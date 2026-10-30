# Planting, rethought (8.1)

## What went wrong in 8.0

A gardener who started in late October picked a plant, clicked an empty-looking square and was told
it clashed with tomatoes. Three causes:

1. **The bed on screen was not the bed being planted into.** The plan showed today (Oct 30, nothing
   in the ground), but a new planting goes into its next window (next spring), when the starter
   bed's crops fill every square. Those crops were never drawn; the squares were only hatched and
   labelled "to Sep 12".
2. **Clashes were explained after the fact and offered one way out** ("Interplant anyway"), as a
   list of red blocks in a side panel.
3. **Placing was hard to find.** Choose a plant, click one corner, click the other corner, then
   press Plant. No drag and drop.

## The new model

**Drop a plant on a square and it is planted.** Undo takes it back. No corner clicks, no separate
confirm step when the squares are free.

- **Drag and drop from the plant list** onto any square (mouse, pen, touch). While dragging, the
  plant's real footprint follows the pointer, green where it fits and orange where it clashes, with
  the reason under it ("Tomato is here Apr 30 to Sep 12"). Dropping on free squares plants it at
  the usual count. On a phone, a long press on a plant starts the drag, so the list still scrolls.
- **Or tap:** tap a plant in the list, then tap a square: planted, same rules. Press and drag across
  squares to plant a bigger patch. The plant stays chosen so several patches can go in one after
  another; Escape or "Done" stops.
- **Move a planting by dragging it** to other squares; it keeps its dates. Same clash rules. A drag
  that starts on a planting always moves the planting, never its bed; planned (dashed) plantings
  are picked and moved the same way.
- **Painting next to a patch of the same plant** that goes in on the same dates makes that patch
  bigger instead of adding a second one.

**The plan shows the bed when it matters.** While a plant is chosen, the plan shows the day it would
go in (with a clear note and "Back to today"), so the crops it would share the bed with are drawn as
real, named patches. Squares that are free on that day but taken later while it grows stay hatched,
labelled with the crop: "Tomato from May 4".

**A clash is a choice, not a dead end.** Dropping on taken squares plants nothing and opens a small
card right there:

- **Plant after it:** the next window for this plant once the squares are free ("Plant after the
  radish: Jul 20"), with the year when it is not this year.
- **Find room:** the nearest free squares of the same size, in this bed or another, for the same
  dates; one click moves it there. When no bed has room the card says so.
- **Replace the tomatoes:** pulls them out and plants this instead (one undo step).
- **Grow alongside:** the old "Interplant anyway", only offered when the pair is not a foe.

## Quality of life

- Every patch shows a tooltip on hover with its name, count and dates.
- The "taken" hatch carries names, never bare dates.
- A first-time hint in the plant list: "Drag a plant onto a square, or tap it and then a square."
- Escape stops placing; Delete pulls out the selected planting; arrow keys still work everywhere.
