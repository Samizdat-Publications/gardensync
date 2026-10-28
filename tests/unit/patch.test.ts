import { describe, expect, it } from 'vitest';
import type { Vessel } from '../../src/domain/doc/schema';
import {
  cellKeys,
  cellsInBounds,
  cellsOverlap,
  defaultCount,
  minCells,
  vesselFit,
  vesselWarningText,
} from '../../src/domain/layout/patch';
import { plantById } from '../../src/domain/plants/library';

const plant = (id: string) => {
  const p = plantById(id);
  if (!p) throw new Error(`no plant ${id}`);
  return p;
};

const pot = (litres: number, extra: Partial<Vessel> = {}): Vessel => ({
  id: 'pot1',
  form: 'vessel',
  kind: 'pot',
  name: 'Pot',
  x: 0,
  y: 0,
  diameterCm: 30,
  litres,
  ...extra,
});

describe('defaultCount', () => {
  it('fills a 4 x 8 bed with 512 carrots', () => {
    expect(defaultCount(plant('carrot'), { w: 4, h: 8 })).toBe(512);
  });

  it('counts per-square plants', () => {
    expect(defaultCount(plant('tomato'), { w: 2, h: 3 })).toBe(6);
    expect(defaultCount(plant('lettuce'), { w: 1, h: 1 })).toBe(4);
  });

  it('counts whole footprints for plants that need several squares', () => {
    const squash = plant('winter-squash');
    expect(squash.density).toEqual({ squares: [3, 3] });
    expect(defaultCount(squash, { w: 2, h: 3 })).toBe(0);
    expect(defaultCount(squash, { w: 3, h: 3 })).toBe(1);
    expect(defaultCount(squash, { w: 6, h: 4 })).toBe(2);
  });

  it('tries the footprint both ways round', () => {
    const tall = { ...plant('winter-squash'), density: { squares: [1, 3] as [number, number] } };
    expect(defaultCount(tall, { w: 3, h: 1 })).toBe(1);
    expect(defaultCount(tall, { w: 1, h: 3 })).toBe(1);
    expect(defaultCount(tall, { w: 6, h: 2 })).toBe(4);
  });
});

describe('minCells', () => {
  it('is one square, or the footprint', () => {
    expect(minCells(plant('carrot'))).toEqual({ w: 1, h: 1 });
    expect(minCells(plant('winter-squash'))).toEqual({ w: 3, h: 3 });
  });
});

describe('vesselFit', () => {
  it('fits a chili pepper in an 11 L pot', () => {
    expect(vesselFit(plant('chili-pepper'), pot(11))).toEqual({ ok: true, maxCount: 1 });
  });

  it('warns that a tomato needs at least 20 L', () => {
    const fit = vesselFit(plant('tomato'), pot(11));
    expect(fit.ok).toBe(false);
    expect(fit.maxCount).toBe(1);
    expect(fit.warning).toEqual({ kind: 'too-small', needLitres: 20, haveLitres: 11 });
    expect(vesselWarningText(fit.warning!, 'Tomato', 'imperial')).toBe(
      'Tomato needs at least 5 gal of soil, and this one holds 3 gal.',
    );
    expect(vesselWarningText(fit.warning!, 'Tomato', 'metric')).toBe(
      'Tomato needs at least 20 L of soil, and this one holds 11 L.',
    );
    expect(vesselFit(plant('tomato'), pot(20)).ok).toBe(true);
  });

  it('says when a plant is not suited to containers', () => {
    const fit = vesselFit(plant('sweet-corn'), pot(100));
    expect(fit).toEqual({ ok: false, maxCount: 0, warning: { kind: 'not-suited' } });
    expect(vesselWarningText(fit.warning!, 'Sweet corn', 'metric')).toBe('Sweet corn is not suited to growing in containers.');
  });

  it('uses perVessel, or one plant per minimum volume', () => {
    expect(vesselFit(plant('lettuce'), pot(40)).maxCount).toBe(3);
    // Cilantro has no perVessel: minimum 6 L, so a 20 L pot holds 3.
    expect(plant('cilantro').container?.perVessel).toBeUndefined();
    expect(vesselFit(plant('cilantro'), pot(20)).maxCount).toBe(3);
  });

  it('uses pockets for a tower', () => {
    const tower = pot(60, { kind: 'tower', pockets: 12 });
    expect(vesselFit(plant('strawberry'), tower)).toEqual({ ok: true, maxCount: 12 });
  });
});

describe('cells', () => {
  const bed = { cols: 4, rows: 8 };

  it('checks bounds', () => {
    expect(cellsInBounds(bed, { col: 0, row: 0, w: 4, h: 8 })).toBe(true);
    expect(cellsInBounds(bed, { col: 1, row: 0, w: 4, h: 1 })).toBe(false);
    expect(cellsInBounds(bed, { col: 0, row: 7, w: 1, h: 2 })).toBe(false);
  });

  it('checks overlap; touching edges do not overlap', () => {
    expect(cellsOverlap({ col: 0, row: 0, w: 2, h: 2 }, { col: 1, row: 1, w: 2, h: 2 })).toBe(true);
    expect(cellsOverlap({ col: 0, row: 0, w: 2, h: 2 }, { col: 2, row: 0, w: 2, h: 2 })).toBe(false);
    expect(cellsOverlap({ col: 0, row: 0, w: 4, h: 1 }, { col: 3, row: 0, w: 1, h: 8 })).toBe(true);
  });

  it('lists cell keys', () => {
    expect(cellKeys({ col: 1, row: 2, w: 2, h: 2 })).toEqual(['1,2', '2,2', '1,3', '2,3']);
  });
});
