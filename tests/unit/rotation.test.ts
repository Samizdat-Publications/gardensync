import { describe, expect, it } from 'vitest';
import type { Cells, Garden, Planting } from '../../src/domain/doc/schema';
import { rotationWarnings } from '../../src/domain/layout/rotation';
import { plantById } from '../../src/domain/plants/library';
import type { Plant } from '../../src/domain/plants/schema';

const custom: Record<string, Plant> = {
  // A plant of family Other, which never warns.
  mystery: { ...plantById('lettuce')!, id: 'mystery', name: 'Mystery green', family: 'Other' },
};
const plantOf = (id: string) => plantById(id) ?? custom[id];

function planting(id: string, plantId: string, season: number, cells: Cells, containerId = 'bed1'): Planting {
  return {
    id,
    containerId,
    plantId,
    cells,
    count: 1,
    method: 'transplant',
    anchor: { kind: 'auto', window: 'spring', season, offsetDays: 0 },
  };
}

const seasonOf = (p: Planting) => (p.anchor.kind === 'auto' ? p.anchor.season : null);

function garden(plantings: Planting[]): Garden {
  return {
    id: 'g1',
    name: 'Home',
    createdAt: '2026-01-01',
    cellCm: 30.48,
    climate: null,
    containers: [
      { id: 'bed1', form: 'grid', kind: 'raised-bed', name: 'Bed 1', x: 0, y: 0, cols: 4, rows: 8, rotation: 0 },
      { id: 'bed2', form: 'grid', kind: 'raised-bed', name: 'Bed 2', x: 200, y: 0, cols: 4, rows: 8, rotation: 0 },
      { id: 'pot', form: 'vessel', kind: 'pot', name: 'Pot', x: 0, y: 300, diameterCm: 40, litres: 40 },
    ],
    plantings,
    series: [],
    harvests: [],
    journal: [],
    customPlants: [],
    taskState: {},
  };
}

const A: Cells = { col: 0, row: 0, w: 2, h: 2 };
const B: Cells = { col: 2, row: 0, w: 2, h: 2 };

describe('rotationWarnings', () => {
  it('warns when the same family grew in the same squares last season', () => {
    const out = rotationWarnings(
      garden([planting('pot26', 'potato', 2026, A), planting('tom27', 'tomato', 2027, { col: 1, row: 1, w: 1, h: 1 })]),
      plantOf,
      seasonOf,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.planting.id).toBe('tom27');
    expect(out[0]!.earlier.id).toBe('pot26');
    expect(out[0]!.family).toBe('Solanaceae');
    expect(out[0]!.seasonsAgo).toBe(1);
    expect(out[0]!.reason).toBe(
      'Tomato is in the tomato family (Solanaceae), like the Potato that grew in these squares last season. ' +
        'Waiting three seasons before the family comes back helps keep soil pests and diseases down.',
    );
  });

  it('warns for two seasons ago but not three', () => {
    const two = rotationWarnings(garden([planting('k', 'kale', 2025, A), planting('c', 'cabbage', 2027, A)]), plantOf, seasonOf);
    expect(two.map((w) => w.seasonsAgo)).toEqual([2]);
    expect(two[0]!.reason).toContain('two seasons ago');
    const three = rotationWarnings(garden([planting('k', 'kale', 2024, A), planting('c', 'cabbage', 2027, A)]), plantOf, seasonOf);
    expect(three).toEqual([]);
  });

  it('names a repeat of the same plant plainly', () => {
    const out = rotationWarnings(garden([planting('t1', 'tomato', 2026, A), planting('t2', 'tomato', 2027, A)]), plantOf, seasonOf);
    expect(out[0]!.reason).toMatch(/^Tomato grew in these squares last season\./);
  });

  it('does not warn for other squares, other beds, other families, the same season or vessels', () => {
    const plantings = [
      planting('pot26', 'potato', 2026, A),
      planting('tomB', 'tomato', 2027, B), // other squares
      planting('tomBed2', 'tomato', 2027, A, 'bed2'), // other bed
      planting('bean', 'bush-bean', 2027, A), // other family
      planting('pep26', 'pepper', 2026, A), // same season as the potato
      { ...planting('potPot', 'tomato', 2027, A, 'pot'), cells: undefined } as Planting,
      { ...planting('potPot0', 'potato', 2026, A, 'pot'), cells: undefined } as Planting,
    ];
    expect(rotationWarnings(garden(plantings), plantOf, seasonOf)).toEqual([]);
  });

  it('never warns for family Other', () => {
    const out = rotationWarnings(garden([planting('m1', 'mystery', 2026, A), planting('m2', 'mystery', 2027, A)]), plantOf, seasonOf);
    expect(out).toEqual([]);
  });

  it('skips plantings without a season', () => {
    const out = rotationWarnings(garden([planting('pot26', 'potato', 2026, A), planting('tom27', 'tomato', 2027, A)]), plantOf, () => null);
    expect(out).toEqual([]);
  });
});
