import { describe, expect, it } from 'vitest';
import { manualProfile } from '../../src/domain/climate/manual';
import { toDay } from '../../src/domain/dates';
import { applyOp } from '../../src/domain/doc/ops';
import type { Harvest } from '../../src/domain/doc/schema';
import { emptyDoc } from '../../src/domain/doc/schema';
import { starterOps } from '../../src/domain/doc/starters';
import { plantById } from '../../src/domain/plants/library';
import { plantingPhases, seasonOf } from '../../src/domain/schedule';
import { pickedSoFar } from '../../src/domain/yield';
import { cropRows, pickablePlantings } from '../../src/ui/harvest/model';

const TODAY = '2027-07-15';
const climate = manualProfile({ lastFrost: '04-16', firstFrost: '11-04', asOf: TODAY });

function starter() {
  let n = 0;
  const ops = starterOps({ kind: 'first-bed', gardenId: 'g1', name: 'Back garden', today: TODAY, units: 'imperial', climate, newId: () => `id${n++}` });
  const res = applyOp(emptyDoc(), { type: 'batch', ops });
  if (!res.ok) throw new Error(res.error);
  return res.doc.gardens[0]!;
}

const g = starter();
const today = toDay(TODAY);
const season = seasonOf(climate, today);
const phasesOf = (id: string) => {
  const p = g.plantings.find((q) => q.id === id)!;
  return plantingPhases(p, plantById(p.plantId)!, climate)!;
};

describe('harvest: what a pick can be logged against', () => {
  const pickable = pickablePlantings(g.plantings, plantById, climate, season, today);

  it('a mid-July starter has plantings that only go in next year', () => {
    expect(g.plantings.some((p) => phasesOf(p.id).bedIn > today)).toBe(true);
  });

  it('lists only plantings in the ground by today', () => {
    expect(pickable.length).toBeGreaterThan(0);
    for (const p of pickable) expect(phasesOf(p.id).bedIn).toBeLessThanOrEqual(today);
    for (const p of g.plantings.filter((q) => !pickable.includes(q))) expect(phasesOf(p.id).bedIn).toBeGreaterThan(today);
  });

  it('keeps a planting that went in before the season and is still growing', () => {
    const later = toDay('2027-12-20');
    const winter = pickablePlantings(g.plantings, plantById, climate, seasonOf(climate, later), later);
    for (const p of pickable) {
      const out = phasesOf(p.id).bedOut;
      if (out === null || out > later) expect(winter).toContain(p);
    }
  });
});

describe('harvest: one row per crop', () => {
  it('every pick lands in a row, so the rows add up to the total, even for a crop planned for next year', () => {
    const nextYear = g.plantings.find((p) => phasesOf(p.id).season !== season)!;
    expect(nextYear).toBeDefined();
    const picks: Harvest[] = [
      { id: 'h1', plantId: nextYear.plantId, plantingId: nextYear.id, date: TODAY, grams: 907 },
      { id: 'h2', plantId: g.plantings[0]!.plantId, plantingId: g.plantings[0]!.id, date: TODAY, grams: 680, count: 3 },
      { id: 'h3', plantId: 'a-deleted-variety', date: TODAY, count: 2 },
    ];
    const rows = cropRows(g.plantings, picks, plantById, climate, season);
    const total = pickedSoFar(picks, () => true);
    expect(rows.reduce((a, r) => a + r.picked.grams, 0)).toBe(total.grams);
    expect(rows.reduce((a, r) => a + r.picked.count, 0)).toBe(total.count);
    expect(rows.find((r) => r.plantId === nextYear.plantId)?.picked.grams).toBe(907);
    expect(rows.find((r) => r.plantId === 'a-deleted-variety')).toMatchObject({ plant: undefined, picked: { grams: 0, count: 2 } });
  });

  it('counts only this season\'s plantings toward what to expect', () => {
    const rows = cropRows(g.plantings, [], plantById, climate, season);
    const planned = new Set(g.plantings.filter((p) => phasesOf(p.id).season === season).map((p) => p.plantId));
    expect(new Set(rows.map((r) => r.plantId))).toEqual(planned);
  });
});
