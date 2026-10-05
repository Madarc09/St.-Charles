# v299 roster polish — verification

## Scope

The current v298 roster renderer receives header cleanup, larger total typography, decorative centre-ice logos and selected-day schedule labels. The existing rink image, player coordinates, centring override, real roster selections, chart/ice toggles and hockey-card handlers remain in place. Andrew uses PHI; the other comparison rinks use TOR. The NHL logo URLs use the same asset provider as the existing team crests and hide cleanly if an image fails.

The standings toggle is moved after both Top 5 panels in the header markup. A final stylesheet places it beneath those panels at desktop widths and across the mobile header below them. The rest of the standings content and its event handler are retained.

The old mobile roster-room navigation rules conflicted: a later absolute-position rule attached the links to the horizontally scrolling scene. The final mobile-only override keeps the navigation fixed and centred in the viewport, allows wrapping, and respects the bottom safe area. No room links, images, hotspots or panning logic were changed.

## Schedule and ownership behaviour

- Human and BOT season ice views show headshot, name and FPTS, without redundant ownership or schedule labels.
- Daily ice views use the selected date's NHL games, including correct opponents for both home and away teams. A known empty slate produces “On the bench”; absent schedule data produces “Schedule unavailable”. “On the ice” denotes an NHL team game, not a confirmed individual appearance.
- Dream Team always keeps its actual human/BOT/undrafted ownership labels and season-selected players. Daily availability appears in addition to ownership. The daily Dream rink has extra vertical room for those labels.
- No display operation mutates the supplied roster or feed objects.

## Checks

`npm test`: 65 passing tests. Two new behavioural cases cover selected dates, home/away opponents, off days, unavailable schedules, human/BOT/undrafted Dream labels, player-card triggers and input immutability. The earlier tests still cover exact roster selections and limits, chart/ice totals, per-owner toggles, controller refreshes, scoring, archives, draft recovery and game results.

Additional markup checks confirmed the centre-ice logo assignments, removed captions, and exactly one standings toggle after the goalie Top 5 panel in season and today views.

All `data/`, `api/` and `lib/` files, shared scoring, the browser BOT roster and rink artwork match v298 byte for byte. The small ZIP contains every protected draft-history record. It passes CRC verification and reproduces the v299 working tree when overlaid on v298, with no file deletions.

## Limits and deployment check

No deployment or live state mutation was performed. A browser binary is unavailable here; automated controller checks use fixture data and an isolated DOM adapter, not rendered screenshots.

After uploading the patch, check one human rink and Dream Team in Season and Today modes on a phone and PC. Check Andrew's centre-ice crest, the larger totals, the moved standings toggle, and that mobile room links remain centred while the room image pans. Existing headshot cards and name toggles should continue to work.
