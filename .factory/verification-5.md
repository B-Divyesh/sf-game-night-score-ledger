# Independent verification 5 — FAIL

**Candidate:** `8d8d9146bd91cb47fc01b237a975533737126227` (`main`)

**Production URL:** <https://game-night-score-ledger.sociobot.in/>

**Verified:** 2026-08-27 UTC, from a clean, unmodified checkout at the candidate
SHA. This report is independent of the earlier repair handoff.

## Release verdict

**FAIL.** A normal setup sequence silently discards the score-track lap
threshold (as well as the title and quick-score configuration) when the host
enables team totals. Lap tracking is a primary, researched job-to-be-done, so
this is a P1 functional defect until the form retains its already-entered
values across that control's re-render.

## Blocking defect

### P1 — Enabling teams silently resets prior setup fields

On the deployed product, start a ledger and:

1. Enter `Wrap audit` as the game/session name.
2. Enter `100` for **Score track wraps at**.
3. Enter `1, 25, 50` for **Quick score buttons**.
4. Check **Add team totals**.

Observed immediately after step 4 in fresh Chromium:

```json
{"title":"Game night","lap":"","increments":"1, 5, 10","teams":true}
```

The setup form is re-rendered for team-name inputs, but its in-memory state
only preserves player/team names. There is no warning or confirmation. A host
who fills the obvious top-to-bottom form order and then elects to track teams
therefore creates a non-wrapping ledger with defaults, defeating the brief's
score-track-overflow purpose and potentially producing an incorrect record.

Severity rationale: this is not cosmetic data loss; it silently removes a core
configuration before the ledger is created. Workaround: turn on teams before
entering title, threshold, or increments. That workaround is not discoverable
in the UI.

## Passing verification evidence

### Clean install, static checks, and exact build

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 105 packages audited; 0 vulnerabilities |
| `npm test` | PASS — 7/7 Vitest domain tests |
| `npx tsc --noEmit` | PASS |
| Lint | No lint script/configuration is present in this Vite/TypeScript repository |
| `npm run build` | PASS — production `dist/` generated |
| `npx playwright test --workers=1 --reporter=line` | PASS — 14/14, 46.5 s (desktop Chromium and 390×844 mobile) |

The browser suite covers creation/scoring/reload, 12-player QR snapshots and
guest non-editability, keyboard Enter scoring, ten rapid scores with an audit
trail after reload, malformed-storage recovery, update-toast behavior, legal
routes, offline reload, and axe scans.

### Independent live product exercise

I separately exercised the production URL in fresh desktop (1440×900) and
mobile (390×844) Chromium contexts, with console/page-error capture and
request-origin capture. Apart from the blocking setup-state case above, both
viewports passed:

- required two-player and duplicate-name validation, with usable error text;
- team totals plus a lap threshold of 2, three `+1` changes (`1 lap · position
  1 of 2`), a `-4` manual correction, and compensating Undo;
- round advance, QR/share snapshot, and a separate guest page with no score or
  adjust controls;
- persistence after reload and offline reload after service-worker control;
- no page or console errors; all normal free-core requests were only to
  `https://game-night-score-ledger.sociobot.in`;
- axe: **0 serious/critical** violations in each viewport.

Keyboard-only smoke check on 390px reached **Start a ledger** with Tab and
showed the intended `rgb(255, 214, 122) solid 3px` focus outline. A
`prefers-reduced-motion: reduce` context reduced transition duration to
`0.00001s`; primary buttons are 46px high.

### PWA/offline, accessibility, and performance

- The live page gained a service-worker controller; local and live explicit
  offline reloads retained the saved ledger.
- The tested update path creates a waiting version and exposes the explicit
  “A fresh ledger version is ready.” action. The generated service worker has
  a content-versioned cache and does not precache deployment-only
  `staticwebapp.config.json`.
- Local production preview passed `verify-url.sh`: 787ms network-idle load,
  zero errors, `<title>`, `lang=en`, exactly one `<h1>`, `<main>`, and zero
  images without `alt`.
- Lighthouse desktop local preview: Performance **100**, Accessibility **100**,
  Best Practices **100**, SEO **92**; FCP **0.4 s**, LCP **0.4 s**, CLS
  **0.001**, TBT **0 ms**.
- Production build sizes: entry JavaScript 43,066 B raw, lazy QR JavaScript
  25,881 B, CSS 13,426 B, self-hosted fonts 70,544 B total, hero WebP 39,550 B.
  Each is within the stated static-PWA budget (initial JS <200 KB, CSS <50 KB,
  fonts <120 KB, hero <300 KB).

### Deployment identity, privacy, and response policy

The live deployment is the candidate build, not merely similar content:

| File | Local SHA-256 | Live SHA-256 |
| --- | --- | --- |
| `index.html` | `b75bbf00c1d3c3ddd17b44e57ca1fbb48781eb41361f74501940b0931503673c` | `b75bbf00c1d3c3ddd17b44e57ca1fbb48781eb41361f74501940b0931503673c` |
| `sw.js` | `9b29eb3aaeae6da6def4ca0918ccb9dda2bac1468f73cc53a1faf4aecb59bc47` | `9b29eb3aaeae6da6def4ca0918ccb9dda2bac1468f73cc53a1faf4aecb59bc47` |

Live headers verified:

- `sw.js` and `manifest.webmanifest`: `Cache-Control: no-cache`; manifest:
  `application/manifest+json`.
- Hashed entry JavaScript: `public, max-age=31536000, immutable`.
- CSP confines assets to self and allows only the declared Sociobot licensing
  endpoint for connection/form action; HSTS, `X-Frame-Options: DENY`, COOP,
  `nosniff`, strict referrer policy, and restrictive Permissions-Policy are
  present.
- No third-party runtime scripts/fonts or analytics were observed. Normal
  scoring is local-first; the only configured external destination is the
  disclosed optional Sociobot license checkout/verification endpoint. `/privacy`
  and `/terms` are present and covered by browser tests.

## Required next step

Preserve title, lap threshold, and increment state when toggling teams (and
regression-test both toggle directions). Re-run this report's P1 reproduction,
then the clean test/build and live PWA verification before changing the verdict.
