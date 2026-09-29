# A safe rehearsal on your phone and computer

Run this after uploading v259 and waiting for Vercel to finish deploying.

## 1. Open one shared test room

1. Open your normal homepage on the computer.
2. Go to **Admin → Open test room**.
3. The draft asks **Who is this?** Choose **Nick**.
4. Open **Admin → Copy this room’s link** and open that link on your phone.
5. Choose **Chris** on the phone.

Both draft screens must say **TEST ROOM**. Do every rehearsal step there. Your live pool has its own room and history.

## 2. Test the lottery

1. Check that the five Draft Lottery Results positions say **TBA**. If you previously rehearsed, Nick can first use **Admin → Clear all test data**.
2. On both devices, choose **Enter Draft Lottery**, then **I’m Ready**.
3. Check that Nick and Chris show as ready. Nick can see who else is online.
4. As Nick, choose **Confirm for all managers** so you can test without the other three friends.
5. Watch the existing sequence, or use **Skip to End**. Both devices must finish with the same five-name order.
6. Choose **Return to Draft** or close the finished lottery. The lottery results should now show the saved names.
7. Refresh one device. The results must stay the same. Replay must use that same order.

## 3. Test picks, filters, and chat

1. Look at **Up Next**. Since the lottery is random, use the name/change button to select the manager whose turn is first on one device.
2. On that device, draft a player. Check that both devices show the pick, updated roster needs, and the next manager within a few seconds.
3. Check that the other manager’s Draft buttons are disabled until their turn. A drafted player should disappear from the available list.
4. Choose an NHL team. Confirm that its skaters and team-goalie unit appear with **All positions** selected. Then combine that team with **Team Goalies**. Also try Washington and a player-name search.
5. Open **Draft chat** on both devices and exchange a message. Minimize it and check the unread count.
6. Refresh either device. Picks and chat should remain saved.
7. On the phone, check that the arena results, name chooser, filters, player cards, lottery controls, and chat fit the screen and remain usable above the ticker.

## 4. Test End Season without playing 60 turns

1. Switch the computer back to **Nick**.
2. Open **Admin → Fill remaining test picks**. This control exists only in a test room.
3. Choose **End Test Season** and accept the confirmation.
4. Confirm that a test-season backup downloads and that the test draft becomes empty with TBA lottery results.
5. On **both devices**, open **Admin → Open history book**, select the new TEST season, and choose **View saved rosters & picks**.
6. Check the five complete rosters, fantasy totals, and all 60 picks. Refresh the phone and reopen the record; it should still be there.

The rehearsal deliberately uses the previous completed season’s real NHL statistics. Live **End Season** uses the selected live season’s statistics.

## 5. Remove the rehearsal

1. Still in the test room as Nick, choose **Admin → Clear all test data**.
2. Refresh the phone. The test picks, lottery, chat, and test archive should be gone.
3. Choose **Return to live pool**.
4. Open the history book. Your original three historical seasons should still be there. The test season must not appear.

When everything passes, share the normal homepage with your friends. Leave the real lottery unstarted until you are ready for draft night.

## If something fails

- **Shared storage error:** keep the existing Redis URL/token environment variables connected to this Vercel deployment, then redeploy. Do not start a real draft until both devices share the test result.
- **NHL data unavailable:** use **Refresh players** after a short wait. Picks and history remain saved. A warning can indicate a labelled saved update. End Season refuses to archive an unavailable or stale statistics response.
- **Old layout or old controls:** refresh the page after the deployment is finished. If needed, close the old tab and open the site again.
- **Any unexpected behavior:** stop the rehearsal and note the step, device, and visible message. A screenshot makes it easier to identify the problem. Avoid using the live reset button to fix a test-room issue.

## v265 live-season scoring check
1. Deploy v265 and open Home on phone and computer.
2. Confirm the status under Home says `LIVE NHL`, shows a current update time, and says checks about every 60 sec.
3. Draft/current rosters should keep using the shared picks; current-season FPTS should come from 2026-27 regular-season NHL totals.
4. Leave a Home page open during games. Official NHL totals should refresh without a manual reload within roughly a minute of the NHL feed changing.
5. Remember team-goalie FPTS only use W (2), A (5), G (10), SO (5). A goalie unit may correctly remain at 0 while its game is in progress or after a loss.
