# Hockey Pool v298 — Ice View for Every Roster

Apply this small patch over v297 in the same GitHub repository.

1. Extract `Hockey-Pool-v297-to-v298-ROSTER-ICE-VIEWS-PATCH.zip`.
2. Upload the files and folders inside to the repository root. Replace matching files and keep everything else.
3. Commit, let Vercel deploy, and refresh the website.

## How it works

- Nick, Andrew, Scott, Chris, Tyler and BOT open in the existing chart view.
- Click or tap the large name **inside a roster card** to flip that roster to its ice lineup. Click the name again to return to its chart. A small hint under the name explains the action.
- Each roster changes independently. Your choices remain in place while scores refresh and while using the Season / Yesterday / Today / Tomorrow controls or the comparison arrows. A fresh page starts from the defaults again.
- Dream Team keeps its existing ice view by default and now also flips to a chart. Its ownership tally remains above the lineup.
- Every ice view uses the same approved rink, real player headshots, fantasy points, ownership and actual roster selections. Goalies stay at the nets, defence behind the blue lines, forwards near centre.
- Tap a headshot to open the existing hockey card, including live/final game scores. Day views show daily points and mark players with no game.
- The jersey links at the top and manager names in the standings still open roster rooms.

There is a brief flip animation when you switch. It is skipped when your device requests reduced motion.

## Preserved

All 60 completed draft picks, the fixed BOT lineup, fantasy scoring, API collection, draft locks, history and End Season behaviour are unchanged. The homepage framing, themes, jersey numbers and artwork are retained. The update reuses the existing rink image, keeping the ZIP small.

## Verification

All 63 automated tests pass. New checks cover the six actual rosters, exact player IDs, 6F/4D/2TG limits, equal chart/ice totals, independent toggles, live refreshes, date/side changes, scroll/focus retention, reduced motion and normal/enlarged boards. No live draft or season action was performed.

A rendered browser preview remains unavailable here. After deployment, check the name toggle on your phone and PC. See `docs/verification-v298.md` for details.
