# thePool v313 — Live Fantasy Impact

This patch extends the v312 Pick’em live-game drawer with fantasy ownership and game-level fantasy points.

- Reads human ownership from the actual shared draft.
- Reads Spare Parts from the fixed BOT roster manifest only when the locked 2026–27 live draft is active.
- Adds a Fantasy Impact panel to expanded live/final Pick’em games.
- Highlights the logged-in manager’s drafted players and shows game FPTS.
- Shows ownership/FPTS on team-goalie matchup cards.
- Makes scoring-log skaters, assists, Fantasy Impact entries and goalie cards open the existing hockey player/team-goalie card.
- Uses the shared scoring rules: skaters G 2, A 1, SHG +5, GWG +5; team goalies W 2, A 5, G 10, SO 5.
- Bumps the GameCenter detail cache and PWA cache to v313 so new fields are not hidden by stale responses.

No draft ownership, Redis keys, Pick’em records, standings formulas or protected draft-history files are changed.
