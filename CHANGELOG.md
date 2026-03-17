# GardenSync Changelog

## v5.4 — 2026-03-08

### QA Sweep (full pass — zero errors)
- All 6 tabs tested: Bed Planner, Grow Schedule, Harvest, Volunteers, Climate Data, Visualize
- Mobile responsive across all tabs (375px)
- Light/dark theme rendering verified
- Console audit: zero errors, zero warnings across all tab transitions
- Network audit: zero failed requests

### Spacing Warnings Overhaul
- Rewrote algorithm: nearest-neighbor only, 65% threshold, pair deduplication
- Reduced from dozens of false positives to ~4 meaningful warnings
- Fixed CSS `pointer-events: none` → `pointer-events: auto; cursor: help` (tooltips now work)
- Tooltip format: "Plant A ↔ Plant B: X" apart, need Y""

### Context Menu Fix
- Replaced 20-item "MOVE TO:" overflow list with single "Move to..." button
- Added scrollable move picker modal (centered overlay, click-outside-to-close)
- Moved Remove to bottom with red danger styling and divider

### Rainfall Deficit Calculator
- Replaced rain barrel calculator with rainfall deficit analysis
- Shows monthly deficit/surplus bars, season balance, total garden area
- Advisory messages based on deficit severity
- Auto-updates via `gardenStateChanged` event from `saveState()`

### Planting Log Removal
- Removed Planting Log tab from desktop and mobile navigation
- Removed `calendar.js` and `planting-log.js` script references
- Utility functions (`getWeekKey`, etc.) preserved in `persistence.js`

### Garden Buddy Enhancements (Plan: glimmering-dazzling-tower)
- **Enhanced system prompt**: container matching by name/type, multi-step operation guidance, plant ID resolution hints, image handling instructions
- **Image upload UI**: + button next to chat input, file picker, thumbnail preview with remove, base64 encoding in Claude API calls
- **`remove_plants` tool**: targeted removal by plant type (vs `clear_bed` which removes all)

### Demo Garden
- Integrated user's actual garden layout as the demo (71 plants, 20 containers)
- `autoOrganizeBed()` called on demo load for clean layouts

### Other Fixes
- Arrow key nudge reduced to 4px/1px (from 20px/4px)
- Zoom-compensated companion line strokes
- Blueberry added to PLANT_LIBRARY
- Cache bumped to v5.4 for styles.css, placement.js; v5.3 for persistence.js
