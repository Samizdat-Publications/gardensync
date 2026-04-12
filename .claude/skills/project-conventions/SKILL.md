---
name: project-conventions
description: GardenSync coding conventions, architecture patterns, and technology constraints. Auto-loaded by Claude to ensure suggestions match the project's vanilla JS, no-bundler, canvas-based architecture.
user-invocable: false
---

# GardenSync Project Conventions

## Hard Rules — NEVER suggest these
- No npm, webpack, vite, rollup, parcel, or any bundler
- No React, Vue, Angular, Svelte, or any framework
- No TypeScript — vanilla JavaScript only
- No Chart.js, D3, or charting libraries — canvas-drawn charts only
- No Jest, Mocha, or test runners — browser HTML test harness only
- No CSS frameworks (Tailwind, Bootstrap) — custom CSS with variables
- No ES modules (`import`/`export`) — globals via `<script>` tags

## Architecture
- ~30 JS modules loaded as `<script>` tags in `index.html` (order matters)
- Modules communicate through a shared global `state` object
- All rendering uses `<canvas>` — beds, charts, stats
- State persisted to `localStorage` with IndexedDB backup
- Undo/redo via `pushUndo()` / `pushRedo()` stack pattern
- 20px grid cells for Square Foot Gardening alignment

## When adding new modules
1. Create `js/new-module.js`
2. Add `<script src="js/new-module.js"></script>` to `index.html` (after dependencies)
3. Expose functions on `window` — no module system
4. Use `state` object for shared data
5. Call `saveState()` after mutations

## Styling
- CSS custom properties in `:root` for theming (dark/light)
- Fonts: Anton (display), Space Mono (mono), Barlow Condensed (body)
- Anarchist-punk aesthetic — emerald/teal accents, bold typography
- Always use `escapeHtml()` when inserting user data via innerHTML

## Testing
- `tests/test-pure-logic.html` — unit tests using `suite()` / `assert()`
- `tests/test-integration.html` — DOM/canvas integration tests
- Open in browser to run — no CLI test runner

## AI Integration
- Garden Buddy uses Claude Sonnet 4 via direct API or proxy.py
- Tool-based architecture with `place_plant`, `clear_bed`, etc.
- API keys stored in localStorage (medium security concern — acknowledged)
- Proxy at `proxy.py` handles CORS, binds to localhost only
