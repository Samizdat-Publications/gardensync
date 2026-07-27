# tools/

Documentation tooling. **Nothing here is part of the app.** The planner still
ships as vanilla HTML, CSS and JS with no build step — `deploy.sh` copies files
and nothing else. `package.json` exists only so these scripts can pin Playwright.

## Regenerating the screenshots

The screenshots in `docs/screenshots/` are used by `README.md` and the project
page, and their alt text describes what is actually visible in them. When the
UI changes in a way that makes a caption wrong, regenerate rather than
hand-edit the prose.

```bash
npm install
npx playwright install chromium
```

Then serve the repo and shoot:

```bash
python proxy.py
```

```bash
node tools/shoot-planner.js docs/screenshots
```

The almanac lives in its own repository. To reshoot its ten captures, serve
that checkout on port 8099 and point the other script at it:

```bash
node tools/shoot-almanac.js ../gardensync-almanac/docs/screenshots
```

Each script loads a known demo garden, freezes animations and transient toasts,
and captures at the same viewport as the original image, so reruns stay
comparable and the existing alt text keeps matching.

## A note on why these exist

The four plan-overview cards in `docs/screenshots/` were originally produced by
a one-off HTML file that was never committed. When those images needed changing
there was no way to regenerate them and they had to be edited as bitmaps. These
scripts exist so that does not happen again — every other documentation image in
this repo can now be rebuilt from the running app.
