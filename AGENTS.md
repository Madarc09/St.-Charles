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

## Homepage design preference

Keep the complete original basement background and live writing directly on its chalkboard. Retain standings on the left and the five rosters on the right. Improve fit and readability within that composition; do not replace it with a cropped hero or standalone dashboard cards.
