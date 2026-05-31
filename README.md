# Custom Hockey Pool — v14 Global Lottery + Better Jerseys

## What changed
- Upgraded the lottery stick-men so the jerseys look much more like hockey jerseys.
- Nick: Leafs-style `13 SUNDIN` jersey.
- Andrew: Flyers-style `88 LINDROS` jersey.
- Chris, Tyler, and Scott: Leafs-style throwback jerseys with different numbers/names.
- Made the classified folder result page smaller.
- Added optional global lottery storage through `/api/lottery`.

## Lottery behavior
- Before running: `LOTTERY NOT COMPLETED YET`.
- First run: equal-weight random order for Nick, Chris, Andrew, Tyler, and Scott.
- The first result locks into the page and becomes the draft order.
- After locking, the main lottery button changes to `REPLAY LOCKED LOTTERY`.
- Replay shows the exact same animation and order.
- `Reset Draft` clears rosters, picks, and the locked lottery result, then returns the lottery to a fresh first run.

## Important: making everyone see the same saved lottery
Browser local storage only saves on one device. To make the result appear for everyone who opens the normal site URL, connect persistent storage on Vercel.

This build includes `/api/lottery`, which supports Vercel Redis / Upstash-style REST environment variables:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

It also supports:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Once those are set in Vercel, the first lottery run saves globally. Other devices will load that same locked result automatically from `/api/lottery`.

Without those environment variables, the site still works, but the locked lottery only saves in that device/browser unless you use the copied replay link.


V160: Home page locked to the Locker Room TV standings theme. Home Page Editor tab removed.


## v168 final roster room image update
- Replaced Nick roster room with final roster-prominent Matthews/Raptors/AND1/Kawhi/Bautista theme.
- Replaced Andrew roster room with corrected static roster Flyers/Gears theme.
- Replaced Tyler roster room with Leafs/GoldenEye/tough-guy theme.
- Replaced Chris roster room with Raptors/Mario Kart/March Madness theme.
- Replaced Scott roster room with mystery/spy theme.
- Added cache-busting image version v=168.


## v169 roster room cleanup
- Removed/hidden the old live clipboard roster overlays from roster-room/stall pages.
- The static roster room images now act as the roster display.
- Kept roster data and standings logic intact.


## v170 roster room formatting update
- Removed/hidden right-side numbered rank markers from static roster-room images.
- Removed old top stall/owner links from roster-room view.
- Added a Trophy Room themed right-side navigation stack:
  - buttons for the four other owner rooms
  - button back to Trophy Room Lobby
- Kept static roster-room images as the main focal display.


## v171 photo-only roster rooms
- Removed the separate stall title/tab area.
- Owner room pages now show the room photo as the main/only content.
- Cropped/zoomed the photo to hide the unwanted numbered strip on the right.
- Added five in-image navigation buttons on the right side:
  - four other owner stalls
  - Trophy Room Lobby


## v172 hard photo-only stall renderer
- Removed old visible stall header/top tab area, including "Andrew's Stall".
- Removed old owner pill buttons from the top.
- Removed visible 1-5 number strip/rank strip.
- Room photo is now the page.
- Navigation buttons are placed directly over the right side of the image:
  - four other owners
  - Trophy Room Lobby


## v173 direct stall renderer replacement
- Directly replaced the real renderStall HTML block.
- Removed the visible stall header bar, Back to locker room button, owner pills, and roster <ol> that caused the 1-5 numbers.
- Added in-photo navigation buttons:
  - four other owner rooms
  - Trophy Room Lobby


## v174 direct verified fix
- Directly replaced the actual renderStall function that still contained:
  - "Back to locker room"
  - "'s Stall"
  - stall-toolbar
  - quick-stall-select
  - roster <ol> list that caused the visible 1-5 numbers
- Verified those literal strings/classes are no longer present in index.html.
- Owner stall view now renders only:
  - static room photo
  - four other owner buttons
  - Trophy Room Lobby button


## v175 mobile roster-room framing
- Verified v174 mobile CSS was zooming room images to width:180% and translateX(-24%).
- Replaced mobile zoom crop with full-width image display.
- Added a narrow right-edge cover strip to hide the baked-in numbers while preserving the trophy case/room.
- Kept the in-photo navigation buttons.


## v176 mobile Trophy Room and home leaderboard cleanup
- Verified the Trophy Room mobile layout is controlled by the v174 CSS.
- Moved mobile roster-room navigation below the image into the open space.
- Kept the full room photo visible on mobile.
- Verified the home background/image layer came from v160 locker-TV home styling.
- Removed the locker-room background image, props, TV shell, scanline overlays, and side cards.
- Home page now shows a clean leaderboard foundation.


## v177 basement chalkboard home leaderboard
- Copied selected generated image into assets/images/home-leaderboard-basement-board.png.
- Verified the live home leaderboard is still produced by the v160 renderer.
- Kept the API/live leaderboard structure intact.
- Added the image as the home leaderboard scene.
- Positioned the live leaderboard over the chalkboard area.
- Restyled the live leaderboard with chalk-like text.
- Hid the old TV/background chrome while preserving sorting and row expansion behavior.


## v178 showcase chalkboard overlay
- Verified v177 image asset and live v160 renderer first.
- Forced the generated image into a full visible pseudo-background on the home card.
- Positioned the live API standings over the chalkboard area.
- Removed the dark TV/table blocks that were hiding the image.
- Made all leaderboard text inherit the same chalk-style font family used by the scorebug/title.
- Preserved live API rendering, sorting, refresh, and expandable roster rows.


## v179 immersive home reset
- Verified the actual dashboard section, tab/nav/header structure, and selected image asset first.
- Rebuilt the Home page from scratch instead of layering over the old standings board.
- Home now displays the selected generated image as the full immersive page.
- Header image and top navigation are hidden while the Home tab is active.
- Other sections/tabs remain in the file for later navigation work.
- Disabled the old v160 home leaderboard renderer and v176/v177/v178 home CSS layers.
- Left a transparent #leaderboardTable placeholder positioned on the chalkboard for the future clean leaderboard overlay.
