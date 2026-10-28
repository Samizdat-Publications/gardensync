// Placement maths for the planner: which way a plant goes in, which window a new planting lands in
// when it is dropped on a given day, and the adapters between the schedule and layout/occupancy.
//
// Dropping a plant uses the next viable window from the day shown (PLAN.md, "The garden model"):
// the first window of this season whose bed-in time has not passed, otherwise next season's first,
// and the planner says which. Pure: no DOM, no signals.
import type { ClimateProfile } from '../../domain/climate/types';
import { toIso, type DayNum } from '../../domain/dates';
import type { Anchor, Planting } from '../../domain/doc/schema';
import type { BedInterval, IntervalOf, PlantOf } from '../../domain/layout/occupancy';
import type { Plant } from '../../domain/plants/schema';
import {
  intervalOf,
  methodSupported,
  nextWindow,
  plantingPhases,
  scheduleMethod,
  type PlantingPhases,
  type WindowChoice,
} from '../../domain/schedule';

export { nextWindow, type WindowChoice };

export type PlaceMethod = Planting['method'];
type AutoAnchor = Extract<Anchor, { kind: 'auto' }>;

const METHOD_ORDER: PlaceMethod[] = ['direct', 'transplant', 'bought', 'plant'];

/** The ways a gardener can put this plant in the ground, in the order the planner offers them. */
export function methodsFor(plant: Plant): PlaceMethod[] {
  return METHOD_ORDER.filter((m) => methodSupported(plant, m));
}

/**
 * The way the planner suggests: sow in place when that is possible and the plant is not tender
 * with an indoor start (tomatoes and peppers are raised indoors), plant out otherwise.
 */
export function defaultMethod(plant: Plant): PlaceMethod {
  const ways = methodsFor(plant);
  const indoorTender = plant.frost === 'tender' && plant.methods.indoor !== undefined && ways.includes('transplant');
  if (ways.includes('direct') && !indoorTender) return 'direct';
  if (ways.includes('transplant')) return 'transplant';
  return ways[0] ?? 'direct';
}

/** "Sow", "Plant out" or "Plant": the verb for putting it in the ground. */
export function verbOf(method: PlaceMethod): string {
  if (method === 'direct') return 'Sow';
  if (method === 'plant') return 'Plant';
  return 'Plant out';
}

export function pastVerbOf(method: PlaceMethod): string {
  if (method === 'direct') return 'Sown';
  if (method === 'plant') return 'Planted';
  return 'Planted out';
}

export function methodLabel(method: PlaceMethod, plant: Plant): string {
  switch (method) {
    case 'direct':
      return 'Sow seed in the bed';
    case 'transplant':
      return plant.methods.indoor ? 'Raise seedlings, then plant out' : 'Plant out seedlings';
    case 'bought':
      return 'Plant out bought plants';
    case 'plant':
      return `Plant ${plant.methods.plant?.what ?? 'sets or divisions'}`;
    case 'indoor':
      return 'Start indoors';
  }
}

/** "spring window", "fall window", "next spring's window", "overwinter window". */
export function windowWords(choice: Pick<WindowChoice, 'kind' | 'nextSeason' | 'anchor' | 'late'>): string {
  const base =
    choice.kind === 'temperature'
      ? choice.anchor.window === 'fall'
        ? 'second'
        : 'main'
      : choice.kind === 'overwinter'
        ? 'overwinter'
        : choice.kind;
  if (choice.late) return `late in the ${base} window, with time still to crop`;
  const round = choice.anchor.round !== undefined && choice.anchor.round > 0 ? `, sowing ${choice.anchor.round + 1}` : '';
  if (choice.nextSeason) return choice.kind === 'spring' ? `next spring's window${round}` : `next season's ${base} window${round}`;
  return `${base} window${round}`;
}

/** The anchor a new planting gets: the next viable window, or the day itself pinned when there is no climate. */
export function anchorFor(
  plant: Plant,
  climate: ClimateProfile | null,
  method: PlaceMethod,
  from: DayNum,
): { anchor: Anchor; choice: WindowChoice | null } | null {
  if (!climate) return { anchor: { kind: 'pinned', bedIn: toIso(from) }, choice: null };
  const choice = nextWindow(plant, climate, method, from);
  return choice ? { anchor: choice.anchor, choice } : null;
}

/** layout/occupancy's IntervalOf from the schedule's own intervalOf. */
export function makeIntervalOf(climate: ClimateProfile | null, plantOf: PlantOf): IntervalOf {
  return (p: Planting): BedInterval | null => {
    const plant = plantOf(p.plantId);
    if (!plant) return null;
    const i = intervalOf(p, plant, climate);
    return i ? { bedIn: i.start, bedOut: i.end } : null;
  };
}

export function makePhasesOf(climate: ClimateProfile | null, plantOf: PlantOf): (p: Planting) => PlantingPhases | null {
  return (p) => {
    const plant = plantOf(p.plantId);
    return plant ? plantingPhases(p, plant, climate) : null;
  };
}

/** The soonest way and day this plant can go in from `from` on, or null when it has no window. */
export function soonestWay(plant: Plant, climate: ClimateProfile, from: DayNum): { method: PlaceMethod; day: DayNum } | null {
  let best: { method: PlaceMethod; day: DayNum } | null = null;
  for (const method of methodsFor(plant)) {
    if (method === 'bought') continue;
    const c = nextWindow(plant, climate, method, from);
    if (c && (!best || c.bedIn < best.day)) best = { method, day: c.bedIn };
  }
  return best;
}

/** Days in "this week", counting today: the palette's "Can go in this week" filter. */
export const WEEK_DAYS = 7;
