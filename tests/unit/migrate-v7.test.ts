// GardenSync 7.x import: localStorage, export files and #plan= share links.
//
// Fixtures in tests/fixtures/v7/ are the public 7.x demo gardens (from v7-final:js/constants.js),
// written in the two shapes the old app stored: the export file (exportAllData) and the
// localStorage keys as applyDemoData left them (containers re-flowed into a grid). Volunteer names,
// phone numbers and the town were scrubbed. max-storage.storage-v1.json is the first four beds of
// Max Storage in the old version 1 save format. Synthetic cases below cover what the demos lack
// (harvests, journal, planting log, custom seeds, varieties, unknown ids).
//
// tests/fixtures/local/ (gitignored, usually absent) may hold real 7.x exports or storage dumps;
// if it exists every file in it must migrate without error.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  decodeV7ShareHash,
  migrateV7Export,
  migrateV7Storage,
  vesselLitres,
  type MigrateOptions,
  type MigrationResult,
} from '../../src/domain/doc/migrate-v7';
import { GardenSchema, type Garden, type GridBed, type Vessel } from '../../src/domain/doc/schema';
import { plantById } from '../../src/domain/plants/library';

const FIXTURES = join(__dirname, '..', 'fixtures', 'v7');
const LOCAL = join(__dirname, '..', 'fixtures', 'local');
const TODAY = '2026-10-28';

/** A fresh, deterministic id sequence. */
function opts(prefix = 'id'): MigrateOptions {
  let n = 0;
  return { today: TODAY, newId: () => `${prefix}${++n}` };
}

function ok(r: MigrationResult) {
  if ('error' in r) throw new Error(`expected success, got: ${r.error}`);
  return r;
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, file), 'utf8')) as unknown;
}

type Obj = Record<string, unknown>;
/** Count old placements in a list of 7.x containers. */
const placementsIn = (containers: unknown[]) =>
  containers.reduce<number>((s, c) => s + ((c as Obj).plants as unknown[]).length, 0);
const patchTotal = (g: Garden) => g.plantings.reduce((s, p) => s + p.count, 0);

function deepFreeze<T>(x: T): T {
  if (typeof x === 'object' && x !== null) {
    Object.freeze(x);
    for (const val of Object.values(x)) deepFreeze(val);
  }
  return x;
}

/** btoa(UTF-8 JSON), exactly as 7.x generateShareURL built a #plan= link. */
function v7Hash(compact: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(compact));
  return '#plan=' + btoa(String.fromCharCode(...bytes));
}

/** A small 7.x export with one container of each kind of interest. */
function exportWith(containers: Obj[], extra: Obj = {}): Obj {
  return { version: 2, exportDate: '2026-06-01T12:00:00.000Z', app: 'GardenSync', state: { containers, volunteers: [] }, ...extra };
}

const bed = (id: string, plants: Obj[], more: Obj = {}): Obj => ({
  id,
  type: 'raised-bed',
  name: id.toUpperCase(),
  canvasX: 40,
  canvasY: 40,
  w: 4,
  h: 8,
  diameter: null,
  plants,
  notes: '',
  volunteer: null,
  ...more,
});
const at = (plantId: string, x = 0, y = 0): Obj => ({ id: `${plantId}-${x}-${y}`, plantId, x, y });

// ---- The demo fixtures --------------------------------------------------------------------------

const DEMOS = [
  'container-showcase',
  'three-sisters',
  'kitchen-herb-patio',
  'beginner-starter',
  'salsa-pizza',
  'full-research-plan',
  'easy-start',
  'max-storage',
];

describe('7.x demo fixtures', () => {
  for (const slug of DEMOS) {
    describe(slug, () => {
      const exportFile = readJson(`${slug}.export.json`) as Obj;
      const storage = readJson(`${slug}.storage.json`) as Record<string, string>;
      const oldContainers = (exportFile.state as Obj).containers as unknown[];
      const plantsIn = placementsIn(oldContainers);

      it('migrates the export file with every plant accounted for', () => {
        const { garden, report } = ok(migrateV7Export(exportFile, opts()));
        expect(v.safeParse(GardenSchema, garden).success).toBe(true);
        expect(report.containers).toBe(oldContainers.length);
        expect(garden.containers).toHaveLength(oldContainers.length);
        expect(report.plants).toBe(plantsIn);
        expect(patchTotal(garden)).toBe(plantsIn);
        expect(report.plantings).toBe(garden.plantings.length);
        expect(report.unknownPlantIds).toEqual([]);
        expect(garden.climate).toBeNull();
        expect(garden.cellCm).toBe(30.48);
      });

      it('migrates the stored state to the same plan', () => {
        const fromStorage = ok(migrateV7Storage(storage, opts()));
        const fromExport = ok(migrateV7Export(exportFile, opts()));
        expect(fromStorage.report.plants).toBe(plantsIn);
        expect(fromStorage.garden.plantings.map((p) => [p.plantId, p.count, p.cells])).toEqual(
          fromExport.garden.plantings.map((p) => [p.plantId, p.count, p.cells]),
        );
        expect(fromStorage.garden.legacy).toMatchObject({ source: 'gardensync-7-storage', harvestGoal: storage.gardensync_harvest_goal });
      });

      it('is idempotent and leaves the input alone', () => {
        const frozenExport = deepFreeze(structuredClone(exportFile));
        const frozenStorage = deepFreeze({ ...storage });
        expect(migrateV7Export(frozenExport, opts())).toEqual(migrateV7Export(frozenExport, opts()));
        expect(migrateV7Storage(frozenStorage, opts())).toEqual(migrateV7Storage(frozenStorage, opts()));
        expect(frozenExport).toEqual(exportFile);
      });

      it('puts every planting inside its container', () => {
        const { garden } = ok(migrateV7Export(exportFile, opts()));
        const byId = new Map(garden.containers.map((c) => [c.id, c]));
        for (const p of garden.plantings) {
          const c = byId.get(p.containerId);
          expect(c).toBeDefined();
          if (c?.form === 'grid') {
            expect(p.cells).toBeDefined();
            expect(p.cells!.col).toBeLessThan(c.cols);
            expect(p.cells!.row).toBeLessThan(c.rows);
          } else {
            expect(p.cells).toBeUndefined();
          }
          expect(plantById(p.plantId) ?? garden.customPlants.find((cp) => cp.id === p.plantId)).toBeDefined();
        }
      });
    });
  }

  it('keeps the crew of the showcase in legacy, scrubbed', () => {
    const { garden, report } = ok(migrateV7Export(readJson('container-showcase.export.json'), opts()));
    const legacy = garden.legacy as Obj;
    expect(legacy.volunteers).toHaveLength(3);
    expect(report.legacyKeys).toContain('volunteers');
    expect(JSON.stringify(legacy)).not.toMatch(/Canton|Ohio|555-/);
  });

  it('turns butternut squash into a winter squash variety', () => {
    const { garden, report } = ok(migrateV7Export(readJson('max-storage.export.json'), opts()));
    expect(report.customPlantsCreated).toBe(1);
    expect(garden.customPlants[0]).toMatchObject({ name: 'Butternut Squash', parent: 'winter-squash', maturity: { days: 110 } });
  });

  it('warns about beds whose plants were never arranged', () => {
    const { report } = ok(migrateV7Export(readJson('easy-start.export.json'), opts()));
    expect(report.warnings.some((w) => w.includes('never arranged'))).toBe(true);
  });

  it('reads the version 1 save format', () => {
    const storage = readJson('max-storage.storage-v1.json') as Record<string, string>;
    const names = JSON.parse(storage.gardensync_bed_names as string) as string[];
    const beds = (JSON.parse(storage.gardensync_state as string) as { beds: unknown[][] }).beds;
    const { garden, report } = ok(migrateV7Storage(storage, opts()));
    expect(garden.containers.map((c) => c.name)).toEqual(names);
    expect(report.plants).toBe(beds.reduce((s, b) => s + b.length, 0));
    expect(garden.containers[0]).toMatchObject({ form: 'grid', cols: 8, rows: 4 });
  });
});

// ---- Geometry -----------------------------------------------------------------------------------

describe('geometry', () => {
  it('lays rectangles out with the long side across, in whole feet', () => {
    const { garden } = ok(
      migrateV7Export(
        exportWith([
          bed('a', [], { w: 5, h: 10, canvasX: 80, canvasY: 120 }),
          { ...bed('b', []), type: 'window-box', w: 0.5, h: 3 },
          { ...bed('c', []), type: 'planter', w: 2.4, h: 1.6 },
        ]),
        opts(),
      ),
    );
    const [a, b, c] = garden.containers as GridBed[];
    expect(a).toMatchObject({ form: 'grid', kind: 'raised-bed', cols: 10, rows: 5, rotation: 0, x: 60.96, y: 91.44 });
    expect(b).toMatchObject({ kind: 'window-box', cols: 3, rows: 1 });
    expect(c).toMatchObject({ kind: 'planter', cols: 2, rows: 2 });
  });

  it('makes round containers vessels centred on the old circle', () => {
    const { garden } = ok(
      migrateV7Export(
        exportWith([
          { ...bed('pot', []), type: 'pot-round', diameter: 1.5, canvasX: 40, canvasY: 40 },
          { ...bed('bag', []), type: 'grow-bag', diameter: null },
          { ...bed('tower', []), type: 'potato-tower', diameter: 4 },
        ]),
        opts(),
      ),
    );
    const [pot, bag, tower] = garden.containers as Vessel[];
    expect(pot).toMatchObject({ form: 'vessel', kind: 'pot', diameterCm: 45.72, litres: 75, x: 53.34, y: 53.34 });
    expect(bag).toMatchObject({ kind: 'grow-bag', diameterCm: 45.72 });
    expect(tower).toMatchObject({ kind: 'tower', diameterCm: 121.92, litres: vesselLitres(121.92) });
    expect(tower?.litres).toBe(700);
  });

  it('merges placements by square and clamps strays into the bed', () => {
    const plants = [at('tomato', 0, 0), at('tomato', 20, 20), at('tomato', 60, 0), at('basil', 20, 20), at('tomato', 1000, 1000)];
    const { garden, report } = ok(migrateV7Export(exportWith([bed('a', plants)]), opts()));
    const summary = garden.plantings.map((p) => [p.plantId, p.cells?.col, p.cells?.row, p.count]);
    expect(summary).toEqual([
      ['tomato', 0, 0, 2],
      ['tomato', 1, 0, 1],
      ['basil', 0, 0, 1],
      ['tomato', 7, 3, 1],
    ]);
    expect(report.plants).toBe(5);
    expect(report.warnings.some((w) => w.includes('outside the bed'))).toBe(true);
  });

  it('turns a portrait bed a quarter turn and maps its squares into the bed frame', () => {
    // 4 x 8 ft shown portrait: 4 squares across (160 px), 8 down (320 px).
    const plants = [at('carrot', 0, 0), at('beet', 120, 0), at('radish', 0, 280)];
    const { garden } = ok(migrateV7Export(exportWith([bed('a', plants, { vertical: true })]), opts()));
    const b = garden.containers[0] as GridBed;
    expect(b).toMatchObject({ cols: 8, rows: 4, rotation: 90 });
    const cell = (id: string) => garden.plantings.find((p) => p.plantId === id)?.cells;
    expect(cell('carrot')).toMatchObject({ col: 0, row: 3 });
    expect(cell('beet')).toMatchObject({ col: 0, row: 0 });
    expect(cell('radish')).toMatchObject({ col: 7, row: 3 });
  });

  it('puts every placement of one plant in a vessel into one patch', () => {
    const pot = { ...bed('pot', [at('basil', 0, 0), at('basil', 20, 0), at('parsley', 0, 20)]), type: 'pot-round', diameter: 2 };
    const { garden } = ok(migrateV7Export(exportWith([pot]), opts()));
    expect(garden.plantings.map((p) => [p.plantId, p.count, p.cells])).toEqual([
      ['basil', 2, undefined],
      ['parsley', 1, undefined],
    ]);
  });
});

// ---- Plants -------------------------------------------------------------------------------------

describe('plant ids', () => {
  it('maps renamed generic ids to their 8.0 plant', () => {
    const ids = ['green-beans', 'peas', 'corn', 'cantaloupe', 'chive', 'collard-greens', 'pepper'];
    const { garden, report } = ok(migrateV7Export(exportWith([bed('a', ids.map((id, i) => at(id, (i % 4) * 40, Math.floor(i / 4) * 40)))]), opts()));
    expect(garden.plantings.map((p) => p.plantId)).toEqual(['bush-bean', 'pea', 'sweet-corn', 'melon', 'chives', 'collards', 'pepper']);
    expect(report.customPlantsCreated).toBe(0);
  });

  it('turns seed-packet varieties into custom plants with parents', () => {
    const ids = ['tomato-roma', 'pea-lincoln', 'squash-cocozelle', 'basil-sweet', 'onion-evergreen-bunching', 'tomato-roma'];
    const { garden, report } = ok(migrateV7Export(exportWith([bed('a', ids.map((id) => at(id)))]), opts()));
    expect(report.customPlantsCreated).toBe(5);
    expect(report.unknownPlantIds).toEqual([]);
    const parents = garden.customPlants.map((c) => [c.name, c.parent, c.maturity.days]);
    expect(parents).toEqual([
      ['Tomato - Roma', 'tomato', 80],
      ['Pea - Lincoln', 'pea', 62],
      ['Squash - Cocozelle', 'zucchini', 50],
      ['Basil - Sweet', 'basil', 85],
      ['Onion - Evergreen Bunching', 'scallion', 60],
    ]);
    const roma = garden.customPlants[0]!;
    expect(garden.plantings.find((p) => p.plantId === roma.id)?.count).toBe(2);
    // A variety plants like its parent.
    expect(garden.plantings.find((p) => p.plantId === roma.id)?.method).toBe('indoor');
  });

  it('builds plants with no 8.0 relative from the old record', () => {
    const { garden } = ok(migrateV7Export(exportWith([bed('a', [at('catnip'), at('sweet-peas', 40, 0)])]), opts()));
    const [catnip, sweetPeas] = garden.customPlants;
    expect(catnip).toMatchObject({ name: 'Catnip', category: 'herb', frost: 'tender', maturity: { days: 72, from: 'sow' } });
    expect(catnip?.parent).toBeUndefined();
    expect(catnip?.methods?.direct?.weeks).toEqual([1, 3]);
    // The ornamental sweet pea is poisonous: never the edible pea.
    expect(sweetPeas).toMatchObject({ name: 'Sweet Peas', category: 'flower', frost: 'hardy' });
    expect(sweetPeas?.parent).toBeUndefined();
    expect(garden.plantings.map((p) => p.plantId)).not.toContain('pea');
  });

  it('reports unknown ids and keeps them as placeholder custom plants', () => {
    const plants = [at('mystery-plant'), at('mystery-plant', 40, 0), at('custom-thai-basil-1712345678901', 80, 0), at('tomatillo', 0, 40)];
    const { garden, report } = ok(migrateV7Export(exportWith([bed('a', plants)]), opts()));
    expect(report.unknownPlantIds).toEqual(['custom-thai-basil-1712345678901', 'mystery-plant']);
    expect(report.plants).toBe(4);
    expect(garden.customPlants.map((c) => c.name)).toEqual(['Mystery Plant', 'Thai Basil']);
    expect(garden.plantings.find((p) => p.plantId === 'tomatillo')).toBeDefined();
    const warning = report.warnings.find((w) => w.includes('matched nothing known'));
    expect(warning).toContain('3 uses');
  });

  it('turns old custom seeds into custom plants, guessing a parent from the name', () => {
    const seeds = [
      { id: 'custom-tomato-sungold-1', name: 'Tomato - Sungold', type: 'vegetable', spacing: 24, daysToHarvest: 65, sunNeed: 'full', waterNeed: 'medium', isCustom: true },
      { id: 'custom-moonflower-2', name: 'Moonflower', type: 'flower', spacing: 18, daysToHarvest: 90, sunNeed: 'full', waterNeed: 'low', isCustom: true },
    ];
    const { garden, report } = ok(migrateV7Export(exportWith([bed('a', [at('custom-tomato-sungold-1')])], { customSeeds: seeds }), opts()));
    expect(report.customPlantsCreated).toBe(2);
    expect(report.unknownPlantIds).toEqual([]);
    const [sungold, moon] = garden.customPlants;
    expect(sungold).toMatchObject({ name: 'Tomato - Sungold', parent: 'tomato', maturity: { days: 65 } });
    expect(moon).toMatchObject({ name: 'Moonflower', category: 'flower', spacingCm: { inRow: 46, betweenRows: 46 } });
    expect(moon?.parent).toBeUndefined();
    expect(garden.plantings[0]?.plantId).toBe(sungold?.id);
    expect((garden.legacy as Obj).customSeeds).toEqual(seeds);
  });

  it('reads custom seeds from storage', () => {
    const storage = {
      gardensync_state: JSON.stringify({ version: 2, containers: [bed('a', [at('custom-x-1')])] }),
      gardenSyncCustomPlants: JSON.stringify([{ id: 'custom-x-1', name: 'Ground Cherry', type: 'fruit', spacing: 24, daysToHarvest: 70 }]),
    };
    const { garden, report } = ok(migrateV7Storage(storage, opts()));
    expect(report.unknownPlantIds).toEqual([]);
    expect(garden.customPlants[0]).toMatchObject({ name: 'Ground Cherry', category: 'fruit' });
  });
});

// ---- Dates --------------------------------------------------------------------------------------

describe('anchors and the planting log', () => {
  const plants = [at('tomato'), at('lettuce', 40, 0), at('garlic', 80, 0), at('strawberry', 120, 0), at('potato', 0, 40)];

  it('anchors on this season, with methods from each plant', () => {
    const { garden } = ok(migrateV7Export(exportWith([bed('a', plants)]), opts()));
    const got = Object.fromEntries(garden.plantings.map((p) => [p.plantId, [p.method, p.anchor]]));
    expect(got.tomato).toEqual(['indoor', { kind: 'auto', window: 'spring', season: 2026, offsetDays: 0 }]);
    expect(got.lettuce?.[0]).toBe('direct');
    // Garlic planted this autumn is harvested next year, which is its season.
    expect(got.garlic).toEqual(['plant', { kind: 'auto', window: 'overwinter', season: 2027, offsetDays: 0 }]);
    expect(got.strawberry).toEqual(['plant', { kind: 'auto', window: 'perennial', season: 2026, offsetDays: 0 }]);
    expect(got.potato?.[0]).toBe('plant');
    expect(garden.plantings.every((p) => p.actual === undefined)).toBe(true);
  });

  it('takes real dates from the old planting log', () => {
    const plantingLog = {
      'tomato-seed-indoor': { done: true, completedAt: '2025-03-02T18:30:00.000Z' },
      'tomato-transplant': { done: true, completedAt: '2025-05-11T14:00:00.000Z' },
      'lettuce-direct-sow': { done: true, completedAt: '2025-04-05T10:00:00.000Z' },
      'garlic-seed-indoor': { done: true, completedAt: 'not a date' },
      'potato-harvest': { done: true, completedAt: '2025-08-01T10:00:00.000Z' },
    };
    const { garden, report } = ok(migrateV7Export(exportWith([bed('a', plants)], { plantingLog }), opts()));
    const tomato = garden.plantings.find((p) => p.plantId === 'tomato');
    expect(tomato).toMatchObject({ method: 'indoor', actual: { startedIndoors: '2025-03-02', bedIn: '2025-05-11' } });
    expect(tomato?.anchor).toMatchObject({ season: 2025 });
    const lettuce = garden.plantings.find((p) => p.plantId === 'lettuce');
    expect(lettuce).toMatchObject({ method: 'direct', actual: { bedIn: '2025-04-05' } });
    expect(garden.plantings.find((p) => p.plantId === 'garlic')?.actual).toBeUndefined();
    expect((garden.legacy as Obj).plantingLog).toEqual(plantingLog);
    expect(report.warnings.some((w) => w.includes('real sowing dates'))).toBe(true);
  });
});

// ---- Harvests, journal, legacy ------------------------------------------------------------------

describe('records', () => {
  const containers = [bed('veg', [at('tomato'), at('kale', 40, 0)]), bed('herbs', [at('basil')], { name: 'HERB & SALAD' })];

  it('carries harvests across in grams, linked to their planting where the bed is known', () => {
    const harvests = [
      { id: 1, plantId: 'tomato', bed: 1, weight: 2, date: '2026-08-01', notes: 'first ones', donated: 'yes', timestamp: '2026-08-01T20:00:00Z' },
      { id: 2, plant: 'kale', bed: '1', weight: '0.5', date: '2026-08-02', donated: 'partial' },
      { id: 3, plantId: 'basil', bed: 'HERB &amp; SALAD', weight: 0, date: '2026-08-03', notes: 'auto: harvest-burst', donated: 'no' },
      { id: 4, plantId: 'tomato', bed: 9, weight: 1, timestamp: '2026-08-04T09:00:00Z' },
      { id: 5, weight: 1, date: '2026-08-05' },
    ];
    const { garden, report } = ok(migrateV7Export(exportWith(containers, { harvests, harvestGoal: 250 }), opts()));
    expect(report.harvests).toBe(4);
    const [h1, h2, h3, h4] = garden.harvests;
    const tomatoPlanting = garden.plantings.find((p) => p.plantId === 'tomato');
    expect(h1).toMatchObject({ plantId: 'tomato', grams: 907.2, date: '2026-08-01', note: 'first ones', plantingId: tomatoPlanting?.id });
    expect(h2).toMatchObject({ plantId: 'kale', grams: 226.8 });
    expect(h2?.plantingId).toBe(garden.plantings.find((p) => p.plantId === 'kale')?.id);
    expect(h3?.grams).toBeUndefined();
    expect(h3?.plantingId).toBe(garden.plantings.find((p) => p.plantId === 'basil')?.id);
    expect(h4).toMatchObject({ date: '2026-08-04' });
    expect(h4?.plantingId).toBeUndefined();
    const legacy = garden.legacy as Obj;
    expect(legacy.harvestGoal).toBe(250);
    expect((legacy.harvests as Obj[]).map((m) => m.donated)).toEqual(['yes', 'partial', 'no', undefined]);
    expect(report.warnings.some((w) => w.includes('1 harvest entries'))).toBe(true);
  });

  it('carries journal entries across to their container', () => {
    const journal = {
      'container-veg': [{ id: 1, text: 'Mulched', date: '2026-06-01T12:00:00.000Z' }],
      'bed-1': [{ id: 2, text: 'Old style key', date: '2026-06-02T12:00:00.000Z' }],
      'container-none': [{ id: 3, text: 'Whole garden', date: '2026-06-03T12:00:00.000Z' }, { id: 4, text: '', date: '2026-06-04' }],
    };
    const { garden, report } = ok(migrateV7Export(exportWith(containers, { journal }), opts()));
    const [veg, herbs] = garden.containers;
    expect(report.journal).toBe(3);
    expect(garden.journal.map((j) => [j.text, j.date, j.containerId])).toEqual([
      ['Mulched', '2026-06-01', veg?.id],
      ['Old style key', '2026-06-02', herbs?.id],
      ['Whole garden', '2026-06-03', undefined],
    ]);
  });

  it('keeps crew, ticked tasks and the rest in legacy, but never a key', () => {
    const vols = [{ id: 'vol-1', name: 'Volunteer 1', phone: '', availability: 'high' }];
    const data = exportWith([bed('veg', [], { volunteer: 'vol-1' })], { completedTasks: { 'tomato-transplant': true }, geminiKey: 'secret' });
    (data.state as Obj).volunteers = vols;
    const { garden, report } = ok(migrateV7Export(data, opts()));
    const legacy = garden.legacy as Obj;
    expect(legacy.volunteers).toEqual(vols);
    expect(legacy.crewAssignments).toEqual({ [garden.containers[0]!.id]: 'vol-1' });
    expect(legacy.completedTasks).toEqual({ 'tomato-transplant': true });
    expect(legacy.exportDate).toBe('2026-06-01T12:00:00.000Z');
    expect(JSON.stringify(legacy)).not.toContain('secret');
    expect(report.legacyKeys).toEqual(Object.keys(legacy).sort());
  });

  it('keeps an unreadable side key as raw text and still imports the garden', () => {
    const storage = {
      gardensync_state: JSON.stringify({ version: 2, containers: containers }),
      gardensync_harvests: '[{"broken',
      gardensync_claude_key: 'sk-ant-never-read',
    };
    const { garden, report } = ok(migrateV7Storage(storage, opts()));
    expect(garden.harvests).toEqual([]);
    expect((garden.legacy as Obj).unreadable).toEqual({ gardensync_harvests: '[{"broken' });
    expect(report.warnings.some((w) => w.includes('harvest log could not be read'))).toBe(true);
    expect(JSON.stringify(garden)).not.toContain('sk-ant');
  });
});

// ---- Share links --------------------------------------------------------------------------------

describe('7.x share links', () => {
  it('decodes a version 2 #plan= link', () => {
    const hash = v7Hash({
      v: 2,
      k: ['basil', 'tomato', 'tomato-roma'],
      c: [
        { t: 'raised-bed', n: 'Café bed', w: 4, h: 4, d: null, p: [[1, 0, 0], [1, 20, 20], [0, 60, 0], [2, 100, 100]] },
        { t: 'pot-round', n: 'Pot', w: null, h: null, d: 1.5, p: [[0, 4, 4], [7, 0, 0]] },
      ],
    });
    const { garden, report } = ok(decodeV7ShareHash(hash, opts()));
    expect(garden.containers.map((c) => [c.name, c.form])).toEqual([
      ['Café bed', 'grid'],
      ['Pot', 'vessel'],
    ]);
    expect(report.plants).toBe(5);
    expect(report.customPlantsCreated).toBe(1);
    expect(report.warnings.some((w) => w.includes('1 unreadable plant'))).toBe(true);
    expect(garden.containers[1]).toMatchObject({ x: 342.9 + 22.86, y: 22.86 });
  });

  it('decodes a version 1 link', () => {
    const hash = v7Hash({ v: 1, k: ['kale'], b: [[[0, 0, 0]], [], [[0, 40, 40]], []], n: ['A', 'B', 'C', 'D'], s: [{ w: 3, h: 6 }] });
    const { garden, report } = ok(decodeV7ShareHash(hash.slice('#plan='.length), opts()));
    expect(garden.containers.map((c) => c.name)).toEqual(['A', 'B', 'C', 'D']);
    expect(garden.containers[0]).toMatchObject({ cols: 6, rows: 3 });
    expect(garden.containers[1]).toMatchObject({ cols: 10, rows: 5 });
    expect(report.plants).toBe(2);
  });

  it('rejects broken links', () => {
    for (const bad of ['', '#plan=', '#plan=!!!', '#plan=' + btoa('not json'), v7Hash({ v: 3, k: [] }), v7Hash([1, 2]), '#plan=' + 'A'.repeat(1_200_000)]) {
      const r = decodeV7ShareHash(bad, opts());
      expect('error' in r, bad.slice(0, 40)).toBe(true);
    }
  });
});

// ---- Corrupt and empty input --------------------------------------------------------------------

describe('bad input', () => {
  it('gives an error, not a throw, for empty or corrupt storage', () => {
    const cases: Record<string, string | null>[] = [
      {},
      { gardensync_state: null },
      { gardensync_state: '' },
      { gardensync_state: '{not json' },
      { gardensync_state: '42' },
      { gardensync_state: '{"version":2}' },
      { gardensync_state: 'null', gardensync_harvests: '[]' },
    ];
    for (const raw of cases) {
      const r = migrateV7Storage(raw, opts());
      expect('error' in r, JSON.stringify(raw)).toBe(true);
    }
    expect('error' in migrateV7Storage(null as unknown as Record<string, string>, opts())).toBe(true);
  });

  it('gives an error for files that are not exports', () => {
    for (const json of [null, undefined, 42, 'garbage', '{"version":2}', {}, [], { state: [] }, { version: 2, state: {} }]) {
      const r = migrateV7Export(json, opts());
      expect('error' in r, JSON.stringify(json)).toBe(true);
    }
    const cyclic: Obj = { version: 2, state: { containers: [] } };
    cyclic.self = cyclic;
    expect('error' in migrateV7Export(cyclic, opts())).toBe(true);
  });

  it('survives junk inside an otherwise valid export', () => {
    const junkContainers: unknown[] = [null, 5, { plants: 'x' }, bed('a', [null as unknown as Obj, { plantId: 7 }, at('kale', NaN, -40)], { w: 'wide', name: '   ' }), bed('a', [])];
    const junk = exportWith(junkContainers as Obj[], {
      harvests: { not: 'a list' },
      journal: 'nope',
    });
    const { garden, report } = ok(migrateV7Export(junk, opts()));
    expect(v.safeParse(GardenSchema, garden).success).toBe(true);
    expect(garden.containers).toHaveLength(2);
    expect(garden.containers[1]?.name).toBe('Raised Bed');
    expect(report.plants).toBe(1);
    expect(report.warnings.length).toBeGreaterThan(0);
  });

  it('reads storage with only side records into an empty garden', () => {
    const { garden, report } = ok(
      migrateV7Storage({ gardensync_harvests: JSON.stringify([{ plantId: 'kale', weight: 1, date: '2026-07-01', bed: 1 }]) }, opts()),
    );
    expect(garden.containers).toEqual([]);
    expect(report.harvests).toBe(1);
  });

  it('rejects a bad today', () => {
    expect('error' in migrateV7Export(exportWith([]), { today: '28/10/2026', newId: () => 'x' })).toBe(true);
  });

  it('warns in plain sentences', () => {
    const all = DEMOS.flatMap((slug) => ok(migrateV7Export(readJson(`${slug}.export.json`), opts())).report.warnings);
    for (const w of all) expect(w).not.toMatch(/—/);
  });
});

// ---- Real local data, when present --------------------------------------------------------------

describe.skipIf(!existsSync(LOCAL))('local 7.x data (tests/fixtures/local)', () => {
  const files = existsSync(LOCAL) ? readdirSync(LOCAL).filter((f) => f.endsWith('.json')) : [];
  for (const file of files) {
    it(`migrates ${file}`, () => {
      const json = JSON.parse(readFileSync(join(LOCAL, file), 'utf8')) as Obj;
      const isStorage = typeof json.gardensync_state === 'string';
      const r = isStorage ? migrateV7Storage(json as Record<string, string>, opts()) : migrateV7Export(json, opts());
      if ('error' in r) throw new Error(`${file}: ${r.error}`);
    });
  }
});

describe('planting-log ticks and the time zone', () => {
  const evening = {
    // 8:30 pm on May 10 in New York (EDT, UTC-4) and 7:30 am on May 11 in Melbourne (AEST, UTC+10).
    'tomato-transplant': { done: true, completedAt: '2025-05-11T00:30:00.000Z' },
    'tomato-seed-indoor': { done: true, completedAt: '2025-03-02T03:00:00Z' },
  };
  const tomato = (tzOffsetMinutes?: number) => {
    const o = tzOffsetMinutes === undefined ? opts() : { ...opts(), tzOffsetMinutes };
    const { garden } = ok(migrateV7Export(exportWith([bed('a', [at('tomato')])], { plantingLog: evening }), o));
    return garden.plantings.find((p) => p.plantId === 'tomato')?.actual;
  };

  it('uses the UTC date by default', () => {
    expect(tomato()).toEqual({ startedIndoors: '2025-03-02', bedIn: '2025-05-11' });
  });

  it("turns an evening tick into the gardener's own date", () => {
    expect(tomato(-240)).toEqual({ startedIndoors: '2025-03-01', bedIn: '2025-05-10' });
    expect(tomato(600)).toEqual({ startedIndoors: '2025-03-02', bedIn: '2025-05-11' });
  });

  it('works in every public entry point and refuses a nonsense offset', () => {
    const storage = { gardensync_state: JSON.stringify({ containers: [bed('a', [at('tomato')])] }), gardensync_plantlog: JSON.stringify(evening) };
    const r = ok(migrateV7Storage(storage, { ...opts(), tzOffsetMinutes: -240 }));
    expect(r.garden.plantings[0]?.actual).toEqual({ startedIndoors: '2025-03-01', bedIn: '2025-05-10' });
    expect(migrateV7Export(exportWith([]), { ...opts(), tzOffsetMinutes: 2000 })).toMatchObject({ error: expect.stringContaining('time zone offset') });
    const share = 'plan=' + btoa(JSON.stringify({ v: 2, k: ['tomato'], c: [{ t: 'raised-bed', n: 'A', w: 4, h: 8, p: [[0, 0, 0]] }] }));
    expect('garden' in decodeV7ShareHash(share, { ...opts(), tzOffsetMinutes: 600 })).toBe(true);
    expect(decodeV7ShareHash(share, { ...opts(), tzOffsetMinutes: 1.5 })).toMatchObject({ error: expect.stringContaining('time zone offset') });
  });

  it('drops an indoor date that comes after the bed-in date, so the planting stays valid', () => {
    const log = {
      'tomato-seed-indoor': { done: true, completedAt: '2025-06-01T12:00:00Z' },
      'tomato-transplant': { done: true, completedAt: '2025-05-11T12:00:00Z' },
    };
    const { garden, report } = ok(migrateV7Export(exportWith([bed('a', [at('tomato')])], { plantingLog: log }), opts()));
    expect(garden.plantings[0]?.actual).toEqual({ bedIn: '2025-05-11' });
    expect(report.warnings.some((w) => w.includes('before its seeds were started'))).toBe(true);
  });
});
