# v304 — Desktop standings + Pick'em selection cleanup

Changes from v303:

- Removes the Tyler 13 CSS/image overlay entirely. The original header artwork is shown unchanged again.
- Desktop standings masthead is reconfigured: Standings/current-view controls occupy a shallow full-width row and all three Top-5 boards (Team Goalies, Forwards, Defence) fill the row below at once.
- Tablet/mobile keep the existing two-board horizontal scroll layout.
- Weekly Pick'em selected team is now unmistakable: strong highlight/glow, ✓ PICKED badge, opposing team fades, and selected buttons expose aria-pressed.
- Existing global Ice/Chart roster presentation behavior from v303 remains unchanged.

Focused regression suite: 18/18 passing (pool/live scoring, scroll state, v302/v303/v304 behavior).
The reconstructed v303 source available in this session is missing several unchanged historical files referenced by unrelated older tests, so the entire legacy test glob cannot run from this patch-only source tree.
