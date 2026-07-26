# GardenSync Changelog

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

- First visit loads the **FNB Easy Start** plan instead of four empty beds.
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
