import { currentSeasonId, fetchNhlStats } from './nhl-api.js';
import { fantasyPoints, ownerTotal } from './scoring.js';

const STORAGE_KEY = 'custom-hockey-pool-v15-draft-rooms';
let globalLotteryStorageConfigured = false;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let defaults = {};
let state = null;
let draftSort = { key: 'fantasyPoints', direction: 'desc' };
let pendingAssignPlayerId = null;
let activeDraftOwnerId = localStorage.getItem('custom-hockey-pool-active-owner') || '';
let draftRoomView = 'info';

const FINAL_OWNERS = [
  { id: 'nick', name: 'Nick', teamName: 'Nick' },
  { id: 'chris', name: 'Chris', teamName: 'Chris' },
  { id: 'andrew', name: 'Andrew', teamName: 'Andrew' },
  { id: 'tyler', name: 'Tyler', teamName: 'Tyler' },
  { id: 'scott', name: 'Scott', teamName: 'Scott' }
];

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
  applyLotteryFromUrl();
  await loadGlobalLottery();
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

function normalizeStateForDraftTesting() {
  state.settings = state.settings || structuredClone(defaults.settings || {});
  state.owners = Array.isArray(state.owners) && state.owners.length ? state.owners : structuredClone(FINAL_OWNERS);
  state.rosters = state.rosters && typeof state.rosters === 'object' && !Array.isArray(state.rosters) ? state.rosters : {};
  state.draftBoard = state.draftBoard && typeof state.draftBoard === 'object' ? state.draftBoard : { currentPick: 1, draftOrder: [], picks: [] };
  state.draftBoard.picks = Array.isArray(state.draftBoard.picks) ? state.draftBoard.picks : [];
  state.draftBoard.draftOrder = Array.isArray(state.draftBoard.draftOrder) && state.draftBoard.draftOrder.length ? state.draftBoard.draftOrder : state.owners.map(o => o.id);
  state.draftBoard.lotteryResult = Array.isArray(state.draftBoard.lotteryResult) ? state.draftBoard.lotteryResult : [];
  state.draftBoard.lotteryRunNumber = state.draftBoard.lotteryRunNumber || 1;
  state.manualPlayers = Array.isArray(state.manualPlayers) ? state.manualPlayers : [];
  state.stats = state.stats && typeof state.stats === 'object' ? state.stats : { fetchedAt: null, players: [] };
  state.stats.players = Array.isArray(state.stats.players) ? state.stats.players : [];
  state.playerMap = state.playerMap || {};
  state.statOverrides = state.statOverrides || {};
  state.owners.forEach(o => { state.rosters[o.id] = Array.isArray(state.rosters[o.id]) ? state.rosters[o.id] : []; });
  state.draftBoard.draftOrder = state.draftBoard.draftOrder.filter(id => state.owners.some(o => String(o.id) === String(id)));
  state.owners.forEach(o => { if (!state.draftBoard.draftOrder.includes(o.id)) state.draftBoard.draftOrder.push(o.id); });
  state.draftBoard.lotteryResult = state.draftBoard.lotteryResult.filter(r => state.owners.some(o => String(o.id) === String(typeof r === 'string' ? r : r.id)));
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
  $$('[data-draft-room]').forEach(btn => btn.addEventListener('click', () => setDraftRoomView(btn.dataset.draftRoom)));
  $('#activeDraftOwnerSelect')?.addEventListener('change', (e) => setActiveDraftOwner(e.target.value));
  $('#closeAssignModal')?.addEventListener('click', closeAssignModal);
  $('#assignModal')?.addEventListener('click', (e) => { if (e.target.id === 'assignModal') closeAssignModal(); });
  $('#statsSearch')?.addEventListener('input', renderPlayersTable);
  $('#saveRulesBtn')?.addEventListener('click', saveRulesFromForm);
  $('#resetRulesBtn')?.addEventListener('click', () => { state.settings = structuredClone(defaults.settings); save(); renderAll(); toast('Rules reset to defaults.'); });
  $('#undoPickBtn')?.addEventListener('click', undoPick);
  $('#resetDraftBtn')?.addEventListener('click', resetDraft);
  $('#addOwnerBtn')?.addEventListener('click', addOwner);
  $('#addOwnerBtnDraft')?.addEventListener('click', addOwner);
  $('#loadSampleOwnersBtn')?.addEventListener('click', loadSampleOwners);
  $('#restoreFinalOwnersBtn')?.addEventListener('click', restoreFinalOwners);
  $('#removeOwnerBtnDraft')?.addEventListener('click', removeOwnerFromDraftRoom);
  $('#runLotteryBtn')?.addEventListener('click', runDraftLottery);
  $('#replayLotteryBtn')?.addEventListener('click', replayLockedLottery);
  $('#copyLotteryLinkBtn')?.addEventListener('click', copyLockedLotteryLink);
  $('#closeSpyLottery')?.addEventListener('click', closeSpyLottery);
  $('#spyLotteryModal')?.addEventListener('click', (e) => { if (e.target.id === 'spyLotteryModal') closeSpyLottery(); });
  $('#loadDemoPlayersBtn')?.addEventListener('click', loadDemoPlayers);
  $('#confirmAssignBtn')?.addEventListener('click', () => assignPlayerToOwner($('#assignOwnerSelect')?.value));
  $('#exportBtn')?.addEventListener('click', exportPool);
  $('#importFile')?.addEventListener('change', importPool);
  $('#clearStatsBtn')?.addEventListener('click', () => { state.stats = { fetchedAt: null, players: [] }; save(); renderAll(); toast('Stats cache cleared.'); });
  $('#factoryResetBtn')?.addEventListener('click', factoryReset);
}


function setDraftRoomView(view) {
  draftRoomView = view === 'board' ? 'board' : 'info';
  renderDraftRooms();
  if (draftRoomView === 'board') setTimeout(() => $('#draftBoardPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

function setActiveDraftOwner(ownerId) {
  const owner = state?.owners?.find(o => String(o.id) === String(ownerId));
  if (!owner) return toast('Choose one of the five teams first.');
  activeDraftOwnerId = String(owner.id);
  localStorage.setItem('custom-hockey-pool-active-owner', activeDraftOwnerId);
  draftRoomView = 'board';
  renderDraftRooms();
  renderDraftBoard();
  toast(`Entered the draft room as ${owner.teamName}.`);
}

function activeDraftOwner() {
  if (!state?.owners?.some(o => String(o.id) === String(activeDraftOwnerId))) {
    activeDraftOwnerId = state?.owners?.[0]?.id || '';
    if (activeDraftOwnerId) localStorage.setItem('custom-hockey-pool-active-owner', activeDraftOwnerId);
  }
  return state?.owners?.find(o => String(o.id) === String(activeDraftOwnerId)) || null;
}

function renderDraftRooms() {
  $$('[data-draft-room]').forEach(btn => btn.classList.toggle('active', btn.dataset.draftRoom === draftRoomView));
  $('#draftInfoRoom')?.classList.toggle('active', draftRoomView === 'info');
  $('#draftBoardPanel')?.classList.toggle('active', draftRoomView === 'board');
  renderDraftEntryCards();
}

function renderDraftEntryCards() {
  const wrap = $('#draftEntryCards');
  if (!wrap) return;
  const current = activeDraftOwner();
  wrap.innerHTML = state.owners.map(owner => {
    const count = (state.rosters[owner.id] || []).length;
    const active = current && String(current.id) === String(owner.id);
    return `<button type="button" class="draft-entry-card ${active ? 'active' : ''}" data-enter-owner="${escapeHtml(owner.id)}">
      <span class="mini-tv-light"></span>
      <strong>${escapeHtml(owner.teamName)}</strong>
      <small>${count} drafted</small>
      <em>${active ? 'Currently inside' : 'Enter room'}</em>
    </button>`;
  }).join('');
  $$('[data-enter-owner]').forEach(btn => btn.addEventListener('click', () => setActiveDraftOwner(btn.dataset.enterOwner)));
  const select = $('#activeDraftOwnerSelect');
  if (select) {
    select.innerHTML = state.owners.map(o => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.teamName)}</option>`).join('');
    if (current) select.value = current.id;
  }
  const label = $('#activeDraftOwnerLabel');
  if (label) label.textContent = current ? current.teamName : 'Choose team';
}

function showTab(tab) {
  if (!tab || !document.getElementById(tab)) return;
  $$('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  $$('.panel').forEach(panel => panel.classList.toggle('active', panel.id === tab));
  document.body.dataset.activeTab = tab;
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
    toast('NHL API pull failed. Try again after deploy or use demo players.');
  } finally {
    setRefreshDisabled(false);
  }
}

function setRefreshDisabled(disabled) {
  ['#refreshStatsBtn', '#refreshStatsBtn2', '#refreshStatsBtn3', '#refreshStatsBtnDraft'].forEach(sel => { const b = $(sel); if (b) b.disabled = disabled; });
}

function renderAll() {
  const titleEl = $('#poolTitle');
  if (titleEl) titleEl.textContent = state.settings.poolName || 'Hockey Pool';
  if ($('#seasonDisplay')) $('#seasonDisplay').textContent = formatSeason(state.settings.seasonId);
  if ($('#lastUpdatedDisplay')) $('#lastUpdatedDisplay').textContent = state.stats.fetchedAt ? new Date(state.stats.fetchedAt).toLocaleString() : 'Never';
  renderDashboardCards();
  renderDraft();
  renderRosters();
  renderTeamManager();
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
  const wrap = $('#dashboardCards');
  if (!wrap) return;
  wrap.innerHTML = cards.map(([label, val]) => `<article class="card"><span class="label">${label}</span><h2>${val}</h2></article>`).join('');
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
  renderDraftRooms();
  renderDraftBoard();
  renderDraftOrderEditor();
  renderDraftLottery();
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
  const current = activeDraftOwner();
  const sortArrow = (key) => draftSort.key === key ? (draftSort.direction === 'asc' ? ' ▲' : ' ▼') : '';
  const header = (label, key) => `<button class="sort-head" data-draft-sort="${key}">${label}${sortArrow(key)}</button>`;
  const draftButton = (p) => `<button type="button" class="draft-player-btn single-draft-btn" data-draft-player="${escapeHtml(String(p.id))}" ${current ? '' : 'disabled'}>Draft</button>`;
  const rows = list.map((p, index) => `
    <tr>
      <td class="rank-cell">${index + 1}</td>
      <td class="player-draft-cell">
        <div class="player-draft-line compact-player-line">
          <div>
            <strong>${escapeHtml(p.name)}</strong>
            <div class="meta">${p.position || '—'} • ${p.nhlTeam || '—'} ${p.manual ? '• Manual' : ''}</div>
          </div>
          ${draftButton(p)}
        </div>
      </td>
      <td>${p.gamesPlayed || 0}</td>
      <td>${p.goals ?? 0}</td>
      <td>${p.assists ?? 0}</td>
      <td>${p.points ?? 0}</td>
      <td>${p.goalieWins ?? ''}</td>
      <td><strong>${fantasyPoints(p, state.settings.scoring)}</strong></td>
    </tr>`).join('');
  const chosenText = current ? `Drafting for ${escapeHtml(current.teamName)}` : 'Choose a team to enter the room';
  $('#draftBoardTable').innerHTML = `
    <div class="active-draft-banner">${chosenText}</div>
    <table class="draft-table"><thead><tr><th>#</th><th>${header('Player','name')}</th><th>${header('GP','gamesPlayed')}</th><th>${header('G','goals')}</th><th>${header('A','assists')}</th><th>${header('PTS','points')}</th><th>${header('W','goalieWins')}</th><th>${header('Fantasy','fantasyPoints')}</th></tr></thead><tbody>${rows || '<tr><td colspan="8">No available players yet. Pull NHL stats or load demo players.</td></tr>'}</tbody></table>`;
  $$('[data-draft-sort]').forEach(btn => btn.addEventListener('click', () => changeDraftSort(btn.dataset.draftSort)));
  $$('[data-draft-player]').forEach(btn => btn.addEventListener('click', () => draftPlayerForActiveOwner(btn.dataset.draftPlayer)));
}

function changeDraftSort(key) {
  if (draftSort.key === key) draftSort.direction = draftSort.direction === 'asc' ? 'desc' : 'asc';
  else draftSort = { key, direction: key === 'name' ? 'asc' : 'desc' };
  const select = $('#draftSortSelect');
  if (select) select.value = key;
  renderDraftBoard();
}


function draftPlayerForActiveOwner(playerId) {
  const owner = activeDraftOwner();
  if (!owner) return toast('Select your team name to enter the Draft Room first.');
  const player = playerPool().find(p => String(p.id) === String(playerId) && !p.drafted);
  if (!player) return toast('That player is no longer available.');
  return assignPlayerToOwner(owner.id, playerId);
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

function assignPlayerToOwner(ownerId, directPlayerId = null) {
  if (!ownerId) return toast('Choose a roster first.');
  const targetPlayerId = directPlayerId || pendingAssignPlayerId;
  if (!targetPlayerId) return closeAssignModal();
  const player = playerPool().find(p => String(p.id) === String(targetPlayerId) && !p.drafted);
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

async function resetDraft() {
  if (!confirm('Reset the entire draft, clear all rosters, and clear the locked lottery results?')) return;
  await clearGlobalLottery();
  state.draftBoard.picks = [];
  state.rosters = {};
  state.owners.forEach(o => { state.rosters[o.id] = []; });
  state.draftBoard.lotteryResult = [];
  state.draftBoard.lotteryRunNumber = 1;
  state.draftBoard.draftOrder = state.owners.map(o => o.id);
  clearLotteryShareUrl();
  save(); renderAll(); toast('Draft and lottery reset.');
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


function equalShuffleOwners(owners) {
  const arr = [...owners];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function lockedLotteryOrderIds() {
  const result = Array.isArray(state.draftBoard.lotteryResult) ? state.draftBoard.lotteryResult : [];
  return result.map(r => typeof r === 'string' ? r : r.id).filter(id => state.owners.some(o => String(o.id) === String(id)));
}

function validLotteryOrder(ids) {
  if (!Array.isArray(ids) || ids.length !== state.owners.length) return false;
  const ownerIds = new Set(state.owners.map(o => String(o.id)));
  const seen = new Set(ids.map(String));
  return seen.size === ids.length && ids.every(id => ownerIds.has(String(id)));
}


async function loadGlobalLottery() {
  try {
    const response = await fetch('/api/lottery', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    globalLotteryStorageConfigured = Boolean(data.configured);
    if (data?.lottery?.orderIds && validLotteryOrder(data.lottery.orderIds)) {
      const ids = data.lottery.orderIds.map(String);
      state.draftBoard.draftOrder = ids;
      state.draftBoard.lotteryResult = ids.map((id, index) => ({
        id,
        pick: index + 1,
        timestamp: data.lottery.timestamp || 'global-lock',
        odds: 'equal',
        source: 'global'
      }));
      state.draftBoard.lotteryRunNumber = 1;
      save();
    }
  } catch (err) {
    globalLotteryStorageConfigured = false;
    console.warn('Global lottery storage not available yet', err);
  }
}

async function saveGlobalLottery(orderIds) {
  try {
    const response = await fetch('/api/lottery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds })
    });
    const data = await response.json().catch(() => ({}));
    globalLotteryStorageConfigured = Boolean(data.configured);
    if (data?.lottery?.orderIds && validLotteryOrder(data.lottery.orderIds)) {
      return data.lottery.orderIds.map(String);
    }
  } catch (err) {
    console.warn('Could not save global lottery', err);
  }
  return orderIds;
}

async function clearGlobalLottery() {
  try {
    const response = await fetch('/api/lottery', { method: 'DELETE' });
    const data = await response.json().catch(() => ({}));
    globalLotteryStorageConfigured = Boolean(data.configured);
  } catch (err) {
    console.warn('Could not clear global lottery', err);
  }
}

function applyLotteryFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const lottery = params.get('lottery');
    if (!lottery) return;
    const ids = lottery.split(',').map(s => s.trim()).filter(Boolean);
    if (!validLotteryOrder(ids)) return;
    state.draftBoard.draftOrder = ids;
    state.draftBoard.lotteryResult = ids.map((id, index) => ({ id, pick: index + 1, timestamp: 'from-shared-link', odds: 'equal' }));
    state.draftBoard.lotteryRunNumber = 1;
    save();
  } catch (err) {
    console.warn('Could not apply lottery from URL', err);
  }
}

function updateLotteryShareUrl(orderIds) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('lottery', orderIds.join(','));
    window.history.replaceState({}, '', url);
  } catch {}
}

function clearLotteryShareUrl() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('lottery');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  } catch {}
}

async function copyLockedLotteryLink() {
  const lockedOrder = lockedLotteryOrderIds();
  if (lockedOrder.length !== state.owners.length) return toast('LOTTERY NOT COMPLETED YET. Run the lottery first.');
  updateLotteryShareUrl(lockedOrder);
  try {
    await navigator.clipboard.writeText(window.location.href);
    toast('Locked lottery replay link copied.');
  } catch {
    toast('Locked lottery is in the address bar. Copy the URL to share it.');
  }
}

function renderDraftLottery() {
  const status = $('#lotteryStatus');
  const results = $('#lotteryResults');
  if (!status || !results) return;
  if (!state.owners.length) {
    status.textContent = 'Add rosters first.';
    results.innerHTML = '<div class="lottery-not-complete">LOTTERY NOT COMPLETED YET</div>';
    return;
  }
  const lockedOrder = lockedLotteryOrderIds();
  const hasResult = lockedOrder.length === state.owners.length;
  const runBtn = $('#runLotteryBtn');
  const replayBtn = $('#replayLotteryBtn');
  const copyBtn = $('#copyLotteryLinkBtn');
  if (runBtn) runBtn.textContent = hasResult ? 'REPLAY LOCKED LOTTERY' : 'RUN LOTTERY';
  if (replayBtn) replayBtn.style.display = hasResult ? '' : 'none';
  if (copyBtn) copyBtn.style.display = hasResult ? '' : 'none';
  status.textContent = hasResult ? 'Mission complete. Draft order locked until Reset Draft.' : 'LOTTERY NOT COMPLETED YET';
  if (!hasResult) {
    results.innerHTML = '<div class="lottery-not-complete">LOTTERY NOT COMPLETED YET</div><p class="muted compact-note">All five owners have equal odds. The first run locks the order. After that, the button becomes a replay button. For all devices to see the same result from the normal URL, connect Vercel Redis storage.</p>';
    return;
  }
  results.innerHTML = lockedOrder.map((id, index) => {
    const owner = state.owners.find(o => String(o.id) === String(id));
    if (!owner) return '';
    return `<div class="mini-list-row lottery-row locked"><div><strong>${index + 1}. ${escapeHtml(owner.teamName)}</strong><div class="meta">${escapeHtml(owner.name)} • locked equal-weight pick</div></div><span>LOCKED</span></div>`;
  }).join('');
}

async function runDraftLottery() {
  ensureOwnersExist();
  if (!state.owners.length) return toast('Add teams before running the lottery.');
  const lockedOrder = lockedLotteryOrderIds();
  if (lockedOrder.length === state.owners.length) {
    playSpyLottery(lockedOrder);
    return toast('Replaying the locked lottery. Use Reset Draft to clear it.');
  }
  if (state.draftBoard.picks.length && !confirm('You already have drafted players. Running the lottery only changes the draft order, not existing picks. Continue?')) return;
  let result = equalShuffleOwners(state.owners).map(owner => owner.id);
  result = await saveGlobalLottery(result);
  state.draftBoard.draftOrder = result;
  state.draftBoard.lotteryResult = result.map((id, index) => ({ id, pick: index + 1, timestamp: new Date().toISOString(), odds: 'equal', source: globalLotteryStorageConfigured ? 'global' : 'browser' }));
  state.draftBoard.lotteryRunNumber = 1;
  updateLotteryShareUrl(result);
  save();
  renderAll();
  playSpyLottery(result);
  const first = state.owners.find(o => o.id === result[0]);
  toast(globalLotteryStorageConfigured ? `Global lottery locked: ${first?.teamName || 'Team 1'} gets pick 1.` : `Lottery locked on this device: ${first?.teamName || 'Team 1'} gets pick 1.`);
}

function replayLockedLottery() {
  const lockedOrder = lockedLotteryOrderIds();
  if (lockedOrder.length !== state.owners.length) return toast('LOTTERY NOT COMPLETED YET. Run the lottery first.');
  playSpyLottery(lockedOrder);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ownerLotteryLabel(owner) {
  if (!owner) return { primary: 'Unknown Team', secondary: 'No owner file', jerseyClass: '', number: '00', jerseyName: 'POOL' };
  const primary = owner.teamName || owner.name || 'Unnamed Team';
  const lower = String(owner.id || owner.name || '').toLowerCase();
  if (lower.includes('nick')) return { primary, secondary: 'Nick • Sundin Leafs jersey', jerseyClass: 'owner-nick', number: '13', jerseyName: 'SUNDIN' };
  if (lower.includes('andrew')) return { primary, secondary: 'Andrew • Lindros Flyers jersey', jerseyClass: 'owner-andrew', number: '88', jerseyName: 'LINDROS' };
  if (lower.includes('chris')) return { primary, secondary: 'Chris • Gilmour Leafs jersey', jerseyClass: 'owner-chris', number: '93', jerseyName: 'GILMOUR' };
  if (lower.includes('tyler')) return { primary, secondary: 'Tyler • Clark Leafs jersey', jerseyClass: 'owner-tyler', number: '17', jerseyName: 'CLARK' };
  if (lower.includes('scott')) return { primary, secondary: 'Scott • Joseph Leafs jersey', jerseyClass: 'owner-scott', number: '31', jerseyName: 'JOSEPH' };
  return { primary, secondary: `${owner.name || 'Owner'} • draft lottery target`, jerseyClass: '', number: '00', jerseyName: 'POOL' };
}

async function playSpyLottery(orderIds) {
  const modal = $('#spyLotteryModal');
  const target = $('#scopeTargetName');
  const meta = $('#scopeTargetMeta');
  const list = $('#spyResultsList');
  const flash = $('#scopeFlash');
  const scope = $('#scopeView');
  const stick = $('#stickTarget');
  if (!modal || !target || !list || !scope) return;

  list.innerHTML = '';
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lottery-running');
  target.textContent = 'Mission loading...';
  if (meta) meta.textContent = 'Equal odds armed • five basement targets';
  stick?.classList.remove('shot', 'owner-nick', 'owner-andrew', 'owner-chris', 'owner-tyler', 'owner-scott');
  await sleep(550);

  for (let i = 0; i < orderIds.length; i++) {
    const owner = state.owners.find(o => String(o.id) === String(orderIds[i]));
    const label = ownerLotteryLabel(owner);
    target.textContent = label.primary;
    if (meta) meta.textContent = `Pick ${i + 1} • ${label.secondary}`;
    scope.style.setProperty('--scope-x', `${39 + Math.random() * 22}%`);
    scope.style.setProperty('--scope-y', `${30 + Math.random() * 24}%`);
    if (stick) {
      stick.className = `stick-target ${label.jerseyClass || ''}`.trim();
      const num = stick.querySelector('.jersey-number');
      const name = stick.querySelector('.jersey-name');
      if (num) num.textContent = label.number;
      if (name) name.textContent = label.jerseyName;
    }
    scope.classList.remove('scope-hit');
    scope.classList.add('scope-locking');
    await sleep(820);
    scope.classList.remove('scope-locking');
    scope.classList.add('scope-hit');
    stick?.classList.add('shot');
    flash?.classList.remove('pulse');
    void flash?.offsetWidth;
    flash?.classList.add('pulse');
    list.insertAdjacentHTML('beforeend', `<li><span>${i + 1}</span><strong>${escapeHtml(label.primary)}</strong><small>${escapeHtml(label.secondary)}</small></li>`);
    await sleep(680);
  }

  target.textContent = 'ORDER CONFIRMED';
  if (meta) meta.textContent = 'Classified draft folder printed';
  scope.classList.remove('scope-hit', 'scope-locking');
}

function closeSpyLottery() {
  const modal = $('#spyLotteryModal');
  modal?.classList.remove('show');
  modal?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('lottery-running');
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
  if (!state.owners.length) restoreFinalOwners(false);
  state.owners.forEach(o => { state.rosters[o.id] = state.rosters[o.id] || []; });
  state.draftBoard.draftOrder = (state.draftBoard.draftOrder || []).filter(id => state.owners.some(o => String(o.id) === String(id)));
  state.owners.forEach(o => { if (!state.draftBoard.draftOrder.includes(o.id)) state.draftBoard.draftOrder.push(o.id); });
  state.draftBoard.lotteryResult = (state.draftBoard.lotteryResult || []).filter(r => state.owners.some(o => String(o.id) === String(typeof r === 'string' ? r : r.id)));
}

function restoreFinalOwners(showToast = true) {
  const oldRosters = state.rosters || {};
  state.owners = structuredClone(FINAL_OWNERS);
  state.rosters = Object.fromEntries(state.owners.map(o => [o.id, oldRosters[o.id] || []]));
  state.draftBoard.draftOrder = state.owners.map(o => o.id);
  state.draftBoard.lotteryResult = [];
  state.draftBoard.lotteryRunNumber = 1;
  clearLotteryShareUrl();
  save();
  renderAll();
  if (showToast) toast('Restored final five owners and cleared lottery results.');
}

function loadSampleOwners(showToast = true) {
  restoreFinalOwners(false);
  if (showToast) toast('Final five rosters loaded.');
}

function renderTeamManager() {
  const el = $('#teamManagerList');
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
    const label = ownerLotteryLabel(owner);
    return `<div class="mini-list-row roster-manager-row team-manager-row ${escapeHtml(label.jerseyClass)}">
      <div><strong>${escapeHtml(owner.teamName)}</strong><div class="meta">${escapeHtml(owner.name)} • ${count}/${limit} players • ${escapeHtml(label.jerseyName)} ${escapeHtml(label.number)}</div></div>
      <span class="badge">FINAL OWNER</span>
    </div>`;
  }).join('') || '<p class="muted">No rosters yet.</p>';
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
  state.draftBoard.lotteryResult = [];
  state.draftBoard.lotteryRunNumber = 1;
  clearLotteryShareUrl();
  save();
  renderAll();
  toast(`${owner.teamName} removed.`);
}

function renderLeaderboard() {
  const table = $('#leaderboardTable');
  if (!table) return;
  const rows = state.owners.map(o => ({ ...o, total: ownerTotal(o.id, state), count: (state.rosters[o.id] || []).length }))
    .sort((a, b) => b.total - a.total)
    .map((o, i) => `<tr><td>${i + 1}</td><td><strong>${escapeHtml(o.teamName)}</strong><div class="meta">${escapeHtml(o.name)}</div></td><td>${o.count}</td><td><strong>${o.total}</strong></td></tr>`).join('');
  table.innerHTML = `<table><thead><tr><th>Rank</th><th>Team</th><th>Players</th><th>Fantasy Points</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderPlayersTable() {
  const table = $('#playersTable');
  if (!table) return;
  const q = ($('#statsSearch')?.value || '').toLowerCase();
  const draftedIds = new Set(state.draftBoard.picks.map(p => String(p.player.id)));
  const rows = playerPool().filter(p => !q || p.name.toLowerCase().includes(q) || String(p.nhlTeam || '').toLowerCase().includes(q)).slice(0, 250).map(p => `
    <tr><td>${escapeHtml(p.name)}</td><td>${p.position || ''}</td><td>${p.nhlTeam || ''}</td><td>${p.gamesPlayed || 0}</td><td>${p.goals ?? ''}</td><td>${p.assists ?? ''}</td><td>${p.points ?? ''}</td><td>${p.goalieWins ?? ''}</td><td>${fantasyPoints(p, state.settings.scoring)}</td><td>${draftedIds.has(String(p.id)) ? '<span class="badge">Drafted</span>' : ''}</td></tr>`).join('');
  table.innerHTML = `<table><thead><tr><th>Player</th><th>Pos</th><th>NHL</th><th>GP</th><th>G</th><th>A</th><th>PTS</th><th>W</th><th>Pool Pts</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="10">No player stats loaded yet.</td></tr>'}</tbody></table>`;
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
