/* v275: live neon arena home board with desktop head-to-head roster comparison. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./pool-core'));
  else {
    const view = factory(root.PoolCore);
    let latest = null, signature = '';
    const compare = { left: 'nick', right: 'andrew' };
    const doc = root.document;

    function availableIds(rows) {
      const preferred = ['nick', 'andrew', 'scott', 'chris', 'tyler'];
      return preferred.filter(id => rows.some(row => row.ownerId === id));
    }
    function normalizeCompare(rows) {
      const ids = availableIds(rows);
      if (!ids.length) return;
      if (!ids.includes(compare.left)) compare.left = ids[0];
      if (!ids.includes(compare.right) || (compare.right === compare.left && ids.length > 1)) {
        compare.right = ids.find(id => id !== compare.left) || ids[0];
      }
    }
    function update(host, html) {
      if (!host) return;
      const scroll = new Map(Array.from(host.querySelectorAll('[data-scroll-key]'), el => [el.dataset.scrollKey, el.scrollLeft]));
      const focus = host.contains(doc.activeElement) ? doc.activeElement.dataset.boardFocus : null;
      host.innerHTML = html;
      host.querySelectorAll('[data-scroll-key]').forEach(el => { el.scrollLeft = scroll.get(el.dataset.scrollKey) || 0; });
      if (focus) Array.from(host.querySelectorAll('[data-board-focus]')).find(el => el.dataset.boardFocus === focus)?.focus({ preventScroll: true });
    }
    function renderLatest() {
      if (!latest) return;
      normalizeCompare(latest.rows);
      const html = view.render(latest.rows, latest.draft, compare);
      update(doc.getElementById('seasonBoard'), html);
      if (doc.getElementById('enlargedChalkboard')?.open)
        update(doc.getElementById('enlargedChalkboardContent'), html);
    }
    root.renderSeasonBoard = function (rows, draft) {
      latest = { rows, draft };
      normalizeCompare(rows);
      const next = JSON.stringify([rows, draft.seasonId, !!draft.locked, draft.picks?.length]);
      if (signature === next) return;
      signature = next;
      renderLatest();
    };

    doc.addEventListener('click', event => {
      const compareShift = event.target.closest('[data-compare-shift]');
      if (compareShift && latest) {
        event.preventDefault();
        const side = compareShift.dataset.compareSide === 'right' ? 'right' : 'left';
        const other = side === 'left' ? 'right' : 'left';
        const ids = availableIds(latest.rows);
        if (!ids.length) return;
        const delta = Number(compareShift.dataset.compareShift || 1) < 0 ? -1 : 1;
        let index = Math.max(0, ids.indexOf(compare[side]));
        let candidate = compare[side];
        for (let attempts = 0; attempts < ids.length; attempts++) {
          index = (index + delta + ids.length) % ids.length;
          candidate = ids[index];
          if (ids.length === 1 || candidate !== compare[other]) break;
        }
        compare[side] = candidate;
        renderLatest();
        return;
      }

      const jump = event.target.closest('[data-roster-jump]');
      if (jump) {
        event.preventDefault();
        const board = jump.closest('.pool-board') || doc;
        const mobileZone = jump.closest('.pool-rosters') || board;
        const target = Array.from(mobileZone.querySelectorAll('.pool-roster[data-owner]')).find(el => el.dataset.owner === jump.dataset.rosterJump);
        target?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        target?.classList.add('pool-roster-pulse');
        root.setTimeout(() => target?.classList.remove('pool-roster-pulse'), 750);
        return;
      }
      const shift = event.target.closest('[data-roster-shift]');
      if (shift) {
        event.preventDefault();
        const zone = shift.closest('.pool-rosters') || shift.closest('.pool-board') || doc;
        const track = zone.querySelector('.pool-roster-track');
        if (track) track.scrollBy({ left: Number(shift.dataset.rosterShift || 1) * Math.max(280, track.clientWidth * .82), behavior: 'smooth' });
        return;
      }
      const dialog = doc.getElementById('enlargedChalkboard');
      if (!dialog) return;
      if (event.target.closest('[data-enlarge-chalkboard]')) {
        event.preventDefault();
        if (latest) {
          normalizeCompare(latest.rows);
          update(doc.getElementById('enlargedChalkboardContent'), view.render(latest.rows, latest.draft, compare));
        }
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
    ['shortHandedGoals', 'SHG', 'Shorthanded Goals'], ['gameWinningGoals', 'GWG', 'Game-Winning Goals']
  ];
  const goalieColumns = [
    ['goalieWins', 'W', 'Wins'], ['goalieAssists', 'A', 'Assists'],
    ['goalieGoals', 'G', 'Goals'], ['goalieShutouts', 'SO', 'Shutouts']
  ];
  function stat(p, key) {
    if (key === 'goalieAssists') return C.num(p.goalieAssists ?? p.assists);
    if (key === 'goalieGoals') return C.num(p.goalieGoals ?? p.goals);
    if (key === 'shortHandedGoals') return C.num(p.shortHandedGoals ?? p.shGoals);
    return C.num(p[key]);
  }
  function contribution(value, key) { return C.num(value) * C.num(C.SCORING[key]); }
  function weighted(value, key) {
    return '<span class="pool-stat-count">' + fmt(value) + '</span><span class="pool-stat-contribution">(' + fmt(contribution(value, key)) + ')</span>';
  }
  function heading(key, short, full) {
    const weight = C.SCORING[key];
    return '<th scope="col"><span class="pool-head-long">' + esc(full) + '</span><span class="pool-head-short">' + esc(short) + '</span>' +
      '<small>(' + fmt(weight) + ' ' + (weight === 1 ? 'FPT' : 'FPTS') + ')</small></th>';
  }
  function headers(columns, first) {
    return '<th class="pool-name-cell" scope="col">' + first + '</th>' + columns.map(([key, short, full]) => heading(key, short, full)).join('');
  }
  function summary(row) {
    const skaters = row.players.filter(p => C.bucket(p) !== 'G');
    const goalies = row.players.filter(p => C.bucket(p) === 'G');
    const totals = Object.fromEntries(skaterColumns.map(([key]) => [key, skaters.reduce((sum, p) => sum + stat(p, key), 0)]));
    return { ...totals, goalieFpts: goalies.reduce((sum, p) => sum + C.points(p), 0) };
  }
  function rosterGroup(players, bucket, label, ownerId, instance) {
    const roster = C.sortRoster(players).filter(p => C.bucket(p) === bucket);
    const columns = bucket === 'G' ? goalieColumns : skaterColumns;
    const first = bucket === 'G' ? 'Team Goalies' : 'Player Name';
    const table = '<table class="pool-stat-table pool-roster-table"><caption class="pool-visually-hidden">' + esc(label) + ' stats. The number in parentheses is the fantasy-point contribution from that category.</caption>' +
      '<thead><tr>' + headers(columns, first) + '<th class="pool-fpts-cell" scope="col">FPTS <small>TOTAL</small></th></tr></thead><tbody>' +
      (roster.map(p =>
        '<tr class="pool-player" data-player-id="' + esc(p.id) + '">' +
        '<th class="pool-name-cell" scope="row" title="' + esc(p.name) + '">' +
        esc(bucket === 'G' ? String(p.name).replace(/\s+Goalies$/i, '') : p.name) +
        '</th>' + columns.map(([key]) => '<td>' + weighted(stat(p, key), key) + '</td>').join('') +
        '<td class="pool-fpts-cell">' + fmt(C.points(p)) + '</td></tr>'
      ).join('') || '<tr><td colspan="6" class="pool-empty">No selections yet.</td></tr>') + '</tbody></table>';
    return '<section class="pool-position" data-position="' + bucket + '"><h4><span>' + esc(label) + '</span><em>' + roster.length + '</em></h4>' +
      '<div class="pool-stat-scroll" data-scroll-key="' + esc((instance || 'roster') + '-' + (ownerId || '') + '-' + bucket) + '" role="region" aria-label="' + esc(label) + ' statistics" tabindex="0">' + table + '</div></section>';
  }
  function rosterCard(row, instance, compareRole) {
    if (!row) return '';
    const champion = row.ownerId === 'andrew' ? ' data-champion="true"' : '';
    const compareAttr = compareRole ? ' data-compare-role="' + esc(compareRole) + '"' : '';
    return '<article class="pool-roster"' + compareAttr + champion + ' data-owner="' + esc(row.ownerId) + '" aria-label="' + esc(row.ownerName) + '’s roster">' +
      '<header class="pool-roster-heading"><div><span class="pool-roster-kicker">MANAGER ROSTER</span><h3><button type="button" data-roster-owner="' + esc(row.ownerId) +
      '" data-board-focus="roster-' + esc(row.ownerId) + '" title="Open ' + esc(row.ownerName) + '’s roster room">' + esc(row.ownerName) +
      ' <span class="pool-room-arrow" aria-hidden="true">↗</span></button></h3></div><span class="pool-roster-total"><b>' + fmt(row.total) + '</b><small>FPTS</small></span></header>' +
      rosterGroup(row.players, 'F', 'Forwards', row.ownerId, instance) +
      rosterGroup(row.players, 'D', 'Defence', row.ownerId, instance) +
      rosterGroup(row.players, 'G', 'Team Goalies', row.ownerId, instance) + '</article>';
  }
  function comparePicker(side, row) {
    if (!row) return '';
    return '<div class="pool-compare-picker" data-compare-picker="' + side + '">' +
      '<button type="button" data-compare-shift="-1" data-compare-side="' + side + '" aria-label="Previous manager on ' + side + '">‹</button>' +
      '<div><span>' + (side === 'left' ? 'TEAM ONE' : 'TEAM TWO') + '</span><strong>' + esc(row.ownerName) + '</strong></div>' +
      '<button type="button" data-compare-shift="1" data-compare-side="' + side + '" aria-label="Next manager on ' + side + '">›</button>' +
    '</div>';
  }
  function render(rows, draft, compareState) {
    const rosterOrder = ['nick', 'andrew', 'scott', 'chris', 'tyler'];
    const ordered = rosterOrder.map(id => rows.find(row => row.ownerId === id)).filter(Boolean);
    const requested = compareState || { left: 'nick', right: 'andrew' };
    const left = ordered.find(row => row.ownerId === requested.left) || ordered[0];
    const right = ordered.find(row => row.ownerId === requested.right && row.ownerId !== left?.ownerId) || ordered.find(row => row.ownerId !== left?.ownerId) || left;
    const table = '<table class="pool-stat-table pool-standings-table"><caption class="pool-visually-hidden">Manager standings. Parentheses show the fantasy points earned from each scoring category.</caption><thead><tr>' +
      '<th class="pool-rank-cell" scope="col">#</th>' + headers(skaterColumns, 'Manager') + '<th scope="col">Goalie<small>FPTS</small></th><th class="pool-fpts-cell" scope="col">Total<small>FPTS</small></th></tr></thead><tbody>' +
      rows.map(row => {
        const totals = summary(row);
        return '<tr><td class="pool-rank-cell"><span class="pool-rank-badge">' + fmt(row.rank) + '</span></td><th class="pool-name-cell" scope="row"><button type="button" data-roster-owner="' + esc(row.ownerId) +
          '" data-board-focus="standing-' + esc(row.ownerId) + '">' + esc(row.ownerName) + '</button></th>' + skaterColumns.map(([key]) => '<td>' + weighted(totals[key], key) + '</td>').join('') +
          '<td><strong class="pool-goalie-total">' + fmt(totals.goalieFpts) + '</strong></td><td class="pool-fpts-cell">' + fmt(row.total) + '</td></tr>';
      }).join('') + '</tbody></table>';
    const managerNav = ordered.map(row => '<button type="button" data-roster-jump="' + esc(row.ownerId) + '">' + esc(row.ownerName) + '</button>').join('');

    return '<div class="pool-v273-dashboard pool-v275-dashboard">' +
      '<section class="pool-standings pool-neon-module" aria-label="League standings">' +
        '<header class="pool-module-title"><div class="pool-title-streak"></div><div><span class="pool-module-kicker">BASEMENT BAR LEAGUE · ' + esc(C.seasonLabel(draft.seasonId)) + '</span><h2>Standings</h2></div><span class="pool-live-chip">LIVE</span></header>' +
        '<div class="pool-stat-scroll" data-scroll-key="standings" role="region" aria-label="Standings statistics" tabindex="0">' + table + '</div>' +
        '<div class="pool-module-foot"><span>Numbers in parentheses = fantasy points earned from that stat.</span><span>' + (draft.picks?.length || 0) + '/60 draft picks saved</span></div>' +
      '</section>' +
      '<section class="pool-rosters" aria-label="Manager rosters">' +
        '<div class="pool-rosters-desktop-controls">' +
          '<header class="pool-rosters-mast pool-compare-mast"><div><span>HEAD-TO-HEAD TEAM VIEW</span><h2>Roster Comparison</h2></div></header>' +
          '<div class="pool-compare-toolbar">' + comparePicker('left', left) + '<span class="pool-versus" aria-hidden="true">VS</span>' + comparePicker('right', right) + '</div>' +
        '</div>' +
        '<div class="pool-rosters-mobile-controls">' +
          '<header class="pool-rosters-mast"><button type="button" class="pool-roster-arrow" data-roster-shift="-1" aria-label="Previous roster">‹</button><div><span>LIVE TEAM CARDS</span><h2>Rosters</h2></div><button type="button" class="pool-roster-arrow" data-roster-shift="1" aria-label="Next roster">›</button></header>' +
          '<nav class="pool-roster-jumpbar" aria-label="Jump to manager roster">' + managerNav + '</nav>' +
        '</div>' +
        '<div class="pool-roster-track pool-v275-roster-track" data-scroll-key="roster-track">' + ordered.map(row => rosterCard(row, 'roster', row.ownerId === left?.ownerId ? 'left' : (row.ownerId === right?.ownerId ? 'right' : ''))).join('') + '</div>' +
      '</section>' +
      '<div class="pool-v273-record">' + (draft.locked ? '<button type="button" data-view-final-draft data-board-focus="final-draft">✓ Final draft locked · View complete draft record ↗</button>' : '<span>Draft in progress · live rosters update automatically</span>') + '</div>' +
    '</div>';
  }
  return { render, rosterCard, rosterGroup, summary, stat };
});
