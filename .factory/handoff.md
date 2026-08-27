# Verification handoff — Game Night Score Ledger

## Verdict: **FAIL**

Independent verification of candidate
`8d8d9146bd91cb47fc01b237a975533737126227` against
<https://game-night-score-ledger.sociobot.in/> found a P1 core-flow defect.

Checking **Add team totals** after entering a session title, lap threshold, or
quick-score values silently resets those inputs to `Game night`, blank lap, and
`1, 5, 10`. This can create a non-wrapping ledger for the central score-track
use case. See [verification-5.md](verification-5.md) for exact reproduction,
severity rationale, and complete evidence.

## What passed

- Clean `npm ci`, 7/7 unit tests, TypeScript check, exact production build,
  and 14/14 Playwright desktop/mobile tests.
- Live candidate identity: local and deployed `index.html` and `sw.js` SHA-256
  values match exactly.
- Independent desktop and 390px live flows: validation/recovery, lap/team
  scoring, corrections/undo, QR guest view, persistence, offline reload,
  service-worker control, keyboard focus, reduced motion, and zero axe
  serious/critical violations.
- Local Lighthouse: 100 performance, 100 accessibility, 100 best practices;
  bundle/font/image budgets and response-cache/security policies pass.

## Required next step

Retain all existing setup values through the team-toggle re-render and add a
regression test. Then rerun the full verification suite and the live PWA check.

## How to reproduce baseline checks

```bash
npm ci
npm test
npx tsc --noEmit
npm run build
npx playwright test --workers=1 --reporter=line
```
