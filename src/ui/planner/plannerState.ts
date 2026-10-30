// Planner-only UI state: the view onto the garden, the placement in progress, the keyboard cursor,
// panels and the toast. Never saved, never undone. Shared state (the plant being placed, the day
// shown, the selection) lives in ../uiState.ts.
import { computed, signal } from '@preact/signals';
import type { DispatchOptions, DispatchResult } from '../store';
import type { Op } from '../../domain/doc/ops';
import type { Cells } from '../../domain/doc/schema';
import { toDay, type DayNum } from '../../domain/dates';
import { resolvePlant } from '../../domain/plants/resolve';
import type { Plant } from '../../domain/plants/schema';
import { garden, store, today } from '../appState';
import { placingPlantId, selection, viewDay } from '../uiState';
import type { Cell, Size, View } from './geometry';
import { nextWindow, placeMethod, type PlaceMethod } from './placement';
import type { DropRequest, Proposal, Resolutions } from './resolve';

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
  /** 'started' while a mouse/pen drag is in progress. */
  phase: 'none' | 'started' | 'done';
  method: PlaceMethod | null;
  /** The count the gardener typed, when it differs from the default. */
  count: number | null;
  /** The gardener chose "Grow alongside anyway". */
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

// ---- Clash card ---------------------------------------------------------------------------------

/** Data for the clash card shown when a drop lands on occupied squares. */
export interface ClashCardData {
  req: DropRequest;
  proposal: Proposal;
  reso: Resolutions;
  /** Screen coordinates to anchor the card near (clientX / clientY). */
  screenX: number;
  screenY: number;
}
export const clashCard = signal<ClashCardData | null>(null);

// ---- Palette drag -------------------------------------------------------------------------------

/** An in-progress drag from the plant palette. */
export interface PaletteDragState {
  plant: Plant;
  /** Current pointer position in screen coords. */
  screenX: number;
  screenY: number;
  /** Snap proposal when the ghost is over a bed cell, null otherwise. */
  snap: { containerId: string; cells: Cells; proposal: Proposal } | null;
}
export const paletteDrag = signal<PaletteDragState | null>(null);

// ---- Planting move ------------------------------------------------------------------------------

/** An in-progress drag-move of an existing planting to new squares. */
export interface PlantingMoveState {
  plantingId: string;
  sourceContainerId: string;
  sourceCells: Cells;
  targetContainerId: string;
  targetCells: Cells;
  proposal: Proposal | null;
}
export const plantingMove = signal<PlantingMoveState | null>(null);

// ---- View-day while placing ---------------------------------------------------------------------

/** The bedIn day we switched viewDay to when placing started (null = did not switch). */
export const placingPreviewDay = signal<DayNum | null>(null);
/** The viewDay value before placing started; restored when placing stops. */
export const prePlacingViewDay = signal<DayNum | null>(null);

// ---- Toast --------------------------------------------------------------------------------------

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

// ---- Placement actions --------------------------------------------------------------------------

/** The way a plant goes in when placed today: the usual way, or bought plants once seed-starting time has passed. */
export function methodNow(plant: Plant): PlaceMethod {
  return placeMethod(plant, garden.value?.climate ?? null, toDay(today.value));
}

export function startPlacing(plantId: string): void {
  placingPlantId.value = plantId;
  const d = draft.value;
  // Keep an existing containerId so choosing another plant in the same bed does not lose context.
  draft.value = { ...emptyDraft(), containerId: d.containerId };
  clashCard.value = null;

  // Switch the plan to the day this plant would go in, so occupied squares are visible.
  const g = garden.value;
  if (g?.climate) {
    const resolved = resolvePlant(plantId, g.customPlants ?? []);
    if (resolved) {
      const method = methodNow(resolved.plant);
      const from = toDay(today.value);
      const choice = nextWindow(resolved.plant, g.climate, method, from);
      if (choice) {
        const currentShown = viewDay.value ?? from;
        if (choice.bedIn !== currentShown) {
          // Choosing another plant while already previewing keeps the day to go back to.
          if (placingPreviewDay.value === null) prePlacingViewDay.value = viewDay.value;
          placingPreviewDay.value = choice.bedIn;
          viewDay.value = choice.bedIn;
        }
      }
    }
  }
}

export function stopPlacing(): void {
  placingPlantId.value = null;
  draft.value = emptyDraft();
  clashCard.value = null;
  paletteDrag.value = null;
  plantingMove.value = null;
  // Restore the view day that was set before placing started.
  if (placingPreviewDay.value !== null) {
    viewDay.value = prePlacingViewDay.value;
    placingPreviewDay.value = null;
    prePlacingViewDay.value = null;
  }
}

export function selectPlanting(id: string): void {
  selection.value = { kind: 'planting', id };
}

export function selectContainer(id: string): void {
  selection.value = { kind: 'container', id };
}
