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
  $('#changeOldManBtn')?.addEventListener('click', openOldManModal);
  $('#closeOldManModal')?.addEventListener('click', closeOldManModal);
  $('#oldManModal')?.addEventListener('click', (e) => { if (e.target.id === 'oldManModal') closeOldManModal(); });
  $('#oldManOptions')?.addEventListener('click', (e) => {
    const btn = e.target.closest?.('[data-old-man]');
    if (btn) setActiveDraftOwner(btn.dataset.oldMan, true);
  });
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
  if (view === 'board') {
    const current = activeDraftOwner();
    if (!current) {
      draftRoomView = 'info';
      renderDraftRooms();
      openOldManModal();
      return;
    }
    draftRoomView = 'board';
  } else {
    draftRoomView = 'info';
  }
  renderDraftRooms();
  if (draftRoomView === 'board') setTimeout(() => $('#draftBoardPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

function openOldManModal() {
  const modal = $('#oldManModal');
  const wrap = $('#oldManOptions');
  if (!modal || !wrap) return;
  wrap.innerHTML = state.owners.map(owner => {
    const count = (state.rosters[owner.id] || []).length;
    const jersey = ownerLotteryLabel(owner);
    return `<button type="button" class="old-man-card ${jersey.jerseyClass || ''}" data-old-man="${escapeHtml(owner.id)}">
      <span class="mini-jersey"><strong>${escapeHtml(jersey.number)}</strong><em>${escapeHtml(jersey.jerseyName)}</em></span>
      <span><strong>${escapeHtml(owner.teamName)}</strong><small>${count} players drafted</small></span>
    </button>`;
  }).join('');
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
}

function closeOldManModal() {
  const modal = $('#oldManModal');
  modal?.classList.remove('show');
  modal?.setAttribute('aria-hidden', 'true');
}

function setActiveDraftOwner(ownerId, fromOldManModal = false) {
  const owner = state?.owners?.find(o => String(o.id) === String(ownerId));
  if (!owner) return toast('Choose one of the five old men first.');
  activeDraftOwnerId = String(owner.id);
  localStorage.setItem('custom-hockey-pool-active-owner', activeDraftOwnerId);
  draftRoomView = 'board';
  if (fromOldManModal) closeOldManModal();
  renderDraftRooms();
  renderDraftBoard();
  toast(`Entered the draft room as ${owner.teamName}.`);
}

function activeDraftOwner() {
  if (!state?.owners?.some(o => String(o.id) === String(activeDraftOwnerId))) {
    activeDraftOwnerId = '';
    localStorage.removeItem('custom-hockey-pool-active-owner');
  }
  return state?.owners?.find(o => String(o.id) === String(activeDraftOwnerId)) || null;
}

function renderDraftRooms() {
  $$('[data-draft-room]').forEach(btn => btn.classList.toggle('active', btn.dataset.draftRoom === draftRoomView));
  $('#draftInfoRoom')?.classList.toggle('active', draftRoomView === 'info');
  $('#draftBoardPanel')?.classList.toggle('active', draftRoomView === 'board');
  renderActiveDraftOwnerControls();
}

function renderActiveDraftOwnerControls() {
  const current = activeDraftOwner();
  const select = $('#activeDraftOwnerSelect');
  if (select) {
    select.innerHTML = `<option value="">Choose old man…</option>` + state.owners.map(o => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.teamName)}</option>`).join('');
    select.value = current ? current.id : '';
  }
  const label = $('#activeDraftOwnerLabel');
  if (label) label.textContent = current ? current.teamName : 'No old man selected';
  const board = $('#draftBoardTable');
  if (board && draftRoomView === 'board' && !current) {
    board.innerHTML = '<div class="empty-draft-board">Choose which old man you are first.</div>';
  }
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
  const draftButton = (p) => `<button type="button" class="draft-player-btn single-draft-btn contract-draft-btn" data-draft-player="${escapeHtml(String(p.id))}" ${current ? '' : 'disabled'} aria-label="Draft ${escapeHtml(p.name)}"><span class="contract-icon" aria-hidden="true"><i></i></span><span>Draft</span></button>`;
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
  const chosenText = current ? `Drafting for ${escapeHtml(current.teamName)}` : 'Choose which old man you are before drafting';
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
  if (!owner) { openOldManModal(); return toast('Which old man are you? Choose before drafting.'); }
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

function lotteryTargetLayout(ownerId) {
  const id = String(ownerId || '').toLowerCase();
  const base = {
    nick:   { x: 70, y: 60, activity: 'N64 controller locked in', prop: 'controller', pose: 'gaming' },
    chris:  { x: 39, y: 66, activity: 'checking the hockey pool book', prop: 'poolbook', pose: 'book' },
    andrew: { x: 21, y: 67, activity: 'guarding the pizza box', prop: 'pizza', pose: 'pizza' },
    tyler:  { x: 54, y: 70, activity: 'sorting player cards', prop: 'cards', pose: 'cards' },
    scott:  { x: 84, y: 58, activity: 'standing by the VHS stack', prop: 'pop', pose: 'vhs' }
  };
  return base[id] || { x: 50, y: 62, activity: 'basement target', prop: 'puck', pose: 'idle' };
}

function renderBasementTargets(orderIds = []) {
  const layer = $('#basementTargetLayer');
  if (!layer) return;
  const orderIndex = new Map(orderIds.map((id, index) => [String(id), index + 1]));
  layer.innerHTML = state.owners.map(owner => {
    const label = ownerLotteryLabel(owner);
    const layout = lotteryTargetLayout(owner.id);
    return `<div class="cartoon-owner ${label.jerseyClass || ''} pose-${layout.pose}" data-scene-owner="${escapeHtml(owner.id)}" style="--tx:${layout.x}%;--ty:${layout.y}%">
      <div class="activity-prop prop-${layout.prop}" aria-hidden="true"><span></span></div>
      <div class="cartoon-shadow"></div>
      <div class="cartoon-body">
        <div class="cartoon-head"><span class="cartoon-hair"></span><span class="cartoon-face"></span></div>
        <div class="cartoon-arm left"></div><div class="cartoon-arm right"></div>
        <div class="cartoon-jersey"><span class="jersey-badge"></span><strong>${escapeHtml(label.number)}</strong><em>${escapeHtml(label.jerseyName)}</em></div>
        <div class="cartoon-leg left"></div><div class="cartoon-leg right"></div>
      </div>
      <div class="target-nameplate"><strong>${escapeHtml(owner.teamName)}</strong><small>${escapeHtml(layout.activity)}</small></div>
      <div class="hit-stamp">PUCKED</div>
      ${orderIndex.has(String(owner.id)) ? `<div class="pick-bubble">${orderIndex.get(String(owner.id))}</div>` : ''}
    </div>`;
  }).join('');
}

function markEliminatedOnFolder(owner, pick, subtitle) {
  const list = $('#spyResultsList');
  if (!list || !owner) return;
  const label = ownerLotteryLabel(owner);
  list.insertAdjacentHTML('afterbegin', `<li><span>${pick}</span><strong>${escapeHtml(label.primary)}</strong><small>${escapeHtml(subtitle || label.secondary)}</small></li>`);
}

function ordinalLabel(n) {
  const value = Number(n);
  if (value === 1) return '1ST';
  if (value === 2) return '2ND';
  if (value === 3) return '3RD';
  return `${value}TH`;
}

function ownerShortName(owner) {
  return owner?.name || owner?.teamName || 'Unknown';
}

function storyboardSceneList(orderIds) {
  const owners = orderIds.map(id => state.owners.find(o => String(o.id) === String(id))).filter(Boolean);
  const winner = owners[0];
  const second = owners[1];
  const third = owners[2];
  const fourth = owners[3];
  const fifth = owners[4];
  const loserOrder = [fifth, fourth, third, second].filter(Boolean);
  const pickOf = owner => owner ? orderIds.indexOf(owner.id) + 1 : '';
  const nameOf = owner => ownerShortName(owner).toUpperCase();
  const teamOf = owner => (owner?.teamName || ownerShortName(owner)).toUpperCase();
  const base = [
    { panel: 1, time: '0:00', title: 'COMING DOWN THE STAIRS...', sub: 'The locked lottery cutscene begins in the 1998 basement.' },
    { panel: 2, time: '0:02', title: `${nameOf(winner)} ENTERS THE ROOM`, sub: 'First overall is the point of view character.' },
    { panel: 3, time: '0:04', title: 'TARGETS IDENTIFIED', sub: 'Pizza, pool books, player cards, VHS tapes, and bad decisions everywhere.' },
    { panel: 4, time: '0:07', title: `${nameOf(fifth)} — ${ordinalLabel(pickOf(fifth))} PICK`, sub: 'Last in the lottery order is marked first.' },
    { panel: 5, time: '0:09', title: `${nameOf(fourth)} — ${ordinalLabel(pickOf(fourth))} PICK`, sub: 'Still thinking there is time to hide by the CRT.' },
    { panel: 6, time: '0:12', title: `${nameOf(third)} — ${ordinalLabel(pickOf(third))} PICK`, sub: 'The N64 table is no longer safe.' },
    { panel: 7, time: '0:15', title: `${nameOf(second)} — ${ordinalLabel(pickOf(second))} PICK`, sub: 'The pizza box becomes part of the action sequence.' },
    { panel: 8, time: '0:17', title: 'ONE LOTTERY PUCK', sub: 'Loaded from the basement draft bag.' },
    { panel: 9, time: '0:18', title: `${nameOf(loserOrder[0])} TAKES IT`, sub: `Knocked out by puck. Locked to pick ${pickOf(loserOrder[0])}.` },
    { panel: 10, time: '0:20', title: `${nameOf(loserOrder[1])} GOES DOWN`, sub: `A tape-stack ricochet seals pick ${pickOf(loserOrder[1])}.` },
    { panel: 11, time: '0:22', title: `${nameOf(loserOrder[2])} IS OUT`, sub: `The basement claims another old man at pick ${pickOf(loserOrder[2])}.` },
    { panel: 12, time: '0:24', title: `${nameOf(loserOrder[3])} MEETS HIS MATCH`, sub: `The last puck hit locks pick ${pickOf(loserOrder[3])}.` },
    { panel: 13, time: '0:26', title: `ONE LEFT: ${nameOf(winner)}`, sub: 'No puck for first overall.' },
    { panel: 14, time: '0:28', title: 'THE ROOM IS SILENT', sub: 'Only the hum of the CRT remains.' },
    { panel: 15, time: '0:29', title: `${nameOf(second)} KNOWS`, sub: 'Second overall is good. First overall was better.' },
    { panel: 16, time: '0:30', title: 'NO ESCAPE', sub: 'The last ricochet echoes through the basement.' },
    { panel: 17, time: '0:31', title: 'GAME OVER', sub: 'Pizza is ruined. Draft order is almost official.' },
    { panel: 18, time: '0:33', title: `THE DRAFT IS ${nameOf(winner)}’S`, sub: `${teamOf(winner)} claims the first pick.` },
    { panel: 19, time: '0:34', title: 'CLASSIFIED FILE PRINTING', sub: 'The final folder is typed up in real time.' },
    { panel: 20, time: '0:35', title: 'DRAFT ORDER LOCKED IN', sub: 'Let the draft begin.' }
  ];
  return base.map(scene => ({
    ...scene,
    title: scene.title.replace(/UNDEFINED|null/gi, 'UNKNOWN')
  }));
}

function setStoryboardPanel(scene, index, total) {
  const cutscene = $('#storyboardCutscene');
  const panel = $('#storyboardPanel');
  const caption = $('#storyboardCaption');
  const subcaption = $('#storyboardSubcaption');
  const timecode = $('#storyboardTimecode');
  const progress = $('#storyboardProgress');
  if (!cutscene || !panel) return;
  const col = (scene.panel - 1) % 5;
  const row = Math.floor((scene.panel - 1) / 5);
  panel.style.setProperty('--story-x', `${col * 25}%`);
  panel.style.setProperty('--story-y', `${row * 33.333333}%`);
  panel.classList.remove('panel-pop');
  void panel.offsetWidth;
  panel.classList.add('panel-pop');
  if (caption) caption.textContent = scene.title;
  if (subcaption) subcaption.textContent = scene.sub;
  if (timecode) timecode.textContent = scene.time;
  if (progress) progress.style.width = `${Math.round(((index + 1) / total) * 100)}%`;
}

async 
async function playSpyLottery(orderIds) {
  const modal = $('#spyLotteryModal');
  const scope = $('#scopeView');
  const screen = modal?.querySelector('.spy-screen');
  if (!modal || !scope || !screen) return;

  const ownersById = new Map(state.owners.map(o => [String(o.id), o]));
  const orderedOwners = orderIds.map(id => ownersById.get(String(id))).filter(Boolean);
  const orderNames = orderedOwners.map(o => ownerShortName(o) || o.name || o.teamName || 'Owner');

  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lottery-running');
  screen.classList.add('broadcast-lottery-mode');

  let frame = $('#broadcastLotteryFrame');
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = 'broadcastLotteryFrame';
    frame.className = 'broadcast-lottery-frame';
    frame.setAttribute('title', 'Hockey Pool Draft Lottery Broadcast');
    frame.setAttribute('loading', 'eager');
    frame.setAttribute('allow', 'autoplay');
    scope.innerHTML = '';
    scope.appendChild(frame);
  }

  frame.srcdoc = buildBroadcastLotterySrcDoc(orderNames);
}

function buildBroadcastLotterySrcDoc(orderNames) {
  let doc = "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\"/>\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/>\n<title>Hockey Pool Draft Lottery Studio V6</title>\n<style>\n:root{\n  --gold:#f5c35b;\n  --red:#b4262d;\n  --blue:#0b2b5f;\n  --studio:#07152b;\n  --ice:#bfe4ff;\n}\n*{box-sizing:border-box}\nhtml,body{margin:0;min-height:100%;background:#01040a;color:#fff;font-family:Arial,Helvetica,sans-serif;overflow-x:hidden}\nbody:before{\n  content:\"\";position:fixed;inset:0;z-index:100;pointer-events:none;\n  background:\n    repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 5px),\n    radial-gradient(circle at 50% 0%, rgba(80,160,255,.12), transparent 50%);\n  mix-blend-mode:screen;\n}\n.wrap{max-width:1260px;margin:0 auto;padding:12px}\n.top{\n  display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;\n  padding:14px 16px;border:1px solid rgba(245,195,91,.35);border-radius:18px;\n  background:linear-gradient(135deg,#071b3a,#020712);\n  box-shadow:0 18px 55px rgba(0,0,0,.55), inset 0 0 30px rgba(245,195,91,.06);\n}\nh1{margin:0;font-family:Impact,Haettenschweiler,\"Arial Narrow Bold\",sans-serif;font-size:clamp(26px,5vw,56px);letter-spacing:.07em;text-shadow:0 4px 0 #000}\n.sub{color:#cbd7ea;line-height:1.35;margin-top:6px;font-size:14px;max-width:780px}\nbutton{\n  border:0;border-radius:999px;padding:13px 19px;cursor:pointer;color:#171006;\n  background:linear-gradient(#ffe8aa,#c98222);font-weight:900;letter-spacing:.08em;text-transform:uppercase;\n  box-shadow:0 5px 0 #693607,0 18px 30px rgba(0,0,0,.36);\n}\nbutton:active{transform:translateY(3px);box-shadow:0 2px 0 #693607}\n.clip{\n  position:relative;margin-top:14px;aspect-ratio:16/9;min-height:470px;overflow:hidden;border-radius:24px;\n  border:3px solid rgba(245,195,91,.36);background:#000;\n  box-shadow:0 30px 90px rgba(0,0,0,.75);\n}\n.clip.shake{animation:shake .45s linear}\n@keyframes shake{0%,100%{transform:translate(0)}20%{transform:translate(-5px,2px)}40%{transform:translate(6px,-2px)}60%{transform:translate(-3px,-3px)}80%{transform:translate(4px,2px)}}\n\n/* TV studio set */\n.studioBack{\n  position:absolute;inset:0;\n  background:\n    radial-gradient(circle at 50% 4%, rgba(255,255,255,.18), transparent 28%),\n    linear-gradient(180deg,#0c244a 0%,#061428 48%,#03070e 100%);\n}\n.wallPanels{\n  position:absolute;left:0;right:0;top:0;height:63%;\n  background:\n    linear-gradient(90deg, transparent 0 8%, rgba(255,255,255,.06) 8% 8.3%, transparent 8.3% 18%, rgba(255,255,255,.05) 18% 18.3%, transparent 18.3% 31%, rgba(255,255,255,.05) 31% 31.3%, transparent 31.3% 69%, rgba(255,255,255,.05) 69% 69.3%, transparent 69.3% 82%, rgba(255,255,255,.05) 82% 82.3%, transparent 82.3%),\n    linear-gradient(180deg,rgba(18,57,112,.95),rgba(5,14,30,.95));\n  border-bottom:4px solid rgba(210,230,255,.18);\n}\n.wallPanels:before{\n  content:\"\";position:absolute;inset:7% 29% 14%;\n  border:2px solid rgba(185,225,255,.24);border-radius:16px;\n  background:linear-gradient(135deg,rgba(20,68,134,.9),rgba(5,14,30,.9));\n  box-shadow:0 16px 55px rgba(0,0,0,.5), inset 0 0 30px rgba(255,255,255,.06);\n}\n.studioTruss{\n  position:absolute;left:0;right:0;top:0;height:42px;\n  background:\n    repeating-linear-gradient(45deg, transparent 0 18px, rgba(255,255,255,.12) 18px 20px),\n    linear-gradient(#111827,#02050a);\n  border-bottom:2px solid rgba(255,255,255,.15);\n}\n.light{position:absolute;top:16px;width:38px;height:54px;background:#111;border:2px solid #555;border-radius:6px;z-index:5}\n.light:after{content:\"\";position:absolute;left:50%;top:48px;width:210px;height:290px;transform:translateX(-50%);background:radial-gradient(ellipse at top,rgba(255,242,190,.24),transparent 70%);clip-path:polygon(45% 0,55% 0,100% 100%,0 100%);mix-blend-mode:screen}\n.light.a{left:18%}.light.b{left:47%}.light.c{right:18%}\n.floor{\n  position:absolute;left:-8%;right:-8%;bottom:-3%;height:43%;\n  background:\n    radial-gradient(ellipse at center top, rgba(190,230,255,.27), transparent 55%),\n    linear-gradient(180deg,rgba(65,100,145,.25),rgba(3,8,17,.97)),\n    repeating-linear-gradient(90deg,rgba(255,255,255,.045) 0 2px,transparent 2px 76px);\n  transform:perspective(750px) rotateX(58deg);transform-origin:bottom;\n  border-top:4px solid rgba(190,230,255,.24);\n}\n.centerScreen{\n  position:absolute;left:31%;right:31%;top:7%;height:20%;z-index:3;\n  border:3px solid rgba(205,230,255,.36);border-radius:16px;\n  background:linear-gradient(135deg,#133e7c,#06152e);\n  display:flex;flex-direction:column;align-items:center;justify-content:center;\n  box-shadow:0 12px 42px rgba(0,0,0,.6), inset 0 0 25px rgba(255,255,255,.08);\n}\n.centerScreen .draft{font-family:Impact;font-size:clamp(32px,5vw,74px);letter-spacing:.08em;line-height:.82}\n.centerScreen .lottery{font-family:Impact;font-size:clamp(12px,1.5vw,20px);letter-spacing:.35em;color:var(--gold);border-top:3px solid var(--red);padding-top:2px}\n.centerScreen .year{font-family:Impact;font-size:clamp(13px,1.8vw,25px);letter-spacing:.32em;color:#f04a4c}\n.sideScreen{\n  position:absolute;top:15%;width:21%;height:46%;z-index:4;\n  border:3px solid rgba(205,230,255,.32);border-radius:14px;background:linear-gradient(180deg,#0c284f,#030b18);\n  box-shadow:0 18px 45px rgba(0,0,0,.6), inset 0 0 20px rgba(255,255,255,.05);overflow:hidden;\n}\n.sideScreen.left{left:3%}\n.sideScreen h3{margin:0;padding:9px 10px;background:linear-gradient(90deg,#15417d,#061228);font-family:Impact;letter-spacing:.08em;font-size:clamp(12px,1.5vw,20px)}\n.boardRow{display:flex;align-items:center;gap:7px;padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.1);font-weight:900;font-size:clamp(11px,1.3vw,16px)}\n.boardRow .num{width:25px;height:25px;border-radius:5px;background:var(--gold);color:#160d04;display:grid;place-items:center;font-weight:1000}\n.boardRow.pending{opacity:.42}.boardRow.revealed{background:rgba(245,195,91,.12);opacity:1}\n\n/* manager seating replaces right reveal board */\n.managerBox{\n  position:absolute;right:3%;top:15%;width:25%;height:46%;z-index:4;\n  border:3px solid rgba(205,230,255,.32);border-radius:14px;\n  background:\n    radial-gradient(circle at 50% 0%, rgba(245,195,91,.12), transparent 45%),\n    linear-gradient(180deg,#102b52,#030b18);\n  box-shadow:0 18px 45px rgba(0,0,0,.6), inset 0 0 20px rgba(255,255,255,.05);\n  padding:10px 10px 14px;\n}\n.managerBox h3{margin:0 0 8px;padding:7px 8px;background:linear-gradient(90deg,#15417d,#061228);font-family:Impact;letter-spacing:.08em;font-size:clamp(12px,1.4vw,20px);border-radius:8px}\n.seats{\n  position:absolute;left:8px;right:8px;bottom:10px;top:49px;\n  display:grid;grid-template-columns:repeat(5,1fr);gap:5px;align-items:end;\n}\n.manager{\n  position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px;\n  opacity:.82;transition:.25s;\n}\n.manager.pulled{opacity:1;transform:translateY(-4px)}\n.manager .bubble{\n  position:absolute;bottom:78%;left:50%;transform:translateX(-50%) scale(.7);\n  background:#fff;color:#111;border:2px solid #111;border-radius:12px;\n  padding:4px 6px;font-weight:1000;font-size:clamp(9px,1.1vw,14px);\n  opacity:0;white-space:nowrap;z-index:10;box-shadow:0 8px 18px rgba(0,0,0,.35);\n}\n.manager .bubble:after{content:\"\";position:absolute;left:50%;bottom:-8px;transform:translateX(-50%);border:8px solid transparent;border-top-color:#fff}\n.manager.mad .bubble{animation:bubbleMad 1.7s ease-out}\n@keyframes bubbleMad{0%{opacity:0;transform:translateX(-50%) scale(.55)}18%,80%{opacity:1;transform:translateX(-50%) scale(1)}100%{opacity:0;transform:translateX(-50%) scale(.8)}}\n.manager .head{width:24px;height:24px;border-radius:50%;background:#d8a174;border:2px solid #221006;z-index:2}\n.manager .body{width:30px;height:45px;border-radius:11px 11px 5px 5px;background:linear-gradient(#1d5ba7,#092752);border:2px solid #041326;position:relative}\n.manager .body:before{content:\"\";position:absolute;left:5px;right:5px;top:9px;height:4px;background:#fff}\n.manager .chair{width:36px;height:36px;background:linear-gradient(#722b2e,#301115);border:2px solid rgba(255,255,255,.15);border-radius:8px 8px 2px 2px;box-shadow:0 8px 12px rgba(0,0,0,.35)}\n.manager .name{font-size:clamp(8px,1vw,12px);font-weight:1000;text-transform:uppercase;color:var(--gold);text-shadow:0 2px #000}\n.manager[data-owner=\"Andrew\"] .body{background:linear-gradient(#ea6b1a,#4a1207)}\n.manager[data-owner=\"Tyler\"] .body{background:linear-gradient(#2d78c8,#092752)}\n.manager[data-owner=\"Chris\"] .body{background:linear-gradient(#174f95,#061b3b)}\n.manager[data-owner=\"Scott\"] .body{background:linear-gradient(#3f89d9,#092752)}\n.manager[data-owner=\"Nick\"] .body{background:linear-gradient(#1f5faf,#061b3b)}\n\n/* sports news desk as huge foreground anchor object */\n.desk{\n  position:absolute;left:20%;right:20%;bottom:8%;height:31%;z-index:24;\n  border-radius:22px 22px 34px 34px;\n  background:\n    linear-gradient(180deg,rgba(255,255,255,.12),transparent 30%),\n    linear-gradient(90deg,#061225,#204979 48%,#061225);\n  border:4px solid rgba(205,230,255,.4);\n  box-shadow:0 34px 85px rgba(0,0,0,.8), inset 0 0 42px rgba(255,255,255,.08);\n}\n.desk:before{\n  content:\"\";position:absolute;left:4%;right:4%;top:8%;height:45%;\n  background:linear-gradient(90deg,#030a15,#173968,#030a15);\n  border:1px solid rgba(245,195,91,.28);border-radius:14px;\n}\n.deskLogo{\n  position:absolute;left:30%;right:30%;top:18%;height:38%;\n  background:linear-gradient(#e9edf4,#8997a6);color:#061225;border-radius:10px;\n  display:grid;place-items:center;font-family:Impact;font-size:clamp(14px,2.2vw,30px);letter-spacing:.09em;\n  box-shadow:inset 0 0 14px rgba(0,0,0,.18);\n}\n.deskTicker{\n  position:absolute;left:0;right:0;bottom:0;height:30%;\n  background:linear-gradient(90deg,#02050b,#112d58,#02050b);\n  border-radius:0 0 29px 29px;border-top:2px solid rgba(245,195,91,.32);\n  display:flex;align-items:center;justify-content:center;color:var(--gold);font-weight:900;letter-spacing:.18em;font-size:clamp(10px,1.3vw,16px);\n}\n\n/* half penguin / half man host */\n.penguinHost{\n  position:absolute;left:50%;bottom:27%;width:220px;height:295px;transform:translateX(-50%);z-index:22;\n  filter:drop-shadow(0 18px 22px rgba(0,0,0,.48));\n}\n.penguinHost.presenting{animation:hostBob 1.2s ease-in-out infinite alternate}\n@keyframes hostBob{from{transform:translateX(-50%) translateY(0)}to{transform:translateX(-50%) translateY(-5px)}}\n.penguinHead{transform-origin:110px 62px}\n.penguinHost.presenting .penguinHead{animation:headShake .42s ease-in-out infinite alternate}\n@keyframes headShake{from{transform:rotate(-4deg)}to{transform:rotate(4deg)}}\n.penguinHost .flipperR{transform-origin:143px 145px}\n.penguinHost.presenting .flipperR{animation:flipperWave .65s ease-in-out infinite alternate}\n@keyframes flipperWave{from{transform:rotate(0)}to{transform:rotate(-10deg)}}\n.penguinHost .flipperL{transform-origin:75px 145px}\n.penguinHost.presenting .flipperL{animation:flipperLeft .7s ease-in-out infinite alternate}\n@keyframes flipperLeft{from{transform:rotate(0)}to{transform:rotate(6deg)}}\n.penguinHost .mouthOpen{opacity:0}\n.penguinHost.presenting .mouthOpen{animation:talk .22s steps(2,end) infinite}\n.penguinHost.presenting .mouthLine{animation:talkLine .22s steps(2,end) infinite}\n@keyframes talk{0%,49%{opacity:0}50%,100%{opacity:1}}\n@keyframes talkLine{0%,49%{opacity:1}50%,100%{opacity:0}}\n\n.speech{\n  position:absolute;left:50%;top:26%;transform:translate(-10%,-100%);z-index:35;\n  background:#fff;color:#051225;border:4px solid #071225;border-radius:20px;\n  padding:12px 16px;font-weight:1000;font-family:Impact;letter-spacing:.04em;font-size:clamp(17px,2.4vw,32px);\n  box-shadow:0 15px 35px rgba(0,0,0,.35);\n  opacity:0;transition:.25s;\n}\n.speech.show{opacity:1;transform:translate(-10%,-108%)}\n.speech:after{\n  content:\"\";position:absolute;left:36px;bottom:-22px;border-width:20px 14px 0 0;border-style:solid;border-color:#fff transparent transparent transparent;\n  filter:drop-shadow(2px 3px 0 #071225);\n}\n\n/* integrated bingo/lottery machine with NUMBER balls */\n.lotteryStation{\n  position:absolute;left:8%;bottom:11%;width:245px;height:285px;z-index:26;\n}\n.pedestal{\n  position:absolute;left:32px;bottom:0;width:175px;height:95px;border-radius:12px 12px 20px 20px;\n  background:linear-gradient(#26384d,#08111e);border:3px solid rgba(210,230,255,.42);box-shadow:0 24px 50px rgba(0,0,0,.65);\n}\n.pedestal:after{content:\"BINGO MACHINE\";position:absolute;left:10%;right:10%;top:20%;text-align:center;color:var(--gold);font-family:Impact;letter-spacing:.1em}\n.globe{\n  position:absolute;left:27px;top:0;width:180px;height:180px;border-radius:50%;overflow:hidden;\n  border:6px solid rgba(225,240,255,.72);\n  background:radial-gradient(circle at 35% 28%,rgba(255,255,255,.5),rgba(100,180,240,.26) 34%,rgba(12,42,88,.64) 76%);\n  box-shadow:inset 0 0 36px rgba(255,255,255,.15),0 14px 42px rgba(0,0,0,.62);\n}\n.globe.spin{animation:globeSpin .7s linear infinite}\n@keyframes globeSpin{to{transform:rotate(360deg)}}\n.ball{\n  position:absolute;width:35px;height:35px;border-radius:50%;\n  background:radial-gradient(circle at 35% 30%,#fff,#f6d267 38%,#b17413);\n  display:grid;place-items:center;color:#0f0902;font-weight:1000;font-size:16px;border:1px solid rgba(0,0,0,.35);box-shadow:0 6px 12px rgba(0,0,0,.34);\n}\n.b1{left:34px;top:31px}.b2{left:88px;top:55px}.b3{left:128px;top:27px}.b4{left:52px;top:115px}.b5{left:123px;top:115px}\n.globe.spin .ball{animation:ballBounce .62s ease-in-out infinite alternate}\n.globe.spin .b2{animation-delay:.11s}.globe.spin .b3{animation-delay:.22s}.globe.spin .b4{animation-delay:.33s}.globe.spin .b5{animation-delay:.44s}\n@keyframes ballBounce{from{transform:translate(0,0)}to{transform:translate(25px,-20px)}}\n.chute{position:absolute;right:0;top:94px;width:80px;height:28px;border-radius:20px;background:linear-gradient(#e8eef7,#7e8997);border:2px solid #e5f3ff;transform:rotate(-12deg)}\n\n.revealMonitor{\n  position:absolute;right:29%;bottom:10%;width:230px;height:150px;z-index:27;\n  background:linear-gradient(180deg,#102a50,#040b17);\n  border:4px solid rgba(210,230,255,.42);border-radius:16px;\n  box-shadow:0 28px 62px rgba(0,0,0,.75), inset 0 0 28px rgba(255,255,255,.07);\n  padding:12px;\n}\n.revealMonitor:before{\n  content:\"REVEAL CARD\";position:absolute;left:12px;right:12px;top:8px;text-align:center;\n  color:#b9d9ff;font-weight:900;font-size:10px;letter-spacing:.16em;\n}\n.card{\n  position:absolute;left:14px;right:14px;top:34px;bottom:12px;border-radius:8px;background:linear-gradient(#fff1c7,#d7b775);\n  border:3px solid #6c3d10;box-shadow:0 12px 32px rgba(0,0,0,.45);color:#1b1006;\n  display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;transform:rotateX(86deg) translateY(35px);\n  font-family:Impact,Haettenschweiler,\"Arial Narrow Bold\";text-align:center;\n}\n.card.show{animation:cardFlip .8s cubic-bezier(.15,.8,.16,1) forwards}\n@keyframes cardFlip{to{opacity:1;transform:rotateX(0) translateY(0)}}\n.card .pick{font-size:clamp(16px,1.8vw,24px);color:#9e271f;letter-spacing:.08em}\n.card .owner{font-size:clamp(28px,3.5vw,46px);letter-spacing:.04em;margin-top:3px}\n.card:after{content:\"SEALED\";position:absolute;right:7px;top:6px;color:#9e271f;border:2px solid #9e271f;border-radius:4px;padding:1px 5px;font:900 9px Arial;transform:rotate(7deg)}\n\n.lowerThird{\n  position:absolute;left:0;right:0;bottom:0;z-index:40;min-height:62px;padding:12px 20px;\n  background:linear-gradient(90deg,rgba(0,0,0,.94),rgba(5,13,28,.88),rgba(0,0,0,.94));\n  border-top:2px solid rgba(245,195,91,.28);\n  font-family:\"Courier New\",monospace;font-weight:900;letter-spacing:.08em;text-align:center;font-size:clamp(14px,2.3vw,30px);\n}\n.lowerThird span{color:var(--gold)}\n.podium{\n  position:absolute;left:25%;right:25%;bottom:5.5%;height:58px;z-index:38;display:flex;align-items:end;justify-content:center;gap:7px;pointer-events:none;\n}\n.slot{width:19%;min-width:68px;background:linear-gradient(#163764,#06152a);border:2px solid rgba(245,195,91,.38);border-radius:8px 8px 0 0;padding:6px 4px;text-align:center;opacity:0;transform:translateY(90px);box-shadow:0 12px 25px rgba(0,0,0,.45)}\n.slot.show{animation:slotIn .55s ease-out forwards}\n@keyframes slotIn{to{opacity:1;transform:translateY(0)}}\n.slot .num{color:var(--gold);font-weight:1000;font-size:11px;letter-spacing:.1em}.slot .name{font-family:Impact;font-size:clamp(13px,1.8vw,23px);letter-spacing:.04em}\n.final{\n  position:absolute;inset:9% 13%;z-index:60;opacity:0;transform:scale(.88);\n  background:linear-gradient(135deg,rgba(255,255,255,.12),transparent 25%),linear-gradient(#102c58,#041226);\n  border:3px solid rgba(245,195,91,.55);border-radius:18px;padding:clamp(18px,3vw,42px);\n  box-shadow:0 30px 110px rgba(0,0,0,.8), inset 0 0 34px rgba(255,255,255,.08);\n}\n.final.show{animation:finalIn .75s ease-out forwards}\n@keyframes finalIn{to{opacity:1;transform:scale(1)}}\n.final h2{margin:0 0 14px;font-family:Impact;font-size:clamp(28px,5vw,64px);letter-spacing:.08em;text-align:center}\n.finalGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}\n.finalRow{display:flex;align-items:center;gap:12px;background:rgba(0,0,0,.35);border:1px solid rgba(245,195,91,.25);border-radius:10px;padding:10px}\n.finalRow .n{width:42px;height:42px;border-radius:8px;background:var(--gold);color:#171006;display:grid;place-items:center;font-weight:1000;font-size:22px}\n.finalRow .nm{font-family:Impact;font-size:clamp(22px,3.5vw,46px);letter-spacing:.05em}\n.progress{position:absolute;left:0;bottom:0;height:5px;background:linear-gradient(90deg,var(--gold),var(--red));width:0%;z-index:70}\n.note{color:#c8d4e6;font-size:14px;line-height:1.45;margin:12px 2px 0}\n\n@media(max-width:900px){\n  .wrap{padding:8px}.clip{min-height:650px;border-radius:16px}\n  .centerScreen{left:18%;right:18%;top:5%;height:13%}\n  .sideScreen{top:20%;height:31%;width:23%}.sideScreen.left{left:1%}\n  .managerBox{right:1%;top:20%;height:31%;width:31%;padding:6px}\n  .managerBox h3{font-size:11px;padding:5px}\n  .seats{top:38px;gap:2px}\n  .manager .head{width:16px;height:16px}.manager .body{width:20px;height:30px}.manager .chair{width:24px;height:25px}.manager .name{font-size:7px}\n  .manager .bubble{font-size:8px}\n  .lotteryStation{left:0;bottom:23%;transform:scale(.58);transform-origin:left bottom}\n  .penguinHost{bottom:31%;width:155px;height:210px}\n  .speech{top:27%;font-size:15px;padding:8px 10px}\n  .desk{left:21%;right:21%;bottom:23%;height:15%}.deskTicker{display:none}\n  .revealMonitor{right:28%;bottom:23%;transform:scale(.65);transform-origin:right bottom}\n  .podium{left:2%;right:2%;bottom:7%;gap:4px}\n  .slot{min-width:57px;padding:5px 2px}.slot .name{font-size:13px}.slot .num{font-size:10px}\n  .final{inset:7% 4%}.finalGrid{grid-template-columns:1fr}.lowerThird{font-size:14px}\n}\n\n/* Embedded-in-site mode */\n.top{display:none!important}\n.wrap{max-width:none!important;width:100%!important;height:100vh!important;padding:0!important}\n.clip{margin:0!important;border-radius:0!important;border:0!important;min-height:100vh!important;height:100vh!important;aspect-ratio:auto!important}\n.note{display:none!important}\nbody{overflow:hidden!important}\n</style>\n</head>\n<body>\n<div class=\"wrap\">\n  <div class=\"top\">\n    <div>\n      <h1>Studio Lottery V6</h1>\n      <div class=\"sub\">Head-shaking half-penguin announcer with grey hair, numbered bingo balls, and a manager seating area where owners curse when their pick is revealed.</div>\n    </div>\n    <button id=\"playBtn\">Play Clip</button>\n  </div>\n\n  <div class=\"clip\" id=\"clip\">\n    <div class=\"studioBack\"></div>\n    <div class=\"wallPanels\"></div>\n    <div class=\"studioTruss\"></div>\n    <div class=\"light a\"></div><div class=\"light b\"></div><div class=\"light c\"></div>\n    <div class=\"floor\"></div>\n\n    <div class=\"centerScreen\">\n      <div class=\"year\">2026</div>\n      <div class=\"draft\">DRAFT</div>\n      <div class=\"lottery\">LOTTERY</div>\n    </div>\n\n    <div class=\"sideScreen left\"><h3>DRAFT ORDER</h3><div id=\"leftBoard\"></div></div>\n\n    <div class=\"managerBox\">\n      <h3>MANAGER SEATING</h3>\n      <div class=\"seats\" id=\"seats\">\n        <div class=\"manager\" data-owner=\"Nick\"><div class=\"bubble\">#@!*%</div><div class=\"head\"></div><div class=\"body\"></div><div class=\"chair\"></div><div class=\"name\">Nick</div></div>\n        <div class=\"manager\" data-owner=\"Chris\"><div class=\"bubble\">%$#@!</div><div class=\"head\"></div><div class=\"body\"></div><div class=\"chair\"></div><div class=\"name\">Chris</div></div>\n        <div class=\"manager\" data-owner=\"Andrew\"><div class=\"bubble\">*&@#!!</div><div class=\"head\"></div><div class=\"body\"></div><div class=\"chair\"></div><div class=\"name\">Andrew</div></div>\n        <div class=\"manager\" data-owner=\"Tyler\"><div class=\"bubble\">@!$%?</div><div class=\"head\"></div><div class=\"body\"></div><div class=\"chair\"></div><div class=\"name\">Tyler</div></div>\n        <div class=\"manager\" data-owner=\"Scott\"><div class=\"bubble\">#%&*@</div><div class=\"head\"></div><div class=\"body\"></div><div class=\"chair\"></div><div class=\"name\">Scott</div></div>\n      </div>\n    </div>\n\n    <div class=\"lotteryStation\">\n      <div class=\"globe\" id=\"globe\">\n        <div class=\"ball b1\">1</div><div class=\"ball b2\">2</div><div class=\"ball b3\">3</div><div class=\"ball b4\">4</div><div class=\"ball b5\">5</div>\n      </div>\n      <div class=\"chute\"></div><div class=\"pedestal\"></div>\n    </div>\n\n    <div class=\"speech\" id=\"speech\">I'M GARY BETTMAN</div>\n\n    <svg class=\"penguinHost\" id=\"host\" viewBox=\"0 0 220 295\" role=\"img\" aria-label=\"half penguin half man announcer\">\n      <defs>\n        <linearGradient id=\"skin\" x1=\"0\" x2=\"0\" y1=\"0\" y2=\"1\">\n          <stop offset=\"0\" stop-color=\"#efc19a\"/>\n          <stop offset=\"1\" stop-color=\"#c9855d\"/>\n        </linearGradient>\n        <linearGradient id=\"suit\" x1=\"0\" x2=\"1\">\n          <stop offset=\"0\" stop-color=\"#0a2654\"/>\n          <stop offset=\".5\" stop-color=\"#2a65ad\"/>\n          <stop offset=\"1\" stop-color=\"#061b3c\"/>\n        </linearGradient>\n      </defs>\n\n      <!-- penguin lower body / arms -->\n      <ellipse cx=\"110\" cy=\"174\" rx=\"58\" ry=\"92\" fill=\"#070b10\" stroke=\"#020407\" stroke-width=\"4\"/>\n      <ellipse cx=\"110\" cy=\"183\" rx=\"34\" ry=\"67\" fill=\"#eef3f7\"/>\n      <g class=\"flipperL\">\n        <path d=\"M62 122 C40 142 32 180 42 215 C48 236 76 229 70 207 C64 183 70 157 88 140 Z\" fill=\"#070b10\" stroke=\"#020407\" stroke-width=\"3\"/>\n      </g>\n      <g class=\"flipperR\">\n        <path d=\"M158 123 C181 141 190 169 181 199 C176 216 151 211 155 194 C160 174 154 153 134 140 Z\" fill=\"#070b10\" stroke=\"#020407\" stroke-width=\"3\"/>\n      </g>\n\n      <!-- business jacket over penguin body -->\n      <path d=\"M63 119 C76 93 91 86 110 86 C130 86 145 94 158 119 L148 205 C132 218 88 218 72 205 Z\" fill=\"url(#suit)\" opacity=\".92\" stroke=\"#03142c\" stroke-width=\"3\"/>\n      <path d=\"M88 92 L132 92 L124 196 C114 203 104 203 96 196 Z\" fill=\"#f3f7fb\"/>\n      <path d=\"M110 98 L122 116 L116 190 L103 190 L98 116 Z\" fill=\"#123158\"/>\n      <path d=\"M110 98 L99 116 L110 124 L121 116 Z\" fill=\"#4c6d9a\"/>\n      <path d=\"M70 113 C85 130 91 154 95 202 C77 184 68 146 65 121 Z\" fill=\"#071d42\" opacity=\".9\"/>\n      <path d=\"M150 113 C135 130 129 154 125 202 C143 184 152 146 155 121 Z\" fill=\"#071d42\" opacity=\".9\"/>\n\n      <!-- tiny hands/mic attached to flippers -->\n      <path d=\"M62 187 C72 181 84 188 82 199 C80 211 64 213 58 203 C54 197 56 191 62 187 Z\" fill=\"url(#skin)\" stroke=\"#4a2112\" stroke-width=\"2\"/>\n      <g transform=\"translate(55 135) rotate(-10)\">\n        <rect x=\"0\" y=\"18\" width=\"17\" height=\"62\" rx=\"8\" fill=\"#090909\"/>\n        <ellipse cx=\"8.5\" cy=\"16\" rx=\"16\" ry=\"12\" fill=\"#111\" stroke=\"#555\" stroke-width=\"2\"/>\n        <rect x=\"-8\" y=\"34\" width=\"34\" height=\"21\" rx=\"3\" fill=\"#edf2f7\" stroke=\"#222\" stroke-width=\"1\"/>\n        <text x=\"9\" y=\"49\" text-anchor=\"middle\" font-family=\"Impact\" font-size=\"12\" fill=\"#081326\">HP</text>\n      </g>\n      <path d=\"M151 185 C162 180 173 187 171 199 C169 211 153 213 147 203 C143 196 145 189 151 185 Z\" fill=\"url(#skin)\" stroke=\"#4a2112\" stroke-width=\"2\"/>\n\n      <g class=\"penguinHead\">\n        <!-- head, grey hair, penguin-ish black cap -->\n        <path d=\"M67 45 C70 17 87 5 110 5 C136 5 153 21 151 50 C149 80 133 97 111 98 C88 99 69 80 67 45 Z\" fill=\"url(#skin)\" stroke=\"#3b1b0f\" stroke-width=\"3\"/>\n        <path d=\"M76 18 C86 6 103 0 121 7 C137 13 146 26 148 43 C128 33 91 32 72 43 C72 33 73 25 76 18 Z\" fill=\"#5e6873\"/>\n        <path d=\"M70 43 C62 47 62 67 72 66\" fill=\"none\" stroke=\"#c9d0d8\" stroke-width=\"8\" stroke-linecap=\"round\"/>\n        <path d=\"M149 44 C158 50 155 68 145 67\" fill=\"none\" stroke=\"#c9d0d8\" stroke-width=\"8\" stroke-linecap=\"round\"/>\n        <path d=\"M86 21 C98 12 123 13 135 24\" fill=\"none\" stroke=\"#dce1e7\" stroke-width=\"4\" stroke-linecap=\"round\" opacity=\".9\"/>\n        <path d=\"M87 45 C94 41 101 41 106 45\" stroke=\"#4c392a\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/>\n        <path d=\"M116 45 C123 41 130 42 135 46\" stroke=\"#4c392a\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/>\n        <ellipse cx=\"96\" cy=\"55\" rx=\"3.5\" ry=\"3\" fill=\"#0b0b0b\"/>\n        <ellipse cx=\"125\" cy=\"55\" rx=\"3.5\" ry=\"3\" fill=\"#0b0b0b\"/>\n        <path d=\"M111 55 C108 63 108 68 116 70\" fill=\"none\" stroke=\"#8d5439\" stroke-width=\"2\" stroke-linecap=\"round\"/>\n        <path class=\"mouthLine\" d=\"M98 81 C106 85 118 85 126 81\" fill=\"none\" stroke=\"#5a2417\" stroke-width=\"3\" stroke-linecap=\"round\"/>\n        <ellipse class=\"mouthOpen\" cx=\"112\" cy=\"82\" rx=\"13\" ry=\"5\" fill=\"#3b130d\"/>\n        <path d=\"M108 66 L123 70 L110 73 Z\" fill=\"#e7a33c\" opacity=\".35\"/>\n      </g>\n\n      <path d=\"M73 258 C88 251 99 256 102 270 C86 275 72 274 59 268 C60 263 65 260 73 258 Z\" fill=\"#e8a133\" stroke=\"#5a2e07\" stroke-width=\"2\"/>\n      <path d=\"M145 258 C130 251 119 256 116 270 C132 275 146 274 159 268 C158 263 153 260 145 258 Z\" fill=\"#e8a133\" stroke=\"#5a2e07\" stroke-width=\"2\"/>\n    </svg>\n\n    <div class=\"desk\">\n      <div class=\"deskLogo\">HOCKEY POOL</div>\n      <div class=\"deskTicker\">OFFICIAL DRAFT LOTTERY BROADCAST</div>\n    </div>\n\n    <div class=\"revealMonitor\"><div class=\"card\" id=\"card\"><div class=\"pick\"></div><div class=\"owner\"></div></div></div>\n\n    <div class=\"podium\" id=\"podium\"></div>\n    <div class=\"lowerThird\" id=\"lowerThird\">WELCOME TO THE <span>HOCKEY POOL DRAFT LOTTERY</span></div>\n\n    <div class=\"final\" id=\"final\">\n      <h2>DRAFT ORDER LOCKED IN</h2>\n      <div class=\"finalGrid\" id=\"finalGrid\"></div>\n    </div>\n\n    <div class=\"progress\" id=\"progress\"></div>\n  </div>\n\n  <p class=\"note\">When a manager\u2019s name is pulled, his seat reacts with a censored angry speech bubble. Picks still reveal from 5th to 1st.</p>\n</div>\n\n<script>\nconst order = __ORDER_JSON__;\nconst playBtn = document.getElementById(\"playBtn\");\nconst clip = document.getElementById(\"clip\");\nconst globe = document.getElementById(\"globe\");\nconst card = document.getElementById(\"card\");\nconst host = document.getElementById(\"host\");\nconst speech = document.getElementById(\"speech\");\nconst lowerThird = document.getElementById(\"lowerThird\");\nconst podium = document.getElementById(\"podium\");\nconst final = document.getElementById(\"final\");\nconst finalGrid = document.getElementById(\"finalGrid\");\nconst progress = document.getElementById(\"progress\");\nconst leftBoard = document.getElementById(\"leftBoard\");\n\nfunction suffix(n){return n===1?\"ST\":n===2?\"ND\":n===3?\"RD\":\"TH\"}\nfunction sleep(ms){return new Promise(r=>setTimeout(r,ms))}\nfunction buildBoards(){\n  leftBoard.innerHTML = \"\";\n  for(let i=1;i<=5;i++){\n    leftBoard.insertAdjacentHTML(\"beforeend\", `<div class=\"boardRow pending\" data-pick=\"${i}\"><div class=\"num\">${i}</div><div>---</div></div>`);\n  }\n  document.querySelectorAll(\".manager\").forEach(m=>m.classList.remove(\"mad\",\"pulled\"));\n}\nfunction lower(text, highlight=\"\"){\n  lowerThird.innerHTML = highlight ? `${text} <span>${highlight}</span>` : text;\n}\nfunction managerReact(name){\n  const el = document.querySelector(`.manager[data-owner=\"${name}\"]`);\n  if(!el) return;\n  el.classList.remove(\"mad\");\n  void el.offsetWidth;\n  el.classList.add(\"mad\",\"pulled\");\n}\nasync function revealPick(pickNumber, name){\n  lower(`THE ${pickNumber}${suffix(pickNumber)} OVERALL PICK GOES TO`, name.toUpperCase());\n  globe.classList.add(\"spin\");\n  host.classList.add(\"presenting\");\n  await sleep(1200);\n  globe.classList.remove(\"spin\");\n  clip.classList.add(\"shake\");\n  setTimeout(()=>clip.classList.remove(\"shake\"), 500);\n\n  card.classList.remove(\"show\");\n  void card.offsetWidth;\n  card.querySelector(\".pick\").textContent = `${pickNumber}${suffix(pickNumber)} OVERALL`;\n  card.querySelector(\".owner\").textContent = name;\n  card.classList.add(\"show\");\n  managerReact(name);\n\n  document.querySelectorAll(`[data-pick=\"${pickNumber}\"]`).forEach(el=>{\n    el.classList.remove(\"pending\"); el.classList.add(\"revealed\");\n    el.innerHTML = `<div class=\"num\">${pickNumber}</div><div>${name.toUpperCase()}</div>`;\n  });\n\n  const slot = document.createElement(\"div\");\n  slot.className = \"slot\";\n  slot.innerHTML = `<div class=\"num\">${pickNumber}${suffix(pickNumber)}</div><div class=\"name\">${name}</div>`;\n  podium.prepend(slot);\n  await sleep(60);\n  slot.classList.add(\"show\");\n  await sleep(1750);\n}\nasync function play(){\n  playBtn.disabled = true;\n  playBtn.textContent = \"Playing...\";\n  buildBoards();\n  podium.innerHTML = \"\";\n  final.classList.remove(\"show\");\n  card.classList.remove(\"show\");\n  speech.classList.remove(\"show\");\n  progress.style.transition = \"none\";\n  progress.style.width = \"0%\";\n  await sleep(60);\n  progress.style.transition = \"width 25s linear\";\n  progress.style.width = \"100%\";\n\n  lower(\"GOOD EVENING. TONIGHT WE DETERMINE THE FIRST FIVE SELECTIONS.\", \"\");\n  host.classList.add(\"presenting\");\n  speech.classList.add(\"show\");\n  await sleep(2600);\n  speech.classList.remove(\"show\");\n  lower(\"ALL FIVE OWNERS HAVE\", \"EQUAL ODDS\");\n  globe.classList.add(\"spin\");\n  await sleep(2200);\n  globe.classList.remove(\"spin\");\n  lower(\"THE BINGO MACHINE IS LOADED WITH NUMBERED BALLS. WE BEGIN WITH\", \"THE 5TH PICK\");\n  await sleep(1900);\n\n  const revealOrder = [...order].reverse();\n  for(let i=0;i<revealOrder.length;i++){\n    await revealPick(5-i, revealOrder[i]);\n  }\n\n  lower(\"THAT CONCLUDES THE HOCKEY POOL DRAFT LOTTERY.\", \"GOOD LUCK.\");\n  finalGrid.innerHTML = order.map((n,i)=>`<div class=\"finalRow\"><div class=\"n\">${i+1}</div><div class=\"nm\">${n}</div></div>`).join(\"\");\n  final.classList.add(\"show\");\n  await sleep(3600);\n  playBtn.disabled = false;\n  playBtn.textContent = \"Replay Clip\";\n}\nplayBtn.addEventListener(\"click\", play); window.addEventListener(\"load\", () => setTimeout(() => playBtn.click(), 350));\n</script>\n</body>\n</html>\n";
  doc = doc.replace('__ORDER_JSON__', JSON.stringify(orderNames && orderNames.length ? orderNames : ['Nick','Chris','Andrew','Tyler','Scott']));
  return doc;
}

function ensureMotionCutsceneElements(scope) {
  if (!scope) return;
  if (!scope.querySelector('.motion-basement')) {
    const basement = document.createElement('div');
    basement.className = 'motion-basement';
    basement.innerHTML = `
      <div class="motion-item motion-stairs"></div>
      <div class="motion-item motion-tv"></div>
      <div class="motion-item motion-n64"></div>
      <div class="motion-item motion-couch"></div>
      <div class="motion-item motion-table"></div>
      <div class="motion-item motion-pizza"></div>
      <div class="motion-item motion-posters"></div>
      <div class="motion-item motion-hockey-sticks"><span></span></div>
    `;
    scope.insertBefore(basement, scope.firstChild);
  }
  if (!scope.querySelector('.motion-caption')) {
    const caption = document.createElement('div');
    caption.className = 'motion-caption';
    caption.innerHTML = '<span id="motionTimecode">0:00</span><strong id="motionTitle">CUTSCENE LOADING</strong><small id="motionSub">Basement draft ops coming online.</small>';
    scope.appendChild(caption);
  }
  if (!scope.querySelector('.motion-impact-flash')) {
    const flash = document.createElement('div');
    flash.className = 'motion-impact-flash';
    scope.appendChild(flash);
  }
  if (!scope.querySelector('.motion-speed-lines')) {
    const speed = document.createElement('div');
    speed.className = 'motion-speed-lines';
    scope.appendChild(speed);
  }
  if (!scope.querySelector('.motion-pick-label')) {
    const pick = document.createElement('div');
    pick.className = 'motion-pick-label';
    pick.id = 'motionPickLabel';
    pick.textContent = 'LOTTERY';
    scope.appendChild(pick);
  }
}

function setMotionCaption(time, title, sub) {
  const t = $('#motionTimecode');
  const h = $('#motionTitle');
  const s = $('#motionSub');
  if (t) t.textContent = time;
  if (h) h.textContent = title;
  if (s) s.textContent = sub;
}

function setMotionCamera(scope, panX, panY, zoom, origin) {
  scope.style.setProperty('--motion-pan-x', panX);
  scope.style.setProperty('--motion-pan-y', panY);
  scope.style.setProperty('--motion-zoom', zoom);
  scope.style.setProperty('--motion-origin', origin || '50% 50%');
}

function resetMotionCamera(scope) {
  setMotionCamera(scope, '0', '0', 1, '50% 50%');
}

function panForTarget(x, y) {
  const px = Math.max(-28, Math.min(22, 50 - Number(x))) * 0.55;
  const py = Math.max(-18, Math.min(18, 52 - Number(y))) * 0.38;
  return { x: `${px}%`, y: `${py}%` };
}

function elementCenterPercent(container, element) {
  const c = container.getBoundingClientRect();
  const r = element.getBoundingClientRect();
  return {
    x: `${((r.left + r.width / 2 - c.left) / c.width) * 100}%`,
    y: `${((r.top + r.height / 2 - c.top) / c.height) * 100}%`
  };
}

async function launchCinematicPuck(scope, winnerEl, targetEl) {
  const puck = $('#flyingPuck');
  const flash = scope.querySelector('.motion-impact-flash');
  if (!puck || !targetEl) return;
  const start = winnerEl ? elementCenterPercent(scope, winnerEl) : { x: '12%', y: '78%' };
  const end = elementCenterPercent(scope, targetEl);
  puck.style.setProperty('--puck-start-x', start.x);
  puck.style.setProperty('--puck-start-y', start.y);
  puck.style.setProperty('--puck-end-x', end.x);
  puck.style.setProperty('--puck-end-y', end.y);
  flash?.style.setProperty('--hit-x', end.x);
  flash?.style.setProperty('--hit-y', end.y);
  puck.classList.remove('launch');
  void puck.offsetWidth;
  flashSpeedLines();
  puck.classList.add('launch');
  await sleep(560);
  scope.classList.add('scope-shake');
  flash?.classList.remove('flash');
  void flash?.offsetWidth;
  flash?.classList.add('flash');
  await sleep(520);
  scope.classList.remove('scope-shake');
}

function showMotionPickLabel(text) {
  const el = $('#motionPickLabel');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

function flashSpeedLines() {
  const el = document.querySelector('.motion-speed-lines');
  if (!el) return;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

function closeSpyLottery() {
  const modal = $('#spyLotteryModal');
  const scope = $('#scopeView');
  const screen = document.querySelector('.spy-screen');
  const folder = $('#classifiedFolder');
  modal?.classList.remove('show');
  modal?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('lottery-running');
  screen?.classList.remove('broadcast-lottery-mode');
  const frame = $('#broadcastLotteryFrame');
  if (frame) frame.srcdoc = '';
  scope?.classList.remove('storyboard-mode', 'motion-mode', 'scope-hit', 'scope-locking', 'scope-shake');
  $('#storyboardCutscene')?.classList.remove('show');
  if (folder && screen && folder.parentElement !== screen) {
    screen.appendChild(folder);
  }
  folder?.classList.remove('in-scene-folder');
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
