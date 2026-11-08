# v314 — Pick’em cleanup, hard lock, app card fit

- Removes the large Fantasy Impact roster block from live game details.
- Fantasy ownership/FPTS badges now appear only when a drafted skater or team-goalie unit has actually earned more than 0 FPTS in that game.
- Player/goalie names remain tappable and open the existing player card.
- Once your saved weekly Pick’em game has started, every later pregame team button is disabled. The API already enforces the same rule server-side, so switching games after puck drop is blocked even if the UI is bypassed.
- Installed iPhone app player-card dialog is smaller in portrait, sits below the safe-area/status region, and keeps the close button reachable.
- Desktop web, mobile web, and installed PWA share the same Pick’em behavior.
