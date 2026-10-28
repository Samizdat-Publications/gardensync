# Plant library verification pass

A second check of the 63 plant records in `src/domain/plants/library/` and of
`src/domain/plants/companions.json`, done after the three research batches. It covers three things:
US spelling (decision D-A10), the numbers each batch log flagged as least certain, and the optional
schema fields that were added mid-batch (`winterMinC`, `support`, `spreads`, `harvest.untilFrost`,
`purpose`). Every source linked below was opened during this pass. Seed catalogue figures are
Johnny's Selected Seeds product pages, and the "days to maturity" basis (from seeding or from
transplanting) is taken from each page's Growing Information box.

## 1. Spelling

`tests/unit/plant-library.test.ts` now fails if a plant name, a note or a companion reason contains a
common British spelling: colour, flavour, neighbour, favour, centre, metre, litre, fertilise,
organise, recognise, harbour, mould, grey, aluminium, programme, sceptic, plough, storey, tonne,
travelled and catalogue, with their usual endings, plus vigour and "autumn" (D-A10 names "fall").
Source titles are left as the pages' own titles. The schema keeps its `minLitres` field name.

32 words were fixed in 24 plant files and 1 companion reason:

| Word | Replacement | Where |
|---|---|---|
| colour, coloured, tricolour | color, colored, tricolor | blueberry, chili-pepper, pepper, pumpkin, tomato, sage |
| flavour, Flavour | flavor, Flavor | brussels-sprouts, chili-pepper, oregano (2), rosemary, sage, scallion, thyme, turnip, companion basil and tomato |
| centre | center | parsley, swiss-chard |
| fertiliser | fertilizer | cosmos |
| neighbours | neighbors | marigold |
| vigour | vigor | parsnip |
| metre | rewritten as "a space about {cm:90} each way" | zucchini (a unit word in prose; the token converts it) |
| autumn (10) | fall; "Autumn-fruiting types" and "Autumn types" became "Fall-bearing types" | asparagus, chives, cilantro, dill, mint (2), oregano, raspberry (2) |

Cilantro's note also had "an fall crop" after the swap; it reads "a fall crop".

## 2. Numbers that changed

Each of these drives the schedule. The golden changes they caused are listed in section 5.

| Plant | Field | Old | New | Sources | Why |
|---|---|---|---|---|---|
| tomatillo | `maturity.days` (from transplant) | 70 | 60 | [Johnny's: Toma Verde Tomatillo Seed](https://www.johnnyseeds.com/vegetables/tomatillos/toma-verde-tomatillo-seed-791.html) (60 days, "From transplant"); [Johnny's: Growing Tomatillos from Seed](https://www.johnnyseeds.com/growers-library/vegetables/tomatillos/tomatillo-key-growing-information.html) (counts from transplant) | The batch figure was a guess from a 60 to 85 range. Johnny's two main varieties, Toma Verde and Pancho, are both listed at 60 days from transplant. |
| melon | `maturity.days` (from sow) | 80 | 90 | [Johnny's: Athena (F1) Melon Seed](https://www.johnnyseeds.com/fruits/melons/cantaloupe-muskmelon/athena-f1-melon-seed-457.html) (79 days "From transplanting; add about 10 days if direct-seeded"); [UA az1005, Vegetable Planting Calendar for Maricopa County](https://extension.arizona.edu/sites/default/files/2024-08/az1005-2018.pdf) (cantaloupe and honeydew 80 to 120 days to harvest) | With 80 from sowing, the schedule's transplant rule (days minus 3 weeks indoors plus a week of shock) gave 66 days from transplant, two weeks short of the standard cantaloupe. 90 gives 76 from transplant and 90 direct, close to Athena's 79 and 89. |
| rosemary | `frost` | half-hardy | hardy | [RHS: Salvia rosmarinus (Ro), plant profile](https://www.rhs.org.uk/plants/384211/salvia-rosmarinus-ro/details) (H4, -10 to -5 C); [RHS: How to grow rosemary](https://www.rhs.org.uk/herbs/rosemary/grow-your-own) (established plants survive about -8 C) | The schema's hardy class is "to about -5 C or lower", which rosemary meets. Batch 3 chose half-hardy only so the plant would not read as winter-safe; `winterMinC` -8 now carries that. |

## 3. Numbers checked and kept

| Plant | Field | Value | Second source opened | Finding |
|---|---|---|---|---|
| watermelon | `yield` | 2 fruits per plant | [Iowa State: Growing Watermelon in the Home Garden](https://yardandgarden.extension.iastate.edu/how-to/growing-watermelon-home-garden) ("about 2 to 3 melons per plant"); [Johnny's: Sugar Baby](https://www.johnnyseeds.com/fruits/watermelons/diploid-watermelons/sugar-baby-watermelon-seed-476.html) ("Avg. 1-2 fruits/plant") | Kept. The two sources bracket 2. |
| watermelon | `maturity.days` (sow) | 85 | Johnny's Sugar Baby: 76 days from transplanting, add about 10 if direct-seeded | Kept: 86 direct. |
| fava-bean | `soilMinC` | 5 | [USDA NRCS Plant Guide: Fava Bean](https://projects.sare.org/media/pdf/N/R/C/NRCSs-Fava-Plant-Guide.pdf) ("Germination will not occur at temperatures below 40 F", optimum 60 to 65 F) | Kept. 40 F is 4.4 C, so 5 is the first whole degree that germinates. It is below 10, so the soil guard does not use it. |
| fava-bean | `fruitSetMaxC` | 27 | NRCS: growth and yield restricted above 90 F (32 C) | Kept, not confirmed. The NRCS ceiling is for growth, not pod set. A Victorian agriculture page that reportedly gives flower abortion above 27 C refused automated access (HTTP 403), as did the 2024 Agronomy field study (optimum maximum for pod set 23.7 to 26.1 C, seen only in search summaries). See Unresolved. |
| sweet-corn | `fruitSetMaxC` | 35 | [Iowa State ICM: Corn pollination, effect of high temperature and stress](https://crops.extension.iastate.edu/encyclopedia/corn-pollination-effect-high-temperature-and-stress) (pollen no longer viable in the mid 90s F); [Purdue: Drought and Heat Stress Effects on Corn Pollination](https://www.agry.purdue.edu/ext/corn/pubs/corn-07.htm) (pollen likely damaged by mid-90s F, silks desiccate above 95 F) | Kept. Mid-90s F is 34 to 36 C. These are field corn pages; the threshold is the same plant physiology. |
| pepper | `maturity.days` (transplant) | 70 | [Johnny's: Ace (F1) Bell Pepper](https://www.johnnyseeds.com/vegetables/peppers/sweet-bell-peppers/ace-f1-bell-pepper-seed-574.html) (50 green, 70 red, from transplanting); [Johnny's: Classic (F1), page now titled Huntington](https://www.johnnyseeds.com/vegetables/peppers/sweet-bell-peppers/classic-f1-bell-pepper-seed-4336.html) (66 green, 86 red) | Kept. 70 is at the late end for green bells, which is the safer side for a frost-capped crop. |
| eggplant | `maturity.days` (transplant) | 75 | [Johnny's: Rosa Bianca](https://johnnyseeds.com/vegetables/eggplant/italian-eggplants/rosa-bianca-organic-eggplant-seed-2605G.html) (73 days, "From date of transplanting") | Kept. The record models large Italian types; Asian types run 55 to 65. |
| cucumber | `maturity.days` (sow) | 55 | [Johnny's: Marketmore 76](https://www.johnnyseeds.com/vegetables/cucumbers/slicing-cucumbers/marketmore-76-cucumber-seed-336.html) (39 days, "From transplanting") | Kept. The schedule's transplant rule gives 41 days from transplant. |
| winter-squash | `maturity.days` (sow) | 95 | [Johnny's: Waltham Butternut](https://www.johnnyseeds.com/vegetables/squash/winter-squash/waltham-butternut-butternut-squash-seed-671.html) (105 days from direct seeding, subtract 14 if transplanting) | Kept. Butternut is one of the slowest winter squashes; 95 sits between acorn and butternut types. |
| pumpkin | `maturity.days` (sow) | 100 | [Johnny's: Howden](https://www.johnnyseeds.com/vegetables/pumpkins/jack-o-lanterns/howden-pumpkin-seed-603.html) (115 days from direct seeding) | Kept for mid-sized and pie types; large jack-o'-lanterns run 10 to 15 days longer. |
| zucchini | `maturity.days` (sow) | 50 | Search listings only (Johnny's Safari 50, Maveric 42); no page opened | Kept, not re-verified. |
| spinach | `temp.maxC` | 20 | [UT Extension D 68: Leafy Crops for the Tennessee Vegetable Garden](https://uthort.tennessee.edu/wp-content/uploads/sites/228/2023/11/D68.pdf) (best at daytime 60 to 70 F, poor results as it approaches 85 to 90 F with long days) | Kept. A daily mean of 20 C matches days near 26 C. |
| lettuce | `temp.maxC` | 22 | UT D 68 (about 50 F nights and 60 to 70 F days; days above 85 F with long days lead to bolting) | Kept. A 29 C day with a 16 C night averages about 22 C. |
| radish | `temp.maxC` | 22 | [UMass: Radish](https://www.umass.edu/agriculture-food-environment/vegetable/fact-sheets/radish) (best roots at 50 to 65 F; bolts and turns pithy as summer warms) | Kept. 22 is the limit, above the quality optimum. |
| arugula | `temp.maxC` | 21 | [UF/IFAS Leon County: Arugula, Planting and Care](https://blogs.ifas.ufl.edu/leonco/2023/11/09/arugula-planting-and-care/) (best at 50 to 65 F; shade above 85 F; tolerates light freezes) | Kept, and half-hardy is supported. |
| bok-choy | `temp.maxC` | 21 | [UF/IFAS HS1337: Bok Choy](https://ask.ifas.ufl.edu/publication/HS1337) (best at 18 to 20 C, tolerates 35 C to -3 C) | Kept. Half-hardy fits the -3 C figure. |
| cauliflower | `temp.maxC` | 22 | [Clemson HGIC: Cauliflower](https://hgic.clemson.edu/factsheet/cauliflower/) (average 60 to 65 F for best growth) | Kept. |
| parsnip | `soilMinC` | 4 | [OSU: Soil temperature conditions for vegetable seed germination](https://extension.oregonstate.edu/gardening/soil-compost/soil-temperature-conditions-vegetable-seed-germination) (minimum 35 F, optimum 50 to 70 F; 57 days to emerge at 41 F, 27 at 50 F) | Kept as the planting floor; the note already says seedlings come fastest near 12 C. Below 10, so the soil guard ignores it. |
| marigold | `maturity.days` | 55 | [Johnny's: Bonanza Harmony](https://www.johnnyseeds.com/flowers/marigold/french-marigolds/bonanza-harmony-marigold-seed-5209.html) (50 days from seeding) | Kept; now cited. |
| calendula | `maturity.days` | 55 | [Johnny's: Alpha](https://www.johnnyseeds.com/herbs/calendula/alpha-organic-calendula-seed-2935.html) (50 to 55 days from seeding) | Kept; now cited. |
| nasturtium | `maturity.days` | 60 | [Johnny's: Jewel Mix](https://www.johnnyseeds.com/flowers/nasturtium/jewel-mix-nasturtium-seed-1420.html) (55 to 65 days from seeding) | Kept; now cited. |
| borage | `maturity.days` | 60 | [Johnny's: Borage](https://www.johnnyseeds.com/herbs/borage/borage-borage-seed-912.html) (50 to 60 days from seeding) | Kept; now cited. |
| sunflower | `maturity.days` | 70 | [Johnny's: Full Sun Improved](https://www.johnnyseeds.com/flowers/sunflowers/tall-sunflowers/full-sun-improved-f1-sunflower-seed-1743.html) (65 to 75 days, single stem, 70 to 80 inches) | Kept; now cited. |
| rhubarb | `perennial.firstHarvestYear` | 2 | [Illinois Extension: To rhubarb or not to rhubarb?](https://extension.illinois.edu/blogs/good-growing/2023-06-08-rhubarb-or-not-rhubarb) (no harvest in the first year, a light harvest for one to two weeks in the second, full harvest from the third) | Kept; it now agrees with UMN and Illinois against USU. |

Herb yields (basil, parsley, cilantro, dill, chives, mint, oregano, thyme, sage, rosemary) remain
estimates: no extension service or catalogue page I could find gives a per-plant figure.

The second sources found for unchanged values were added to the plant files' `sources` lists
(watermelon, melon, winter squash, pumpkin, sweet corn, pepper, eggplant, tomatillo, fava, the five
flowers above, rhubarb, spinach, lettuce, radish, arugula, bok choy, cauliflower, parsnip).

## 4. Optional fields filled

43 values in 31 plants.

| Field | Plant | Value | Source |
|---|---|---|---|
| `winterMinC` | fava-bean | -10 | [USDA NRCS Plant Guide: Fava Bean](https://projects.sare.org/media/pdf/N/R/C/NRCSs-Fava-Plant-Guide.pdf) (hardier Mediterranean cultivars to 14 F, the hardiest European ones to 5 F); Johnny's (already cited) gives 10 F. The [RHS broad bean page](https://www.rhs.org.uk/vegetables/broad-beans/grow-your-own) gives no temperature, only "use a hardy variety and protect young plants with cloches". -10 C is the NRCS figure for hardier cultivars. |
| `winterMinC` | strawberry | -9 | [UMN: Growing strawberries in the home garden](https://extension.umn.edu/fruit/growing-strawberries-home-garden) ("The crown of a strawberry plant may be killed at 15 F, therefore winter protection is essential") |
| `winterMinC` | blueberry | -29 | [Ontario OMAFA: Growing blueberries](https://www.ontario.ca/page/growing-blueberries-home-gardens-and-small-scale-production) (mid-winter -29 C to -32 C can severely injure or kill flower buds and young branches) |
| `winterMinC` | rosemary | -8 | RHS grow page (about -8 C); RHS plant profile H4 (-10 to -5) |
| `winterMinC` | sage | -15 | [RHS: Salvia officinalis](https://www.rhs.org.uk/plants/16356/salvia-officinalis/details) (H5, -15 to -10) |
| `winterMinC` | thyme | -15 | [RHS: Thymus vulgaris](https://www.rhs.org.uk/plants/18213/thymus-vulgaris/details) (H5, -15 to -10) |
| `winterMinC` | oregano | -20 | [RHS: Origanum vulgare](https://www.rhs.org.uk/plants/11923/origanum-vulgare/details) (H6, -20 to -15) |
| `winterMinC` | chives | -20 | [RHS: Allium schoenoprasum](https://www.rhs.org.uk/plants/859/allium-schoenoprasum/details) (H6, -20 to -15) |
| `support` | tomato | stake | Existing UMN and RHS sources; note says stake or cage, pinch side shoots on staked types |
| `support` | pepper | stake | [RHS: How to grow sweet peppers](https://www.rhs.org.uk/vegetables/peppers/grow-your-own) ("Support each plant with a sturdy bamboo cane") |
| `support` | eggplant | stake | Johnny's Rosa Bianca ("may be pruned and staked"); [UMN: Growing eggplant](https://extension.umn.edu/vegetables/growing-eggplant) ("Install plant supports at the time of planting") |
| `support` | tomatillo | cage | Johnny's tomatillo guide (sprawling plants benefit from support, like determinate tomatoes); note says stake or cage |
| `support` | cucumber | trellis | Existing CSU and UMN sources; density 2 per square and the tall canopy assume a trellis |
| `support` | pole-bean | trellis | [UMN: Growing beans](https://extension.umn.edu/vegetables/growing-beans) ("Install pole bean supports in place at planting time") |
| `support` | pea | trellis | Existing RHS source; note says netting or twiggy supports at sowing |
| `support` | raspberry | trellis | [OSU EC 1306: Growing Raspberries in Your Home Garden](https://extension.oregonstate.edu/catalog/pub/ec-1306-growing-raspberries-your-home-garden) ("Raspberries require trellising to support the canes") |
| `support` | sunflower | stake | Existing RHS source (stake tall types); the record is a single-stem tall type |
| `support` | brussels-sprouts | stake | Existing RHS source (batch 2: plants need staking) |
| `spreads` | mint | true | [RHS: Mentha spicata](https://www.rhs.org.uk/plants/11055/mentha-spicata/details) (forms an extensive colony); existing Illinois source |
| `spreads` | raspberry | true | OSU EC 1306 (red and yellow raspberries send up primocanes from root buds and spread out) |
| `spreads` | strawberry | true | UMN strawberry page (runners "will quickly take over your garden") |
| `harvest.untilFrost` | pole-bean | true | UMN beans ("Pole beans will continue to flower and bear until frost") |
| `harvest.untilFrost` | okra | true | [Clemson HGIC: How to Grow Okra in South Carolina](https://hgic.clemson.edu/factsheet/okra/) (up to twelve weeks of picking, and after cutting back, production "continuing until first frost") |
| `harvest.untilFrost` | marigold | true | [Clemson HGIC: Marigold](https://hgic.clemson.edu/factsheet/marigold/) (blooms "from early summer to late fall, typically until a hard frost") |
| `harvest.untilFrost` | zinnia | true | [Wisconsin Extension: Zinnias](https://hort.extension.wisc.edu/articles/zinnias/) ("Plants flower from summer until frost"; "season-long color") |
| `purpose` | basil, parsley, cilantro, mint, oregano, thyme, sage, rosemary | food | Their existing herb sources |
| `purpose` | dill | food, pollinators | Existing USU source (bees, wasps, lady beetles, lacewings, hoverflies) |
| `purpose` | chives | food, pollinators | RHS chives (flowers rich in nectar for bees) |
| `purpose` | borage | food, pollinators | Johnny's Borage (supports pollinators); existing RHS source (edible flowers) |
| `purpose` | calendula | display, cut-flowers, food | Existing USU and Wisconsin sources (edible petals, picked at full bloom) |
| `purpose` | cosmos | cut-flowers, pollinators, display | [USU: Cosmos in the Garden](https://extension.usu.edu/yardandgarden/research/cosmos-in-the-garden) (cut stems; butterflies, lacewings, hoverflies) |
| `purpose` | marigold | display, cut-flowers, pest-control | Clemson Marigold (bedding and cutting; cover crops suppress root-knot nematodes, interplanting does not) |
| `purpose` | nasturtium | food, pollinators, display | [RHS: annual nasturtiums](https://www.rhs.org.uk/plants/nasturtiums/annual-nasturtiums/how-to-grow-annual-nasturtiums) (edible leaves, seeds and buds; single flowers attract bees) |
| `purpose` | sunflower | cut-flowers, pollinators, display, food | Existing RHS and UGA sources (bees; seed heads); Johnny's Full Sun Improved (cut flower type) |
| `purpose` | sweet-alyssum | pollinators, pest-control, display | [Wisconsin Extension: Sweet Alyssum](https://hort.extension.wisc.edu/articles/sweet-alyssum-lobularia-maritima/) (nectar for bees, flower flies and small wasps; planted in organic lettuce and broccoli fields to attract natural enemies of aphids) |
| `purpose` | zinnia | cut-flowers, pollinators, display | Wisconsin Zinnias (excellent cut flowers, attract butterflies and pollinators) |

Left out on purpose:
- `harvest.untilFrost` for sweet and chili pepper: the RHS says outdoor crops finish "once
  temperatures start to drop in early autumn", and UMN does not mention frost. Also left out for
  nasturtium (RHS: "into autumn") and sweet alyssum (Wisconsin: "well into the fall"), where the
  sources stop short of frost, and for tomato, which no source here was checked for.
- `winterMinC` for asparagus, rhubarb and raspberry: none of the opened pages gives a temperature,
  and the RHS ratings for vegetables are UK ceilings (the rhubarb species is rated only H4). Mint is
  RHS H7 ("colder than -20"), which has no lower bound to record.
- `support` for melon and nasturtium (trailing or climbing is optional) and fava (staking tall
  plants is in the note, but this pass did not reopen a page that says so).

## 5. Golden schedule changes

`npx vitest run` failed only on the six golden files after these edits. 32 lines changed, all from
the changes above. None of the crops in `schedule-validation.md` (tomato, pepper, pea, lettuce,
garlic, spinach, kale, potato) moved, so no change made a checked golden worse, and nothing was
reverted. Checks against other guidance:

- Melon: harvest now comes 90 days after direct sowing, inside the 80 to 120 days UA az1005 gives
  for cantaloupe in Phoenix. Phoenix transplanting moves earlier (Feb 12 to Mar 21, was Mar 22 to
  Mar 31), because fruit set now has to finish before the late-May heat, and direct sowing closes
  10 days sooner (Mar 7). I could not read the rotated UA chart cell by cell, so this window was
  not checked date for date. Canton picking starts 10 days later, Aug 14 (transplants) and Aug 28
  (direct), still well before frost.
- Okra and pole bean: picking runs to the day before Canton's median first frost (Nov 3), as UMN
  and Clemson describe. Phoenix okra now picks until Dec 24: okra has no `fruitSetMaxC`, and the
  heat cap for such crops (mean above `maxC` + 4, 36 C) is never reached there. That is in line with
  Clemson's "until first frost" for a hot-summer climate, but no Phoenix source was checked for it.
- Fava (Canton) and strawberry (Canton) now carry `winter-too-cold`: Canton's mean extreme minimum
  is -20.7 C, below -10 and -9 C. UMN gives winter mulch as essential for strawberries in a
  similar climate, which is what the warning says.
- Rosemary picks later in fall (Canton to Nov 30, Edinburgh to Dec 11) under the hardy cap.
- Tomatillo picking starts 10 days earlier everywhere. Phoenix transplanting now runs to Mar 20,
  10 days past the tomato window, which matches Johnny's advice to plant tomatillos a week or two
  after tomatoes.

The changed lines, old then new:

```
canton-oh fava-bean overwinter direct: ... pick Apr 30 to Jun 11
canton-oh fava-bean overwinter direct: ... pick Apr 30 to Jun 11, warn winter-too-cold
canton-oh marigold spring transplant: ... pick Jul 03 to Oct 11 -> Jul 03 to Nov 03
canton-oh marigold spring direct: ... pick Jul 24 to Nov 01 -> Jul 24 to Nov 03
edinburgh marigold spring transplant: ... pick Jul 19 to Oct 27 -> Jul 19 to Nov 14
phoenix marigold spring transplant: ... pick Mar 18 to Jun 26 -> Mar 18 to Jul 07
brisbane melon temperature transplant: indoor Aug 11 to Jan 20 2028, out Sep 08 to Feb 10 2028, pick Nov 13 to Dec 04
  -> indoor Aug 10 to Jan 10 2028, out Sep 07 to Jan 31 2028, pick Nov 22 to Dec 13
brisbane melon temperature direct: sow Sep 06 to Jan 27 2028, pick Nov 25 to Dec 16
  -> sow Sep 05 to Jan 17 2028, pick Dec 04 to Dec 25
canton-oh melon spring transplant: ... pick Aug 04 to Aug 25 -> Aug 14 to Sep 04
canton-oh melon spring direct: ... pick Aug 18 to Sep 08 -> Aug 28 to Sep 18
edinburgh melon spring transplant: ... pick Aug 20 to Sep 10 -> Aug 30 to Sep 20
phoenix melon spring transplant: indoor Feb 22 to Mar 10, out Mar 22 to Mar 31, pick May 27 to Jun 11, warn frost-possible
  -> indoor Jan 15 to Feb 28, out Feb 12 to Mar 21, pick Apr 29 to May 20, warn frost-possible cool-summer
phoenix melon spring direct: sow Feb 12 to Mar 17, pick May 03 to May 24, warn frost-possible cool-summer
  -> sow Feb 12 to Mar 07, pick May 13 to Jun 03, warn frost-possible
singapore melon temperature transplant: ... pick Jan 20 to Feb 10 -> Jan 30 to Feb 20
singapore melon temperature direct: ... pick Feb 03 to Feb 24 -> Feb 13 to Mar 06
canton-oh okra spring transplant: ... pick Jul 08 to Sep 26 -> Jul 08 to Nov 03
canton-oh okra spring direct: ... pick Jul 29 to Oct 17 -> Jul 29 to Nov 03
edinburgh okra spring transplant: ... pick Jul 24 to Oct 12 -> Jul 24 to Nov 14
phoenix okra spring transplant: ... pick Apr 30 to Jul 19 -> Apr 30 to Dec 24
phoenix okra spring direct: ... pick May 21 to Aug 09 -> May 21 to Dec 24
canton-oh pole-bean spring direct: ... pick Jul 21 to Sep 19 -> Jul 21 to Nov 03
canton-oh rosemary spring plant: ... pick Jun 15 to Nov 11 -> Jun 15 to Nov 30
edinburgh rosemary spring plant: ... pick Jun 14 to Dec 07 -> Jun 14 to Dec 11
canton-oh strawberry perennial plant: ... yearly from 2028 -> yearly from 2028, warn winter-too-cold
brisbane tomatillo temperature transplant: ... pick Sep 26 to Nov 25 -> Sep 16 to Nov 15
canton-oh tomatillo spring transplant: ... pick Jul 26 to Sep 24 -> Jul 16 to Sep 14
edinburgh tomatillo spring transplant: ... pick Aug 24 to Oct 23 -> Aug 14 to Oct 13
melbourne tomatillo temperature transplant: indoor Sep 07 to Dec 22, out Oct 19 to Jan 19 2028, pick Dec 28 to Feb 26 2028
  -> indoor Sep 08 to Jan 01 2028, out Oct 20 to Jan 29 2028, pick Dec 19 to Feb 17 2028
phoenix tomatillo spring transplant: indoor Jan 01 to Feb 10, out Feb 12 to Mar 10, pick Apr 23 to May 25
  -> indoor Jan 01 to Feb 20, out Feb 12 to Mar 20, pick Apr 13 to May 25
singapore tomatillo temperature transplant: ... pick Jan 24 to Mar 25 -> Jan 14 to Mar 15
canton-oh zinnia spring transplant: ... pick Jul 18 to Oct 16 -> Jul 18 to Nov 03
edinburgh zinnia spring transplant: ... pick Aug 03 to Nov 01 -> Aug 03 to Nov 14
phoenix zinnia spring transplant: ... pick Apr 02 to Jul 01 -> Apr 02 to Jul 07
```

Parts marked "..." are unchanged; the full lines are in `tests/unit/__goldens__/schedule-*.txt`.

## 6. Unresolved

- **Fava `fruitSetMaxC` 27.** Still an estimate. The pages that would confirm it (Agriculture
  Victoria's faba bean guide, the 2024 Agronomy pod-set study) refused automated fetches. What I
  could open gives a growth ceiling of 32 C (NRCS), and a grower magazine says flowers may drop
  above 21 C, so 27 sits between them.
- **Herb yields** have no published per-plant figure.
- **Zucchini maturity** was checked only against search listings.
- **Perennial herbs and `winterMinC`.** Rosemary, sage, thyme, oregano and chives have no
  `perennial` block, so the schedule never compares their `winterMinC` with the local winter. At
  Canton (-20.7 C) rosemary will not survive outdoors, and the app gives no warning. The notes say
  it, but a warning would need the schedule to read `winterMinC` for perennial herbs too.
- **`winterMinC`** for asparagus, rhubarb and raspberry needs a source with a temperature.
