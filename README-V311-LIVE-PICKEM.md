# thePool v311 — Live Pick'em Scoreboards

This patch upgrades Weekly Pick'em started games into live NHL scoreboards across desktop web, mobile web, and the installed thePool PWA.

## What changed

- Pregame games remain normal Pick'em selection cards until puck drop.
- Once a game starts, its card becomes a live scoreboard with score, game clock/period, team logos, and shots on goal.
- Tap/click a started game to expand NHL GameCenter details:
  - scorers and assists for each goal
  - goal strength badges (PP / SH / EN when available)
  - goalie matchup with player headshots and live save/shot totals
  - shots on goal
  - power-play goals/opportunities
  - a prominent live POWER PLAY banner when the NHL play-by-play situation indicates one team currently has the man advantage
- Expanded live games refresh about every 15 seconds; the Pick'em slate refreshes about every 30 seconds.
- Detailed GameCenter data loads on demand only after a started game is opened, keeping the main Pick'em page lightweight.
- Current Pick'em locking, saved picks, Monday–Sunday weeks, and the Nov. 2–8 exhibition-week rule are unchanged.
- PWA live API routes remain network-only and are not cached by the service worker.

## Files in this patch

- `index.html`
- `service-worker.js`
- `package.json`
- `api/nhl.js`
- `lib/nhl-data.js`
- `lib/pickem-store.js`
- `assets/js/pickem-v311.js`
- `assets/css/pickem-v311.css`
- `tests/v311.test.js`
- `README-V311-LIVE-PICKEM.md`

## Validation

Targeted current-feature suite: 20/20 passing.

This includes existing Pick'em save/replace behavior, exhibition-week handling, standings/UI regressions, PWA no-cache behavior for live APIs, and mocked live NHL GameCenter parsing for scorer/assist, goalie, SOG, PP opportunities, and live power-play state.
