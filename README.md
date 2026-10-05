# Hockey Pool v297 — Dream Team Spacing

This small patch updates v296.

1. Extract `Hockey-Pool-v296-to-v297-DREAM-SPACING-PATCH.zip`.
2. Upload its files and folders to the root of your existing GitHub repository, replacing matching files and keeping everything else.
3. Commit, let Vercel deploy, and refresh the page.

## Changes

- Corrects the shared button-style conflict that shifted every Dream Team player down and right. Players now centre on their rink positions, including the goalies at the nets and the forwards on the right.
- Moves “Dream Team spots by roster” above the rink image.
- Refreshes the changed CSS and JavaScript cache versions.

The existing rink artwork, player sizes, homepage layout, themes, game-score cards, scoring and rosters are unchanged. All 60 real draft picks and the fixed BOT roster are preserved.

All 58 existing automated tests pass. The centering rule was checked against the actual shared button reset. A rendered browser preview was unavailable; please refresh and check the placement on your phone and PC after deployment.
