// Ops: the only way the garden document changes.
//
// The UI, the assistant and imports all describe an edit as an Op and hand it to applyOp, which
// returns a new document (immer's produce, so unchanged parts are shared) or a plain-sentence error
// a gardener could read. Ops carry every id they need; the domain never makes up ids or reads the
// clock. A batch applies its ops in order and is all or nothing.
//
// What applyOp checks: that the things an op points at exist, that names and numbers the gardener
// typed are usable, that grid plantings stay inside their bed, and that nothing would be left
// pointing at something removed. What it does not check: overlapping plantings. Sharing squares is
// often deliberate (lettuce under tomatoes, a relay after garlic), so that is the UI's call, made
// with layout/occupancy.ts.
//
// Every document applyOp returns still passes DocSchema; the unit tests check that after every op.
// User-supplied records are run through their schema here too, and the parsed copy is what gets
// stored, so the caller's objects are never frozen or shared into the document. A patch may only name
// the fields its op is for (never an id or a container's form); anything else is refused. Moving a
// planting to another bed is an updatePlanting with a containerId, checked like a new planting.
//
// As a backstop, the result goes through checkDoc (check.ts): an op is refused if it would leave a
// cross-reference problem the document did not already have.
import { produce, type Draft } from 'immer';
import * as v from 'valibot';
import { ClimateProfileSchema, type ClimateProfile } from '../climate/types';
import { isIsoDate, type IsoDate } from '../dates';
import { cellsInBounds } from '../layout/patch';
import { plantById } from '../plants/library';
import { resolvePlant, wouldCreateCycle } from '../plants/resolve';
import { actualInOrder, methodSupported } from '../schedule/project';
import { problemsOf, type Problem } from './check';
import {
  ContainerSchema,
  CustomPlantSchema,
  GardenSchema,
  HarvestSchema,
  JournalSchema,
  PlantingSchema,
  SeriesSchema,
  SettingsSchema,
  type Container,
  type CustomPlant,
  type Garden,
  type GardenDoc,
  type Harvest,
  type JournalEntry,
  type Planting,
  type Series,
  type Settings,
} from './schema';

/** Fields of a container an update may change. Fields of the other form are refused. */
export interface ContainerPatch {
  name?: string;
  x?: number;
  y?: number;
  notes?: string;
  kind?: Container['kind'];
  /** Grid beds only. */
  cols?: number;
  rows?: number;
  rotation?: 0 | 90 | 180 | 270;
  /** Vessels only. */
  diameterCm?: number;
  litres?: number;
  pockets?: number;
}

/** A patch sets the fields it names. A field set to undefined is cleared (if it is optional). */
type Patch<T> = { [K in keyof T]?: T[K] | undefined };

export type Op =
  | { type: 'addGarden'; garden: { id: string; name: string; createdAt: IsoDate; cellCm: Garden['cellCm'] } }
  | { type: 'renameGarden'; gardenId: string; name: string }
  | { type: 'removeGarden'; gardenId: string }
  | { type: 'setActiveGarden'; gardenId: string | null }
  | { type: 'updateSettings'; patch: Patch<Pick<Settings, 'units' | 'theme' | 'lastExportAt'>> }
  | { type: 'setClimate'; gardenId: string; climate: ClimateProfile | null }
  | { type: 'addContainer'; gardenId: string; container: Container }
  | { type: 'updateContainer'; gardenId: string; containerId: string; patch: ContainerPatch }
  | { type: 'removeContainer'; gardenId: string; containerId: string }
  | { type: 'addPlanting'; gardenId: string; planting: Planting }
  | { type: 'updatePlanting'; gardenId: string; plantingId: string; patch: Patch<Omit<Planting, 'id'>> }
  | { type: 'removePlanting'; gardenId: string; plantingId: string }
  | { type: 'logHarvest'; gardenId: string; harvest: Harvest }
  | { type: 'updateHarvest'; gardenId: string; harvestId: string; patch: Patch<Omit<Harvest, 'id'>> }
  | { type: 'removeHarvest'; gardenId: string; harvestId: string }
  | { type: 'addJournal'; gardenId: string; entry: JournalEntry }
  | { type: 'removeJournal'; gardenId: string; entryId: string }
  | { type: 'setTaskDone'; gardenId: string; taskId: string; date: IsoDate }
  | { type: 'clearTaskDone'; gardenId: string; taskId: string }
  | { type: 'addCustomPlant'; gardenId: string; plant: CustomPlant }
  | { type: 'updateCustomPlant'; gardenId: string; plantId: string; patch: Patch<Omit<CustomPlant, 'id'>> }
  | { type: 'removeCustomPlant'; gardenId: string; plantId: string }
  | { type: 'addSeries'; gardenId: string; series: Series }
  | { type: 'removeSeries'; gardenId: string; seriesId: string }
  | { type: 'batch'; ops: readonly Op[] };

export type OpResult = { ok: true; doc: GardenDoc } | { ok: false; error: string };

class OpError extends Error {}

function fail(message: string): never {
  throw new OpError(message);
}

/** Run outside data through its schema; the error is a backstop for what the checks below miss. */
function parse<S extends v.GenericSchema>(schema: S, value: unknown, what: string): v.InferOutput<S> {
  const res = v.safeParse(schema, value);
  if (res.success) return res.output;
  const path = v.getDotPath(res.issues[0]);
  fail(`Something in this ${what} is not usable${path ? ` (${path})` : ''}.`);
}

const MAX_NAME = 80;
const MAX_NOTE = 2000;

/** A trimmed, non-empty name of at most 80 characters. */
function checkName(name: unknown, what: string): string {
  if (typeof name !== 'string' || name.trim() === '') fail(`Give the ${what} a name.`);
  const trimmed = name.trim();
  if (trimmed.length > MAX_NAME) fail(`Keep the ${what}'s name to ${MAX_NAME} characters or fewer.`);
  return trimmed;
}

function checkNote(note: unknown, what: string): void {
  if (note === undefined) return;
  if (typeof note !== 'string') fail(`The ${what} has to be text.`);
  if (note.length > MAX_NOTE) fail(`Keep the ${what} to ${MAX_NOTE} characters or fewer.`);
}

function checkDate(d: unknown, what: string): void {
  if (typeof d !== 'string' || !isIsoDate(d)) fail(`The ${what} is not a calendar date.`);
}

const isWhole = (n: unknown, lo: number, hi: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi;
const isNumberIn = (n: unknown, lo: number, hi: number): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;

// The fields each update op may change. Ids, a container's form and a custom plant's id never change.
const SETTINGS_KEYS = ['units', 'theme', 'lastExportAt'] as const;
const CONTAINER_KEYS = ['name', 'x', 'y', 'notes', 'kind', 'cols', 'rows', 'rotation', 'diameterCm', 'litres', 'pockets'] as const;
const PLANTING_KEYS = ['containerId', 'plantId', 'cells', 'count', 'method', 'anchor', 'seriesId', 'actual', 'notes'] as const;
const HARVEST_KEYS = ['plantId', 'plantingId', 'date', 'grams', 'count', 'note'] as const;
const CUSTOM_PLANT_KEYS: readonly string[] = Object.keys(CustomPlantSchema.entries).filter((k) => k !== 'id');

/**
 * Set the patch's fields on a copy of `base`; fields set to undefined are removed. Only the listed
 * keys may appear in the patch; any other key (an id, a form, a typo) refuses the whole op.
 */
function merge<T extends object>(base: T, patch: unknown, allowed: readonly string[], what: string): T {
  if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) fail(`That change to the ${what} is not usable.`);
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, val] of Object.entries(patch)) {
    if (!allowed.includes(k)) {
      const label = /^[A-Za-z]{1,40}$/.test(k) ? ` (${k})` : '';
      fail(`That change to the ${what} touches something that cannot be changed this way${label}.`);
    }
    if (val === undefined) delete out[k];
    else out[k] = val;
  }
  return out as T;
}

function hasId(list: readonly { id: string }[], id: string): boolean {
  return list.some((x) => x.id === id);
}

function indexOrFail<T extends { id: string }>(list: T[], id: string, missing: string): number {
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) fail(missing);
  return i;
}

function gardenOf(draft: Draft<GardenDoc>, id: string): Draft<Garden> {
  const g = draft.gardens.find((x) => x.id === id);
  if (!g) fail('That garden no longer exists.');
  return g;
}

function plantName(garden: Garden | Draft<Garden>, plantId: string): string {
  return resolvePlant(plantId, garden.customPlants as CustomPlant[])?.plant.name ?? 'this plant';
}

function knownPlant(garden: Garden | Draft<Garden>, plantId: string): boolean {
  return resolvePlant(plantId, garden.customPlants as CustomPlant[]) !== undefined;
}

// ---------------------------------------------------------------------------------------------
// Validation of whole records against the garden they go into

function validateContainer(c: unknown): Container {
  const raw = c as Partial<Record<string, unknown>>;
  const name = checkName(raw.name, raw.form === 'vessel' ? 'container' : 'bed');
  if (!isNumberIn(raw.x, -100_000, 100_000) || !isNumberIn(raw.y, -100_000, 100_000)) {
    fail('That spot is too far from the rest of the garden.');
  }
  if (raw.form === 'grid') {
    if (!isWhole(raw.cols, 1, 60) || !isWhole(raw.rows, 1, 60)) {
      fail('A bed can be 1 to 60 squares along each side.');
    }
  } else if (raw.form === 'vessel') {
    if (!isNumberIn(raw.litres, 1, 2000)) fail('That soil volume is outside what a container can hold.');
    if (!isNumberIn(raw.diameterCm, 10, 300)) fail('That width is outside what a container can be.');
    if (raw.pockets !== undefined && !isWhole(raw.pockets, 1, 60)) fail('A tower can have 1 to 60 pockets.');
  }
  checkNote(raw.notes, 'note');
  return parse(ContainerSchema, { ...raw, name }, 'bed or container');
}

/** Checks a planting against its garden and returns the parsed copy to store. */
function validatePlanting(garden: Draft<Garden>, p: unknown): Planting {
  const raw = p as Partial<Record<string, unknown>>;
  if (typeof raw.count !== 'number' || raw.count < 1) fail('A planting needs at least one plant.');
  if (!Number.isInteger(raw.count)) fail('Use a whole number of plants.');
  if (raw.count > 10_000) fail('That is more plants than one planting can hold.');
  checkNote(raw.notes, 'note');
  const planting = parse(PlantingSchema, raw, 'planting');

  const container = garden.containers.find((c) => c.id === planting.containerId);
  if (!container) fail('That bed or container no longer exists.');
  if (!knownPlant(garden, planting.plantId)) fail('GardenSync does not know that plant.');
  const name = plantName(garden, planting.plantId);

  if (container.form === 'grid') {
    if (!planting.cells) fail(`Choose the squares for the ${name}.`);
    if (!cellsInBounds(container, planting.cells)) fail(`The ${name} would stick out past the edge of ${container.name}.`);
  } else if (planting.cells) {
    fail(`Plants in ${container.name} do not take squares; give a count instead.`);
  }

  if (planting.seriesId !== undefined && !hasId(garden.series, planting.seriesId)) {
    fail('That succession series no longer exists.');
  }
  if (planting.anchor.kind === 'pinned' && planting.anchor.bedOut !== undefined && planting.anchor.bedOut <= planting.anchor.bedIn) {
    fail(`The ${name} has to come out after it goes in.`);
  }
  const plant = resolvePlant(planting.plantId, garden.customPlants as CustomPlant[])!.plant;
  if (!methodSupported(plant, planting.method)) fail(methodRefusal(name, planting.method));
  if (!actualInOrder(planting.actual)) {
    fail(`The ${name}'s dates are out of order: it is started indoors first, then goes in, then comes out.`);
  }
  return planting;
}

function methodRefusal(name: string, method: Planting['method']): string {
  switch (method) {
    case 'direct':
      return `The ${name} is not sown straight into the ground. Choose another way to grow it.`;
    case 'transplant':
    case 'bought':
      return `The ${name} is not planted out as young plants. Choose another way to grow it.`;
    case 'indoor':
      return `The ${name} is not started indoors. Choose another way to grow it.`;
    case 'plant':
      return `The ${name} is not grown from sets, crowns or divisions. Choose another way to grow it.`;
  }
}

function validateHarvest(garden: Draft<Garden>, h: unknown): Harvest {
  const raw = h as Partial<Record<string, unknown>>;
  checkDate(raw.date, 'harvest date');
  if (raw.grams === undefined && raw.count === undefined) fail('Record a weight or a count for the harvest.');
  if (raw.grams !== undefined && !isNumberIn(raw.grams, 0, 1_000_000)) fail('That harvest weight is not usable.');
  if (raw.count !== undefined && !isWhole(raw.count, 0, 10_000)) fail('Count the harvest in whole numbers.');
  checkNote(raw.note, 'note');
  const harvest = parse(HarvestSchema, raw, 'harvest');
  if (!knownPlant(garden, harvest.plantId)) fail('GardenSync does not know that plant.');
  if (harvest.plantingId !== undefined) {
    const planting = garden.plantings.find((p) => p.id === harvest.plantingId);
    if (!planting) fail('That planting no longer exists.');
    if (planting.plantId !== harvest.plantId) fail('That harvest is for a different plant than its planting.');
  }
  return harvest;
}

function validateCustomPlant(garden: Draft<Garden>, c: unknown, selfId: string): CustomPlant {
  const raw = c as Partial<Record<string, unknown>>;
  const name = checkName(raw.name, 'plant');
  const maturity = raw.maturity as { days?: unknown } | undefined;
  if (!maturity || !isWhole(maturity.days, 1, 2000)) fail('Days to maturity must be a whole number of at least 1.');
  const plant = parse(CustomPlantSchema, { ...raw, name }, 'plant');
  if (plant.parent !== undefined) {
    if (plant.parent === selfId) fail(`${name} cannot be based on itself.`);
    if (!knownPlant(garden, plant.parent)) fail('The plant this one is based on no longer exists.');
    if (wouldCreateCycle(selfId, plant.parent, garden.customPlants as CustomPlant[])) {
      fail(`${name} cannot be based on ${plantName(garden, plant.parent)}, because that plant is already based on ${name}.`);
    }
  }
  return plant;
}

// ---------------------------------------------------------------------------------------------
// The ops

function apply(draft: Draft<GardenDoc>, op: Exclude<Op, { type: 'batch' }>): void {
  switch (op.type) {
    case 'addGarden': {
      const { id, createdAt, cellCm } = op.garden;
      const name = checkName(op.garden.name, 'garden');
      checkDate(createdAt, 'start date');
      if (hasId(draft.gardens, id)) fail('A garden with that id already exists.');
      const garden = parse(GardenSchema, {
        id,
        name,
        createdAt,
        cellCm,
        climate: null,
        containers: [],
        plantings: [],
        series: [],
        harvests: [],
        journal: [],
        customPlants: [],
        taskState: {},
      } satisfies Garden, 'garden');
      draft.gardens.push(garden);
      if (draft.settings.activeGardenId === null) draft.settings.activeGardenId = id;
      return;
    }
    case 'renameGarden': {
      gardenOf(draft, op.gardenId).name = checkName(op.name, 'garden');
      return;
    }
    case 'removeGarden': {
      const i = indexOrFail(draft.gardens, op.gardenId, 'That garden no longer exists.');
      draft.gardens.splice(i, 1);
      if (draft.settings.activeGardenId === op.gardenId) {
        draft.settings.activeGardenId = draft.gardens[0]?.id ?? null;
      }
      return;
    }
    case 'setActiveGarden': {
      if (op.gardenId !== null) gardenOf(draft, op.gardenId);
      draft.settings.activeGardenId = op.gardenId;
      return;
    }
    case 'updateSettings': {
      if (op.patch.lastExportAt !== undefined) checkDate(op.patch.lastExportAt, 'export date');
      draft.settings = parse(SettingsSchema, merge(draft.settings, op.patch, SETTINGS_KEYS, 'settings'), 'setting');
      return;
    }
    case 'setClimate': {
      const g = gardenOf(draft, op.gardenId);
      g.climate = op.climate === null ? null : parse(ClimateProfileSchema, op.climate, 'climate');
      return;
    }

    case 'addContainer': {
      const g = gardenOf(draft, op.gardenId);
      if (hasId(g.containers, op.container.id)) fail('Something with that id is already in this garden.');
      g.containers.push(validateContainer(op.container));
      return;
    }
    case 'updateContainer': {
      const g = gardenOf(draft, op.gardenId);
      const i = indexOrFail(g.containers, op.containerId, 'That bed or container no longer exists.');
      const old = g.containers[i]!;
      const p = op.patch;
      const merged = merge(old, p, CONTAINER_KEYS, old.form === 'grid' ? 'bed' : 'container');
      if (old.form === 'grid' && (p.diameterCm !== undefined || p.litres !== undefined || p.pockets !== undefined)) {
        fail(`${old.name} is a bed measured in squares, not a container measured by volume.`);
      }
      if (old.form === 'vessel' && (p.cols !== undefined || p.rows !== undefined || p.rotation !== undefined)) {
        fail(`${old.name} is measured by volume and has no squares to resize.`);
      }
      const next = validateContainer(merged);
      if (next.form === 'grid') {
        const orphan = g.plantings.find((pl) => pl.containerId === next.id && pl.cells && !cellsInBounds(next, pl.cells));
        if (orphan) {
          fail(`Making ${old.name} that size would leave the ${plantName(g, orphan.plantId)} outside it. Move or remove that planting first.`);
        }
      }
      g.containers[i] = next;
      return;
    }
    case 'removeContainer': {
      const g = gardenOf(draft, op.gardenId);
      const i = indexOrFail(g.containers, op.containerId, 'That bed or container no longer exists.');
      g.containers.splice(i, 1);
      const gone = new Set(g.plantings.filter((p) => p.containerId === op.containerId).map((p) => p.id));
      g.plantings = g.plantings.filter((p) => !gone.has(p.id));
      // Harvests and journal entries are history: keep them, but stop pointing at what is gone.
      for (const h of g.harvests) if (h.plantingId !== undefined && gone.has(h.plantingId)) delete h.plantingId;
      for (const j of g.journal) if (j.containerId === op.containerId) delete j.containerId;
      return;
    }

    case 'addPlanting': {
      const g = gardenOf(draft, op.gardenId);
      if (hasId(g.plantings, op.planting.id)) fail('Something with that id is already in this garden.');
      g.plantings.push(validatePlanting(g, op.planting));
      return;
    }
    case 'updatePlanting': {
      const g = gardenOf(draft, op.gardenId);
      const i = indexOrFail(g.plantings, op.plantingId, 'That planting no longer exists.');
      const old = g.plantings[i]!;
      const next = validatePlanting(g, merge(old, op.patch, PLANTING_KEYS, 'planting'));
      if (next.plantId !== old.plantId && g.harvests.some((h) => h.plantingId === old.id)) {
        fail('Harvests are logged against this planting, so its plant cannot change.');
      }
      g.plantings[i] = next;
      return;
    }
    case 'removePlanting': {
      const g = gardenOf(draft, op.gardenId);
      const i = indexOrFail(g.plantings, op.plantingId, 'That planting no longer exists.');
      g.plantings.splice(i, 1);
      for (const h of g.harvests) if (h.plantingId === op.plantingId) delete h.plantingId;
      return;
    }

    case 'logHarvest': {
      const g = gardenOf(draft, op.gardenId);
      if (hasId(g.harvests, op.harvest.id)) fail('That harvest is already logged.');
      g.harvests.push(validateHarvest(g, op.harvest));
      return;
    }
    case 'updateHarvest': {
      const g = gardenOf(draft, op.gardenId);
      const i = indexOrFail(g.harvests, op.harvestId, 'That harvest is no longer in the log.');
      g.harvests[i] = validateHarvest(g, merge(g.harvests[i]!, op.patch, HARVEST_KEYS, 'harvest'));
      return;
    }
    case 'removeHarvest': {
      const g = gardenOf(draft, op.gardenId);
      g.harvests.splice(indexOrFail(g.harvests, op.harvestId, 'That harvest is no longer in the log.'), 1);
      return;
    }

    case 'addJournal': {
      const g = gardenOf(draft, op.gardenId);
      const { entry } = op;
      if (hasId(g.journal, entry.id)) fail('That journal entry is already saved.');
      checkDate(entry.date, 'journal date');
      if (typeof entry.text !== 'string' || entry.text.trim() === '') fail('Write something for the journal entry.');
      checkNote(entry.text, 'journal entry');
      if (entry.containerId !== undefined && !hasId(g.containers, entry.containerId)) {
        fail('That bed or container no longer exists.');
      }
      g.journal.push(parse(JournalSchema, entry, 'journal entry'));
      return;
    }
    case 'removeJournal': {
      const g = gardenOf(draft, op.gardenId);
      g.journal.splice(indexOrFail(g.journal, op.entryId, 'That journal entry is already gone.'), 1);
      return;
    }

    case 'setTaskDone': {
      const g = gardenOf(draft, op.gardenId);
      if (typeof op.taskId !== 'string' || op.taskId === '' || op.taskId.length > 200) fail('That task is not usable.');
      checkDate(op.date, 'date');
      g.taskState[op.taskId] = op.date;
      return;
    }
    case 'clearTaskDone': {
      const g = gardenOf(draft, op.gardenId);
      delete g.taskState[op.taskId];
      return;
    }

    case 'addCustomPlant': {
      const g = gardenOf(draft, op.gardenId);
      const { id } = op.plant;
      if (plantById(id)) fail('A built-in plant already uses that id.');
      if (hasId(g.customPlants, id)) fail('A plant with that id is already in this garden.');
      g.customPlants.push(validateCustomPlant(g, op.plant, id));
      return;
    }
    case 'updateCustomPlant': {
      const g = gardenOf(draft, op.gardenId);
      const i = indexOrFail(g.customPlants, op.plantId, 'That plant is no longer in this garden.');
      g.customPlants[i] = validateCustomPlant(g, merge(g.customPlants[i]!, op.patch, CUSTOM_PLANT_KEYS, 'plant'), op.plantId);
      // Plantings of it (or of plants based on it) must still be grown a way it supports.
      for (const pl of g.plantings) {
        const r = resolvePlant(pl.plantId, g.customPlants as CustomPlant[]);
        if (r && !methodSupported(r.plant, pl.method)) {
          fail(`That change would leave the ${r.plant.name} planting grown a way the plant does not support. Change that planting first.`);
        }
      }
      return;
    }
    case 'removeCustomPlant': {
      const g = gardenOf(draft, op.gardenId);
      const i = indexOrFail(g.customPlants, op.plantId, 'That plant is no longer in this garden.');
      const name = g.customPlants[i]!.name;
      const uses = g.plantings.filter((p) => p.plantId === op.plantId).length;
      if (uses > 0) {
        fail(`${name} is in ${uses === 1 ? 'a planting' : `${uses} plantings`}. Remove ${uses === 1 ? 'it' : 'them'} first.`);
      }
      if (g.series.some((s) => s.plantId === op.plantId)) fail(`${name} has a succession series. Remove it first.`);
      if (g.harvests.some((h) => h.plantId === op.plantId)) {
        fail(`Harvests of ${name} are in your log, so it has to stay to keep their names.`);
      }
      if (g.customPlants.some((c) => c.parent === op.plantId)) {
        fail(`Other plants are based on ${name}. Change or remove them first.`);
      }
      g.customPlants.splice(i, 1);
      return;
    }

    case 'addSeries': {
      const g = gardenOf(draft, op.gardenId);
      const { series } = op;
      if (hasId(g.series, series.id)) fail('That succession series already exists.');
      if (!isWhole(series.everyDays, 3, 60)) fail('Sow again every 3 to 60 days.');
      if (!knownPlant(g, series.plantId)) fail('GardenSync does not know that plant.');
      g.series.push(parse(SeriesSchema, series, 'succession series'));
      return;
    }
    case 'removeSeries': {
      const g = gardenOf(draft, op.gardenId);
      g.series.splice(indexOrFail(g.series, op.seriesId, 'That succession series is already gone.'), 1);
      // The rounds already planned stay, as ordinary plantings.
      for (const p of g.plantings) if (p.seriesId === op.seriesId) delete p.seriesId;
      return;
    }
  }
}

/** Apply one op. The input document is never changed. */
export function applyOp(doc: GardenDoc, op: Op): OpResult {
  if (op.type === 'batch') {
    let cur = doc;
    for (const inner of op.ops) {
      const res = applyOp(cur, inner);
      if (!res.ok) return res; // nothing from the batch is kept
      cur = res.doc;
    }
    return { ok: true, doc: cur };
  }
  let next: GardenDoc;
  try {
    next = produce(doc, (draft) => apply(draft, op));
  } catch (e) {
    if (e instanceof OpError) return { ok: false, error: e.message };
    throw e;
  }
  const fresh = next === doc ? [] : newProblems(doc, next);
  if (fresh.length > 0) return { ok: false, error: `${fresh[0]!.message} That change was not made.` };
  return { ok: true, doc: next };
}

/** Cross-reference problems in `after` that `before` did not have. */
function newProblems(before: GardenDoc, after: GardenDoc): Problem[] {
  const now = problemsOf(after);
  if (now.length === 0) return now;
  const old = new Set(problemsOf(before).map((p) => p.key));
  return now.filter((p) => !old.has(p.key));
}
