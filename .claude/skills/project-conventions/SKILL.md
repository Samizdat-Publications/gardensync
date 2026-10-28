---
name: project-conventions
description: GardenSync 8 coding conventions, architecture boundaries and technology choices. Auto-loaded so suggestions match the project's Vite + TypeScript + Preact stack, pure domain layer, op-based state and testing rules.
user-invocable: false
---

# GardenSync 8 conventions

## Stack (do not swap)
- Vite 8, TypeScript 7 in strict mode (`noUncheckedIndexedAccess` on), Preact 11 + `@preact/signals`.
- valibot for every schema that validates outside data; immer to produce new documents.
- No React, no CSS framework, no date library, no chart library, no state library beyond signals.
- Vitest for unit tests, Playwright + axe for end-to-end and accessibility.

## Layers
- `src/domain/` is pure: no DOM, no `window`, no `fetch`, no `localStorage`, no `Date.now()` inside
  logic (pass "today" in). It must run in Node under Vitest.
- `src/platform/` wraps storage, network and canvas. UI code calls platform, never the browser APIs
  directly for those things.
- `src/ui/` renders and dispatches. Components do not mutate the document.

## State
- The garden document changes only through `dispatch(op)`. Add a new kind of edit by adding an `Op`
  variant and its case in `applyOp`, with a unit test.
- Drags and other continuous gestures update a preview signal and commit one op when they end.
- UI state (selection, zoom, viewed date, open panels) is separate from the document and never undone.

## Data and dates
- Dates are integer day numbers or ISO `YYYY-MM-DD` strings. Never add or subtract on `Date` objects.
- Geometry in centimetres; units are a display concern.
- Plant records are validated by `src/domain/plants/schema.ts`; the lint test requires sources and
  forbids absolute dates and place names in notes.

## UI
- Text goes through JSX so Preact escapes it. Never `dangerouslySetInnerHTML` with user or model text.
- Design tokens are CSS custom properties in `src/ui/styles/tokens.css`; components use tokens,
  never raw colours. Light and dark both, reduced motion respected.
- Real `<button>`, `<a href>`, `<input>` with `<label>`; icon-only buttons get `aria-label`;
  touch targets at least 44 px.
- Plant icons are generated glyphs, never emoji.

## Tests
- Domain changes come with unit tests in `tests/unit/`. Schedule and climate behaviour is pinned by
  readable golden snapshots; update a golden only after checking it against extension guidance.
- New screens get an entry in `tests/e2e/shots.spec.ts` and an axe check.
- `npm run check` must print ALL GREEN before anything is called done.
