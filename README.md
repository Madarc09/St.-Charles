# Hockey Pool v295 — Correct Live, Weekly and Monthly Points

Apply this small patch over v294. This is a scoring-data fix; the homepage layout and themes are unchanged.

1. Extract `Hockey-Pool-v294-to-v295-POINTS-FIX-PATCH.zip`.
2. Upload the files and folders inside to the root of the same GitHub repository. Replace matching files and keep every other file.
3. Commit and let the existing Vercel integration deploy. Refresh the page after deployment.

## What was wrong

The NHL score feed and GameCenter sometimes describe the same goal differently. The old event key treated those descriptions as separate goals, doubling daily goals and assists. Weekly and monthly totals include the daily data, so they inherited the error. Season totals use the NHL's cumulative counts and were not doubled in the same way.

A separate date bug started both historical lookups at the first of the month, dropping the September portion of a week that continued into October.

## What changed

- Match the same scoring event across both feeds using the game's score, event ID, period/time and scorer count, retaining the richer details. Count each real goal and its assists once.
- Fetch enough history to cover both the Monday-start week and the calendar month, then filter each period independently.
- Scope game reports to the requested season and dates. Reject incomplete or duplicate game reports rather than publishing partial totals.
- Use fresh period-data cache keys so earlier cached calculations are not reused after deployment.

The October 4 diagnostic snapshot showed Chris at 46 season / 49 week / 49 month. Checking the relevant NHL game logs gave 46 season / 46 week / 42 month for that snapshot. These are diagnostic values, not hard-coded totals; future games continue to update normally.

All 60 real draft picks, the fixed BOT roster, Dream Team features, scoring weights, room storage keys, season history and archive logic remain unchanged. No draft reset or End Season action is needed. See `docs/verification-v295.md` for verification details.
