# v296 verification

## Behaviour

The visual lineup is restricted to the comparison-only Dream Team. The existing selector, date controls, standings, human roster tables and BOT competitor retain their existing roles. The selection algorithm and scoring weights are unchanged. Display placement sorts copies and never rewrites the saved draft.

Player and team-goalie card results use NHL game IDs. The live feed supplies current results; the existing cached date scoreboard supplies older results. The last five fantasy-point rows retain their numbers when result retrieval fails. A current live/scheduled card polls every 15 seconds, preserves scrolling, rejects old responses after switching/closing, and stops after Final. Results may lag according to the NHL feed.

## Automated checks

- `npm test`: 58 passing tests.
- New regression cases cover 6F / 4D / 2TG placement, interactive headshots, real manager ownership, BOT-as-undrafted labels, counts, daily points, off days and unchanged source data.
- Results match game IDs even when a player has changed teams. Existing live results are reused. Missing results do not fabricate scores or remove fantasy points.
- Player and goalie card markup handles live period/clock, final results, zero scores and scheduled games.
- Browser-controller tests with isolated responses and a manual clock exercise live-to-final refresh, temporary failure, scroll retention, close and switch races.
- Existing tests cover the 60-pick lock, atomic draft ledger, recovery, season archiving, BOT conflicts, themes, full-pool rankings and v295 period-scoring fixes.

## Release integrity

Protected draft JSON, roster CSV, their SHA256 manifest and the canonical fixed BOT roster are byte-identical to v295. Persistent room keys, draft lock/ledger logic, shared scoring and archive code are unchanged. The ZIP includes all protected final-draft records, passes CRC inspection, and reconstructs v296 when overlaid on v295.

No live write, reset, undo, End Season or deployment was performed.

## Visual verification limit

No browser binary was available. A normal browser installation attempt failed, so no desktop/mobile screenshots or rendered-layout check could be completed. Source review checked selector scope, narrow-card wrapping and vertical spacing, but does not replace visual inspection on the user's devices. The generated rink artwork was inspected separately before use.

After deployment: select Dream Team, verify the full rink on phone and PC, tap a portrait and check that a current game shows its score/status. Existing roster comparisons and all six themes should remain available.
