# Adding another homepage skin

The active v292 release has six options. Page 1 is the unmodified v291 presentation. The five new choices share its board structure, controls and responsive layout.

1. Add a permanent ID, name and description to `assets/js/home-themes.js`.
2. Add matching artwork under `assets/images/themes/`. Current lossless WebP plates are 1448 × 1086: the upper band contains the seven navigation images; the rest is a blank themed texture. Preserve the order and centres of the navigation targets. Never bake live stats into the art.
3. Add variables under `html[data-home-skin="ID"], [data-preview-theme="ID"]` in `assets/css/home-skins-v292.css`. Set the artwork path, measured upper-band height, colours and font families. Use the existing shared skin rules.
4. Update the image path mapping in `home-themes.js` if the new asset uses another folder. Current alternate IDs load from `assets/images/themes/v292/`.
5. Check desktop and mobile, including header click targets, long names, date tabs, standings and roster comparisons. Theme changes must never contact the pool API or affect data.

Keep `data-pool-theme="chalkboard"` fixed. It supplies the legacy layout foundation; **only `data-home-skin` changes**. Do not add widths, row heights, grids, breakpoints or motion to the shared board when adding artwork.

The permanent preference key is `hockey-pool:home-theme:v1`. Choices stay in each browser. The retired chalkboard choice and unrecognised IDs fall back to Original Home. Existing ice/arena/press/arcade preferences retain their IDs. Do not rename IDs or the storage key between releases.

`docs/theme-artwork-prompts.json` records the five image-generation prompts. `npm test` covers theme persistence, assets and shared data/controls. Actual device inspection remains necessary for visual changes.
