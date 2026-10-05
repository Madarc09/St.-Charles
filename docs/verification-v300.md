# v300 verification

## Behaviour

All comparison rosters default to ice. The existing per-owner page-memory toggle still flips to charts, preserves scroll/focus, respects reduced motion and survives data/date/side changes. A reload restores the ice defaults.

Daily rink filtering happens after season slots are assigned. Only selections whose NHL teams have a game remain; active players do not move to other positions or get replaced by other players. Selecting Season restores all selections. Human/BOT and Dream Team use the same filter. The Dream Team's ownership tally still counts the full season-selected roster. With an unavailable schedule, selections remain visible and carry the existing unavailable-schedule label.

`lib/pool-clock.js` computes a date from local calendar fields in `America/Toronto`; hours before 04:00 use the previous calendar date. This avoids the daylight-saving error caused by simply subtracting four elapsed hours. `liveFeed` requests `/score/YYYY-MM-DD`, caches per season and date, and rejects malformed/mismatched slates. Adjacent-day lookups also reject mismatched dates. Neither the NHL `/now` rollover nor a still-fresh previous-day cache can choose the pool's date. The existing roughly 15-second refresh and visibility-change refresh are retained.

The new game skins use the existing theme registry and storage key. Their actual shipped artwork drives both the header and chooser preview. `data-home-theme-family="game"` scopes their contrast overrides and HTML sign labels; the legacy layout attribute remains `chalkboard`. All existing theme IDs remain valid.

## Validation

`npm test`: 69 tests pass. New boundary cases cover 03:59:59/04:00 Eastern, spring and autumn daylight-saving changes, the repeated autumn hour, new year and leap day. Mocked feed tests verify date-specific requests and cache separation, correct season/game-type/date filtering and rejection of unavailable schedules. Roster checks cover active IDs, unchanged slot coordinates, empty slates, restored season rosters, ownership, totals, headshot actions and no mutation of inputs.

The existing tests still cover locked draft recovery, atomic commits, archives, fixed BOT constraints, scoring and deduplication, independent periods, available-pool rankings, player-card score polling, themes and comparison controls.

Additional checks inspect the five banner images and transparent All-Star decal, verify that lossless WebP conversion retains every pixel, and measure the new table palettes. The lowest checked text/background contrast is above 7.8:1 across normal/alternate rows, muted copy, headings, points and selected controls.

The protected draft JSON/CSV/hash manifest, all other `data/` files, canonical/browser BOT records, scoring core, every API handler, pool storage/archive code, original rink artwork and all older theme artwork are byte-identical to v299. The only production backend changes concern dated NHL lookups and the new clock helper. Persistent draft/room keys are untouched.

The patch includes every protected draft record, passes ZIP CRC verification, contains no deleted-file requirement and reproduces the completed v300 tree when applied over v299.

## Limits

No deployment or live pool mutation was performed. There is no available rendered browser preview in this environment; controller tests use isolated DOM adapters and fixtures. The image assets were inspected, but CSS placement and typography still need the final phone/PC check after deployment. Game-day presence is team-schedule based, not an individual lineup confirmation.

The Mario Kart and Smash banners are scenery-only interpretations after the character-heavy attempts were rejected by the image generator. Final assets, prompts and source/credit details are listed in `theme-artwork-v300.json`.
