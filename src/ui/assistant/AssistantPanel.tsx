// The optional assistant: a modal side panel over a dimmed page (a near full-height sheet on a
// phone) where the gardener asks about their
// garden in words, or shows it a seed packet. Layout from A-assistant.dc.html.
//
// It needs the gardener's own Anthropic key; without one the panel explains what it is and asks for
// it. Changes the model proposes collect in a card and only reach the garden when the gardener
// presses Apply, as one batch op, so one Undo takes them all back. Model text is shown as plain text.
import type Anthropic from '@anthropic-ai/sdk';
import { signal, useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import type { Op } from '../../domain/doc/ops';
import type { GardenDoc } from '../../domain/doc/schema';
import { DEFAULT_MODEL, MODELS, forgetKey, looksLikeKey, readKey, readModel, runTurn, saveKey, saveModel, type ModelId, type Turn } from '../../platform/anthropic';
import { preparePhoto, type Photo } from '../../platform/image';
import { garden, newId, store, today, units } from '../appState';
import { assistantOpen } from './open';
import { SYSTEM_PROMPT } from './prompt';
import { TOOL_DEFS, runTool } from './tools';
import './Assistant.css';

type Item = { kind: 'user'; text: string; photo?: string } | { kind: 'assistant'; text: string } | { kind: 'note'; text: string; error?: boolean };

interface Pending {
  ops: Op[];
  summaries: { text: string; removes: boolean }[];
  draft: GardenDoc;
  /** The live document the draft was built on. If the garden has changed since, the squares and
   * dates the assistant chose may no longer hold, so the proposal is not applied. */
  base: GardenDoc;
  gardenId: string;
}

const STALE_NOTE = 'Your garden changed after the assistant made that proposal, so the squares it chose may be taken. Nothing was applied; ask it again.';
const STALE_OUTCOME = 'Your last proposal was dropped unapplied because the gardener changed the garden meanwhile. Call get_garden again before proposing.';

// The conversation lasts as long as the page: it is not saved, exported or shared.
const items = signal<Item[]>([]);
const history: Turn[] = [];
const pending = signal<Pending | null>(null);
/** What happened to the last proposal, told to the model with the next message. */
let outcome: string | null = null;

/** Forgets the whole conversation (New chat, or when the key is forgotten). */
export function resetChat(): void {
  items.value = [];
  history.length = 0;
  pending.value = null;
  outcome = null;
}

export function AssistantPanel() {
  const key = useSignal(readKey());
  const setup = useSignal(key.value === null);
  const busy = useSignal(false);
  const live = useSignal('');
  const draft = useSignal('');
  const photo = useSignal<Photo | null>(null);
  const abort = useRef<AbortController | null>(null);
  const listEnd = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    heading.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Only while the gardener is in the panel; Escape elsewhere belongs to that screen.
      if (e.key === 'Escape' && (panel.current?.contains(document.activeElement) || document.activeElement === document.body)) closePanel();
      if (e.key === 'Tab') keepFocusInside(e);
    };
    addEventListener('keydown', onKey);
    // The page behind is dimmed and inert: hold it still where it was, and put it back on close.
    const root = document.documentElement;
    const y = scrollY;
    document.body.style.setProperty('--as-lock-top', `${-y}px`);
    root.classList.add('assistant-open');
    return () => {
      removeEventListener('keydown', onKey);
      root.classList.remove('assistant-open');
      document.body.style.removeProperty('--as-lock-top');
      scrollTo(0, y);
    };
  }, []);

  /** Tab and Shift+Tab cycle through the panel's controls, since the page behind is covered. */
  function keepFocusInside(e: KeyboardEvent) {
    const box = panel.current;
    if (!box) return;
    const all = box.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const items = Array.from(all).filter((el) => el.getClientRects().length > 0);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    const at = document.activeElement;
    if (!box.contains(at)) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && (at === first || at === heading.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && at === last) {
      e.preventDefault();
      first.focus();
    }
  }
  useEffect(() => listEnd.current?.scrollIntoView({ block: 'end' }), [items.value.length, live.value, pending.value]);

  const g = garden.value;
  function closePanel() {
    abort.current?.abort();
    assistantOpen.value = false;
    // Back to the button that opened it, for keyboard users.
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.assistant-link')?.focus());
  }

  async function send(e: Event) {
    e.preventDefault();
    const text = draft.value.trim();
    if ((!text && !photo.value) || busy.value || !key.value || !g) return;
    const pic = photo.value;
    draft.value = '';
    photo.value = null;
    items.value = [...items.value, { kind: 'user', text, ...(pic ? { photo: pic.dataUrl } : {}) }];

    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (pic)
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: pic.base64 },
      });
    const lead = outcome ? `(${outcome}) ` : '';
    outcome = null;
    content.push({ type: 'text', text: lead + (text || 'What is this?') });

    let prior = pending.value?.gardenId === g.id ? pending.value : null;
    if (prior && prior.base !== store.doc.value) {
      prior = null;
      pending.value = null;
      items.value = [...items.value, { kind: 'note', text: STALE_NOTE, error: true }];
      content.unshift({ type: 'text', text: `(${STALE_OUTCOME})` });
    }
    history.push({ role: 'user', content });

    busy.value = true;
    live.value = '';
    const ctl = new AbortController();
    abort.current = ctl;
    const before = prior;
    let work: Pending = prior ?? {
      ops: [],
      summaries: [],
      draft: store.doc.value,
      base: store.doc.value,
      gardenId: g.id,
    };

    try {
      const end = await runTurn({
        key: key.value,
        model: readModel(),
        system: SYSTEM_PROMPT,
        tools: TOOL_DEFS,
        messages: history,
        signal: ctl.signal,
        onText: (d) => (live.value += d),
        onRestart: () => (live.value = ''),
        runTool: (name, input) => {
          // A tool call starts a new paragraph of model text after it.
          if (live.value.trim()) {
            items.value = [...items.value, { kind: 'assistant', text: live.value.trim() }];
            live.value = '';
          }
          const r = runTool(name, input, {
            doc: work.draft,
            gardenId: g.id,
            today: today.value,
            units: units.value,
            newId,
          });
          if (r.change) {
            work = {
              ...work,
              ops: [...work.ops, r.change.op],
              summaries: [...work.summaries, { text: r.change.summary, removes: r.change.removes }],
              draft: r.change.doc,
            };
            pending.value = work;
          }
          return { text: r.text, isError: r.isError };
        },
      });

      if (live.value.trim()) items.value = [...items.value, { kind: 'assistant', text: live.value.trim() }];
      // A turn that did not finish is taken out of the history the model sees, so what it queued goes too.
      if (end.kind !== 'done') pending.value = before;
      if (end.kind === 'stopped') items.value = [...items.value, { kind: 'note', text: 'Stopped. Nothing from that reply was kept.' }];
      if (end.kind === 'refused') items.value = [...items.value, { kind: 'note', text: 'The assistant declined to answer that one.' }];
      if (end.kind === 'limit')
        items.value = [
          ...items.value,
          {
            kind: 'note',
            text: 'The assistant stopped after a long run of steps. Ask again, a piece at a time.',
          },
        ];
      if (end.kind === 'error') {
        items.value = [...items.value, { kind: 'note', text: end.message, error: true }];
        if (end.badKey) setup.value = true;
      }
    } finally {
      live.value = '';
      busy.value = false;
      abort.current = null;
    }
  }

  function apply() {
    const p = pending.value;
    if (!p) return;
    focusInput();
    if (p.base !== store.doc.value) {
      pending.value = null;
      outcome = STALE_OUTCOME;
      items.value = [...items.value, { kind: 'note', text: STALE_NOTE, error: true }];
      return;
    }
    const res = store.dispatch({ type: 'batch', ops: p.ops }, { label: "the assistant's changes" });
    pending.value = null;
    if (res.ok) {
      outcome = 'The gardener applied your proposed changes.';
      items.value = [
        ...items.value,
        {
          kind: 'note',
          text: `Applied ${p.ops.length} ${p.ops.length === 1 ? 'change' : 'changes'}. Undo takes them all back.`,
        },
      ];
    } else {
      outcome = 'Your proposed changes could not be applied because the garden changed meanwhile; nothing was changed.';
      items.value = [
        ...items.value,
        {
          kind: 'note',
          text: 'Those changes no longer fit the garden (it changed meanwhile), so nothing was applied. Ask again.',
          error: true,
        },
      ];
    }
  }

  /** The Apply and Discard buttons go away once pressed; keep keyboard focus in the panel. */
  const focusInput = () => requestAnimationFrame(() => document.getElementById('as-input')?.focus());

  function discard() {
    focusInput();
    pending.value = null;
    outcome = 'The gardener discarded your proposed changes; nothing was changed.';
    items.value = [...items.value, { kind: 'note', text: 'Discarded. Nothing in the garden changed.' }];
  }

  async function attach(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      photo.value = await preparePhoto(file);
    } catch {
      items.value = [
        ...items.value,
        {
          kind: 'note',
          text: 'That photo could not be read. Try a JPEG or PNG.',
          error: true,
        },
      ];
    }
  }

  return (
    <>
      {/* The dimmed page behind: a click on it closes the panel. Not focusable; Escape and the close button do the same. */}
      <div class="as-scrim" aria-hidden="true" onClick={closePanel} />
      <div class="assistant" role="dialog" aria-modal="true" aria-labelledby="as-h" ref={panel}>
        <header class="as-head">
          <h2 id="as-h" tabIndex={-1} ref={heading}>
            Ask about your garden
          </h2>
          {key.value && !setup.value && items.value.length > 0 ? (
            <button class="btn btn-quiet" onClick={resetChat} disabled={busy.value}>
              New chat
            </button>
          ) : null}
          {key.value && !setup.value ? (
            <button class="btn btn-quiet" onClick={() => (setup.value = true)}>
              Key and model
            </button>
          ) : null}
          <button class="btn btn-icon" aria-label="Close the assistant" onClick={closePanel}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M4 4l10 10M14 4 4 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </header>

        {setup.value ? (
          <KeySetup
            hasKey={key.value !== null}
            onSaved={(k) => {
              key.value = k;
              setup.value = false;
            }}
            onForget={() => {
              forgetKey();
              resetChat();
              key.value = null;
            }}
            onCancel={key.value ? () => (setup.value = false) : null}
          />
        ) : (
          <>
            <div class="as-log" aria-live="polite">
              {items.value.length === 0 ? (
                <p class="muted as-empty">
                  Ask for a plan ("lay out the new 4 by 4 bed for salsa"), a question about timing, or attach a photo of a seed packet to add that variety.
                </p>
              ) : null}
              {items.value.map((it, i) =>
                it.kind === 'user' ? (
                  <div key={i} class="as-msg as-user">
                    {it.photo ? <img src={it.photo} alt="Your photo" class="as-photo" /> : null}
                    {it.text ? <Paragraphs text={it.text} /> : null}
                  </div>
                ) : it.kind === 'assistant' ? (
                  <div key={i} class="as-msg as-model">
                    <Paragraphs text={it.text} />
                  </div>
                ) : (
                  <p key={i} class={it.error ? 'as-note as-error' : 'as-note'} role={it.error ? 'alert' : undefined}>
                    {it.text}
                  </p>
                ),
              )}
              {live.value ? (
                <div class="as-msg as-model">
                  <Paragraphs text={live.value} />
                </div>
              ) : busy.value ? (
                <p class="as-note">Thinking.</p>
              ) : null}
              {pending.value && pending.value.gardenId === g?.id ? (
                <section class="as-changes" aria-labelledby="as-ch">
                  <h3 id="as-ch">Proposed changes</h3>
                  <ul>
                    {pending.value.summaries.map((s, i) => (
                      <li key={i} class={s.removes ? 'as-remove' : undefined}>
                        {s.removes ? <strong>Remove: </strong> : null}
                        {s.removes ? s.text.replace(/^Remove /, '') : s.text}
                      </li>
                    ))}
                  </ul>
                  <div class="row">
                    <button class="btn btn-primary" onClick={apply} disabled={busy.value}>
                      Apply to the garden
                    </button>
                    <button class="btn" onClick={discard} disabled={busy.value}>
                      Discard
                    </button>
                  </div>
                  <p class="muted small">You can undo this as one step.</p>
                </section>
              ) : null}
              <div ref={listEnd} />
            </div>

            <form class="as-compose" onSubmit={send}>
              {photo.value ? (
                <div class="as-attached">
                  <img src={photo.value.dataUrl} alt="Photo to send" />
                  <button type="button" class="btn" onClick={() => (photo.value = null)}>
                    Remove photo
                  </button>
                </div>
              ) : null}
              <label for="as-input" class="visually-hidden">
                Message
              </label>
              <textarea
                id="as-input"
                class="input as-input"
                rows={2}
                value={draft.value}
                placeholder={g ? 'Message' : 'Add a garden first'}
                disabled={!g}
                onInput={(e) => (draft.value = (e.target as HTMLTextAreaElement).value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    (e.currentTarget.form as HTMLFormElement).requestSubmit();
                  }
                }}
              />
              <div class="as-actions">
                <label class="btn">
                  Add a photo
                  <input type="file" accept="image/*" class="visually-hidden" onChange={attach} />
                </label>
                {busy.value ? (
                  <button type="button" class="btn" onClick={() => abort.current?.abort()}>
                    Stop
                  </button>
                ) : (
                  <button type="submit" class="btn btn-primary" disabled={!g || (!draft.value.trim() && !photo.value)}>
                    Send
                  </button>
                )}
              </div>
              <p class="muted small">Runs on Claude with your own Anthropic key. Answers can be wrong; dates in your calendar come from GardenSync, not the chat.</p>
            </form>
          </>
        )}
      </div>
    </>
  );
}

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </>
  );
}

function KeySetup(props: { hasKey: boolean; onSaved: (key: string) => void; onForget: () => void; onCancel: (() => void) | null }) {
  const value = useSignal('');
  const model = useSignal<ModelId>(readModel());
  const error = useSignal('');

  function submit(e: Event) {
    e.preventDefault();
    saveModel(model.value);
    const k = value.value.trim();
    if (!k && props.hasKey && props.onCancel) {
      props.onCancel();
      return;
    }
    if (!looksLikeKey(k)) {
      error.value = 'That does not look like an Anthropic API key. Keys start with sk-ant-.';
      return;
    }
    if (!saveKey(k)) {
      error.value = 'This browser would not store the key (private browsing can block it).';
      return;
    }
    props.onSaved(k);
  }

  return (
    <form class="as-setup" onSubmit={submit}>
      <p>
        The assistant is optional. It can read your garden, answer questions, plan a bed for you to review, and read a seed packet photo into a new variety. Everything else in
        GardenSync works without it.
      </p>
      <p>
        It runs on Claude and needs your own Anthropic API key; messages are charged to your Anthropic account. Get a key from{' '}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
          the Anthropic Console
        </a>
        .
      </p>
      <p class="muted">
        The key is kept only in this browser. It is never put in exports, share links or backups, and it is sent only to Anthropic. Your garden is sent to Anthropic only while you
        use the assistant.
      </p>
      <div class="field">
        <label for="as-key">{props.hasKey ? 'Replace your API key' : 'Your Anthropic API key'}</label>
        <input
          id="as-key"
          class="input"
          type="password"
          autoComplete="off"
          spellcheck={false}
          placeholder={props.hasKey ? 'Leave empty to keep the saved key' : 'sk-ant-...'}
          value={value.value}
          aria-invalid={error.value ? true : undefined}
          aria-describedby={error.value ? 'as-key-err' : undefined}
          onInput={(e) => {
            value.value = (e.target as HTMLInputElement).value;
            error.value = '';
          }}
        />
        {error.value ? (
          <p id="as-key-err" class="as-error" role="alert">
            {error.value}
          </p>
        ) : null}
      </div>
      <fieldset class="field as-models">
        <legend>Model</legend>
        {MODELS.map((m) => (
          <label key={m.id} class="as-model">
            <input type="radio" name="as-model" value={m.id} checked={model.value === m.id} onChange={() => (model.value = m.id)} />
            <span>
              <strong>{m.label}</strong>
              {m.id === DEFAULT_MODEL ? ' (default)' : ''}
              <span class="muted"> {m.note}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div class="row">
        <button class="btn btn-primary" type="submit">
          Save
        </button>
        {props.onCancel ? (
          <button class="btn" type="button" onClick={props.onCancel}>
            Cancel
          </button>
        ) : null}
        {props.hasKey ? (
          <button class="btn" type="button" onClick={props.onForget}>
            Forget my key
          </button>
        ) : null}
      </div>
    </form>
  );
}
