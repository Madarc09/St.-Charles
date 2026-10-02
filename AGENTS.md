# Protect the completed pool draft

- Start from the latest user-provided source. This project is uploaded to GitHub and deployed on the existing Vercel project.
- `data/draft-history/20262027.json` contains the REAL completed 60-pick draft. Preserve it and every future final-draft record in all packages. Never replace it with fixtures or old screenshots.
- `data/final-draft.json` and `assets/data/rosters.json` are older static records; they are NOT the current live roster source.
- Keep the Redis room key and its `:room:v259:` suffix stable across releases. UI/cache/package version numbers may change independently.
- Preserve the server-side lock, independent final-draft ledger and atomic compare-and-set behavior. Final roster ownership, player IDs, lottery order and pick order must not change during display or artwork updates.
- Sort copies for display. Do not sort or rewrite the persisted picks.
- Final draft records are separate from end-of-season statistics. End Season must archive before advancing and retain all protected draft records.
- Keep tests in isolated test rooms. Never call reset, undo, auto-fill or End Season against the real pool while checking a release.
- Run `npm test` after any storage, draft, scoring or history change. Preserve the latest full backup before changes.

## Homepage themes (approved October 2, 2026)

The user approved replacing the old fixed-size lower scene with five responsive themes: Ice Level, Arena Scoreboard, The Sports Page, Coach’s Chalkboard and Arcade Hockey. This supersedes the earlier whole-background chalkboard restriction.

Preserve the actual original header artwork: neon draft link, four navy/cream jerseys (Nick 09, Scott 81, Tyler 91, Chris 34), prominent orange Andrew 28 championship display, and trophy link. CSS windows may resize/reflow that original art for phones. Never regenerate or recolour the header.

Do not add Basement Bar League branding or a Back to the Bar link: that is a different league.

Theme choice belongs only to this browser’s localStorage, under the permanent hockey-pool:home-theme:v1 key. Never send it to the pool API or store it with a manager or draft. Keep theme changes presentation-only and the stats shared by every theme.

All standings and roster columns show the scoring weights in their headings. Separate skater goals/assists from goalie stats; use the shared PoolCore scoring. Group roster copies Forwards, Defence, Team Goalies. Keep normal-sized mobile text with horizontal table scrolling.

Read ADDING-THEMES.md before adding a theme. Keep the registry and CSS extensible, and preserve the existing theme IDs across versions.
