# v297 spacing correction

The user screenshot showed the top goalie card starting at the rink centre instead of being centred there. The same displacement pushed the right-side forwards beyond the rink edge.

The cause was `#dashboard button { transform:none!important }` in the shared board CSS overriding the Dream Team's non-important translate. The scoped Dream Team rule now uses `transform:translate(-50%,-50%)!important`, with higher specificity than the reset. It applies to normal and enlarged board roots. Existing percentage positions, player sizes and artwork remain unchanged.

The roster-count panel now renders between the caption and the rink image. Its data and styling remain unchanged.

Validation: all 58 automated tests pass, including the updated count-panel placement assertion. Protected draft records, the canonical BOT roster, shared scoring, backend game-score handling, storage and archive code are byte-identical to v296. The update ZIP includes the protected draft records, passes CRC verification and reconstructs v297 when overlaid on v296.

No live data writes or deployment were performed. This environment has no working browser preview, so the CSS cascade and generated markup were checked without a rendered screenshot.
