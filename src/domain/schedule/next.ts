// The next viable planting window from a given day: the first window of this season whose bed-in
// time has not passed, otherwise next season's first. Used when a plant is dropped into the planner,
// by the assistant, and for the starter gardens, so a garden started in any month gets dates ahead
// of it rather than behind. Pure.
import type { ClimateProfile } from '../climate/types';
import type { DayNum } from '../dates';
import type { Anchor, Planting } from '../doc/schema';
import type { Plant } from '../plants/schema';
import { plantingPhases, scheduleMethod } from './project';
import { seasonOf } from './seasons';
import { plantSchedule, type ScheduleWindow, type WindowKind } from './windows';

type AutoAnchor = Extract<Anchor, { kind: 'auto' }>;
type PlaceMethod = Planting['method'];

export interface WindowChoice {
  anchor: AutoAnchor;
  /** The bed-in day the anchor gives. */
  bedIn: DayNum;
  kind: WindowKind;
  /** True when this season had no window left and the planting goes to the next. */
  nextSeason: boolean;
  window: ScheduleWindow;
  /** True when the window had just closed but a planting now still has time to crop. */
  late?: boolean;
}

/** How long after a window closes a late planting is still offered, if its harvest fits. */
export const LATE_DAYS = 42;
/** The least picking time that makes a late planting worth it. */
const LATE_MIN_PICKING = 14;

/** The anchor window name findWindow (schedule/project.ts) maps back to this window. */
function anchorWindowOf(w: ScheduleWindow, all: readonly ScheduleWindow[]): AutoAnchor['window'] | null {
  if (w.kind !== 'temperature') return w.kind;
  const same = all.filter((x) => x.kind === 'temperature' && x.method === w.method);
  const i = same.indexOf(w);
  if (i === 0) return 'spring';
  if (i === 1) return 'fall';
  return null;
}

/**
 * The next viable window for a new planting from `from` on: its auto anchor and the bed-in day it
 * gives. null when the plant has no window in this season or the next (no climate, too hot, ...).
 */
export function nextWindow(
  plant: Plant,
  climate: ClimateProfile,
  method: PlaceMethod,
  from: DayNum,
  /** True for a brand-new garden: nothing is started yet, so seeds raised indoors start on `from` at the earliest. */
  startsFresh = false,
): WindowChoice | null {
  const m = scheduleMethod(method);
  const s0 = seasonOf(climate, from);
  for (const season of [s0, s0 + 1]) {
    const schedule = plantSchedule(plant, climate, season);
    let best: WindowChoice | null = null;
    for (const w of schedule.windows) {
      if (w.method !== m) continue;
      const name = anchorWindowOf(w, schedule.windows);
      if (!name) continue;
      let day: DayNum | null = null;
      let anchor: AutoAnchor | null = null;
      // Days from sowing indoors to planting out, when seedlings are raised first.
      const lead = startsFresh && w.indoor ? w.bedIn.start - w.indoor.start : 0;
      const earliest = from + lead;
      if (w.rounds && w.rounds.length > 0) {
        const k = w.rounds.findIndex((d) => d >= earliest);
        if (k >= 0) {
          day = w.rounds[k]!;
          anchor = { kind: 'auto', window: name, season, round: k, offsetDays: 0 };
        }
      } else if (w.bedIn.end >= earliest) {
        day = Math.max(earliest, w.bedIn.start);
        const offset = day - w.bedIn.start;
        anchor = { kind: 'auto', window: name, season, offsetDays: offset };
      }
      if (day === null || !anchor) continue;
      if (!best || day < best.bedIn) best = { anchor, bedIn: day, kind: w.kind, nextSeason: season !== s0, window: w };
    }
    // A window that closed in the last few weeks may still take a late planting today (peppers set
    // out in early June), as long as there is still a harvest before frost. It wins over waiting.
    if (season === s0) {
      const late = lateChoice(plant, climate, method, schedule.windows, m, season, from, startsFresh);
      if (late && (!best || late.bedIn < best.bedIn)) best = late;
    }
    if (best) return best;
  }
  return null;
}

function lateChoice(
  plant: Plant,
  climate: ClimateProfile,
  method: PlaceMethod,
  windows: readonly ScheduleWindow[],
  m: ReturnType<typeof scheduleMethod>,
  season: number,
  from: DayNum,
  startsFresh: boolean,
): WindowChoice | null {
  for (const w of windows) {
    if (w.method !== m || w.kind === 'overwinter' || w.kind === 'perennial') continue;
    // Seeds not yet started cannot be planted out late today.
    if (startsFresh && w.indoor) continue;
    if (w.bedIn.end >= from || from - w.bedIn.end > LATE_DAYS) continue;
    const name = anchorWindowOf(w, windows);
    if (!name) continue;
    const anchor: AutoAnchor = { kind: 'auto', window: name, season, offsetDays: from - w.bedIn.start };
    if (anchor.offsetDays > 366) continue;
    const ph = plantingPhases({ id: 'late', containerId: 'late', plantId: plant.id, count: 1, method, anchor }, plant, climate);
    if (!ph?.harvest || ph.bedIn !== from || ph.harvest.end - ph.harvest.start < LATE_MIN_PICKING) continue;
    return { anchor, bedIn: from, kind: w.kind, nextSeason: false, window: w, late: true };
  }
  return null;
}
