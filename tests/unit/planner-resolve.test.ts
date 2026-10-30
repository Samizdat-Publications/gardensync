import { describe, expect, it } from 'vitest';
import { manualProfile } from '../../src/domain/climate/manual';
import { toDay } from '../../src/domain/dates';
import { applyOp } from '../../src/domain/doc/ops';
import { emptyDoc, type Garden, type GridBed } from '../../src/domain/doc/schema';
import { starterOps } from '../../src/domain/doc/starters';
import { plantById } from '../../src/domain/plants/library';
import { conflictsFor } from '../../src/domain/layout/occupancy';
import { makeIntervalOf } from '../../src/ui/planner/placement';
import { propose, resolutions, type DropRequest } from '../../src/ui/planner/resolve';

const climate = manualProfile({ lastFrost: '04-20', firstFrost: '10-15', asOf: '2026-10-30' });
const plantOf = (id: string) => plantById(id);

/** The starter bed made on Oct 30, the way a gardener starting in the fall gets it: every square planned for next season. */
function fallStarter(extraBed = false): Garden {
  let n = 0;
  const ops = starterOps({ kind: 'first-bed', gardenId: 'g', name: 'G', today: '2026-10-30', units: 'imperial', climate, newId: () => `i${n++}` });
  if (extraBed) ops.push({ type: 'addContainer', gardenId: 'g', container: { id: 'bed2', form: 'grid', kind: 'raised-bed', name: 'Bed 2', x: 400, y: 0, cols: 4, rows: 4, rotation: 0 } });
  const res = applyOp(emptyDoc(), { type: 'batch', ops });
  if (!res.ok) throw new Error(res.error);
  return res.doc.gardens[0]!;
}

const bed1 = (g: Garden) => g.containers.find((c): c is GridBed => c.form === 'grid' && c.name === 'Bed 1')!;

function req(g: Garden, plantId: string, col: number, row: number, w = 1, h = 1): DropRequest {
  return { plant: plantById(plantId)!, method: 'direct', bed: bed1(g), cells: { col, row, w, h }, from: toDay('2026-10-30') };
}

describe('dropping a plant on squares', () => {
  it('plants at the usual count when the squares are free', () => {
    const g = fallStarter();
    const empty: Garden = { ...g, plantings: [] };
    const p = propose(req(empty, 'lettuce', 0, 1), empty, plantOf);
    expect(p.problem).toBeNull();
    expect(p.clashes).toEqual([]);
    expect(p.planting).toMatchObject({ plantId: 'lettuce', count: 4, cells: { col: 0, row: 1, w: 1, h: 1 } });
  });

  it('finds the clash a gardener starting in the fall could not see: next season is already planned there', () => {
    const g = fallStarter();
    const p = propose(req(g, 'lettuce', 0, 1), g, plantOf);
    expect(p.clashes.map((c) => c.with.plantId)).toContain('lettuce');
  });

  it('says why it cannot go in when the squares are too few or off the bed', () => {
    const g = fallStarter();
    expect(propose(req(g, 'lettuce', 7, 3, 2, 1), g, plantOf).problem).toMatch(/runs off/);
  });
});

describe('the ways out of a clash', () => {
  it('offers to plant after the crop that is there, with dates that clash with nothing', () => {
    const g = fallStarter();
    const r = req(g, 'radish', 1, 3); // radishes are planned in B4 for spring
    const p = propose(r, g, plantOf);
    expect(p.clashes.length).toBeGreaterThan(0);
    const out = resolutions(r, p, g, plantOf);
    expect(out.replace.map((x) => x.plantId)).toContain('radish');
    if (out.after) {
      const again = propose({ ...r, from: out.after.bedIn }, g, plantOf);
      expect(again.planting?.anchor).toBeDefined();
      expect(out.after.afterNames).toContain('Radish');
    }
  });

  it('offers room only where nothing clashes', () => {
    const g = fallStarter(true);
    const r = req(g, 'lettuce', 0, 1);
    const out = resolutions(r, propose(r, g, plantOf), g, plantOf);
    expect(out.room).not.toBeNull();
    const at = out.room!.planting.cells!;
    const again = propose({ ...r, bed: out.room!.bed, cells: at }, g, plantOf);
    expect(again.clashes).toEqual([]);
  });

  it('looks in another bed when this one is full for those dates', () => {
    const g = fallStarter(true);
    const lettuce = g.plantings.find((p) => p.plantId === 'lettuce')!;
    // One lettuce patch over the whole of Bed 1, on the same dates the drop would get.
    const full: Garden = { ...g, plantings: [{ ...lettuce, id: 'full', cells: { col: 0, row: 0, w: 8, h: 4 } }] };
    const r = req(full, 'lettuce', 0, 1);
    const p = propose(r, full, plantOf);
    expect(p.clashes.length).toBeGreaterThan(0);
    expect(resolutions(r, p, full, plantOf).room?.bed.id).toBe('bed2');
  });

  it('finds the nearest free squares in the same bed first', () => {
    const g = fallStarter();
    // Free the whole of row 4 except where the drop lands, so the nearest room is in that row.
    const keep = g.plantings.filter((p) => !(p.cells && p.cells.row === 3));
    const g2: Garden = { ...g, plantings: [...keep, { id: 'x', containerId: bed1(g).id, plantId: 'carrot', cells: { col: 0, row: 3, w: 1, h: 1 }, count: 16, method: 'direct', anchor: g.plantings[0]!.anchor.kind === 'auto' ? { ...g.plantings.find((p) => p.plantId === 'carrot')!.anchor } : g.plantings[0]!.anchor }] };
    const r = req(g2, 'carrot', 0, 3);
    const p = propose(r, g2, plantOf);
    expect(p.clashes.length).toBeGreaterThan(0);
    const out = resolutions(r, p, g2, plantOf);
    expect(out.room?.bed.id).toBe(bed1(g2).id);
    expect(out.room?.planting.cells?.row).toBe(3);
    expect(out.room?.planting.cells?.col).toBe(1);
  });
});

describe('find room only offers empty squares', () => {
  for (const [plantId, method, col, row] of [['basil', 'transplant', 0, 0], ['garlic', 'plant', 1, 3], ['lettuce', 'direct', 2, 1]] as const) {
    it(`${plantId}: the offered squares hold nothing at all while it would grow`, () => {
      const g = fallStarter();
      const r = { ...req(g, plantId, col, row), method };
      const p = propose(r, g, plantOf);
      const out = resolutions(r, p, g, plantOf);
      if (!out.room) return;
      const iof = makeIntervalOf(climate, plantOf);
      const overlaps = conflictsFor({ ...out.room.planting, id: 'probe' }, g.plantings, iof, plantOf);
      expect(overlaps.map((c) => c.with.plantId)).toEqual([]);
    });
  }
});
