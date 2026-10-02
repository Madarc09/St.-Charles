/* One live board for every theme. Uses the existing scoring and shared pool. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./pool-core'));
  else {
    const view = factory(root.PoolCore);
    let latest = null, signature = '';
    const doc = root.document;
    function update(host, html) {
      if (!host) return;
      const scroll = new Map(Array.from(host.querySelectorAll('[data-scroll-key]'), el => [el.dataset.scrollKey, el.scrollLeft]));
      const focus = host.contains(doc.activeElement) ? doc.activeElement.dataset.boardFocus : null;
      host.innerHTML = html;
      host.querySelectorAll('[data-scroll-key]').forEach(el => { el.scrollLeft = scroll.get(el.dataset.scrollKey) || 0; });
      if (focus) Array.from(host.querySelectorAll('[data-board-focus]')).find(el => el.dataset.boardFocus === focus)?.focus({ preventScroll: true });
    }
    root.renderSeasonBoard = function (rows, draft) {
      latest = { rows, draft };
      const next = JSON.stringify([rows, draft.seasonId, !!draft.locked, draft.picks?.length]);
      if (signature === next) return;
      signature = next;
      update(doc.getElementById('seasonBoard'), view.render(rows, draft));
      if (doc.getElementById('enlargedChalkboard')?.open)
        update(doc.getElementById('enlargedChalkboardContent'), view.render(rows, draft));
    };
    doc.addEventListener('click', event => {
      const dialog = doc.getElementById('enlargedChalkboard');
      if (!dialog) return;
      if (event.target.closest('[data-enlarge-chalkboard]')) {
        event.preventDefault();
        if (latest) update(doc.getElementById('enlargedChalkboardContent'), view.render(latest.rows, latest.draft));
        if (!dialog.open) dialog.showModal();
      }
      if (event.target.closest('[data-close-chalkboard]') ||
          (dialog.open && event.target.closest('[data-roster-owner], [data-view-final-draft]'))) dialog.close();
    }, true);
  }
})(typeof window !== 'undefined' ? window : this, function (C) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fmt = value => C.num(value).toLocaleString('en-CA', { maximumFractionDigits: 2 });
  const skaterColumns = [
    ['goals', 'G', 'Goals'], ['assists', 'A', 'Assists'],
    ['shortHandedGoals', 'SHG', 'Shorthanded goals'], ['gameWinningGoals', 'GWG', 'Game-winning goals']
  ];
  const goalieColumns = [
    ['goalieWins', 'W', 'Wins'], ['goalieAssists', 'A', 'Goalie assists'],
    ['goalieGoals', 'G', 'Goalie goals'], ['goalieShutouts', 'SO', 'Shutouts']
  ];
  function stat(p, key) {
    if (key === 'goalieAssists') return C.num(p.goalieAssists ?? p.assists);
    if (key === 'goalieGoals') return C.num(p.goalieGoals ?? p.goals);
    if (key === 'shortHandedGoals') return C.num(p.shortHandedGoals ?? p.shGoals);
    return C.num(p[key]);
  }
  function headers(columns, first) {
    return '<th class="pool-name-cell" scope="col">' + first + '</th>' + columns.map(([key, label, full]) =>
      '<th scope="col"><abbr title="' + full + '">' + label + '</abbr><small>(' + C.SCORING[key] + ' ' + (C.SCORING[key] === 1 ? 'FPT' : 'FPTS') + ')</small></th>'
    ).join('');
  }
  function summary(row) {
    const skaters = row.players.filter(p => C.bucket(p) !== 'G');
    const goalies = row.players.filter(p => C.bucket(p) === 'G');
    const totals = Object.fromEntries(skaterColumns.map(([key]) => [key, skaters.reduce((sum, p) => sum + stat(p, key), 0)]));
    return { ...totals, goalieFpts: goalies.reduce((sum, p) => sum + C.points(p), 0) };
  }
  function rosterGroup(players, bucket, label, ownerId) {
    const roster = C.sortRoster(players).filter(p => C.bucket(p) === bucket);
    const columns = bucket === 'G' ? goalieColumns : skaterColumns;
    const table = '<table class="pool-stat-table pool-roster-table"><caption class="pool-visually-hidden">' + esc(label) + ' stats. Weights in headings are fantasy points per stat.</caption>' +
      '<thead><tr>' + headers(columns, bucket === 'G' ? 'Team' : 'Player Name') + '<th class="pool-fpts-cell" scope="col">FPTS</th></tr></thead><tbody>' +
      (roster.map(p =>
        '<tr class="pool-player" data-player-id="' + esc(p.id) + '">' +
        '<th class="pool-name-cell" scope="row" title="' + esc(p.name) + '">' +
        esc(bucket === 'G' ? String(p.name).replace(/\s+Goalies$/i, '') : p.name) +
        '</th>' + columns.map(([key]) => '<td>' + fmt(stat(p, key)) + '</td>').join('') +
        '<td class="pool-fpts-cell">' + fmt(C.points(p)) + '</td></tr>'
      ).join('') || '<tr><td colspan="6" class="pool-empty">No selections yet.</td></tr>') + '</tbody></table>';
    return '<section class="pool-position" data-position="' + bucket + '"><h4>' + label + '</h4>' +
      '<div class="pool-stat-scroll" data-scroll-key="' + esc(ownerId || '') + '-' + bucket + '" role="region" aria-label="' + esc(label) + ' statistics, scroll for all columns" tabindex="0">' + table + '</div></section>';
  }
  function rosterCard(row) {
    return '<article class="pool-roster" data-owner="' + esc(row.ownerId) + '" aria-label="' + esc(row.ownerName) + '’s roster">' +
      '<header class="pool-roster-heading"><h3><button type="button" data-roster-owner="' + esc(row.ownerId) +
      '" data-board-focus="roster-' + esc(row.ownerId) + '" title="Open ' + esc(row.ownerName) + '’s roster room">' + esc(row.ownerName) +
      ' <span class="pool-room-arrow" aria-hidden="true">↗</span></button></h3><span class="pool-roster-total"><b>' + fmt(row.total) + '</b> FPTS</span></header>' +
      rosterGroup(row.players, 'F', 'Forwards', row.ownerId) +
      rosterGroup(row.players, 'D', 'Defence', row.ownerId) +
      rosterGroup(row.players, 'G', 'Team Goalies', row.ownerId) + '</article>';
  }
  function render(rows, draft) {
    const rosterOrder = ['nick', 'andrew', 'scott', 'chris', 'tyler'];
    const ordered = rosterOrder.map(id => rows.find(row => row.ownerId === id)).filter(Boolean);
    const table = '<table class="pool-stat-table pool-standings-table"><caption class="pool-visually-hidden">Manager standings. G, A, SHG and GWG are skater totals. Goalie FPTS is added to get the final FPTS.</caption><thead><tr>' +
      headers(skaterColumns, 'Manager') + '<th scope="col">Goalie<small>FPTS</small></th><th class="pool-fpts-cell" scope="col">FPTS</th></tr></thead><tbody>' +
      rows.map(row => {
        const totals = summary(row);
        return '<tr><th class="pool-name-cell" scope="row"><button type="button" data-roster-owner="' + esc(row.ownerId) +
          '" data-board-focus="standing-' + esc(row.ownerId) + '"><span class="pool-rank">' + fmt(row.rank) + '</span>' + esc(row.ownerName) +
          '</button></th>' + skaterColumns.map(([key]) => '<td>' + fmt(totals[key]) + '</td>').join('') +
          '<td>' + fmt(totals.goalieFpts) + '</td><td class="pool-fpts-cell">' + fmt(row.total) + '</td></tr>';
      }).join('') + '</tbody></table>';
    return '<div class="pool-board-layout"><section class="pool-standings" aria-label="League standings">' +
      '<div class="pool-board-heading"><h2>Standings</h2><span class="pool-season">' + esc(C.seasonLabel(draft.seasonId)) + '</span></div>' +
      '<p class="pool-swipe-hint">Swipe tables sideways to see every stat.</p>' +
      '<div class="pool-stat-scroll" data-scroll-key="standings" role="region" aria-label="Standings, scroll for all stat columns" tabindex="0">' + table + '</div>' +
      '<p class="pool-board-note">G, A, SHG and GWG count skater stats. Goalie FPTS completes the total.</p>' +
      '<p class="pool-draft-record">' + (draft.locked ?
        '<button type="button" data-view-final-draft data-board-focus="final-draft">✓ Final draft locked · ' + (draft.picks?.length || 60) + '/60 saved · View record ↗</button>' :
        (draft.picks?.length || 0) + '/60 picks saved') + '</p></section>' +
      '<section class="pool-rosters" aria-label="All five manager rosters"><div class="pool-board-heading"><h2>Rosters</h2><span class="pool-roster-count">6 forwards · 4 defence · 2 team goalies</span></div>' +
      '<div class="pool-roster-grid">' + ordered.map(rosterCard).join('') + '</div></section></div>';
  }
  return { render, rosterCard, rosterGroup, summary, stat };
});
