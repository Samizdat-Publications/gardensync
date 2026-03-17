# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GardenSync** — A community garden bed planner for Food Not Bombs Canton, OH. Interactive drag-and-drop planner with companion planting, AI chat assistant, harvest tracking, volunteer management, and season-aware scheduling for Zone 6a.

## How to Run

### Development server
```bash
python3 proxy.py
# Opens http://localhost:8080
```
The proxy server serves static files and proxies `/api/gemini/*` and `/api/claude/*` for the AI features (Garden Buddy chat).

### Tests
Open in browser (no test runner):
- `tests/test-pure-logic.html` — Unit tests for pure logic functions
- `tests/test-integration.html` — Integration tests

## Architecture

### Modular JS (`js/` directory)
The app was split from a monolith (`_OLD_monolithic_app.js`) into ~30 modules loaded via `<script>` tags in `index.html`. There is no bundler — modules communicate through a shared global `state` object and exported functions on `window`.

Key modules:
| Module | Responsibility |
|--------|---------------|
| `state.js` | Global state object, undo/redo stacks |
| `constants.js` | Plant library (37 plants), Zone 6a climate data, Canton frost dates |
| `placement.js` | Click-to-place mechanics, 20px grid snapping, spacing validation |
| `selection.js` | Plant selection, multi-select, drag |
| `canvas.js` | Canvas-based bed rendering, companion lines |
| `garden-buddy.js` | Claude Sonnet 4 AI chat with tool use (place_plant, clear_bed, organize_bed, etc.) |
| `templates.js` | 7 pre-made bed layouts |
| `custom-seeds.js` | User-added seeds with OCR photo scanning |
| `persistence.js` | localStorage save/load for garden state |
| `data-io.js` | JSON export/import, URL-based sharing (base64), PNG snapshots |
| `weather.js` | Live weather from Open-Meteo API |
| `climate.js` | Canvas-drawn climate charts (no Chart.js) |
| `organize.js` | Square Foot Gardening auto-arrangement |

### State Management
- Global `state` object with `beds[]` array (4 garden beds, 5'x10' each)
- Each bed: `{id, name, width, height, plants: [{id, plantId, x, y}]}`
- `localStorage` for persistence — no backend database
- Undo/redo via `pushUndo()`/`pushRedo()` stack pattern
- Garden Buddy conversation history in localStorage

### Rendering
- All bed visualizations drawn on `<canvas>` elements
- Charts (climate, stats) also canvas-based — no D3 or Chart.js
- 20px grid cells for Square Foot Gardening alignment
- Companion/enemy plant connection lines drawn on canvas overlay

### AI Integration (Garden Buddy)
- Uses Claude Sonnet 4 via `proxy.py` CORS proxy
- Tool-based: `place_plant`, `clear_bed`, `apply_template`, `get_garden_state`, `get_plant_info`, `list_plants`, `rename_bed`, `organize_bed`, `get_schedule_advice`
- System prompt includes current garden state, frost dates, location
- API keys via `.env` file or request headers

## Coding Conventions

- **No build tools.** Vanilla HTML/CSS/JS. No webpack, vite, npm, bundlers.
- **No framework.** Plain DOM manipulation, no React/Vue/Angular.
- **Modules via script tags** — each `js/*.js` file is a separate `<script>` in `index.html`
- **Canvas for rendering** — beds and charts drawn programmatically, not SVG or DOM
- **CSS custom properties** — `:root` variables for theming (dark/light modes)
- **Fonts:** Anton (display), Space Mono (mono), Barlow Condensed (body) — Google Fonts CDN
- **Anarchist-punk aesthetic** — emerald/teal accents, bold typography

## External APIs

- **Open-Meteo** — Weather data (no key required)
- **Anthropic Claude** — Garden Buddy AI chat (key via `.env` or header)
- **Google Gemini** — Optional AI features (key via `.env` or header)
