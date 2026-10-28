# CLAUDE.md

Guidance for Claude Code in this repository.

## What this is

**GardenSync 8**: a garden bed planner for home gardeners anywhere. Draw beds and containers, place
plants into the squares, and get a sowing, planting and harvest schedule worked out from 30 years of
weather for the gardener's own town. Local-first: no accounts, no backend. An optional assistant uses
the gardener's own Anthropic key.

Version 8 is a ground-up rebuild (branch `v8`). The old 7.x app (vanilla JS, built for one community
garden in Canton, Ohio) lives at tag `v7-final`; read any old file with `git show v7-final:<path>`.

**Read first, every session:** `HANDOFF.md`, `PROGRESS.md`, `docs/v8/PLAN.md` (the approved plan),
`docs/STEWART_FEEDBACK.md` (outranks any critic), `review/LEDGER.md`, `docs/v8/DECISIONS.md`.

The sibling edition, *A Quiet Almanac*, is a separate repo (`Samizdat-Publications/gardensync-almanac`)
and shares no code. Never change it from here.

## Commands

```bash
npm run dev            # Vite dev server, http://localhost:5173
npm run check          # THE gate: typecheck, unit (two time zones), build, bundle budget, e2e. ALL GREEN or FAILED
npm run check -- --quick   # same, e2e in Chromium only
npm test               # unit tests only (Vitest)
npm run e2e            # Playwright end-to-end against the production build
npm run shots          # screenshots of every screen into review/shots/ (phone, tablet, desktop; light, dark)
npm run deploy:preview # build and deploy branch preview to https://v8.gardensync-e4e.pages.dev
npm run deploy:production # the live app, at release only
```

Firefox end-to-end runs only in CI (Playwright's Firefox will not start on Stewart's Windows build);
locally the check runs Chromium, WebKit and a phone profile.

## Architecture

- **Stack:** Vite 8, TypeScript 7 strict, Preact 11 with `@preact/signals`, valibot for validating
  saved and imported data, immer for producing new documents. No CSS framework, no date library, no
  chart library.
- `src/domain/`: pure TypeScript, no DOM, no network. Dates, units, climate maths, plant library,
  schedule maths, layout (patches, vessels, occupancy over time), the garden document and its ops,
  migration from 7.x, share codec. Every module has unit tests in `tests/unit/`.
- `src/platform/`: the only code that touches storage, the network (Open-Meteo, Anthropic) or canvas.
- `src/ui/`: Preact components. The whole garden is one SVG in real units.
- **State:** one immutable garden document in a signal. The only way to change it is
  `dispatch(op)`; undo is a stack of previous documents. UI state (selection, zoom, viewed date) lives
  in separate signals and is never saved or undone.
- **Dates:** integer day numbers and ISO date strings. Never do arithmetic on JS `Date` objects.
- **Geometry:** stored in centimetres. Units (ft/in or m/cm, lb or kg, °F or °C) are display only.

## Rules

- **Never put user or model text into `innerHTML` or `dangerouslySetInnerHTML`.** Preact escapes text.
- Everything read from storage, a file, a share link or the assistant is validated by the same schema.
- The assistant key never goes into exports, share links or logs. Load the `claude-api` skill before
  writing or changing assistant code.
- Plant data: every number needs sources; care notes never contain absolute dates or place names
  (the lint test enforces this). Companion claims carry a reason and `tested` or `traditional`.
- No Canton, group or personal content anywhere in the app or the tree.
- Stage explicit paths. Never `git add -A` or `git add .`: `.claude/data/` holds a plugin database and
  Stewart keeps personal files in the repo folder that are ignored but must never be committed.
- No em dashes in anything a person reads (UI text, docs, commit messages). Code comments are fine.
- Commands written for Stewart are one-line Windows PowerShell 5.1 with full absolute paths.
- Nothing is "done" without `npm run check` output to show for it. Mark anything unchecked UNVERIFIED.

## Deploy

Cloudflare Pages project `gardensync` (production alias `gardensync-e4e.pages.dev`, production
branch `master`). `scripts/deploy.mjs` deploys from inside `dist/` so the landing page's Pages
Function in `functions/` is never uploaded with the app. Production deploys, merges to `master`,
tags and GitHub releases need Stewart's yes (Checkpoint 4 in the plan).

The landing page lives in `site/` (deployed separately as `gardensync-landing`).
