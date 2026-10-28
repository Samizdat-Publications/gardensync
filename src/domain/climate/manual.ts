// A climate profile from frost dates the gardener typed in.
//
// With only two dates there is no spread to measure, so the risk dates use fixed margins:
// LF90 = LF50 + 14 days and FF10 = FF50 - 10 days. Hard-frost dates are unknown (null), and the
// zone is null unless a mean extreme minimum is supplied. When monthly normals come along (a town
// was chosen and its temperatures downloaded, but the frost dates were overridden) they are kept,
// and they decide the warmest month.
import { circularDoy, monthDayFromCircular, parseMonthDay, type IsoDate, type MonthDay } from '../dates';
import type { ClimatePlace } from './compute';
import type { ClimateProfile } from './types';
import { zoneFromExtremeMinC } from './zone';

export const MANUAL_LF90_MARGIN_DAYS = 14;
export const MANUAL_FF10_MARGIN_DAYS = 10;

export interface ManualClimateInput {
  /** Typical (median) last spring frost, MM-DD. */
  lastFrost: MonthDay;
  /** Typical (median) first fall frost, MM-DD. */
  firstFrost: MonthDay;
  hemisphere?: 'north' | 'south';
  place?: ClimatePlace;
  monthly?: { meanC: number[]; minC: number[]; maxC: number[] };
  /** Mean annual extreme minimum, C, if known: gives the zone. */
  extremeMinC?: number | null;
  asOf: IsoDate;
}

const round2 = (x: number) => Math.round(x * 100) / 100;
const mod365 = (x: number) => ((x % 365) + 365) % 365;

function shift(md: MonthDay, days: number): MonthDay {
  return monthDayFromCircular(circularDoy(md) + days);
}

/** Month (1-12) of the middle of the frost-free run from last frost forward to first frost. */
function midSeasonMonth(lastFrost: MonthDay, firstFrost: MonthDay): number {
  const lf = circularDoy(lastFrost);
  const gap = mod365(circularDoy(firstFrost) - lf);
  return parseMonthDay(monthDayFromCircular(lf + Math.floor(gap / 2))).month;
}

export function manualProfile(input: ManualClimateInput): ClimateProfile {
  const { lastFrost, firstFrost, place, monthly, asOf } = input;
  parseMonthDay(lastFrost);
  parseMonthDay(firstFrost);
  if (monthly && [monthly.meanC, monthly.minC, monthly.maxC].some((a) => a.length !== 12)) {
    throw new RangeError('monthly normals need 12 values each');
  }

  let warmestMonth: number;
  if (monthly) {
    warmestMonth = 1;
    monthly.meanC.forEach((t, i) => {
      if (t > monthly.meanC[warmestMonth - 1]!) warmestMonth = i + 1;
    });
  } else {
    warmestMonth = midSeasonMonth(lastFrost, firstFrost);
  }

  const hemisphere: 'north' | 'south' =
    input.hemisphere ??
    (place ? (place.lat < 0 ? 'south' : 'north') : warmestMonth === 12 || warmestMonth <= 2 ? 'south' : 'north');

  const extremeMinC = input.extremeMinC ?? null;

  return {
    source: 'manual',
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
    hemisphere,
    warmestMonth,
    frostClass: 'frost',
    frostYearsShare: 1,
    lastFrost: { p50: lastFrost, p90: shift(lastFrost, MANUAL_LF90_MARGIN_DAYS) },
    firstFrost: { p50: firstFrost, p10: shift(firstFrost, -MANUAL_FF10_MARGIN_DAYS) },
    firstHardFrost: { minus2: null, minus5: null },
    extremeMinC,
    zone: zoneFromExtremeMinC(extremeMinC),
    ...(monthly ? { monthly: { meanC: [...monthly.meanC], minC: [...monthly.minC], maxC: [...monthly.maxC] } } : {}),
    asOf,
  };
}
