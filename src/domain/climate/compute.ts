// Build a ClimateProfile from a run of daily minimum and maximum temperatures.
//
// The method has no hemisphere branch. Everything hangs off the warmest month:
//
// 1. Monthly normals: per calendar month, the mean of daily (Tmin + Tmax) / 2, of Tmin and of Tmax.
//    The warmest month is the one with the highest mean.
// 2. Put the middle day of the warmest month, W, on the 365-day circle (circularDoy). A frost season
//    runs from one W day to the day before the next, so it is 365 (or 366) days long and holds one
//    whole winter: Jul 16 to Jul 15 in Ohio, Jan 16 to Jan 15 in Melbourne.
// 3. For each complete season: the first fall frost is the FIRST day of the season with Tmin <= 0 C
//    and the last spring frost is the LAST such day of the same season, so a season with a single
//    frost night has first = last. Likewise the first day <= -2 C and <= -5 C, and the season's
//    lowest Tmin. Seasons cut off by the ends of the data, or with more than a tenth of their Tmin
//    values missing, are skipped.
// 4. Dates are measured as days into the season from W, so they sort chronologically even when the
//    winter crosses the new year. A season with no frost counts as minus infinity (infinitely early)
//    for the last frost and plus infinity (infinitely late) for the first frost.
// 5. Quantiles by nearest rank, index Math.round(q * (n - 1)); the median of an even count is the
//    rounded mean of the two middle values. A quantile that lands on an infinity is null.
//
// An earlier version split each season at the coldest point (W + 182) and looked for fall frosts
// only before it and spring frosts only after it. That broke mild climates whose few frosts straddle
// the coldest point (Phoenix had no median last frost despite frost in 86% of winters).
import {
  circularDoy,
  dayInYear,
  daysInMonth,
  monthDayFromCircular,
  monthDayOf,
  parseMonthDay,
  partsFromDay,
  toDay,
  yearOf,
  type DayNum,
  type IsoDate,
  type MonthDay,
} from '../dates';
import { monthMidDoy } from './tempCurve';
import type { ClimateProfile } from './types';
import { zoneFromExtremeMinC } from './zone';

export type Temp = number | null;

export interface ClimatePlace {
  name: string;
  region?: string;
  country?: string;
  lat: number;
  lon: number;
  elevationM?: number;
}

export interface ClimateInput {
  /** The date of tmin[0] and tmax[0]. */
  start: IsoDate;
  /** Daily minimum temperature, C, one per day from start. null for a missing day. */
  tmin: readonly Temp[];
  /** Daily maximum temperature, C, aligned with tmin. */
  tmax: readonly Temp[];
  place?: ClimatePlace;
  /** Years the data covers, inclusive. Defaults to the calendar years of the first and last day. */
  years?: [number, number];
  /** ISO date the profile is being computed. */
  asOf: IsoDate;
}

/** Statistics for one cold season, exposed for tests and for the research notes. */
export interface SeasonStats {
  /** First day of the season (the mid-warmest-month day). */
  start: DayNum;
  /** First day of the season with Tmin <= 0 C, or null when there was none. Likewise for -2 and -5 C. */
  firstFrost: DayNum | null;
  firstMinus2: DayNum | null;
  firstMinus5: DayNum | null;
  /** Last day of the season with Tmin <= 0 C, or null when there was none. */
  lastFrost: DayNum | null;
  /** Lowest Tmin of the season, C. */
  minC: number;
  /** Whether any day of the season had Tmin <= 0 C. */
  anyFrost: boolean;
}

export interface ClimateAnalysis {
  profile: ClimateProfile;
  seasons: SeasonStats[];
}

const FROST_C = 0;
const MAX_MISSING_SHARE = 0.1;

const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;
const mod365 = (x: number) => ((x % 365) + 365) % 365;

/** Nearest-rank quantile of an ascending list, per the module header. */
export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) throw new RangeError('quantile of an empty list');
  return sorted[Math.round(q * (sorted.length - 1))]!;
}

/** Median of an ascending list; for an even count, the rounded mean of the two middle values. */
export function median(sorted: readonly number[]): number {
  const n = sorted.length;
  if (n === 0) throw new RangeError('median of an empty list');
  if (n % 2 === 1) return sorted[(n - 1) / 2]!;
  const a = sorted[n / 2 - 1]!;
  const b = sorted[n / 2]!;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return a === b ? a : !Number.isFinite(a) ? a : b;
  return Math.round((a + b) / 2);
}

function monthlyNormals(startDay: DayNum, tmin: readonly Temp[], tmax: readonly Temp[]) {
  const sum = { mean: new Array<number>(12).fill(0), min: new Array<number>(12).fill(0), max: new Array<number>(12).fill(0) };
  const cnt = { mean: new Array<number>(12).fill(0), min: new Array<number>(12).fill(0), max: new Array<number>(12).fill(0) };
  // Walk the calendar by incrementing day and month counters, avoiding a Date per sample.
  let { year, month, day } = partsFromDay(startDay);
  for (let i = 0; i < tmin.length; i++) {
    const m = month - 1;
    const lo = tmin[i];
    const hi = tmax[i];
    if (typeof lo === 'number') {
      sum.min[m]! += lo;
      cnt.min[m]!++;
    }
    if (typeof hi === 'number') {
      sum.max[m]! += hi;
      cnt.max[m]!++;
    }
    if (typeof lo === 'number' && typeof hi === 'number') {
      sum.mean[m]! += (lo + hi) / 2;
      cnt.mean[m]!++;
    }
    if (++day > daysInMonth(year, month)) {
      day = 1;
      if (++month > 12) {
        month = 1;
        year++;
      }
    }
  }
  const avg = (k: 'mean' | 'min' | 'max') =>
    sum[k].map((s, m) => {
      const c = cnt[k][m]!;
      if (c === 0) throw new RangeError(`No temperature data for month ${m + 1}`);
      return round1(s / c);
    });
  return { meanC: avg('mean'), minC: avg('min'), maxC: avg('max') };
}

function warmestOf(meanC: readonly number[]): number {
  let best = 0;
  for (let m = 1; m < 12; m++) if (meanC[m]! > meanC[best]!) best = m;
  return best + 1;
}

/** The complete frost seasons in the data, each W day to the day before the next. */
function seasonStats(startDay: DayNum, tmin: readonly Temp[], wMd: MonthDay): SeasonStats[] {
  const endDay = startDay + tmin.length - 1;
  const at = (d: DayNum): Temp => tmin[d - startDay] ?? null;
  const out: SeasonStats[] = [];
  for (let y = yearOf(startDay); y <= yearOf(endDay); y++) {
    const s = dayInYear(y, wMd);
    const next = dayInYear(y + 1, wMd);
    const last = next - 1;
    if (s < startDay || last > endDay) continue;

    let missing = 0;
    let minC = Infinity;
    let firstFrost: DayNum | null = null;
    let firstMinus2: DayNum | null = null;
    let firstMinus5: DayNum | null = null;
    let lastFrost: DayNum | null = null;
    let anyFrost = false;
    for (let d = s; d <= last; d++) {
      const t = at(d);
      if (t === null) {
        missing++;
        continue;
      }
      if (t < minC) minC = t;
      if (t <= FROST_C) {
        anyFrost = true;
        if (firstFrost === null) firstFrost = d;
        lastFrost = d;
      }
      if (t <= -2 && firstMinus2 === null) firstMinus2 = d;
      if (t <= -5 && firstMinus5 === null) firstMinus5 = d;
    }
    if (missing > MAX_MISSING_SHARE * (last - s + 1) || !Number.isFinite(minC)) continue;
    out.push({ start: s, firstFrost, firstMinus2, firstMinus5, lastFrost, minC, anyFrost });
  }
  return out;
}

/** Days into a season that starts at circular day `origin`, from an actual day. Feb 29 folds into Feb 28. */
function offsetFrom(origin: number, d: DayNum): number {
  return mod365(circularDoy(monthDayOf(d)) - origin);
}

function toMd(origin: number, offset: number): MonthDay | null {
  return Number.isFinite(offset) ? monthDayFromCircular(origin + offset) : null;
}

/** Full analysis: the profile plus the per-season statistics it was built from. */
export function analyzeClimate(input: ClimateInput): ClimateAnalysis {
  const { start, tmin, tmax, place, asOf } = input;
  if (tmin.length !== tmax.length) throw new RangeError('tmin and tmax must be the same length');
  if (tmin.length === 0) throw new RangeError('no temperature data');
  const startDay = toDay(start);
  const endDay = startDay + tmin.length - 1;

  const monthly = monthlyNormals(startDay, tmin, tmax);
  const warmestMonth = warmestOf(monthly.meanC);
  const W = monthMidDoy(warmestMonth);
  const wMd = monthDayFromCircular(W);

  const seasons = seasonStats(startDay, tmin, wMd);
  if (seasons.length === 0) throw new RangeError('need at least one complete frost season (a full year) of data');

  const asc = (a: number, b: number) => a - b;
  const spring = seasons.map((s) => (s.lastFrost === null ? -Infinity : offsetFrom(W, s.lastFrost))).sort(asc);
  const fallOf = (pick: (s: SeasonStats) => DayNum | null) =>
    seasons.map((s) => {
      const d = pick(s);
      return d === null ? Infinity : offsetFrom(W, d);
    }).sort(asc);
  const fall0 = fallOf((s) => s.firstFrost);
  const fall2 = fallOf((s) => s.firstMinus2);
  const fall5 = fallOf((s) => s.firstMinus5);

  const frostYearsShare = seasons.filter((s) => s.anyFrost).length / seasons.length;
  const frostClass = frostYearsShare >= 0.5 ? 'frost' : frostYearsShare >= 0.1 ? 'marginal' : 'none';
  const extremeMinC = round1(seasons.reduce((a, s) => a + s.minC, 0) / seasons.length);

  const hemisphere: 'north' | 'south' = place
    ? place.lat < 0
      ? 'south'
      : 'north'
    : warmestMonth === 12 || warmestMonth <= 2
      ? 'south'
      : 'north';

  const profile: ClimateProfile = {
    source: 'computed',
    ...(place
      ? {
          place: {
            name: place.name,
            ...(place.region !== undefined ? { region: place.region } : {}),
            ...(place.country !== undefined ? { country: place.country } : {}),
            lat: round2(place.lat),
            lon: round2(place.lon),
            ...(place.elevationM !== undefined ? { elevationM: Math.round(place.elevationM) } : {}),
          },
        }
      : {}),
    years: input.years ?? [yearOf(startDay), yearOf(endDay)],
    hemisphere,
    warmestMonth,
    frostClass,
    frostYearsShare: Math.round(frostYearsShare * 1000) / 1000,
    lastFrost: { p50: toMd(W, median(spring)), p90: toMd(W, quantile(spring, 0.9)) },
    firstFrost: { p50: toMd(W, median(fall0)), p10: toMd(W, quantile(fall0, 0.1)) },
    firstHardFrost: { minus2: toMd(W, median(fall2)), minus5: toMd(W, median(fall5)) },
    extremeMinC,
    zone: zoneFromExtremeMinC(extremeMinC),
    monthly,
    asOf,
  };
  return { profile, seasons };
}

export function computeClimateProfile(input: ClimateInput): ClimateProfile {
  return analyzeClimate(input).profile;
}

/**
 * Days from a to b going forward within a season that starts at `origin` (the mid-warmest-month
 * day): positive when b is later. Useful for comparing two month-days, e.g. LF50 and LF90.
 */
export function daysWithinSeason(origin: MonthDay, a: MonthDay, b: MonthDay): number {
  parseMonthDay(origin);
  const o = circularDoy(origin);
  return mod365(circularDoy(b) - o) - mod365(circularDoy(a) - o);
}
