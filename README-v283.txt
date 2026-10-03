v283 regression fix

Fixes:
1. Mobile Tonight's Matchup button now works. Both desktop and mobile roster-mode buttons receive their own click listener.
2. Player card no longer throws "C is not defined". Browser-side fantasy ranking uses window.PoolCore correctly.
3. index.html loads a new home-board-v283.js filename to avoid stale browser/Vercel cache.

No scoring, Redis, draft, standings design, roster design, or card styling changes were made.

Copy these files over the matching paths in the existing v282 repo. Do not delete other repo files.
