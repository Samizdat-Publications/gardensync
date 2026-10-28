// Growing seasons and the frost reference days of each one (SCHEDULE_SPEC.md section 1).
//
// A season S is one growing year, hung on its midsummer W(S): the middle day of the warmest month,
// in calendar year S in the north and S + 1 in the south. Last spring frost dates are the latest
// occurrence of their month-day on or before W(S); first fall frost dates are the first occurrence
// after it. Everything is integer day arithmetic, so the answer is the same in every time zone.
import {
  dayFromParts,
  dayInYear,
  daysInMonth,
  monthDayFromCircular,
  nextMonthDayAfter,
  partsFromDay,
  yearOf,
  type DayNum,
  type MonthDay,
} from '../dates';
import { monthMidDoy, tempOn } from '../climate/tempCurve';
import type { ClimateProfile } from '../climate/types';

/** Half a year either side of midsummer: a season spans [W - 182, W + 182]. */
export const HALF_SEASON = 182;

export interface SeasonRefs {
  season: number;
  /** Midsummer W(S). */
  W: DayNum;
  /** W - 182 and W + 182. */
  start: DayNum;
  end: DayNum;
  /** Median last spring frost, and the 90%-safe last frost. */
  LF50: DayNum | null;
  LF90: DayNum | null;
  /** Median first fall frost, and the 10%-risk first frost. */
  FF50: DayNum | null;
  FF10: DayNum | null;
  /** Median first fall -2 C and -5 C. */
  H2: DayNum | null;
  H5: DayNum | null;
}

/** The middle day of the warmest month, as a month-day (Jul 16 for July). */
export function midsummerMonthDay(profile: ClimateProfile): MonthDay {
  return monthDayFromCircular(monthMidDoy(profile.warmestMonth));
}

/** W(S): midsummer of season S. */
export function midsummer(profile: ClimateProfile, season: number): DayNum {
  const year = profile.hemisphere === 'south' ? season + 1 : season;
  return dayInYear(year, midsummerMonthDay(profile));
}

/** The latest occurrence of a month-day on or before day d. */
export function onOrBefore(d: DayNum, md: MonthDay): DayNum {
  const y = yearOf(d);
  const same = dayInYear(y, md);
  return same <= d ? same : dayInYear(y - 1, md);
}

const cache = new WeakMap<ClimateProfile, Map<number, SeasonRefs>>();

export function seasonRefs(profile: ClimateProfile, season: number): SeasonRefs {
  let byProfile = cache.get(profile);
  if (!byProfile) {
    byProfile = new Map();
    cache.set(profile, byProfile);
  }
  const hit = byProfile.get(season);
  if (hit) return hit;
  const W = midsummer(profile, season);
  const before = (md: MonthDay | null) => (md === null ? null : onOrBefore(W, md));
  const after = (md: MonthDay | null) => (md === null ? null : nextMonthDayAfter(W, md));
  const refs: SeasonRefs = {
    season,
    W,
    start: W - HALF_SEASON,
    end: W + HALF_SEASON,
    LF50: before(profile.lastFrost.p50),
    LF90: before(profile.lastFrost.p90),
    FF50: after(profile.firstFrost.p50),
    FF10: after(profile.firstFrost.p10),
    H2: after(profile.firstHardFrost.minus2),
    H5: after(profile.firstHardFrost.minus5),
  };
  byProfile.set(season, refs);
  return refs;
}

/**
 * The season whose [W - 182, W + 182] holds the day. Consecutive midsummers are 365 or 366 days
 * apart, so a day can sit 183 days from both; it then goes to the later season.
 */
export function seasonOf(profile: ClimateProfile, day: DayNum): number {
  const guess = yearOf(day) - (profile.hemisphere === 'south' ? 1 : 0);
  let best = guess;
  let bestDist = Infinity;
  for (const s of [guess - 1, guess, guess + 1]) {
    const dist = Math.abs(day - midsummer(profile, s));
    if (dist <= bestDist) {
      best = s;
      bestDist = dist;
    }
  }
  return best;
}

/** "2027" in the north, "2027-28" in the south, whose summer straddles the new year. */
export function seasonLabel(profile: ClimateProfile, season: number): string {
  return profile.hemisphere === 'south' ? `${season}-${String((season + 1) % 100).padStart(2, '0')}` : String(season);
}

// ---- Temperatures by day number ------------------------------------------------------------------

export interface DailyTemps {
  mean: Float64Array;
  min: Float64Array;
  max: Float64Array;
}

const tempCache = new WeakMap<ClimateProfile, DailyTemps | null>();

/** The 365-day temperature curve of a profile (index = circular day, 0 = Jan 1), or null. */
export function dailyTemps(profile: ClimateProfile): DailyTemps | null {
  if (tempCache.has(profile)) return tempCache.get(profile)!;
  let out: DailyTemps | null = null;
  if (profile.monthly) {
    out = { mean: new Float64Array(365), min: new Float64Array(365), max: new Float64Array(365) };
    for (let i = 0; i < 365; i++) {
      const md = monthDayFromCircular(i);
      out.mean[i] = tempOn(profile, md, 'mean')!;
      out.min[i] = tempOn(profile, md, 'min')!;
      out.max[i] = tempOn(profile, md, 'max')!;
    }
  }
  tempCache.set(profile, out);
  return out;
}

/** Days before the first of each month in a common year. */
const DAYS_BEFORE_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334] as const;

function circularUncached(d: DayNum): number {
  const { month, day } = partsFromDay(d);
  return month === 2 && day === 29 ? 58 : DAYS_BEFORE_MONTH[month - 1]! + day - 1;
}

/** Circular days for 1900-01-01 to 2200-12-31 (the seasons an anchor may name), built on first use. */
const TABLE_FROM = dayFromParts(1900, 1, 1);
const TABLE_TO = dayFromParts(2200, 12, 31);
let table: Int16Array | null = null;

/**
 * Circular day (0 = Jan 1, Feb 29 folded into Feb 28) of a day number. The schedule's temperature
 * loops call this millions of times, so days in the table's range are a lookup.
 */
export function circularDayOf(d: DayNum): number {
  if (d < TABLE_FROM || d > TABLE_TO) return circularUncached(d);
  if (!table) {
    table = new Int16Array(TABLE_TO - TABLE_FROM + 1);
    for (let x = TABLE_FROM; x <= TABLE_TO; x++) table[x - TABLE_FROM] = circularUncached(x);
  }
  return table[d - TABLE_FROM]!;
}

// ---- The coolest three months --------------------------------------------------------------------

export interface CoolRun {
  /** First month of the coolest run of three consecutive months, 1-12. */
  startMonth: number;
  /** Mean temperature of the coolest single month, C. */
  coolestMeanC: number;
}

/** The coolest three consecutive months by mean temperature (ties go to the earlier start). */
export function coolestRun(profile: ClimateProfile): CoolRun | null {
  const m = profile.monthly?.meanC;
  if (!m) return null;
  let best = 0;
  let bestSum = Infinity;
  for (let i = 0; i < 12; i++) {
    const sum = m[i]! + m[(i + 1) % 12]! + m[(i + 2) % 12]!;
    if (sum < bestSum - 1e-9) {
      best = i;
      bestSum = sum;
    }
  }
  return { startMonth: best + 1, coolestMeanC: Math.min(...m) };
}

/** The coolest run that ends on or before W(S): its first day and the day after its last month. */
export function coolRunBefore(profile: ClimateProfile, season: number): { start: DayNum; end: DayNum } | null {
  const run = coolestRun(profile);
  if (!run) return null;
  const W = midsummer(profile, season);
  const md = `${String(run.startMonth).padStart(2, '0')}-01`;
  const run1 = coolRunFrom(onOrBefore(W, md));
  // A run still going at midsummer belongs to the year before.
  return run1.end <= W ? run1 : coolRunFrom(onOrBefore(run1.start - 1, md));
}

function coolRunFrom(start: DayNum): { start: DayNum; end: DayNum } {
  let { year: y, month: mo } = partsFromDay(start);
  let end = start;
  for (let k = 0; k < 3; k++) {
    end += daysInMonth(y, mo);
    if (++mo > 12) {
      mo = 1;
      y++;
    }
  }
  return { start, end };
}
