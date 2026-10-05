# Hockey Pool v294 — Dream Team Ownership

Apply this small patch over the v293 update.

1. Extract `Hockey-Pool-v293-to-v294-DREAM-OWNERS-PATCH.zip`.
2. Upload the files and folders inside to the root of the same GitHub repository. Replace matching files and keep every other existing file.
3. Commit and let Vercel deploy, then refresh your page.

The Dream Team now shows `Roster: Nick` (or the appropriate manager/BOT) beneath every player and team goalie group. Unowned selections show **Not drafted**.

A compact tally beneath the Dream Team heading shows how many spots come from each manager, BOT and the undrafted pool. Zero counts are included. Each team goalie group counts as one spot. The tally covers the full Dream Team, including in Yesterday/Today/Tomorrow views, and updates automatically with the selection.

The Dream Team remains comparison-only. All completed draft records, human and BOT rosters, standings, scoring, season archive logic, theme artwork and existing controls are unchanged. No reset, End Season or data migration is needed.

The board and color stylesheet retain their v293 filenames and use v294 cache versions. See `docs/verification-v294.md` for verification details.
