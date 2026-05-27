import { currentSeasonId, fetchNhlStats } from './nhl-api.js';
import { fantasyPoints, ownerTotal } from './scoring.js';

const STORAGE_KEY = 'custom-hockey-pool-v1';
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
  if (!state.settings.seasonId) state.settings.seasonId = currentSeasonId();
  bindEvents();
  renderAll();
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
    toast(`Loaded ${data.players.length} NHL players.`);
  } catch (error) {
    console.error(error);
    toast('NHL stats pull failed. You can still draft manual players.');
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
  const rows = list.map((p, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(p.name)}</strong><div class="meta">${p.position || '—'} • ${p.nhlTeam || '—'} ${p.manual ? '• Manual' : ''}</div></td>
      <td>${p.gamesPlayed || 0}</td>
      <td>${p.goals ?? 0}</td>
      <td>${p.assists ?? 0}</td>
      <td>${p.points ?? 0}</td>
      <td>${p.goalieWins ?? ''}</td>
      <td><strong>${fantasyPoints(p, state.settings.scoring)}</strong></td>
      <td><button class="small-btn primary" data-open-assign="${escapeHtml(String(p.id))}">Add to Roster</button></td>
    </tr>`).join('');
  $('#draftBoardTable').innerHTML = `<table class="draft-table"><thead><tr><th>#</th><th>${header('Player','name')}</th><th>${header('GP','gamesPlayed')}</th><th>${header('G','goals')}</th><th>${header('A','assists')}</th><th>${header('PTS','points')}</th><th>${header('W','goalieWins')}</th><th>${header('Fantasy','fantasyPoints')}</th><th>Draft</th></tr></thead><tbody>${rows || '<tr><td colspan="9">No available players yet. Pull NHL stats or add a manual player.</td></tr>'}</tbody></table>`;
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
  $('#assignRosterOptions').innerHTML = state.owners.map(owner => {
    const count = (state.rosters[owner.id] || []).length;
    const limit = Number(state.settings.rosterRules?.totalRosterSize || 99);
    const full = count >= limit;
    return `<button class="assign-option ${full ? 'disabled' : ''}" data-assign-owner="${owner.id}" ${full ? 'disabled' : ''}>
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
  if (!pendingAssignPlayerId) return closeAssignModal();
  const player = playerPool().find(p => String(p.id) === String(pendingAssignPlayerId) && !p.drafted);
  const owner = state.owners.find(o => o.id === ownerId);
  if (!player || !owner) return toast('Player or owner not found.');
  const rosterLimit = Number(state.settings.rosterRules?.totalRosterSize || 99);
  if ((state.rosters[ownerId] || []).length >= rosterLimit) return toast('That roster is already full.');
  const pick = { pick: state.draftBoard.picks.length + 1, ownerId, player: minimalPlayer(player), timestamp: new Date().toISOString() };
  state.draftBoard.picks.push(pick);
  state.rosters[ownerId] = state.rosters[ownerId] || [];
  state.rosters[ownerId].push(minimalPlayer(player));
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

function addOwner() {
  const name = prompt('Owner name?');
  if (!name) return;
  const teamName = prompt('Team name?', `${name}'s Team`) || `${name}'s Team`;
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36).slice(-4);
  state.owners.push({ id, name, teamName });
  state.draftBoard.draftOrder.push(id);
  save(); renderAll(); toast('Owner added.');
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
