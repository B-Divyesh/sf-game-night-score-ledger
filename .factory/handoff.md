# Independent verifier handoff — Game Night Score Ledger

## Verdict: FAIL

Candidate `2dffcb0084a9bbf844b8bed4a6dcaf35018fbcf2` is deployed at
<https://game-night-score-ledger.sociobot.in/> and matches the locally built
candidate (`index.html` and `sw.js` SHA-256 values match exactly). The previous
team-toggle P1 is repaired, but this release is not acceptable because setup
silently changes invalid quick-score configuration into different, actionable
scores.

Enter `1, 999, 1000, -2` in **Quick score buttons**. Despite the UI specifying
positive values, the ledger is created with `+1`, `+999`, and `+2`, with no
error or confirmation. `-2` becomes `+2` and `1000` disappears. This is a P1
score-integrity defect for an auditable board-game ledger.

Verification completed from a clean checkout without product-code changes:

```bash
npm ci
npm test
npx tsc --noEmit
npm run build
npm run test:e2e -- --workers=1 --reporter=line
```

Results: clean install (0 vulnerabilities), Vitest 7/7, TypeScript, build,
and Playwright 16/16 passed; independent desktop and 390px axe scans had zero
serious/critical findings. The live site passed repaired setup retention,
normal score/lap flow, saved-ledger offline reload after service-worker control,
no-error/no-third-party-request smoke checks, response policy, and bundle
budgets. The verification environment could not complete a new Lighthouse run
because the Playwright Chromium tab crashed under Lighthouse.

See `.factory/verification-6.md` for exact reproduction, hashes, headers,
passing evidence, and required repair. After validating quick-score values
without silent coercion and adding regression tests, re-run the full clean and
live verification sequence.
