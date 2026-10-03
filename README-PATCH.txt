V278 -> V279 PATCH

Copy these files over the matching files in the existing GitHub repository.
Do not delete the rest of the repository.

Functional fix:
- Standings and roster comparison now have independent render/state paths.
- Today's Totals changes standings only.
- Tonight's Matchup changes roster cards only.
- Roster toggle changes to Season Totals while Tonight mode is active.
- Desktop left/right team arrows and manager selectors update roster comparison only.
- Selecting the team already on the other side swaps the comparison sides.
