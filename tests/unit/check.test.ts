// Cross-reference checks (check.ts): what DocSchema cannot see, and how each caller uses them.
import { describe, expect, it } from 'vitest';
import { checkDoc, checkGarden, repairDoc } from '../../src/domain/doc/check';
import { applyOp } from '../../src/domain/doc/ops';
import { emptyDoc, type Garden, type GardenDoc, type Planting } from '../../src/domain/doc/schema';
import { decodeShare, encodeShare } from '../../src/domain/doc/share';

const anchor = { kind: 'auto', window: 'spring', season: 2027, offsetDays: 0 } as const;
const planting = (id: string, extra: Partial<Planting> = {}): Planting => ({
  id,
  containerId: 'bed1',
  plantId: 'kale',
  cells: { col: 0, row: 0, w: 1, h: 1 },
  count: 1,
  method: 'transplant',
  anchor,
  ...extra,
});

function garden(extra: Partial<Garden> = {}): Garden {
  return {
    id: 'g1',
    name: 'Home',
    createdAt: '2026-10-28',
    cellCm: 30.48,
    climate: null,
    containers: [
      { id: 'bed1', form: 'grid', kind: 'raised-bed', name: 'Bed 1', x: 0, y: 0, cols: 2, rows: 2, rotation: 0 },
      { id: 'pot1', form: 'vessel', kind: 'pot', name: 'Pot', x: 100, y: 0, diameterCm: 30, litres: 20 },
    ],
    plantings: [planting('p1')],
    series: [],
    harvests: [],
    journal: [],
    customPlants: [],
    taskState: {},
    ...extra,
  };
}

const docOf = (g: Garden): GardenDoc => ({ ...emptyDoc(), gardens: [g], settings: { units: 'imperial', theme: 'system', activeGardenId: g.id } });
const codes = (g: Garden) => checkGarden(g).map((p) => p.code);

describe('checkGarden', () => {
  it('passes a garden whose records fit together', () => {
    expect(checkGarden(garden())).toEqual([]);
    expect(checkDoc(docOf(garden()))).toEqual([]);
  });

  it('finds duplicate ids in every list', () => {
    const g = garden({
      plantings: [planting('p1'), planting('p1')],
      series: [{ id: 's', plantId: 'kale', everyDays: 14 }, { id: 's', plantId: 'kale', everyDays: 14 }],
      harvests: [{ id: 'h', plantId: 'kale', date: '2027-06-01' }, { id: 'h', plantId: 'kale', date: '2027-06-02' }],
      journal: [{ id: 'j', date: '2027-06-01', text: 'a' }, { id: 'j', date: '2027-06-01', text: 'b' }],
      customPlants: [
        { id: 'c', name: 'C', category: 'herb', frost: 'hardy', maturity: { days: 30, from: 'sow' } },
        { id: 'c', name: 'C2', category: 'herb', frost: 'hardy', maturity: { days: 30, from: 'sow' } },
      ],
    });
    g.containers.push({ ...g.containers[0]! });
    const dup = checkGarden(g).filter((p) => p.code === 'duplicate-id');
    expect(dup.map((p) => p.key.split('|')[3])).toEqual(['containers', 'plantings', 'series', 'harvests', 'journal', 'customPlants']);
    expect(checkDoc({ ...docOf(g), gardens: [garden(), garden()] }).filter((p) => p.code === 'duplicate-id' && p.gardenId === undefined)).toHaveLength(1);
  });

  it('finds plantings pointing nowhere, at the wrong squares or out of order', () => {
    expect(codes(garden({ plantings: [planting('p', { containerId: 'gone' })] }))).toEqual(['missing-container']);
    expect(codes(garden({ plantings: [planting('p', { plantId: 'triffid' })] }))).toEqual(['unknown-plant']);
    const noCells = planting('p');
    delete noCells.cells;
    expect(codes(garden({ plantings: [noCells] }))).toEqual(['cells-missing']);
    expect(codes(garden({ plantings: [planting('p', { cells: { col: 1, row: 1, w: 2, h: 1 } })] }))).toEqual(['cells-outside']);
    expect(codes(garden({ plantings: [planting('p', { containerId: 'pot1' })] }))).toEqual(['cells-on-vessel']);
    expect(codes(garden({ plantings: [planting('p', { anchor: { kind: 'pinned', bedIn: '2027-05-01', bedOut: '2027-05-01' } })] }))).toEqual([
      'bed-out-not-after-bed-in',
    ]);
    expect(codes(garden({ plantings: [planting('p', { seriesId: 'gone' })] }))).toEqual(['missing-series']);
  });

  it('finds series, harvests and journal entries pointing nowhere', () => {
    expect(codes(garden({ series: [{ id: 's', plantId: 'triffid', everyDays: 14 }] }))).toEqual(['series-unknown-plant']);
    expect(codes(garden({ harvests: [{ id: 'h', plantId: 'kale', plantingId: 'gone', date: '2027-06-01' }] }))).toEqual(['harvest-missing-planting']);
    expect(codes(garden({ journal: [{ id: 'j', date: '2027-06-01', text: 'x', containerId: 'gone' }] }))).toEqual(['journal-missing-container']);
  });

  it('finds custom plants that reuse a built-in id or loop through their parents', () => {
    const custom = (id: string, parent?: string) =>
      ({ id, name: id.toUpperCase(), category: 'herb', frost: 'hardy', maturity: { days: 30, from: 'sow' }, ...(parent ? { parent } : {}) }) as const;
    expect(codes(garden({ customPlants: [custom('kale')] }))).toEqual(['custom-shadows-built-in']);
    expect(codes(garden({ customPlants: [custom('a', 'b'), custom('b', 'a'), custom('c', 'a')] }))).toEqual(['parent-cycle', 'parent-cycle']);
  });

  it('finds an active garden that is not there', () => {
    const doc = { ...docOf(garden()), settings: { units: 'imperial', theme: 'system', activeGardenId: 'gone' } } as const;
    expect(checkDoc(doc).map((p) => p.code)).toEqual(['missing-active-garden']);
  });
});

describe('repairDoc', () => {
  it('fixes what it safely can and reports the rest', () => {
    const g = garden({
      plantings: [
        planting('keep'),
        planting('lost', { containerId: 'gone' }),
        planting('alien', { plantId: 'triffid' }),
        planting('pot', { containerId: 'pot1' }),
        planting('pinned', { anchor: { kind: 'pinned', bedIn: '2027-05-01', bedOut: '2027-04-01' } }),
        planting('series', { seriesId: 'gone' }),
        planting('outside', { cells: { col: 5, row: 0, w: 1, h: 1 } }),
      ],
      harvests: [{ id: 'h', plantId: 'kale', plantingId: 'lost', date: '2027-06-01' }],
      journal: [{ id: 'j', date: '2027-06-01', text: 'x', containerId: 'gone' }],
    });
    const doc = { ...docOf(g), settings: { units: 'imperial', theme: 'system', activeGardenId: 'gone' } } as const;
    const r = repairDoc(doc);
    const out = r.doc.gardens[0]!;
    expect(out.plantings.map((p) => p.id)).toEqual(['keep', 'pot', 'pinned', 'series', 'outside']);
    expect(out.plantings.find((p) => p.id === 'pot')?.cells).toBeUndefined();
    expect(out.plantings.find((p) => p.id === 'pinned')?.anchor).toEqual({ kind: 'pinned', bedIn: '2027-05-01' });
    expect(out.plantings.find((p) => p.id === 'series')?.seriesId).toBeUndefined();
    expect(out.harvests[0]?.plantingId).toBeUndefined();
    expect(out.journal[0]?.containerId).toBeUndefined();
    expect(r.doc.settings.activeGardenId).toBe('g1');
    expect(r.remaining.map((p) => p.code)).toEqual(['cells-outside']);
    expect(r.fixed).toHaveLength(7);
    expect(doc.gardens[0]!.plantings).toHaveLength(7);
  });
});

describe('applyOp and the checks', () => {
  it('leaves no problems behind after ordinary edits, and tolerates problems a document arrived with', () => {
    const arrived = docOf(garden({ plantings: [planting('p1'), planting('bad', { cells: { col: 5, row: 0, w: 1, h: 1 } })] }));
    expect(checkDoc(arrived).map((p) => p.code)).toEqual(['cells-outside']);
    const res = applyOp(arrived, { type: 'renameGarden', gardenId: 'g1', name: 'Allotment' });
    expect(res.ok).toBe(true);
  });
});

describe('decodeShare and the checks', () => {
  it('refuses a plan whose records do not fit together', async () => {
    const twoSame = garden({ plantings: [planting('p1'), planting('p1')] });
    expect(await decodeShare(await encodeShare(twoSame, { includeLocation: false }))).toEqual({
      error: 'This share link holds a plan that does not fit together: Two plantings in "Home" share the id "p1".',
    });
    const outside = garden({ plantings: [planting('p1', { cells: { col: 5, row: 5, w: 1, h: 1 } })] });
    expect(await decodeShare(await encodeShare(outside, { includeLocation: false }))).toMatchObject({ error: expect.stringContaining('past the edge of Bed 1') });
  });
});
