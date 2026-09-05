# Verification 8 update — Game Night Score Ledger

## Current independent QA verdict

**FAIL — 1 P2 external finding; 0 untested claims.**

Independent verification reviewed implementation
`18506cc3e3e8766523dfd6eac5ad3d1799703489` with report/documentation SHA
`ef36303ece80be1b4f62ae3e7c4f79e971f4f586`. The deployed `index.html` and
`sw.js` exactly match that implementation build. Fresh desktop and 390px
phone checks, all 22 declared claim commands, 8 unit tests, typecheck, build,
and both 9-test browser projects pass. The free local-first ledger, isolated
demo, offline reload, legal pages, designed 404, headers, metadata, focus,
reduced motion, and axe checks pass.

The visible **Buy Host pack** public path reaches
`https://api.sociobot.in/api/v1/products/game-night-score-ledger/checkout`,
which returns HTTP 404. This is a billing-operator registration dependency and
a broken optional purchase path, so verification is FAIL until the $12 Host
pack is registered and hosted checkout works. Product code was not changed in
verification. See `.factory/verification-8.md` for complete evidence.

---

# Repair 5 handoff — Game Night Score Ledger

## Verdict

PASS for the product scope. The only remaining external dependency is billing
offer registration, described below. The free product, demo, paid-feature
boundary, and license handling are implemented.

- Production: <https://game-night-score-ledger.sociobot.in>
- Implementation SHA deployed: `18506cc3e3e8766523dfd6eac5ad3d1799703489`
- Verification-tooling SHA: `be93d46fa9b541926e8a5f0a355c45b31093fb9f`
- The final handoff/evidence commit is report-only and does not change `dist/`.

The deployed `index.html` and `sw.js` SHA-256 values match the build from the
implementation SHA:

| File | SHA-256 |
| --- | --- |
| `index.html` | `24e7a3ba5dd062cd6e14188bd8d20cc07340d6127ea5dd25179661428ca2bf1c` |
| `sw.js` | `4b67011a4cb9baeed347a432ef526e7684ac9d3b9dcdadb5ec8b5824e0db8615` |

## What changed

- Added `/demo` and the first-screen **Try it with sample data** action.
- Seeded a four-player, two-team, three-round sample with laps and eight score
  events. Demo changes stay in memory under `demo:sample-session`.
- Added the persistent demo label, **Reset demo**, and **Start for real**.
- Rewrote the landing page around the score-tracking job, host audience, first
  action, three product facts, how it works, limits, and Host pack scope.
- Added visible header navigation to every app-rendered route.
- Added complete root, demo, legal, and 404 metadata. The social image is a
  1200×630 crop of the existing original product art.
- Added the designed 404 page and a Static Web Apps 404 response override.
  Unknown live paths now return that page with HTTP 404.
- Added `.factory/claims.json` with 22 unique claim IDs and one observable
  Playwright test per ID. Every command was also run separately.
- Added `.factory/demo.md`, `.factory/copy-audit.md`, and the 92-character
  verb-first catalog description.
- Expanded browser coverage for metadata, nav, all page structures, and axe.
- Preserved the existing scoring, teams, laps, QR, exports, import, offline,
  update, rapid-input, recovery, and licensing behavior.

## First screen and demo evidence

Fresh production desktop (1440×900) and phone (390×844) contexts both report:

- Job: **Track board-game scores with laps and teams**.
- Audience: hosts running long games who need clear changes during play.
- First action: **Try it with sample data**.
- No horizontal overflow, console error, page error, or non-product-origin
  request during the free demo flow.

In both contexts the action opened a populated four-player ledger. The demo
label stayed visible. Maya began at 142, changed to 152 through keyboard score
input, and returned to 142 after reset. IndexedDB and localStorage canaries in
the real namespace remained unchanged. Both contexts then reloaded `/demo`
offline successfully.

The same run found zero serious or critical axe violations, a visible 3px gold
focus outline, and a reduced-motion transition duration of `1e-05s`. Evidence:
`/work/.evidence/live-cold-browser.json` and the live desktop/phone screenshots.

## Quality gates

Run from the repository root with Node.js 20 or newer:

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run test:e2e -- --workers=1 --reporter=line
npm run test:claims -- --project=desktop-chromium --workers=1 --reporter=line
node scripts/verify-live.mjs https://game-night-score-ledger.sociobot.in /work/.evidence
```

Results on 2026-09-05 UTC:

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 104 packages installed; 0 vulnerabilities |
| `npm test` | PASS — 8/8 Vitest tests |
| `npm run typecheck` | PASS |
| `npm run build` | PASS — `dist/` created with root `index.html` |
| Browser regression | PASS — 18/18 across desktop and 390px phone |
| Claim suite | PASS — 22/22 desktop sandbox tests |
| Every command in `.factory/claims.json` | PASS — 22/22 separately; see `claim-commands.log` |
| Worker URL verifier | PASS — live root and `/demo`; no errors |
| Live cold-browser verification | PASS — desktop and phone |
| Live unknown route | PASS — designed page with deliberate HTTP 404 |

The route axe checks cover root, demo, Privacy, Terms, and 404, while the core
flow checks the open share dialog and populated ledgers. All have zero serious
or critical findings.

## Performance and delivery

Lighthouse against the production build preview completed after Chromium was
started with `--disable-dev-shm-usage`:

| Category or metric | Result |
| --- | ---: |
| Performance | 99 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |
| FCP | 1.4 s |
| LCP | 1.9 s |
| CLS | 0.035 |
| TBT | 0 ms |

| Initial asset | Raw size | Budget |
| --- | ---: | ---: |
| Entry JavaScript | 48,176 B | ≤ 200 KB |
| CSS | 16,758 B | ≤ 50 KB |
| Two fonts | 70,544 B | ≤ 120 KB |
| Hero WebP | 39,550 B | ≤ 300 KB |

Live headers keep HTML revalidated, hashed assets immutable for one year, and
the manifest/service worker uncached. The manifest is served as
`application/manifest+json`. CSP, HSTS, `nosniff`, `DENY` framing, COOP,
strict referrer policy, and restrictive permissions policy remain active.

## Claims and sandbox

`.factory/claims.json` contains 22 declared claims. Each ID appears in exactly
one test title and each command passed from the documented `/demo` entry point.
The suite covers demo isolation, offline reload, same-origin privacy, no-account
use, player boundaries, laps, team totals, audit/undo/rapid input, two-tab
merge, QR guest behavior, three exports, JSON import, PWA install data,
persistence, free scope, Host pack terms, local license handling, revocation,
and data deletion.

The offline claim owns and closes a separate browser context. No claim test
closes the shared Playwright browser.

## Current review findings

| Finding | Disposition |
| --- | --- |
| F1 sample sandbox missing | Fixed and tested live; `/demo`, reset, exit, persistent label, and real-data isolation pass. |
| F2 claims registry/tests missing | Fixed; 22 registered claims and 22 separately passing commands. |
| F3 slogan/non-plain first screen | Fixed; job, audience, sample action, outcome note, and facts are visible before scrolling. |
| F4 metadata incomplete | Fixed on root, demo, legal, and 404 routes; demo server response has its own title. |
| F5 no real 404 | Fixed; unknown live paths return designed content with HTTP 404 and recovery links. |
| F6 no header navigation | Fixed; Demo, New ledger, and Privacy links appear on every rendered route. |

## Earlier review and verification findings

| Earlier finding | Current proof |
| --- | --- |
| Malformed import could strand the app | Complete schema validation and invalid-storage recovery regression pass. |
| Guest snapshot exposed inert controls | 12-player and demo guest tests show no score or adjustment controls. |
| Share dialog serious axe issues | Open-dialog axe regression passes with zero serious/critical findings. |
| 12-player QR was too large | Boundary QR test creates a scannable image below the documented URL envelope. |
| Update toast/cache versioning failed | Versioned worker and explicit waiting-worker toast regression pass. |
| Deployment-only file broke SW install | It is excluded from precache; local and live controlled offline reload pass. |
| Hashed assets, manifest MIME, security headers | Verified live after this deployment. |
| Small/ambiguous touch controls | Controls and links meet 44px targets; player adjustment names remain specific. |
| Rapid score taps lost events | Rapid ten-tap regressions pass in core and claim suites. |
| Team toggle discarded setup values | Both toggle directions preserve title, lap, and quick-score values. |
| Invalid quick scores were changed silently | Invalid values remain focused and unchanged with an announced error. |

## Known external dependency

The public Sociobot checkout route returned HTTP 404 during this repair, so the
separate billing operator still needs to register the existing $12 one-time
Host pack. `/work/.evidence/billing-offer.json` contains the requested public
offer metadata. The app retains the exact checkout/verification paths, restore
field, cached first paint, revoked-license lock, free core, and legal terms.
No provider credential is present in the repository or evidence.

The deployment tool briefly created its normal local `.env` credential cache.
It was removed immediately and was never read, reported, staged, or committed.
