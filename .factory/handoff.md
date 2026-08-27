# Verification handoff — Game Night Score Ledger

## VERDICT: **FAIL**

Independent verification on 2026-08-27 of candidate
`82cddb7033b2bd60c4ae216123dac7c61bdf6d43` and
https://game-night-score-ledger.sociobot.in failed. **Do not promote this
candidate.** No product source was modified by either verifier.

The independent reports are [`.factory/verification.md`](verification.md) and
[`.factory/verification-3.md`](verification-3.md). Combined blockers are:

- A malformed-but-shallowly-valid JSON import is persisted and can make every
  home render throw, stranding all local ledgers without an in-product repair.
- A view-only snapshot renders focusable but inert **Adjust ±** controls.
- A 12-player ledger with twelve ordinary events cannot produce a QR; it falls
  back to a 3,774-character copy-only link.
- Opening Share view produces two axe **serious** findings: invalid ARIA on
  `#qr` and an inaccessible scrollable `.share-url`.
- The fixed `score-ledger-v1` cache and unconditional `skipWaiting()` do not
  provide the required reliable versioned-cache/update-toast flow.

Both reports also record deployment cache/MIME/header gaps. Re-verify every
blocker after fixes; this section supersedes the optimistic builder handoff
below.

## Builder handoff (superseded by independent verdict)

## Shipped

A finished static PWA for the board-game host workflow:

- Fast setup for 2–12 named players, optional free-form teams, optional lap threshold, and configurable quick increments.
- Large table-readable scoreboard with raw totals, lap/position breakdowns, team totals, round controls, leader labels, custom positive/negative changes, finalization, and reopening.
- Auditable timestamped score trail. Undo writes a linked inverse event; it does not erase the original.
- IndexedDB persistence with localStorage fallback, same-device `BroadcastChannel` updates, and browser-lock event merging so simultaneous host tabs do not drop score events.
- View-only QR/link snapshot containing totals and the latest 12 trail entries, with no host key or edit path.
- CSV event export, generated PNG receipt, complete JSON backup, and JSON import as a new host-owned copy.
- Install manifest, 192/512/maskable icons, versioned service worker, build-time precache, offline fallback, update notice, safe-area handling, and explicit offline status.
- Optional $12 one-time Host pack via Sociobot checkout/verify, URL token capture, daily cached verification, offline optimistic unlock, invalid-license reconciliation, and paste-to-restore. Only distraction-free Table view is gated; core use and all exports stay free.
- `/privacy/` and `/terms/`, MIT license, sitemap, robots policy, no tracking, no third-party runtime assets.
- Product-specific luminous glass visual system and original generated hero. Prompt, review, model provenance, and source are recorded in `.factory/design.md` and `assets/src/`.

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

- `npm test`: 5/5 domain tests pass.
- TypeScript strict check: pass.
- `npm run build`: pass; output is `dist/` with root `index.html`.
- Playwright mobile Chromium (Pixel 5): 2/2 scenarios pass. The main scenario creates a team ledger, records a score, reloads persistence, generates a QR, runs axe, switches offline, and reloads the active ledger from the service worker.
- Console errors during the end-to-end path: 0.
- Axe serious/critical violations: 0.
- Lighthouse mobile: Performance 99, Accessibility 100, Best Practices 100, SEO 100.
- Lighthouse lab metrics: FCP 1.4 s, LCP 1.8 s, CLS 0.001, total transferred 135 KiB. INP is not produced for a no-interaction lab navigation; scoring feedback is a synchronous local update.
- Build budgets: initial JS 36.17 KB raw (QR chunk lazy-loads at 25.88 KB), CSS 13.32 KB, fonts 70 KB, hero WebP 39 KB (JPEG fallback 87 KB).
- Responsive visual inspection completed at 390×844 and 1440×1000. Touch controls are at least 44 px, focus is restored after re-rendering, and reduced-motion removes transitions/transform motion.

## Known gaps and honest boundaries

- A static, offline-only deployment has no cross-device sync service. Guest QR links are intentionally point-in-time snapshots, clearly labeled with capture time and a reshare instruction. Same-device host tabs do synchronize and merge safely.
- License checkout/verification depends on the factory registering this slug. Production uses `api.sociobot.in`; staging should build with `VITE_BILLING_BASE=https://pilot-api.sociobot.in`.
- Browsers can delete local data under storage pressure or when the user clears site data. JSON backup is provided for durable ownership and transfer.
- The local image encoder did not support AVIF. The accepted original is shipped as a 39 KB WebP with an 87 KB JPEG fallback, both below the 300 KB hero budget.

## Suggested next steps

- After factory registration, exercise the hosted checkout return and revoked-license paths with the staging product and test card.
- If live cross-device viewing becomes essential, add an optional encrypted relay with expiring room IDs; keep local-only use as the default.
