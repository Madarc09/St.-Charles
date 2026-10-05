# v295 points correction — verification

## Observed live discrepancy

Read-only inspection at 2026-10-05 00:36:54 UTC (October 4 evening in Eastern time) confirmed the deployed v294 frontend and the same protected 60-pick draft.

| Chris's roster | Season shown | Week shown | Month shown |
| --- | ---: | ---: | ---: |
| Before correction | 46 | 49 | 49 |
| Reconciled against the relevant game logs | 46 | 46 | 42 |

The live response reported Kyle Connor with 4 goals and 2 assists today, while his game log reported 2 goals, 1 assist and 1 GWG (10 FPTS). Josh Morrissey had 4 daily assists in the response versus 2 in his game log. These duplicate contributions added 7 points to both period totals.

William Nylander's 2 goals on September 29 (4 FPTS) belonged to the September 28–October 4 week but were omitted by the historical lookup that started October 1. His October 3 assist belongs to both periods. Removing the duplicated 7 points and restoring the missing weekly 4 points produces the reconciled values above. Numbers are for the recorded snapshot and are not hard-coded.

Sources inspected: the deployed site's `/api/nhl?season=20262027`, read-only draft response, and NHL-backed player cards for IDs 8478398, 8477504 and 8477939. Direct NHL endpoint reads returned HTTP 403 in this environment, so verification used the site's accessible NHL-backed game logs and isolated feed-shaped regression fixtures.

## Checks

- `npm test`: 51 tests pass, including six new regression cases.
- Tests reproduce the mismatched period/event shapes, verify single-feed fallback and enriched assists, preserve multiple goals by one scorer, and count a goalie assist once.
- Period tests cover September/October, December/January, Monday resets, independent month totals, exclusion of today from historical rows, requested-season filtering, and incomplete/duplicate reports.
- A separate local calculation using the captured real roster and the three game logs reproduces Chris's before/corrected totals above.
- The UI, shared scoring weights, human draft records, fixed BOT roster, draft locks, storage and archive logic remain byte-identical to v294.
- The update archive is CRC-checked and verified by overlaying it on a copy of v294. No live reset, draft mutation, End Season or deployment was performed.
