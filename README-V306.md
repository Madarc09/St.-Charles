# v306 — Just the Tip / Your Pick visual upgrade

Apply over v305/current repo; do not delete unchanged files.

Changes:
- Keeps the approved Just the Tip header artwork.
- Enlarges and centers the live week/date text inside the artwork's bottom display panel.
- Replaces the plain Your Pick text box with a new cinematic matchup artwork containing empty team bays.
- Dynamically injects the actual NHL away/home logos into those bays when a matchup is selected or already saved.
- The selected team gets a bright green YOUR PICK indicator and glow.
- Saved picks remain visible after reload; W/L result styling is supported.
- The normal day/game picker and save workflow remain below the new display.

Focused regression suite: 16/16 passing (scroll state, Pick'em storage/selectability, standings layout, artwork rule, and v306 behavior).
The reconstructed working tree also contains older stale tests that reference files absent from the supplied patch history; those unrelated legacy failures are not caused by v306.
