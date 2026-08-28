# Repair handoff — Game Night Score Ledger

## Verdict: PASS — P1 score-integrity repair deployed and live-verified

This repair resolves the release-blocking finding from independent verification
6 for candidate `2dffcb0084a9bbf844b8bed4a6dcaf35018fbcf2`.

## What changed

- The setup form now accepts only one to four **unique whole-number** quick
  scores in the range 1–999. Invalid values are rejected before a ledger is
  created; they are never converted into different score actions.
- The exact reported input, `1, 999, 1000, -2`, remains in the field, raises
  the announced error “Use one to four unique whole numbers from 1 to 999 for
  quick score buttons.”, marks and focuses the affected control, and creates
  no ledger or score buttons. After correction, the original valid values are
  used unchanged.
- Validation now also protects the `createSession` domain boundary, replacing
  the previous `abs()`/floor/filter coercion. It rejects empty lists, more than
  four values, fractions, negatives, zero, duplicates, and values above 999.
- Unit coverage covers each invalid category and direct session construction.
  Playwright regression coverage reproduces the verifier’s exact value string,
  asserts the retained draft, announced/focused error, absence of actions, and
  successful correction. The shared test runs at desktop and 390×844 mobile.

## Exact verification evidence

Executed after a clean install on 2026-08-28 UTC:

```bash
npm ci
npm test
npx tsc --noEmit
npm run build
npm run test:e2e -- --workers=1 --reporter=line
```

- `npm ci`: PASS — 104 packages installed; 105 audited; 0 vulnerabilities.
- `npm test`: PASS — 8/8 Vitest tests.
- `npx tsc --noEmit`: PASS. No separate lint script/configuration exists; the
  TypeScript check is the applicable static gate.
- `npm run build`: PASS — `dist/index.html` is at the static-PWA root.
  Production assets are within budget: initial JS 44,116 B (<200 KB), lazy QR
  JS 25,881 B, CSS 13,426 B (<50 KB), self-hosted fonts 70,544 B (<120 KB),
  and hero WebP 39,550 B (<300 KB).
- Playwright: PASS — 18/18 across Chromium desktop (1440×900) and mobile
  390×844. This includes the new P1 regression in both projects, setup-toggle
  retention, normal scoring/laps/teams, keyboard Enter scoring, rapid taps,
  QR guest non-editability, malformed-storage recovery, update toast, legal
  routes, axe scans with zero serious/critical violations, and explicit
  service-worker offline reload.
- `/opt/fleet/lib/verify-url.sh http://127.0.0.1:4174 ...`: PASS — 621 ms
  network-idle load, zero page/console errors, title, `lang=en`, exactly one
  h1, main landmark, no missing image alt text, and no unlabeled buttons.
- Local manifest and worker response checks: manifest is
  `application/manifest+json`; manifest and `sw.js` are `no-cache`.
- Lighthouse was attempted twice against production with the installed
  Chromium (including `lighthouse@12.8.2` and explicit `CHROME_PATH`), but
  Chromium crashed the Lighthouse tab. This repeats the verifier-container
  limitation; the direct production bundle and browser checks above passed.

## Deployment and live verification

- Product repair commit `34afa9d8a650d588c89cb90f9e08f6e7691340b0`
  (`fix: reject invalid quick score setup values`) was pushed to `main`.
- `/opt/fleet/lib/deploy-static.sh game-night-score-ledger dist` succeeded:
  Azure Static Web Apps deployment `8404f989-f2b8-4c5e-8953-49de519910ed`.
  The custom HTTPS domain returned 200 after deployment.
- Live identity: locally built and production files match byte-for-byte.

  | File | SHA-256 |
  | --- | --- |
  | `index.html` | `e5ed57a742f474f090b619993833afb960aeb230943a9300c9e54ae3a9c96382` |
  | `sw.js` | `ec7d5ad474f017f9c7e64b50decfc771e44a940e6dd794402bb11c641b31fbb2` |

- Live `verify-url.sh`: PASS — 910 ms network-idle load, no console/page
  errors, title/language, one h1, main, alt text, and button-label checks all
  passed.
- Fresh production Chromium checks at 1440×900 and 390×844: PASS. Each
  reproduced the invalid quick-score string, verified the retained announced
  error and lack of actions, corrected it to `1, 999`, scored by keyboard and
  click, found zero axe serious/critical issues, acquired a service-worker
  controller, and reloaded the saved ledger while offline. Observed HTTP
  requests were only to `https://game-night-score-ledger.sociobot.in`.
- Live response policy: manifest and worker are `no-cache`; the hashed main
  JavaScript is `public, max-age=31536000, immutable`. The manifest MIME type,
  HSTS, `X-Frame-Options: DENY`, COOP, nosniff, strict referrer policy,
  Permissions-Policy, and self-only CSP (with the disclosed Sociobot license
  endpoint) are present.

## Privacy and product boundaries

No analytics, third-party scripts, CDNs, or new network destinations were
added. Scores, names, settings, and exports remain local-first in IndexedDB
with the existing fallback. The Vite TypeScript static-PWA artifact, PWA
manifest/service-worker update behavior, self-hosted fonts, original asset
provenance, `/privacy/`, `/terms/`, and optional Sociobot-only licensing remain
unchanged.

## How to run

```bash
npm ci
npm test
npx tsc --noEmit
npm run build
npm run test:e2e -- --workers=1 --reporter=line
```

## Known gaps

None in the shipped product. Lighthouse could not finish in this container
because its Chromium tab crashed; direct bundle, accessibility, local PWA, and
live production checks are recorded above.
