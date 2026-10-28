// The climate profile: everything the schedule needs to know about a place, computed once from
// 30 years of daily temperatures (Open-Meteo historical archive) and cached in the garden document.
//
// Frost dates are month-days. "p50" is the median year. For spring, "p90" is the 90%-safe date: in
// 9 years out of 10 the last frost has already happened. For fall, "p10" is the 10%-risk date: in
// 1 year out of 10 the first frost has already come. A value is null when frost at that probability
// does not happen at this place (for example LF50 in a frost-free climate).
import * as v from 'valibot';
import { isMonthDay } from '../dates';

const MonthDaySchema = v.pipe(v.string(), v.check(isMonthDay, 'expected MM-DD'));
const NullableMd = v.nullable(MonthDaySchema);
const Twelve = v.pipe(v.array(v.number()), v.length(12));
/** Place names come from the geocoder or a share link; 120 characters is far beyond any real one. */
export const MAX_PLACE_TEXT = 120;
const PlaceText = v.pipe(v.string(), v.maxLength(MAX_PLACE_TEXT));

export const ClimateProfileSchema = v.object({
  /** computed from the archive, or typed in by hand. */
  source: v.picklist(['computed', 'manual']),
  place: v.optional(
    v.object({
      name: PlaceText,
      region: v.optional(PlaceText),
      country: v.optional(PlaceText),
      /** Rounded to 0.01 degrees when stored. */
      lat: v.number(),
      lon: v.number(),
      elevationM: v.optional(v.number()),
    }),
  ),
  /** The run of years the statistics came from, inclusive. */
  years: v.optional(v.tuple([v.number(), v.number()])),
  hemisphere: v.picklist(['north', 'south']),
  /** 1-12. The warmest month splits the year into the spring and fall halves. */
  warmestMonth: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(12)),
  /**
   * frost: frost in at least half of years. marginal: in 10-50% of years. none: in fewer than 10%.
   * With manual dates and no temperature data this is 'frost'.
   */
  frostClass: v.picklist(['frost', 'marginal', 'none']),
  /** Share of years with at least one frost (Tmin <= 0 C), 0-1. */
  frostYearsShare: v.number(),
  lastFrost: v.object({ p50: NullableMd, p90: NullableMd }),
  firstFrost: v.object({ p50: NullableMd, p10: NullableMd }),
  /** Median first fall day at or below -2 C and -5 C: harvest caps for half-hardy and hardy crops. */
  firstHardFrost: v.object({ minus2: NullableMd, minus5: NullableMd }),
  /** Mean of each cold season's lowest temperature, C. */
  extremeMinC: v.nullable(v.number()),
  /** USDA-style hardiness zone from extremeMinC, e.g. "6b". */
  zone: v.nullable(v.string()),
  /** Monthly normals, January first, degrees C. Absent for manual profiles without a place. */
  monthly: v.optional(v.object({ meanC: Twelve, minC: Twelve, maxC: Twelve })),
  /** ISO date the profile was computed or entered. */
  asOf: v.string(),
  /**
   * Days the gardener moved the frost dates from what was computed (positive is later). The stored
   * dates already include the shift; this records it so the app can say so and undo it.
   */
  adjustedDays: v.optional(
    v.object({
      lastFrost: v.pipe(v.number(), v.integer(), v.minValue(-60), v.maxValue(60)),
      firstFrost: v.pipe(v.number(), v.integer(), v.minValue(-60), v.maxValue(60)),
    }),
  ),
});

export type ClimateProfile = v.InferOutput<typeof ClimateProfileSchema>;
