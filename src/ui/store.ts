// The app's state: one garden document in a signal, changed only through dispatch(op).
//
// Undo keeps the previous documents themselves (immer shares unchanged parts, so this is cheap),
// capped at 100 steps. Edits that arrive in a quick run under the same coalesce key, such as typing a
// bed name, become one undo step. A batch op (for example everything the assistant proposed) is one
// step because it is one op. Loading or importing a whole document replaces it without an undo step.
//
// UI state that is not part of the garden (selection, zoom, the day being viewed, open panels) lives
// in its own signals elsewhere and is never saved or undone.
import { computed, signal, type ReadonlySignal } from '@preact/signals';
import { applyOp, type Op } from '../domain/doc/ops';
import type { GardenDoc } from '../domain/doc/schema';

const UNDO_LIMIT = 100;
const COALESCE_MS = 1000;

export interface DispatchOptions {
  /** Shown in the undo button's tooltip, e.g. "Undo plant lettuce". */
  label?: string;
  /** Consecutive dispatches with the same key within a second share one undo step. */
  coalesceKey?: string;
}

export type DispatchResult = { ok: true } | { ok: false; error: string };

interface Step {
  doc: GardenDoc;
  label: string;
}

export interface Store {
  readonly doc: ReadonlySignal<GardenDoc>;
  readonly canUndo: ReadonlySignal<boolean>;
  readonly canRedo: ReadonlySignal<boolean>;
  /** Label of the step undo would reverse, or null. */
  readonly undoLabel: ReadonlySignal<string | null>;
  readonly redoLabel: ReadonlySignal<string | null>;
  dispatch(op: Op, opts?: DispatchOptions): DispatchResult;
  undo(): boolean;
  redo(): boolean;
  /** Replaces the whole document (load, import, restore). Clears undo history. */
  replace(doc: GardenDoc): void;
  /** Called after every change with the new document, for autosave. */
  subscribe(fn: (doc: GardenDoc) => void): () => void;
}

export function createStore(initial: GardenDoc, clock: () => number = () => Date.now()): Store {
  const doc = signal(initial);
  const past = signal<Step[]>([]);
  const future = signal<Step[]>([]);
  const listeners = new Set<(d: GardenDoc) => void>();
  let lastKey: string | undefined;
  let lastAt = 0;

  // A listener that throws (an autosave that hits a browser error, say) must not undo or block a
  // change that is already committed, nor stop the other listeners: report it and carry on.
  const notify = () => {
    for (const fn of listeners) {
      try {
        fn(doc.value);
      } catch (err) {
        console.error('GardenSync: a store listener failed', err);
      }
    }
  };

  return {
    doc,
    canUndo: computed(() => past.value.length > 0),
    canRedo: computed(() => future.value.length > 0),
    undoLabel: computed(() => past.value.at(-1)?.label ?? null),
    redoLabel: computed(() => future.value.at(-1)?.label ?? null),

    dispatch(op, opts = {}) {
      const res = applyOp(doc.value, op);
      if (!res.ok) return { ok: false, error: res.error };
      if (res.doc === doc.value) return { ok: true };
      const now = clock();
      const coalesce = opts.coalesceKey !== undefined && opts.coalesceKey === lastKey && now - lastAt < COALESCE_MS && past.value.length > 0;
      if (!coalesce) {
        past.value = [...past.value, { doc: doc.value, label: opts.label ?? 'last change' }].slice(-UNDO_LIMIT);
      }
      future.value = [];
      lastKey = opts.coalesceKey;
      lastAt = now;
      doc.value = res.doc;
      notify();
      return { ok: true };
    },

    undo() {
      const step = past.value.at(-1);
      if (!step) return false;
      past.value = past.value.slice(0, -1);
      future.value = [...future.value, { doc: doc.value, label: step.label }];
      lastKey = undefined;
      doc.value = step.doc;
      notify();
      return true;
    },

    redo() {
      const step = future.value.at(-1);
      if (!step) return false;
      future.value = future.value.slice(0, -1);
      past.value = [...past.value, { doc: doc.value, label: step.label }];
      lastKey = undefined;
      doc.value = step.doc;
      notify();
      return true;
    },

    replace(next) {
      past.value = [];
      future.value = [];
      lastKey = undefined;
      doc.value = next;
      notify();
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
