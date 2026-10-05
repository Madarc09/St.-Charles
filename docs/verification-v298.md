# v298 roster ice views — verification

## Change

The v297 rink renderer is shared across all comparison rosters. Human and BOT charts remain the defaults; the Dream Team retains its ice default. Both chart and ice headers use a roster-name toggle with an action label and a visible hint. Real roster-room links remain on the homepage jerseys and standings.

Per-owner presentation is stored only in browser page memory. Toggle actions render comparison hosts, preserving horizontal scroll and restoring focus to the selected name. Normal and open enlarged boards use the same choices. Standings state is independent. Live refreshes, daily modes and comparison arrows retain choices. A new page restores the defaults. A short Web Animation runs only on the clicked card, unless reduced motion is requested or animation support is unavailable.

Player positions, artwork and the v297 centering override remain unchanged. Each ice lineup is built from a copy of its own roster. Goalkeeper portraits use the existing NHL goalie feed for that team, with a team-crest fallback. Players on off days remain visible and are labelled in daily ice views; daily chart/ice totals agree. The Dream Team remains comparison-only.

## Automated checks

`npm test`: 63 passing tests.

The five added cases verify:

1. All five human rosters and BOT default to charts; their ice views contain exactly their own 6F / 4D / 2TG, matching season totals and goalie images, without mutating inputs.
2. Chart and ice daily totals agree for Yesterday / Today / Tomorrow; all ice player/goalie cards remain interactive and off days are marked.
3. Dream Team can display a chart with ownership and counts, remains outside actual standings, and existing jersey links remain available.
4. The actual browser controller's name events update only the requested owner's presentation on normal/enlarged boards, retain both horizontal scroll positions and focus, and leave standings/data unchanged.
5. Presentation choices survive date switches, arrows and fresh stats. Reduced motion skips animation; a new page restores the defaults.

Existing tests continue to cover locked draft recovery, season archives, shared scoring, fixed BOT constraints, themes, available-pool rankings, period totals and game-score card polling.

## Release checks and limits

The protected draft JSON/CSV/hash manifest, canonical BOT roster, all backend API and library files, shared scoring, storage and archive code remain byte-identical to v297. The rink image is unchanged and reused from the installed version. The ZIP includes all protected draft records, passes CRC checks and reproduces v298 when applied over v297.

No deployment or live mutation was performed. A browser binary is unavailable, so controller checks use an isolated DOM adapter and fixture data, not rendered screenshots. The approved v297 rink styling is retained; the new header hint and flip animation still need a visual check on the user's phone and PC.
