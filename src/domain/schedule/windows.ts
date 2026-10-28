// plantSchedule: a plant record and a climate profile in, planting windows for one season out.
//
// This is the code behind every date the gardener sees. It follows docs/v8/SCHEDULE_SPEC.md section
// by section; the "Changes during build" section at the end of that file lists every place it differs
// from the first draft and why. All arithmetic is on integer day numbers.
import { nextMonthDayAfter, type DayNum, type DayRange } from '../dates';
import type { ClimateProfile } from '../climate/types';
import type { Plant } from '../plants/schema';
import type { CapKind, Method, Reason } from './reasons';
import {
  circularDayOf,
  coolRunBefore,
  coolestRun,
  dailyTemps,
  seasonRefs,
  type DailyTemps,
  type SeasonRefs,
} from './seasons';

export type WindowKind = 'spring' | 'fall' | 'overwinter' | 'perennial' | 'temperature';
export type ScheduleMode = 'frost' | 'temperature' | 'frost-only' | 'none';

export interface ScheduleWindow {
  kind: WindowKind;
  method: Method;
  bedIn: DayRange;
  indoor?: DayRange;
  hardenOff?: DayRange;
  /** Harvest of a planting made on the first bed-in day. First season's harvest for perennials. */
  harvest: DayRange;
  yearly?: { season: number; harvest: DayRange }[];
  /** Succession bed-in days, when the plant has succession. */
  rounds?: DayNum[];
  reasons: Reason[];
  warnings: Reason[];
}

export interface PlantSchedule {
  plantId: string;
  season: number;
  mode: ScheduleMode;
  approximate: boolean;
  windows: ScheduleWindow[];
  notViable: { kind: WindowKind; method?: Method; reason: Reason }[];
}

// ---- Tunables, each named in the spec ------------------------------------------------------------

/** Weeks at the indoor stage when a plant has no indoor block (section 3). */
const DEFAULT_AGE_WEEKS = 4;
/** Harvests shorter than this are not viable (section 4). */
const MIN_HARVEST_DAYS = 7;
/** Fall factor: shortening days slow growth (section 6). */
const FALL_EXTRA_DAYS = 14;
/** Tender fall crops get at least this much picking before frost (section 6). */
const TENDER_FALL_PICKING = 21;
/** Flowering point as a share of the time from bed-in to first harvest (section 5.5). */
const FLOWERING_SHARE = 0.6;
/** Heat cap: harvest of a fruiting crop ends once the max passes fruitSetMaxC + this (section 4). */
const HEAT_CAP_MARGIN_C = 4;
/** Bolting: more than this share of days above temp.maxC fails (section 5.5). */
const BOLT_SHARE = 0.25;
/** Temperature mode: share of days inside the crop's range (section 10). */
const IN_RANGE_SHARE = 0.85;
/** Where the soil never warms enough, tender plants wait for days within this of the peak mean. */
const NEAR_PEAK_C = 2;
/** A spring window pushed past its published end keeps this many days (section 5.4). */
const MIN_WINDOW_DAYS = 14;

// ---- Context --------------------------------------------------------------------------------------

interface Ctx {
  plant: Plant;
  profile: ClimateProfile;
  season: number;
  refs: SeasonRefs;
  prev: SeasonRefs;
  next: SeasonRefs;
  temps: DailyTemps | null;
  mode: ScheduleMode;
}

export function scheduleMode(profile: ClimateProfile | null): ScheduleMode {
  if (!profile) return 'none';
  if (profile.lastFrost.p50 !== null && profile.firstFrost.p50 !== null) return profile.monthly ? 'frost' : 'frost-only';
  return profile.monthly ? 'temperature' : 'none';
}

function ctxFor(plant: Plant, profile: ClimateProfile, season: number): Ctx {
  return {
    plant,
    profile,
    season,
    refs: seasonRefs(profile, season),
    prev: seasonRefs(profile, season - 1),
    next: seasonRefs(profile, season + 1),
    temps: dailyTemps(profile),
    mode: scheduleMode(profile),
  };
}

const tMean = (t: DailyTemps, d: DayNum) => t.mean[circularDayOf(d)]!;
const tMax = (t: DailyTemps, d: DayNum) => t.max[circularDayOf(d)]!;

// ---- Section 3: method timing ---------------------------------------------------------------------

export function outdoorMethods(plant: Plant): Method[] {
  const out: Method[] = [];
  if (plant.methods.transplant) out.push('transplant');
  if (plant.methods.direct) out.push('direct');
  if (plant.methods.plant) out.push('plant');
  return out;
}

function ageWeeks(plant: Plant): readonly [number, number] {
  return plant.methods.indoor?.ageWeeks ?? [DEFAULT_AGE_WEEKS, DEFAULT_AGE_WEEKS];
}

/** A transplant of a crop timed from sowing still needs this long in the bed before harvest. */
const MIN_DAYS_AFTER_TRANSPLANT = 7;

/**
 * Days from bed-in to first harvest, per section 3. A quick crop timed from sowing whose seedlings
 * are older than its days to maturity would come out before bed-in; it gets at least a week.
 */
export function daysToHarvest(plant: Plant, method: Method): number {
  const { days, from } = plant.maturity;
  const ageMin = ageWeeks(plant)[0];
  if (method === 'plant') return days;
  if (from === 'transplant') return method === 'transplant' ? days : days + 7 * ageMin;
  return method === 'direct' ? days : Math.max(MIN_DAYS_AFTER_TRANSPLANT, days - 7 * ageMin + 7);
}

// ---- Section 4: caps and harvests -----------------------------------------------------------------

/**
 * What ends a harvest. `day` is exclusive: the first day the crop can no longer be picked (the frost
 * itself, the first too-hot or out-of-range day, or the day after the picking window). The harvest
 * always ends the day before it.
 */
interface Cap {
  day: DayNum;
  kind: CapKind;
  estimated: boolean;
}

/**
 * A half-hardy crop in a place whose measured winters have no median -2 C night (Phoenix) is not cut
 * down by winter there, so it takes the hardy rules. For typed-in profiles a null -2 C date only
 * means "unknown" and keeps the spec's estimate.
 */
function hardiness(ctx: Ctx, refs: SeasonRefs): Plant['frost'] {
  const f = ctx.plant.frost;
  return f === 'half-hardy' && refs.H2 === null && ctx.profile.source === 'computed' ? 'hardy' : f;
}

/** Frost-mode harvest cap for the season (section 4). */
function frostCap(ctx: Ctx, refs: SeasonRefs): Cap | null {
  const { FF50, H2, H5 } = refs;
  if (FF50 === null) return null;
  const frost = hardiness(ctx, refs);
  if (frost === 'tender') return { day: FF50, kind: 'first-frost', estimated: false };
  if (frost === 'half-hardy') return H2 !== null ? { day: H2, kind: 'minus2', estimated: false } : { day: FF50 + 14, kind: 'minus2', estimated: true };
  if (H5 !== null) return { day: H5, kind: 'minus5', estimated: false };
  return { day: (H2 ?? FF50) + 28, kind: 'minus5', estimated: true };
}

interface HarvestOk {
  ok: true;
  range: DayRange;
  cap: Cap;
  /** Day fruit setting resumes after summer heat (fall windows of fruiting crops), if it waited. */
  setDay?: DayNum;
}
interface HarvestBad {
  ok: false;
  reason: Reason;
}
type HarvestResult = HarvestOk | HarvestBad;

/**
 * The harvest of a planting bedded in on day d. `fall` adds the fall factor. Fruiting crops in fall
 * wait out summer heat: fruit sets from the first day after flowering whose max is under
 * fruitSetMaxC, and ripens over the same time it would have taken from flowering.
 */
/**
 * Temperature-mode cap: the first day after maturity when the mean temperature leaves the crop's
 * range, or (tender crops) when frost becomes possible. Measured from the planting itself, so a
 * cool-season crop is not cut off at the edge of the season.
 */
function temperatureCap(ctx: Ctx, M: DayNum): Cap {
  const { plant, temps, profile } = ctx;
  let cap: Cap = { day: M + 366, kind: 'out-of-range', estimated: false };
  if (temps) {
    for (let x = M + 1; x <= M + 365; x++) {
      if (!inRange(plant, tMean(temps, x))) {
        cap = { day: x, kind: 'out-of-range', estimated: false };
        break;
      }
    }
  }
  if (plant.frost === 'tender' && profile.firstFrost.p10 !== null) {
    const ff = nextMonthDayAfter(M, profile.firstFrost.p10);
    if (ff < cap.day) cap = { day: ff, kind: 'frost-risk', estimated: false };
  }
  return cap;
}

function harvestFor(ctx: Ctx, refs: SeasonRefs, method: Method, d: DayNum, fall: boolean): HarvestResult {
  const { plant, temps } = ctx;
  let M = d + daysToHarvest(plant, method) + (fall ? FALL_EXTRA_DAYS : 0);
  const temperature = ctx.mode === 'temperature';
  const frost = temperature ? temperatureCap(ctx, M) : frostCap(ctx, refs);
  if (!frost) return { ok: false, reason: { code: 'needs-town' } };
  let setDay: DayNum | undefined;
  const fs = plant.fruitSetMaxC;
  if (fall && fs !== undefined && temps) {
    const F = d + Math.round(FLOWERING_SHARE * (M - d));
    let s = F;
    while (s < frost.day && tMax(temps, s) > fs) s++;
    if (s >= frost.day) return { ok: false, reason: { code: 'too-short', day: frost.day, cap: frost.kind } };
    if (s > F) {
      setDay = s;
      M = Math.max(M, s + (M - F));
    }
  }
  let end = frost.day - 1;
  let cap: Cap = frost;
  if ((!plant.harvest.untilFrost || temperature) && M + plant.harvest.windowDays < end) {
    end = M + plant.harvest.windowDays;
    cap = { day: end + 1, kind: 'window', estimated: false };
  }
  if (fs !== undefined && temps && plant.harvest.type !== 'once') {
    for (let x = M + 1; x <= end; x++) {
      if (tMax(temps, x) > fs + HEAT_CAP_MARGIN_C) {
        end = x - 1;
        cap = { day: x, kind: 'heat', estimated: false };
        break;
      }
    }
  }
  if (fs === undefined && temps && plant.harvest.type !== 'once') {
    // Leafy crops: a mean this far above their range makes them bolt or burn (Phoenix kale in May).
    for (let x = M + 1; x <= end; x++) {
      if (tMean(temps, x) > plant.temp.maxC + HEAT_CAP_MARGIN_C) {
        end = x - 1;
        cap = { day: x, kind: 'bolting-heat', estimated: false };
        break;
      }
    }
  }
  // Tender crops in temperature mode get three weeks of picking, as tender fall crops do (section 6).
  const minLen = temperature && plant.frost === 'tender' ? Math.min(plant.harvest.windowDays, TENDER_FALL_PICKING) : MIN_HARVEST_DAYS;
  if (end - M + 1 < minLen) return { ok: false, reason: { code: 'too-short', day: cap.day, cap: cap.kind } };
  return { ok: true, range: { start: M, end }, cap, ...(setDay !== undefined ? { setDay } : {}) };
}

// ---- Section 5.5: heat guards ---------------------------------------------------------------------

type HeatFail = { what: 'fruit-set' | 'bolting'; tempC: number } | null;

function heatFail(ctx: Ctx, method: Method, d: DayNum, fall: boolean): HeatFail {
  const { plant, temps } = ctx;
  if (!temps) return null;
  const M = d + daysToHarvest(plant, method) + (fall ? FALL_EXTRA_DAYS : 0);
  const fs = plant.fruitSetMaxC;
  if (fs !== undefined) {
    // Fall windows wait out the heat in harvestFor instead of being dropped.
    if (fall) return null;
    const F = d + Math.round(FLOWERING_SHARE * (M - d));
    return tMax(temps, F) > fs ? { what: 'fruit-set', tempC: fs } : null;
  }
  // Bolting comes from heat in long days. A bed-in after midsummer matures into shortening days and
  // only its second half has to be cool (lettuce sown into late-summer heat in the desert).
  const from = fall ? d + Math.floor((M - d) / 2) : d;
  let hot = 0;
  for (let x = from; x <= M; x++) if (tMean(temps, x) > plant.temp.maxC) hot++;
  return hot > BOLT_SHARE * (M - from + 1) ? { what: 'bolting', tempC: plant.temp.maxC } : null;
}

/** First day in [from, to] whose mean temperature reaches t, or null. */
function firstMeanAtLeast(temps: DailyTemps, from: DayNum, to: DayNum, t: number): DayNum | null {
  for (let d = from; d <= to; d++) if (tMean(temps, d) >= t) return d;
  return null;
}

/** The earliest run of days in [start, end] passing `ok`; and the first failure seen before or in it. */
function earliestRun(start: DayNum, end: DayNum, ok: (d: DayNum) => boolean): DayRange | null {
  let s: DayNum | null = null;
  for (let d = start; d <= end; d++) {
    if (ok(d)) {
      if (s === null) s = d;
    } else if (s !== null) {
      return { start: s, end: d - 1 };
    }
  }
  return s === null ? null : { start: s, end };
}

function heatReason(f: NonNullable<HeatFail>): Reason {
  return { code: 'heat-trimmed', tempC: f.tempC, what: f.what };
}

function tooHot(f: NonNullable<HeatFail>): Reason {
  return { code: 'too-hot', tempC: f.tempC };
}

// ---- Warnings shared by windows -------------------------------------------------------------------

function commonWarnings(ctx: Ctx, method: Method, d: DayNum, M: DayNum): Reason[] {
  const { plant, temps, refs } = ctx;
  const out: Reason[] = [];
  if (plant.frost === 'tender' && ctx.mode !== 'temperature' && refs.FF10 !== null) out.push({ code: 'frost-possible', day: refs.FF10 });
  if (plant.frost === 'tender' && temps) {
    let cool = 0;
    let sum = 0;
    for (let x = d; x <= M; x++) {
      const t = tMean(temps, x);
      sum += t;
      if (t < plant.temp.minC - 1) cool++;
    }
    if (cool > 0.5 * (M - d + 1)) out.push({ code: 'cool-summer', meanC: sum / (M - d + 1), minC: plant.temp.minC });
  }
  if (ctx.mode === 'frost-only') out.push({ code: 'frost-only' });
  return out;
}

function indoorFor(plant: Plant, method: Method, bedIn: DayRange): Pick<ScheduleWindow, 'indoor' | 'hardenOff'> {
  if (method !== 'transplant' || !plant.methods.indoor) return {};
  const [ageMin, ageMax] = plant.methods.indoor.ageWeeks;
  return {
    indoor: { start: bedIn.start - 7 * ageMax, end: bedIn.end - 7 * ageMin },
    hardenOff: { start: bedIn.start - 10, end: bedIn.start - 1 },
  };
}

function maturityReason(plant: Plant, method: Method, fall: boolean): Reason {
  return { code: 'maturity', days: daysToHarvest(plant, method), method, extraDays: fall ? FALL_EXTRA_DAYS : 0 };
}

function harvestReasons(plant: Plant, h: HarvestOk): Reason[] {
  const out: Reason[] = [];
  if (h.setDay !== undefined) out.push({ code: 'fall-heat-set', day: h.setDay, tempC: plant.fruitSetMaxC ?? 0 });
  // The reason names the last day of picking, which is the day before the cap.
  out.push({ code: 'harvest-until', day: h.range.end, cap: h.cap.kind, estimated: h.cap.estimated });
  return out;
}

// ---- Section 5: spring windows --------------------------------------------------------------------

interface Built {
  windows: ScheduleWindow[];
  notViable: PlantSchedule['notViable'];
}

function springWindow(ctx: Ctx, method: Method, out: Built): ScheduleWindow | null {
  const { plant, refs, temps } = ctx;
  const LF50 = refs.LF50!;
  const weeks = plant.methods[method]!.weeks;
  let start = LF50 + 7 * weeks[0];
  let end = LF50 + 7 * weeks[1];
  const reasons: Reason[] = [{ code: 'frost-offset', method, weeks, lastFrost: LF50 }];
  const warnings: Reason[] = [];
  const tender = plant.frost === 'tender';
  if (tender && refs.LF90 !== null && refs.LF90 > start) {
    start = refs.LF90;
    reasons.push({ code: 'held-to-lf90', day: start });
  }

  // Soil guard. Direct sowing: spec 5.3. Tender transplants and plantings: the same cold soil stalls them.
  const soil = plant.soilMinC;
  if (temps && soil !== undefined && ((method === 'direct' && soil >= 10) || (tender && method !== 'direct'))) {
    const warm = firstMeanAtLeast(temps, refs.start, refs.W, soil);
    if (warm === null) {
      if (method === 'direct') {
        out.notViable.push({ kind: 'spring', method, reason: { code: 'soil-never-warm', tempC: soil, method } });
        return null;
      }
      warnings.push({ code: 'soil-never-warm', tempC: soil, method });
      // Never warm enough: wait at least for the warmest stretch of the year, within 2 C of the
      // season's peak mean (Edinburgh growers plant tender crops out in June).
      let peak = -Infinity;
      for (let x = refs.start; x <= refs.end; x++) peak = Math.max(peak, tMean(temps, x));
      const nearPeak = firstMeanAtLeast(temps, refs.start, refs.W, peak - NEAR_PEAK_C);
      if (nearPeak !== null && nearPeak > start) {
        start = nearPeak;
        reasons.push({ code: 'warmest-weeks', day: nearPeak, tempC: soil });
      }
    } else if (warm > start) {
      // Where waiting for warm soil would hand more than a week of harvest to summer heat (desert
      // climates), the window opens at the frost-safe date instead: extension calendars there sow and
      // plant before the mean air temperature reaches the germination minimum, as sunny soil runs warmer.
      const early = harvestFor(ctx, refs, method, start, false);
      const late = harvestFor(ctx, refs, method, warm, false);
      const len = (h: HarvestResult) => (h.ok ? h.range.end - h.range.start + 1 : 0);
      // Only heat counts: a later sowing that loses picking days to the autumn frost instead is
      // what waiting for warm soil costs everywhere (cosmos in the Ohio fixture).
      const capOf = (h: HarvestResult) => (h.ok ? h.cap.kind : h.reason.code === 'too-short' ? h.reason.cap : null);
      const heatCut = (h: HarvestResult) => capOf(h) === 'heat' || capOf(h) === 'bolting-heat';
      if (heatCut(late) && len(early) - len(late) > MIN_HARVEST_DAYS) {
        end = Math.max(end, warm + MIN_WINDOW_DAYS);
        reasons.push({ code: 'early-for-heat', day: warm, tempC: soil });
      } else {
        start = warm;
        reasons.push({ code: 'soil-warm', method, day: warm, tempC: soil });
      }
    }
  }
  // Pushed (nearly) past its published end, the window keeps two weeks.
  if (end - start + 1 < MIN_HARVEST_DAYS) end = start + MIN_WINDOW_DAYS;

  let firstFail: HeatFail = null;
  let lastBad: HarvestBad | null = null;
  const run = earliestRun(start, end, (d) => {
    const f = heatFail(ctx, method, d, false);
    if (f) {
      firstFail ??= f;
      return false;
    }
    const h = harvestFor(ctx, refs, method, d, false);
    if (!h.ok) {
      lastBad ??= h;
      return false;
    }
    return true;
  });
  if (!run) {
    const fail = firstFail as HeatFail;
    const bad = lastBad as HarvestBad | null;
    out.notViable.push({ kind: 'spring', method, reason: fail ? tooHot(fail) : (bad?.reason ?? { code: 'too-short', day: end, cap: 'window' }) });
    return null;
  }
  if (run.end < end && firstFail) reasons.push(heatReason(firstFail));
  const bedIn = run;
  const h = harvestFor(ctx, refs, method, bedIn.start, false) as HarvestOk;
  const ind = indoorFor(plant, method, bedIn);
  if (ind.indoor) reasons.push({ code: 'indoor-start', weeks: plant.methods.indoor!.ageWeeks }, { code: 'harden-off' });
  reasons.push(maturityReason(plant, method, false), ...harvestReasons(plant, h));
  const common = commonWarnings(ctx, method, bedIn.start, h.range.start);
  // "Too cool" already says it; drop the soil note then.
  const merged = common.some((w) => w.code === 'cool-summer') ? warnings.filter((w) => w.code !== 'soil-never-warm') : warnings;
  merged.push(...common);
  return { kind: 'spring', method, bedIn, ...ind, harvest: h.range, reasons, warnings: merged };
}

// ---- Section 6: fall windows ----------------------------------------------------------------------

interface FallRef {
  day: DayNum;
  kind: 'frost-risk' | 'first-frost' | 'minus2' | 'minus5';
  estimated: boolean;
}

function fallRef(ctx: Ctx): FallRef | null {
  const { plant, refs } = ctx;
  const { FF50, FF10, H2, H5 } = refs;
  if (FF50 === null) return null;
  if (plant.frost === 'tender') return FF10 !== null ? { day: FF10, kind: 'frost-risk', estimated: false } : { day: FF50, kind: 'first-frost', estimated: false };
  // Pods and fruit are spoiled by the first frost even on a hardy plant (fall peas).
  if (plant.fruitSetMaxC !== undefined) return { day: FF50, kind: 'first-frost', estimated: false };
  if (hardiness(ctx, refs) === 'half-hardy') return H2 !== null ? { day: H2, kind: 'minus2', estimated: false } : { day: FF50 + 7, kind: 'minus2', estimated: true };
  if (H5 !== null) return { day: H5, kind: 'minus5', estimated: false };
  return { day: (H2 ?? FF50) + 21, kind: 'minus5', estimated: true };
}

/** Latest and earliest fall bed-in days before any guards, or null. */
function fallBounds(ctx: Ctx, method: Method): { ref: FallRef; need: number; latest: DayNum; earliest: DayNum } | null {
  const { plant } = ctx;
  if (!plant.fall) return null;
  const ref = fallRef(ctx);
  if (!ref) return null;
  const picking = plant.frost === 'tender' ? Math.min(plant.harvest.windowDays, TENDER_FALL_PICKING) : 0;
  const need = daysToHarvest(plant, method) + FALL_EXTRA_DAYS + picking;
  const latest = ref.day - need;
  return { ref, need, latest, earliest: latest - 7 * plant.fall.windowWeeks };
}

function fallWindow(ctx: Ctx, method: Method, spring: ScheduleWindow | undefined, out: Built): ScheduleWindow | null {
  const { plant, refs } = ctx;
  const b = fallBounds(ctx, method);
  if (!b) return null;
  const reasons: Reason[] = [
    { code: 'fall-count-back', ref: b.ref.day, refKind: b.ref.kind, days: b.need, pickingDays: b.need - daysToHarvest(plant, method) - FALL_EXTRA_DAYS, estimated: b.ref.estimated },
  ];
  let earliest = b.earliest;
  const soil = plant.soilMinC;
  if (method === 'direct' && soil !== undefined && soil >= 10 && ctx.temps) {
    // Seed sown into soil that never warms enough does not come up in autumn either.
    if (firstMeanAtLeast(ctx.temps, refs.start, refs.end, soil) === null) {
      out.notViable.push({ kind: 'fall', method, reason: { code: 'soil-never-warm', tempC: soil, method } });
      return null;
    }
  }
  if (spring && spring.bedIn.end >= earliest) {
    earliest = spring.bedIn.end + 1;
    reasons.push({ code: 'after-spring', day: earliest });
  }
  if (earliest > b.latest) {
    out.notViable.push({ kind: 'fall', method, reason: { code: 'no-room', ref: b.ref.day } });
    return null;
  }
  let firstFail: HeatFail = null;
  let bad: HarvestBad | null = null;
  const run = earliestRun(earliest, b.latest, (d) => {
    const f = heatFail(ctx, method, d, true);
    if (f) {
      firstFail ??= f;
      return false;
    }
    const h = harvestFor(ctx, refs, method, d, true);
    if (!h.ok) {
      bad ??= h;
      return false;
    }
    return true;
  });
  if (!run) {
    const fail = firstFail as HeatFail;
    const why = bad as HarvestBad | null;
    out.notViable.push({ kind: 'fall', method, reason: fail ? tooHot(fail) : (why?.reason ?? { code: 'no-room', ref: b.ref.day }) });
    return null;
  }
  if (run.start > earliest && firstFail) reasons.push(heatReason(firstFail));
  const h = harvestFor(ctx, refs, method, run.start, true) as HarvestOk;
  const ind = indoorFor(plant, method, run);
  if (ind.indoor) reasons.push({ code: 'indoor-start', weeks: plant.methods.indoor!.ageWeeks }, { code: 'harden-off' });
  reasons.push(maturityReason(plant, method, true), ...harvestReasons(plant, h));
  const warnings = commonWarnings(ctx, method, run.start, h.range.start);
  return { kind: 'fall', method, bedIn: run, ...ind, harvest: h.range, reasons, warnings };
}

// ---- Section 7: succession ------------------------------------------------------------------------

function successionMethod(plant: Plant, windows: ScheduleWindow[]): Method | null {
  for (const m of ['direct', 'transplant', 'plant'] as const) if (windows.some((w) => w.kind === 'spring' && w.method === m)) return m;
  return null;
}

function addSuccession(ctx: Ctx, windows: ScheduleWindow[]): void {
  const { plant, refs, temps } = ctx;
  if (!plant.succession) return;
  const method = successionMethod(plant, windows);
  if (!method) return;
  const spring = windows.find((w) => w.kind === 'spring' && w.method === method)!;
  const fall = windows.find((w) => w.kind === 'fall' && w.method === method);
  const fb = fallBounds(ctx, method);
  const cap = frostCap(ctx, refs);
  const last = fb ? fb.latest : cap ? cap.day - daysToHarvest(plant, method) - MIN_HARVEST_DAYS : spring.bedIn.end;
  const warm =
    temps && method === 'direct' && plant.soilMinC !== undefined && plant.soilMinC >= 10
      ? firstMeanAtLeast(temps, refs.start, refs.W, plant.soilMinC)
      : null;

  const groups: DayNum[][] = [];
  const gaps: { from: DayNum; to: DayNum; tempC: number }[] = [];
  let current: DayNum[] = [];
  let pendingGap: { from: DayNum; tempC: number } | null = null;
  for (let d = spring.bedIn.start; d <= last; d += plant.succession.everyDays) {
    const fallSide = d > refs.W;
    const tenderOk = plant.frost !== 'tender' || refs.LF90 === null || d >= refs.LF90;
    const warmOk = warm === null || d >= warm;
    const heat = heatFail(ctx, method, d, fallSide);
    const h = harvestFor(ctx, refs, method, d, fallSide);
    if (tenderOk && warmOk && !heat && h.ok) {
      if (pendingGap && current.length === 0 && groups.length > 0) {
        gaps.push({ from: pendingGap.from, to: d - 1, tempC: pendingGap.tempC });
      }
      pendingGap = null;
      current.push(d);
    } else {
      if (current.length > 0) {
        groups.push(current);
        current = [];
      }
      if (heat && groups.length > 0 && pendingGap === null) pendingGap = { from: d, tempC: heat.tempC };
    }
  }
  if (current.length > 0) groups.push(current);
  if (groups.length === 0) return;

  // Each window's rounds sit inside it. The first run of rounds belongs to spring, and the spring
  // window stretches to its last round when sowing stays viable longer than the published weeks.
  // Rounds after a gap belong to the fall window, which stretches to cover them; a plant with no
  // fall block gets one built from them. A spring run that reaches the fall window is one season-long
  // window, reported once.
  const springRounds = groups[0]!;
  const laterRounds = groups.slice(1).flat();
  const reasons: Reason[] = [{ code: 'succession', everyDays: plant.succession.everyDays, count: groups.flat().length }];
  for (const g of gaps) reasons.push({ code: 'succession-gap', ...g });
  const everyDays = plant.succession.everyDays;

  const stretch = (w: ScheduleWindow, start: DayNum, end: DayNum, fallSide: boolean) => {
    const bedIn = { start: Math.min(w.bedIn.start, start), end: Math.max(w.bedIn.end, end) };
    if (bedIn.start !== w.bedIn.start) {
      const h = harvestFor(ctx, refs, method, bedIn.start, fallSide);
      if (h.ok) {
        w.harvest = h.range;
        // Keep the harvest reasons in step with the harvest they describe.
        w.reasons = w.reasons.filter((r) => r.code !== 'harvest-until' && r.code !== 'fall-heat-set');
        w.reasons.push(...harvestReasons(plant, h));
      }
    }
    w.bedIn = bedIn;
    Object.assign(w, indoorFor(plant, method, bedIn));
  };

  stretch(spring, springRounds[0]!, springRounds.at(-1)!, false);
  spring.rounds = [...springRounds];
  spring.reasons.push(...reasons);

  let fallWin = fall;
  if (laterRounds.length > 0) {
    if (fallWin) {
      stretch(fallWin, laterRounds[0]!, laterRounds.at(-1)!, true);
    } else {
      const bedIn = { start: laterRounds[0]!, end: laterRounds.at(-1)! };
      const h = harvestFor(ctx, refs, method, bedIn.start, true);
      if (!h.ok) {
        spring.rounds.push(...laterRounds);
        return;
      }
      fallWin = {
        kind: 'fall',
        method,
        bedIn,
        ...indoorFor(plant, method, bedIn),
        harvest: h.range,
        reasons: [maturityReason(plant, method, true), ...harvestReasons(plant, h)],
        warnings: commonWarnings(ctx, method, bedIn.start, h.range.start),
      };
      windows.push(fallWin);
    }
    fallWin.rounds = [...laterRounds];
  }

  // Touching (no full round interval between them): merge into one season-long spring window.
  if (fallWin && spring.bedIn.end + everyDays >= fallWin.bedIn.start) {
    spring.bedIn = { start: spring.bedIn.start, end: Math.max(spring.bedIn.end, fallWin.bedIn.end) };
    Object.assign(spring, indoorFor(plant, method, spring.bedIn));
    spring.rounds = [...new Set([...spring.rounds, ...(fallWin.rounds ?? [])])].sort((a, b) => a - b);
    spring.reasons.push({ code: 'season-long', until: spring.bedIn.end });
    for (const w of fallWin.warnings) if (!spring.warnings.some((x) => x.code === w.code)) spring.warnings.push(w);
    windows.splice(windows.indexOf(fallWin), 1);
  }
}

// ---- Section 8: overwinter ------------------------------------------------------------------------

/** Pseudo first frost: four weeks before the coolest three months begin. Pseudo last frost: six weeks after they end. */
const COOL_PLANT_LEAD_DAYS = 28;
const COOL_HARVEST_LAG_DAYS = 42;
/** Winters whose coolest month averages above this give garlic no natural chill. */
const CHILL_MEAN_C = 10;

function overwinterWindow(ctx: Ctx, out: Built): ScheduleWindow | null {
  const { plant, profile, refs, prev } = ctx;
  const ow = plant.overwinter;
  if (!ow) return null;
  const method: Method = plant.methods.plant ? 'plant' : plant.methods.direct ? 'direct' : 'transplant';
  const cool = coolRunBefore(profile, ctx.season);
  const reasons: Reason[] = [];
  const warnings: Reason[] = [];
  let plantRef: DayNum;
  let harvestRef: DayNum;
  let plantKind: 'first-frost' | 'cool-season';
  let harvestKind: 'last-frost' | 'cool-season';
  if (ctx.mode === 'temperature') {
    if (!cool) return null;
    plantRef = cool.start - COOL_PLANT_LEAD_DAYS;
    harvestRef = cool.end + COOL_HARVEST_LAG_DAYS;
    plantKind = 'cool-season';
    harvestKind = 'cool-season';
  } else {
    const ff = prev.FF50!;
    const lf = refs.LF50!;
    // In mild winters the frost dates sit deep in winter; the cool months are the better anchor.
    const coolPlant = cool ? cool.start - COOL_PLANT_LEAD_DAYS : Infinity;
    const coolHarvest = cool ? cool.end + COOL_HARVEST_LAG_DAYS : -Infinity;
    plantRef = Math.min(ff, coolPlant);
    harvestRef = Math.max(lf, coolHarvest);
    plantKind = plantRef === ff ? 'first-frost' : 'cool-season';
    harvestKind = harvestRef === lf ? 'last-frost' : 'cool-season';
  }
  const bedIn = { start: plantRef + 7 * ow.plantWeeks[0], end: plantRef + 7 * ow.plantWeeks[1] };
  const harvest = { start: harvestRef + 7 * ow.harvestWeeks[0], end: harvestRef + 7 * ow.harvestWeeks[1] };
  if (harvest.start <= bedIn.end) {
    out.notViable.push({ kind: 'overwinter', method, reason: { code: 'no-room', ref: harvest.start } });
    return null;
  }
  if (ctx.mode === 'temperature' && ctx.temps) {
    const temps = ctx.temps;
    let n = 0;
    for (let x = bedIn.start; x <= harvest.start; x++) if (inRange(plant, tMean(temps, x))) n++;
    if (n < IN_RANGE_SHARE * (harvest.start - bedIn.start + 1)) {
      out.notViable.push({ kind: 'overwinter', method, reason: rangeFailure(plant, temps, refs) });
      return null;
    }
  }
  reasons.push(
    { code: 'overwinter-plant', weeks: ow.plantWeeks, ref: plantKind === 'first-frost' ? plantRef : cool!.start, refKind: plantKind },
    { code: 'overwinter-harvest', weeks: ow.harvestWeeks, ref: harvestKind === 'last-frost' ? harvestRef : cool!.end, refKind: harvestKind },
  );
  const run = coolestRun(profile);
  if (ow.chillWeeks !== undefined && run && run.coolestMeanC > CHILL_MEAN_C) reasons.push({ code: 'pre-chill', weeks: ow.chillWeeks });
  if (plant.winterMinC !== undefined && profile.extremeMinC !== null && profile.extremeMinC < plant.winterMinC) {
    warnings.push({ code: 'winter-too-cold', zoneMinC: profile.extremeMinC, winterMinC: plant.winterMinC });
  }
  if (ctx.mode === 'temperature') warnings.push({ code: 'approximate' });
  if (ctx.mode === 'frost-only') warnings.push({ code: 'frost-only' });
  return { kind: 'overwinter', method, bedIn, harvest, reasons, warnings };
}

// ---- Section 9: perennials ------------------------------------------------------------------------

const MAX_YEARLY = 10;

function perennialMethod(plant: Plant): Method | null {
  if (plant.methods.plant) return 'plant';
  if (plant.methods.transplant) return 'transplant';
  if (plant.methods.direct) return 'direct';
  return null;
}

function inRange(plant: Plant, t: number): boolean {
  return t >= plant.temp.minC - 1 && t <= plant.temp.maxC + 1;
}

function perennialWindow(ctx: Ctx, out: Built): ScheduleWindow | null {
  const { plant, profile, temps } = ctx;
  const per = plant.perennial!;
  const method = perennialMethod(plant);
  if (!method) return null;
  const weeks = plant.methods[method]!.weeks;
  const reasons: Reason[] = [];
  const warnings: Reason[] = [];
  let bedIn: DayRange;
  const lifespan = Math.min(per.lifespanYears ?? MAX_YEARLY, MAX_YEARLY);
  const yearly: { season: number; harvest: DayRange }[] = [];
  const firstSeason = ctx.season + per.firstHarvestYear - 1;

  if (ctx.mode === 'temperature') {
    if (!temps) return null;
    // Plant at the start of the earliest run whose next eight weeks sit inside the crop's range.
    const ok = (d: DayNum) => {
      let n = 0;
      for (let x = d; x < d + 56; x++) if (inRange(plant, tMean(temps, x))) n++;
      return n >= IN_RANGE_SHARE * 56;
    };
    const run = earliestRun(ctx.refs.start, ctx.refs.end, ok);
    if (!run) {
      out.notViable.push({ kind: 'perennial', method, reason: rangeFailure(plant, temps, ctx.refs) });
      return null;
    }
    bedIn = { start: run.start, end: Math.min(run.end, run.start + 7 * Math.max(1, weeks[1] - weeks[0])) };
    // Yearly harvest: the published weeks after a pseudo last frost six weeks past the coolest months
    // (the same anchor overwintered crops use), kept when most of it sits inside the crop's range.
    for (let y = firstSeason; y < ctx.season + lifespan; y++) {
      const cool = coolRunBefore(profile, y);
      if (!cool) continue;
      const ref = cool.end + COOL_HARVEST_LAG_DAYS;
      const h = { start: ref + 7 * per.harvestWeeks[0], end: ref + 7 * per.harvestWeeks[1] };
      let n = 0;
      for (let x = h.start; x <= h.end; x++) if (inRange(plant, tMean(temps, x))) n++;
      if (n >= 0.5 * (h.end - h.start + 1)) yearly.push({ season: y, harvest: h });
    }
    reasons.push({ code: 'temp-range', minC: plant.temp.minC, maxC: plant.temp.maxC }, { code: 'perennial-harvest', firstSeason, weeks: null });
    warnings.push({ code: 'approximate' });
  } else {
    const LF50 = ctx.refs.LF50!;
    bedIn = { start: LF50 + 7 * weeks[0], end: LF50 + 7 * weeks[1] };
    reasons.push({ code: 'frost-offset', method, weeks, lastFrost: LF50 });
    if (plant.frost === 'tender' && ctx.refs.LF90 !== null && ctx.refs.LF90 > bedIn.start) {
      bedIn = { start: ctx.refs.LF90, end: Math.max(bedIn.end, ctx.refs.LF90 + MIN_WINDOW_DAYS) };
      reasons.push({ code: 'held-to-lf90', day: bedIn.start });
    }
    for (let y = firstSeason; y < ctx.season + lifespan; y++) {
      const lf = seasonRefs(profile, y).LF50!;
      yearly.push({ season: y, harvest: { start: lf + 7 * per.harvestWeeks[0], end: lf + 7 * per.harvestWeeks[1] } });
    }
    reasons.push({ code: 'perennial-harvest', firstSeason, weeks: null });
    if (plant.winterMinC !== undefined && profile.extremeMinC !== null && profile.extremeMinC < plant.winterMinC) {
      warnings.push({ code: 'winter-too-cold', zoneMinC: profile.extremeMinC, winterMinC: plant.winterMinC });
    }
    if (ctx.mode === 'frost-only') warnings.push({ code: 'frost-only' });
  }
  const first = yearly[0];
  if (!first) {
    out.notViable.push({ kind: 'perennial', method, reason: temps ? rangeFailure(plant, temps, ctx.refs) : { code: 'too-cool', tempC: plant.temp.minC } });
    return null;
  }
  return { kind: 'perennial', method, bedIn, harvest: first.harvest, yearly, reasons, warnings };
}

// ---- Section 10: temperature mode -----------------------------------------------------------------

/** The frost-risk spans [FF10, next LF90] around a season, for tender crops in temperature mode. */
function frostSpans(ctx: Ctx): DayRange[] {
  const { profile } = ctx;
  const spans: DayRange[] = [];
  for (const r of [ctx.prev, ctx.refs, ctx.next]) {
    if (r.FF10 === null || profile.lastFrost.p90 === null) continue;
    const later = seasonRefs(profile, r.season + 1).LF90;
    if (later !== null && later >= r.FF10) spans.push({ start: r.FF10, end: later });
  }
  return spans;
}

function rangeFailure(plant: Plant, temps: DailyTemps, refs: SeasonRefs): Reason {
  let hot = 0;
  let cold = 0;
  for (let d = refs.start; d <= refs.end; d++) {
    const t = tMean(temps, d);
    if (t > plant.temp.maxC + 1) hot++;
    else if (t < plant.temp.minC - 1) cold++;
  }
  return hot >= cold ? { code: 'too-hot', tempC: plant.temp.maxC } : { code: 'too-cool', tempC: plant.temp.minC };
}

function temperatureWindows(ctx: Ctx, method: Method, out: Built): ScheduleWindow[] {
  const { plant, refs, temps } = ctx;
  if (!temps) return [];
  const days = daysToHarvest(plant, method);
  const spans = plant.frost === 'tender' ? frostSpans(ctx) : [];
  const fs = plant.fruitSetMaxC;
  const viable = (d: DayNum): boolean => {
    const M = d + days;
    let n = 0;
    for (let x = d; x <= M; x++) if (inRange(plant, tMean(temps, x))) n++;
    if (n < IN_RANGE_SHARE * (M - d + 1)) return false;
    if (fs !== undefined && tMax(temps, d + Math.round(FLOWERING_SHARE * days)) > fs) return false;
    if (spans.some((s) => d <= s.end && M >= s.start)) return false;
    return harvestFor(ctx, refs, method, d, false).ok;
  };
  const runs: DayRange[] = [];
  let s: DayNum | null = null;
  for (let d = refs.start; d <= refs.end; d++) {
    if (viable(d)) {
      if (s === null) s = d;
    } else if (s !== null) {
      runs.push({ start: s, end: d - 1 });
      s = null;
    }
  }
  if (s !== null) runs.push({ start: s, end: refs.end });
  const kept = runs.filter((r) => r.end - r.start + 1 >= MIN_HARVEST_DAYS);
  if (kept.length === 0) {
    out.notViable.push({ kind: 'temperature', method, reason: rangeFailure(plant, temps, refs) });
    return [];
  }
  return kept.map((bedIn) => {
    const h = harvestFor(ctx, refs, method, bedIn.start, false) as HarvestOk;
    const ind = indoorFor(plant, method, bedIn);
    const reasons: Reason[] = [{ code: 'temp-range', minC: plant.temp.minC, maxC: plant.temp.maxC }];
    for (const sp of spans) {
      const touches = (sp.end >= bedIn.start - 30 && sp.end < bedIn.start) || (sp.start > bedIn.end && sp.start <= bedIn.end + days + 30);
      if (touches) reasons.push({ code: 'frost-span-avoided', from: sp.start, to: sp.end });
    }
    if (ind.indoor) reasons.push({ code: 'indoor-start', weeks: plant.methods.indoor!.ageWeeks }, { code: 'harden-off' });
    reasons.push(maturityReason(plant, method, false), ...harvestReasons(plant, h));
    const warnings: Reason[] = [{ code: 'approximate' }];
    // Leafy crops sown into hot days: shade them (section 10 note in the spec's changes).
    if (fs === undefined) {
      const hotLimit = plant.temp.maxC + 2;
      const hotRun = earliestRun(bedIn.start, bedIn.end, (d) => {
        let sum = 0;
        for (let x = d; x <= d + days; x++) sum += tMax(temps, x);
        return sum / (days + 1) > hotLimit;
      });
      if (hotRun) warnings.push({ code: 'hot-weather-shade', from: hotRun.start, to: hotRun.end, tempC: hotLimit });
    }
    return { kind: 'temperature' as const, method, bedIn, ...ind, harvest: h.range, reasons, warnings };
  });
}

// ---- Entry point ----------------------------------------------------------------------------------

const memo = new WeakMap<Plant, WeakMap<ClimateProfile, Map<number, PlantSchedule>>>();

/**
 * Planting windows for one plant in one season. Results are memoised per plant, profile and season.
 * Never throws: a plant record the maths cannot handle (a custom plant with odd values, say) gives
 * no windows and one `schedule-error` reason, so one bad record cannot take down the whole planner.
 */
export function plantSchedule(plant: Plant, profile: ClimateProfile, season: number): PlantSchedule {
  let byPlant = memo.get(plant);
  if (!byPlant) memo.set(plant, (byPlant = new WeakMap()));
  let byProfile = byPlant.get(profile);
  if (!byProfile) byPlant.set(profile, (byProfile = new Map()));
  const hit = byProfile.get(season);
  if (hit) return hit;
  let result: PlantSchedule;
  try {
    result = compute(plant, profile, season);
  } catch {
    let mode: ScheduleMode = 'none';
    try {
      mode = scheduleMode(profile);
    } catch {
      // A profile that cannot even be read keeps 'none'.
    }
    result = { plantId: String(plant?.id), season, mode, approximate: false, windows: [], notViable: [{ kind: 'spring', reason: { code: 'schedule-error' } }] };
  }
  byProfile.set(season, result);
  return result;
}

function compute(plant: Plant, profile: ClimateProfile, season: number): PlantSchedule {
  const ctx = ctxFor(plant, profile, season);
  const built: Built = { windows: [], notViable: [] };
  const base = { plantId: plant.id, season, mode: ctx.mode };
  if (ctx.mode === 'none') {
    return { ...base, approximate: false, windows: [], notViable: [{ kind: 'spring', reason: { code: 'needs-town' } }] };
  }

  if (plant.perennial) {
    const w = perennialWindow(ctx, built);
    if (w) built.windows.push(w);
  } else if (ctx.mode === 'temperature') {
    if (plant.overwinter) {
      const w = overwinterWindow(ctx, built);
      if (w) built.windows.push(w);
    } else {
      for (const m of outdoorMethods(plant)) built.windows.push(...temperatureWindows(ctx, m, built));
    }
  } else {
    const springs: ScheduleWindow[] = [];
    for (const m of outdoorMethods(plant)) {
      const w = springWindow(ctx, m, built);
      if (w) springs.push(w);
    }
    built.windows.push(...springs);
    for (const m of outdoorMethods(plant)) {
      const w = fallWindow(ctx, m, springs.find((s) => s.method === m), built);
      if (w) built.windows.push(w);
    }
    addSuccession(ctx, built.windows);
    if (plant.overwinter) {
      const w = overwinterWindow(ctx, built);
      if (w) built.windows.push(w);
    }
  }
  return { ...base, approximate: ctx.mode === 'temperature', windows: built.windows, notViable: built.notViable };
}

/**
 * The harvest of a planting bedded in on a given day within a known season and window (auto
 * anchors with an offset, or an actual bed-in day). `fall` adds the fall factor.
 */
export function harvestInSeason(
  plant: Plant,
  profile: ClimateProfile,
  season: number,
  method: Method,
  bedIn: DayNum,
  fall: boolean,
): { harvest: DayRange | null; reason?: Reason; until?: Reason } {
  const ctx = ctxFor(plant, profile, season);
  if (ctx.mode === 'none') return { harvest: null, reason: { code: 'needs-town' } };
  const h = harvestFor(ctx, ctx.refs, method, bedIn, fall && ctx.mode !== 'temperature');
  return h.ok ? { harvest: h.range, until: untilReason(h) } : { harvest: null, reason: h.reason };
}

/** The `harvest-until` reason of a harvest: its last day and what ends it. */
function untilReason(h: HarvestOk): Reason {
  return { code: 'harvest-until', day: h.range.end, cap: h.cap.kind, estimated: h.cap.estimated };
}

/**
 * The harvest of a planting bedded in on a day the gardener chose (pinned), when the season is not
 * known: the first of the day's own season, the next and the previous that gives a viable harvest.
 * A bed-in after that season's midsummer gets the fall factor.
 */
export function harvestFrom(
  plant: Plant,
  profile: ClimateProfile,
  method: Method,
  bedIn: DayNum,
  ownSeason: number,
): { season: number; harvest: DayRange | null; reason?: Reason; until?: Reason } {
  let firstReason: Reason | undefined;
  for (const s of [ownSeason, ownSeason + 1, ownSeason - 1]) {
    const ctx = ctxFor(plant, profile, s);
    if (ctx.mode === 'none') return { season: ownSeason, harvest: null, reason: { code: 'needs-town' } };
    const fall = ctx.mode !== 'temperature' && bedIn > ctx.refs.W;
    const h = harvestFor(ctx, ctx.refs, method, bedIn, fall);
    if (h.ok) return { season: s, harvest: h.range, until: untilReason(h) };
    firstReason ??= h.reason;
  }
  return { season: ownSeason, harvest: null, ...(firstReason ? { reason: firstReason } : {}) };
}
