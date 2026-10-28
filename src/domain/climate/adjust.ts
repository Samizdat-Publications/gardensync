// The gardener's own frost dates: shift the computed ones by whole days (a frost pocket, a sheltered
// yard), and shift them back. Both quantiles of each date move together, so the risk spread stays.
import { circularDoy, monthDayFromCircular, type MonthDay } from '../dates';
import type { ClimateProfile } from './types';

const shift = (md: MonthDay | null, days: number): MonthDay | null => (md === null ? null : monthDayFromCircular(circularDoy(md) + days));

/** Moves the last spring frost (which: 'lastFrost') or first fall frost ('firstFrost') by `days`. */
export function adjustFrost(profile: ClimateProfile, which: 'lastFrost' | 'firstFrost', days: number): ClimateProfile {
  const prior = profile.adjustedDays ?? { lastFrost: 0, firstFrost: 0 };
  const total = prior[which] + days;
  if (Math.abs(total) > 60) return profile;
  const adjustedDays = { ...prior, [which]: total };
  const next: ClimateProfile =
    which === 'lastFrost'
      ? { ...profile, lastFrost: { p50: shift(profile.lastFrost.p50, days), p90: shift(profile.lastFrost.p90, days) } }
      : {
          ...profile,
          firstFrost: { p50: shift(profile.firstFrost.p50, days), p10: shift(profile.firstFrost.p10, days) },
          firstHardFrost: { minus2: shift(profile.firstHardFrost.minus2, days), minus5: shift(profile.firstHardFrost.minus5, days) },
        };
  if (adjustedDays.lastFrost === 0 && adjustedDays.firstFrost === 0) {
    const { adjustedDays: _drop, ...rest } = next;
    return rest;
  }
  return { ...next, adjustedDays };
}

/** Undoes every adjustment, back to the dates as computed or typed. */
export function resetFrost(profile: ClimateProfile): ClimateProfile {
  const a = profile.adjustedDays;
  if (!a) return profile;
  return adjustFrost(adjustFrost(profile, 'lastFrost', -a.lastFrost), 'firstFrost', -a.firstFrost);
}
