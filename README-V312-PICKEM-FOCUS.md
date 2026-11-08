# thePool v312 — Pick'em Focus

This patch builds on v311.

## Changes
- The logged-in manager's saved weekly game is promoted to the top of that day's game list.
- If that saved game is currently live when Pick'em opens, its date is focused automatically.
- The saved game has a strong `YOUR GAME` treatment on desktop, mobile web, and the installed PWA.
- The logged-in manager's selected team has a persistent `YOUR PICK` highlight before and during the game.
- The team currently ahead is shaded separately and labeled `LEADING`; after a final it becomes `WINNER`.
- Tiny manager-initial chips show which pool members picked each team.
- Pick, leader/winner, and pool-pick indicators intentionally use different visual treatments so their meanings are not confused.

No Pick'em scoring rules or saved backend data were changed.
