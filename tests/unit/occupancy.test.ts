import { describe, expect, it } from 'vitest';
import { toDay } from '../../src/domain/dates';
import type { Cells, GridBed, Planting, Vessel } from '../../src/domain/doc/schema';
import {
  conflictsFor,
  formatDuration,
  occupiedAt,
  vesselLoad,
  type BedInterval,
} from '../../src/domain/layout/occupancy';
import { plantById } from '../../src/domain/plants/library';

const plantOf = (id: string) => plantById(id);

/** A planting with pinned dates; bedOut undefined means ongoing. */
function planting(
  id: string,
  plantId: string,
  bedIn: string,
  bedOut: string | undefined,
  cells: Cells | undefined = { col: 0, row: 0, w: 2, h: 2 },
  extra: Partial<Planting> = {},
): Planting {
  return {
    id,
    containerId: 'bed1',
    plantId,
    ...(cells ? { cells } : {}),
    count: 1,
    method: 'transplant',
    anchor: { kind: 'pinned', bedIn, ...(bedOut ? { bedOut } : {}) },
    ...extra,
  };
}

const intervalOf = (p: Planting): BedInterval | null =>
  p.anchor.kind === 'pinned'
    ? { bedIn: toDay(p.anchor.bedIn), bedOut: p.anchor.bedOut ? toDay(p.anchor.bedOut) : null }
    : null;

const bed: GridBed = { id: 'bed1', form: 'grid', kind: 'raised-bed', name: 'Bed 1', x: 0, y: 0, cols: 4, rows: 8, rotation: 0 };

describe('conflictsFor', () => {
  const garlic = planting('garlic', 'garlic', '2026-10-20', '2027-07-10');

  it('garlic through to July blocks a May tomato in the same squares', () => {
    const tomato = planting('tom', 'tomato', '2027-05-20', '2027-09-30');
    const out = conflictsFor(tomato, [garlic], intervalOf, plantOf);
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe('conflict');
    expect(out[0]!.with.id).toBe('garlic');
    expect(out[0]!.reason).toBe(
      'Garlic is still growing here when Tomato goes in, and they would share these squares for 7 weeks.',
    );
  });

  it('lets a July 20 bean follow the garlic', () => {
    const bean = planting('bean', 'bush-bean', '2027-07-20', '2027-09-15');
    expect(conflictsFor(bean, [garlic], intervalOf, plantOf)).toEqual([]);
  });

  it('treats back-to-back plantings as not overlapping', () => {
    const bean = planting('bean', 'bush-bean', '2027-07-10', '2027-09-15');
    expect(conflictsFor(bean, [garlic], intervalOf, plantOf)).toEqual([]);
  });

  it('ignores other squares, other beds and itself', () => {
    const tomato = planting('tom', 'tomato', '2027-05-20', '2027-09-30', { col: 2, row: 0, w: 2, h: 2 });
    const elsewhere = { ...garlic, id: 'g2', containerId: 'bed2' };
    expect(conflictsFor(tomato, [garlic, elsewhere, tomato], intervalOf, plantOf)).toEqual([]);
  });

  it('calls lettuce under a tomato an interplant', () => {
    const tomato = planting('tom', 'tomato', '2027-05-20', '2027-09-30');
    const lettuce = planting('let', 'lettuce', '2027-06-01', '2027-07-15', { col: 1, row: 1, w: 1, h: 1 });
    const out = conflictsFor(lettuce, [tomato], intervalOf, plantOf);
    expect(out).toEqual([
      { with: tomato, kind: 'interplant', reason: 'Lettuce stays low and copes with shade, so it can grow under Tomato.' },
    ]);
    // And the same from the tomato's side.
    expect(conflictsFor(tomato, [lettuce], intervalOf, plantOf)[0]!.kind).toBe('interplant');
  });

  it('calls a short overlap a relay', () => {
    // Garlic comes out 3 weeks after the tomato goes in.
    const tomato = planting('tom', 'tomato', '2027-06-19', '2027-09-30');
    const out = conflictsFor(tomato, [garlic], intervalOf, plantOf);
    expect(out[0]!.kind).toBe('interplant');
    expect(out[0]!.reason).toBe('Garlic comes out within 3 weeks of Tomato going in, so they can share the squares as a relay.');
    // 29 days is too long for a relay.
    const early = planting('tom', 'tomato', '2027-06-11', '2027-09-30');
    expect(conflictsFor(early, [garlic], intervalOf, plantOf)[0]!.kind).toBe('conflict');
  });

  it('asparagus, a perennial with no end, blocks everything later', () => {
    const asparagus = planting('asp', 'asparagus', '2026-04-10', undefined, { col: 0, row: 0, w: 4, h: 2 });
    for (const [plantId, bedIn] of [
      ['tomato', '2027-05-20'],
      ['bush-bean', '2030-07-01'],
      ['lettuce', '2028-04-01'],
    ] as const) {
      const later = planting('later', plantId, bedIn, '2031-01-01', { col: 1, row: 1, w: 1, h: 1 });
      const out = conflictsFor(later, [asparagus], intervalOf, plantOf);
      expect(out).toHaveLength(1);
      expect(out[0]!.kind).toBe('conflict');
      expect(out[0]!.reason).toMatch(/^Asparagus is a perennial and holds these squares from year to year/);
    }
  });

  it('describes plantings that go in on the same day', () => {
    const a = planting('a', 'tomato', '2027-05-20', '2027-09-30');
    const b = planting('b', 'pepper', '2027-05-20', '2027-09-30');
    expect(conflictsFor(a, [b], intervalOf, plantOf)[0]!.reason).toBe(
      `Tomato and ${plantById('pepper')!.name} would go into the same squares at the same time and share them for 19 weeks.`,
    );
  });

  it('occupies nothing without an interval', () => {
    const indoors = planting('in', 'tomato', '2027-05-20', '2027-09-30');
    expect(conflictsFor(indoors, [garlic], () => null, plantOf)).toEqual([]);
  });

  it('has no em dashes in its reasons', () => {
    const tomato = planting('tom', 'tomato', '2027-05-20', '2027-09-30');
    for (const c of conflictsFor(tomato, [garlic], intervalOf, plantOf)) expect(c.reason).not.toMatch(/—/);
  });
});

describe('occupiedAt', () => {
  const garlic = planting('garlic', 'garlic', '2026-10-20', '2027-07-10', { col: 0, row: 0, w: 2, h: 1 });
  const bean = planting('bean', 'bush-bean', '2027-07-10', '2027-09-15', { col: 0, row: 0, w: 2, h: 1 });
  const lettuce = planting('let', 'lettuce', '2027-04-01', '2027-06-01', { col: 1, row: 0, w: 1, h: 2 });
  const other = { ...bean, id: 'other', containerId: 'bed2' };
  const all = [garlic, bean, lettuce, other];

  it('shows what holds each square on a day', () => {
    const may = occupiedAt(bed, all, toDay('2027-05-01'), intervalOf);
    expect(may.present.map((p) => p.id)).toEqual(['garlic', 'let']);
    expect(may.byCell.get('0,0')!.map((p) => p.id)).toEqual(['garlic']);
    expect(may.byCell.get('1,0')!.map((p) => p.id)).toEqual(['garlic', 'let']);
    expect(may.byCell.get('1,1')!.map((p) => p.id)).toEqual(['let']);
    expect(may.byCell.has('2,0')).toBe(false);
  });

  it('hands the squares over on the changeover day', () => {
    expect(occupiedAt(bed, all, toDay('2027-07-09'), intervalOf).present.map((p) => p.id)).toEqual(['garlic']);
    expect(occupiedAt(bed, all, toDay('2027-07-10'), intervalOf).present.map((p) => p.id)).toEqual(['bean']);
  });

  it('lists vessel contents without cells', () => {
    const v: Vessel = { id: 'bed2', form: 'vessel', kind: 'pot', name: 'Pot', x: 0, y: 0, diameterCm: 30, litres: 20 };
    const res = occupiedAt(v, all, toDay('2027-08-01'), intervalOf);
    expect(res.present.map((p) => p.id)).toEqual(['other']);
    expect(res.byCell.size).toBe(0);
  });
});

describe('vesselLoad', () => {
  const pot: Vessel = { id: 'pot', form: 'vessel', kind: 'pot', name: 'Big pot', x: 0, y: 0, diameterCm: 40, litres: 40 };
  const inPot = (id: string, plantId: string, count: number, bedIn: string, bedOut: string) =>
    planting(id, plantId, bedIn, bedOut, undefined, { containerId: 'pot', count, method: 'direct' });

  it('accepts what fits', () => {
    const lettuce = inPot('l1', 'lettuce', 3, '2027-04-01', '2027-06-01');
    expect(vesselLoad(lettuce, pot, [], intervalOf, plantOf)).toEqual({ ok: true, peak: 1 });
  });

  it('counts the same plant across plantings', () => {
    const a = inPot('l1', 'lettuce', 2, '2027-04-01', '2027-06-01');
    const b = inPot('l2', 'lettuce', 2, '2027-05-01', '2027-07-01');
    const res = vesselLoad(b, pot, [a], intervalOf, plantOf);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('This pot has room for 3 Lettuce, and this would make 4.');
  });

  it('only counts plantings in the pot at the same time', () => {
    const a = inPot('l1', 'lettuce', 3, '2027-04-01', '2027-06-01');
    const b = inPot('l2', 'lettuce', 3, '2027-06-01', '2027-07-15');
    expect(vesselLoad(b, pot, [a], intervalOf, plantOf).ok).toBe(true);
  });

  it('adds up shares of different plants', () => {
    // A tomato fills a pot on its own (perVessel 1), so lettuce alongside is too much.
    const tomato = inPot('t', 'tomato', 1, '2027-05-20', '2027-09-30');
    const lettuce = inPot('l', 'lettuce', 1, '2027-06-01', '2027-07-01');
    const res = vesselLoad(lettuce, pot, [tomato], intervalOf, plantOf);
    expect(res.ok).toBe(false);
    expect(res.peak).toBeCloseTo(4 / 3, 9);
    expect(res.reason).toBe('This pot would be too crowded: together these plants need about 133% of the room it has.');
  });
});

describe('formatDuration', () => {
  it('uses days, then weeks', () => {
    expect(formatDuration(1)).toBe('1 day');
    expect(formatDuration(13)).toBe('13 days');
    expect(formatDuration(21)).toBe('3 weeks');
    expect(formatDuration(52)).toBe('7 weeks');
  });
});
