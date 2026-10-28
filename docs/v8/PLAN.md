# GardenSync 8.0: ground-up rebuild for home gardeners anywhere

## Context

GardenSync 7.1 was built for one community garden. The repo is already public
(`Samizdat-Publications/gardensync`, live at gardensync-e4e.pages.dev), but the app still reads as
that group's tool: the group's banner, ticker and logo, a fixed zone badge, a Volunteers tab, a
group harvest goal, and the maintainer's own gardens in the demos. Underneath, it has outgrown its structure: 33 global-scope scripts, a 170 KB
stylesheet, the frost-date maths copied six times with different rules, no location setting at all,
fixed-size emoji at pixel positions instead of real square-foot cells, unescaped user text reaching
`innerHTML`, a broken seed-OCR model id, a likely-broken Gemini visualizer, and Supabase sync
pointed at Stewart's personal project with open RLS.

The goal is a ground-up rebuild of the same idea (beds, square-foot planting, companions, a
frost-aware schedule, a harvest log, an optional AI helper) for **home gardeners anywhere**, polished
enough to promote on GitHub, shipped as **GardenSync 8.0** in the same repo.

**Stewart's decisions (2026-10-28):** home gardeners (crews and group goals go); same repo, ships as
8.0 (tags already run v1.0 to v7.1); Vite + TypeScript + Preact; the assistant stays as an optional
bring-your-own-key panel, the Gemini visualizer goes.

**Verified during planning:** one free, keyless call to Open-Meteo's historical archive (30 years of
daily lows/highs, ~250 KB) gives Canton a median last frost of Apr 16 (the app hard-codes Apr 18),
first frost Nov 4, and zone 6b (matches the 2023 USDA map). So "type your town, get your frost
dates" works worldwide with no key and no backend. The same test on harder places shows why frost
dates alone are not enough: Melbourne gets frost in only 10 of 30 years, Singapore never, and
Phoenix's real limit is summer heat (July mean 34.7 °C), not frost. So the schedule uses weekly
frost risk **and** each crop's temperature range, both from that one download.

## What 8.0 is

**One line:** draw your beds, drop plants into the squares, and GardenSync tells you when to start,
sow, plant out and pick, using frost dates worked out for your own town.

**Goals**
1. **Works anywhere.** First run asks "Where do you garden?" (search a town, use my location, or type
   frost dates by hand). Frost dates, zone, season length and monthly temperatures are computed
   from 30 years of Open-Meteo data and cached in the save, so it works offline after. Both
   hemispheres. Frost-free climates get a temperature-window schedule labelled approximate.
   Imperial or metric (1 ft or 30 cm squares; lb or kg; °F or °C).
2. **A planner that feels like a tool.** One SVG garden in real units: beds and containers you can
   draw, resize, rotate; plants placed into squares with their true footprint; friends and foes shown
   in the bed; mouse, touch, pen and keyboard; pinch and wheel zoom; undo for everything.
3. **Time-aware.** Every planting has dates. A season scrubber shows the garden on any week, so
   succession (lettuce in spring, beans in the same square in summer) and fall crops are first-class.
4. **A schedule you can trust.** "This week" tasks and a year calendar, every date with a "why"
   ("6 to 8 weeks before your last frost, Apr 16"). Frost warnings from the 7-day forecast.
5. **A plant library worth reading.** About 60 fact-checked crops, herbs, fruit and companion flowers
   with a consistent schema, local dates on every card, companions with reasons, and cited sources.
6. **Harvest log.** Log picks per planting, compare with projected yield, season totals.
7. **Local-first and safe with your data.** No account. Autosave, rolling backups, JSON export and
   import, share link, printable poster and PNG, installable and offline (PWA), several gardens.
   Old 7.x gardens on the same site are imported automatically and never deleted.
8. **Optional assistant.** Bring your own Anthropic key: chat that can read and edit the garden with
   tools (every edit undoable), and read a seed-packet photo into a custom variety. Nothing else
   needs a key.
9. **Polished.** WCAG 2.2 AA, full keyboard use, light and dark, reduced motion, fast on a mid-range
   phone, Lighthouse 95+ across the board.

**Non-goals for 8.0:** accounts or cloud sync, crews and volunteers, group goals, the Gemini
visualizer, the effects panel (bloom, sway, page turn and the rest), 3D, native apps, translations
(strings kept in one place so they can come later), photo journaling.

**Anti-goals (a failure even if it works):** any Canton, group or personal content left in the app
or repo tree; a date the app can't explain; a core feature that needs a key; losing someone's
garden; emoji as plant icons; a planner that stutters on a phone; folklore companions presented as
fact.

## Design with Claude Design (Phase 1, ends at Checkpoint 1)

Claude Design now lives in Claude as the **Design canvas** artifact type (live artboards on a
canvas, private by default, Stewart can comment on any artboard). I create one canvas,
"GardenSync 8 design", containing:

1. **Three directions, same screen.** The desktop planner drawn three ways so the choice is visual:
   - **A. Field kit** (my pick): GardenSync's lineage made grown-up. Bold condensed display type,
     high contrast, leaf green on dark soil plus a sunlit light theme, seed-packet label details.
     Loud styling, calm copy. Keeps it clearly distinct from the Almanac's paper and ink.
   - **B. Seed catalogue:** warm printed colour, illustrated feel, editorial type.
   - **C. Quiet tool:** neutral modern app, one green accent, maximum clarity.
2. **The full screen set in the recommended direction:** first-run location setup, planner (desktop
   and phone), plant library and plant card, This week, year calendar, harvest log, settings and
   your-climate panel, assistant panel, empty, error and offline states.
3. **The plant glyph system:** no emoji. One drawn glyph per plant form (leafy rosette, root, fruiting
   bush, vine, pod, allium, brassica head, herb sprig, flower, tuber, cane fruit, grain), coloured
   per crop, legible at 16 px, generated from data so every plant (and custom ones) gets one.
4. **Tokens** for colour (light and dark), type, spacing, radii, motion, written so the app's
   `tokens.css` is a straight copy.

I use the frontend-design and impeccable skills for craft, then run a blind critic subagent over the
canvas before Stewart sees it (approving this plan counts as asking for that check). The app's
`tokens.css` and components are then built to match the artboards, and the critic compares app
screenshots against them in later phases.

**Checkpoint 1:** Stewart picks a direction (or says "A, but...") and comments on the artboards.
If the pick is B or C, I redraw the set in that direction and carry on without another stop.

## How it's built

### Code layout
```
src/domain/     pure TypeScript, no DOM, fully unit-tested
  dates.ts        integer day numbers, ISO dates, seasons (never Date arithmetic)
  units.ts        centimetres canonical; ft/in, lb/kg, °F/°C are display only
  climate/        compute.ts (daily series -> ClimateProfile), zone.ts, tempCurve.ts
  plants/         schema.ts (valibot), library.json, companions.json, resolve.ts (variety = parent + deltas)
  schedule/       windows.ts, project.ts (planting -> phases), tasks.ts
  layout/         patch.ts (counts, vessel capacity), occupancy.ts (cells x time), rotation.ts
  yield.ts
  doc/            schema.ts, ops.ts (every edit is an Op), migrate-v7.ts, share.ts
src/platform/   storage.ts, openmeteo.ts, anthropic.ts, png.ts
src/ui/         store.ts, app shell, planner/, schedule/, plants/, climate/, harvest/, assistant/
tests/          unit goldens + fixtures; e2e/ Playwright specs and the shots script
```
Runtime dependencies stay tiny: preact, @preact/signals, valibot, immer, self-hosted fonts. No date
or chart library; charts are hand-drawn SVG.

### The garden model
- **Garden doc:** `{schemaVersion, gardens[{id, name, units, climate, beds[], plantings[], series[],
  harvests[], journal[], customPlants[], taskState{}}], settings}`. Geometry stored in cm.
- **Beds** are rectangles on a square grid (1 ft or 30 cm cells; the same per-square densities apply
  to both, and the app says so), rotated in 90° steps. **Vessels** (pots, grow bags, buckets) are not
  grids: they have a volume, and each plant has a minimum volume and a max per vessel, so a pepper
  fits a 12" (11 L) pot and an indeterminate tomato gets a warning. Window boxes and troughs are
  one-row beds. Potato towers are a vessel with a pocket count.
- **Plantings are patches:** a rectangle of cells plus a count, the count derived from the plant's
  density and editable. Each plant declares density explicitly (16, 9, 4 or 1 per square, or squares
  per plant such as 2x2 for squash), plus a rows layout for row-sown beds. A 4x8 bed of carrots is
  one patch of 512, drawn as a fill with a count and a few glyphs, not 512 nodes.
- **Time:** a planting occupies its cells from `bedIn` to `bedOut` (indoor seedlings occupy nothing).
  Garlic holds its squares from October to July across the new year; a July bean may follow it.
  A planting stores an **anchor**, not a fixed date: `auto` (a named window such as spring, fall,
  overwinter or succession round n, plus an offset in days) or `pinned` (a date the gardener set).
  Auto dates are computed, so changing frost dates re-flows the garden; pinned ones never move.
  Dropping a plant uses the next viable window from the scrubber date (October in the north offers
  the fall or overwinter window if there is one, otherwise next spring, and says which). Actual
  dates (sown, transplanted, ended, failed) are stored and win over the plan.
- **Interplanting** is a badge, not a block: a low, shade-tolerant crop under a tall one, or a relay
  crop that ends within four weeks of the next going in. Anything else shows a conflict with the
  reason; placing avoids occupied cells unless "interplant here" is chosen.
- **Succession** is a series (plant, interval) whose rounds are ordinary plantings. **Perennials**
  have no end date, a first-harvest year (asparagus year 3, rhubarb year 2) and yearly windows.
  **Rotation:** a warning when the same family was in the same bed within three seasons.

### The plant library
About 60 crops, herbs, fruit and companion flowers at launch, each one fact-checked, rather than more
with thin data. Each record: name, latin name, category, family, lifecycle, frost tolerance (tender,
half-hardy, hardy), growing temperature range (daily mean °C), fruit-set maximum, soil temperature
minimum, sun, water, density, in-row and between-row spacing, container minimum volume, canopy
height and shade tolerance, days to maturity and whether that counts from sowing or transplant,
transplant age, sowing offsets relative to last frost (as the extension literature publishes them),
fall window, overwinter rule, succession interval, harvest type and window, yield per plant or per
square, glyph spec, short care notes with **no absolute dates or place names**, and `sources[]`.
Companions live in one symmetric table `{a, b, good|bad, reason, evidence: tested|traditional}`;
the 23 broken references and the myths (cucumber with melons, beet with chard) go. The old library
seeds the work; research subagents check every number against two or more university extension or
RHS sources, and disagreements go in the ledger. Varieties are parent plus differences, which is
exactly what a seed packet gives, so old 7.x varieties become custom varieties on import. A custom
plant needs only a name, category, days to maturity, frost tolerance and sowing method; every other
field inherits from its parent crop or a category default, and its schedule says "based on
defaults for this kind of plant".

### The climate and schedule maths
- **Profile from 30 years of daily data:** find the warmest month; last frost is the last Tmin ≤ 0 °C
  in the half-year before it, first frost the first in the half-year after (so no hemisphere branch).
  Years without frost count as infinitely early or late, then take quantiles: LF50 and LF90 (median
  and 90%-safe last frost), FF50 and FF10, plus first −2 °C and −5 °C dates for half-hardy and
  hardy crops. Frost-free if most years have no frost; marginal if 10 to 50% do (Melbourne). Zone
  from the mean extreme minimum per cold season. Monthly mean, min and max temperatures. Every value
  can be nudged by a week or typed in by hand, and the panel says where the numbers came from.
- **Typed-in frost dates:** if a town is known, the temperature curve is still downloaded and only the
  frost dates are overridden. With no town or no network, the schedule runs on frost dates alone
  (LF90 = LF50 + 14 days, FF10 = FF50 - 10 days), heat and frost-free rules are off, and a banner
  says "add your town for heat-aware dates".
- **What each date is for:** LF50 anchors the published offsets; LF90 is the floor for tender crops
  going out; FF10 drives tender fall back-counting and starts "watch the forecast"; FF50 ends tender
  harvests and anchors garlic; the −2 and −5 °C dates end half-hardy and hardy crops. Risk bands
  (LF50 to LF90, FF10 to FF50) are drawn on the calendar.
- **Spring:** outdoor window = LF50 + published offsets, pushed to LF90 and to soil warmth for
  tender crops; indoor start counts back from it by transplant age; harden-off is the ten days
  before. **Maturity** = bed-in + days to maturity (adjusted for sow vs transplant), plus 14 days
  when maturing into shortening days; the harvest ends at the cap for its hardiness, and a window
  that can't fit is "not viable here".
- **Fall:** latest bed-in = the frost reference for its hardiness minus (days to maturity + 14 +
  harvest window for tender crops), not before summer heat eases. Canton fall peas come out at
  roughly Aug 1 to 22, matching Ohio guidance.
- **Succession:** candidate sowings every interval up to the latest bed-in, kept only where the
  harvest fits, the season stays under the crop's bolting temperature, and tender crops are past
  LF90. Lettuce gets spring rounds, a summer gap, then fall rounds, without special cases.
- **Overwinter** (garlic, fava, overwintering onions): planted around FF50, harvested a set number of
  weeks after next spring's LF50; in frost-free climates it says to pre-chill.
- **Heat:** everywhere, the flowering point must sit under the crop's fruit-set maximum, which is what
  gives Phoenix two tomato windows and none in June. **Frost-free:** windows are the runs where the
  mean temperature stays in the crop's range, labelled approximate; a crop with no window says so
  and suggests heat-tolerant varieties instead of going blank.
- **Year boundary:** windows are always worked out for last, this and next season; tasks filter by
  date, never by "this year". Task ids are stable, so ticking one survives a re-flowed schedule.

### State, saving and safety
- One immutable garden doc in a signal; selection, zoom and the viewed date are separate UI signals.
  The only way to change the doc is `dispatch(op)`. Drags preview live and commit one op on release.
  Undo is a capped stack of previous docs (structural sharing); an assistant batch is one undo step.
- Autosave 400 ms after a change and on page hide, with a revision number so a second tab can't
  silently overwrite the first; a 7-day backup ring plus a pre-import snapshot; a corrupt save is
  quarantined and a recovery screen offered. `navigator.storage.persist()`, an install nudge and a
  monthly export reminder cover Safari's habit of clearing site data.
- **7.x import:** on first load, read the old keys (`gardensync_state`, `_harvests`, `_journal`,
  `_plantlog`, `_completed_tasks`, `gardenSyncCustomPlants`; beds in feet at 40 px per foot), show a
  dry-run summary ("14 beds, 212 plants, 3 unknown"), import, and leave the old keys untouched. Old
  JSON export files and old `#plan=` share links go through the same path. Imported plants get auto
  anchors on this season's main window, with real sow dates from the old planting log where they
  exist. Crew, volunteer and goal data is kept, inert, in a `legacy` field so nothing is lost.
- **Share links** carry beds, plantings, custom plants and the garden name, compressed into the URL
  hash. Harvests, journal and the key never go in. The town and frost dates go in only if the sender
  ticks "include my location" (coordinates rounded to 0.1°); otherwise the recipient's own climate
  is used.
- **Security:** Preact escapes all text and `innerHTML` is banned for user or model content; strict
  CSP in `_headers` (`connect-src` only Open-Meteo and Anthropic); imports and share links validated
  by the same schema; the assistant key never goes into exports or share links; every assistant edit
  is an op, previewed and undoable. The assistant code is written after loading the claude-api
  skill (current model ids, browser-direct access).

### Rendering
The garden is one SVG in real units with viewBox pan and zoom, Pointer Events for mouse, touch and
pen, pinch zoom, and level of detail by zoom (patches become fills when zoomed out). Tap to place is
the main touch interaction. PNG and print come from the same SVG.

## How I work autonomously (so Stewart only reviews at checkpoints)

Modelled on the loop already working in Black Diamond and Inner Sun.

**Durable state in the repo** (so any session, including a fresh one after a usage limit, can resume):
- `PROGRESS.md`: current phase, dated done log, "Next (exact)". Updated after every meaningful chunk.
- `HANDOFF.md`: newest first, "start here", and the exact prompt to paste into a new session.
- `docs/v8/PLAN.md`: this plan, copied in at Phase 0.
- `docs/v8/DECISIONS.md`: D-Uxx (Stewart's) and D-Axx (mine), each with how to reverse it.
- `docs/v8/NEEDS_STEWART.md`: only things only Stewart can do, each with the workaround I'm using meanwhile.
- `review/LEDGER.md`: every critic or reviewer item marked FIX, DEFER or REJECT with a reason.
- `docs/v8/CPn_GATE.md`: per checkpoint, what was asked, results, pictures, open questions.
- `docs/STEWART_FEEDBACK.md`: Stewart's checkpoint comments, which outrank any critic.

**The loop, every task:** build, then **check** (one command, `npm run check`: typecheck, unit tests,
build, end-to-end tests, axe accessibility, bundle budget; prints ALL GREEN or FAILED), then **see**
(`npm run shots`: Playwright captures every screen at phone, tablet and desktop, light and dark,
which I open and look at myself), then **critique** (a blind critic subagent that only sees the
screenshots and the design canvas, never my code or intent; a code-review subagent on the phase
diff), then fix and repeat. Nothing gets called done without the check output to show for it;
anything I could not check is marked UNVERIFIED.

**Who does what:** I keep architecture, the design, UI composition and every judgment call. Fresh
builder subagents take well-specified independent tasks (each domain module with its tests, plant
data batches), on disjoint files, reviewed before merge (superpowers subagent-driven-development).
Research subagents fact-check plant data against university extension and RHS sources.

**When I stop:** only at the four checkpoints, at a usage limit, or for an action outside the list
below. A product question that comes up mid-phase gets my best reversible call, logged in
DECISIONS.md and raised at the next checkpoint; work does not wait. At each checkpoint I push a
notification to Stewart's phone with the preview link and the gate doc, then wait.

**What approving this plan authorizes (for the whole rebuild):**
- Tag today's `master` as `v7-final` (the existing `v7.1` tag is five commits older) and push the
  tag, so the last old version is always one checkout away.
- Create branch `v8` from `master` in this repo; commit there freely (explicit paths, never
  `git add -A`, never `.claude/data/`); push `v8` to origin. The repo is public, so the branch is
  visible while in progress.
- `git worktree prune` for the two stale worktree entries still pointing at the dead
  `C:\Users\stewa\OneDrive\Documents\Claude\gardensync\...` path.
- Install the npm dev and runtime packages named in this plan (current versions checked today:
  vite 8.3, preact 11.1, @preact/signals 2.11, typescript 7.0, vitest 5.0, @playwright/test 1.64,
  @axe-core/playwright 4.14, vite-plugin-pwa 2.0, @fontsource fonts; plus valibot 1.5 and immer 11).
- Preview deploys of the `v8` branch to Cloudflare Pages: `https://v8.gardensync-e4e.pages.dev`.
  Never the production branch before Checkpoint 4.
- A GitHub Actions workflow on the `v8` branch that runs the same check.
- Private artifacts (the design canvas), web research, keep-awake on this PC while working.

**Still needs Stewart's yes (asked at Checkpoint 4):** merging to `master`, the production deploy,
the `v8.0.0` tag and GitHub release, changing the repo description, topics and homepage,
redeploying the landing page, deleting remote branches, any history rewrite, anything in the
gardensync-almanac repo.

**The one thing for Stewart to do at the start:** when approving, choose the mode that auto-accepts
edits, so I don't stop for permission prompts.

## Repo clean-up on the `v8` branch

- **Old app out of the tree** (history and the `v7-final` tag keep it): `index.html`,
  `styles.css`, `guide.html`, `js/`, the two HTML test pages, `proxy.py`, `deploy.sh`.
- **Personal and group files out of the tree:** `spring-amendment-shopping-plan.html`,
  `demo-data.json`, `tools/shoot-almanac.js` (belongs to the Almanac repo). Stewart's ignored
  personal files on disk (garden saves, backups, photos, the group's documents) stay where they
  are, untouched and never staged; they are excluded locally so they can't be committed by
  accident.
- **Landing page:** the byte-range function moves from `functions/` into `site/` so the app deploy
  no longer uploads it; footer `blob/main` link fixed to `master`. Content refreshed in Phase 6.
- **Claude tooling:** new `CLAUDE.md` for the new stack; `project-conventions` skill rewritten (it
  currently bans TypeScript and test runners); `gen-test` skill retired; `security-reviewer` agent
  repointed at `src/`; `.claude/launch.json` runs `npm run dev`. The prompt-type edit hook in
  `.claude/settings.json` costs a model call on every edit and is the kind that caused halts before;
  I'll swap it for an equivalent command hook (same rule: no `.env` or secrets). If the harness won't
  let me edit it, it goes in NEEDS_STEWART.
- **Reported, not touched (Stewart's call at Checkpoint 4):** the old group's files and the old
  monolith still in public history; two unrelated branches on the remote.

## Phases and checkpoints

Each phase ends with `npm run check` ALL GREEN, a screenshot review, the critic pass with every
item ledgered, PROGRESS and HANDOFF updated, a commit and a push of `v8`.

| Phase | What gets built | Ends with |
|---|---|---|
| **0. Setup** | Branch `v8`, worktree prune, ignores, scaffold (Vite, TS strict, Preact, Vitest, Playwright, axe), `npm run check` and `npm run shots`, CI workflow, the state docs, new CLAUDE.md and project skill, keep-awake; fix the memory notes that still point at the dead OneDrive path or describe dropped features (Supabase, the punk overhaul) | internal gate |
| **1. Design** | Claude Design canvas: three directions, the full screen set, glyph system, tokens | **CP1: Stewart picks a direction and comments** |
| **2. Domain core** | Plant library (data + research fact-check), climate profile, schedule maths, garden geometry, save format and validation, 7.x migration, share codec. Pure TypeScript, no UI, heavily unit-tested | internal gate |
| **3. Core app** | App shell and navigation, first-run location setup, planner (beds, containers, placement, companions, season scrubber, undo), plant library and plant card, settings and your-climate panel | **CP2: preview link, "does this feel right?"** |
| **4. Everything else** | This week, year calendar, frost-warning forecast, harvest log, several gardens, export / import / share / print / PNG, automatic 7.x import, PWA offline, the assistant | internal gate |
| **5. Hardening and polish** | Accessibility, keyboard, touch and pinch, performance budget, empty / error / offline states, three browsers, in-app help, README, CONTRIBUTING, plant-data and climate method docs; critic rounds until nothing serious is left | **CP3: beta preview link + QA report** |
| **6. Release** | CHANGELOG, showcase.json, refreshed landing page and project page captures, publish check over history | **CP4: Stewart says yes, then I merge, deploy production, tag `v8.0.0`, publish the release, update repo description** |

## Verification

- **One command:** `npm run check` must be ALL GREEN at every gate and checkpoint, locally and in CI.
- **Unit (Vitest)**, run under two time zones (New York and Melbourne) to catch date bugs:
  - Climate from trimmed, committed 30-year Open-Meteo fixtures (Canton: 40.80, -81.38,
    1995 to 2024, the same series I ran during planning) plus synthetic series with known answers.
    Canton exact against that fixture (LF50 Apr 16, LF90 Apr 29, FF50 Nov 4, FF10 Oct 26, zone 6b);
    other places are first checked against published frost and zone figures within a week, then
    their computed values become the goldens. Melbourne
    marginal; Brisbane and Singapore frost-free; Phoenix Jan to Feb last frost; Edinburgh as a
    short-season case.
  - Schedule goldens as readable text snapshots, each first checked against extension guidance for
    that place (within a week) and then frozen. Canton tomato out from Apr 29 with seeds started
    early to late March, peas Mar 5 to 19 plus a fall window around Aug 1 to 22, lettuce spring
    rounds then a July gap then fall rounds, garlic planted mid-Oct to mid-Nov and lifted early to
    mid-July; Melbourne tomato window includes early November and garlic goes in in autumn; Phoenix
    two tomato windows and none in June or July; Brisbane lettuce in May, not January; Singapore
    lettuce and peas unsuitable, garlic needs pre-chilling.
  - Layout: 4x8 carrots = 512; garlic blocks a May tomato in its squares but not a July bean;
    lettuce under tomato is an interplant badge; asparagus has no harvest in years 1 and 2; pepper fits
    an 11 L pot and a tomato warns.
  - Tasks for fixed "today" dates, including late December showing January's jobs.
  - Plant data lint: every record valid, unique ids, every companion resolves, no duplicate pairs,
    ranges ordered, sources present, no absolute dates or place names in notes.
  - Save validation; share-link round trip under 8 KB; 7.x migration with the old public demo
    gardens as committed fixtures and Stewart's ignored real saves on disk as local-only fixtures
    (never committed): counts preserved, unknown plants become custom ones, idempotent, never throws.
- **End to end (Playwright, Chromium, Firefox and WebKit):** first run with mocked geocoding and
  archive responses; draw a bed, place and move plants, undo; scrub the season; This week shows
  the right tasks; log a harvest; export then import; share link opens the same garden; a 7.x garden
  in localStorage is imported intact and the original keys are still there; offline reload works;
  a keyboard-only pass; a phone-size touch pass. axe runs on every screen.
- **Visual:** `npm run shots` set reviewed by me each phase and by the blind critic.
- **Real site:** before each checkpoint I drive `https://v8.gardensync-e4e.pages.dev` in the built-in
  browser, and run Lighthouse on it (target 95+ in every category).

## Risks and how they're handled

- **Plant data is the biggest job.** Fewer crops done properly, schema plus lint tests, two sources per
  number, folklore labelled "traditional" or dropped, sources shown in the app.
- **Gridded climate data is off in valleys, coasts and cities.** Say where numbers came from, make
  each date easy to nudge or type in.
- **Date bugs** (time zones, daylight saving, leap years, hemispheres, the new year). Integer day
  numbers, the two-time-zone test run, three-season evaluation.
- **Data loss.** Revision check, backup ring, pre-import snapshot, persistent storage, export reminders.
- **Scope creep.** There is no deadline (Stewart: "take as long as you need"), so quality wins over
  speed. Domain core with goldens first, then the UI in vertical slices. Only a feature that turns
  out wildly expensive for its value moves to 8.1, and the candidates are named now: forecast frost
  alerts, the print poster, the rotation warning, potato towers.

## Calls I made (Stewart can overrule any of them)

- Name stays **GardenSync**; tagline written in the design phase.
- The header drops the Almanac link along with the rest of the banner; the README and About page
  still mention it.
- The Climate and Visualize tabs go; climate lives in a "Your climate" panel in settings, weather as a
  small frost-warning card in This week.
- Old Ferry-Morse and Livingston seed-packet varieties leave the built-in library; anyone who had them
  keeps them as custom varieties after import.
- Demo gardens are new and generic (a first 4x8 bed, a patio of containers, a salsa bed, a
  three-bed kitchen garden); none of the old personal or group demos ship.
- Fonts are self-hosted (privacy and offline), not loaded from Google.
- The laptop needs to stay plugged in with the lid open during long runs; keep-awake can't stop a
  closed lid from sleeping.
