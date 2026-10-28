// A planting's own dates: where its anchor lands in the schedule, and what actually happened.
//
// auto anchor: the named window (and succession round) of its season, plus offsetDays.
// pinned anchor: the gardener's dates, which never move.
// actual dates win over both for anything already done.
//
// A planting the plant cannot be grown that way (a method the plant has no block for) or whose
// actual dates are out of order has no dates: plantingPhases returns null, as ops.ts refuses both.
// Results are memoised per planting, plant and climate object; the document is immutable, so an
// unchanged planting is the same object and costs nothing the second time.
import { isDraft } from 'immer';
import { toDay, type DayNum, type DayRange } from '../dates';
import type { ClimateProfile } from '../climate/types';
import type { Anchor, Planting } from '../doc/schema';
import type { Plant } from '../plants/schema';
import type { Method, Reason } from './reasons';
import { seasonOf, seasonRefs } from './seasons';
import { harvestFrom, harvestInSeason, plantSchedule, type PlantSchedule, type ScheduleWindow, type WindowKind } from './windows';

export interface PlantingPhases {
  plantingId: string;
  /** The growing season the planting belongs to (its harvest season for overwinter crops). */
  season: number;
  anchor: 'auto' | 'pinned';
  /** The schedule window an auto planting sits in; null for pinned plantings or when none fits. */
  window: ScheduleWindow | null;
  kind: WindowKind | null;
  method: Method;
  round?: number;
  /** When to start seeds indoors, for plantings raised from the gardener's own seed. */
  indoor: DayRange | null;
  bedIn: DayNum;
  /** null when no viable harvest can be worked out (no climate, or not viable). */
  harvest: DayRange | null;
  /** Why the harvest ends when it does (a `harvest-until` reason naming harvest.end), when known. */
  harvestUntil: Reason | null;
  /** First day the space is free again; null for perennials. */
  bedOut: DayNum | null;
  /** Which dates came from what actually happened. */
  actual: { indoor: boolean; bedIn: boolean; ended: boolean };
}

export type AnchorWindow = Extract<Anchor, { kind: 'auto' }>['window'];

/** The outdoor method a planting uses in the schedule. */
export function scheduleMethod(method: Planting['method']): Method {
  if (method === 'direct') return 'direct';
  if (method === 'plant') return 'plant';
  return 'transplant';
}

/**
 * Can this plant be grown this way? 'direct', 'transplant' and 'plant' need the plant's own block;
 * 'bought' starts go in like transplants, so they need a transplant window; 'indoor' needs an indoor
 * block and a transplant window to plant the seedlings out in.
 */
export function methodSupported(plant: Plant, method: Planting['method']): boolean {
  const m = plant.methods;
  switch (method) {
    case 'direct':
      return m.direct !== undefined;
    case 'plant':
      return m.plant !== undefined;
    case 'transplant':
    case 'bought':
      return m.transplant !== undefined;
    case 'indoor':
      return m.indoor !== undefined && m.transplant !== undefined;
  }
}

/** Are the actual dates in order: started indoors, then into the bed, then ended (equal is fine)? */
export function actualInOrder(actual: Planting['actual']): boolean {
  if (!actual) return true;
  const seq = [actual.startedIndoors, actual.bedIn, actual.ended].filter((d): d is string => d !== undefined);
  // ISO dates compare correctly as strings.
  for (let i = 1; i < seq.length; i++) if (seq[i]! < seq[i - 1]!) return false;
  return true;
}

/**
 * Whether a bed-in day in a window gets the fall factor, by the rule the schedule used to build
 * that window: rounds (succession) get it after midsummer W, other fall windows always, spring and
 * temperature windows never. A season-long window's late rounds so get the harvest the schedule gave.
 */
function fallFactor(window: ScheduleWindow, W: DayNum, bedIn: DayNum): boolean {
  if (window.kind === 'temperature') return false;
  if (window.rounds) return bedIn > W;
  return window.kind === 'fall';
}

const isSeasonLong = (w: ScheduleWindow) => w.reasons.some((r) => r.code === 'season-long');

/** Does this planting raise its own seedlings indoors? */
function raisedIndoors(planting: Planting, plant: Plant): boolean {
  return (planting.method === 'indoor' || planting.method === 'transplant') && plant.methods.indoor !== undefined;
}

/**
 * The window an auto anchor points at. Temperature-mode schedules have 'temperature' windows only:
 * 'spring' takes the first and 'fall' the second (or the first when there is one).
 */
export function findWindow(schedule: PlantSchedule, window: AnchorWindow, method: Method): ScheduleWindow | null {
  const pick = (kind: WindowKind) => {
    const all = schedule.windows.filter((w) => w.kind === kind);
    return all.find((w) => w.method === method) ?? all[0] ?? null;
  };
  const exact = schedule.windows.find((w) => w.kind === window && w.method === method);
  if (exact) return exact;
  // A season-long spring window (succession with no summer gap) also serves fall plantings.
  if (window === 'fall') {
    const long = schedule.windows.find((w) => w.kind === 'spring' && w.method === method && w.reasons.some((r) => r.code === 'season-long'));
    if (long) return long;
  }
  const direct = pick(window);
  if (direct) return direct;
  if (schedule.mode === 'temperature' && (window === 'spring' || window === 'fall')) {
    const temps = schedule.windows.filter((w) => w.kind === 'temperature');
    const sameMethod = temps.filter((w) => w.method === method);
    const list = sameMethod.length > 0 ? sameMethod : temps;
    return (window === 'fall' ? list[1] : undefined) ?? list[0] ?? null;
  }
  return null;
}

function isPerennial(plant: Plant): boolean {
  return plant.lifecycle === 'perennial' || plant.perennial !== undefined;
}

/** Stands in for a null climate as a WeakMap key. */
const NO_CLIMATE = {};
const phaseMemo = new WeakMap<Planting, WeakMap<Plant, WeakMap<object, PlantingPhases | null>>>();

/**
 * The planting's indoor, bed-in, harvest and bed-out days, or null when they cannot be known. The
 * result is shared between callers (memoised) and must not be changed.
 */
export function plantingPhases(planting: Planting, plant: Plant, climate: ClimateProfile | null): PlantingPhases | null {
  if (isDraft(planting) || isDraft(plant)) return computePhases(planting, plant, climate);
  let byPlant = phaseMemo.get(planting);
  if (!byPlant) phaseMemo.set(planting, (byPlant = new WeakMap()));
  let byClimate = byPlant.get(plant);
  if (!byClimate) byPlant.set(plant, (byClimate = new WeakMap()));
  const key = climate ?? NO_CLIMATE;
  if (byClimate.has(key)) return byClimate.get(key)!;
  const out = computePhases(planting, plant, climate);
  byClimate.set(key, out);
  return out;
}

function computePhases(planting: Planting, plant: Plant, climate: ClimateProfile | null): PlantingPhases | null {
  if (!methodSupported(plant, planting.method) || !actualInOrder(planting.actual)) return null;
  const method = scheduleMethod(planting.method);
  const anchor = planting.anchor;
  const actual = planting.actual ?? {};
  const actualBedIn = actual.bedIn !== undefined ? toDay(actual.bedIn) : null;

  let season: number;
  let window: ScheduleWindow | null = null;
  let kind: WindowKind | null = null;
  let bedIn: DayNum;
  let harvest: DayRange | null = null;
  let harvestUntil: Reason | null = null;
  let round: number | undefined;
  let pinnedOut: DayNum | null = null;

  if (anchor.kind === 'auto') {
    if (!climate) return null;
    season = anchor.season;
    const schedule = plantSchedule(plant, climate, season);
    window = findWindow(schedule, anchor.window, method);
    if (!window) return null;
    kind = window.kind;
    const rounds = window.rounds;
    const W = seasonRefs(climate, season).W;
    if (anchor.round !== undefined && rounds && rounds.length > 0) {
      round = Math.min(anchor.round, rounds.length - 1);
    } else if (anchor.window === 'fall' && window.kind === 'spring' && rounds && isSeasonLong(window)) {
      // A fall planting in a season-long window starts at its first round after midsummer.
      const k = rounds.findIndex((d) => d > W);
      if (k >= 0) round = k;
    }
    const base = round !== undefined ? rounds![round]! : window.bedIn.start;
    bedIn = actualBedIn ?? base + anchor.offsetDays;
    if (window.kind === 'overwinter' || window.kind === 'perennial') {
      harvest = window.harvest;
    } else if (bedIn === window.bedIn.start) {
      harvest = window.harvest;
      harvestUntil = window.reasons.find((r) => r.code === 'harvest-until') ?? null;
    } else {
      const h = harvestInSeason(plant, climate, season, window.method, bedIn, fallFactor(window, W, bedIn));
      harvest = h.harvest;
      harvestUntil = h.until ?? null;
    }
  } else {
    const pinnedIn = toDay(anchor.bedIn);
    bedIn = actualBedIn ?? pinnedIn;
    pinnedOut = anchor.bedOut !== undefined ? toDay(anchor.bedOut) : null;
    if (climate) {
      const h = harvestFrom(plant, climate, method, bedIn, seasonOf(climate, pinnedIn));
      season = h.season;
      harvest = h.harvest;
      harvestUntil = h.until ?? null;
      if (isPerennial(plant) && plant.perennial) {
        const w = findWindow(plantSchedule(plant, climate, season), 'perennial', method);
        if (w) {
          harvest = w.harvest;
          harvestUntil = null;
        }
      }
    } else {
      season = Number(anchor.bedIn.slice(0, 4));
    }
  }

  let indoor: DayRange | null = null;
  if (actual.startedIndoors !== undefined) {
    const d = toDay(actual.startedIndoors);
    indoor = { start: d, end: d };
  } else if (raisedIndoors(planting, plant)) {
    const [ageMin, ageMax] = plant.methods.indoor!.ageWeeks;
    indoor = { start: bedIn - 7 * ageMax, end: bedIn - 7 * ageMin };
  }

  let bedOut: DayNum | null;
  if (actual.ended !== undefined) bedOut = toDay(actual.ended) + 1;
  else if (pinnedOut !== null) bedOut = pinnedOut;
  else if (isPerennial(plant)) bedOut = null;
  else bedOut = harvest ? harvest.end + 1 : null;

  return {
    plantingId: planting.id,
    season,
    anchor: anchor.kind,
    window,
    kind,
    method,
    ...(round !== undefined ? { round } : {}),
    indoor,
    bedIn,
    harvest,
    harvestUntil,
    bedOut,
    actual: { indoor: actual.startedIndoors !== undefined, bedIn: actualBedIn !== null, ended: actual.ended !== undefined },
  };
}

/**
 * The days a planting occupies its space, [start, end): end is the first free day, null for
 * perennials (open-ended) and for plantings whose harvest cannot be worked out.
 */
export function intervalOf(planting: Planting, plant: Plant, climate: ClimateProfile | null): { start: DayNum; end: DayNum | null } | null {
  const p = plantingPhases(planting, plant, climate);
  return p ? { start: p.bedIn, end: p.bedOut } : null;
}
