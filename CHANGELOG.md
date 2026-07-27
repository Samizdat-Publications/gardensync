# GardenSync Changelog

The planner is live at <https://gardensync-e4e.pages.dev>. Project page:
<https://samizdat-publications.github.io/gardensync/>

Its sibling edition, *A Quiet Almanac*, now lives in its own repository:
<https://github.com/Samizdat-Publications/gardensync-almanac>
(live at <https://gardensync-almanac.pages.dev>).

---

## v7.0 — 2026-07-26

**The two editions became two repositories.**

They never shared a line of code — only a repo, a deploy script and a plant
dataset. Keeping them together meant one README trying to introduce two
different programs with two different aesthetics, one landing page split down
the middle, and every visitor landing on a choice before they had seen either
thing. Each edition now gets its own front door.

- `fable/` was lifted out with `git subtree split`, so the almanac carries its
  own seven commits into the new repo rather than starting from a squashed
  import. Its history is intact and attributable.
- This repo keeps the name, the tags (v1.0 through v6.1) and the whole record
  of the planner's development — which is what most of that history always was.
- The almanac's ten screenshots moved with it; the planner keeps its own
  thirty-six.
- `deploy.sh` no longer stages `fable/`, and now copies `planner-hero.png` in
  as the link-preview image.
- The two editions still point at each other, but by absolute URL now that they
  are hosted separately: the almanac link in the header and the mobile drawer
  goes to <https://gardensync-almanac.pages.dev>.
- Open Graph and Twitter card tags added, so sharing the planner's link no
  longer previews as a blank rectangle.
- README and project page rewritten for the planner alone.

Nothing about the running planner changed. This is a repository and packaging
change only.

---

## v6.1 — 2026-07-26

Polish pass on A Quiet Almanac ahead of republishing.

### Ask the almanac now answers for everyone

The chat only worked where a proxy was running, which was nowhere on the public
build — every visitor who asked a question got *"The almanac is resting"*. It now
falls back to its own reading of the plant library and the garden in front of it:

- Answers sowing calendars, companions and quarrels, container suitability, sun
  and water, spacing, what is ready to pick on the date being viewed, the
  season's projected yield, and what wants doing this week.
- The proxy is tried once. If nothing answers it stops asking, and every later
  question is instant and local — measured at 3ms, no network.
- Where a key *is* configured, the fuller model still answers as before.

Two matching bugs, both caught by testing rather than reading:

- *"keep away from potatoes"* matched the **container** branch, because `" pot"`
  is a substring of `" potatoes"`. Word boundaries now.
- *"how much will I harvest"* hit the what-is-ripe branch ahead of the yield
  branch. Weight questions are caught first.

### Garlic grows the right way round

Garlic was scheduled as a spring crop. All three of its sowing fields are `null`,
which the spring maths reads as *plant at last frost* — landing the harvest on
**Dec 14**, for a crop whose own notes say plant October, harvest July.

Fall-sown crops now have their own window that wraps the turn of the year: in the
ground Oct 10, growing through winter, harvest Jul 12–26, resting Aug–Sep. The
year strip draws it as two bars, the calendar gained the missing *"plant for next
summer"* entry, and spring crops are untouched.

### Keyboard

The garden is navigable without a pointer. Each plot is a single tab stop; arrows
walk its plants in reading order, Home and End jump to the ends, and Delete
already worked on the selection, which closes the loop. Focus survives the
re-render. Focus-visible outlines throughout, and the hover-only note and delete
buttons reveal on focus too.

### Link previews

Open Graph and Twitter card tags with a canonical URL and theme colour.
`deploy.sh` copies the hero screenshot in as the card image at publish time, so
the 780KB PNG stays out of the app folder.

*Verified in the browser: 11 question shapes answered correctly, garlic staged
correctly at nine points across the year, tomato unaffected, keyboard walk and
focus retention, no console errors, no horizontal overflow, no NaN in any SVG
attribute.*

---

## v6.0 — 2026-07-26

First public release. Both editions are live at
<https://gardensync-e4e.pages.dev> — the planner at `/`, A Quiet Almanac at
`/fable/`.

### Layout bugs found in a live audit

- **Dropdown menus rendered permanently over the canvas.** `display: none` and
  all the popup chrome (background, border, shadow, z-index) had been written
  inside the `#container-menu .menu-popup` override instead of the base
  `.menu-popup` rule, so the FILE menu was unstyled and always open. Moved the
  shared styling to the base rule; only alignment stays in the override.
- **Every plant name in the library rendered at 0px wide.** `.plant-name` had
  `flex: 1` (basis 0) while the season badge was `flex-shrink: 0`, so in a 187px
  palette the name lost the squeeze and collapsed entirely — the library showed
  emoji and badges only. The row now wraps, the name has a `min-width` floor, and
  badges drop to a second line.
- **TEMPLATE, ADD and FILL ROW were clipped mid-word** in the bed sidebar
  (`TEMPLATE` → `TEMPLAT`). Those button rows now wrap instead of overflowing.
- **The garden was squeezed into 240px on phones.** The sidebar and palette
  resize handles wrote an inline `grid-template-columns` at startup, which
  outranks the mobile media query that collapses the layout to one column,
  leaving a phantom 240px palette track. Grid writes now go through a
  breakpoint-aware helper, and a `matchMedia` listener reconciles the track when
  crossing 900px in either direction.

### Polish

- First visit loads the **Easy Start** plan instead of four empty beds.
  `FILE ▸ NEW GARDEN` still clears to a blank slate.
- Demo gardens ship as a single tall column of beds, which zoom-to-fit shrank to
  ~48% with dead space either side. They are now re-flowed into a grid on load —
  all eleven demos, not just the first-run one.
- The two editions link to each other: an `ALMANAC ↗` chip in the planner header
  (in the nav drawer on phones) and a `Planner ↗` button in the almanac masthead.
- Added a favicon, description and theme-colour to the planner; the missing
  favicon was a 404 on every load.

### AI

- Garden Buddy moved from Claude Sonnet 4 (deprecated, retires 2026-06-15) to
  **Claude Sonnet 5**. Sonnet 5 runs adaptive thinking by default and `max_tokens`
  covers thinking plus reply, so the budget went 1024 → 4096 at `effort: medium`.
  Thinking stays on deliberately — with it disabled Sonnet 5 reaches for tools
  noticeably less, and this assistant is tool-driven.
- Ask the almanac moved from Claude Sonnet 4.6 to **Claude Sonnet 5** with
  thinking disabled and `effort: low` — the answers are three warm sentences and
  there are no tools to trigger. Response parsing now walks all text blocks
  rather than assuming `content[0]`.

### Deployment

- `deploy.sh` stages a clean `dist/` (1.1 MB, 44 files) and publishes to
  Cloudflare Pages, deliberately leaving behind the pre-refactor monolith,
  personal garden JSON, screenshots and `node_modules`.
- Ships a `_headers` file with `nosniff`, `Referrer-Policy`, `X-Frame-Options`
  and a `Permissions-Policy` that denies geolocation, mic and camera.
- Ships an empty `supabase-config.js` stand-in so the script tag resolves instead
  of falling through to the 404 page, which the browser then rejected on MIME
  grounds. Console is clean on load.

### Known gap

- Almanac chat is inert on the hosted site until a Pages Function exists at
  `functions/api/claude/[[path]].js`. Everything else works without it.
  *(Resolved in v6.1 — the chat now answers locally, so no Function is needed.)*

---

## A Quiet Almanac — the rebuild — 2026-06-10

A second edition of the same garden, written from scratch rather than restyled.
Four self-contained files in `fable/`, sharing no code with the original planner —
only the agronomy: 77 plants, companions, Zone 6a windows, carried over from
`js/constants.js`.

### The idea

Where the planner shouts, this edition breathes. Warm paper, botanical ink, and a
year you scrub through rather than a calendar you read.

- **The season ribbon.** The whole year sits at the top of the page. Drag the pin
  to any date and the garden re-renders as the almanac imagines it then: dashed
  ghosts before sowing, small sprouts, full plants, gold harvest rings, sepia
  spent crops. Frost dates marked; today pinned in clay red.
- **Companion halos, not error lines.** Pick up a seed packet and every planted
  friend glows moss green, every foe blushes terracotta — guidance *before* you
  commit, instead of alarms after.
- **Bed moods.** Each bed reports how its plants get along: *thriving*,
  *content*, or *uneasy — 2 quarrels*.
- **The almanac panel.** Context-sensitive: the garden's week at a glance, or a
  full plant page with a year-strip timeline, the companions actually present in
  your garden, and care notes.
- **Square-foot honest.** Footprints derive from real spacing — 16 carrots per
  square, one tomato per 2×2 ft.

### Expansion 1 — the potting shed

Containers beyond raised beds: terracotta pots, deep tree pots, whisky half
barrels, fabric grow bags, window boxes and steel troughs, each drawn with its own
chrome. Container rules apply — everything fits one square, and sprawlers like
squash get a gentle warning that they'll sulk. Plus the harvest outlook with the
500 lb goal, the printable year calendar, field notes and caretakers per plot,
frost watch, redo, and the help overlay.

### Expansion 2 — sharing

Share links that fold the whole garden into a compact URL hash, a PNG garden
poster, succession sowing reminders, and a first-visit hint pointing at the pin.

### Expansion 3 — refinement

A ready-to-pick line for the viewed date, seed-drawer inventory dots, rAF-throttled
ribbon scrubbing, reduced-motion support, and ARIA dialog roles.

### Expansion 4 — harvest logging

Log picks per plant, a picked-versus-projected goal bar, season tallies, all
persisted and included in export/import.

---

## v5.4 — 2026-03-08

### QA Sweep (full pass — zero errors)
- All 6 tabs tested: Bed Planner, Grow Schedule, Harvest, Volunteers, Climate Data, Visualize
- Mobile responsive across all tabs (375px)
- Light/dark theme rendering verified
- Console audit: zero errors, zero warnings across all tab transitions
- Network audit: zero failed requests

### Spacing Warnings Overhaul
- Rewrote algorithm: nearest-neighbor only, 65% threshold, pair deduplication
- Reduced from dozens of false positives to ~4 meaningful warnings
- Fixed CSS `pointer-events: none` → `pointer-events: auto; cursor: help` (tooltips now work)
- Tooltip format: "Plant A ↔ Plant B: X" apart, need Y""

### Context Menu Fix
- Replaced 20-item "MOVE TO:" overflow list with single "Move to..." button
- Added scrollable move picker modal (centered overlay, click-outside-to-close)
- Moved Remove to bottom with red danger styling and divider

### Rainfall Deficit Calculator
- Replaced rain barrel calculator with rainfall deficit analysis
- Shows monthly deficit/surplus bars, season balance, total garden area
- Advisory messages based on deficit severity
- Auto-updates via `gardenStateChanged` event from `saveState()`

### Planting Log Removal
- Removed Planting Log tab from desktop and mobile navigation
- Removed `calendar.js` and `planting-log.js` script references
- Utility functions (`getWeekKey`, etc.) preserved in `persistence.js`

### Garden Buddy Enhancements (Plan: glimmering-dazzling-tower)
- **Enhanced system prompt**: container matching by name/type, multi-step operation guidance, plant ID resolution hints, image handling instructions
- **Image upload UI**: + button next to chat input, file picker, thumbnail preview with remove, base64 encoding in Claude API calls
- **`remove_plants` tool**: targeted removal by plant type (vs `clear_bed` which removes all)

### Demo Garden
- Integrated user's actual garden layout as the demo (71 plants, 20 containers)
- `autoOrganizeBed()` called on demo load for clean layouts

### Other Fixes
- Arrow key nudge reduced to 4px/1px (from 20px/4px)
- Zoom-compensated companion line strokes
- Blueberry added to PLANT_LIBRARY
- Cache bumped to v5.4 for styles.css, placement.js; v5.3 for persistence.js
