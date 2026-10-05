# Protect the completed pool draft

- Start from the latest user-provided source. This project is uploaded to GitHub and deployed on the existing Vercel project.
- `data/draft-history/20262027.json` contains the REAL completed 60-pick draft. Preserve it and every future final-draft record in all packages. Never replace it with fixtures or old screenshots.
- `data/final-draft.json` and `assets/data/rosters.json` are older static records; they are NOT the current live roster source.
- Keep the Redis room key and its `:room:v259:` suffix stable across releases. UI/cache/package version numbers may change independently.
- Preserve the server-side lock, independent final-draft ledger and atomic compare-and-set behavior. Final roster ownership, player IDs, lottery order and pick order must not change during display or artwork updates.
- Sort copies for display. Do not sort or rewrite the persisted picks.
- Final draft records are separate from end-of-season statistics. End Season must archive before advancing and retain all protected draft records.
- Keep tests in isolated test rooms. Never call reset, undo, auto-fill or End Season against the real pool while checking a release.
- Run `npm test` after any storage, draft, scoring or history change. Preserve the latest full backup before changes.

## Homepage themes (latest approval October 3, 2026)

The v291 layout, framing, controls, responsive breakpoints, scrolling and motion are approved. Preserve them. Page 1, Original Home, retains the existing artwork and presentation. Five additional skins may reinterpret the header artwork, background, colours and fonts without redesigning the layout.

Keep all seven header links and destinations: Draft Room, Nick 09, Scott 81, prominent orange Andrew 28 champion, Tyler 91, Chris 34 and Trophy Room. The four other jerseys remain navy/cream. New artwork belongs only to the five alternate themes. This latest approval supersedes the earlier ban on regenerating theme header art.

`data-pool-theme="chalkboard"` intentionally remains fixed: legacy CSS uses it for v291 geometry. New skins use `data-home-skin`. Do not change the legacy attribute when selecting a skin. Active files are `home-themes.js`, `home-skins-v292.css`, `home-fixes-v293.css` and `home-board-v293.js`.

Do not add Basement Bar League branding or a Back to the Bar link: that is a different league.

Theme choice belongs only to this browser’s localStorage, under the permanent hockey-pool:home-theme:v1 key. Never send it to the pool API or store it with a manager or draft. Keep theme changes presentation-only and the stats shared by every theme.

All standings and roster columns show the scoring weights in their headings. Separate skater goals/assists from goalie stats; use the shared PoolCore scoring. Group roster copies Forwards, Defence, Team Goalies. Keep normal-sized mobile text with horizontal table scrolling.

Read ADDING-THEMES.md before adding a theme. Keep the registry and CSS extensible, and preserve the existing theme IDs across versions.

## Fixed BOT competitor

`data/bot-teams/20262027.json` is the canonical locked BOT roster. Preserve it; never automatically redraft or replace its players. Regenerate its browser copy with `node scripts/build-bot-roster.js` if the canonical format needs maintenance. The original human draft must remain untouched.

BOT is a separate standings competitor, not a sixth draft manager. Do not add it to Core.OWNERS, identity, lottery, pick order or roster rooms. It uses 6F/4D/2 team goalies and the exact shared scoring. It activates only for the matching locked 2026–27 human draft and refuses all player conflicts. End Season retains its result in the optional botTeam snapshot without rewriting human trophy/championship records. A future season needs a separately approved BOT roster.

## Ranking and contrast corrections (v293)

Both Top 5 panels and player-card fantasy ranks compare the full available skater/team-goalie pool, including unowned players. Label those entries “Undrafted in our pool”. Use the same draft-board catalogue for identities only; current-season stats supply all points. Individual goalies are not draftable units. Keep manager standings limited to their actual rosters. Display SHG and GWG as abbreviations on all devices.

Press Box colors in home-fixes-v293.css intentionally use #dashboard #seasonBoard to win against legacy important selectors. Preserve the contrast on odd/even rows and FPTS cells. Previews use the actual theme banners plus small HTML scoreboard samples, not legacy reference chalkboard images.

## The Dream Team (comparison only)

The Dream Team is a dynamic, hypothetical comparison roster, separate from the fixed BOT competitor. Recompute the best 6F/4D/2TG from the full pool using current-season fantasy points on each stats refresh. Already-owned players are eligible. Never add this team to Core.OWNERS, standings, weekly/monthly rankings, saved rosters, ownership labels, season archives, draft history or roster rooms. Keep it available through the existing comparison controls on desktop and mobile. Selecting a daily comparison view does not change the season-based selection criteria.

Its displayed players and team goalie groups must show their actual pool roster owner, or “Not drafted” when unowned. The compact roster tally counts all current Dream Team selections, including goalie groups, even in a daily comparison view. Include managers with zero selections, BOT when active, and the unowned count. Recompute labels and counts from actual roster ownership; they must never assign ownership to the Dream Team or be persisted as a new roster/history record.

## Live and period scoring (v295)

The NHL score feed and GameCenter may put period numbers in different places and may use different event IDs. Deduplicate the same goal across both feeds before summing daily goals/assists and goalie contributions. A distinct score must remain a distinct goal even when the scorer is the same. Preserve enriched goal details without mutating source payloads.

Weekly totals start Monday; monthly totals start on the first calendar day. Fetch from the earlier boundary and filter each period independently, including weeks crossing a month or year boundary. Keep the requested season and regular-season-only filter. Reject incomplete/duplicate game reports. Only NHL cache keys may change for a scoring fix; never change the persistent room/draft keys. Do not cap weekly/monthly points to season points to conceal a data discrepancy.
