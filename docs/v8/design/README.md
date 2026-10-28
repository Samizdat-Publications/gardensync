# Design source

The Claude Design canvas for GardenSync 8 (direction A, "Plot", chosen at Checkpoint 1), exported
as files: `canvas.json` is the layout, each `.dc.html` is one artboard (HTML with inline styles; the
`renderVals()` function at the bottom of each file holds its sample data and palettes).

The app is built to match these artboards, with the fixes recorded in `review/LEDGER.md` items 2
to 20. When the app and an artboard disagree, `src/ui/styles/tokens.css` and the ledger win.

| Artboard | Screen |
|---|---|
| Main.dc.html | Planner, desktop (direction A) |
| B-planner.dc.html, C-planner.dc.html | The two directions not chosen |
| A-setup.dc.html | First run: where do you garden |
| A-plants.dc.html | Plant library and plant card |
| A-week.dc.html | This week |
| A-calendar.dc.html | Year calendar |
| A-harvest.dc.html | Harvest log |
| A-settings.dc.html | Settings and your climate |
| A-phone-garden.dc.html, A-phone-place.dc.html, A-phone-week.dc.html | Phone screens |
| A-assistant.dc.html | Assistant panel |
| A-states.dc.html | Empty, error, offline and import states |
| A-system.dc.html | Plant glyphs, colour, type |

The sample garden is in Portland, Oregon, with dates computed from real weather records.
