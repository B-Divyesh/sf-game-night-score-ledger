# Game Night Score Ledger

Game Night Score Ledger is a local-first scoreboard for board-game hosts handling long score tracks, laps, teams, and many rounds. It keeps an auditable event trail without accounts or a rules database, works offline after first load, and exports a portable receipt.

Live product: <https://game-night-score-ledger.sociobot.in>

## What it does

- Creates a ledger in under a minute for 2–12 players.
- Tracks configurable quick increments, manual corrections, rounds, optional teams, and score-track laps.
- Preserves every change in a timestamped trail; undo creates a compensating event instead of deleting history.
- Saves locally in IndexedDB with a localStorage fallback and merges simultaneous-tab events under a browser lock.
- Generates a view-only QR snapshot with no host key; guests cannot edit it.
- Exports event CSV, score-receipt PNG, and full backup/import JSON.
- Installs as a PWA and reloads saved ledgers offline.
- Offers an optional $12 one-time Host pack for distraction-free Table view. Core scoring, accessibility, and exports remain free.

## Develop and verify

Requires Node.js 20 or newer.

```bash
npm ci
npm run dev
npm test
npx tsc --noEmit
npm run build
```

The factory build command is exactly `npm run build`. Production output lands in `dist/`, with `dist/index.html` at its root and separate `privacy/index.html` and `terms/index.html` entries.

Browser and offline checks use Playwright:

```bash
npx playwright install chromium
npm run test:e2e
```

## Billing configuration

Production defaults to `https://api.sociobot.in`. Staging can point at the pilot service without changing source:

```bash
VITE_BILLING_BASE=https://pilot-api.sociobot.in npm run build
```

No payment provider or product ID is embedded. Checkout and license verification use the Sociobot product slug contract.

## Privacy and sharing model

Scores and player names stay in the browser. There is no analytics, tracking, account system, or third-party runtime CDN. A guest QR is a compact, view-only copy of the current scoreboard and twelve most recent events; it is not live across devices, so the host reshares after the board changes. JSON export/import provides device migration and user-owned backups.

## Project notes

- Visual system and generated-asset provenance: [`.factory/design.md`](.factory/design.md)
- Build verification and known gaps: [`.factory/handoff.md`](.factory/handoff.md)
- License: MIT
