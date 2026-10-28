# Climate profiles: method and validation

How GardenSync 8 turns 30 years of daily temperatures into frost dates, a hardiness zone and a
temperature curve, what it gives for six test places, and how those numbers compare with published
station figures. Code: `src/domain/climate/compute.ts` (method), `manual.ts` (typed-in dates),
`tempCurve.ts` (daily curve), `zone.ts`, and `src/platform/openmeteo.ts` (download). Tests:
`tests/unit/climate*.test.ts`. Fixtures: `tests/fixtures/climate/*.json.gz`, made by
`node scripts/fetch-climate-fixture.mjs`.

## The data

Daily `temperature_2m_min` and `temperature_2m_max` from the Open-Meteo historical archive
(<https://archive-api.open-meteo.com/v1/archive>, `timezone=auto`, 1995-01-01 to 2024-12-31). This is
reanalysis on a grid of roughly 10 km cells, not a weather station. Open-Meteo answers with the
nearest cell, so the stored coordinates are those of the cell (Canton's is 40.81, -81.43 against
the 40.80, -81.38 asked for). All six fixtures came back with no missing days.

## The method in plain words

1. **Monthly normals.** For each calendar month: the average of the daily mean ((min + max) / 2),
   the average minimum and the average maximum. The warmest month is the one with the highest
   mean.
2. **One frost season per winter.** Take the middle day of the warmest month (July 16 in Ohio,
   January 16 in Melbourne). A *frost season* runs from that day to the day before the next one, so
   it is a full year that holds one whole winter. Nothing depends on the hemisphere: the same rule
   gives Jul 16 to Jul 15 in Ohio and Jan 16 to Jan 15 in Melbourne.
3. **Per season:** the first fall frost is the *first* day of the season with a minimum at or below
   0 C, and the last spring frost is the *last* such day of the same season, so a winter with a single
   frost night has first frost = last frost. Likewise the first day at or below -2 C and -5 C, and the
   lowest minimum of the season. Seasons cut off by the start or end of the data are skipped (30
   years of data give 29 complete seasons), as are seasons missing more than a tenth of their
   minimums.
4. **Dates are counted as days into the season** from the warm point, so that ordering is
   chronological even when the winter crosses New Year (a northern frost in January, a southern
   frost season running from May to October). February 29 is folded into February 28.
5. **No frost is infinitely early or late.** A season without a spring frost counts as minus
   infinity for the last frost, one without a fall frost as plus infinity for the first frost.
6. **Quantiles** by nearest rank: sort, take index `round(q * (n - 1))`. The median of an even count
   is the rounded mean of the two middle values. Anything that lands on an infinity is "none".
   - **LF50** = median last spring frost. **LF90** = the 0.9 quantile: in 9 years out of 10 the
     last frost is over by then.
   - **FF50** = median first fall frost. **FF10** = the 0.1 quantile: in 1 year in 10 frost has
     already come by then.
   - **Hard frosts:** median first fall day at or below -2 C and -5 C.
7. **Frost class** from the share of seasons with any minimum at or below 0 C: "frost" at 50% or
   more, "marginal" from 10% to 50%, otherwise "none".
8. **Zone** from the mean of the seasons' lowest minimums, converted to F, in USDA bands:
   zone = floor((F + 60) / 10) + 1, half "a" if (F + 60) mod 10 is under 5, otherwise "b", clamped to
   1a to 13b.
9. **Temperature curve:** each monthly normal is pinned to the middle of its month and days between
   are interpolated in a straight line, going round from December into January.

**Typed-in dates** (`manualProfile`): no spread can be measured from two dates, so LF90 = LF50 + 14
days and FF10 = FF50 - 10 days; hard frosts and zone are unknown unless an extreme minimum is given.

**Why not split at the coldest point.** A first version split each season at the coldest point
(182 days after the warm point) and looked for fall frosts only before it and spring frosts only
after it, as NOAA does when it counts spring freezes from January 1 and fall freezes from August 1.
That works where winter is long, but in mild climates the few frosts straddle the split: Phoenix
came out with frost in 86% of winters and yet no median last frost, because most of its frosts fall
in late December and early January. Taking the first and last frost of the same season fixes that
and changes nothing in Canton or Edinburgh, where both halves always have frost.

## Results (1995-2024)

| Place | Class (share of winters with frost) | LF50 | LF90 | FF10 | FF50 | First -2 C | First -5 C | Mean extreme min | Zone |
|---|---|---|---|---|---|---|---|---|---|
| Canton, Ohio | frost (100%) | Apr 16 | Apr 29 | Oct 26 | Nov 4 | Nov 12 | Dec 1 | -20.7 C | 6a |
| Melbourne | marginal (31%) | none | Jul 21 | Jul 9 | none | none | none | 0.4 C | 10a |
| Phoenix | frost (86%) | Jan 9 | Feb 12 | Nov 30 | Dec 25 | none | none | -1.2 C | 9b |
| Brisbane | none (0%) | none | none | none | none | none | none | 5.4 C | 11a |
| Singapore | none (0%) | none | none | none | none | none | none | 22.7 C | 13b |
| Edinburgh | frost (100%) | Apr 15 | May 1 | Oct 29 | Nov 15 | Dec 8 | none | -5.6 C | 9a |

Monthly normals worth noting: Canton July mean 22.9 C, January -2.4 C; Phoenix July mean maximum
40.9 C; Edinburgh July mean 14.7 C with a mean maximum of 17.9 C; Singapore's monthly means all lie
between 26.0 and 27.4 C.

## Checks against published figures

### Canton, Ohio (Akron-Canton Airport, CAK)
NWS Cleveland's frost/freeze page (1991-2020 normals, data from the Midwestern Regional Climate
Center) gives Akron-Canton an **average last 32 F freeze of April 29** and an **average first freeze
of October 19**, with the earliest last freeze on record April 2, 2019 and the latest first freeze
November 12, 2016. <https://www.weather.gov/cle/frost_freeze>

- The grid's median last frost (Apr 16) is **13 days earlier** than the station average, and its
  median first frost (Nov 4) **16 days later**. The grid's LF90 (Apr 29) lands on the station's
  average. The growing season in the grid is about a month longer than at the airport.
- Year by year the grid tracks the station: its 2019 last frost is April 2, the same day NWS lists as
  the record-early last freeze. The offset is a steady warm bias in nighttime minimums, the
  well-known behaviour of reanalysis on clear, calm radiation nights, when an open airport site
  cools faster than a 10 km average.
- **Zone:** the USDA 2023 map puts Canton in **6b** (-5 to 0 F). The grid's mean extreme minimum is
  -20.7 C = -5.3 F, 0.3 F into **6a**. The method was not adjusted to force 6b; the test pins 6a and
  says why. The grid is slightly cold for the zone even though it is warm for frost dates,
  probably because a season's single coldest night tends to come with an arctic outbreak rather than
  a calm radiation night, where the warm bias is smallest.
- The planning numbers from the earlier, simpler script (LF50 04-16, LF90 04-29, FF50 11-04,
  FF10 10-26) are reproduced exactly.

### Melbourne (Bureau of Meteorology stations, via Wikipedia's climate tables)
Melbourne's city stations almost never reach 0 C: the CBD record low for 1910-2015 is -1.5 C and
Olympic Park's since 2013 is -0.5 C, while Melbourne Airport's is -2.8 C (1970-2022). Mean July
minimums are 7.5 C (CBD), 7.3 C (Olympic Park) and 5.8 C (Airport).
<https://en.wikipedia.org/wiki/Climate_of_Melbourne> (tables sourced to BoM; the BoM site itself
refused automated requests).

- The grid cell's July minimum is 6.5 C, between the city and the airport, and it reaches 0 C in
  31% of winters, which is plausible for the middle and outer suburbs where most Melbourne
  gardeners live, and too frosty for the CBD. "Marginal" with no median first or last frost is the
  right call either way. The risk dates read as one short window: in 1 winter in 10 the first frost
  has come by Jul 9 (FF10), and in 9 in 10 the last has gone by Jul 21 (LF90). FF10 before LF90 is
  the expected order (first frost, then last frost, in the same winter).
- Event check: the grid's coldest night of the period is -1.7 C in the 2018 winter, with its last
  frost on August 29, 2018; news reports from that week (AAP via SBS) describe Melbourne Airport at
  -2 C, its coldest August morning in 32 years, while the city held 0.8 C.
  <https://www.sbs.com.au/news/melbourne-s-record-breaking-cold-start>

### Brisbane (BoM stations, via Wikipedia)
The city station has never gone below 2 C (July record 2.6 C); Brisbane Airport dropped to -0.1 C
once, on 19 July 2007; Archerfield, inland, has a record of -2.5 C. Mean July minimums: 10.5 C
city, 9.4 C airport, 8.1 C Archerfield. <https://en.wikipedia.org/wiki/Climate_of_Brisbane>

- The grid's July minimum is 10.0 C and it never reaches 0 C, so **"none" holds without forcing.**
  Its coldest season is 2007 (2.7 C), the same winter as the airport's only sub-zero reading. Frost
  hollows west of the city (Ipswich) do get frost; a gardener there should type in local dates.

### Phoenix (Sky Harbor, NOAA 1991-2020 normals, via Wikipedia)
Sky Harbor reached 32 F in only 9 of the 30 years 1991-2020 (17 days in all); its average coldest
night of the year is 33.8 F (1.0 C); the record earliest and latest freezes are November 4 (1956)
and March 31 (1987). July mean daily maximum 106.5 F (41.4 C); January mean daily minimum 46.0 F
(7.8 C). <https://en.wikipedia.org/wiki/Climate_of_Phoenix>

- Daytime heat matches: the grid's July mean maximum is 40.9 C, 0.5 C under the airport.
- Nights do not: the grid's January minimum is 5.0 C, 2.8 C colder than Sky Harbor, and it has frost
  in 86% of winters against 30% at the airport. The airport sits in the urban heat island; the grid
  cell behaves like the open desert floor around the city. So the grid calls Phoenix "frost" where
  the airport record would say "marginal", and its zone is 9b where the airport's 1.0 C mean extreme
  minimum would give 10a.
- **Shape of the answer:** the frost season runs from late November (FF10 Nov 30, FF50 Dec 25) to
  mid-February (LF50 Jan 9, LF90 Feb 12), inside the published Nov 4 to Mar 31 envelope. "Tender
  plants out after mid-February" is the right reading for the open valley; gardens near the city
  centre will see fewer frosts than this.

### Edinburgh (Met Office, Royal Botanic Garden Edinburgh No 2, 1991-2020)
Air-frost days per year: 42.7, with 1.70 in April, 0.37 in May, none June to August, 0.03 in
September, 1.27 in October and 5.27 in November. Mean July maximum 19.3 C; mean January minimum
1.7 C. <https://www.metoffice.gov.uk/research/climate/maps-and-data/location-specific-long-term-averages/gcvwr3zrw>
The garden's own growing notes put the local last frost "around May" and say most local growers
wait until June to plant out tender crops. <https://stories.rbge.org.uk/archives/tag/harden-off>

- The grid gives 36.4 air-frost days (minimum below 0 C) a year: 2.7 in April, 0.2 in May, 0.2 in
  October and 3.3 in November. Spring is close to the station, autumn is short of frosts, the same
  warm-night bias as Canton. So LF50 Apr 15 and LF90 May 1 fit the April frost count and the
  "around May" advice (which is a safety date, closer to LF90); FF50 Nov 15 is probably a week or two
  late against the garden's 1.3 October frost days.
- Edinburgh is the short-season case because of warmth, not frost: the frost-free run is long
  (mid-April to mid-November) but July averages only 14.7 C and the warmest month's mean maximum is
  17.9 C, 1.4 C under the botanic garden. Heat-loving crops will struggle whatever the frost dates
  say, which is the "June planting" advice in another form.
- Zone 9a (-5.6 C mean extreme minimum) is consistent with a mild maritime city; RHS hardiness
  ratings are not on the USDA scale, so there is no direct published zone to compare.

### Singapore
Equatorial, never near frost; the grid's monthly means (26.0 to 27.4 C) and coldest nights
(about 22 C) are what any climate summary for Singapore shows. Zone 13b is the top of the scale.

## What this means for the app

- The gridded frost dates are **optimistic**: in Canton the median last frost is two weeks early and
  the median first frost two weeks late against the airport. LF90 and FF10, which the schedule uses
  for tender crops, land close to the station *averages*, so tender crops are still protected, but
  the "nudge by a week" control and the "where these numbers came from" note matter. A fixed
  correction was considered and not applied, because the bias depends on the site (it is large for
  open, cold-air-draining airports and small for city gardens, which are often warmer than the
  airport too).
- Zones can disagree with the USDA map by half a zone at band edges (Canton) and by a full half-zone
  where the city is warmer than its grid cell (Phoenix).
- No hemisphere branch was needed: Melbourne and Brisbane run through exactly the same code as
  Canton, and the synthetic southern tests (warmest in January) give last frosts in August to
  October, and a July-only frost cluster gives first frost Jul 1 and last frost Jul 31.
