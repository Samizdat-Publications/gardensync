// Speed and caching: the whole library in two climates, the memo for custom plants, the phases memo,
// and rotation checks that only work out seasons when they must.
import { describe, expect, it } from 'vitest';
import type { CustomPlant, Garden, Planting } from '../../src/domain/doc/schema';
import { rotationWarnings } from '../../src/domain/layout/rotation';
import { PLANTS } from '../../src/domain/plants/library';
import { resolvePlant } from '../../src/domain/plants/resolve';
import { plantingPhases } from '../../src/domain/schedule/project';
import { plantSchedule } from '../../src/domain/schedule/windows';
import { profileOf } from './schedule-helpers';

describe('schedule speed', () => {
  it('works out all 63 plants for Canton and Melbourne in well under 1.5 s, then serves them from cache', () => {
    const places = [profileOf('canton-oh'), profileOf('melbourne')];
    const t0 = performance.now();
    const first = places.flatMap((profile) => PLANTS.map((p) => plantSchedule(p, profile, 2027)));
    const cold = performance.now() - t0;
    expect(first).toHaveLength(126);
    expect(cold).toBeLessThan(1500);

    const t1 = performance.now();
    const second = places.flatMap((profile) => PLANTS.map((p) => plantSchedule(p, profile, 2027)));
    const warm = performance.now() - t1;
    second.forEach((s, i) => expect(s).toBe(first[i]));
    expect(warm).toBeLessThan(50);
  });
});

describe('caches', () => {
  const customPlants: CustomPlant[] = [
    { id: 'sungold', name: 'Sungold', parent: 'tomato', category: 'vegetable', frost: 'tender', maturity: { days: 57, from: 'transplant' } },
  ];

  it('resolves a custom plant to the same object while its list is unchanged, so the schedule memo hits', () => {
    const a = resolvePlant('sungold', customPlants)!;
    const b = resolvePlant('sungold', customPlants)!;
    expect(b.plant).toBe(a.plant);
    const canton = profileOf('canton-oh');
    expect(plantSchedule(b.plant, canton, 2027)).toBe(plantSchedule(a.plant, canton, 2027));
    // A new list (the document changed) resolves afresh.
    expect(resolvePlant('sungold', [...customPlants])!.plant).not.toBe(a.plant);
  });

  it('remembers a planting\'s phases per planting, plant and climate', () => {
    const plant = resolvePlant('sungold', customPlants)!.plant;
    const planting: Planting = {
      id: 'p1', containerId: 'bed1', plantId: 'sungold', count: 1, method: 'transplant',
      anchor: { kind: 'auto', window: 'spring', season: 2027, offsetDays: 3 },
    };
    const canton = profileOf('canton-oh');
    const p = plantingPhases(planting, plant, canton);
    expect(p).not.toBeNull();
    expect(plantingPhases(planting, plant, canton)).toBe(p);
    expect(plantingPhases(planting, plant, profileOf('melbourne'))).not.toBe(p);
    expect(plantingPhases({ ...planting }, plant, canton)).not.toBe(p);
    expect(plantingPhases({ ...planting }, plant, canton)).toEqual(p);
  });

  it('rotation works out seasons only for plantings that share squares and family', () => {
    const at = (id: string, plantId: string, col: number): Planting => ({
      id, containerId: 'bed1', plantId, cells: { col, row: 0, w: 1, h: 1 }, count: 1, method: 'transplant',
      anchor: { kind: 'auto', window: 'spring', season: 2027, offsetDays: 0 },
    });
    const garden: Garden = {
      id: 'g', name: 'G', createdAt: '2026-01-01', cellCm: 30.48, climate: null,
      containers: [{ id: 'bed1', form: 'grid', kind: 'raised-bed', name: 'Bed', x: 0, y: 0, cols: 8, rows: 1, rotation: 0 }],
      // Tomato and kale share a square but not a family; the others share nothing.
      plantings: [at('t', 'tomato', 0), at('k', 'kale', 0), at('c', 'carrot', 2), at('b', 'bush-bean', 4)],
      series: [], harvests: [], journal: [], customPlants: [], taskState: {},
    };
    let calls = 0;
    const out = rotationWarnings(garden, (id) => resolvePlant(id, [])?.plant, () => {
      calls++;
      return 2027;
    });
    expect(out).toEqual([]);
    expect(calls).toBe(0);
  });
});
