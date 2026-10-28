# Review ledger

Every critic or reviewer item gets FIX, DEFER or REJECT with a reason. A rejected item that comes back
twice is escalated to Stewart.

| # | Date | Source | Item | Verdict | Note |
|---|---|---|---|---|---|
| 1 | 2026-10-28 | npm audit | 4 low advisories (deepmerge via workbox-build) | DEFER | Build-time only; see D-A08 |
| 2 | 2026-10-28 | design critic | P0 bed surface unreadable on dark soil (glyphs 1.2 to 1.7:1, selection ring 1.24:1) | FIX | Canvas: pale loam beds, outlined glyphs, ink and white double ring, haloed markers. Build: same tokens |
| 3 | 2026-10-28 | design critic | P0 drag-only interactions (palette, season marker, pinch, empty state) | FIX | Canvas: slider input, phone zoom buttons, pointer cursor. Build: tap to place everywhere, keyboard placement, number fields for bed size |
| 4 | 2026-10-28 | design critic | P1 mock dates contradict each other | FIX | Canvas copy fixed. Build: every date comes from the schedule engine, never typed |
| 5 | 2026-10-28 | design critic | P1 squares named but not labelled; no north | FIX | Canvas: rulers and north arrow on the planner. Build: rulers on every bed, north per garden; phone "turn to fit" is a view option that keeps labels |
| 6 | 2026-10-28 | design critic | P1 planner, ribbon and inspector out of sync | FIX | Canvas: "Looking ahead, back to today" state, ribbon scoped to the selected bed |
| 7 | 2026-10-28 | design critic | P1 calendar stages by opacity only | FIX | Canvas: outlined growing, solid picking, dashed indoors, "Show as a list" |
| 8 | 2026-10-28 | design critic | P1 units toggle changes one string | FIX | Build: all quantities through src/domain/units.ts |
| 9 | 2026-10-28 | design critic | P1 header differs per screen | FIX | Build: one header component |
| 10 | 2026-10-28 | design critic | P1 tokens and dark mode missing on most screens; input borders 2.2:1 | FIX | Build: every colour a token, plant colours tuned per theme, control borders 3:1 or more |
| 11 | 2026-10-28 | design critic | P1 inspector wraps at 1024 to 1140 px; SVG labels shrink | FIX | Build: inspector becomes a sheet below 1200 px; labels as fixed-size HTML overlays |
| 12 | 2026-10-28 | design critic | P1 plant forms rely on colour (tomato, pepper, strawberry share a form) | FIX | Canvas: names on patches. Build: names when zoomed in, initials when zoomed out |
| 13 | 2026-10-28 | design critic | P1 same action has several names | FIX | Build: docs/v8/COPY.md glossary, one name per action |
| 14 | 2026-10-28 | design critic | P2 header shows the 50% frost date | FIX | Canvas: "Frost-safe from Apr 14" |
| 15 | 2026-10-28 | design critic | P2 jargon and mixed spelling | FIX | Build: US English throughout (D-A10); zone shown as "USDA-style zone" with the coldest-night figure; plain words for bolting and indeterminate |
| 16 | 2026-10-28 | design critic | P2 role=alert on a static banner; frost night by fill only | FIX | Canvas: role removed. Build: frost nights get an icon and text |
| 17 | 2026-10-28 | design critic | P2 targets under 44 px | FIX | Canvas: planner at 44. Build: 44 minimum everywhere |
| 18 | 2026-10-28 | design critic | P2 two primary button styles; two colours per crop | FIX | Build: one primary style; one colour per crop with a tint derived from it |
| 19 | 2026-10-28 | design critic | P2 Week, Harvest, Assistant read as template layouts | DEFER | Phase 5 polish: bring plant forms and timber into those screens |
| 20 | 2026-10-28 | design critic | Gaps: bed editor, more phone screens, sowing and rescheduling, southern axis, assistant states, loading, shared-link view, backups, toasts, rotation | FIX | Built as part of Phases 3 to 5; each is a screen or state in the shots list |
| 21 | 2026-10-28 | Claude | Plant notes and companion reasons mix British spellings (flavour, colour) with US English | FIX | Phase 5: spelling lint in the plant-library test plus a sweep (D-A10) |
| 22 | 2026-10-28 | layout builder | Sweet pepper minLitres 15 makes the plan's "pepper fits an 11 L pot" example false | REJECT | 15 L (4 gal) is within extension guidance; the plan's example was illustrative |
| 23 | 2026-10-28 | code review P2 | Critical: unvalidatable or newer save can be overwritten (storedRev -1) | FIX | Fixed 2026-10-28 |
| 24 | 2026-10-28 | code review P2 | Critical: unbounded plant numbers from imports can hang or crash the schedule | FIX | Bounds in PlantSchema; schedule never throws |
| 25 | 2026-10-28 | code review P2 | Critical: share, storage and migrate bypass op invariants | FIX | One cross-reference check used everywhere |
| 26 | 2026-10-28 | code review P2 | Critical: addGarden unvalidated; patches can change ids | FIX | Schema-validate, whitelist patch keys |
| 27 | 2026-10-28 | code review P2 | Quarantine copies unbounded; snapshot labels collide | FIX | Dedupe, cap at 3, timestamped snapshot keys |
| 28 | 2026-10-28 | code review P2 | Merged succession windows: fall factor mismatch between schedule and planting phases | FIX | Same rule in both |
| 29 | 2026-10-28 | code review P2 | Years 0 to 99 shift to 19xx | FIX | setUTCFullYear; ISO years 1000 to 9999 |
| 30 | 2026-10-28 | code review P2 | No local-today helper; migration ticks a day late in the evening | FIX | isoFromLocal; tz offset option |
| 31 | 2026-10-28 | code review P2 | Caches miss for custom plants; uncached phases; rotation n squared order | FIX | WeakMap caches, cheap filters first, perf test |
| 32 | 2026-10-28 | code review P2 | Harvest before bed-in possible for short sow-counted transplants | FIX | Clamp to 7 days |
| 33 | 2026-10-28 | code review P2 | Actual dates unordered; unsupported methods accepted | FIX | Validate in ops |
| 34 | 2026-10-28 | code review P2 | Harvest end days inconsistent with reasons | FIX | Exclusive caps everywhere |
| 35 | 2026-10-28 | code review P2 | Pinned planting ticks lost when climate set | FIX | Ids from pinned date |
| 36 | 2026-10-28 | code review P2 | Throwing subscriber breaks a committed dispatch | FIX | try/catch per listener |
| 37 | 2026-10-28 | code review P2 | Open-Meteo: tmax gaps unchecked, no timeout, unbounded names | FIX | Count both, AbortSignal.timeout, length caps |
| 38 | 2026-10-28 | self-check vs PLAN goal 1 | First run had no "Use my location" | FIX | Geolocation, rounded to 0.01 degrees, e2e with mocked archive |
| 39 | 2026-10-28 | security review, assistant | M: a failed or stopped turn left a tool call with no result in the history, so every later message failed; SDK load failure stuck the panel busy | FIX | runTurn drops what the turn appended on any ending but done; SDK load retried; tool errors caught; busy reset in finally; New chat button |
| 40 | 2026-10-28 | security review, assistant | M: Apply could differ from the preview if the gardener edited the garden meanwhile | FIX | Proposal remembers the document it was built on; if the garden changed, it is dropped with a note and the model is told |
| 41 | 2026-10-28 | security review, assistant | M-L: preview hid note text, dates, custom plant fields; removals looked like additions | FIX | All shown; removals labelled and coloured |
| 42 | 2026-10-28 | security review, assistant | L: tool name lookup accepted inherited names (toString) | FIX | Object.hasOwn |
| 43 | 2026-10-28 | security review, assistant | L: pinned dates any year; counts and patch sizes unbounded | FIX | Dates within a year back and two ahead; counts at most twice what the squares hold; no patch smaller than one plant |
| 44 | 2026-10-28 | security review, assistant | L: photo size uncapped, transparent PNG went black, loose type check; camera permission not needed | FIX | 25 MB cap, white fill, type allow-list, camera=() |
| 45 | 2026-10-28 | security review, assistant | L: photos re-sent on every later message; history never compacted | DEFER | Removing old images would edit earlier turns, which breaks thinking replay. New chat clears it; max_tokens lowered to 16000 |
| 46 | 2026-10-28 | security review, assistant | L: key readable by any page on the same origin; 7.x is still served there | DEFER to CP4 | 8.0 replaces 7.x at that origin on release; nothing else is served there |
| 47 | 2026-10-28 | security review, assistant | L: Escape closed the panel from anywhere; Settings key status can go stale while the panel is open | FIX / DEFER | Escape only inside the panel; stale status is cosmetic |
| 48 | 2026-10-28 | live preview check | Town results stayed open after picking a town | FIX | List closes; the box shows the full place name; e2e |
| 49 | 2026-10-28 | live preview check | A town outside the US started in feet and Fahrenheit when the browser language was US English | FIX | Units follow the town's country until the gardener picks |
| 50 | 2026-10-28 | own shots review | A garden started in the fall showed an empty bed with no word of when plantings go in | FIX | Planner hint with "Show <day>"; e2e |
| 51 | 2026-10-28 | own shots review | Header wrapped to two lines at 1024 px; model choices all bold; "Pulled out 2 tomato" | FIX | Tighter header below 1180 px; label weight; "2 tomato plants" |
| 52 | 2026-10-28 | live preview, Melbourne | Starter garden anchored to windows already past: overdue hardening off and "start picking" for crops never sown | FIX | Starters use the next window from today; seeds raised indoors start today at the earliest; nursery plants when seed is too late; test over 4 places by 4 months |
| 53 | 2026-10-28 | live preview, Melbourne | Year-round windows read "Jul 18 to Jul 17" | FIX | "All year round" / "Any time of year" |
| 54 | 2026-10-28 | live preview | Temperatures in reasons ignored the units ("7 C") | FIX | reasonText takes the units; every caller passes them |
| 55 | 2026-10-28 | own finding | A crop whose window closed a week ago went to next year (peppers in late May) | FIX | Late planting offered up to 6 weeks after the window when 2 weeks of picking still fit; anchor offsets up to a year |
| 56 | 2026-10-28 | blind critic CP2 | P0 calendar: growing bars invisible, no indoor phase; phone shows two months; legend mismatch; text chevrons | FIX | Calendar builder |
| 57 | 2026-10-28 | blind critic CP2 | P0 harvest: phone scrolls sideways, "How many" overflows | FIX | Inputs share the card; form first when it wraps |
| 58 | 2026-10-28 | blind critic CP2 | P0 settings phone: section list over the headings | FIX | Scrolling strip on phones |
| 59 | 2026-10-28 | blind critic CP2 | P0 planner: season strip says nothing planned; "Taken until" labels overlap | FIX | Planner builder |
| 60 | 2026-10-28 | blind critic CP2 | P1 header wraps at 390 and 820; switcher only at 1440; "My garden" reads as a nav item | FIX | One line at every width (logo only below 1100, place shortens); switcher on tablet and up; name dropped from the header |
| 61 | 2026-10-28 | blind critic CP2 | P1 sheets cover the bed; three selection marks; palette and library dates disagree; planner copy and toolbar | FIX | Planner builder |
| 62 | 2026-10-28 | blind critic CP2 | P1 copy points left/right on stacked layouts | FIX | No directions |
| 63 | 2026-10-28 | blind critic CP2 | P1 first-run right half blank before a town is chosen | DEFER | Phase 5: a quiet preview of the result panel |
| 64 | 2026-10-28 | blind critic CP2 | P1 week count left out overdue jobs; order changed between renders | FIX | "12 jobs to do, 6 of them from earlier"; sorted by date then name |
| 65 | 2026-10-28 | blind critic CP2 | P1 plant card sticky button let content show around it | FIX | Solid band the width of the card padding |
| 66 | 2026-10-28 | blind critic CP2 | P1 "8.0.0-dev" shown in About | FIX | "8.0 preview" before release, "8.0" after |
| 67 | 2026-10-28 | blind critic CP2 | P2 plant names lost capitals ("french marigold") | REJECT | Already right in the current build (inSentence keeps French, Swiss, Brussels); the critic saw an older capture |
| 68 | 2026-10-28 | blind critic CP2 | P2 harvest empty state: bars of zero, counts without units | FIX (part) | Heading says what the plan should give; counts say "picked". Compact empty layout DEFER to Phase 5 |
| 69 | 2026-10-28 | blind critic CP2 | P2 tomato card repeats "Frost possible"; developer phrasing in card reasons; settings backups and share rows; library at 1024 px two wide columns; phone chips three rows; week off-centre; missing artboard items (location line in header shown already; "Ask" label; calendar export; print poster) | DEFER | Phase 5 polish pass; print and PNG are Phase 4 |
| 70 | 2026-10-28 | blind critic CP2 | P3 radio dots 2 px low; no nav item active on Settings | DEFER | Phase 5 |
| 71 | 2026-10-28 | own finding while verifying | Planner and calendar styled the same class names (.seg, .key), so after visiting the garden the calendar's indoor bars lost their border and shifted | FIX | Both scoped; a lint test fails on any class styled by two components |
| 72 | 2026-10-28 | own finding while verifying | Router focus on the page heading could steal focus from a plant card's heading | FIX | Router leaves focus that a screen already placed |
| 73 | 2026-10-28 | Phase 4 plan | Print poster and PNG picture of the garden | FIX | One SVG poster drawn from the garden data (plan to scale and the plantings with dates), printed alone by a print stylesheet and saved as a PNG; e2e checks a real PNG and the print view |
| 74 | 2026-10-28 | Phase 5 polish | First run blank half; library columns at 1024 px; phone chips; card repetition and developer phrasing; harvest empty state; settings rows and radios; header current state and "Ask" label; week off-centre (ledger 63, 68 to 70) | FIX | Two builders; npm run check ALL GREEN |
| 75 | 2026-10-28 | final blind critic | P1 This week dates contradicted their own rule (late starter plantings, shifted ranges, held-back tomatoes, later succession sowings all quoted the first rule) | FIX | Ranges never pass the real window; late plantings say so; the reason that set the date is the one shown; later sowings give the succession reason; test holds every job to its reason in 3 places by 3 start dates |
| 76 | 2026-10-28 | final blind critic | P1 Calendar Feb to Jan; phone list hides dates; tomato indoor phase missing; lone "round 5" rows | FIX | Calendar builder |
| 77 | 2026-10-28 | final blind critic | P1 Swiss chard and kohlrabi drawn as flowers; peppers, tomato, strawberry alike | FIX | Chard as red stalks, kohlrabi pale green head, strawberry as berries, a new pepper glyph |
| 78 | 2026-10-28 | final blind critic | P1 Season strip blue all year; laptop selection shrinks the bed; phone buttons wrap; bed label over column A; "*" for planned; repetitive strip title; undo enabled on a new garden | FIX | Planner builder |
| 79 | 2026-10-28 | final blind critic | P1 "8.0 preview" in About | FIX | Version becomes 8.0.0 at release |
| 80 | 2026-10-28 | final blind critic | P2 harvest counts read as picked; heading after the form on phones; chips wrap inside; placeholder looks typed; "postcode"; "Change town" with no town; poster scale line and margin | FIX | "about 120"; heading first; chips one line; muted italic placeholders; "postal code"; "Add your town"; poster fixed |
| 81 | 2026-10-28 | final blind critic | P2 slashed zeros in body text | REJECT | Atkinson Hyperlegible Next slashes the zero on purpose to tell 0 from O; it is the legibility font chosen with the design |
| 82 | 2026-10-28 | final blind critic | P2/P3 assistant panel backdrop; plant card scroll cut; tablet Coming up width; phone first-run preview; header place looks like a label; theme toggle look; settings strip fade; hover outlines in captures | DEFER | 8.0.x polish; none affects use |
| 83 | 2026-10-28 | own check of the final shots | "Swiss chard" and "French marigold" lower-cased: a stray backspace byte from an editing script had replaced the regex word boundary | FIX | Byte fixed, no others in any tracked file, unit test guards the helper; "Sow lettuce again" instead of "round 4" |
