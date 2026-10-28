# Schedule validation: computed dates against published guidance

This page checks the schedule maths (`src/domain/schedule/`, spec in `docs/v8/SCHEDULE_SPEC.md`)
against published planting guidance for the six fixture places. Every date is for season 2027 and
uses the 1995-2024 Open-Meteo climate fixtures (`docs/v8/research/climate.md`). The full output for
every plant is in `tests/unit/__goldens__/schedule-*.txt`, and the checks are in
`tests/unit/schedule-windows.test.ts` and `schedule-tasks.test.ts`. The target was to land within
about a week of the guidance. Where the maths missed by more, I changed the maths; each change is
listed under "Changes during build" in the spec.

A note on Canton. The gridded climate gives a median last frost of Apr 16 and a 90%-safe last frost
of Apr 29. The station average at Akron-Canton airport is Apr 29. Ohio extension dates follow the
station, so any rule that hangs only on the grid's frost dates runs about two weeks early there.

## Sources

| Short name | Source |
|---|---|
| OSU-Wayne | OSU Extension, Planning and Planting the Garden (central Ohio dates; "2 weeks later for northern Ohio"), https://wayne.osu.edu/sites/wayne/files/imce/Program_Pages/ANR/Garden/Planning%20and%20Planting%20%20the%20Garden.pdf |
| OSU-Athens | OSU Extension, Ohio Gardening Calendar (Zone 6a), https://athens.osu.edu/sites/athens/files/imce/Ag_Docs/Garden%20Calendar_1.pdf |
| OSU-Tomato | Ohioline HYG-1624, Growing Tomatoes in the Home Garden, https://ohioline.osu.edu/factsheet/HYG-1624 |
| OSU-Garlic | OSU, Growing Garlic in the Garden, https://cfaes.osu.edu/fact-sheet/growing-garlic-garden |
| PSU-Garlic | Penn State Extension, Garlic Production, https://extension.psu.edu/garlic-production |
| PSU-Peas | Penn State Extension, A Gardener's Guide to Peas, https://extension.psu.edu/a-gardeners-guide-to-peas |
| PSU-Fall | Penn State Extension, Season Extenders and Growing Fall Vegetables (last sowing dates), https://extension.psu.edu/season-extenders-and-growing-fall-vegetables |
| UA-az1005 | University of Arizona Cooperative Extension az1005, Vegetable Planting Calendar for Maricopa County, https://extension.arizona.edu/sites/default/files/2024-08/az1005-2018.pdf |
| UA-Garlic | UA Extension, Backyard Gardener: Garlic, https://extension.arizona.edu/sites/default/files/attachment/Garlic.pdf |
| SGA-Tomato | Sustainable Gardening Australia, Tomatoes, https://www.sgaonline.org.au/tomatoes/ |
| GA-Tomato | ABC Gardening Australia, Top Tomato Tips, https://www.abc.net.au/gardening/how-to/top-tomato-tips/13618668 |
| SGA-Garlic | Sustainable Gardening Australia, Glorious Garlic, https://www.sgaonline.org.au/glorious-garlic/ and Harvesting and Storing Garlic, https://www.sgaonline.org.au/harvesting-and-storing-garlic/ |
| SGA-Lettuce | Sustainable Gardening Australia, Lettuce, https://www.sgaonline.org.au/lettuce/ |
| GA-Subtropical | ABC Gardening Australia, Sub-Tropical Vegies, https://www.abc.net.au/gardening/factsheets/sub-tropical-vegies/9423954 |
| GA-Brisbane | ABC Gardening Australia, Subtropical Harvesting (garlic pre-chill), https://abc.net.au/gardening/factsheets/subtropical-harvesting/9431594 |
| NParks-Lettuce | NParks GardeningSG, Lettuce, https://gardeningsg.nparks.gov.sg/gardening-resource-library/lettuce/ |
| NParks-Pea | NParks Flora and Fauna Web, Pisum sativum, https://www.nparks.gov.sg/florafaunaweb/flora/6/5/6532 |
| RBGE-Tender | Royal Botanic Garden Edinburgh, Time to plant out frost tender vegetables, https://stories.rbge.org.uk/?p=342 |
| RBGE-Months | RBGE, What to do in the garden, Scotland: March and April, https://stories.rbge.org.uk/archives/14153 and https://stories.rbge.org.uk/archives/14648 |
| RHS-Tomato | RHS, How to grow tomatoes, https://www.rhs.org.uk/vegetables/tomatoes/grow-your-own |
| RHS-Peas | RHS, How to grow peas, https://www.rhs.org.uk/vegetables/peas/grow-your-own |
| RHS-Potato | RHS, How to grow potatoes, https://www.rhs.org.uk/vegetables/potatoes/grow-your-own |

## Canton, Ohio (frost mode)

| Crop | Computed | Guidance | Difference |
|---|---|---|---|
| Tomato, spring | Seeds indoors Mar 22 to Apr 19, out May 17 to May 31, first pick Jul 26 | OSU-Tomato: central Ohio transplant May 20, northern Ohio about a week later. OSU-Athens: after May 15. OSU-Wayne: set out May 15 central, plus 2 weeks north | Within a week. The spec alone gave out from Apr 29, 2 to 4 weeks early: fixed by the soil-warmth rule for tender transplants |
| Pepper | Indoors Mar 8 to Apr 5, out May 17 to May 31 | OSU-Wayne: start Mar 20, set out May 15 central (plus 2 weeks north) | Within a week |
| Pea, spring | Sow Mar 5 to Apr 2 | OSU-Athens: after Mar 15 and in April. PSU-Peas: April | Start 10 days ahead of OSU-Athens; the window overlaps both |
| Pea, fall | Sow Aug 1 to Aug 22 | PSU-Peas: "may be planted in August". PSU-Fall: last sowing Aug 15 | Within a week. The spec's H5 reference gave Aug 28 to Sep 18: fixed by the FF50 reference for pod crops |
| Lettuce | Spring: sow Mar 19 to May 14, rounds every 14 days. No sowings May 28 to Jul 22 (heat). Fall: sow Jul 23 to Sep 3, rounds Jul 23, Aug 6, Aug 20, Sep 3 | OSU-Athens: April and May, again after Aug 15, leaf lettuce before Sep 10. PSU-Fall: last sowing head Jul 25, bibb Aug 15, leaf Aug 30 | Within a week. Spring rounds, a summer gap, then fall rounds |
| Garlic | Plant Oct 13 to Nov 10 (2026); lift Jun 18 to Jul 9 | OSU-Athens: plant in October. OSU-Garlic: late fall, lift when the lower leaves yellow. PSU-Garlic: most ready by mid-July. UA-Garlic: leaves yellow June to early July | Within a week on both ends, after the plant-data change below (plantWeeks [-3, 1], harvestWeeks [9, 12]). The old data gave Oct 20 to Nov 24, lifted from Jun 4 |
| Spinach | Spring: sow Mar 5 to May 4, rounds every 10 days. Fall: sow Aug 2 to Sep 27, rounds Aug 2 to Sep 21 | OSU-Athens: after Mar 15. OSU-Wayne: Sept 1. PSU-Fall: last sowing Aug 30 | Spring starts 10 days early (as for peas). The fall window contains the guidance dates but runs about 4 weeks past Penn State's last sowing, because the grid's -5 C date is warm |
| Kale | Spring out Mar 19 to Apr 2, picking to Dec 1; fall direct Jul 29 to Aug 20, transplant Aug 26 to Sep 17 | OSU-Wayne: Apr 1 to Aug 1, fall table Aug 1 to 15. PSU-Fall: last sowing Aug 15 | Direct sowing within a week. Fall transplants run about 10 days later than the sowing guidance, which is expected for transplants |

## Melbourne (marginal frost, temperature mode, approximate)

| Crop | Computed | Guidance | Difference |
|---|---|---|---|
| Tomato | Out Oct 19 to Jan 20, seeds indoors Aug 24 to Dec 9, first pick Dec 28 | GA-Tomato: soil at least 16 C, in cold areas usually the first week of November. SGA-Tomato: temperate August to November | Includes early November. The start sits between the two sources |
| Garlic | Plant Apr 13 to May 11; lift Dec 15 to Jan 5; no pre-chill | SGA-Garlic: temperate April to July, harvest in late spring or summer, 7 to 8 months after planting | Within the range. The spec alone planted in June and lifted in August: fixed by the cool-season anchors |
| Lettuce | Sowable all year. Sowings Nov 26 to Feb 22 carry a "part shade" warning | SGA-Lettuce: temperate "All Year Round!", with part shade in hot months or it runs to seed. No authority found that says to avoid midsummer | Matches SGA. The brief expected a midsummer gap; the guidance does not support one, so summer sowings are flagged, not removed |

## Phoenix (frost mode, heat-limited)

| Crop | Computed | Guidance | Difference |
|---|---|---|---|
| Tomato, spring | Out Feb 12 to Mar 10, first pick Apr 23, picking ends May 25 in the heat | UA-az1005: transplants Feb 15 to Mar 15 | Within a week. The spec alone gave Feb 12 to Feb 26, and the first soil rule gave Mar 5: fixed by the rule that weighs soil warmth against summer heat |
| Tomato, fall | Out Jul 20 to Aug 17, picking from Nov 15 | UA-az1005: transplants Jul 15 to Aug 1 | Starts within a week; ends 16 days later. The spec's heat guard made fall not viable: fixed by letting fruit set wait out the heat |
| Tomato, June and July | No window from Jun 1 to Jul 19 | UA-az1005: no tomato planting from late March to mid-July | Agrees. The brief said "no window in June or July", but the UA calendar itself plants from Jul 15, so late July is kept |
| Lettuce | Fall: sow Sep 18 to Nov 12. Spring: sow Dec 12 to Mar 6. Rounds every 14 days inside each window | UA-az1005: head lettuce seed Aug 15 and Sep 1, then Sep 15 to Dec 15, and Jan 1 to Feb 1 (leaf to Feb 15) | Starts 3 to 5 weeks after the Aug 15 seed dates, but within a week of the Sep 15 main start. No sowings Nov 13 to Dec 11 (known limit). Nothing in June or July |

## Brisbane (frost-free, temperature mode)

| Crop | Computed | Guidance | Difference |
|---|---|---|---|
| Lettuce | Sowable Mar 17 to Sep 28 (across the season edge); not December to mid-March | GA-Subtropical: "don't bother" with lettuce in the warm, humid summer; winter is the best season | May is in, January is out. GA names no months |
| Garlic | Plant Apr 13 to May 11 with pre-chill; lift Dec 15 to Jan 5 | GA-Brisbane: pre-chill cloves in the fridge for a month; harvest about 5 months later, before the wet season | Pre-chill agrees. Lifting runs 1 to 2 months later than the 5 months GA gives |

## Singapore (equatorial, temperature mode)

| Crop | Computed | Guidance | Difference |
|---|---|---|---|
| Lettuce | Not viable (too hot: mean stays above 22 C) | NParks-Lettuce: head lettuce is difficult to grow outdoors; loose-leaf types do better | Agrees for head lettuce. A heat-tolerant loose-leaf variety would need its own record |
| Pea | Not viable (too hot) | NParks-Pea: not likely to grow well outdoors in Singapore | Agrees |
| Garlic | Plant Sep 13 to Oct 11 with "chill the cloves for 6 weeks"; lift May 17 to Jun 7 | UA-Garlic: cloves need 4 to 6 weeks below 40 F to bulb. GA-Brisbane: pre-chill in warm climates. No Singapore source on whether garlic does well there | Pre-chill agrees. The dates are approximate |

## Edinburgh (frost mode, short cool season)

| Crop | Computed | Guidance | Difference |
|---|---|---|---|
| Tomato | Indoors Apr 20 to May 18, out Jun 15 to Jun 29, with warnings that it would grow mostly in weather cooler than it likes (grow under cover) and frost possible from Oct 29 | RBGE-Tender: most local growers wait until June to plant tender crops out, and sow tomatoes about 6 weeks before. RHS-Tomato: plant out in early summer once reliably above 16 C | Within a week. The spec alone gave May 1: fixed by the warmest-weeks rule |
| Pea | Sow Mar 4 to Apr 1, no warnings; fall Aug 12 to Sep 2 | RBGE-Months: March under cloche or fleece, and April. RHS-Peas: March to June | Agrees |
| Potato | Plant Mar 18 to Apr 15; lift Jun 16 to Jul 14 | RHS-Potato: first earlies planted late March, lifted June to July. RBGE-Months: end of March if the soil is warm, otherwise April | Agrees |

## Frost-only profile and time zones

A typed-in profile (LF50 Apr 16, FF50 Nov 4, no temperatures) runs in frost-only mode. Tomatoes go
out at LF90 (Apr 30, LF50 + 14) with no soil, heat or bolting guards, and every window carries the
"add your town for heat-aware dates" warning. The golden files are compared under both
`TZ=America/New_York` and `TZ=Australia/Melbourne` by `npm run check`, and they are identical, because
all arithmetic is on UTC day numbers.

## Succession rounds and their windows

Each window's rounds now sit inside it. The spring window runs to its last viable round, and rounds
after a heat gap go into the fall window, which stretches to cover them. When the spring run reaches
the fall window with no gap, both are reported once as a single "spring through fall" window. In
Canton that happens for beet, carrot, cilantro, dill, scallion, turnip and bush bean; Edinburgh, with
its cool summers, merges almost every succession crop. A plant with succession but no fall block
gets a fall window built from its later rounds (Phoenix sunflower and sweet corn, Jul 25 to Sep 5,
which matches UA-az1005's summer corn sowings).

## Plant-data changes

Applied after review:
- `garlic`: `overwinter.plantWeeks` changed from `[-2, 3]` to `[-3, 1]`, and `harvestWeeks` from
  `[7, 11]` to `[9, 12]`, with the Penn State source added. Canton now plants Oct 13 to Nov 10 and
  lifts Jun 18 to Jul 9. With the station's last frost (Apr 29) instead of the grid's, it would
  lift Jul 1 to Jul 22.

- `fava-bean`: `winterMinC` -10 added in the plant verification pass
  (`docs/v8/research/plants-verification.md`). The RHS broad bean page gives no temperature; the
  figure is from the USDA NRCS fava plant guide (hardier cultivars to 14 F). Canton's fall-sown fava
  now carries a `winter-too-cold` warning, since its mean extreme minimum is -20.7 C. The same pass
  changed tomatillo and melon maturity, rosemary's frost class and four `untilFrost` flags; none of
  the crops checked on this page moved.
