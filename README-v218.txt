v218 diagnosis/fix

Problem: Trophy Room did not match Home page visual sizing.
Cause: v217 changed the inner trophy image shell to 1448x1086, but the Trophy Room tab still did not mirror the Home page's full-width outer body/main/panel rules. Also v217 used width:min(100vw, calc(100vh*1.333333)), which intentionally creates side margins on wide desktop screens. Home v181 uses full viewport width on desktop and 100svh height on mobile.

Fix: v218 adds a later, active-tab scoped override so #rosters uses the same outer shell behavior as Home:
- desktop: shell is 100vw wide, stage is 100vw with 1448/1086 aspect ratio
- mobile: stage height is 100svh with 1448/1086 aspect ratio
- top trophy tab bar remains hidden
- bottom nav, Home jersey hotspot, and door hotspots preserved
