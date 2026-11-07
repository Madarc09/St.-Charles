# v302 update

This patch applies over v301/current GitHub repo.

## Weekly Pick'em
- New Home panel below the live standings/roster board.
- Monday-Sunday week.
- Nick, Andrew, Scott, Tyler and Chris each choose one NHL game and one winner for the week.
- A pick can be changed until the selected game's puck drop, then it locks.
- Final NHL scores automatically resolve W/L.
- Current-week picks plus season Pick'em standings ranked by Win%, then wins.
- Pick'em uses its own persistent Redis key (`hockey-pool:weekly-pickem:v1`) and never changes draft/roster storage.

## Home board
- Top 5 is now Top 5 Forwards, Top 5 Defence, Top 5 Team Goalies.
- The standings masthead scrolls horizontally so the board itself does not get wider.
- Empty ice on any comparison rink toggles that roster to chart view; player/headshot taps still open hockey cards.
- User-facing BOT labels now read `Spare Parts`; internal `bot` identity and locked roster are unchanged.
- v301 viewport and roster-room scroll preservation remains in place.

## Verification
- v300 hockey-day/date tests: pass.
- v301 scroll-state tests: pass.
- v302 feature/API tests: pass.
- 11/11 selected current regression tests passed in the supplied patch environment.
