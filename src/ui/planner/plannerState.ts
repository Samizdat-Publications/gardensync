// Planner-only UI state: the view onto the garden, the placement in progress, the keyboard cursor,
// panels and the toast. Never saved, never undone. Shared state (the plant being placed, the day
// shown, the selection) lives in ../uiState.ts.
import { computed, signal } from '@preact/signals';
import type { DispatchOptions, DispatchResult } from '../store';
import type { Op } from '../../domain/doc/ops';
import { garden, store } from '../appState';
import { placingPlantId, selection } from '../uiState';
import type { Cell, Size, View } from './geometry';
import type { PlaceMethod } from './placement';

export const view = signal<View | null>(null);
export const viewport = signal<Size>({ w: 0, h: 0 });

/** Level of detail, in steps, so the drawing only changes when a threshold is crossed. */
export const lod = computed<0 | 1 | 2 | 3>(() => {
  const v = view.value;
  const g = garden.value;
  if (!v || !g) return 1;
  const cellPx = g.cellCm * v.s;
  if (cellPx < 14) return 0; // whole beds only: no rulers, one glyph per patch
  if (cellPx < 34) return 1; // initials, rulers
  if (cellPx < 64) return 2; // names, a glyph per square
  return 3; // names and counts everywhere
});

export interface Draft {
  containerId: string | null;
  start: Cell | null;
  end: Cell | null;
  /** 'started' after the first square, 'done' after the second. */
  phase: 'none' | 'started' | 'done';
  method: PlaceMethod | null;
  /** The count the gardener typed, when it differs from the default. */
  count: number | null;
  /** The gardener chose "Interplant anyway" (or "Plant anyway" for a crowded pot). */
  allowClash: boolean;
}

export const emptyDraft = (): Draft => ({ containerId: null, start: null, end: null, phase: 'none', method: null, count: null, allowClash: false });
export const draft = signal<Draft>(emptyDraft());

/** Keyboard cursor: a screen square of a bed's footprint, or the whole of a pot. */
export const cursor = signal<{ containerId: string; sx: number; sy: number } | null>(null);
export const canvasFocused = signal(false);

/** A bed or pot being dragged: its offset in cm from where it is stored. */
export const dragPreview = signal<{ id: string; dx: number; dy: number } | null>(null);

export const paletteOpen = signal(false);

export interface Toast {
  id: number;
  text: string;
  undo: boolean;
}
export const toast = signal<Toast | null>(null);
let toastSeq = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function showToast(text: string, undo = false): void {
  clearTimeout(toastTimer);
  toast.value = { id: ++toastSeq, text, undo };
  toastTimer = setTimeout(() => {
    toast.value = null;
  }, 8000);
}

export function clearToast(): void {
  clearTimeout(toastTimer);
  toast.value = null;
}

/** Dispatch an op on the active garden, with a toast that offers undo when it worked. */
export function act(op: Op, label: string, done?: string, opts: Omit<DispatchOptions, 'label'> = {}): DispatchResult {
  const res = store.dispatch(op, { ...opts, label });
  if (res.ok && done) showToast(done, true);
  return res;
}

export function startPlacing(plantId: string): void {
  placingPlantId.value = plantId;
  const d = draft.value;
  // Keep a chosen pot or bed so choosing another plant does not lose the squares.
  draft.value = { ...emptyDraft(), containerId: d.containerId, start: d.start, end: d.end, phase: d.phase };
}

export function stopPlacing(): void {
  placingPlantId.value = null;
  draft.value = emptyDraft();
}

export function selectPlanting(id: string): void {
  selection.value = { kind: 'planting', id };
}

export function selectContainer(id: string): void {
  selection.value = { kind: 'container', id };
}
