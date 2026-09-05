# Review: track board-game scores without manual recalculation

**Verdict: FAIL**

Reviewed on 2026-09-05 UTC at
<https://game-night-score-ledger.sociobot.in/>.

The reviewed implementation is `6faec2d98c11d33afc5192071969c3ff691891ad`.
The checked-out documentation commit is
`a539bee7e025b5be7fa7594cfe5cd04460c9f96a`; its only changes after the
implementation are `.factory/handoff.md` and `.factory/verification-7.md`.
Fresh `dist/index.html` and `dist/sw.js` SHA-256 values matched the live files,
so the production application is the implementation candidate.

There are **6 findings** and **18 untested public claims**. This is not a
PASS, regardless of the passing code checks.

## First screen

Before scrolling, I opened fresh Chromium desktop (1440 × 900) and phone
(390 × 844) contexts. The job is to record board-game scores with laps, teams,
and an audit trail. The audience is a board-game host at the table. The only
first action is **Start a ledger**; it opens real setup. Neither viewport has
“Try it with sample data,” a sample label, Reset demo, or Start for real.

The desktop and phone had no horizontal overflow or console/page errors. Both
made first-load requests only to the product origin. Screenshots are retained
outside the repository at `/work/.evidence/live-desktop-initial.png` and
`/work/.evidence/live-phone-initial.png`.

## Findings

### F1 — P1: no one-click sample sandbox

The required demo does not exist. The landing page provides only **Start a
ledger**. `/demo` returns the ordinary home document and opens no sample;
`?demo=1` has no handling in the app. There is no persistent “Demo — sample
data, nothing is saved” label, Reset demo, Start for real control, separate
storage namespace, or `.factory/demo.md`.

This prevents the required sample exercise and does not protect real local
data during a try-out. Add a realistic seeded session reachable in one click,
make demo storage separate from real storage, and document and test reset and
exit behaviour.

### F2 — P1: public promises have no claims registry or claim tests

`.factory/claims.json` is absent, so there are no declared claim commands to
run. The required per-claim test mapping is absent even though the landing
page, README, privacy policy, and terms make visitor-reliance promises.

I counted 18 distinct untested promises, including offline reload, local-only
storage/no analytics, 2–12 players, laps, teams, event audit/undo, concurrent
tab merging, guest QR non-editing, CSV/PNG/JSON export, PWA installation,
under-one-minute setup, and the $12 Host pack scope. Existing unit and browser
tests exercise several features, but they are not tagged claim tests and no
registry maps a public sentence to one observable sandbox command.

Create `.factory/claims.json`; give each public claim exactly one
`@claim:<id>` sandbox test starting from `/demo`; remove or narrow claims that
cannot be proved. The reported untested-claim count is therefore **18**.

### F3 — P2: the first-screen words do not name the job or a try-out

The main heading is “Keep every point. Lose the arithmetic.” It is a slogan,
not a plain description of the score-recording job. The accompanying first
action starts a real ledger instead of the required sample. This fails the
first-screen plain-words shape for a distracted host.

Use a job heading such as “Track board-game scores with laps and teams,” name
the host situation in one short sentence, and put **Try it with sample data**
beside the real setup action with a short outcome note.

### F4 — P2: root and demo route metadata are incomplete

The live root title is only “Game Night Score Ledger”, not “Product name —
what it does in plain words.” The root has a description but no canonical,
Open Graph, Twitter-card, or Apple-touch metadata. `/demo` is the ordinary root
document, so it has no demo-specific title. The legal pages have correct titles
and one main/h1, but also omit description, canonical, and social metadata.

Set a plain root title within 60 characters, create a real demo route with
“Demo — Game Night Score Ledger”, and add the required canonical, Open Graph,
Twitter-card, and Apple-touch metadata to every route.

### F5 — P2: there is no designed 404 route

`/404` and `/not-a-real-route` both return the home document with HTTP 200 and
the root title. They do not identify a missing page or provide the required
designed route-specific recovery. The static-host fallback currently masks a
missing URL as the landing page.

Ship `404.html` in this product’s visual system with a plain heading and a home
link, and configure the host response override so unknown URLs return the
designed 404 response.

### F6 — P3: the site header has no product navigation

The header contains the home wordmark, local-save status, and an unlabeled
symbol button for the optional pack, but no navigation landmark or links to
Demo and Privacy. This is below the required consistent header structure and
makes the legal and try-out paths less discoverable. Add a concise visible nav
with links that remain available on each route.

## Checks that passed

From the clean checkout after `npm ci`:

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 104 packages installed; 0 vulnerabilities reported |
| `npm test` | PASS — 8/8 Vitest tests |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS — `dist/` created |
| Chromium browser suite | PASS — 18/18: desktop 9/9 and phone 9/9 |

The configured `npm run test:e2e` command was split by Playwright project only
because this review runner interrupts a single command after 30 seconds. The
two project runs execute the same configured suite and both completed normally.

Fresh live desktop and phone exercises passed normal use: I created a two-team
ledger with a wrap threshold of 2, scored Ada through a lap, downloaded
`review-table.csv` and `review-table-score.png`, opened a QR guest snapshot,
and verified it had View only text and zero score controls. Five live rapid
ten-tap runs each reached score 10 with ten trail events and kept score 10
after reload. The live service worker controlled the page and each populated
ledger reloaded while offline.

Live invalid and recovery checks passed: fewer than two players, invalid quick
increments, and a threshold of 100001 provide corrective errors; malformed
snapshot links render a recovery screen. Axe scans found zero serious or
critical violations in populated desktop, phone, and open-share states. Normal
flows produced no console/page errors. First-load and scoring requests stayed
same-origin; no analytics or third-party runtime resource was observed.

`/privacy/` and `/terms/` return 200 with one `h1`, one `main`, and route
titles. Manifest, icons, robots, sitemap, CSP, clickjacking protection,
immutable hashed assets, and service-worker cache headers are live. The built
initial JS is 44,116 bytes raw and CSS is 13,426 bytes raw, within the stated
budgets.

## Earlier findings

| Earlier finding | Current disposition | Evidence |
| --- | --- | --- |
| Malformed import could strand a ledger | Fixed | Strict stored/import validation and recovery test pass; current live build is candidate-equivalent. |
| Guest snapshot showed inert score controls | Fixed | Live guest snapshot had zero score or adjustment controls. |
| Share-dialog axe errors | Fixed | Live open-share axe scan: zero serious/critical findings. |
| 12-player QR was too large | Fixed | Candidate browser test passes the documented 12-player QR case. |
| Update toast/cache versioning | Fixed | Candidate browser test passes waiting-worker update; live controller and offline reload pass. |
| Non-immutable assets, manifest MIME, missing security headers | Fixed | Live headers show immutable `/assets/*`, manifest MIME, CSP, X-Frame-Options, COOP, permissions policy, and no-cache SW/manifest. |
| Small/ambiguous touch controls | Fixed | Current browser suite and live mobile keyboard/axe checks pass. |
| Rapid quick-score loss | Fixed | Five live 10-tap runs had 10 events, displayed 10, and persisted 10. |
| Team toggle discarded setup values | Fixed | Candidate desktop and phone regression tests pass both toggle directions. |
| Invalid quick scores were silently changed | Fixed | Live invalid input remained unchanged, focused, and announced the correction. |

The earlier report’s PASS was accurate for the then-tested implementation
behaviour, but it did not cover the later factory-required demo and claims
contracts. Those omissions are the current release blockers.

## Required next work

1. Build and test the isolated sample demo, including persistent label, reset,
   direct `/demo` entry, and real-data isolation.
2. Add the claims registry and sandbox tests for every remaining public claim.
3. Repair the landing words, metadata, header navigation, and designed 404
   response; then repeat this review from a fresh checkout and fresh live
   phone/desktop contexts.
