# Independent verification 7 — PASS

**Candidate:** `6faec2d98c11d33afc5192071969c3ff691891ad` (`main`)

**Production URL:** <https://game-night-score-ledger.sociobot.in/>

**Verified:** 2026-08-28 UTC from a clean checkout at the candidate SHA.
Product source was not modified during this verification.

## Release verdict

**PASS.** The deployed PWA is the tested candidate, and it satisfies the
researched brief's core table-side job: a host can create a local ledger,
track teams and wrapping scores with an audit trail, correct a score without
erasing evidence, share a non-editable QR snapshot, export records, and
reload the saved ledger offline.

## Clean-install quality gates

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 104 packages installed; 105 audited; 0 vulnerabilities. |
| `npm test` | PASS — 8/8 Vitest domain tests. |
| `npx tsc --noEmit` | PASS. |
| Lint | No lint script or lint configuration is present. |
| `npm run build` | PASS — production `dist/` created. |
| `npm run test:e2e -- --workers=1 --reporter=line` | PASS — 18/18 Chromium scenarios (desktop 1440×900 and mobile 390×844). |

The browser suite covers setup-state retention, invalid quick-score rejection
and correction, normal persistence, teams/laps, QR guest non-editability,
keyboard scoring, rapid taps, malformed stored-data recovery, service-worker
update notification, legal pages, axe scans, and offline reload.

## Independent functional evidence

I repeated the high-risk flows outside the repository suite against the
production build and the live site.

- Created a two-player team ledger with a lap threshold of `2` and quick
  scores `1, 999`; keyboard Enter and click scoring reached 2 points and the
  score readout showed `1 lap · position 0 of 2`.
- Tested a correction of `-4`, undo (as a compensating audit event), and
  starting the next round; team setup and the audit trail remained available.
- Downloaded CSV, PNG score-image, and JSON backup exports. Generated
  filenames were `boundary-session.csv`, `game-night-score.png`, and
  `game-night.json`.
- Confirmed the guest share URL contains no host key and its view has zero
  score/adjustment controls.
- Boundary and recovery checks passed: one player reports “Add at least two
  player names.”; duplicate names report the corrective message; lap `1` is
  rejected while the upper boundary `100000` creates a ledger; a fractional
  custom score has native `stepMismatch`; a malformed snapshot shows “View
  link is damaged”; malformed JSON import reports its parsing error without
  opening it.
- The prior P1 regression is repaired on both live desktop and mobile: input
  `1, 999, 1000, -2` remains unchanged, is focused, announces “Use one to
  four unique whole numbers from 1 to 999 for quick score buttons.”, and
  creates no score actions. Correcting it to `1, 999` creates the ledger.

## Accessibility, responsive behavior, and browser health

- Independent axe scans on fresh live desktop and 390×844 mobile ledgers:
  **0 serious/critical violations** in each viewport.
- Live normal-use flows produced **no console errors or page errors**.
- Keyboard-only smoke test passed: Tab reaches the 44.8px skip link with a
  visible `3px solid rgb(255, 214, 122)` focus outline; Enter scores a focused
  quick-score button.
- Reduced-motion emulation yields `0.00001s` transition duration. The source
  has the corresponding `prefers-reduced-motion` override.
- The suite's local production-PWA check verified the waiting-worker update
  toast; live desktop and mobile both acquired a service-worker controller
  and reloaded the persisted ledger while `context.setOffline(true)`.

## Deployment identity, privacy, and response policy

The live release matches the locally built candidate exactly at the app-shell
identity boundary:

| File | SHA-256 |
| --- | --- |
| `index.html` | `e5ed57a742f474f090b619993833afb960aeb230943a9300c9e54ae3a9c96382` |
| `sw.js` | `ec7d5ad474f017f9c7e64b50decfc771e44a940e6dd794402bb11c641b31fbb2` |

The live HTML references the same `main-DpURyQFK.js` and `main-CzEKpCxk.css`
as `dist/`. Normal live use requested only
`game-night-score-ledger.sociobot.in`; there are no analytics, third-party
scripts, or CDN fonts. Scores are stored locally in IndexedDB with the stated
localStorage fallback. The only optional external endpoint in source/CSP is
the disclosed Sociobot license verifier.

Live headers were checked directly. `sw.js` and `manifest.webmanifest` use
`Cache-Control: no-cache`; the hashed main JS uses
`public, max-age=31536000, immutable`; the manifest is
`application/manifest+json`. HSTS, strict referrer policy, `nosniff`,
`X-Frame-Options: DENY`, COOP, restrictive Permissions-Policy, and the
self-only CSP (plus the disclosed license origin) are present.

The manifest has standalone display, a build-versioned start URL, matching
night theme/background colors, and existing 192/512 plus 512-maskable icons.

## Bundle budgets

| Asset | Raw size | Budget | Result |
| --- | ---: | ---: | --- |
| Initial JS | 44,116 B | 200 KB | PASS |
| Lazy QR JS | 25,881 B | — | PASS |
| CSS | 13,426 B | 50 KB | PASS |
| Self-hosted fonts (combined) | 70,544 B | 120 KB | PASS |
| Hero WebP | 39,550 B | 300 KB | PASS |

## Defects by severity

No release-blocking, major, minor, or advisory defects found.

