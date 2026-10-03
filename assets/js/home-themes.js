/* Presentation only. This file never reads or writes a pool, draft or identity. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.PoolThemes = api; api.mount(root); }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  // Add a theme here and its matching selectors in home-skins-v292.css.
  // IDs and the storage key are permanent, independent of website releases.
  const themes = Object.freeze([
    { id: 'original', name: 'Original Home', description: 'Page 1 · Your current room and arena boards.' },
    { id: 'ice', name: 'Frostline', description: 'Page 2 · Frozen timber, northern lights and blue ice.' },
    { id: 'arena', name: 'Heritage Hall', description: 'Page 3 · Walnut, brass and a warm championship glow.' },
    { id: 'press', name: 'The Press Box', description: 'Page 4 · Vintage newsprint, cream paper and ink.' },
    { id: 'midnight', name: 'Neon Ice', description: 'Page 5 · Luminous displays and midnight-blue glass.' },
    { id: 'arcade', name: 'Arcade Hockey', description: 'Page 6 · Detailed pixel art and retro scoreboard type.' }
  ].map(Object.freeze));
  const storageKey = 'hockey-pool:home-theme:v1';
  const defaultTheme = 'original';
  const normalize = id => themes.some(t => t.id === id) ? id : defaultTheme;
  function read(storage) {
    try { return normalize(storage && storage.getItem(storageKey)); }
    catch (_) { return defaultTheme; }
  }
  function write(storage, id) {
    const theme = normalize(id);
    try {
      if (!storage) return { theme, saved: false };
      storage.setItem(storageKey, theme);
      return { theme, saved: true };
    } catch (_) { return { theme, saved: false }; }
  }
  function mount(win) {
    const doc = win.document;
    let storage;
    try { storage = win.localStorage; } catch (_) { storage = null; }
    let current = read(storage);
    // Runs synchronously in <head>, before the first paint.
    // v274–291 shared geometry was tuned against this legacy base. Keep it fixed;
    // the independent skin attribute changes artwork, colors and font families only.
    doc.documentElement.dataset.poolTheme = 'chalkboard';
    doc.documentElement.dataset.homeSkin = current;
    function sync(saved) {
      const theme = themes.find(t => t.id === current);
      const header = doc.querySelector?.('.pool-header-image');
      if (header) {
        const src = current === 'original' ? 'assets/images/home-leaderboard-basement-board.png?v=269'
          : 'assets/images/themes/v292/' + current + '.webp';
        if (header.getAttribute('src') !== src) header.setAttribute('src', src);
      }
      doc.querySelectorAll('[data-current-theme]').forEach(el => { el.textContent = theme.name; });
      doc.querySelectorAll('input[name="pool-home-theme"]').forEach(input => {
        input.checked = input.value === current;
        input.closest('label').dataset.selected = String(input.checked);
      });
      const status = doc.getElementById('themeSaveStatus');
      if (status) status.textContent = saved === false
        ? 'Selected for this visit. Your browser is not allowing this preference to be saved.'
        : 'Remembered in this browser. Everyone else keeps their own choice.';
    }
    function select(id, persist) {
      current = normalize(id);
      const result = persist ? write(storage, current) : { saved: undefined };
      doc.documentElement.dataset.homeSkin = current;
      sync(result.saved);
    }
    function ready() {
      const options = doc.getElementById('poolThemeOptions');
      if (options) options.innerHTML = themes.map(t =>
        '<label class="pool-theme-choice" data-preview-theme="' + t.id + '">' +
          '<input type="radio" name="pool-home-theme" value="' + t.id + '">' +
          '<span class="pool-theme-swatch" aria-hidden="true"><b>STANDINGS</b><i></i><i></i><i></i><em>FPTS</em></span>' +
          '<span class="pool-theme-name">' + t.name + '</span>' +
          '<span class="pool-theme-description">' + t.description + '</span>' +
          '<span class="pool-theme-selected" aria-hidden="true">✓ Selected</span>' +
        '</label>'
      ).join('');
      sync();
      doc.addEventListener('change', event => {
        if (event.target.matches('input[name="pool-home-theme"]')) select(event.target.value, true);
      });
      doc.addEventListener('click', event => {
        const open = event.target.closest('[data-pool-theme-picker]');
        const close = event.target.closest('[data-close-theme-picker]');
        const dialog = doc.getElementById('poolThemeDialog');
        if (open && dialog && !dialog.open) { event.preventDefault(); dialog.showModal(); }
        if (close && dialog) dialog.close();
      });
      win.addEventListener('storage', event => {
        if (event.key === storageKey || event.key === null) select(read(storage), false);
      });
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ready, { once: true });
    else ready();
    return { select: id => select(id, true), current: () => current };
  }
  return Object.freeze({ themes, storageKey, defaultTheme, normalize, read, write, mount });
});
