# v294 validation

- Existing automated tests pass. Additional local checks verify human/BOT/unowned labels, zero counts, team goalie ownership, the 12-spot total, changing counts after a stats refresh and consistent labels/tallies across season and daily comparisons.
- Labels and counts are derived from the same full-pool ownership map used by Top 5 rankings. Only the Dream Team's display copies receive the new labels. Normal roster rendering and standings remain unchanged.
- Added wrapping ownership text and a wrapping count list for desktop/mobile. Counts use each theme's existing palette. This patch was not screenshot-validated in a local browser.
- Protected draft files, the BOT roster, shared scoring, backend storage and archive logic are byte-identical to v293. The ZIP was checked for corruption and verified by applying it over a copy of v293.
- Nothing was deployed and no live data was mutated while preparing the patch.
