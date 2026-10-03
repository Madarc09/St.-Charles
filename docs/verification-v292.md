# v292 verification — October 3, 2026

## Passed

- 37 automated cases: 5 completed-draft/history/storage tests, 21 homepage and historical regression tests, 4 pool/API tests, and 7 v292 BOT/theme tests. Each suite ran in an isolated process; all passed.
- Human draft: the bundled 60-pick record matches the live read captured during preparation. Its bytes, original header artwork, shared scoring, NHL collector, application data flow, storage implementation and draft-lock implementation are identical to the assembled v291 baseline.
- Every existing CSS file and all seven original header buttons are unchanged. The new skin stylesheet is additive and presentation-focused. Page 1 receives no alternate-skin styling.
- v292 human-only board markup equals v291 exactly across all eight combinations of roster dates and standings modes. BOT adds one competitor without changing human picks, identities or links.
- BOT: exactly 12 unique, undrafted selections (6F/4D/2TG); canonical and browser records match. All scoring bonuses, missing stats, ties, repeated refreshes, conflict protection, season gating, day/week/month totals and no-BOT-roster-room behaviour pass.
- Browser JavaScript wiring was exercised with an in-memory document harness: BOT is added once, comparison works, date and standings controls remain independent, and a refresh retains their choices. This is a logic test, not a rendered browser test.
- Theme persistence, independent device preferences, blocked browser storage, old preference fallback, six choices and artwork paths pass.
- End Season was exercised only in local synthetic storage. It archives the BOT snapshot and retains the original picks and protected final-draft ledger before advancing. No live End Season/reset action was taken.
- 26 inline scripts and 37 JavaScript files parse successfully, including module-format files. Referenced local homepage and new skin assets exist.

## Visual verification limit

The original live homepage and the five generated artwork plates were visually inspected. The browser blocked the local preview with ERR_BLOCKED_BY_CLIENT, so no rendered desktop/mobile acceptance check of the assembled v292 page was possible here. Actual-device appearance, image crops and font fit should be checked after the GitHub/Vercel update. This release does not claim a completed visual browser test.

## Device check after deployment

Open the homepage on phone and computer. Choose different themes at the bottom, refresh both, then verify each retains its own choice. Return to Original Home to compare the familiar frame. Try each of the seven header links, swipe/scroll roster tables, switch the four date views, and select BOT in standings. These checks require no reset or End Season action.

## Small-package follow-up

The five PNG theme plates were losslessly encoded as WebP at unchanged resolution. Decoded image bytes match the originals exactly. Only image references, cache identifiers, packaging metadata and these instructions changed from full v292. The protected draft and BOT roster remain byte-identical. The update is a delta from v291, with the protected final-draft record included unchanged.
