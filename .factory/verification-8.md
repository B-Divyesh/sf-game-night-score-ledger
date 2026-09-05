# Verification 8 — FAIL

**Job:** Track board-game scores with laps and teams without manual recalculation.  
**Audience:** Board-game hosts running long games at the table.  
**First action:** Try it with sample data.  
**Candidate:** `18506cc3e3e8766523dfd6eac5ad3d1799703489`  
**Documentation/report SHA:** `ef36303ece80be1b4f62ae3e7c4f79e971f4f586`  
**Live URL:** <https://game-night-score-ledger.sociobot.in>

## Verdict

**FAIL — 1 finding; 0 untested claims.**

The live static app matches the implementation candidate and the free scoring
job passes. The optional Host pack purchase path returns HTTP 404, which is a
broken public user path. It needs billing-operator registration, not a
product-code repair.

## Finding

### F1 — P2: Host pack checkout is not registered

Opening **View Host pack** from a populated ledger and selecting **Buy Host
pack** sends the visitor to:

`https://api.sociobot.in/api/v1/products/game-night-score-ledger/checkout`

On 2026-09-05 UTC, following that public URL returned HTTP **404** with
`{"error":"enabled factory product","status":404}`. The app lists the pack
as a $12 one-time purchase, but a visitor cannot buy it.

Register the existing Game Night Score Ledger $12 Host pack with the billing
operator, then retest the hosted checkout redirect. The free core, exports,
privacy, and accessibility are not affected.

## Fresh-checkout checks

I cloned the repository into a new temporary directory, detached at the
documentation SHA, and ran `npm ci` before all checks.

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 104 packages installed; 0 vulnerabilities |
| `npm test` | PASS — 8/8 |
| `npm run typecheck` | PASS |
| `npm run build` | PASS — `dist/` with root `index.html` |
| Desktop browser suite | PASS — 9/9 |
| 390px mobile browser suite | PASS — 9/9 |
| Every declared claim command | PASS — 22/22, each run separately |

The initial JavaScript is 48,176 B raw, CSS is 16,758 B, self-hosted fonts
are 70,544 B, and the hero WebP is 39,550 B. Each is within budget.

## Claims

All 22 registry IDs occur exactly once in `tests/claims.spec.ts`, and every
command declared in `.factory/claims.json` passed from the fresh checkout.
The coverage includes sample isolation, offline reload, local-only free flow,
player bounds, laps, teams, audit/undo, rapid input, multi-tab merge,
view-only QR, CSV/PNG/JSON, installability, persistence, free scope, license
fixtures, and deletion. Untested claim count: **0**.

The Host pack claim uses a recorded sandbox flow to prove price, scope, and
the exact checkout URL. It cannot make the external offer registration exist;
the independent live checkout result above is the finding.

## Live desktop and phone checks

Fresh 1440×900 desktop and 390×844 phone contexts passed. Before scrolling,
each showed the job “Track board-game scores with laps and teams”, the host
audience, and “Try it with sample data”. The action opened a realistic
four-player, two-team sample with Maya at 142 on a 100-point lap track. The
persistent “Demo — sample data, nothing is saved” label remained visible.
Keyboard scoring added 10 to Maya and Reset demo restored 142. Real
localStorage and IndexedDB canaries stayed unchanged. Both contexts reloaded
the demo offline after service-worker control.

Both had no horizontal overflow, console error, page error, serious/critical
axe violation, or free-flow request outside the product origin. The focus
outline was visible at 3px; reduced-motion duration was `1e-05s`. Evidence is
`/work/.evidence/live-cold-browser.json` and companion screenshots.

## Routes, delivery, and earlier findings

The live root, `/demo`, `/privacy`, and `/terms` return 200 with their own
plain titles. An unknown route returns the designed recovery page with a
deliberate HTTP 404; that response is expected and is not this finding.

The live root and service worker match this candidate build byte-for-byte:

| File | SHA-256 |
| --- | --- |
| `index.html` | `24e7a3ba5dd062cd6e14188bd8d20cc07340d6127ea5dd25179661428ca2bf1c` |
| `sw.js` | `4b67011a4cb9baeed347a432ef526e7684ac9d3b9dcdadb5ec8b5824e0db8615` |

Live responses retain the expected CSP, HSTS, `nosniff`, DENY framing, COOP,
strict referrer policy, restrictive permissions policy, manifest MIME type,
no-cache service-worker/manifest, and immutable hashed assets. Playwright axe
integration scanned the desktop and phone demo flow with zero serious or
critical violations.

Passing regression and live evidence proves the disposition of earlier
findings: malformed import recovery; guest non-editability; share-dialog axe;
12-player QR; update notification/cache versioning; offline reload; headers;
touch and focus; rapid scores; team-toggle state retention; invalid quick
score rejection; sample sandbox; claims registry; first-screen copy; metadata;
navigation; and a real 404. No backend applies to this static local-first PWA,
so tenant isolation, restart persistence, health, and 429 checks do not apply.

## Retest

After billing registration, run the documented clean checks and open Host pack
from the live sample. **Buy Host pack** must redirect to a working hosted
checkout rather than HTTP 404.
