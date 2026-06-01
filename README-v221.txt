v221 roster-room mobile fullscreen fix

Diagnosed issue:
- Roster room images were rendered as inline <img> elements with width:100% and height:auto.
- On mobile, the wide image took only the top portion of the viewport, leaving a large black empty area below.
- This was not an image asset problem; it was the roster-room stage/container CSS.

Fix:
- Roster room stall host/stage now uses 100vw x 100svh.
- Roster room image uses object-fit: cover, matching the Home/Trophy scene approach.
- Navigation remains at the bottom as an overlay.
- Applies to all owner roster rooms.

Source:
- Built from hockey-pool-v220-trophy-mobile-roster-exits-previous-seasons.zip
