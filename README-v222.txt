v222 roster-room mobile redo

Built from v220, not v221.

Why v221 failed:
- It used object-fit: cover and full viewport locking too broadly.
- That cropped/zoomed the roster images on mobile.
- It also affected desktop scroll behavior.

v222 fix:
- Desktop rules are untouched.
- Mobile only:
  - Roster room stage is 100svh high.
  - Image is height:100svh and width:auto, so the full image height is visible.
  - Stage allows horizontal panning instead of cropping the image.
  - Bottom navigation floats fixed at the bottom.
  - Script centers the wide image after render.
