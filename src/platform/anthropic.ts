// The optional assistant's connection to Claude, straight from the browser with the gardener's own
// Anthropic key. Nothing else in GardenSync needs a key.
//
// The key lives in its own localStorage entry, never in the garden document, so it is never in an
// export, a share link, a backup or the undo history, and nothing here logs it. The SDK is loaded
// only when the assistant is first used, so the rest of the app does not carry it.
import type Anthropic from '@anthropic-ai/sdk';

const KEY_STORAGE = 'gardensync.v8.assistant.key';
const MODEL_STORAGE = 'gardensync.v8.assistant.model';

export const MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', note: 'Fast and capable: plans beds and reads seed packets well.' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: 'The most capable, at about twice the price of Sonnet.' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', note: 'By far the cheapest; fine for quick questions, less sure with planning.' },
] as const;
export type ModelId = (typeof MODELS)[number]['id'];
export const DEFAULT_MODEL: ModelId = 'claude-sonnet-5-5';

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function readKey(): string | null {
  return safe(() => localStorage.getItem(KEY_STORAGE), null);
}

export function saveKey(key: string): boolean {
  return safe(() => {
    localStorage.setItem(KEY_STORAGE, key.trim());
    return true;
  }, false);
}

export function forgetKey(): void {
  safe(() => localStorage.removeItem(KEY_STORAGE), undefined);
}

/** A light check before any request: Anthropic API keys start with sk-ant-. */
export function looksLikeKey(key: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key.trim());
}

export function readModel(): ModelId {
  const m = safe(() => localStorage.getItem(MODEL_STORAGE), null);
  return MODELS.some((x) => x.id === m) ? (m as ModelId) : DEFAULT_MODEL;
}

export function saveModel(id: ModelId): void {
  safe(() => localStorage.setItem(MODEL_STORAGE, id), undefined);
}

type Sdk = typeof import('@anthropic-ai/sdk');
let sdk: Promise<Sdk> | null = null;
function loadSdk(): Promise<Sdk> {
  // A failed load (offline, or an old cached page after a new deploy) is not kept, so a retry works.
  sdk ??= import('@anthropic-ai/sdk').catch((err: unknown) => {
    sdk = null;
    throw err;
  });
  return sdk;
}

export type Turn = Anthropic.Beta.BetaMessageParam;

export interface ToolRun {
  text: string;
  isError: boolean;
}

export interface TurnOptions {
  key: string;
  model: ModelId;
  system: string;
  tools: Anthropic.Tool[];
  /** The conversation so far. New assistant turns and tool results are appended to it in place. */
  messages: Turn[];
  /** Runs one tool call. Inputs are untrusted: the callee validates them. */
  runTool: (name: string, input: unknown) => ToolRun;
  onText: (delta: string) => void;
  /** The current reply is being re-requested (a tool input did not parse); drop its partial text. */
  onRestart: () => void;
  signal: AbortSignal;
}

export type TurnEnd =
  | { kind: 'done' }
  | { kind: 'stopped' }
  | { kind: 'refused' }
  | { kind: 'limit' }
  | { kind: 'error'; message: string; badKey?: boolean };

/** Each request may call tools; stop after this many rounds so a confused turn can't run up a bill. */
const MAX_ROUNDS = 12;

/**
 * One gardener message through to the model's final reply: stream text, run the tools it asks for,
 * send the results back, repeat. Thinking blocks and everything else the model returned are kept in
 * `messages` exactly as they came, so the history stays append-only.
 */
export async function runTurn(o: TurnOptions): Promise<TurnEnd> {
  // On any ending but a finished reply, the history goes back to how it was, so a half-done turn
  // (a tool call with no result) can never make every later request fail. Only entries this turn
  // appended are dropped; nothing earlier is edited.
  const mark = o.messages.length;
  const end = await turn(o);
  if (end.kind !== 'done') o.messages.length = mark;
  return end;
}

async function turn(o: TurnOptions): Promise<TurnEnd> {
  let mod: Sdk;
  try {
    mod = await loadSdk();
  } catch {
    return { kind: 'error', message: 'The assistant could not load. Check your connection, or reload the page.' };
  }
  const { default: Client, APIError, AuthenticationError, PermissionDeniedError, RateLimitError, APIConnectionError, APIUserAbortError } = mod;
  const client = new Client({ apiKey: o.key, dangerouslyAllowBrowser: true, maxRetries: 2 });
  // Server-side fallback re-runs a declined request on another model; Haiku has none.
  const fallback = o.model === 'claude-haiku-5-5' ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const };
  const tools = o.tools.map((t) => ({ ...t, eager_input_streaming: true }));
  let jsonRetries = 0;

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const stream = client.beta.messages.stream(
        {
          model: o.model,
          max_tokens: 16000,
          output_config: { effort: 'medium' },
          cache_control: { type: 'ephemeral' },
          system: o.system,
          tools,
          messages: o.messages,
          ...fallback,
        },
        { signal: o.signal },
      );
      stream.on('text', (delta) => o.onText(delta));

      let message: Anthropic.Beta.BetaMessage;
      try {
        message = await stream.finalMessage();
        jsonRetries = 0;
      } catch (err) {
        // Only a tool input that could not be parsed is retried; API errors go to the outer catch.
        if (err instanceof APIError || err instanceof APIUserAbortError || jsonRetries++ >= 2) throw err;
        o.onRestart();
        round--;
        continue;
      }

      if (message.stop_reason === 'refusal') return { kind: 'refused' };
      o.messages.push({ role: 'assistant', content: message.content });
      if (message.stop_reason === 'pause_turn') continue;

      const calls = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
      if (calls.length === 0) return { kind: 'done' };
      if (message.stop_reason === 'max_tokens') return { kind: 'error', message: 'The reply was cut off before it finished. Try asking for less at once.' };

      const results: Anthropic.Beta.BetaToolResultBlockParam[] = calls.map((call) => {
        let r: ToolRun;
        try {
          r = o.runTool(call.name, call.input);
        } catch {
          r = { text: 'That tool failed unexpectedly. Try a different request.', isError: true };
        }
        return { type: 'tool_result', tool_use_id: call.id, content: r.text, ...(r.isError ? { is_error: true } : {}) };
      });
      o.messages.push({ role: 'user', content: results });
    }
    return { kind: 'limit' };
  } catch (err) {
    if (err instanceof APIUserAbortError || o.signal.aborted) return { kind: 'stopped' };
    if (err instanceof AuthenticationError) return { kind: 'error', message: 'Anthropic did not accept that key. Check it in the Anthropic Console, or enter it again.', badKey: true };
    if (err instanceof PermissionDeniedError) return { kind: 'error', message: 'That key is not allowed to use this model. Try another model, or check the key in the Anthropic Console.' };
    if (err instanceof RateLimitError) return { kind: 'error', message: 'Too many requests for this key just now. Wait a minute and try again.' };
    if (err instanceof APIConnectionError) return { kind: 'error', message: 'Could not reach Anthropic. Check your connection; the rest of GardenSync works offline.' };
    if (err instanceof APIError) return { kind: 'error', message: `Anthropic returned an error (${err.status ?? 'no status'}). Try again in a moment.` };
    return { kind: 'error', message: 'Something went wrong talking to the assistant. Try again.' };
  }
}
