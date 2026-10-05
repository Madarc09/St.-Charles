# Adding another homepage skin

The active v300 release has eleven options. Page 1 is the unmodified v291 presentation. All alternate choices share its board structure, controls and responsive layout.

1. Add a permanent ID, name and description to `assets/js/home-themes.js`. Set `art` to the bundled image path. The five v300 options also use `family: 'game'` for their scoped contrast and sign-label overrides.
2. Add matching artwork under `assets/images/themes/`. Current lossless WebP plates are 1448 × 1086: the upper band contains the seven navigation images; the rest is a blank themed texture. Preserve the order and centres of the navigation targets. Never bake live stats into the art.
3. Add variables under `html[data-home-skin="ID"], [data-preview-theme="ID"]` in a loaded skin stylesheet. Older skins use `home-skins-v292.css`; the new game skins use `home-games-v300.css`. Set the artwork path, measured upper-band height, colours and font families. Use the existing shared skin rules.
4. Keep the registry `art` path and CSS `--skin-art` path pointing at the same image. Without an explicit `art` property, older alternate IDs retain their `assets/images/themes/v292/` mapping. Do not change existing IDs to relocate images.
5. Check desktop and mobile, including header click targets, long names, date tabs, standings and roster comparisons. Theme changes must never contact the pool API or affect data.

Keep `data-pool-theme="chalkboard"` fixed. It supplies the legacy layout foundation; **only `data-home-skin` changes**. Do not add widths, row heights, grids, breakpoints or motion to the shared board when adding artwork.

The permanent preference key is `hockey-pool:home-theme:v1`. Choices stay in each browser. The retired chalkboard choice and unrecognised IDs fall back to Original Home. Existing ice/arena/press/arcade preferences retain their IDs. Do not rename IDs or the storage key between releases.

`docs/theme-artwork-prompts.json` records the original five image-generation prompts. `docs/theme-artwork-v300.json` records the five game-theme prompts. `npm test` covers theme persistence, assets and shared data/controls. Actual device inspection remains necessary for visual changes. Keep readable body text on solid table backgrounds; use the pixel font mainly for larger headings.

The chooser now renders each real header image with a small HTML scoreboard preview. Its corrective styles are in `home-fixes-v293.css`. A new theme inherits its preview colors from the same skin variables. Do not restore old `--pool-standings-art` preview backgrounds.
