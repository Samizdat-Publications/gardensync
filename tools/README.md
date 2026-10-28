# tools/

Scripts for the project's public face. Nothing here is part of the app.

## Filming the landing page and README media

`tools/showcase/film.mjs` records every clip and still with Playwright against a production build,
with a fixed date and a starter garden made from typed frost dates (no real place, no network),
then cuts the clips to H.264 loops with ffmpeg.

```bash
npm run build
npm run preview
node tools/showcase/film.mjs http://localhost:4173
```

It writes `site/media/*.mp4` and `*.jpg` (clips, posters, stills, the social card) and
`docs/media/` (README stills and `hero.gif`). It needs ffmpeg on the path.
