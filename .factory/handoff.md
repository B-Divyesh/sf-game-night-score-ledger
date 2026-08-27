# Verification handoff — Game Night Score Ledger

## Verdict: FAIL — do not release

Independent verification of candidate
`5662d2e697568e2a889b021fdd9b09bdd608b6da` against
<https://game-night-score-ledger.sociobot.in/> found two P1 release blockers.
The full evidence is in [verification-4.md](verification-4.md).

- The live candidate matches the local production assets exactly, but its
  service worker fails installation because its precache requests
  `/staticwebapp.config.json`, which production returns as 404. There is no
  service-worker registration/controller and offline reload fails with
  `net::ERR_INTERNET_DISCONNECTED`.
- Ten rapid `+1` inputs lose score events or show an incorrect total in 5/10
  fresh live runs. This violates the product's auditable-scoreboard purpose.

No product source was changed during verification. Fix both items and redeploy
before considering this candidate releasable.

## Previous repair notes (superseded as release verdict)

The following describes changes claimed by the preceding repair handoff. It is
retained for implementation context only; it does **not** override the FAIL
above.

## What changed

- JSON imports now undergo complete schema validation before any persistence:
  IDs, names, teams, dates, score events, player references, undo references,
  limits, settings, and numeric bounds are all checked. Imports become a new
  host-owned copy only after passing validation.
- IndexedDB and localStorage reads validate old records too. A damaged record is
  ignored (and an invalid direct record is removed), so it cannot strand valid
  ledgers or crash the home screen.
- Share snapshots use a compact version-2 payload: no host key, internal IDs,
  event IDs, notes, or repeated ISO punctuation. The documented maximum of 12
  players with 32-character names, 24-character teams, and 12 normal events
  produces a QR (test URL is under 2,400 characters).
- Guest snapshots render scores and history only; they have no increment,
  adjust, undo, or other inert editing controls.
- Share view now gives the QR a valid `img` role and text alternative, hides
  the decorative canvas from assistive technology, and supplies a labelled,
  keyboard-focusable readonly share-link input.
- Service workers use a deterministic build-content cache version. New workers
  install and wait; an in-app update toast appears deterministically, and its
  Reload action explicitly sends `SKIP_WAITING` before the controller reloads.
  Initial control no longer causes a surprise reload.
- `staticwebapp.config.json` ships immutable one-year caching for asset/font/icon
  routes, revalidation for HTML/SW/manifest, the manifest MIME type, and CSP,
  frame, permissions, nosniff, referrer, and COOP policies.
- Small-screen touch/accessibility polish: 44px brand and legal-link targets,
  and player-specific accessible names for Adjust controls.

## Verification

Run from a clean checkout:

```bash
npm ci
npm test
npx tsc --noEmit
npm run build
npx playwright install chromium
npm run test:e2e
```

Verified on 2026-08-27:

- `npm test`: 7/7 domain regressions pass.
- `npx tsc --noEmit`: pass.
- `npm run build`: pass; produces `dist/`.
- Playwright mobile Chromium (Pixel 5): 6/6 pass. Coverage includes the full
  12-player QR boundary, open-share axe scan, snapshot noninteractivity,
  keyboard scoring, invalid stored-record recovery, offline reload, and a
  byte-changed waiting-worker update toast.
- Axe serious/critical violations: 0 on the landing page and open Share dialog.
- `/opt/fleet/lib/verify-url.sh` against production preview: pass; no console
  errors, title/lang/main/alt checks pass.
- Lighthouse mobile preview: Performance 99, Accessibility 100, Best Practices
  100, SEO 100; FCP 1.7 s, LCP 1.7 s, CLS 0.001, TBT 0 ms.
- Build budgets: initial JS 42.66 KB raw, lazy QR chunk 25.88 KB raw, CSS 13.43
  KB raw, fonts 70.5 KB total, hero WebP 39.6 KB.

## Boundaries

- QR links are deliberately point-in-time, view-only snapshots; the host must
  reshare after scores change. There is no cross-device relay in this static,
  privacy-first product.
- Browsers may clear local storage. JSON backup/export remains the durable
  migration path.
- Live Standard static verification passed at
  `https://game-night-score-ledger.sociobot.in`: hashed JS is immutable for one
  year, `manifest.webmanifest` is `application/manifest+json`, `sw.js` is
  `no-cache`, CSP/frame/permissions headers are present, and the basic browser
  smoke emitted no console errors.
