# v310 — thePool vintage app icon

This update replaces the temporary PWA/Home Screen artwork with the selected vintage hockey `thePool` logo.

Included:
- 180x180 Apple touch icon for iPhone Home Screen installs.
- 192x192 and 512x512 standard PWA icons.
- 512x512 maskable icon with extra safe-area padding.
- 1024x1024 vintage master artwork retained in the repo for future splash/logo work.
- Cache-busted manifest/icon URLs and a v310 service-worker cache so new installs do not reuse the previous icon.
- No league data, Pick'em logic, scoring logic, desktop layout, or mobile webpage layout changed.

If thePool is already installed on an iPhone, remove the existing Home Screen app after deploying v310 and add it again from Safari to force iOS to show the new icon immediately.
