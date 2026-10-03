# Hockey Pool — v292 Small Update

This smaller package adds all v292 changes over your existing v291 website. It also works if you uploaded some or all of the larger v292 package. It contains the changed files and a matching copy of the protected final draft. Keep all other existing GitHub files.

## Install

1. Download and extract `Hockey-Pool-v292-SMALL-UPDATE.zip`.
2. Upload the extracted **contents** to the root of the same GitHub repository, replacing matching files. Drag the files and folders from inside the extracted folder into GitHub’s upload area. Keep the folder paths intact. Upload the contents, not the ZIP itself. Do not delete the repository or any files missing from this small package.
3. Commit the upload and let the existing Vercel integration deploy it. Keep the existing Vercel settings and environment variables.
4. Refresh the homepage. At the bottom, select **Choose your theme**. Original Home is Page 1; the other five choices are Frostline, Heritage Hall, The Press Box, Neon Ice and Arcade Hockey.

No migration, draft reset or End Season action is required to install this update.

The five new images use lossless WebP encoding at their original resolution. Decoded pixels were verified identical to the larger PNG originals; this is a file-size reduction, with no image-quality reduction.

## What changed

- Five actual image-based skins, with matching backgrounds and type. The approved v291 layout, controls, scrolling and original Page 1 artwork are retained. All seven navigation links still go to the same destinations.
- Each browser remembers its own theme. Selecting a skin does not change another manager's screen or the shared pool data.
- BOT **The Spare Parts** joins season/today standings, weekly/monthly rankings and the existing roster comparison. Click BOT in standings to compare its roster, or cycle through the teams. Player stat cards work normally. There is no BOT roster room or extra draft identity.
- BOT has a fixed, saved 6F/4D/2TG roster selected exclusively from the undrafted pool. Its selection used previous completed seasons and preseason outlooks, not 2026–27 results. All 2026–27 regular-season points count for standings, on the same basis as the human teams.
- End Season also saves a BOT snapshot with the archived season. Existing human trophy/championship handling remains intact.

All 60 human picks, pick order, lottery data and locked draft history are preserved. The stable storage keys, atomic updates and independent draft ledger remain unchanged. The NHL statistics collector is unchanged; BOT uses the same existing feed.

See `BOT-TEAM-2026-2027.md` for the roster and research, `ADDING-THEMES.md` for future themes, and `docs/verification-v292.md` for validation and its limits.

## Local checks

Run `npm test`. `npm run preview:test` uses synthetic NHL data and local test storage only. Never use the real pool's reset or End Season controls to check an update. No test data or test season was written to the live pool while building this release.
