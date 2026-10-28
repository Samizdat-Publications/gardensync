# Contributing to GardenSync

Thank you for helping. The most useful contributions are usually not code: a planting date that is
wrong for your area, a crop that is missing, or a companion claim that does not hold up. Open an
issue with what you saw, where you garden, and a source if you have one.

## Getting set up

You need Node 22 or later.

```bash
npm install
npm run dev     # http://localhost:5173
npm run check   # the full gate; it must print ALL GREEN before a pull request
```

`npm run check` runs the typecheck, the unit tests in two time zones (New York and Melbourne, to
catch date bugs), the production build, the bundle size budget and the Playwright end-to-end tests.
`npm run check -- --quick` runs the end-to-end tests in Chromium only.

## How the code is laid out

- `src/domain/` is pure TypeScript: no DOM, no network, no `Date` arithmetic. Dates are integer day
  numbers and ISO strings; lengths are centimetres. Everything here has unit tests in `tests/unit/`.
- `src/platform/` is the only code that touches storage, the network or the canvas.
- `src/ui/` is Preact. State is one immutable garden document; the only way to change it is
  `dispatch(op)` with an op from `src/domain/doc/ops.ts`. Selection, zoom and the day on view are
  separate signals and are never saved.

A few rules the tests and review hold to:

- Never put user or model text into `innerHTML` or `dangerouslySetInnerHTML`.
- Everything read from storage, a file, a share link or the assistant goes through the schema in
  `src/domain/doc/schema.ts`.
- The assistant key never goes into exports, share links or logs.
- No em dashes in anything a person reads (interface text, docs, commit messages).
- US English in the interface; metric and imperial are both first class.

## Adding or fixing a plant

Each plant is one JSON file in `src/domain/plants/library/`, checked by the schema in
`src/domain/plants/schema.ts` and by the lint tests in `tests/unit/plant-library.test.ts`.

- **Every number needs a source.** Give at least one university extension service or RHS page in
  `sources`, two where they exist, and prefer the source that publishes the number you used. Where
  sources disagree, use the more cautious figure and say so in the pull request.
- **Timing is relative.** Sowing and planting offsets are weeks before or after the last frost, as
  extension guides publish them. Care notes never contain absolute dates or place names (the lint
  test checks): the app works out dates for each gardener's own climate.
- **Temperatures and lengths in notes** use the placeholders already in the files, `{c:21}` for
  degrees Celsius and `{cm:0.6}` for centimetres, so the app can show them in the gardener's units.
- **Spacing is square-foot spacing:** `density` is plants per square (1, 4, 9 or 16) or squares per
  plant.

Then run `npm test` and look at the plant's card in the app (`npm run dev`, then Plants).

## Companion planting

Pairs live in `src/domain/plants/companions.json`, one entry per pair, with a reason and an
`evidence` field: `tested` when trials or extension guidance back it, `traditional` when it is
garden lore. If you cannot find support for a claim either way, leave it out. Folklore presented as
fact is the one thing this file must not contain.

## Schedule changes

The schedule maths is specified in `docs/v8/SCHEDULE_SPEC.md` and pinned by readable golden files in
`tests/unit/__goldens__/`. If your change moves dates, the goldens will fail. Check the new dates
against extension guidance for the places in the goldens, then update them with
`npx vitest run -u` and explain the change in the pull request.

## Pull requests

Keep them small and focused, include tests for behavior changes, and paste the `npm run check`
result. Screenshots help for anything visible (`npm run shots` writes every screen to
`review/shots/`).
