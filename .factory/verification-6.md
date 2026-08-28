# Independent verification 6 — FAIL

**Candidate:** `2dffcb0084a9bbf844b8bed4a6dcaf35018fbcf2` (`main`)

**Production URL:** <https://game-night-score-ledger.sociobot.in/>

**Verified:** 2026-08-28 UTC from a clean, detached checkout at the candidate
SHA. Product source was not modified during verification.

## Release verdict

**FAIL.** The repaired team-toggle regression is fixed and production is the
candidate artifact, but setup silently changes invalid quick-score input into
different scoring controls. This fails the brief's requirement for an
auditable, non-disruptive table ledger: a host can configure a score value that
the UI explicitly says is invalid and then unknowingly award a different value.

## Blocking defect

### P1 — Invalid quick-score values are silently transformed into valid but wrong scores

The **Quick score buttons** hint says: “Up to four positive values, separated
by commas.” In a fresh ledger on both the local production build and the live
site, enter two valid player names, then enter exactly:

```
1, 999, 1000, -2
```

Click **Create ledger**. There is no validation message. After the asynchronous
save/render completes, each player's controls are:

```
+1, +999, +2
```

`1000` is silently discarded and `-2` is silently converted into `+2`. The
host receives neither a correction nor a confirmation, so the recorded score
can differ from the table rule/configuration they entered. This is a scoring
integrity failure, not merely permissive input normalization.

Reproduced on:

| Target | Observed quick buttons |
| --- | --- |
| Local `npm run build` + `vite preview` | `+1`, `+999`, `+2` |
| `https://game-night-score-ledger.sociobot.in/` | `+1`, `+999`, `+2` |

Required repair: reject non-integers, negatives, zero, duplicates, and values
above 999 in the setup form with an announced error; retain the draft so the
host can correct it. Do not coerce an entered negative score into a positive
quick-score action. Add desktop and 390px regression coverage.

## Passing evidence

### Clean checkout and quality gates

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 104 packages installed; 105 audited; 0 vulnerabilities |
| `npm test` | PASS — 7/7 Vitest domain tests |
| `npx tsc --noEmit` | PASS |
| Lint | No lint script or lint configuration exists in this repository |
| `npm run build` | PASS — generated `dist/` with root index, legal routes, manifest, icons, and service worker |
| `npm run test:e2e -- --workers=1 --reporter=line` | PASS — 16/16 Playwright scenarios across desktop Chromium and 390×844 mobile |
| Independent axe scan (desktop + 390px) | PASS — 0 serious/critical violations in either viewport |

The browser suite covers the repaired title/lap/increment state across both
team-toggle directions, scoring/reload, team/lap scoring, 12-player QR views,
view-only guests, keyboard Enter scoring, rapid score persistence, damaged
storage recovery, service-worker update UX, legal routes, offline reload, and
axe scans.

The optional Lighthouse CLI run could not complete in this container because
the preinstalled Playwright Chromium tab crashed under Lighthouse. This is a
verification-environment limitation, not a substitute for a passing result.
Bundle budgets were directly checked from the production build:

| Artifact | Raw size | Budget | Result |
| --- | ---: | ---: | --- |
| Initial entry JS | 43,525 B | 200 KB | PASS |
| Lazy QR JS | 25,881 B | — | PASS |
| CSS | 13,426 B | 50 KB | PASS |
| Self-hosted fonts | 70,544 B | 120 KB | PASS |
| Hero WebP | 39,550 B | 300 KB | PASS |

### Independent end-to-end checks

On local production preview, I exercised normal scoring and error recovery:

- one player gives “Add at least two player names”; duplicate names give a
  distinct corrective error; lap threshold `1` gives the stated `2–100,000`
  error;
- two teams with a lap threshold of 2, three `+1` scores, a `-4` adjustment,
  undo, round advance, finish behavior, CSV export, and JSON backup export all
  worked;
- a malformed guest hash displays the damaged-view recovery screen;
- custom score input is an integer-step browser control, so a fractional value
  remains invalid rather than being recorded;
- reduced-motion media produces a `0.00001s` transition duration; intended
  focus outline is visible (`3px solid` gold); the mobile target size and
  keyboard flow are covered by the passing Playwright projects.

Fresh live Chromium checks at 1440×900 and 390×844 separately entered
`Wrap audit`, lap `100`, and increments `1, 25, 50`, enabled teams, and
verified that all three values survived the rerender. Both created the ledger,
scored three `+1` events (`0 laps · position 3 of 100`), acquired a
service-worker controller, and reloaded the saved ledger while offline. Both
had zero console/page errors and requests only to the product origin.

### Deployment identity, privacy, and response policy

The live deployment is byte-identical for the two app-shell identity files:

| File | Local SHA-256 | Live SHA-256 |
| --- | --- | --- |
| `index.html` | `e5d0e960c8c7e105b7b4a364708b5c47d9c58f2dcc2746c2ec7b2298cf6ebd44` | `e5d0e960c8c7e105b7b4a364708b5c47d9c58f2dcc2746c2ec7b2298cf6ebd44` |
| `sw.js` | `46e18cb09461e1e139f68078da06544309bf8555cf55321847522af3e5eeda74` | `46e18cb09461e1e139f68078da06544309bf8555cf55321847522af3e5eeda74` |

Live headers confirm `Cache-Control: no-cache` for `sw.js` and the manifest,
`application/manifest+json` for the manifest, and
`public, max-age=31536000, immutable` for the hashed entry JS. HSTS,
`X-Frame-Options: DENY`, COOP, `nosniff`, strict referrer policy,
Permissions-Policy, and the self-only CSP with the disclosed Sociobot license
endpoint are present.

No analytics, third-party scripts, fonts, or normal scoring requests were
observed. Scores remain local-first; `/privacy/` and `/terms/` render with one
heading and a main landmark. The manifest includes standalone display,
versioned start URL, and any/maskable 192/512 icons. The service worker uses a
content-versioned precache, explicit waiting-worker update action, and passed
saved-ledger offline reload on live production.

## Next step

Fix P1, add the specified regression tests, then repeat clean install,
typecheck, build, desktop/mobile browser, live identity, and offline checks
before changing this verdict.
