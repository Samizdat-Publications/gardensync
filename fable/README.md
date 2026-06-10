# GardenSync — A Quiet Almanac

A ground-up rebuild of GardenSync with a different temperament: where the
original shouts (punk posters, neon, bold caps), this edition breathes —
warm paper, botanical ink, and a garden you plan by scrubbing through the year.

**Run it:** start the existing dev server from the repo root (`python proxy.py`)
and open <http://localhost:8080/fable/>. No build step, no dependencies —
three files and the shared plant library.

## What's different

- **The season ribbon.** The whole year sits at the top of the page. Drag the
  pin to any date and the garden re-renders as the almanac imagines it then:
  dashed ghosts before sowing, small sprouts, full plants, gold harvest rings,
  sepia spent crops. Frost dates are marked; today is pinned in clay red.
- **Companion halos, not error lines.** Pick up a seed packet and every
  planted friend glows moss green, every foe blushes terracotta — guidance
  before you commit, instead of alarms after.
- **Bed moods.** Each bed quietly reports how its plants get along:
  *thriving*, *content*, or *uneasy — 2 quarrels*.
- **The almanac panel.** Context-sensitive: the garden's week at a glance
  (sow/transplant/harvest tasks derived from Zone 6a frost dates), or a full
  plant page with a year-strip timeline, companions present in your garden,
  and care notes.
- **Ask the almanac.** A small Claude-powered companion that knows your
  exact beds and the date (uses the same `proxy.py` + `.env` key as the
  original Garden Buddy).
- **Square-foot honest.** Placement footprints derive from real spacing —
  16 carrots per square, one tomato per 2×2 ft.

Autosaves to localStorage; export/import JSON; full undo (Ctrl+Z);
FNB Easy Start five-bed plan included as the default garden.

Data (77 plants, companions, Zone 6a windows) is carried over from the
original `js/constants.js` research — the design is new, the agronomy isn't.
