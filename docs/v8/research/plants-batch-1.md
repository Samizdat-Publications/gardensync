# Plant research log: batch-1 (fruiting crops, legumes, corn and tubers)

Eighteen records in `src/domain/plants/library/`: pepper, chili-pepper, eggplant, tomatillo, cucumber,
zucchini, winter-squash, pumpkin, melon, watermelon, bush-bean, pole-bean, pea, fava-bean, sweet-corn,
okra, potato, sweet-potato. Companions are not included; a later pass adds them.

Every source below was opened during this pass (WebFetch for content; curl confirmed HTTP 200 for the
RHS, Johnny's, Clemson, USU and NMSU pages; the UMN site blocks curl with a bot check but served every
page listed here to WebFetch). Titles are the pages' own titles, prefixed with the publisher.

## Conventions used across the batch

- **Weeks** are relative to the median last spring frost (LF50). Where a source gave calendar dates
  for its own region (UMN for Minnesota, RHS for Britain, Clemson for South Carolina), I converted
  them using that region's typical last frost, then cross-checked against the frost-relative timing in
  the Colorado State Vegetable Planting Guide (CSU).
- **Soil minimums** (`soilMinC`): CSU's germination table is the common reference (minimum soil
  temperature at 10 cm, 8 am). Where a crop-specific source asked for warmer soil, I used the warmer
  figure, because the app uses this value to decide when sowing is sensible, not when germination is
  merely possible.
- **Transplanted fruiting crops** (pepper, chili, eggplant, tomatillo) carry `soilMinC: 16`, following
  `tomato.json`. CSU gives 16 C (60 F) as the minimum for pepper and eggplant; the UMN pages give 21 C
  (70 F) as the ideal seedling soil.
- **Temperatures** are converted from Fahrenheit and rounded to the nearest whole degree C.
- **Frost classes** follow CSU's groups: CSU "very tender" and "tender" both map to `tender`,
  "semi-hardy" to `half-hardy`, "hardy" to `hardy`.
- **Yields** are deliberately conservative. Most sources give no per-plant figure, so several yields
  are my estimates from the per-row or per-plant figures that were given; each is flagged below.
- **Maturity** for crops with both direct and transplant methods is counted from sowing, as seed
  catalogues usually state it for cucurbits, beans and corn. Transplants of these crops are ready a
  week or two sooner (USU and Clemson say about two weeks for watermelon).

## pepper (Sweet pepper)

Sources: UMN "Growing peppers in home gardens"; RHS "How to grow sweet peppers"; CSU "Vegetable
Planting Guide".

- Indoor start: UMN about 8 weeks before planting out, seed 0.6 cm deep, flats at 27 to 32 C on a heat
  mat; transplant age chosen as 8 to 10 weeks (brief range; UMN seedlings are 6 to 8 weeks old when
  hardening off begins, plus 1 to 2 weeks of hardening).
- Transplant: UMN after nights stay above 10 C (50 F); RHS outdoors once nights are reliably above
  12 C with days of 15 C or more; CSU about 2 or more weeks after last frost. Chosen `[2, 4]`.
- Temperatures: UMN says days above 32 C (90 F) or nights below 16 C (60 F) or above 21 C weaken
  growth and flowers drop in hot days and nights; RHS says fruiting falls off above 30 C. Mean range
  18 to 27; `fruitSetMaxC` 32 (UMN, and the brief's example). RHS's 30 C is a greenhouse figure; I
  kept the extension threshold.
- Spacing: UMN 46 cm in row, 76 to 91 cm between rows; RHS 38 to 45 cm. Chosen 45 x 75. Density 1.
- Container: RHS pot at least 30 cm wide, one plant: about 15 L.
- Maturity: not given by either page; 70 days from transplant is the middle of catalogue figures for
  green bells. Yield 1000 g per plant is my conservative estimate (no source figure).

## chili-pepper (Chili pepper)

Sources: RHS "How to grow chilli peppers"; NMSU "Growing Chile Peppers in New Mexico Gardens"
(Guide H-240); UMN "Growing peppers in home gardens".

- Indoor start: NMSU 6 to 8 weeks before transplanting; RHS late winter to mid spring at about 21 C.
  I chose 8 to 10 weeks to match sweet pepper, since chilies germinate more slowly.
- Plant out: RHS once nights are reliably at least 12 C, after 2 to 3 weeks of hardening; NMSU after
  the last frost once soils warm. Chosen `[2, 4]`.
- Temperatures: NMSU days 18 to 29 C and nights 16 to 21 C for growth and fruit set; blossoms may fail
  below 16 C or above 32 C (90 F). RHS: over 30 C can reduce fruiting. Mean 18 to 29 (UMN notes
  small-fruited peppers take heat and cold better than bells), `fruitSetMaxC` 32.
- Spacing: NMSU 20 to 36 cm in row, rows 61 to 76 cm; RHS 38 to 45 cm, 30 cm for dwarf types. Chosen
  40 x 75 (between the two in-row ranges; density stays 1).
- Container: RHS 22 cm pot per plant, about 8 L.
- Maturity: NMSU mature green fruit 45 to 55 days after pollination. 75 days from transplant chosen
  as a first-ripe figure. Yield 400 g per plant is my conservative estimate.

## eggplant

Sources: UMN "Growing eggplant in home gardens"; RHS "How to grow aubergines"; CSU.

- Indoor: UMN start about 8 weeks before setting out, flats at 24 to 29 C (75 to 85 F); plants ready
  at 8 to 10 weeks old. Chosen `[8, 10]`.
- Transplant: UMN nights consistently above 10 C; CSU 2 or more weeks after last frost; RHS late spring
  after the last frost, soil warmed under cloches for two weeks. Chosen `[2, 4]`.
- Temperatures: UMN chill damage below 10 C; poor flowering above 32 C or with nights below 16 C.
  Mean 18 to 29, `fruitSetMaxC` 32.
- Spacing: UMN 46 cm in row, 76 to 91 cm rows; RHS 60 cm. Chosen 50 x 80.
- Container: RHS pot at least 30 cm wide, one plant: 15 L.
- Maturity: RHS needs at least five months from sowing, which after an 8 to 10 week indoor period
  leaves roughly 80 to 90 days; catalogue figures are 60 to 80 from transplant. Chosen 75.
  RHS: on large-fruited types keep five or six fruits. Yield 1200 g per plant (estimate).

## tomatillo

Sources: UMN "Growing tomatillos and ground cherries in home gardens"; Johnny's "Growing Tomatillos
from Seed: Sowing, Care & Harvest".

- Indoor: UMN and Johnny's both say 4 to 5 weeks before transplanting; UMN germination at 24 to 29 C.
  Chosen `[4, 6]` to allow a little slack.
- Transplant: Johnny's 1 to 2 weeks later than your earliest tomatoes; UMN after frost once the soil
  has warmed. Tomato is `[1, 4]`, so tomatillo is `[2, 4]`.
- Flower drop: UMN above 32 C or below 13 C (55 F). `fruitSetMaxC` 32, mean 16 to 29.
- Spacing: Johnny's 60 to 90 cm depending on training; UMN up to 90 cm because plants are bushy and
  take more space than tomatoes. Chosen 75 in row, 120 between rows, density 2 x 2 squares.
- Pollination: both sources say at least two plants are needed. This is in the sowing note (see
  Schema gaps).
- Maturity: Johnny's counts days from transplant; neither page gives a number. 70 days chosen from
  catalogue ranges (60 to 85). Container 20 L by analogy with tomato (no source figure). Yield 1000 g
  per plant (estimate).

## cucumber

Sources: UMN "Growing cucumbers in home gardens"; RHS "How to grow cucumbers"; CSU.

- Direct sowing: UMN after the last frost, soil at least 21 C (70 F) at 2.5 cm; CSU minimum 16 C
  (60 F), sow around the average last frost. RHS plants out once temperatures are reliably above
  12 C. Disagreement: I chose `soilMinC` 18 as the midpoint, direct `[1, 4]`.
- Indoor: UMN no earlier than 4 weeks before the last frost; RHS 10 cm pots. Age `[3, 4]`,
  transplant `[1, 3]`.
- Spacing: UMN thin to 20 to 30 cm with 60 to 90 cm each side for sprawling vines; RHS 30 cm; CSU 15 cm
  trellised. Chosen 30 in row, 120 between rows, density 2 per square on a trellis (canopy tall).
- Container: RHS at least 30 cm wide and deep: about 20 L.
- Harvest sizes from RHS (slicers 20 to 25 cm). Maturity 55 days from sowing (catalogue figure; not on
  either page). Yield 2000 g per plant (estimate). `fruitSetMaxC` 35 from the brief's cucurbit value.

## zucchini (summer squash)

Sources: UMN "Growing summer squash and zucchini in home gardens"; RHS "How to grow courgettes"; CSU.

- Sowing: UMN direct after the last frost, soil at least 21 C at 5 cm, seed 1.3 cm deep; RHS outdoors
  2.5 cm deep, two or three per site, germination 18 to 21 C. `soilMinC` 18, direct `[1, 4]`.
- Transplants: UMN advises against them (root disturbance); RHS sows indoors in 7.5 cm pots for an
  earlier crop. I kept an indoor option, `[3, 4]` weeks, with a note to handle roots gently.
- Spacing: RHS at least 90 cm, about a square metre per plant; CSU 90 to 120 cm; UMN bush rows 60 to
  90 cm. Chosen 90 x 120, density 3 x 3 squares (the brief's example).
- Mulch: UMN, only once soil is above 24 C. Container: RHS at least 45 cm wide, about 45 L.
- Yield: RHS three or four fruits per plant per week in good weather. 3000 g per plant over a 60 day
  window is conservative. Maturity 50 days from sowing (catalogue).

## winter-squash

Sources: UMN "Growing pumpkins and winter squash in home gardens"; RHS "How to grow squashes"; CSU.

- Soil: UMN 18 C (65 F) at 5 cm to germinate properly; CSU 16 C. Chosen 18.
- Indoor: UMN about 4 weeks from seeding to transplant, pots at least 5 cm wide, 2 to 3 true leaves.
- Timing: UMN late spring after warm soil; CSU 2 or more weeks after last frost. Direct and
  transplant `[1, 3]`.
- Spacing: UMN 61 to 91 cm in row (closer for bush), rows 1.5 to 1.8 m; RHS bush 90 cm, trailing
  1.5 m. Chosen 90 x 180, density 3 x 3 squares. Container `null`: trailing types are not suited;
  RHS gives a 45 cm container only for summer squash.
- Harvest and curing: UMN before a hard freeze, a light frost that kills vines usually spares fruit;
  field cure 1 to 2 weeks or indoors at 27 C (80 F); store at about 13 C. RHS stores at 10 to 15 C.
- Maturity 95 days from sowing and yield of 3 fruits per plant are catalogue-based estimates; neither
  source gives them.

## pumpkin

Sources: UMN "Growing pumpkins and winter squash in home gardens"; RHS "How to grow pumpkins"; CSU.

- Same soil and timing basis as winter squash (UMN covers both). RHS: indoor sowing 1 cm deep, seed
  on its side, outdoors 2.5 cm deep, two or three per site.
- Spacing: RHS bush 90 cm, trailing 1.5 m; UMN as for winter squash. Chosen 90 x 180, 3 x 3 squares.
- Fruit: RHS keep two or three per plant for large fruit, one for giants. Yield 2 per plant.
- Curing: RHS in the sun for 7 to 10 days; frosted fruit does not store. Maturity 100 days from
  sowing (catalogue figure).

## melon (muskmelon and cantaloupe)

Sources: UMN "Growing melons in the home garden"; RHS "How to grow melons"; CSU.

- Category `fruit`: the RHS files melons under fruit. This is a judgment call; other cucurbits stay
  `vegetable`.
- Indoor: UMN 2 to 4 weeks before the last frost, transplant at 2 or 3 true leaves; RHS plant out at
  three or four leaves, germination 18 to 21 C. UMN germination best at 21 to 32 C. Age `[3, 4]`.
- Planting out: UMN soil at least 18 C (65 F); RHS nights not below 12 to 15 C; CSU 2 or more weeks
  after last frost. Transplant and direct `[2, 4]`. UMN also mentions direct sowing about a week
  before the last frost once soil reaches 18 C, which reads as a regional quirk; I followed the soil
  rule and CSU.
- Spacing: UMN transplants 60 cm apart in rows 1.5 m apart; RHS 45 cm trained, 90 cm trailing; CSU 90
  to 120 cm. Chosen 60 x 150, density 2 x 2 squares.
- Container: RHS at least 40 cm wide and deep, about 40 L. Fruits: RHS up to four outdoors; yield 3.
- Maturity: UMN 35 to 45 days from flowering, choose varieties of 65 to 80 days. Chosen 80 from sowing.

## watermelon

Sources: USU "How to Grow Watermelon in Your Garden"; Clemson HGIC "Watermelons"; UMN "Growing melons
in the home garden".

- Soil: USU 18 C (65 F); Clemson 16 to 18 C at 10 cm; UMN 18 C and notes watermelon is more cold
  sensitive than cantaloupe. Chosen 18.
- Air: Clemson average 21 to 29 C (70 to 85 F) for good growth. Mean 21 to 30.
- Transplants: USU allow 6 weeks, 2 to 3 mature leaves; UMN 2 to 4 weeks. Chosen `[3, 5]`.
- Timing: USU says plastic mulch and row covers allow planting 2 to 3 weeks before the last frost;
  Clemson and CSU say after the last frost (CSU 2 or more weeks after). Chosen `[2, 4]` for unprotected
  planting.
- Spacing: USU transplants 60 cm apart in rows 1.2 to 1.8 m, or mounds 1.2 m apart with two plants;
  Clemson 1.5 to 1.8 m in rows 1.8 to 2.4 m, about 2.2 square metres per plant. Chosen 90 x 180,
  density 3 x 3 squares, the low end of Clemson and above USU.
- Maturity: Clemson 85 to 90 days from transplant to first ripe fruit for the large varieties it
  lists; USU 35 to 45 days from flowering. Chosen 85 from sowing, which suits mid-sized and icebox
  types; large types run longer.
- Yield: USU about 40 fruits per 30 m of row, which at its spacing is roughly one per plant; I chose 2
  per plant at the wider spacing used here. This is the least certain number in the batch.
- Container `null`.

## bush-bean

Sources: UMN "Growing beans in home gardens"; RHS "How to grow French beans"; Clemson HGIC "Bush &
Pole-Type Snap Beans"; CSU.

- Soil: Clemson at least 16 C (60 F) at 10 cm; CSU minimum 13 C (55 F); UMN cold soil rots the seed.
  Chosen 16.
- Timing: CSU sow around the average last frost; UMN once soil has warmed; RHS outdoors late spring
  after frost. Chosen `[1, 4]`.
- Spacing: UMN 10 cm in row, rows 60 to 90 cm; Clemson 5 to 10 cm, rows 60 to 90 cm; RHS 15 cm.
  Chosen 10 x 60, density 9.
- Temperatures: Clemson best at 16 to 24 C average, blossom drop above 32 C (90 F). Mean 16 to 26,
  `fruitSetMaxC` 32.
- Succession: UMN every 2 weeks until about 8 weeks before fall frost; Clemson every 10 to 14 days.
  Chosen 14. `fall.windowWeeks` 4: Clemson lists fall plantings, UMN sows into late summer.
- Maturity: Clemson about 55 days. Harvest window: UMN harvest comes at once; RHS crops for a few
  weeks. Continuous for 21 days.
- Container: RHS 30 to 45 cm wide. 15 L for four plants. Yield 100 g per plant (estimate; no source
  figure).

## pole-bean

Sources: UMN "Growing beans in home gardens"; RHS "How to grow French beans"; Clemson HGIC "Bush &
Pole-Type Snap Beans".

- Same soil and timing as bush beans (all three sources treat them together).
- Spacing: UMN 10 cm or two to four seeds per pole; RHS one plant per cane, canes 15 cm apart, rows at
  least 45 cm apart. Chosen 15 x 90, density 8 on a trellis.
- Supports: Clemson trellis at least 1.8 to 2.4 m; RHS canes 2.5 m, plants reach about 2 m.
- Harvest: UMN many pickings until frost, no succession needed; RHS midsummer to early autumn, pods
  15 to 20 cm. Window 60 days (see Schema gaps: "until frost" cannot be expressed).
- Container: RHS at least 75 cm wide and 45 cm deep, which is a full wigwam. I chose 40 L for three
  plants as the smallest pot that still gives a crop; this is a judgment call.
- Maturity 65 days from sowing: Clemson's 55 days covers bush and pole together, and pole types are
  generally later. Yield 250 g per plant (estimate).

## pea (garden, snap and snow)

Sources: UMN "Growing peas in home gardens"; RHS "How to grow peas"; CSU.

- Frost: CSU groups peas as hardy; UMN young plants take light frost, but frost on flowers and pods
  does damage. `hardy`.
- Timing: UMN as soon as the soil has thawed and can be worked; CSU as early as 2 to 4 weeks before
  last frost; RHS outdoors once soil is about 10 C. Chosen `[-6, -2]`.
- Soil: CSU minimum 4 C (40 F); RHS about 10 C. Disagreement: CSU is the bare germination floor and
  RHS the practical sowing temperature. Chosen 7.
- Temperatures: UMN best at 13 to 18 C, grows above 4 C, growth, flowering and pod set stop above
  29 C (85 F). Mean 10 to 21, `fruitSetMaxC` 29.
- Spacing: RHS 7.5 cm; UMN 5 cm broadcast, 15 to 18 cm for tall vining rows; CSU 10 to 15 cm.
  Chosen 8 in row (RHS) so that density 8 passes the spacing sanity check; rows 60 cm.
- Maturity: UMN about 60 days; RHS 12 to 16 weeks from sowing in a cool spring. Chosen 60.
- Fall: UMN describes a second sowing for fall harvest. `fall.windowWeeks` 3.
- Container: RHS at least 45 cm wide; 20 L for about ten plants. Yield 50 g per plant (estimate).

## fava-bean (broad bean)

Sources: RHS "How to grow broad beans"; Johnny's "Growing Fava Beans From Seed".

- Spring sowing: Johnny's early spring as soon as soil can be worked; RHS outdoors early to late
  spring. Chosen `[-6, -2]`, as for peas.
- Overwinter: Johnny's sow in late summer where winter lows stay above -12 C (10 F); RHS sow hardy
  varieties such as 'Aquadulce Claudia' in mid to late autumn in mild areas, cropping as early as late
  spring. Converted relative to first fall frost: Johnny's late summer is several weeks before frost,
  RHS's autumn sowings are around it. `plantWeeks [-6, 0]`; `harvestWeeks [2, 8]` after the next last
  frost. Frost kept `hardy`.
- Soil: neither source gives a number ("as soon as the soil can be worked"). `soilMinC` 5 is an
  estimate by analogy with peas.
- Spacing: RHS 15 to 23 cm, single rows 45 cm apart; Johnny's 10 to 15 cm in rows 46 to 91 cm, or one
  plant per 30 cm square in wide beds. Chosen 20 x 45, density 2 (Johnny's gives 1, RHS spacing gives
  2 to 4).
- Temperatures: Johnny's notes an aphid-spread virus is worst above 27 C. No source gives a pod-set
  ceiling; `fruitSetMaxC` 27 reflects the common observation that fava sets poorly in heat. Mean 7 to
  20. This is an estimate.
- Container: RHS at least 40 cm wide, 15 cm apart: 30 L for four plants. RHS pinching out of tips
  once the lowest pods form is in the care note.
- Maturity 85 days from spring sowing and yield 200 g per plant are estimates.

## sweet-corn

Sources: UMN "Growing sweet corn in home gardens"; RHS "How to grow sweetcorn"; Johnny's "Growing Sweet
Corn: How to Plant, Grow & Harvest".

- Soil: UMN minimum su 16 C, se 13 to 16 C, sh 13 to 18 C; Johnny's untreated seed 18 C, treated
  16 C; RHS above 10 C; CSU minimum 10 C. Chosen 16 (UMN su, Johnny's treated), with the note telling
  supersweet growers to wait for 18 C.
- Timing: CSU around the average last frost; RHS plants out after frost risk has passed. Direct
  `[1, 4]`. RHS raises plants indoors and plants out at 8 to 15 cm tall, so indoor `[3, 4]` and
  transplant `[1, 3]` are included.
- Spacing: UMN 20 to 30 cm in row, rows 76 to 91 cm, blocks of at least four rows; RHS 34 to 45 cm
  each way in blocks; Johnny's 15 to 18 cm, rows 76 to 91 cm. Chosen 30 x 75, density 1.
- Isolation: UMN and Johnny's both say keep supersweet types apart or separate maturity by about two
  weeks (Johnny's 12 days). In the care note.
- Maturity: UMN su 75 to 92, se 67 to 83, sh 63 to 87 days; Johnny's counts from direct seeding.
  Chosen 80.
- Harvest: UMN and Johnny's silks brown 18 to 24 days after first silk; RHS milky kernel test. Window
  10 days, once.
- Succession every 14 days: Johnny's says plantings can continue through early summer; the interval
  is a common practice figure, not stated by these pages.
- Yield: RHS says most plants bear two cobs; I chose 1 good ear per plant as the conservative figure.
- `fruitSetMaxC` 35: pollen viability falls in heat above about 35 C. No opened page states it; this
  is a standard agronomy figure and an estimate here.
- Container `null`: RHS allows compact varieties in large pots, but block pollination makes pots a
  poor fit.

## okra

Sources: Clemson HGIC "How to Grow Okra in South Carolina"; RHS "How to grow okra".

- Soil: Clemson optimum 21 to 35 C, wait if below 18 C (65 F) at 10 cm. Chosen 18.
- Air: Clemson best growth at 24 to 32 C (75 to 90 F). Mean 21 to 32. No `fruitSetMaxC`: neither
  source gives a ceiling and okra keeps setting in heat that stops other crops.
- Timing: Clemson regional dates fall roughly 2 to 6 weeks after last frost; RHS transplants in late
  spring to early summer. Direct and transplant `[2, 5]`.
- Indoor: RHS sow in small pots, plant out at 10 to 15 cm tall; seed soaked 2 hours in warm water.
  Age `[4, 6]` is my estimate.
- Spacing: Clemson 23 to 30 cm in row, rows 0.9 to 1.8 m; RHS 30 to 90 cm by variety. Chosen 30 x 90.
- Harvest: Clemson 60 to 70 days, pods 5 to 8 cm, pick at least every two days, up to twelve weeks of
  picking; RHS 5 to 10 cm. Maturity 60, window 80 days.
- Container: RHS at least 30 cm wide and deep, about 20 L. Yield 400 g per plant (estimate).

## potato

Sources: UMN "Growing potatoes in home gardens"; RHS "How to grow potatoes"; NDSU "Dakota Gardener:
How to plant potatoes"; CSU.

- Method: `plant` with `what: "seed potatoes"`; maturity counted from planting (`from: "transplant"`,
  which the schema accepts with a `plant` method).
- Timing: CSU 0 to 2 weeks before average last frost; NDSU about 2 weeks before; RHS first earlies in
  late March, roughly 4 weeks before a typical British last frost. Chosen `[-4, 0]`.
- Soil: CSU minimum 7 C (45 F); NDSU 13 to 16 C to prevent seed rot. Chosen 10 as a compromise.
- Seed and depth: UMN pieces 3 cm with at least one eye, 8 to 13 cm deep; NDSU egg-sized pieces with
  2 to 3 eyes, 10 to 15 cm; RHS 15 cm trenches. Note says 10 to 15 cm.
- Spacing: UMN 25 to 30 cm, rows 76 to 91 cm; RHS earlies 30 x 60, maincrop 37 x 75; NDSU 30 cm.
  Chosen 30 x 75.
- Earthing up: RHS first at about 23 cm, ridge 20 to 30 cm; UMN at about 30 cm, 15 to 20 cm total.
- Maturity: UMN new potatoes 7 to 8 weeks after planting; RHS earlies as little as 12 weeks,
  maincrops longer. Chosen 90 days (see Schema gaps).
- Curing: UMN 15 to 18 C for ten days or more. Container: RHS at least 30 cm wide and deep per seed
  potato, about 20 L. Yield 1000 g per plant (estimate).
- No `fall` block: none of the opened sources describes a fall crop as normal practice.

## sweet-potato

Sources: Clemson HGIC "Sweetpotato"; RHS "How to grow sweet potatoes".

- Method: `plant` with `what: "rooted slips"`.
- Timing: Clemson well after the last frost, soil above 18 C (65 F); RHS late spring or early summer
  once plants are well rooted. Chosen `[2, 5]`.
- Temperatures: RHS does best at 21 to 26 C. Mean 20 to 29.
- Slips: Clemson sprouts appear in about 2 weeks, pulled at 15 cm or more; rooting in water about 10
  days. The note suggests starting about 6 weeks before planting.
- Spacing: Clemson 20 to 30 cm in rows 90 cm, 8 to 10 cm deep; RHS at least 30 cm. Chosen 30 x 90.
- Maturity: Clemson 90 to 120 days (Beauregard 90 to 100); RHS four to five months in a cool climate.
  Chosen 100 from planting.
- Curing: Clemson 29 C (85 F) and 90 percent humidity for a week, none below 21 C; store never below
  10 C, never refrigerate. Store range in the note, 13 to 16 C, sits inside the usual extension
  storage range. Container: RHS pot at least 30 cm wide; 30 L chosen. Yield 800 g per plant
  (estimate).

## Glyph colours

Solanaceae: tomato `#d64545` (existing), sweet pepper `#3f9b3a`, chili `#e0622a`, eggplant `#5b2d6e`,
tomatillo `#a5c23a`, potato `#b8935a`. Cucurbitaceae: cucumber `#2f7d32`, zucchini `#6b8e23`, winter
squash `#c98a2e`, pumpkin `#f47a1f`, melon `#f5b971`, watermelon `#e2526b`. Fabaceae: bush bean
`#5aa832`, pole bean `#2f7a3a`, pea `#9ccc3c`, fava `#6f8f4e`. Sweet corn `#f2d23c`, okra `#7fae5b`,
sweet potato `#c4622d`.

## Test run note

`npx vitest run tests/unit/plant-library.test.ts` first reported only 7 tests (tomato alone): the
vitest file-system module cache had kept an old result of `import.meta.glob`. Running with the cache
off (`--experimental.fsModuleCache=false`, or the top-level `fsModuleCache` option) loads every file;
all 79 tests then passed.

## Schema gaps

1. **Overwinter conditions.** Fava's autumn sowing only works where winter lows stay above about
   -12 C. `overwinter` has `chillWeeks` but no minimum winter temperature, so the app cannot tell a
   gardener with a hard winter not to try it.
2. **Harvest "until frost".** Pole beans, okra, peppers and other continuous croppers bear until the
   first fall frost. `harvest.windowDays` is a fixed length, so the window is a guess for any given
   climate.
3. **Pollination and planting minimums.** Tomatillo needs at least two plants, sweet corn a block of
   at least four rows, and seedless watermelon a pollinizer. These live only in the notes.
4. **Support and habit.** Cucumber, melon and pole bean densities assume a trellis; there is no field
   for "needs support" or for the trailing versus trellised footprint, so `canopy` and `density`
   describe one growing style only.
5. **Maturity counted from one method.** When a crop can be direct sown or transplanted (cucurbits,
   corn, okra), one `maturity` figure serves both. Transplants are typically ready one to two weeks
   sooner.
6. **Variety-dependent figures.** Sweet corn soil temperature differs by sugar type (su, se, sh2) and
   potato maturity by type (earlies about 12 weeks, maincrops 16 to 20). One number each.
7. **Planting-out conditions.** Warm-season transplants are gated by night temperature (peppers and
   eggplant nights above 10 C, chili and melon above 12 C). The schema has `soilMinC` for germination
   but no night-minimum field; for transplanted crops `soilMinC` is ambiguous.
8. **Lead time for planting stock.** Sweet potato slips must be grown from roots about 6 weeks ahead,
   and potatoes benefit from 4 to 6 weeks of pre-sprouting. `methods.plant` has no lead-time field.
