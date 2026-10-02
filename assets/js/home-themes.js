/* Presentation only. This file never reads or writes a pool, draft or identity. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.PoolThemes = api; api.mount(root); }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  // Add a theme here and its matching selectors in home-themes.css.
  // IDs and the storage key are permanent, independent of website releases.
  const themes = Object.freeze([
    { id: 'ice', name: 'Ice Level', description: 'Bright ice, navy lettering and red totals.' },
    { id: 'arena', name: 'Arena Scoreboard', description: 'Dark steel and warm amber scores.' },
    { id: 'press', name: 'The Sports Page', description: 'Vintage paper and hockey box scores.' },
    { id: 'chalkboard', name: "Coach's Chalkboard", description: 'Green chalkboard and handwritten scores.' },
    { id: 'arcade', name: 'Arcade Hockey', description: 'Retro hockey with cyan and magenta.' }
  ].map(Object.freeze));
  const storageKey = 'hockey-pool:home-theme:v1';
  const defaultTheme = 'chalkboard';
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
    doc.documentElement.dataset.poolTheme = current;
    function sync(saved) {
      const theme = themes.find(t => t.id === current);
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
      doc.documentElement.dataset.poolTheme = current;
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
