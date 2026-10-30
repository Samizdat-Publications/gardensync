# Handoff

Newest first. Read this, then [PROGRESS.md](PROGRESS.md), then [docs/v8/PLAN.md](docs/v8/PLAN.md),
then [docs/STEWART_FEEDBACK.md](docs/STEWART_FEEDBACK.md) (Stewart's notes outrank any critic), then
[review/LEDGER.md](review/LEDGER.md).

## 8.1 released (2026-10-30): start here

**State:** 8.1 (planting, rethought) is on `master` at 3210be2, tagged v8.1.0, released on GitHub,
and live at https://gardensync-e4e.pages.dev; the landing page says 8.1. The landing project's
production branch is `main` (deploy `site-dist` with `--branch=main`). The design is
docs/v8/PLANTING_UX.md; findings are review/LEDGER.md 84 to 93.

**Next:** 8.1.x polish: ledger 91 (corner resize handles) and 93 (companion link key, phone title,
phone icons on one-row patches). Check ledger 90 (taps after a touch paint) on a real phone.

## Release (2026-10-28)

**State:** 8.0 is live and the new landing page is deployed. Local remote `archive` is the private
old repo (push `v8` there). Branch `release-8.0` is one parentless commit with the 8.0 tree; it
becomes `master` of the new public repo, which Stewart creates with:

```powershell
cd "C:\Users\stewa\Documents\Claude\gardensync"; gh repo create Samizdat-Publications/gardensync --public --description "Garden bed planner for home gardeners anywhere: plan your beds square by square and get a sowing and harvest schedule from 30 years of weather for your own town." --homepage "https://gardensync-landing.pages.dev"; git remote add origin https://github.com/Samizdat-Publications/gardensync.git; git push origin release-8.0:master; git tag -a v8.0.0 release-8.0 -m "GardenSync 8.0"; git push origin v8.0.0
```

**Next:** PROGRESS.md "Current phase".

## Session 1, late (2026-10-28)

**State:** Checkpoint 2 is open: docs/v8/CP2_GATE.md, preview https://v8.gardensync-e4e.pages.dev.
Everything is committed on `v8` (8648268 and the gate doc after it); `npm run check` ALL GREEN.

**Next:** PROGRESS.md "Next (exact)". Stewart's notes in docs/STEWART_FEEDBACK.md come first.

## Session 1, evening (2026-10-28)

**State:** Checkpoint 1 passed (direction A, Plot). All screens but the planner are committed. The
planner (src/ui/planner/, tests/e2e/planner.spec.ts) was being built by a subagent; if this is a new
session, check `git status` and run `npm run check -- --quick` to see where it stands. The assistant
(src/ui/assistant/, src/platform/anthropic.ts, src/platform/image.ts), several gardens (Settings and
header), "Use my location" (first run), README and CONTRIBUTING are written and tested but
uncommitted, because the assistant imports src/ui/planner/placement.ts.

**Next:** PROGRESS.md "Next (exact)". Checkpoint 2 is the preview link plus docs/v8/CP2_GATE.md.

## Session 1, later (2026-10-28)

**State:** Phases 0 and 2 done; Phase 1 (design) waiting at Checkpoint 1 for Stewart to pick a
direction on the canvas https://claude.ai/artifact/5SYt7e5bGaegsR7ycEHbvZ (see docs/v8/CP1_GATE.md;
direction A "Plot" recommended). The domain core is complete and reviewed: climate, 63 plants,
companions, schedule with goldens, layout, ops, check, 7.x import, share, storage, store.
`npm run check` ALL GREEN, 645 unit tests.

**Next:** once Stewart answers, Phase 3: src/ui/styles/tokens.css copied from the canvas's
A-system artboard (pale loam beds, outlined glyphs, both themes), the glyph component from the
canvas symbols, the app shell and header (one component), first-run setup, the SVG planner with
tap to place, the season slider, the plant library and card. Every date on screen comes from
src/domain/schedule. Ledger items 2 to 20 are build requirements.

## Session 1, start (2026-10-28)

**State:** Phase 0 in progress on branch `v8`. The old 7.x app is gone from the tree; it lives at tag
`v7-final`.

**How to work:** autonomous between checkpoints (see "How I work autonomously" in the plan). Stop only
at a checkpoint, a usage limit, or an action the plan does not authorize. Log every judgment call in
`docs/v8/DECISIONS.md`. Never `git add -A` (`.claude/data/` holds a plugin database); stage explicit
paths. No em dashes in anything a person reads. Commands for Stewart are one-line Windows
PowerShell 5.1 with full paths.

**Gate:** `npm run check` must print ALL GREEN (`npm run check -- --quick` for Chromium only while
iterating).

**Prompt to paste into a fresh session:**

> Continue the GardenSync 8.0 rebuild in C:\Users\stewa\Documents\Claude\gardensync on branch v8.
> Read HANDOFF.md, PROGRESS.md, docs/v8/PLAN.md, docs/STEWART_FEEDBACK.md and review/LEDGER.md first,
> then carry on from "Next (exact)" in PROGRESS.md, working autonomously until the next checkpoint.
