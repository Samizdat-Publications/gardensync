# GardenSync 8.0: release QA report

Checked on 2026-10-28 at commit `b7bafc2` on branch `v8`.

## The gate

`npm run check`: ALL GREEN, and the same check passes in GitHub Actions (with Firefox).

| Step | Result |
|---|---|
| Typecheck (TypeScript strict) | clean |
| Unit tests, run in New York and in Melbourne time | 766 passed, both zones |
| Build and bundle budget | first load 123 of 150 KB gzipped; everything 238 of 260 KB |
| End-to-end, Chromium, WebKit and a phone profile, axe on every screen | 110 passed |

What the unit tests pin down: the climate maths against 30-year fixtures for six places; planting
windows for those places checked against extension guidance and frozen as readable goldens; a
starter garden begun in any month has nothing already late; every job's date agrees with the
reason it gives; plant data lint (sources, no dates or places in notes, companions resolve); the
garden document, edits, undo, 7.x import, share links, storage; the assistant's tools reject
malformed or hostile input.

## By hand and by critic

- Every screen captured at phone, tablet, laptop and desktop, light and dark (104 images),
  reviewed by me and by three blind design critic rounds. The last round found no P0; its P1s are
  fixed (ledger 75 to 80, 83). Remaining P2 and P3 polish is listed in `review/LEDGER.md` (82).
- The live preview driven with real towns, including a southern-hemisphere one. That found real
  date bugs the tests had missed; they are fixed and now covered.
- Accessibility and best practices: Lighthouse 100 and 100 on the preview. A throttled phone
  (4x CPU, about 9 Mbps) paints the first screen in about 1.4 s with 267 KB transferred.
- Security: a review of the assistant found nothing critical or high; its findings are fixed. The
  key never enters the garden document, exports, share links or backups.
- Privacy: no accounts, analytics or server. The app talks to Open-Meteo for weather and place
  search, and to Anthropic only if the gardener sets up the assistant with their own key.
- Public content: a sweep of every tracked file for personal details and the old group, and a
  full-history scan for secrets (none ever committed). The public repository starts from a clean
  8.0 commit; the full old history is kept privately (D-U06).

## Known and accepted

- Pinch zoom works but has no automated test. A pinned date cannot be switched back to automatic.
- P2 and P3 items in ledger item 82: assistant panel backdrop, plant card scroll edge, tablet
  "Coming up" width, the phone first-run preview, small header and settings details.
- Firefox end-to-end runs only in CI (it will not start on the development PC).
