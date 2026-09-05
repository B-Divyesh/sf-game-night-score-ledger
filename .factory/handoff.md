# Review handoff — Game Night Score Ledger

## Verdict: FAIL

Review 1 on 2026-09-05 found no regression in the core ledger, but the product
does not meet the factory release contract. The implementation reviewed is
`6faec2d98c11d33afc5192071969c3ff691891ad`; the documentation review commit
before this report is `a539bee7e025b5be7fa7594cfe5cd04460c9f96a`.

The live root and service worker exactly match a fresh build from the reviewed
checkout. Full evidence and all findings are in `.factory/review-1.md`.

## What was verified

- Clean `npm ci`, unit tests, TypeScript check, and production build passed.
- The configured browser suite passed on both projects: desktop 9/9 and phone
  9/9.
- Fresh live desktop and phone contexts passed normal scoring, teams, laps,
  QR view-only sharing, CSV/PNG export, rapid scoring, invalid/recovery paths,
  keyboard/focus, reduced motion, axe, privacy request capture, service-worker
  control, and offline reload.
- No product source was changed by this review.

## How to run

```bash
npm ci
npm test
npx tsc --noEmit
npm run build
npm run test:e2e -- --workers=1 --reporter=line
```

## Known gaps

- No one-click, isolated sample demo or `.factory/demo.md`.
- No `.factory/claims.json`; 18 public claims remain untested under the claims
  contract.
- Landing words, metadata, 404 behaviour, and header navigation do not meet
  the required site structure.
