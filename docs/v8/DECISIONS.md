# Decisions

D-Uxx are Stewart's. D-Axx are Claude's calls, each with how to reverse it. Stewart can overrule any
D-A decision; it then becomes a D-U entry.

## Stewart's decisions

- **D-U01 (2026-10-28) Audience:** home gardeners anywhere (backyard, patio, allotment). Crews,
  volunteers and group harvest goals are dropped.
- **D-U02 (2026-10-28) Repo and version:** same repo, ships as 8.0 (old tags already run v1.0 to v7.1).
- **D-U03 (2026-10-28) Stack:** Vite + TypeScript + Preact.
- **D-U04 (2026-10-28) Assistant:** kept as an optional bring-your-own-key panel; the Gemini
  visualizer is dropped.

- **D-U05 (2026-10-28) Design direction:** A, Plot, built as drawn with the critic fixes
  (Checkpoint 1).

- **D-U06 (2026-10-28) Old history:** the 1.0 to 7.x history leaves the public repo. Backup first
  (done: a verified bundle of every ref plus the release and pull request notes in
  `C:\Users\stewa\Documents\Claude\_archives\`). At release the current repo is renamed
  `gardensync-v7-archive` and made private, and a new public `Samizdat-Publications/gardensync`
  starts from one clean 8.0 commit. Reverse: restore the archive repo's name and visibility.

## Claude's calls

- **D-A01 Name** stays GardenSync. Reverse: rename in `index.html`, `package.json`, README, manifest.
- **D-A02 No Almanac link in the header.** The README and About page mention it. Reverse: add a link
  to the app header.
- **D-A03 Climate and Visualize tabs removed.** Climate lives in a "Your climate" panel in settings;
  weather is a frost-warning card in This week.
- **D-A04 Seed-packet varieties leave the built-in library;** 7.x users keep theirs as custom varieties.
- **D-A05 New generic demo gardens only;** none of the old personal or group demos ship.
- **D-A06 Self-hosted fonts** (privacy, offline). Reverse: Google Fonts links in `index.html`.
- **D-A07 Landing page function stays in `functions/`.** The plan said to move it into `site/`;
  instead the app deploys from inside `dist/`, so Pages never sees `functions/` for the app and the
  landing page deploy is untouched. Reverse: move the folder and update the landing deploy command.
- **D-A08 Low-severity npm advisories accepted:** `deepmerge` inside `workbox-build` (build time only,
  via vite-plugin-pwa 2.0). Nothing ships to users. Revisit when workbox updates.
- **D-A09 Firefox end-to-end tests run in CI only.** Playwright's Firefox fails to start on this
  Windows build ("side-by-side configuration is incorrect"). Local `npm run check` covers Chromium,
  WebKit and a phone profile; GitHub Actions runs Chromium, Firefox and WebKit on Linux. Reverse:
  once Firefox launches locally, drop the special case in `scripts/check.mjs`.
- **D-A10 US English** in all app text (fall, zucchini, cilantro, color), with metric fully supported.
  Reverse: a translation layer later.
- **D-A11 Assistant model:** Claude Sonnet 5.5 by default (Stewart, 2026-10-28: Opus is too much),
  with Opus 5.5 and Haiku 5.5 offered in the
  panel (the gardener pays, so the gardener picks). Effort is set to medium, and server-side refusal
  fallback is on for Opus and Sonnet. Reverse: `MODELS` and `DEFAULT_MODEL` in
  `src/platform/anthropic.ts`.
- **D-A12 Official Anthropic SDK, loaded only when the assistant opens.** It is about 79 KB gzipped in
  its own chunk, so the app's first load does not carry it. The key is sent as a Bearer token with the
  SDK's browser opt-in; it lives in its own localStorage entry, never in the garden document.
  Reverse: remove `@anthropic-ai/sdk` and `src/ui/assistant/`.
- **D-A13 The assistant only proposes.** Its editing tools build a draft; nothing reaches the garden
  until the gardener presses Apply, and the whole proposal is one undo step. The conversation is not
  saved. Reverse: `src/ui/assistant/AssistantPanel.tsx`.
- **D-A14 Several gardens:** listed in Settings (open, rename, add, delete) and switchable from the
  header on wider screens. A new garden starts with the current garden's climate. Delete is offered
  only when there is more than one garden and asks first.
