# Checkpoint 1: the design

**Status:** PASSED 2026-10-28. Stewart chose direction A, Plot.

## What was asked

Rethink GardenSync from the ground up for home gardeners anywhere, consulting Claude Design. At this
checkpoint: pick a visual direction and comment on the screens.

## The canvas

https://claude.ai/artifact/5SYt7e5bGaegsR7ycEHbvZ (private to Stewart's account).

- **Row 1, three directions for the planner:**
  - **A. Plot** (recommended): the garden drawn as a surveyed plan on graph paper with real soil,
    timber and crop colours; quiet interface around it; the season ribbon is the one bold element.
    Light and dark (Tweaks menu on the artboard).
  - **B. Seed packet:** two-ink risograph print, wide display type. Loud, a great poster, a weaker
    tool: letter codes for plants, inks that cannot be themed, low contrast.
  - **C. Quiet tool:** neutral modern app, letter-coded tiles. Clear but generic, and the codes mean
    little to a backyard gardener.
- **Rows 2 to 4, direction A in full:** first run ("Where do you garden?"), plant library and card,
  This week (desktop and phone), year calendar, harvest log, settings and your climate, the phone
  garden and tap-to-place, the assistant panel, empty, error, offline and import states.
- **Row 5:** the twelve plant forms, colour tokens for both themes, type and marks.

The sample garden is in Portland, Oregon with real computed frost dates (median last frost Mar 22,
90% safe Apr 14, first frost Nov 21, zone 8b).

## Results

A blind critic reviewed the canvas without my reasoning. Verdict: A is the strongest direction on
the merits ("the only one that works as a tool"). It found two serious problems, both now fixed on
the canvas:

1. Dark soil made plants and the selection unreadable (kale on soil 1.2:1 against a 3:1 minimum).
   Beds are now pale loam in a timber frame, plants are outlined, selection is an ink-and-white ring.
2. Too much relied on dragging and pinching. The season marker is now a slider, the phone has zoom
   buttons, and tap to place is the main way to plant.

It also caught dates that contradicted each other between screens, squares named but not labelled,
and growth stages shown by opacity alone; those are fixed on the canvas too. The remaining items
are build requirements, each logged in `review/LEDGER.md` (items 2 to 20).

## Decisions for Stewart

1. **Direction:** A, B or C (or "A, but...").
2. Anything on any artboard: comment directly on the canvas, or reply in the chat.

## Meanwhile

Work continues on direction-independent pieces: the schedule maths, layout and edit operations,
7.x import and share links, all in pure TypeScript with tests.
