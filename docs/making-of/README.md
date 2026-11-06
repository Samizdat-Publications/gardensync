# The making of GardenSync 8

GardenSync 8 is a ground-up rebuild. This record starts at that rebuild: the planner it replaced,
built for one community garden, lives at tag `v7-final`, and its history is kept in a private
archive. Everything below is the app as it stands today.

Built with **Claude Opus 5.5**.

## What is kept, and where

| Kind | Where |
|---|---|
| Stills, one per milestone | `docs/making-of/stills/NNN_<release>-<label>.jpg` |
| Clips, at the big visual moments | `docs/making-of/clips/NNN_<release>-<label>.mp4` |
| What changed in each release | `CHANGELOG.md` |
| Release tags | `v8.0.0` to `v8.4.0`, one per release |
| The plan the rebuild followed | `docs/v8/PLAN.md`, decisions in `docs/v8/DECISIONS.md` |

The stills and clips are the landing page captures as they were at each release tag, recovered
from git rather than captured again, so each one shows the app exactly as it shipped.

## Timeline

| When | Release | Picture | Tag | The story in one line |
|---|---|---|---|---|
| 2026-10-28 | 8.0: the rebuild | `stills/001`, `clips/001` | `v8.0.0` | A new app for home gardeners anywhere: Vite, TypeScript and Preact with no server. Type a town and it pulls 30 years of daily weather to work out the frost dates, then draws beds to scale, places plants in real squares and turns them into a sowing and harvest schedule. 63 plants, every number sourced; about 750 unit tests run in two time zones. |
| 2026-10-30 | 8.1: planting, rethought | `stills/002` | `v8.1.0` | Planting becomes drag and drop. Drop a plant on a square and it is planted; drag across squares to paint a patch. A drop onto a taken square opens a card with ways out instead of an error, and crops planned for later show as dashed patches. |
| 2026-10-30 | 8.2: polish | - | `v8.2.0` | Four rounds of fixes from blind design reviews and new-gardener usability tests: resizable patches, a key for the plan, no initials as labels, shared gardens that open in a fresh browser, leap-year calendars. |
| 2026-10-30 | 8.3: dates for every climate | - | `v8.3.0` | A second review of the plant library against extension guidance. Picking runs until frost for crops that keep cropping, summer crops can go in later, and frost-free places get real seasons. |
| 2026-10-31 | 8.4: herbs that come back | `stills/003`, `clips/002` | `v8.4.0` | Perennial herbs keep their squares year to year, the planner fits a laptop with the day always in view, and a fresh landing page with new clips. |

## Before and after

`stills/001` and `stills/003` show the same bed on the same day, May 20, three days of work apart.

In 8.0 the bed is half planted and the small patches are labelled by initials ("FM", "Pa", "Na").
By 8.4 it is planted edge to edge by drag and drop, good neighbors are linked across the bed, the
plan's title sits on two lines so the date is never cut off, the buttons use short labels, frost
dates have their own chip, and the tomato and pepper harvest bars run on to the October frost
instead of stopping in September.

`stills/002` is the 8.1 moment in between: the plan looking ahead to June 1, the bed filled for
the first time by dragging plants straight from the list.
