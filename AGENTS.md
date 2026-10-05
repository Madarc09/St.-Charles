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

The v291 layout, framing, controls, responsive breakpoints, scrolling and motion are approved. Preserve them. Page 1, Original Home, retains the existing artwork and presentation. Alternate skins may reinterpret the header artwork, background, colours and fonts without redesigning the layout. The October 5 v300 request adds five game-inspired skins, for eleven choices total.

Keep all seven header links and destinations: Draft Room, Nick 09, Scott 81, prominent orange Andrew 28 champion, Tyler 91, Chris 34 and Trophy Room. The four other jerseys remain navy/cream. New artwork belongs only to alternate themes. This approval supersedes the earlier ban on regenerating theme header art.

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

Its displayed players and team goalie groups must show “Team: Nick” (or the actual manager), “Undrafted” when unowned, and “Undrafted (The Spare Parts)” for BOT selections. The compact roster tally counts all current Dream Team selections, including goalie groups, even in a daily comparison view. Include managers with zero selections, BOT when active, and the unowned count. Recompute labels and counts from actual roster ownership; they must never assign ownership to the Dream Team or be persisted as a new roster/history record.

The user approved the Dream Team rink in v296, extended it to every comparison roster in v298, and made ice the default for all rosters in v300. Keep 6 forwards between centre and the blue lines, 4 defence behind the blue lines, and 2 team-goalie groups at the nets in season mode. Display real NHL headshots, name and FPTS; the Dream Team alone retains ownership labels in ice view (v299). Its roster tally stays above the rink (v297 spacing correction). Headshots open the existing hockey cards. Preserve surrounding comparison controls, homepage framing, themes and the chart alternative. Daily views use the season-selected lineup but hide off-day selections completely; do not replace them with other players.

## Hockey-card game results (v296)

Player and team-goalie cards show a separate NHL score strip and game results beside the last five fantasy-point rows. Match scores by game ID, not current player team, so trades do not associate past points with the wrong game. Keep live period/clock, Final, OT/SO and scheduled states distinct; do not invent scores when the feed is unavailable. Opening a current live or scheduled game polls while the card is open. Closing or switching cards must invalidate old responses; stop polling after a final result. Score display must not change fantasy-point formulas, saved rosters or standings.

## Live and period scoring (v295)

The NHL score feed and GameCenter may put period numbers in different places and may use different event IDs. Deduplicate the same goal across both feeds before summing daily goals/assists and goalie contributions. A distinct score must remain a distinct goal even when the scorer is the same. Preserve enriched goal details without mutating source payloads.

Weekly totals start Monday; monthly totals start on the first calendar day. Fetch from the earlier boundary and filter each period independently, including weeks crossing a month or year boundary. Keep the requested season and regular-season-only filter. Reject incomplete/duplicate game reports. Only NHL cache keys may change for a scoring fix; never change the persistent room/draft keys. Do not cap weekly/monthly points to season points to conceal a data discrepancy.

## Dream Team positioning (v297)

The shared `#dashboard button` reset uses `transform:none!important`. The scoped `.dream-rink-player` centering rule must override that reset so each percentage coordinate marks the centre of the whole card. Losing this override pushes the lineup down/right and clips the right-side forwards and bottom goalie. Keep the fix scoped to ice-view player cards in both normal and enlarged boards. Keep the roster-count panel above the rink artwork.

## Every-roster ice view (v298)

As of v300, all five human managers, the fixed BOT and Dream Team default to ice. In every comparison card, the roster name is a button that toggles that roster alone between chart and ice; it must not carry `data-roster-owner`, which would invoke the roster-room navigation handler. Header jersey links and standings links still open the real rooms.

Keep each presentation choice per owner in page memory, through live refreshes, date changes, side changes and normal/enlarged-board rendering. A fresh page restores defaults. Preserve horizontal comparison scrolling and keyboard focus. The flip animation respects reduced motion.

Every ice lineup uses that roster's actual selections, with 6F / 4D / 2TG limits, the existing rink artwork and NHL portraits. Day views show that day's FPTS and, from v300 onward, remove off-day selections while keeping active players in their season positions. The chart and ice totals must agree. No player substitutions, automatic redrafts, new persistent room keys or changes to scoring, draft/archive data are part of this display toggle.

## Roster polish (v299)

Keep human season headers free of “Manager Roster” and omit the lineup-count/tap-player caption above all rinks. Roster FPTS totals are deliberately larger on phone and desktop. The standings view toggle belongs below the Top 5 skater and team-goalie panels; preserve the rest of the standings arrangement.

Use the Philadelphia Flyers centre-ice crest for Andrew, the NHL All-Star decal for Dream Team (v300), and the Toronto Maple Leafs crest for every other comparison rink. They are decorative overlays on the approved rink; keep them below the interactive players.

In named human/BOT ice views, leave the area below player FPTS blank in season mode. In a selected daily mode, show “On the ice” plus the opponent when the NHL team has a game on that date. The v300 request removes known off-day selections entirely, superseding the v299 “On the bench” label. This describes the team schedule, not a confirmed individual lineup. Missing schedule data must not be presented as a known off day; keep those players visible with an unavailable-schedule label. Dream Team ownership always remains visible on its displayed players, with the daily status underneath when applicable. These are display-only changes.

On phones, the actual roster-room bottom navigation stays centred in the viewport while the wide room artwork pans. Keep existing room links, hotspots and pan behaviour. The final override is in `assets/css/home-polish-v299.css`.

## Hockey day and game themes (v300)

Yesterday / Today / Tomorrow are relative to a day starting at 04:00 in `America/Toronto`, matching Sudbury and daylight-saving changes. `lib/pool-clock.js` owns the calendar decision. NHL live feeds must request the explicit date and include it in the cache key; do not delegate rollover to `/score/now`. Adjacent dates and period boundaries derive from that same date. Leave the existing live-refresh interval and draft/season storage rules intact.

The five added theme IDs are `goldeneye`, `mariokart`, `smash`, `nhl95`, and `streetfighter`. Their art is in `assets/images/themes/v300/`, with variables and contrast overrides in `home-games-v300.css`. Keep the six older IDs, original art and permanent preference key unchanged. Game themes set `data-home-theme-family="game"` for scoped presentation overrides, while `data-pool-theme="chalkboard"` stays fixed. Previews must use the actual shipped image for each theme. The bundled VT323 font and its OFL licence stay together.
