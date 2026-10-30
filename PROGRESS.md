# GardenSync 8.0 progress

The approved plan is [docs/v8/PLAN.md](docs/v8/PLAN.md). Decisions: [docs/v8/DECISIONS.md](docs/v8/DECISIONS.md).
Things only Stewart can do: [docs/v8/NEEDS_STEWART.md](docs/v8/NEEDS_STEWART.md).

## Current phase

**8.0 released (2026-10-28).** Live at https://gardensync-e4e.pages.dev; landing page at
https://gardensync-landing.pages.dev; public repo https://github.com/Samizdat-Publications/gardensync
(clean history from one 8.0 commit, release v8.0.0, topics set, CI green, publish-check clean). The
old history is the private `gardensync-v7-archive` (local remote `archive`, branch `v8`) plus a
verified bundle in `C:\Users\stewa\Documents\Claude\_archives\`. Work continues on `master`
(remote `origin`). Hub media proposal: `C:\Users\stewa\Documents\Claude\Github Hub\proposals\gardensync.md`;
showcase.json already points at the hub cut.

**8.1 released (2026-10-30): planting, rethought.** Merged to `master` (3210be2), tag v8.1.0,
GitHub release, live app and landing page deployed. Drag and drop from the list, drop to plant,
paint patches, move any planting, a clash card with ways out, the plan showing the bed-in day while
placing. Design: docs/v8/PLANTING_UX.md; ledger 84 to 93. Next: 8.1.x polish from ledger 91
(corner resize handles) and 93.

## Done

- 2026-10-30: Planting rethought (ledger 84 to 93): two usability passes, all P1s fixed, e2e tests
  for each. Released as 8.1 the same day after Stewart tried the preview; `npm run check` ALL GREEN.

- 2026-10-28: Plan approved. Decisions D-U01 to D-U04 recorded.
- 2026-10-28: Tag `v7-final` on the last 7.x commit (`8d3f563`). Branch `v8` created. Old app removed
  from the tree (46 files; recover any of them with `git show v7-final:<path>`).
- 2026-10-28: Scaffold: Vite 8, TypeScript 7 (strict), Preact 11 + signals, Vitest 5, Playwright 1.64
  with axe. `npm run check` prints ALL GREEN or FAILED. CI workflow runs the same check.

- 2026-10-28: New CLAUDE.md, project-conventions skill and security-reviewer agent for the new stack;
  gen-test skill retired; launch config runs `npm run dev`; the prompt-type edit hook replaced by a
  command hook (`.claude/hooks/block-secrets.mjs`, tested: blocks `.env` and real key formats).
- 2026-10-28: Preview deploy works: https://v8.gardensync-e4e.pages.dev (with CSP and security headers).
  Firefox e2e is CI-only on this PC (D-A09). `npm run check` ALL GREEN.

- 2026-10-28: Domain contracts (dates, plant record, climate profile, garden document).
- 2026-10-28: Climate module: frost seasons midsummer to midsummer, fixtures for 6 places, Canton
  exact against the planning numbers. Plant library: 42 of 63 crops researched and committed
  (batches 1 and 3); batch 2 (greens, brassicas, roots, alliums) in progress.
- 2026-10-28: Claude Design canvas built: https://claude.ai/artifact/5SYt7e5bGaegsR7ycEHbvZ
  (three directions plus 12 screens in direction A "Plot", glyphs and tokens). Blind critic running.
- 2026-10-28: Plant library complete: 63 crops. Blind design critic: direction A strongest; P0s fixed on
  the canvas, the rest ledgered (review/LEDGER.md 2 to 20). Checkpoint 1 gate written.
- 2026-10-28: Builders started on units, plant inheritance, layout, edit ops, 7.x import, share codec.

- 2026-10-28: Domain core complete: units, plant inheritance, layout (patches, vessels, occupancy,
  rotation), edit ops, 7.x import, share links, storage (revisions, backups, quarantine), app store
  with undo, 53 companion pairs, and the schedule maths with goldens for six places checked
  against extension guidance (Canton tomatoes out May 17; Ohio State says about May 20).
  `npm run check` ALL GREEN, 528 unit tests.

- 2026-10-28: Checkpoint 1 passed: Stewart chose direction A, Plot (D-U05).
- 2026-10-28: Screens built and committed: app shell and header, first run, settings with your
  climate, This week with the frost watch, year calendar, harvest log, plant library and card, share
  links, installable and offline. Each with e2e and axe.
- 2026-10-28: Assistant (bring your own Anthropic key, D-A11 to D-A13): tools validated with valibot,
  edits proposed on a draft and applied as one undo step, photo of a seed packet into a custom
  variety, SDK loaded only when opened. 11 unit tests; e2e with a mocked event stream passes in
  Chromium and the phone profile. Several gardens (D-A14), "Use my location" (ledger 38), new
  README and CONTRIBUTING. UNVERIFIED as a whole until the full `npm run check` after the planner.

- 2026-10-28: Planner, assistant, several gardens and use-my-location committed. Live-preview
  testing in Melbourne found starter gardens dated in the past, late plantings pushed a year,
  units ignored in reasons: fixed with tests (ledger 52 to 55). Blind design critic: all P0s and
  most P1s fixed (ledger 56 to 72), including a class-name clash between planner and calendar,
  now guarded by a lint test. `npm run check` ALL GREEN at 8648268. Preview redeployed; CP2 gate
  written.

## Next (exact)

1. While Stewart reviews: print poster and PNG picture of the garden from the planner SVG
   (src/platform/png.ts is written; add the buttons in the planner and a print stylesheet).
2. Then Phase 5 from review/LEDGER.md DEFER items (63, 68 to 70), keyboard and touch passes,
   performance, Lighthouse on the preview.
3. Fold in Stewart's CP2 notes from docs/STEWART_FEEDBACK.md as soon as they arrive; they come first.
