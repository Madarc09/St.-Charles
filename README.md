# Hockey Pool v296 — Dream Team Rink and Hockey-Card Scores

Apply this small update over v295 in the same GitHub repository.

1. Extract `Hockey-Pool-v295-to-v296-DREAM-RINK-SCORES-PATCH.zip`.
2. Upload the files and folders **inside** it to the repository root. Replace matching files and keep every other file. Do not upload the ZIP itself as the website.
3. Commit and let the existing Vercel integration deploy. Refresh the site after deployment.

## Dream Team

- The existing Dream Team comparison now uses an arena rink background, with 6 forwards near centre, 4 defence behind the blue lines and 2 goalie groups at the nets.
- Large real NHL headshots show the name, fantasy points and roster owner. Tap a portrait to open its hockey card.
- Labels read `Team: Nick` (or the actual manager), `Undrafted`, or `Undrafted (The Spare Parts)` for BOT selections.
- The count of selections belonging to each roster remains beneath the rink.
- The lineup continues to update from the best current-season FPTS. The existing Season / Yesterday / Today / Tomorrow controls remain available. Daily views show that day's points and mark players without a game.

## Hockey cards

- Player and team-goalie cards show the NHL game score, live period and clock, or the final result.
- Results also appear alongside the last five games so the score can be matched to the fantasy points for that game.
- An open current-game card checks for updates every 15 seconds. It stops after Final or when closed. Feed delays are still possible.
- Scheduled games show the opponents; missing results are labelled unavailable. A temporary refresh failure keeps the last successful card visible.

The homepage framing, six themes, real roster tables and locked draft are preserved. All 60 draft picks and the fixed BOT roster are unchanged. This update does not alter scoring weights, storage keys or End Season behaviour. The previous v295 points correction is retained.

## Checks

All 58 automated tests pass, including card refresh, failed refresh, closing/switching, game identity and roster integrity. The ZIP is checked against the v295 baseline. See `docs/verification-v296.md`.

A browser preview was unavailable in the build environment, so desktop/mobile appearance has not been visually verified. After deployment, open the Dream Team on your phone and PC, tap a portrait and check the game-score strip. No draft reset or End Season action is needed.
