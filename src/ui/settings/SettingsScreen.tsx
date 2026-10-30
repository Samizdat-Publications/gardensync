// Settings: your climate (with the gardener's own adjustments), units and look, your gardens and
// data (download, open, backups), the assistant, and about. Layout from A-settings.dc.html.
import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { adjustFrost, resetFrost } from '../../domain/climate/adjust';
import type { ClimateProfile } from '../../domain/climate/types';
import { circularDoy } from '../../domain/dates';
import { exportFileName, parseImportFile, toExportFile } from '../../domain/doc/exportFile';
import type { Op } from '../../domain/doc/ops';
import { encodeShare } from '../../domain/doc/share';
import { formatTemp, type Units } from '../../domain/units';
import { MODELS, forgetKey, readKey, readModel } from '../../platform/anthropic';
import { listBackups, readBackup, takeSnapshot } from '../../platform/storage';
import { lastCompleteYears, profileForPlace, type PlaceHit } from '../../platform/openmeteo';
import { APP_VERSION } from '../../version';
import { adoptDoc, garden, newId, store, today, units } from '../appState';
import { openAssistant } from '../assistant/open';
import { PlaceSearch, placeErrorText } from '../components/PlaceSearch';
import { fmtMonthDay } from '../format';
import { hrefOf, route } from '../router';
import './Settings.css';

const SECTIONS = [
  ['climate', 'Your climate'],
  ['units', 'Units and look'],
  ['data', 'Your gardens and data'],
  ['assistant', 'Assistant'],
  ['about', 'About GardenSync'],
] as const;

export function SettingsScreen() {
  const r = route.value;
  const active = r.name === 'settings' ? r.section ?? 'climate' : 'climate';
  useEffect(() => {
    if (r.name === 'settings' && r.section) document.getElementById(r.section)?.scrollIntoView({ block: 'start' });
  }, [active]);

  // On phones the section list is a scrolling strip: mark which ends have more tabs past them, so
  // the CSS can fade that edge instead of cutting a label off with no hint.
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const mark = () => {
      const more = el.scrollWidth - el.clientWidth > 1;
      el.dataset['moreStart'] = String(more && el.scrollLeft > 1);
      el.dataset['moreEnd'] = String(more && el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    };
    mark();
    el.addEventListener('scroll', mark, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(mark);
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', mark);
      ro?.disconnect();
    };
  }, []);

  return (
    <div class="settings">
      <nav aria-label="Settings sections" class="settings-nav" ref={nav}>
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={hrefOf({ name: 'settings', section: id })} aria-current={active === id ? 'true' : undefined}>
            {label}
          </a>
        ))}
      </nav>
      <main class="settings-main">
        <h1 tabIndex={-1} class="settings-title">
          Settings
        </h1>
        <ClimateSection />
        <UnitsSection />
        <DataSection />
        <AssistantSection />
        <AboutSection />
      </main>
    </div>
  );
}

function ClimateSection() {
  const g = garden.value;
  const changing = useSignal(false);
  const busy = useSignal<string | null>(null);
  const error = useSignal<string | null>(null);
  if (!g) return null;
  const c = g.climate;
  const u = units.value;

  const set = (climate: ClimateProfile, label: string) =>
    store.dispatch({ type: 'setClimate', gardenId: g.id, climate }, { label, coalesceKey: `climate:${g.id}` });

  async function pick(place: PlaceHit) {
    busy.value = place.name;
    error.value = null;
    try {
      const profile = await profileForPlace(place, lastCompleteYears(today.value), today.value);
      set(profile, `move the garden to ${place.name}`);
      changing.value = false;
    } catch (err) {
      error.value = placeErrorText(err);
    } finally {
      busy.value = null;
    }
  }

  return (
    <section id="climate" class="panel settings-section" aria-labelledby="climate-h">
      <div class="settings-head">
        <h2 id="climate-h">Your climate</h2>
        <button class="btn" onClick={() => (changing.value = !changing.value)} aria-expanded={changing.value}>
          {garden.value?.climate?.place ? 'Change town' : 'Add your town'}
        </button>
      </div>
      {changing.value ? (
        <div class="settings-change">
          <PlaceSearch id="settings-town" onPick={pick} autoFocus />
          {busy.value ? <p role="status">Reading 30 years of weather records for {busy.value}.</p> : null}
          {error.value ? <p class="settings-error">{error.value} Your dates were not changed.</p> : null}
        </div>
      ) : null}
      {c ? <ClimateDetails climate={c} units={u} onChange={set} /> : <p>No town yet. Choose one so every date fits your garden.</p>}
    </section>
  );
}

function ClimateDetails({ climate: c, units: u, onChange }: { climate: ClimateProfile; units: Units; onChange: (c: ClimateProfile, label: string) => void }) {
  const where = c.place ? [c.place.name, c.place.region, c.place.country].filter(Boolean).join(', ') : null;
  const source =
    c.source === 'computed' && c.years
      ? `Worked out from daily weather records for ${c.years[0]} to ${c.years[1]}, on a grid about 10 km across, so a frost pocket or a sheltered yard can differ. If your garden runs earlier or later, move a date: every plan in the app follows.`
      : 'From frost dates you typed in. Add your town to let GardenSync allow for summer heat as well.';
  const adjusted = c.adjustedDays;
  const season =
    c.lastFrost.p50 && c.firstFrost.p50 ? (((circularDoy(c.firstFrost.p50) - circularDoy(c.lastFrost.p50)) % 365) + 365) % 365 : null;
  return (
    <>
      <p class="muted">
        {where ? <strong class="settings-place">{where}. </strong> : null}
        {source}
      </p>
      {c.frostClass !== 'frost' ? (
        <p class="settings-callout">
          {c.frostClass === 'none'
            ? 'Frost almost never comes here, so dates follow temperature instead.'
            : 'Frost comes only in some winters here. Dates follow temperature, with a warning for tender crops in the coldest weeks.'}
        </p>
      ) : null}
      <div class="frost-pickers">
        {c.lastFrost.p50 ? (
          <FrostPicker
            legend="Last spring frost, typical year"
            value={c.lastFrost.p50}
            note={c.lastFrost.p90 ? `Tender plants wait for ${fmtMonthDay(c.lastFrost.p90)}, safe 9\u00a0years in\u00a010` : ''}
            shiftedDays={adjusted?.lastFrost ?? 0}
            onShift={(d) => onChange(adjustFrost(c, 'lastFrost', d), 'move the last frost date')}
          />
        ) : null}
        {c.firstFrost.p50 ? (
          <FrostPicker
            legend="First fall frost, typical year"
            value={c.firstFrost.p50}
            note={c.firstFrost.p10 ? `In 1\u00a0year in\u00a010 it came by ${fmtMonthDay(c.firstFrost.p10)}` : ''}
            shiftedDays={adjusted?.firstFrost ?? 0}
            onShift={(d) => onChange(adjustFrost(c, 'firstFrost', d), 'move the first frost date')}
          />
        ) : null}
      </div>
      <p>
        {c.zone ? `USDA-style zone ${c.zone}. ` : ''}
        {c.extremeMinC !== null ? `Typical coldest night ${formatTemp(c.extremeMinC, u)}. ` : ''}
        {season !== null ? `${season} frost-free days. ` : ''}
        {adjusted ? (
          <button class="btn btn-quiet inline-btn" onClick={() => onChange(resetFrost(c), 'reset the frost dates')}>
            Reset to the computed dates
          </button>
        ) : null}
      </p>
      {c.monthly ? <MonthlyChart climate={c} units={u} /> : null}
    </>
  );
}

function FrostPicker(props: { legend: string; value: string; note: string; shiftedDays: number; onShift: (days: number) => void }) {
  return (
    <fieldset class="frost-picker">
      <legend>{props.legend}</legend>
      <div class="frost-picker-row">
        <button class="btn btn-icon" aria-label="One week earlier" onClick={() => props.onShift(-7)}>
          &#8722;
        </button>
        <output class="frost-value" aria-live="polite">
          {fmtMonthDay(props.value)}
        </output>
        <button class="btn btn-icon" aria-label="One week later" onClick={() => props.onShift(7)}>
          +
        </button>
      </div>
      {props.note ? <span class="muted small">{props.note}</span> : null}
      {props.shiftedDays !== 0 ? (
        <span class="small">
          Moved {Math.abs(props.shiftedDays / 7)} {Math.abs(props.shiftedDays) === 7 ? 'week' : 'weeks'} {props.shiftedDays > 0 ? 'later' : 'earlier'} than computed
        </span>
      ) : null}
    </fieldset>
  );
}

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function MonthlyChart({ climate, units: u }: { climate: ClimateProfile; units: Units }) {
  const m = climate.monthly!;
  const lo = Math.min(...m.minC) - 2;
  const hi = Math.max(...m.maxC) + 2;
  const y = (t: number) => 10 + (1 - (t - lo) / (hi - lo)) * 110;
  const x = (i: number) => 24 + i * 40;
  const line = (vals: number[]) => vals.map((t, i) => `${i === 0 ? 'M' : 'L'}${x(i)} ${y(t).toFixed(1)}`).join(' ');
  const frostMonths = m.minC.map((t) => t <= 0);
  return (
    <figure class="climate-chart">
      <figcaption class="muted small">Average daily high (solid) and low (dashed) by month. Shaded months have frosty nights on average.</figcaption>
      <svg viewBox="0 0 480 150" role="img" aria-labelledby="chart-desc">
        <desc id="chart-desc">
          {MONTH_NAMES.map((name, i) => `${name}: high ${formatTemp(m.maxC[i]!, u)}, low ${formatTemp(m.minC[i]!, u)}`).join('. ')}
        </desc>
        {frostMonths.map((f, i) => (f ? <rect key={i} x={x(i) - 20} y="0" width="40" height="125" fill="var(--c-frost-soft)" /> : null))}
        {lo < 0 && hi > 0 ? <path d={`M4 ${y(0)} H476`} stroke="var(--c-frost)" stroke-width="1" stroke-dasharray="3 3" /> : null}
        <path d={line(m.maxC)} fill="none" stroke="var(--c-caution)" stroke-width="2.5" stroke-linejoin="round" />
        <path d={line(m.minC)} fill="none" stroke="var(--c-frost)" stroke-width="2.5" stroke-dasharray="6 4" stroke-linejoin="round" />
        {MONTHS.map((l, i) => (
          <text key={i} x={x(i)} y="145" text-anchor="middle" font-size="12" fill="var(--c-muted)">
            {l}
          </text>
        ))}
      </svg>
    </figure>
  );
}

function UnitsSection() {
  const s = store.doc.value.settings;
  const set = (patch: Partial<typeof s>) => store.dispatch({ type: 'updateSettings', patch }, { label: 'change a setting' });
  return (
    <section id="units" class="panel settings-section" aria-labelledby="units-h">
      <h2 id="units-h">Units and look</h2>
      <div class="settings-cols">
        <fieldset class="settings-radios">
          <legend>Measurements</legend>
          <label>
            <input type="radio" name="units" checked={s.units === 'imperial'} onChange={() => set({ units: 'imperial' })} />
            Feet, pounds, Fahrenheit
          </label>
          <label>
            <input type="radio" name="units" checked={s.units === 'metric'} onChange={() => set({ units: 'metric' })} />
            Meters, kilograms, Celsius
          </label>
        </fieldset>
        <fieldset class="settings-radios">
          <legend>Appearance</legend>
          {(
            [
              ['system', 'Match this device'],
              ['light', 'Light'],
              ['dark', 'Dark'],
            ] as const
          ).map(([v, label]) => (
            <label key={v}>
              <input type="radio" name="theme" checked={s.theme === v} onChange={() => set({ theme: v })} />
              {label}
            </label>
          ))}
        </fieldset>
      </div>
    </section>
  );
}

function DataSection() {
  const fileInput = useRef<HTMLInputElement>(null);
  const message = useSignal<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const backups = useSignal(listBackups(localStorage));
  const lastExport = store.doc.value.settings.lastExportAt;

  function download() {
    const text = toExportFile(store.doc.value, new Date().toISOString(), APP_VERSION);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName(today.value);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    store.dispatch({ type: 'updateSettings', patch: { lastExportAt: today.value } }, { label: 'download a copy' });
    message.value = { kind: 'ok', text: 'Downloaded. Keep the file somewhere safe; open it here to bring the garden back.' };
  }

  async function openFile(file: File) {
    const text = await file.text();
    const res = parseImportFile(text, { today: today.value, newId, tzOffsetMinutes: -new Date().getTimezoneOffset() });
    if (res.kind === 'error') {
      message.value = { kind: 'error', text: res.message };
      return;
    }
    takeSnapshot(localStorage, store.doc.value, 'before opening a copy', new Date().toISOString());
    if (res.kind === 'doc') {
      adoptDoc(res.doc);
      message.value = { kind: 'ok', text: 'Opened. What was here before is kept in Backups.' };
    } else {
      const d = store.doc.value;
      adoptDoc({ ...d, gardens: [...d.gardens, res.garden], settings: { ...d.settings, activeGardenId: res.garden.id } });
      message.value = { kind: 'ok', text: `Brought across a garden from version 7: ${res.report.containers} beds and pots, ${res.report.plants} plants.` };
    }
    backups.value = listBackups(localStorage);
  }

  function restore(key: string) {
    const doc = readBackup(localStorage, key);
    if (!doc) return;
    takeSnapshot(localStorage, store.doc.value, 'before restoring a backup', new Date().toISOString());
    adoptDoc(doc);
    backups.value = listBackups(localStorage);
    message.value = { kind: 'ok', text: 'Restored. What was here before is kept in Backups.' };
  }

  return (
    <section id="data" class="panel settings-section" aria-labelledby="data-h">
      <h2 id="data-h">Your gardens and data</h2>
      <GardensPanel />
      <p class="muted">
        Everything is saved in this browser as you go, with a backup each day for a week. Clearing this site's data deletes it, so download a copy now and then.
      </p>
      <div class="row">
        <button class="btn btn-primary" onClick={download}>
          Download a copy
        </button>
        <button class="btn" onClick={() => fileInput.current?.click()}>
          Open a saved copy
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (f) void openFile(f);
            (e.target as HTMLInputElement).value = '';
          }}
        />
        <ShareButton />
      </div>
      <p class="muted small">{lastExport ? `Last downloaded on ${lastExport}.` : 'Not downloaded yet.'}</p>
      {message.value ? (
        <p role="status" class={message.value.kind === 'error' ? 'settings-error' : 'settings-ok'}>
          {message.value.text}
        </p>
      ) : null}
      {backups.value.length > 0 ? (
        <details class="backups">
          <summary>Backups ({backups.value.length})</summary>
          <ul>
            {backups.value.map((b) => (
              <li key={b.key}>
                <span>
                  {b.kind === 'daily' ? `Daily backup, ${b.label}` : `Copy kept ${b.label.replace(/@.*/, '').replace(/-/g, ' ')}`}
                  <span class="muted">, {b.gardens} {b.gardens === 1 ? 'garden' : 'gardens'}</span>
                </span>
                <button class="btn" onClick={() => restore(b.key)}>
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

/** Every garden in this browser: switch, rename, add, delete. */
function GardensPanel() {
  const d = store.doc.value;
  const active = garden.value;
  const naming = useSignal<string | null>(null);
  const name = useSignal('');
  const deleting = useSignal<string | null>(null);
  const error = useSignal('');

  function rename(e: Event, id: string) {
    e.preventDefault();
    const res = store.dispatch({ type: 'renameGarden', gardenId: id, name: name.value }, { label: 'rename the garden' });
    if (res.ok) naming.value = null;
    else error.value = res.error;
  }

  function add() {
    const id = newId();
    const n = d.gardens.length + 1;
    const ops: Op[] = [
      { type: 'addGarden', garden: { id, name: `Garden ${n}`, createdAt: today.value, cellCm: active?.cellCm ?? 30.48 } },
      // A second garden is usually in the same town, so it starts with the same climate.
      ...(active?.climate ? [{ type: 'setClimate' as const, gardenId: id, climate: active.climate }] : []),
      { type: 'setActiveGarden', gardenId: id },
    ];
    const res = store.dispatch({ type: 'batch', ops }, { label: 'add a garden' });
    if (res.ok) {
      naming.value = id;
      name.value = `Garden ${n}`;
    } else error.value = res.error;
  }

  return (
    <div class="gardens">
      <ul class="gardens-list">
        {d.gardens.map((g) => (
          <li key={g.id} class={g.id === active?.id ? 'is-active' : ''}>
            {naming.value === g.id ? (
              <form class="row" onSubmit={(e) => rename(e, g.id)}>
                <label for={`gn-${g.id}`} class="visually-hidden">
                  Garden name
                </label>
                <input id={`gn-${g.id}`} class="input" value={name.value} maxLength={80} autoFocus onInput={(e) => (name.value = (e.target as HTMLInputElement).value)} />
                <button class="btn btn-primary" type="submit">
                  Save
                </button>
                <button class="btn" type="button" onClick={() => (naming.value = null)}>
                  Cancel
                </button>
              </form>
            ) : deleting.value === g.id ? (
              <div class="row">
                <span>
                  Delete <strong>{g.name}</strong> and everything in it? A backup from today keeps a copy.
                </span>
                <button
                  class="btn btn-danger"
                  onClick={() => {
                    store.dispatch({ type: 'removeGarden', gardenId: g.id }, { label: 'delete a garden' });
                    deleting.value = null;
                  }}
                >
                  Delete
                </button>
                <button class="btn" onClick={() => (deleting.value = null)}>
                  Keep it
                </button>
              </div>
            ) : (
              <>
                <span class="gardens-name">
                  <strong>{g.name}</strong>
                  <span class="muted">
                    {' '}
                    {g.containers.length} {g.containers.length === 1 ? 'bed or pot' : 'beds and pots'}
                    {g.climate?.place ? `, ${g.climate.place.name}` : ''}
                    {g.id === active?.id ? ', open now' : ''}
                  </span>
                </span>
                <span class="row">
                  {g.id !== active?.id ? (
                    <button class="btn" onClick={() => store.dispatch({ type: 'setActiveGarden', gardenId: g.id }, { label: 'switch gardens' })}>
                      Open
                    </button>
                  ) : null}
                  <button
                    class="btn"
                    onClick={() => {
                      naming.value = g.id;
                      name.value = g.name;
                      error.value = '';
                    }}
                  >
                    Rename
                  </button>
                  {d.gardens.length > 1 ? (
                    <button class="btn" onClick={() => (deleting.value = g.id)}>
                      Delete
                    </button>
                  ) : null}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      <div class="row">
        <button class="btn" onClick={add}>
          Add another garden
        </button>
      </div>
      {error.value ? (
        <p role="alert" class="settings-error">
          {error.value}
        </p>
      ) : null}
    </div>
  );
}

/** Inline share button: sits in the data button row, expands a share box below. */
function ShareButton() {
  const g = garden.value;
  const open = useSignal(false);
  const withPlace = useSignal(false);
  const link = useSignal<string | null>(null);
  const copied = useSignal(false);
  if (!g) return null;
  async function make() {
    const payload = await encodeShare(g!, { includeLocation: withPlace.value });
    link.value = `${location.origin}${location.pathname}#share=${payload}`;
    copied.value = false;
  }
  return (
    <>
      <button class="btn" aria-expanded={open.value} onClick={() => (open.value = !open.value)}>
        Share a link
      </button>
      {open.value ? (
        <div class="panel share-box share-box-inline">
          <p>
            A link that opens a copy of <strong>{g.name}</strong>: its beds, pots and plantings. Harvests and notes stay here.
          </p>
          <label class="share-check">
            <input type="checkbox" checked={withPlace.value} onChange={(e) => { withPlace.value = (e.target as HTMLInputElement).checked; link.value = null; }} />
            Include my town and frost dates (the position is rounded to about 10 km)
          </label>
          <button class="btn btn-primary" onClick={() => void make()}>
            Make the link
          </button>
          {link.value ? (
            <div class="field">
              <label for="share-link">Link</label>
              <div class="row">
                <input id="share-link" class="input share-input" readOnly value={link.value} onFocus={(e) => (e.target as HTMLInputElement).select()} />
                <button
                  class="btn"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(link.value!);
                      copied.value = true;
                    } catch {
                      copied.value = false;
                    }
                  }}
                >
                  Copy
                </button>
              </div>
              <span role="status" class="muted small">
                {copied.value ? 'Copied.' : `${link.value.length.toLocaleString('en-US')} characters`}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function AssistantSection() {
  const hasKey = useSignal(readKey() !== null);
  return (
    <section id="assistant" class="panel settings-section" aria-labelledby="assistant-h">
      <h2 id="assistant-h">Assistant</h2>
      <p>
        An optional helper that can answer questions about your garden, plan a bed for you to review, and read a seed packet from a photo into a new variety. It runs on Claude with your
        own Anthropic API key, charged to your Anthropic account. Nothing else in GardenSync needs a key.
      </p>
      <p class="muted">
        {hasKey.value
          ? `A key is saved in this browser. Model: ${MODELS.find((m) => m.id === readModel())?.label ?? readModel()}.`
          : 'No key saved. The key stays in this browser only and never goes into downloads, share links or backups.'}
      </p>
      <div class="row">
        <button class="btn btn-primary" onClick={openAssistant}>
          {hasKey.value ? 'Open the assistant' : 'Set up the assistant'}
        </button>
        {hasKey.value ? (
          <button
            class="btn"
            onClick={() => {
              forgetKey();
              hasKey.value = false;
            }}
          >
            Forget my key
          </button>
        ) : null}
      </div>
    </section>
  );
}

/** "8.0", or "8.0 preview" for a build before the release. */
function shownVersion(): string {
  const [major, minor] = APP_VERSION.split('.');
  return `${major}.${minor}${APP_VERSION.includes('-') ? ' preview' : ''}`;
}

function AboutSection() {
  return (
    <section id="about" class="panel settings-section" aria-labelledby="about-h">
      <h2 id="about-h">About GardenSync</h2>
      <p>
        GardenSync {shownVersion()}. Free and open source under the MIT license:{' '}
        <a href="https://github.com/Samizdat-Publications/gardensync" target="_blank" rel="noopener">
          source on GitHub
        </a>
        .
      </p>
      <p class="muted">
        Weather records and forecasts from{' '}
        <a href="https://open-meteo.com/" target="_blank" rel="noopener">
          Open-Meteo
        </a>{' '}
        (CC BY 4.0). Plant timings from university extension services, the Royal Horticultural Society and other growing guides, cited on each plant. Typefaces: Bricolage Grotesque and
        Atkinson Hyperlegible Next (SIL Open Font License).
      </p>
      <p class="muted">
        A calmer sister edition,{' '}
        <a href="https://gardensync-almanac.pages.dev" target="_blank" rel="noopener">
          A Quiet Almanac
        </a>
        , takes a different approach to the same idea.
      </p>
    </section>
  );
}
