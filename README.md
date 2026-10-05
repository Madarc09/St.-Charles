# Hockey Pool v300 — Ice First + Game Themes

Apply this update over v299 in the same GitHub repository.

1. Extract `Hockey-Pool-v299-to-v300-ICE-GAME-THEMES-PATCH.zip`.
2. Upload the files and folders inside to the repository root, replacing matching files and keeping everything else.
3. Commit, let Vercel deploy, then refresh the website.

## Ice views

- Every human roster, BOT and Dream Team now opens on the ice. Click the large roster name to flip to the chart; click it again to return to the rink.
- Season shows the whole roster. Yesterday / Today / Tomorrow hide players and goalie groups whose NHL teams have no game on that date. Remaining players keep their season positions on the rink; there are no substitutions or roster changes.
- An empty game day shows a short “No players or goalie groups scheduled” message. If the schedule is unavailable, the lineup stays visible with an unavailable-schedule label instead of pretending everyone is off.
- Dream Team keeps ownership on its displayed players, its full season-selection tally above the rink, and now uses an NHL All-Star centre-ice decal. Andrew keeps the Flyers logo and the other rinks keep the Maple Leafs logo.

## The hockey day starts at 4 a.m. Eastern

The date changes at **04:00 in America/Toronto**, matching Sudbury through daylight-saving time.

For example, at 3:59 a.m. Monday, Today still shows Sunday's games. At 4:00 a.m. Monday, Today becomes Monday, Yesterday becomes Sunday and Tomorrow becomes Tuesday. The existing automatic refresh picks up the change, and reopening the page refreshes it immediately. Weekly and monthly boundaries use the same hockey date.

Game-day visibility uses the NHL team's schedule, not a confirmed individual lineup or injury report. Fantasy scoring is unchanged.

## Five more themes

The existing theme chooser now has eleven options. These five are added:

- GoldenEye
- Mario Kart SNES
- Super Smash Brothers
- NHL 95
- Street Fighter II

Each has its own banner artwork, background, colours and heading style. Mario Kart and Smash use scenery-only interpretations. The existing six themes, all seven navigation links, jersey colours/numbers, champion prominence and homepage layout remain. Your selection is remembered only in your browser and does not change anyone else's choice.

The shipped banners are lossless WebP versions of the generated artwork, rather than separate mockups. Asset paths and generation prompts are recorded in `docs/theme-artwork-v300.json`. Pixel headings use the bundled VT323 font; its licence is included.

## Verification and preserved data

All 69 automated tests pass. Checks cover the 4 a.m. cutoff, both daylight-saving transitions, year/leap-day boundaries, dated NHL cache keys, roster visibility, independent chart/ice toggles, theme persistence and all prior scoring/draft tests.

All 60 locked draft picks, the fixed BOT roster, scoring formulas, draft storage keys, locking and history/archive code are unchanged. No live reset, draft or End Season action was performed. The ZIP includes the protected draft-history files and was checked as an overlay on v299.

A rendered browser preview is unavailable here. After deployment, please check the new themes and day tabs on your phone and PC. See `docs/verification-v300.md` for details.
