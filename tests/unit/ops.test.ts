import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { manualProfile } from '../../src/domain/climate/manual';
import { applyOp, type Op } from '../../src/domain/doc/ops';
import { DocSchema, emptyDoc, type GardenDoc, type GridBed, type Planting, type Vessel } from '../../src/domain/doc/schema';

/** Apply an op that must succeed, and check the result still passes DocSchema. */
function ok(doc: GardenDoc, op: Op): GardenDoc {
  const res = applyOp(doc, op);
  if (!res.ok) throw new Error(`expected ${op.type} to succeed: ${res.error}`);
  const check = v.safeParse(DocSchema, res.doc);
  if (!check.success) throw new Error(`${op.type} left an invalid doc: ${v.getDotPath(check.issues[0])}: ${check.issues[0].message}`);
  return res.doc;
}

/** Apply an op that must fail, and return its error. The document must be untouched. */
function err(doc: GardenDoc, op: Op): string {
  const before = JSON.stringify(doc);
  const res = applyOp(doc, op);
  if (res.ok) throw new Error(`expected ${op.type} to fail`);
  expect(JSON.stringify(doc)).toBe(before);
  expect(res.error).not.toMatch(/—/);
  expect(res.error).toMatch(/[.]$/);
  return res.error;
}

const G = 'g1';
const bed: GridBed = { id: 'bed1', form: 'grid', kind: 'raised-bed', name: 'Bed 1', x: 0, y: 0, cols: 4, rows: 8, rotation: 0 };
const pot: Vessel = { id: 'pot1', form: 'vessel', kind: 'pot', name: 'Blue pot', x: 300, y: 0, diameterCm: 30, litres: 20 };

function planting(id: string, plantId: string, extra: Partial<Planting> = {}): Planting {
  return {
    id,
    containerId: 'bed1',
    plantId,
    cells: { col: 0, row: 0, w: 2, h: 2 },
    count: 4,
    method: 'transplant',
    anchor: { kind: 'auto', window: 'spring', season: 2027, offsetDays: 0 },
    ...extra,
  };
}

/** A garden with one 4 x 8 bed, a pot, and a carrot patch in rows 6 and 7 of the bed. */
function base(): GardenDoc {
  let doc = emptyDoc();
  doc = ok(doc, { type: 'addGarden', garden: { id: G, name: 'Home', createdAt: '2026-10-28', cellCm: 30.48 } });
  doc = ok(doc, { type: 'addContainer', gardenId: G, container: bed });
  doc = ok(doc, { type: 'addContainer', gardenId: G, container: pot });
  doc = ok(doc, { type: 'addPlanting', gardenId: G, planting: planting('carrots', 'carrot', { cells: { col: 0, row: 6, w: 4, h: 2 }, count: 128, method: 'direct' }) });
  return doc;
}

const garden = (doc: GardenDoc) => doc.gardens.find((g) => g.id === G)!;

describe('gardens and settings', () => {
  it('adds a garden and makes it active', () => {
    const doc = base();
    expect(doc.gardens).toHaveLength(1);
    expect(doc.settings.activeGardenId).toBe(G);
    expect(garden(doc).climate).toBeNull();
  });

  it('trims names and rejects empty or long ones', () => {
    const doc = ok(base(), { type: 'renameGarden', gardenId: G, name: '  Back yard  ' });
    expect(garden(doc).name).toBe('Back yard');
    expect(err(doc, { type: 'renameGarden', gardenId: G, name: '   ' })).toBe('Give the garden a name.');
    expect(err(doc, { type: 'renameGarden', gardenId: G, name: 'x'.repeat(81) })).toBe("Keep the garden's name to 80 characters or fewer.");
    expect(err(doc, { type: 'renameGarden', gardenId: 'nope', name: 'Plot' })).toBe('That garden no longer exists.');
  });

  it('removes a garden and moves the active one on', () => {
    let doc = ok(base(), { type: 'addGarden', garden: { id: 'g2', name: 'Allotment', createdAt: '2026-10-28', cellCm: 30 } });
    expect(doc.settings.activeGardenId).toBe(G);
    doc = ok(doc, { type: 'setActiveGarden', gardenId: 'g2' });
    doc = ok(doc, { type: 'removeGarden', gardenId: 'g2' });
    expect(doc.settings.activeGardenId).toBe(G);
    doc = ok(doc, { type: 'removeGarden', gardenId: G });
    expect(doc.settings.activeGardenId).toBeNull();
    expect(err(doc, { type: 'setActiveGarden', gardenId: G })).toBe('That garden no longer exists.');
  });

  it('updates settings', () => {
    const doc = ok(base(), { type: 'updateSettings', patch: { units: 'metric', theme: 'dark', lastExportAt: '2026-10-28' } });
    expect(doc.settings).toEqual({ units: 'metric', theme: 'dark', activeGardenId: G, lastExportAt: '2026-10-28' });
    expect(err(doc, { type: 'updateSettings', patch: { lastExportAt: '2026-13-01' } })).toBe('The export date is not a calendar date.');
  });

  it('sets and clears the climate', () => {
    const climate = manualProfile({ lastFrost: '04-20', firstFrost: '10-15', asOf: '2026-10-28' });
    let doc = ok(base(), { type: 'setClimate', gardenId: G, climate });
    expect(garden(doc).climate?.lastFrost.p50).toBe('04-20');
    doc = ok(doc, { type: 'setClimate', gardenId: G, climate: null });
    expect(garden(doc).climate).toBeNull();
  });

  it('never changes the document it was given', () => {
    const doc = base();
    const before = JSON.stringify(doc);
    ok(doc, { type: 'renameGarden', gardenId: G, name: 'Other' });
    expect(JSON.stringify(doc)).toBe(before);
  });
});

describe('containers', () => {
  it('moves, renames and rotates a bed', () => {
    const doc = ok(base(), { type: 'updateContainer', gardenId: G, containerId: 'bed1', patch: { x: 50, y: 60, name: 'North bed', rotation: 90 } });
    expect(garden(doc).containers[0]).toMatchObject({ x: 50, y: 60, name: 'North bed', rotation: 90, cols: 4, rows: 8 });
  });

  it('resizes a bed when every planting still fits', () => {
    const doc = ok(base(), { type: 'updateContainer', gardenId: G, containerId: 'bed1', patch: { cols: 6, rows: 8 } });
    expect(garden(doc).containers[0]).toMatchObject({ cols: 6, rows: 8 });
  });

  it('rejects a resize that would leave a planting outside the bed', () => {
    expect(err(base(), { type: 'updateContainer', gardenId: G, containerId: 'bed1', patch: { rows: 6 } })).toBe(
      'Making Bed 1 that size would leave the Carrot outside it. Move or remove that planting first.',
    );
  });

  it('rejects sizes that make no sense', () => {
    const doc = base();
    expect(err(doc, { type: 'updateContainer', gardenId: G, containerId: 'bed1', patch: { cols: 0 } })).toBe('A bed can be 1 to 60 squares along each side.');
    expect(err(doc, { type: 'updateContainer', gardenId: G, containerId: 'bed1', patch: { cols: 2.5 } })).toBe('A bed can be 1 to 60 squares along each side.');
    expect(err(doc, { type: 'updateContainer', gardenId: G, containerId: 'bed1', patch: { litres: 40 } })).toBe(
      'Bed 1 is a bed measured in squares, not a container measured by volume.',
    );
    expect(err(doc, { type: 'updateContainer', gardenId: G, containerId: 'pot1', patch: { rows: 2 } })).toBe(
      'Blue pot is measured by volume and has no squares to resize.',
    );
    expect(err(doc, { type: 'updateContainer', gardenId: G, containerId: 'pot1', patch: { litres: 0 } })).toBe(
      'That soil volume is outside what a container can hold.',
    );
    expect(err(doc, { type: 'updateContainer', gardenId: G, containerId: 'pot1', patch: { name: '' } })).toBe('Give the container a name.');
  });

  it('rejects a duplicate id', () => {
    expect(err(base(), { type: 'addContainer', gardenId: G, container: { ...pot } })).toBe('Something with that id is already in this garden.');
  });

  it('removes a container with its plantings, keeping history', () => {
    let doc = ok(base(), { type: 'logHarvest', gardenId: G, harvest: { id: 'h1', plantId: 'carrot', plantingId: 'carrots', date: '2027-07-01', grams: 900 } });
    doc = ok(doc, { type: 'addJournal', gardenId: G, entry: { id: 'j1', date: '2027-07-01', text: 'Pulled the first carrots.', containerId: 'bed1' } });
    doc = ok(doc, { type: 'addPlanting', gardenId: G, planting: planting('tom', 'tomato', { containerId: 'pot1', cells: undefined, count: 1 }) });
    doc = ok(doc, { type: 'removeContainer', gardenId: G, containerId: 'bed1' });
    const g = garden(doc);
    expect(g.containers.map((c) => c.id)).toEqual(['pot1']);
    expect(g.plantings.map((p) => p.id)).toEqual(['tom']);
    expect(g.harvests).toEqual([{ id: 'h1', plantId: 'carrot', date: '2027-07-01', grams: 900 }]);
    expect(g.journal[0]).toEqual({ id: 'j1', date: '2027-07-01', text: 'Pulled the first carrots.' });
  });
});

describe('plantings', () => {
  it('adds a planting and does not block overlaps', () => {
    let doc = ok(base(), { type: 'addPlanting', gardenId: G, planting: planting('tom', 'tomato', { count: 4 }) });
    doc = ok(doc, { type: 'addPlanting', gardenId: G, planting: planting('let', 'lettuce', { count: 16 }) });
    expect(garden(doc).plantings.map((p) => p.id)).toEqual(['carrots', 'tom', 'let']);
  });

  it('checks the container, the plant, the squares and the count', () => {
    const doc = base();
    const add = (p: Planting): Op => ({ type: 'addPlanting', gardenId: G, planting: p });
    expect(err(doc, add(planting('x', 'tomato', { containerId: 'nope' })))).toBe('That bed or container no longer exists.');
    expect(err(doc, add(planting('x', 'triffid')))).toBe('GardenSync does not know that plant.');
    expect(err(doc, add(planting('x', 'tomato', { cells: { col: 3, row: 0, w: 2, h: 1 } })))).toBe('The Tomato would stick out past the edge of Bed 1.');
    expect(err(doc, add(planting('x', 'tomato', { cells: undefined })))).toBe('Choose the squares for the Tomato.');
    expect(err(doc, add(planting('x', 'tomato', { containerId: 'pot1' })))).toBe('Plants in Blue pot do not take squares; give a count instead.');
    expect(err(doc, add(planting('x', 'tomato', { count: 0 })))).toBe('A planting needs at least one plant.');
    expect(err(doc, add(planting('x', 'tomato', { count: 1.5 })))).toBe('Use a whole number of plants.');
    expect(err(doc, add(planting('x', 'tomato', { seriesId: 'gone' })))).toBe('That succession series no longer exists.');
    expect(err(doc, add(planting('x', 'tomato', { anchor: { kind: 'pinned', bedIn: '2027-05-20', bedOut: '2027-05-01' } })))).toBe(
      'The Tomato has to come out after it goes in.',
    );
    expect(err(doc, add(planting('carrots', 'tomato')))).toBe('Something with that id is already in this garden.');
  });

  it('updates a planting, moving it to a pot', () => {
    let doc = ok(base(), { type: 'updatePlanting', gardenId: G, plantingId: 'carrots', patch: { count: 100, notes: 'Thin later.' } });
    expect(garden(doc).plantings[0]).toMatchObject({ count: 100, notes: 'Thin later.' });
    doc = ok(doc, { type: 'updatePlanting', gardenId: G, plantingId: 'carrots', patch: { containerId: 'pot1', cells: undefined, count: 15 } });
    const p = garden(doc).plantings[0]!;
    expect(p.containerId).toBe('pot1');
    expect('cells' in p).toBe(false);
    expect(err(doc, { type: 'updatePlanting', gardenId: G, plantingId: 'carrots', patch: { count: -1 } })).toBe('A planting needs at least one plant.');
  });

  it('removes a planting and unhooks its harvests', () => {
    let doc = ok(base(), { type: 'logHarvest', gardenId: G, harvest: { id: 'h1', plantId: 'carrot', plantingId: 'carrots', date: '2027-07-01', count: 20 } });
    doc = ok(doc, { type: 'removePlanting', gardenId: G, plantingId: 'carrots' });
    expect(garden(doc).plantings).toEqual([]);
    expect(garden(doc).harvests[0]!.plantingId).toBeUndefined();
    expect(err(doc, { type: 'removePlanting', gardenId: G, plantingId: 'carrots' })).toBe('That planting no longer exists.');
  });
});

describe('harvests, journal and tasks', () => {
  it('logs, edits and removes harvests', () => {
    let doc = ok(base(), { type: 'logHarvest', gardenId: G, harvest: { id: 'h1', plantId: 'carrot', date: '2027-07-01', grams: 1020 } });
    doc = ok(doc, { type: 'updateHarvest', gardenId: G, harvestId: 'h1', patch: { grams: 1100, note: 'Sweet.' } });
    expect(garden(doc).harvests[0]).toEqual({ id: 'h1', plantId: 'carrot', date: '2027-07-01', grams: 1100, note: 'Sweet.' });
    expect(err(doc, { type: 'updateHarvest', gardenId: G, harvestId: 'h1', patch: { grams: undefined } })).toBe('Record a weight or a count for the harvest.');
    expect(err(doc, { type: 'updateHarvest', gardenId: G, harvestId: 'h1', patch: { date: 'yesterday' } })).toBe('The harvest date is not a calendar date.');
    expect(err(doc, { type: 'logHarvest', gardenId: G, harvest: { id: 'h2', plantId: 'tomato', plantingId: 'carrots', date: '2027-07-01', count: 1 } })).toBe(
      'That harvest is for a different plant than its planting.',
    );
    doc = ok(doc, { type: 'removeHarvest', gardenId: G, harvestId: 'h1' });
    expect(garden(doc).harvests).toEqual([]);
  });

  it('adds and removes journal entries', () => {
    let doc = ok(base(), { type: 'addJournal', gardenId: G, entry: { id: 'j1', date: '2027-04-02', text: 'First sowing.' } });
    expect(err(doc, { type: 'addJournal', gardenId: G, entry: { id: 'j2', date: '2027-04-02', text: '  ' } })).toBe('Write something for the journal entry.');
    expect(err(doc, { type: 'addJournal', gardenId: G, entry: { id: 'j2', date: '2027-04-02', text: 'x'.repeat(2001) } })).toBe(
      'Keep the journal entry to 2000 characters or fewer.',
    );
    doc = ok(doc, { type: 'removeJournal', gardenId: G, entryId: 'j1' });
    expect(garden(doc).journal).toEqual([]);
  });

  it('ticks and unticks tasks', () => {
    let doc = ok(base(), { type: 'setTaskDone', gardenId: G, taskId: 'sow:carrots:0', date: '2027-04-02' });
    expect(garden(doc).taskState).toEqual({ 'sow:carrots:0': '2027-04-02' });
    doc = ok(doc, { type: 'clearTaskDone', gardenId: G, taskId: 'sow:carrots:0' });
    expect(garden(doc).taskState).toEqual({});
  });
});

describe('custom plants and series', () => {
  const sungold = { id: 'sungold', name: 'Sungold', parent: 'tomato', category: 'vegetable', frost: 'tender', maturity: { days: 57, from: 'transplant' } } as const;

  it('adds a custom plant that plantings can use', () => {
    let doc = ok(base(), { type: 'addCustomPlant', gardenId: G, plant: sungold });
    doc = ok(doc, { type: 'addPlanting', gardenId: G, planting: planting('sg', 'sungold', { count: 1 }) });
    expect(err(doc, { type: 'removeCustomPlant', gardenId: G, plantId: 'sungold' })).toBe('Sungold is in a planting. Remove it first.');
    doc = ok(doc, { type: 'removePlanting', gardenId: G, plantingId: 'sg' });
    doc = ok(doc, { type: 'removeCustomPlant', gardenId: G, plantId: 'sungold' });
    expect(garden(doc).customPlants).toEqual([]);
  });

  it('rejects bad custom plants', () => {
    const doc = ok(base(), { type: 'addCustomPlant', gardenId: G, plant: sungold });
    expect(err(doc, { type: 'addCustomPlant', gardenId: G, plant: { ...sungold, id: 'tomato' } })).toBe('A built-in plant already uses that id.');
    expect(err(doc, { type: 'addCustomPlant', gardenId: G, plant: { ...sungold } })).toBe('A plant with that id is already in this garden.');
    expect(err(doc, { type: 'addCustomPlant', gardenId: G, plant: { ...sungold, id: 'x', name: '' } })).toBe('Give the plant a name.');
    expect(err(doc, { type: 'addCustomPlant', gardenId: G, plant: { ...sungold, id: 'x', parent: 'gone' } })).toBe(
      'The plant this one is based on no longer exists.',
    );
    expect(err(doc, { type: 'addCustomPlant', gardenId: G, plant: { ...sungold, id: 'x', maturity: { days: 0, from: 'sow' } } })).toBe(
      'Days to maturity must be a whole number of at least 1.',
    );
  });

  it('updates a custom plant but refuses a loop of parents', () => {
    let doc = ok(base(), { type: 'addCustomPlant', gardenId: G, plant: sungold });
    doc = ok(doc, { type: 'addCustomPlant', gardenId: G, plant: { ...sungold, id: 'sungold-2', name: 'Sungold select', parent: 'sungold' } });
    doc = ok(doc, { type: 'updateCustomPlant', gardenId: G, plantId: 'sungold', patch: { name: 'Sun Gold', canopy: 'tall' } });
    expect(garden(doc).customPlants[0]).toMatchObject({ name: 'Sun Gold', canopy: 'tall' });
    expect(err(doc, { type: 'updateCustomPlant', gardenId: G, plantId: 'sungold', patch: { parent: 'sungold-2' } })).toBe(
      'Sun Gold cannot be based on Sungold select, because that plant is already based on Sun Gold.',
    );
    expect(err(doc, { type: 'updateCustomPlant', gardenId: G, plantId: 'sungold', patch: { parent: 'sungold' } })).toBe('Sun Gold cannot be based on itself.');
    expect(err(doc, { type: 'removeCustomPlant', gardenId: G, plantId: 'sungold' })).toBe('Other plants are based on Sun Gold. Change or remove them first.');
  });

  it('adds and removes a series, keeping its rounds as plantings', () => {
    let doc = ok(base(), { type: 'addSeries', gardenId: G, series: { id: 's1', plantId: 'lettuce', everyDays: 14 } });
    doc = ok(doc, { type: 'addPlanting', gardenId: G, planting: planting('l0', 'lettuce', { seriesId: 's1' }) });
    expect(err(doc, { type: 'addSeries', gardenId: G, series: { id: 's2', plantId: 'lettuce', everyDays: 2 } })).toBe('Sow again every 3 to 60 days.');
    doc = ok(doc, { type: 'removeSeries', gardenId: G, seriesId: 's1' });
    expect(garden(doc).series).toEqual([]);
    expect(garden(doc).plantings.find((p) => p.id === 'l0')!.seriesId).toBeUndefined();
  });
});

describe('batch', () => {
  it('applies every op in order', () => {
    const doc = ok(base(), {
      type: 'batch',
      ops: [
        { type: 'addContainer', gardenId: G, container: { ...bed, id: 'bed2', name: 'Bed 2', x: 200 } },
        { type: 'addPlanting', gardenId: G, planting: planting('t', 'tomato', { containerId: 'bed2' }) },
      ],
    });
    expect(garden(doc).plantings.map((p) => p.id)).toEqual(['carrots', 't']);
  });

  it('is all or nothing', () => {
    const doc = base();
    const error = err(doc, {
      type: 'batch',
      ops: [
        { type: 'renameGarden', gardenId: G, name: 'Changed' },
        { type: 'addContainer', gardenId: G, container: { ...bed, id: 'bed2', name: 'Bed 2' } },
        { type: 'addPlanting', gardenId: G, planting: planting('t', 'tomato', { containerId: 'bed3' }) },
      ],
    });
    expect(error).toBe('That bed or container no longer exists.');
    expect(garden(doc).name).toBe('Home');
    expect(garden(doc).containers).toHaveLength(2);
  });

  it('nests', () => {
    const doc = ok(base(), {
      type: 'batch',
      ops: [{ type: 'batch', ops: [{ type: 'renameGarden', gardenId: G, name: 'Nested' }] }],
    });
    expect(garden(doc).name).toBe('Nested');
  });
});

describe('patches change only what their op is for', () => {
  it('validates a new garden, id included', () => {
    expect(err(emptyDoc(), { type: 'addGarden', garden: { id: 'has space', name: 'Home', createdAt: '2026-10-28', cellCm: 30.48 } })).toBe(
      'Something in this garden is not usable (id).',
    );
    const weird = { id: 'g9', name: 'Home', createdAt: '2026-10-28', cellCm: 12 } as unknown as { id: string; name: string; createdAt: string; cellCm: 30 };
    expect(err(emptyDoc(), { type: 'addGarden', garden: weird })).toBe('Something in this garden is not usable (cellCm).');
  });

  it('refuses ids, forms and unknown fields in a patch', () => {
    const doc = base();
    const sneaky = <T,>(x: object) => x as T;
    expect(err(doc, { type: 'updateContainer', gardenId: G, containerId: 'bed1', patch: sneaky({ id: 'bed9' }) })).toBe(
      'That change to the bed touches something that cannot be changed this way (id).',
    );
    expect(err(doc, { type: 'updateContainer', gardenId: G, containerId: 'pot1', patch: sneaky({ form: 'grid' }) })).toMatch(/cannot be changed this way \(form\)/);
    expect(err(doc, { type: 'updatePlanting', gardenId: G, plantingId: 'carrots', patch: sneaky({ id: 'other' }) })).toMatch(/planting touches something/);
    expect(err(doc, { type: 'updateSettings', patch: sneaky({ activeGardenId: 'nowhere' }) })).toMatch(/settings touches something/);
    // A key that would reach the prototype if merged blindly.
    expect(err(doc, { type: 'updatePlanting', gardenId: G, plantingId: 'carrots', patch: JSON.parse('{"__proto__":{"polluted":true}}') })).toMatch(
      /cannot be changed this way\.$/,
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    let withHarvest = ok(doc, { type: 'logHarvest', gardenId: G, harvest: { id: 'h1', plantId: 'carrot', date: '2027-07-01', grams: 10 } });
    expect(err(withHarvest, { type: 'updateHarvest', gardenId: G, harvestId: 'h1', patch: sneaky({ id: 'h2' }) })).toMatch(/harvest touches something/);
    withHarvest = ok(withHarvest, { type: 'addCustomPlant', gardenId: G, plant: { id: 'sg', name: 'Sungold', parent: 'tomato', category: 'vegetable', frost: 'tender', maturity: { days: 57, from: 'transplant' } } });
    expect(err(withHarvest, { type: 'updateCustomPlant', gardenId: G, plantId: 'sg', patch: sneaky({ id: 'sg2' }) })).toMatch(/plant touches something/);
  });

  it('moves a planting to another container only where it fits', () => {
    const doc = base();
    expect(err(doc, { type: 'updatePlanting', gardenId: G, plantingId: 'carrots', patch: { containerId: 'nowhere' } })).toBe('That bed or container no longer exists.');
    expect(err(doc, { type: 'updatePlanting', gardenId: G, plantingId: 'carrots', patch: { containerId: 'pot1' } })).toBe(
      'Plants in Blue pot do not take squares; give a count instead.',
    );
    const moved = ok(doc, { type: 'updatePlanting', gardenId: G, plantingId: 'carrots', patch: { containerId: 'pot1', cells: undefined, count: 6 } });
    expect(garden(moved).plantings[0]).toMatchObject({ containerId: 'pot1', count: 6 });
    expect(garden(moved).plantings[0]?.cells).toBeUndefined();
  });
});

describe('plantings must be grown a way the plant supports, with dates in order', () => {
  it('refuses a method the plant has no block for', () => {
    const doc = base();
    expect(err(doc, { type: 'addPlanting', gardenId: G, planting: planting('t', 'tomato', { method: 'direct' }) })).toBe(
      'The Tomato is not sown straight into the ground. Choose another way to grow it.',
    );
    expect(err(doc, { type: 'addPlanting', gardenId: G, planting: planting('c', 'carrot', { method: 'indoor' }) })).toBe(
      'The Carrot is not started indoors. Choose another way to grow it.',
    );
    expect(err(doc, { type: 'addPlanting', gardenId: G, planting: planting('g', 'garlic', { method: 'bought' }) })).toBe(
      'The Garlic is not planted out as young plants. Choose another way to grow it.',
    );
    expect(err(doc, { type: 'addPlanting', gardenId: G, planting: planting('k', 'kale', { method: 'plant' }) })).toBe(
      'The Kale is not grown from sets, crowns or divisions. Choose another way to grow it.',
    );
    ok(doc, { type: 'addPlanting', gardenId: G, planting: planting('t', 'tomato', { method: 'bought' }) });
    ok(doc, { type: 'addPlanting', gardenId: G, planting: planting('t', 'tomato', { method: 'indoor' }) });
    expect(err(doc, { type: 'updatePlanting', gardenId: G, plantingId: 'carrots', patch: { method: 'transplant' } })).toMatch(/not planted out as young plants/);
  });

  it('refuses actual dates out of order', () => {
    const doc = base();
    const bad = (actual: Planting['actual']) => err(doc, { type: 'addPlanting', gardenId: G, planting: planting('t', 'tomato', { method: 'indoor', actual }) });
    expect(bad({ startedIndoors: '2027-05-01', bedIn: '2027-04-01' })).toBe(
      "The Tomato's dates are out of order: it is started indoors first, then goes in, then comes out.",
    );
    expect(bad({ bedIn: '2027-05-20', ended: '2027-05-01' })).toMatch(/out of order/);
    expect(bad({ startedIndoors: '2027-09-01', ended: '2027-08-01' })).toMatch(/out of order/);
    ok(doc, { type: 'addPlanting', gardenId: G, planting: planting('t', 'tomato', { method: 'indoor', actual: { startedIndoors: '2027-04-01', bedIn: '2027-05-20', ended: '2027-05-20' } }) });
  });

  it('refuses a change to a custom plant that strands its plantings', () => {
    let doc = ok(base(), {
      type: 'addCustomPlant',
      gardenId: G,
      plant: { id: 'sg', name: 'Sungold', parent: 'tomato', category: 'vegetable', frost: 'tender', maturity: { days: 57, from: 'transplant' } },
    });
    doc = ok(doc, { type: 'addPlanting', gardenId: G, planting: planting('sg1', 'sg', { count: 1, method: 'transplant' }) });
    expect(
      err(doc, { type: 'updateCustomPlant', gardenId: G, plantId: 'sg', patch: { methods: { direct: { weeks: [0, 2] } } } }),
    ).toBe('That change would leave the Sungold planting grown a way the plant does not support. Change that planting first.');
  });
});
