# v291 mobile + roster-date update

Apply over an existing v290 repository. Do not delete the rest of the repo.

Changes:
- Mobile Standings heading/current-view/button centered; Top-5 boards remain below.
- Roster Comparison weekly/monthly rankings show manager names only (no fantasy team subtitle).
- Roster Comparison now has four independent modes: Season, Yesterday, Today, Tomorrow.
- Yesterday uses NHL game-level stats for the completed date.
- Today uses the existing live GameCenter/NHL scoring layer.
- Tomorrow uses the NHL dated score/schedule endpoint and shows scheduled drafted selections with 0 daily FPTS until played.
- These roster-date controls remain independent from the Standings Season/Today's Totals control.
- Adjacent-day NHL results are cached so the 15-second live refresh does not hammer historical/future endpoints.

Future note requested by Nick: add a season record for the highest fantasy-team score in a single week, including manager, week, and point total.
