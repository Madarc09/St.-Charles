# Adding another theme

All five themes use one live board. A theme only changes appearance; it does not own a roster, season, identity or score.

1. Add one entry to the themes array in assets/js/home-themes.js. Give it a permanent, unique lowercase id, a name and a short description.
2. Add a matching block to assets/css/home-themes.css. Copy an existing theme block and change its colour, font and background variables. Include both selectors: :root[data-pool-theme="your-id"] and [data-preview-theme="your-id"]. The second selector makes its chooser preview match.
3. Add any extra decoration under html[data-pool-theme="your-id"] selectors. Keep it scoped to the homepage, board and theme chooser. Put new background assets in assets/images/themes. Keep text and scores as HTML, never embedded in a background image.
4. Bump the cache query on the two changed files in index.html. Do not rename existing theme ids or change the localStorage key when increasing the website version.
5. Run npm test, then check a wide screen and a 390px phone layout. Choose the new theme, reload and verify it remains selected. Check a separate browser still retains its own choice.

The chooser generates itself from the registry. There is no need to add new HTML options, duplicate a page, touch the shared pool API or copy the board renderer.

Keep the original header image unchanged. Its desktop and mobile image windows are in home-board.css. Preserve all manager names, jersey numbers/colours and Andrew’s prominent championship display.

The storage key is hockey-pool:home-theme:v1. It intentionally does not include a release, season, manager id or shared room. Storage belongs to this website’s origin and browser profile. A different browser or device gets an independent preference. Clearing site data resets it; private browsing may only keep it for the current session. Existing saved preferences remain valid after normal GitHub/Vercel updates on the same domain.

home-board.js is the sole renderer. PoolCore remains the source for scoring weights, position grouping and fantasy points. Stat updates preserve horizontal table scroll and keyboard focus. Never make a theme depend on a separate scoring formula.
