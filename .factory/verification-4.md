# Independent verification 4 — FAIL

**Candidate:** `5662d2e697568e2a889b021fdd9b09bdd608b6da`  
**Live URL:** <https://game-night-score-ledger.sociobot.in/>  
**Verified:** 2026-08-27 (UTC)  
**Scope:** clean-checkout production build and deployed PWA; product source was not modified.

## Release verdict

**FAIL.** The live site is byte-for-byte serving the candidate application, but
it cannot install its service worker or reload offline. In addition, rapid
score input can lose events and produce a wrong displayed total. Both break the
brief's core promise of an auditable, offline table scoreboard.

## Blocking defects

### P1 — live PWA service worker fails to install; offline reload fails

`dist/sw.js` precaches `/staticwebapp.config.json`. The deployed static host
does not expose that configuration file:

```text
GET https://game-night-score-ledger.sociobot.in/staticwebapp.config.json -> 404
```

The service worker uses `cache.addAll(PRECACHE)`, so this non-OK response
rejects installation. Fresh Chromium evidence after a network-idle load and
three-second settle:

```json
{
  "supported": true,
  "controller": false,
  "registrations": []
}
```

After switching the same fresh context offline, `page.reload()` failed with
`net::ERR_INTERNET_DISCONNECTED`. This is a deployed-product defect, not a
candidate/deployment mismatch: SHA-256 values for live `index.html`, `sw.js`,
`manifest.webmanifest`, `assets/main-BxeLhbWK.js`,
`assets/main-CzEKpCxk.css`, and `assets/browser-CqDbEFy1.js` all match the
fresh `dist/` build exactly. The live `sw.js` SHA-256 is
`c1994436af17dece0580d2fe1b9fef63403a3163c1bbaa4c07dcf8fc412ea344`.

### P1 — rapid quick-score input is not reliable

On the live candidate, I created a two-player ledger and dispatched ten rapid
`+1` quick-score clicks for Ada, then allowed 350 ms for pending persistence.
Ten independent fresh-context runs produced five wrong ledgers:

| Run | Displayed total | Audit events |
| --- | ---: | ---: |
| 1 | 9 | 10 |
| 3 | 5 | 5 |
| 4 | 9 | 9 |
| 5 | 6 | 6 |
| 6 | 7 | 7 |

The remaining five runs reached 10. This is reproducible against both the
local production preview and the live candidate. A busy host can tap a quick
increment repeatedly; silently dropping score events or showing a total that
does not equal its audit trail is unacceptable for the job-to-be-done.

## Checks that passed

### Clean checkout and build

```text
npm ci                         PASS (104 packages audited; 0 vulnerabilities)
npm test                       PASS (7/7 Vitest domain tests)
npx tsc --noEmit               PASS
npm run build                  PASS; dist/ produced
npm run test:e2e               PASS (6/6) after `npx playwright install chromium`
```

The initial E2E invocation could not launch because the disposable verifier
image lacked Playwright Chromium; after installing the repository-documented
browser prerequisite, all six tests passed. There is no lint script in
`package.json`.

The passing browser suite covers normal creation/scoring/persistence, 12-player
QR sizing, view-only guests, keyboard score activation, damaged stored-record
recovery, a waiting service-worker update, legal routes, and local-preview
offline reload. The live service-worker failure above is outside that preview
environment because the preview serves `staticwebapp.config.json` while the
production host does not.

### Independent functional checks

- Normal local production-preview flow: created teams and a 100-point wrap,
  scored Ada to `20`, adjusted `-25`, and observed `-5`, `-1 lap`, and
  `position 95 of 100`.
- Valid exports downloaded as `game-night.csv`, `game-night-score.png`, and
  `game-night.json`.
- QR guest URL was 163 characters for the basic ledger, showed “View only”,
  and contained zero Add/Adjust score controls.
- Simultaneous independent two-tab `+1` changes merged as two events with
  scores `[1, 1]` after reload.
- Recovery feedback passed for blank players, duplicate names, lap threshold
  `100001`, and malformed JSON import; each returned a specific recoverable
  error without crashing.
- A live 390px smoke flow created a ledger and scored `+10`; it emitted no
  console/page errors and made requests only to
  `https://game-night-score-ledger.sociobot.in` during the free core flow.

### Accessibility, responsive behavior, privacy, and policy

- Local production preview axe scan: **0 serious/critical** findings at 1440px
  desktop and at 390px mobile.
- At 390px, `scrollWidth === innerWidth === 390`; reduced-motion transitions
  reduce to `1e-05s`; no browser/page errors occurred in either viewport.
- Keyboard focus is visibly designed: focused skip link measured a 3px outline
  and became visible (`transform: none`). The repository E2E keyboard
  Enter-score test also passed.
- Live response headers include CSP, `X-Frame-Options: DENY`, COOP,
  `Permissions-Policy`, `nosniff`, `strict-origin-when-cross-origin`, and HSTS.
  Live `sw.js`/manifest are `no-cache`; hashed JS/CSS are one-year immutable;
  manifest MIME is `application/manifest+json`.
- No third-party runtime resources or outbound core-flow requests were
  observed. Fonts and imagery are self-hosted. Privacy/legal routes return
  200 and have a main landmark and one h1 in the passing suite.

### Budgets

Fresh production output, raw bytes:

| Asset | Size | Budget result |
| --- | ---: | --- |
| Initial `main` JS | 42,657 B | PASS (< 200 KB) |
| Lazy QR JS | 25,881 B | PASS |
| CSS | 13,426 B | PASS (< 50 KB) |
| Two fonts total | 70,544 B | PASS (< 120 KB) |
| Hero WebP | 39,550 B | PASS (< 300 KB) |

## Required next steps

1. Remove deployment-only configuration files from the service-worker
   precache (or make every precached URL deployable), then verify a fresh live
   registration, controller, install/update behavior, and offline reload.
2. Serialize/debounce quick-score persistence or otherwise make each tap an
   atomic event before release. Add a regression test that performs rapid
   repeated score activations and asserts both the total and event trail.
3. Redeploy, then rerun this verification against the new immutable asset
   hashes and live URL.
