import { describe, expect, it } from 'vitest';
import { applyOp } from '../../src/domain/doc/ops';
import { PLANTS } from '../../src/domain/plants/library';
import { emptyDoc, type GardenDoc } from '../../src/domain/doc/schema';
import { TOOL_DEFS, isEditing, runTool, type ToolContext } from '../../src/ui/assistant/tools';
import { profileOf } from './schedule-helpers';

function setup(): ToolContext {
  let n = 0;
  const doc: GardenDoc = {
    ...emptyDoc(),
    gardens: [
      {
        id: 'g1',
        name: 'Back yard',
        createdAt: '2027-01-10',
        cellCm: 30.48,
        climate: profileOf('canton-oh'),
        containers: [{ id: 'bed1', form: 'grid', kind: 'raised-bed', name: 'Bed 1', x: 0, y: 0, cols: 4, rows: 4, rotation: 0 }],
        plantings: [],
        series: [],
        harvests: [],
        journal: [],
        customPlants: [],
        taskState: {},
      },
    ],
    settings: { units: 'imperial', theme: 'system', activeGardenId: 'g1' },
  };
  return { doc, gardenId: 'g1', today: '2027-02-15', units: 'imperial', newId: () => `id${++n}` };
}

/** Run a call and carry its draft forward, as the panel does. */
function step(ctx: ToolContext, name: string, input: unknown) {
  const r = runTool(name, input, ctx);
  if (r.change) ctx.doc = r.change.doc;
  return r;
}

describe('assistant tool definitions', () => {
  it('has a definition for every tool, with closed schemas', () => {
    for (const t of TOOL_DEFS) {
      expect(t.input_schema.type).toBe('object');
      expect((t.input_schema as { additionalProperties?: boolean }).additionalProperties).toBe(false);
    }
    expect(TOOL_DEFS.map((t) => t.name)).toContain('place_plant');
    expect(isEditing('place_plant')).toBe(true);
    expect(isEditing('get_garden')).toBe(false);
  });
});

describe('reading tools', () => {
  it('describes the garden with real ids', () => {
    const r = runTool('get_garden', {}, setup());
    expect(r.isError).toBe(false);
    expect(r.text).toContain('Bed 1 (id bed1)');
    expect(r.text).toContain('4 by 4 squares of 1 ft');
    expect(r.change).toBeUndefined();
  });

  it('finds plants by name', () => {
    const r = runTool('find_plants', { query: 'tomato' }, setup());
    expect(r.text).toMatch(/Tomato \(id tomato/);
  });

  it('gives a plant its next window in this climate', () => {
    const r = runTool('get_plant', { plant_id: 'tomato' }, setup());
    expect(r.text).toContain('Next window from today');
  });
});

describe('editing tools queue changes on a draft only', () => {
  it('places a plant in the first free squares and leaves the real document alone', () => {
    const ctx = setup();
    const before = ctx.doc;
    const r = step(ctx, 'place_plant', { container_id: 'bed1', plant_id: 'carrot' });
    expect(r.isError).toBe(false);
    expect(r.change!.op.type).toBe('addPlanting');
    expect(before.gardens[0]!.plantings).toHaveLength(0);
    const p = ctx.doc.gardens[0]!.plantings[0]!;
    expect(p.cells).toEqual({ col: 0, row: 0, w: 1, h: 1 });
    expect(p.count).toBe(16);
    expect(p.anchor.kind).toBe('auto');

    // The next one skips the taken square.
    step(ctx, 'place_plant', { container_id: 'bed1', plant_id: 'carrot' });
    expect(ctx.doc.gardens[0]!.plantings[1]!.cells).toEqual({ col: 1, row: 0, w: 1, h: 1 });
  });

  it('refuses squares already in use at the same time', () => {
    const ctx = setup();
    step(ctx, 'place_plant', { container_id: 'bed1', plant_id: 'carrot', col: 0, row: 0, width: 2, height: 2 });
    const r = step(ctx, 'place_plant', { container_id: 'bed1', plant_id: 'beet', col: 1, row: 1 });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/taken/);
  });

  it('refuses a patch that runs off the bed', () => {
    const r = runTool('place_plant', { container_id: 'bed1', plant_id: 'carrot', col: 3, row: 0, width: 2 }, setup());
    expect(r.isError).toBe(true);
  });

  it('lets a later call build on a bed added earlier in the turn, and the queued ops replay as one batch', () => {
    const ctx = setup();
    const start = ctx.doc;
    const bed = step(ctx, 'add_bed', { name: 'Salsa', kind: 'raised-bed', cols: 4, rows: 4 });
    const id = /id (id\d+)/.exec(bed.text)![1]!;
    const plant = step(ctx, 'place_plant', { container_id: id, plant_id: 'tomato' });
    expect(plant.isError).toBe(false);
    const res = applyOp(start, { type: 'batch', ops: [bed.change!.op, plant.change!.op] });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.doc).toEqual(ctx.doc);
    // The new bed sits to the right of the old one.
    const added = ctx.doc.gardens[0]!.containers[1]!;
    expect(added.x).toBeGreaterThan(4 * 30.48);
  });

  it('adds a seed-packet variety under its parent crop', () => {
    const ctx = setup();
    const r = step(ctx, 'add_custom_plant', { name: 'Cherokee Purple tomato', parent_id: 'tomato', category: 'vegetable', frost: 'tender', days_to_maturity: 80, maturity_from: 'transplant' });
    expect(r.isError).toBe(false);
    expect(ctx.doc.gardens[0]!.customPlants[0]).toMatchObject({ name: 'Cherokee Purple tomato', parent: 'tomato', maturity: { days: 80, from: 'transplant' } });
  });
});

describe('untrusted input', () => {
  it('rejects unknown tools, wrong types and extra junk without throwing', () => {
    const ctx = setup();
    expect(runTool('delete_everything', {}, ctx).isError).toBe(true);
    expect(runTool('add_bed', { name: 'X', kind: 'raised-bed', cols: 'lots', rows: 2 }, ctx).isError).toBe(true);
    expect(runTool('add_bed', { name: '', kind: 'raised-bed', cols: 2, rows: 2 }, ctx).isError).toBe(true);
    expect(runTool('place_plant', { container_id: '../../etc', plant_id: 'tomato' }, ctx).isError).toBe(true);
    expect(runTool('place_plant', { container_id: 'nope', plant_id: 'tomato' }, ctx).isError).toBe(true);
    expect(runTool('get_garden', null, ctx).isError).toBe(false);
  });

  it('rejects a method the plant does not support', () => {
    const r = runTool('place_plant', { container_id: 'bed1', plant_id: 'tomato', method: 'direct' }, setup());
    expect(r.isError).toBe(true);
  });
});

describe('limits from the security review', () => {
  it('ignores names inherited from Object, such as toString', () => {
    const r = runTool('toString', {}, setup());
    expect(r.isError).toBe(true);
  });

  it('keeps pinned dates near today', () => {
    const ctx = setup();
    expect(runTool('place_plant', { container_id: 'bed1', plant_id: 'carrot', date: '2999-05-01' }, ctx).isError).toBe(true);
    const ok = runTool('place_plant', { container_id: 'bed1', plant_id: 'carrot', date: '2027-05-01' }, ctx);
    expect(ok.isError).toBe(false);
    expect(ok.change!.summary).toContain('May 1');
  });

  it('refuses counts far beyond what the squares hold, and patches smaller than one plant', () => {
    const ctx = setup();
    expect(runTool('place_plant', { container_id: 'bed1', plant_id: 'carrot', count: 10000 }, ctx).isError).toBe(true);
    const big = PLANTS.find((p) => 'squares' in p.density && p.density.squares[0] > 1)!;
    expect(runTool('place_plant', { container_id: 'bed1', plant_id: big.id, width: 1, height: 1 }, ctx).isError).toBe(true);
  });

  it('marks removals so the preview can show them as such', () => {
    const ctx = setup();
    step(ctx, 'place_plant', { container_id: 'bed1', plant_id: 'carrot' });
    const id = ctx.doc.gardens[0]!.plantings[0]!.id;
    const r = runTool('remove_planting', { planting_id: id }, ctx);
    expect(r.change!.removes).toBe(true);
    expect(r.change!.summary).toContain('Bed 1 squares A1');
  });
});
