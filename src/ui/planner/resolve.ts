// What to offer when a plant is dropped on squares that are taken while it would grow: plant it
// after the crop that is there, find free squares for the same dates, replace that crop, or grow
// alongside it anyway. Pure: no DOM, no signals, so it is unit-tested directly.
import type { ClimateProfile } from '../../domain/climate/types';
import type { DayNum } from '../../domain/dates';
import type { Anchor, Cells, Garden, GridBed, Planting } from '../../domain/doc/schema';
import { conflictsFor, type Clash, type IntervalOf, type PlantOf } from '../../domain/layout/occupancy';
import { cellsInBounds, defaultCount } from '../../domain/layout/patch';
import type { Plant } from '../../domain/plants/schema';
import { anchorFor, makeIntervalOf, nextWindow, type PlaceMethod } from './placement';

export interface DropRequest {
  plant: Plant;
  method: PlaceMethod;
  bed: GridBed;
  cells: Cells;
  /** The day the plan shows: the planting goes into its next window from here. */
  from: DayNum;
  /** The count the gardener set; otherwise the usual count for the squares. */
  count?: number;
}

export interface Proposal {
  /** The planting to add (without an id), when it can go in. */
  planting: Omit<Planting, 'id'> | null;
  /** Why it cannot go in at all (no window here, too few squares). */
  problem: string | null;
  /** Clashes with plantings already in those squares while it would grow. */
  clashes: Clash[];
}

export interface Resolutions {
  /** Plant it in the same squares once they are free: its next window after the last clash ends. */
  after: { planting: Omit<Planting, 'id'>; bedIn: DayNum; afterNames: string[] } | null;
  /** The nearest free squares of the same size for the same dates, in this bed or another. */
  room: { planting: Omit<Planting, 'id'>; bed: GridBed } | null;
  /** The plantings that would be pulled out to make room. */
  replace: Planting[];
}

const PROBE = 'drop-probe';

function buildAt(req: DropRequest, bed: GridBed, cells: Cells, anchor: Anchor): Omit<Planting, 'id'> {
  const usual = Math.max(1, defaultCount(req.plant, cells));
  return { containerId: bed.id, plantId: req.plant.id, cells, count: req.count ?? usual, method: req.method, anchor };
}

function clashesOf(p: Omit<Planting, 'id'>, plantings: readonly Planting[], iof: IntervalOf, plantOf: PlantOf): Clash[] {
  return conflictsFor({ ...p, id: PROBE }, plantings, iof, plantOf).filter((c) => c.kind === 'conflict');
}

/** Anything at all in those squares while it would grow, even a crop it could share with. */
function sharesWithAnything(p: Omit<Planting, 'id'>, plantings: readonly Planting[], iof: IntervalOf, plantOf: PlantOf): boolean {
  return conflictsFor({ ...p, id: PROBE }, plantings, iof, plantOf).length > 0;
}

/** The planting a drop would make, and what it clashes with. */
export function propose(req: DropRequest, garden: Garden, plantOf: PlantOf): Proposal {
  if (!cellsInBounds(req.bed, req.cells)) return { planting: null, problem: `That runs off ${req.bed.name}.`, clashes: [] };
  if (defaultCount(req.plant, req.cells) === 0) {
    return { planting: null, problem: `${req.plant.name} needs more squares than that for one plant.`, clashes: [] };
  }
  const a = anchorFor(req.plant, garden.climate, req.method, req.from);
  if (!a) return { planting: null, problem: `${req.plant.name} has no planting window here this season or next.`, clashes: [] };
  const planting = buildAt(req, req.bed, req.cells, a.anchor);
  const iof = makeIntervalOf(garden.climate, plantOf);
  return { planting, problem: null, clashes: clashesOf(planting, garden.plantings, iof, plantOf) };
}

/** The ways out of a clash, given a proposal that has one. */
export function resolutions(req: DropRequest, proposal: Proposal, garden: Garden, plantOf: PlantOf): Resolutions {
  const empty: Resolutions = { after: null, room: null, replace: [] };
  if (!proposal.planting || proposal.clashes.length === 0) return empty;
  const iof = makeIntervalOf(garden.climate, plantOf);
  const occupants = proposal.clashes.map((c) => c.with);
  return {
    after: plantAfter(req, occupants, garden, plantOf, iof),
    room: findRoom(req, proposal.planting.anchor, garden, plantOf, iof),
    replace: occupants,
  };
}

function plantAfter(req: DropRequest, occupants: Planting[], garden: Garden, plantOf: PlantOf, iof: IntervalOf): Resolutions['after'] {
  const climate: ClimateProfile | null = garden.climate;
  if (!climate) return null;
  let free = req.from;
  for (const o of occupants) {
    const i = iof(o);
    if (!i || i.bedOut === null) return null; // a perennial holds the squares for good
    free = Math.max(free, i.bedOut);
  }
  // Try the next few windows from the day the squares free up, in case one still clashes with a
  // later crop in the same squares.
  let from = free;
  for (let tries = 0; tries < 4; tries++) {
    const choice = nextWindow(req.plant, climate, req.method, from);
    if (!choice) return null;
    const planting = buildAt(req, req.bed, req.cells, choice.anchor);
    const clashes = conflictsFor({ ...planting, id: PROBE }, garden.plantings, iof, plantOf);
    if (clashes.length === 0) {
      const names = [...new Set(occupants.map((o) => plantOf(o.plantId)?.name ?? o.plantId))];
      return { planting, bedIn: choice.bedIn, afterNames: names };
    }
    const later = Math.max(...clashes.map((c) => iof(c.with)?.bedOut ?? Number.POSITIVE_INFINITY));
    if (!Number.isFinite(later) || later <= from) return null;
    from = later;
  }
  return null;
}

function findRoom(req: DropRequest, anchor: Anchor, garden: Garden, plantOf: PlantOf, iof: IntervalOf): Resolutions['room'] {
  const { w, h } = req.cells;
  const beds = [req.bed, ...garden.containers.filter((c): c is GridBed => c.form === 'grid' && c.id !== req.bed.id)];
  let best: { planting: Omit<Planting, 'id'>; bed: GridBed; score: number } | null = null;
  for (const [k, bed] of beds.entries()) {
    for (let row = 0; row + h <= bed.rows; row++) {
      for (let col = 0; col + w <= bed.cols; col++) {
        // Nearest to the drop in the same bed; any other bed only when this one has no room.
        const score = k === 0 ? Math.abs(col - req.cells.col) + Math.abs(row - req.cells.row) : 1000 * k + row * bed.cols + col;
        if (best && score >= best.score) continue;
        const planting = buildAt(req, bed, { col, row, w, h }, anchor);
        // "Find room" means empty squares, not squares it could share with another crop.
        if (!sharesWithAnything(planting, garden.plantings, iof, plantOf)) best = { planting, bed, score };
      }
    }
  }
  return best ? { planting: best.planting, bed: best.bed } : null;
}
