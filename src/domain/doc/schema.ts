// The garden document: everything GardenSync saves, exports, shares and imports.
//
// One document holds every garden in this browser plus the settings. It is immutable: every change
// goes through dispatch(op) (ops.ts), which returns a new document. The same schema validates what
// comes back from storage, from a downloaded file, from a share link and from the assistant.
//
// Geometry is in centimetres on the garden plane (x to the right, y down). Grid beds measure their
// size in cells; the cell size is fixed per garden (30.48 cm for a foot, 30 cm for metric). Dates are
// ISO strings. Plantings store an anchor rather than fixed dates, so a change to the climate re-flows
// the whole garden; see src/domain/schedule.
import * as v from 'valibot';
import { isIsoDate } from '../dates';
import { ClimateProfileSchema } from '../climate/types';
import { PlantSchema } from '../plants/schema';

export const SCHEMA_VERSION = 1;

const Id = v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{1,40}$/));
const Iso = v.pipe(v.string(), v.check(isIsoDate, 'expected YYYY-MM-DD'));
const Name = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80));
const Cm = v.pipe(v.number(), v.minValue(-100_000), v.maxValue(100_000));
const Count = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(10_000));
const Note = v.pipe(v.string(), v.maxLength(2000));

/** Beds laid out on the square grid. */
export const GRID_KINDS = ['raised-bed', 'in-ground', 'planter', 'window-box', 'trough'] as const;
/** Containers measured by soil volume rather than squares. */
export const VESSEL_KINDS = ['pot', 'grow-bag', 'bucket', 'tower'] as const;

export const GridBedSchema = v.object({
  id: Id,
  form: v.literal('grid'),
  kind: v.picklist(GRID_KINDS),
  name: Name,
  /** Top-left corner on the garden plane, cm. */
  x: Cm,
  y: Cm,
  cols: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(60)),
  rows: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(60)),
  rotation: v.picklist([0, 90, 180, 270]),
  notes: v.optional(Note),
});

export const VesselSchema = v.object({
  id: Id,
  form: v.literal('vessel'),
  kind: v.picklist(VESSEL_KINDS),
  name: Name,
  /** Centre on the garden plane, cm. */
  x: Cm,
  y: Cm,
  diameterCm: v.pipe(v.number(), v.minValue(10), v.maxValue(300)),
  litres: v.pipe(v.number(), v.minValue(1), v.maxValue(2000)),
  /** Planting pockets, for towers. */
  pockets: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(60))),
  notes: v.optional(Note),
});

export const ContainerSchema = v.variant('form', [GridBedSchema, VesselSchema]);

/** A rectangle of cells inside a grid bed. */
export const CellsSchema = v.object({
  col: v.pipe(v.number(), v.integer(), v.minValue(0)),
  row: v.pipe(v.number(), v.integer(), v.minValue(0)),
  w: v.pipe(v.number(), v.integer(), v.minValue(1)),
  h: v.pipe(v.number(), v.integer(), v.minValue(1)),
});

export const WINDOWS = ['spring', 'fall', 'overwinter', 'perennial'] as const;

export const AnchorSchema = v.variant('kind', [
  v.object({
    /** Dates come from the schedule and move when the climate changes. */
    kind: v.literal('auto'),
    window: v.picklist(WINDOWS),
    /** The growing season the planting belongs to (its harvest season for overwinter crops). */
    season: v.pipe(v.number(), v.integer(), v.minValue(1900), v.maxValue(2200)),
    /** Succession round, 0 for the first sowing. */
    round: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(52))),
    /** Days added to the start of the window, from the gardener's own adjustment. */
    // Up to a year: in a year-round window the next sowing can be many months past its start.
    offsetDays: v.pipe(v.number(), v.integer(), v.minValue(-366), v.maxValue(366)),
  }),
  v.object({
    /** Dates the gardener set. They never move. */
    kind: v.literal('pinned'),
    bedIn: Iso,
    bedOut: v.optional(Iso),
  }),
]);

export const PlantingSchema = v.object({
  id: Id,
  containerId: Id,
  /** A built-in plant id or a custom plant id. */
  plantId: Id,
  /** Present for grid beds; absent for vessels. */
  cells: v.optional(CellsSchema),
  count: Count,
  method: v.picklist(['indoor', 'direct', 'transplant', 'plant', 'bought']),
  anchor: AnchorSchema,
  seriesId: v.optional(Id),
  /** What actually happened. These win over the plan. */
  actual: v.optional(
    v.object({
      startedIndoors: v.optional(Iso),
      bedIn: v.optional(Iso),
      ended: v.optional(Iso),
      failed: v.optional(v.boolean()),
    }),
  ),
  notes: v.optional(Note),
});

/**
 * A gardener-added plant or variety. Only a name, category, frost tolerance and days to maturity are
 * required; every other field inherits from `parent` (for a variety) or a category default, see
 * plants/resolve.ts. Custom plants carry no sources.
 */
const PartialPlant = v.partial(PlantSchema);
export const CustomPlantSchema = v.object({
  ...PartialPlant.entries,
  id: Id,
  name: Name,
  parent: v.optional(Id),
  category: PlantSchema.entries.category,
  frost: PlantSchema.entries.frost,
  maturity: PlantSchema.entries.maturity,
});

export const SeriesSchema = v.object({
  id: Id,
  plantId: Id,
  everyDays: v.pipe(v.number(), v.integer(), v.minValue(3), v.maxValue(60)),
});

export const HarvestSchema = v.object({
  id: Id,
  plantId: Id,
  plantingId: v.optional(Id),
  date: Iso,
  grams: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1_000_000))),
  count: v.optional(Count),
  note: v.optional(Note),
});

export const JournalSchema = v.object({
  id: Id,
  date: Iso,
  text: Note,
  containerId: v.optional(Id),
});

export const GardenSchema = v.object({
  id: Id,
  name: Name,
  createdAt: Iso,
  /** 30.48 for a foot grid, 30 for metric. Fixed when the garden is created. */
  cellCm: v.picklist([30.48, 30]),
  /** null until the gardener says where the garden is. */
  climate: v.nullable(ClimateProfileSchema),
  containers: v.array(ContainerSchema),
  plantings: v.array(PlantingSchema),
  series: v.array(SeriesSchema),
  harvests: v.array(HarvestSchema),
  journal: v.array(JournalSchema),
  customPlants: v.array(CustomPlantSchema),
  /** Ticked tasks, by stable task id, with the date they were ticked. */
  taskState: v.record(v.string(), Iso),
  /** Data from GardenSync 7.x that 8.0 does not use (crews, goals), kept so nothing is lost. */
  legacy: v.optional(v.unknown()),
});

export const SettingsSchema = v.object({
  units: v.picklist(['imperial', 'metric']),
  theme: v.picklist(['system', 'light', 'dark']),
  activeGardenId: v.nullable(Id),
  /** When the gardener last downloaded a copy; drives the gentle export reminder. */
  lastExportAt: v.optional(Iso),
});

export const DocSchema = v.object({
  schemaVersion: v.literal(SCHEMA_VERSION),
  gardens: v.array(GardenSchema),
  settings: SettingsSchema,
});

export type GridBed = v.InferOutput<typeof GridBedSchema>;
export type Vessel = v.InferOutput<typeof VesselSchema>;
export type Container = v.InferOutput<typeof ContainerSchema>;
export type Cells = v.InferOutput<typeof CellsSchema>;
export type Anchor = v.InferOutput<typeof AnchorSchema>;
export type Planting = v.InferOutput<typeof PlantingSchema>;
export type Series = v.InferOutput<typeof SeriesSchema>;
export type Harvest = v.InferOutput<typeof HarvestSchema>;
export type JournalEntry = v.InferOutput<typeof JournalSchema>;
export type CustomPlant = v.InferOutput<typeof CustomPlantSchema>;
export type Garden = v.InferOutput<typeof GardenSchema>;
export type Settings = v.InferOutput<typeof SettingsSchema>;
export type GardenDoc = v.InferOutput<typeof DocSchema>;

export function emptyDoc(): GardenDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    gardens: [],
    settings: { units: 'imperial', theme: 'system', activeGardenId: null },
  };
}
