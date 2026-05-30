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
