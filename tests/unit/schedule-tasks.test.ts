// A planting's own dates (project.ts) and the task list (tasks.ts), for fixed "today" dates.
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import type { ClimateProfile } from '../../src/domain/climate/types';
import { circularDoy, monthDayFromCircular, toDay, toIso, type MonthDay } from '../../src/domain/dates';
import { GardenSchema, type Garden, type Planting } from '../../src/domain/doc/schema';
import { PLANTS_BY_ID, plantById } from '../../src/domain/plants/library';
import { intervalOf, plantingPhases } from '../../src/domain/schedule/project';
import { tasksFor, type Task } from '../../src/domain/schedule/tasks';
import { seasonRefs } from '../../src/domain/schedule/seasons';
import { daysToHarvest, plantSchedule } from '../../src/domain/schedule/windows';
import { profileOf } from './schedule-helpers';

const d = (iso: string) => toDay(iso);
const plant = (id: string) => plantById(id)!;

function auto(id: string, plantId: string, method: Planting['method'], window: 'spring' | 'fall' | 'overwinter' | 'perennial', season: number, extra: Partial<Planting> = {}, offsetDays = 0, round?: number): Planting {
  return {
    id,
    containerId: 'bed1',
    plantId,
    count: 1,
    method,
    anchor: { kind: 'auto', window, season, offsetDays, ...(round !== undefined ? { round } : {}) },
    ...extra,
  };
}

function garden(climate: ClimateProfile, plantings: Planting[], taskState: Record<string, string> = {}): Garden {
  return v.parse(GardenSchema, {
    id: 'g1',
    name: 'Test garden',
    createdAt: '2026-10-28',
    cellCm: 30.48,
    climate,
    containers: [{ id: 'bed1', form: 'grid', kind: 'raised-bed', name: 'Bed 1', x: 0, y: 0, cols: 4, rows: 8, rotation: 0 }],
    plantings,
    series: [],
    harvests: [],
    journal: [],
    customPlants: [],
    taskState,
  });
}

const canton = () => profileOf('canton-oh');
const cantonPlantings = (): Planting[] => [
  auto('tom1', 'tomato', 'indoor', 'spring', 2027),
  auto('pep1', 'pepper', 'indoor', 'spring', 2027),
  auto('oni1', 'onion', 'indoor', 'spring', 2027),
  auto('leek1', 'leek', 'indoor', 'spring', 2027),
  auto('gar1', 'garlic', 'plant', 'overwinter', 2027),
  auto('let1', 'lettuce', 'direct', 'spring', 2027, {}, 0, 0),
  auto('kal1', 'kale', 'transplant', 'spring', 2027),
];
const brief = (ts: Task[]) => ts.map((t) => `${toIso(t.date)} ${t.kind} ${t.plantId} ${t.season}`);

describe('plantingPhases', () => {
  it('auto: the window start plus offsetDays, harvest moved with it', () => {
    const w = plantSchedule(plant('tomato'), canton(), 2027).windows[0]!;
    const p0 = plantingPhases(auto('t', 'tomato', 'indoor', 'spring', 2027), plant('tomato'), canton())!;
    expect(p0.bedIn).toBe(w.bedIn.start);
    expect(p0.harvest).toEqual(w.harvest);
    expect(p0.indoor).toEqual({ start: w.bedIn.start - 56, end: w.bedIn.start - 42 });
    expect(p0.bedOut).toBe(w.harvest.end + 1);
    const p7 = plantingPhases(auto('t', 'tomato', 'indoor', 'spring', 2027, {}, 7), plant('tomato'), canton())!;
    expect(p7.bedIn).toBe(w.bedIn.start + 7);
    expect(p7.harvest!.start).toBe(w.harvest.start + 7);
  });

  it('auto with a succession round takes that round', () => {
    const rounds = plantSchedule(plant('lettuce'), canton(), 2027).windows.find((w) => w.kind === 'spring' && w.method === 'direct')!.rounds!;
    const p = plantingPhases(auto('l', 'lettuce', 'direct', 'spring', 2027, {}, 0, 2), plant('lettuce'), canton())!;
    expect(p.bedIn).toBe(rounds[2]);
    expect(p.round).toBe(2);
  });

  it('pinned dates never move, and the harvest follows them', () => {
    const pl: Planting = { id: 'p', containerId: 'bed1', plantId: 'tomato', count: 1, method: 'bought', anchor: { kind: 'pinned', bedIn: '2027-05-25' } };
    const p = plantingPhases(pl, plant('tomato'), canton())!;
    expect(toIso(p.bedIn)).toBe('2027-05-25');
    expect(toIso(p.harvest!.start)).toBe('2027-08-03');
    expect(p.indoor).toBeNull();
    expect(p.season).toBe(2027);
    const out = plantingPhases({ ...pl, anchor: { kind: 'pinned', bedIn: '2027-05-25', bedOut: '2027-09-01' } }, plant('tomato'), null)!;
    expect(toIso(out.bedOut!)).toBe('2027-09-01');
  });

  it('actual dates override the plan', () => {
    const pl = auto('t', 'tomato', 'indoor', 'spring', 2027, { actual: { startedIndoors: '2027-03-20', bedIn: '2027-05-20', ended: '2027-09-10' } });
    const p = plantingPhases(pl, plant('tomato'), canton())!;
    expect(p.indoor).toEqual({ start: d('2027-03-20'), end: d('2027-03-20') });
    expect(toIso(p.bedIn)).toBe('2027-05-20');
    expect(toIso(p.harvest!.start)).toBe('2027-07-29');
    expect(toIso(p.bedOut!)).toBe('2027-09-11');
  });

  it('intervalOf: [bedIn, bedOut), open-ended for perennials, across the new year for garlic', () => {
    const asp = intervalOf(auto('a', 'asparagus', 'plant', 'perennial', 2027), plant('asparagus'), canton())!;
    expect(asp.end).toBeNull();
    const gar = intervalOf(auto('g', 'garlic', 'plant', 'overwinter', 2027), plant('garlic'), canton())!;
    expect(toIso(gar.start)).toBe('2026-10-13');
    expect(toIso(gar.end!)).toBe('2027-07-10');
    expect(intervalOf(auto('t', 'tomato', 'indoor', 'spring', 2027), plant('tomato'), null)).toBeNull();
  });
});

describe('tasksFor in Canton', () => {
  it('Mar 1 2027: start peppers and tomatoes indoors soon', () => {
    const g = garden(canton(), cantonPlantings());
    const ts = tasksFor(g, PLANTS_BY_ID, d('2027-03-01'), d('2027-03-28'));
    const indoors = ts.filter((t) => t.kind === 'start-indoors').map((t) => t.plantId);
    expect(indoors).toContain('pepper');
    expect(indoors).toContain('tomato');
    expect(ts.find((t) => t.plantId === 'pepper' && t.kind === 'start-indoors')!.date).toBe(d('2027-03-08'));
  });

  it('Dec 28 2026 shows the January jobs of the coming season', () => {
    const g = garden(canton(), cantonPlantings());
    const ts = tasksFor(g, PLANTS_BY_ID, d('2026-12-28'), d('2027-01-31'));
    expect(brief(ts)).toContain('2026-12-25 start-indoors onion 2027');
    expect(brief(ts)).toContain('2027-01-08 start-indoors leek 2027');
    expect(ts.every((t) => t.season === 2027)).toBe(true);
  });

  it('October 2026 includes planting garlic for next season', () => {
    const g = garden(canton(), cantonPlantings());
    const ts = tasksFor(g, PLANTS_BY_ID, d('2026-10-01'), d('2026-10-31'));
    const garlic = ts.find((t) => t.plantId === 'garlic')!;
    expect(garlic.kind).toBe('plant-next-year');
    expect(garlic.id).toBe('gar1:plant-next-year:2027');
    expect(toIso(garlic.date)).toBe('2026-10-13');
    expect(toIso(garlic.until!)).toBe('2026-11-10');
  });

  it('a whole season: sorted by date, ids unique, frost reminder at FF10 for tender crops', () => {
    const g = garden(canton(), cantonPlantings());
    const ts = tasksFor(g, PLANTS_BY_ID, d('2026-07-16'), d('2027-12-31'));
    for (let i = 1; i < ts.length; i++) expect(ts[i]!.date).toBeGreaterThanOrEqual(ts[i - 1]!.date);
    expect(new Set(ts.map((t) => t.id)).size).toBe(ts.length);
    const frost = ts.filter((t) => t.kind === 'frost-possible');
    expect(frost.map((t) => t.plantId).sort()).toEqual([]);
    // Tomato and pepper are pulled by Sep 24, before FF10 (Oct 26): no reminder. A later pepper gets one.
    const late = garden(canton(), [auto('pep2', 'pepper', 'indoor', 'spring', 2027, {}, 45)]);
    const lateTasks = tasksFor(late, PLANTS_BY_ID, d('2027-01-01'), d('2027-12-31'));
    expect(lateTasks.find((t) => t.kind === 'frost-possible')?.id).toBe('pep2:frost-possible:2027');
    expect(brief(ts)).toContain('2027-04-02 succession-sow lettuce 2027');
  });

  it('a ticked task keeps its id when the frost dates move by a week', () => {
    const shift = (md: MonthDay | null) => (md === null ? null : monthDayFromCircular(circularDoy(md) + 7));
    const p = canton();
    const later: ClimateProfile = {
      ...p,
      lastFrost: { p50: shift(p.lastFrost.p50), p90: shift(p.lastFrost.p90) },
      firstFrost: { p50: shift(p.firstFrost.p50), p10: shift(p.firstFrost.p10) },
      firstHardFrost: { minus2: shift(p.firstHardFrost.minus2), minus5: shift(p.firstHardFrost.minus5) },
    };
    const before = tasksFor(garden(p, cantonPlantings()), PLANTS_BY_ID, d('2026-07-16'), d('2027-12-31'));
    const ticked = { [before.find((t) => t.plantId === 'kale' && t.kind === 'transplant')!.id]: '2027-03-20' };
    const after = tasksFor(garden(later, cantonPlantings(), ticked), PLANTS_BY_ID, d('2026-07-16'), d('2027-12-31'));
    const ids = (ts: Task[]) => ts.filter((t) => t.kind !== 'frost-possible').map((t) => t.id).sort();
    expect(ids(after)).toEqual(ids(before));
    const kale = after.find((t) => t.id === 'kal1:transplant:2027')!;
    expect(kale.done).toBe(true);
    expect(kale.date).toBe(before.find((t) => t.id === 'kal1:transplant:2027')!.date + 7);
  });

  it('is the same answer whatever the process time zone (the check runs this file in two)', () => {
    const ts = tasksFor(garden(canton(), cantonPlantings()), PLANTS_BY_ID, d('2027-03-01'), d('2027-03-31'));
    expect(brief(ts)).toContain('2027-03-22 start-indoors tomato 2027');
    expect(brief(ts)).toContain('2027-03-19 transplant kale 2027');
  });

  it('failed plantings drop their open jobs; done ones are marked', () => {
    const pl = auto('t', 'tomato', 'indoor', 'spring', 2027, { actual: { startedIndoors: '2027-03-20', failed: true } });
    const ts = tasksFor(garden(canton(), [pl]), PLANTS_BY_ID, d('2027-01-01'), d('2027-12-31'));
    expect(ts.map((t) => t.kind)).toEqual(['start-indoors']);
    expect(ts[0]!.done).toBe(true);
  });
});

describe('tasksFor in Melbourne (southern, temperature mode)', () => {
  it('garlic for the 2027-28 season goes in in autumn 2027', () => {
    const g = garden(profileOf('melbourne'), [auto('g', 'garlic', 'plant', 'overwinter', 2027)]);
    const ts = tasksFor(g, PLANTS_BY_ID, d('2027-04-01'), d('2027-05-31'));
    expect(ts.map((t) => t.id)).toEqual(['g:plant-next-year:2027']);
  });

  it('a spring anchor finds the temperature window', () => {
    const g = garden(profileOf('melbourne'), [auto('t', 'tomato', 'indoor', 'spring', 2027)]);
    const ts = tasksFor(g, PLANTS_BY_ID, d('2027-08-01'), d('2028-06-30'));
    expect(ts.map((t) => t.kind)).toEqual(['start-indoors', 'harden-off', 'transplant', 'start-picking', 'end-of-season']);
  });
});

describe('season-long windows and the fall factor', () => {
  // Canton beet: one spring-through-fall window, rounds every 21 days from Mar 26 to Aug 20.
  const beet = () => plantSchedule(plant('beet'), canton(), 2027).windows.find((w) => w.kind === 'spring')!;
  const W = () => seasonRefs(canton(), 2027).W;

  it('a late round gets the fall factor, as the schedule gave it when it checked the round', () => {
    const w = beet();
    expect(w.reasons.some((r) => r.code === 'season-long')).toBe(true);
    const k = w.rounds!.findIndex((r) => r > W());
    expect(k).toBeGreaterThan(0);
    const p = plantingPhases(auto('b', 'beet', 'direct', 'spring', 2027, {}, 0, k), plant('beet'), canton())!;
    expect(p.bedIn).toBe(w.rounds![k]);
    expect(p.harvest!.start - p.bedIn).toBe(daysToHarvest(plant('beet'), 'direct') + 14);
    // An early round does not.
    const e = plantingPhases(auto('b', 'beet', 'direct', 'spring', 2027, {}, 0, 1), plant('beet'), canton())!;
    expect(e.harvest!.start - e.bedIn).toBe(daysToHarvest(plant('beet'), 'direct'));
  });

  it('a fall anchor on a season-long window starts at the first round after midsummer', () => {
    const w = beet();
    const p = plantingPhases(auto('b', 'beet', 'direct', 'fall', 2027), plant('beet'), canton())!;
    const first = w.rounds!.find((r) => r > W())!;
    expect(p.bedIn).toBe(first);
    expect(toIso(p.bedIn)).toBe('2027-07-30');
    expect(p.harvest!.start - p.bedIn).toBe(daysToHarvest(plant('beet'), 'direct') + 14);
  });

  it('every phase names the day its harvest ends', () => {
    for (const offset of [-5, 0, 9]) {
      for (const [id, method] of [['kale', 'transplant'], ['tomato', 'indoor'], ['lettuce', 'direct']] as const) {
        const p = plantingPhases(auto('x', id, method, 'spring', 2027, {}, offset), plant(id), canton());
        if (!p?.harvest) continue;
        expect(p.harvestUntil).toMatchObject({ code: 'harvest-until', day: p.harvest.end });
      }
    }
  });
});

describe('plantings the plant cannot be grown that way, or with dates out of order', () => {
  it('have no phases', () => {
    expect(plantingPhases(auto('t', 'tomato', 'direct', 'spring', 2027), plant('tomato'), canton())).toBeNull();
    expect(plantingPhases(auto('c', 'carrot', 'indoor', 'spring', 2027), plant('carrot'), canton())).toBeNull();
    expect(plantingPhases(auto('g', 'garlic', 'bought', 'overwinter', 2027), plant('garlic'), canton())).toBeNull();
    expect(plantingPhases(auto('t', 'tomato', 'bought', 'spring', 2027), plant('tomato'), canton())).not.toBeNull();
    const backwards = auto('t', 'tomato', 'indoor', 'spring', 2027, { actual: { startedIndoors: '2027-06-01', bedIn: '2027-05-20' } });
    expect(plantingPhases(backwards, plant('tomato'), canton())).toBeNull();
    const ended = auto('t', 'tomato', 'indoor', 'spring', 2027, { actual: { bedIn: '2027-05-20', ended: '2027-05-19' } });
    expect(plantingPhases(ended, plant('tomato'), null)).toBeNull();
  });
});

describe('task ids for pinned plantings', () => {
  const pinned: Planting = {
    id: 'pin', containerId: 'bed1', plantId: 'tomato', count: 1, method: 'bought',
    anchor: { kind: 'pinned', bedIn: '2028-02-01' },
  };
  const gardenWith = (climate: ClimateProfile | null, taskState: Record<string, string> = {}): Garden =>
    v.parse(GardenSchema, { ...garden(canton(), [pinned], taskState), climate });

  it('a tick made before there was a climate still applies once one is set', () => {
    const from = d('2028-01-01');
    const to = d('2028-12-31');
    const before = tasksFor(gardenWith(null), PLANTS_BY_ID, from, to).find((t) => t.kind === 'transplant')!;
    expect(before.id).toBe('pin:transplant:2028');
    const ticked = { [before.id]: '2028-02-01' };
    for (const climate of [profileOf('melbourne'), canton()]) {
      const after = tasksFor(gardenWith(climate, ticked), PLANTS_BY_ID, from, to).find((t) => t.kind === 'transplant')!;
      expect(after.id).toBe(before.id);
      expect(after.done).toBe(true);
    }
    // Melbourne's season for a February day is the one that began the year before.
    expect(plantingPhases(pinned, plant('tomato'), profileOf('melbourne'))!.season).toBe(2027);
  });
});

describe('the first sowing of a succession crop', () => {
  it('runs until the next round is due, not to the end of a season-long window', () => {
    const g = garden(canton(), [auto('r1', 'radish', 'direct', 'spring', 2027)]);
    const sow = tasksFor(g, PLANTS_BY_ID, d('2027-01-01'), d('2027-12-31')).find((t) => t.kind === 'direct-sow');
    const next = tasksFor(g, PLANTS_BY_ID, d('2027-01-01'), d('2027-12-31')).find((t) => t.kind === 'succession-sow');
    expect(sow).toBeDefined();
    expect(next).toBeDefined();
    expect(sow!.until).toBe(next!.date - 1);
  });
});
