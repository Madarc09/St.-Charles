# Custom Hockey Pool

Vercel/GitHub-ready custom NHL pool app with:

- Draft Room with sortable Top 75 available player board
- Add-to-roster popup
- Editable scoring rules
- Editable roster sizes
- Rosters and leaderboard
- Player stats cache
- Admin import/export backup
- Free NHL stat pull through a Vercel API route

## How to deploy

1. Upload the contents of this folder to a new GitHub repo.
2. Connect the repo to Vercel.
3. Deploy.
4. Open the site. It will automatically try to load NHL players.
5. You can also manually click **Pull NHL Stats**.

## API endpoints included

The main API route is:

```txt
/api/nhl?season=20252026&gameType=2
```

It pulls skater and goalie summary data from:

```txt
https://api.nhle.com/stats/rest/en/skater/summary
https://api.nhle.com/stats/rest/en/goalie/summary
```

No API key is required for this version.

## Important

The pool data is stored in browser localStorage. Use **Admin → Export Pool Backup** after making picks or changing rules.
