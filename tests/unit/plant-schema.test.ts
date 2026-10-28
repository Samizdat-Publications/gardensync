// The plant record's number bounds, and the schedule's refusal to throw on a record it cannot use.
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { CustomPlantSchema } from '../../src/domain/doc/schema';
import { PLANTS, plantById } from '../../src/domain/plants/library';
import { PlantSchema, type Plant } from '../../src/domain/plants/schema';
import { reasonText } from '../../src/domain/schedule/reasons';
import { plantSchedule } from '../../src/domain/schedule/windows';
import { profileOf } from './schedule-helpers';

const tomato = plantById('tomato')!;
const lettuce = plantById('lettuce')!;
const garlic = plantById('garlic')!;
const valid = (p: unknown) => v.safeParse(PlantSchema, p).success;

describe('plant number bounds', () => {
  it('every one of the 63 library plants still validates', () => {
    expect(PLANTS).toHaveLength(63);
    for (const p of PLANTS) expect(valid(p), p.id).toBe(true);
  });

  it('week ranges are whole weeks within 60 either side', () => {
    const at = (weeks: unknown) => ({ ...lettuce, methods: { ...lettuce.methods, direct: { weeks } } });
    expect(valid(at([-60, 60]))).toBe(true);
    expect(valid(at([-61, 0]))).toBe(false);
    expect(valid(at([0, 61]))).toBe(false);
    expect(valid(at([0.5, 2]))).toBe(false);
    expect(valid({ ...garlic, overwinter: { ...garlic.overwinter!, plantWeeks: [-2, 61] } })).toBe(false);
    expect(valid({ ...garlic, overwinter: { ...garlic.overwinter!, harvestWeeks: [-1.5, 2] } })).toBe(false);
  });

  it('seedling ages are 1 to 20 whole weeks', () => {
    const age = (ageWeeks: unknown) => ({ ...tomato, methods: { ...tomato.methods, indoor: { ageWeeks } } });
    expect(valid(age([1, 20]))).toBe(true);
    expect(valid(age([0, 6]))).toBe(false);
    expect(valid(age([6, 21]))).toBe(false);
    expect(valid(age([4.5, 6]))).toBe(false);
  });

  it('days, windows and intervals have sensible ranges', () => {
    expect(valid({ ...tomato, maturity: { days: 2000, from: 'sow' } })).toBe(true);
    expect(valid({ ...tomato, maturity: { days: 2001, from: 'sow' } })).toBe(false);
    expect(valid({ ...tomato, maturity: { days: 70.5, from: 'sow' } })).toBe(false);
    expect(valid({ ...tomato, harvest: { ...tomato.harvest, windowDays: 730 } })).toBe(true);
    expect(valid({ ...tomato, harvest: { ...tomato.harvest, windowDays: 731 } })).toBe(false);
    expect(valid({ ...lettuce, fall: { windowWeeks: 26 } })).toBe(true);
    expect(valid({ ...lettuce, fall: { windowWeeks: 27 } })).toBe(false);
    expect(valid({ ...lettuce, succession: { everyDays: 2 } })).toBe(false);
    expect(valid({ ...lettuce, succession: { everyDays: 120 } })).toBe(true);
    expect(valid({ ...lettuce, succession: { everyDays: 121 } })).toBe(false);
  });

  it('custom plants get the same bounds', () => {
    const base = { id: 'mine', name: 'Mine', category: 'vegetable', frost: 'tender', maturity: { days: 60, from: 'sow' } };
    expect(v.safeParse(CustomPlantSchema, base).success).toBe(true);
    expect(v.safeParse(CustomPlantSchema, { ...base, methods: { direct: { weeks: [0, 5000] } } }).success).toBe(false);
    expect(v.safeParse(CustomPlantSchema, { ...base, maturity: { days: 1e9, from: 'sow' } }).success).toBe(false);
  });
});

describe('plantSchedule never throws', () => {
  it('gives a broken record no windows and a schedule-error reason', () => {
    // A record that skipped validation: a transplant block with no weeks.
    const broken = { ...tomato, id: 'broken', methods: { transplant: {} } } as unknown as Plant;
    const s = plantSchedule(broken, profileOf('canton-oh'), 2027);
    expect(s.windows).toEqual([]);
    expect(s.notViable).toEqual([{ kind: 'spring', reason: { code: 'schedule-error' } }]);
    expect(reasonText(s.notViable[0]!.reason)).toMatch(/could not be worked out/);
    expect(plantSchedule(broken, profileOf('canton-oh'), 2027)).toBe(s);
  });
});
