# Custom Hockey Pool v2

A Vercel-ready custom NHL pool website for a private friends league.

## What it does

- Draft board showing the top 75 available players with sortable stat columns
- Editable scoring rules
- Editable roster sizes
- Owner/team setup
- Rosters
- Leaderboard
- NHL stats pull using free public NHL endpoints
- Add-to-roster pop-up so any selected player can be assigned to the correct owner
- Manual player add option
- Export/import full pool backup as JSON
- Vercel serverless proxy route at `/api/nhl` to reduce browser/CORS problems

## Upload to GitHub + Vercel

1. Create a new GitHub repository.
2. Upload all files from this folder into the repo root.
3. Go to Vercel and import the GitHub repo.
4. Deploy with the default settings.
5. Open the deployed site, click **Pull NHL Stats**, then use **Draft Room** to sort the board and assign players to rosters.

## Important

This project uses community-documented public NHL endpoints. They do not require an API key for this version, but because they are not a paid contract API, endpoint behavior can change.

## Data storage

The site saves changes in the browser's `localStorage`.
Use **Admin → Export Pool Backup** after changes.
Use **Admin → Import Pool Backup** to restore the pool on another device/browser.

For a later version, the next big upgrade would be a real database or login system so multiple owners can draft from separate devices at the same time.

## Main files

- `index.html` — app shell
- `assets/css/style.css` — styling
- `assets/js/app.js` — main app logic
- `assets/js/nhl-api.js` — NHL stat fetching and normalization
- `assets/js/scoring.js` — fantasy scoring calculations
- `assets/data/pool-settings.json` — default editable rules
- `assets/data/owners.json` — default owners
- `api/nhl.js` — Vercel proxy API route
