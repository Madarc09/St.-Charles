# Check v272 on your phone and computer

These checks do not change the draft or season.

1. Open the deployed website on your phone and computer. Refresh once after Vercel finishes.
2. On the phone, choose Arcade Hockey from Choose your theme near the bottom links (or Theme above the standings). On the computer, choose Ice Level. Confirm the two screens retain their separate choices.
3. Close and reopen each browser page. The phone should still use Arcade Hockey and the computer Ice Level. Try another theme at any time; changes save immediately. Clearing site data or using private browsing can reset this preference.
4. Check all five choices. Confirm the same players and points appear in every theme. The high-detail frames should match the approved concept art: arcade neon, arena steel, chalkboard, newspaper and modern ice. No example/sample scores should remain visible behind the live table.
5. On the phone, confirm the top locker-room art is one compact horizontal strip and the standings/roster panels use the phone artwork rather than a squeezed desktop panel. All current columns should remain readable and the whole page must not scroll sideways.
6. Check that all five roster sections show 6 forwards, then 4 defence, then 2 team-goalie units. Stat headings include their scoring weights.
7. Check the original header links: draft, trophy room and each jersey. Andrew remains the large orange 28 champion; Nick 09, Scott 81, Tyler 91 and Chris 34 retain the original navy-and-cream artwork.
8. Use Enlarge board, then close it. Its theme and live data should match the page. The manager names still open their roster rooms.
9. Confirm the home board says Final draft locked and 60/60 saved. View record should show the original completed draft. Spot-check Nick: Connor McDavid; Chris: Macklin Celebrini; Andrew: Cole Caufield; Tyler: Nikita Kucherov; Scott: Nathan MacKinnon.
10. The draft room should remain closed. Keep your existing completed-draft backup. Do not press End Season or reset anything as part of this appearance check.

For any future draft rehearsal use Admin → Open test room on both devices and verify both clearly say TEST ROOM. Live data never needs to be reset to test appearance.

## v273 neon arena home rebuild
- [ ] Desktop: existing header image and all Draft / manager / Trophy Room hit targets still work.
- [ ] Desktop: standings spans the page without crushed columns; each stat reads like `3 (6)` and total FPTS is visually emphasized.
- [ ] Desktop: roster area shows large side-by-side cards; horizontal scroll/arrows expose all five managers.
- [ ] Desktop: Nick/Scott/Tyler/Chris use cyan treatment; Andrew uses champion red/orange treatment.
- [ ] Desktop: each skater roster has Player Name, G, A, SHG, GWG and FPTS; each goalie row has Team Goalies, W, A, G, SO and FPTS.
- [ ] Mobile: standings scrolls sideways rather than shrinking the stat text into unreadable columns.
- [ ] Mobile: one roster card occupies the useful width at a time; swipe/arrows and manager chips navigate all five.
- [ ] Clicking a manager in standings or the roster heading still opens that manager's roster room.
- [ ] Live NHL status and stat refresh continue to update without changing the visual layout.

## v274 desktop arena polish
- [ ] Desktop roster rows stay dark (no white legacy-theme zebra rows).
- [ ] Andrew and other managers share the same dark table body; manager/champion color is trim only.
- [ ] Roster table headers read G / A / SHG / GWG without collision at 1280px desktop width.
- [ ] FPTS column is consistently gold across all roster cards.
- [ ] Two roster cards remain readable side-by-side on typical desktop widths.
- [ ] Mobile layout/spacing/colors remain identical to v273.

## v275 comparison checks
- Desktop (>700px): exactly two roster cards are visible at once.
- Desktop: left and right arrow controls change only their own comparison side; the same manager is not shown on both sides when alternatives exist.
- Mobile (<=700px): all five rosters remain available one card at a time in the horizontal carousel.
- Roster tables: horizontally scroll G/A/SHG/GWG/FPTS and confirm Player Name / Team Goalies stays pinned on the left.
- Standings: horizontally scroll and confirm rank + manager stay pinned on the left.


## v277 Today / card checks
- [ ] Standings: Today’s Totals switches to today-only rankings and Season Totals switches back.
- [ ] Standings and roster tables: FPTS is the first stat after the frozen manager/player name.
- [ ] Mobile: manager name is centered in each roster card header with one arrow on each side; no extra arrows flank Tonight’s Active Players.
- [ ] Tap a skater name/headshot: a 1996-series card opens with five individual recent games plus Last 10 and Last 25 totals.
- [ ] Tap a team-goalie row: the goalie-unit card shows headshots for goalies with appearances and the unit's recent game totals.
- [ ] Close cards by X or tapping the dark backdrop; roster/standings scroll positions should remain intact.
