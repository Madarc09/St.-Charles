# Custom Hockey Pool — v13 Locked Lottery Fix

This version fixes the tab/navigation freeze and updates the draft lottery flow.

## Lottery behavior
- Before running: `LOTTERY NOT COMPLETED YET`.
- First run: equal-weight random order for Nick, Chris, Andrew, Tyler, and Scott.
- The first result locks into the page and becomes the draft order.
- After locking, the main lottery button changes to `REPLAY LOCKED LOTTERY`.
- Replay shows the exact same animation and order.
- `Reset Draft` clears rosters, picks, and the locked lottery result, then returns the lottery to a fresh first run.
- A `Copy Locked Replay Link` button appears after the lottery is locked. That link includes the locked order in the URL so others can open it and replay the exact same result on their device.

## Notes
This remains a static Vercel/GitHub project. Browser local storage saves the locked result on the current device. To share the exact result with other people, use the copied locked replay link or export/import the pool backup.
