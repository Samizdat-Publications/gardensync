// The jobs between two days for a garden's plantings (SCHEDULE_SPEC.md section 13).
//
// Every task has a stable id `${plantingId}:${kind}:${season}[:round]`. It names what the job is and
// which season it belongs to, never a date, so a ticked task stays ticked when new frost dates
// re-flow the schedule. For an auto planting the season is its anchor's. For a pinned planting it is
// the calendar year of the pinned bed-in date, not the climate's season (which needs a climate and
// changes with the hemisphere), so setting or changing the town never loses a tick. Tasks are
// filtered by date, never by "this year": a late-December view shows January's jobs for the coming
// season.
import { toDay, type DayNum } from '../dates';
import type { Garden, Planting } from '../doc/schema';
import type { Plant } from '../plants/schema';
import type { Reason } from './reasons';
import { plantingPhases, type PlantingPhases } from './project';
import { seasonOf, seasonRefs } from './seasons';
import { scheduleMode } from './windows';

export type TaskKind =
  | 'start-indoors'
  | 'harden-off'
  | 'transplant'
  | 'direct-sow'
  | 'plant'
  | 'plant-next-year'
  | 'succession-sow'
  | 'start-picking'
  | 'end-of-season'
  | 'frost-possible';

export interface Task {
  id: string;
  plantingId: string;
  plantId: string;
  containerId: string;
  kind: TaskKind;
  season: number;
  round?: number;
  /** The day, or the first day of a range. */
  date: DayNum;
  /** Last day of the range, when the job can be done any day in it. */
  until?: DayNum;
  reason: Reason;
  /** Ticked in the garden's task state, or already recorded as done. */
  done: boolean;
}

const KIND_ORDER: Record<TaskKind, number> = {
  'frost-possible': 0,
  'start-indoors': 1,
  'harden-off': 2,
  transplant: 3,
  'direct-sow': 3,
  plant: 3,
  'plant-next-year': 3,
  'succession-sow': 4,
  'start-picking': 5,
  'end-of-season': 6,
};

export function taskId(plantingId: string, kind: TaskKind, season: number, round?: number): string {
  return `${plantingId}:${kind}:${season}${round !== undefined ? `:${round}` : ''}`;
}

/** The season a planting's task ids name: the anchor's season, or the pinned bed-in year. */
export function taskSeason(planting: Planting, phases: PlantingPhases): number {
  return planting.anchor.kind === 'pinned' ? Number(planting.anchor.bedIn.slice(0, 4)) : phases.season;
}

type PlantLookup = ReadonlyMap<string, Plant> | Readonly<Record<string, Plant>>;

function lookup(plants: PlantLookup, id: string): Plant | undefined {
  return plants instanceof Map ? plants.get(id) : (plants as Readonly<Record<string, Plant>>)[id];
}

function bedInKind(p: PlantingPhases): TaskKind {
  if (p.kind === 'overwinter') return 'plant-next-year';
  if (p.method === 'direct') return 'direct-sow';
  if (p.method === 'plant') return 'plant';
  return 'transplant';
}

/** The jobs whose day or range touches [from, to], sorted by date. */
/**
 * The reason that set a window's opening day: a later hold (frost risk, soil warmth, heat) wins
 * over the published offset it moved, so a job's date and its reason never disagree.
 */
const DECIDING_ORDER: readonly Reason['code'][] = ['soil-warm', 'held-to-lf90', 'warmest-weeks', 'early-for-heat', 'fall-count-back', 'overwinter-plant', 'temp-range', 'frost-offset'];
function decidingReason(reasons: readonly Reason[], opens: DayNum): Reason {
  const exact = reasons.find((x) => DECIDING_ORDER.includes(x.code) && 'day' in x && x.day === opens);
  if (exact) return exact;
  for (const code of DECIDING_ORDER) {
    const r = reasons.find((x) => x.code === code);
    if (r) return r;
  }
  return reasons[0] ?? { code: 'approximate' };
}

export function tasksFor(garden: Garden, plants: PlantLookup, from: DayNum, to: DayNum): Task[] {
  const out: Task[] = [];
  const climate = garden.climate;
  const ticked = garden.taskState;

  for (const planting of garden.plantings) {
    const plant = lookup(plants, planting.plantId);
    if (!plant) continue;
    const phases = plantingPhases(planting, plant, climate);
    if (!phases) continue;
    const tasks = tasksForPlanting(garden, planting, plant, phases, from, to);
    const failed = planting.actual?.failed === true;
    for (const t of tasks) {
      t.done ||= ticked[t.id] !== undefined;
      if (failed && !t.done) continue;
      out.push(t);
    }
  }

  const hit = (t: Task) => t.date <= to && (t.until ?? t.date) >= from;
  return out
    .filter(hit)
    .sort((a, b) => a.date - b.date || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function tasksForPlanting(
  garden: Garden,
  planting: Planting,
  plant: Plant,
  p: PlantingPhases,
  from: DayNum,
  to: DayNum,
): Task[] {
  const tasks: Task[] = [];
  const season = p.season;
  const idSeason = taskSeason(planting, p);
  const base = { plantingId: planting.id, plantId: planting.plantId, containerId: planting.containerId, season };
  const add = (kind: TaskKind, date: DayNum, until: DayNum | undefined, reason: Reason, done = false, round?: number) => {
    tasks.push({
      id: taskId(planting.id, kind, idSeason, round),
      ...base,
      kind,
      ...(round !== undefined ? { round } : {}),
      date,
      ...(until !== undefined && until > date ? { until } : {}),
      reason,
      done,
    });
  };
  const actual = planting.actual ?? {};
  const w = p.window;

  // Raising seedlings
  if (p.indoor) {
    if (p.actual.indoor) add('start-indoors', p.indoor.start, undefined, { code: 'done', day: p.indoor.start }, true);
    else add('start-indoors', p.indoor.start, p.indoor.end, { code: 'indoor-start', weeks: plant.methods.indoor!.ageWeeks });
    if (!p.actual.bedIn) add('harden-off', p.bedIn - 10, p.bedIn - 1, { code: 'harden-off' });
  }

  // Into the bed
  const kind = bedInKind(p);
  if (p.actual.bedIn) {
    add(kind, p.bedIn, undefined, { code: 'done', day: toDay(actual.bedIn!) }, true, p.round);
  } else if (planting.anchor.kind === 'pinned') {
    add(kind, p.bedIn, undefined, { code: 'pinned-date', day: p.bedIn }, false, p.round);
  } else if (w) {
    const offset = planting.anchor.offsetDays;
    // A succession crop's first sowing runs until the next round is due, not to the end of a window
    // that may span the whole season; each later round gets its own task.
    const nextRound = w.rounds?.[(p.round ?? 0) + 1];
    const windowEnd = w.bedIn.end;
    const end = nextRound !== undefined && plant.succession ? Math.min(windowEnd, nextRound + offset - 1) : windowEnd;
    if (p.round === undefined && p.bedIn > windowEnd) {
      // Past its usual window: one day, and a reason that says so rather than the window's rule.
      add(kind, p.bedIn, undefined, { code: 'late-planting', usualEnd: windowEnd }, false, p.round);
    } else {
      const until = p.round !== undefined ? undefined : end > p.bedIn ? end : undefined;
      // A later succession sowing is due because of the succession, not the first sowing's rule.
      const later = p.round !== undefined && p.round > 0 ? w.reasons.find((r) => r.code === 'succession') : undefined;
      add(kind, p.bedIn, until, later ?? decidingReason(w.reasons, w.bedIn.start), false, p.round);
    }
  }

  // Next succession round, unless the garden already has a planting for it
  if (w?.rounds && planting.anchor.kind === 'auto') {
    const r = p.round ?? 0;
    const next = w.rounds[r + 1];
    const anchor = planting.anchor;
    const taken = garden.plantings.some(
      (q) =>
        q.id !== planting.id &&
        q.plantId === planting.plantId &&
        q.anchor.kind === 'auto' &&
        q.anchor.season === anchor.season &&
        q.anchor.window === anchor.window &&
        (q.anchor.round ?? 0) === r + 1 &&
        (planting.seriesId === undefined || q.seriesId === planting.seriesId),
    );
    if (next !== undefined && !taken && plant.succession) {
      add('succession-sow', next + anchor.offsetDays, undefined, { code: 'succession', everyDays: plant.succession.everyDays, count: w.rounds.length }, false, r + 1);
    }
  }

  // Harvest
  if (p.window?.yearly) {
    for (const y of p.window.yearly) {
      tasks.push({
        id: taskId(planting.id, 'start-picking', y.season),
        ...base,
        season: y.season,
        kind: 'start-picking',
        date: y.harvest.start,
        until: y.harvest.end,
        reason: w!.reasons.find((r) => r.code === 'perennial-harvest') ?? { code: 'approximate' },
        done: false,
      });
    }
  } else if (p.harvest) {
    add('start-picking', p.harvest.start, p.harvest.end, { code: 'maturity', days: p.harvest.start - p.bedIn, method: p.method, extraDays: 0 });
  }
  if (p.bedOut !== null) {
    const last = p.bedOut - 1;
    // The planting's own harvest reason names its own last day; a pinned bed-out names that day.
    const own = p.harvestUntil?.code === 'harvest-until' && p.harvestUntil.day === last ? p.harvestUntil : null;
    if (p.actual.ended) add('end-of-season', last, undefined, { code: 'done', day: last }, true);
    else add('end-of-season', last, undefined, own ?? { code: 'harvest-until', day: last, cap: 'window', estimated: false });
  }

  // Frost reminders for tender crops still in the ground
  const climate = garden.climate;
  if (climate && plant.frost === 'tender' && scheduleMode(climate) !== 'temperature' && scheduleMode(climate) !== 'none') {
    for (let s = seasonOf(climate, from) - 1; s <= seasonOf(climate, to) + 1; s++) {
      const ff10 = seasonRefs(climate, s).FF10;
      if (ff10 === null || ff10 < from || ff10 > to) continue;
      const inGround = p.bedIn <= ff10 && (p.bedOut === null || ff10 < p.bedOut);
      if (inGround) {
        tasks.push({ id: taskId(planting.id, 'frost-possible', s), ...base, season: s, kind: 'frost-possible', date: ff10, reason: { code: 'frost-possible', day: ff10 }, done: false });
      }
    }
  }
  return tasks;
}

