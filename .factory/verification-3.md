# Verification 3 — FAIL

**Candidate:** `82cddb7033b2bd60c4ae216123dac7c61bdf6d43`  
**Audited:** 2026-08-27 UTC  
**Target:** `https://game-night-score-ledger.sociobot.in`

## Verdict

**FAIL.** The ordinary ledger workflow is usable and the deployed static artifacts match the candidate, but the release misses hard acceptance requirements:

1. The share dialog produces two axe **serious** accessibility violations.
2. QR sharing fails at the documented 12-player upper bound with only 12 score events.
3. The PWA update contract is incomplete: cache name is not versioned and an observed worker update does not show the required update toast.

No product-source files were changed during verification.

## Evidence

### Reproducible local gates

Run in a clean dependency tree:

```bash
npm ci
npm test
npx tsc --noEmit
npm run build
npx playwright install chromium
npm run test:e2e
```

All commands passed.

- `npm ci`: 103 packages installed; `npm audit`: 0 vulnerabilities.
- Unit tests: 5/5 passing.
- TypeScript strict check: passing.
- Exact production build: passing; `dist/` includes root, legal routes, manifest, SW, icons and offline page.
- Repository Playwright suite: 2/2 passing on mobile Chromium, including its normal offline reload check.

Build output/budgets: main JS 36,173 B raw, lazy QR JS 25,881 B raw, CSS 13,321 B raw, self-hosted fonts 70,544 B total, hero WebP 39,550 B. The initial JS and CSS meet the stated 200 KB/50 KB budgets.

Independent Lighthouse mobile-style run against local production preview (Chromium 1208, `--preset=perf`): Performance **97**, Accessibility **100**, Best Practices **100**, SEO **100**; FCP 2.0 s, LCP 2.0 s, CLS 0.001, TBT 10 ms, transfer 106 KiB. This landing-page score does not cover the open share dialog failure below.

### Host, guest, scoring and recovery

The following passed in independent browser checks:

- Created named two-player ledgers; persisted after reload; normal live smoke on the deployed site scored `Live Ada` to 10 and rendered a QR with no console errors.
- Setup validation has clear recovery: one player gives “Add at least two player names”; duplicate case-insensitive names gives a distinct-name error; lap threshold 1 gives the documented 2–100,000 error; score adjustment 0 gives the documented range error and a subsequent `+1` is saved.
- A malformed nested import is not recovered: `{"version":1,"id":"x","hostKey":"x","players":[{"id":"a","name":"Ada"},{"id":"b","name":"Bo"}],"events":[null]}` is accepted and saved, produces `Cannot read properties of null (reading 'playerId')`, and after reload shows “View link is damaged” rather than the home screen. The corrupt saved record remains and causes every home render to fail.
- Normal QR snapshots omit `host=`/the host key and have no increment or undo control. However, the guest snapshot incorrectly renders a focusable, inert `Adjust ±` control for every player (the pseudo-session is active but there is no host session to process its click).
- Domain tests cover raw totals, team total (Mint 155), positive and negative lap positions, unicode snapshot encoding, auditable compensating undo, and import-as-new-host-copy.
- CSV download contains timestamp, round, player/team, delta, running total and note. PNG export had a valid PNG signature and JSON export contained complete session data.
- Offline reload after the app shell was controlled by the service worker restored a saved ledger and score 10 without console errors.
- `prefers-reduced-motion: reduce` changes animation/transition durations to `1e-05s` and scroll behavior to `auto`.

### Accessibility and interaction checks

- Home, setup, active ledger and legal pages have one H1, `main`, `lang`, title, labels and a skip link. Keyboard Tab reveals the designed 3 px gold focus outline; Enter opens the share dialog and Escape returns focus to Share view.
- The 390 x 844 and 1440 x 1000 layouts had no horizontal overflow (scroll width equaled viewport width). The visual system, self-hosted type and original asset match `.factory/design.md`.
- Minor observations: on 390 px, the contextual Adjust controls are only 38 x 44 px after their visible label is visually shortened, header mark link is 36 x 36 px, and footer legal links are 20 px tall. The two Adjust controls have the same accessible name (`Adjust ±`) rather than naming their player.

**Hard failure — axe share dialog:** Running `@axe-core/playwright` after opening Share view reports these serious violations:

| Rule | Target | Exact finding |
| --- | --- | --- |
| `aria-prohibited-attr` | `#qr` | The plain `div` gains `aria-label="QR code for a view-only score snapshot"`; aria-label is prohibited without a valid role. |
| `scrollable-region-focusable` | `.share-url` | The overflow-scrollable URL paragraph has no focusable content and is not itself keyboard-focusable. |

The supplied test only runs axe after closing the dialog, so it misses these violations. The acceptance contract requires zero serious/critical axe findings.

### QR upper-bound test — hard failure

The product advertises setup for 2–12 players and the brief calls for a share-by-QR PWA. I created the maximum 12 players, used 32-character player names and 24-character team names allowed by the form, added one `+1` event to each, then opened Share view. Result:

```text
events: 12
snapshot URL length: 3774
QR canvas count: 0
dialog text: This session is too large for a QR code. Copy the view link instead.
```

The fallback is honest, but it is not a QR share at a supported ledger size and it happens with only twelve events, not an unusual history. It fails the brief's share-by-QR workflow at the stated upper bound.

### PWA/update and caching checks

- Manifest passes basic inspection: standalone display, 192/512/maskable icons, matching colors and `/?v=1` start URL. Service worker precaches shell/assets and local IndexedDB persistence survives close/reload.
- `context.setOffline(true)` after a controlled first load successfully reloaded an active saved ledger. (Playwright's offline emulation did not update `navigator.onLine`, so the visual status rail still said “Saved locally”; the actual offline reload is the evidence.)
- **Hard failure — update signaling/versioning:** built and live `sw.js` use the fixed cache name `score-ledger-v1`. A simulated byte-changed SW response followed by `registration.update()` activated without exposing `#toast` (`toast.hidden === true`, empty toast text). `skipWaiting()` is called during install, which races past the only update-notice branch. This does not meet the required versioned cache name plus in-app “update available” toast contract and risks stale entries accumulating in the same cache across releases.
- **Deployment cache finding:** live `/assets/main-I9mfpdsi.js`, CSS and hashed lazy chunk all return `Cache-Control: public, must-revalidate, max-age=30`, not long-lived immutable caching. The manifest is served as `application/octet-stream` rather than a manifest JSON MIME type. These are release configuration defects relative to the stated static-PWA cache policy.

### Privacy, requests, headers and live parity

- Fresh live load made only same-origin requests: document, local hero image, JS/CSS, two self-hosted fonts and icon. There was no analytics/tracker or third-party runtime/CDN request. Source inspection finds only the expected Sociobot billing verification fetch, which is dormant without a locally stored license.
- Privacy and terms render successfully and describe local storage, snapshot sharing and billing-token behavior. No card processor is embedded.
- Live HTTPS headers include HSTS, `Referrer-Policy: strict-origin-when-cross-origin` and `X-Content-Type-Options: nosniff`; no CSP or frame-ancestors/X-Frame-Options header was observed.
- Deployment parity is confirmed for index, main/lazy JS, CSS, service worker, manifest, offline page, privacy/terms, both fonts and hero WebP: SHA-256 values downloaded from production equal the corresponding `dist/` files. The live normal scoring/QR smoke also passed with zero console errors.

## Defects by severity

### High

1. **QR sharing does not work for a supported 12-player ledger.** Repro above; it falls back to copy-only at 3,774 characters with twelve events. Compress/minimize snapshots, use a compact QR payload/short local share mechanism, or lower/document the supported QR envelope before release.
2. **Serious accessibility violations in Share view.** `#qr` has an invalid ARIA label and the scrollable share URL cannot be keyboard-scrolled/focused. Add a valid semantic role/alternative for the QR and make the scrollable URL focusable or replace it with a selectable input/control. Re-run axe while the dialog is open.
3. **PWA update contract fails.** Fixed `score-ledger-v1` cache name and unconditional install-time `skipWaiting()` prevent the required observed update-available notice. Version the cache per build and retain an explicit user-driven update flow/toast.
4. **Guest “View only” controls are inert rather than absent.** `renderSnapshot()` passes an active pseudo-session to `scoreCard()`, which renders `Adjust ±`; clicks silently do nothing because there is no `currentSession`. Remove host-edit controls from snapshot rendering.
5. **Malformed import can strand local data.** Import validation accepts nested-invalid data such as `events: [null]`, persists it, then `scoreMap()` throws while rendering saved ledgers. Validate complete import structure before persistence and provide a recovery/delete path for already-corrupt records.

### Medium

1. **Live hashed assets are cached for only 30 seconds and are not immutable.** Configure long-lived immutable caching for content-hashed assets; keep HTML/SW short-lived.
2. **Touch/name quality gaps on 390 px.** Header home link, footer legal links and visible Adjust button width are below the 44 px target; duplicate unscoped `Adjust ±` accessible names do not identify the player.
3. **Manifest is deployed as `application/octet-stream`.** Serve it as `application/manifest+json` (or accepted JSON MIME) for reliable platform recognition.

### Low

1. **No CSP or clickjacking protection header observed.** This was not a brief gate, but a security hardening follow-up is appropriate.

## Required disposition

Do not release this candidate as verified. Fix all High defects, then rerun the clean gates, open-dialog axe scan, 12-player QR scenario, SW update-toast scenario, offline reload, and live header/cache checks.
