
    // V91 rebuilt clean draft room controller.
    (function(){
      "use strict";

      const OWNERS = [
        { id:"nick", name:"Nick", teamName:"Nick" },
        { id:"chris", name:"Chris", teamName:"Chris" },
        { id:"andrew", name:"Andrew", teamName:"Andrew" },
        { id:"tyler", name:"Tyler", teamName:"Tyler" },
        { id:"scott", name:"Scott", teamName:"Scott" }
      ];
      const LIMITS = { F: 6, D: 4, G: 2, SKATERS: 10 };
      const TOTAL_PICKS = OWNERS.length * (LIMITS.F + LIMITS.D + LIMITS.G);

      let activeOwnerId = localStorage.getItem("custom-hockey-pool-active-owner") || "nick";
      let draft = null;
      let players = [];
      let playersLoaded = false;
      let playersLoading = false;
      let positionFilter = "F";
      let sortKey = "fantasyPoints";
      let poll = null;

      const $ = (sel) => document.querySelector(sel);

      function esc(s){
        return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
      }

      function toast(message){
        const t = document.getElementById("toast");
        if (!t) return;
        t.textContent = message;
        t.classList.add("show");
        setTimeout(() => t.classList.remove("show"), 2600);
      }

      function currentSeasonId(){
        // Draft testing should use the completed 2025-2026 regular-season stat pool.
        // Do not roll this automatically by calendar date while we are testing the draft/rollover flow.
        return "20252026";
      }

      function bucket(position){
        if (position === "D") return "D";
        if (position === "G" || position === "TG") return "G";
        return "F";
      }

      function displayPosition(position){
        return position === "TG" ? "Team Goalies" : (position || "");
      }

      function fp(p){
        if (bucket(p.position) === "G") return Math.round((Number(p.goalieWins || 0) * 2) + (Number(p.goalieGoals || p.goals || 0) * 10) + (Number(p.goalieAssists || p.assists || 0) * 5) + (Number(p.goalieShutouts || 0) * 5));
        return Math.round((Number(p.goals || 0) * 2) + (Number(p.assists || 0) * 1) + (Number(p.shortHandedGoals || 0) * 5) + (Number(p.gameWinningGoals || 0) * 5));
      }

      function defaultDraft(){
        return {
          owners: OWNERS.slice(),
          draftOrder: OWNERS.map(o => o.id),
          picks: [],
          updatedAt: new Date().toISOString()
        };
      }

      function owner(id){
        return (draft?.owners || OWNERS).find(o => String(o.id) === String(id)) || null;
      }

      function ownerName(id){
        const o = owner(id);
        return o?.teamName || o?.name || id || "";
      }

      function lotteryOrderFromStorage(){
        const keys = ["custom-hockey-pool-v30-popout-emergency","custom-hockey-pool-v29-inline-emergency","custom-hockey-pool-v28-hard-bypass-fallback"];
        for (const key of keys){
          try{
            const parsed = JSON.parse(localStorage.getItem(key) || "null");
            if (parsed && Array.isArray(parsed.lotteryOrder) && parsed.lotteryOrder.length) return parsed.lotteryOrder.slice();
          }catch(e){}
        }
        return null;
      }

      function draftOrder(){
        if (draft && Array.isArray(draft.draftOrder) && draft.draftOrder.length) return draft.draftOrder.slice();
        return lotteryOrderFromStorage() || OWNERS.map(o => o.id);
      }

      function snakePick(index){
        const order = draftOrder();
        if (!order.length || index >= TOTAL_PICKS) return null;
        const round = Math.floor(index / order.length) + 1;
        const slot = index % order.length;
        const roundOrder = round % 2 === 1 ? order : order.slice().reverse();
        return {
          pickNumber: index + 1,
          round,
          slot: slot + 1,
          ownerId: roundOrder[slot]
        };
      }

      function currentPick(){
        const count = Array.isArray(draft?.picks) ? draft.picks.length : 0;
        return snakePick(count);
      }

      function draftedIds(){
        return new Set((draft?.picks || []).map(p => String(p.player?.id || "")));
      }

      function lastYearStaticRosters(){
        return (window.__lastYearStaticRosters && typeof window.__lastYearStaticRosters === "object") ? window.__lastYearStaticRosters : {};
      }

      const ROSTER_RESET_KEY = "custom-hockey-pool-rosters-manually-cleared";
      function markRostersManuallyCleared(){
        try { localStorage.setItem(ROSTER_RESET_KEY, "true"); } catch(e) {}
      }
      function clearRostersManuallyCleared(){
        try { localStorage.removeItem(ROSTER_RESET_KEY); } catch(e) {}
      }
      function rostersWereManuallyCleared(){
        try { if (localStorage.getItem(ROSTER_RESET_KEY) === "true") return true; } catch(e) {}
        return !!(draft && draft.__manualRosterReset);
      }

      function hasFullStaticSeasonRosters(){
        const rosters = lastYearStaticRosters();
        return OWNERS.every(o => Array.isArray(rosters[o.id]) && rosters[o.id].length >= 12);
      }

      function staticSeasonPicks(){
        const rosters = lastYearStaticRosters();
        let pickNumber = 1;
        const picks = [];
        OWNERS.forEach(ownerObj => {
          (rosters[ownerObj.id] || []).forEach((player, index) => {
            const b = bucket(player.position);
            picks.push({
              pickNumber: pickNumber++,
              round: Math.floor(index / 5) + 1,
              slot: (index % 5) + 1,
              ownerId: ownerObj.id,
              ownerName: ownerObj.teamName || ownerObj.name || ownerObj.id,
              timestamp: "2026-04-17T04:00:00.000Z",
              source: "previousSeasonStaticRoster",
              player: Object.assign({
                id: String(player.id || (ownerObj.id + "-" + String(player.name || "player").toLowerCase().replace(/[^a-z0-9]+/g,"-"))),
                name: player.name || "Player",
                position: player.position || (player.type === "goalie" ? "G" : "F"),
                nhlTeam: player.nhlTeam || "",
                fantasyPoints: fp(player)
              }, player, { fantasyPoints: fp(player) })
            });
          });
        });
        return picks;
      }

      function applyStaticSeasonLockIfNeeded(){
        if (!draft) return;
        // If Nick has intentionally reset/cleared rosters for draft testing, do not
        // auto-rebuild the old 2025-2026 roster list from the static history file.
        if (rostersWereManuallyCleared()) return;
        if (!hasFullStaticSeasonRosters()) return;
        if (Array.isArray(draft.picks) && draft.picks.length > 0) return;
        draft.picks = staticSeasonPicks();
        draft.draftClosed = true;
        draft.__seasonLockedRecord = "2025-2026 Regular Season";
        draft.__fromStaticSeasonRecord = true;
        draft.updatedAt = new Date().toISOString();
      }

      function isDraftClosed(){
        if (!draft) return false;
        if (draft.draftClosed || draft.__seasonLockedRecord) return true;
        return Array.isArray(draft.picks) && draft.picks.length >= TOTAL_PICKS;
      }

      function showDraftClosed(message){
        const board = $("#cleanDraftBoard");
        if (!board) return;
        const label = message || "Rosters full. Draft closed.";
        board.innerHTML = `<div class="clean-loading-card draft-closed-card"><strong>${esc(label)}</strong><span>All five rosters already have 10 skaters and 2 goalies. Players already on a roster are treated as unavailable so duplicates cannot be drafted.</span></div>`;
      }

      function rosterCounts(ownerId){
        const counts = { F:0, D:0, G:0 };
        (draft?.picks || []).forEach(p => {
          if (String(p.ownerId) !== String(ownerId)) return;
          counts[bucket(p.player?.position)] += 1;
        });
        return counts;
      }

      function canOwnerDraftPosition(ownerId, position){
        const counts = rosterCounts(ownerId);
        const b = bucket(position);
        if (b === "G") return counts.G < LIMITS.G;
        if (b === "D") return counts.D < LIMITS.D;
        return counts.F < LIMITS.F;
      }

      function normalizeName(first, last, fallback){
        const f = typeof first === "object" ? (first.default || "") : (first || "");
        const l = typeof last === "object" ? (last.default || "") : (last || "");
        return fallback || [f,l].filter(Boolean).join(" ").trim();
      }

      function normalizeSkater(row){
        const id = row.playerId || row.skaterId || row.id || `${row.firstName || ""}-${row.lastName || ""}-${row.teamAbbrevs || row.teamAbbrev || ""}`;
        const name = row.skaterFullName || row.playerFullName || row.fullName || normalizeName(row.firstName, row.lastName, "");
        const position = row.positionCode || row.position || row.positionAbbrev || "F";
        const nhlTeam = row.teamAbbrevs || row.teamAbbrev || row.team || "";
        return {
          id: String(id),
          name,
          position: position === "L" ? "LW" : position === "R" ? "RW" : position,
          nhlTeam,
          gamesPlayed: Number(row.gamesPlayed || row.gp || 0),
          goals: Number(row.goals || 0),
          assists: Number(row.assists || 0),
          points: Number(row.points || 0),
          shortHandedGoals: Number(row.shGoals || row.shortHandedGoals || 0),
          gameWinningGoals: Number(row.gameWinningGoals || row.gwGoals || 0),
          fantasyPoints: 0
        };
      }

      function normalizeGoalies(goalies){
        const map = new Map();
        (goalies || []).forEach(row => {
          const team = row.teamAbbrevs || row.teamAbbrev || row.team || "";
          if (!team) return;
          const current = map.get(team) || {
            id: `TG-${team}`,
            name: `${team} Team Goalies`,
            position: "TG",
            nhlTeam: team,
            gamesPlayed: 0,
            goals: 0,
            assists: 0,
            goalieGoals: 0,
            goalieAssists: 0,
            goalieWins: 0,
            goalieShutouts: 0,
            savePct: 0,
            goalsAgainstAverage: 0,
            fantasyPoints: 0
          };
          current.gamesPlayed += Number(row.gamesPlayed || row.gp || 0);
          current.goals += Number(row.goals || row.goalieGoals || 0);
          current.assists += Number(row.assists || row.goalieAssists || 0);
          current.goalieGoals += Number(row.goals || row.goalieGoals || 0);
          current.goalieAssists += Number(row.assists || row.goalieAssists || 0);
          current.goalieWins += Number(row.wins || row.goalieWins || 0);
          current.goalieShutouts += Number(row.shutouts || row.goalieShutouts || 0);
          current.savePct = Math.max(current.savePct || 0, Number(row.savePct || row.savePercentage || 0));
          const gaa = Number(row.goalsAgainstAverage || row.gaa || 0);
          if (gaa) current.goalsAgainstAverage = current.goalsAgainstAverage ? Math.min(current.goalsAgainstAverage, gaa) : gaa;
          map.set(team, current);
        });
        return Array.from(map.values());
      }

      function enrichPlayer(p){
        p.fantasyPoints = fp(p);
        return p;
      }

      function teamLogoUrl(team){
        return `https://assets.nhle.com/logos/nhl/svg/${encodeURIComponent(team || "NHL")}_light.svg`;
      }

      function playerImageUrl(p){
        if (p.position === "TG") return teamLogoUrl(p.nhlTeam);
        const numeric = String(p.id || "").replace(/\D/g, "");
        return numeric ? `https://assets.nhle.com/mugs/nhl/latest/${numeric}.png` : teamLogoUrl(p.nhlTeam);
      }

      function teamClassName(team){
        return `nhl-${String(team || "nhl").toLowerCase().replace(/[^a-z0-9]+/g,"-")}`;
      }

      async function loadSharedDraft(){
        if (window.officialDraftApi) {
          draft = await window.officialDraftApi.load();
        } else {
          draft = defaultDraft();
        }
        if (!Array.isArray(draft.owners) || !draft.owners.length) draft.owners = OWNERS.slice();
        if (!Array.isArray(draft.draftOrder) || !draft.draftOrder.length) draft.draftOrder = draftOrder();
        if (!Array.isArray(draft.picks)) draft.picks = [];
        applyStaticSeasonLockIfNeeded();
        window.__currentLiveDraft = draft;
        if (window.renderDraftRosters) window.renderDraftRosters(draft);
        if (window.renderDraftRoomLottery) window.renderDraftRoomLottery(draft);
        return draft;
      }

      async function saveSharedDraft(){
        draft.updatedAt = new Date().toISOString();
        if (window.officialDraftApi) draft = await window.officialDraftApi.save(draft);
        window.__currentLiveDraft = draft;
        if (window.renderDraftRosters) window.renderDraftRosters(draft);
        if (window.renderDraftRoomLottery) window.renderDraftRoomLottery(draft);
        if (window.liveLottery && window.liveLottery.renderLiveDraftTicker) window.liveLottery.renderLiveDraftTicker(draft, true);
        return draft;
      }

      function setSourceStatus(){
        if (window.officialDraftApi && window.officialDraftApi.updateSourceStatus) window.officialDraftApi.updateSourceStatus(draft);
      }

      function setSyncStatus(text){
        const el = $("#cleanSyncStatus");
        if (el) el.textContent = text;
      }

      let presenceMap = {};
      let presencePoll = null;
      let heartbeatPoll = null;

      async function sendPresence(){
        if (!activeOwnerId) return;
        try{
          await fetch("/api/presence", {
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body:JSON.stringify({ ownerId: activeOwnerId })
          });
        }catch(e){}
      }

      async function loadPresence(){
        try{
          const res = await fetch("/api/presence?t=" + Date.now(), { cache:"no-store" });
          const data = await res.json();
          presenceMap = data && data.presence ? data.presence : {}; window.__presenceMap = presenceMap;
        }catch(e){
          presenceMap = {};
        }
      }

      function updateCurrentPresenceLight(){
        const pick = currentPick();
        const light = document.getElementById("currentOnlineLight");
        if (!light) return;
        const online = Boolean(pick && presenceMap && presenceMap[pick.ownerId]);
        light.classList.toggle("online", online);
        light.classList.toggle("offline", !online);
        light.title = online ? "Online drafting" : "Offline";
      }

      function startPresence(){
        clearInterval(presencePoll);
        clearInterval(heartbeatPoll);
        sendPresence();
        loadPresence().then(() => { updateCurrentPresenceLight(); renderDraftRoomLottery(draft); });
        heartbeatPoll = setInterval(sendPresence, 15000);
        presencePoll = setInterval(async () => {
          await loadPresence();
          updateCurrentPresenceLight();
          renderDraftRoomLottery(draft);
        }, 10000);
      }

      function updateMobileStickyRosterNeeds(){
        if (!(window.matchMedia && window.matchMedia("(max-width: 820px)").matches)) {
          document.body.classList.remove("mobile-roster-needs-fixed");
          const ph = document.getElementById("mobileRosterNeedsSpacer");
          if (ph) ph.style.height = "0px";
          return;
        }
        const panel = document.getElementById("cleanRosterNeedsPanel");
        const topbar = document.querySelector(".roster-needs-topbar");
        if (!panel || !topbar) return;

        let spacer = document.getElementById("mobileRosterNeedsSpacer");
        if (!spacer) {
          spacer = document.createElement("div");
          spacer.id = "mobileRosterNeedsSpacer";
          spacer.className = "mobile-roster-needs-spacer";
          topbar.parentNode.insertBefore(spacer, topbar);
        }

        const start = spacer.getBoundingClientRect().top + window.scrollY;
        const shouldFix = window.scrollY > start;
        document.body.classList.toggle("mobile-roster-needs-fixed", shouldFix);
        spacer.style.height = shouldFix ? (topbar.offsetHeight + "px") : "0px";
      }

      function alignDesktopDraftBoard(){
        // V101: desktop no longer uses the old centered table; it uses a left-aligned grid.
        const grid = document.querySelector("#cleanDraftBoard .desktop-player-grid");
        if (grid) grid.dataset.leftAligned = "true";
      }

      function showBoardLoading(message){
        const board = $("#cleanDraftBoard");
        if (board) board.innerHTML = `<div class="clean-loading-card"><strong>${esc(message || "Loading…")}</strong></div>`;
      }

      function showBoardError(message){
        const board = $("#cleanDraftBoard");
        if (board) board.innerHTML = `<div class="clean-loading-card error"><strong>${esc(message || "Something failed.")}</strong><button id="cleanRetryPlayers" class="primary" type="button">Retry</button></div>`;
      }

      async function pullPlayers(){
        if (!draft) await loadSharedDraft();
        if (isDraftClosed()) { showDraftClosed("Rosters full. Draft closed."); return toast("Rosters full. Draft closed."); }
        if (playersLoading) return;
        playersLoading = true;
        showBoardLoading("Pulling real NHL player board…");
        try{
          const season = currentSeasonId();
          const res = await fetch(`/api/nhl?season=${season}&gameType=2&limit=900`, { cache:"no-store" });
          const payload = await res.json();
          if (!res.ok || !payload.ok) throw new Error(payload.error || payload.detail || "NHL API failed");

          const skaters = (payload.skaters || []).map(normalizeSkater);
          const goalies = normalizeGoalies(payload.goalies || []);
          const map = new Map();
          [...skaters, ...goalies].forEach(p => {
            if (!p.id || !p.name) return;
            const item = enrichPlayer(p);
            if (!map.has(String(item.id))) map.set(String(item.id), item);
          });
          players = Array.from(map.values()).sort((a,b) => fp(b)-fp(a));
          playersLoaded = true;
          toast(`Loaded ${players.length} real NHL players.`);
          renderRoom();
        }catch(error){
          console.error(error);
          showBoardError(error.message || "NHL player pull failed.");
          toast("NHL player pull failed.");
        }finally{
          playersLoading = false;
        }
      }

      function filteredPlayers(){
        const taken = draftedIds();
        let list = players.filter(p => !taken.has(String(p.id)));
        if (positionFilter === "F") list = list.filter(p => bucket(p.position) === "F");
        else if (positionFilter === "D") list = list.filter(p => bucket(p.position) === "D");
        else if (positionFilter === "TG") list = list.filter(p => bucket(p.position) === "G");

        return list.sort((a,b) => {
          const av = sortKey === "name" ? String(a.name).toLowerCase() : Number(a[sortKey] || fp(a) || 0);
          const bv = sortKey === "name" ? String(b.name).toLowerCase() : Number(b[sortKey] || fp(b) || 0);
          if (sortKey === "name") return av.localeCompare(bv);
          return bv - av;
        });
      }

      function renderRosterNeeds(){
        if (!window.renderRosterNeeds) return;
        window.renderRosterNeeds(draft, activeOwnerId, ownerName(activeOwnerId));
      }

      function renderOnDeck(){
        const box = $("#cleanOnDeckCircle");
        if (!box) return;
        const currentPickNo = (draft?.picks || []).length + 1;
        const items = [];

        // On Deck starts AFTER the current pick.
        // If pick 1 is drafting, this shows picks 2, 3, and 4.
        for (let i=currentPickNo; i<Math.min(TOTAL_PICKS, currentPickNo + 3); i++){
          const p = snakePick(i);
          if (!p) continue;
          const idx = i - currentPickNo;
          const label = idx === 0 ? "Next" : idx === 1 ? "After" : "Then";
          items.push(`<span class="on-deck-chip ${idx===0 ? "next-up" : ""}"><b>${label}</b><strong>${esc(ownerName(p.ownerId))}</strong><em>Pick ${i+1}</em></span>`);
        }
        box.innerHTML = items.length ? items.join("") : '<span class="empty">No one on deck.</span>';
      }

      function renderDraftOrderStrip(){
        const strip = $("#cleanDraftOrderStrip");
        if (!strip) return;
        const pickNo = (draft?.picks || []).length + 1;
        const items = [];
        for (let i=0; i<Math.min(TOTAL_PICKS, pickNo + 14); i++){
          const p = snakePick(i);
          if (!p) continue;
          items.push(`<span class="${i+1 === pickNo ? "current" : ""}">${i+1}. ${esc(ownerName(p.ownerId))}</span>`);
        }
        strip.innerHTML = items.join("");
      }

      function renderRoom(){
        if (!draft) draft = defaultDraft();
        window.__currentLiveDraft = draft;
        if (window.liveLottery && window.liveLottery.renderLiveDraftTicker) {
          window.liveLottery.renderLiveDraftTicker(draft, true);
        }
        setSourceStatus();

        const select = $("#cleanDraftAsSelect");
        if (select && select.value !== activeOwnerId) select.value = activeOwnerId;

        const pick = currentPick();
        const currentName = pick ? ownerName(pick.ownerId) : "Draft complete";
        const currentEl = $("#cleanCurrentlyDrafting");
        const detailEl = $("#cleanPickDetails");
        if (currentEl) currentEl.textContent = currentName;
        if (detailEl) detailEl.textContent = pick ? `Pick ${pick.pickNumber} • Round ${pick.round}` : `${(draft.picks || []).length} picks complete`;
        updateCurrentPresenceLight();

        const onClock = $("#cleanOnClockBanner");
        if (onClock) onClock.hidden = !(pick && String(pick.ownerId) === String(activeOwnerId));

        renderRosterNeeds();
        renderOnDeck();
        renderDraftOrderStrip();

        if (isDraftClosed()) {
          showDraftClosed("Rosters full. Draft closed.");
          return;
        }

        if (!playersLoaded) {
          showBoardLoading("Select your team, then press PULL NHL PLAYERS.");
          return;
        }

        const board = $("#cleanDraftBoard");
        if (!board) return;

        const canPick = Boolean(pick && String(pick.ownerId) === String(activeOwnerId));
        const goalieMode = positionFilter === "TG";
        const sortHead = (key,label) => `<button type="button" class="stat-sort-header" data-sort-key="${key}">${label}${sortKey === key ? " ▲" : ""}</button>`;
        const posSelect = `<select id="cleanPositionFilter" class="table-position-filter">
          <option value="F" ${positionFilter==="F"?"selected":""}>Forward</option>
          <option value="D" ${positionFilter==="D"?"selected":""}>Defense</option>
          <option value="TG" ${positionFilter==="TG"?"selected":""}>Team Goalie</option>
        </select>`;

        const desktopHeaders = goalieMode
          ? `<div class="desktop-player-row desktop-player-header"><div class="pic-cell">Pic</div><div class="name-cell">${posSelect}</div><div>${sortHead("goalieWins","Wins")}</div><div>${sortHead("savePct","Save %")}</div><div>${sortHead("goalsAgainstAverage","GAA")}</div><div>${sortHead("fantasyPoints","Fantasy Pts")}</div></div>`
          : `<div class="desktop-player-row desktop-player-header"><div class="pic-cell">Pic</div><div class="name-cell">${posSelect}</div><div>${sortHead("goals","Goals")}</div><div>${sortHead("assists","Assists")}</div><div>${sortHead("points","Pts")}</div><div>${sortHead("fantasyPoints","Fantasy Pts")}</div></div>`;

        const rows = filteredPlayers().slice(0, 900).map(p => {
          const allowed = activeOwnerId ? canOwnerDraftPosition(activeOwnerId, p.position) : false;
          const disabled = (canPick && allowed) ? "" : "disabled";
          const text = !canPick ? "Wait" : (!allowed ? "Full" : "Draft");
          return `<div class="desktop-player-row ${p.position === "TG" ? "team-goalie-row" : ""} ${esc(teamClassName(p.nhlTeam))}" data-mobile-sign="${esc(p.id)}" style="--team-logo:url('${esc(teamLogoUrl(p.nhlTeam))}')">
            <div class="pic-cell"><img class="desktop-player-headshot" src="${esc(playerImageUrl(p))}" alt="" loading="lazy" onerror="this.style.display='none'"></div>
            <div class="name-cell"><div class="player-draft-line compact-player-line"><div class="player-name-wrap"><strong>${esc(p.name)}</strong><div class="meta">${esc(displayPosition(p.position))} • ${esc(p.nhlTeam)} • Real NHL API</div></div><button type="button" class="draft-player-btn single-draft-btn contract-draft-btn clean-sign-btn" data-clean-sign="${esc(p.id)}" ${disabled}><span>${text}</span></button></div></div>
            <div>${p.position === "TG" ? (p.goalieWins || 0) : (p.goals || 0)}</div>
            <div>${p.position === "TG" ? (p.savePct || 0) : (p.assists || 0)}</div>
            <div>${p.position === "TG" ? (p.goalsAgainstAverage || 0) : (p.points || 0)}</div>
            <div><strong>${fp(p)}</strong></div>
          </div>`;
        }).join("");

        const mobileTools = `<div class="mobile-player-tools">
          <select id="cleanMobilePositionFilter" class="mobile-position-filter" aria-label="Player type">
            <option value="F" ${positionFilter==="F"?"selected":""}>Forwards</option>
            <option value="D" ${positionFilter==="D"?"selected":""}>Defense</option>
            <option value="TG" ${positionFilter==="TG"?"selected":""}>Team Goalies</option>
          </select>
          <div class="mobile-sort-row">
            ${goalieMode ? `<button data-sort-key="goalieWins">Wins</button><button data-sort-key="savePct">SV%</button><button data-sort-key="goalsAgainstAverage">GAA</button><button data-sort-key="fantasyPoints">FPTS</button>` : `<button data-sort-key="goals">G</button><button data-sort-key="assists">A</button><button data-sort-key="points">PTS</button><button data-sort-key="fantasyPoints">FPTS</button>`}
          </div>
        </div>`;

        const mobileCards = filteredPlayers().slice(0,900).map(p => {
          const allowed = activeOwnerId ? canOwnerDraftPosition(activeOwnerId, p.position) : false;
          const disabled = (canPick && allowed) ? "" : "disabled";
          const text = !canPick ? "Wait" : (!allowed ? "Full" : "Draft");
          return `<article class="mobile-draft-player-card ${p.position === "TG" ? "team-goalie-row" : ""} ${esc(teamClassName(p.nhlTeam))}" data-mobile-sign="${esc(p.id)}" style="--team-logo:url('${esc(teamLogoUrl(p.nhlTeam))}')">
            <div class="mobile-card-main">
              <img class="mobile-card-logo" src="${esc(playerImageUrl(p))}" alt="" loading="lazy" onerror="this.style.display='none'">
              <div class="mobile-card-nameplate"><strong>${esc(p.name)}</strong><span>${esc(displayPosition(p.position))} • ${esc(p.nhlTeam)}</span></div>
              <button type="button" class="draft-player-btn clean-sign-btn mobile-draft-btn" data-clean-sign="${esc(p.id)}" ${disabled}>${text}</button>
            </div>
            <div class="mobile-card-stats">
              <span><b>${p.position === "TG" ? "W" : "G"}</b>${p.position === "TG" ? (p.goalieWins || 0) : (p.goals || 0)}</span>
              <span><b>${p.position === "TG" ? "SV%" : "A"}</b>${p.position === "TG" ? (p.savePct || 0) : (p.assists || 0)}</span>
              <span><b>${p.position === "TG" ? "GAA" : "PTS"}</b>${p.position === "TG" ? (p.goalsAgainstAverage || 0) : (p.points || 0)}</span>
              <span><b>FPTS</b>${fp(p)}</span>
            </div>
          </article>`;
        }).join("");

        board.innerHTML = `${mobileTools}<div class="desktop-player-grid ${goalieMode ? "goalie-board-mode" : "skater-board-mode"}">${desktopHeaders}${rows}</div><div class="mobile-draft-board-list">${mobileCards}</div>`;
        alignDesktopDraftBoard();
      }

      function eligibleFor(ownerId, b){
        const taken = draftedIds();
        return players
          .filter(p => !taken.has(String(p.id)))
          .filter(p => bucket(p.position) === b)
          .filter(p => canOwnerDraftPosition(ownerId, p.position))
          .sort((a,b) => fp(b) - fp(a));
      }

      function neededBuckets(ownerId){
        const c = rosterCounts(ownerId);
        return ["F","D","G"].filter(b => c[b] < LIMITS[b]);
      }

      function autoPlayer(ownerId){
        // Best available FPTS first, but only from positions this owner still needs.
        // This prevents auto draft from taking a 3rd goalie, 7th forward, or 5th defenseman,
        // while still picking the strongest remaining player for the current pick.
        const taken = draftedIds();
        const needed = new Set(neededBuckets(ownerId));
        if (!needed.size) return null;
        return players
          .filter(p => !taken.has(String(p.id)))
          .filter(p => needed.has(bucket(p.position)))
          .sort((a,b) => fp(b) - fp(a))[0] || null;
      }

      function pushPick(pick, player){
        draft.picks.push({
          pickNumber: pick.pickNumber,
          round: pick.round,
          slot: pick.slot,
          ownerId: pick.ownerId,
          ownerName: ownerName(pick.ownerId),
          timestamp: new Date().toISOString(),
          player: {
            id: String(player.id),
            name: player.name || (player.position === "TG" ? ((player.nhlTeam || "NHL") + " Team Goalies") : "Drafted Player"),
            position: player.position,
            nhlTeam: player.nhlTeam,
            gamesPlayed: player.gamesPlayed || 0,
            goals: player.goals || 0,
            assists: player.assists || 0,
            points: player.points || 0,
            goalieGoals: player.goalieGoals || player.goals || 0,
            goalieAssists: player.goalieAssists || player.assists || 0,
            goalieWins: player.goalieWins || 0,
            goalieShutouts: player.goalieShutouts || 0,
            savePct: player.savePct || 0,
            goalsAgainstAverage: player.goalsAgainstAverage || 0,
            fantasyPoints: fp(player),
            fpts: fp(player)
          }
        });
      }

      async function signPlayer(id){
        await loadSharedDraft();
        if (isDraftClosed()) return toast("Rosters full. Draft closed.");
        const pick = currentPick();
        if (!pick) return toast("Rosters full. Draft closed.");
        if (String(pick.ownerId) !== String(activeOwnerId)) return toast(`It is ${ownerName(pick.ownerId)}'s pick. Select that team to draft for them.`);
        const player = players.find(p => String(p.id) === String(id));
        if (!player) return toast("Player not found. Pull NHL players again.");
        if (!canOwnerDraftPosition(activeOwnerId, player.position)) return toast("That roster position is full.");

        const ok = confirm(`Draft ${player.name} to ${ownerName(activeOwnerId)}?`);
        if (!ok) return;

        pushPick(pick, player);
        await saveSharedDraft();
        toast(`Drafted ${player.name} to ${ownerName(activeOwnerId)}.`);
        renderRoom();
        if (window.liveLottery && window.liveLottery.refreshLiveDraftTicker) await window.liveLottery.refreshLiveDraftTicker(true);
      }

      async function autoDraftEntireDraft(){
        await loadSharedDraft();
        clearRostersManuallyCleared();
        if (draft) { draft.__manualRosterReset = false; delete draft.__rostersClearedAt; }
        if (isDraftClosed()) { showDraftClosed("Rosters full. Draft closed."); return toast("Rosters full. Draft closed."); }
        if (!playersLoaded || !players.length) {
          await pullPlayers();
          if (!playersLoaded || !players.length) return toast("Could not load NHL players for auto draft.");
        }
        if (!confirm("Auto draft the entire remaining draft?")) return;
        let made = 0;
        let guard = 0;
        let stopped = "";
        while (currentPick() && guard < 500){
          guard++;
          const pick = currentPick();
          const player = autoPlayer(pick.ownerId);
          if (!player) {
            const c = rosterCounts(pick.ownerId);
            stopped = `Stopped at pick ${pick.pickNumber}: ${ownerName(pick.ownerId)} needs F ${Math.max(0,LIMITS.F-c.F)}, D ${Math.max(0,LIMITS.D-c.D)}, G ${Math.max(0,LIMITS.G-c.G)}. Check if the NHL player pool loaded enough eligible players.`;
            break;
          }
          pushPick(pick, player);
          made++;
        }
        await saveSharedDraft();
        renderRoom();
        if (window.liveLottery && window.liveLottery.refreshLiveDraftTicker) await window.liveLottery.refreshLiveDraftTicker(true);
        toast(stopped || `Auto drafted ${made} picks.`);
      }

      async function resetLiveDraft(){
        if (!confirm("Reset the shared live draft picks for everyone?")) return;
        markRostersManuallyCleared();
        draft = window.officialDraftApi ? await window.officialDraftApi.reset() : defaultDraft();
        draft.draftOrder = draftOrder();
        draft.picks = [];
        draft.draftClosed = false;
        delete draft.__seasonLockedRecord;
        delete draft.__fromStaticSeasonRecord;
        draft.__manualRosterReset = true;
        draft.__rostersClearedAt = new Date().toISOString();
        await saveSharedDraft();
        window.__currentLiveDraft = draft;
        if (window.renderDraftRosters) window.renderDraftRosters(draft);
        renderRoom();
        toast("Shared live draft reset. Rosters are now blank for the next draft.");
      }

      async function startRoom(){
        await loadSharedDraft();
        const order = lotteryOrderFromStorage();
        if (order && (!draft.draftOrder || !draft.draftOrder.length || JSON.stringify(draft.draftOrder) === JSON.stringify(OWNERS.map(o=>o.id)))) {
          draft.draftOrder = order;
          await saveSharedDraft();
        }
        const select = $("#cleanDraftAsSelect");
        if (select) {
          select.value = activeOwnerId;
          select.onchange = () => {
            activeOwnerId = select.value || "nick";
            localStorage.setItem("custom-hockey-pool-active-owner", activeOwnerId);
            sendPresence();
            renderRoom();
          };
        }
        renderRoom();
        startPolling();
        startPresence();
        setTimeout(updateMobileStickyRosterNeeds, 100);
      }

      async function refreshRoom(){
        await loadSharedDraft();
        renderRoom();
      }

      function startPolling(){
        clearInterval(poll);
        poll = setInterval(refreshRoom, 5000);
      }

      document.addEventListener("click", async (event) => {
        const reset = event.target.closest && event.target.closest("#resetLiveDraftBtn, #adminResetDraftBtn, #resetDraftBtn, [data-reset-draft]");
        if (reset) {
          event.preventDefault();
          event.stopPropagation();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          await resetLiveDraft();
          return;
        }

        const pull = event.target.closest && event.target.closest("#v46PullNhlPlayersBtn, #cleanRetryPlayers, #cleanRefreshBtn");
        if (pull) {
          event.preventDefault();
          if (!activeOwnerId) activeOwnerId = $("#cleanDraftAsSelect")?.value || "nick";
          await loadSharedDraft();
          await pullPlayers();
          return;
        }

        const sign = event.target.closest && event.target.closest("[data-clean-sign]");
        if (sign) {
          event.preventDefault();
          await signPlayer(sign.dataset.cleanSign);
          return;
        }

        const row = event.target.closest && event.target.closest("[data-mobile-sign]");
        if (row && window.matchMedia && window.matchMedia("(max-width: 820px)").matches && !event.target.closest("button,select,a,input,textarea")) {
          event.preventDefault();
          const btn = row.querySelector("[data-clean-sign]");
          if (btn && !btn.disabled) await signPlayer(row.dataset.mobileSign);
          return;
        }

        const sort = event.target.closest && event.target.closest("[data-sort-key]");
        if (sort) {
          event.preventDefault();
          sortKey = sort.dataset.sortKey || "fantasyPoints";
          renderRoom();
          return;
        }

        const auto = event.target.closest && event.target.closest("#cleanAutoDraftBtn");
        if (auto) {
          event.preventDefault();
          await autoDraftEntireDraft();
          return;
        }
      }, true);

      document.addEventListener("change", (event) => {
        const pos = event.target.closest && event.target.closest("#cleanPositionFilter, #cleanMobilePositionFilter");
        if (pos) {
          positionFilter = pos.value || "F";
          sortKey = "fantasyPoints";
          renderRoom();
        }
      }, true);

      window.addEventListener("draft-tab-opened", () => setTimeout(startRoom, 25));
      window.addEventListener("load", () => setTimeout(startRoom, 250));
      window.addEventListener("scroll", updateMobileStickyRosterNeeds, { passive:true });
      window.addEventListener("resize", () => { setTimeout(alignDesktopDraftBoard, 50); setTimeout(updateMobileStickyRosterNeeds, 60); });
      window.v91DraftRoom = { startRoom, pullPlayers, refreshRoom, resetLiveDraft, alignDesktopDraftBoard, updateMobileStickyRosterNeeds };
    })();
  