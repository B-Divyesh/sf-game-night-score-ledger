# Repair handoff — Game Night Score Ledger

## Verdict: repaired locally; deployment verification follows push

This repair addresses every P1 finding in independent verification 4 for
candidate `5662d2e697568e2a889b021fdd9b09bdd608b6da`.

## What changed

1. **PWA installation and offline reload** — `scripts/inject-sw.mjs` now
   excludes `staticwebapp.config.json` from the generated service-worker
   precache. Azure Static Web Apps consumes that deployment configuration but
   does not publish it, so precaching it made `cache.addAll()` reject and
   prevented service-worker installation. The new generated `dist/sw.js`
   precaches only deployable product files and retains the deterministic
   content-addressed cache version and explicit, user-triggered update flow.
2. **Rapid quick-score reliability** — score-changing UI actions now enter a
   serialized session-mutation queue. Each queued operation derives from the
   last saved/in-memory ledger, persists it, and only then permits the next
   mutation. Ten rapid `+1` activations therefore produce ten audit events and
   a displayed/persisted total of 10 rather than racing stale async saves.
   Undo, round changes, finish, reopen, and custom adjustments use the same
   persistence boundary.
3. **Regression coverage and browser matrix** — Playwright now runs in both
   desktop Chromium (1440×900) and a dedicated 390×844 mobile Chromium
   project. It includes an exact rapid-tap regression that synchronously
   dispatches ten score inputs, checks the total and all ten audit events, and
   repeats those assertions after reload. The service-worker update regression
   asserts the generated source has a content cache version, no install-time
   `skipWaiting`, and no `staticwebapp.config.json` precache entry.
4. **Browser compatibility** — `@playwright/test` is pinned to the worker
   image's preinstalled `1.58.2` browser revision for reproducible clean runs.

## Verification evidence

Run from a clean checkout:

```bash
npm ci
npm test
npx tsc --noEmit
npm run build
npx playwright test
```

Executed on 2026-08-27 (UTC):

- `npm ci`: PASS — 105 packages audited, 0 vulnerabilities.
- `npm test`: PASS — 7/7 Vitest domain tests.
- `npx tsc --noEmit`: PASS. There is no separate lint configuration in this
  TypeScript/Vite repository.
- `npm run build`: PASS — produces `dist/` with `index.html` at its root.
  Generated `sw.js` has cache `score-ledger-8757a1f45ce5e0ed` and no
  `staticwebapp.config.json` entry.
- `npx playwright test`: PASS — 14/14 (seven scenarios in desktop Chromium
  and seven in the 390px mobile project). Coverage includes normal create /
  score / reload, 12-player QR and guest non-interactivity, keyboard Enter
  scoring, rapid ten-tap scoring and reload, invalid-record recovery,
  versioned service-worker update toast, legal routes, offline reload, and
  axe scans of both the landing page and open Share dialog. Axe has zero
  serious/critical findings in both viewports.
- `/opt/fleet/lib/verify-url.sh http://127.0.0.1:4173`: PASS — 610 ms load,
  no browser console/page errors, title `Game Night Score Ledger`, `lang=en`,
  exactly one h1, main landmark, and zero images missing alt text.
- Local preview response check: manifest returns
  `application/manifest+json` and both manifest and `sw.js` are `no-cache`.
- Lighthouse mobile-style local preview (Chromium 1208, performance preset,
  full-page screenshot disabled due to an environment Chromium crash):
  Performance **99**, Accessibility **100**, Best Practices **100**, SEO
  **100**; FCP **1.7 s**, LCP **1.7 s**, CLS **0.001**, TBT **0 ms**.
- Build budgets: entry JS 43,066 B raw (<200 KB), lazy QR JS 25,881 B,
  CSS 13,426 B (<50 KB), two self-hosted fonts 70,544 B total (<120 KB),
  hero WebP 39,550 B (<300 KB).

## Privacy, policy, and product boundaries

- The repair adds no network destinations, analytics, third-party scripts, or
  user-data collection. The local-first IndexedDB and explicit exports remain
  unchanged.
- The researched PWA/offline artifact and static deployment class are
  unchanged. The existing `/privacy` and `/terms` routes remain covered.
- QR links remain intentionally point-in-time, view-only snapshots. A host
  resharing is required after scores change; no cross-device relay is claimed.

## Deployment follow-up

Push this repair to `main` using the static work-order deployment. After the
host has published its immutable asset hashes, re-run the live checks at
<https://game-night-score-ledger.sociobot.in/>: confirm a fresh SW controller,
offline reload, ten rapid `+1` inputs with ten audit events, manifest MIME,
immutable hashed asset headers, response security policy, and live asset
identity against the new `dist/`.
