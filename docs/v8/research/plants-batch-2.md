# Plant research log: batch 2 (leafy greens, brassicas, roots, alliums)

Twenty-one files in `src/domain/plants/library/`: lettuce, spinach, swiss-chard, kale, arugula,
bok-choy, collards, cabbage, broccoli, cauliflower, brussels-sprouts, kohlrabi, carrot, beet, radish,
turnip, parsnip, onion, garlic, leek, scallion. All pass `npx vitest run tests/unit/plant-library.test.ts`.

Every cited URL was opened in this session and returned HTTP 200 (checked with curl, or with WebFetch
where the site refuses curl: UMN rate-limited curl with 429 and Clemson returned 403, but both served the
pages to WebFetch). Old 7.x values were not used except as a sanity check; none of its prose was copied.

## Shared sources and rules applied across the batch

- **Temperature range (`temp`).** UC Cooperative Extension Placer and Nevada Counties, *Vegetable
  Characteristics* (May 2011), reproduces the Knott's Handbook table of optimum, minimum and maximum
  mean temperatures:
  - garlic, leek, onion, chive: min 45 F, max 85 F (7 to 29 C)
  - arugula, beet, broccoli, Brussels sprouts, cabbage, chard, collards, kale, kohlrabi, pak choi,
    radish, spinach, turnip: min 40 F, max 75 F (4 to 24 C)
  - carrot, cauliflower, lettuce: min 45 F, max 75 F (7 to 24 C)

  These are monthly mean air temperatures, which is what the schema means by daily mean, so I used them
  as the base. For crops that bolt or turn bitter quickly, I lowered `maxC` below the Knott ceiling,
  because the published bolting trigger is "several days above 75 F" (UMN for lettuce and spinach, USU
  for lettuce, spinach and kale). That is a daytime high. A 24 C high usually goes with a daily mean of
  roughly 18 to 21 C. The values I chose: spinach 20 (RHS gives an ideal of 15 to 20 C), arugula 21,
  bok choy 21, lettuce 22, radish 22, cauliflower 22 (UMN says curds form best at 50 to 70 F). Every
  other crop keeps the Knott maximum. Parsnip is missing from the UC copy of the table. I gave it 4 to
  24, the hardy-root group value, which agrees with USU ("best at or below 75 F").
- **Soil minimum (`soilMinC`).** UC Sacramento Garden Notes GN 154, CSU Vegetable Planting Guide and the
  USU sheets agree on 40 F (4 C) for the brassicas, beet, chard, carrot, radish and turnip. Where the
  tables give 32 to 35 F (lettuce, onion, green onion), I used 2 C, the CSU figure, rather than 0 C. At
  0 C, GN 154 shows 49 to 136 days to emergence, so that minimum has no practical use.
- **Frost class.** CSU groups crops as hardy (plant 2 to 4 weeks before last frost) or semi-hardy (0 to 2
  weeks before). The UMN midsummer table gives fall tolerance ("down to 20 F", "survives light frost").
  USU gives damage thresholds (cabbage and kale 25 F, broccoli 28 F, carrot, chard and lettuce 32 F). I
  mapped these to the schema classes: hardy means -5 C or colder, half-hardy means about -2 C.
- **Spring timing.** Taken from USU ("2 to 3 weeks before the last frost", and so on) and the CSU
  hardiness groups. RHS gives calendar months only, so I used it for spacing, depth, containers, harvest
  and bolting, never for frost offsets.
- **Containers.** RHS gives the minimum pot width. The brief equates a 30 cm pot with about 11 L. I
  scaled that for wider pots: 40 cm is about 25 L, 45 cm is about 35 L.
- **Density.** Square-foot practice, checked against the test's spacing band.

## Per plant

### Lettuce
Sources: UMN *Growing lettuce, endive and radicchio*; RHS *How to grow lettuces*; USU *How to Grow
Lettuce*; CSU planting guide; UC temperature table.
- Half-hardy: USU says young plants are not damaged at 32 F, UMN says it survives light frost, and CSU
  lists it as hardy. I chose half-hardy as the conservative class.
- temp 7 to 22 (see shared rules). UMN gives a night low of 50 F and a day high of up to 68 F as ideal,
  with bolting after several days above 75 F. USU says to avoid temperatures above 80 F.
- Germination: soilMinC 2. USU says germination falls above 80 F (27 C), so the notes mention 27.
- Indoor transplant age 4 to 6 weeks: UMN gives 4 and USU 5 to 6. The brief flags short indoor periods,
  so I did not go lower than 4.
- Transplant -2 to 0 (USU: near the last frost). Direct sowing -4 to -1 (USU 2 to 3 weeks before; CSU
  hardy group 2 to 4 weeks before).
- Spacing: in-row 20 cm. Sources disagree: RHS gives 15 cm for loose-leaf and 30 cm for hearting types,
  UMN 25 to 30 cm for full size, USU 20 to 30 cm. I picked 20 because square-foot density is 4 per
  square. Rows 30 cm (RHS).
- Maturity 50 days from sowing. Sources disagree here too: RHS gives 4 to 6 weeks for loose-leaf and 10
  to 14 weeks for hearting types, UMN 40 to 60 days for leaf lettuce, and CSU 60 days for leaf types. I
  modelled leaf types, the most common home crop.
- Succession 14 days (RHS "every fortnight"). Fall window 4 weeks: UMN says sow 3 months before the
  first fall frost, and USU says 50 to 75 days before a maturity date 1 to 2 weeks before the frost.
- Yield 150 g per plant, from USU's 4 to 6 lb per 10 ft row at 20 cm spacing.

### Spinach
Sources: UMN *Growing spinach and Swiss chard*; RHS *How to grow spinach*; USU *How to Grow Spinach*;
CSU; UC table.
- Hardy: CSU lists it as hardy, UMN says it may overwinter, and USU describes overwintering plants with
  4 to 5 leaves under mulch.
- temp 4 to 20. RHS gives an ideal of 15 to 20 C. Bolting comes from long days plus heat (UMN, USU).
- Direct sowing -6 to -3. USU says 2 to 3 weeks before the last frost, CSU 2 to 4 weeks, and the USU
  timing article 6.5 to 8.5 weeks for the hardy group. The brief also notes spinach goes in weeks
  early. I left out a transplant method: USU covers transplants, but spinach is normally direct sown.
- Spacing 8 cm in-row (RHS 7.5 cm, USU 3 in, UMN 2 to 4 in). Rows 30 cm (USU 12 in).
- Maturity 45 days (UMN 35 to 45, CSU 40, RHS about 2 months for mature leaves).
- Succession 10 days (UMN every 1 to 2 weeks). Fall window 3 weeks (UMN: about 2 months before the
  first frost).
- Yield 400 g per square, from USU's 4 to 6 lb per 10 ft row.

### Swiss chard
Sources: UMN *Growing spinach and Swiss chard*; RHS *How to grow chard*; USU *How to Grow Swiss Chard*;
CSU; UC table.
- Half-hardy: CSU lists it as semi-hardy, USU says 32 F does not seriously damage young plants, and UMN
  says it survives light frost. RHS calls it hardy over winter, but it stops growing then.
- temp 4 to 24 (Knott). UMN says it slows in summer and resumes in fall. It does not bolt from heat or
  day length, though cold can make it bolt.
- Indoor 4 to 6 weeks (UMN 4, USU 5 to 6). Transplant 0 to 2 and direct sowing -2 to 1. USU contradicts
  itself: one section says seeds go 3 to 4 weeks before transplants, its FAQ says 2 to 3 weeks before
  the last frost. CSU says 0 to 2 weeks before. I took the middle of that range.
- Spacing: in-row 20 cm. USU gives 15 cm, UMN 10 to 15 cm, and RHS 30 cm for full size, so 20 is a
  compromise that keeps density at 4 per square. Rows 45 cm (RHS).
- Maturity 55 days (CSU 60; UMN fall table 40 to 60). Container 25 L, 2 plants (RHS: at least 40 cm).
- Yield 250 g per plant, from USU's 8 to 12 lb per 10 ft row at 15 cm. This is conservative for a full
  season of picking.

### Kale
Sources: UMN *Growing collards and kale*; RHS *How to grow kale*; USU *How to Grow Kale*; UC table.
- Hardy: USU says young plants take 25 F and mature plants are very hardy. UMN says it handles down to
  20 F.
- Transplant -4 to -2 (USU 4 to 5 weeks before the last frost; seeds can go in at the same time).
- Indoor 4 to 6 weeks. UMN gives 4, USU 5 to 6, and RHS 6 to 8 weeks for seedbed plants. I used the
  indoor figures.
- Spacing 40 cm in-row and 60 cm rows. USU gives 30 to 45 cm, RHS 30 to 60 cm, and UMN 20 cm for
  transplants. Square-foot density is 1.
- Maturity 55 days from transplant (USU variety figures 50 to 55 days).
- Yield 200 g per plant (USU 3 to 5 lb per 10 ft at 30 cm). This is conservative.

### Arugula
Sources: Cornell *Arugula growing guide*; RHS *How to grow rocket*; SARE *Northeast Crop Production and
Harvest Manual: Arugula*; UC table.
- Half-hardy. No source gives a frost temperature. Knott puts it in the hardy group, and RHS says wild
  rocket crops into winter under cover, but I did not want to overstate salad rocket, so I chose the
  conservative class.
- soilMinC 4: SARE says it does not germinate below 40 F, and Cornell says it germinates fast at 40 to
  55 F. SARE gives an optimum of 65 to 75 F (daytime). I set maxC to 21 because heat and long days
  cause bolting (SARE, RHS, Cornell).
- Direct sowing -4 to 0 (Cornell: as soon as the soil can be worked).
- Succession 14 days. SARE says 10 to 12 days, Cornell 2 to 3 weeks, RHS "every few weeks".
- Spacing 15 cm (RHS, Cornell), giving density 4. Rows 20 cm (SARE 7 to 9 in).
- Maturity 35 days (Cornell from 4 weeks, RHS 4 to 6 weeks). Harvest is cut-and-come-again over 30 days
  (RHS 1 to 2 months).
- Yield 150 g per square is my own conservative estimate; no source gave a yield.

### Bok choy
Sources: RHS *How to grow pak choi*; NC State Plant Toolbox *Bok Choy*; UC table.
- Half-hardy (NC State: tolerates light frost).
- Cold spells and heat both trigger bolting (RHS), and RHS says to sow outdoors only after frost risk
  has passed. So direct sowing and transplant are both 0 to 2, not earlier. Indoor 3 to 5 weeks (RHS
  transplants at 10 cm tall).
- Spacing: in-row 20 cm (RHS semi-mature 20 cm, mature 25 to 30 cm; NC State 15 cm). Rows 30 cm.
- Maturity 50 days. RHS gives 45 to 75 days, or 8 to 10 weeks, for full size and 30 days for baby
  leaves. NC State gives 60 days.
- Container 4 L, 1 plant (NC State: 1 gallon minimum).
- soilMinC 4 comes from the cabbage-family figure in the UC table; I found no figure specific to bok
  choy. The yield is a count of 1 head per plant.

### Collard greens
Sources: UMN *Growing collards and kale*; Clemson HGIC *Collards*; NC State Plant Toolbox *Brassica
oleracea Collards Group*; UMN midsummer fall table; UC table.
- Hardy (UMN: down to 20 F; NC State and Clemson: frosts and light to medium freezes).
- Search results quoted Texas A&M as saying collards take more heat than most crops, but I did not open
  that page, so it is not cited and I kept the Knott maxC of 24. The care note says collards are more
  heat tolerant than most cabbage-family crops; NC State's description of the 'Georgia Southern' type
  supports this.
- Maturity 70 days from sowing (Clemson 60 to 80 after direct seeding; UMN 40 to 65).
- Spacing 40 cm in-row and 75 cm rows. Clemson gives 15 to 45 cm in-row and 45 to 90 cm rows.
- Yield 300 g per plant is my own estimate, scaled up from kale; no source gave a yield.

### Cabbage
Sources: UMN *Growing cabbage*; RHS *How to grow cabbages*; USU *How to Grow Cabbage*; CSU; UC table.
- Hardy (USU 25 F; UMN fall table 20 F).
- Indoor 5 to 7 weeks (USU 6 to 7, UMN 4 to 6, RHS about 5, CSU 5 to 7). Transplant -3 to -1 (USU 2
  to 3 weeks before). Direct sowing is also allowed (USU, UMN), but UMN says it takes up to 3 weeks
  longer.
- Seedlings grow best at 60 to 70 F (UMN), so the note says 16 to 21 C. USU says heat above 80 F causes
  tipburn, so the note says 27 C.
- Maturity 75 days from transplant. CSU gives 85, USU's variety figures run 55 to 100, and UMN gives 60
  to 100.
- Spacing 40 cm in-row and 60 cm rows (UMN 38 to 45 cm; USU 30 to 45 cm with 60 to 90 cm rows; RHS 30
  to 45 cm).
- Container 11 L, 1 plant (RHS: one compact plant in a 30 cm pot). Yield 700 g per plant (USU 10 to
  15 lb per 10 ft).

### Broccoli
Sources: UMN *Growing broccoli*; RHS *How to grow calabrese*; USU *Broccoli in the Garden*; CSU; UC
table.
- Half-hardy: USU says plants take 28 F (-2 C) and UMN says they survive light frost. CSU lists broccoli
  as hardy, but USU's threshold fits the schema's half-hardy class.
- Heat: UMN says days of 86 F with nights above 77 F prevent heads forming, so the note says 30 C by
  day and 25 C at night.
- Indoor 5 to 7 weeks (USU 6 to 7, CSU 5 to 7, UMN 4). Transplant -3 to 0.
- Maturity 60 days from transplant (CSU 65; USU varieties 50 to 65; UMN spring 50 to 60).
- RHS says side shoots extend the harvest by up to 8 weeks, so I chose continuous harvest over 42 days.
- Container 19 L, 1 plant is my own judgement; no source gave a container size for broccoli.

### Cauliflower
Sources: UMN *Growing cauliflower*; RHS *How to grow cauliflower*; USU *How to Grow Cauliflower*; CSU;
UC table.
- Half-hardy (CSU semi-hardy; USU says 32 F lowers growth).
- temp 7 to 22 (curds form best at 50 to 70 F per UMN; Knott gives 7 to 24).
- RHS germination temperature is 12 to 22 C. Indoor 5 to 7 weeks (RHS 6, USU 6 to 7, CSU 5 to 7).
  Transplant -2 to 0 (USU 1 to 2 weeks before the last frost). No direct method in spring, because RHS
  and UMN describe transplants and the crop is sensitive to checks in growth.
- Maturity 60 days from transplant (USU 50 to 80; UMN 50 to 60).
- Container: RHS recommends only mini types, up to 4 in a 40 cm pot. I set 25 L for 1 plant as a
  general figure; see Unsure.

### Brussels sprouts
Sources: UMN *Growing Brussels sprouts*; RHS *How to grow Brussels sprouts*; UMN midsummer fall table;
UC table.
- Hardy (UMN: stays out while temperatures stay above 20 F; RHS: very hardy).
- Maturity 90 days from transplant (UMN fall table 90 to 100). Indoor 4 to 6 weeks (UMN about 3 weeks;
  RHS 10 to 15 cm tall).
- Transplant -2 to 2 for long cool seasons. UMN treats it as a fall crop sown in June, so I also set a
  fall window of 3 weeks.
- Spacing 50 cm in-row and 60 cm rows (RHS 60 by 60 cm; UMN 45 cm). Canopy is tall: RHS says about
  90 cm, which sits on the mid/tall boundary, and the plants need staking.
- Yield 450 g per plant is my own estimate; no source gave a yield.

### Kohlrabi
Sources: UMN *Growing kohlrabi*; RHS *How to grow kohl rabi*; USU *How to Grow Kohlrabi*; CSU; UC table.
- Half-hardy. USU calls it the least hardy of the cabbage-like crops, and UMN says it survives light
  frost. CSU lists it as hardy.
- Bolting: UMN says more than a week of nights below 50 F leads to bolting, and RHS says to wait until
  temperatures are above 10 C. USU says plants flower when the average during growth is below 45 F.
- Direct sowing -3 to -1 and transplant -2 to 0 (USU 1 to 2 weeks before; UMN mid April to early May).
  Indoor 4 to 6 weeks (UMN 4 to 6, USU 5 to 6, RHS 3 to 4).
- Maturity 45 days from sowing (CSU 50; USU 40 to 60; UMN spring varieties 35 to 45). Harvest at 5 to
  7.5 cm across (UMN, USU).

### Carrot
Sources: UMN *Growing carrots and parsnips*; RHS *How to grow carrots*; USU *How to Grow Carrots*; CSU;
UC table; UC GN 154.
- Half-hardy (CSU semi-hardy; USU says 32 F does no serious damage).
- Direct sowing -3 to 2 (USU 2 to 3 weeks before; CSU 0 to 2 weeks before).
- Succession 21 days. UMN says 3 weeks, RHS 3 to 4 weeks, USU every 4 weeks.
- Maturity 75 days. CSU gives 70, USU 70 to 100, and RHS 12 to 16 weeks (about 90 days). I picked a
  value at the low end.
- Spacing 6 cm in-row (RHS 5 to 7.5 cm; USU 5 to 7.5 cm), giving density 16. USU says soil above 85 F
  gives pale roots, so the note says 29 C.

### Beet
Sources: RHS *How to grow beetroot*; USU *How to Grow Beets*; CSU; UMN midsummer fall table; UC table;
UC GN 154.
- Half-hardy (CSU semi-hardy; UMN survives the high 20s F).
- soilMinC 4: the US sources all give 40 F. RHS says to wait for 7 C. GN 154 shows 42 days to emerge
  at 41 F against 17 days at 50 F. I kept the table minimum for consistency with the other crops; see
  Unsure.
- Direct sowing -3 to 2. Succession 21 days (USU 2 to 3 weeks).
- Maturity 55 days (RHS 50 to 60; CSU 60; USU 60 to 80; UMN 50 to 60).
- Spacing 10 cm (RHS), giving density 9.

### Radish
Sources: UMN *Growing radishes*; RHS *How to grow radishes*; USU *How to Grow Radishes*; CSU; UC table.
- Hardy (CSU hardy; UMN fall table: dig until the soil freezes).
- Direct sowing -5 to 0 (UMN early April to early May against a mid May last frost; CSU 2 to 4 weeks
  before).
- Succession 10 days (USU).
- Maturity 28 days (UMN 3 to 5 weeks; USU 25 to 45 days; CSU 30).
- Spacing 5 cm in-row and 15 cm rows (RHS 2.5 to 5 cm, rows 15 cm).
- Yield 200 g per square, from USU's 10 bunches per 10 ft row.

### Turnip
Sources: RHS *How to grow turnips*; USU *How to Grow Rutabagas and Turnips*; CSU; UMN midsummer fall
table; UC table.
- Hardy (CSU hardy; Knott hardy group). RHS says the roots are not fully hardy, so the fall note says to
  lift before hard frosts.
- Direct sowing -4 to -1 (USU 2 to 3 weeks before; CSU 2 to 4 weeks before). Succession 28 days (USU
  every 4 weeks).
- Maturity 50 days. CSU gives 50, UMN 50 to 60, USU 60 to 80, and RHS 6 weeks for early types and 10
  weeks for maincrop. I chose 50 to suit early white types.

### Parsnip
Sources: UMN *Growing carrots and parsnips*; RHS *How to grow parsnips*; USU *How to Grow Parsnips*;
CSU; UC GN 154.
- Hardy: the roots overwinter in the ground (UMN, RHS). CSU lists parsnip as semi-hardy for planting.
- Fresh seed: USU says germination and vigour drop after one year, and RHS says to use fresh seed each
  spring. Germination takes 14 to 30 days (RHS), 14 to 21 (USU), or 15 to 25 (CSU).
- soilMinC: this was the biggest disagreement in the batch. CSU gives 35 F, USU 40 F, GN 154 32 F, and
  RHS says to wait for about 12 C. I set 4 to match the USU and CSU planting advice (2 to 3 weeks
  before the last frost). The note says seedlings come up fastest near 12 C.
- Direct sowing -2 to 2. Maturity 110 days. USU gives 100 to 120. CSU's 70 looks too short, so I set it
  aside.
- Container null, because no source covers containers for this deep taproot. Harvest window 90 days,
  since the roots hold in the ground over winter.

### Onion
Sources: UMN *Growing onions*; RHS *How to grow onions*; USU *How to Grow Onions*; CSU; UC table; UC GN
154.
- Hardy (CSU hardy; UMN says transplants tolerate light frost).
- Day length: UMN says long-day types need 14 or more hours to bulb, and short-day types make small bulbs
  at high latitudes. The note gives this guidance without place names, as the brief asks.
- Indoor 8 to 12 weeks (UMN 10 to 12; USU 8). Transplant, direct sowing and sets are all -4 to -2 (CSU
  hardy group; UMN says plant sets as soon as the soil can be worked).
- RHS and USU say low spring temperatures and large sets cause bolting. USU says sets over 5/8 in bolt
  more often.
- Maturity 100 days from transplant. USU gives 100 to 120 and CSU 110 for seed and sets. Bulbing
  depends on day length, not a day count; see Schema gaps.
- Container 35 L, 12 plants (RHS: at least 45 cm wide and deep).

### Garlic
Sources: UMN *Growing garlic*; RHS *How to grow garlic*; USU *How to Grow Garlic*; UMN midsummer fall
table; UC table.
- Overwinter, hardy.
- plantWeeks -2 to 3 relative to the first fall frost. UMN says 1 to 2 weeks after the first killing
  frost. USU gives mid September to early November. RHS gives mid autumn to early winter. Search results
  repeated a common figure of 4 to 8 weeks before the ground freezes, but I did not cite those pages.
- harvestWeeks 7 to 11 after the next spring's last frost. UMN gives late June to late July, against a
  mid May last frost (about 6 to 10 weeks). RHS gives late spring to early summer for autumn-planted
  garlic.
- chillWeeks 6, the middle of RHS's 1 to 2 months at 0 to 10 C.
- Spring fallback: `methods.plant` with "cloves" at -6 to -3. USU says to plant as soon as the soil can
  be worked but bulbs will be small. RHS says some varieties suit late winter or early spring planting.
- Spacing: in-row 10 cm. USU gives 7.5 to 10 cm, UMN and RHS 15 cm. I chose 10 to match a square-foot
  density of 9.
- Container 8 L, 4 cloves (RHS: pots at least 25 cm deep).
- Maturity 120 days from planting applies to the spring fallback only; see Schema gaps.

### Leek
Sources: UMN *Growing leeks*; RHS *How to grow leeks*; USU *How to Grow Leeks*; CSU; UC table.
- Hardy (UMN: some varieties to 20 F; RHS: established plants need no protection).
- Indoor 8 to 12 weeks (RHS about 8; USU 6 to 8; UMN up to 10 to 15). Transplant -2 to 1 (UMN: once
  days reach at least 45 F; USU: early April).
- Maturity 100 days from transplant. UMN gives 120 to 150 (and as little as 90 for newer cultivars),
  USU 100 to 120 with harvest from 60, and RHS about 6 months from sowing.
- Spacing: in-row 15 cm (RHS 15 to 20; UMN 5 to 15; USU 10 to 15). Square-foot density 9.
- Harvest window 90 days, since leeks stand in the ground into winter.

### Scallion
Sources: RHS *How to grow salad onions*; Oregon State *Onions (Bunching)*; CSU; UMN midsummer fall
table; UC table.
- Latin name *Allium fistulosum* (bunching onion). Green onions from *A. cepa* are grown the same way.
- Hardy (CSU hardy; UMN survives the high 20s F; RHS hardy varieties overwinter).
- soilMinC: this is a disagreement. CSU gives 35 F for green onions, but Oregon State says sow once the
  soil is at least 50 F. I chose 2 C to match onion and the CSU hardy-group timing.
- Direct sowing -4 to 2. Succession 14 days (RHS "every couple of weeks").
- Maturity 60 days (CSU 60; RHS about 2 months; UMN 60 to 70). Oregon State says cut leaves regrow
  several times, so harvest is cut-and-come-again.
- Spacing 5 cm (RHS thin to 2.5 cm; CSU 5 to 7.5 cm). Rows 20 cm (RHS).

## Optional fields added to the schema mid-batch

The schema gained several optional fields while this batch was in progress: `harvest.untilFrost`,
`support`, `winterMinC`, `soilPh`, `spreads` and `purpose`. I filled only the ones a source supports:

- `harvest.untilFrost: true` for swiss-chard, kale, collards and brussels-sprouts. All four are picked
  through the fall until frost or a hard freeze (UMN, RHS, USU).
- `soilPh`:
  - 6 to 7 for broccoli, cauliflower, Brussels sprouts, carrot, parsnip and garlic, from the UMN pages
    for each crop.
  - 6.5 to 8 for spinach (UMN).
  - 6 to 7.5 for bok choy and 6 to 8 for collards (NC State Toolbox).
- `winterMinC` is left empty. No source gave a survival temperature for garlic, the batch's only
  overwintered crop. `support`, `spreads` and `purpose` do not apply to this batch.

## Unsure

- The lowered `maxC` values for bolting crops are a judgement: I converted daytime bolting triggers into
  daily means. They are listed under Shared sources above so a later pass can tune them against real
  climate runs.
- Cauliflower container: RHS supports mini types only, so 25 L for 1 standard plant is a stretch.
  Broccoli, collards and Brussels sprouts containers (19 L, 1 plant) are my own estimates.
- Yields for arugula, collards and Brussels sprouts are my estimates. The others come from USU
  row-yield figures and are deliberately low.
- Beet and parsnip soilMinC follow the US table minimum (4 C). RHS would say 7 C for beet and 12 C for
  parsnip.

## Schema gaps

- **Day-length bulbing (onion).** Onion bulbing starts when day length passes a threshold (long-day,
  intermediate or short-day types), not after a number of days. The schema cannot record the day-length
  type, so the app cannot warn that a long-day onion will not bulb near the tropics. The note says it in
  prose only.
- **Maturity for overwinter crops (garlic).** `maturity.days` is a single number. For garlic, the real
  timeline is in `overwinter`; the 120 days applies only to the spring-planted fallback. `maturity.from`
  also has no "plant" option for cloves, sets or crowns, so I used "transplant".
- **Overwintering onions.** RHS describes autumn-planted overwintering sets and late-summer sowings. They
  depend on the variety and suit mild winters, so I did not add an `overwinter` block to the general
  onion. A separate record for an overwintering type would capture it.
- **Cold-triggered bolting.** Bok choy, kohlrabi, chard and onion bolt after a cold spell. The schema has
  `temp.minC` for growth but nothing for "a week of nights below 10 C causes bolting". The
  transplant-week offsets are set later to compensate.
- **Baby-leaf versus full-size.** Lettuce, spinach, chard, kale, bok choy and beet are each grown both
  ways, at different spacing and maturity. One record per crop has to pick one; I chose full-size
  except lettuce (leaf types).
