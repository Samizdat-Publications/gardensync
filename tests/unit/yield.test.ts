import { describe, expect, it } from 'vitest';
import type { Planting } from '../../src/domain/doc/schema';
import { plantById } from '../../src/domain/plants/library';
import { expectedYield, pickedSoFar } from '../../src/domain/yield';

const planting = (plantId: string, count: number, cells?: Planting['cells']): Planting => ({
  id: 'p', containerId: 'c', plantId, count, method: 'direct', anchor: { kind: 'auto', window: 'spring', season: 2027, offsetDays: 0 }, ...(cells ? { cells } : {}),
});

describe('yield', () => {
  it('multiplies per-plant yields by the count and per-square yields by the squares', () => {
    const tomato = plantById('tomato')!;
    const t = expectedYield(planting('tomato', 2), tomato);
    expect(tomato.yield.per === 'plant' ? t.grams || t.count : 0).toBe(tomato.yield.amount * 2);
    const perSquare = [...['carrot', 'lettuce', 'radish', 'spinach', 'bush-bean']].map((id) => plantById(id)!).find((p) => p.yield.per === 'square');
    if (perSquare) {
      const y = expectedYield(planting(perSquare.id, 64, { col: 0, row: 0, w: 2, h: 2 }), perSquare);
      expect(y.grams || y.count).toBe(perSquare.yield.amount * 4);
    }
  });
  it('adds up picks by weight and by count', () => {
    const h = [
      { id: 'a', plantId: 'tomato', date: '2027-07-01', grams: 500 },
      { id: 'b', plantId: 'tomato', date: '2027-07-02', grams: 250, count: 3 },
      { id: 'c', plantId: 'kale', date: '2027-07-02', grams: 100 },
    ];
    expect(pickedSoFar(h, (x) => x.plantId === 'tomato')).toEqual({ grams: 750, count: 3 });
  });
});
