# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GardenSync** — A community garden bed planner for Food Not Bombs Canton, OH. Interactive
drag-and-drop planner with companion planting, an AI chat assistant, harvest tracking, volunteer
management, and season-aware scheduling for Zone 6a. The harvest feeds neighbours, so the plant
data and the schedule maths are the parts most worth getting right.

Live: <https://gardensync-e4e.pages.dev>

There is a sibling edition, *A Quiet Almanac* — a calm paper-and-ink rebuild of the same idea that
shares no code with this app. It used to live in `fable/` here; it now has its own repo at
<https://github.com/Samizdat-Publications/gardensync-almanac> (live at
<https://gardensync-almanac.pages.dev>). The two apps cross-link in their headers
(`.edition-link` in `index.html`), and the plant research in `js/constants.js` is the shared
ancestor of both plant libraries. Nothing else is shared: changes here do not propagate there.

## How to Run

### Development server
```bash
python proxy.py
# Serves this app on http://localhost:8080
```
The proxy serves the static files from the repo root and forwards `/api/gemini/*` and
`/api/claude/*`, passing along whatever `x-api-key` / `x-goog-api-key` header the browser sends.
It holds no key of its own and never reads `.env` — its only mention of that file is in
`BLOCKED_PATHS`, so `.env` is never served as a static file. Of the app modules only
`js/visualizer.js` uses the proxy, for Gemini; Garden Buddy calls Anthropic directly from the page
and works with or without the proxy running.

### Deploy
```bash
./deploy.sh            # stage dist/ and publish to Cloudflare Pages
./deploy.sh --stage    # stage only
```
`deploy.sh` copies `index.html`, `styles.css`, `guide.html`, `js/`, a preview image, and a
`_headers` file into a fresh `dist/`. Never edit `dist/` — it is rebuilt every run — and never
deploy the repo root, which holds the pre-refactor monolith, personal garden JSON, screenshots
and notes. The script also writes an empty `js/supabase-config.js` stub into `dist/`, because the
real file is gitignored and a missing `<script src>` would fall through to the 404 page and be
rejected for its MIME type.

### Tests
Open in a browser (there is no test runner):
- `tests/test-pure-logic.html` — unit tests for pure logic functions
- `tests/test-integration.html` — integration tests

## Architecture

### Modular JS (`js/` directory)
The app was split from a monolith (`_OLD_monolithic_app.js`) into 33 modules loaded via plain
`<script>` tags in `index.html`. There is no bundler — modules communicate through a shared global
`state` object and functions declared at global scope.

**Load order matters.** The script tags are ordered by dependency (`constants.js` and `state.js`
first, `init.js` last), and `js/init.js` runs every `init*()` in a fixed sequence on
`DOMContentLoaded`, each wrapped in its own try/catch so one failure does not take down the rest.
Adding a module means adding both a `<script>` tag and (usually) an entry in that list.

Key modules:
| Module | Responsibility |
|--------|---------------|
| `constants.js` | `PLANT_LIBRARY` (77 plants), `CONTAINER_TYPES` (7 kinds), Zone 6a climate data, Canton frost dates, demo gardens, `GRID_CELL_PX = 20`, `CANVAS_PX_PER_FOOT = 40` |
| `state.js` | Global `state` object, undo/redo stacks, `escapeHtml()`, container geometry helpers |
| `containers.js` | Renders a container as a `.garden-bed` DOM element; add/remove/resize |
| `placement.js` | Click-to-place mechanics, 20px grid snapping, spacing validation, companion line drawing |
| `selection.js` | Plant selection, multi-select, drag |
| `canvas.js` | The pan/zoom garden surface, sidebar & palette resizing, layout breakpoint sync |
| `palette.js` / `shelf.js` / `sidebar.js` | Plant palette, container shelf, right-hand detail sidebar (`BED_TEMPLATES`, the 7 bed layouts, is defined here) |
| `templates.js` | The bed-template dropdown UI (the template data itself lives in `sidebar.js`) |
| `garden-buddy.js` | Claude Sonnet 5 chat with tool use |
| `custom-seeds.js` | User-added seeds with OCR photo scanning |
| `persistence.js` | localStorage save/load, default garden, planting-log helpers, Supabase hooks |
| `supabase-sync.js` | Cloud persistence via Supabase (auto-save, 5-min interval, page unload) |
| `supabase-config.js` | Supabase credentials — gitignored; copy `supabase-config.example.js` |
| `data-io.js` | JSON export/import, URL-based sharing (base64), `DEMO_REGISTRY` (11 demo gardens) |
| `export.js` | `exportPNG()` — the PNG snapshot of the garden |
| `harvest.js` / `volunteers.js` / `schedule.js` | The harvest, crew and grow-schedule workspaces |
| `weather.js` | Live weather from Open-Meteo |
| `climate.js` | Climate charts, drawn on `<canvas>` (no Chart.js) |
| `organize.js` | Square Foot Gardening auto-arrangement |
| `init.js` | The init sequence described above |

`js/calendar.js` and `js/planting-log.js` are **not** loaded by `index.html` — the planting-log
helpers were folded into `persistence.js`. Leave them alone or delete them; do not wire them back
in without checking for duplicate definitions.

### State Management
- Global `state` object; the garden lives in `state.containers[]` (not `beds` — that name survives
  in `data-io.js` as an import shim for old save files, and as the key Garden Buddy's
  `get_garden_state` tool hands back to the model in `garden-buddy.js`)
- Each container: `{id, type, name, canvasX, canvasY, w, h, diameter, plants: [], notes, volunteer}`
  where `type` is a key of `CONTAINER_TYPES` and circular kinds use `diameter` instead of `w`/`h`
- Each placement inside `plants[]`: `{id, plantId, x, y}` — `x`/`y` are pixels within the container
  element, snapped to the 20px grid
- A first genuine visit — no localStorage, no backup, no share link — opens on the
  `DEMO_FNB_EASY_START` plan via `seedFirstRunGarden()` in `persistence.js`, so nobody meets an
  empty screen. `createDefaultGarden()` (four 5'×10' raised beds) is the FILE > NEW GARDEN path and
  the fallback when seeding throws.
- `localStorage` for persistence + optional Supabase cloud backup (stewops-dashboard project)
- Undo/redo via the `pushUndo()` / `undo()` / `redo()` stack pattern in `state.js`
- Garden Buddy conversation history in localStorage; garden ID (UUID) in localStorage keys cloud sync

### Rendering
- Beds and containers are **DOM elements**, not canvas: an absolutely-positioned `div.garden-bed`
  inside `#garden-canvas`, with one `div.placed-plant` per placement. `#garden-canvas` is a panned
  and zoomed `div`, not a `<canvas>`.
- Companion/enemy connection lines are an **SVG overlay** (`.companion-svg`) built with
  `createElementNS` in `placement.js` and redrawn on every render and during drags
- Real `<canvas>` is used in three places only: the climate charts (`climate.js`), the PNG snapshot
  export (`export.js`), and image preprocessing for seed-packet OCR (`custom-seeds.js`)
- 20px grid cells for Square Foot Gardening alignment; 40px per foot for container dimensions

### Layout gotcha — inline grid tracks vs. the mobile breakpoint
`initSidebarResize()` / `initPaletteResize()` in `canvas.js` write an inline
`grid-template-columns` on `.planner-layout`. Inline styles outrank the
`max-width: 900px` media query that collapses the planner to one column, so all
grid writes must go through `_setLayoutColumns()`, and `initLayoutBreakpointSync()`
must run after both resize inits. Writing that property directly will squeeze the
garden viewport on phones.

### AI Integration (Garden Buddy)
- Uses Claude Sonnet 5, called straight from the browser at `https://api.anthropic.com/v1/messages`
  with the `anthropic-dangerous-direct-browser-access` header. Nothing in `js/` routes Claude
  through the proxy.
- Tool-based: `place_plant`, `clear_bed`, `apply_template`, `get_garden_state`, `get_plant_info`,
  `list_plants`, `rename_bed`, `organize_bed`, `get_schedule_advice`, `remove_plants`
- System prompt includes the current garden state, frost dates and location
- The key is pasted into the chat panel's own field and kept at
  `localStorage['gardensync_claude_key']`; `custom-seeds.js` reads the same key for seed-packet OCR.
  There is no `.env` path for it.

## Coding Conventions

- **No build tools.** Vanilla HTML/CSS/JS. No webpack, vite, npm, bundlers.
- **No framework.** Plain DOM manipulation, no React/Vue/Angular.
- **Modules via script tags** — each `js/*.js` file is a separate `<script>` in `index.html`,
  with a `?v=` cache-buster; bump it when you change a file that users have already loaded
- **DOM for the garden, SVG for lines, canvas for charts and exports** — see Rendering above
- **Escape everything dynamic** — `escapeHtml()` from `state.js` before any string reaches
  `innerHTML`; plant and container names are user input
- **CSS custom properties** — `:root` variables for theming (dark/light modes)
- **Fonts:** Anton (display), Space Mono (mono), Barlow Condensed (body) — Google Fonts CDN
- **Anarchist-punk aesthetic** — emerald/teal on black, bold typography. The mission is real;
  the styling is loud, the copy is not.

## External APIs

- **Open-Meteo** — weather data (no key required)
- **Anthropic Claude** — Garden Buddy chat and seed-packet OCR; key pasted into the in-app field and
  stored at `localStorage['gardensync_claude_key']`
- **Google Gemini** — optional AI features in `visualizer.js`, through the proxy with the key from
  `localStorage['gardensync_gemini_key']` sent as `x-goog-api-key`
- **Supabase** — optional cloud sync; absent config quietly disables it
