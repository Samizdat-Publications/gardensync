// What a tap, a click, a key or a button does in the planner. The canvas (pointer and keyboard),
// the placement panel and the inspector all go through these, so every input does the same thing.
import type { Cells, Container, Planting } from '../../domain/doc/schema';
import { squaresLabel } from '../../domain/layout/labels';
import { defaultCount, minCells } from '../../domain/layout/patch';
import { fmtDay, inSentence } from '../format';
import { garden, newId } from '../appState';
import { selection, shownDay, viewDay } from '../uiState';
import { candidate } from './candidate';
import { footprints, intervalOfP, present, plantLookup, upcoming } from './derived';
import { boundsOf, cellsBetween, fitView, type Cell } from './geometry';
import { act, clashCard, draft, emptyDraft, methodNow, placingPreviewDay, showToast, stopPlacing, view, viewport } from './plannerState';
import { propose, resolutions, type DropRequest, type Proposal } from './resolve';
import { placingPlantId } from '../uiState';

// ---- Tap and paint ------------------------------------------------------------------------------

/**
 * Attempt to plant at a grid cell using the plant's minimum footprint. Called for taps (mouse,
 * touch, keyboard Enter) and for single-cell mouse clicks. Plants immediately on success; shows
 * the clash card on a clash; shows a toast on a structural problem.
 */
export function placeAtCell(containerId: string, cell: Cell, screenX = 0, screenY = 0): void {
  const plantId = placingPlantId.value;
  if (!plantId) return;
  const g = garden.value;
  if (!g) return;
  const plant = plantLookup.value(plantId);
  if (!plant) return;
  const min = minCells(plant);
  const cells: Cells = { col: cell.col, row: cell.row, w: min.w, h: min.h };
  attemptPlant(containerId, cells, screenX, screenY);
}

/** A mouse or pen drag across squares: the end follows the pointer (for visual feedback). */
export function paintTo(containerId: string, cell: Cell): void {
  const d = draft.value;
  if (d.containerId !== containerId || !d.start) return;
  if (d.end && d.end.col === cell.col && d.end.row === cell.row) return;
  draft.value = { ...d, end: cell, count: null, allowClash: false };
}

/**
 * Finish a paint gesture (mouse/pen drag release). If the drag crossed cells, attempts to plant
 * the full region. Passes screen coords for clash-card positioning.
 */
export function finishPaint(screenX = 0, screenY = 0): void {
  const d = draft.value;
  if (!d.start || !d.containerId) {
    draft.value = emptyDraft();
    return;
  }
  const cells = cellsBetween(d.start, d.end ?? d.start);
  draft.value = emptyDraft();
  attemptPlant(d.containerId, cells, screenX, screenY);
}

/**
 * Tap on a vessel while placing: immediately plants or shows a toast on a problem.
 * Uses the existing candidate signal which handles vessel-specific logic.
 */
export function placeInVessel(containerId: string): void {
  draft.value = { ...draft.value, containerId, start: null, end: null, phase: 'done', count: null, allowClash: false };
  const c = candidate.value;
  if (!c) return;
  if (c.planting) {
    commitCandidate(c);
  } else if (c.problems.length > 0) {
    showToast(c.problems[0]!);
    draft.value = emptyDraft();
  }
}

// ---- Core placement logic -----------------------------------------------------------------------

/**
 * Attempt to plant a specific set of cells in a grid bed. On success, commits immediately and
 * the plant stays chosen. On a clash, opens the clash card. On a structural problem, shows a
 * toast. Exported so ClashCard and palette drag can call it directly.
 */
export function attemptPlant(containerId: string, cells: Cells, screenX = 0, screenY = 0): void {
  const g = garden.value;
  const plantId = placingPlantId.value;
  if (!g || !plantId) return;
  const plant = plantLookup.value(plantId);
  if (!plant) return;
  const container = g.containers.find((c) => c.id === containerId);
  if (!container || container.form !== 'grid') return;

  const method = draft.value.method ?? methodNow(plant);
  const req: DropRequest = { plant, method, bed: container, cells, from: shownDay.value };
  const proposal = propose(req, g, plantLookup.value);

  if (proposal.problem) {
    showToast(proposal.problem);
    return;
  }

  if (proposal.clashes.length > 0) {
    // When every clash is with the same plant in the same bed, try expanding the patch instead.
    const allSamePlant = proposal.clashes.every((c) => c.with.plantId === plantId && c.with.containerId === containerId);
    const same = proposal.clashes.map((c) => c.with).filter((p) => p.cells);
    if (allSamePlant && tryExpandPatch(containerId, cells, same, g)) return;

    const reso = resolutions(req, proposal, g, plantLookup.value);
    clashCard.value = { req, proposal, reso, screenX, screenY };
    // Clear placement state so the panel does not show spurious warnings while the card is open.
    const prevMethod = draft.value.method;
    draft.value = { ...emptyDraft(), method: prevMethod };
    return;
  }

  if (proposal.planting) {
    const neighbour = neighbourToJoin(containerId, cells, proposal.planting, g);
    if (neighbour && tryExpandPatch(containerId, cells, [neighbour], g)) return;
    commitPlanting(proposal.planting, plant.name, g.id);
  }
}

/** Two patches that together make an exact rectangle: side by side with a whole edge shared. */
function joinsInto(a: Cells, b: Cells): boolean {
  const sideBySide = a.row === b.row && a.h === b.h && (a.col + a.w === b.col || b.col + b.w === a.col);
  const stacked = a.col === b.col && a.w === b.w && (a.row + a.h === b.row || b.row + b.h === a.row);
  return sideBySide || stacked;
}

/**
 * A patch of the same plant, going in on the same dates, that the new squares extend into one
 * bigger rectangle, so painting next to a patch makes it bigger rather than adding a second one.
 */
function neighbourToJoin(containerId: string, cells: Cells, planting: Omit<Planting, 'id'>, g: NonNullable<typeof garden.value>): Planting | null {
  const anchor = JSON.stringify(planting.anchor);
  return (
    g.plantings.find(
      (p) =>
        p.containerId === containerId &&
        p.plantId === planting.plantId &&
        p.method === planting.method &&
        p.cells !== undefined &&
        JSON.stringify(p.anchor) === anchor &&
        joinsInto(p.cells, cells),
    ) ?? null
  );
}

/**
 * Merge the dropped cells with patches of the same plant (ones they overlap, or one they extend)
 * into one bigger rectangle patch. Returns true when done (so the caller skips the clash card or
 * the separate planting). Never reports "Cilantro clashes with Cilantro".
 */
function tryExpandPatch(containerId: string, newCells: Cells, same: Planting[], g: NonNullable<typeof garden.value>): boolean {
  const plantId = placingPlantId.value;
  if (!plantId) return false;
  const plant = plantLookup.value(plantId);
  if (!plant) return false;
  const container = g.containers.find((c) => c.id === containerId);
  if (!container || container.form !== 'grid') return false;

  const samePatches = same.filter((p) => p.containerId === containerId && p.plantId === plantId && p.cells);
  if (samePatches.length === 0) return false;

  // Bounding rectangle that includes every existing patch plus the new cells.
  let minCol = newCells.col, maxCol = newCells.col + newCells.w - 1;
  let minRow = newCells.row, maxRow = newCells.row + newCells.h - 1;
  for (const p of samePatches) {
    const pc = p.cells!;
    minCol = Math.min(minCol, pc.col);
    maxCol = Math.max(maxCol, pc.col + pc.w - 1);
    minRow = Math.min(minRow, pc.row);
    maxRow = Math.max(maxRow, pc.row + pc.h - 1);
  }
  const bigCells: Cells = { col: minCol, row: minRow, w: maxCol - minCol + 1, h: maxRow - minRow + 1 };
  // Painting over squares one patch already covers changes nothing: say so rather than "bigger".
  const only = samePatches.length === 1 ? samePatches[0]!.cells! : null;
  if (only && only.col === bigCells.col && only.row === bigCells.row && only.w === bigCells.w && only.h === bigCells.h) {
    showToast(`Those squares already have ${inSentence(plant.name)}.`);
    draft.value = emptyDraft();
    return true;
  }

  // Check that the bounding rectangle does not conflict with other plants.
  const sameIds = new Set(samePatches.map((p) => p.id));
  const otherPlantings = g.plantings.filter((p) => !sameIds.has(p.id));
  const method = draft.value.method ?? methodNow(plant);
  const bigReq: DropRequest = { plant, method, bed: container, cells: bigCells, from: shownDay.value };
  const bigProposal = propose(bigReq, { ...g, plantings: otherPlantings }, plantLookup.value);
  if (bigProposal.problem || bigProposal.clashes.length > 0 || !bigProposal.planting) return false;

  const newPlantingId = newId();
  const count = Math.max(1, defaultCount(plant, bigCells));
  const newPlanting: Planting = { ...bigProposal.planting, id: newPlantingId, count };
  const removeOps = [...sameIds].map((id) => ({ type: 'removePlanting' as const, gardenId: g.id, plantingId: id }));
  const addOp = { type: 'addPlanting' as const, gardenId: g.id, planting: newPlanting };

  const plantName = inSentence(plant.name);
  const res = act(
    { type: 'batch', ops: [...removeOps, addOp] },
    `expand ${plantName}`,
    `Made the ${plantName} patch bigger.`,
  );
  if (res.ok) {
    selection.value = { kind: 'planting', id: newPlantingId };
    draft.value = emptyDraft();
    const span = intervalOfP.value(newPlanting);
    if (span && (span.bedIn > shownDay.value || (span.bedOut !== null && span.bedOut <= shownDay.value))) {
      viewDay.value = span.bedIn;
      if (placingPreviewDay.value !== null) placingPreviewDay.value = span.bedIn;
    }
  }
  return res.ok;
}

/** Commit a planting derived from a proposal. The plant stays chosen so more can be dropped. */
export function commitPlanting(planting: Omit<Planting, 'id'>, plantName: string, gardenId: string): void {
  const id = newId();
  const full: Planting = { ...planting, id };
  const name = inSentence(plantName);
  // Say where it went and when it goes in, since a drop can land later in the season or elsewhere.
  const g = garden.value;
  const bed = g?.containers.find((c) => c.id === full.containerId);
  const where = bed ? (full.cells ? ` in ${bed.name}, ${squaresLabel(full.cells)}` : ` in ${bed.name}`) : '';
  const span = intervalOfP.value(full);
  const when = span ? `, going in ${fmtDay(span.bedIn)}` : '';
  const res = act(
    { type: 'addPlanting', gardenId, planting: full },
    `plant ${full.count} ${name}`,
    `Planted ${full.count} ${name} ${full.count === 1 ? 'plant' : 'plants'}${where}${when}.`,
  );
  if (res.ok) {
    selection.value = { kind: 'planting', id };
    draft.value = emptyDraft();
    // Show the day it goes in when that is not the day on screen, so the new patch is visible.
    if (span && (span.bedIn > shownDay.value || (span.bedOut !== null && span.bedOut <= shownDay.value))) {
      viewDay.value = span.bedIn;
      // While placing, the note over the plan names the day shown; keep it in step.
      if (placingPreviewDay.value !== null) placingPreviewDay.value = span.bedIn;
    }
  }
  // If not ok, the toast/error was already shown.
}

/** Commit the current candidate (vessel placing). */
function commitCandidate(c: NonNullable<typeof candidate.value>): void {
  const g = garden.value;
  if (!g || !c.planting) return;
  const id = newId();
  const planting: Planting = { ...c.planting, id };
  const name = inSentence(c.plant.name);
  const res = act(
    { type: 'addPlanting', gardenId: g.id, planting },
    `plant ${planting.count} ${name}`,
    `Planted ${planting.count} ${name} ${planting.count === 1 ? 'plant' : 'plants'}.`,
  );
  if (res.ok) {
    selection.value = { kind: 'planting', id };
    draft.value = emptyDraft();
    // If it goes in on a different day, show that day.
    const bedIn = c.phases?.bedIn;
    const day = shownDay.value;
    const out = c.phases?.bedOut ?? null;
    if (bedIn !== undefined && (bedIn > day || (out !== null && out <= day))) {
      showToast(`Planted ${planting.count} ${name}. It goes in on ${fmtDay(bedIn)}, so the garden now shows that day.`, true);
      viewDay.value = bedIn;
    }
  }
}

/** Legacy: kept for PlacementPanel's "Plant" fallback. Clear the paint region. */
export function clearSquares(): void {
  const d = draft.value;
  draft.value = { ...emptyDraft(), method: d.method, containerId: d.containerId };
}

// ---- Selection and navigation -------------------------------------------------------------------

/** What a tap does when not placing: pick the planting under it, or its bed or pot. */
export function selectAt(c: Container, cell: Cell | null): void {
  const s = selection.value;
  // Plantings in the ground on the day shown come first, then ones planned for those squares.
  const here = [...(upcoming.value.get(c.id) ?? []), ...(present.value.get(c.id) ?? [])];
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
/** How far the floating note reaches into the plan, in px (0 when it is not floating or empty). */
function noteHeight(): number {
  const note = document.querySelector<HTMLElement>('.plan-note');
  const app = document.querySelector<HTMLElement>('.canvas-app');
  if (!note || !app || getComputedStyle(note).position !== 'absolute' || note.childElementCount === 0) return 0;
  return Math.max(0, note.getBoundingClientRect().bottom - app.getBoundingClientRect().top);
}

export function fitAll(bottomInset = 0): void {
  const r = boundsOf([...footprints.value.values()]);
  const size = viewport.value;
  if (size.w === 0) return;
  const inset = Math.min(Math.max(0, bottomInset), size.h * 0.6);
  // A note about the day shown floats over the top of the plan on wider screens: fit below it.
  const top = Math.min(noteHeight(), size.h * 0.3);
  // Leave room for the bed names and rulers around the edge.
  const box = r ? { x: r.x - 20, y: r.y - 45, w: r.w + 40, h: r.h + 65 } : null;
  const room = size.h - inset - top;
  const v = fitView(box, { w: size.w, h: room }, 32);
  // A wide garden on a tall screen would float in the middle of empty grid: sit it near the top.
  const spare = box ? room - box.h * v.s : 0;
  if (box && spare > 160) {
    view.value = { ...v, cy: box.y + (size.h / 2 - top - 32) / v.s };
    return;
  }
  view.value = { ...v, cy: v.cy + (inset - top) / 2 / v.s };
}

export function zoomBy(factor: number): void {
  const v = view.value;
  if (!v) return;
  view.value = { ...v, s: Math.min(12, Math.max(0.02, v.s * factor)) };
}
