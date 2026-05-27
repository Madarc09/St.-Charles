import { currentSeasonId, fetchNhlStats } from './nhl-api.js';
import { fantasyPoints, ownerTotal } from './scoring.js';

const STORAGE_KEY = 'custom-hockey-pool-v4-roster-test';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let defaults = {};
let state = null;
let draftSort = { key: 'fantasyPoints', direction: 'desc' };
let pendingAssignPlayerId = null;

async function loadJson(path, fallback) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(path);
    return await res.json();
  } catch {
    return fallback;
  }
}

async function init() {
  const [settings, owners, rosters, draftBoard, playerMap] = await Promise.all([
    loadJson('assets/data/pool-settings.json', {}),
    loadJson('assets/data/owners.json', []),
    loadJson('assets/data/rosters.json', {}),
    loadJson('assets/data/draft-board.json', { currentPick: 1, draftOrder: [], picks: [] }),
    loadJson('assets/data/player-map.json', {})
  ]);

  defaults = {
    settings: { ...settings, seasonId: settings.seasonId || currentSeasonId() },
    owners,
    rosters,
    draftBoard,
    playerMap,
    manualPlayers: [],
    statOverrides: {},
    stats: { fetchedAt: null, players: [] }
  };
  const saved = localStorage.getItem(STORAGE_KEY);
  state = saved ? deepMerge(structuredClone(defaults), JSON.parse(saved)) : structuredClone(defaults);
  normalizeStateForDraftTesting();
  if (!state.settings.seasonId) state.settings.seasonId = currentSeasonId();
  bindEvents();
  renderAll();
  if (!state.stats?.players?.length) {
    setTimeout(() => refreshStats(), 350);
  }
}

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) target[key] = deepMerge(target[key] || {}, value);
    else target[key] = value;
  }
  return target;
}

function save() {
  state.settings.lastUpdated = state.settings.lastUpdated || null;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderRawJson();
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function bindEvents() {
  $$('.tab').forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.tab)));
  $$('[data-tab-jump]').forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.tabJump)));
  ['#refreshStatsBtn', '#refreshStatsBtn2', '#refreshStatsBtn3', '#refreshStatsBtnDraft'].forEach(sel => $(sel)?.addEventListener('click', refreshStats));
  $('#draftPositionFilter')?.addEventListener('change', renderDraftBoard);
  $('#draftSortSelect')?.addEventListener('change', () => { draftSort = { key: $('#draftSortSelect').value, direction: draftSort.direction || 'desc' }; renderDraftBoard(); });
  $('#closeAssignModal')?.addEventListener('click', closeAssignModal);
  $('#assignModal')?.addEventListener('click', (e) => { if (e.target.id === 'assignModal') closeAssignModal(); });
  $('#statsSearch').addEventListener('input', renderPlayersTable);
  $('#saveRulesBtn').addEventListener('click', saveRulesFromForm);
  $('#resetRulesBtn').addEventListener('click', () => { state.settings = structuredClone(defaults.settings); save(); renderAll(); toast('Rules reset to defaults.'); });
  $('#addManualPlayerBtn').addEventListener('click', addManualPlayer);
  $('#undoPickBtn').addEventListener('click', undoPick);
  $('#resetDraftBtn').addEventListener('click', resetDraft);
  $('#addOwnerBtn').addEventListener('click', addOwner);
  $('#addOwnerBtnDraft')?.addEventListener('click', addOwner);
  $('#loadSampleOwnersBtn')?.addEventListener('click', loadSampleOwners);
  $('#removeOwnerBtnDraft')?.addEventListener('click', removeOwnerFromDraftRoom);
  $('#loadDemoPlayersBtn')?.addEventListener('click', loadDemoPlayers);
  $('#confirmAssignBtn')?.addEventListener('click', () => assignPlayerToOwner($('#assignOwnerSelect')?.value));
  $('#exportBtn').addEventListener('click', exportPool);
  $('#importFile').addEventListener('change', importPool);
  $('#clearStatsBtn').addEventListener('click', () => { state.stats = { fetchedAt: null, players: [] }; save(); renderAll(); toast('Stats cache cleared.'); });
  $('#factoryResetBtn').addEventListener('click', factoryReset);
}

function showTab(tab) {
  $$('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  $$('.panel').forEach(panel => panel.classList.toggle('active', panel.id === tab));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function refreshStats() {
  try {
    setRefreshDisabled(true);
    toast('Pulling NHL stats…');
    const data = await fetchNhlStats(state.settings.seasonId, state.settings.gameTypeId || 2);
    state.stats = data;
    state.settings.lastUpdated = data.fetchedAt;
    save();
    renderAll();
    showTab('draft');
    toast(`Loaded ${data.players.length} NHL players. Draft board is ready.`);
  } catch (error) {
    console.error(error);
    toast('NHL API pull failed. Try again after deploy or use manual players.');
  } finally {
    setRefreshDisabled(false);
  }
}

function setRefreshDisabled(disabled) {
  ['#refreshStatsBtn', '#refreshStatsBtn2', '#refreshStatsBtn3', '#refreshStatsBtnDraft'].forEach(sel => { const b = $(sel); if (b) b.disabled = disabled; });
}

function renderAll() {
  $('#poolTitle').textContent = state.settings.poolName || 'Custom Hockey Pool';
  $('#seasonDisplay').textContent = formatSeason(state.settings.seasonId);
  $('#lastUpdatedDisplay').textContent = state.stats.fetchedAt ? new Date(state.stats.fetchedAt).toLocaleString() : 'Never';
  renderDashboardCards();
  renderDraft();
  renderRosters();
  renderLeaderboard();
  renderPlayersTable();
  renderRulesForms();
  renderRawJson();
}

function formatSeason(seasonId) {
  if (!seasonId || String(seasonId).length !== 8) return seasonId || '—';
  return `${String(seasonId).slice(0, 4)}-${String(seasonId).slice(4)}`;
}

function renderDashboardCards() {
  const cards = [
    ['Owners', state.owners.length],
    ['Drafted Players', state.draftBoard.picks.length],
    ['NHL Players Cached', state.stats.players.length]
  ];
  $('#dashboardCards').innerHTML = cards.map(([label, val]) => `<article class="card"><span class="label">${label}</span><h2>${val}</h2></article>`).join('');
}

function currentOwnerId() {
  const order = state.draftBoard.draftOrder.length ? state.draftBoard.draftOrder : state.owners.map(o => o.id);
  const rounds = Number(state.settings.draftRules?.rounds || state.settings.rosterRules?.totalRosterSize || 1);
  const pickIndex = Math.max(0, state.draftBoard.picks.length);
  const round = Math.floor(pickIndex / order.length);
  if (round >= rounds) return null;
  const indexInRound = pickIndex % order.length;
  const snake = (state.settings.draftRules?.type || '').toLowerCase() === 'snake';
  const roundOrder = snake && round % 2 === 1 ? [...order].reverse() : order;
  return roundOrder[indexInRound];
}

function renderDraft() {
  $('#draftedCount').textContent = state.draftBoard.picks.length;
  renderDraftBoard();
  renderDraftOwnerList();
  renderDraftOrderEditor();
  renderPickHistory();
}

function playerPool() {
  const drafted = new Set(state.draftBoard.picks.map(p => String(p.player.id)));
  const combined = [...state.stats.players, ...state.manualPlayers];
  const map = new Map();
  combined.forEach(p => map.set(String(p.id), { ...p, drafted: drafted.has(String(p.id)) }));
  return [...map.values()];
}

function positionMatches(p, pos) {
  if (pos === 'all') return true;
  if (pos === 'F') return ['C','L','R','F','LW','RW'].includes(p.position);
  return p.position === pos;
}

function draftValue(p, key) {
  if (key === 'fantasyPoints') return fantasyPoints(p, state.settings.scoring);
  if (key === 'name') return String(p.name || '').toLowerCase();
  return Number(p[key] ?? 0);
}

function availableDraftBoardPlayers() {
  const pos = $('#draftPositionFilter')?.value || 'all';
  const key = draftSort.key || $('#draftSortSelect')?.value || 'fantasyPoints';
  const dir = draftSort.direction === 'asc' ? 1 : -1;
  return playerPool()
    .filter(p => !p.drafted)
    .filter(p => positionMatches(p, pos))
    .sort((a, b) => {
      const av = draftValue(a, key);
      const bv = draftValue(b, key);
      if (typeof av === 'string' || typeof bv === 'string') return String(av).localeCompare(String(bv)) * dir;
      return (av - bv) * dir || String(a.name).localeCompare(String(b.name));
    })
    .slice(0, 75);
}

function renderDraftBoard() {
  const list = availableDraftBoardPlayers();
  const sortArrow = (key) => draftSort.key === key ? (draftSort.direction === 'asc' ? ' ▲' : ' ▼') : '';
  const header = (label, key) => `<button class="sort-head" data-draft-sort="${key}">${label}${sortArrow(key)}</button>`;
  const draftButton = (p) => `<button type="button" class="draft-player-btn" data-open-assign="${escapeHtml(String(p.id))}">Draft</button>`;
  const rows = list.map((p, index) => `
    <tr>
      <td class="rank-cell">${index + 1}</td>
      <td class="player-draft-cell">
        <div class="player-draft-line">
          <div>
            <strong>${escapeHtml(p.name)}</strong>
            <div class="meta">${p.position || '—'} • ${p.nhlTeam || '—'} ${p.manual ? '• Manual' : ''}</div>
          </div>
          ${draftButton(p)}
        </div>
      </td>
      <td class="draft-action-cell">${draftButton(p)}</td>
      <td>${p.gamesPlayed || 0}</td>
      <td>${p.goals ?? 0}</td>
      <td>${p.assists ?? 0}</td>
      <td>${p.points ?? 0}</td>
      <td>${p.goalieWins ?? ''}</td>
      <td><strong>${fantasyPoints(p, state.settings.scoring)}</strong></td>
    </tr>`).join('');
  $('#draftBoardTable').innerHTML = `<table class="draft-table"><thead><tr><th>#</th><th>${header('Player','name')} / Draft</th><th>Draft</th><th>${header('GP','gamesPlayed')}</th><th>${header('G','goals')}</th><th>${header('A','assists')}</th><th>${header('PTS','points')}</th><th>${header('W','goalieWins')}</th><th>${header('Fantasy','fantasyPoints')}</th></tr></thead><tbody>${rows || '<tr><td colspan="9">No available players yet. Pull NHL stats or add a manual player.</td></tr>'}</tbody></table>`;
  $$('[data-draft-sort]').forEach(btn => btn.addEventListener('click', () => changeDraftSort(btn.dataset.draftSort)));
  $$('[data-open-assign]').forEach(btn => btn.addEventListener('click', () => openAssignModal(btn.dataset.openAssign)));
}

function changeDraftSort(key) {
  if (draftSort.key === key) draftSort.direction = draftSort.direction === 'asc' ? 'desc' : 'asc';
  else draftSort = { key, direction: key === 'name' ? 'asc' : 'desc' };
  const select = $('#draftSortSelect');
  if (select) select.value = key;
  renderDraftBoard();
}

function openAssignModal(playerId) {
  const player = playerPool().find(p => String(p.id) === String(playerId) && !p.drafted);
  if (!player) return toast('That player is no longer available.');
  pendingAssignPlayerId = String(playerId);
  $('#assignModalTitle').textContent = player.name;
  $('#assignPlayerMeta').textContent = `${player.position || '—'} • ${player.nhlTeam || '—'} • ${fantasyPoints(player, state.settings.scoring)} fantasy pts`;
  ensureOwnersExist();
  const limit = Number(state.settings.rosterRules?.totalRosterSize || 99);
  const options = state.owners.map(owner => {
    const count = (state.rosters[owner.id] || []).length;
    const full = count >= limit;
    return `<option value="${escapeHtml(owner.id)}" ${full ? 'disabled' : ''}>${escapeHtml(owner.teamName)} — ${count}/${limit}</option>`;
  }).join('');
  $('#assignOwnerSelect').innerHTML = options;
  $('#assignRosterOptions').innerHTML = state.owners.map(owner => {
    const count = (state.rosters[owner.id] || []).length;
    const full = count >= limit;
    return `<button type="button" class="assign-option ${full ? 'disabled' : ''}" data-assign-owner="${escapeHtml(owner.id)}" ${full ? 'disabled' : ''}>
      <strong>${escapeHtml(owner.teamName)}</strong>
      <span>${escapeHtml(owner.name)} • ${count}/${limit} players</span>
    </button>`;
  }).join('');
  $$('[data-assign-owner]').forEach(btn => btn.addEventListener('click', () => assignPlayerToOwner(btn.dataset.assignOwner)));
  $('#assignModal').classList.add('show');
  $('#assignModal').setAttribute('aria-hidden', 'false');
}

function closeAssignModal() {
  pendingAssignPlayerId = null;
  $('#assignModal')?.classList.remove('show');
  $('#assignModal')?.setAttribute('aria-hidden', 'true');
}

function assignPlayerToOwner(ownerId) {
  if (!ownerId) return toast('Choose a roster first.');
  if (!pendingAssignPlayerId) return closeAssignModal();
  const player = playerPool().find(p => String(p.id) === String(pendingAssignPlayerId) && !p.drafted);
  const owner = state.owners.find(o => String(o.id) === String(ownerId));
  if (!player || !owner) return toast('Player or owner not found.');
  const rosterLimit = Number(state.settings.rosterRules?.totalRosterSize || 99);
  if ((state.rosters[ownerId] || []).length >= rosterLimit) return toast('That roster is already full.');
  const pick = { pick: state.draftBoard.picks.length + 1, ownerId, player: minimalPlayer(player), timestamp: new Date().toISOString() };
  state.draftBoard.picks.push(pick);
  state.rosters[owner.id] = state.rosters[owner.id] || [];
  state.rosters[owner.id].push(minimalPlayer(player));
  closeAssignModal();
  save();
  renderAll();
  toast(`Added ${player.name} to ${owner.teamName}.`);
}

function minimalPlayer(p) {
  return { id: String(p.id), name: p.name, position: p.position, nhlTeam: p.nhlTeam, type: p.type || (p.position === 'G' ? 'goalie' : 'skater') };
}

function undoPick() {
  const last = state.draftBoard.picks.pop();
  if (!last) return toast('No picks to undo.');
  state.rosters[last.ownerId] = (state.rosters[last.ownerId] || []).filter(p => String(p.id) !== String(last.player.id));
  save(); renderAll(); toast(`Undid ${last.player.name}.`);
}

function resetDraft() {
  if (!confirm('Reset the entire draft and clear all rosters?')) return;
  state.draftBoard.picks = [];
  state.rosters = {};
  save(); renderAll(); toast('Draft reset.');
}

function renderDraftOrderEditor() {
  const order = state.draftBoard.draftOrder.length ? state.draftBoard.draftOrder : state.owners.map(o => o.id);
  $('#draftOrderEditor').innerHTML = order.map((id, index) => {
    const owner = state.owners.find(o => o.id === id);
    return `<div class="row-card"><div><strong>${index + 1}. ${owner?.name || id}</strong><div class="meta">${owner?.teamName || ''}</div></div><div><button class="small-btn" data-move-up="${id}">↑</button><button class="small-btn" data-move-down="${id}">↓</button></div></div>`;
  }).join('');
  $$('[data-move-up]').forEach(b => b.addEventListener('click', () => moveOwner(b.dataset.moveUp, -1)));
  $$('[data-move-down]').forEach(b => b.addEventListener('click', () => moveOwner(b.dataset.moveDown, 1)));
}

function moveOwner(id, delta) {
  const order = state.draftBoard.draftOrder.length ? state.draftBoard.draftOrder : state.owners.map(o => o.id);
  const i = order.indexOf(id), j = i + delta;
  if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  state.draftBoard.draftOrder = order;
  save(); renderDraft();
}

function renderPickHistory() {
  const rows = [...state.draftBoard.picks].reverse().map(p => {
    const owner = state.owners.find(o => o.id === p.ownerId);
    return `<tr><td>${p.pick}</td><td>${owner?.name || p.ownerId}</td><td>${escapeHtml(p.player.name)}</td><td>${p.player.position || ''}</td><td>${p.player.nhlTeam || ''}</td></tr>`;
  }).join('');
  $('#pickHistory').innerHTML = `<table><thead><tr><th>Pick</th><th>Owner</th><th>Player</th><th>Pos</th><th>NHL</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No picks yet.</td></tr>'}</tbody></table>`;
}

function renderRosters() {
  $('#rosterCards').innerHTML = state.owners.map(owner => {
    const roster = state.rosters[owner.id] || [];
    const total = ownerTotal(owner.id, state);
    const rows = roster.map(p => {
      const current = state.stats.players.find(sp => String(sp.id) === String(p.id)) || p;
      return `<div class="player-pill"><div><strong>${escapeHtml(p.name)}</strong><div class="meta">${p.position} • ${p.nhlTeam || ''} • ${fantasyPoints({ ...p, ...current }, state.settings.scoring)} pts</div></div><button class="small-btn danger" data-remove-player="${owner.id}|${p.id}">Remove</button></div>`;
    }).join('');
    return `<article class="card"><div class="owner-head"><div><span class="label">${escapeHtml(owner.name)}</span><h3>${escapeHtml(owner.teamName)}</h3></div><span class="badge">${total} pts</span></div>${rows || '<p class="muted">No players drafted yet.</p>'}</article>`;
  }).join('');
  $$('[data-remove-player]').forEach(btn => btn.addEventListener('click', () => removePlayer(btn.dataset.removePlayer)));
}

function removePlayer(value) {
  const [ownerId, playerId] = value.split('|');
  state.rosters[ownerId] = (state.rosters[ownerId] || []).filter(p => String(p.id) !== String(playerId));
  state.draftBoard.picks = state.draftBoard.picks.filter(p => !(p.ownerId === ownerId && String(p.player.id) === String(playerId))).map((p, i) => ({ ...p, pick: i + 1 }));
  save(); renderAll(); toast('Player removed.');
}

function addOwner(presetName = null, presetTeamName = null) {
  const name = typeof presetName === 'string' ? presetName : prompt('Owner name?');
  if (!name) return;
  const teamName = typeof presetTeamName === 'string' ? presetTeamName : (prompt('Team name?', `${name}'s Team`) || `${name}'s Team`);
  let base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'owner';
  let id = base;
  let n = 2;
  while (state.owners.some(o => o.id === id)) id = `${base}-${n++}`;
  state.owners.push({ id, name, teamName });
  state.rosters[id] = state.rosters[id] || [];
  if (!state.draftBoard.draftOrder.includes(id)) state.draftBoard.draftOrder.push(id);
  save(); renderAll(); toast(`${teamName} roster created.`);
}

function ensureOwnersExist() {
  if (!Array.isArray(state.owners)) state.owners = [];
  if (!state.owners.length) loadSampleOwners(false);
  state.owners.forEach(o => { state.rosters[o.id] = state.rosters[o.id] || []; });
  state.draftBoard.draftOrder = (state.draftBoard.draftOrder || []).filter(id => state.owners.some(o => o.id === id));
  state.owners.forEach(o => { if (!state.draftBoard.draftOrder.includes(o.id)) state.draftBoard.draftOrder.push(o.id); });
}

function loadSampleOwners(showToast = true) {
  const sample = [
    ['nick', 'Nick', "Nick's Team"],
    ['owner2', 'Owner 2', 'Owner 2'],
    ['owner3', 'Owner 3', 'Owner 3'],
    ['owner4', 'Owner 4', 'Owner 4'],
    ['owner5', 'Owner 5', 'Owner 5'],
    ['owner6', 'Owner 6', 'Owner 6'],
    ['owner7', 'Owner 7', 'Owner 7'],
    ['owner8', 'Owner 8', 'Owner 8']
  ];
  state.owners = sample.map(([id, name, teamName]) => ({ id, name, teamName }));
  state.rosters = Object.fromEntries(state.owners.map(o => [o.id, state.rosters?.[o.id] || []]));
  state.draftBoard.draftOrder = state.owners.map(o => o.id);
  save();
  renderAll();
  if (showToast) toast('Loaded 8 sample rosters.');
}

function normalizeStateForDraftTesting() {
  state.settings = state.settings || structuredClone(defaults.settings || {});
  state.settings.scoring = state.settings.scoring || {};
  state.settings.rosterRules = state.settings.rosterRules || { totalRosterSize: 18 };
  state.settings.draftRules = state.settings.draftRules || { type: 'snake', rounds: 18 };
  state.owners = Array.isArray(state.owners) ? state.owners : [];
  state.rosters = state.rosters && typeof state.rosters === 'object' ? state.rosters : {};
  state.draftBoard = state.draftBoard || { currentPick: 1, draftOrder: [], picks: [] };
  state.draftBoard.picks = Array.isArray(state.draftBoard.picks) ? state.draftBoard.picks : [];
  state.draftBoard.draftOrder = Array.isArray(state.draftBoard.draftOrder) ? state.draftBoard.draftOrder : [];
  state.manualPlayers = Array.isArray(state.manualPlayers) ? state.manualPlayers : [];
  state.stats = state.stats || { fetchedAt: null, players: [] };
  state.stats.players = Array.isArray(state.stats.players) ? state.stats.players : [];
  ensureOwnersExist();
}


function loadDemoPlayers() {
  const demo = [
    ['demo-1','Connor McDavid','C','EDM',82,64,89,153],
    ['demo-2','Nathan MacKinnon','C','COL',82,51,89,140],
    ['demo-3','Nikita Kucherov','R','TBL',81,44,100,144],
    ['demo-4','Auston Matthews','C','TOR',81,69,38,107],
    ['demo-5','David Pastrnak','R','BOS',82,47,63,110],
    ['demo-6','Leon Draisaitl','C','EDM',81,41,65,106],
    ['demo-7','Mikko Rantanen','R','COL',80,42,62,104],
    ['demo-8','Artemi Panarin','L','NYR',82,49,71,120],
    ['demo-9','Cale Makar','D','COL',77,21,69,90],
    ['demo-10','Quinn Hughes','D','VAN',82,17,75,92],
    ['demo-11','William Nylander','R','TOR',82,40,58,98],
    ['demo-12','Mitch Marner','R','TOR',69,26,59,85],
    ['demo-13','Brady Tkachuk','L','OTT',81,37,37,74],
    ['demo-14','Jack Hughes','C','NJD',62,27,47,74],
    ['demo-15','Sidney Crosby','C','PIT',82,42,52,94],
    ['demo-16','Igor Shesterkin','G','NYR',55,0,0,0,36,4,1400,120],
    ['demo-17','Connor Hellebuyck','G','WPG',60,0,0,0,37,5,1600,125],
    ['demo-18','Jeremy Swayman','G','BOS',44,0,0,0,25,3,1200,100],
    ['demo-19','Andrei Vasilevskiy','G','TBL',52,0,0,0,30,2,1450,135],
    ['demo-20','Jake Oettinger','G','DAL',54,0,0,0,35,3,1350,120]
  ].map(row => {
    const isGoalie = row[2] === 'G';
    return {
      id: row[0], name: row[1], position: row[2], nhlTeam: row[3], type: isGoalie ? 'goalie' : 'skater',
      gamesPlayed: row[4], goals: row[5], assists: row[6], points: row[7],
      goalieWins: row[8] || 0, goalieShutouts: row[9] || 0, goalieSaves: row[10] || 0, goalieGoalsAgainst: row[11] || 0,
      manual: true, demo: true
    };
  });
  state.stats = { source: 'demo-board', fetchedAt: new Date().toISOString(), seasonId: state.settings.seasonId, gameTypeId: state.settings.gameTypeId || 2, players: demo };
  save();
  renderAll();
  toast('Demo player board loaded. You can test Add to Roster now.');
}

function renderDraftOwnerList() {
  const el = $('#draftOwnerList');
  if (!el) return;
  const limit = Number(state.settings.rosterRules?.totalRosterSize || 99);
  const removeSelect = $('#removeOwnerSelect');
  if (removeSelect) {
    removeSelect.innerHTML = state.owners.map(owner => {
      const count = (state.rosters[owner.id] || []).length;
      return `<option value="${escapeHtml(owner.id)}">${escapeHtml(owner.teamName)} — ${count} players</option>`;
    }).join('') || '<option value="">No teams available</option>';
    removeSelect.disabled = !state.owners.length;
  }
  const removeBtn = $('#removeOwnerBtnDraft');
  if (removeBtn) removeBtn.disabled = !state.owners.length;

  el.innerHTML = state.owners.map(owner => {
    const count = (state.rosters[owner.id] || []).length;
    return `<div class="mini-list-row roster-manager-row">
      <div><strong>${escapeHtml(owner.teamName)}</strong><div class="meta">${escapeHtml(owner.name)} • ${count}/${limit} players</div></div>
      <button class="small-btn danger" data-remove-owner-inline="${escapeHtml(owner.id)}">Remove</button>
    </div>`;
  }).join('') || '<p class="muted">No rosters yet.</p>';
  $$('[data-remove-owner-inline]').forEach(btn => btn.addEventListener('click', () => removeOwner(btn.dataset.removeOwnerInline)));
}

function removeOwnerFromDraftRoom() {
  const ownerId = $('#removeOwnerSelect')?.value;
  if (!ownerId) return toast('No team selected.');
  removeOwner(ownerId);
}

function removeOwner(ownerId) {
  const owner = state.owners.find(o => String(o.id) === String(ownerId));
  if (!owner) return toast('Team not found.');
  const rosterCount = (state.rosters[owner.id] || []).length;
  const pickCount = state.draftBoard.picks.filter(p => String(p.ownerId) === String(owner.id)).length;
  const warning = rosterCount || pickCount ? `

This will also release ${rosterCount} roster player(s) back to the draft board and remove ${pickCount} pick history item(s).` : '';
  if (!confirm(`Remove ${owner.teamName}?${warning}`)) return;
  state.owners = state.owners.filter(o => String(o.id) !== String(owner.id));
  delete state.rosters[owner.id];
  state.draftBoard.draftOrder = (state.draftBoard.draftOrder || []).filter(id => String(id) !== String(owner.id));
  state.draftBoard.picks = (state.draftBoard.picks || [])
    .filter(pick => String(pick.ownerId) !== String(owner.id))
    .map((pick, index) => ({ ...pick, pick: index + 1 }));
  save();
  renderAll();
  toast(`${owner.teamName} removed.`);
}

function renderLeaderboard() {
  const rows = state.owners.map(o => ({ ...o, total: ownerTotal(o.id, state), count: (state.rosters[o.id] || []).length }))
    .sort((a, b) => b.total - a.total)
    .map((o, i) => `<tr><td>${i + 1}</td><td><strong>${escapeHtml(o.teamName)}</strong><div class="meta">${escapeHtml(o.name)}</div></td><td>${o.count}</td><td><strong>${o.total}</strong></td></tr>`).join('');
  $('#leaderboardTable').innerHTML = `<table><thead><tr><th>Rank</th><th>Team</th><th>Players</th><th>Fantasy Points</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderPlayersTable() {
  const q = ($('#statsSearch')?.value || '').toLowerCase();
  const draftedIds = new Set(state.draftBoard.picks.map(p => String(p.player.id)));
  const rows = playerPool().filter(p => !q || p.name.toLowerCase().includes(q) || String(p.nhlTeam || '').toLowerCase().includes(q)).slice(0, 250).map(p => `
    <tr><td>${escapeHtml(p.name)}</td><td>${p.position || ''}</td><td>${p.nhlTeam || ''}</td><td>${p.gamesPlayed || 0}</td><td>${p.goals ?? ''}</td><td>${p.assists ?? ''}</td><td>${p.points ?? ''}</td><td>${p.goalieWins ?? ''}</td><td>${fantasyPoints(p, state.settings.scoring)}</td><td>${draftedIds.has(String(p.id)) ? '<span class="badge">Drafted</span>' : ''}</td></tr>`).join('');
  $('#playersTable').innerHTML = `<table><thead><tr><th>Player</th><th>Pos</th><th>NHL</th><th>GP</th><th>G</th><th>A</th><th>PTS</th><th>W</th><th>Pool Pts</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="10">No player stats loaded yet.</td></tr>'}</tbody></table>`;
}

function renderRulesForms() {
  $('#poolSetupForm').innerHTML = field('Pool name', 'poolName', state.settings.poolName, 'text') + field('Season ID', 'seasonId', state.settings.seasonId, 'text') + field('Game type ID', 'gameTypeId', state.settings.gameTypeId || 2, 'number') + field('Draft type', 'draftRules.type', state.settings.draftRules?.type || 'snake', 'text') + field('Draft rounds', 'draftRules.rounds', state.settings.draftRules?.rounds || 18, 'number');
  const rosterKeys = ['forwards','defense','goalies','bench','ir','totalRosterSize'];
  $('#rosterRulesForm').innerHTML = rosterKeys.map(k => field(labelize(k), `rosterRules.${k}`, state.settings.rosterRules?.[k] ?? 0, 'number')).join('');
  const scoreKeys = Object.keys(state.settings.scoring || {});
  $('#scoringRulesForm').innerHTML = scoreKeys.map(k => field(labelize(k), `scoring.${k}`, state.settings.scoring[k] ?? 0, 'number', '0.01')).join('');
}

function field(label, path, value, type = 'text', step = '1') {
  return `<div class="form-field"><label>${label}</label><input data-setting-path="${path}" type="${type}" step="${step}" value="${escapeHtml(String(value ?? ''))}" /></div>`;
}

function saveRulesFromForm() {
  $$('[data-setting-path]').forEach(input => {
    const path = input.dataset.settingPath.split('.');
    let obj = state.settings;
    while (path.length > 1) {
      const part = path.shift();
      obj[part] = obj[part] || {};
      obj = obj[part];
    }
    const key = path[0];
    obj[key] = input.type === 'number' ? Number(input.value || 0) : input.value;
  });
  save(); renderAll(); toast('Rules saved.');
}

function addManualPlayer() {
  const name = $('#manualName').value.trim();
  if (!name) return toast('Add a player name first.');
  const player = { id: `manual-${Date.now()}`, name, position: $('#manualPos').value, nhlTeam: $('#manualTeam').value.trim().toUpperCase(), type: $('#manualPos').value === 'G' ? 'goalie' : 'skater', manual: true, gamesPlayed: 0, goals: 0, assists: 0, points: 0, goalieWins: 0, goalieShutouts: 0 };
  state.manualPlayers.push(player);
  $('#manualName').value = ''; $('#manualTeam').value = '';
  save(); renderAll(); toast('Manual player added.');
}

function exportPool() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `custom-hockey-pool-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importPool(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    state = deepMerge(structuredClone(defaults), imported);
    save(); renderAll(); toast('Pool backup imported.');
  } catch (err) {
    console.error(err); toast('Import failed. Make sure it is a valid JSON backup.');
  } finally { e.target.value = ''; }
}

function factoryReset() {
  if (!confirm('Factory reset all saved browser data for this pool?')) return;
  localStorage.removeItem(STORAGE_KEY);
  state = structuredClone(defaults);
  renderAll(); toast('Factory reset complete.');
}

function renderRawJson() {
  const el = $('#rawJson');
  if (el) el.value = JSON.stringify(state, null, 2);
}

function labelize(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

function escapeHtml(str) {
  return String(str).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

init();
