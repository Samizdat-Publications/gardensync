// Pure helpers behind the harvest screen: which plantings a pick can be logged against, and one row
// per crop so the rows always add up to the season's total. No DOM; unit tested.
import type { ClimateProfile } from '../../domain/climate/types';
import { dayFromParts, type DayNum } from '../../domain/dates';
import type { Harvest, Planting } from '../../domain/doc/schema';
import type { Plant } from '../../domain/plants/schema';
import { plantingPhases, seasonRefs } from '../../domain/schedule';
import { expectedYield, pickedSoFar, type Amount } from '../../domain/yield';

type PlantOf = (id: string) => Plant | undefined;

/** First and last day of a season: around midsummer with a climate, the calendar year without. */
export function seasonBounds(c: ClimateProfile | null, season: number): { start: DayNum; end: DayNum } {
  if (c) {
    const r = seasonRefs(c, season);
    return { start: r.start, end: r.end };
  }
  return { start: dayFromParts(season, 1, 1), end: dayFromParts(season, 12, 31) };
}

/**
 * Plantings a pick can come from: in the ground at some point in the season shown, up to today.
 * One that goes in later (a planting moved to next year because this year's window has passed) has
 * nothing to pick yet. A planting the schedule cannot place is kept, since nothing says it is not
 * in the ground.
 */
export function pickablePlantings(plantings: readonly Planting[], plantOf: PlantOf, c: ClimateProfile | null, season: number, today: DayNum): Planting[] {
  const { start, end } = seasonBounds(c, season);
  const until = Math.min(today, end);
  return plantings.filter((p) => {
    const plant = plantOf(p.plantId);
    if (!plant) return false;
    const phases = plantingPhases(p, plant, c);
    if (!phases) return true;
    return phases.bedIn <= until && (phases.bedOut ?? Infinity) > start;
  });
}

export interface CropRow {
  plantId: string;
  /** Undefined for a pick of a plant no longer in the library (a deleted variety). */
  plant: Plant | undefined;
  /** What this season's plantings of the crop should give; zero when none are planned. */
  expected: Amount;
  /** What was picked this season. */
  picked: Amount;
}

/**
 * One row per crop that is planned for the season or was picked in it, in the order first met
 * (plantings, then picks). Every pick in `seasonHarvests` lands in exactly one row, so the rows add
 * up to the season's total.
 */
export function cropRows(plantings: readonly Planting[], seasonHarvests: readonly Harvest[], plantOf: PlantOf, c: ClimateProfile | null, season: number): CropRow[] {
  const rows = new Map<string, CropRow>();
  const row = (plantId: string): CropRow => {
    let r = rows.get(plantId);
    if (!r) rows.set(plantId, (r = { plantId, plant: plantOf(plantId), expected: { grams: 0, count: 0 }, picked: { grams: 0, count: 0 } }));
    return r;
  };
  for (const p of plantings) {
    const plant = plantOf(p.plantId);
    if (!plant) continue;
    const phases = plantingPhases(p, plant, c);
    if (phases && phases.season !== season) continue;
    const r = row(plant.id);
    const e = expectedYield(p, plant);
    r.expected = { grams: r.expected.grams + e.grams, count: r.expected.count + e.count };
  }
  for (const h of seasonHarvests) row(h.plantId);
  for (const r of rows.values()) r.picked = pickedSoFar(seasonHarvests, (h) => h.plantId === r.plantId);
  return [...rows.values()];
}
