# v303 — standings / roster view / Pick'em / Tyler jersey fix

Apply this patch over v302. Do not delete the rest of the repository.

## Changes
- Restores the standings masthead to the original two-leader-board size.
- Top-5 board order is Team Goalies → Forwards → Defence.
- The right leader area scrolls horizontally: Goalies+Forwards initially, then Forwards+Defence.
- Roster Comparison Ice/Chart presentation is now global across every team (and Dream Team/Spare Parts).
- Weekly Pick'em uses persistent delegated clicks and recognizes future games even if the NHL feed uses a non-FUT schedule-state label.
- Pick'em automatically opens the next selectable day if today's games are all locked.
- Tyler's Home-header jersey is visually corrected from 91 to 13 across the shared header/theme presentation without recompressing the source artwork.
- Spare Parts naming and v301 scroll-state preservation remain intact.

## Verification
Focused regression suite: 11/11 passing (`v301-scroll-state`, `v302`, `v303`).
The reconstructed uploaded patch tree lacks some old historical test-only modules/files, so a blanket `npm test` includes unrelated legacy missing-module failures; the current affected regression groups pass.
