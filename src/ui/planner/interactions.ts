// What a tap, a click, a key or a button does in the planner. The canvas (pointer and keyboard),
// the placement panel and the inspector all go through these, so every input does the same thing.
import type { Container, Planting } from '../../domain/doc/schema';
import { fmtDay, inSentence } from '../format';
import { garden, newId } from '../appState';
import { selection, shownDay, viewDay } from '../uiState';
import { candidate } from './candidate';
import { footprints, present } from './derived';
import { boundsOf, fitView, type Cell } from './geometry';
import { act, draft, emptyDraft, showToast, stopPlacing, view, viewport } from './plannerState';

/** A square tapped (or marked with the keyboard) while placing: the first is the start, the second the end. */
export function placeAtCell(containerId: string, cell: Cell): void {
  const d = draft.value;
  if (d.phase === 'started' && d.containerId === containerId) {
    draft.value = { ...d, end: cell, phase: 'done', count: null, allowClash: false };
  } else {
    draft.value = { ...d, containerId, start: cell, end: cell, phase: 'started', count: null, allowClash: false };
  }
}

/** A mouse or pen drag across squares: the end follows the pointer. */
export function paintTo(containerId: string, cell: Cell): void {
  const d = draft.value;
  if (d.containerId !== containerId || !d.start) return;
  if (d.end && d.end.col === cell.col && d.end.row === cell.row) return;
  draft.value = { ...d, end: cell, count: null, allowClash: false };
}

export function finishPaint(): void {
  const d = draft.value;
  if (d.start && d.end && (d.start.col !== d.end.col || d.start.row !== d.end.row)) draft.value = { ...d, phase: 'done' };
}

export function placeInVessel(containerId: string): void {
  draft.value = { ...draft.value, containerId, start: null, end: null, phase: 'done', count: null, allowClash: false };
}

/** Clear the squares chosen so far but keep placing the same plant. */
export function clearSquares(): void {
  const d = draft.value;
  draft.value = { ...emptyDraft(), method: d.method };
}

/** Add the planting being placed: one dispatch, one undo step. */
export function commitPlacement(): { ok: boolean; error?: string } {
  const c = candidate.value;
  const g = garden.value;
  if (!c || !g || !c.planting) return { ok: false, error: 'Choose where it goes first.' };
  const id = newId();
  const planting: Planting = { ...c.planting, id };
  const name = inSentence(c.plant.name);
  const res = act({ type: 'addPlanting', gardenId: g.id, planting }, `plant ${planting.count} ${name}`, `Planted ${planting.count} ${name} ${planting.count === 1 ? 'plant' : 'plants'}.`);
  if (!res.ok) return { ok: false, error: res.error };
  // If it does not go in until later, show the day it goes in, so the new planting is visible.
  const bedIn = c.phases?.bedIn;
  const day = shownDay.value;
  const out = c.phases?.bedOut ?? null;
  if (bedIn !== undefined && (bedIn > day || (out !== null && out <= day))) {
    showToast(`Planted ${planting.count} ${name} ${planting.count === 1 ? 'plant' : 'plants'}. It goes in on ${fmtDay(bedIn)}, so the garden now shows that day.`, true);
    viewDay.value = bedIn;
  }
  stopPlacing();
  selection.value = { kind: 'planting', id };
  return { ok: true };
}

/** What a tap does when not placing: pick the planting under it, or its bed or pot. */
export function selectAt(c: Container, cell: Cell | null): void {
  const s = selection.value;
  const here = present.value.get(c.id) ?? [];
  let target: Planting | undefined;
  if (c.form === 'grid' && cell) {
    target = [...here].reverse().find((p) => p.cells && cell.col >= p.cells.col && cell.col < p.cells.col + p.cells.w && cell.row >= p.cells.row && cell.row < p.cells.row + p.cells.h);
  } else if (c.form === 'vessel') {
    target = here[0];
  }
  // Tapping the selected planting again selects its bed or pot.
  if (target && !(s?.kind === 'planting' && s.id === target.id)) {
    selection.value = { kind: 'planting', id: target.id };
  } else {
    selection.value = { kind: 'container', id: c.id };
  }
}

/**
 * Show the whole garden. `bottomInset` is screen px at the bottom covered by a sheet (the phone's
 * placement sheet), so the garden fits in the part that is still visible.
 */
export function fitAll(bottomInset = 0): void {
  const r = boundsOf([...footprints.value.values()]);
  const size = viewport.value;
  if (size.w === 0) return;
  const inset = Math.min(Math.max(0, bottomInset), size.h * 0.6);
  // Leave room for the bed names and rulers around the edge.
  const v = fitView(r ? { x: r.x - 20, y: r.y - 45, w: r.w + 40, h: r.h + 65 } : null, { w: size.w, h: size.h - inset }, 32);
  view.value = { ...v, cy: v.cy + inset / 2 / v.s };
}

export function zoomBy(factor: number): void {
  const v = view.value;
  if (!v) return;
  view.value = { ...v, s: Math.min(12, Math.max(0.02, v.s * factor)) };
}
