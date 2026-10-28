# Checkpoint 2: the core app

**Preview:** https://v8.gardensync-e4e.pages.dev (branch `v8`; production is untouched)

**The question:** does this feel right? Try it the way you would use it, on your laptop and on your
phone, and tell me what feels wrong, missing or fussy. Your notes go in
[docs/STEWART_FEEDBACK.md](../STEWART_FEEDBACK.md) and outrank every critic.

## Things to try (10 minutes)

1. Open the preview in a private window. Type your town (or press "Use my location"), pick the
   starter bed, and press Start planning.
2. **Garden:** tap a plant in the list on the left (on a phone: Add plants), then tap two squares to
   place it. Tap a planting to see its dates and why. Drag the season slider to see the bed in
   July. Undo anything.
3. **This week:** the jobs due now, each with its reason, and the next 7 nights' frost forecast.
4. **Calendar:** the whole year for every planting; Print the year.
5. **Plants:** search, open Tomato, read its dates for your town and its sources.
6. **Harvest:** log a pick.
7. **Settings:** your climate (nudge a frost date and watch the garden re-flow), units, a second
   garden, download a copy, share a link.
8. **Assistant** (the speech-bubble button, optional): needs your own Anthropic API key. Ask it to
   plan a small herb bed, then Apply or Discard.

## What is in

Every screen from the plan's Phase 3 and most of Phase 4: first run (town search, your location
or typed frost dates), the planner (beds and pots to scale, square-foot placing, friends and foes,
the season ribbon, undo), This week with the frost watch, the year calendar, the harvest log, the
plant library (63 plants, every number sourced), settings and your climate, several gardens, share
links, offline install, and the optional assistant.

## How it was checked

- `npm run check` ALL GREEN at commit `8648268`: typecheck, 755 unit tests in two time zones,
  build, bundle budget (entry 123 of 150 KB gzipped), 98 end-to-end tests in Chromium, WebKit and a
  phone profile, with axe accessibility checks on every screen. Firefox runs in CI only (D-A09).
- Screenshots of 12 screens at phone, tablet, laptop and desktop, light and dark (96 images in
  `review/shots/`), reviewed by me and by a blind design critic. All 6 of the critic's P0s and
  most P1s are fixed; the rest are in `review/LEDGER.md` (items 56 to 70) for Phase 5.
- A security review of the assistant: nothing critical or high; its two medium findings fixed.
- The live preview driven by hand with real towns (Melbourne). That found real bugs the tests had
  missed, now fixed and covered: starter gardens dated in the past, late plantings pushed to next
  year, temperatures ignoring your units, the town list staying open.

## Known gaps (planned, not forgotten)

- Print poster and PNG picture of the garden (Phase 4, next).
- First run's right half is blank until you pick a town (ledger 63).
- Polish items from the critic: harvest empty state, tomato card repetition, library layout at
  1024 px, small alignment issues (ledger 68 to 70).
- Pinch zoom works but has no automated test; a pinned date cannot be switched back to automatic.

## Calls I made you may want to change

- **D-A11:** the assistant uses Claude Sonnet 5.5 at medium effort by default (changed from Opus at
  Stewart's request); Opus 5.5 and Haiku 5.5 are one click away in its panel.
- **D-A14:** a second garden starts with the first one's frost dates.
- A starter garden begun in late spring uses nursery plants for tomatoes and peppers, since seed
  would be too late; one begun in the fall shows when its first planting goes in.

## After this

Your answer, then Phase 4's remaining pieces (print and PNG), then Phase 5: accessibility,
keyboard and touch passes, performance, every critic item, three browsers in CI, docs. Then
Checkpoint 3 with a beta link and a QA report.
