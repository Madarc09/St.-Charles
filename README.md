# Basement Bar League — v260

The draft-room upgrade for your existing GitHub → Vercel website.

## Upload to GitHub

1. Keep your previous ZIP or GitHub commit as a backup.
2. Extract this ZIP. Upload its **contents** into the same GitHub repository folder that currently contains `index.html`. Do not upload the ZIP itself or put everything inside an extra nested folder.
3. Include the new `lib` folder, all six files in `api`, the updated `assets` folder, `index.html`, `package.json`, and `vercel.json`. The scripts and tests can also stay in the repository.
4. Keep your existing Vercel project and its Redis environment variables. No new paid service, API key, or database is introduced.
5. Let Vercel deploy your GitHub change, then refresh the site on both devices. Follow `PHONE-AND-COMPUTER-TEST.md` before your real draft.

Use the same Vercel settings as your existing static site. This project has no build step or runtime npm dependencies. The root `index.html` is the homepage; `/api/*` are Vercel functions. Do not publish it as GitHub Pages, which cannot run those functions.

## What changed

- **v260 roster-room update:** Draft/Wait buttons have stronger contrast on desktop and mobile. Owner-room navigation uses manager names again (Nick, Andrew, Tyler, Chris, Scott). Each locker room now overlays the roster currently saved in the shared draft, so new picks replace the baked previous-season player list automatically; opening a room refreshes the shared draft first.
- Entering the draft room requires choosing Nick, Chris, Andrew, Tyler, or Scott. There is no automatic Nick selection and no password. The name is remembered in that browser tab; use the name button to change it.
- The arena screen shows **Draft Lottery Results**, with all five positions set to **TBA** until the lottery is official.
- The existing Bettman reveal sequence, ready check, online indicators, commissioner “Confirm for all managers,” skip, and replay are retained. Replay uses the saved order.
- Lottery results, picks, presence, and chat are shared. The server checks whose turn it is, roster limits, duplicate players, and simultaneous requests.
- **Roster Needs**, **Up Next**, a collapsible personal roster, and the Draft Results ticker remain. The old drafting-as selector and On Deck block are removed.
- Player/team search includes all 32 team-goalie units. Position and team filters can be combined; sorting includes fantasy points, names, teams, goals, assists, games, goalie wins, save percentage, and GAA. Player rows no longer say “Real NHL API.”
- A small collapsible chat sits above the ticker. It keeps the latest 150 messages for that room.
- The draft has a new arena background. Existing home, trophy-room, owner-room images, and original historical season files are unchanged.
- Broken duplicate draft controllers and unused controls were removed. Team and scoring rules now describe the actual 6F / 4D / 2 team-goalie draft.

## Lottery and draft flow

Home → Enter Draft Room → choose your name → Enter Draft Lottery → I’m Ready.

Everyone opens the same room. The commissioner can confirm all five managers when needed. Managers in the lottery see the same saved order revealed. Closing the finished lottery returns them to the draft; the first manager can pick. Someone arriving late loads the same official order and existing picks.

The room refreshes about every 3.5 seconds while the draft is open. Presence updates about every 14 seconds and fades after roughly 45 seconds away. Hidden tabs pause polling. The results become shared as soon as a successful save completes, although another device can take one polling interval to display it.

## End Season and history

In the **live pool**, Nick’s **End Season** control:

1. Requires a complete 60-pick draft.
2. Fetches fresh regular-season statistics for the pool’s selected season.
3. Recalculates every roster’s score using those statistics.
4. Saves standings, champion/ties, rosters and player statistics, all picks, lottery results, scoring rules, and timestamps in shared history.
5. Only after that save succeeds, opens the next season with empty picks and a fresh lottery.
6. Downloads a JSON copy of the completed season.

If fresh statistics cannot be verified, End Season fails without clearing the draft. It does not use the previous season’s draft-comparison points as final live-season scores.

Use **Open history book → select a season → View saved rosters & picks** to inspect a saved record. Older historical seasons retain the information present in your original files; missing historical player details are not invented. Test seasons never enter the live all-time totals.

Shared room/history records have no automatic expiry in this code and survive deployments. Keep the Redis database connected and retain the downloaded backups. **Download full backup** exports the current draft, lottery, and all history visible in that room. There is deliberately no live-history delete button.

## Safe tests

**Admin → Open test room** opens a separate shared rehearsal. Copy that room’s link onto your other device.

It has its own lottery, picks, chat, and archives. Its **End Test Season** uses the previous completed season’s statistics so you can exercise the full process before this season finishes. **Fill remaining test picks** avoids making all 60 selections manually. **Clear all test data** removes only that rehearsal’s picks, lottery, chat, and test archives. It cannot run against the live room.

**Reset draft & lottery** clears the active room’s picks, lottery, and chat but retains its archived seasons. Resetting the live draft requires typing `RESET LIVE DRAFT`.

## NHL data

The official NHL feeds already used by the project remain the source:

- Statistics: `https://api.nhle.com/stats/rest/en`
- Current roster membership: `https://api-web.nhle.com/v1/roster/{team}/current`
- Player headshots and team logos: `https://assets.nhle.com`

Instead of fetching the same summary reports sorted 13 different ways, the server loads complete skater and goalie summaries and paginates when necessary. It checks for truncated or duplicate rows. Team-specific goalie reports are requested when a traded goalie needs to be split between clubs.

Team-goalie save percentage and GAA come from combined saves, shots, goals allowed, and time on ice. Team games use goalie starts when available, so relief appearances do not inflate them. Current roster membership supplies current teams and rookies; prior-season statistics remain clearly labelled as draft comparisons.

Current-season statistics are cached for five minutes, completed-season statistics for six hours, and current rosters for twelve hours. Warm server requests share results; Redis retains the last successful update. Ordinary pages may show a labelled saved update during an NHL outage. End Season requires a fresh successful response. This is near-live season scoring, not a per-shot live game feed, and remains dependent on NHL feed availability.

## Storage and migration

The backend accepts the same REST credential pairs as the original project:

- `KV_REST_API_URL` and `KV_REST_API_TOKEN`, or
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or
- `REDIS_REST_API_URL` and `REDIS_REST_API_TOKEN`.

Keep these in Vercel, never in GitHub or this ZIP. Without shared storage, production shows an error instead of pretending that a browser-only save is shared.

The first v259 room loads the old server draft and lottery when applicable. A previous deliberate reset or static archived-season fallback is respected. Legacy keys are left untouched as a migration backup. v259 writes its own versioned room key and uses atomic compare-and-set updates to prevent lost picks. Test rooms use different keys.

If you roll code back after using v259, the old code will see its old storage snapshot, not newer v259 picks. Download a full backup before a rollback and do not mix old and new clients during a real draft. No recovery import is exposed in the public UI; the JSON backups are available for a deliberate recovery if needed.

Name selection is the trust-based arrangement requested for this friends’ pool. Selecting Nick exposes the commissioner controls; this is not password authentication.

## Developer checks

With a modern Node.js installation:

```sh
npm test
npm run preview:test
```

The local test preview is `http://127.0.0.1:8787/?room=test-local#draft`. It uses synthetic NHL players and temporary in-memory rooms. Synthetic fixtures are imported only by the test/preview scripts, never production API functions. Do not set `POOL_LOCAL_TEST` in Vercel.

Validation performed for this ZIP: automated concurrent-pick, lottery, roster-limit, archive, stale-data refusal, test-isolation, pagination, migration, and scoring checks; JavaScript syntax, HTML IDs, asset references, and unchanged original image/history checks.

Still to verify after upload: desktop/mobile rendering in your browsers, your existing production Redis connection, and real NHL responses from Vercel. This session’s preview browser could not open the local build, and the live NHL endpoint was unavailable from the review environment. The two-device guide covers those checks; do them in the test room first.
