# Hockey Pool — v277

## Upload this update

1. Keep the previous website ZIP and your separate Completed-Draft-2026-2027-Backup.json.
2. Extract this ZIP and upload its CONTENTS into the existing GitHub repository at the level containing index.html. Include every folder, especially lib and data/draft-history.
3. Keep the same Vercel project, domain and Redis environment variables. There is no new service, payment, build step or runtime npm dependency.
4. After Vercel deploys, refresh Home. Open **Choose your theme** beside Teams / Rules / Admin at the bottom, or **Theme** above the standings.
5. Follow PHONE-AND-COMPUTER-TEST.md for the short device check.

## Five approved reference-art themes, one live pool

- Ice Level: the approved bright-ice scoreboard and roster frame.
- Arena Scoreboard: the approved black-steel arena/jumbotron frame.
- The Sports Page: the approved vintage hockey newspaper layout.
- Coach’s Chalkboard: the approved green wood-framed tactical board. This remains the initial default.
- Arcade Hockey: the approved cyan/magenta retro arcade board.

Selecting a theme changes it immediately and saves the choice in this browser. Closing/reopening the page or browser keeps that choice. Another device or browser has its own independent choice. Two tabs in the same browser follow the same saved preference. Clearing this website’s browser data resets the choice; private browsing or blocked storage may only keep it for the visit. The chooser explains if a save was blocked.

Theme selection never calls a pool API, changes a manager identity or modifies a draft. It remains independent of login, seasons and future website version numbers. Continue using the same website domain to retain the browser’s preference.

## Readable standings and full roster tables

All five themes use the same live data and scoring renderer. v272 uses crops from the five approved concept images as high-detail visual plates; live HTML/API text and numbers are rendered over the sample-data regions, so the artwork supplies the steel, neon, paper, chalk and ice detail without baking live scores into an image. Standings show Manager, G (2 FPTS), A (1 FPT), SHG (5 FPTS), GWG (5 FPTS), Goalie FPTS and total FPTS. Skater G/A totals exclude goalie goals/assists, whose different weights are counted in Goalie FPTS.

Every roster displays all 12 selections, grouped Forwards, Defence and Team Goalies. Skaters show the same weighted headings. Team goalies show W (2 FPTS), A (5 FPTS), G (10 FPTS), SO (5 FPTS), FPTS. The fantasy points and live NHL polling remain those of the existing shared scoring system; the images’ illustrative scores were not imported.

On a phone the original header is now shown as one compact horizontal art strip, matching the phone concepts instead of breaking into a two-row icon grid. Standings and roster cards switch to separate phone crops from the approved concepts, and the current compact stat set is fitted into the frame without forcing the whole page sideways. Live stat refreshes keep using the same data renderer. Enlarge board opens the same live board in a larger dialog with the currently selected theme.

The original header PNG and every approved roster-room image are unchanged. CSS windows show the existing draft sign, Nick 09 / Scott 81 / Tyler 91 / Chris 34 navy-and-cream jerseys, Andrew’s prominent orange 28 championship display and the trophy-room link. There is no added league branding or Back to the Bar link. Tyler’s Sundin and Andrew’s Brière updates remain.

See ADDING-THEMES.md to add another theme. One registry entry and a scoped CSS block add its chooser option automatically; no duplicate page or scoring logic is required.

## The completed draft remains protected

The real 2026–2027 60-pick draft remains in data/draft-history/20262027.json, with its CSV roster list and SHA256 record. Original player IDs, owners, lottery order and pick sequence are unchanged. The backend, NHL scoring, Redis room key and independent locked-draft ledger are unchanged from v270. The internal v259 storage suffix and existing record format names are intentional compatibility identifiers; do not rename them to match this release.

The completed live draft stays closed and rejects undo/reset/new picks. The home board and roster rooms continue collecting live scores. View record opens the saved draft without reopening it.

End Season is still for the real end of the season: it archives final standings, player stats, rosters and picks before advancing, while retaining the locked draft record. Do not use End Season to test a theme. Admin → Download full backup includes the current pool, lottery, history and locked draft records. Keep that backup outside the website.

## Verification

Automated checks cover isolated browser preferences, reload persistence, early saved-theme selection, blocked/invalid storage, goalie/scorer totals, every player appearing once, unchanged draft ownership, atomic draft protection, archive retention, NHL scoring and live game overlays. JavaScript syntax, local asset references, HTML IDs and the ZIP contents are checked before delivery.

The local container could not complete a Chromium screenshot run reliably, so desktop/mobile visual verification should still be completed after deployment using the included checklist. No changes were made to the live pool, scoring, draft record or Redis data during this artwork pass.

Run npm test with modern Node.js. npm run preview:test starts a loopback-only local preview using synthetic NHL data and isolated in-process storage. Do not set POOL_LOCAL_TEST in Vercel.

## v273 — Neon arena home rebuild
- The existing interactive header (Draft / manager jerseys / Trophy Room) is preserved.
- Home standings and roster presentation are rebuilt as a real responsive interface rather than reference-image plates.
- Standings show manager rank, Goals, Assists, SHG, GWG, goalie FPTS and total FPTS. Every skater category displays `stat count (fantasy points contributed)` using the unchanged shared scoring constants.
- Roster cards show the same weighted skater categories for all forwards and defence, plus team-goalie W/A/G/SO with their goalie scoring weights and total FPTS.
- Desktop rosters are large two-up cards in a horizontal snap track; mobile shows one large roster card at a time with swipe/arrows and manager jump controls.
- Current champion Andrew receives a warm red/orange card treatment while the league board remains cyan/blue neon.
- Theme-picker UI is intentionally hidden on Home for this release so v273 can be refined as one approved theme before additional themes are reintroduced.
- No changes were made to scoring rules, NHL data collection, Redis/shared draft state, final-draft integrity, roster ownership, or season history.

## v274 — Desktop arena polish
- Leaves the approved v273 phone layout unchanged.
- Removes the legacy theme zebra-striping that leaked bright rows into the desktop roster tables.
- Uses one dark arena-steel body palette across every manager card; cyan/orange are trim accents rather than full-card fills.
- Uses a consistent gold FPTS column for every manager.
- Uses compact G / A / SHG / GWG roster headers on desktop so two-card layouts remain readable.
- Keeps two roster cards side-by-side on normal desktop widths and falls back to one large card only on narrower tablet/laptop widths.

## v275 home roster comparison
- Desktop Home now renders exactly two large roster cards in a head-to-head comparison layout.
- Each side has independent previous/next manager controls, so one manager can stay fixed while the other cycles through opponents.
- Mobile keeps the one-card-at-a-time roster carousel from v273/v274.
- Player/team names are frozen on the left while roster stat tables scroll horizontally.
- Standings rank + manager columns are also frozen during horizontal scrolling.
- No scoring, NHL, Redis, draft, history, or roster ownership logic changed.


## v276 — player art + Tonight's Matchup
- Draft-style NHL player headshots and team-logo badges appear in roster rows.
- Desktop comparison and mobile carousel can switch to a live Tonight's Matchup view using the existing NHL live feed.

## v277 — Today standings + recent-game collectible cards
- Standings can switch between season totals and TODAY'S TOTALS, ranked by fantasy points earned today.
- Total FPTS is the first stat after the frozen identity column in standings, season rosters, and Tonight's Matchup tables.
- Mobile roster-card headers center the manager name with previous/next arrows on the card itself; the Tonight's Active Players mast no longer has duplicate arrows.
- Clicking/tapping any skater opens a 1996-series cream-card game log with the last five games individually and rolling Last 10 / Last 25 totals.
- Clicking/tapping a team-goalie unit opens a distinct multi-goalie card showing NHL headshots for goalies who have appeared for that club, plus the team unit's recent-game fantasy totals.
- Recent-game data is loaded on demand from NHL player game logs; live today scoring is layered in when available.
- No scoring weights, draft ownership, final-draft protection, Redis keys, or season-history behavior changed.

## v284 player-card update
- Team-colour card trim and a subtle NHL crest watermark.
- Team crest moved into the upper-right of the player bio panel.
- Position/team/fantasy rank moved directly beneath the photo/bio panel.
- Current-season totals added above the Last 5 game log.
- Existing v283 mobile Tonight matchup and Home control fixes remain unchanged.



## v290 — Mobile weekly/monthly roster rankings
- Brings the v289 Roster Comparison masthead rankings to phones.
- Mobile now shows Current View plus compact This Week and This Month manager rankings above the roster carousel.
- Existing mobile matchup toggle, manager navigation, swipe behavior and roster cards are unchanged.

## v289 — Roster comparison masthead + week/month rankings
- Desktop Roster Comparison header now mirrors the Standings masthead: title on the left, current view centered below it, and its matchup/season toggle in the same left block.
- The middle header panel ranks all five managers by fantasy points earned during the current Monday–Sunday week.
- The right header panel ranks all five managers by fantasy points earned during the current calendar month.
- Weekly/monthly totals use NHL game-level stats for completed prior days plus the existing live GameCenter totals for the current day, so in-progress scoring is included without double-counting.
- Mobile Roster Comparison layout is intentionally unchanged.
