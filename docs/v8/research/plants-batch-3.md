# Plant research log: batch 3 (perennial crops, fruit, herbs, companion flowers)

Week offsets are relative to the median last spring frost (LF50). Every source listed under a
plant was opened and returned HTTP 200 for that crop. Figures quoted from seed catalogue search
listings that were not opened are marked "not cited".

Two general rules I applied where sources were silent:

- **temp.minC / maxC** (daily mean). Few home-garden pages publish a daily-mean range. Where none
  was found I used the brief's bands (cool season about 7 to 24, warm season about 16 to 30) and
  adjusted for what the sources say about the crop (for example "cool-season" or "warm-season" in
  the UMN herb table, heat bolting, heat stopping flowering). These are judgement values.
- **yield for herbs and flowers**. No opened source quantifies herb yield per plant or blooms per
  plant. The values are deliberately conservative estimates and are flagged per plant.

## Perennial crops and fruit

### Asparagus
- Sources: UMN Extension, Growing asparagus in home gardens; RHS, How to grow asparagus.
- Crowns: UMN trench 15 to 30 cm (shallower on clay), cover 5 to 8 cm, buds about 30 cm apart,
  rows at least 90 cm. RHS 30 to 45 cm in row, 45 cm between rows, holes about 20 cm deep. Chose
  30 cm in row (both agree it works) and UMN's 90 cm rows.
- Planting time: UMN early May to early June in its region (roughly LF50 -2 to +3); RHS March
  (about -4 to -6). Chose plant weeks [-4, 2].
- First harvest: both say wait two years from crowns, so harvest starts in season 3
  (firstHarvestYear 3). UMN: two weeks in the first harvest year; RHS: six weeks in year 3, eight
  weeks after. The note says "lightly for 2 to 4 weeks", then 6 to 8 weeks.
- Yearly window: UMN 6 to 8 weeks, early May to late June (about -2 to +6); RHS from mid April for
  about 8 weeks (about 0 to +8). Chose [-2, 6], windowDays 56.
- Lifespan: UMN 15 or more years, RHS up to 20. Chose 15.
- Yield: RHS about 10 spears per established plant over the season; used count 10.
- Container: RHS says pots at least 30 cm wide and deep, one crown, lighter crops. Set 20 L.
- maturity 730 days from planting: an honest "about two years to first harvest" (see Schema gaps).
- pH 6.5 to 7.0 from UMN.

### Rhubarb
- Sources: UMN Extension, Growing rhubarb in home gardens; RHS, How to grow rhubarb; USU
  Extension, How to Grow Rhubarb in Your Garden.
- Spacing: UMN 90 x 90 cm; RHS 75 to 90 cm; USU 90 cm, rows 120 cm. Chose 90 x 90, squares [3, 3].
- First harvest: sources disagree. UMN: second season. RHS: a few stalks in year 2, normal from
  year 3. USU: none for two years, 3 to 4 weeks in year 3. Followed UMN and the brief:
  firstHarvestYear 2, with the note saying "only a few in the second".
- Window: UMN through the end of June; RHS April or May to late June or early July (2 to 3
  months); USU 6 to 10 weeks once established. Chose [0, 8], 56 days.
- Lifespan: UMN 15 or more years; USU 10 to 15, divide every 5 to 10 years; RHS divide about every
  five years. Chose 15 with a division note.
- Yield: USU 4 to 12 lb per plant per year. Used the low end, 1800 g.
- Container: RHS pot at least 50 cm deep and wide, compact variety. Set 75 L.
- Shade: UMN wants all-day sun; RHS says it copes in light shade. shadeTolerant true, sun full.
- Chill: none of the opened pages give a figure; the note says it needs a cold winter rest.
- Seed: UMN starts seed indoors 6 weeks before last frost, but seed adds a year to first harvest,
  so only crowns are modelled.

### Strawberry
- Sources: UMN Extension, Growing strawberries in the home garden; RHS, How to grow
  strawberries; Nebraska Extension NebGuide G89-897, Strawberries.
- Spacing disagreement: UMN quick facts 30 to 45 cm, its body 45 to 60 cm matted rows with rows
  90 to 120 cm; RHS 35 to 40 cm, rows 75 cm; Nebraska matted row 45 to 60 cm, rows 90 to 120 cm,
  hill system 45 cm. UMN also allows a 30 cm grid. Chose 30 cm in row (the closest UMN figure,
  which also matches its 1 x 1 ft grid) and 90 cm rows, density 1 per square. The density test
  rules out the square-foot tradition of 4 per square at these spacings.
- Planting: UMN dormant plants April or May once soil is workable; Nebraska early to mid April.
  Chose plant weeks [-4, 0].
- Modelled as June-bearing, the most common type: firstHarvestYear 2 (Nebraska: full production
  the year after planting, flowers removed through the first season). Day-neutral first-year fruit
  is in the notes.
- Harvest: RHS 2 to 3 weeks of heavy cropping; UMN about four weeks. windowDays 21, yearly window
  [4, 8].
- Yield: Nebraska "at least one quart" per healthy plant. Used 500 g, slightly under a quart.
- Bed life: Nebraska no more than three fruiting seasons; RHS replant every 3 to 4 years; UMN move
  every 3 to 4 years. lifespanYears 4 (planting year plus three crops).
- Winter mulch: UMN straw once dormant and below 40 F, written as {c:4}.
- Container: RHS large containers at 20 cm spacing, no size given. Set 11 L for 3 plants
  (judgement).
- fruitSetMaxC left out: no opened source gives one.

### Blueberry (northern highbush)
- Sources: RHS, How to grow blueberries; Ontario Ministry of Agriculture, Food and Agribusiness,
  Growing blueberries for home gardens and small scale production.
- pH: RHS 4.5 to 5.5; Ontario 4.5 to 5.0, tolerates 5.5, unsuitable above 6.5. Note says 4.5 to
  5.5 and how to deal with it.
- Spacing: Ontario 1.0 to 1.5 m in row, rows 1.5 to 3.0 m; RHS 1 to 2 m. Chose 120 cm and 240 cm,
  squares [4, 4].
- Plant age and timing: Ontario 2- or 3-year-old dormant plants in early spring as soon as soil
  can be worked. plant weeks [-4, 0].
- First crop: Ontario about 225 g per bush in year 3, 450 to 900 g in year 4, rising until 6 to 8
  years; remove blossoms in seasons 1 and 2. firstHarvestYear 3.
- Yield: Ontario 2.5 to 3.5 kg mature; RHS 2.25 to 5 kg at about seven years. Used 2500 g.
- Harvest: Ontario fruit ripens over 4 to 6 weeks; RHS from midsummer into early autumn. 35 days,
  yearly window [8, 15].
- Lifespan: Ontario 20 or more years. lifespanYears 20.
- Container: RHS at least 30 cm for a young plant, 45 to 50 cm for a larger one. Set 45 L.
- Shade: RHS crops reasonably in part shade, so shadeTolerant true.
- Chill: neither source gives chill hours. The note says most varieties need a long cold winter and
  to choose low-chill types in mild climates.

### Raspberry
- Sources: RHS, How to grow raspberries; Oregon State University Extension, Growing Raspberries in
  Your Home Garden.
- Spacing: RHS 40 to 60 cm in row, rows 1.5 to 2 m; OSU 60 to 75 cm in row, rows 2.4 to 3 m. Chose
  60 cm and 200 cm, squares [2, 2].
- Planting: OSU as soon as soil can be worked in spring; RHS any time while dormant. plant weeks
  [-4, 0]. Depth: RHS top roots no more than 5 cm down; OSU 2.5 to 5 cm.
- Modelled as summer-fruiting (floricane): first crop in the second summer (firstHarvestYear 2).
  Autumn-fruiting types often crop in year 1 (RHS); this is in the notes (see Schema gaps).
- Harvest: OSU about two months, June and July; RHS summer types early to late summer. windowDays
  42, yearly window [6, 12].
- Yield: OSU 18 to 27 lb per 10 ft of mature summer-bearing row. At 60 cm spacing that is about 5
  plants, or 1.6 to 2.4 kg each. Used 1500 g.
- Lifespan: RHS crops well for up to ten years; OSU red raspberry plantings 10 to 15 years. 10.
- Container: RHS compact varieties only, pot at least 40 cm wide and 30 cm deep. Set 35 L.
- pH 5.6 to 6.5 from OSU.

## Annual and biennial herbs

### Basil
- Sources: RHS, How to grow basil; Clemson HGIC, Basil; Illinois Extension, Basil; Johnny's,
  Genovese Basil Seed.
- Indoor start: Clemson 4 to 6 weeks; Illinois 3 to 4; Johnny's about 6; UMN herb page 6 to 8.
  Chose [4, 6].
- Planting out: RHS nights above 10 C; Illinois after frost with soil at least 60 F; Clemson nights
  above 50 F. Transplant weeks [1, 3], soilMinC 16 (Illinois 60 F).
- Spacing: big disagreement. Clemson 60 cm x 90 cm (for large plants); Johnny's 10 to 20 cm, rows
  45 cm; RHS thin to 10 to 20 cm. Chose 20 cm and 45 cm rows, 4 per square.
- Days: Johnny's 68 days from seeding (its herb figures count from seeding). maturity 68 from sow.
- Container: RHS at least 20 cm wide and deep, so 6 L.
- Yield 200 g per plant over the season: estimate.

### Parsley
- Sources: RHS, How to grow parsley; Illinois Extension, Parsley; Oregon State Extension, Soil
  temperature conditions for vegetable seed germination; Johnny's, Giant of Italy Parsley Seed.
- Listed as annual per the schema; the care note explains the second-year flowering (Illinois,
  RHS).
- Soil temperature: OSU table minimum 40 F, optimum range 50 to 85 F; emergence 29 days at 50 F,
  17 at 59 F, 14 at 68 F. soilMinC 10 (bottom of the optimum range; the 4 C minimum is too slow
  to plan by). The note gives about 4 weeks at {c:10}, about 2 weeks at {c:20}.
- Spacing: RHS 15 to 30 cm, rows 20 to 30 cm; Johnny's 20 to 30 cm, rows 30 to 45 cm. Chose 20 and
  30, 4 per square.
- Timing: Johnny's prefers transplants, direct sowing after last frost; RHS outdoors mid spring to
  late summer. Parsley is hardy, so transplant [-2, 2], direct [-2, 4], indoor [6, 8]. Fall
  window 4 because RHS has sowings run to late summer for autumn and winter picking.
- Days: Johnny's 75 from seeding.
- Container: RHS at least 25 cm wide and deep, about 12 L.
- Yield 150 g per plant: estimate.

### Cilantro / coriander
- Sources: RHS, How to grow coriander; Illinois Extension, Cilantro; Texas A&M AgriLife,
  Cilantro; Johnny's, How to Grow Cilantro (Coriander); Penn State Extension, Cilantro, a Unique
  Culinary Herb. Also opened USU Extension, Cilantro/Coriander in the Garden, but did not cite it
  (five sources are enough).
- Frost: Texas A&M says it tolerates light frost; Illinois and USU say sow after frost. Set
  half-hardy and direct weeks [-2, 2] as a compromise between "light frost is fine" and "after
  frost".
- Temperature: Texas A&M does best under 50 to 85 F (daily range, not mean) and soil 45 to 85 F.
  temp 7 to 24 (daily mean; maxC 24 is the point where heat bolting becomes likely), soilMinC 7.
- Succession: Johnny's 2 to 3 weeks; Illinois 3 to 4; Penn State 2 to 4; RHS every few weeks to
  monthly. Chose 21 days. Fall window 4 (RHS and USU sow again late in the season).
- Spacing for leaves: Johnny's 0.6 to 1.3 cm apart with no thinning; USU 5 cm; Penn State and
  Clemson 15 to 20 cm; RHS 10 cm for transplants. Chose 10 cm, rows 30 cm, 9 per square.
- Days: Texas A&M 50 to 55; Penn State 50 for 'Slow Bolt', 28 to 40 for 'Leisure'. 50 from sow.
- Harvest windowDays 21 reflects the short useful life before bolting (Illinois).
- Container 6 L: RHS says it grows well in containers, size is my estimate. Yield 50 g: estimate.

### Dill
- Sources: RHS, How to grow dill; Illinois Extension, Dill; USU Extension, How to Grow Dill in
  Your Garden; Johnny's, Bouquet Dill Seed.
- Timing: Illinois 1 to 2 weeks before last frost; Johnny's as soon as soil can be worked; RHS
  once soil has warmed. Direct [-2, 2], half-hardy (USU calls it quite hardy).
- Succession: Illinois every 2 weeks; Johnny's every 3; USU every 4 to 6. Chose 21 days.
- Spacing: RHS thin to 20 cm, rows 30 cm; USU 23 cm, rows 30 cm; Johnny's sows thickly with no
  thinning for leaf. Chose 20 and 30, 2 per square.
- Days: Johnny's 40 to 45 to leaf, 85 to 105 to seed; USU 6 to 8 weeks; RHS about six weeks.
  maturity 42 from sow.
- Seed: Illinois harvests 2 to 3 weeks after blossoms appear.
- Insects: USU lists bees, butterflies, wasps, lady beetles, lacewings, hoverflies and tachinid
  flies, and says to leave swallowtail caterpillars.
- Container: RHS at least 30 cm deep and wide, compact variety: 20 L. Yield 50 g: estimate.

## Perennial herbs

### Chives
- Sources: RHS, How to grow chives; Illinois Extension, Chives; Johnny's, Nelly Chive Seed.
- Divisions of 4 to 6 bulbs (Illinois), divide every 2 to 3 years (Illinois) or 3 to 4 (RHS,
  Johnny's). Note says 3 to 4.
- Spacing: RHS thin to 15 to 20 cm, clumps at least 15 cm apart; Johnny's 5 to 20 cm, rows 45 cm.
  Chose 15 cm and 45 cm, 4 clumps per square.
- Seed: Johnny's starts 6 to 8 weeks before last frost, several seeds per plug; direct sow once soil
  warms. Days 75 to 85 from seeding, used 80.
- Container: RHS at least 20 cm wide and deep: 6 L.
- No perennial block (optional for herbs). Yield 100 g: estimate.

### Mint
- Sources: RHS, How to grow mint; Illinois Extension, Mint.
- Spreading: both say grow in a container; Illinois says above-ground containers are best because
  mint escapes sunk pots. That is in the notes.
- Spacing: neither gives one. 45 cm in row, 60 cm rows is my judgement for a plant that spreads.
- Container 11 L is my estimate for one established plant; RHS only says pot on as it grows.
- Divide every 3 to 4 years (Illinois), every few years (RHS).
- maturity 30 days from planting: estimate. Yield 200 g: estimate.

### Oregano
- Sources: RHS, How to grow oregano; Illinois Extension, Oregano.
- Illinois: cuttings for best flavour, seed does not come true, seed needs light; Greek oregano only
  marginally hardy in very cold winters, mulch after the soil freezes. RHS: Origanum vulgare
  reliably hardy, germinates at about 20 C, plant out after last frost, 20 to 30 cm apart, pot at
  least 15 cm. Set hardy, transplant [0, 3], spacing 30 cm, container 3 L.
- Harvest leaving 4 to 6 leaf pairs (Illinois). maturity 60 days and 100 g yield: estimates.

### Thyme
- Sources: RHS, How to grow thyme; Illinois Extension, Thyme.
- RHS: germination 15 to 20 C, plant out mid spring to early summer, 20 to 30 cm apart, pot at
  least 15 cm wide and 10 cm deep; most varieties tolerate frost but dislike wet winters; replace
  when straggly. Illinois: divisions or cuttings easier than seed; poor winter drainage shortens
  life.
- Spacing 25 cm (middle of RHS range), 1 per square because mature plants spread about 30 cm.
- Transplant [-2, 2]: hardy, RHS plants out from mid spring. maturity 60 and yield 50 g: estimates.

### Sage
- Sources: RHS, How to grow sage; Illinois Extension, Sage.
- RHS at least 30 cm from neighbours, height 30 to 90 cm, pot at least 30 cm wide and deep,
  replace after six or seven years. Illinois cuttings preferred, coloured types not dependably
  hardy in cold winters. Chose 45 cm spacing because plants grow to about 60 cm across, container
  20 L. The note says replace after five or six years (slightly earlier than RHS, as Illinois
  says only "as plants age").
- Transplant [-1, 3]: RHS plants out once soil starts to warm. maturity 60 and yield 100 g:
  estimates.

### Rosemary
- Sources: RHS, How to grow rosemary; Illinois Extension, Rosemary.
- Hardiness: RHS says established plants survive about -8 C; Illinois says it is not reliably hardy
  in cold-winter climates and should be potted and brought in. The schema frost field is about
  light frost, which rosemary handles, but I set half-hardy as instructed so it is not treated as
  winter-safe (see Schema gaps).
- Spacing: RHS at least 45 cm; chose 60 cm, squares [2, 2]. Container RHS at least 30 cm wide and
  deep: 20 L.
- Planting from nursery plants or cuttings only, plant weeks [0, 4]; seed takes years (both).
- maturity 60 and yield 100 g: estimates.

## Flowers

### French marigold (Tagetes patula)
- Sources: Clemson HGIC, How to Grow and Care for Marigolds; Wisconsin Extension, Marigolds.
- Indoor: Clemson 4 to 6 weeks for French types at 70 to 75 F (8 weeks is for African types);
  Wisconsin 8 weeks for marigolds in general. Chose [4, 6].
- Direct sow: Wisconsin once soil is above 65 F, so soilMinC 18; Clemson after frost and warm soil.
- Spacing: Clemson 20 to 25 cm. Chose 20 cm, 4 per square.
- Days to bloom: Johnny's catalogue lists French types at 50 to 60 days from sowing (search listing,
  not cited). Used 55.
- Nematodes: both sources say dense marigold cover crops reduce root-knot nematodes; Clemson says
  interplanting does not protect nearby plants. The note says exactly that.
- Yield 30 blooms per plant: conservative estimate.

### Nasturtium
- Sources: RHS, How to grow annual nasturtiums; Johnny's, Growing Nasturtium From Seed.
- RHS: sow indoors in spring and plant out after last frost, or sow outdoors late spring to early
  summer; best on poor soil; cabbage white caterpillars and blackfly are the main pests. Johnny's:
  germinates 7 to 14 days at 60 to 65 F, sow 1.3 to 2.5 cm deep, seed needs darkness, 20 to 30 cm
  apart, 3 to 5 plants per 25 cm container, transplants sown 3 to 4 weeks ahead.
- soilMinC 16 from the bottom of Johnny's germination range. Spacing 30 cm, 1 per square.
- Edible parts: RHS lists leaves, seeds and young buds; Johnny's adds flowers.
- Days: Johnny's lists 'Jewel Mix' at 55 to 65 days (search listing, not cited). Used 60.
- I did not add trap-crop claims: the opened sources do not support them.
- Yield 30 blooms: estimate.

### Calendula
- Sources: USU Extension, How to Grow Calendula in Your Garden; Wisconsin Extension, Calendula,
  Calendula officinalis.
- Timing disagreement: Wisconsin sows outdoors just before last frost and starts indoors 6 to 8
  weeks ahead; USU sows when soil reaches about 60 F and sets transplants out after frost. USU also
  says plants survive 25 F (about -4 C). Chose half-hardy, direct [-2, 0], transplant [0, 2],
  soilMinC 10 (judgement: Wisconsin's timing implies germination in cool soil; USU's 60 F is for
  quick emergence).
- Heat: USU prefers below 85 F and often stops blooming in extreme heat; Wisconsin says it recovers
  when cooler weather returns. temp 7 to 24.
- Spacing: USU 20 to 30 cm. Chose 25 cm, 2 per square.
- Days: Johnny's catalogue lists 'Alpha' at 50 to 55 days (search listing, not cited). Used 55.
- Container 8 L and yield 20 blooms: estimates.

### Sunflower
- Sources: RHS, How to grow Helianthus (sunflowers); University of Georgia, Growing Sunflowers in
  the Home Garden.
- UGA: soil at least 60 F (soilMinC 16), 2.5 to 5 cm deep, thin to 30 to 38 cm, rows 60 to 90 cm,
  succession every couple of weeks. RHS: not frost hardy, sow outdoors after soil warms, stake tall
  types, dwarf types suit patio containers, bees visit.
- Days to bloom: Johnny's single-stem cut types 50 to 60 days (search listing, not cited); WVU
  Extension 85 to 95 days to maturity (page returned 403, not cited). Used 70 from sow for a
  typical garden sunflower; the note says 9 to 11 weeks.
- Modelled as single-stem: harvest once, 1 head per plant, windowDays 14, succession 14 days.
- Container 20 L for dwarf types: estimate.

### Zinnia
- Sources: Clemson HGIC, How to Grow Zinnias: The Best Varieties & Care Tips; Wisconsin Extension,
  Zinnias; Johnny's, Growing Zinnias from Seed.
- Germination: Johnny's 3 to 5 days at 80 to 85 F, slower at 70 to 75 F; Clemson soil and air about
  70 F; Wisconsin germinate at 65 to 70 F. soilMinC 18, note says sow at about {c:21}.
- Indoor: Johnny's 4 weeks; Wisconsin 4 to 6 weeks. Chose [4, 6].
- Spacing: Johnny's 23 to 30 cm; Clemson 20 to 60 cm by cultivar. Chose 25 cm, 2 per square.
- Days to bloom: Clemson 8 to 12 weeks. Used 70.
- Yield 15 cut stems per plant: estimate.

### Borage
- Sources: RHS, How to grow borage; Johnny's, Growing Borage From Seed.
- RHS: sow outdoors in spring, about 50 cm apart, 50 to 70 cm tall, flowers in summer, spring
  sowings decline by late summer, pot at least 30 cm wide, self-seeds. Johnny's: sow when soil has
  warmed, 0.6 to 1.3 cm deep, thin to 30 cm, rows 60 cm, taproot, self-sows.
- Spacing disagreement 30 cm vs 50 cm: chose 45 cm, the note gives the range.
- Frost class half-hardy and direct [-1, 3]: RHS sows outdoors in mid spring, treated as a hardy
  annual; no opened source gives a temperature, so this is a judgement.
- Days to bloom: a seed retailer lists 60 to 70 days (not cited). Used 60. Yield 50 flowers:
  estimate.

### Sweet alyssum
- Sources: Wisconsin Extension, Sweet Alyssum, Lobularia maritima; Johnny's, Growing Sweet Alyssum
  From Seed.
- Wisconsin: barely cover seed (light helps), hardened transplants can go out a week or two before
  last frost, flowers 6 to 8 weeks from sowing, slows in heat, shear to rebloom, strong nectar
  source for bees, flower flies and tiny wasps. Johnny's: 8 to 10 days at 65 to 70 F, indoor 4 to
  5 weeks, direct as soon as soil can be worked, 15 to 20 cm, cut back by half when nights cool.
- Chose half-hardy, indoor [4, 5], transplant [-2, 1], direct [-4, 0], soilMinC 10 (judgement: it
  is sown into cold spring soil), 15 cm spacing, 4 per square. Days 49 (7 weeks).
- Wisconsin also notes commercial lettuce and broccoli growers plant it for aphid control; I kept
  the note to the insects it feeds and made no crop-protection claim.
- Yield 20 flower clusters: a placeholder; the plant is not grown for cutting.

### Cosmos (Cosmos bipinnatus)
- Sources: USU Extension, Cosmos in the Garden; UF/IFAS Gardening Solutions, Cosmos.
- USU: sow after last frost when soil reaches 65 F (soilMinC 18), germination best 70 to 75 F in 7
  to 14 days, 0.3 cm deep, 30 to 60 cm apart, do not fertilise, deadhead or cut back to 30 to 45
  cm, self-seeds, blooms best in late summer. UF/IFAS: blooms 2 to 3 months after planting, bees
  and butterflies.
- Days 75 from sow. Spacing 30 cm, 1 per square. Container 10 L and yield 30 blooms: estimates.

## Schema gaps

- **Perennial maturity.** `maturity.days` is one number "from sow or transplant". For perennials
  the real answer is "season N" (already in `perennial.firstHarvestYear`), so I filled maturity
  with an approximate day count from planting to first harvest (asparagus 730, blueberry 800,
  rhubarb 365, strawberry and raspberry 400). If the schedule maths uses `maturity.days` for
  perennials, it should prefer the perennial block.
- **Types within one crop.** June-bearing vs day-neutral strawberries and summer vs autumn
  raspberries have different first-harvest years, harvest windows and pruning. One record can only
  hold one; I modelled June-bearing and summer-fruiting and covered the others in the notes. A
  `variants` list or separate records would fix this.
- **Winter hardiness vs frost class.** `frost` describes tolerance of spring and fall frost, but for
  perennials the important question is winter survival (rosemary takes light frost easily yet dies
  in hard winters; blueberry flower buds die below about -29 C). A separate `winterMinC` field
  would let the app warn about overwintering.
- **Soil pH.** Blueberries need pH 4.5 to 5.5 and asparagus 6.5 to 7.0; there is no pH field, so it
  lives in the notes.
- **Chill requirement for perennial fruit.** `chillWeeks` only exists on `overwinter`. Blueberry and
  rhubarb need winter chilling every year; a perennial-level chill field would help mild-climate
  gardeners.
- **Flower yield and cut vs garden use.** Bloom counts are rough and there is no way to say
  "grown for display or insects, not harvested" (sweet alyssum), or "harvested for seed" (dill,
  cilantro, sunflower seed). Cilantro and dill also have two maturities (leaf and seed).
- **Spreading habit.** Mint (and to a lesser degree self-sowing borage, cosmos and calendula) need
  a "spreads" or "contain it" flag; it is only in the notes.
- **Bloom window timing.** For flowers `harvest.windowDays` holds the bloom window, but some pause
  in midsummer heat (calendula, sweet alyssum) and resume; the schema cannot express a gap.
