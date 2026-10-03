# Hockey Pool v293 — Small Fix Patch

Apply this over your installed v292 / v292 small update.

1. Extract `Hockey-Pool-v292-to-v293-FIX-PATCH.zip`.
2. Upload the files and folders **inside** to the root of the same GitHub repository. Replace matching files and keep every other existing file. Do not upload the ZIP itself or delete the repository.
3. Commit and let the existing Vercel integration deploy. Refresh the page afterwards.

This patch needs no image downloads, migration, draft reset or End Season action.

## Fixes

- The two Top 5 panels now rank the complete available skater/team-goalie pool using current-season fantasy points. Unowned entries show **Undrafted in our pool**. Human selections show their manager; BOT selections show BOT. Team goalie rankings cover all 32 units. Individual goalies are excluded.
- Player-card fantasy ranks use the same full-pool comparison. Ties share a rank. Manager standings still sum only each manager’s actual roster.
- The existing draft-board endpoint supplies the full catalogue once per page. Its previous-season values are discarded: only identity fields are retained. Current NHL stats supply every point. No scoring weights or NHL collector behaviour changed.
- SHG and GWG stay abbreviated in standings, roster tables, day views and scoring rules.
- Press Box now has dark text, readable stat contributions and dark red FPTS on cream rows. Its banner is unchanged.
- All six theme previews now use their own actual banners and matching scoreboard colors, including Original Home and Neon Ice.
- **The Dream Team** is available through the roster comparison arrows and team selector. It automatically selects the highest-scoring 6 forwards, 4 defencemen and 2 team goalie groups using current-season fantasy points, and updates whenever the stats refresh. It can include players from any manager or BOT roster. It is for comparison only: it has no roster room and never enters standings, season archives, the draft or ownership records.

All 60 human picks, BOT selections, lottery order, protected draft history, backend storage and season archive logic are unchanged. The approved framing, scrolling and controls are retained.

See `docs/verification-v293.md` for checks. Nothing was deployed or changed in the live pool by this patch preparation.
