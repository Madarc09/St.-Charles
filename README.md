# Hockey Pool — v271

## Upload this update

1. Keep the previous website ZIP and your separate Completed-Draft-2026-2027-Backup.json.
2. Extract this ZIP and upload its CONTENTS into the existing GitHub repository at the level containing index.html. Include every folder, especially lib and data/draft-history.
3. Keep the same Vercel project, domain and Redis environment variables. There is no new service, payment, build step or runtime npm dependency.
4. After Vercel deploys, refresh Home. Open **Choose your theme** beside Teams / Rules / Admin at the bottom, or **Theme** above the standings.
5. Follow PHONE-AND-COMPUTER-TEST.md for the short device check.

## Five themes, one live pool

- Ice Level: bright ice, navy lettering and red totals.
- Arena Scoreboard: dark arena, steel frames and amber totals.
- The Sports Page: vintage paper and hockey box scores.
- Coach’s Chalkboard: green chalkboard with handwritten lettering. This is the initial default.
- Arcade Hockey: retro hockey graphics, cyan and magenta.

Selecting a theme changes it immediately and saves the choice in this browser. Closing/reopening the page or browser keeps that choice. Another device or browser has its own independent choice. Two tabs in the same browser follow the same saved preference. Clearing this website’s browser data resets the choice; private browsing or blocked storage may only keep it for the visit. The chooser explains if a save was blocked.

Theme selection never calls a pool API, changes a manager identity or modifies a draft. It remains independent of login, seasons and future website version numbers. Continue using the same website domain to retain the browser’s preference.

## Readable standings and full roster tables

All five themes use the same live data and scoring renderer. Standings show Manager, G (2 FPTS), A (1 FPT), SHG (5 FPTS), GWG (5 FPTS), Goalie FPTS and total FPTS. Skater G/A totals exclude goalie goals/assists, whose different weights are counted in Goalie FPTS.

Every roster displays all 12 selections, grouped Forwards, Defence and Team Goalies. Skaters show the same weighted headings. Team goalies show W (2 FPTS), A (5 FPTS), G (10 FPTS), SO (5 FPTS), FPTS. The fantasy points and live NHL polling remain those of the existing shared scoring system; the images’ illustrative scores were not imported.

On a phone the header image links reflow and roster tables stack. Names and numbers stay at normal reading size. Swipe a table horizontally to inspect all columns; its name and final-point columns stay pinned. Live stat refreshes retain the table’s horizontal scroll position. Enlarge board opens the same live board in a larger dialog with the currently selected theme.

The original header PNG and every approved roster-room image are unchanged. CSS windows show the existing draft sign, Nick 09 / Scott 81 / Tyler 91 / Chris 34 navy-and-cream jerseys, Andrew’s prominent orange 28 championship display and the trophy-room link. There is no added league branding or Back to the Bar link. Tyler’s Sundin and Andrew’s Brière updates remain.

See ADDING-THEMES.md to add another theme. One registry entry and a scoped CSS block add its chooser option automatically; no duplicate page or scoring logic is required.

## The completed draft remains protected

The real 2026–2027 60-pick draft remains in data/draft-history/20262027.json, with its CSV roster list and SHA256 record. Original player IDs, owners, lottery order and pick sequence are unchanged. The backend, NHL scoring, Redis room key and independent locked-draft ledger are unchanged from v270. The internal v259 storage suffix and existing record format names are intentional compatibility identifiers; do not rename them to match this release.

The completed live draft stays closed and rejects undo/reset/new picks. The home board and roster rooms continue collecting live scores. View record opens the saved draft without reopening it.

End Season is still for the real end of the season: it archives final standings, player stats, rosters and picks before advancing, while retaining the locked draft record. Do not use End Season to test a theme. Admin → Download full backup includes the current pool, lottery, history and locked draft records. Keep that backup outside the website.

## Verification

Automated checks cover isolated browser preferences, reload persistence, early saved-theme selection, blocked/invalid storage, goalie/scorer totals, every player appearing once, unchanged draft ownership, atomic draft protection, archive retention, NHL scoring and live game overlays. JavaScript syntax, local asset references, HTML IDs and the ZIP contents are checked before delivery.

The local preview browser blocked localhost with ERR_BLOCKED_BY_CLIENT, so desktop/mobile visual verification must be completed after deployment using the included checklist. No changes were made to the live pool during this work.

Run npm test with modern Node.js. npm run preview:test starts a loopback-only local preview using synthetic NHL data and isolated in-process storage. Do not set POOL_LOCAL_TEST in Vercel.
