import { currentSeasonId, fetchNhlStats } from './nhl-api.js';
import { fantasyPoints, ownerTotal } from './scoring.js';

const STORAGE_KEY = 'custom-hockey-pool-v29-inline-lottery';
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


function forceFinalOwners() {
  if (!state) return;
  state.owners = Array.isArray(state.owners) ? state.owners : [];
  FINAL_OWNERS.forEach(owner => {
    if (!state.owners.some(o => String(o.id) === String(owner.id))) {
      state.owners.push(structuredClone(owner));
    }
  });
  if (!state.owners.length) state.owners = structuredClone(FINAL_OWNERS);
  state.rosters = state.rosters || {};
  state.owners.forEach(owner => {
    if (!Array.isArray(state.rosters[owner.id])) state.rosters[owner.id] = [];
  });
  state.draftBoard = state.draftBoard || {};
  state.draftBoard.picks = Array.isArray(state.draftBoard.picks) ? state.draftBoard.picks : [];
  state.draftBoard.draftOrder = Array.isArray(state.draftBoard.draftOrder) && state.draftBoard.draftOrder.length
    ? state.draftBoard.draftOrder
    : FINAL_OWNERS.map(o => o.id);
  state.owners.forEach(owner => {
    if (!state.draftBoard.draftOrder.some(id => String(id) === String(owner.id))) {
      state.draftBoard.draftOrder.push(owner.id);
    }
  });
}

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
  try {
    state = saved ? deepMerge(structuredClone(defaults), JSON.parse(saved)) : structuredClone(defaults);
  } catch (err) {
    console.warn('Saved state was incompatible. Starting clean.', err);
    localStorage.removeItem(STORAGE_KEY);
    state = structuredClone(defaults);
  }
  normalizeStateForDraftTesting();
  forceFinalOwners();
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
  forceFinalOwners();
  if (view === 'board') {
    let current = activeDraftOwner();
    if (!current) {
      const fallbackOwner = state.owners[0] || FINAL_OWNERS[0];
      activeDraftOwnerId = String(fallbackOwner.id);
      localStorage.setItem('custom-hockey-pool-active-owner', activeDraftOwnerId);
      current = fallbackOwner;
      toast(`Entered the draft room as ${fallbackOwner.teamName}. Use the selector to switch old men.`);
    }
    draftRoomView = 'board';
  } else {
    draftRoomView = 'info';
  }
  renderDraftRooms();
  renderDraftBoard();
  if (draftRoomView === 'board') {
    ensureRealNhlPlayersForDraft();
    setTimeout(() => $('#draftBoardPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }
}

function openOldManModal() {
  forceFinalOwners();
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
  forceFinalOwners();
  let current = activeDraftOwner();
  if (draftRoomView === 'board' && !current && state.owners.length) {
    activeDraftOwnerId = String(state.owners[0].id);
    localStorage.setItem('custom-hockey-pool-active-owner', activeDraftOwnerId);
    current = state.owners[0];
  }
  const select = $('#activeDraftOwnerSelect');
  if (select) {
    select.innerHTML = state.owners.map(o => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.teamName)}</option>`).join('');
    select.value = current ? current.id : (state.owners[0]?.id || '');
  }
  const label = $('#activeDraftOwnerLabel');
  if (label) label.textContent = current ? current.teamName : (state.owners[0]?.teamName || 'Choose team');
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
  forceFinalOwners();
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


let realNhlDraftLoadPromise = null;

function hasRealNhlPlayers() {
  return Array.isArray(state?.stats?.players) && state.stats.players.length > 0 && state.stats.source !== 'demo-board' && state.stats.source !== 'auto-demo-board';
}

async function loadRealNhlPlayersForDraft(force = false) {
  if (realNhlDraftLoadPromise) return realNhlDraftLoadPromise;
  if (!force && hasRealNhlPlayers()) return state.stats;

  const target = $('#draftBoardTable');
  if (target) {
    target.innerHTML = `
      <div class="real-nhl-loading">
        <strong>Pulling real NHL player stats…</strong>
        <span>Loading Goals, Assists, Points, and Fantasy Points from the NHL API.</span>
      </div>`;
  }

  realNhlDraftLoadPromise = (async () => {
    try {
      const data = await fetchNhlStats(state.settings.seasonId, state.settings.gameTypeId || 2);
      state.stats = data;
      state.settings.lastUpdated = data.fetchedAt;
      save();
      renderAll();
      toast(`Loaded ${data.players.length} real NHL players.`);
      return data;
    } catch (error) {
      console.error(error);
      if (target) {
        target.innerHTML = `
          <div class="real-nhl-error">
            <strong>NHL API pull failed.</strong>
            <span>Try the Pull Real NHL Players button again after deploy/refresh.</span>
            <button type="button" class="primary" id="retryRealNhlPullBtn">Retry NHL Pull</button>
          </div>`;
        $('#retryRealNhlPullBtn')?.addEventListener('click', () => loadRealNhlPlayersForDraft(true));
      }
      toast('NHL API pull failed. No demo players were loaded.');
      return null;
    } finally {
      realNhlDraftLoadPromise = null;
    }
  })();

  return realNhlDraftLoadPromise;
}

function ensureRealNhlPlayersForDraft() {
  if (!hasRealNhlPlayers()) loadRealNhlPlayersForDraft(false);
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
  const tableTarget = $('#draftBoardTable');
  if (!tableTarget) return;

  if (!hasRealNhlPlayers()) {
    tableTarget.innerHTML = `
      <div class="real-nhl-loading">
        <strong>No real NHL stats loaded yet.</strong>
        <span>Click Pull Real NHL Players, or wait — the draft room will try the NHL API automatically.</span>
        <button type="button" class="primary" id="inlineRealNhlPullBtn">Pull Real NHL Players</button>
      </div>`;
    $('#inlineRealNhlPullBtn')?.addEventListener('click', () => loadRealNhlPlayersForDraft(true));
    return;
  }

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
            <div class="meta">${p.position || '—'} • ${p.nhlTeam || '—'} • Real NHL API</div>
          </div>
          ${draftButton(p)}
        </div>
      </td>
      <td>${p.gamesPlayed || 0}</td>
      <td>${p.goals ?? 0}</td>
      <td>${p.assists ?? 0}</td>
      <td>${p.points ?? 0}</td>
      <td><strong>${fantasyPoints(p, state.settings.scoring)}</strong></td>
    </tr>`).join('');
  const chosenText = current ? `Drafting for ${escapeHtml(current.teamName)}` : 'Choose which old man you are before drafting';
  tableTarget.innerHTML = `
    <div class="active-draft-banner">${chosenText}</div>
    <table class="draft-table"><thead><tr>
      <th>#</th>
      <th>${header('Player','name')}</th>
      <th>${header('GP','gamesPlayed')}</th>
      <th>${header('Goals','goals')}</th>
      <th>${header('Assists','assists')}</th>
      <th>${header('Pts','points')}</th>
      <th>${header('Fantasy Pts','fantasyPoints')}</th>
    </tr></thead><tbody>${rows || '<tr><td colspan="7">No available real NHL players found. Try Pull Real NHL Players again.</td></tr>'}</tbody></table>`;
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
  return {
    id: String(p.id),
    name: p.name,
    position: p.position,
    nhlTeam: p.nhlTeam,
    type: p.type || (p.position === 'G' ? 'goalie' : 'skater'),
    gamesPlayed: Number(p.gamesPlayed || 0),
    goals: Number(p.goals || 0),
    assists: Number(p.assists || 0),
    points: Number(p.points || 0),
    goalieWins: Number(p.goalieWins || 0),
    goalieShutouts: Number(p.goalieShutouts || 0),
    goalieSaves: Number(p.goalieSaves || 0),
    goalieGoalsAgainst: Number(p.goalieGoalsAgainst || 0)
  };
}

function undoPick() {
  const last = state.draftBoard.picks.pop();
  if (!last) return toast('No picks to undo.');
  state.rosters[last.ownerId] = (state.rosters[last.ownerId] || []).filter(p => String(p.id) !== String(last.player.id));
  save(); renderAll(); toast(`Undid ${last.player.name}.`);
}

async async function resetDraft() {
  forceFinalOwners();
  if (!confirm('Reset the entire draft, clear all rosters, and clear the locked lottery results?')) return;
  state.draftBoard.picks = [];
  state.rosters = {};
  state.owners.forEach(o => { state.rosters[o.id] = []; });
  state.draftBoard.lotteryResult = [];
  state.draftBoard.lotteryRunNumber = 0;
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
  forceFinalOwners();
  ensureOwnersExist();
  if (!state.owners.length) return toast('Add teams before running the lottery.');
  const lockedOrder = lockedLotteryOrderIds();
  if (lockedOrder.length === state.owners.length) {
    playSpyLottery(lockedOrder);
    return toast('Replaying the locked lottery. Use Reset Draft to clear it.');
  }
  if (state.draftBoard.picks.length && !confirm('You already have drafted players. Running the lottery only changes the draft order, not existing picks. Continue?')) return;
  let result = equalShuffleOwners(state.owners).map(owner => owner.id);

  // For now keep this local only. This avoids Vercel/API/global-save issues while we restore stability.
  globalLotteryStorageConfigured = false;

  state.draftBoard.draftOrder = result;
  state.draftBoard.lotteryResult = result.map((id, index) => ({ id, pick: index + 1, timestamp: new Date().toISOString(), odds: 'equal', source: 'browser' }));
  state.draftBoard.lotteryRunNumber = 1;
  updateLotteryShareUrl(result);
  save();
  renderAll();
  playSpyLottery(result);
  const first = state.owners.find(o => o.id === result[0]);
  toast(`Lottery locked locally: ${first?.teamName || 'Team 1'} gets pick 1.`);
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
  // v29: no modal. The lottery reveal is rendered directly inside the Draft Info page.
  const ownersById = new Map(state.owners.map(o => [String(o.id), o]));
  const orderedOwners = orderIds.map(id => ownersById.get(String(id))).filter(Boolean);
  if (!orderedOwners.length) return toast('No lottery owners found.');

  const results = $('#lotteryResults');
  const status = $('#lotteryStatus');
  if (!results) return;

  if (status) status.textContent = 'Lottery reveal running directly on the Draft Info page.';

  results.innerHTML = `
    <div class="inline-lottery-stage">
      <div class="inline-lottery-header">
        <span>2026</span>
        <strong>HOCKEY POOL DRAFT LOTTERY</strong>
        <small>Equal odds • no overlay • no video modal</small>
      </div>
      <div class="inline-lottery-machine" id="inlineLotteryMachine">
        <i>1</i><i>2</i><i>3</i><i>4</i><i>5</i>
      </div>
      <div class="inline-lottery-card" id="inlineLotteryCard">
        <small>READY</small>
        <strong>---</strong>
      </div>
      <div class="inline-lottery-seats">
        ${orderedOwners.map(o => `<div data-inline-owner="${escapeHtml(String(o.id))}"><b>#@!*%</b><span>${escapeHtml(ownerShortName(o) || o.name || o.teamName || 'Owner')}</span></div>`).join('')}
      </div>
      <ol class="inline-lottery-results" id="inlineLotteryRevealList"></ol>
    </div>
  `;

  const machine = $('#inlineLotteryMachine');
  const card = $('#inlineLotteryCard');
  const list = $('#inlineLotteryRevealList');
  machine?.classList.add('spin');

  const revealOrder = [...orderedOwners].reverse();
  for (let i = 0; i < revealOrder.length; i++) {
    const owner = revealOrder[i];
    const pickNumber = orderedOwners.length - i;
    const name = ownerShortName(owner) || owner.name || owner.teamName || 'Owner';
    await sleep(550);
    if (card) card.innerHTML = `<small>${ordinalLabel(pickNumber)} OVERALL</small><strong>${escapeHtml(name)}</strong>`;
    const seat = document.querySelector(`[data-inline-owner="${CSS.escape(String(owner.id))}"]`);
    if (seat) {
      seat.classList.remove('mad');
      void seat.offsetWidth;
      seat.classList.add('mad');
    }
    if (list) list.insertAdjacentHTML('afterbegin', `<li><span>${pickNumber}</span><strong>${escapeHtml(name)}</strong></li>`);
    await sleep(650);
  }

  machine?.classList.remove('spin');
  if (status) status.textContent = 'Mission complete. Draft order locked until Reset Draft.';
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

const ROSTER_ROOM_OWNER_COLORS = {
  nick: ['#1d4ed8', '#93c5fd'],
  chris: ['#991b1b', '#fecaca'],
  andrew: ['#166534', '#bbf7d0'],
  tyler: ['#7c2d12', '#fed7aa'],
  scott: ['#581c87', '#e9d5ff']
};

let rosterRoomState = { openBinder: null, allPage: 0, flipping: false };

function getRosterRoomPlayer(ownerId, player) {
  const current = state.stats.players.find(sp => String(sp.id) === String(player.id)) || {};
  const merged = { ...player, ...current };
  return {
    ...merged,
    poolPoints: fantasyPoints(merged, state.settings.scoring),
    ownerId
  };
}

function rosterRoomAllPlayers() {
  const items = [];
  state.owners.forEach(owner => {
    (state.rosters[owner.id] || []).forEach(player => {
      items.push({ owner, player: getRosterRoomPlayer(owner.id, player) });
    });
  });
  return items;
}

function playerInitials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || '?';
}

function renderHockeyCard(player, owner, index = 0) {
  const safeName = escapeHtml(player.name || 'Empty Sleeve');
  const safeTeam = escapeHtml(player.nhlTeam || 'NHL');
  const pos = escapeHtml(player.position || '—');
  const pts = Number(player.poolPoints || 0);
  const isGoalie = String(player.position || '').toUpperCase() === 'G';
  const statLine = isGoalie
    ? `${Number(player.goalieWins || 0)} W • ${Number(player.goalieShutouts || 0)} SO`
    : `${Number(player.goals || 0)} G • ${Number(player.assists || 0)} A • ${Number(player.points || 0)} PTS`;
  const colors = ROSTER_ROOM_OWNER_COLORS[owner?.id] || ['#334155', '#cbd5e1'];
  return `
    <div class="binder-card hockey-player-card" style="--card-a:${colors[0]};--card-b:${colors[1]};" data-player-card="${escapeHtml(String(player.id || index))}">
      <div class="card-shine"></div>
      <div class="card-topline"><span>${pos}</span><strong>${safeTeam}</strong></div>
      <div class="card-portrait"><span>${escapeHtml(playerInitials(player.name))}</span></div>
      <h4>${safeName}</h4>
      <div class="card-stat-line">${escapeHtml(statLine)}</div>
      <div class="card-footer"><span>${pts} pool pts</span><small>${escapeHtml(owner?.teamName || owner?.name || '')}</small></div>
      <button class="small-btn danger roster-card-remove" data-remove-player="${escapeHtml(owner?.id || '')}|${escapeHtml(String(player.id || ''))}" title="Remove player">×</button>
    </div>`;
}

function renderEmptySleeves(count = 9) {
  return Array.from({ length: count }, (_, i) => `
    <div class="binder-card empty-sleeve">
      <span class="sleeve-glare"></span>
      <strong>Empty Sleeve</strong>
      <small>Draft slot ${i + 1}</small>
    </div>`).join('');
}

function renderBinderShelf() {
  const ownerBinders = state.owners.map(owner => {
    const roster = state.rosters[owner.id] || [];
    const total = ownerTotal(owner.id, state);
    const colors = ROSTER_ROOM_OWNER_COLORS[owner.id] || ['#334155', '#cbd5e1'];
    return `
      <button class="binder-spine ${rosterRoomState.openBinder === owner.id ? 'active' : ''}" data-open-binder="${escapeHtml(owner.id)}" style="--binder-a:${colors[0]};--binder-b:${colors[1]};">
        <span class="binder-rings"></span>
        <strong>${escapeHtml(owner.teamName || owner.name)}</strong>
        <em>${roster.length} cards • ${total} pts</em>
      </button>`;
  }).join('');

  return `
    <div class="binder-coffee-table" aria-label="Coffee table with hockey card binders">
      ${ownerBinders}
      <button class="binder-spine all-teams ${rosterRoomState.openBinder === 'all' ? 'active' : ''}" data-open-binder="all">
        <span class="binder-rings"></span>
        <strong>League Binder</strong>
        <em>All teams • page turn test</em>
      </button>
    </div>`;
}

function renderOwnerBinder(owner) {
  const roster = (state.rosters[owner.id] || []).map(p => getRosterRoomPlayer(owner.id, p));
  const cards = roster.length
    ? roster.map((player, i) => renderHockeyCard(player, owner, i)).join('') + renderEmptySleeves(Math.max(0, 9 - roster.length))
    : renderEmptySleeves(9);

  return `
    <div class="open-binder owner-binder-open">
      <div class="binder-cover-edge"><span></span><span></span><span></span></div>
      <div class="binder-page left-page">
        <div class="binder-page-title">
          <span class="eyebrow">${escapeHtml(owner.name)}'s binder</span>
          <h3>${escapeHtml(owner.teamName || owner.name)}</h3>
          <p>${roster.length ? 'Drafted players appear as hockey cards in plastic sleeves.' : 'No drafted players yet. Sleeves are ready for API-generated cards.'}</p>
        </div>
      </div>
      <div class="binder-page right-page card-sleeve-grid">
        ${cards}
      </div>
    </div>`;
}

function renderLeagueBinder() {
  const all = rosterRoomAllPlayers();
  const perPage = 6;
  const pages = all.length ? chunkArray(all, perPage) : [[], [], [], [], []];
  const maxPage = Math.max(0, pages.length - 1);
  rosterRoomState.allPage = Math.min(rosterRoomState.allPage || 0, maxPage);
  const pageItems = pages[rosterRoomState.allPage] || [];
  const cards = pageItems.length
    ? pageItems.map((item, i) => renderHockeyCard(item.player, item.owner, i)).join('') + renderEmptySleeves(Math.max(0, perPage - pageItems.length))
    : renderEmptyLeagueDividers();

  return `
    <div class="open-binder league-binder-open ${rosterRoomState.flipping ? 'is-flipping' : ''}">
      <div class="binder-cover-edge"><span></span><span></span><span></span></div>
      <div class="binder-page left-page league-index-page">
        <span class="eyebrow">Sixth book test</span>
        <h3>League Binder</h3>
        <p>One master binder for every drafted player. This is the version with page-turn controls and animation.</p>
        <div class="league-index-list">
          ${state.owners.map(owner => `<span>${escapeHtml(owner.teamName || owner.name)} <em>${(state.rosters[owner.id] || []).length}</em></span>`).join('')}
        </div>
      </div>
      <div class="binder-page right-page page-turn-target">
        <div class="page-turn-shadow"></div>
        <div class="league-page-head">
          <strong>Page ${rosterRoomState.allPage + 1}</strong>
          <span>${all.length || 0} drafted cards total</span>
        </div>
        <div class="card-sleeve-grid league-card-grid">${cards}</div>
        <div class="page-controls">
          <button data-binder-page="prev" ${rosterRoomState.allPage <= 0 ? 'disabled' : ''}>← Previous page</button>
          <button data-binder-page="next" ${rosterRoomState.allPage >= maxPage ? 'disabled' : ''}>Next page →</button>
        </div>
      </div>
    </div>`;
}

function renderEmptyLeagueDividers() {
  return state.owners.map((owner, i) => `
    <div class="binder-card team-divider-card">
      <span>${String(i + 1).padStart(2, '0')}</span>
      <strong>${escapeHtml(owner.teamName || owner.name)}</strong>
      <small>Waiting for drafted cards</small>
    </div>`).join('') + renderEmptySleeves(Math.max(0, 6 - state.owners.length));
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function renderRosters() {
  const target = $('#rosterCards');
  if (!target) return;
  const currentId = rosterRoomState.openBinder || 'all';
  const currentOwner = state.owners.find(o => o.id === currentId);
  const openContent = currentId === 'all' ? renderLeagueBinder() : renderOwnerBinder(currentOwner || state.owners[0]);

  target.className = 'roster-room-host';
  target.innerHTML = `
    <section class="roster-room-scene">
      <div class="roster-room-bg"></div>
      <div class="roster-room-vignette"></div>
      <div class="roster-room-intro">
        <span class="eyebrow">Roster Room Prototype</span>
        <h3>1998 basement hockey-card binder room</h3>
        <p>Pick a binder on the coffee table. Individual binders show one team. The sixth League Binder tests the page-turn version for every team together.</p>
      </div>
      ${renderBinderShelf()}
      <div class="binder-stage">
        ${openContent}
      </div>
    </section>`;

  $$('[data-open-binder]', target).forEach(btn => btn.addEventListener('click', () => {
    rosterRoomState.openBinder = btn.dataset.openBinder;
    rosterRoomState.flipping = false;
    renderRosters();
  }));

  $$('[data-binder-page]', target).forEach(btn => btn.addEventListener('click', () => {
    const direction = btn.dataset.binderPage === 'next' ? 1 : -1;
    rosterRoomState.flipping = true;
    renderRosters();
    setTimeout(() => {
      rosterRoomState.allPage = Math.max(0, rosterRoomState.allPage + direction);
      rosterRoomState.flipping = false;
      renderRosters();
    }, 360);
  }));

  $$('[data-remove-player]', target).forEach(btn => btn.addEventListener('click', (event) => {
    event.stopPropagation();
    removePlayer(btn.dataset.removePlayer);
  }));
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
  forceFinalOwners();
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

async function loadDemoPlayers() {
  // Kept this function name only because the existing button uses this id.
  // It now pulls real NHL API players, not demo players.
  return loadRealNhlPlayersForDraft(true);
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
