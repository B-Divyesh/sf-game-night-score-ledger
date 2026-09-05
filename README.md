# Game Night Score Ledger

Track board-game scores with laps and teams. It is for hosts who need a clear
score trail without pausing play or asking players to create accounts.

Live product: <https://game-night-score-ledger.sociobot.in>

One-click sample: <https://game-night-score-ledger.sociobot.in/demo>

## What it does

- Creates ledgers for 2 to 12 players.
- Tracks quick scores, corrections, rounds, teams, and wrapping score tracks.
- Keeps each score change in the trail. Undo adds a reversal instead of deleting history.
- Merges score events made in two open host tabs.
- Opens a point-in-time, view-only guest snapshot from a QR code.
- Exports event CSV, a 1200 by 630 PNG, and an editable JSON backup.
- Saves real ledgers in the browser and reloads them after closing or refreshing.
- Provides a standalone PWA that reloads offline after the first visit.

The free core includes scoring, teams, laps, history, sharing, and exports. The
optional Host pack is listed at $12 once and adds the large-screen Table view.

## Sample sandbox

Select **Try it with sample data** or open `/demo`. The sample has four players,
two teams, a 100-point lap, and eight score events. Its persistent banner has
**Reset demo** and **Start for real** actions.

The sample stays in memory under the `demo:sample-session` identifier. It does
not open or write the real ledger stores. See [`.factory/demo.md`](.factory/demo.md).

## Run and verify

Use Node.js 20 or newer.

```bash
npm ci
npm run dev
npm test
npm run typecheck
npm run build
npm run test:e2e -- --workers=1
npm run test:claims -- --project=desktop-chromium --workers=1
```

The build command creates `dist/` with `dist/index.html` at its root. Deploy the
contents of `dist/` to the product's static host. No backend or shared database
is required.

Every public product claim and its clean-state browser command is listed in
[`.factory/claims.json`](.factory/claims.json).

## Privacy and sharing

Free scoring and export run in the browser without analytics or runtime CDN
scripts. Real ledgers use IndexedDB, with a localStorage fallback. A guest QR
contains a view-only snapshot and no host key. It does not update after sharing.

## Host pack registration

Checkout and license verification use only the Sociobot billing API. The public
production checkout route is:

`https://api.sociobot.in/api/v1/products/game-night-score-ledger/checkout`

The billing operator still needs to register this offer; the route returned 404
during this repair. The app keeps the checkout and license paths ready for that
registration. No payment provider or credential is embedded in the product.

## Project records

- Visual system and asset provenance: [`.factory/design.md`](.factory/design.md)
- Latest verification and remaining dependency: [`.factory/handoff.md`](.factory/handoff.md)
- License: MIT
