// What a planting should give over its harvest, from the plant's typical yield: per plant (times the
// planting's count) or per square (times its squares). Weights in grams; some crops are counted
// (heads, fruits, blooms) instead. These are conservative home-garden figures, so the harvest screen
// can show "picked so far against what to expect" without overpromising.
import type { Harvest, Planting } from './doc/schema';
import type { Plant } from './plants/schema';

export interface Amount {
  grams: number;
  count: number;
}

export function expectedYield(planting: Planting, plant: Plant): Amount {
  const { amount, unit, per } = plant.yield;
  const multiplier = per === 'plant' ? planting.count : planting.cells ? planting.cells.w * planting.cells.h : planting.count;
  const total = amount * multiplier;
  return unit === 'g' ? { grams: total, count: 0 } : { grams: 0, count: total };
}

export function pickedSoFar(harvests: readonly Harvest[], filter: (h: Harvest) => boolean): Amount {
  let grams = 0;
  let count = 0;
  for (const h of harvests) {
    if (!filter(h)) continue;
    grams += h.grams ?? 0;
    count += h.count ?? 0;
  }
  return { grams, count };
}
