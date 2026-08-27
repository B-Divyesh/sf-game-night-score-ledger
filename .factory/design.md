# Visual thesis — the score aurora

## Direction and product fit

Game Night Score Ledger uses a **luminous glass data landscape** inspired by a score track seen across a dim table: ink-dark felt, frosted acrylic counters, mint-blue edge light, and coral move markers. This is a session instrument, so decoration also explains state. Concentric lap rings communicate wrapped totals; horizontal light trails connect individual score events to the final total. It should feel purpose-built for tabletop play, never like an admin dashboard or a generic gradient landing page.

The experience is intentionally single-mode. A controlled dark surface reduces glare when a phone is passed around a table, lets score changes read from a distance, and makes the luminous hierarchy meaningful. Every core control remains above 4.5:1 contrast.

## Color tokens

| Token | Value | Role |
| --- | --- | --- |
| Night | `#071119` | page background / table felt |
| Deep glass | `#0d1d28` | persistent chrome |
| Glass | `rgba(20, 43, 55, .78)` | independent scoring surfaces |
| Frost | `#f2fbf8` | primary text |
| Mist | `#a9c1c5` | secondary text |
| Aurora | `#67f5d2` | primary action, focus, positive score |
| Aurora ink | `#06221c` | text on aurora |
| Coral | `#ff8c7a` | current leader, destructive confirmation |
| Gold | `#ffd67a` | warning/offline/update state |
| Danger | `#ff9aab` | errors |
| Hairline | `rgba(184, 235, 231, .18)` | glass borders and separators |

Large numerals may use luminous colors; status never relies on color alone and includes text or an icon.

## Type

- **Display and score numerals:** `Space Grotesk`, self-hosted variable WOFF2, with open geometry and tabular figures. It makes totals glanceable across the table.
- **Interface and prose:** `Inter`, self-hosted variable WOFF2, chosen for compact labels and clear form text.
- Scale: 14px metadata, 16px body minimum, 20px section heading, 28–36px page title, 46–72px score total. Body leading is 1.55; text measures stay below 70 characters.

## Spacing and shape

The base unit is 4px with a working rhythm of 8 / 12 / 16 / 24 / 32 / 48. Touch controls are at least 44px with 8px separation. Corners use 14px on controls and 22–28px on major glass surfaces. Borders are thin and low-contrast; depth comes from backdrop blur, a soft inner highlight, and shadow rather than stacks of boxed cards.

Phone layout drops the decorative hero copy once a session is active, keeps score actions near the thumb, stacks players in leaderboard order, and makes the action dock sticky above the safe area. Desktop reveals the session history beside the ledger.

## Interaction grammar

- **Tap to score:** quick increment chips are the dominant action. The changed total brightens and settles; an aria-live message announces the exact event.
- **Press and hold is never required.** Custom score entry and correction are explicit labeled actions.
- **History is the audit trail:** every change records points, round, actor label, and time. Undo adds a compensating event rather than erasing evidence.
- **Host/view boundary:** an unguessable host key stays in the URL fragment and is stripped when making a view-only share. Imported snapshots are always view-only until deliberately duplicated.
- **Feedback:** saved/offline/update/licensing states occupy one quiet status rail, not modal interruptions.

## Motion policy

Score totals use a 180ms opacity/translate settle and new history rows enter from their source over 220ms. Dialogs fade/scale from the invoking control in 180ms. Nothing loops. Under `prefers-reduced-motion`, transforms and smooth scrolling are removed and state changes use instant opacity only.

## Asset plan and provenance

- `public/assets/score-aurora.webp` and `.avif`: original generated atmospheric hero showing abstract translucent scoring pylons and lap rings on a dark tabletop. It establishes the world without suggesting copyrighted games or app functionality that does not exist.
- App marks and PWA icons are hand-authored geometric SVG/PNG derived from a lap ring and ledger tick.

### Generation prompt sheet

Use case: stylized-concept. Asset type: wide PWA landing-page hero. Subject: an abstract tabletop score landscape made of five translucent glass score pylons, concentric lap rings, and tiny luminous point markers. World/materials: dark ink-blue game table, smoked acrylic, frosted glass, subtle paper grain, no recognizable board game. Composition: wide, low oblique isometric view; primary cluster on the right; quiet negative space on the left; no people. Light/lens: cinematic mint edge light with restrained coral and amber point lights, shallow atmospheric depth but crisp object edges. Palette words: ink night, sea-glass mint, warm coral, pale gold, frost. Negative list: text, numbers, logos, watermark, brands, copyrighted characters, dice, playing cards, chess pieces, hands, busy neon cyberpunk, purple gradient, illegible glyphs.

Generated with the factory Azure image deployment (`factory-image`) on 2026-08-27. The output is original AI-generated imagery commissioned for this product; no reference images, brands, real people, or copyrighted characters were used. Source PNG and prompt sidecar are retained in `assets/src/`.
