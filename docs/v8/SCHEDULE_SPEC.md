# Schedule maths: specification

How GardenSync 8 turns a plant record and a climate profile into dates. This is the reference for
`src/domain/schedule/` and for anyone checking why the app gave a date. Every date the app shows
must be explainable from this page.

Inputs: a resolved plant (`src/domain/plants/schema.ts`), a climate profile
(`src/domain/climate/types.ts`), and a season number. All arithmetic is on integer day numbers
(`src/domain/dates.ts`). Temperatures come from `tempOn(profile, md, 'mean' | 'max' | 'min')`
(`src/domain/climate/tempCurve.ts`), which is null for a profile without monthly data.

## 1. Seasons

A season is one growing year, named by a number S.

- **Midsummer** `W(S)`: the middle day of the profile's warmest month, in calendar year S for the
  northern hemisphere and in calendar year S + 1 for the southern (whose summer straddles the new
  year). Southern seasons are labelled "S-S+1" in the UI, e.g. "2027-28".
- **Frost dates of season S**: the last spring frost dates are the latest occurrences of their
  month-day on or before `W(S)` (within 365 days); the first fall frost dates are the first
  occurrences after `W(S)`. So Canton 2027 is LF50 2027-04-16 and FF50 2027-11-04; Phoenix 2027 is
  LF50 2027-01-09 and FF50 2027-12-25; a southern place with a spring frost in October and a fall
  frost in April gets LF50 2027-10-xx and FF50 2028-04-xx for season 2027.
- Names used below, each a day number or null: `LF50`, `LF90` (90%-safe), `FF50`, `FF10` (10%-risk),
  `H2` (first -2 C, median), `H5` (first -5 C, median).
- `seasonOf(day)`: the season whose window [W(S) - 182, W(S) + 182] contains the day.
- Every query evaluates seasons S - 1, S and S + 1, so nothing breaks at the new year.

## 2. Modes

- **Frost mode** when LF50 and FF50 are both non-null. Published week offsets apply.
- **Temperature mode** otherwise (frost class marginal or none). Needs monthly data; windows come
  from the crop's temperature range and are labelled approximate. Without monthly data and without
  frost dates there is no schedule; the UI asks for a town.
- **Frost-only** (manual profile without monthly data): frost mode with the heat and soil guards off,
  flagged so the UI can say "add your town for heat-aware dates".

## 3. Method timing

For a bed-in day `d` and method m, the first harvest (maturity) `M(d)`:

| maturity.from | method | M(d) |
|---|---|---|
| transplant | transplant | d + days |
| transplant | direct | d + days + 7 x ageMin (seed needs the nursery time too) |
| sow | direct | d + days |
| sow | transplant | d + days - 7 x ageMin + 7 (time already spent indoors, plus a week of transplant shock) |
| any | plant (sets, cloves, crowns, tubers) | d + days |

`ageMin`, `ageMax` are `methods.indoor.ageWeeks`. Without an indoor block, ageMin = 4.

## 4. Caps (when harvest must end)

- tender: `FF50` (the UI also flags `FF10` as "frost possible from")
- half-hardy: `H2 ?? FF50 + 14`
- hardy: `H5 ?? (H2 ?? FF50) + 28`
- Temperature mode: the season end `W(S) + 182`, or the start of the frost-risk span for tender crops
  when `FF10` exists.
- Heat cap for fruiting crops (those with `fruitSetMaxC`), in any mode with monthly data: the first
  day after `M` whose max temperature exceeds `fruitSetMaxC + 4` ends a continuous harvest.

Harvest = `[M, min(M + windowDays, cap - 1)]`, or `[M, cap - 1]` when `harvest.untilFrost`: a cap is the
first day the crop can no longer be picked, so picking ends the day before it. A window whose
harvest would be shorter than 7 days is **not viable here** (with a reason).

## 5. Spring window (frost mode)

For each outdoor method the plant has (transplant, direct, plant), with weeks `[a, b]`:

1. `out = [LF50 + 7a, LF50 + 7b]`.
2. Tender crops: `out.start = max(out.start, LF90)`. Reason text: "held back to <LF90>, when frost has
   passed in 9 years out of 10".
3. Soil guard (direct sowing with `soilMinC >= 10`, monthly data present): `out.start` is no earlier
   than the first day after `W(S) - 182` whose mean air temperature reaches `soilMinC`.
4. If `out.start > out.end`, `out.end = out.start + 14`.
5. Heat guards, monthly data present: drop bed-in days whose flowering point
   `F = d + 0.6 x (M(d) - d)` has a max temperature above `fruitSetMaxC` (fruiting crops), and,
   for crops without `fruitSetMaxC`, days where the mean temperature over `[d, M(d)]` exceeds
   `temp.maxC` on more than a quarter of the days (bolting). The window becomes the remaining run
   that starts earliest; if none remain the spring window is not viable.
6. Transplants: indoor start `[out.start - 7 x ageMax, out.end - 7 x ageMin]`, harden off
   `[out.start - 10, out.start - 1]`.

## 6. Fall window (frost mode, plants with `fall`)

1. Reference: tender `FF10`; half-hardy `H2 ?? FF50 + 7`; hardy `H5 ?? (H2 ?? FF50) + 21`.
2. Remaining days needed for bed-in `d`: `need = (M(d) - d) + 14` (fall factor: shortening days slow
   growth) `+ min(windowDays, 21)` for tender crops (at least three weeks of picking before frost).
3. `latest = reference - need`, `earliest = latest - 7 x fall.windowWeeks`.
4. Heat guard as in 5.5 (summer heat may push `earliest` later). Not before the spring window ends.
5. Transplants: indoor start `[earliest - 7 x ageMax, latest - 7 x ageMin]`.
6. Harvest: `[M(d) + 14, cap]` per section 4.

## 7. Succession (plants with `succession`)

Candidate bed-in days from the spring window start, every `everyDays`, up to the latest fall bed-in
(or the cap minus the time to maturity for plants without `fall`). Keep a candidate when its harvest
is viable, it passes the heat guard, and (tender) it is on or after LF90. Consecutive kept candidates
form rounds; a gap in the middle (summer heat for lettuce) is reported as a gap, not hidden.

## 8. Overwinter (plants with `overwinter`)

The planting belongs to the season of its harvest, S.

- Frost mode: plant `[FF50(S-1) + 7 x plantWeeks[0], FF50(S-1) + 7 x plantWeeks[1]]`, harvest
  `[LF50(S) + 7 x harvestWeeks[0], LF50(S) + 7 x harvestWeeks[1]]`. Occupies the bed across the new
  year. If the profile's zone minimum is below `winterMinC` (when given), add a warning.
- Temperature mode: plant at the start of the coolest three-month run, harvest at plant + days; if
  `chillWeeks` is set, the reason says to chill the cloves or sets in a refrigerator for that long
  first. Labelled approximate.

## 9. Perennials (plants with `perennial`)

Plant once (method `plant`, weeks relative to LF50 of the planting season). Yearly harvest window
`[LF50(Y) + 7 x harvestWeeks[0], LF50(Y) + 7 x harvestWeeks[1]]` for seasons
`Y >= S + firstHarvestYear - 1`. In temperature mode, harvest when the mean temperature is inside
the crop's range. Occupancy is open-ended.

## 10. Temperature mode windows (annuals)

Over the 365 days of season S, a bed-in day `d` is viable when the mean temperature over
`[d, M(d)]` stays within `[temp.minC - 1, temp.maxC + 1]` on at least 85% of days, the heat guard
passes, and for tender crops `[d, M(d)]` avoids the frost-risk span `[FF10, LF90]` when those exist.
Runs of viable days become windows (there may be two, or none). With no window the result says
"too warm (or too cool) here all year" and names the limiting temperature.

## 11. Why strings

Every window carries a short, plain explanation built from the rule that set it, with real dates,
for example: "1 to 4 weeks after your last frost (Mar 22), held back to Apr 14, when frost has
passed in 9 years out of 10". No em dashes. Date formatting is the UI's job: the domain returns
structured reasons (`{ code, days, ref }`) plus a default English sentence.

## 12. Output

```ts
interface PlantSchedule {
  plantId: string;
  season: number;
  mode: 'frost' | 'temperature' | 'frost-only';
  approximate: boolean;
  windows: ScheduleWindow[];      // one per viable (window kind, method)
  notViable: { kind: WindowKind; reason: Reason }[];
}
interface ScheduleWindow {
  kind: 'spring' | 'fall' | 'overwinter' | 'perennial' | 'temperature';
  method: 'transplant' | 'direct' | 'plant';
  bedIn: DayRange;
  indoor?: DayRange;
  hardenOff?: DayRange;
  harvest: DayRange;               // first season's harvest for perennials; see yearly
  yearly?: { season: number; harvest: DayRange }[];
  rounds?: DayNum[];               // succession bed-in days, when the plant has succession
  reasons: Reason[];
  warnings: Reason[];
}
```

## 13. Tasks

`tasksFor(garden, from, to)` returns the jobs between two days for the garden's plantings, each
with a stable id `${plantingId}:${kind}:${season}[:round]` so ticking survives re-flowing: start
seeds indoors, harden off, transplant, direct sow, plant, succession sow (next round), start picking,
end of season (pull out), plant for next year (overwinter), plus "frost possible from" reminders at
FF10 for gardens with tender crops still in the ground. A planting's own dates come from its anchor:
`auto` takes its window from the schedule (plus `offsetDays`), `pinned` uses its dates, and
`actual` dates override both for anything already done.

## Changes during build

Each change below is the smallest one I could find that fixed dates which were clearly wrong. I
checked them against published guidance, and the comparisons are in
`docs/v8/research/schedule-validation.md`. The constants are named in `src/domain/schedule/windows.ts`.

**Seasons and modes (sections 1, 2, 12)**
- `seasonOf`: midsummers are 365 or 366 days apart, so one day can sit 183 days from both. That day
  goes to the later season.
- A fourth mode, `'none'`, covers a profile with no frost dates and no monthly data. It returns no
  windows and one `needs-town` reason.
- `notViable` entries carry the method as well as the kind.
- `ScheduleWindow.harvest` is the harvest of a planting made on the first bed-in day.

**Caps (section 4)**
- Leafy crops (no `fruitSetMaxC`) now have a heat cap like fruiting crops. A continuous harvest ends
  on the first day after `M` whose mean temperature passes `temp.maxC + 4`. Without it, Phoenix kale
  sown in December was "picked" until the next January, right through a 40 C summer.
- In a computed profile with no median -2 C night (Phoenix), a half-hardy crop takes the hardy rules
  for its cap and fall reference. There, a null H2 means winter does not cut the crop down. In a
  typed-in profile, a null H2 only means "unknown", so the spec's `FF50 + 14` and `FF50 + 7` stay.
  Without this, Phoenix lettuce had no November sowings.
- Temperature mode measures the cap from the planting itself. The cap is the first day after `M`
  when the mean leaves `[minC - 1, maxC + 1]`, or the next FF10 for tender crops. It used to be the
  season end, `W + 182`, which cut Brisbane's lettuce season in two at the season edge (no sowings
  Jun 11 to Jul 18, the best weeks of the year there).
- In temperature mode, `untilFrost` is ignored and the harvest ends at `M + windowDays`.
- In temperature mode, a tender crop needs `min(windowDays, 21)` days of harvest, the same as a tender
  fall crop. Without that, Melbourne tomatoes could go in until Feb 18 for one week of picking in a
  cooling April.

- Caps are exclusive everywhere (frost, hard frost, heat, bolting heat, out of range, frost risk):
  the harvest ends the day before the cap. Frost caps used to be the last day of picking, while
  heat caps were already the first day lost, so the `harvest-until` reason named a day that did not
  match the range. That reason now always names the range's last day, and its sentence says "just
  before the usual first frost" (or the heat, and so on). Every frost-capped harvest ends one day
  earlier than before, and where the 7-day minimum is what limits the latest bed-in day, that day
  moves one earlier too; three final succession rounds (Canton fall lettuce and bok choy, Edinburgh
  arugula) drop out for the same reason.
- Section 3, `sow` crops transplanted: `days - 7 x ageMin + 7` is at least 7, so a quick crop raised
  as old seedlings never "matures" before it goes in. No library plant reaches the floor.

**Spring windows (section 5)**
- 5.3, soil guard: it now applies to tender transplants and plantings (`plant`), not only to direct
  sowing with `soilMinC >= 10`. A transplant sits in the same cold soil. RHS and Gardening Australia
  both give 16 C for planting tomatoes out. Without the guard, Canton tomatoes went out on Apr 29
  (LF90), two to four weeks ahead of OSU's mid to late May. The gridded data's last frost runs 13
  days early at Canton (see `climate.md`), and the soil rule corrects for that as well.
- 5.3, waiting for warm soil versus summer heat: sometimes the soil-warm date would lose more than a
  week of harvest to the heat cap, compared with the frost-safe date. When that happens, the window
  opens at the frost-safe date and runs to at least `warm + 14`, with an `early-for-heat` reason.
  This applies to direct sowing too. It covers desert calendars that plant before the mean air
  temperature reaches the germination minimum, because sunny soil runs warmer than the air. Only
  heat counts: the rule fires only when the later harvest is cut short by a heat or bolting cap, not
  when the autumn frost takes the days (otherwise Canton cosmos would be sown a month before its soil
  is warm). It gives
  Phoenix tomatoes Feb 12 to Mar 10, against the UA calendar's Feb 15 to Mar 15. Canton and Edinburgh
  never trigger it.
- 5.3, soil that never warms enough: direct sowing is not viable, in spring or fall. A tender
  transplant gets a warning and waits for the warmest weeks, the first day within 2 C of the year's
  peak mean. That puts Edinburgh tender crops out on Jun 15. RBGE says local growers wait until June.
- 5.4: a window pushed (nearly) past its published end is now always 14 days long, so a window
  shorter than 7 days is stretched too. Before, the rule only fired when `start > end`, and the soil
  guard left calendula and alyssum with one-day windows.
- New warning `cool-summer`: for tender crops whose mean temperature over `[d, M(d)]` sits below
  `temp.minC - 1` on more than half the days. It suggests cover or early varieties (Edinburgh).

**Fall windows (section 6)**
- 6.1: fruiting crops that are not tender (`fruitSetMaxC` set, which means peas) use FF50 as the fall
  reference, because the first frost spoils pods and flowers even on a hardy plant. The H5 rule put
  Canton fall peas at Aug 28 to Sep 18. FF50 gives Aug 1 to 22, which matches the plan and Penn
  State's "August".
- 6.4, fruiting crops: in fall, a hot flowering point now delays the harvest instead of dropping the
  day. Fruit sets from the first day after flowering whose max is at or under `fruitSetMaxC`. It
  then ripens over `M - F` days, and the harvest must still last 7 days before the cap. That gives
  Phoenix fall tomatoes Jul 20 to Aug 17, picked from mid-November, against the UA calendar's
  Jul 15 to Aug 1.
- 5.5 and 6.4, bolting: for a bed-in after midsummer, only the second half of `[d, M]` counts. Heat
  causes bolting in long days. A sowing into late-summer heat matures in shortening, cooler days.
  This moves Phoenix fall lettuce from mid-October to mid-September, where the UA calendar has it.
- Fall bed-in days for direct sowing get the soil rule above.

**Succession (section 7)**
- Candidates after `W(S)` get the fall factor for their harvest.
- Direct-sown rounds respect the soil guard.
- Each window's rounds sit inside it. The spring window runs to its last viable round. Rounds after
  a gap go into the same method's fall window, which stretches to cover them; a plant with no fall
  block gets a fall window built from them. When the spring run reaches the fall window (less than
  one round interval apart), the two merge into one spring window with a `season-long` reason, and
  fall anchors use it.

- A planting's own dates (project.ts) use the same rule for the fall factor as the schedule: a bed-in
  day in a window with rounds gets it after `W(S)`, a fall window's always, a spring window's never.
  So the late rounds of a season-long window get the harvest the schedule checked them with.
- A `fall` anchor on a season-long window starts at its first round after `W(S)`, not at the start of
  spring.

**Overwinter (section 8)**
- Temperature mode no longer plants "at the start of the coolest three-month run" and harvests at
  "plant + days". That planted Melbourne garlic in June and lifted it in August, eight to ten weeks
  early.
- Instead, the plant reference is four weeks before the coolest three months begin, and the harvest
  reference is six weeks after they end. `plantWeeks` and `harvestWeeks` apply as in frost mode.
  The offsets come from frost places: at Canton the cool run starts Dec 1 and ends Mar 1, so the two
  references land 1 and 4 days from FF50 (Nov 4) and LF50 (Apr 16). At Edinburgh they land 12 and 3
  days away.
- In frost mode with monthly data, the plant reference is the earlier of FF50(S-1) and that cool-run
  reference. The harvest reference is the later of LF50(S) and its cool-run reference. This changes
  nothing at Canton or Edinburgh (within 4 days). It moves Phoenix garlic from a Dec 11 start to
  mid-October (Oct 13 with the current plant data), close to the UA calendar's October.
- `pre-chill` only appears when the coolest month's mean is above 10 C. Melbourne's 9.7 C winter
  chills garlic naturally, and extension advice there does not ask for refrigeration. Brisbane and
  Singapore get the reason.
- In temperature mode an overwinter crop needs 85% of `[plant, harvest start]` inside its range. That
  makes fava not viable in Singapore and Brisbane.

**Perennials (section 9)**
- In temperature mode, the yearly harvest is `harvestWeeks` after the same pseudo last frost: six
  weeks past the coolest months. A year is kept when at least half of its harvest days sit in the
  crop's range. Before, "harvest when the mean is in range" gave Melbourne asparagus a harvest all
  year.
- Planting is at the start of the earliest run whose next eight weeks are in range.

**Temperature mode (section 10)**
- New warning `hot-weather-shade` for leafy crops: when the average daily max over `[d, M(d)]` is above
  `temp.maxC + 2`, the bed-in days that do so are named and the reason says to give part shade.
- Melbourne lettuce stays viable all year, as Sustainable Gardening Australia says for temperate zones
  ("all year round", with shade in the hot months). The task brief expected a midsummer gap, so this
  is reported rather than forced.

**Tasks (section 13)**
- The signature is `tasksFor(garden, plantsById, from, to)`, so custom plants resolve outside the
  schedule.
- Frost reminders are per tender planting still in the ground at FF10, with id
  `${plantingId}:frost-possible:${season}`.
- `succession-sow` names the next round only when no planting in the garden already holds it.
- Each task has a `done` flag: ticked in `taskState`, or covered by an actual date. A failed planting
  drops its open tasks.
- `actual.ended` is the last day in the bed, so `bedOut = ended + 1`.
- Auto anchors in temperature mode: `spring` takes the first `temperature` window and `fall` the
  second, or the first when there is only one.
- A pinned planting's season is the first of its own season, the next and the previous that gives a
  viable harvest. Its task ids, though, use the calendar year of the pinned bed-in date: the season
  needs a climate and depends on the hemisphere, and a tick must survive the gardener setting or
  changing the town.
- Plantings grown a way the plant has no block for, or whose actual dates are out of order, have no
  dates and no tasks (ops.ts refuses both).

**Plant data review (8.3)**
A second review of the plant data, with a Gemini critique of the whole library and its goldens,
found places where the maths let through dates an experienced gardener would reject:
- Section 4: crops left standing for the frost (`untilFrost` with harvest type `once`: parsnip, leek)
  also take the bolting-heat cap, so Phoenix leeks come out before the summer heat.
- Section 5.5: a spring window that runs on into cooling weather ends at the first day a tender
  crop would grow mostly below its range (more than half the days to harvest under `temp.minC - 1`).
  Where even the first day fails that test (Edinburgh), the window stays, with the cool-summer warning.
- Section 6: a tender crop gets a fall window only where summer heat cut its spring harvest short or
  ruled it out (Phoenix tomatoes). Elsewhere a later planting is a late spring one. Fall windows and
  succession rounds of tender crops that fail the cool test above are dropped, so no sweet corn is
  sown in an Edinburgh July and no tomato is planted out for a cool autumn.
- Section 9: a perennial with `needsChill` (rhubarb, highbush blueberry, raspberry) is not viable
  where the coolest month averages above 10 C (`no-chill`), in either mode.
- Section 10: temperature mode applies the bolting guard of section 5.5 to annual crops without a
  fruit-set limit, so broccoli, cilantro and turnips are not sown into a Brisbane summer. A soil
  warmth test at sowing was tried and dropped: it put Melbourne tomatoes after early November and
  zucchini into December, later than local guidance.

Known limits, not fixed here:
- Growth speed does not depend on temperature beyond the fixed fall factor. Edinburgh fall spinach
  "matures" in December.
- Phoenix lettuce still has no sowings from about Nov 13 to Dec 11. That gap sits between one season's
  fall window and the next season's spring window.
