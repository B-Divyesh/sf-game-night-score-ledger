# Independent verification — FAIL

**Verified:** 2026-08-27  
**Candidate:** `82cddb7033b2bd60c4ae216123dac7c61bdf6d43` (clean checkout)  
**Deployment:** https://game-night-score-ledger.sociobot.in/

This is an independent verifier report. No product source was changed. The
candidate is **FAIL** because a malformed-but-accepted JSON backup can leave
the local-first app unable to render or recover its home screen. A second
product defect exposes inert score-edit controls in the promised view-only
guest screen.

## Quality gates

Executed from the clean candidate checkout, with a lockfile reinstall:

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 103 packages installed; npm audit reported 0 vulnerabilities. |
| `npm test` | PASS — Vitest: 1 file, 5/5 tests. |
| `npx tsc --noEmit` | PASS. |
| `npm run build` | PASS — Vite build plus service-worker injection; `dist/` produced. |
| `npx playwright install chromium` | PASS. |
| `npm run test:e2e` | PASS — 2/2 Chromium mobile scenarios, including saved-ledger offline reload. |

Built asset budget is within the static-PWA limits: initial main JS 36,173 B
raw (the 25,881 B QR chunk is lazy), CSS 13,321 B, self-hosted fonts 70,544 B,
and hero WebP 39,550 B. Lighthouse against the local production preview
generated 99 Performance / 100 Accessibility / 100 Best Practices / 100 SEO,
with FCP 1.5 s, LCP 1.8 s, CLS 0.001 and TBT 0 ms. Lighthouse wrote the result
but its final Chrome tab crashed during shutdown, so this is informational
measurement rather than a clean Lighthouse process pass.

## Product exercise

### Passing evidence

- Created a normal two-player team ledger with a wrapping threshold of 100 and
  four quick increments. Added +500, made a named -1 correction, and undid it:
  score changed from 500 to 499 and the audit trail retained the compensating
  event.
- CSV downloaded with the expected seven-column header and included the named
  correction. QR share links contained a `#view=` snapshot and no `host=` key.
- Two host tabs concurrently added +10 to Ada and +5 to Bo. After reload the
  persisted ledger had Ada 10, Bo 5, and two events.
- Setup rejected fewer than two players and duplicate names. A zero manual
  correction reported “Enter a score change between -999999 and 999999.”
- An unrelated JSON file reported “Choose a Score Ledger JSON export.” A
  malformed `#view` route displayed the recovery error screen.
- Desktop 1440×1000 and phone 390×844 ledger layouts were visually checked.
  On phone, a quick-score target measured 52×48 CSS px. Tab order begins Skip
  to ledger → brand → Host pack → Start a ledger; focus is a visible 3 px ring.
  Under reduced motion, button transition duration computed to 0.01 ms.
- `@axe-core/playwright` found zero serious/critical findings on local mobile
  home and the shipped end-to-end session; it also found zero on the live home.
  Console/page errors were zero during normal local and live paths.
- The local PWA registered, loaded the saved ledger with
  `context.setOffline(true)`, and reloaded offline in the repository e2e test.
  A separate versioned-service-worker fixture proved that a changed worker
  raises the in-app “A fresh ledger version is ready.” toast.

### Failing/recovery evidence

1. Imported this JSON, which passes `validateImported` because it has the
   shallowly checked top-level fields:

   ```json
   {"version":1,"id":"x","hostKey":"x","players":[{"id":"a","name":"Ada"},{"id":"b","name":"Bo"}],"events":[null]}
   ```

   It is saved before rendering fails with `Cannot read properties of null
   (reading 'playerId')`. Reload then displays “View link is damaged” instead
   of the home screen; the in-app Return home route attempts to render the
   malformed saved session and fails again. There is no in-product repair or
   deletion route, so the user must clear site storage outside the product and
   loses all saved ledgers.

2. Created a guest snapshot and opened it in a second page. It correctly says
   “View only”, but renders two focusable **Adjust ±** buttons (one per player).
   They are inert because there is no `currentSession`, rather than being
   absent/disabled. This contradicts the table-facing guest-view promise and
   is confusing for keyboard and touch users.

## Defects

### P1 — malformed accepted import can soft-brick the app and strand local data

`validateImported` validates only version, ids, player names and that `events`
is an array. It neither validates event objects/fields nor validates the rest
of the persisted session before `saveSession`. A `null` event makes
`scoreMap()` throw on every home render after reload. Validate the complete
schema before persistence, reject bad nested values, and add an in-app
quarantine/delete/recovery path for records that cannot be rendered.

### P2 — view-only snapshots expose non-working score-edit buttons

`renderSnapshot()` creates a pseudo session with `status: "active"`, so
`scoreCard()` renders `custom-score` controls. The click handler silently does
nothing without a host session. Do not render score controls for snapshots
(and test the guest interaction contract).

### P2 — live delivery misses caching and defense-in-depth headers

The live root, JS, CSS, font, and service worker all use
`cache-control: public, must-revalidate, max-age=30`; hashed assets are not
long-lived immutable as required by the performance contract. The manifest is
served as `application/octet-stream`. Live responses include HSTS,
`nosniff`, and `strict-origin-when-cross-origin`, but do not include CSP,
`frame-ancestors`/X-Frame-Options, Permissions-Policy, or COOP. These are
deployment configuration issues and require factory/deployment remediation;
the repository contains no static-host header configuration.

## Privacy, security, and deployment parity

- Live first-load request capture contained only
  `https://game-night-score-ledger.sociobot.in` assets: document, CSS, module,
  local fonts, hero, and icon. No analytics, trackers, CDNs, or outbound
  requests occurred. Source inspection confirms the license endpoint is only
  contacted after a license is present/restored.
- Privacy and terms routes exist and describe local browser storage, snapshots,
  export, and optional licensing. No payment provider is embedded.
- `diff -u dist/index.html <live root>` and `diff -u dist/sw.js <live sw>`
  were empty. The live root references the same hashed JS/CSS assets and their
  byte sizes match the build, so the tested deployment matches this candidate
  application artifact.
- Live PWA smoke check: correct title and h1, active service-worker controller
  scoped to `/`, zero console/page errors, zero axe serious/critical findings.

## Required next steps

1. Fix and test strict import validation plus a safe recovery/delete flow for
   already-corrupt local records.
2. Remove all host score controls from snapshot rendering.
3. Configure immutable cache lifetimes and the listed response headers at the
   deployment layer, including an appropriate manifest MIME type.
4. Re-run this verification after the fixes; do not promote this candidate.
