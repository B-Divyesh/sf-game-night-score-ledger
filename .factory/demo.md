# Sample demo

Demo URL: <https://game-night-score-ledger.sociobot.in/demo>

The landing page opens this demo in one click through **Try it with sample data**.
The demo starts with four players, two teams, a 100-point lap threshold, three
rounds, and eight realistic score events. The initial scores are Maya 142,
Priya 125, Theo 101, and Jonah 73.

The persistent banner reads **Demo — sample data, nothing is saved**. **Reset
demo** recreates the original sample. **Start for real** discards the in-memory
sample and opens normal ledger setup.

Demo state uses the in-memory `demo:sample-session` namespace. Demo startup and
scoring do not call the real IndexedDB or localStorage ledger adapters. Reloading
`/demo` creates a clean sample, including when the cached PWA reloads offline.

All claim tests start from `/demo` (or the landing action that opens it). Tests
that cover saved real ledgers first select **Start for real** in a fresh browser
context, so no existing user data is available to them.
