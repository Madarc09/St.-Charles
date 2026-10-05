# Hockey Pool v299 — Roster Polish

Apply this small patch over v298 in the same GitHub repository.

1. Extract `Hockey-Pool-v298-to-v299-ROSTER-POLISH-PATCH.zip`.
2. Upload the files and folders inside to the repository root. Replace matching files and keep everything else.
3. Commit, let Vercel deploy, and refresh the website.

## Changes

- Removed “Manager Roster” and the extra lineup-count/tap-player caption above the ice.
- Made roster fantasy-point totals larger on both desktop and mobile.
- Moved the standings' View Today's Totals button beneath the two Top 5 panels.
- Added a Flyers logo at Andrew's centre ice and a Maple Leafs logo on the other rinks.
- Named human/BOT ice views no longer repeat ownership below each player's FPTS. In season view that area is blank. Daily views show “On the ice” and the opponent, or “On the bench” for an off day.
- Dream Team always keeps ownership, including “Undrafted (The Spare Parts)”, and adds the daily game labels when a day is selected. Its ownership tally remains above the rink.
- Centred the actual mobile roster-room bottom links so they stay in place while the wide room image pans.

“On the ice” means the player's NHL team has a game on the selected date; it is not a confirmed individual lineup. If the schedule is unavailable, the page says so instead of showing a false off day.

The existing name-to-flip controls, default chart views, headshot hockey cards and game scores remain available. All 60 completed draft picks, the fixed BOT lineup, scoring, data collection, draft locks, history and End Season behaviour are unchanged. The patch reuses the installed rink artwork and keeps the existing homepage framing and themes.

## Verification

All 65 automated tests pass, including selected-day opponent labels, off days, missing schedules and Dream Team ownership. The protected draft files and all backend/scoring files are byte-identical to v298. No live draft or season action was performed.

A rendered browser preview is unavailable here, so the final visual check on your phone and PC is still needed after deployment. See `docs/verification-v299.md` for details.
