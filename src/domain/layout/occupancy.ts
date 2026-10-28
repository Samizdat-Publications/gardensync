// Occupancy: who holds which squares when, and whether two plantings can share them.
//
// A planting holds its cells from bedIn up to (not including) bedOut, as day numbers. bedOut null
// means ongoing: a perennial that stays from year to year. Where those dates come from (the schedule,
// pinned dates, what actually happened) is the caller's business, so every function here takes an
// `intervalOf` function. It returns null for a planting that is not in the ground at all (only
// started indoors so far, say), which then occupies nothing.
//
// Two plantings in the same bed clash when their cells overlap and their intervals overlap. Because
// intervals are half-open, back-to-back plantings (garlic out on the day the beans go in) do not
// overlap. A clash is one of two kinds:
// - interplant: sharing works. Either a low, shade-tolerant crop grows under a tall or mid one
//   (lettuce under tomatoes), or it is a relay: one ends within 28 days after the other goes in.
//   The UI shows a badge.
// - conflict: anything else, with the reason. A perennial always conflicts, since it holds the
//   squares from year to year.
// Placing does not block either kind; ops.ts accepts overlaps and the UI decides what to offer.
//
// Vessels have no cells. Instead, everything in a vessel at the same time shares its room: each
// planting uses count / maxCount of it (vesselFit), and the total must not pass 1.
import type { Container, GridBed, Planting, Vessel } from '../doc/schema';
import type { DayNum } from '../dates';
import type { Plant } from '../plants/schema';
import { cellKeys, cellsInBounds, cellsOverlap, vesselFit } from './patch';

/** Days a relay crop may overlap the crop that follows it. */
export const RELAY_DAYS = 28;

/** [bedIn, bedOut) in day numbers; bedOut null is ongoing. */
export interface BedInterval {
  bedIn: DayNum;
  bedOut: DayNum | null;
}

export type IntervalOf = (p: Planting) => BedInterval | null;
export type PlantOf = (plantId: string) => Plant | undefined;

export interface Clash {
  /** The other planting. */
  with: Planting;
  kind: 'interplant' | 'conflict';
  reason: string;
}

const end = (i: BedInterval) => i.bedOut ?? Number.POSITIVE_INFINITY;

export function intervalsOverlap(a: BedInterval, b: BedInterval): boolean {
  return a.bedIn < end(b) && b.bedIn < end(a);
}

export function inBedOn(i: BedInterval, day: DayNum): boolean {
  return day >= i.bedIn && day < end(i);
}

/** A span of days for a sentence: "5 days", "1 week", "8 weeks". */
export function formatDuration(days: number): string {
  if (days < 14) return days === 1 ? '1 day' : `${days} days`;
  const weeks = Math.round(days / 7);
  return `${weeks} weeks`;
}

function nameOf(plantOf: PlantOf, id: string): string {
  return plantOf(id)?.name ?? 'This plant';
}

/** Classify two plantings whose cells and intervals overlap. */
function classify(
  a: { plant: Plant | undefined; name: string; i: BedInterval },
  b: { plant: Plant | undefined; name: string; i: BedInterval },
): { kind: 'interplant' | 'conflict'; reason: string } {
  // A perennial holds its squares for years, so nothing shares them.
  for (const [x, y] of [[a, b], [b, a]] as const) {
    if (x.i.bedOut === null) {
      return { kind: 'conflict', reason: `${x.name} is a perennial and holds these squares from year to year, so ${y.name} would have no room.` };
    }
  }

  // A low, shade-tolerant crop under a taller one.
  if (a.plant && b.plant) {
    for (const [under, over] of [[a, b], [b, a]] as const) {
      const u = under.plant!;
      const o = over.plant!;
      if (u.canopy === 'low' && u.shadeTolerant && (o.canopy === 'tall' || o.canopy === 'mid')) {
        return { kind: 'interplant', reason: `${under.name} stays low and copes with shade, so it can grow under ${over.name}.` };
      }
    }
  }

  // A relay: one comes out within RELAY_DAYS after the other goes in.
  for (const [first, next] of [[a, b], [b, a]] as const) {
    const out = first.i.bedOut!; // both are finite here
    const shared = out - next.i.bedIn;
    if (shared > 0 && shared <= RELAY_DAYS) {
      return { kind: 'interplant', reason: `${first.name} comes out within ${formatDuration(shared)} of ${next.name} going in, so they can share the squares as a relay.` };
    }
  }

  // Anything else is a real clash. Say who is there first and for how long they would share.
  const [first, next] = a.i.bedIn <= b.i.bedIn ? [a, b] : [b, a];
  const shared = Math.min(end(a.i), end(b.i)) - Math.max(a.i.bedIn, b.i.bedIn);
  if (first.i.bedIn === next.i.bedIn) {
    return { kind: 'conflict', reason: `${a.name} and ${b.name} would go into the same squares at the same time and share them for ${formatDuration(shared)}.` };
  }
  return { kind: 'conflict', reason: `${first.name} is still growing here when ${next.name} goes in, and they would share these squares for ${formatDuration(shared)}.` };
}

/**
 * Every other planting in the candidate's grid bed whose cells and in-bed time overlap it, with
 * whether they can share (interplant) or not (conflict). Plantings without cells (vessels) are not
 * checked here; use vesselLoad for those.
 */
export function conflictsFor(
  candidate: Planting,
  others: readonly Planting[],
  intervalOf: IntervalOf,
  plantOf: PlantOf,
): Clash[] {
  const ci = intervalOf(candidate);
  if (!ci || !candidate.cells) return [];
  const cPlant = plantOf(candidate.plantId);
  const cSide = { plant: cPlant, name: nameOf(plantOf, candidate.plantId), i: ci };
  const out: Clash[] = [];
  for (const o of others) {
    if (o.id === candidate.id || o.containerId !== candidate.containerId || !o.cells) continue;
    if (!cellsOverlap(candidate.cells, o.cells)) continue;
    const oi = intervalOf(o);
    if (!oi || !intervalsOverlap(ci, oi)) continue;
    const oSide = { plant: plantOf(o.plantId), name: nameOf(plantOf, o.plantId), i: oi };
    out.push({ with: o, ...classify(cSide, oSide) });
  }
  return out;
}

export interface Occupancy {
  /** Plantings in the container on that day. */
  present: Planting[];
  /** For a grid bed: cell key ("col,row") to the plantings in it that day. Empty for a vessel. */
  byCell: Map<string, Planting[]>;
}

/** What is in a container on a given day (for the season scrubber). */
export function occupiedAt(
  container: Container,
  plantings: readonly Planting[],
  day: DayNum,
  intervalOf: IntervalOf,
): Occupancy {
  const present: Planting[] = [];
  const byCell = new Map<string, Planting[]>();
  for (const p of plantings) {
    if (p.containerId !== container.id) continue;
    const i = intervalOf(p);
    if (!i || !inBedOn(i, day)) continue;
    present.push(p);
    if (container.form === 'grid' && p.cells) {
      for (const key of cellKeys(clipToBed(container, p.cells))) {
        const list = byCell.get(key);
        if (list) list.push(p);
        else byCell.set(key, [p]);
      }
    }
  }
  return { present, byCell };
}

/** A patch cut down to the bed's edges (a patch should never stick out, but stay safe). */
function clipToBed(bed: GridBed, cells: NonNullable<Planting['cells']>) {
  if (cellsInBounds(bed, cells)) return cells;
  const col = Math.max(0, cells.col);
  const row = Math.max(0, cells.row);
  return {
    col,
    row,
    w: Math.max(0, Math.min(bed.cols, cells.col + cells.w) - col),
    h: Math.max(0, Math.min(bed.rows, cells.row + cells.h) - row),
  };
}

export interface VesselLoad {
  /** Nothing is squeezed: at the busiest moment the plants use at most all of the vessel. */
  ok: boolean;
  /** Share of the vessel in use at the busiest moment of the candidate's time in it, 1 = full. */
  peak: number;
  reason?: string;
}

const VESSEL_WORDS: Record<Vessel['kind'], string> = {
  pot: 'pot',
  'grow-bag': 'grow bag',
  bucket: 'bucket',
  tower: 'tower',
};

/**
 * How full a vessel is while the candidate is in it. Each planting present uses count / maxCount of
 * the vessel (vesselFit); the busiest day is checked. A plant not suited to containers counts as
 * filling the vessel on its own; say so with vesselFit and vesselWarningText.
 */
export function vesselLoad(
  candidate: Planting,
  vessel: Vessel,
  others: readonly Planting[],
  intervalOf: IntervalOf,
  plantOf: PlantOf,
): VesselLoad {
  const ci = intervalOf(candidate);
  if (!ci) return { ok: true, peak: 0 };
  const sharing = others.filter((o) => {
    if (o.id === candidate.id || o.containerId !== vessel.id) return false;
    const oi = intervalOf(o);
    return oi !== null && intervalsOverlap(ci, oi);
  });
  const all = [candidate, ...sharing];
  const share = (p: Planting): number => {
    const plant = plantOf(p.plantId);
    if (!plant) return 0;
    const max = vesselFit(plant, vessel).maxCount;
    return max === 0 ? 1 : p.count / max;
  };

  // The load only rises when something goes in, so the busiest day is one of the bedIn days
  // inside the candidate's interval (or the candidate's own first day).
  const days = [ci.bedIn, ...sharing.map((o) => intervalOf(o)!.bedIn).filter((d) => inBedOn(ci, d))];
  let peak = 0;
  let busiest: Planting[] = [candidate];
  for (const d of days) {
    const here = all.filter((p) => inBedOn(intervalOf(p)!, d));
    const load = here.reduce((s, p) => s + share(p), 0);
    if (load > peak) {
      peak = load;
      busiest = here;
    }
  }
  if (peak <= 1 + 1e-9) return { ok: true, peak };

  const word = VESSEL_WORDS[vessel.kind];
  const ids = new Set(busiest.map((p) => p.plantId));
  if (ids.size === 1) {
    const plant = plantOf(candidate.plantId);
    const max = plant ? vesselFit(plant, vessel).maxCount : 0;
    const total = busiest.reduce((s, p) => s + p.count, 0);
    return {
      ok: false,
      peak,
      reason: `This ${word} has room for ${max} ${nameOf(plantOf, candidate.plantId)}, and this would make ${total}.`,
    };
  }
  return {
    ok: false,
    peak,
    reason: `This ${word} would be too crowded: together these plants need about ${Math.round(peak * 100)}% of the room it has.`,
  };
}
