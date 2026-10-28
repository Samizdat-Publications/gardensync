// A smooth year of temperatures from the twelve monthly normals.
//
// Each monthly value is pinned to the middle day of its month on the 365-day circle (see
// circularDoy), and days in between are linearly interpolated between the two nearest mid-month
// points. The circle closes, so mid-December runs straight on into mid-January.
import { circularDoy, daysInMonth, type MonthDay } from '../dates';
import type { ClimateProfile } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Circular day (0 = Jan 1) of the middle of a month, 1-12, in a common year. July gives Jul 16. */
export function monthMidDoy(month: number): number {
  return circularDoy(`${pad(month)}-01`) + Math.floor(daysInMonth(2023, month) / 2);
}

const MIDS: readonly number[] = Array.from({ length: 12 }, (_, i) => monthMidDoy(i + 1));

/** Cyclic linear interpolation of twelve mid-month values at a circular day 0-364. */
export function interpolateMonthly(values: readonly number[], doy: number): number {
  if (values.length !== 12) throw new RangeError('expected 12 monthly values');
  const x = ((doy % 365) + 365) % 365;
  for (let i = 0; i < 12; i++) {
    const a = MIDS[i]!;
    const j = (i + 1) % 12;
    // The last span runs from mid-December across the new year to mid-January.
    const b = j === 0 ? MIDS[0]! + 365 : MIDS[j]!;
    const xx = j === 0 && x < a ? x + 365 : x;
    if (xx >= a && xx <= b) {
      const t = (xx - a) / (b - a);
      return values[i]! + t * (values[j]! - values[i]!);
    }
  }
  // Only reachable for the stretch before mid-January, which the December span covers above.
  throw new RangeError(`unreachable day ${doy}`);
}

/** Expected temperature (C) on a month-day, or null when the profile has no monthly normals. */
export function tempOn(profile: ClimateProfile, md: MonthDay, which: 'mean' | 'min' | 'max'): number | null {
  const m = profile.monthly;
  if (!m) return null;
  const values = which === 'mean' ? m.meanC : which === 'min' ? m.minC : m.maxC;
  return interpolateMonthly(values, circularDoy(md));
}
