// The plant record: the contract every entry in library.json (and every custom plant) satisfies.
//
// Conventions that matter for the schedule maths:
// - Week offsets for sowing and transplanting are relative to the median last spring frost (LF50),
//   exactly as extension guides publish them ("sow 4 weeks before last frost" is -4).
// - Temperatures are in degrees Celsius. `temp` is the range of DAILY MEAN temperature the crop grows
//   well in; `fruitSetMaxC` is the DAILY MAXIMUM above which flowers drop or fruit fails to set.
// - Spacing is in centimetres. Density is square-foot-garden density per 30 cm / 1 ft square.
// - Notes never contain absolute dates or place names (tests/unit/plant-library.test.ts enforces it).
import * as v from 'valibot';

export const CATEGORIES = ['vegetable', 'herb', 'fruit', 'flower'] as const;

export const FAMILIES = [
  'Alliaceae', // onion, garlic, leek, chives (APG: Amaryllidaceae subfamily Allioideae)
  'Amaranthaceae', // beet, chard, spinach, amaranth
  'Apiaceae', // carrot, parsnip, celery, parsley, dill, cilantro, fennel
  'Asparagaceae', // asparagus
  'Asteraceae', // lettuce, endive, sunflower, marigold, zinnia, calendula, artichoke
  'Boraginaceae', // borage, comfrey
  'Brassicaceae', // cabbage, kale, broccoli, radish, turnip, arugula, alyssum
  'Convolvulaceae', // sweet potato
  'Cucurbitaceae', // cucumber, squash, melon, pumpkin
  'Ericaceae', // blueberry
  'Fabaceae', // beans, peas, fava
  'Lamiaceae', // basil, mint, oregano, thyme, sage, rosemary
  'Malvaceae', // okra
  'Poaceae', // corn
  'Polygonaceae', // rhubarb, sorrel
  'Rosaceae', // strawberry, raspberry
  'Solanaceae', // tomato, pepper, eggplant, potato, tomatillo
  'Tropaeolaceae', // nasturtium
  'Other',
] as const;

/** Glyph forms: the drawn icon family. Colour comes from `glyph.color`. */
export const GLYPH_FORMS = [
  'rosette', // leafy heads and greens
  'root', // carrots, beets, radishes
  'fruiting', // tomato, eggplant, tomatillo
  'pepper', // sweet and hot peppers
  'vine', // cucumbers, squash, melons
  'pod', // beans, peas
  'allium', // onions, garlic, leeks
  'brassica', // cabbage, broccoli, cauliflower
  'sprig', // herbs
  'flower', // flowers
  'tuber', // potatoes, sweet potatoes
  'cane', // berries and canes
  'stalk', // corn, asparagus, rhubarb, celery
] as const;

/** A whole number in [lo, hi]. */
const IntIn = (lo: number, hi: number) => v.pipe(v.number(), v.integer(), v.minValue(lo), v.maxValue(hi));
/**
 * Weeks relative to a frost date, [earliest, latest]: whole weeks within 60 either side, which is
 * more than a year. The bounds keep a typed-in or imported plant from sending the schedule maths
 * decades away.
 */
const WeekRange = v.pipe(
  v.tuple([IntIn(-60, 60), IntIn(-60, 60)]),
  v.check(([a, b]) => a <= b, 'week range must be [earliest, latest]'),
);
/** Age of a seedling at transplant, 1 to 20 whole weeks. */
const AgeWeeks = v.pipe(
  v.tuple([IntIn(1, 20), IntIn(1, 20)]),
  v.check(([a, b]) => a <= b, 'age range must be [youngest, oldest]'),
);
const PositiveInt = v.pipe(v.number(), v.integer(), v.minValue(1));
const Celsius = v.pipe(v.number(), v.minValue(-40), v.maxValue(50));

export const SourceSchema = v.object({
  title: v.pipe(v.string(), v.minLength(3)),
  url: v.pipe(v.string(), v.url()),
});

export const DensitySchema = v.union([
  v.object({ perSquare: v.picklist([1, 2, 4, 8, 9, 16]) }),
  v.object({ squares: v.tuple([PositiveInt, PositiveInt]) }),
]);

export const PlantSchema = v.object({
  id: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]*$/)),
  name: v.pipe(v.string(), v.minLength(2)),
  latin: v.pipe(v.string(), v.minLength(3)),
  category: v.picklist(CATEGORIES),
  family: v.picklist(FAMILIES),
  /** Biennials grown for leaves or roots (carrot, beet, parsley) are listed as 'annual'. */
  lifecycle: v.picklist(['annual', 'biennial', 'perennial']),
  /** tender: killed by 0 C. half-hardy: survives light frost to about -2 C. hardy: to about -5 C or lower. */
  frost: v.picklist(['tender', 'half-hardy', 'hardy']),
  /** Daily mean temperature range for good growth, degrees C. */
  temp: v.pipe(
    v.object({ minC: Celsius, maxC: Celsius }),
    v.check((t) => t.minC < t.maxC, 'temp.minC must be below temp.maxC'),
  ),
  /** Daily maximum above which fruit set fails (fruiting crops only). */
  fruitSetMaxC: v.optional(Celsius),
  /** Minimum soil temperature for germination when direct sown. */
  soilMinC: v.optional(Celsius),
  sun: v.picklist(['full', 'partial', 'shade']),
  water: v.picklist(['low', 'medium', 'high']),
  density: DensitySchema,
  spacingCm: v.object({ inRow: PositiveInt, betweenRows: PositiveInt }),
  /** null means not suited to containers. */
  container: v.nullable(v.object({ minLitres: PositiveInt, perVessel: v.optional(PositiveInt) })),
  canopy: v.picklist(['low', 'mid', 'tall']),
  shadeTolerant: v.boolean(),
  maturity: v.object({ days: IntIn(1, 2000), from: v.picklist(['sow', 'transplant']) }),
  methods: v.pipe(
    v.object({
      /** Can be started indoors; transplanted at this age in weeks. */
      indoor: v.optional(v.object({ ageWeeks: AgeWeeks })),
      /** Outdoor transplant window, weeks relative to LF50. Requires `indoor` or bought starts. */
      transplant: v.optional(v.object({ weeks: WeekRange })),
      /** Direct sowing window, weeks relative to LF50. */
      direct: v.optional(v.object({ weeks: WeekRange })),
      /** Planted from a division, crown, set, clove or bare-root plant, weeks relative to LF50. */
      plant: v.optional(v.object({ weeks: WeekRange, what: v.string() })),
    }),
    v.check(
      (m) => !!(m.transplant || m.direct || m.plant),
      'a plant needs at least one way into the ground (transplant, direct or plant)',
    ),
  ),
  /** A fall crop is possible: sown for harvest before the hardiness-appropriate frost cap. */
  fall: v.optional(v.object({ windowWeeks: IntIn(1, 26) })),
  /** Planted in autumn, harvested the following year (garlic, overwintering onions, fava). */
  overwinter: v.optional(
    v.object({
      /** Weeks relative to the median first fall frost (FF50). */
      plantWeeks: WeekRange,
      /** Weeks relative to the next spring's LF50. */
      harvestWeeks: WeekRange,
      /** Needs a cold period; in frost-free climates the app says to pre-chill. */
      chillWeeks: v.optional(PositiveInt),
    }),
  ),
  succession: v.optional(v.object({ everyDays: IntIn(3, 120) })),
  harvest: v.object({
    type: v.picklist(['once', 'continuous', 'cut-and-come-again']),
    windowDays: IntIn(1, 730),
    /** Keeps producing until the frost cap for its hardiness rather than for windowDays. */
    untilFrost: v.optional(v.boolean()),
  }),
  /** Needs a trellis, stake or cage; density assumes it. */
  support: v.optional(v.picklist(['trellis', 'stake', 'cage'])),
  /** Lowest winter temperature an established plant survives, C (perennials and overwintered crops). */
  winterMinC: v.optional(Celsius),
  /** Preferred soil pH range. */
  soilPh: v.optional(
    v.pipe(
      v.tuple([v.number(), v.number()]),
      v.check(([a, b]) => a < b && a >= 3 && b <= 9, 'pH range must be [low, high] between 3 and 9'),
    ),
  ),
  /** Spreads by runners or roots and is best kept contained. */
  spreads: v.optional(v.boolean()),
  /** Why gardeners grow it, mostly for flowers and herbs. */
  purpose: v.optional(v.array(v.picklist(['food', 'pollinators', 'pest-control', 'cut-flowers', 'display']))),
  /** Typical yield. Grams per plant or per square, or a count (heads, fruits, bunches). */
  yield: v.object({
    amount: v.pipe(v.number(), v.minValue(0)),
    unit: v.picklist(['g', 'count']),
    per: v.picklist(['plant', 'square']),
  }),
  perennial: v.optional(
    v.object({
      /** The growing season in which harvest may start, counting the planting season as 1. */
      firstHarvestYear: PositiveInt,
      /** Yearly harvest window, weeks relative to LF50. */
      harvestWeeks: WeekRange,
      /** Years the planting stays productive before replanting is usual. */
      lifespanYears: v.optional(PositiveInt),
      /** Needs a cold winter rest; not viable where the coolest month averages above 10 C. */
      needsChill: v.optional(v.boolean()),
    }),
  ),
  glyph: v.object({
    form: v.picklist(GLYPH_FORMS),
    color: v.pipe(v.string(), v.regex(/^#[0-9a-f]{6}$/)),
  }),
  notes: v.object({
    sowing: v.pipe(v.string(), v.minLength(10), v.maxLength(400)),
    care: v.pipe(v.string(), v.minLength(10), v.maxLength(400)),
    harvest: v.pipe(v.string(), v.minLength(10), v.maxLength(300)),
  }),
  sources: v.pipe(v.array(SourceSchema), v.minLength(1)),
});

export type Plant = v.InferOutput<typeof PlantSchema>;
export type Category = (typeof CATEGORIES)[number];
export type Family = (typeof FAMILIES)[number];
export type GlyphForm = (typeof GLYPH_FORMS)[number];

export const CompanionSchema = v.object({
  a: v.string(),
  b: v.string(),
  kind: v.picklist(['good', 'bad']),
  reason: v.pipe(v.string(), v.minLength(10), v.maxLength(240)),
  /** tested: supported by trials or extension research. traditional: gardening lore, unproven. */
  evidence: v.picklist(['tested', 'traditional']),
  source: v.optional(SourceSchema),
});

export type Companion = v.InferOutput<typeof CompanionSchema>;
