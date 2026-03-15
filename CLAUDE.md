# GardenSync — AI Assistant Guide

## CRITICAL: Project Identity

**This is GardenSync** — a community garden bed planner for Food Not Bombs Canton, OH.

**This project has ZERO association with Strange Signals, UAP correlation, paranormal sightings, or any other project.** GardenSync is a standalone gardening application. Do not add, reference, or conflate any other project with this repo.

- **Repo:** `Samizdat-Publications/gardensync`
- **Strange Signals is a SEPARATE repo:** `Samizdat-Publications/strange-signals`
- Never add Strange Signals files, remotes, or branches to this repo
- Never add sightings data, paranormal data, or map visualization code here

## Project Overview

GardenSync is a browser-based garden bed planner with companion planting intelligence, harvest tracking, and AI-assisted garden planning via Claude API. Built for community gardens.

## Tech Stack

- **Frontend:** Vanilla JS + CSS (no framework, no bundler)
- **Backend:** Python proxy server (`proxy.py`) for Claude API calls
- **No package manager** — all dependencies via CDN (Google Fonts)
- **No build step** — open `index.html` directly or serve with any HTTP server

## File Structure

| File | Purpose |
|------|---------|
| `index.html` | Main app — bed planner, grow schedule, planting log, stats dashboard |
| `app.js` | All application logic (~6K lines) — bed management, plant placement, AI chat |
| `styles.css` | All styles (~4K lines) — OLED dark theme, responsive layout |
| `guide.html` | User documentation — standalone styled guide |
| `proxy.py` | Python HTTP proxy for Claude API (avoids CORS) |
| `demo-data.json` | Sample garden data for first-run experience |
| `.gitignore` | Standard ignores (.DS_Store, __pycache__) |

## Running Locally

```bash
# Start the API proxy (required for Garden Buddy AI chat)
python proxy.py

# Then open index.html in browser, or:
python -m http.server 8000
```

## Key Features

- Bed planner with snap grid and spacing circles
- 37+ plant library with companion/enemy relationships
- Garden Buddy AI chat assistant (Claude Sonnet)
- Harvest tracking and goal setting
- Print-friendly bed map export
- Dark/light theme toggle
- Mobile responsive
- URL-based garden plan sharing

## Code Architecture

- Single-page app with tab navigation (Bed Planner / Grow Schedule / Planting Log / Stats)
- State stored in `localStorage` with URL sharing via base64 encoding
- No routing — all views rendered in `index.html`
- Procedural ES6+ style (no classes, no modules)

## Coding Conventions

- Vanilla JS — no frameworks, no TypeScript
- CSS custom properties for theming
- Descriptive function names, no abbreviations
- All UI in `index.html`, all logic in `app.js`, all styles in `styles.css`
