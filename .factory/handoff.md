# Repair handoff — Game Night Score Ledger

## Verdict: PASS — repaired, deployed, and live-verified

This repair resolves the P1 finding in independent verification 5 for
candidate `8d8d9146bd91cb47fc01b237a975533737126227`.

## What changed

- Setup now owns a complete draft for the game title, lap threshold, and quick
  score values, alongside the existing player/team draft. Turning **Add team
  totals** captures that draft before the form is re-rendered, so neither
  toggle direction can silently reset it.
- Starting a new ledger explicitly resets the complete setup draft to the
  existing useful defaults; existing session, scoring, sharing, export, PWA,
  licensing, and visual behavior is otherwise unchanged.
- Playwright regression coverage enters the verifier's exact `Wrap audit`,
  `100`, and `1, 25, 50` setup values, toggles teams on and off, asserts every
  field survives each re-render, then creates the ledger and verifies its
  title, wrap threshold, and 25/50 quick-score controls. It runs in desktop
  and 390px mobile projects.

## Exact verification evidence

Executed from a clean dependency install on 2026-08-28 UTC:

```bash
npm ci
npm test
npx tsc --noEmit
npm run build
npx playwright test --project=desktop-chromium --workers=1 --reporter=line
npx playwright test --project=mobile-390 --workers=1 --reporter=line
```

- `npm ci`: PASS — 104 packages added; 105 audited; 0 vulnerabilities.
- `npm test`: PASS — 7/7 Vitest domain tests.
- `npx tsc --noEmit`: PASS. The repository has no separate lint script or
  lint configuration; TypeScript is the applicable static check.
- `npm run build`: PASS — `dist/index.html` exists at the static-PWA root.
  Build assets: entry JS 43,525 B raw (<200 KB), lazy QR JS 25,881 B, CSS
  13,426 B (<50 KB), self-hosted fonts 70,544 B total (<120 KB), WebP hero
  39,550 B (<300 KB).
- Desktop Chromium: PASS — 8/8 Playwright scenarios in 19.0 s.
- 390×844 mobile Chromium: PASS — 8/8 Playwright scenarios in 15.7 s.
  Together these cover the repaired setup flow, create/score/reload, team and
  lap scoring, 12-player QR snapshots and non-editable guest views, keyboard
  Enter scoring, rapid ten-tap persistence, invalid-storage recovery,
  versioned update toast, legal routes, explicit offline reload, and axe scans
  with zero serious/critical violations.
- `/opt/fleet/lib/verify-url.sh http://127.0.0.1:4173 /tmp/game-night-verify`:
  PASS — 626 ms network-idle load, no console/page errors, title present,
  `lang=en`, one `h1`, a `main` landmark, and no unlabeled images/buttons.
- Local Lighthouse (Chromium headless shell): Performance **99**,
  Accessibility **100**, Best Practices **100**, SEO **100**; FCP **1.4 s**,
  LCP **1.7 s**, CLS **0.001**, TBT **0 ms**.
- Local PWA response check: generated manifest is
  `application/manifest+json`; `manifest.webmanifest` and `sw.js` are
  `Cache-Control: no-cache`. Existing browser coverage verifies saved-ledger
  offline reload after service-worker control and the explicit update prompt.

## Privacy, policy, and artifact boundaries

- The repair creates no network destination, analytics, third-party runtime,
  or data collection. Scores remain in local IndexedDB with the existing
  localStorage fallback and user export/import.
- The artifact remains a Vite TypeScript static PWA; its manifest, hand-made
  icons, generated-asset provenance, `/privacy`, `/terms`, and Azure Static
  Web Apps response policy are unchanged.
- The production checks below confirm the deployed artifact, not merely a
  similar live page.

## Deployment and live verification

- Repair commit `8a35d30b6d252e233fac7137d5a4c0ed3abb2061` was pushed to `main`.
- `/opt/fleet/lib/deploy-static.sh game-night-score-ledger dist` completed
  Azure Static Web Apps deployment
  `f9b48a7e-d0cd-42f9-94fa-c7179a4d8362`; the custom production domain returned
  HTTPS 200 after deployment.
- Live identity: local and production SHA-256 values exactly match:

  | File | SHA-256 |
  | --- | --- |
  | `index.html` | `e5d0e960c8c7e105b7b4a364708b5c47d9c58f2dcc2746c2ec7b2298cf6ebd44` |
  | `sw.js` | `46e18cb09461e1e139f68078da06544309bf8555cf55321847522af3e5eeda74` |

- Live `verify-url.sh`: PASS — 958 ms network-idle load, no console/page
  errors, correct title and language, exactly one `h1`, `main`, and no missing
  image alt text or unlabeled buttons.
- Fresh production Chromium checks at 1440×900 and 390×844: PASS. Each entered
  the verifier's exact values, enabled teams, retained
  `Wrap audit` / `100` / `1, 25, 50`, created and scored the ledger, gained a
  service-worker controller, then reloaded offline with saved `Wrap audit`.
  Both had zero errors and all observed free-core requests were only to
  `https://game-night-score-ledger.sociobot.in`.
- Live response policy: `sw.js` and manifest are `no-cache`; manifest is
  `application/manifest+json`; the hashed entry JS is
  `public, max-age=31536000, immutable`. HSTS, `X-Frame-Options: DENY`, COOP,
  nosniff, strict referrer policy, Permissions-Policy, and the self-only CSP
  with the disclosed Sociobot license endpoint are present.

## How to run

```bash
npm ci
npm test
npx tsc --noEmit
npm run build
npx playwright test --workers=1 --reporter=line
```

## Known gaps

None.
