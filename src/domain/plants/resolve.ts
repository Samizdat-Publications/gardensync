// Resolving a plant id to a full plant record.
//
// A planting names a plant by id: either a built-in plant from the library or a custom plant the
// gardener added to this garden. Custom plants store only what the gardener told us (a name, a
// category, frost tolerance and days to maturity are required); everything else comes from:
//
// 1. its parent, when it is a variety of another plant ("Sungold" based on Tomato). The parent may
//    itself be custom, so the chain is followed, with a guard against loops; or
// 2. the general defaults for its category (CATEGORY_DEFAULTS), when it has no parent, the parent
//    is missing (deleted) or the chain loops back on itself.
//
// The merge is shallow: a field the gardener set (say `notes` or `spacingCm`) replaces the whole
// inherited field. The result says where the rest came from, so the UI can say "based on Tomato"
// or "based on defaults for this kind of plant" next to anything the gardener did not set.
import { isDraft } from 'immer';
import type { CustomPlant } from '../doc/schema';
import { PLANTS, plantById } from './library';
import type { Category, Plant } from './schema';

export interface ResolvedPlant {
  plant: Plant;
  /** null for a built-in plant; otherwise where the values the gardener did not set came from. */
  inheritedFrom: 'parent' | 'defaults' | null;
  /** The parent the values came from, when inheritedFrom is 'parent'. */
  parentId?: string;
  /** True for a custom plant. */
  custom: boolean;
  /** The fields the gardener set on a custom plant (empty for a built-in). */
  ownKeys: readonly (keyof Plant)[];
}

const GENERIC_SOURCES: Plant['sources'] = [];

/**
 * General starting values for a plant nobody has researched yet. They lean cautious: plant out
 * after the last frost, give each plant a whole square, ask for a decent pot. Yield is 0, which
 * the harvest views read as "no estimate" rather than inventing one. No sources: these are not
 * advice for any particular plant, and the notes say so.
 */
export const CATEGORY_DEFAULTS: Readonly<Record<Category, Plant>> = {
  vegetable: {
    id: 'default-vegetable',
    name: 'Vegetable',
    latin: '',
    category: 'vegetable',
    family: 'Other',
    lifecycle: 'annual',
    frost: 'tender',
    temp: { minC: 10, maxC: 27 },
    soilMinC: 10,
    sun: 'full',
    water: 'medium',
    density: { perSquare: 1 },
    spacingCm: { inRow: 30, betweenRows: 30 },
    container: { minLitres: 20, perVessel: 1 },
    canopy: 'mid',
    shadeTolerant: false,
    maturity: { days: 60, from: 'sow' },
    methods: {
      indoor: { ageWeeks: [4, 6] },
      transplant: { weeks: [1, 4] },
      direct: { weeks: [1, 4] },
    },
    harvest: { type: 'continuous', windowDays: 30 },
    yield: { amount: 0, unit: 'g', per: 'plant' },
    glyph: { form: 'rosette', color: '#5f8f4e' },
    notes: {
      sowing:
        'These are general defaults for a vegetable, not advice for this plant. Sowing after your last frost is the safe choice; check the seed packet for depth and timing.',
      care: 'General defaults: full sun and steady watering suit most vegetables. Give each plant a full square until you know how big it grows.',
      harvest: 'General defaults: check the seed packet for when and how to harvest.',
    },
    sources: GENERIC_SOURCES,
  },
  herb: {
    id: 'default-herb',
    name: 'Herb',
    latin: '',
    category: 'herb',
    family: 'Other',
    lifecycle: 'annual',
    frost: 'tender',
    temp: { minC: 10, maxC: 27 },
    soilMinC: 10,
    sun: 'full',
    water: 'medium',
    density: { perSquare: 2 },
    spacingCm: { inRow: 20, betweenRows: 30 },
    container: { minLitres: 8, perVessel: 1 },
    canopy: 'mid',
    shadeTolerant: false,
    maturity: { days: 60, from: 'sow' },
    methods: {
      indoor: { ageWeeks: [6, 8] },
      transplant: { weeks: [1, 4] },
      direct: { weeks: [1, 4] },
    },
    harvest: { type: 'cut-and-come-again', windowDays: 60 },
    yield: { amount: 0, unit: 'g', per: 'plant' },
    glyph: { form: 'sprig', color: '#4f8a5b' },
    notes: {
      sowing:
        'These are general defaults for a herb, not advice for this plant. Sowing or planting out after your last frost is the safe choice; check the seed packet.',
      care: 'General defaults: most herbs like sun and soil that drains well. Water when the top of the soil is dry.',
      harvest: 'General defaults: pick leaves as you need them, taking no more than a third of the plant at once.',
    },
    sources: GENERIC_SOURCES,
  },
  fruit: {
    id: 'default-fruit',
    name: 'Fruit',
    latin: '',
    category: 'fruit',
    family: 'Other',
    lifecycle: 'perennial',
    frost: 'tender',
    temp: { minC: 10, maxC: 27 },
    sun: 'full',
    water: 'medium',
    density: { perSquare: 1 },
    spacingCm: { inRow: 60, betweenRows: 90 },
    container: { minLitres: 40, perVessel: 1 },
    canopy: 'mid',
    shadeTolerant: false,
    maturity: { days: 90, from: 'transplant' },
    methods: {
      plant: { weeks: [0, 4], what: 'young plants' },
    },
    harvest: { type: 'continuous', windowDays: 21 },
    yield: { amount: 0, unit: 'g', per: 'plant' },
    perennial: { firstHarvestYear: 2, harvestWeeks: [8, 16] },
    glyph: { form: 'cane', color: '#a0405a' },
    notes: {
      sowing:
        'These are general defaults for a fruit, not advice for this plant. Planting out after your last frost is the safe choice; check the label from the nursery.',
      care: 'General defaults: most fruit wants full sun, steady watering and a mulch. Check how big it grows before choosing its spot.',
      harvest: 'General defaults: many fruit plants give little or nothing in their first season.',
    },
    sources: GENERIC_SOURCES,
  },
  flower: {
    id: 'default-flower',
    name: 'Flower',
    latin: '',
    category: 'flower',
    family: 'Other',
    lifecycle: 'annual',
    frost: 'tender',
    temp: { minC: 10, maxC: 27 },
    soilMinC: 10,
    sun: 'full',
    water: 'medium',
    density: { perSquare: 4 },
    spacingCm: { inRow: 15, betweenRows: 30 },
    container: { minLitres: 8, perVessel: 1 },
    canopy: 'mid',
    shadeTolerant: false,
    maturity: { days: 70, from: 'sow' },
    methods: {
      indoor: { ageWeeks: [6, 8] },
      transplant: { weeks: [1, 4] },
      direct: { weeks: [1, 4] },
    },
    harvest: { type: 'cut-and-come-again', windowDays: 60 },
    yield: { amount: 0, unit: 'count', per: 'plant' },
    glyph: { form: 'flower', color: '#c2577a' },
    notes: {
      sowing:
        'These are general defaults for a flower, not advice for this plant. Sowing or planting out after your last frost is the safe choice; check the seed packet.',
      care: 'General defaults: most annual flowers like sun and steady watering. Removing spent flowers keeps many of them blooming.',
      harvest: 'General defaults: cut flowers in the cool of the morning, just as they open.',
    },
    sources: GENERIC_SOURCES,
  },
};

/** Fields of a custom plant that are bookkeeping, not plant data. */
const NOT_PLANT_DATA = new Set(['parent']);

/** The keys a custom plant actually sets (present and not undefined). */
function ownKeysOf(custom: CustomPlant): (keyof Plant)[] {
  return Object.keys(custom).filter(
    (k) => !NOT_PLANT_DATA.has(k) && (custom as Record<string, unknown>)[k] !== undefined,
  ) as (keyof Plant)[];
}

/** Shallow merge of the gardener's own fields over a base record. */
function mergeOver(base: Plant, custom: CustomPlant): Plant {
  const out: Record<string, unknown> = { ...base };
  for (const k of ownKeysOf(custom)) out[k] = (custom as Record<string, unknown>)[k];
  // Sources belong to researched data. A custom plant has none of its own; it keeps its parent's
  // (they describe the inherited values) or none at all over the defaults.
  out.sources = base.sources;
  return out as Plant;
}

function resolveCustom(
  custom: CustomPlant,
  byId: ReadonlyMap<string, CustomPlant>,
  visiting: Set<string>,
): ResolvedPlant {
  visiting.add(custom.id);
  let base: Plant | undefined;
  let parentId: string | undefined;
  if (custom.parent !== undefined && !visiting.has(custom.parent)) {
    const builtIn = plantById(custom.parent);
    if (builtIn) {
      base = builtIn;
    } else {
      const parentCustom = byId.get(custom.parent);
      if (parentCustom) base = resolveCustom(parentCustom, byId, visiting).plant;
    }
    if (base) parentId = custom.parent;
  }
  const ownKeys = ownKeysOf(custom);
  if (base && parentId !== undefined) {
    return { plant: mergeOver(base, custom), inheritedFrom: 'parent', parentId, custom: true, ownKeys };
  }
  return { plant: mergeOver(CATEGORY_DEFAULTS[custom.category], custom), inheritedFrom: 'defaults', custom: true, ownKeys };
}

/**
 * Results per customPlants array, by id. The document is immutable, so an array that has not
 * changed is the same array, and the same id resolves to the same Plant object every time; that is
 * what lets the schedule's memo (keyed by plant object) hit for custom plants. Immer drafts are
 * still being changed while an op runs, so they are never cached.
 */
const resolved = new WeakMap<readonly CustomPlant[], Map<string, ResolvedPlant | undefined>>();

/**
 * The full plant for an id: a built-in plant, or a custom plant from `customPlants` merged over
 * its parent or its category's defaults. undefined when the id is neither. The array is treated as
 * immutable: change a garden through ops, never in place, or this returns the old answer.
 */
export function resolvePlant(id: string, customPlants: readonly CustomPlant[]): ResolvedPlant | undefined {
  const cacheable = !isDraft(customPlants);
  let byArray = cacheable ? resolved.get(customPlants) : undefined;
  if (byArray?.has(id)) return byArray.get(id);
  const out = resolveUncached(id, customPlants);
  if (cacheable) {
    if (!byArray) resolved.set(customPlants, (byArray = new Map()));
    byArray.set(id, out);
  }
  return out;
}

function resolveUncached(id: string, customPlants: readonly CustomPlant[]): ResolvedPlant | undefined {
  const builtIn = plantById(id);
  if (builtIn) return { plant: builtIn, inheritedFrom: null, custom: false, ownKeys: [] };
  const byId = new Map(customPlants.map((c) => [c.id, c]));
  const custom = byId.get(id);
  return custom ? resolveCustom(custom, byId, new Set()) : undefined;
}

/** Every plant the gardener can choose from: the library plus this garden's custom plants, by name. */
export function allPlants(customPlants: readonly CustomPlant[]): ResolvedPlant[] {
  const out: ResolvedPlant[] = PLANTS.map((plant) => ({ plant, inheritedFrom: null, custom: false, ownKeys: [] }));
  for (const c of customPlants) {
    // A custom plant can never shadow a built-in one (ops.ts refuses the id), but be safe.
    if (plantById(c.id)) continue;
    const r = resolvePlant(c.id, customPlants);
    if (r) out.push(r);
  }
  return out.sort((a, b) => a.plant.name.localeCompare(b.plant.name));
}

/** True when following `parentId` upward from a plant would come back to `id`. */
export function wouldCreateCycle(id: string, parentId: string, customPlants: readonly CustomPlant[]): boolean {
  const byId = new Map(customPlants.map((c) => [c.id, c]));
  const seen = new Set<string>();
  let cur: string | undefined = parentId;
  while (cur !== undefined && !seen.has(cur)) {
    if (cur === id) return true;
    seen.add(cur);
    cur = byId.get(cur)?.parent;
  }
  return false;
}
