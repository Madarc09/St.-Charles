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
