// App state outside the garden document, and the boot sequence.
//
// boot() decides what the gardener sees first:
//   - a saved 8.x document: load it (repairing what is safe to repair);
//   - nothing saved, but 7.x data in this browser: offer to bring it across;
//   - nothing at all: the first-run "Where do you garden?" screen.
// Then it starts autosave: 400 ms after the last change, and immediately when the page is hidden.
import { computed, effect, signal } from '@preact/signals';
import { isoFromLocal, type IsoDate } from '../domain/dates';
import { V7_STORAGE_KEYS } from '../domain/doc/migrate-v7';
import { emptyDoc, type Garden, type GardenDoc } from '../domain/doc/schema';
import { loadDoc, requestPersistentStorage, saveDoc, storedRev, type KeyValueStore, type LoadResult } from '../platform/storage';
import { createStore, type Store } from './store';

export type BootState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  /** No 8.x save, but 7.x data exists. */
  | { kind: 'offer-v7'; raw: Record<string, string | null> }
  /** The save could not be read; its raw text is kept aside. */
  | { kind: 'recovery'; result: Extract<LoadResult, { status: 'corrupt' | 'needs-repair' }> }
  /** Another tab saved a newer version, or a newer GardenSync wrote this save. */
  | { kind: 'conflict'; reason: 'other-tab' | 'unknown-format' };

export const boot = signal<BootState>({ kind: 'loading' });
export const store: Store = createStore(emptyDoc());

/** Today in the gardener's own time zone. Refreshed when the page becomes visible again. */
export const today = signal<IsoDate>(isoFromLocal(new Date()));

/** The active garden, or null when there is none (first run). */
export const garden = computed<Garden | null>(() => {
  const d = store.doc.value;
  return d.gardens.find((g) => g.id === d.settings.activeGardenId) ?? d.gardens[0] ?? null;
});

export const units = computed(() => store.doc.value.settings.units);

/** Save status for the header: 'saved', 'saving' or an error message. */
export const saveStatus = signal<{ kind: 'saved' | 'saving' } | { kind: 'error'; message: string }>({ kind: 'saved' });

let rev = -1;
let timer: ReturnType<typeof setTimeout> | undefined;
let kv: KeyValueStore | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function flush(doc: GardenDoc, replaceUnreadable = false): void {
  if (!kv || boot.value.kind !== 'ready') return;
  clearTimeout(timer);
  timer = undefined;
  const res = saveDoc(kv, doc, { expectedRev: rev, today: isoFromLocal(new Date()), now: nowIso(), replaceUnreadable });
  if (res.ok) {
    rev = res.rev;
    saveStatus.value = { kind: 'saved' };
  } else if (res.reason === 'conflict') {
    boot.value = { kind: 'conflict', reason: 'other-tab' };
  } else if (res.reason === 'unknown-format') {
    boot.value = { kind: 'conflict', reason: 'unknown-format' };
  } else {
    saveStatus.value = { kind: 'error', message: res.message };
  }
}

function scheduleSave(doc: GardenDoc): void {
  saveStatus.value = { kind: 'saving' };
  clearTimeout(timer);
  timer = setTimeout(() => flush(doc), 400);
}

function hasV7Data(store: KeyValueStore): Record<string, string | null> | null {
  const raw: Record<string, string | null> = {};
  let any = false;
  for (const key of V7_STORAGE_KEYS) {
    const value = store.getItem(key);
    raw[key] = value;
    if (value !== null && key === 'gardensync_state') any = true;
  }
  return any ? raw : null;
}

/** Starts the app with the browser's localStorage, or a given store in tests. */
export function startApp(storage: KeyValueStore | null = safeLocalStorage()): void {
  kv = storage;
  if (!kv) {
    // Private browsing in some browsers: work in memory and say so in the header.
    saveStatus.value = { kind: 'error', message: 'This browser is not letting GardenSync save. Changes last until you close the tab.' };
    boot.value = { kind: 'ready' };
    return;
  }
  const result = loadDoc(kv, nowIso());
  if (result.status === 'ok') {
    rev = result.rev;
    store.replace(result.doc);
    boot.value = { kind: 'ready' };
  } else if (result.status === 'empty') {
    const v7 = hasV7Data(kv);
    boot.value = v7 ? { kind: 'offer-v7', raw: v7 } : { kind: 'ready' };
  } else {
    boot.value = { kind: 'recovery', result };
  }

  store.subscribe(scheduleSave);
  window.addEventListener('pagehide', () => {
    if (timer !== undefined) flush(store.doc.value);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer !== undefined) flush(store.doc.value);
    if (document.visibilityState === 'visible') today.value = isoFromLocal(new Date());
  });
  window.addEventListener('storage', (e) => {
    // Another tab saved. Only a conflict if our own copy has not caught up with it.
    if (e.key === 'gardensync.v8.doc' && kv) {
      const theirs = storedRev(kv);
      if (theirs.kind === 'rev' && theirs.rev > rev) boot.value = { kind: 'conflict', reason: 'other-tab' };
    }
  });
  void requestPersistentStorage();
  // Light, dark, or follow the device (tokens.css reads data-theme).
  effect(() => {
    const theme = store.doc.value.settings.theme;
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  });
}

/** Finishes a recovery or a 7.x import: from now on, this document is the garden. */
export function adoptDoc(doc: GardenDoc, opts: { replaceUnreadable?: boolean } = {}): void {
  if (kv) {
    const stored = storedRev(kv);
    rev = stored.kind === 'rev' ? stored.rev : -1;
  }
  store.replace(doc);
  boot.value = { kind: 'ready' };
  flush(doc, opts.replaceUnreadable ?? false);
}

function safeLocalStorage(): KeyValueStore | null {
  try {
    const ls = window.localStorage;
    const probe = 'gardensync.v8.probe';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

/** A short random id for new records. Not secret, just unique within a garden. */
export function newId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, (c) => (c === '+' ? '-' : c === '/' ? '_' : ''));
}
