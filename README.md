# Basement Bar League — v269

## Upload this update

1. Keep the v268 ZIP and the separate **Completed-Draft-2026-2027-Backup.json**.
2. Extract this ZIP and upload its **contents** into your existing GitHub repository, at the level that contains `index.html`. Include **all folders**, especially `lib` and `data/draft-history`.
3. Keep the same Vercel project and the existing Redis environment variables. No new service or payment is needed.
4. After Vercel deploys, refresh the home page. You should see **Final rosters locked** and all five rosters. The draft room should say **That’s a wrap**.
5. Check the phone and computer using `PHONE-AND-COMPUTER-TEST.md`.

This is a complete website replacement package with no build step and no runtime npm dependencies. Upload extracted files, not the ZIP itself. Do not deploy as GitHub Pages, which cannot run the API functions.

## Your completed draft is preserved

The real 2026–2027 live draft was captured from your existing website before these edits. It contains **60 unique selections**, **five managers**, and **6 forwards / 4 defence / 2 team-goalie units per manager**. The actual pick sequence, player IDs, owners, lottery order and original pick timestamps are retained. Display sorting does not reorder the saved picks.

- `data/draft-history/20262027.json` is the protected copy included in this package and GitHub.
- `data/draft-history/20262027-rosters.csv` is a readable roster list you can open in a spreadsheet.
- The separate downloaded JSON backup also includes all three existing historical seasons.
- The update keeps the exact Redis room key used by v268: its internal `v259` suffix is intentional and must never be changed just to match a release number.
- On the first successful live load after deployment, the server locks the completed draft and saves an independent final-draft ledger in Redis alongside the room. Both save together, with no expiration.
- The server rejects undo, reset, season changes, new picks and a new lottery for a locked live draft. Hiding buttons is only the visible part; the APIs enforce the same rules.
- If the active room is missing, its final draft can be recovered from the independent ledger or the packaged copy. Conflicting complete records stop with an error rather than silently overwriting selections.
- Future live drafts automatically lock when all 60 picks are saved. Test rooms remain separate and resettable.

The new lock takes effect when you deploy v269. The separate backup has already been created. Keep that backup and the protected data folder in later website updates.

## Draft history versus End Season

**Locking the draft does not end the season or freeze scores.** The home board and roster rooms continue using the existing live NHL statistics and scoring rules from v268.

Use **View draft record** on Home, in the closed draft room, or under Admin to see the final grouped rosters, lottery order and original sequence of all 60 picks. The record has its own download button and contains draft selections, not final season scores.

At the actual end of the season, Nick can use **End Season** in Admin. It still requires fresh NHL statistics, saves final standings, player statistics, rosters and picks to the history book, then opens the next season. The separate final-draft record stays saved after this transition. If the fresh statistics request fails, the active season stays intact.

**Admin → Download full backup** now includes current draft, lottery, season history, every locked draft record and scoring rules. The public UI has no delete control for live season history or final draft records.

Selecting a manager name is the existing trust-based arrangement for this group; there are no new passwords. Select Nick from the name control in Admin to use commissioner tools without reopening the draft.

## Home and artwork changes

- The familiar basement scene and clickable jersey entrances remain at the top.
- Larger standings show each manager’s rank and fantasy points. Select a manager to jump to their roster.
- All five roster cards display full names and current stat lines. Desktop uses multiple columns; phones show full-width cards.
- Players are grouped as **Forwards → Defence → Team goalies**, alphabetically within each group.
- Team-goalie names remain complete, including **New York Islanders Goalies**.
- Nick’s home-page jersey reads **09**.
- Tyler’s room has a **Sundin 13** jersey and matching helmet/nameplate.
- Andrew’s room has a **Brière 48** jersey, helmet, framed picture and collectible puck.
- The other three room images, existing historical files, lottery animation and NHL scoring implementation are unchanged from v268.

The three image edits were made with the built-in image tool. Asset paths and exact prompts are listed in `ARTWORK-CHANGES.json`.

## Keep tests separate

**Admin → Open test room** opens the existing rehearsal room. Use the same test-room link on both devices. Test picks and test history never affect the live pool. **Clear all test data** works only in a test room.

A finished live draft cannot be reset. **End Season** is for the real end of the season, not a way to test this update.

## Technical checks

Run `npm test` with a modern Node.js installation. The suite covers draft validation and races, NHL scoring and the live GameCenter overlay, archives, test-room isolation, protected final selections, rejection of edits, atomic room/ledger persistence, recovery, next-season transition, and roster display grouping.

The automated checks passed for this package. All inline and external JavaScript was parsed, HTML IDs and local asset paths were checked, and the saved 60-pick record was compared against the original live capture. Desktop/mobile visual rendering still needs the short post-deployment check on your devices; the review browser could not preview the local build.

`npm run preview:test` starts a local synthetic-data preview. It never connects to your production pool. Do not set `POOL_LOCAL_TEST` in Vercel.
