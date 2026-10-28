# Plant record brief

How to write one plant file for GardenSync 8. This brief is for research agents now and becomes the
basis of the contributor guide later.

## Where things go

- One file per plant: `src/domain/plants/library/<id>.json`. The file name must equal the `id`.
- The contract is `src/domain/plants/schema.ts` (read its comments first). The worked example is
  `src/domain/plants/library/tomato.json`.
- Check your work with `npx vitest run tests/unit/plant-library.test.ts` (schema, sources, notes lint,
  density sanity). It must pass for every file you write.
- Keep a research log per batch in `docs/v8/research/plants-<batch>.md`: for each plant, the sources
  you used, the numbers you chose, and any place sources disagreed and how you settled it.
- The old 7.x library is a starting point only (`git show v7-final:js/constants.js`). Its numbers are
  unsourced and some are wrong (see "Known 7.x problems" below). Do not copy its prose: it has
  Canton dates in it.

## The numbers

All offsets are **weeks relative to the median last spring frost (LF50)**, the way extension guides
publish them. "Sow 4 weeks before last frost" is `-4`; "transplant 1 to 2 weeks after" is `[1, 2]`.

| Field | Meaning | How to choose it |
|---|---|---|
| `frost` | tender (killed at 0 C), half-hardy (takes light frost to about -2 C), hardy (to about -5 C or colder) | Extension "cool-season hardy / semi-hardy / warm-season tender" tables |
| `temp.minC`, `temp.maxC` | daily MEAN temperature range where the crop grows well | Use published optimum and limit ranges for the crop; daily mean, not daytime highs. Cool-season crops typically 7 to 24; warm-season 16 to 30 |
| `fruitSetMaxC` | daily MAXIMUM above which flowers drop or fruit fails (fruiting crops only) | e.g. tomato 32, pepper 32, bean 32, squash 35. Omit for leaf and root crops |
| `soilMinC` | minimum soil temperature for germination when direct sown | Extension soil-temperature germination tables |
| `density` | square-foot density in one 30 cm (1 ft) square: 1, 2, 4, 8, 9 or 16; or `squares: [w, h]` for plants needing more than one square | Square Foot Gardening practice (e.g. carrot 16, beet 9, lettuce 4, pepper 1, zucchini 3x3) |
| `spacingCm` | in-row and between-row spacing for row planting | Extension spacing tables, converted to cm and rounded |
| `container` | smallest pot in litres that gives a decent crop, and how many plants per pot; `null` if not suited | 1 US gallon = 3.8 L. A 12 inch pot is about 11 L |
| `canopy` | low (under 30 cm), mid (30 to 90 cm), tall (over 90 cm or trellised) | |
| `shadeTolerant` | grows acceptably in part shade (useful for interplanting under taller crops) | |
| `maturity.days` / `from` | days to first harvest, counted from `sow` or `transplant` as seed catalogues and extension guides state it | Most transplanted crops count from transplant |
| `methods.indoor.ageWeeks` | age of transplant when set out | e.g. tomato 6 to 8, pepper 8 to 10, brassicas 4 to 6, lettuce 3 to 5 |
| `methods.transplant.weeks` | when transplants go out, relative to LF50 | Requires `indoor` |
| `methods.direct.weeks` | when to sow outdoors, relative to LF50 | |
| `methods.plant` | for crops planted from sets, cloves, crowns, tubers, divisions or bare-root plants | `what` says which, e.g. "seed potatoes", "crowns" |
| `fall.windowWeeks` | include only if a fall crop is a normal practice for the crop; width of the fall sowing window in weeks | The app back-counts from the first fall frost |
| `overwinter` | crops planted in autumn and harvested next year (garlic, overwintering onions, fava in mild areas) | `plantWeeks` relative to first fall frost FF50; `harvestWeeks` relative to next spring's LF50 |
| `succession.everyDays` | interval between sowings for crops normally succession sown | e.g. lettuce 14, radish 10, bush bean 14 to 21 |
| `harvest.type` / `windowDays` | once (one harvest), continuous (keeps producing), cut-and-come-again; and how long harvesting lasts | |
| `yield` | typical home-garden yield, grams per plant or per square, or a count (heads, fruits) | Use conservative extension figures |
| `perennial` | perennial crops: first harvest year (planting season = 1), yearly harvest weeks relative to LF50, productive lifespan | e.g. asparagus first harvest year 3 |
| `glyph` | icon form (see `GLYPH_FORMS`) and a colour that reads as the crop, `#rrggbb` lower case | Pick distinct colours within a family |

## The notes

Three short notes (sowing, care, harvest), plain and useful, written for a home gardener anywhere.

- **No absolute dates and no place names.** Write relative to frost: "4 weeks before your last frost",
  "when the soil has warmed", "before the first fall frost".
- **Measurements are tokens**, never bare units: `{c:21}` is 21 degrees C, `{cm:0.6}` is 0.6 cm. The app
  shows them as C or F, cm or inches. Do not write the degree sign, "inches", "F" and so on.
- **No em dashes.** Use commas, colons or full stops.
- Calm, specific, no marketing tone, no exclamation marks.

## Sources

At least two per plant, each a page you have opened and confirmed (HTTP 200, and it covers the crop).
Prefer, in order: university extension services (UMN, Cornell, Penn State, Ohio State, Purdue, UC ANR,
Utah State, Colorado State, Oregon State, Clemson HGIC, Texas A&M AgriLife, UF/IFAS, NC State), the
Royal Horticultural Society, Australian state agriculture departments, then established seed
companies' growing guides (Johnny's Selected Seeds). Avoid blogs and content farms. Use the page's
real title.

## Known 7.x problems to avoid

- Spacing copied from seed packets' row spacing (pickling cucumber 48 inches, Roma 36 inches).
- Days to maturity with no "from sow or transplant".
- Lettuce, chard and collards with indoor periods that are too short.
- Garlic with no planting dates at all (it is an overwinter crop).
- Prose with Canton dates ("Mar 1-7", "after May 1") and "Zone 6a".
