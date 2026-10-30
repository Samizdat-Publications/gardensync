// Bring a GardenSync 7.x garden into 8.0.
//
// The old app (vanilla JS, still live at the same origin) kept everything in localStorage under a
// handful of keys, wrote JSON export files of the same data, and made `#plan=` share links. All three
// come in through the same path:
//
// 1. Read the source into one plain shape (V7Data): a list of old containers in the version 2 form
//    (version 1 saves and share links are converted first, as the old app did), plus the side data
//    (harvests, journal, planting log, custom seeds, crew).
// 2. Containers. The old canvas was 40 px per foot; 8.0 works in cm, so 1 px = 30.48 / 40 cm.
//    Rectangles (raised-bed, planter, in-ground, window-box) become grid beds on a foot grid. The old
//    app always drew the LONG side across (landscape) unless the bed was flagged `vertical`, so cols
//    is the long side and rows the short side, each rounded to whole feet (at least 1); a vertical bed
//    gets rotation 90. Circles (pot-round, grow-bag, potato-tower) become vessels; old canvasX/Y was
//    the top-left of the circle's box, a vessel's x/y is its centre.
// 3. Plants. Each old placement sat at x/y px inside its container, snapped to a 20 px grid, so its
//    square is floor(x / 40), floor(y / 40). Placements of the same plant in the same square merge
//    into one patch whose count is the number of placements; vessels have no squares, so every
//    placement of one plant in a vessel is one patch. Squares outside the bed are clamped inside.
//    Old plant ids go through an explicit table (OLD_TO_NEW, OLD_RECORDS below).
// 4. Dates. There is no climate yet, so every planting gets an `auto` anchor on this season's main
//    window (spring; overwinter for garlic; perennial for plants with a perennial record) and a
//    method from the plant's own methods. Where the old planting log has a real sow or transplant
//    date for that plant, it goes into `actual`.
// 5. Harvests (lb to g) and journal entries carry across. Everything 8.0 does not use (crew, goals,
//    the old task ticks, the raw planting log, the old custom seed records) goes into `legacy`
//    verbatim, so nothing is lost.
// 6. The result is validated against GardenSchema and the cross-reference checks in check.ts before
//    it is returned.
//
// Every function here is pure: no clock (opts.today), no randomness (opts.newId), no storage, and
// the input is never modified. Given the same input and the same newId sequence the output is the
// same. Nothing throws: failure comes back as { error }.
import * as v from 'valibot';
import { isIsoDate, partsFromDay, toDay, toIso, type IsoDate } from '../dates';
import { checkGarden } from './check';
import { PLANTS, plantById } from '../plants/library';
import type { Category, Plant } from '../plants/schema';
import {
  GardenSchema,
  type Anchor,
  type Container,
  type CustomPlant,
  type Garden,
  type GridBed,
  type Harvest,
  type JournalEntry,
  type Planting,
  type Vessel,
} from './schema';

// ---- Public types -------------------------------------------------------------------------------

export interface MigrateOptions {
  /** The day the migration runs; picks the season for new anchors and the garden's createdAt. */
  today: IsoDate;
  /** Id generator. Called in a fixed order, so a fixed sequence gives a fixed result. */
  newId: () => string;
  /** Name for the new garden. Defaults to a plain one per source. */
  name?: string;
  /**
   * The gardener's offset from UTC in minutes, local minus UTC (-300 for New York in winter, 600 for
   * Melbourne): the negative of Date.prototype.getTimezoneOffset(). 7.x stored planting-log ticks as
   * UTC timestamps, so an evening tick in New York reads as the next day without it. Default 0.
   */
  tzOffsetMinutes?: number;
}

/** Offsets beyond these do not exist (UTC-12 to UTC+14). */
const MIN_TZ_OFFSET = -12 * 60;
const MAX_TZ_OFFSET = 14 * 60;

export interface MigrationReport {
  /** Containers (beds and vessels) in the new garden. */
  containers: number;
  /** Plantings (patches) created. */
  plantings: number;
  /** Total plants: the number of old placements carried across, equal to the sum of patch counts. */
  plants: number;
  /** Old plant ids that matched nothing known, sorted. Each became a placeholder custom plant. */
  unknownPlantIds: string[];
  customPlantsCreated: number;
  harvests: number;
  journal: number;
  /** Top-level keys written into garden.legacy, sorted. */
  legacyKeys: string[];
  /** Plain sentences for the dry-run summary. */
  warnings: string[];
}

export type MigrationResult = { garden: Garden; report: MigrationReport } | { error: string };

/** The localStorage keys GardenSync 7.x wrote that hold garden data. Nothing else is read. */
export const V7_STORAGE_KEYS = [
  'gardensync_state',
  'gardensync_bed_names',
  'gardensync_bed_sizes',
  'gardensync_harvests',
  'gardensync_harvest_goal',
  'gardensync_journal',
  'gardensync_plantlog',
  'gardensync_completed_tasks',
  'gardenSyncCustomPlants',
] as const;

// ---- Units and old container types --------------------------------------------------------------

const PX_PER_FOOT = 40;
const CM_PER_FOOT = 30.48;
const CM_PER_PX = CM_PER_FOOT / PX_PER_FOOT;
const GRAMS_PER_LB = 453.59237;
/** Vessels: soil depth is taken as equal to the diameter, but no deeper than this. */
const VESSEL_MAX_DEPTH_CM = 60;
const MAX_GRID = 60;
const MAX_NOTE = 2000;
const MAX_NAME = 80;

type OldShape =
  | { shape: 'rect'; label: string; w: number; h: number; kind: GridBed['kind'] }
  | { shape: 'circle'; label: string; d: number; kind: Vessel['kind'] };

/** CONTAINER_TYPES from 7.x js/constants.js: defaults in feet, and the 8.0 kind each becomes. */
const OLD_TYPES: Record<string, OldShape> = {
  'raised-bed': { shape: 'rect', label: 'Raised Bed', w: 5, h: 10, kind: 'raised-bed' },
  planter: { shape: 'rect', label: 'Planter Box', w: 1, h: 4, kind: 'planter' },
  'in-ground': { shape: 'rect', label: 'In-Ground Plot', w: 6, h: 12, kind: 'in-ground' },
  'window-box': { shape: 'rect', label: 'Window Box', w: 0.5, h: 3, kind: 'window-box' },
  'pot-round': { shape: 'circle', label: 'Round Pot', d: 1.5, kind: 'pot' },
  'grow-bag': { shape: 'circle', label: 'Grow Bag', d: 1.5, kind: 'grow-bag' },
  'potato-tower': { shape: 'circle', label: 'Potato Tower', d: 2, kind: 'tower' },
};

// ---- Plant id mapping ---------------------------------------------------------------------------

/**
 * Generic 7.x ids and the 8.0 plant each one is. Ids that are the same in both versions are listed
 * too, so the table is the whole story. 'pepper' was Bell Pepper in 7.x and is the sweet pepper in
 * 8.0. 'sweet-peas' is deliberately absent: the ornamental sweet pea is poisonous and must never
 * become the edible pea; it becomes a custom flower from OLD_RECORDS instead.
 */
const OLD_TO_NEW: Readonly<Record<string, string>> = {
  tomato: 'tomato',
  cucumber: 'cucumber',
  lettuce: 'lettuce',
  spinach: 'spinach',
  'green-beans': 'bush-bean',
  pepper: 'pepper',
  zucchini: 'zucchini',
  radish: 'radish',
  carrot: 'carrot',
  kale: 'kale',
  onion: 'onion',
  garlic: 'garlic',
  corn: 'sweet-corn',
  broccoli: 'broccoli',
  cabbage: 'cabbage',
  beet: 'beet',
  'swiss-chard': 'swiss-chard',
  peas: 'pea',
  eggplant: 'eggplant',
  potato: 'potato',
  strawberry: 'strawberry',
  cantaloupe: 'melon',
  blueberry: 'blueberry',
  basil: 'basil',
  chive: 'chives',
  parsley: 'parsley',
  cilantro: 'cilantro',
  oregano: 'oregano',
  dill: 'dill',
  mint: 'mint',
  thyme: 'thyme',
  rosemary: 'rosemary',
  borage: 'borage',
  marigold: 'marigold',
  nasturtium: 'nasturtium',
  sunflower: 'sunflower',
  'collard-greens': 'collards',
  'sweet-alyssum': 'sweet-alyssum',
  calendula: 'calendula',
};

/** The parts of an old 7.x plant record that a custom plant can use. Weeks are relative to last frost. */
interface OldRecord {
  name: string;
  type: string;
  days: number;
  spacingIn: number | null;
  sowIndoors: number | null;
  transplant: number | null;
  direct: number | null;
  sun: string | null;
  water: string | null;
}

type OldRow = [
  parent: string | null,
  name: string,
  type: string,
  days: number,
  spacingIn: number,
  sowIndoors: number | null,
  transplant: number | null,
  direct: number | null,
  sun: string,
  water: string,
];

/**
 * 7.x records that become custom plants: the 36 seed-packet varieties, plus 'butternut-squash' (a
 * variety of winter squash, kept by name) and 'sweet-peas' (see OLD_TO_NEW). A non-null parent
 * makes a variety that inherits everything but its name and days to maturity. Judgment calls:
 * Evergreen Bunching onion is a scallion; Cocozelle is an Italian zucchini; California Blackeye
 * cowpea is grown like a bush bean, so it inherits bush bean's timing. Catnip, California poppy,
 * hollyhock, the wildflower mix and sweet peas have no 8.0 relative and are built from the old record.
 */
const OLD_ROWS: Readonly<Record<string, OldRow>> = {
  'tomato-cherokee-purple': ['tomato', 'Tomato - Cherokee Purple', 'vegetable', 82, 30, -6, 2, null, 'full', 'medium'],
  'tomato-red-brandywine': ['tomato', 'Tomato - Red Brandywine', 'vegetable', 90, 24, -7, 2, null, 'full', 'medium'],
  'tomato-roma': ['tomato', 'Tomato - Roma', 'vegetable', 80, 36, -6, 2, null, 'full', 'medium'],
  'tomato-better-boy': ['tomato', 'Tomato - Better Boy Hybrid', 'vegetable', 80, 24, -6, 2, null, 'full', 'medium'],
  'tomato-mortgage-lifter': ['tomato', 'Tomato - Mortgage Lifter', 'vegetable', 82, 30, -5, 2, null, 'full', 'medium'],
  'onion-evergreen-bunching': ['scallion', 'Onion - Evergreen Bunching', 'vegetable', 60, 3, null, null, -4, 'full', 'low'],
  'carrot-chantenay': ['carrot', 'Carrot - Chantenay', 'vegetable', 70, 3, null, null, -2, 'full', 'medium'],
  'beet-bulls-blood': ['beet', "Beet - Bull's Blood", 'vegetable', 46, 4, null, null, 1, 'full', 'medium'],
  'beet-early-wonder': ['beet', 'Beet - Tall Top Early Wonder', 'vegetable', 60, 4, null, null, -4, 'full', 'medium'],
  'pumpkin-big-max': ['pumpkin', 'Pumpkin - Big Max', 'vegetable', 120, 96, null, null, 2, 'full', 'medium'],
  'watermelon-crimson-sweet': ['watermelon', 'Watermelon - Crimson Sweet', 'vegetable', 80, 60, null, null, 2, 'full', 'high'],
  'watermelon-petite-yellow': ['watermelon', 'Watermelon - Petite Yellow', 'vegetable', 72, 72, -4, 2, 2, 'full', 'high'],
  'watermelon-dixie-queen': ['watermelon', 'Watermelon - Dixie Queen', 'vegetable', 85, 72, -4, 2, 2, 'full', 'high'],
  'cantaloupe-hearts-of-gold': ['melon', 'Cantaloupe - Hearts of Gold', 'vegetable', 90, 36, -4, 2, 1, 'full', 'medium'],
  'cantaloupe-delicious-51': ['melon', 'Cantaloupe - Delicious 51', 'vegetable', 80, 36, -4, 2, 1, 'full', 'medium'],
  'squash-cocozelle': ['zucchini', 'Squash - Cocozelle', 'vegetable', 50, 21, -3, 1, 1, 'full', 'medium'],
  'cucumber-national-pickling': ['cucumber', 'Cucumber - National Pickling', 'vegetable', 55, 48, null, null, 2, 'full', 'high'],
  'cowpeas-california-blackeye': ['bush-bean', 'Cowpeas - California Blackeye', 'vegetable', 80, 3, null, null, 2, 'full', 'medium'],
  'lettuce-lolla-rossa': ['lettuce', 'Lettuce - Lolla Rossa', 'vegetable', 50, 10, -5, 0, 1, 'full', 'medium'],
  'pea-early-frosty': ['pea', 'Pea - Early Frosty', 'vegetable', 62, 3, null, null, -6, 'full', 'medium'],
  'pea-lincoln': ['pea', 'Pea - Lincoln', 'vegetable', 62, 8, null, null, -6, 'full', 'medium'],
  'arugula-roquette': ['arugula', 'Arugula - Roquette', 'vegetable', 40, 9, null, null, -4, 'partial', 'medium'],
  'spinach-america': ['spinach', 'Spinach - America', 'vegetable', 50, 8, null, null, -4, 'partial', 'medium'],
  'dill-mammoth': ['dill', 'Dill - Mammoth', 'herb', 67, 9, null, null, 1, 'full', 'low'],
  'basil-sweet': ['basil', 'Basil - Sweet', 'herb', 85, 10, -6, 1, 1, 'full', 'medium'],
  'parsley-flat-italian': ['parsley', 'Parsley - Flat Italian', 'herb', 75, 10, -6, null, -4, 'partial', 'medium'],
  catnip: [null, 'Catnip', 'herb', 72, 20, null, null, 1, 'full', 'low'],
  'california-poppy-mission-bells': [null, 'California Poppy - Mission Bells', 'flower', 80, 6, null, null, -4, 'full', 'low'],
  'marigold-crackerjack': ['marigold', 'Marigold - Crackerjack Mixed', 'flower', 52, 12, -7, 1, 1, 'full', 'low'],
  'marigold-french-dwarf': ['marigold', 'Marigold - French Double Dwarf', 'flower', 52, 8, -7, 1, 1, 'full', 'low'],
  'zinnia-california-giants': ['zinnia', 'Zinnia - California Giants Mixed', 'flower', 47, 15, -4, 1, 1, 'full', 'low'],
  'zinnia-state-fair': ['zinnia', 'Zinnia - State Fair Giant Mixed', 'flower', 47, 12, -4, 1, 1, 'full', 'low'],
  'nasturtium-alaska': ['nasturtium', 'Nasturtium - Alaska Mixed', 'flower', 36, 10, null, null, 1, 'full', 'low'],
  'nasturtium-tall-single': ['nasturtium', 'Nasturtium - Tall Single Mixed', 'flower', 36, 10, null, null, 1, 'full', 'low'],
  'hollyhock-summer-carnival': [null, 'Hollyhock - Summer Carnival Mixed', 'flower', 100, 24, -7, 1, 1, 'full', 'medium'],
  'wildflower-birds-butterfly': [null, 'Wildflower - Birds & Butterfly Mix', 'flower', 49, 6, null, null, 0, 'full', 'low'],
  'butternut-squash': ['winter-squash', 'Butternut Squash', 'vegetable', 110, 36, -3, 2, 1, 'full', 'medium'],
  'sweet-peas': [null, 'Sweet Peas', 'flower', 65, 6, -6, -2, -4, 'full', 'medium'],
};

/** Old names of the generic ids, used to guess the parent of a gardener's own custom seed. */
const OLD_GENERIC_NAMES: Readonly<Record<string, string>> = {
  'green beans': 'bush-bean',
  'garden peas': 'pea',
  'sweet corn': 'sweet-corn',
  'bell pepper': 'pepper',
  cantaloupe: 'melon',
  'collard greens': 'collards',
  'butternut squash': 'winter-squash',
};

/** Plants that 7.x placed in spring but that 8.0 schedules as an autumn planting for next year. */
const OVERWINTER_IDS: ReadonlySet<string> = new Set(['garlic']);

// ---- Small readers for untrusted JSON -----------------------------------------------------------

type Obj = Record<string, unknown>;

const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const num = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);
const str = (x: unknown): string | undefined => (typeof x === 'string' ? x : undefined);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const round2 = (x: number) => Math.round(x * 100) / 100;

/** A number, or a string holding one (old form fields were saved either way). */
function numLike(x: unknown): number | undefined {
  if (typeof x === 'number') return Number.isFinite(x) ? x : undefined;
  if (typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x))) return Number(x);
  return undefined;
}

/** The ISO date part of a date or date-time string ("2026-05-02T13:00:00Z" gives "2026-05-02"). */
function isoDatePart(x: unknown): IsoDate | undefined {
  const s = str(x);
  if (!s) return undefined;
  const d = s.slice(0, 10);
  return isIsoDate(d) ? d : undefined;
}

const TIMESTAMP_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

/**
 * The gardener's local date of a timestamp with a zone ("2026-05-02T01:30:00.000Z" at -300 gives
 * "2026-05-01"), worked out in whole minutes with no Date object. A plain date, or a time with no
 * zone, is taken as already local.
 */
function localDatePart(x: unknown, tzOffsetMinutes: number): IsoDate | undefined {
  const s = str(x);
  if (!s) return undefined;
  const m = TIMESTAMP_RE.exec(s);
  if (!m || !isIsoDate(m[1]!)) return isoDatePart(s);
  const zone = m[5]!;
  const zoneMinutes = zone === 'Z' ? 0 : (zone[0] === '-' ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(-2)));
  const utcMinutes = Number(m[2]) * 60 + Number(m[3]) - zoneMinutes;
  const local = utcMinutes + tzOffsetMinutes;
  const out = toIso(toDay(m[1]!) + Math.floor(local / 1440));
  return isIsoDate(out) ? out : undefined;
}

/**
 * Old names went through escapeHtml when a 7.x share link was loaded, so a saved name can hold
 * "&amp;". Undo the five entities that function wrote; 8.0 escapes at render time instead.
 */
function unescapeOld(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&');
}

/** A name that passes the schema: trimmed, 1-80 characters, with a fallback. */
function cleanName(x: unknown, fallback: string): string {
  const s = typeof x === 'string' ? unescapeOld(x).trim() : '';
  return (s || fallback).slice(0, MAX_NAME).trim() || fallback;
}

function safeJsonParse(s: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(s) as unknown };
  } catch {
    return { ok: false };
  }
}

const isEmptyish = (x: unknown) =>
  x === undefined || x === null || x === '' || (Array.isArray(x) && x.length === 0) || (isObj(x) && Object.keys(x).length === 0);

/** Top-level export keys that must never be copied into legacy, whatever a hand-edited file holds. */
const SECRET_KEY = /key|token|secret|password/i;

// ---- The common shape every source is read into -------------------------------------------------

type Source = 'gardensync-7-storage' | 'gardensync-7-export' | 'gardensync-7-share';

interface V7Data {
  source: Source;
  defaultName: string;
  /** Old containers in the version 2 form ({ id, type, name, canvasX, canvasY, w, h, diameter, vertical, plants, notes, volunteer }). */
  containers: unknown[];
  volunteers?: unknown;
  bedAssignments?: unknown;
  plantingLog?: unknown;
  harvests?: unknown;
  journal?: unknown;
  completedTasks?: unknown;
  harvestGoal?: unknown;
  customSeeds?: unknown;
  /** Old canvas zoom and pan. */
  view?: unknown;
  /** Extra keys kept verbatim (export date, unknown top-level keys of an export file). */
  extra: Obj;
  /** Values that could not be parsed, kept as the raw text. */
  unreadable: Obj;
  warnings: string[];
}

/**
 * The old version 1 save: four beds as arrays of placements, with names and sizes in their own
 * keys. Mirrors migrateV1ToV2 in 7.x js/state.js, including its canvas positions.
 */
function containersFromV1(state: Obj, bedNames: unknown, bedSizes: unknown): unknown[] {
  const beds = Array.isArray(state.beds) ? state.beds : [];
  const names = Array.isArray(bedNames) ? bedNames : [];
  const sizes = Array.isArray(bedSizes) ? bedSizes : [];
  const assignments = Array.isArray(state.bedAssignments) ? state.bedAssignments : [];
  const out: unknown[] = [];
  for (let i = 0; i < Math.max(4, beds.length); i++) {
    const size = isObj(sizes[i]) ? (sizes[i] as Obj) : {};
    out.push({
      id: `bed-migrated-${i}`,
      type: 'raised-bed',
      name: str(names[i]) ?? `BED ${i + 1}`,
      canvasX: 50 + (i % 2) * 450,
      canvasY: 50 + Math.floor(i / 2) * 280,
      w: num(size.w) ?? 5,
      h: num(size.h) ?? 10,
      diameter: null,
      plants: Array.isArray(beds[i]) ? beds[i] : [],
      notes: '',
      volunteer: assignments[i] ?? null,
    });
  }
  return out;
}

// ---- Plant resolution ---------------------------------------------------------------------------

/** What the old planting log says happened to one old plant id. */
interface LogEvidence {
  startedIndoors?: IsoDate;
  transplanted?: IsoDate;
  directSown?: IsoDate;
}

/** A resolved plant: the 8.0 id, and the record that supplies its methods and window. */
interface Resolved {
  id: string;
  /** The built-in plant, or for a variety its parent. Absent for an orphan custom plant. */
  base?: Plant;
  /** Methods and maturity for orphan custom plants (built from the old record). */
  methods?: Plant['methods'];
  maturityFrom?: 'sow' | 'transplant';
}

/** Earliest week a crop went outdoors in 7.x, read as a frost tolerance. */
function frostFromWeeks(rec: OldRecord): Plant['frost'] {
  const weeks = [rec.transplant, rec.direct].filter((w): w is number => w !== null);
  if (weeks.length === 0) return 'tender';
  const earliest = Math.min(...weeks);
  if (earliest <= -4) return 'hardy';
  if (earliest < 0) return 'half-hardy';
  return 'tender';
}

/**
 * Sowing windows from an old record. 7.x stored one week per method; 8.0 wants a range, so each
 * becomes [week, week + 2]. Indoor age is the gap between the indoor sowing and the transplant.
 */
function methodsFromOld(rec: OldRecord): Plant['methods'] | undefined {
  const m: Plant['methods'] = {};
  if (rec.direct !== null) m.direct = { weeks: [rec.direct, rec.direct + 2] };
  if (rec.transplant !== null) m.transplant = { weeks: [rec.transplant, rec.transplant + 2] };
  if (rec.sowIndoors !== null && rec.transplant !== null && rec.transplant > rec.sowIndoors) {
    const age = rec.transplant - rec.sowIndoors;
    m.indoor = { ageWeeks: [age, age] };
  }
  return m.direct || m.transplant ? m : undefined;
}

function recordFromRow(row: OldRow): OldRecord {
  const [, name, type, days, spacingIn, sowIndoors, transplant, direct, sun, water] = row;
  return { name, type, days, spacingIn, sowIndoors, transplant, direct, sun, water };
}

/** An old custom seed (gardenSyncCustomPlants). 7.x scheduled every one at +2 weeks transplant, 0 direct. */
function recordFromCustomSeed(seed: Obj): OldRecord {
  return {
    name: cleanName(seed.name, 'Custom plant'),
    type: str(seed.type) ?? 'vegetable',
    days: numLike(seed.daysToHarvest) ?? 60,
    spacingIn: numLike(seed.spacing) ?? null,
    sowIndoors: null,
    transplant: 2,
    direct: 0,
    sun: str(seed.sunNeed) ?? null,
    water: str(seed.waterNeed) ?? null,
  };
}

const CATEGORY_SET: ReadonlySet<string> = new Set<Category>(['vegetable', 'herb', 'fruit', 'flower']);

class PlantMapper {
  readonly customPlants: CustomPlant[] = [];
  private readonly byOldId = new Map<string, Resolved>();
  private readonly unknownCounts = new Map<string, number>();

  constructor(private readonly newId: () => string) {}

  /** Register an old custom seed so placements of its id find it. */
  addCustomSeed(seed: Obj): void {
    const oldId = str(seed.id);
    if (!oldId || this.byOldId.has(oldId)) return;
    const rec = recordFromCustomSeed(seed);
    this.byOldId.set(oldId, this.makeCustom(rec, guessParent(rec.name)));
  }

  /** The 8.0 plant for an old id, creating a custom plant the first time one is needed. */
  resolve(oldId: string): Resolved {
    const known = this.byOldId.get(oldId);
    if (known) return known;
    let r: Resolved;
    const mapped = OLD_TO_NEW[oldId];
    const row = OLD_ROWS[oldId];
    const builtIn = mapped ? plantById(mapped) : undefined;
    if (builtIn) {
      r = { id: builtIn.id, base: builtIn };
    } else if (row) {
      r = this.makeCustom(recordFromRow(row), row[0] ? plantById(row[0]) : undefined);
    } else if (plantById(oldId)) {
      // Already an 8.0 id (a hand-edited file, or a crop 7.x never had under another name).
      const p = plantById(oldId) as Plant;
      r = { id: p.id, base: p };
    } else {
      r = this.makeCustom(placeholderRecord(oldId), undefined);
      this.unknownCounts.set(oldId, 0);
    }
    this.byOldId.set(oldId, r);
    return r;
  }

  /** Count one use of an old id that matched nothing (for the report). */
  countUse(oldId: string): void {
    const n = this.unknownCounts.get(oldId);
    if (n !== undefined) this.unknownCounts.set(oldId, n + 1);
  }

  get unknown(): ReadonlyMap<string, number> {
    return this.unknownCounts;
  }

  private makeCustom(rec: OldRecord, parent: Plant | undefined): Resolved {
    const id = this.newId();
    const days = Math.max(1, Math.round(rec.days) || 60);
    if (parent) {
      this.customPlants.push({
        id,
        name: rec.name,
        parent: parent.id,
        category: parent.category,
        frost: parent.frost,
        maturity: { days, from: parent.maturity.from },
      });
      return { id, base: parent };
    }
    const methods = methodsFromOld(rec);
    const maturityFrom = rec.sowIndoors !== null && rec.direct === null ? 'transplant' : 'sow';
    const custom: CustomPlant = {
      id,
      name: rec.name,
      category: (CATEGORY_SET.has(rec.type) ? rec.type : 'vegetable') as Category,
      frost: frostFromWeeks(rec),
      maturity: { days, from: maturityFrom },
    };
    if (rec.sun === 'full' || rec.sun === 'partial' || rec.sun === 'shade') custom.sun = rec.sun;
    if (rec.water === 'low' || rec.water === 'medium' || rec.water === 'high') custom.water = rec.water;
    if (rec.spacingIn !== null && rec.spacingIn > 0) {
      const cm = Math.max(1, Math.round(rec.spacingIn * 2.54));
      custom.spacingCm = { inRow: cm, betweenRows: cm };
    }
    if (methods) custom.methods = methods;
    this.customPlants.push(custom);
    return { id, methods, maturityFrom };
  }
}

/** For an id nobody knows: a name from the id ("custom-thai-basil-1712345678901" gives "Thai Basil"). */
function placeholderRecord(oldId: string): OldRecord {
  const words = oldId
    .replace(/^custom-/, '')
    .replace(/-\d{6,}$/, '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return {
    name: cleanName(words.join(' '), 'Unknown plant'),
    type: 'vegetable',
    days: 60,
    spacingIn: null,
    sowIndoors: null,
    transplant: null,
    direct: null,
    sun: null,
    water: null,
  };
}

/**
 * The built-in plant a gardener's own seed is a variety of, judged only from the part of its name
 * before " - " ("Tomato - Sungold" is a tomato). Exact name or id matches only, so a doubtful
 * name gets no parent rather than a wrong one.
 */
function guessParent(name: string): Plant | undefined {
  const head = name.split(/\s+[-–]\s+/)[0]?.trim().toLowerCase() ?? '';
  if (!head) return undefined;
  const viaOld = OLD_GENERIC_NAMES[head];
  if (viaOld) return plantById(viaOld);
  return PLANTS.find((p) => p.name.toLowerCase() === head || p.id === head.replace(/\s+/g, '-'));
}

/** Parse the old planting log ({ "<plantId>-seed-indoor": { done, completedAt } }) into evidence per plant. */
function readPlantingLog(log: unknown, tzOffsetMinutes: number): Map<string, LogEvidence> {
  const out = new Map<string, LogEvidence>();
  if (!isObj(log)) return out;
  const kinds: [string, keyof LogEvidence][] = [
    ['-seed-indoor', 'startedIndoors'],
    ['-transplant', 'transplanted'],
    ['-direct-sow', 'directSown'],
  ];
  for (const [key, entry] of Object.entries(log)) {
    if (!isObj(entry) || entry.done !== true) continue;
    // completedAt was written with toISOString(): a UTC timestamp, turned into the gardener's date.
    const date = localDatePart(entry.completedAt, tzOffsetMinutes);
    if (!date) continue;
    for (const [suffix, field] of kinds) {
      if (!key.endsWith(suffix)) continue;
      const plantId = key.slice(0, -suffix.length);
      const ev = out.get(plantId) ?? {};
      if (!ev[field] || date < (ev[field] as string)) ev[field] = date;
      out.set(plantId, ev);
    }
  }
  return out;
}

// ---- Plantings: method and anchor ---------------------------------------------------------------

/** The growing season (calendar year) a date belongs to. */
const yearOfIso = (d: IsoDate) => partsFromDay(toDay(d)).year;
/** For an overwinter crop: planted from July on, it is harvested (its season) the next year. */
const harvestSeasonOf = (d: IsoDate) => {
  const { year, month } = partsFromDay(toDay(d));
  return month >= 7 ? year + 1 : year;
};

/**
 * How the planting goes in. What the old log recorded wins when the plant allows it; otherwise
 * set-grown crops (garlic, potatoes, crowns) are 'plant', crops whose maturity counts from sowing
 * are 'direct' when they can be direct sown, and the rest are started indoors and transplanted.
 */
function chooseMethod(
  methods: Plant['methods'] | undefined,
  maturityFrom: 'sow' | 'transplant' | undefined,
  ev: LogEvidence | undefined,
): Planting['method'] {
  if (!methods) return 'transplant';
  const canIndoor = !!(methods.indoor && methods.transplant);
  if (ev?.startedIndoors && canIndoor) return 'indoor';
  if (ev?.directSown && methods.direct) return 'direct';
  if (ev?.transplanted && methods.transplant) return 'transplant';
  if (methods.plant && !methods.direct && !methods.transplant) return 'plant';
  if (methods.direct && maturityFrom === 'sow') return 'direct';
  if (canIndoor) return 'indoor';
  if (methods.transplant) return 'transplant';
  if (methods.direct) return 'direct';
  return 'plant';
}

function makeAnchor(r: Resolved, today: IsoDate, actual: Planting['actual']): Anchor {
  const base = r.base;
  const when = actual?.bedIn ?? actual?.startedIndoors;
  if (base?.perennial) {
    return { kind: 'auto', window: 'perennial', season: yearOfIso(when ?? today), offsetDays: 0 };
  }
  if (base && OVERWINTER_IDS.has(base.id)) {
    return { kind: 'auto', window: 'overwinter', season: harvestSeasonOf(actual?.bedIn ?? today), offsetDays: 0 };
  }
  return { kind: 'auto', window: 'spring', season: yearOfIso(when ?? today), offsetDays: 0 };
}

// ---- Containers ---------------------------------------------------------------------------------

/** A converted container and how to find the 8.0 square of an old placement in it. */
interface ConvertedContainer {
  container: Container;
  /** The old container object, read only. */
  raw: Obj;
  oldId: string | undefined;
  volunteer: unknown;
  /** The cell for an old placement (px within the old element), clamped; null for vessels. */
  cellOf: ((x: number, y: number) => { col: number; row: number; clamped: boolean }) | null;
}

/**
 * Litres for a round vessel: a cylinder of the given diameter, as deep as it is wide but no deeper
 * than VESSEL_MAX_DEPTH_CM. A 1.5 ft (46 cm) grow bag gives 75 L, close to the 20 gallons such bags
 * are sold as; a 4 ft tower is capped at about 700 L.
 */
export function vesselLitres(diameterCm: number): number {
  const depth = Math.min(diameterCm, VESSEL_MAX_DEPTH_CM);
  const litres = (Math.PI * (diameterCm / 2) ** 2 * depth) / 1000;
  return clamp(Math.round(litres), 1, 2000);
}

function convertContainer(raw: Obj, id: string): ConvertedContainer {
  const type = OLD_TYPES[str(raw.type) ?? ''] ?? (OLD_TYPES['raised-bed'] as OldShape);
  const name = cleanName(raw.name, type.label);
  const leftPx = num(raw.canvasX) ?? 40;
  const topPx = num(raw.canvasY) ?? 40;
  const notesRaw = typeof raw.notes === 'string' ? raw.notes.trim() : '';
  const notes = notesRaw ? notesRaw.slice(0, MAX_NOTE) : undefined;
  const base = { raw, oldId: str(raw.id), volunteer: raw.volunteer ?? null };

  if (type.shape === 'circle') {
    // `container.diameter || default`, as 7.x drew it.
    const ft = num(raw.diameter) || type.d;
    const diameterCm = clamp(round2(ft * CM_PER_FOOT), 10, 300);
    const vessel: Vessel = {
      id,
      form: 'vessel',
      kind: type.kind,
      name,
      x: clampCm(leftPx * CM_PER_PX + diameterCm / 2),
      y: clampCm(topPx * CM_PER_PX + diameterCm / 2),
      diameterCm,
      litres: vesselLitres(diameterCm),
    };
    if (notes) vessel.notes = notes;
    return { ...base, container: vessel, cellOf: null };
  }

  const w = num(raw.w) || type.w;
  const h = num(raw.h) || type.h;
  const cols = clamp(Math.round(Math.max(w, h)), 1, MAX_GRID);
  const rows = clamp(Math.round(Math.min(w, h)), 1, MAX_GRID);
  const vertical = raw.vertical === true;
  const bed: GridBed = {
    id,
    form: 'grid',
    kind: type.kind,
    name,
    x: clampCm(leftPx * CM_PER_PX),
    y: clampCm(topPx * CM_PER_PX),
    cols,
    rows,
    rotation: vertical ? 90 : 0,
  };
  if (notes) bed.notes = notes;

  const cellOf = (x: number, y: number) => {
    // Square on screen, in the frame 7.x drew the bed in.
    const sx = Math.floor(x / PX_PER_FOOT);
    const sy = Math.floor(y / PX_PER_FOOT);
    // Landscape: the screen frame is the bed's own frame. Portrait (rotation 90, a quarter turn
    // clockwise): the bed's columns run down the screen and its rows run from right to left.
    const col = vertical ? sy : sx;
    const row = vertical ? rows - 1 - sx : sy;
    const cc = clamp(col, 0, cols - 1);
    const rr = clamp(row, 0, rows - 1);
    return { col: cc, row: rr, clamped: cc !== col || rr !== row };
  };
  return { ...base, container: bed, cellOf };
}

const clampCm = (cm: number) => clamp(round2(cm), -100_000, 100_000);

// ---- The builder --------------------------------------------------------------------------------

interface Patch {
  containerId: string;
  plant: Resolved;
  oldPlantId: string;
  cells?: { col: number; row: number; w: number; h: number };
  count: number;
}

function buildGarden(data: V7Data, opts: MigrateOptions): MigrationResult {
  if (!isIsoDate(opts.today)) return { error: `Today's date must be YYYY-MM-DD, not "${opts.today}".` };
  const tz = opts.tzOffsetMinutes ?? 0;
  if (!Number.isInteger(tz) || tz < MIN_TZ_OFFSET || tz > MAX_TZ_OFFSET) {
    return { error: `The time zone offset must be a whole number of minutes from ${MIN_TZ_OFFSET} to ${MAX_TZ_OFFSET}.` };
  }
  const warnings = [...data.warnings];
  const legacy: Obj = { source: data.source };
  const truncated: Obj[] = [];
  const skipped: Obj[] = [];

  const gardenId = opts.newId();

  // Containers, deduplicated by old id as 7.x did (first one wins).
  const converted: ConvertedContainer[] = [];
  const seenOld = new Set<string>();
  let badContainers = 0;
  for (const raw of data.containers) {
    if (!isObj(raw)) {
      badContainers++;
      skipped.push({ container: raw ?? null });
      continue;
    }
    const oldId = str(raw.id);
    if (oldId !== undefined) {
      if (seenOld.has(oldId)) {
        skipped.push({ duplicateContainer: raw });
        warnings.push(`A second container with the id "${oldId}" was skipped, as GardenSync 7 did. It is kept in the legacy data.`);
        continue;
      }
      seenOld.add(oldId);
    }
    const c = convertContainer(raw, opts.newId());
    if (typeof raw.notes === 'string' && raw.notes.trim().length > MAX_NOTE) {
      truncated.push({ container: c.container.id, notes: raw.notes });
      warnings.push(`The notes on ${c.container.name} were longer than 2000 characters and were shortened. The full text is kept in the legacy data.`);
    }
    converted.push(c);
  }
  if (badContainers > 0) warnings.push(`${badContainers} unreadable container entries were skipped.`);
  const containers = converted.map((c) => c.container);
  const idByOld = new Map<string, string>();
  for (const c of converted) if (c.oldId !== undefined) idByOld.set(c.oldId, c.container.id);

  // Custom seeds first, so placements of their ids find them.
  const mapper = new PlantMapper(opts.newId);
  if (Array.isArray(data.customSeeds)) {
    for (const seed of data.customSeeds) if (isObj(seed)) mapper.addCustomSeed(seed);
  }

  // Placements into patches, keyed by container, square and plant, in order of first appearance.
  const patches = new Map<string, Patch>();
  let plantsIn = 0;
  let badPlacements = 0;
  converted.forEach((conv, ci) => {
    const placements = Array.isArray(conv.raw.plants) ? conv.raw.plants : [];
    let clamped = 0;
    let atOrigin = 0;
    for (const p of placements) {
      const plantId = isObj(p) ? str(p.plantId) : undefined;
      if (!isObj(p) || !plantId) {
        badPlacements++;
        skipped.push({ container: conv.container.id, placement: p ?? null });
        continue;
      }
      const x = Math.max(0, num(p.x) ?? 0);
      const y = Math.max(0, num(p.y) ?? 0);
      if (x === 0 && y === 0) atOrigin++;
      const plant = mapper.resolve(plantId);
      mapper.countUse(plantId);
      plantsIn++;
      let key = `${ci}|${plant.id}`;
      let cells: Patch['cells'];
      if (conv.cellOf) {
        const cell = conv.cellOf(x, y);
        if (cell.clamped) clamped++;
        cells = { col: cell.col, row: cell.row, w: 1, h: 1 };
        key += `|${cell.col},${cell.row}`;
      }
      const existing = patches.get(key);
      if (existing) existing.count++;
      else patches.set(key, { containerId: conv.container.id, plant, oldPlantId: plantId, cells, count: 1 });
    }
    const name = conv.container.name;
    if (clamped > 0) {
      warnings.push(`${clamped} ${clamped === 1 ? 'plant' : 'plants'} in ${name} sat outside the bed and moved to the nearest square inside it.`);
    }
    if (conv.cellOf && placements.length > 1 && atOrigin === placements.length) {
      warnings.push(`The ${placements.length} plants in ${name} were never arranged in GardenSync 7, so each kind is one patch in the corner square. Spread them out in the planner.`);
    }
  });
  if (badPlacements > 0) warnings.push(`${badPlacements} unreadable plant entries were skipped. They are kept in the legacy data.`);

  // Plantings, with the method and real dates from the old planting log.
  const evidence = readPlantingLog(data.plantingLog, tz);
  const plantings: Planting[] = [];
  let withActual = 0;
  for (const patch of patches.values()) {
    const ev = evidence.get(patch.oldPlantId);
    const methods = patch.plant.base?.methods ?? patch.plant.methods;
    const maturityFrom = patch.plant.base?.maturity.from ?? patch.plant.maturityFrom;
    const method = chooseMethod(methods, maturityFrom, ev);
    let actual: Planting['actual'];
    if (ev && (ev.startedIndoors || ev.transplanted || ev.directSown)) {
      actual = {};
      if (ev.startedIndoors) actual.startedIndoors = ev.startedIndoors;
      const bedIn = method === 'direct' ? (ev.directSown ?? ev.transplanted) : (ev.transplanted ?? ev.directSown);
      if (bedIn) actual.bedIn = bedIn;
      // 8.0 refuses a planting that went in before its seeds were started; the bed-in date is the
      // one the gardener most likely ticked on the day, so the indoor date gives way.
      if (actual.startedIndoors && actual.bedIn && actual.startedIndoors > actual.bedIn) {
        delete actual.startedIndoors;
        warnings.push(`The old planting log says ${patch.plant.id} went in before its seeds were started, so the indoor date was left out.`);
      }
      withActual++;
    }
    const planting: Planting = {
      id: opts.newId(),
      containerId: patch.containerId,
      plantId: patch.plant.id,
      count: Math.min(patch.count, 10_000),
      method,
      anchor: makeAnchor(patch.plant, opts.today, actual),
    };
    if (patch.cells) planting.cells = patch.cells;
    if (actual) planting.actual = actual;
    plantings.push(planting);
  }
  if (withActual > 0) {
    warnings.push(`${withActual} ${withActual === 1 ? 'planting has' : 'plantings have'} real sowing dates from the old planting log.`);
  }

  // Harvests.
  const harvests: Harvest[] = [];
  const harvestMeta: Obj[] = [];
  if (data.harvests !== undefined && !Array.isArray(data.harvests)) {
    warnings.push('The harvest log was not a list and was not read. It is kept in the legacy data.');
    legacy.harvestLog = data.harvests;
  }
  let badHarvests = 0;
  for (const h of Array.isArray(data.harvests) ? data.harvests : []) {
    const oldPlant = isObj(h) ? (str(h.plantId) ?? str(h.plant)) : undefined;
    const date = isObj(h) ? (isoDatePart(h.date) ?? isoDatePart(h.timestamp)) : undefined;
    if (!isObj(h) || !oldPlant || !date) {
      badHarvests++;
      skipped.push({ harvest: h ?? null });
      continue;
    }
    const plant = mapper.resolve(oldPlant);
    mapper.countUse(oldPlant);
    const containerId = containerForBed(h.bed, converted);
    const planting = containerId ? plantings.find((p) => p.containerId === containerId && p.plantId === plant.id) : undefined;
    const harvest: Harvest = { id: opts.newId(), plantId: plant.id, date };
    if (planting) harvest.plantingId = planting.id;
    const lb = numLike(h.weight);
    if (lb !== undefined && lb > 0) harvest.grams = clamp(Math.round(lb * GRAMS_PER_LB * 10) / 10, 0, 1_000_000);
    const note = typeof h.notes === 'string' ? h.notes.trim() : '';
    if (note) {
      harvest.note = note.slice(0, MAX_NOTE);
      if (note.length > MAX_NOTE) truncated.push({ harvest: harvest.id, notes: h.notes });
    }
    harvests.push(harvest);
    const meta: Obj = { harvestId: harvest.id };
    if (h.id !== undefined) meta.oldId = h.id;
    if (h.bed !== undefined) meta.bed = h.bed;
    if (containerId) meta.containerId = containerId;
    if (h.donated !== undefined) meta.donated = h.donated;
    if (h.timestamp !== undefined) meta.timestamp = h.timestamp;
    harvestMeta.push(meta);
  }
  if (badHarvests > 0) warnings.push(`${badHarvests} harvest entries had no plant or date and were not imported. They are kept in the legacy data.`);

  // Journal: { "container-<oldId>" | "bed-<index>" | "container-none": [{ id, text, date }] }.
  const journal: JournalEntry[] = [];
  let badJournal = 0;
  const journalLists: [string, unknown][] = Array.isArray(data.journal)
    ? [['container-none', data.journal]]
    : isObj(data.journal)
      ? Object.entries(data.journal)
      : [];
  if (data.journal !== undefined && journalLists.length === 0 && !isEmptyish(data.journal)) {
    legacy.journalRaw = data.journal;
    warnings.push('The journal was in a form this version does not read. It is kept in the legacy data.');
  }
  for (const [key, list] of journalLists) {
    const containerId = containerForJournalKey(key, idByOld, converted);
    for (const e of Array.isArray(list) ? list : [list]) {
      const text = isObj(e) && typeof e.text === 'string' ? e.text.trim() : '';
      const date = isObj(e) ? isoDatePart(e.date) : undefined;
      if (!text || !date) {
        badJournal++;
        skipped.push({ journalKey: key, entry: e ?? null });
        continue;
      }
      const entry: JournalEntry = { id: opts.newId(), date, text: text.slice(0, MAX_NOTE) };
      if (containerId) entry.containerId = containerId;
      if (text.length > MAX_NOTE) truncated.push({ journal: entry.id, text });
      journal.push(entry);
    }
  }
  if (badJournal > 0) warnings.push(`${badJournal} journal entries had no text or date and were not imported. They are kept in the legacy data.`);
  if (truncated.length > 0 && !warnings.some((w) => w.includes('shortened'))) {
    warnings.push(`${truncated.length} notes were longer than 2000 characters and were shortened. The full text is kept in the legacy data.`);
  }

  // Unknown ids.
  const unknownPlantIds = [...mapper.unknown.keys()].sort();
  if (unknownPlantIds.length > 0) {
    const uses = [...mapper.unknown.values()].reduce((a, b) => a + b, 0);
    warnings.push(
      `${unknownPlantIds.length} plant ${unknownPlantIds.length === 1 ? 'id' : 'ids'} (${unknownPlantIds.join(', ')}) matched nothing known, across ${uses} ${uses === 1 ? 'use' : 'uses'}. Each became a custom plant you can edit.`,
    );
  }

  // Legacy: everything 8.0 does not use, verbatim.
  const containerIds: Obj = {};
  const crew: Obj = {};
  for (const c of converted) {
    if (c.oldId !== undefined) containerIds[c.container.id] = c.oldId;
    if (c.volunteer !== null && c.volunteer !== undefined && c.volunteer !== '') crew[c.container.id] = c.volunteer;
  }
  const put = (key: string, value: unknown) => {
    if (!isEmptyish(value)) legacy[key] = value;
  };
  put('containerIds', containerIds);
  put('volunteers', data.volunteers);
  put('crewAssignments', crew);
  put('bedAssignments', data.bedAssignments);
  put('harvestGoal', data.harvestGoal);
  put('harvests', harvestMeta);
  put('plantingLog', data.plantingLog);
  put('completedTasks', data.completedTasks);
  put('customSeeds', data.customSeeds);
  put('view', data.view);
  for (const [k, val] of Object.entries(data.extra)) put(k, val);
  put('unreadable', data.unreadable);
  put('truncated', truncated);
  put('skipped', skipped);

  const garden: Garden = {
    id: gardenId,
    name: cleanName(opts.name, data.defaultName),
    createdAt: opts.today,
    cellCm: CM_PER_FOOT,
    climate: null,
    containers,
    plantings,
    series: [],
    harvests,
    journal,
    customPlants: mapper.customPlants,
    taskState: {},
    legacy,
  };

  const parsed = v.safeParse(GardenSchema, garden);
  if (!parsed.success) {
    const issue = parsed.issues[0];
    return { error: `The imported garden did not pass validation at ${v.getDotPath(issue) ?? '(root)'}: ${issue.message}` };
  }
  const problem = checkGarden(parsed.output)[0];
  if (problem) return { error: `The imported garden does not fit together: ${problem.message}` };

  const plantsOut = plantings.reduce((s, p) => s + p.count, 0);
  if (plantsOut !== plantsIn) warnings.push(`${plantsIn - plantsOut} plants did not fit the 10,000 per patch limit.`);
  return {
    garden: parsed.output,
    report: {
      containers: containers.length,
      plantings: plantings.length,
      plants: plantsOut,
      unknownPlantIds,
      customPlantsCreated: mapper.customPlants.length,
      harvests: harvests.length,
      journal: journal.length,
      legacyKeys: Object.keys(legacy).sort(),
      warnings,
    },
  };
}

/**
 * The container an old harvest's `bed` field points at. The 7.x form saved a 1-based bed number
 * (BED 1 to BED 4, which were the first four containers); the harvest-burst shortcut saved the
 * container's name. Anything else, or a number past the end, gives no container.
 */
function containerForBed(bed: unknown, converted: readonly ConvertedContainer[]): string | undefined {
  const n = numLike(bed);
  if (n !== undefined) return Number.isInteger(n) && n >= 1 ? converted[n - 1]?.container.id : undefined;
  const name = typeof bed === 'string' ? unescapeOld(bed).trim() : '';
  if (!name) return undefined;
  const exact = converted.filter((c) => c.container.name === name);
  if (exact.length === 1) return exact[0]?.container.id;
  const loose = converted.filter((c) => c.container.name.toLowerCase() === name.toLowerCase());
  return loose.length === 1 ? loose[0]?.container.id : undefined;
}

/** The container a 7.x journal key belongs to: "container-<old id>", or "bed-<index>" from 6.x. */
function containerForJournalKey(
  key: string,
  idByOld: ReadonlyMap<string, string>,
  converted: readonly ConvertedContainer[],
): string | undefined {
  if (key === 'container-none') return undefined;
  if (key.startsWith('container-')) return idByOld.get(key.slice('container-'.length));
  const m = /^bed-(\d+)$/.exec(key);
  return m ? converted[Number(m[1])]?.container.id : undefined;
}

/** Plain words for each storage key, for warnings. */
const KEY_WORDS: Readonly<Record<string, string>> = {
  gardensync_bed_names: 'bed names',
  gardensync_bed_sizes: 'bed sizes',
  gardensync_harvests: 'harvest log',
  gardensync_harvest_goal: 'harvest goal',
  gardensync_journal: 'journal',
  gardensync_plantlog: 'planting log',
  gardensync_completed_tasks: 'ticked tasks',
  gardenSyncCustomPlants: 'custom seeds',
};

/** Canvas zoom and pan, kept only so nothing is lost. */
function viewOf(state: Obj): Obj | undefined {
  const view: Obj = {};
  for (const k of ['canvasZoom', 'canvasOffsetX', 'canvasOffsetY']) if (state[k] !== undefined) view[k] = state[k];
  return Object.keys(view).length > 0 ? view : undefined;
}

/** Old containers from a 7.x state object (v2 `containers`, or v1 `beds`), or null if it has neither. */
function containersOf(state: Obj, bedNames: unknown, bedSizes: unknown): unknown[] | null {
  if (Array.isArray(state.containers)) return state.containers;
  if (Array.isArray(state.beds)) return containersFromV1(state, bedNames, bedSizes);
  return null;
}

/** The volunteer for a container: its own field, else the old index-based bedAssignments list. */
function withAssignments(containers: unknown[], bedAssignments: unknown): unknown[] {
  if (!Array.isArray(bedAssignments)) return containers;
  return containers.map((c, i) =>
    isObj(c) && (c.volunteer === null || c.volunteer === undefined) && bedAssignments[i] !== undefined
      ? { ...c, volunteer: bedAssignments[i] }
      : c,
  );
}

/**
 * Migrate what GardenSync 7.x left in this browser's localStorage. Pass the values of the keys in
 * V7_STORAGE_KEYS (missing keys as null or absent); nothing else is read, so the assistant key and
 * other settings can never end up in the garden. The old keys are not touched.
 */
export function migrateV7Storage(raw: Readonly<Record<string, string | null>>, opts: MigrateOptions): MigrationResult {
  try {
    if (!isObj(raw)) return { error: 'There was nothing to import.' };
    const warnings: string[] = [];
    const unreadable: Obj = {};
    const read = (key: string): unknown => {
      const s = raw[key];
      if (typeof s !== 'string' || s === '') return undefined;
      const parsed = safeJsonParse(s);
      if (parsed.ok) return parsed.value;
      unreadable[key] = s;
      warnings.push(`The saved ${KEY_WORDS[key] ?? key} could not be read. It is kept, as it was, in the legacy data.`);
      return undefined;
    };

    const stateText = raw.gardensync_state;
    let state: Obj | undefined;
    if (typeof stateText === 'string' && stateText !== '') {
      const parsed = safeJsonParse(stateText);
      if (!parsed.ok || !isObj(parsed.value)) {
        return { error: 'The saved GardenSync 7 garden is damaged and could not be read. Nothing was changed.' };
      }
      state = parsed.value;
    }

    const bedNames = read('gardensync_bed_names');
    const bedSizes = read('gardensync_bed_sizes');
    const side = {
      harvests: read('gardensync_harvests'),
      journal: read('gardensync_journal'),
      plantingLog: read('gardensync_plantlog'),
      completedTasks: read('gardensync_completed_tasks'),
      customSeeds: read('gardenSyncCustomPlants'),
    };
    // The goal was saved as the bare text of a number input.
    const goalText = raw.gardensync_harvest_goal;
    const harvestGoal = typeof goalText === 'string' && goalText !== '' ? goalText : undefined;

    let containers: unknown[];
    if (state) {
      const found = containersOf(state, bedNames, bedSizes);
      if (!found) return { error: 'The saved GardenSync 7 garden is in a form this version does not recognize. Nothing was changed.' };
      containers = found;
    } else {
      const anything = Object.values(side).some((x) => !isEmptyish(x)) || harvestGoal !== undefined;
      if (!anything) return { error: 'No GardenSync 7 garden was found in this browser.' };
      containers = [];
      warnings.push('No beds were saved, only other records, so the garden starts empty.');
    }
    const extra: Obj = {};
    if (state && !Array.isArray(state.containers) && Array.isArray(state.beds)) {
      extra.v1 = { bedNames: bedNames ?? null, bedSizes: bedSizes ?? null };
    }

    return buildGarden(
      {
        source: 'gardensync-7-storage',
        defaultName: 'My garden',
        containers: withAssignments(containers, state?.bedAssignments),
        volunteers: state?.volunteers,
        bedAssignments: state?.bedAssignments,
        ...side,
        harvestGoal,
        view: state ? viewOf(state) : undefined,
        extra,
        unreadable,
        warnings,
      },
      opts,
    );
  } catch (err) {
    return { error: `The GardenSync 7 garden could not be imported (${err instanceof Error ? err.message : String(err)}). Nothing was changed.` };
  }
}

/** Top-level keys of a 7.x export (or demo) file that the migration reads itself. */
const EXPORT_KEYS: ReadonlySet<string> = new Set([
  'version',
  'state',
  'plantingLog',
  'harvests',
  'journal',
  'completedTasks',
  'harvestGoal',
  'customSeeds',
  'bedNames',
  'bedSizes',
]);

/**
 * Migrate a GardenSync 7.x JSON export (a gardensync-backup-*.json file), given as the parsed JSON
 * or its text. The 7.x demo files have the same shape.
 */
export function migrateV7Export(json: unknown, opts: MigrateOptions): MigrationResult {
  try {
    let data: unknown;
    if (typeof json === 'string') {
      const parsed = safeJsonParse(json);
      if (!parsed.ok) return { error: 'This file is not valid JSON, so it is not a GardenSync 7 export.' };
      data = parsed.value;
    } else {
      // A private copy: the caller's object is never touched, and legacy holds plain JSON only.
      data = JSON.parse(JSON.stringify(json ?? null)) as unknown;
    }
    if (!isObj(data) || !isObj(data.state)) return { error: 'This file is not a GardenSync 7 export.' };
    const state = data.state;
    const containers = containersOf(state, data.bedNames, data.bedSizes);
    if (!containers) return { error: 'This GardenSync 7 export holds no beds this version recognizes.' };

    const extra: Obj = {};
    for (const [k, val] of Object.entries(data)) {
      if (!EXPORT_KEYS.has(k) && !SECRET_KEY.test(k)) extra[k] = val;
    }
    return buildGarden(
      {
        source: 'gardensync-7-export',
        defaultName: 'Imported garden',
        containers: withAssignments(containers, state.bedAssignments),
        volunteers: state.volunteers,
        bedAssignments: state.bedAssignments,
        plantingLog: data.plantingLog,
        harvests: data.harvests,
        journal: data.journal,
        completedTasks: data.completedTasks,
        harvestGoal: data.harvestGoal,
        customSeeds: data.customSeeds,
        view: viewOf(state),
        extra,
        unreadable: {},
        warnings: [],
      },
      opts,
    );
  } catch (err) {
    return { error: `The file could not be imported (${err instanceof Error ? err.message : String(err)}).` };
  }
}

/** Longest `#plan=` payload accepted. Real 7.x links were a few KB. */
const MAX_V7_SHARE_CHARS = 1_000_000;

/**
 * Decode a 7.x share link: "#plan=<base64>", "plan=<base64>" or the bare base64. The payload was
 * btoa of the UTF-8 JSON { v: 2, k: [plant ids], c: [{ t, n, w, h, d, p: [[idIndex, x, y]] }] },
 * or the older { v: 1, k, b: [[[idIndex, x, y]]], n: [names], s: [{ w, h }] }. Share links carried
 * no positions, notes or orientation; beds are laid out two across as 7.x did.
 */
export function decodeV7ShareHash(hash: string, opts: MigrateOptions): MigrationResult {
  try {
    if (typeof hash !== 'string') return { error: 'This is not a GardenSync 7 share link.' };
    let s = hash.trim();
    const at = s.indexOf('plan=');
    if (at >= 0) s = s.slice(at + 'plan='.length);
    if (s.length > MAX_V7_SHARE_CHARS) return { error: 'This share link is too long to be a GardenSync 7 plan.' };
    if (s.includes('%')) s = decodeURIComponent(s);
    if (s === '') return { error: 'This share link is empty.' };

    let compact: unknown;
    try {
      const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
      compact = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
    } catch {
      return { error: 'This share link is damaged and could not be read.' };
    }
    if (!isObj(compact) || !Array.isArray(compact.k)) return { error: 'This is not a GardenSync 7 share link.' };
    const ids: unknown[] = compact.k;
    const placements = (list: unknown) =>
      (Array.isArray(list) ? list : []).map((entry: unknown) => {
        if (!Array.isArray(entry)) return entry;
        const [idx, x, y] = entry as unknown[];
        return { plantId: typeof idx === 'number' ? str(ids[idx]) : undefined, x, y };
      });

    let containers: unknown[];
    if (compact.v === 2 && Array.isArray(compact.c)) {
      containers = compact.c.map((c: unknown, i: number) => {
        const cd = isObj(c) ? c : {};
        return {
          id: `container-share-${i}`,
          type: str(cd.t) ?? 'raised-bed',
          name: str(cd.n) ?? `Container ${i + 1}`,
          canvasX: (i % 2) * 450,
          canvasY: Math.floor(i / 2) * 280,
          w: cd.w,
          h: cd.h,
          diameter: cd.d,
          plants: placements(cd.p),
        };
      });
    } else if (compact.v === 1 && Array.isArray(compact.b)) {
      const names: unknown[] = Array.isArray(compact.n) ? compact.n : [];
      const sizes: unknown[] = Array.isArray(compact.s) ? compact.s : [];
      containers = compact.b.map((bed: unknown, i: number) => {
        const size = isObj(sizes[i]) ? (sizes[i] as Obj) : {};
        return {
          id: `container-share-${i}`,
          type: 'raised-bed',
          name: str(names[i]) ?? `Bed ${i + 1}`,
          canvasX: (i % 2) * 450,
          canvasY: Math.floor(i / 2) * 280,
          w: num(size.w) || 5,
          h: num(size.h) || 10,
          diameter: null,
          plants: placements(bed),
        };
      });
    } else {
      return { error: 'This GardenSync 7 share link is in a form this version does not recognize.' };
    }

    return buildGarden(
      {
        source: 'gardensync-7-share',
        defaultName: 'Shared garden',
        containers,
        extra: {},
        unreadable: {},
        warnings: [],
      },
      opts,
    );
  } catch (err) {
    return { error: `The share link could not be imported (${err instanceof Error ? err.message : String(err)}).` };
  }
}
