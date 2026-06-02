
  /* Center the wide roster-room image on mobile after each room render.
     This keeps the image full-height while letting the user pan left/right. */
  (function(){
    function centerRosterStage(){
      if (!window.matchMedia || !window.matchMedia('(max-width: 760px)').matches) return;
      const activeRosters = document.querySelector('#rosters.active');
      if (!activeRosters) return;
      activeRosters.querySelectorAll('.v174-stall-stage').forEach(stage => {
        requestAnimationFrame(() => {
          const max = Math.max(0, stage.scrollWidth - stage.clientWidth);
          if (max > 0) stage.scrollLeft = Math.round(max / 2);
        });
      });
    }
    document.addEventListener('click', () => setTimeout(centerRosterStage, 80), true);
    window.addEventListener('resize', () => setTimeout(centerRosterStage, 120));
    window.addEventListener('load', () => setTimeout(centerRosterStage, 250));
    const mo = new MutationObserver(() => setTimeout(centerRosterStage, 80));
    mo.observe(document.documentElement, {childList:true, subtree:true, attributes:true, attributeFilter:['class']});
  })();


    // V116: replay button hard override. This is registered early and blocks the old lottery video handler.
    document.addEventListener("click", function(event){
      const replay = event.target.closest && event.target.closest("#replayLotteryBtn, [data-replay-live-lottery]");
      if (!replay) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      if (window.liveLottery && typeof window.liveLottery.replayCurrentLottery === "function") {
        window.liveLottery.replayCurrentLottery();
      } else {
        window.__pendingLiveLotteryReplay = true;
      }
    }, true);
  

    // V56: global-safe Team Goalies helper. Prevents buildTeamGoalies/teamBuildGoalies scope errors.
    window.buildTeamGoalies = function(goalies) {
      var byTeam = new Map();
      (Array.isArray(goalies) ? goalies : []).forEach(function(g) {
        var team = g.nhlTeam || g.teamAbbrev || g.team || "TEAM";
        if (!byTeam.has(team)) {
          byTeam.set(team, {
            id: "TG-" + team,
            name: team + " Team Goalies",
            position: "TG",
            nhlTeam: team,
            gamesPlayed: 0,
            goals: 0,
            assists: 0,
            points: 0,
            goalieWins: 0,
            goalieShutouts: 0,
            saves: 0,
            shotsAgainst: 0,
            goalsAgainst: 0,
            weightedGaa: 0,
            weightedSavePct: 0,
            type: "teamGoalie"
          });
        }

        var t = byTeam.get(team);
        var gp = Number(g.gamesPlayed || 0);
        var saves = Number(g.saves || 0);
        var shotsAgainst = Number(g.shotsAgainst || 0);
        var goalsAgainst = Number(g.goalsAgainst || 0);
        var savePct = Number(g.savePct || g.savePercentage || 0);
        var gaa = Number(g.goalsAgainstAverage || g.gaa || 0);

        t.gamesPlayed += gp;
        t.goals = Number(t.goals || 0) + Number(g.goals || g.goalieGoals || 0);
        t.assists = Number(t.assists || 0) + Number(g.assists || g.goalieAssists || 0);
        t.goalieWins += Number(g.goalieWins || g.wins || 0);
        t.goalieShutouts += Number(g.goalieShutouts || g.shutouts || 0);
        t.saves += saves;
        t.shotsAgainst += shotsAgainst;
        t.goalsAgainst += goalsAgainst;
        t.weightedGaa += gaa * gp;
        t.weightedSavePct += savePct * gp;
      });

      return Array.from(byTeam.values()).map(function(t) {
        t.savePct = t.shotsAgainst > 0 ? Number((t.saves / t.shotsAgainst).toFixed(3)) : Number((t.weightedSavePct / Math.max(1, t.gamesPlayed)).toFixed(3));
        t.goalsAgainstAverage = t.gamesPlayed > 0 ? Number((t.weightedGaa / Math.max(1, t.gamesPlayed)).toFixed(2)) : 0;
        t.fantasyPoints = Math.round((Number(t.goalieWins || 0) * 2) + (Number(t.goals || 0) * 10) + (Number(t.assists || 0) * 5) + (Number(t.goalieShutouts || 0) * 5));
        return t;
      });
    };

    // Alias for the typo/alternate wording if anything calls it.
    window.teamBuildGoalies = window.buildTeamGoalies;
  

    // V86 official shared draft controller.
    // One source of truth: /api/draft. localStorage is backup only after API loads.
    (function(){
      const KEY = "custom-hockey-pool-v40-clean-live-draft";
      const OWNERS = [
        { id:"nick", name:"Nick", teamName:"Nick" },
        { id:"chris", name:"Chris", teamName:"Chris" },
        { id:"andrew", name:"Andrew", teamName:"Andrew" },
        { id:"tyler", name:"Tyler", teamName:"Tyler" },
        { id:"scott", name:"Scott", teamName:"Scott" }
      ];

      function defaultDraft(){
        return {
          owners: OWNERS,
          draftOrder: OWNERS.map(o => o.id),
          picks: [],
          updatedAt: new Date().toISOString()
        };
      }

      function validDraft(draft){
        return draft && Array.isArray(draft.owners) && Array.isArray(draft.picks);
      }

      function backup(draft){
        try { localStorage.setItem(KEY, JSON.stringify(draft)); } catch(e) {}
      }

      async function loadSharedDraftOfficial(){
        try{
          const res = await fetch("/api/draft?t=" + Date.now(), { cache:"no-store" });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data && data.draft && Array.isArray(data.draft.picks)) {
            const draft = validDraft(data.draft) ? data.draft : Object.assign(defaultDraft(), data.draft || {});
            draft.__source = data.configured ? "shared API persistent" : "shared API temporary";
            draft.__configured = data.configured;
            draft.__storage = data.storage || "api";
            draft.__mode = data.mode || (data.configured ? "persistent" : "temporary");
            backup(draft);
            return draft;
          }

          const empty = defaultDraft();
          try {
            if (localStorage.getItem("custom-hockey-pool-rosters-manually-cleared") === "true") {
              empty.__manualRosterReset = true;
              empty.__rostersClearedAt = new Date().toISOString();
            }
          } catch(e) {}
          empty.__source = data && data.configured === false ? "shared API empty temporary" : "shared API empty";
          empty.__configured = data ? data.configured : null;
          empty.__storage = data ? data.storage : "api";
          empty.__mode = data ? data.mode : "unknown";
          backup(empty);
          return empty;
        }catch(error){
          const empty = defaultDraft();
          empty.__source = "shared API unavailable";
          empty.__configured = null;
          empty.__storage = "unavailable";
          empty.__mode = "error";
          empty.__error = String(error && error.message || error);
          return empty;
        }
      }

      async function saveSharedDraftOfficial(draft){
        const clean = validDraft(draft) ? draft : defaultDraft();
        clean.updatedAt = new Date().toISOString();
        backup(clean);

        const res = await fetch("/api/draft", {
          method:"POST",
          headers:{ "Content-Type":"application/json" },
          body: JSON.stringify(clean)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || "Shared draft save failed.");

        const saved = data.draft && Array.isArray(data.draft.picks) ? data.draft : clean;
        if (clean.__manualRosterReset) saved.__manualRosterReset = true;
        if (clean.__rostersClearedAt) saved.__rostersClearedAt = clean.__rostersClearedAt;
        saved.__source = data.configured ? "shared API persistent" : "shared API temporary";
        saved.__configured = data.configured;
        saved.__storage = data.storage || "api";
        saved.__mode = data.mode || (data.configured ? "persistent" : "temporary");
        backup(saved);
        return saved;
      }

      async function resetSharedDraftOfficial(){
        try { await fetch("/api/draft", { method:"DELETE" }); } catch(e) {}
        const fresh = defaultDraft();
        fresh.picks = [];
        fresh.draftClosed = false;
        fresh.__manualRosterReset = true;
        fresh.__rostersClearedAt = new Date().toISOString();
        try { localStorage.setItem("custom-hockey-pool-rosters-manually-cleared", "true"); } catch(e) {}
        return saveSharedDraftOfficial(fresh).catch(() => fresh);
      }

      function describeDraft(draft){
        const count = draft && Array.isArray(draft.picks) ? draft.picks.length : 0;
        const source = draft && draft.__source ? draft.__source : "unknown";
        const storage = draft && draft.__storage ? draft.__storage : "";
        const mode = draft && draft.__mode ? draft.__mode : "";
        const updated = draft && draft.updatedAt ? new Date(draft.updatedAt).toLocaleString() : "not saved";
        return `Source: ${source}${storage ? " / " + storage : ""}${mode ? " / " + mode : ""} • Picks: ${count} • Updated: ${updated}`;
      }

      function updateSourceStatus(draft){
        const text = describeDraft(draft);
        ["homeRosterSourceStatus","draftRoomSourceStatus","rostersSourceStatus"].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.textContent = text;
        });
      }

      window.officialDraftApi = {
        load: async function(){
          const draft = await loadSharedDraftOfficial();
          updateSourceStatus(draft);
          return draft;
        },
        save: async function(draft){
          const saved = await saveSharedDraftOfficial(draft);
          updateSourceStatus(saved);
          return saved;
        },
        reset: async function(){
          const fresh = await resetSharedDraftOfficial();
          updateSourceStatus(fresh);
          return fresh;
        },
        describe: describeDraft,
        updateSourceStatus,
        defaultDraft,
        backupKey: KEY
      };
    })();
  

    // V49: global-safe roster needs renderer. This prevents renderRosterNeeds scope errors.
    window.__draftRosterLimits = { F: 6, D: 4, G: 2 };

    window.__draftBucket = function(position) {
      if (position === "G" || position === "TG") return "G";
      if (position === "D") return "D";
      return "F";
    };

    window.canOwnerDraftPosition = function(draft, ownerId, position) {
      var counts = { F: 0, D: 0, G: 0 };
      try {
        var picks = draft && Array.isArray(draft.picks) ? draft.picks : [];
        picks.forEach(function(p) {
          if (String(p.ownerId) !== String(ownerId)) return;
          var bucket = window.__draftBucket(p.player && p.player.position);
          counts[bucket] = (counts[bucket] || 0) + 1;
        });
      } catch (e) {}

      var bucket = window.__draftBucket(position);
      var limits = window.__draftRosterLimits || { F: 6, D: 4, G: 2 };
      return Math.max(0, (limits[bucket] || 0) - (counts[bucket] || 0)) > 0;
    };

    window.renderRosterNeeds = function(draft, ownerId, ownerName) {
      var panel = document.getElementById("cleanRosterNeedsPanel");
      if (!panel) return;

      if (!ownerId) {
        panel.innerHTML = '<div class="needs-placeholder"><strong>Select a team to see roster needs.</strong><span>Limits: 10 skaters, 2 goalies</span></div>';
        return;
      }

      var counts = { F: 0, D: 0, G: 0 };
      try {
        var picks = draft && Array.isArray(draft.picks) ? draft.picks : [];
        picks.forEach(function(p) {
          if (String(p.ownerId) !== String(ownerId)) return;
          var bucket = window.__draftBucket(p.player && p.player.position);
          counts[bucket] = (counts[bucket] || 0) + 1;
        });
      } catch (e) {}

      var limits = window.__draftRosterLimits;
      var remF = Math.max(0, limits.F - (counts.F || 0));
      var remD = Math.max(0, limits.D - (counts.D || 0));
      var remG = Math.max(0, limits.G - (counts.G || 0));

      panel.innerHTML =
        '<div class="needs-title needs-title-swapped"><strong class="needs-team-name">' + (ownerName || ownerId) + '</strong><span class="eyebrow needs-heading-centered">Roster Needs</span></div>' +
        '<div class="needs-grid">' +
          '<div class="' + (remF === 0 ? 'filled' : '') + '"><span>Forwards needed</span><strong>' + remF + '</strong><em>' + (counts.F || 0) + '/6 drafted</em></div>' +
          '<div class="' + (remD === 0 ? 'filled' : '') + '"><span>Defense needed</span><strong>' + remD + '</strong><em>' + (counts.D || 0) + '/4 drafted</em></div>' +
          '<div class="' + (remG === 0 ? 'filled' : '') + '"><span>Goalies needed</span><strong>' + remG + '</strong><em>' + (counts.G || 0) + '/2 drafted</em></div>' +
        '</div>';
    };
  

    // Tiny no-dependency tab fallback so navigation still works even if a module error happens.
    document.addEventListener('click', function (event) {
      var btn = event.target.closest && event.target.closest('[data-tab]');
      if (!btn) return;
      var tab = btn.getAttribute('data-tab');
      var panel = document.getElementById(tab);
      if (!panel) return;
      document.querySelectorAll('.tab').forEach(function (b) { b.classList.toggle('active', b === btn); });
      document.querySelectorAll('.panel').forEach(function (p) { p.classList.toggle('active', p.id === tab); });
      document.body.dataset.activeTab = tab;
      if (tab === 'draft') {
        window.dispatchEvent(new CustomEvent('draft-tab-opened'));
      }
    });
  

    (function () {
      "use strict";
      var KEY = "custom-hockey-pool-v30-popout-emergency";
      var OWNERS = [
        { id: "nick", teamName: "Nick" },
        { id: "chris", teamName: "Chris" },
        { id: "andrew", teamName: "Andrew" },
        { id: "tyler", teamName: "Tyler" },
        { id: "scott", teamName: "Scott" }
      ];

      function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
          return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
        });
      }
      function get() {
        try {
          var raw = localStorage.getItem(KEY);
          if (raw) {
            var state = JSON.parse(raw);
            if (Array.isArray(state.owners) && state.owners.length) return state;
          }
        } catch (e) {}
        return { owners: OWNERS.slice(), lotteryOrder: null };
      }
      function save(state) {
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
      }
      function shuffle(ids) {
        var a = ids.slice();
        for (var i = a.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
      }
      function suffix(n) { return n === 1 ? "ST" : n === 2 ? "ND" : n === 3 ? "RD" : "TH"; }
      function toast(msg) {
        var t = document.getElementById("toast");
        if (!t) return;
        t.textContent = msg;
        t.classList.add("show");
        setTimeout(function () { t.classList.remove("show"); }, 2500);
      }
      function paintTeams() {
        var state = get();
        var list = document.getElementById("teamManagerList");
        if (list) {
          list.innerHTML = state.owners.map(function (o) {
            return '<div class="mini-list-row roster-manager-row team-manager-row"><div><strong>' + esc(o.teamName) + '</strong><div class="meta">active owner</div></div><span class="badge">OWNER</span></div>';
          }).join("");
        }
        var select = document.getElementById("removeOwnerSelect");
        if (select) {
          select.innerHTML = state.owners.map(function (o) {
            return '<option value="' + esc(o.id) + '">' + esc(o.teamName) + ' — 0 players</option>';
          }).join("");
        }
      }
      function paintInlineSummary(orderIds) {
        var state = get();
        var results = document.getElementById("lotteryResults");
        var status = document.getElementById("lotteryStatus");
        if (!results) return;
        if (!orderIds || !orderIds.length) {
          if (status) status.textContent = "LOTTERY NOT COMPLETED YET";
          results.innerHTML = '<div class="lottery-not-complete">LOTTERY NOT COMPLETED YET</div>';
          return;
        }
        if (status) status.textContent = "Mission complete. Draft order locked until Reset Draft.";
        results.innerHTML = '<div class="inline-lottery-summary">' +
          '<strong>Draft order locked:</strong>' +
          orderIds.map(function (id, i) {
            var owner = state.owners.find(function (o) { return o.id === id; }) || { teamName: id };
            return '<div><span>' + (i + 1) + '</span><b>' + esc(owner.teamName) + '</b></div>';
          }).join("") +
          '<button class="primary" id="popoutLotteryBtn" type="button">Watch Lottery Pop-Out</button>' +
        '</div>';
      }
      function ensurePopout() {
        var existing = document.getElementById("lotteryPopoutOverlay");
        if (existing) return existing;

        var overlay = document.createElement("div");
        overlay.id = "lotteryPopoutOverlay";
        overlay.className = "lottery-popout-overlay";
        overlay.innerHTML =
          '<div class="lottery-popout-shell">' +
            '<button class="lottery-popout-close" id="closeLotteryPopout" type="button">Close ×</button>' +
            '<div class="pop-stage" id="popStage"></div>' +
          '</div>';
        document.body.appendChild(overlay);
        return overlay;
      }
      function renderPopout(orderIds) {
        var state = get();
        var overlay = ensurePopout();
        var stage = document.getElementById("popStage");
        var orderOwners = orderIds.map(function (id) {
          return state.owners.find(function (o) { return o.id === id; }) || { id: id, teamName: id };
        });

        stage.innerHTML =
          '<div class="pop-bg"></div>' +
          '<div class="pop-title"><span>2026</span><strong>HOCKEY POOL DRAFT LOTTERY</strong><small>Equal Odds • Locked Replay</small></div>' +
          '<div class="pop-host clean-announcer">' +
            '<div class="pop-bubble">I&#39;M GARY BETTMAN</div>' +
            '<svg class="clean-announcer-svg" viewBox="0 0 220 340" role="img" aria-label="cartoon penguin announcer">' +
              '<defs>' +
                '<linearGradient id="skinClean" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f0c29a"/><stop offset="1" stop-color="#c9875f"/></linearGradient>' +
                '<linearGradient id="suitClean" x1="0" x2="1"><stop offset="0" stop-color="#0a2654"/><stop offset=".5" stop-color="#2a65ad"/><stop offset="1" stop-color="#061b3c"/></linearGradient>' +
                '<linearGradient id="hairClean" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#d8dde3"/><stop offset=".55" stop-color="#939ca6"/><stop offset="1" stop-color="#5d6670"/></linearGradient>' +
              '</defs>' +
              '<g class="clean-body">' +
                '<ellipse cx="110" cy="214" rx="63" ry="98" fill="#06090e" stroke="#010306" stroke-width="5"/>' +
                '<ellipse cx="110" cy="225" rx="35" ry="67" fill="#eef3f7"/>' +
                '<path d="M57 156 C31 180 26 224 44 252 C55 267 76 257 68 239 C58 218 66 189 89 170 Z" fill="#06090e" stroke="#010306" stroke-width="5" class="leftFlipper"/>' +
                '<path d="M163 156 C189 180 194 224 176 252 C165 267 144 257 152 239 C162 218 154 189 131 170 Z" fill="#06090e" stroke="#010306" stroke-width="5" class="rightFlipper"/>' +
                '<path d="M70 145 C82 126 96 119 110 119 C124 119 138 126 150 145 L143 247 C124 260 96 260 77 247 Z" fill="url(#suitClean)" stroke="#03142c" stroke-width="4"/>' +
                '<path d="M91 130 L129 130 L121 239 C114 245 106 245 99 239 Z" fill="#f3f7fb"/>' +
                '<path d="M110 138 L121 156 L115 232 L104 232 L99 156 Z" fill="#17345d"/>' +
                '<path d="M73 311 C91 302 104 309 105 325 C87 331 72 330 58 322 C59 317 64 313 73 311 Z" fill="#e8a133" stroke="#5a2e07" stroke-width="3"/>' +
                '<path d="M147 311 C129 302 116 309 115 325 C133 331 148 330 162 322 C161 317 156 313 147 311 Z" fill="#e8a133" stroke="#5a2e07" stroke-width="3"/>' +
              '</g>' +
              '<g class="clean-head">' +
                '<path d="M68 56 C70 27 88 12 110 12 C133 12 151 28 152 57 C153 88 136 109 112 111 C88 113 67 89 68 56 Z" fill="url(#skinClean)" stroke="#3b1b0f" stroke-width="4"/>' +
                '<path d="M73 43 C79 22 92 11 110 11 C129 11 144 24 148 45 C131 36 90 35 73 43 Z" fill="url(#hairClean)" stroke="#4c5661" stroke-width="3"/>' +
                '<path d="M68 51 C55 60 58 82 72 78" fill="none" stroke="#c7ced6" stroke-width="9" stroke-linecap="round"/>' +
                '<path d="M151 51 C165 60 161 83 148 79" fill="none" stroke="#c7ced6" stroke-width="9" stroke-linecap="round"/>' +
                '<path d="M87 58 C94 54 101 54 106 58" stroke="#543927" stroke-width="4" fill="none" stroke-linecap="round"/>' +
                '<path d="M116 58 C123 54 131 55 136 59" stroke="#543927" stroke-width="4" fill="none" stroke-linecap="round"/>' +
                '<ellipse cx="96" cy="69" rx="4" ry="4" fill="#090909"/>' +
                '<ellipse cx="126" cy="69" rx="4" ry="4" fill="#090909"/>' +
                '<path d="M112 69 C109 76 109 83 116 85" stroke="#8b5438" stroke-width="3" fill="none" stroke-linecap="round"/>' +
                '<ellipse cx="117" cy="84" rx="3" ry="2" fill="#7b3d27" opacity=".55"/>' +
                '<path class="mouthClosed" d="M98 96 C106 101 119 101 128 96" stroke="#5a2417" stroke-width="4" fill="none" stroke-linecap="round"/>' +
                '<ellipse class="mouthOpen" cx="113" cy="98" rx="16" ry="7" fill="#3b130d" stroke="#5a2417" stroke-width="2"/>' +
                '<path d="M88 27 C101 18 124 19 137 31" stroke="#e1e5ea" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/>' +
              '</g>' +
            '</svg>' +
          '</div>' +
          '<div class="pop-machine spin"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>' +
          '<div class="pop-seats">' + orderOwners.map(function (o) { return '<div class="manager-seat manager-' + esc(o.id) + '" data-owner="' + esc(o.id) + '"><b>#@!*%</b><div class="manager-head"></div><div class="manager-jersey"></div><div class="manager-chair"></div><span>' + esc(o.teamName) + '</span></div>'; }).join("") + '</div>' +
          '<div class="pop-card" id="popCard"><small>READY</small><strong>---</strong></div>' +
          '<ol class="pop-results" id="popResults"></ol>' +
          '<div class="pop-lower" id="popLower">WELCOME TO THE <span>HOCKEY POOL DRAFT LOTTERY</span></div>';

        overlay.classList.add("show");
        document.body.classList.add("lottery-popout-open");

        var card = document.getElementById("popCard");
        var results = document.getElementById("popResults");
        var lower = document.getElementById("popLower");
        var reveal = orderOwners.slice().reverse();
        var i = 0;

        function step() {
          if (!overlay.classList.contains("show")) return;
          if (i >= reveal.length) {
            if (lower) lower.innerHTML = 'DRAFT ORDER <span>LOCKED</span>';
            var machine = stage.querySelector(".pop-machine");
            if (machine) machine.classList.remove("spin");
            return;
          }
          var owner = reveal[i];
          var pick = reveal.length - i;
          if (lower) lower.innerHTML = 'THE ' + pick + suffix(pick) + ' PICK GOES TO <span>' + esc(owner.teamName).toUpperCase() + '</span>';
          if (card) card.innerHTML = '<small>' + pick + suffix(pick) + ' OVERALL</small><strong>' + esc(owner.teamName) + '</strong>';
          var seat = stage.querySelector('[data-owner="' + CSS.escape(owner.id) + '"]');
          if (seat) {
            seat.classList.remove("mad");
            void seat.offsetWidth;
            seat.classList.add("mad");
          }
          if (results) {
            results.insertAdjacentHTML("afterbegin", '<li><span>' + pick + '</span><strong>' + esc(owner.teamName) + '</strong></li>');
          }
          i++;
          setTimeout(step, 1300);
        }

        setTimeout(step, 650);
      }
      function run() {
        var state = get();
        if (!state.lotteryOrder) {
          state.lotteryOrder = shuffle(state.owners.map(function (o) { return o.id; }));
          save(state);
          toast("Lottery locked.");
        } else {
          toast("Replaying locked lottery.");
        }
        paintTeams();
        paintInlineSummary(state.lotteryOrder);
        renderPopout(state.lotteryOrder);
      }
      function reset() {
        var state = get();
        state.lotteryOrder = null;
        state.owners = state.owners && state.owners.length ? state.owners : OWNERS.slice();
        save(state);
        paintTeams();
        paintInlineSummary(null);
        toast("Draft and lottery reset.");
      }
      function restore() {
        save({ owners: OWNERS.slice(), lotteryOrder: null });
        paintTeams();
        paintInlineSummary(null);
        toast("Final five teams restored.");
      }
      function closePopout() {
        var overlay = document.getElementById("lotteryPopoutOverlay");
        if (overlay) overlay.classList.remove("show");
        document.body.classList.remove("lottery-popout-open");
      }

      document.addEventListener("click", function (event) {
        var runBtn = event.target.closest && event.target.closest("#runLotteryBtn, #popoutLotteryBtn");
        if (runBtn) {
          event.preventDefault();
          event.stopPropagation();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          var state = get();
          if (runBtn.id === "popoutLotteryBtn" && state.lotteryOrder) {
            renderPopout(state.lotteryOrder);
          } else {
            run();
          }
          return;
        }
        var resetBtn = event.target.closest && event.target.closest("#resetDraftBtn");
        if (resetBtn) {
          event.preventDefault();
          event.stopPropagation();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          reset();
          return;
        }
        var draftRoomBtn = event.target.closest && event.target.closest('[data-draft-room="board"]');
        if (draftRoomBtn) {
          event.preventDefault();
          event.stopPropagation();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          enterDraftRoomFallback();
          return;
        }

        var restoreBtn = event.target.closest && event.target.closest("#restoreFinalOwnersBtn, #loadSampleOwnersBtn");
        if (restoreBtn) {
          event.preventDefault();
          event.stopPropagation();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          restore();
          return;
        }
        var closeBtn = event.target.closest && event.target.closest("#closeLotteryPopout");
        if (closeBtn) {
          event.preventDefault();
          closePopout();
          return;
        }
        var overlay = event.target && event.target.id === "lotteryPopoutOverlay";
        if (overlay) {
          closePopout();
          return;
        }
      }, true);


      function enterDraftRoomFallback() {
        try { localStorage.setItem("custom-hockey-pool-active-owner", "nick"); } catch (e) {}

        var info = document.getElementById("draftInfoRoom");
        var board = document.getElementById("draftBoardPanel");
        if (info) info.classList.remove("active");
        if (board) {
          board.classList.add("active");
          board.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        document.querySelectorAll("[data-draft-room]").forEach(function (btn) {
          btn.classList.toggle("active", btn.dataset.draftRoom === "board");
        });

        var select = document.getElementById("activeDraftOwnerSelect");
        if (select) {
          if (!select.options.length) {
            select.innerHTML = OWNERS.map(function (o) {
              return '<option value="' + esc(o.id) + '">' + esc(o.teamName) + '</option>';
            }).join("");
          }
          select.value = "nick";
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }

        var label = document.getElementById("activeDraftOwnerLabel");
        if (label) label.textContent = "Nick";

        toast("Entered Draft Room as Nick. Use the Drafting As selector to switch teams.");
      }

      window.addEventListener("load", function () {
        setTimeout(function () {
          var state = get();
          paintTeams();
          paintInlineSummary(state.lotteryOrder);
        }, 200);
      });
    })();
  

    (function () {
      "use strict";

      var KEY = "custom-hockey-pool-v38-official-snake";
      var OWNERS = [
        { id: "nick", name: "Nick", teamName: "Nick" },
        { id: "chris", name: "Chris", teamName: "Chris" },
        { id: "andrew", name: "Andrew", teamName: "Andrew" },
        { id: "tyler", name: "Tyler", teamName: "Tyler" },
        { id: "scott", name: "Scott", teamName: "Scott" }
      ];
      var activeOwnerId = localStorage.getItem("custom-hockey-pool-active-owner") || "";
      var players = [];
      var playersLoaded = false;
      var playersLoading = false;
      var draftState = null;
      var pollTimer = null;
      var sortKey = "fantasyPoints";
      var sortDirection = "desc";
      var adminMode = true; // You wanted to be able to switch teams and pick for people if needed.

      function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
          return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
        });
      }
      function toast(message) {
        var t = document.getElementById("toast");
        if (!t) return;
        t.textContent = message;
        t.classList.add("show");
        setTimeout(function () { t.classList.remove("show"); }, 2600);
      }
      function currentSeasonId() {
        return "20252026";
      }
      function defaultState() {
        return {
          owners: OWNERS.slice(),
          draftOrder: null,
          picks: [],
          updatedAt: new Date().toISOString()
        };
      }
      function getLocalState() {
        try {
          var raw = localStorage.getItem(KEY);
          if (raw) {
            var parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.owners) && Array.isArray(parsed.picks)) return parsed;
          }
        } catch (e) {}
        return defaultState();
      }
      function saveLocalState(state) {
        draftState = state;
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
      }
      function ownerById(id) {
        return (draftState && draftState.owners || OWNERS).find(function (o) { return String(o.id) === String(id); }) || null;
      }
      function lotteryOrderFromPageOrStorage() {
        // Prefer the current inline lottery script storage if present.
        var possibleKeys = [
          "custom-hockey-pool-v30-popout-emergency",
          "custom-hockey-pool-v29-inline-emergency",
          "custom-hockey-pool-v28-hard-bypass-fallback"
        ];
        for (var k = 0; k < possibleKeys.length; k++) {
          try {
            var raw = localStorage.getItem(possibleKeys[k]);
            if (!raw) continue;
            var parsed = JSON.parse(raw);
            if (Array.isArray(parsed.lotteryOrder) && parsed.lotteryOrder.length === OWNERS.length) {
              return parsed.lotteryOrder.slice();
            }
          } catch (e) {}
        }
        var rows = Array.from(document.querySelectorAll("#lotteryResults .mini-item strong, #lotteryResults .inline-lottery-summary div b"));
        if (rows.length === OWNERS.length) {
          var names = rows.map(function (el) { return el.textContent.trim().toLowerCase(); });
          var mapped = names.map(function (name) {
            var owner = OWNERS.find(function (o) { return o.id === name || o.teamName.toLowerCase() === name; });
            return owner && owner.id;
          }).filter(Boolean);
          if (mapped.length === OWNERS.length) return mapped;
        }
        return null;
      }
      function officialOrder() {
        if (!draftState) draftState = getLocalState();
        if (Array.isArray(draftState.draftOrder) && draftState.draftOrder.length === draftState.owners.length) {
          return draftState.draftOrder.slice();
        }
        var lottery = lotteryOrderFromPageOrStorage();
        if (lottery && lottery.length === OWNERS.length) {
          draftState.draftOrder = lottery.slice();
          saveLocalState(draftState);
          saveDraftShared();
          return lottery.slice();
        }
        return null;
      }
      function rosterLimit() {
        var input = document.getElementById("totalRosterSize");
        var n = Number(input && input.value || 12);
        return Number.isFinite(n) && n > 0 ? n : 12;
      }
      function totalPickLimit() {
        return (draftState?.owners?.length || OWNERS.length) * rosterLimit();
      }
      function snakeOwnerForPickNumber(pickNumber) {
        var order = officialOrder();
        if (!order || !order.length) return null;
        var teamCount = order.length;
        var roundIndex = Math.floor((pickNumber - 1) / teamCount);
        var slotIndex = (pickNumber - 1) % teamCount;
        var ownerIndex = roundIndex % 2 === 0 ? slotIndex : teamCount - 1 - slotIndex;
        return {
          ownerId: order[ownerIndex],
          round: roundIndex + 1,
          slot: slotIndex + 1,
          ownerIndex: ownerIndex
        };
      }
      function currentPickInfo() {
        if (!draftState) draftState = getLocalState();
        var pickNumber = (draftState.picks || []).length + 1;
        var info = snakeOwnerForPickNumber(pickNumber);
        if (!info) return null;
        return Object.assign({ pickNumber: pickNumber }, info);
      }
      function draftedIds() {
        return new Set((draftState?.picks || []).map(function (p) { return String(p.player.id); }));
      }
      function fantasyPoints(p) {
        // Hockey Pool scoring: skater G=2, A=1, SHG=5, GWG=5; goalie W=2, A=5, G=10, SO=5.
        var g = Number(document.getElementById("goalPoints")?.value || 2);
        var a = Number(document.getElementById("assistPoints")?.value || 1);
        var shg = Number(document.getElementById("shortHandedGoalPoints")?.value || 5);
        var gwg = Number(document.getElementById("gameWinningGoalPoints")?.value || 5);
        var win = Number(document.getElementById("goalieWinPoints")?.value || 2);
        var goalieA = Number(document.getElementById("goalieAssistPoints")?.value || 5);
        var goalieG = Number(document.getElementById("goalieGoalPoints")?.value || 10);
        var so = Number(document.getElementById("goalieShutoutPoints")?.value || 5);
        if (p.position === "G" || p.position === "TG") return Math.round((Number(p.goalieWins || 0) * win) + (Number(p.goalieGoals || p.goals || 0) * goalieG) + (Number(p.goalieAssists || p.assists || 0) * goalieA) + (Number(p.goalieShutouts || 0) * so));
        return Math.round((Number(p.goals || 0) * g) + (Number(p.assists || 0) * a) + (Number(p.shortHandedGoals || 0) * shg) + (Number(p.gameWinningGoals || 0) * gwg));
      }
      function normalizeSkater(row) {
        var first = row.firstName || row.firstNameDefault || "";
        var last = row.lastName || row.lastNameDefault || "";
        var name = row.skaterFullName || row.playerFullName || row.fullName || (first + " " + last).trim();
        return {
          id: String(row.playerId || row.skaterId || row.id || name),
          name: name,
          position: row.positionCode || row.position || "F",
          nhlTeam: row.teamAbbrevs || row.teamAbbrev || row.team || "",
          gamesPlayed: Number(row.gamesPlayed || 0),
          goals: Number(row.goals || 0),
          assists: Number(row.assists || 0),
          points: Number(row.points || 0),
          shortHandedGoals: Number(row.shGoals || row.shortHandedGoals || 0),
          gameWinningGoals: Number(row.gameWinningGoals || row.gwGoals || 0),
          goalieWins: 0,
          goalieShutouts: 0
        };
      }
      function normalizeGoalie(row) {
        var first = row.firstName || row.firstNameDefault || "";
        var last = row.lastName || row.lastNameDefault || "";
        var name = row.goalieFullName || row.playerFullName || row.fullName || (first + " " + last).trim();
        var saves = Number(row.saves || row.saveShotsAgainst || row.shotsSaved || 0);
        var shotsAgainst = Number(row.shotsAgainst || 0);
        var goalsAgainst = Number(row.goalsAgainst || 0);
        var savePct = Number(row.savePct || row.savePercentage || 0);
        var gaa = Number(row.goalsAgainstAverage || row.gaa || 0);
        return {
          id: String(row.playerId || row.goalieId || row.id || name) + "-G",
          name: name,
          position: "G",
          nhlTeam: row.teamAbbrevs || row.teamAbbrev || row.team || "",
          gamesPlayed: Number(row.gamesPlayed || 0),
          goals: Number(row.goals || 0),
          assists: Number(row.assists || 0),
          points: Number(row.points || 0),
          goalieGoals: Number(row.goals || row.goalieGoals || 0),
          goalieAssists: Number(row.assists || row.goalieAssists || 0),
          goalieWins: Number(row.wins || 0),
          goalieShutouts: Number(row.shutouts || 0),
          saves: saves,
          shotsAgainst: shotsAgainst,
          goalsAgainst: goalsAgainst,
          savePct: savePct,
          goalsAgainstAverage: gaa
        };
      }

      function buildTeamGoalies(goalies) {
        const byTeam = new Map();
        goalies.forEach(g => {
          const team = g.nhlTeam || "TEAM";
          if (!byTeam.has(team)) {
            byTeam.set(team, {
              id: "TG-" + team,
              name: team + " Team Goalies",
              position: "TG",
              nhlTeam: team,
              gamesPlayed: 0,
              goals: 0,
              assists: 0,
              points: 0,
              goalieWins: 0,
              goalieShutouts: 0,
              saves: 0,
              shotsAgainst: 0,
              goalsAgainst: 0,
              weightedGaa: 0,
              weightedSavePct: 0,
              type: "teamGoalie"
            });
          }
          const t = byTeam.get(team);
          const gp = Number(g.gamesPlayed || 0);
          t.gamesPlayed += gp;
          t.goalieWins += Number(g.goalieWins || 0);
          t.goalieShutouts += Number(g.goalieShutouts || 0);
          t.saves += Number(g.saves || 0);
          t.shotsAgainst += Number(g.shotsAgainst || 0);
          t.goalsAgainst += Number(g.goalsAgainst || 0);
          t.weightedGaa += Number(g.goalsAgainstAverage || 0) * gp;
          t.weightedSavePct += Number(g.savePct || 0) * gp;
        });

        return [...byTeam.values()].map(t => {
          t.savePct = t.shotsAgainst > 0 ? Number((t.saves / t.shotsAgainst).toFixed(3)) : Number((t.weightedSavePct / Math.max(1, t.gamesPlayed)).toFixed(3));
          t.goalsAgainstAverage = t.gamesPlayed > 0 ? Number((t.weightedGaa / t.gamesPlayed).toFixed(2)) : 0;
          t.fantasyPoints = fp(t);
          return t;
        });
      }
      async function fetchRealNhlPlayers() {
        if (playersLoading) return;
        if (playersLoaded && players.length) return;
        playersLoading = true;
        paintPlayersLoading();
        try {
          var season = currentSeasonId();
          var payload;
          try {
            var res = await fetch("/api/nhl?season=" + encodeURIComponent(season) + "&gameType=2&limit=1000", { cache: "no-store" });
            if (!res.ok) throw new Error("API HTTP " + res.status);
            payload = await res.json();
          } catch (proxyError) {
            // Direct NHL fallback for local testing.
            var skaterParams = new URLSearchParams({ isAggregate: "false", isGame: "false", start: "0", limit: "900", sort: "points", dir: "desc", cayenneExp: "seasonId=" + season + " and gameTypeId=2" });
            var defenseParams = new URLSearchParams({ isAggregate: "false", isGame: "false", start: "0", limit: "900", sort: "points", dir: "desc", cayenneExp: "seasonId=" + season + " and gameTypeId=2 and positionCode=\"D\"" });
            var goalieParams = new URLSearchParams({ isAggregate: "false", isGame: "false", start: "0", limit: "900", sort: "wins", dir: "desc", cayenneExp: "seasonId=" + season + " and gameTypeId=2" });
            var skaters = await fetch("https://api.nhle.com/stats/rest/en/skater/summary?" + skaterParams.toString()).then(function (r) { return r.json(); });
            var defense = await fetch("https://api.nhle.com/stats/rest/en/skater/summary?" + defenseParams.toString()).then(function (r) { return r.json(); });
            var goalies = await fetch("https://api.nhle.com/stats/rest/en/goalie/summary?" + goalieParams.toString()).then(function (r) { return r.json(); });
            var playerMap = new Map();
            [].concat(skaters.data || [], defense.data || []).forEach(function(row){ playerMap.set(String(row.playerId || row.skaterId || row.id || row.firstName + row.lastName), row); });
            payload = { skaters: Array.from(playerMap.values()), goalies: goalies.data || [] };
          }
          var map = new Map();
          (payload.skaters || []).map(normalizeSkater).filter(function (p) { return p.name; }).forEach(function (p) { map.set(p.id + "-" + p.position, p); });
          (payload.goalies || []).map(normalizeGoalie).filter(function (p) { return p.name; }).forEach(function (p) { map.set(p.id, p); });
          players = Array.from(map.values()).map(function (p) {
            p.fantasyPoints = fantasyPoints(p);
            return p;
          });
          playersLoaded = true;
          toast("Loaded " + players.length + " real NHL players.");
          renderOfficialDraftRoom();
        } catch (error) {
          console.error(error);
          paintPlayersError();
          toast("NHL API pull failed. Real players could not load.");
        } finally {
          playersLoading = false;
        }
      }
      function availablePlayers() {
        var taken = draftedIds();
        var posFilter = document.getElementById("draftPositionFilter")?.value || "all";
        var list = players.filter(function (p) { return !taken.has(String(p.id)); });
        if (posFilter === "F") list = list.filter(function (p) { return ["C","L","R","LW","RW","F"].includes(p.position); });
        else if (posFilter !== "all") list = list.filter(function (p) { return p.position === posFilter; });
        return list.sort(function (a, b) {
          var av = sortKey === "name" ? String(a.name).toLowerCase() : Number(sortKey === "fantasyPoints" ? fantasyPoints(a) : a[sortKey] || 0);
          var bv = sortKey === "name" ? String(b.name).toLowerCase() : Number(sortKey === "fantasyPoints" ? fantasyPoints(b) : b[sortKey] || 0);
          var dir = sortDirection === "asc" ? 1 : -1;
          if (typeof av === "string") return av.localeCompare(String(bv)) * dir;
          return (av - bv) * dir || a.name.localeCompare(b.name);
        }).slice(0, 900);
      }
      async function loadDraftShared() {
        try {
          var res = await fetch("/api/draft", { cache: "no-store" });
          if (!res.ok) throw new Error("draft API HTTP " + res.status);
          var data = await res.json();
          if (data.draft && Array.isArray(data.draft.picks)) {
            draftState = Object.assign(defaultState(), data.draft);
            saveLocalState(draftState);
            return true;
          }
        } catch (e) {}
        draftState = getLocalState();
        return false;
      }
      async function saveDraftShared() {
        if (!draftState) draftState = getLocalState();
        draftState.updatedAt = new Date().toISOString();
        saveLocalState(draftState);
        try {
          await fetch("/api/draft", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(draftState)
          });
        } catch (e) {}
      }
      function showDraftChooser() {
        var panel = document.getElementById("draftBoardPanel");
        if (!panel) return;
        panel.classList.add("active");
        var board = document.getElementById("draftBoardTable");
        if (!board) return;
        board.innerHTML =
          '<div class="official-draft-entry">' +
            '<h3>Which team are you drafting for?</h3>' +
            '<p>Select your team to enter the live snake draft room. You can switch teams if someone needs help.</p>' +
            '<div class="official-owner-grid">' + OWNERS.map(function (o) {
              return '<button type="button" class="official-owner-btn" data-official-owner="' + esc(o.id) + '">' + esc(o.teamName) + '</button>';
            }).join("") + '</div>' +
          '</div>';
      }
      function enterAsOwner(ownerId) {
        activeOwnerId = ownerId;
        localStorage.setItem("custom-hockey-pool-active-owner", ownerId);
        toast("Entered Draft Room as " + (ownerById(ownerId)?.teamName || ownerId) + ".");
        renderOfficialDraftRoom();
        fetchRealNhlPlayers();
      }
      function paintPlayersLoading() {
        var board = document.getElementById("draftBoardTable");
        if (!board) return;
        board.innerHTML =
          '<div class="official-draft-loading">' +
            '<strong>Pulling real NHL players…</strong>' +
            '<span>Loading Goals, Assists, Points, Fantasy Points, and sorting controls.</span>' +
          '</div>';
      }
      function paintPlayersError() {
        var board = document.getElementById("draftBoardTable");
        if (!board) return;
        board.innerHTML =
          '<div class="official-draft-loading error">' +
            '<strong>Real NHL API pull failed.</strong>' +
            '<span>No demo players are being shown. Click below to retry the real NHL API.</span>' +
            '<button type="button" class="primary" id="officialRetryPlayers">Retry Real NHL Pull</button>' +
          '</div>';
      }
      function renderOfficialDraftRoom() {
        if (!draftState) draftState = getLocalState();
        var info = document.getElementById("draftInfoRoom");
        var boardPanel = document.getElementById("draftBoardPanel");
        if (info) info.classList.remove("active");
        if (boardPanel) boardPanel.classList.add("active");
        document.querySelectorAll("[data-draft-room]").forEach(function (btn) {
          btn.classList.toggle("active", btn.dataset.draftRoom === "board");
        });
        if (!activeOwnerId) {
          showDraftChooser();
          return;
        }
        if (!officialOrder()) {
          var boardNoLottery = document.getElementById("draftBoardTable");
          if (boardNoLottery) {
            boardNoLottery.innerHTML =
              '<div class="official-draft-loading error">' +
                '<strong>Lottery required before drafting.</strong>' +
                '<span>Run the Draft Lottery first. The lottery locks the draft order, then the snake draft room opens.</span>' +
              '</div>';
          }
          return;
        }
        if (!playersLoaded) {
          paintPlayersLoading();
          fetchRealNhlPlayers();
          return;
        }
        var board = document.getElementById("draftBoardTable");
        if (!board) return;
        var pick = currentPickInfo();
        var activeOwner = ownerById(activeOwnerId);
        var currentOwner = pick ? ownerById(pick.ownerId) : null;
        var canPick = Boolean(pick && activeOwner && (adminMode || activeOwner.id === pick.ownerId));
        var maxReached = (draftState.picks || []).length >= totalPickLimit();
        var order = officialOrder() || [];
        var sequencePreview = [];
        for (var i = 0; i < Math.min(15, totalPickLimit()); i++) {
          var info = snakeOwnerForPickNumber(i + 1);
          var o = info && ownerById(info.ownerId);
          if (o) sequencePreview.push('<span class="' + (i + 1 === (draftState.picks.length + 1) ? 'current' : '') + '">' + (i + 1) + '. ' + esc(o.teamName) + '</span>');
        }
        var rows = availablePlayers().map(function (p, index) {
          var fp = fantasyPoints(p);
          var disabled = !canPick || maxReached;
          var title = maxReached ? "Draft complete" : (!canPick ? "Not your pick" : "Sign Player");
          return '<tr>' +
            '<td class="rank-cell">' + (index + 1) + '</td>' +
            '<td class="player-draft-cell"><div class="player-draft-line compact-player-line"><div><strong>' + esc(p.name) + '</strong><div class="meta">' + esc(p.position) + ' • ' + esc(p.nhlTeam) + ' • Real NHL API</div></div>' +
            '<button type="button" class="draft-player-btn single-draft-btn contract-draft-btn official-sign-btn" data-sign-player="' + esc(p.id) + '" ' + (disabled ? 'disabled' : '') + ' title="' + esc(title) + '"><span class="contract-icon" aria-hidden="true"><i></i></span><span>Sign Player</span></button></div></td>' +
            '<td>' + (p.gamesPlayed || 0) + '</td>' +
            '<td>' + (p.goals || 0) + '</td>' +
            '<td>' + (p.assists || 0) + '</td>' +
            '<td>' + (p.points || 0) + '</td>' +
            '<td><strong>' + fp + '</strong></td>' +
          '</tr>';
        }).join("");
        board.innerHTML =
          '<div class="official-draft-top">' +
            '<div><span class="eyebrow">Official Snake Draft</span><h3>' + (maxReached ? 'Draft Complete' : ('Pick ' + pick.pickNumber + ' • Round ' + pick.round)) + '</h3><p>Current pick: <strong>' + esc(currentOwner ? currentOwner.teamName : '—') + '</strong></p></div>' +
            '<div class="official-active-box"><label>Drafting as</label><select id="officialActiveOwnerSelect">' + (draftState.owners || OWNERS).map(function (o) { return '<option value="' + esc(o.id) + '" ' + (o.id === activeOwnerId ? 'selected' : '') + '>' + esc(o.teamName) + '</option>'; }).join("") + '</select><small>' + (canPick ? 'You are on the clock.' : (adminMode ? 'Admin switch enabled. Change team to pick for someone.' : 'Watch mode until your pick.')) + '</small></div>' +
          '</div>' +
          '<div class="official-order-strip">' + sequencePreview.join("") + '</div>' +
          '<div class="official-draft-controls">' +
            '<select id="officialPositionFilter"><option value="all">All positions</option><option value="F">Forwards</option><option value="C">C</option><option value="L">L/LW</option><option value="R">R/RW</option><option value="D">D</option><option value="TG">Team Goalies</option></select>' +
            '<select id="officialSortSelect"><option value="fantasyPoints">Sort by Fantasy Pts</option><option value="points">Sort by NHL Pts</option><option value="goals">Sort by Goals</option><option value="assists">Sort by Assists</option><option value="gamesPlayed">Sort by GP</option><option value="name">Sort by Name</option></select>' +
            '<button type="button" id="officialRefreshPlayers">Refresh Real NHL Players</button>' +
          '</div>' +
          '<table class="draft-table official-player-table"><thead><tr><th>#</th><th>Player</th><th>GP</th><th>Goals</th><th>Assists</th><th>Pts</th><th>Fantasy Pts</th></tr></thead><tbody>' + (rows || '<tr><td colspan="7">No available players left.</td></tr>') + '</tbody></table>' +
          '<div class="official-pick-history"><h4>Signed Players</h4>' + ((draftState.picks || []).slice().reverse().map(function (p) { return '<div><span>' + p.pickNumber + '</span><strong>' + esc(p.player.name) + '</strong><em>' + esc(p.ownerName) + '</em></div>'; }).join("") || '<p>No players signed yet.</p>') + '</div>';
        var officialPosition = document.getElementById("officialPositionFilter");
        if (officialPosition) {
          officialPosition.value = document.getElementById("draftPositionFilter")?.value || "all";
          officialPosition.addEventListener("change", function () {
            var old = document.getElementById("draftPositionFilter");
            if (old) old.value = officialPosition.value;
            renderOfficialDraftRoom();
          });
        }
        var officialSort = document.getElementById("officialSortSelect");
        if (officialSort) {
          officialSort.value = sortKey;
          officialSort.addEventListener("change", function () {
            sortKey = officialSort.value;
            sortDirection = sortKey === "name" ? "asc" : "desc";
            renderOfficialDraftRoom();
          });
        }
        var ownerSelect = document.getElementById("officialActiveOwnerSelect");
        if (ownerSelect) ownerSelect.addEventListener("change", function () { enterAsOwner(ownerSelect.value); });
        var refresh = document.getElementById("officialRefreshPlayers");
        if (refresh) refresh.addEventListener("click", function () { playersLoaded = false; players = []; fetchRealNhlPlayers(); });
      }
      async function signPlayer(playerId) {
        if (!draftState) draftState = getLocalState();
        var pick = currentPickInfo();
        if (!pick) return toast("Run the lottery first to lock the draft order.");
        if (activeOwnerId !== pick.ownerId) {
          var current = ownerById(pick.ownerId);
          return toast("It is " + (current?.teamName || "another team") + "'s pick. Switch teams if you are helping them.");
        }
        var player = players.find(function (p) { return String(p.id) === String(playerId); });
        if (!player) return toast("That player is not available.");
        if (draftedIds().has(String(player.id))) return toast("That player has already been signed.");
        var owner = ownerById(pick.ownerId);
        var signed = {
          pickNumber: pick.pickNumber,
          round: pick.round,
          slot: pick.slot,
          ownerId: pick.ownerId,
          ownerName: owner ? owner.teamName : pick.ownerId,
          timestamp: new Date().toISOString(),
          player: {
            id: String(player.id),
            name: player.name,
            position: player.position,
            nhlTeam: player.nhlTeam,
            gamesPlayed: player.gamesPlayed || 0,
            goals: player.goals || 0,
            assists: player.assists || 0,
            points: player.points || 0,
            fantasyPoints: fantasyPoints(player)
          }
        };
        draftState.picks.push(signed);
        saveLocalState(draftState);
        await saveDraftShared();
        toast("Signed " + player.name + " to " + signed.ownerName + ".");
        renderOfficialDraftRoom();
      }
      async function resetOfficialDraft() {
        draftState = getLocalState();
        draftState.picks = [];
        draftState.draftOrder = lotteryOrderFromPageOrStorage() || null;
        saveLocalState(draftState);
        try { await fetch("/api/draft", { method: "DELETE" }); } catch (e) {}
        renderOfficialDraftRoom();
        toast("Official draft reset.");
      }
      function startPolling() {
        clearInterval(pollTimer);
        pollTimer = setInterval(async function () {
          if (!document.getElementById("draftBoardPanel")?.classList.contains("active")) return;
          var before = JSON.stringify((draftState && draftState.picks || []).map(function (p) { return p.player.id; }));
          await loadDraftShared();
          var after = JSON.stringify((draftState && draftState.picks || []).map(function (p) { return p.player.id; }));
          if (before !== after) renderOfficialDraftRoom();
        }, 4500);
      }
      document.addEventListener("click", async function (event) {
        var enter = event.target.closest && event.target.closest('[data-draft-room="board"]');
        if (enter) {
          event.preventDefault();
          event.stopPropagation();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          await loadDraftShared();
          if (!activeOwnerId) showDraftChooser();
          else renderOfficialDraftRoom();
          startPolling();
          return;
        }
        var ownerBtn = event.target.closest && event.target.closest("[data-official-owner]");
        if (ownerBtn) {
          event.preventDefault();
          enterAsOwner(ownerBtn.dataset.officialOwner);
          return;
        }
        var sign = event.target.closest && event.target.closest("[data-sign-player]");
        if (sign) {
          event.preventDefault();
          signPlayer(sign.dataset.signPlayer);
          return;
        }
        var retry = event.target.closest && event.target.closest("#officialRetryPlayers");
        if (retry) {
          event.preventDefault();
          fetchRealNhlPlayers();
          return;
        }
        var reset = event.target.closest && event.target.closest("#resetDraftBtn");
        if (reset) {
          // Let old reset do its lottery/local work, then clear official shared draft too.
          setTimeout(resetOfficialDraft, 250);
        }
      }, true);
      window.addEventListener("load", function () {
        draftState = getLocalState();
        paintOfficialSmallStatus();
      });
      function paintOfficialSmallStatus() {
        var results = document.getElementById("lotteryResults");
        if (!results) return;
        // Leave existing lottery display alone; this function is intentionally light.
      }
    })();
  

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
  

    (function(){
      function esc(s){
        return String(s == null ? "" : s).replace(/[&<>"']/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c];});
      }

      function currentSeasonId(){
        return "20252026";
      }

      function toast(message){
        const t = document.getElementById("toast");
        if (!t) return;
        t.textContent = message;
        t.classList.add("show");
        setTimeout(() => t.classList.remove("show"), 2600);
      }

      const DEFAULT_OWNERS = [
        { id:"nick", teamName:"Nick" },
        { id:"chris", teamName:"Chris" },
        { id:"andrew", teamName:"Andrew" },
        { id:"tyler", teamName:"Tyler" },
        { id:"scott", teamName:"Scott" }
      ];

      function getOwners(){
        return DEFAULT_OWNERS;
      }

      function getLotteryOrder(){
        var keys = ["custom-hockey-pool-v30-popout-emergency","custom-hockey-pool-v29-inline-emergency","custom-hockey-pool-v28-hard-bypass-fallback"];
        for (var i=0;i<keys.length;i++){
          try{
            var parsed = JSON.parse(localStorage.getItem(keys[i]) || "null");
            if (parsed && Array.isArray(parsed.lotteryOrder) && parsed.lotteryOrder.length){
              return parsed.lotteryOrder.slice();
            }
          }catch(e){}
        }
        return getOwners().map(function(o){return o.id;});
      }

      function renderCompactLottery(){
        var status = document.getElementById("compactLotteryStatus");
        if (!status) return;
        var owners = getOwners();
        var map = new Map(owners.map(function(o){return [o.id,o];}));
        var order = getLotteryOrder();
        var rows = order.map(function(id,idx){
          var o = map.get(id) || {teamName:id};
          return '<span><b>'+String(idx+1)+'</b>'+esc(o.teamName)+'</span>';
        }).join("");
        status.innerHTML = '<div class="compact-order-list">'+rows+'</div>';
        var run = document.getElementById("runLotteryBtn"); var replay = document.getElementById("replayLotteryBtn");
        if (run) run.style.display = "none";
        if (replay) replay.style.display = "inline-flex";
      }

      async function readRosterDraftState(){
        async function tryStaticFinal(){
          try{
            const res = await fetch("/data/final-draft.json?t=" + Date.now(), { cache:"no-store" });
            if (!res.ok) return null;
            const data = await res.json();
            if (data && data.locked && Array.isArray(data.picks) && data.picks.length) {
              data.__source = "static final roster";
              return data;
            }
          }catch(e){}
          return null;
        }

        async function trySharedDraft(){
          if (window.officialDraftApi) {
            const draft = await window.officialDraftApi.load();
            draft.__source = draft.__source || "shared roster/draft API";
            return draft;
          }
          return null;
        }

        // During live draft testing, do not let old data/final-draft.json override the shared API.
        // Static final draft can be re-enabled later after the draft is truly locked.
        return (await trySharedDraft()) || { owners: DEFAULT_OWNERS, picks: [], __source:"no shared roster/draft source found" };
      }

      function normalizeName(s){
        return String(s || "").toLowerCase().replace(/[^a-z0-9]/g,"");
      }

      function rowName(row){
        const first = row.firstName && (row.firstName.default || row.firstName);
        const last = row.lastName && (row.lastName.default || row.lastName);
        return row.skaterFullName || row.playerFullName || row.goalieFullName || row.fullName || [first,last].filter(Boolean).join(" ");
      }

      function rowTeam(row){
        return row.teamAbbrevs || row.teamAbbrev || row.team || row.teamName || "";
      }

      function buildSkaterMap(skaters){
        const byId = new Map();
        const byNameTeam = new Map();
        (Array.isArray(skaters) ? skaters : []).forEach(row => {
          const id = String(row.playerId || row.skaterId || row.id || "");
          const name = rowName(row);
          const team = rowTeam(row);
          const goals = Number(row.goals || 0);
          const assists = Number(row.assists || 0);
          const shortHandedGoals = Number(row.shortHandedGoals || row.shGoals || 0);
          const gameWinningGoals = Number(row.gameWinningGoals || row.gwGoals || 0);
          const playoffPts = (goals * 2) + assists + (shortHandedGoals * 5) + (gameWinningGoals * 5);
          const item = { id, name, team, goals, assists, shortHandedGoals, gameWinningGoals, playoffPts };
          if (id) byId.set(id, item);
          byNameTeam.set(normalizeName(name) + "|" + team, item);
          byNameTeam.set(normalizeName(name), item);
        });
        return { byId, byNameTeam };
      }

      function buildTeamGoalieWins(goalies){
        const teamWins = new Map();
        (Array.isArray(goalies) ? goalies : []).forEach(row => {
          const team = rowTeam(row);
          if (!team) return;
          teamWins.set(team, (teamWins.get(team) || 0) + Number(row.wins || row.goalieWins || 0));
        });
        return teamWins;
      }

      function findSkaterForPick(pick, maps){
        const player = pick.player || {};
        const rawId = String(player.id || "").replace(/\D/g, "");
        if (rawId && maps.byId.has(rawId)) return maps.byId.get(rawId);
        const name = player.name || "";
        const team = player.nhlTeam || "";
        return maps.byNameTeam.get(normalizeName(name) + "|" + team) || maps.byNameTeam.get(normalizeName(name)) || null;
      }

      function playerPositionLabel(player){
        if (!player) return "";
        return player.position === "TG" ? "Team Goalies" : (player.position || "");
      }

      async function renderPlayoffLeaderboard(){
        const target = document.getElementById("leaderboardTable");
        const button = document.getElementById("refreshStatsBtn2");
        if (!target) return;
        if (button) {
          button.disabled = true;
          button.textContent = "Pulling Playoff Stats…";
        }
        target.innerHTML = '<div class="clean-loading-card"><strong>Pulling NHL playoff stats…</strong><span>Reading roster source and scoring playoff stats.</span></div>';

        try{
          const draft = await readRosterDraftState();
          if (window.officialDraftApi && window.officialDraftApi.updateSourceStatus) window.officialDraftApi.updateSourceStatus(draft);
          const owners = Array.isArray(draft.owners) && draft.owners.length ? draft.owners : DEFAULT_OWNERS;
          const picks = Array.isArray(draft.picks) ? draft.picks : [];

          if (!picks.length) {
            target.innerHTML = `<div class="clean-loading-card"><strong>No roster picks found.</strong><span>Home checked /api/draft only for the live roster. Source: ${esc(draft.__source || "unknown")}.</span></div>`;
            return;
          }

          const season = currentSeasonId();
          const res = await fetch(`/api/nhl?gameType=3&limit=900&season=${season}`, { cache:"no-store" });
          const payload = await res.json();
          if (!res.ok || !payload.ok) throw new Error(payload.error || "NHL playoff stat pull failed.");

          const skaterMaps = buildSkaterMap(payload.skaters || []);
          const teamGoalieWins = buildTeamGoalieWins(payload.goalies || []);

          const teams = new Map();
          owners.forEach(o => {
            teams.set(String(o.id), { ownerId:String(o.id), ownerName:o.teamName || o.name || o.id, total:0, goals:0, assists:0, goalieWins:0, players:[] });
          });

          picks.forEach(pick => {
            const player = pick.player || {};
            const ownerId = String(pick.ownerId || "");
            if (!teams.has(ownerId)) {
              teams.set(ownerId, { ownerId, ownerName:pick.ownerName || ownerId, total:0, goals:0, assists:0, goalieWins:0, players:[] });
            }

            const team = teams.get(ownerId);
            let goals = 0, assists = 0, goalieWins = 0, points = 0;

            if (player.position === "TG") {
              goalieWins = Number(teamGoalieWins.get(player.nhlTeam) || 0);
              points = goalieWins * 2;
            } else {
              const stat = findSkaterForPick(pick, skaterMaps);
              if (stat) {
                goals = Number(stat.goals || 0);
                assists = Number(stat.assists || 0);
                points = (Number(stat.goals || 0) * 2) + (Number(stat.assists || 0) * 1) + (Number(stat.shortHandedGoals || stat.shGoals || 0) * 5) + (Number(stat.gameWinningGoals || stat.gwGoals || 0) * 5);
              }
            }

            team.goals += goals;
            team.assists += assists;
            team.goalieWins += goalieWins;
            team.total += points;
            team.players.push({
              name: player.name || "Unknown player",
              position: playerPositionLabel(player),
              nhlTeam: player.nhlTeam || "",
              goals, assists, goalieWins,
              playoffPoints: points,
              points,
              regularPoints: Number(player.points || 0),
              fantasyPoints: Number(player.fantasyPoints || 0)
            });
          });

          const rows = Array.from(teams.values()).sort((a,b) => (b.total - a.total) || a.ownerName.localeCompare(b.ownerName));

          target.innerHTML =
            '<div class="playoff-scoring-note">Scoring: <b>Goal = 2</b> • <b>Assist = 1</b> • <b>SHG/GWG = 5</b> • <b>Goalie win = 2</b> • <b>Goalie assist = 5</b> • <b>Goalie goal = 10</b> • <b>Shutout = 5</b>. Click a team name to see the player breakdown.</div>' +
            '<table class="leaderboard playoff-leaderboard expandable-playoff-leaderboard">' +
              '<thead><tr><th>Rank</th><th>Team</th><th>Total</th><th>G</th><th>A</th><th>GW</th><th>Top playoff scorers</th></tr></thead>' +
              '<tbody>' + rows.map((row, i) => {
                const sortedPlayers = row.players.slice().sort((a,b) => (b.playoffPoints - a.playoffPoints) || (b.fantasyPoints - a.fantasyPoints) || a.name.localeCompare(b.name));
                const topPlayers = sortedPlayers.filter(p => p.playoffPoints > 0).slice(0, 12);
                const playerHtml = topPlayers.length
                  ? topPlayers.map(p => `<span class="playoff-player-chip"><b>${esc(p.name)}</b> ${esc(p.nhlTeam)} ${p.playoffPoints} pts <small>${p.goalieWins ? `${p.goalieWins} GW` : `${p.goals}G ${p.assists}A`}</small></span>`).join("")
                  : '<span class="muted">No playoff points yet</span>';

                const breakdownRows = sortedPlayers.map(p => {
                  const calc = p.goalieWins ? `${p.goalieWins} goalie wins × 2 = ${p.playoffPoints}` : `(${p.goals} goals × 2) + ${p.assists} assists + (${p.shortHandedGoals || 0} SHG × 5) + (${p.gameWinningGoals || 0} GWG × 5) = ${p.playoffPoints}`;
                  return `<tr><td><strong>${esc(p.name)}</strong><small>${esc(p.position)} • ${esc(p.nhlTeam)}</small></td><td>${p.goals}</td><td>${p.assists}</td><td>${p.goalieWins}</td><td>${p.regularPoints}</td><td>${p.fantasyPoints}</td><td class="total-cell">${p.playoffPoints}</td><td>${esc(calc)}</td></tr>`;
                }).join("");

                const mobileBreakdownCards = sortedPlayers.map(p => {
                  const calc = p.goalieWins ? `${p.goalieWins} goalie wins × 2 = ${p.playoffPoints}` : `(${p.goals} goals × 2) + ${p.assists} assists + (${p.shortHandedGoals || 0} SHG × 5) + (${p.gameWinningGoals || 0} GWG × 5) = ${p.playoffPoints}`;
                  return `<article class="mobile-playoff-player-card"><div class="mobile-playoff-player-head"><strong>${esc(p.name)}</strong><b>${p.playoffPoints} pts</b></div><small>${esc(p.position)} • ${esc(p.nhlTeam)}</small><div class="mobile-playoff-stat-grid"><span><em>G</em>${p.goals}</span><span><em>A</em>${p.assists}</span><span><em>GW</em>${p.goalieWins}</span><span><em>NHL Pts</em>${p.regularPoints}</span><span><em>Draft FPTS</em>${p.fantasyPoints}</span></div><p>${esc(calc)}</p></article>`;
                }).join("");

                const detailId = `playoff-breakdown-${esc(row.ownerId)}`;
                return `<tr class="playoff-summary-row"><td><b>${i + 1}</b></td><td><button type="button" class="playoff-team-toggle" data-playoff-toggle="${detailId}"><span>▸</span>${esc(row.ownerName)}</button></td><td class="total-cell">${row.total}</td><td>${row.goals}</td><td>${row.assists}</td><td>${row.goalieWins}</td><td><div class="playoff-player-list">${playerHtml}</div></td></tr>
                <tr id="${detailId}" class="playoff-breakdown-row" hidden><td colspan="7"><div class="playoff-breakdown-panel"><h3>${esc(row.ownerName)} playoff point breakdown</h3><div class="mobile-playoff-breakdown-list">${mobileBreakdownCards || '<p class="muted">No drafted players.</p>'}</div><table class="playoff-breakdown-table"><thead><tr><th>Player</th><th>G</th><th>A</th><th>GW</th><th>NHL Pts</th><th>Draft FPTS</th><th>Pool Pts</th><th>Calculation</th></tr></thead><tbody>${breakdownRows || '<tr><td colspan="8">No drafted players.</td></tr>'}</tbody></table></div></td></tr>`;
              }).join("") + '</tbody></table>' +
            `<p class="muted playoff-updated">Roster picks found: ${esc(picks.length)} from ${esc(draft.__source || "unknown source")}. Pulled NHL playoff stats for season ${esc(payload.season || season)}. Skaters: ${esc((payload.counts && payload.counts.skaters) || 0)}. Goalies: ${esc((payload.counts && payload.counts.goalies) || 0)}.</p>`;
        } catch(error) {
          console.error(error);
          target.innerHTML = `<div class="clean-loading-card error"><strong>Playoff leaderboard failed.</strong><span>${esc(error.message || error)}</span></div>`;
          toast("Playoff leaderboard failed.");
        } finally {
          if (button) {
            button.disabled = false;
            button.textContent = "Pull Playoff Stats";
          }
        }
      }

      document.addEventListener("click", function(event){
        const toggle = event.target.closest && event.target.closest("[data-playoff-toggle]");
        if (toggle) {
          event.preventDefault();
          const row = document.getElementById(toggle.dataset.playoffToggle);
          const icon = toggle.querySelector("span");
          if (row) {
            row.hidden = !row.hidden;
            if (icon) icon.textContent = row.hidden ? "▸" : "▾";
          }
          return;
        }

        const btn = event.target.closest && event.target.closest("#refreshStatsBtn2");
        if (!btn) return;
        event.preventDefault();
        renderPlayoffLeaderboard();
      }, true);

      window.addEventListener("load", function(){
        renderCompactLottery();
        setTimeout(renderPlayoffLeaderboard, 500);
      });
    })();
  

    // V86 robust rosters source
    (function(){
      const ROSTER_OWNERS = [
        { id:"nick", name:"Nick", teamName:"Nick" },
        { id:"chris", name:"Chris", teamName:"Chris" },
        { id:"andrew", name:"Andrew", teamName:"Andrew" },
        { id:"tyler", name:"Tyler", teamName:"Tyler" },
        { id:"scott", name:"Scott", teamName:"Scott" }
      ];

      function esc(s){
        return String(s == null ? "" : s).replace(/[&<>"']/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c];});
      }

      function bucket(position){
        if (position === "D") return "D";
        if (position === "G" || position === "TG") return "G";
        return "F";
      }

      function localDraftBackup(){
        const keys = [
          "custom-hockey-pool-v40-clean-live-draft",
          "custom-hockey-pool-v38-official-snake",
          "custom-hockey-pool-active-draft"
        ];
        let best = null;
        keys.forEach(key => {
          try{
            const parsed = JSON.parse(localStorage.getItem(key) || "null");
            if (parsed && Array.isArray(parsed.picks)) {
              if (!best || parsed.picks.length > best.picks.length) best = parsed;
            }
          }catch(e){}
        });
        return best;
      }

      async function sharedDraft(){
        if (window.officialDraftApi) return await window.officialDraftApi.load();
        return { owners: ROSTER_OWNERS, draftOrder: ROSTER_OWNERS.map(o=>o.id), picks: [], __source:"official API controller missing" };
      }

      async function getBestDraftForRosters(){
        // Official source only. localStorage is no longer allowed to override cross-device roster state.
        return await sharedDraft();
      }

      function ownerName(owner){
        return owner.teamName || owner.name || owner.id;
      }

      function playerLine(pick){
        const p = pick.player || {};
        const pos = p.position === "TG" ? "Team Goalies" : (p.position || "");
        const nhl = p.nhlTeam || "";
        return `<div class="roster-player-row"><strong>${esc(p.name || "Unknown")}</strong><span>${esc(pos)} ${nhl ? "• " + esc(nhl) : ""}</span></div>`;
      }

      function section(title, picks, limit){
        return `<div class="roster-section">
          <h4>${esc(title)} <small>${picks.length}/${limit}</small></h4>
          <div class="roster-player-list">${picks.length ? picks.map(playerLine).join("") : '<div class="roster-empty">No players yet</div>'}</div>
        </div>`;
      }

      window.__rosterConceptState = window.__rosterConceptState || { ownerId: "nick" };

      function conceptOwnerId(owners){
        const state = window.__rosterConceptState;
        if (!owners.some(o => String(o.id) === String(state.ownerId))) state.ownerId = owners[0] && owners[0].id || "nick";
        return state.ownerId;
      }

      function conceptOwnerButtons(owners){
        const active = conceptOwnerId(owners);
        return `<div class="concept-owner-switcher">${owners.map(o => `<button type="button" class="concept-owner-btn ${String(o.id) === String(active) ? "active" : ""}" data-concept-owner="${esc(o.id)}">${esc(ownerName(o))}</button>`).join("")}</div>`;
      }

      function pickPlayer(pick){ return (pick && pick.player) ? pick.player : {}; }
      function playerName(p){ return p.name || p.fullName || p.id || "Drafted Player"; }
      function playerMeta(p){
        const pos = p.position === "TG" ? "Team Goalies" : (p.position || "—");
        const team = p.nhlTeam || p.team || "";
        return `${pos}${team ? " • " + team : ""}`;
      }
      function ownerRosterFromDraft(draft, ownerId){
        const picks = Array.isArray(draft && draft.picks) ? draft.picks : [];
        return picks.filter(p => String(p.ownerId) === String(ownerId)).map(pickPlayer);
      }

      function conceptSampleRoster(ownerId){
        const base = {
          nick: [
            ["Auston Matthews","F","TOR",52,31,83],["William Nylander","F","TOR",40,58,98],["Mitch Marner","F","TOR",26,73,99],["Jason Robertson","F","DAL",35,45,80],["Brayden Point","F","TBL",44,38,82],["Tim Stützle","F","OTT",28,51,79],
            ["Cale Makar","D","COL",21,69,90],["Quinn Hughes","D","VAN",17,75,92],["Rasmus Dahlin","D","BUF",18,47,65],["Evan Bouchard","D","EDM",18,64,82],
            ["Toronto Goalies","TG","TOR",0,0,0],["Dallas Goalies","TG","DAL",0,0,0],["Matvei Michkov","F","PHI",24,34,58],["Macklin Celebrini","F","SJS",25,38,63],["Lane Hutson","D","MTL",8,48,56],["Connor Bedard","F","CHI",32,45,77],["Jake Sanderson","D","OTT",10,42,52],["Minnesota Goalies","TG","MIN",0,0,0]
          ],
          chris: [["Connor McDavid","F","EDM",35,92,127],["Leon Draisaitl","F","EDM",52,54,106],["David Pastrnak","F","BOS",47,63,110],["Jack Hughes","F","NJD",33,56,89],["Kyle Connor","F","WPG",41,49,90],["Sebastian Aho","F","CAR",36,53,89],["Adam Fox","D","NYR",14,58,72],["Miro Heiskanen","D","DAL",12,47,59],["Noah Dobson","D","NYI",10,60,70],["Victor Hedman","D","TBL",13,59,72],["Edmonton Goalies","TG","EDM",0,0,0],["Boston Goalies","TG","BOS",0,0,0],["Lucas Raymond","F","DET",31,46,77],["Cole Caufield","F","MTL",37,35,72],["Moritz Seider","D","DET",9,39,48],["Wyatt Johnston","F","DAL",33,42,75],["Luke Hughes","D","NJD",11,36,47],["Carolina Goalies","TG","CAR",0,0,0]],
          andrew: [["Nathan MacKinnon","F","COL",51,89,140],["Nikita Kucherov","F","TBL",44,100,144],["Mikko Rantanen","F","COL",42,62,104],["Artemi Panarin","F","NYR",49,71,120],["Kirill Kaprizov","F","MIN",46,50,96],["Tage Thompson","F","BUF",38,38,76],["Roman Josi","D","NSH",23,62,85],["Josh Morrissey","D","WPG",12,57,69],["Dougie Hamilton","D","NJD",15,41,56],["Shea Theodore","D","VGK",10,42,52],["Colorado Goalies","TG","COL",0,0,0],["Vegas Goalies","TG","VGK",0,0,0],["Juraj Slafkovsky","F","MTL",26,40,66],["Dylan Guenther","F","UTA",30,35,65],["Brandt Clarke","D","LAK",8,34,42],["Alexis Lafreniere","F","NYR",31,31,62],["Olen Zellweger","D","ANA",7,31,38],["Winnipeg Goalies","TG","WPG",0,0,0]],
          tyler: [["Brady Tkachuk","F","OTT",37,42,79],["Matthew Tkachuk","F","FLA",29,59,88],["Elias Pettersson","F","VAN",34,55,89],["Jake Guentzel","F","TBL",36,45,81],["Timo Meier","F","NJD",35,35,70],["Robert Thomas","F","STL",27,59,86],["Brock Faber","D","MIN",10,45,55],["Brent Burns","D","CAR",10,33,43],["MacKenzie Weegar","D","CGY",20,35,55],["Charlie McAvoy","D","BOS",12,42,54],["Florida Goalies","TG","FLA",0,0,0],["Ottawa Goalies","TG","OTT",0,0,0],["Logan Cooley","F","UTA",24,40,64],["Cutter Gauthier","F","ANA",24,28,52],["Simon Edvinsson","D","DET",7,25,32],["Shane Wright","F","SEA",22,31,53],["Thomas Harley","D","DAL",15,36,51],["Tampa Bay Goalies","TG","TBL",0,0,0]],
          scott: [["Sidney Crosby","F","PIT",42,52,94],["Alex Ovechkin","F","WSH",42,30,72],["Steven Stamkos","F","NSH",40,41,81],["John Tavares","F","TOR",33,42,75],["Bo Horvat","F","NYI",34,35,69],["Ryan Nugent-Hopkins","F","EDM",24,55,79],["Erik Karlsson","D","PIT",11,45,56],["Morgan Rielly","D","TOR",9,49,58],["Kris Letang","D","PIT",10,40,50],["Drew Doughty","D","LAK",10,35,45],["Pittsburgh Goalies","TG","PIT",0,0,0],["NY Islanders Goalies","TG","NYI",0,0,0],["Zach Benson","F","BUF",17,30,47],["Will Smith","F","SJS",22,31,53],["David Reinbacher","D","MTL",5,24,29],["Marco Kasper","F","DET",18,24,42],["Pavel Mintyukov","D","ANA",8,36,44],["Washington Goalies","TG","WSH",0,0,0]]
        };
        return (base[ownerId] || base.nick).map((x, i) => ({ name:x[0], fullName:x[0], position:x[1], nhlTeam:x[2], goals:x[3], assists:x[4], points:x[5], id:`sample-${ownerId}-${i}` }));
      }

      function ownerConceptRoster(draft, ownerId){
        const real = ownerRosterFromDraft(draft, ownerId);
        return real.length ? real : conceptSampleRoster(ownerId);
      }
      function groupRoster(players){
        return {
          F: players.filter(p => bucket(p.position) === "F"),
          D: players.filter(p => bucket(p.position) === "D"),
          G: players.filter(p => bucket(p.position) === "G")
        };
      }
      function statLine(p){
        const pos = String(p.position || "").toUpperCase();
        if (pos === "G" || pos === "TG") return `${Number(p.goalieWins || p.wins || 0)} W • ${Number(p.goalieShutouts || p.shutouts || 0)} SO`;
        return `${Number(p.goals || 0)} G • ${Number(p.assists || 0)} A • ${Number(p.points || 0)} PTS`;
      }
      function cardInitials(name){
        return String(name || "?").split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join("").toUpperCase() || "?";
      }
      function miniPlayerCard(p, i, extraClass){
        return `<article class="concept-player-card ${extraClass || ""}" style="--tilt:${((i % 7) - 3) * 1.2}deg">
          <div class="concept-card-top"><span>${esc((p.position === "TG" ? "TG" : p.position) || "—")}</span><b>${esc(p.nhlTeam || p.team || "NHL")}</b></div>
          <div class="concept-card-face"><span>${esc(cardInitials(playerName(p)))}</span></div>
          <h4>${esc(playerName(p))}</h4>
          <small>${esc(statLine(p))}</small>
        </article>`;
      }
      function emptyRosterMessage(){ return `<div class="concept-empty"><strong>No drafted players yet.</strong><span>Auto-draft a full roster and this concept will fill in live.</span></div>`; }
      function conceptShell(kind, title, subtitle, owner, owners, draft, body){
        const picks = Array.isArray(draft && draft.picks) ? draft.picks : [];
        const usingSamples = !picks.length;
        const counts = owners.map(o => `${ownerName(o)} ${ownerConceptRoster(draft, o.id).length}`).join(" • ");
        return `<div class="concept-shell concept-${kind}">
          <div class="concept-topline"><span class="eyebrow">Roster concept test ${usingSamples ? "• sample full rosters for spacing" : "• live drafted rosters"}</span><em>${esc(picks.length)} real drafted players</em></div>
          <div class="concept-head">
            <div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p><small>${esc(counts)}</small></div>
            ${conceptOwnerButtons(owners)}
          </div>
          <div class="concept-stage" data-owner="${esc(owner.id)}">${body}</div>
        </div>`;
      }
      function renderCardWall(host, draft, owners){
        const owner = owners.find(o => String(o.id) === String(conceptOwnerId(owners))) || owners[0];
        const roster = ownerConceptRoster(draft, owner.id);
        const cards = roster.length ? roster.map((p,i)=>miniPlayerCard(p,i,"wall-card")).join("") : emptyRosterMessage();
        host.innerHTML = conceptShell("card-wall", "Hockey Card Wall", "A basement wall of taped-up 90s player cards. This is probably the cleanest version for API player cards and full-roster spacing.", owner, owners, draft, `
          <div class="wall-room-bg">
            <aside class="wall-memorabilia"><b>${esc(ownerName(owner))}</b><span>Beckett</span><span>POGs</span><span>NHL 98</span><span>VHS</span></aside>
            <section class="wall-card-grid">${cards}</section>
          </div>`);
      }
      function renderCorkboard(host, draft, owners){
        const owner = owners.find(o => String(o.id) === String(conceptOwnerId(owners))) || owners[0];
        const roster = ownerConceptRoster(draft, owner.id);
        const g = groupRoster(roster);
        const group = (label, arr) => `<section class="cork-group"><h3>${label} <small>${arr.length}</small></h3>${arr.length ? arr.map((p,i)=>miniPlayerCard(p,i,"pin-card")).join("") : `<div class="cork-empty-slot">Waiting for ${label}</div>`}</section>`;
        host.innerHTML = conceptShell("corkboard", "Corkboard War Room", "A fantasy-GM basement board with pinned cards, notes, tape, and roster groups by position.", owner, owners, draft, `
          <div class="corkboard-bg">
            <div class="sticky-note main-note">${esc(ownerName(owner))}<br><small>KEEPERS? TRADE BAIT?</small></div>
            <div class="cork-groups">${group("Forwards", g.F)}${group("Defense", g.D)}${group("Goalies", g.G)}</div>
          </div>`);
      }
      function renderDesk(host, draft, owners){
        const owner = owners.find(o => String(o.id) === String(conceptOwnerId(owners))) || owners[0];
        const roster = ownerConceptRoster(draft, owner.id);
        const cards = roster.length ? roster.map((p,i)=>miniPlayerCard(p,i,"desk-card")).join("") : emptyRosterMessage();
        host.innerHTML = conceptShell("desk", "GM Desk", "An old basement coffee-table/GM desk with roster cards spread over notes, pucks, magazines, and a draft sheet.", owner, owners, draft, `
          <div class="desk-bg">
            <div class="desk-props"><span class="mug">MUG</span><span class="puck-prop"></span><span class="vhs-prop">NHL 98</span><span class="sheet-prop">DRAFT SHEET</span></div>
            <div class="desk-card-spread">${cards}</div>
          </div>`);
      }
      function renderCase(host, draft, owners){
        const owner = owners.find(o => String(o.id) === String(conceptOwnerId(owners))) || owners[0];
        const roster = ownerConceptRoster(draft, owner.id);
        const g = groupRoster(roster);
        const shelf = (label, arr) => `<div class="case-shelf"><h3>${label}</h3><div>${arr.length ? arr.map((p,i)=>miniPlayerCard(p,i,"case-card")).join("") : `<span class="case-empty">Empty shelf</span>`}</div></div>`;
        host.innerHTML = conceptShell("case", "Roster Display Case", "A premium glass case: trophies up top, roster cards on shelves, and owner memorabilia around the edges.", owner, owners, draft, `
          <div class="display-case-bg">
            <div class="case-trophy-row"><span></span><span></span><span></span><b>${esc(ownerName(owner))}'s Case</b></div>
            ${shelf("Forwards", g.F)}${shelf("Defense", g.D)}${shelf("Goalies", g.G)}
          </div>`);
      }
      function renderGame(host, draft, owners){
        const owner = owners.find(o => String(o.id) === String(conceptOwnerId(owners))) || owners[0];
        const roster = ownerConceptRoster(draft, owner.id);
        const rows = roster.length ? roster.map((p,i)=>`<tr><td>${String(i+1).padStart(2,"0")}</td><td>${esc(playerName(p))}</td><td>${esc(p.position === "TG" ? "TG" : (p.position || "—"))}</td><td>${esc(p.nhlTeam || p.team || "")}</td><td>${esc(statLine(p))}</td></tr>`).join("") : `<tr><td colspan="5">NO PLAYERS DRAFTED YET</td></tr>`;
        host.innerHTML = conceptShell("game", "NHL 98 Roster Screen", "A clean video-game style roster menu. Less realistic room, but it handles full rosters extremely well.", owner, owners, draft, `
          <div class="game-screen-bg">
            <div class="game-crt"><div class="game-title">${esc(ownerName(owner)).toUpperCase()} ROSTER</div><table><thead><tr><th>#</th><th>Player</th><th>Pos</th><th>NHL</th><th>Stats</th></tr></thead><tbody>${rows}</tbody></table><div class="game-footer">PRESS START • ${esc(roster.length)} PLAYERS</div></div>
          </div>`);
      }
      window.renderRosterConceptTabs = function(draft){
        const owners = Array.isArray(draft && draft.owners) && draft.owners.length ? draft.owners : ROSTER_OWNERS;
        const map = [
          ["rosterCardWallHost", renderCardWall],
          ["rosterCorkboardHost", renderCorkboard],
          ["rosterDeskHost", renderDesk],
          ["rosterCaseHost", renderCase],
          ["rosterGameHost", renderGame]
        ];
        map.forEach(([id, fn]) => { const host = document.getElementById(id); if (host) fn(host, draft || {}, owners); });
        document.querySelectorAll("[data-concept-owner]").forEach(btn => {
          btn.onclick = function(){ window.__rosterConceptState.ownerId = this.dataset.conceptOwner || (owners[0] && owners[0].id) || "nick"; window.renderRosterConceptTabs(draft || {}); };
        });
      };

      window.renderDraftRosters = function(draft){
        if (window.officialDraftApi && window.officialDraftApi.updateSourceStatus) window.officialDraftApi.updateSourceStatus(draft);
        const target = document.getElementById("rosterCards");
        if (!target) return;

        const owners = Array.isArray(draft && draft.owners) && draft.owners.length ? draft.owners : ROSTER_OWNERS;
        const picks = Array.isArray(draft && draft.picks) ? draft.picks : [];
        const source = draft && draft.__source ? draft.__source : "draft state";
        const limits = { F:6, D:4, G:2 };
        function ownerPicks(ownerId){ return picks.filter(p => String(p.ownerId) === String(ownerId)); }
        function rowsFor(title, arr, limit){
          return `<div class="roster-section"><h4>${esc(title)} <small>${arr.length}/${limit}</small></h4><div class="roster-player-list">${arr.length ? arr.map(playerLine).join("") : '<div class="roster-empty">No players yet</div>'}</div></div>`;
        }
        target.className = "grid roster-grid clean-original-rosters";
        target.innerHTML = owners.map(owner => {
          const mine = ownerPicks(owner.id);
          const grouped = { F:[], D:[], G:[] };
          mine.forEach(p => grouped[bucket((p.player || {}).position)].push(p));
          return `<article class="card roster-card-clean"><div class="roster-card-head"><div><span class="eyebrow">${esc(source)}</span><h3>${esc(ownerName(owner))}</h3></div><b>${esc(mine.length)} players</b></div>${rowsFor("Forwards", grouped.F, limits.F)}${rowsFor("Defense", grouped.D, limits.D)}${rowsFor("Goalies", grouped.G, limits.G)}</article>`;
        }).join("");
        if (window.renderRosterConceptTabs) window.renderRosterConceptTabs(draft || {});
        renderDraftRoomLottery(draft || {});
      };

      function lotteryOrderFromStorage(){
        const keys = ["custom-hockey-pool-v30-popout-emergency","custom-hockey-pool-v29-inline-emergency","custom-hockey-pool-v28-hard-bypass-fallback"];
        for (const key of keys) {
          try{
            const parsed = JSON.parse(localStorage.getItem(key) || "null");
            if (parsed && Array.isArray(parsed.lotteryOrder) && parsed.lotteryOrder.length) return parsed.lotteryOrder.slice();
          }catch(e){}
        }
        return null;
      }

      window.renderDraftRoomLottery = function(draft){
        // V114: old hook now only refreshes the live draft ticker.
        if (window.liveLottery && window.liveLottery.refreshLiveDraftTicker) {
          window.liveLottery.refreshLiveDraftTicker(true);
        }
      };

      async function syncRosterTab(){
        try {
          const draft = await getBestDraftForRosters();
          if (window.renderDraftRosters) window.renderDraftRosters(draft);
        } catch(e) {
          const fallback = { owners: ROSTER_OWNERS, draftOrder: ROSTER_OWNERS.map(o=>o.id), picks: [], __source:"concept fallback" };
          if (window.renderRosterConceptTabs) window.renderRosterConceptTabs(fallback);
          if (window.renderDraftRosters) window.renderDraftRosters(fallback);
        }
      }

      window.addEventListener("load", function(){
        if (window.renderRosterConceptTabs) window.renderRosterConceptTabs({ owners: ROSTER_OWNERS, draftOrder: ROSTER_OWNERS.map(o=>o.id), picks: [], __source:"sample concept fill" });
        setTimeout(syncRosterTab, 350);
      });

      document.addEventListener("click", function(event){
        const tab = event.target.closest && event.target.closest("[data-tab]");
        if (tab && (["rosters","draft","rosterCardWall","rosterCorkboard","rosterDesk","rosterCase","rosterGame"].includes(tab.dataset.tab))) {
          setTimeout(syncRosterTab, 100);
        }
      }, true);

      window.addEventListener("focus", syncRosterTab);
    })();
  

    // V86 ensure all draft reset actions reset the official shared API draft.
    (function(){
      document.addEventListener("click", async function(event){
        const btn = event.target.closest && event.target.closest("#resetLiveDraftBtn, #resetDraftBtn, [data-reset-draft]");
        if (!btn || !window.officialDraftApi) return;
        // Let existing confirm/UI happen if it exists; this just makes the official store match the reset.
        setTimeout(async () => {
          try {
            const fresh = await window.officialDraftApi.reset();
            if (window.renderDraftRosters) window.renderDraftRosters(fresh);
            if (window.renderDraftRoomLottery) window.renderDraftRoomLottery(fresh);
          } catch(e) {}
        }, 100);
      }, true);
    })();
  

    // V112 rebuilt live lottery controller.
    (function(){
      const OWNERS = [
        { id:"nick", teamName:"Nick", name:"Nick" },
        { id:"chris", teamName:"Chris", name:"Chris" },
        { id:"andrew", teamName:"Andrew", name:"Andrew" },
        { id:"tyler", teamName:"Tyler", name:"Tyler" },
        { id:"scott", teamName:"Scott", name:"Scott" }
      ];

      let revealStartedFor = "";
      let pollTimer = null;
      let lastLiveTickerSignature = "";

      let tickerOffset = 0;
      let tickerLastTime = 0;
      let tickerAnimationId = 0;
      let resultsTickerSignature = "";
      window.__v127ResultsTicker = window.__v127ResultsTicker || {
        cards: [],
        index: 0,
        intervalId: 0,
        lastRenderedKey: "",
        started: false
      };
      let skipLotteryReveal = false;

      function startSportsTicker(){
        // V120: ticker movement is pure CSS on brand-new containers.
      }

      function ownerName(id){
        const o = OWNERS.find(x => x.id === id);
        return o ? (o.teamName || o.name || o.id) : id;
      }
      function activeOwnerId(){
        return localStorage.getItem("custom-hockey-pool-active-owner") || document.getElementById("cleanDraftAsSelect")?.value || "";
      }
      function showOverlay(){ const el = document.getElementById("liveLotteryOverlay"); if (el) el.hidden = false; }
      function hideOverlay(){ const el = document.getElementById("liveLotteryOverlay"); if (el) el.hidden = true; }
      function setText(id, text){ const el = document.getElementById(id); if (el) el.textContent = text; }
      function setSpeech(text){ setText("garySpeechBubble", text); }
      function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

      function renderJoined(state){
        const target = document.getElementById("liveLotteryJoined");
        if (!target) return;
        const joined = new Set(state.joined || []);
        target.innerHTML = OWNERS.map(o => `<span class="${joined.has(o.id) ? "in" : ""}">${joined.has(o.id) ? "✓" : "○"} ${o.teamName}</span>`).join("");
      }

      function ownerSequenceFromDraft(draft){
        const owners = Array.isArray(draft && draft.owners) && draft.owners.length ? draft.owners : OWNERS;
        const order = Array.isArray(draft && draft.draftOrder) && draft.draftOrder.length ? draft.draftOrder : owners.map(o => o.id);
        const totalPicks = order.length * 12;
        const pickIndex = Array.isArray(draft && draft.picks) ? draft.picks.length : 0;
        const seq = [];
        for (let i = pickIndex; i < Math.min(totalPicks, pickIndex + 3); i++) {
          const round = Math.floor(i / order.length) + 1;
          const slot = i % order.length;
          const roundOrder = round % 2 === 1 ? order : order.slice().reverse();
          const ownerId = roundOrder[slot];
          seq.push({ ownerId, pickNumber:i + 1, round });
        }
        return seq;
      }

      function safeHtml(value){
        return String(value ?? "").replace(/[&<>"']/g, ch => ({
          "&":"&amp;",
          "<":"&lt;",
          ">":"&gt;",
          '"':"&quot;",
          "'":"&#39;"
        }[ch]));
      }

      function safeDisplayPosition(pos){
        if (pos === "F") return "Forward";
        if (pos === "D") return "Defense";
        if (pos === "TG") return "Team Goalie";
        if (pos === "G") return "Goalie";
        return pos || "";
      }

      function safeFantasyPoints(player){
        if (!player) return 0;
        if (typeof player.fantasyPoints === "number") return Math.round(player.fantasyPoints * 10) / 10;
        const g = Number(player.goals || 0);
        const a = Number(player.assists || 0);
        const wins = Number(player.goalieWins || 0);
        return (g * 2) + a + (wins * 5);
      }

      function safeTeamLogoUrl(team){
        const aliases = {
          ARI:"UTA",
          LA:"LAK",
          LOSANGELES:"LAK",
          MONTREAL:"MTL",
          TAMPA:"TBL",
          VEGAS:"VGK",
          WASHINGTON:"WSH",
          WINNIPEG:"WPG",
          NEWJERSEY:"NJD",
          NEWYORKI:"NYI",
          NEWYORKR:"NYR",
          SANJOSE:"SJS",
          STLOUIS:"STL",
          COLUMBUS:"CBJ",
          CALGARY:"CGY"
        };
        let abbr = String(team || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        abbr = aliases[abbr] || abbr;
        const valid = new Set(["ANA","BOS","BUF","CAR","CBJ","CGY","CHI","COL","DAL","DET","EDM","FLA","LAK","MIN","MTL","NJD","NSH","NYI","NYR","OTT","PHI","PIT","SEA","SJS","STL","TBL","TOR","UTA","VAN","VGK","WPG","WSH"]);
        if (!valid.has(abbr)) return "";
        // Same style as NHL player mugs: direct NHL asset URL, but for team logos.
        return `https://assets.nhle.com/logos/nhl/svg/${abbr}_light.svg`;
      }

      function safeTeamAbbrFromPlayer(player){
        const valid = ["ANA","BOS","BUF","CAR","CBJ","CGY","CHI","COL","DAL","DET","EDM","FLA","LAK","MIN","MTL","NJD","NSH","NYI","NYR","OTT","PHI","PIT","SEA","SJS","STL","TBL","TOR","UTA","VAN","VGK","WPG","WSH"];
        const validSet = new Set(valid);

        const rawFields = [
          player && player.nhlTeam,
          player && player.teamAbbrev,
          player && player.team,
          player && player.abbrev,
          player && player.triCode,
          player && player.teamCode
        ].map(v => String(v || "").toUpperCase().trim()).filter(Boolean);

        for (const raw of rawFields) {
          const cleaned = raw.replace(/[^A-Z0-9]/g, "");
          if (validSet.has(cleaned)) return cleaned;
          if (cleaned === "LA") return "LAK";
          if (cleaned === "ARI") return "UTA";
        }

        const source = [
          player && player.name,
          player && player.fullTeamName,
          player && player.teamName,
          player && player.nhlTeamName
        ].map(v => String(v || "").toUpperCase()).join(" ");

        const names = [
          ["ANA", ["ANAHEIM","DUCKS"]],
          ["BOS", ["BOSTON","BRUINS"]],
          ["BUF", ["BUFFALO","SABRES"]],
          ["CAR", ["CAROLINA","HURRICANES"]],
          ["CBJ", ["COLUMBUS","BLUE JACKETS"]],
          ["CGY", ["CALGARY","FLAMES"]],
          ["CHI", ["CHICAGO","BLACKHAWKS"]],
          ["COL", ["COLORADO","AVALANCHE"]],
          ["DAL", ["DALLAS","STARS"]],
          ["DET", ["DETROIT","RED WINGS"]],
          ["EDM", ["EDMONTON","OILERS"]],
          ["FLA", ["FLORIDA","PANTHERS"]],
          ["LAK", ["LOS ANGELES","KINGS"]],
          ["MIN", ["MINNESOTA","WILD"]],
          ["MTL", ["MONTREAL","CANADIENS"]],
          ["NJD", ["NEW JERSEY","DEVILS"]],
          ["NSH", ["NASHVILLE","PREDATORS"]],
          ["NYI", ["ISLANDERS"]],
          ["NYR", ["RANGERS"]],
          ["OTT", ["OTTAWA","SENATORS"]],
          ["PHI", ["PHILADELPHIA","FLYERS"]],
          ["PIT", ["PITTSBURGH","PENGUINS"]],
          ["SEA", ["SEATTLE","KRAKEN"]],
          ["SJS", ["SAN JOSE","SHARKS"]],
          ["STL", ["ST LOUIS","BLUES"]],
          ["TBL", ["TAMPA BAY","LIGHTNING"]],
          ["TOR", ["TORONTO","MAPLE LEAFS"]],
          ["UTA", ["UTAH","MAMMOTH","HOCKEY CLUB"]],
          ["VAN", ["VANCOUVER","CANUCKS"]],
          ["VGK", ["VEGAS","GOLDEN KNIGHTS"]],
          ["WPG", ["WINNIPEG","JETS"]],
          ["WSH", ["WASHINGTON","CAPITALS"]]
        ];

        for (const [abbr, tokens] of names) {
          if (tokens.some(token => source.includes(token))) return abbr;
        }

        for (const abbr of valid) {
          if (source.includes(abbr)) return abbr;
        }

        return "";
      }

      function safeTeamGoalieLogoUrl(player){
        const abbr = safeTeamAbbrFromPlayer(player);
        return abbr ? safeTeamLogoUrl(abbr) : "";
      }

      function safePlayerImageUrl(player){
        const id = player && (player.playerId || player.id || player.nhlId);
        if (id && String(id).match(/^\d+$/)) {
          return `https://assets.nhle.com/mugs/nhl/latest/${id}.png`;
        }
        return "";
      }

      function safeTeamClassName(team){
        return `team-${String(team || "na").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      }

      function safeOwnerWatermarkUrl(ownerId){
        const id = String(ownerId || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
        const map = {
          nick:"assets/images/owner-watermarks/nick-watermark.png",
          chris:"assets/images/owner-watermarks/chris-watermark.png",
          andrew:"assets/images/owner-watermarks/andrew-watermark.png",
          tyler:"assets/images/owner-watermarks/tyler-watermark.png",
          scott:"assets/images/owner-watermarks/scott-watermark.png"
        };
        return map[id] || "";
      }

      function renderLiveDraftTicker(draft, force = false){
        const cardHost = document.getElementById("v126ResultsCardHost");
        if (!cardHost) return;

        const owners = Array.isArray(draft && draft.owners) && draft.owners.length ? draft.owners : OWNERS;
        const order = Array.isArray(draft && draft.draftOrder) && draft.draftOrder.length ? draft.draftOrder : owners.map(o => o.id);
        const picks = Array.isArray(draft && draft.picks) ? draft.picks : [];
        const pickIndex = picks.length;

        const resultCount = Math.max(10, picks.length);
        const newCards = [];

        for (let i = 0; i < resultCount; i++) {
          const pick = picks[i];
          if (pick && pick.player) {
            const p = pick.player || {};
            const player = p.name || "Unknown Player";
            const owner = pick.ownerName || ownerName(pick.ownerId);
            const pos = safeDisplayPosition(p.position || "");
            const team = p.nhlTeam || p.teamAbbrev || "";
            const fantasy = safeFantasyPoints(p);
            const rawPosition = String(p.position || "").toUpperCase();
            const rawId = String(p.id || p.playerId || p.nhlId || "").toLowerCase();
            const lowerName = String(player || "").toLowerCase();
            const isTeamGoalie = rawPosition === "TG" || rawPosition === "TEAM_GOALIE" || rawId.includes("team-goalie") || lowerName.includes("team goalie") || lowerName.includes("goalies");
            const teamGoalieLogo = isTeamGoalie ? safeTeamGoalieLogoUrl(p) : "";
            const pic = isTeamGoalie ? teamGoalieLogo : safePlayerImageUrl(p);
            if (isTeamGoalie && !teamGoalieLogo) console.warn("Team Goalie logo not resolved:", p);
            const picType = isTeamGoalie ? "team-logo" : "headshot";
            const logo = safeOwnerWatermarkUrl(pick.ownerId);
            const playerId = p.id || p.playerId || p.nhlId || "";
            const roundNumber = Math.floor(i / Math.max(1, order.length)) + 1;
            const pickInRound = (i % Math.max(1, order.length)) + 1;
            newCards.push({
              key:`filled-${i + 1}-${playerId}-${player}`,
              type:"filled",
              pickNumber:i + 1,
              roundNumber,
              pickInRound,
              player,
              owner,
              ownerId: pick.ownerId,
              pos,
              team,
              fantasy,
              pic,
              picType,
              goalieFallback: isTeamGoalie ? (safeTeamAbbrFromPlayer(p) || "TG") : "",
              logo,
              teamClass:safeTeamClassName(team)
            });
          } else {
            const roundNumber = Math.floor(i / Math.max(1, order.length)) + 1;
            const pickInRound = (i % Math.max(1, order.length)) + 1;
            newCards.push({
              key:`tba-${i + 1}`,
              type:"tba",
              pickNumber:i + 1,
              roundNumber,
              pickInRound,
              player:"TBA",
              owner:"—",
              pos:`Waiting for pick ${i + 1}`,
              team:"",
              fantasy:"",
              pic:"",
              logo:"",
              teamClass:"team-tba"
            });
          }
        }

        const resultsSignature = `${picks.length}|${picks.map(p => (p.pickNumber || "") + ":" + (p.player && (p.player.id || p.player.playerId || p.player.nhlId) || "")).join(",")}`;
        const signature = `${pickIndex}|${order.join(",")}|${resultsSignature}`;

        if (!force && signature === lastLiveTickerSignature && cardHost.dataset.v129Ready === "1") return;
        lastLiveTickerSignature = signature;
        cardHost.dataset.v129Ready = "1";

        // Bottom Draft Results ticker only. No live/upcoming ticker is rendered in V129.
        setV127ResultsCards(newCards, resultsSignature);
      }

      function resultCardHtml(card){
        if (!card) return "";
        if (card.type === "filled") {
          return `<div id="v126ResultsCard" class="v126-results-card filled ${safeHtml(card.teamClass)}" style="--team-logo:url('${safeHtml(card.logo)}')">
            ${card.logo ? `<img class="v133-owner-watermark-img" src="${safeHtml(card.logo)}" alt="" loading="lazy" aria-hidden="true">` : ""}
            ${card.pic ? `<img class="v126-result-headshot ${card.picType === "team-logo" ? "v136-team-goalie-logo" : ""}" src="${safeHtml(card.pic)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'v126-pick-num v137-tg-fallback',textContent:'${safeHtml(card.goalieFallback || card.pickNumber)}'}))">` : `<span class="v126-pick-num ${card.goalieFallback ? "v137-tg-fallback" : ""}">${safeHtml(card.goalieFallback || card.pickNumber)}</span>`}
            <span class="v126-result-main">
              <strong>${safeHtml(card.player)}</strong>
              <em>${safeHtml(card.pos)}${card.team ? " • " + safeHtml(card.team) : ""} • ${safeHtml(card.fantasy)} FP</em>
            </span>
            <span class="v126-drafted-by">
              <small>Drafted by</small>
              ${safeHtml(card.owner)}
            </span>
          </div>`;
        }

        return `<div id="v126ResultsCard" class="v126-results-card tba">
          <span class="v126-pick-num">${safeHtml(card.pickNumber)}</span>
          <span class="v126-result-main">
            <strong>TBA</strong>
            <em>${safeHtml(card.pos || ("Waiting for pick " + card.pickNumber))}</em>
          </span>
          <span class="v126-drafted-by">
            <small>Drafted by</small>
            —
          </span>
        </div>`;
      }

      function renderSingleResultCard(card){
        const host = document.getElementById("v126ResultsCardHost");
        const roundPickLabel = document.getElementById("v135RoundPickLabel");
        if (!host || !card) return;
        if (roundPickLabel) {
          roundPickLabel.textContent = `R:${card.roundNumber || ""} P:${card.pickInRound || ""}`;
        }
        const state = window.__v127ResultsTicker;
        if (state.lastRenderedKey === card.key && host.querySelector("#v126ResultsCard")) return;

        host.innerHTML = resultCardHtml(card);
        state.lastRenderedKey = card.key;

        const rendered = document.getElementById("v126ResultsCard");
        if (rendered) {
          rendered.classList.remove("entering");
          void rendered.offsetWidth;
          rendered.classList.add("entering");
        }
      }

      function setV127ResultsCards(cards, signature){
        const state = window.__v127ResultsTicker;
        if (!Array.isArray(cards) || !cards.length) return;

        const oldCurrent = state.cards[state.index] || null;
        const oldKey = oldCurrent && oldCurrent.key;

        state.cards = cards;

        if (oldKey) {
          const sameIndex = cards.findIndex(card => card.key === oldKey);
          if (sameIndex >= 0) state.index = sameIndex;
          else if (state.index >= cards.length) state.index = 0;
        } else if (state.index >= cards.length) {
          state.index = 0;
        }

        resultsTickerSignature = signature;

        if (!state.started) {
          state.started = true;
          startV127ResultsTicker();
        } else if (!document.getElementById("v126ResultsCard")) {
          renderSingleResultCard(state.cards[state.index] || state.cards[0]);
        }
      }

      function startV127ResultsTicker(){
        const state = window.__v127ResultsTicker;
        if (state.intervalId) clearInterval(state.intervalId);

        function tick(){
          const currentState = window.__v127ResultsTicker;
          if (!currentState.cards.length) return;

          if (currentState.index >= currentState.cards.length) currentState.index = 0;

          const card = currentState.cards[currentState.index];
          renderSingleResultCard(card);

          currentState.index = (currentState.index + 1) % currentState.cards.length;
        }

        tick();
        state.intervalId = setInterval(tick, 5000);
      }

      function renderTickerFromOrder(order){
        // V114: ticker is live-draft-only. Lottery results never write into it.
        refreshLiveDraftTicker();
      }

      async function refreshLiveDraftTicker(force = false){
        try{
          // Prefer the live draft room object. This is the draft the user is actually seeing.
          // /api/draft can lag/fail briefly; using only it caused the bottom ticker to show TBA
          // even when the draft room already had picks.
          if (window.__currentLiveDraft && Array.isArray(window.__currentLiveDraft.picks)) {
            renderLiveDraftTicker(window.__currentLiveDraft, force);
            if ((window.__currentLiveDraft.picks || []).length) return;
          }

          if (window.officialDraftApi && window.officialDraftApi.load) {
            const sharedDraft = await window.officialDraftApi.load().catch(()=>null);
            if (sharedDraft) {
              window.__currentLiveDraft = sharedDraft;
              renderLiveDraftTicker(sharedDraft, force);
            }
          }
        }catch(error){
          console.warn("Draft Results ticker sync failed:", error);
        }
      }

      async function loadState(){
        try{
          const res = await fetch("/api/live-lottery?t=" + Date.now(), { cache:"no-store" });
          const data = await res.json();
          return data && data.state ? data.state : { phase:"idle" };
        }catch(e){
          return { phase:"idle" };
        }
      }

      async function postAction(action, extra){
        const res = await fetch("/api/live-lottery", {
          method:"POST",
          headers:{ "Content-Type":"application/json" },
          body:JSON.stringify({ action, ...(extra || {}) })
        });
        const data = await res.json();
        return data && data.state ? data.state : { phase:"idle" };
      }

      function setRevealMode(mode){
        const overlay = document.getElementById("liveLotteryOverlay");
        if (!overlay) return;
        overlay.classList.toggle("mode-ready", mode === "ready");
        overlay.classList.toggle("mode-host", mode === "host");
        overlay.classList.toggle("mode-board", mode === "board");
        overlay.classList.toggle("mode-final", mode === "final");
      }

      function showSingleBoard(pickNo, ownerId, winner){
        const board = document.getElementById("familyFeudBoard");
        if (!board) return;
        board.hidden = false;
        board.innerHTML = `
          <div class="lottery-single-board ${winner ? "winner-board" : ""}">
            <div class="board-label">${winner ? "Lottery Winner" : "Pick " + pickNo}</div>
            <div class="board-hidden-name" id="singleRevealName">${ownerName(ownerId)}</div>
          </div>`;
      }

      async function revealSinglePick(pickNo, ownerId, options = {}){
        if (skipLotteryReveal) return;
        setRevealMode("host");
        setSpeech(options.intro || `The ${pickNo} pick goes to...`);
        await sleep(options.introDelay || 2600);
        if (skipLotteryReveal) return;

        setRevealMode("board");
        showSingleBoard(pickNo, ownerId, options.winner);
        await sleep(options.boardDelay || 3200);
        if (skipLotteryReveal) return;

        const name = document.getElementById("singleRevealName");
        if (name) name.classList.add("revealed");
        await sleep(options.revealedDelay || 3600);
        if (skipLotteryReveal) return;

        setRevealMode("host");
        setSpeech(options.outro || `The pick belongs to ${ownerName(ownerId)}.`);
        await sleep(options.outroDelay || 2800);
      }

      function showFinalBoard(order){
        const board = document.getElementById("familyFeudBoard");
        if (!board) return;
        setRevealMode("final");
        setText("liveLotteryTitle", "Final Draft Order");
        setText("liveLotteryMessage", "The lottery reveal is complete.");
        board.hidden = false;
        board.innerHTML = `
          <div class="lottery-final-board">
            ${order.map((id, idx) => `<div class="final-pick ${idx === 0 ? "winner" : ""}"><b>${idx+1}</b><span>${ownerName(id)}</span></div>`).join("")}
          </div>`;
        const leave = document.getElementById("leaveLotteryBtn");
        if (leave) leave.hidden = false;
      }

      async function replayOrder(order, sessionId, options = {}){
        if (!Array.isArray(order) || order.length < 5) return;
        const alreadyOfficial = Boolean(options.alreadyOfficial);
        const videoOnly = Boolean(options.videoOnly);
        const enterBtn = document.getElementById("enterLiveLotteryBtn");
        const testBtn = document.getElementById("testJoinAllLotteryBtn");
        const leave = document.getElementById("leaveLotteryBtn");
        const close = document.getElementById("closeLiveLotteryBtn");
        const skipBtn = document.getElementById("skipLotteryRevealBtn");

        showOverlay();
        skipLotteryReveal = false;
        revealStartedFor = sessionId || "replay";
        if (enterBtn) enterBtn.hidden = true;
        if (testBtn) testBtn.hidden = true;
        if (leave) leave.hidden = true;
        if (close) close.disabled = true;
        if (skipBtn) skipBtn.hidden = false;
        renderJoined({ joined: OWNERS.map(o => o.id) });
        setText("liveLotteryTitle", "Draft Lottery Results");
        setText("liveLotteryMessage", "The lottery is now underway.");

        await revealSinglePick(5, order[4], {
          intro:"Good evening, managers. The lottery balls have settled, and the fifth pick is ready to be revealed...",
          outro:`At number five, we have ${ownerName(order[4])}. The board is open, the tension is real, and we move to pick four.`
        });
        await revealSinglePick(4, order[3], {
          intro:"The fourth selection is now on the board...",
          outro:`The fourth pick belongs to ${ownerName(order[3])}. Three spots remain, and the top of the draft is getting interesting.`
        });
        await revealSinglePick(3, order[2], {
          intro:"Now revealing the third overall pick...",
          outro:`The third pick goes to ${ownerName(order[2])}. That leaves two managers waiting, but only one lottery winner.`
        });
        await revealSinglePick(1, order[0], {
          winner:true,
          intro:"And now, the moment everyone came for. The winner of the draft lottery is...",
          introDelay:2600,
          boardDelay:3200,
          revealedDelay:3600,
          outro:`The first overall pick belongs to ${ownerName(order[0])}. Congratulations — you are officially on the clock.`,
          outroDelay:2800
        });

        if (videoOnly || alreadyOfficial) {
          setSpeech("Replay complete. This was only a replay and did not change the pool.");
        } else {
          setSpeech("The lottery is complete. The draft order is now being saved for the live draft.");
        }
        showFinalBoard(order);

        if (videoOnly || alreadyOfficial) {
          if (leave) leave.hidden = true;
        } else {
          await finalizeLottery();
          setSpeech("The draft order is official. You can leave the lottery when you're ready.");
          if (leave) {
            leave.hidden = false;
            leave.textContent = "Leave Lottery";
          }
        }

        await refreshLiveDraftTicker(true);
        if (skipBtn) skipBtn.hidden = true;
        if (close) close.disabled = false;
      }

      async function revealBoard(state){
        if (!state || !Array.isArray(state.order)) return;
        if (revealStartedFor === state.sessionId) return;
        await replayOrder(state.order, state.sessionId, { alreadyOfficial:Boolean(state.finalized), videoOnly:false });
      }

      async function finalizeLottery(){
        const state = await postAction("finalize");
        const order = state && Array.isArray(state.order) ? state.order : [];
        if (order.length) {
          await refreshLiveDraftTicker(true);
        }
        if (window.officialDraftApi && window.officialDraftApi.load) {
          const draft = await window.officialDraftApi.load().catch(()=>null);
          if (draft) {
            if (window.renderDraftRosters) window.renderDraftRosters(draft);
          }
        }
        return state;
      }

      async function finalizeLotteryAndLeave(){
        await finalizeLottery();
        hideOverlay();
      }

      async function replayCurrentLottery(){
        // Replay is video-only and always uses the rebuilt reveal.
        // First choice: official saved /api/draft order.
        const oldOverlay = document.getElementById("lotteryPopoutOverlay");
        if (oldOverlay) oldOverlay.classList.remove("show");
        document.body.classList.remove("lottery-popout-open");

        if (window.officialDraftApi && window.officialDraftApi.load) {
          const draft = await window.officialDraftApi.load().catch(()=>null);
          if (draft && Array.isArray(draft.draftOrder) && draft.draftOrder.length) {
            await replayOrder(draft.draftOrder, "draft-replay", { alreadyOfficial:true, videoOnly:true });
            return;
          }
        }

        let state = await loadState();
        if (state && Array.isArray(state.order) && state.order.length) {
          await replayOrder(state.order, state.sessionId || "replay", { alreadyOfficial:Boolean(state.finalized), videoOnly:true });
        }
      }

      async function renderState(state){
        if (!state) state = await loadState();

        if (state.phase === "waiting") {
          showOverlay();
          setRevealMode("ready");
          const enterBtn = document.getElementById("enterLiveLotteryBtn");
          const testBtn = document.getElementById("testJoinAllLotteryBtn");
          const leave = document.getElementById("leaveLotteryBtn");
          const board = document.getElementById("familyFeudBoard");
          if (board) board.hidden = true;
          if (enterBtn) enterBtn.hidden = false;
          if (testBtn) testBtn.hidden = false;
          if (leave) leave.hidden = true;
          setText("liveLotteryTitle", "Ready Check");
          setText("liveLotteryMessage", "The commissioner has started the live draft lottery. Confirm when you are ready.");
          setSpeech("I'm Commissioner Bettman. The lottery will begin once every manager is ready.");
          renderJoined(state);
          return;
        }

        if (state.phase === "revealing") {
          revealBoard(state);
          return;
        }

        if ((state.phase === "complete" || state.phase === "idle") && Array.isArray(state.order) && state.order.length && state.finalized) {
          refreshLiveDraftTicker();
        }
      }

      async function runLottery(){
        const ok = confirm("Run the live draft lottery now? This clears the previous live lottery session.");
        if (!ok) return;
        const state = await postAction("start");
        revealStartedFor = "";
        renderState(state);
      }

      async function enterLotto(){
        const ownerId = activeOwnerId();
        if (!ownerId) {
          alert("Select your name under 'You are drafting as' first.");
          return;
        }
        const state = await postAction("join", { ownerId });
        renderState(state);
      }

      async function testJoinAllLottery(){
        let state = await loadState();
        if (state.phase !== "waiting") {
          state = await postAction("start");
          renderState(state);
          await sleep(400);
        }
        setSpeech("I'm Commissioner Bettman. Confirming every manager for testing.");
        state = await postAction("confirmAll");
        renderState(state);
      }

      function startPolling(){
        clearInterval(pollTimer);
        pollTimer = setInterval(async () => {
          await renderState(await loadState());
          await refreshLiveDraftTicker(false);
        }, 3500);
        setTimeout(async () => {
          await renderState(await loadState());
          await refreshLiveDraftTicker(true);
        }, 600);
      }

      document.addEventListener("click", async function(event){
        const replay = event.target.closest && event.target.closest("#replayLotteryBtn");
        if (replay) {
          event.preventDefault();
          event.stopPropagation();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          replayCurrentLottery();
          return;
        }
        const run = event.target.closest && event.target.closest("#runLiveLotteryBtn");
        if (run) {
          event.preventDefault();
          event.stopPropagation();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          runLottery();
          return;
        }
        const enter = event.target.closest && event.target.closest("#enterLiveLotteryBtn");
        if (enter) {
          event.preventDefault();
          enterLotto();
          return;
        }
        const testAll = event.target.closest && event.target.closest("#testJoinAllLotteryBtn, #testJoinAllLotteryAdminBtn");
        if (testAll) {
          event.preventDefault();
          event.stopPropagation();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          testJoinAllLottery();
          return;
        }
        const skip = event.target.closest && event.target.closest("#skipLotteryRevealBtn");
        if (skip) {
          event.preventDefault();
          skipLotteryReveal = true;
          const state = await loadState();
          if (state && Array.isArray(state.order) && state.order.length) {
            showFinalBoard(state.order);
            setSpeech("Skipped to the final board. The draft order is ready.");
            const leaveBtn = document.getElementById("leaveLotteryBtn");
            const skipBtn = document.getElementById("skipLotteryRevealBtn");
            const closeBtn = document.getElementById("closeLiveLotteryBtn");
            if (skipBtn) skipBtn.hidden = true;
            if (leaveBtn) leaveBtn.hidden = false;
            if (closeBtn) closeBtn.disabled = false;
            if (!state.finalized) await finalizeLottery();
          }
          return;
        }

        const leave = event.target.closest && event.target.closest("#leaveLotteryBtn");
        if (leave) {
          event.preventDefault();
          finalizeLotteryAndLeave();
          return;
        }
        const close = event.target.closest && event.target.closest("#closeLiveLotteryBtn");
        if (close) {
          event.preventDefault();
          hideOverlay();
          return;
        }
      }, true);

      window.addEventListener("load", () => { startPolling(); setTimeout(() => refreshLiveDraftTicker(true), 500); if (window.__pendingLiveLotteryReplay) { window.__pendingLiveLotteryReplay = false; replayCurrentLottery(); } });
      window.liveLottery = { runLottery, enterLotto, testJoinAllLottery, replayCurrentLottery, finalizeLotteryAndLeave, refreshLiveDraftTicker, renderLiveDraftTicker, loadState, renderState };
    })();
  


  // V151 final override: walkable locker room hub + all five owner stall views.
  (() => {
    const DEFAULT_OWNERS = [
      { id:'nick', name:'Nick', teamName:'Nick' },
      { id:'chris', name:'Chris', teamName:'Chris' },
      { id:'andrew', name:'Andrew', teamName:'Andrew' },
      { id:'tyler', name:'Tyler', teamName:'Tyler' },
      { id:'scott', name:'Scott', teamName:'Scott' }
    ];
    const STALLS = {
      nick: {
        image:'assets/images/locker-stall-nick.png?v=168',
        number:'72',
        jersey:'McKenna / Rafer Alston',
        theme:'Leafs • Raptors • Bat Flip • Kawhi • bands',
        ready:true
      },
      andrew: {
        image:'assets/images/locker-stall-andrew.png?v=168',
        number:'88',
        jersey:'Porter Martone',
        theme:'Flyers • Gears of War • gritty orange/black',
        ready:true
      },
      tyler: {
        image:'assets/images/locker-stall-tyler.png?v=168',
        number:'13',
        jersey:'Domi / Clark',
        theme:'Leafs tough guys • GoldenEye 007',
        ready:true
      },
      chris: {
        image:'assets/images/locker-stall-chris.png?v=168',
        number:'93',
        jersey:'Vince Carter / Gilmour',
        theme:'Raptors • Mario Kart • March Madness',
        ready:true
      },
      scott: {
        image:'assets/images/locker-stall-scott.png?v=168',
        number:'???',
        jersey:'Mystery Man',
        theme:'International man of mystery • secret draft files',
        ready:true
      }
    };
    window.__lastYearStaticRosters = window.__lastYearStaticRosters || null;
    const LAST_YEAR_STATIC_ROSTERS = {"tyler": [{"id": "tyler-draisaitl-2025", "name": "Leon Draisaitl", "position": "F", "nhlTeam": "EDM", "type": "skater", "goals": 35, "assists": 62, "points": 97, "shortHandedGoals": 1, "gameWinningGoals": 3}, {"id": "tyler-pastrnak-2025", "name": "David Pastrnak", "position": "F", "nhlTeam": "BOS", "type": "skater", "goals": 29, "assists": 71, "points": 100, "shortHandedGoals": 0, "gameWinningGoals": 4}, {"id": "tyler-jhughes-2025", "name": "Jack Hughes", "position": "F", "nhlTeam": "NJD", "type": "skater", "goals": 27, "assists": 50, "points": 77, "shortHandedGoals": 1, "gameWinningGoals": 5}, {"id": "tyler-eichel-2025", "name": "Jack Eichel", "position": "F", "nhlTeam": "VGK", "type": "skater", "goals": 27, "assists": 63, "points": 90, "shortHandedGoals": 1, "gameWinningGoals": 6}, {"id": "tyler-keller-2025", "name": "Clayton Keller", "position": "F", "nhlTeam": "UTA", "type": "skater", "goals": 26, "assists": 62, "points": 88, "shortHandedGoals": 0, "gameWinningGoals": 6}, {"id": "tyler-tavares-2025", "name": "John Tavares", "position": "F", "nhlTeam": "TOR", "type": "skater", "goals": 31, "assists": 40, "points": 71, "shortHandedGoals": 0, "gameWinningGoals": 4}, {"id": "tyler-chychrun-2025", "name": "Jakob Chychrun", "position": "D", "nhlTeam": "WAS", "type": "skater", "goals": 26, "assists": 34, "points": 60, "shortHandedGoals": 0, "gameWinningGoals": 8}, {"id": "tyler-harley-2025", "name": "Thomas Harley", "position": "D", "nhlTeam": "DAL", "type": "skater", "goals": 6, "assists": 30, "points": 36, "shortHandedGoals": 0, "gameWinningGoals": 4}, {"id": "tyler-parayko-2025", "name": "Colton Parayko", "position": "D", "nhlTeam": "STL", "type": "skater", "goals": 4, "assists": 14, "points": 18, "shortHandedGoals": 0, "gameWinningGoals": 0}, {"id": "tyler-sergachev-2025", "name": "Mikhail Sergachev", "position": "D", "nhlTeam": "UTA", "type": "skater", "goals": 10, "assists": 49, "points": 59, "shortHandedGoals": 0, "gameWinningGoals": 1}, {"id": "tyler-woll-2025", "name": "Joseph Woll", "position": "G", "nhlTeam": "TOR", "type": "goalie", "goalieWins": 15, "goalieAssists": 1, "goalieGoals": 0, "goalieShutouts": 2, "goals": 0, "assists": 1, "points": 1}, {"id": "tyler-stolarz-2025", "name": "Anthony Stolarz", "position": "G", "nhlTeam": "TOR", "type": "goalie", "goalieWins": 10, "goalieAssists": 0, "goalieGoals": 0, "goalieShutouts": 0, "goals": 0, "assists": 0, "points": 0}], "nick": [{"id": "nick-matthews-2025", "name": "Auston Matthews", "position": "F", "nhlTeam": "TOR", "type": "skater", "goals": 27, "assists": 26, "points": 53, "shortHandedGoals": 0, "gameWinningGoals": 3}, {"id": "nick-crosby-2025", "name": "Sidney Crosby", "position": "F", "nhlTeam": "PIT", "type": "skater", "goals": 29, "assists": 45, "points": 74, "shortHandedGoals": 0, "gameWinningGoals": 4}, {"id": "nick-scheifele-2025", "name": "Mark Scheifele", "position": "F", "nhlTeam": "WPG", "type": "skater", "goals": 36, "assists": 67, "points": 103, "shortHandedGoals": 0, "gameWinningGoals": 6}, {"id": "nick-aho-2025", "name": "Sebastian Aho", "position": "F", "nhlTeam": "CAR", "type": "skater", "goals": 27, "assists": 53, "points": 80, "shortHandedGoals": 2, "gameWinningGoals": 4}, {"id": "nick-celebrini-2025", "name": "Macklin Celebrini", "position": "F", "nhlTeam": "SJS", "type": "skater", "goals": 45, "assists": 70, "points": 115, "shortHandedGoals": 0, "gameWinningGoals": 5}, {"id": "nick-bedard-2025", "name": "Connor Bedard", "position": "F", "nhlTeam": "CHI", "type": "skater", "goals": 30, "assists": 45, "points": 75, "shortHandedGoals": 0, "gameWinningGoals": 5}, {"id": "nick-makar-2025", "name": "Cale Makar", "position": "D", "nhlTeam": "COL", "type": "skater", "goals": 20, "assists": 59, "points": 79, "shortHandedGoals": 0, "gameWinningGoals": 4}, {"id": "nick-josi-2025", "name": "Roman Josi", "position": "D", "nhlTeam": "NSH", "type": "skater", "goals": 13, "assists": 42, "points": 55, "shortHandedGoals": 0, "gameWinningGoals": 3}, {"id": "nick-sanderson-2025", "name": "Jake Sanderson", "position": "D", "nhlTeam": "OTT", "type": "skater", "goals": 14, "assists": 40, "points": 54, "shortHandedGoals": 0, "gameWinningGoals": 3}, {"id": "nick-dobson-2025", "name": "Noah Dobson", "position": "D", "nhlTeam": "MTL", "type": "skater", "goals": 12, "assists": 35, "points": 47, "shortHandedGoals": 0, "gameWinningGoals": 1}, {"id": "nick-comrie-2025", "name": "Eric Comrie", "position": "G", "nhlTeam": "WPG", "type": "goalie", "goalieWins": 12, "goalieAssists": 0, "goalieGoals": 0, "goalieShutouts": 0, "goals": 0, "assists": 0, "points": 0}, {"id": "nick-hellebuyck-2025", "name": "Connor Hellebuyck", "position": "G", "nhlTeam": "WPG", "type": "goalie", "goalieWins": 23, "goalieAssists": 0, "goalieGoals": 0, "goalieShutouts": 0, "goals": 0, "assists": 0, "points": 0}], "scott": [{"id": "scott-mcdavid-2025", "name": "Connor McDavid", "position": "F", "nhlTeam": "EDM", "type": "skater", "goals": 48, "assists": 90, "points": 138, "shortHandedGoals": 1, "gameWinningGoals": 4}, {"id": "scott-nylander-2025", "name": "William Nylander", "position": "F", "nhlTeam": "TOR", "type": "skater", "goals": 30, "assists": 49, "points": 79, "shortHandedGoals": 0, "gameWinningGoals": 4}, {"id": "scott-connor-2025", "name": "Kyle Connor", "position": "F", "nhlTeam": "WPG", "type": "skater", "goals": 39, "assists": 53, "points": 92, "shortHandedGoals": 2, "gameWinningGoals": 5}, {"id": "scott-hagel-2025", "name": "Brandon Hagel", "position": "F", "nhlTeam": "TBL", "type": "skater", "goals": 36, "assists": 38, "points": 74, "shortHandedGoals": 1, "gameWinningGoals": 6}, {"id": "scott-reinhart-2025", "name": "Sam Reinhart", "position": "F", "nhlTeam": "FLA", "type": "skater", "goals": 29, "assists": 32, "points": 61, "shortHandedGoals": 3, "gameWinningGoals": 6}, {"id": "scott-guentzel-2025", "name": "Jake Guentzel", "position": "F", "nhlTeam": "TBL", "type": "skater", "goals": 38, "assists": 50, "points": 88, "shortHandedGoals": 2, "gameWinningGoals": 5}, {"id": "scott-morrissey-2025", "name": "Josh Morrissey", "position": "D", "nhlTeam": "WPG", "type": "skater", "goals": 14, "assists": 41, "points": 55, "shortHandedGoals": 0, "gameWinningGoals": 2}, {"id": "scott-hedman-2025", "name": "Victor Hedman", "position": "D", "nhlTeam": "TBL", "type": "skater", "goals": 1, "assists": 16, "points": 17, "shortHandedGoals": 0, "gameWinningGoals": 0}, {"id": "scott-seider-2025", "name": "Moritz Seider", "position": "D", "nhlTeam": "DET", "type": "skater", "goals": 10, "assists": 50, "points": 60, "shortHandedGoals": 0, "gameWinningGoals": 2}, {"id": "scott-heiskanen-2025", "name": "Miro Heiskanen", "position": "D", "nhlTeam": "DAL", "type": "skater", "goals": 9, "assists": 54, "points": 63, "shortHandedGoals": 1, "gameWinningGoals": 3}, {"id": "scott-oettinger-2025", "name": "Jake Oettinger", "position": "G", "nhlTeam": "DAL", "type": "goalie", "goalieWins": 35, "goalieAssists": 1, "goalieGoals": 0, "goalieShutouts": 4, "goals": 0, "assists": 1, "points": 1}, {"id": "scott-desmith-2025", "name": "Casey DeSmith", "position": "G", "nhlTeam": "DAL", "type": "goalie", "goalieWins": 15, "goalieAssists": 0, "goalieGoals": 0, "goalieShutouts": 1, "goals": 0, "assists": 0, "points": 0}], "chris": [{"id": "chris-kucherov-2025", "name": "Nikita Kucherov", "position": "F", "nhlTeam": "TBL", "type": "skater", "goals": 44, "assists": 86, "points": 130, "shortHandedGoals": 1, "gameWinningGoals": 8}, {"id": "chris-kaprizov-2025", "name": "Kirill Kaprizov", "position": "F", "nhlTeam": "MIN", "type": "skater", "goals": 45, "assists": 44, "points": 89, "shortHandedGoals": 0, "gameWinningGoals": 7}, {"id": "chris-rantanen-2025", "name": "Mikko Rantanen", "position": "F", "nhlTeam": "DAL", "type": "skater", "goals": 22, "assists": 55, "points": 77, "shortHandedGoals": 0, "gameWinningGoals": 1}, {"id": "chris-point-2025", "name": "Brayden Point", "position": "F", "nhlTeam": "TBL", "type": "skater", "goals": 18, "assists": 32, "points": 50, "shortHandedGoals": 0, "gameWinningGoals": 0}, {"id": "chris-robertson-2025", "name": "Jason Robertson", "position": "F", "nhlTeam": "DAL", "type": "skater", "goals": 45, "assists": 51, "points": 96, "shortHandedGoals": 0, "gameWinningGoals": 9}, {"id": "chris-stutzle-2025", "name": "Tim Stützle", "position": "F", "nhlTeam": "OTT", "type": "skater", "goals": 34, "assists": 49, "points": 83, "shortHandedGoals": 2, "gameWinningGoals": 5}, {"id": "chris-qhughes-2025", "name": "Quinn Hughes", "position": "D", "nhlTeam": "VAN", "type": "skater", "goals": 7, "assists": 69, "points": 76, "shortHandedGoals": 0, "gameWinningGoals": 1}, {"id": "chris-bouchard-2025", "name": "Evan Bouchard", "position": "D", "nhlTeam": "EDM", "type": "skater", "goals": 21, "assists": 74, "points": 95, "shortHandedGoals": 0, "gameWinningGoals": 5}, {"id": "chris-fox-2025", "name": "Adam Fox", "position": "D", "nhlTeam": "NYR", "type": "skater", "goals": 9, "assists": 44, "points": 53, "shortHandedGoals": 0, "gameWinningGoals": 1}, {"id": "chris-montour-2025", "name": "Brandon Montour", "position": "D", "nhlTeam": "SEA", "type": "skater", "goals": 11, "assists": 21, "points": 32, "shortHandedGoals": 0, "gameWinningGoals": 3}, {"id": "chris-bobrovsky-2025", "name": "Sergei Bobrovsky", "position": "G", "nhlTeam": "FLA", "type": "goalie", "goalieWins": 27, "goalieAssists": 1, "goalieGoals": 0, "goalieShutouts": 4, "goals": 0, "assists": 1, "points": 1}, {"id": "chris-tarasov-2025", "name": "Daniil Tarasov", "position": "G", "nhlTeam": "FLA", "type": "goalie", "goalieWins": 13, "goalieAssists": 0, "goalieGoals": 0, "goalieShutouts": 0, "goals": 0, "assists": 0, "points": 0}], "andrew": [{"id": "andrew-mackinnon-2025", "name": "Nathan MacKinnon", "position": "F", "nhlTeam": "COL", "type": "skater", "goals": 53, "assists": 74, "points": 127, "shortHandedGoals": 0, "gameWinningGoals": 7}, {"id": "andrew-marner-2025", "name": "Mitch Marner", "position": "F", "nhlTeam": "VGK", "type": "skater", "goals": 24, "assists": 56, "points": 80, "shortHandedGoals": 0, "gameWinningGoals": 2}, {"id": "andrew-suzuki-2025", "name": "Nick Suzuki", "position": "F", "nhlTeam": "MTL", "type": "skater", "goals": 29, "assists": 72, "points": 101, "shortHandedGoals": 1, "gameWinningGoals": 2}, {"id": "andrew-thompson-2025", "name": "Tage Thompson", "position": "F", "nhlTeam": "BUF", "type": "skater", "goals": 40, "assists": 41, "points": 81, "shortHandedGoals": 0, "gameWinningGoals": 5}, {"id": "andrew-panarin-2025", "name": "Artemi Panarin", "position": "F", "nhlTeam": "NYR", "type": "skater", "goals": 28, "assists": 56, "points": 84, "shortHandedGoals": 0, "gameWinningGoals": 4}, {"id": "andrew-necas-2025", "name": "Martin Nečas", "position": "F", "nhlTeam": "COL", "type": "skater", "goals": 38, "assists": 62, "points": 100, "shortHandedGoals": 0, "gameWinningGoals": 5}, {"id": "andrew-werenski-2025", "name": "Zach Werenski", "position": "D", "nhlTeam": "CBJ", "type": "skater", "goals": 22, "assists": 59, "points": 81, "shortHandedGoals": 0, "gameWinningGoals": 2}, {"id": "andrew-hutson-2025", "name": "Lane Hutson", "position": "D", "nhlTeam": "MTL", "type": "skater", "goals": 12, "assists": 66, "points": 78, "shortHandedGoals": 0, "gameWinningGoals": 3}, {"id": "andrew-dahlin-2025", "name": "Rasmus Dahlin", "position": "D", "nhlTeam": "BUF", "type": "skater", "goals": 19, "assists": 55, "points": 74, "shortHandedGoals": 0, "gameWinningGoals": 0}, {"id": "andrew-lacombe-2025", "name": "Jackson LaCombe", "position": "D", "nhlTeam": "ANA", "type": "skater", "goals": 10, "assists": 48, "points": 58, "shortHandedGoals": 1, "gameWinningGoals": 0}, {"id": "andrew-hill-2025", "name": "Adin Hill", "position": "G", "nhlTeam": "VGK", "type": "goalie", "goalieWins": 10, "goalieAssists": 1, "goalieGoals": 0, "goalieShutouts": 1, "goals": 0, "assists": 1, "points": 1}, {"id": "andrew-schmid-2025", "name": "Akira Schmid", "position": "G", "nhlTeam": "VGK", "type": "goalie", "goalieWins": 16, "goalieAssists": 1, "goalieGoals": 0, "goalieShutouts": 2, "goals": 0, "assists": 1, "points": 1}]};
    window.__lastYearStaticRosters = LAST_YEAR_STATIC_ROSTERS;
    const room = window.__walkableLockerRoomState = window.__walkableLockerRoomState || { view:'hub', open:'nick', focus:'nick', lastDraft:null, entering:false };
    const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
    function getOwners(draft){
      const owners = Array.isArray(draft?.owners) && draft.owners.length ? draft.owners : DEFAULT_OWNERS;
      const normalized = owners.slice(0,5).map((o,i)=>({
        id:String(o.id || DEFAULT_OWNERS[i]?.id || `owner-${i+1}`).toLowerCase(),
        name:o.name || o.teamName || DEFAULT_OWNERS[i]?.name || `Owner ${i+1}`,
        teamName:o.teamName || o.name || DEFAULT_OWNERS[i]?.teamName || `Owner ${i+1}`
      }));
      const order = ['nick','andrew','tyler','chris','scott'];
      return normalized.sort((a,b)=>(order.indexOf(a.id) === -1 ? 99 : order.indexOf(a.id)) - (order.indexOf(b.id) === -1 ? 99 : order.indexOf(b.id)));
    }
    function playerName(p){
      const player = p?.player || p;
      return player?.name || player?.fullName || player?.displayName || p?.playerName || p?.name || 'Drafted Player';
    }
    function playerMeta(p){
      const player = p?.player || p;
      const bits = [];
      const pos = player?.position || player?.pos || player?.defaultPosition || p?.position;
      const team = player?.team || player?.nhlTeam || player?.currentTeamAbbrev || p?.team || p?.nhlTeam;
      if (pos) bits.push(pos);
      if (team) bits.push(team);
      return bits.join(' • ');
    }
    function groupPicks(draft, owners){
      const by = Object.fromEntries(owners.map(o => [String(o.id), []]));

      // First try any direct roster object, including the static rosters stored in this build.
      const rosterSources = [
        draft?.rosters,
        draft?.draft?.rosters,
        draft?.state?.rosters,
        window.__lastYearStaticRosters,
        LAST_YEAR_STATIC_ROSTERS
      ].filter(src => src && typeof src === 'object');

      for (const source of rosterSources) {
        owners.forEach(o => {
          const keys = [o.id, String(o.id).toLowerCase(), o.name, o.teamName].filter(Boolean);
          const arr = keys.map(k => source[k]).find(Array.isArray);
          if (arr && arr.length) by[o.id] = arr;
        });
      }

      // Then overlay any actual draft picks from the live draft API if they exist.
      const picks = Array.isArray(draft?.picks) ? draft.picks : Array.isArray(draft?.draft?.picks) ? draft.draft.picks : [];
      const pickedBy = Object.fromEntries(owners.map(o => [String(o.id), []]));
      picks.forEach((pick) => {
        const ownerId = String(pick.ownerId || pick.owner?.id || pick.teamId || pick.managerId || pick.draftedBy || '').toLowerCase();
        if (ownerId && pickedBy[ownerId]) pickedBy[ownerId].push(pick.player || pick);
      });
      const totalLivePicks = Object.values(pickedBy).reduce((sum, arr) => sum + arr.length, 0);
      if (totalLivePicks > 0) {
        owners.forEach(o => { by[o.id] = pickedBy[o.id] || []; });
      }

      return by;
    }
    function rosterRows(roster){
      if (!roster.length) return `<li class="empty-line"><b>No drafted players yet</b><em>Auto-draft or draft picks will print here.</em></li>`;
      return roster.slice(0,26).map((p,i)=>`<li><span>${String(i+1).padStart(2,'0')}</span><b>${esc(playerName(p))}</b>${playerMeta(p) ? `<em>${esc(playerMeta(p))}</em>` : ''}</li>`).join('');
    }
    function renderHub(target, owners, rosters){
      target.className = 'walkable-locker-host trophy-lobby-host';
      const ids = owners.map(o => o.id);
      if (!ids.includes(room.focus)) room.focus = ids[0] || 'nick';
      const focusIndex = Math.max(0, ids.indexOf(room.focus));
      const len = owners.length || 1;
      function relFor(idx){
        let rel = idx - focusIndex;
        if (rel > len / 2) rel -= len;
        if (rel < -len / 2) rel += len;
        return rel;
      }
      target.innerHTML = `
        <section class="trophy-lobby" aria-label="Trophy Room locker lobby">
          <div class="trophy-lobby-vignette"></div>
          <div class="trophy-lobby-title">
            <span class="tiny-cup">🏆</span>
            <p>Trophy Room</p>
            <h3>Choose Your Locker Room</h3>
            <small>Use the arrows or swipe to rotate the circular room. Select the lit center door to enter.</small>
          </div>
          <div class="trophy-door-ring" data-door-ring>
            ${owners.map((owner, idx) => {
              const stall = STALLS[owner.id] || {};
              const count = (rosters[owner.id] || []).length;
              const rel = relFor(idx);
              const pos = rel === 0 ? 'center' : rel === -1 ? 'left' : rel === 1 ? 'right' : rel < -1 ? 'hidden-left' : 'hidden-right';
              return `<button class="trophy-door trophy-door-${pos} ${rel === 0 ? 'is-center' : ''}" data-door-id="${esc(owner.id)}" style="--door-rel:${rel}; --door-index:${idx}">
                <span class="door-glow"></span>
                <span class="door-nameplate">${esc(owner.teamName || owner.name)}</span>
                <span class="door-panel-lines"><i></i><i></i><i></i></span>
                <span class="door-handle"></span>
                <span class="door-meta"><b>${esc(stall.number || '—')}</b><em>${count} players</em></span>
                <span class="door-enter-hint">${rel === 0 ? 'Enter room' : 'Rotate here'}</span>
              </button>`;
            }).join('')}
          </div>
          <button class="lobby-arrow lobby-arrow-left" data-lobby-prev aria-label="Previous locker door">‹</button>
          <button class="lobby-arrow lobby-arrow-right" data-lobby-next aria-label="Next locker door">›</button>
          <div class="lobby-control-deck">
            <span>Swipe / rotate</span>
            <div class="lobby-dots">${owners.map(o=>`<button class="${o.id === room.focus ? 'active' : ''}" data-lobby-dot="${esc(o.id)}" aria-label="Show ${esc(o.teamName || o.name)} door"></button>`).join('')}</div>
            <button class="lobby-enter" data-lobby-enter>Walk through ${esc((owners[focusIndex]?.teamName || owners[focusIndex]?.name || 'door'))}'s door</button>
          </div>
          <div class="lobby-enter-transition" aria-hidden="true"><span></span><b>Entering locker room…</b></div>
        </section>`;

      function rotate(step){
        const current = Math.max(0, ids.indexOf(room.focus));
        const next = (current + step + ids.length) % ids.length;
        room.focus = ids[next];
        room.open = ids[next];
        renderWalkableLocker(room.lastDraft || {});
      }
      function enter(id){
        room.open = id || room.focus || 'nick';
        room.focus = room.open;
        const lobby = target.querySelector('.trophy-lobby');
        if (lobby) lobby.classList.add('is-entering');
        setTimeout(() => {
          room.view = 'stall';
          renderWalkableLocker(room.lastDraft || {});
        }, 520);
      }
      target.querySelector('[data-lobby-prev]')?.addEventListener('click', () => rotate(-1));
      target.querySelector('[data-lobby-next]')?.addEventListener('click', () => rotate(1));
      target.querySelector('[data-lobby-enter]')?.addEventListener('click', () => enter(room.focus));
      target.querySelectorAll('[data-lobby-dot]').forEach(btn => btn.addEventListener('click', () => { room.focus = btn.dataset.lobbyDot || room.focus; room.open = room.focus; renderWalkableLocker(room.lastDraft || {}); }));
      target.querySelectorAll('[data-door-id]').forEach(btn => btn.addEventListener('click', () => {
        const id = btn.dataset.doorId || 'nick';
        if (id !== room.focus) {
          room.focus = id;
          room.open = id;
          renderWalkableLocker(room.lastDraft || {});
        } else {
          enter(id);
        }
      }));
      const ring = target.querySelector('[data-door-ring]');
      let startX = null;
      ring?.addEventListener('pointerdown', (e) => { startX = e.clientX; ring.setPointerCapture?.(e.pointerId); });
      ring?.addEventListener('pointerup', (e) => {
        if (startX == null) return;
        const dx = e.clientX - startX;
        startX = null;
        if (Math.abs(dx) > 40) rotate(dx > 0 ? -1 : 1);
      });
    }
    function renderStall(target, owners, rosters, active){
      const stall = STALLS[active.id] || STALLS.nick;
      target.className = 'walkable-locker-host v174-photo-only-host';

      const navOwners = owners.filter(o => o.id !== active.id);
      target.innerHTML = `
        <section class="owner-stall-view owner-${esc(active.id)} v174-photo-only-stall" aria-label="${esc(active.teamName || active.name)} roster room">
          <div class="v174-stall-stage">
            <img class="owner-stall-img v174-stall-img" src="${esc(stall.image)}" alt="${esc(active.teamName || active.name)} roster room">
            <button type="button" class="v219-championships-hotspot" data-locker-back aria-label="Back to Trophy Room"></button>
            <nav class="v174-stall-nav v219-bottom-stall-nav" aria-label="Roster room navigation">
              <button type="button" class="v174-stall-btn v220-stall-home-link" data-stall-home="dashboard">Home</button><button type="button" class="v174-stall-btn v225-stall-trophy-link" data-open-trophy-room> Trophy Room</button>${navOwners.map(o=>`<button type="button" class="v174-stall-btn" data-walk-stall="${esc(o.id)}">${esc(o.teamName || o.name)}</button>`).join('')}
            </nav>
          </div>
        </section>`;

      target.querySelectorAll('[data-locker-back]').forEach(btn => btn.addEventListener('click', () => {
        room.view = 'hub';
        renderWalkableLocker(room.lastDraft || {});
      }));
      target.querySelectorAll('[data-walk-stall]').forEach(btn => btn.addEventListener('click', () => {
        room.open = btn.dataset.walkStall || 'nick';
        room.view = 'stall';
        renderWalkableLocker(room.lastDraft || {});
      }));
      target.querySelectorAll('[data-stall-home]').forEach(btn => btn.addEventListener('click', () => {
        const homeTab = document.querySelector('[data-tab="dashboard"]');
        if (homeTab) homeTab.click();
      }));
    }
    function renderWalkableLocker(draft = {}){
      room.lastDraft = draft;
      if (room.view !== 'stall' && typeof window.__renderExactTrophyLobby === 'function') {
        room.view = 'hub';
        window.__renderExactTrophyLobby(draft);
        return;
      }
      const target = document.getElementById('rosterCards');
      if (!target) return;
      const owners = getOwners(draft);
      if (!owners.some(o => o.id === room.open)) room.open = owners[0]?.id || 'nick';
      const active = owners.find(o => o.id === room.open) || owners[0];
      const rosters = groupPicks(draft, owners);
      if (room.view === 'stall') renderStall(target, owners, rosters, active);
      else renderHub(target, owners, rosters);
    }
    window.__forceRosterTrophyLobby = function(draft){
      room.view = 'hub';
      room.open = '';
      room.focus = 'nick';
      renderWalkableLocker(draft || room.lastDraft || {});
    };
    window.openRosterStall = function(ownerId){
      const id = String(ownerId || 'nick').toLowerCase();
      room.open = id;
      room.view = 'stall';
      const rosterTab = document.querySelector('[data-tab="rosters"]');
      const rosterPanel = document.getElementById('rosters');
      if (rosterTab && rosterPanel) {
        document.querySelectorAll('.tab').forEach(function (b) { b.classList.toggle('active', b === rosterTab); });
        document.querySelectorAll('.panel').forEach(function (panel) { panel.classList.toggle('active', panel === rosterPanel); });
        document.body.dataset.activeTab = 'rosters';
      }
      renderWalkableLocker(room.lastDraft || {});
      setTimeout(function(){ rosterPanel && rosterPanel.scrollIntoView({ behavior:'smooth', block:'start' }); }, 50);
    };
    window.renderDraftRosters = renderWalkableLocker;
    window.renderWalkableLockerRoom = renderWalkableLocker;
    window.addEventListener('load', () => {
      setTimeout(async () => {
        try {
          if (window.officialDraftApi && typeof window.officialDraftApi.load === 'function') {
            renderWalkableLocker(await window.officialDraftApi.load());
            return;
          }
        } catch(e) {}
        renderWalkableLocker(room.lastDraft || {});
      }, 900);
    });
  })();


(function(){
  "use strict";
  const KEY = "custom-hockey-pool-season-history";
  const OWNERS = [
    { id:"nick", name:"Nick" }, { id:"chris", name:"Chris" }, { id:"andrew", name:"Andrew" }, { id:"tyler", name:"Tyler" }, { id:"scott", name:"Scott" }
  ];
  function toast(message){ const t=document.getElementById("toast"); if(!t) return alert(message); t.textContent=message; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2600); }
  function readHistory(){ try { return JSON.parse(localStorage.getItem(KEY) || "[]") || []; } catch(e){ return []; } }
  function writeHistory(items){ try { localStorage.setItem(KEY, JSON.stringify(items)); } catch(e){} }
  function staticRosters(){ return window.__lastYearStaticRosters && typeof window.__lastYearStaticRosters === "object" ? window.__lastYearStaticRosters : {}; }
  function rosterRecordFromCurrentDraft(){
    const draft = window.__currentLiveDraft || null;
    const grouped = {};
    OWNERS.forEach(o => grouped[o.id] = []);
    if (draft && Array.isArray(draft.picks) && draft.picks.length) {
      draft.picks.forEach(p => { const ownerId=String(p.ownerId||"").toLowerCase(); if(!grouped[ownerId]) grouped[ownerId]=[]; if(p.player) grouped[ownerId].push(p.player); });
    }
    const hasAny = Object.values(grouped).some(list => list.length);
    if (hasAny) return grouped;
    return staticRosters();
  }
  function saveCurrentSeasonToHistory(){
    const rosters = rosterRecordFromCurrentDraft();
    const count = Object.values(rosters).reduce((sum,list)=>sum+(Array.isArray(list)?list.length:0),0);
    if (!count) return toast("No rosters found to save yet.");
    const seasonId = "2025-2026";
    const record = {
      id: seasonId + "-regular-season",
      seasonId,
      label: "2025-2026 Regular Season",
      savedAt: new Date().toISOString(),
      rosterCount: count,
      scoring: { skaterGoals:2, skaterAssists:1, skaterShortHandedGoals:5, skaterGameWinningGoals:5, goalieWins:2, goalieAssists:5, goalieGoals:10, goalieShutouts:5 },
      rosters
    };
    const history = readHistory().filter(item => item.id !== record.id);
    history.unshift(record);
    writeHistory(history);
    window.__savedSeasonHistory = history;
    updateHistoryNote();
    toast("Saved rosters to Previous Season history.");
  }
  function updateHistoryNote(){
    const history = readHistory();
    const host = document.getElementById("previousSeasonStatus") || document.getElementById("homeRosterSourceStatus");
    if (!host) return;
    let note = document.getElementById("seasonHistorySaveNote");
    if (!note) { note = document.createElement("div"); note.id="seasonHistorySaveNote"; note.className="history-save-note"; host.insertAdjacentElement("afterend", note); }
    if (history.length) note.textContent = "Saved season history records in this browser: " + history.map(h => h.label || h.seasonId).join(", ");
    else note.textContent = "No season history records saved in this browser yet.";
  }
  document.addEventListener("click", function(event){
    const btn = event.target.closest && event.target.closest("#saveSeasonHistoryBtn, #saveSeasonHistoryBtnInline");
    if (!btn) return;
    event.preventDefault();
    saveCurrentSeasonToHistory();
  }, true);
  window.addEventListener("load", () => setTimeout(updateHistoryNote, 700));
  window.hockeyPoolSeasonHistory = { saveCurrentSeasonToHistory, readHistory };
})();


(function(){
  const SEASON_ID = '20252026';
  const GAME_TYPE = 2;
  const FALLBACK_OWNERS = [
    {id:'nick',name:'Nick',teamName:'Nick'},
    {id:'chris',name:'Chris',teamName:'Chris'},
    {id:'andrew',name:'Andrew',teamName:'Andrew'},
    {id:'tyler',name:'Tyler',teamName:'Tyler'},
    {id:'scott',name:'Scott',teamName:'Scott'}
  ];
  const SCORING = { goals:2, assists:1, shortHandedGoals:5, gameWinningGoals:5, goalieWins:2, goalieAssists:5, goalieGoals:10, goalieShutouts:5 };
  function esc(value){ return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function cleanName(name){ return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }
  function num(v){ const n=Number(v); return Number.isFinite(n) ? n : 0; }
  function ownerName(owner){ return owner.teamName || owner.name || owner.id; }
  function valueText(v){
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (typeof v === 'object') return String(v.default || v.en || v.fr || '');
    return '';
  }
  function rowName(row, kind){
    const first = valueText(row.firstName || row.firstNameDefault);
    const last = valueText(row.lastName || row.lastNameDefault);
    return row.skaterFullName || row.goalieFullName || row.playerFullName || row.fullName || `${first} ${last}`.trim();
  }
  function rowTeam(row){ return String(row.teamAbbrevs || row.teamAbbrev || row.team || row.teamName || '').split(',')[0].trim(); }
  function makeApiMaps(payload){
    const skaters = new Map(), goalies = new Map();
    (payload.skaters || []).forEach(row => {
      const name = rowName(row,'skater'); if (!name) return;
      const team = rowTeam(row);
      const item = { source:'api', type:'skater', name, nhlTeam:team, goals:num(row.goals), assists:num(row.assists), shortHandedGoals:num(row.shGoals || row.shortHandedGoals), gameWinningGoals:num(row.gameWinningGoals || row.gwGoals), points:num(row.points) };
      skaters.set(cleanName(name), item);
      if (team) skaters.set(cleanName(name)+'|'+String(team).toUpperCase(), item);
    });
    (payload.goalies || []).forEach(row => {
      const name = rowName(row,'goalie'); if (!name) return;
      const team = rowTeam(row);
      const item = { source:'api', type:'goalie', name, nhlTeam:team, goalieWins:num(row.wins || row.goalieWins), goalieAssists:num(row.assists || row.goalieAssists), goalieGoals:num(row.goals || row.goalieGoals), goalieShutouts:num(row.shutouts || row.goalieShutouts) };
      goalies.set(cleanName(name), item);
      if (team) goalies.set(cleanName(name)+'|'+String(team).toUpperCase(), item);
    });
    return { skaters, goalies };
  }
  function findApi(player, maps){
    const key = cleanName(player.name || '');
    const team = String(player.nhlTeam || '').toUpperCase();
    const teamKey = key + '|' + team;
    const map = (player.type === 'goalie' || player.position === 'G') ? maps.goalies : maps.skaters;
    let hit = map.get(teamKey) || map.get(key);
    if (hit) return hit;
    // Last-resort exact last-name + first initial match. This catches NHL API quirks without trusting saved fallback stats.
    const pieces = key.split(' ').filter(Boolean);
    const firstInitial = pieces[0] ? pieces[0][0] : '';
    const last = pieces[pieces.length - 1] || '';
    if (!last) return null;
    for (const [mapKey, value] of map.entries()) {
      const nameOnly = mapKey.split('|')[0];
      const parts = nameOnly.split(' ').filter(Boolean);
      if (parts.length >= 2 && parts[0][0] === firstInitial && parts[parts.length - 1] === last) return value;
    }
    return null;
  }
  function fantasy(player){
    if (player.type === 'goalie' || player.position === 'G') {
      return (num(player.goalieWins)*SCORING.goalieWins) + (num(player.goalieAssists || player.assists)*SCORING.goalieAssists) + (num(player.goalieGoals || player.goals)*SCORING.goalieGoals) + (num(player.goalieShutouts)*SCORING.goalieShutouts);
    }
    return (num(player.goals)*SCORING.goals) + (num(player.assists)*SCORING.assists) + (num(player.shortHandedGoals)*SCORING.shortHandedGoals) + (num(player.gameWinningGoals)*SCORING.gameWinningGoals);
  }
  function calcLine(player){
    if (player.type === 'goalie' || player.position === 'G') return `(${num(player.goalieWins)} W × 2) + (${num(player.goalieAssists || player.assists)} A × 5) + (${num(player.goalieGoals || player.goals)} G × 10) + (${num(player.goalieShutouts)} SO × 5)`;
    return `(${num(player.goals)} G × 2) + (${num(player.assists)} A × 1) + (${num(player.shortHandedGoals)} SHG × 5) + (${num(player.gameWinningGoals)} GWG × 5)`;
  }
  async function fetchRegularSeasonStats(){
    const url = `/api/nhl?gameType=${GAME_TYPE}&limit=-1&season=${SEASON_ID}`;
    const res = await fetch(url, { cache:'no-store' });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload.ok) throw new Error(payload.error || payload.detail || 'NHL regular-season stat pull failed.');
    return payload;
  }
  function buildRows(payload){
    const rosters = window.__lastYearStaticRosters || {};
    const owners = FALLBACK_OWNERS;
    const maps = payload ? makeApiMaps(payload) : { skaters:new Map(), goalies:new Map() };
    let apiHits = 0, totalPlayers = 0;
    const unmatched = [];
    const rows = owners.map(owner => {
      const roster = Array.isArray(rosters[owner.id]) ? rosters[owner.id] : [];
      const players = roster.map(base => {
        totalPlayers++;
        const api = payload ? findApi(base, maps) : null;
        if (api) apiHits++;
        else if (payload) unmatched.push({ ownerId: owner.id, ownerName: ownerName(owner), name: base.name, position: base.position || base.type || '', nhlTeam: base.nhlTeam || '' });
        const merged = { ...base, ...(api || {}), source: api ? 'NHL API' : 'saved roster' };
        const fpts = fantasy(merged);
        return { ...merged, fpts, calculation: calcLine(merged) + ` = ${fpts}` };
      }).sort((a,b) => b.fpts - a.fpts || a.name.localeCompare(b.name));
      const skaterPts = players.filter(p => !(p.type === 'goalie' || p.position === 'G')).reduce((s,p)=>s+p.fpts,0);
      const goaliePts = players.filter(p => p.type === 'goalie' || p.position === 'G').reduce((s,p)=>s+p.fpts,0);
      return { ownerId:owner.id, ownerName:ownerName(owner), players, total:players.reduce((s,p)=>s+p.fpts,0), skaterPts, goaliePts };
    }).sort((a,b)=>b.total-a.total || a.ownerName.localeCompare(b.ownerName));
    return { rows, apiHits, totalPlayers, unmatched };
  }
  function renderTable(targetId, statusId, payload, error){
    const target = document.getElementById(targetId); if (!target) return;
    const status = statusId ? document.getElementById(statusId) : null;
    const { rows, apiHits, totalPlayers, unmatched } = buildRows(payload || null);
    window.__lastSeasonApiDiagnostics = { rows, apiHits, totalPlayers, unmatched, season: SEASON_ID, usedApi: !!payload && !error };
    const usedApi = !!payload && !error;
    if (status) status.textContent = usedApi ? `Source: NHL API regular season ${SEASON_ID} + saved 2025-26 roster list` : `Source: saved 2025-26 roster list fallback${error ? ' — API error: '+(error.message || error) : ''}`;
    const unmatchedHtml = usedApi && unmatched.length
      ? `<div class="season-unmatched-warning"><b>API unmatched players (${unmatched.length}):</b> ${unmatched.map(p => `${esc(p.ownerName)} — ${esc(p.name)} (${esc(p.position)} ${esc(p.nhlTeam)})`).join('; ')}. These need API matching fixed before the season is official.</div>`
      : usedApi ? `<div class="season-unmatched-ok"><b>API check:</b> all ${totalPlayers} roster players matched.</div>` : '';
    const note = `<div class="season-leaderboard-note"><b>2025-2026 Regular Season Leaderboard</b><span class="season-source-badge">${usedApi ? 'NHL API pulled' : 'Saved fallback'}</span><br>Scoring: skaters — G 2, A 1, SHG 5, GWG 5. Goalies — W 2, A 5, G 10, SO 5. ${usedApi ? `Matched ${apiHits}/${totalPlayers} roster players from the NHL API.` : `Showing saved history-file values until the NHL API pull succeeds.`}${unmatchedHtml}</div>`;
    target.innerHTML = note +
      '<table class="leaderboard playoff-leaderboard expandable-playoff-leaderboard season-leaderboard"><thead><tr><th>Rank</th><th>Team</th><th>Total</th><th>Skaters</th><th>Goalies</th><th>G</th><th>A</th><th>SHG</th><th>GWG</th><th>W</th><th>SO</th></tr></thead><tbody>' +
      rows.map((row,i)=>{
        const detailId = `${targetId}-detail-${row.ownerId}`;
        const teamGoals = row.players.reduce((s,p)=>s+num(p.goals),0);
        const teamAssists = row.players.reduce((s,p)=>s+num(p.assists),0);
        const teamShg = row.players.reduce((s,p)=>s+num(p.shortHandedGoals),0);
        const teamGwg = row.players.reduce((s,p)=>s+num(p.gameWinningGoals),0);
        const teamWins = row.players.reduce((s,p)=>s+num(p.goalieWins),0);
        const teamSo = row.players.reduce((s,p)=>s+num(p.goalieShutouts),0);
        const details = row.players.map(p => `<tr><td><strong>${esc(p.name)}</strong><small>${esc(p.position || '')} • ${esc(p.nhlTeam || '')} • ${esc(p.source)}</small></td><td>${p.type==='goalie'||p.position==='G'?'G':'S'}</td><td>${num(p.goals)}</td><td>${num(p.assists)}</td><td>${num(p.shortHandedGoals)}</td><td>${num(p.gameWinningGoals)}</td><td>${num(p.goalieWins)}</td><td>${num(p.goalieShutouts)}</td><td class="total-cell">${p.fpts}</td><td>${esc(p.calculation)}</td></tr>`).join('');
        const mobile = row.players.map(p => `<article class="mobile-season-player-card"><div class="mobile-season-player-head"><strong>${esc(p.name)}</strong><b>${p.fpts} pts</b></div><small>${esc(p.position || '')} • ${esc(p.nhlTeam || '')} • ${esc(p.source)}</small><div class="mobile-season-stat-grid"><span><em>G</em>${num(p.goals)}</span><span><em>A</em>${num(p.assists)}</span><span><em>SHG</em>${num(p.shortHandedGoals)}</span><span><em>GWG</em>${num(p.gameWinningGoals)}</span><span><em>W</em>${num(p.goalieWins)}</span><span><em>SO</em>${num(p.goalieShutouts)}</span><span><em>Total</em>${p.fpts}</span></div></article>`).join('');
        return `<tr class="season-summary-row"><td data-label="Rank"><b>${i+1}</b></td><td data-label="Team"><button type="button" class="season-team-link" data-season-owner-link="${esc(row.ownerId)}">${esc(row.ownerName)}</button></td><td data-label="Total" class="total-cell">${row.total}</td><td data-label="Skaters">${row.skaterPts}</td><td data-label="Goalies">${row.goaliePts}</td><td data-label="G">${teamGoals}</td><td data-label="A">${teamAssists}</td><td data-label="SHG">${teamShg}</td><td data-label="GWG">${teamGwg}</td><td data-label="W">${teamWins}</td><td data-label="SO">${teamSo}</td></tr><tr id="${detailId}" class="season-breakdown-row" hidden><td colspan="11"><div class="season-breakdown-panel"><h3>${esc(row.ownerName)} 2025-26 breakdown</h3><div class="mobile-season-breakdown-list">${mobile}</div><table class="season-breakdown-table"><thead><tr><th>Player</th><th>Type</th><th>G</th><th>A</th><th>SHG</th><th>GWG</th><th>W</th><th>SO</th><th>FPTS</th><th>Calculation</th></tr></thead><tbody>${details}</tbody></table></div></td></tr>`;
      }).join('') + '</tbody></table>' + `<p class="muted season-updated">Season saved as previous season record: 2025-2026 Regular Season. Roster count: ${totalPlayers}. ${usedApi ? `NHL source: ${esc(payload.source || 'api.nhle.com')}.` : ''}</p>`;
  }
  async function renderSeasonLeaderboards(){
    const home = document.getElementById('leaderboardTable');
    const prev = document.getElementById('previousSeasonTable');
    [home, prev].forEach(t => { if (t) t.innerHTML = '<div class="clean-loading-card"><strong>Pulling 2025-26 regular-season stats…</strong><span>Calculating fantasy points for last season\'s roster record.</span></div>'; });
    try{
      const payload = await fetchRegularSeasonStats();
      renderTable('leaderboardTable','homeRosterSourceStatus',payload,null);
      renderTable('previousSeasonTable','previousSeasonStatus',payload,null);
    }catch(err){
      console.error('Season leaderboard API failed:', err);
      renderTable('leaderboardTable','homeRosterSourceStatus',null,err);
      renderTable('previousSeasonTable','previousSeasonStatus',null,err);
    }
  }
  function prepareUi(){
    const btn = document.getElementById('refreshStatsBtn2');
    if (btn) { btn.id = 'refreshSeasonStatsBtn'; btn.textContent = 'Pull 2025-26 Stats'; btn.disabled = false; }
    const eyebrow = document.querySelector('#dashboard .eyebrow'); if (eyebrow) eyebrow.textContent = '2025-2026 Season Leaderboard';
    const title = document.querySelector('#dashboard h2'); if (title) title.textContent = 'Last season standings';
  }
  document.addEventListener('click', function(event){
    const ownerLink = event.target.closest && event.target.closest('[data-season-owner-link]');
    if (ownerLink) { event.preventDefault(); if (window.openRosterStall) window.openRosterStall(ownerLink.dataset.seasonOwnerLink); return; }
    const toggle = event.target.closest && event.target.closest('[data-season-toggle]');
    if (toggle) { event.preventDefault(); const row=document.getElementById(toggle.dataset.seasonToggle); const icon=toggle.querySelector('span'); if(row){ row.hidden=!row.hidden; if(icon) icon.textContent=row.hidden?'▸':'▾'; } return; }
    const btn = event.target.closest && event.target.closest('#refreshSeasonStatsBtn,#refreshPreviousSeasonBtn');
    if (btn) { event.preventDefault(); renderSeasonLeaderboards(); }
  }, true);
  window.renderPreviousSeasonLeaderboard = renderSeasonLeaderboards;
  window.addEventListener('load', function(){
    prepareUi();
    setTimeout(renderSeasonLeaderboards, 900);
  });
})();


(function(){
  const SEASON_ID='20252026', GAME_TYPE=2;
  const OWNERS=[{id:'nick',name:'Nick',teamName:'Nick'},{id:'chris',name:'Chris',teamName:'Chris'},{id:'andrew',name:'Andrew',teamName:'Andrew'},{id:'tyler',name:'Tyler',teamName:'Tyler'},{id:'scott',name:'Scott',teamName:'Scott'}];
  const SC={goals:2,assists:1,shortHandedGoals:5,gameWinningGoals:5,goalieWins:2,goalieAssists:5,goalieGoals:10,goalieShutouts:5};
  let lastPayload=null,lastError=null,sortKey='total',sortDir='desc';
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
  const clean=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const valueText=v=>v==null?'':(typeof v==='object'?String(v.default||v.en||v.fr||''):String(v));
  function rowName(row){const first=valueText(row.firstName||row.firstNameDefault),last=valueText(row.lastName||row.lastNameDefault);return row.skaterFullName||row.goalieFullName||row.playerFullName||row.fullName||`${first} ${last}`.trim()}
  function rowTeam(row){return String(row.teamAbbrevs||row.teamAbbrev||row.team||row.teamName||'').split(',')[0].trim().toUpperCase()}
  function makeMaps(payload){const skaters=new Map(),goalies=new Map();(payload?.skaters||[]).forEach(row=>{const name=rowName(row); if(!name)return; const team=rowTeam(row); const item={source:'NHL API',type:'skater',name,nhlTeam:team,goals:num(row.goals),assists:num(row.assists),shortHandedGoals:num(row.shGoals||row.shortHandedGoals),gameWinningGoals:num(row.gameWinningGoals||row.gwGoals),points:num(row.points)}; skaters.set(clean(name),item); if(team) skaters.set(clean(name)+'|'+team,item);});(payload?.goalies||[]).forEach(row=>{const name=rowName(row); if(!name)return; const team=rowTeam(row); const item={source:'NHL API',type:'goalie',name,nhlTeam:team,goalieWins:num(row.wins||row.goalieWins),goalieAssists:num(row.assists||row.goalieAssists),goalieGoals:num(row.goals||row.goalieGoals),goalieShutouts:num(row.shutouts||row.goalieShutouts)}; goalies.set(clean(name),item); if(team) goalies.set(clean(name)+'|'+team,item);}); return {skaters,goalies};}
  function findApi(player,maps){const key=clean(player.name),team=String(player.nhlTeam||'').toUpperCase();const map=(player.type==='goalie'||player.position==='G')?maps.goalies:maps.skaters;let hit=map.get(key+'|'+team)||map.get(key);if(hit)return hit;const parts=key.split(' ').filter(Boolean),fi=parts[0]?.[0]||'',last=parts.at(-1)||'';if(!last)return null;for(const [k,val] of map.entries()){const nameOnly=k.split('|')[0],p=nameOnly.split(' ').filter(Boolean);if(p.length>=2&&p[0][0]===fi&&p.at(-1)===last)return val;}return null;}
  function fpts(p){if(p.type==='goalie'||p.position==='G')return num(p.goalieWins)*SC.goalieWins+num(p.goalieAssists||p.assists)*SC.goalieAssists+num(p.goalieGoals||p.goals)*SC.goalieGoals+num(p.goalieShutouts)*SC.goalieShutouts;return num(p.goals)*SC.goals+num(p.assists)*SC.assists+num(p.shortHandedGoals)*SC.shortHandedGoals+num(p.gameWinningGoals)*SC.gameWinningGoals;}
  function calc(p){return (p.type==='goalie'||p.position==='G')?`(${num(p.goalieWins)} W × 2) + (${num(p.goalieAssists||p.assists)} GA × 5) + (${num(p.goalieGoals||p.goals)} GG × 10) + (${num(p.goalieShutouts)} SO × 5) = ${p.fpts}`:`(${num(p.goals)} G × 2) + (${num(p.assists)} A × 1) + (${num(p.shortHandedGoals)} SHG × 5) + (${num(p.gameWinningGoals)} GWG × 5) = ${p.fpts}`}
  async function fetchStats(){const res=await fetch(`/api/nhl?gameType=${GAME_TYPE}&limit=-1&season=${SEASON_ID}`,{cache:'no-store'});const payload=await res.json().catch(()=>({}));if(!res.ok||!payload.ok)throw new Error(payload.error||payload.detail||'NHL regular-season stat pull failed.');return payload;}
  function buildRows(payload){const rosters=window.__lastYearStaticRosters||{};const maps=payload?makeMaps(payload):{skaters:new Map(),goalies:new Map()};let apiHits=0,totalPlayers=0;const unmatched=[];let rows=OWNERS.map(owner=>{const players=(Array.isArray(rosters[owner.id])?rosters[owner.id]:[]).map(base=>{totalPlayers++;const api=payload?findApi(base,maps):null;if(api)apiHits++;else if(payload)unmatched.push({ownerName:owner.teamName||owner.name,name:base.name,position:base.position||base.type||'',nhlTeam:base.nhlTeam||''});const merged={...base,...(api||{}),source:api?'NHL API':'saved roster'};const pts=fpts(merged);return {...merged,fpts:pts,calculation:calc({...merged,fpts:pts})};}).sort((a,b)=>b.fpts-a.fpts||String(a.name).localeCompare(String(b.name)));const totals={goals:0,assists:0,shortHandedGoals:0,gameWinningGoals:0,goalieWins:0,goalieShutouts:0,goalieAssists:0,goalieGoals:0,total:0};players.forEach(p=>{totals.goals+=num(p.goals);totals.assists+=num(p.assists);totals.shortHandedGoals+=num(p.shortHandedGoals);totals.gameWinningGoals+=num(p.gameWinningGoals);totals.goalieWins+=num(p.goalieWins);totals.goalieShutouts+=num(p.goalieShutouts);totals.goalieAssists+=num(p.goalieAssists||((p.type==='goalie'||p.position==='G')?p.assists:0));totals.goalieGoals+=num(p.goalieGoals||((p.type==='goalie'||p.position==='G')?p.goals:0));totals.total+=p.fpts;});return {ownerId:owner.id,ownerName:owner.teamName||owner.name,players,...totals};});rows.sort((a,b)=>{const av=a[sortKey]??0,bv=b[sortKey]??0;const cmp=typeof av==='string'?String(av).localeCompare(String(bv)):av-bv;return sortDir==='asc'?cmp:-cmp || a.ownerName.localeCompare(b.ownerName)});return {rows,apiHits,totalPlayers,unmatched};}
  function noteHtml(usedApi,apiHits,totalPlayers,unmatched,error){const unmatchedHtml=usedApi&&unmatched.length?`<div class="season-unmatched-warning"><b>API unmatched players (${unmatched.length}):</b> ${unmatched.map(p=>`${esc(p.ownerName)} — ${esc(p.name)} (${esc(p.position)} ${esc(p.nhlTeam)})`).join('; ')}. These need API matching fixed before the season is official.</div>`:usedApi?`<div class="season-unmatched-ok"><b>API check:</b> all ${totalPlayers} roster players matched.</div>`:'';return `<div class="season-arena-banner"><div class="season-arena-logo">🏒</div><div><strong>Basement Bar League standings board</strong><span>2025-2026 regular season scored using your pool rules. Tap a team to open its compact roster breakdown.</span></div><div class="season-arena-pill">Live-style record</div></div><div class="season-leaderboard-note"><b>Scoring:</b> Skaters — G 2, A 1, SHG 5, GWG 5. Goalies — W 2, GA 5, GG 10, SO 5. ${usedApi?`Matched ${apiHits}/${totalPlayers} roster players from the NHL API.`:`Saved fallback${error?' — API error: '+esc(error.message||error):''}.`}${unmatchedHtml}</div>`}
  function header(key,label){const arrow=sortKey===key?(sortDir==='asc'?' ▲':' ▼'):'';return `<button type="button" class="season-sort-btn" data-season-sort="${key}">${label}${arrow}</button>`}
  function renderTable(targetId,statusId,payload,error,mode){const target=document.getElementById(targetId);if(!target)return;const status=statusId?document.getElementById(statusId):null;const usedApi=!!payload&&!error;const {rows,apiHits,totalPlayers,unmatched}=buildRows(payload||null);window.__lastSeasonApiDiagnostics={rows,apiHits,totalPlayers,unmatched,season:SEASON_ID,usedApi};if(status)status.textContent=usedApi?`Source: NHL API regular season ${SEASON_ID} + saved roster list`:`Source: saved roster list fallback${error?' — '+(error.message||error):''}`;target.innerHTML=noteHtml(usedApi,apiHits,totalPlayers,unmatched,error)+`<table class="leaderboard season-rankings-board"><thead><tr><th>${header('rank','Rank')}</th><th>${header('ownerName','Team')}</th><th>${header('total','FPTS')}</th><th>${header('goals','G')}</th><th>${header('assists','A')}</th><th>${header('shortHandedGoals','SHG')}</th><th>${header('gameWinningGoals','GWG')}</th><th>${header('goalieWins','W')}</th><th>${header('goalieShutouts','SO')}</th><th>${header('goalieAssists','GA')}</th><th>${header('goalieGoals','GG')}</th></tr></thead><tbody>`+rows.map((row,i)=>{const detailId=`${targetId}-detail-${row.ownerId}`;const badge=i===0?'gold':i===1?'silver':i===2?'bronze':'';const playerRows=row.players.map(p=>`<tr><td><span class="season-player-name">${esc(p.name)}</span><span class="season-player-source">${esc(p.position||p.type||'')} • ${esc(p.nhlTeam||'')} • ${esc(p.source||'')}</span></td><td>${p.type==='goalie'||p.position==='G'?'G':'S'}</td><td>${num(p.goals)}</td><td>${num(p.assists)}</td><td>${num(p.shortHandedGoals)}</td><td>${num(p.gameWinningGoals)}</td><td>${num(p.goalieWins)}</td><td>${num(p.goalieShutouts)}</td><td>${num(p.goalieAssists||((p.type==='goalie'||p.position==='G')?p.assists:0))}</td><td>${num(p.goalieGoals||((p.type==='goalie'||p.position==='G')?p.goals:0))}</td><td class="total-cell">${p.fpts}</td><td>${esc(p.calculation)}</td></tr>`).join('');return `<tr class="season-summary-row"><td data-label="Rank"><span class="season-rank-badge ${badge}">${i+1}</span></td><td data-label="Team"><button type="button" class="season-team-toggle" data-season-toggle="${detailId}"><span>▸</span>${esc(row.ownerName)}</button></td><td data-label="FPTS"><span class="season-total-chip">${row.total}</span></td><td data-label="G" class="season-mini-stat">${row.goals}</td><td data-label="A" class="season-mini-stat">${row.assists}</td><td data-label="SHG" class="season-mini-stat">${row.shortHandedGoals}</td><td data-label="GWG" class="season-mini-stat">${row.gameWinningGoals}</td><td data-label="W" class="season-mini-stat">${row.goalieWins}</td><td data-label="SO" class="season-mini-stat">${row.goalieShutouts}</td><td data-label="GA" class="season-mini-stat">${row.goalieAssists}</td><td data-label="GG" class="season-mini-stat">${row.goalieGoals}</td></tr><tr id="${detailId}" class="season-breakdown-row" hidden><td colspan="11"><div class="season-breakdown-panel"><h3>${esc(row.ownerName)} compact roster</h3><div class="season-breakdown-table-wrap"><table class="season-compact-roster"><thead><tr><th>Player</th><th>Type</th><th>G</th><th>A</th><th>SHG</th><th>GWG</th><th>W</th><th>SO</th><th>GA</th><th>GG</th><th>FPTS</th><th>Calculation</th></tr></thead><tbody>${playerRows||'<tr><td colspan="12">No roster players.</td></tr>'}</tbody></table></div></div></td></tr>`}).join('')+`</tbody></table><p class="muted season-updated">Season record: 2025-2026 Regular Season. Roster count: ${totalPlayers}. Click any column header to sort.</p>`;}
  function setupPreviousSeasonPicker(){const card=document.querySelector('.previous-season-card');const table=document.getElementById('previousSeasonTable');if(!card||!table)return;const head=card.querySelector('.section-head div');if(head){const h=head.querySelector('h2');if(h)h.textContent='Previous Season';const p=head.querySelector('p');if(p)p.textContent='Choose a saved season first, then the full standings and roster breakdown will load.'}let picker=document.getElementById('previousSeasonPicker');if(!picker){picker=document.createElement('div');picker.id='previousSeasonPicker';picker.className='season-prev-picker';picker.innerHTML='<label for="previousSeasonSelect">Season</label><select id="previousSeasonSelect"><option value="">Select a season…</option><option value="20252026">2025-2026 Regular Season</option></select>';table.parentNode.insertBefore(picker,table);}if(!document.getElementById('previousSeasonSelect').value)table.innerHTML='<div class="season-prev-placeholder"><strong>No season selected.</strong><br>Select 2025-2026 Regular Season to view the saved standings record.</div>'}
  async function renderAll(){const home=document.getElementById('leaderboardTable');if(home)home.innerHTML='<div class="clean-loading-card"><strong>Pulling 2025-26 regular-season stats…</strong><span>Calculating fantasy points for the standings board.</span></div>';try{lastPayload=await fetchStats();lastError=null;}catch(e){console.error('v156 season standings API failed:',e);lastPayload=null;lastError=e;}renderTable('leaderboardTable','homeRosterSourceStatus',lastPayload,lastError,'home');const sel=document.getElementById('previousSeasonSelect');if(sel&&sel.value==='20252026')renderTable('previousSeasonTable','previousSeasonStatus',lastPayload,lastError,'previous');}
  function prep(){const btn=document.getElementById('refreshSeasonStatsBtn')||document.getElementById('refreshStatsBtn2');if(btn){btn.id='refreshSeasonStatsBtn';btn.textContent='Refresh standings';btn.disabled=false;}const eyebrow=document.querySelector('#dashboard .eyebrow');if(eyebrow)eyebrow.textContent='Fantasy standings';const title=document.querySelector('#dashboard h2');if(title)title.textContent='2025-2026 pool rankings';setupPreviousSeasonPicker();}
  document.addEventListener('click',e=>{const sort=e.target.closest?.('[data-season-sort]');if(sort){e.preventDefault();const key=sort.dataset.seasonSort;if(sortKey===key)sortDir=sortDir==='asc'?'desc':'asc';else{sortKey=key;sortDir=key==='ownerName'?'asc':'desc'}renderTable('leaderboardTable','homeRosterSourceStatus',lastPayload,lastError,'home');const sel=document.getElementById('previousSeasonSelect');if(sel&&sel.value==='20252026')renderTable('previousSeasonTable','previousSeasonStatus',lastPayload,lastError,'previous');return;}const toggle=e.target.closest?.('[data-season-toggle]');if(toggle){e.preventDefault();const row=document.getElementById(toggle.dataset.seasonToggle);const icon=toggle.querySelector('span');if(row){row.hidden=!row.hidden;if(icon)icon.textContent=row.hidden?'▸':'▾';}return;}const refresh=e.target.closest?.('#refreshSeasonStatsBtn,#refreshPreviousSeasonBtn');if(refresh){e.preventDefault();renderAll();}},true);
  document.addEventListener('change',e=>{if(e.target&&e.target.id==='previousSeasonSelect'){if(e.target.value==='20252026')renderTable('previousSeasonTable','previousSeasonStatus',lastPayload,lastError,'previous');else document.getElementById('previousSeasonTable').innerHTML='<div class="season-prev-placeholder"><strong>No season selected.</strong><br>Select a season to view the saved standings record.</div>';}});
  window.renderPreviousSeasonLeaderboard=renderAll;
  window.addEventListener('load',()=>{setTimeout(()=>{prep();renderAll();},1500);});
})();


(function(){
  const owners=[
    {id:'scott',label:'Scott'},
    {id:'nick',label:'Nick'},
    {id:'andrew',label:'Andrew'},
    {id:'tyler',label:'Tyler'},
    {id:'chris',label:'Chris'}
  ];
  function ownerById(id){return owners.find(o=>o.id===id)||owners[1];}
  function enter(id, src){
    const o=ownerById(id);
    const token = (window.__trophyRoomNavigationToken = (window.__trophyRoomNavigationToken || 0) + 1);
    const sh=document.querySelector('#rosterCards .straight-lobby-shell');
    if(sh){
      const s=src&&src.getBoundingClientRect?src:(sh.querySelector('[data-enter-door="'+o.id+'"]')||sh);
      const r=s.getBoundingClientRect(), sr=sh.getBoundingClientRect();
      sh.style.setProperty('--enter-x',(((r.left+r.width/2-sr.left)/sr.width)*100).toFixed(1)+'%');
      sh.style.setProperty('--enter-y',(((r.top+r.height/2-sr.top)/sr.height)*100).toFixed(1)+'%');
      sh.classList.add('is-entering');
    }
    setTimeout(function(){
      if (window.__trophyRoomNavigationToken !== token) return;
      if(typeof window.openRosterStall==='function') window.openRosterStall(o.id);
    }, 360);
  }
  function renderStraightLobby(draft){
    window.__trophyRoomNavigationToken = (window.__trophyRoomNavigationToken || 0) + 1;
    window.__exactLobbyDraft=draft||{};
    const target=document.getElementById('rosterCards'); if(!target) return;
    target.className='walkable-locker-host trophy-lobby-host exact-lobby-host straight-lobby-host';
    target.innerHTML='<section class="straight-lobby-shell" aria-label="Trophy Room locker doors">'+
      '<img class="straight-lobby-scene" src="assets/images/trophy-room-lobby-reference.png?v=216" alt="Trophy room with five roster-room doors, a Home jersey link, championship banners, a Stanley Cup display, and a hockey history book">'+
      '<button class="straight-home-hotzone" type="button" data-tab="dashboard" aria-label="Return Home">Home</button>'+ 
      '<button class="straight-book-hotzone" type="button" aria-label="Open Hockey History book">Book</button>'+ 
      owners.map(o=>'<button class="straight-door-hotzone '+o.id+'" data-enter-door="'+o.id+'" type="button" aria-label="Enter '+o.label+' locker room">'+o.label+'</button>').join('')+
      '<span class="straight-enter-flash" aria-hidden="true"></span>'+ 
    '</section>';
  }

  document.addEventListener('click',function(e){
    const home=e.target.closest&&e.target.closest('#rosterCards .straight-home-hotzone[data-tab="dashboard"]');
    if(!home) return;
    const homeTab=document.querySelector('button.tab[data-tab="dashboard"]');
    if(homeTab){ e.preventDefault(); e.stopPropagation(); homeTab.click(); }
  }, true);
  document.addEventListener('click',function(e){
    const door=e.target.closest&&e.target.closest('#rosterCards .straight-door-hotzone[data-enter-door]');
    if(!door) return;
    e.preventDefault(); e.stopPropagation();
    enter(door.dataset.enterDoor, door);
  }, true);
  window.__renderExactTrophyLobby=renderStraightLobby;
  window.renderDraftRosters=renderStraightLobby;
  window.renderWalkableLockerRoom=renderStraightLobby;
  window.addEventListener('load',function(){setTimeout(async function(){try{if(window.officialDraftApi&&window.officialDraftApi.load){renderStraightLobby(await window.officialDraftApi.load());return;}}catch(err){} renderStraightLobby(window.__exactLobbyDraft||{});},140);});
})();


(function(){
  function setHomeActive(){
    const dash = document.getElementById('dashboard');
    document.body.classList.toggle('v180-home-active', !!(dash && dash.classList.contains('active')));
  }
  document.addEventListener('DOMContentLoaded', setHomeActive);
  document.addEventListener('click', function(e){
    if (e.target.closest && e.target.closest('[data-tab]')) {
      setTimeout(setHomeActive, 30);
      setTimeout(setHomeActive, 150);
    }
  }, true);
  document.addEventListener('DOMContentLoaded', function(){
    const dash = document.getElementById('dashboard');
    if (dash) new MutationObserver(setHomeActive).observe(dash, {attributes:true, attributeFilter:['class']});
    setHomeActive();
  });
  window.addEventListener('load', setHomeActive);
})();


(function(){
  const OWNER_ORDER = ["andrew", "chris", "scott", "nick", "tyler"];

  function esc(value){
    return String(value ?? "").replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function num(value){
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function shortName(name){
    const s = String(name || "").trim();
    if (!s) return "";
    const parts = s.split(/\s+/);
    if (parts.length <= 2) return s;
    return parts[0] + " " + parts[parts.length - 1];
  }

  function isGoalie(player){
    return player && (player.type === "goalie" || player.position === "G");
  }

  function statTotals(row){
    const players = Array.isArray(row.players) ? row.players : [];
    return {
      goals: players.reduce((s,p)=>s + num(p.goals), 0),
      assists: players.reduce((s,p)=>s + num(p.assists), 0),
      shg: players.reduce((s,p)=>s + num(p.shortHandedGoals), 0),
      gwg: players.reduce((s,p)=>s + num(p.gameWinningGoals), 0),
    };
  }

  function renderStandings(rows){
    return `
      <section class="v182-standings">
        <table class="v182-standings-table" aria-label="Pool standings">
          <thead>
            <tr><th>Team</th><th>FPTS</th><th>G</th><th>A</th><th>SHG</th><th>GWG</th></tr>
          </thead>
          <tbody>
            ${rows.map(row => {
              const t = statTotals(row);
              return `<tr>
                <td>${esc(row.ownerName)}</td>
                <td>${num(row.total)}</td>
                <td>${t.goals}</td>
                <td>${t.assists}</td>
                <td>${t.shg}</td>
                <td>${t.gwg}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </section>`;
  }

  function renderRosterCard(row){
    const players = Array.isArray(row.players) ? row.players.slice() : [];
    const skaters = players.filter(p => !isGoalie(p)).slice(0, 10);
    const goalies = players.filter(isGoalie).slice(0, 2);

    const playerRows = skaters.map(p => `<div class="v182-player-row"><span>${esc(shortName(p.name))}</span><span>${num(p.fpts)}</span></div>`).join("");
    const goalieRows = goalies.map(p => `<div class="v182-player-row"><span>${esc(shortName(p.name))}</span><span>${num(p.fpts)}</span></div>`).join("");

    return `<article class="v182-roster-card">
      <h3 class="v182-owner-name">${esc(row.ownerName)}</h3>
      <div class="v182-roster-head"><span>Player Name</span><span>FPTS</span></div>
      ${playerRows}
      <div class="v182-goalie-break">${goalieRows}</div>
    </article>`;
  }

  function renderRosters(rows){
    const byId = new Map(rows.map(row => [row.ownerId, row]));
    const ordered = OWNER_ORDER.map(id => byId.get(id)).filter(Boolean);
    rows.forEach(row => { if (!ordered.includes(row)) ordered.push(row); });

    return `
      <section class="v182-rosters">
        <div class="v182-roster-grid">
          ${ordered.slice(0,5).map(renderRosterCard).join("")}
        </div>
      </section>`;
  }

  function renderMockup(){
    const host = document.getElementById("leaderboardTable");
    if (!host) return false;

    const diag = window.__lastSeasonApiDiagnostics;
    if (!diag || !Array.isArray(diag.rows) || !diag.rows.length) {
      if (!host.querySelector(".v182-loading") && !host.querySelector(".v182-chalk-layout")) {
        host.innerHTML = `<div class="v182-loading">Basement Bar League • 2025-2026 Regular Season<br>Loading standings…</div>`;
      }
      return false;
    }

    const rows = diag.rows.slice().sort((a,b) => num(b.total) - num(a.total) || String(a.ownerName).localeCompare(String(b.ownerName)));
    host.innerHTML = `<div class="v182-chalk-layout">${renderStandings(rows)}${renderRosters(rows)}</div>`;
    return true;
  }

  function schedule(){
    clearTimeout(window.__v182HomeChalkTimer);
    window.__v182HomeChalkTimer = setTimeout(renderMockup, 60);
  }

  document.addEventListener("DOMContentLoaded", function(){
    schedule();
    const host = document.getElementById("leaderboardTable");
    if (host) {
      new MutationObserver(function(){
        if (!host.querySelector(".v182-chalk-layout")) schedule();
      }).observe(host, {childList:true, subtree:false});
    }
  });

  window.addEventListener("load", function(){
    schedule();
    setTimeout(schedule, 600);
    setTimeout(schedule, 1600);
    setTimeout(schedule, 3200);
  });

  document.addEventListener("click", function(event){
    if (event.target.closest && (event.target.closest("#refreshPreviousSeasonBtn") || event.target.closest("#refreshStatsBtn2") || event.target.closest("[data-season-sort]"))) {
      setTimeout(schedule, 400);
      setTimeout(schedule, 1400);
    }
  }, true);

  window.renderV182HomeChalkboard = renderMockup;
})();


(function(){
  function isMobileHome(){ return window.matchMedia && window.matchMedia('(max-width: 820px)').matches; }
  function important(el, prop, value){ if(el && el.style) el.style.setProperty(prop, value, 'important'); }
  function enforce(){
    if(!isMobileHome()) return;
    var host=document.getElementById('leaderboardTable');
    if(!host || !host.classList.contains('home-chalk-leaderboard-overlay')) return;
    important(host,'left','19.2%'); important(host,'top','30.4%'); important(host,'width','65.7%'); important(host,'height','46.1%'); important(host,'overflow','visible');
    var layout=host.querySelector('.v182-chalk-layout');
    important(layout,'display','grid'); important(layout,'grid-template-columns','minmax(0, 46.8%) minmax(0, 52.8%)'); important(layout,'gap','.4%'); important(layout,'align-items','start'); important(layout,'width','100%'); important(layout,'height','100%');
    var standings=host.querySelector('.v182-standings');
    important(standings,'width','100%'); important(standings,'max-width','100%'); important(standings,'min-width','0'); important(standings,'padding','1.6% 2.2% 0 0'); important(standings,'overflow','hidden');
    var rosters=host.querySelector('.v182-rosters');
    important(rosters,'width','100%'); important(rosters,'max-width','100%'); important(rosters,'min-width','0'); important(rosters,'padding','1.3% 0 0 1.1%'); important(rosters,'overflow','hidden');
    host.querySelectorAll('.v182-chalk-title').forEach(function(el){ important(el,'height','18px'); important(el,'min-height','18px'); important(el,'max-height','18px'); important(el,'margin','0 0 2px'); important(el,'background-size','contain'); });
    var table=host.querySelector('.v182-standings-table');
    important(table,'width','98%'); important(table,'max-width','98%'); important(table,'margin','0'); important(table,'table-layout','fixed'); important(table,'border-collapse','collapse'); important(table,'transform','none');
    host.querySelectorAll('.v182-standings-table th').forEach(function(el){
      important(el,'font-size','7.6px'); important(el,'line-height','.94'); important(el,'padding','0 0 1px 0'); important(el,'letter-spacing','-.07em'); important(el,'white-space','nowrap'); important(el,'overflow','hidden'); important(el,'text-overflow','clip'); important(el,'font-weight','780');
    });
    host.querySelectorAll('.v182-standings-table td').forEach(function(el){
      important(el,'font-size','10.7px'); important(el,'line-height','.99'); important(el,'padding','1.5px 0'); important(el,'letter-spacing','-.07em'); important(el,'white-space','nowrap'); important(el,'overflow','hidden'); important(el,'text-overflow','clip'); important(el,'font-weight','925');
    });
    host.querySelectorAll('.v182-standings-table th:first-child,.v182-standings-table td:first-child').forEach(function(el){ important(el,'width','24%'); important(el,'text-align','left'); important(el,'letter-spacing','-.085em'); });
    host.querySelectorAll('.v182-standings-table th:nth-child(2),.v182-standings-table td:nth-child(2)').forEach(function(el){ important(el,'width','21%'); });
    host.querySelectorAll('.v182-standings-table th:nth-child(3),.v182-standings-table td:nth-child(3),.v182-standings-table th:nth-child(4),.v182-standings-table td:nth-child(4)').forEach(function(el){ important(el,'width','10%'); });
    host.querySelectorAll('.v182-standings-table th:nth-child(5),.v182-standings-table td:nth-child(5),.v182-standings-table th:nth-child(6),.v182-standings-table td:nth-child(6)').forEach(function(el){ important(el,'width','17.5%'); });
    host.querySelectorAll('.v182-owner-name').forEach(function(el){ important(el,'font-size','6.05px'); important(el,'line-height','1.02'); important(el,'margin-bottom','1.3px'); important(el,'letter-spacing','-.045em'); important(el,'white-space','nowrap'); important(el,'overflow','hidden'); important(el,'text-overflow','clip'); });
    host.querySelectorAll('.v182-roster-head').forEach(function(el){ important(el,'font-size','4.15px'); important(el,'line-height','1.02'); important(el,'padding-bottom','1px'); important(el,'margin-bottom','1px'); important(el,'gap','1px'); });
    host.querySelectorAll('.v182-player-row').forEach(function(el){ important(el,'font-size','4.65px'); important(el,'line-height','1.04'); important(el,'gap','1px'); important(el,'min-height','1.04em'); important(el,'letter-spacing','-.035em'); });
  }
  window.__v193EnforceMobileSplitBoard = enforce;
  document.addEventListener('DOMContentLoaded', function(){ enforce(); setTimeout(enforce,150); setTimeout(enforce,700); setTimeout(enforce,1800); });
  window.addEventListener('load', function(){ enforce(); setTimeout(enforce,500); setTimeout(enforce,1800); });
  window.addEventListener('resize', enforce, {passive:true});
  new MutationObserver(enforce).observe(document.documentElement,{childList:true,subtree:true});
})();


(function(){
  function isMobileHome(){ return window.matchMedia && window.matchMedia('(max-width: 820px)').matches; }
  function important(el, prop, value){ if(el && el.style) el.style.setProperty(prop, value, 'important'); }
  function enforce(){
    if(!isMobileHome()) return;
    var host=document.getElementById('leaderboardTable');
    if(!host || !host.classList.contains('home-chalk-leaderboard-overlay')) return;
    var layout=host.querySelector('.v182-chalk-layout');
    important(layout,'grid-template-columns','minmax(0, 46.8%) minmax(0, 52.8%)');
    important(layout,'gap','.4%');
    var rosters=host.querySelector('.v182-rosters');
    important(rosters,'padding','1.3% 0 0 1.1%');
    important(rosters,'overflow','hidden');
    host.querySelectorAll('.v182-rosters .v182-chalk-title').forEach(function(el){ important(el,'height','16px'); important(el,'min-height','16px'); important(el,'max-height','16px'); important(el,'margin','0 0 1px'); important(el,'background-size','contain'); });
    host.querySelectorAll('.v182-roster-grid').forEach(function(el){ important(el,'column-gap','.7%'); important(el,'row-gap','2.4%'); important(el,'width','100%'); });
    host.querySelectorAll('.v182-roster-card').forEach(function(el){ important(el,'padding','0 .8%'); important(el,'min-width','0'); });
    host.querySelectorAll('.v182-owner-name').forEach(function(el){ important(el,'font-size','6.05px'); important(el,'line-height','1.02'); important(el,'margin-bottom','1.3px'); important(el,'letter-spacing','-.045em'); important(el,'white-space','nowrap'); important(el,'overflow','hidden'); important(el,'text-overflow','clip'); });
    host.querySelectorAll('.v182-roster-head').forEach(function(el){ important(el,'font-size','4.15px'); important(el,'line-height','1.02'); important(el,'padding-bottom','1px'); important(el,'margin-bottom','1px'); important(el,'gap','1px'); });
    host.querySelectorAll('.v182-player-row').forEach(function(el){ important(el,'font-size','4.65px'); important(el,'line-height','1.04'); important(el,'min-height','1.04em'); important(el,'gap','1px'); important(el,'letter-spacing','-.035em'); });
    host.querySelectorAll('.v182-player-row span:first-child').forEach(function(el){ important(el,'min-width','0'); important(el,'overflow','hidden'); important(el,'text-overflow','clip'); important(el,'white-space','nowrap'); });
    host.querySelectorAll('.v182-player-row span:last-child').forEach(function(el){ important(el,'min-width','1.45em'); important(el,'text-align','right'); });
    host.querySelectorAll('.v182-goalie-break').forEach(function(el){ important(el,'margin-top','2px'); });
    host.querySelectorAll('.v182-goalie-break::before');
  }
  window.__v194EnforceMobileRosters = enforce;
  document.addEventListener('DOMContentLoaded', function(){ enforce(); setTimeout(enforce,150); setTimeout(enforce,700); setTimeout(enforce,1800); });
  window.addEventListener('load', function(){ enforce(); setTimeout(enforce,500); setTimeout(enforce,1800); });
  window.addEventListener('resize', enforce, {passive:true});
  new MutationObserver(enforce).observe(document.documentElement,{childList:true,subtree:true});
})();


(function(){
  function isMobileHome(){ return window.matchMedia && window.matchMedia('(max-width: 820px)').matches; }
  function important(el, prop, value){ if(el && el.style) el.style.setProperty(prop, value, 'important'); }
  function enforce(){
    if(!isMobileHome()) return;
    var host=document.getElementById('leaderboardTable');
    if(!host || !host.classList.contains('home-chalk-leaderboard-overlay')) return;
    var layout=host.querySelector('.v182-chalk-layout');
    important(layout,'grid-template-columns','minmax(0, 46.8%) minmax(0, 52.8%)');
    important(layout,'gap','.4%');
    var rosters=host.querySelector('.v182-rosters');
    important(rosters,'padding','.9% 0 0 1.0%');
    important(rosters,'height','100%');
    important(rosters,'max-height','100%');
    important(rosters,'overflow','hidden');
    host.querySelectorAll('.v182-rosters .v182-chalk-title').forEach(function(el){ important(el,'height','14px'); important(el,'min-height','14px'); important(el,'max-height','14px'); important(el,'margin','0 0 2px'); important(el,'background-size','contain'); important(el,'opacity','.92'); });
    host.querySelectorAll('.v182-roster-grid').forEach(function(el){ important(el,'display','grid'); important(el,'grid-template-columns','repeat(2, minmax(0, 1fr))'); important(el,'column-gap','3.2%'); important(el,'row-gap','3.0%'); important(el,'width','98.5%'); important(el,'max-width','98.5%'); important(el,'height','auto'); important(el,'align-items','start'); important(el,'align-content','start'); important(el,'justify-items','stretch'); });
    host.querySelectorAll('.v182-roster-card').forEach(function(el){ important(el,'padding','0 .8%'); important(el,'min-width','0'); important(el,'width','100%'); important(el,'overflow','hidden'); });
    host.querySelectorAll('.v182-owner-name').forEach(function(el){ important(el,'font-size','8.15px'); important(el,'line-height','1.02'); important(el,'margin','0 0 1.8px'); important(el,'letter-spacing','-.035em'); important(el,'white-space','nowrap'); important(el,'overflow','hidden'); important(el,'text-overflow','clip'); });
    host.querySelectorAll('.v182-roster-head').forEach(function(el){ important(el,'font-size','5.25px'); important(el,'line-height','1.02'); important(el,'padding-bottom','1.1px'); important(el,'margin-bottom','1.1px'); important(el,'gap','1px'); });
    host.querySelectorAll('.v182-player-row').forEach(function(el){ important(el,'font-size','6.15px'); important(el,'line-height','1.055'); important(el,'min-height','1.055em'); important(el,'gap','1px'); important(el,'letter-spacing','-.035em'); });
    host.querySelectorAll('.v182-player-row span:first-child').forEach(function(el){ important(el,'min-width','0'); important(el,'overflow','hidden'); important(el,'text-overflow','clip'); important(el,'white-space','nowrap'); });
    host.querySelectorAll('.v182-player-row span:last-child').forEach(function(el){ important(el,'min-width','1.55em'); important(el,'text-align','right'); });
    host.querySelectorAll('.v182-goalie-break').forEach(function(el){ important(el,'margin-top','2.2px'); });
  }
  window.__v195EnforceMobileRostersFill = enforce;
  document.addEventListener('DOMContentLoaded', function(){ enforce(); setTimeout(enforce,150); setTimeout(enforce,700); setTimeout(enforce,1800); });
  window.addEventListener('load', function(){ enforce(); setTimeout(enforce,500); setTimeout(enforce,1800); setTimeout(enforce,3500); });
  window.addEventListener('resize', enforce, {passive:true});
  new MutationObserver(enforce).observe(document.documentElement,{childList:true,subtree:true});
})();


(function(){
  function isMobileHome(){ return window.matchMedia && window.matchMedia('(max-width: 820px)').matches; }
  function important(el, prop, value){ if(el && el.style) el.style.setProperty(prop, value, 'important'); }
  function enforce(){
    if(!isMobileHome()) return;
    var host=document.getElementById('leaderboardTable');
    if(!host || !host.classList.contains('home-chalk-leaderboard-overlay')) return;
    var layout=host.querySelector('.v182-chalk-layout');
    important(layout,'grid-template-columns','minmax(0, 46.8%) minmax(0, 52.8%)');
    important(layout,'gap','.4%');
    important(layout,'align-items','start');
    var rosters=host.querySelector('.v182-rosters');
    important(rosters,'width','100%'); important(rosters,'max-width','100%'); important(rosters,'min-width','0'); important(rosters,'height','100%'); important(rosters,'max-height','100%'); important(rosters,'padding','.8% 0 0 .9%'); important(rosters,'overflow','hidden');
    host.querySelectorAll('.v182-rosters .v182-chalk-title').forEach(function(el){ important(el,'height','13px'); important(el,'min-height','13px'); important(el,'max-height','13px'); important(el,'margin','0 0 2px'); important(el,'background-size','contain'); important(el,'opacity','.90'); });
    host.querySelectorAll('.v182-roster-grid').forEach(function(el){ important(el,'display','grid'); important(el,'grid-template-columns','repeat(6, minmax(0, 1fr))'); important(el,'column-gap','1.35%'); important(el,'row-gap','4.4%'); important(el,'width','98.8%'); important(el,'max-width','98.8%'); important(el,'height','auto'); important(el,'align-items','start'); important(el,'align-content','start'); important(el,'justify-items','stretch'); });
    host.querySelectorAll('.v182-roster-card').forEach(function(el,i){ important(el,'min-width','0'); important(el,'width','100%'); important(el,'max-width','100%'); important(el,'padding','0 .55%'); important(el,'overflow','hidden'); important(el,'background','transparent'); important(el,'border','0'); var pos=[['1 / span 2','1'],['3 / span 2','1'],['5 / span 2','1'],['2 / span 2','2'],['4 / span 2','2']][i]; if(pos){ important(el,'grid-column',pos[0]); important(el,'grid-row',pos[1]); } });
    host.querySelectorAll('.v182-owner-name').forEach(function(el){ important(el,'font-size','6.15px'); important(el,'line-height','1.02'); important(el,'margin','0 0 1.25px'); important(el,'letter-spacing','-.035em'); important(el,'text-align','left'); important(el,'white-space','nowrap'); important(el,'overflow','hidden'); important(el,'text-overflow','clip'); });
    host.querySelectorAll('.v182-roster-head').forEach(function(el){ important(el,'display','grid'); important(el,'grid-template-columns','minmax(0, 1fr) auto'); important(el,'gap','1px'); important(el,'font-size','4.05px'); important(el,'line-height','1.02'); important(el,'padding-bottom','1px'); important(el,'margin-bottom','1px'); important(el,'white-space','nowrap'); });
    host.querySelectorAll('.v182-player-row').forEach(function(el){ important(el,'display','grid'); important(el,'grid-template-columns','minmax(0, 1fr) auto'); important(el,'gap','1px'); important(el,'font-size','4.95px'); important(el,'line-height','1.045'); important(el,'min-height','1.045em'); important(el,'letter-spacing','-.035em'); important(el,'white-space','nowrap'); });
    host.querySelectorAll('.v182-player-row span:first-child').forEach(function(el){ important(el,'min-width','0'); important(el,'overflow','hidden'); important(el,'text-overflow','clip'); important(el,'white-space','nowrap'); });
    host.querySelectorAll('.v182-player-row span:last-child').forEach(function(el){ important(el,'min-width','1.48em'); important(el,'text-align','right'); });
    host.querySelectorAll('.v182-goalie-break').forEach(function(el){ important(el,'margin-top','1.7px'); });
    host.querySelectorAll('.v182-goalie-break').forEach(function(el){ if(!el.dataset.v197){ el.dataset.v197='1'; } });
  }
  window.__v197EnforceMobileRosterThreeTwo = enforce;
  document.addEventListener('DOMContentLoaded', function(){ enforce(); setTimeout(enforce,150); setTimeout(enforce,700); setTimeout(enforce,1800); setTimeout(enforce,3600); });
  window.addEventListener('load', function(){ enforce(); setTimeout(enforce,500); setTimeout(enforce,1800); setTimeout(enforce,3500); setTimeout(enforce,6500); });
  window.addEventListener('resize', enforce, {passive:true});
  new MutationObserver(function(){ requestAnimationFrame(enforce); }).observe(document.documentElement,{childList:true,subtree:true});
})();


(function(){
  function isMobileHome(){ return window.matchMedia && window.matchMedia('(max-width: 820px)').matches; }
  function important(el, prop, value){ if(el && el.style) el.style.setProperty(prop, value, 'important'); }
  function enforce(){
    if(!isMobileHome()) return;
    var host=document.getElementById('leaderboardTable');
    if(!host || !host.classList.contains('home-chalk-leaderboard-overlay')) return;
    var layout=host.querySelector('.v182-chalk-layout');
    important(layout,'grid-template-columns','minmax(0, 46.8%) minmax(0, 52.8%)'); important(layout,'gap','.4%'); important(layout,'align-items','stretch'); important(layout,'height','100%');
    var rosters=host.querySelector('.v182-rosters');
    important(rosters,'width','100%'); important(rosters,'max-width','100%'); important(rosters,'min-width','0'); important(rosters,'height','100%'); important(rosters,'max-height','100%'); important(rosters,'padding','.45% 0 0 .7%'); important(rosters,'overflow','hidden'); important(rosters,'display','flex'); important(rosters,'flex-direction','column');
    host.querySelectorAll('.v182-rosters .v182-chalk-title').forEach(function(el){ important(el,'height','10px'); important(el,'min-height','10px'); important(el,'max-height','10px'); important(el,'margin','0 0 1px'); important(el,'background-size','contain'); important(el,'opacity','.82'); important(el,'flex','0 0 auto'); });
    host.querySelectorAll('.v182-roster-grid').forEach(function(el){ important(el,'display','grid'); important(el,'grid-template-columns','repeat(6, minmax(0, 1fr))'); important(el,'grid-template-rows','minmax(0, 1fr) minmax(0, 1fr)'); important(el,'column-gap','1.05%'); important(el,'row-gap','2.15%'); important(el,'width','99.2%'); important(el,'max-width','99.2%'); important(el,'height','calc(100% - 11px)'); important(el,'max-height','calc(100% - 11px)'); important(el,'align-items','stretch'); important(el,'align-content','stretch'); important(el,'justify-items','stretch'); });
    host.querySelectorAll('.v182-roster-card').forEach(function(el,i){ important(el,'min-width','0'); important(el,'width','100%'); important(el,'max-width','100%'); important(el,'height','100%'); important(el,'min-height','0'); important(el,'padding','0 .45%'); important(el,'overflow','hidden'); important(el,'background','rgba(0,0,0,.05)'); important(el,'border','0'); important(el,'display','flex'); important(el,'flex-direction','column'); important(el,'justify-content','flex-start'); var pos=[['1 / span 2','1'],['3 / span 2','1'],['5 / span 2','1'],['2 / span 2','2'],['4 / span 2','2']][i]; if(pos){ important(el,'grid-column',pos[0]); important(el,'grid-row',pos[1]); } });
    host.querySelectorAll('.v182-owner-name').forEach(function(el){ important(el,'font-size','7.45px'); important(el,'line-height','1'); important(el,'margin','0 0 1.55px'); important(el,'letter-spacing','-.045em'); important(el,'text-align','left'); important(el,'white-space','nowrap'); important(el,'overflow','hidden'); important(el,'text-overflow','clip'); important(el,'flex','0 0 auto'); });
    host.querySelectorAll('.v182-roster-head').forEach(function(el){ important(el,'display','grid'); important(el,'grid-template-columns','minmax(0, 1fr) auto'); important(el,'gap','1px'); important(el,'font-size','4.95px'); important(el,'line-height','1'); important(el,'padding-bottom','1.1px'); important(el,'margin-bottom','1.2px'); important(el,'white-space','nowrap'); important(el,'flex','0 0 auto'); });
    host.querySelectorAll('.v182-player-row').forEach(function(el){ important(el,'display','grid'); important(el,'grid-template-columns','minmax(0, 1fr) auto'); important(el,'gap','1px'); important(el,'font-size','6.12px'); important(el,'line-height','1.12'); important(el,'min-height','1.12em'); important(el,'letter-spacing','-.035em'); important(el,'white-space','nowrap'); important(el,'flex','0 0 auto'); });
    host.querySelectorAll('.v182-player-row span:first-child').forEach(function(el){ important(el,'min-width','0'); important(el,'overflow','hidden'); important(el,'text-overflow','clip'); important(el,'white-space','nowrap'); });
    host.querySelectorAll('.v182-player-row span:last-child').forEach(function(el){ important(el,'min-width','1.35em'); important(el,'text-align','right'); });
    host.querySelectorAll('.v182-goalie-break').forEach(function(el){ important(el,'margin-top','2.2px'); important(el,'flex','0 0 auto'); });
  }
  window.__v202EnforceMobileRosterFill = enforce;
  document.addEventListener('DOMContentLoaded', function(){ enforce(); setTimeout(enforce,150); setTimeout(enforce,700); setTimeout(enforce,1800); setTimeout(enforce,3600); });
  window.addEventListener('load', function(){ enforce(); setTimeout(enforce,500); setTimeout(enforce,1800); setTimeout(enforce,3500); setTimeout(enforce,6500); });
  window.addEventListener('resize', enforce, {passive:true});
  new MutationObserver(function(){ requestAnimationFrame(enforce); }).observe(document.documentElement,{childList:true,subtree:true});
})();


(function(){
  function isMobile(){ return window.matchMedia && window.matchMedia('(max-width: 820px)').matches; }
  function important(el, prop, value){ if(el && el.style) el.style.setProperty(prop, value, 'important'); }
  function each(root, selector, fn){ if(root) root.querySelectorAll(selector).forEach(fn); }
  function enforce(){
    if(!isMobile()) return;
    var host = document.getElementById('leaderboardTable');
    if(!host || !host.classList.contains('home-chalk-leaderboard-overlay')) return;
    host.setAttribute('data-v203-mobile-clean-rebuild','true');
    important(host,'left','18.9%'); important(host,'top','31.85%'); important(host,'width','66.2%'); important(host,'height','43.85%'); important(host,'overflow','visible'); important(host,'transform','rotate(-0.08deg)');
    var layout = host.querySelector('.v182-chalk-layout');
    important(layout,'position','relative'); important(layout,'display','block'); important(layout,'width','100%'); important(layout,'height','100%'); important(layout,'gap','0'); important(layout,'transform','none'); important(layout,'overflow','visible');
    var standings = host.querySelector('.v182-standings');
    important(standings,'position','absolute'); important(standings,'left','0'); important(standings,'top','0'); important(standings,'width','46.4%'); important(standings,'height','100%'); important(standings,'max-width','46.4%'); important(standings,'padding','.5% 1.25% 0 0'); important(standings,'overflow','hidden'); important(standings,'display','block');
    var rosters = host.querySelector('.v182-rosters');
    important(rosters,'position','absolute'); important(rosters,'left','47.2%'); important(rosters,'top','0'); important(rosters,'width','52.8%'); important(rosters,'height','100%'); important(rosters,'max-width','52.8%'); important(rosters,'padding','.35% .25% 0 .75%'); important(rosters,'overflow','hidden'); important(rosters,'display','flex'); important(rosters,'flex-direction','column');
    each(host,'.v182-standings .v182-chalk-title',function(el){ important(el,'height','14px'); important(el,'min-height','14px'); important(el,'max-height','14px'); important(el,'margin','0 0 2px'); important(el,'background-size','contain'); important(el,'opacity','.84'); important(el,'font-size','0'); important(el,'line-height','0'); });
    each(host,'.v182-rosters .v182-chalk-title',function(el){ important(el,'height','13px'); important(el,'min-height','13px'); important(el,'max-height','13px'); important(el,'margin','0 0 2px'); important(el,'background-size','contain'); important(el,'opacity','.83'); important(el,'font-size','0'); important(el,'line-height','0'); important(el,'flex','0 0 auto'); });
    var table=host.querySelector('.v182-standings-table');
    important(table,'width','100%'); important(table,'table-layout','fixed'); important(table,'border-collapse','collapse'); important(table,'margin','0');
    each(host,'.v182-standings-table th',function(el){ important(el,'font-size','7.6px'); important(el,'line-height','.94'); important(el,'padding-top','0'); important(el,'padding-bottom','2px'); important(el,'font-weight','650'); important(el,'letter-spacing','-.045em'); important(el,'white-space','nowrap'); important(el,'overflow','hidden'); important(el,'text-overflow','clip'); });
    each(host,'.v182-standings-table td',function(el){ important(el,'font-size','9.75px'); important(el,'line-height','.98'); important(el,'padding-top','1.9px'); important(el,'padding-bottom','1.9px'); important(el,'font-weight','850'); important(el,'letter-spacing','-.045em'); important(el,'white-space','nowrap'); important(el,'overflow','hidden'); important(el,'text-overflow','clip'); });
    each(host,'.v182-roster-grid',function(el){ important(el,'display','grid'); important(el,'grid-template-columns','repeat(6, minmax(0, 1fr))'); important(el,'grid-template-rows','1fr 1fr'); important(el,'column-gap','1.65%'); important(el,'row-gap','2.6%'); important(el,'width','100%'); important(el,'height','calc(100% - 15px)'); important(el,'min-height','0'); important(el,'align-items','stretch'); important(el,'align-content','stretch'); important(el,'justify-items','stretch'); });
    each(host,'.v182-roster-card',function(el,i){ important(el,'min-width','0'); important(el,'width','100%'); important(el,'max-width','100%'); important(el,'height','100%'); important(el,'min-height','0'); important(el,'overflow','hidden'); important(el,'padding','0 .55%'); important(el,'background','rgba(0,0,0,.035)'); important(el,'border','0'); important(el,'display','flex'); important(el,'flex-direction','column'); important(el,'justify-content','flex-start'); var pos=[['1 / span 2','1'],['3 / span 2','1'],['5 / span 2','1'],['2 / span 2','2'],['4 / span 2','2']][i]; if(pos){ important(el,'grid-column',pos[0]); important(el,'grid-row',pos[1]); } });
    each(host,'.v182-owner-name',function(el){ important(el,'font-size','6.9px'); important(el,'line-height','.98'); important(el,'margin','0 0 1.4px'); important(el,'letter-spacing','-.035em'); important(el,'text-align','left'); important(el,'white-space','nowrap'); important(el,'overflow','hidden'); important(el,'text-overflow','clip'); important(el,'flex','0 0 auto'); });
    each(host,'.v182-roster-head',function(el){ important(el,'display','grid'); important(el,'grid-template-columns','minmax(0, 1fr) auto'); important(el,'gap','1px'); important(el,'font-size','4.55px'); important(el,'line-height','.98'); important(el,'padding-bottom','1px'); important(el,'margin-bottom','1.1px'); important(el,'white-space','nowrap'); important(el,'flex','0 0 auto'); });
    each(host,'.v182-player-row',function(el){ important(el,'display','grid'); important(el,'grid-template-columns','minmax(0, 1fr) auto'); important(el,'gap','1px'); important(el,'font-size','5.72px'); important(el,'line-height','1.085'); important(el,'min-height','1.085em'); important(el,'letter-spacing','-.032em'); important(el,'white-space','nowrap'); important(el,'flex','0 0 auto'); });
    each(host,'.v182-player-row span:first-child',function(el){ important(el,'min-width','0'); important(el,'overflow','hidden'); important(el,'text-overflow','clip'); important(el,'white-space','nowrap'); });
    each(host,'.v182-player-row span:last-child',function(el){ important(el,'min-width','1.35em'); important(el,'text-align','right'); });
    each(host,'.v182-goalie-break',function(el){ important(el,'margin-top','2px'); important(el,'flex','0 0 auto'); });
  }
  window.__v203EnforceMobileHomeCleanRebuild = enforce;
  document.addEventListener('DOMContentLoaded', function(){ enforce(); setTimeout(enforce,120); setTimeout(enforce,650); setTimeout(enforce,1600); setTimeout(enforce,3300); });
  window.addEventListener('load', function(){ enforce(); setTimeout(enforce,400); setTimeout(enforce,1200); setTimeout(enforce,2600); setTimeout(enforce,5200); });
  window.addEventListener('resize', enforce, {passive:true});
  new MutationObserver(function(){ requestAnimationFrame(enforce); }).observe(document.documentElement,{childList:true,subtree:true});
})();


(function(){
  function openOwner(ownerId){
    ownerId = String(ownerId || '').toLowerCase();
    if (!ownerId) return;
    if (typeof window.openRosterStall === 'function') {
      window.openRosterStall(ownerId);
      return;
    }
    var rosterTab = document.querySelector('[data-tab="rosters"]');
    var rosterPanel = document.getElementById('rosters');
    if (rosterTab && rosterPanel) {
      document.querySelectorAll('.tab').forEach(function (b) { b.classList.toggle('active', b === rosterTab); });
      document.querySelectorAll('.panel').forEach(function (panel) { panel.classList.toggle('active', panel === rosterPanel); });
      document.body.dataset.activeTab = 'rosters';
    }
    window.__pendingHomeRosterOwner = ownerId;
  }

  document.addEventListener('click', function(event){
    var btn = event.target.closest && event.target.closest('.home-image-hotspot-owner[data-roster-owner]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    openOwner(btn.getAttribute('data-roster-owner'));
  }, true);

  window.addEventListener('load', function(){
    if (window.__pendingHomeRosterOwner && typeof window.openRosterStall === 'function') {
      window.openRosterStall(window.__pendingHomeRosterOwner);
      window.__pendingHomeRosterOwner = '';
    }
  });
})();


(function(){
  function isMobile(){ return window.matchMedia && window.matchMedia('(max-width: 820px)').matches; }
  function important(el, prop, value){ if(el && el.style) el.style.setProperty(prop, value, 'important'); }
  function fix(){
    if(!isMobile()) return;
    var host = document.getElementById('leaderboardTable');
    if(!host || !host.classList.contains('home-chalk-leaderboard-overlay')) return;

    var standings = host.querySelector('.v182-standings');
    var table = host.querySelector('.v182-standings-table');

    /* This is the actual mobile lever: the v203 rebuild made standings absolute and pinned it at top:0 inline. */
    important(standings, 'position', 'absolute');
    important(standings, 'top', '18.8%');
    important(standings, 'height', '81.2%');
    important(standings, 'padding-top', '0');
    important(standings, 'padding-right', '1.25%');
    important(standings, 'padding-bottom', '0');
    important(standings, 'padding-left', '0');
    important(standings, 'overflow', 'visible');

    important(table, 'margin-top', '0');
    important(table, 'transform', 'none');
  }

  window.__v214FixMobileStandingsActualPosition = fix;

  document.addEventListener('DOMContentLoaded', function(){
    fix();
    setTimeout(fix, 80);
    setTimeout(fix, 300);
    setTimeout(fix, 900);
    setTimeout(fix, 1800);
    setTimeout(fix, 3600);
    setTimeout(fix, 6500);
  });
  window.addEventListener('load', function(){
    fix();
    setTimeout(fix, 250);
    setTimeout(fix, 1000);
    setTimeout(fix, 2500);
    setTimeout(fix, 5200);
  });
  window.addEventListener('resize', fix, {passive:true});

  var observerReady = function(){
    var host = document.getElementById('leaderboardTable');
    if(host) new MutationObserver(fix).observe(host, {childList:true, subtree:true, attributes:true});
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observerReady);
  else observerReady();
})();


(function(){
  function isMobile(){ return window.matchMedia && window.matchMedia('(max-width: 820px)').matches; }
  function important(el, prop, value){ if(el && el.style) el.style.setProperty(prop, value, 'important'); }
  function fix(){
    if(!isMobile()) return;
    var host = document.getElementById('leaderboardTable');
    if(!host || !host.classList.contains('home-chalk-leaderboard-overlay')) return;

    var rosters = host.querySelector('.v182-rosters');
    var grid = host.querySelector('.v182-roster-grid');

    /* v203's mobile enforcer writes top:0 inline to rosters. This later enforcer is the actual matching lever. */
    important(rosters, 'position', 'absolute');
    important(rosters, 'top', '18.8%');
    important(rosters, 'height', '81.2%');
    important(rosters, 'padding-top', '0');
    important(rosters, 'padding-right', '.25%');
    important(rosters, 'padding-bottom', '0');
    important(rosters, 'padding-left', '.75%');
    important(rosters, 'overflow', 'hidden');

    important(grid, 'height', '100%');
    important(grid, 'max-height', '100%');
  }

  window.__v215FixMobileRostersMatchStandings = fix;

  document.addEventListener('DOMContentLoaded', function(){
    fix();
    setTimeout(fix, 80);
    setTimeout(fix, 300);
    setTimeout(fix, 900);
    setTimeout(fix, 1800);
    setTimeout(fix, 3600);
    setTimeout(fix, 6500);
  });
  window.addEventListener('load', function(){
    fix();
    setTimeout(fix, 250);
    setTimeout(fix, 1000);
    setTimeout(fix, 2500);
    setTimeout(fix, 5200);
  });
  window.addEventListener('resize', fix, {passive:true});

  var observerReady = function(){
    var host = document.getElementById('leaderboardTable');
    if(host) new MutationObserver(fix).observe(host, {childList:true, subtree:true, attributes:true});
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observerReady);
  else observerReady();
})();


(function(){
  function sync(){
    var rosters = document.getElementById('rosters');
    var active = !!(rosters && rosters.classList.contains('active'));
    document.body.classList.toggle('v218-rosters-active', active);
    if (active) document.body.dataset.activeTab = 'rosters';
  }
  document.addEventListener('DOMContentLoaded', function(){
    sync();
    setTimeout(sync, 50);
    setTimeout(sync, 250);
    setTimeout(sync, 900);
  });
  document.addEventListener('click', function(){ setTimeout(sync, 0); setTimeout(sync, 120); }, true);
  window.addEventListener('load', sync);
  window.addEventListener('resize', sync, {passive:true});
  new MutationObserver(sync).observe(document.body, {subtree:true, attributes:true, attributeFilter:['class']});
})();


{"schemaVersion":1,"poolId":"ricoh-history-book","description":"Canonical previous-season history file for the Ricoh/friends hockey pool book. Add future completed seasons here instead of relying on history sources.","owners":{"nick":{"owner":"Nick","currentTeam":"Glizzy Disposal"},"andrew":{"owner":"Andrew","currentTeam":"Between The Pipes"},"tyler":{"owner":"Tyler","currentTeam":"Puck Slut"},"chris":{"owner":"Chris","currentTeam":"CeCe Hairless Horde"},"ricoh":{"owner":"Ricoh","currentTeam":"Senile Cely"},"scott":{"owner":"Scott","currentTeam":"Scott"}},"seasons":[{"id":"20252026","label":"2025-2026 Regular Season","source":"OnlinePools screenshot verified / saved-history-file","championOwnerId":"andrew","standings":[{"rank":1,"ownerId":"andrew","team":"Between The Pipes","pts":1376},{"rank":2,"ownerId":"chris","team":"CeCe Hairless Horde","pts":1362},{"rank":3,"ownerId":"scott","team":"Scott","pts":1346},{"rank":4,"ownerId":"nick","team":"Glizzy Disposal","pts":1258},{"rank":5,"ownerId":"tyler","team":"Puck Slut","pts":1202}]},{"id":"20242025","label":"2024-2025 Ricoh Abandon Pool","source":"saved-history-file","championOwnerId":"chris","standings":[{"rank":1,"ownerId":"chris","team":"CeCe Hairless Horde","pts":1380,"skatersTotal":1250,"goaliesTotal":130,"skaters":[{"name":"MacKinnon, N","nhlTeam":"COL","pts":173},{"name":"Draisaitl, L","nhlTeam":"EDM","pts":213},{"name":"Kaprizov, K","nhlTeam":"MIN","pts":106},{"name":"Crosby, S","nhlTeam":"PIT","pts":174},{"name":"Nylander, W","nhlTeam":"TOR","pts":169},{"name":"Tkachuk, M","nhlTeam":"FLA","pts":89},{"name":"Fox, A","nhlTeam":"NYR","pts":81},{"name":"Morrissey, J","nhlTeam":"WPG","pts":86},{"name":"Dahlin, R","nhlTeam":"BUF","pts":90},{"name":"Karlsson, E","nhlTeam":"PIT","pts":69}],"goalies":[{"name":"Oettinger, J","nhlTeam":"DAL","pts":87},{"name":"DeSmith, C","nhlTeam":"DAL","pts":43}]},{"rank":2,"ownerId":"nick","team":"Glizzy Disposal","pts":1301,"skatersTotal":1175,"goaliesTotal":126,"skaters":[{"name":"Rantanen, M","nhlTeam":"DAL","pts":150},{"name":"Hughes, J","nhlTeam":"NJD","pts":132},{"name":"Marner, M","nhlTeam":"TOR","pts":164},{"name":"Robertson, J","nhlTeam":"DAL","pts":145},{"name":"Aho, S","nhlTeam":"CAR","pts":148},{"name":"Bedard, C","nhlTeam":"CHI","pts":115},{"name":"Makar, C","nhlTeam":"COL","pts":142},{"name":"Bouchard, E","nhlTeam":"EDM","pts":91},{"name":"Heiskanen, M","nhlTeam":"DAL","pts":30},{"name":"Rielly, M","nhlTeam":"TOR","pts":58}],"goalies":[{"name":"Quick, J","nhlTeam":"NYR","pts":42},{"name":"Shesterkin, I","nhlTeam":"NYR","pts":84}]},{"rank":3,"ownerId":"andrew","team":"Between The Pipes","pts":1172,"skatersTotal":1056,"goaliesTotal":116,"skaters":[{"name":"McDavid, C","nhlTeam":"EDM","pts":141},{"name":"Kucherov, N","nhlTeam":"TAM","pts":203},{"name":"Reinhart, S","nhlTeam":"FLA","pts":140},{"name":"Pettersson, E","nhlTeam":"VAN","pts":65},{"name":"Thomas, R","nhlTeam":"STL","pts":127},{"name":"Michkov, M","nhlTeam":"PHI","pts":104},{"name":"Josi, R","nhlTeam":"NAS","pts":52},{"name":"Dobson, N","nhlTeam":"NYI","pts":54},{"name":"Werenski, Z","nhlTeam":"CBJ","pts":130},{"name":"McAvoy, C","nhlTeam":"BOS","pts":40}],"goalies":[{"name":"Skinner, S","nhlTeam":"EDM","pts":67},{"name":"Pickard, C","nhlTeam":"EDM","pts":49}]},{"rank":4,"ownerId":"tyler","team":"Puck Slut","pts":1163,"skatersTotal":1060,"goaliesTotal":103,"skaters":[{"name":"Matthews, A","nhlTeam":"TOR","pts":121},{"name":"Pastrnak, D","nhlTeam":"BOS","pts":169},{"name":"Miller, J","nhlTeam":"NYR","pts":102},{"name":"Panarin, A","nhlTeam":"NYR","pts":141},{"name":"Forsberg, F","nhlTeam":"NAS","pts":122},{"name":"Stamkos, S","nhlTeam":"NAS","pts":110},{"name":"Hughes, Q","nhlTeam":"VAN","pts":107},{"name":"Hedman, V","nhlTeam":"TAM","pts":80},{"name":"Seider, M","nhlTeam":"DET","pts":54},{"name":"Skjei, B","nhlTeam":"NAS","pts":54}],"goalies":[{"name":"Saros, J","nhlTeam":"NAS","pts":65},{"name":"Wedgewood, S","nhlTeam":"COL","pts":38}]}]},{"id":"20232024","label":"2023-2024 Legend Of Ricoh","source":"saved-history-file","championOwnerId":"chris","standings":[{"rank":1,"ownerId":"chris","team":"CeCe Hairless Horde","pts":1515,"skatersTotal":1429,"goaliesTotal":86,"skaters":[{"name":"MacKinnon, N","nhlTeam":"COL","pts":236},{"name":"Kucherov, N","nhlTeam":"TAM","pts":218},{"name":"Tkachuk, B","nhlTeam":"OTT","pts":121},{"name":"Tkachuk, M","nhlTeam":"FLA","pts":124},{"name":"Kaprizov, K","nhlTeam":"MIN","pts":182},{"name":"Hintz, R","nhlTeam":"DAL","pts":125},{"name":"Makar, C","nhlTeam":"COL","pts":116},{"name":"Karlsson, E","nhlTeam":"PIT","pts":87},{"name":"Josi, R","nhlTeam":"NAS","pts":133},{"name":"Carlson, J","nhlTeam":"WAS","pts":87}],"goalies":[{"name":"Georgiev, A","nhlTeam":"COL","pts":86},{"name":"Francouz, P","nhlTeam":"COL","pts":0}]},{"rank":2,"ownerId":"nick","team":"Glizzy Disposal","pts":1418,"skatersTotal":1280,"goaliesTotal":138,"skaters":[{"name":"McDavid, C","nhlTeam":"EDM","pts":189},{"name":"Crosby, S","nhlTeam":"PIT","pts":151},{"name":"Nylander, W","nhlTeam":"TOR","pts":173},{"name":"Stutzle, T","nhlTeam":"OTT","pts":98},{"name":"Eichel, J","nhlTeam":"VGK","pts":134},{"name":"Aho, S","nhlTeam":"CAR","pts":175},{"name":"Fox, A","nhlTeam":"NYR","pts":115},{"name":"Seider, M","nhlTeam":"DET","pts":51},{"name":"Bouchard, E","nhlTeam":"EDM","pts":135},{"name":"Jones, S","nhlTeam":"CHI","pts":59}],"goalies":[{"name":"Quick, J","nhlTeam":"NYR","pts":46},{"name":"Shesterkin, I","nhlTeam":"NYR","pts":92}]},{"rank":3,"ownerId":"andrew","team":"Between The Pipes","pts":1265,"skatersTotal":1221,"goaliesTotal":44,"skaters":[{"name":"Matthews, A","nhlTeam":"TOR","pts":216},{"name":"Thompson, T","nhlTeam":"BUF","pts":100},{"name":"Rantanen, M","nhlTeam":"COL","pts":191},{"name":"Verhaeghe, C","nhlTeam":"FLA","pts":141},{"name":"Ovechkin, A","nhlTeam":"WAS","pts":121},{"name":"Stamkos, S","nhlTeam":"TAM","pts":151},{"name":"Dahlin, R","nhlTeam":"BUF","pts":89},{"name":"Morrissey, J","nhlTeam":"WPG","pts":84},{"name":"Montour, B","nhlTeam":"FLA","pts":56},{"name":"Toews, D","nhlTeam":"COL","pts":72}],"goalies":[{"name":"Vanecek, V","nhlTeam":"SAN","pts":34},{"name":"Schmid, A","nhlTeam":"NJD","pts":10}]},{"rank":4,"ownerId":"tyler","team":"Puck Slut","pts":1249,"skatersTotal":1130,"goaliesTotal":119,"skaters":[{"name":"Draisaitl, L","nhlTeam":"EDM","pts":182},{"name":"Hughes, J","nhlTeam":"NJD","pts":121},{"name":"Pettersson, E","nhlTeam":"VAN","pts":173},{"name":"Robertson, J","nhlTeam":"DAL","pts":129},{"name":"Hischier, N","nhlTeam":"NJD","pts":114},{"name":"Tavares, J","nhlTeam":"TOR","pts":124},{"name":"Hughes, Q","nhlTeam":"VAN","pts":119},{"name":"Hamilton, D","nhlTeam":"NJD","pts":21},{"name":"Heiskanen, M","nhlTeam":"DAL","pts":73},{"name":"McAvoy, C","nhlTeam":"BOS","pts":74}],"goalies":[{"name":"Ullmark, L","nhlTeam":"BOS","pts":54},{"name":"Swayman, J","nhlTeam":"BOS","pts":65}]},{"rank":5,"ownerId":"ricoh","team":"Senile Cely","pts":1143,"skatersTotal":1040,"goaliesTotal":103,"skaters":[{"name":"Pastrnak, D","nhlTeam":"BOS","pts":182},{"name":"Marner, M","nhlTeam":"TOR","pts":121},{"name":"Bedard, C","nhlTeam":"CHI","pts":93},{"name":"Point, B","nhlTeam":"TAM","pts":196},{"name":"Zibanejad, M","nhlTeam":"NYR","pts":113},{"name":"Panarin, A","nhlTeam":"NYR","pts":194},{"name":"Dunn, V","nhlTeam":"SEA","pts":57},{"name":"Sergachev, M","nhlTeam":"TAM","pts":21},{"name":"Barrie, T","nhlTeam":"NAS","pts":16},{"name":"Pietrangelo, A","nhlTeam":"VGK","pts":47}],"goalies":[{"name":"Sorokin, I","nhlTeam":"NYI","pts":60},{"name":"Varlamov, S","nhlTeam":"NYI","pts":43}]}]}]}


(function(){
  const OWNER_META = {
    nick:{owner:'Nick', team:'Glizzy Disposal'},
    andrew:{owner:'Andrew', team:'Between The Pipes'},
    tyler:{owner:'Tyler', team:'Puck Slut'},
    chris:{owner:'Chris', team:'CeCe Hairless Horde'},
    ricoh:{owner:'Ricoh', team:'Senile Cely'},
    scott:{owner:'Scott', team:'Scott'}
  };
  const STATIC_SEASONS = [
    {
        "id": "20252026",
        "label": "2025-2026 Regular Season",
        "note": "Saved history file verified from OnlinePools screenshot.",
        "standings": [
            {
                "rank": 1,
                "ownerId": "andrew",
                "team": "Between The Pipes",
                "pts": 1376
            },
            {
                "rank": 2,
                "ownerId": "chris",
                "team": "CeCe Hairless Horde",
                "pts": 1362
            },
            {
                "rank": 3,
                "ownerId": "scott",
                "team": "Scott",
                "pts": 1346
            },
            {
                "rank": 4,
                "ownerId": "nick",
                "team": "Glizzy Disposal",
                "pts": 1258
            },
            {
                "rank": 5,
                "ownerId": "tyler",
                "team": "Puck Slut",
                "pts": 1202
            }
        ]
    },
    {
        "id": "20242025",
        "label": "2024-2025 Ricoh Abandon Pool",
        "note": "Saved history file.",
        "standings": [
            {
                "rank": 1,
                "ownerId": "chris",
                "team": "CeCe Hairless Horde",
                "pts": 1380
            },
            {
                "rank": 2,
                "ownerId": "nick",
                "team": "Glizzy Disposal",
                "pts": 1301
            },
            {
                "rank": 3,
                "ownerId": "andrew",
                "team": "Between The Pipes",
                "pts": 1172
            },
            {
                "rank": 4,
                "ownerId": "tyler",
                "team": "Puck Slut",
                "pts": 1163
            }
        ]
    },
    {
        "id": "20232024",
        "label": "2023-2024 Legend Of Ricoh",
        "note": "Saved history file.",
        "standings": [
            {
                "rank": 1,
                "ownerId": "chris",
                "team": "CeCe Hairless Horde",
                "pts": 1515
            },
            {
                "rank": 2,
                "ownerId": "nick",
                "team": "Glizzy Disposal",
                "pts": 1418
            },
            {
                "rank": 3,
                "ownerId": "andrew",
                "team": "Between The Pipes",
                "pts": 1265
            },
            {
                "rank": 4,
                "ownerId": "tyler",
                "team": "Puck Slut",
                "pts": 1249
            },
            {
                "rank": 5,
                "ownerId": "ricoh",
                "team": "Senile Cely",
                "pts": 1143
            }
        ]
    }
];
  const OWNER_ORDER = ['chris','nick','andrew','tyler','scott','ricoh'];
  const TEST_SEASONS_KEY = 'custom-hockey-pool-test-history-seasons';
  function readTestSeasons(){
    try {
      const items = JSON.parse(localStorage.getItem(TEST_SEASONS_KEY) || '[]');
      return Array.isArray(items) ? items.filter(s => s && Array.isArray(s.standings)) : [];
    } catch(e) { return []; }
  }
  let activeView = 'total';
  let modal = null;
  let bookSort = { view:'total', key:'total', dir:'desc' };
  function esc(v){return String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function fmt(n){return Number(n||0).toLocaleString('en-CA');}
  function liveSeasonRows(){
    const d = window.__lastSeasonApiDiagnostics;
    if(!d || !Array.isArray(d.rows) || !d.rows.length) return null;
    return d.rows.map((r,i)=>({
      rank:i+1, ownerId:r.ownerId, team:(OWNER_META[r.ownerId]&&OWNER_META[r.ownerId].team)||r.ownerName||r.ownerId,
      pts:Number(r.total)||0, goals:Number(r.goals)||0, assists:Number(r.assists)||0, shortHandedGoals:Number(r.shortHandedGoals)||0,
      gameWinningGoals:Number(r.gameWinningGoals)||0, goalieWins:Number(r.goalieWins)||0, goalieShutouts:Number(r.goalieShutouts)||0,
      goalieAssists:Number(r.goalieAssists)||0, goalieGoals:Number(r.goalieGoals)||0, hasFullStats:true
    }));
  }
  function allSeasons(){
    let seasons = STATIC_SEASONS.map(s=>({...s, standings:s.standings.map(r=>({...r}))}));
    // v254: Do not let live/current roster state replace the permanent 2025-2026 history in the book.
    // Resetting rosters can create blank/zero live rows; those must never overwrite saved history visually.
    const tests = readTestSeasons().map(s=>({...s, standings:s.standings.map(r=>({...r})), testSeason:true}));
    if (tests.length) {
      const testIds = new Set(tests.map(t => String(t.id)));
      seasons = seasons.filter(s => !testIds.has(String(s.id))).concat(tests);
    }
    seasons.forEach(season=>{ season.standings.sort((a,b)=>b.pts-a.pts || String(a.team).localeCompare(String(b.team))); season.standings.forEach((r,i)=>r.rank=i+1); });
    seasons.sort((a,b)=>String(b.id||'').localeCompare(String(a.id||'')));
    return seasons;
  }
  function aggregateRows(){
    const totals = {}; OWNER_ORDER.forEach(id=>totals[id]={ownerId:id, owner:OWNER_META[id].owner, team:OWNER_META[id].team, total:0, seasons:0, bySeason:{}});
    allSeasons().forEach(season=>season.standings.forEach(row=>{
      if(!totals[row.ownerId]) totals[row.ownerId]={ownerId:row.ownerId, owner:row.ownerId, team:row.team, total:0, seasons:0, bySeason:{}};
      totals[row.ownerId].total += Number(row.pts)||0;
      totals[row.ownerId].seasons += 1;
      totals[row.ownerId].bySeason[season.id] = Number(row.pts)||0;
    }));
    return Object.values(totals).sort((a,b)=>b.total-a.total || b.seasons-a.seasons || a.owner.localeCompare(b.owner));
  }
  function sortButton(key,label){ return '<button type="button" data-v232-book-sort="'+esc(key)+'">'+esc(label)+'</button>'; }
  function table(headers, rows){
    return '<table class="v219-history-table v228-book-table"><thead><tr>'+headers.map(h=>'<th>'+(h.key?sortButton(h.key,h.label):esc(h.label||h))+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table>';
  }
  function sortRows(rows, view, fallbackKey){
    const key = (bookSort.view===view && bookSort.key) ? bookSort.key : fallbackKey;
    const dir = (bookSort.view===view && bookSort.dir==='asc') ? 1 : -1;
    return rows.slice().sort((a,b)=>{
      const av = a[key], bv = b[key];
      if(typeof av === 'number' || typeof bv === 'number') return ((Number(av)||0)-(Number(bv)||0))*dir || String(a.team||a.owner||'').localeCompare(String(b.team||b.owner||''));
      return String(av||'').localeCompare(String(bv||''))*dir;
    });
  }
  function statCell(v){ return (v===null || typeof v === 'undefined') ? '<span class="v232-unavailable">—</span>' : fmt(v); }
  function seasonYearLabel(s){
    const m = String(s && s.label || '').match(/(\d{4}-\d{4})/);
    return m ? m[1] : String(s && s.id || '').replace(/(\d{4})(\d{4})/,'$1-$2');
  }
  function collectorHtml(){
    return '<h2>Collector</h2><p>Choose the record you want to open.</p>'+ 
      '<div class="v228-book-nav"><button type="button" data-v228-view="total">All-Time Stats</button>'+allSeasons().map(s=>'<button type="button" data-v228-view="'+esc(s.id)+'">'+esc(seasonYearLabel(s))+'</button>').join('')+'</div>';
  }
  function rankText(seasonId, ownerId){
    const s = allSeasons().find(x=>x.id===seasonId);
    if(!s) return '—';
    const row = s.standings.find(r=>r.ownerId===ownerId);
    return row ? ('#'+row.rank+' / '+fmt(row.pts)+' pts') : '—';
  }
  function v242LedgerHtml(columns, rows, className){
    return '<div class="v242-book-ledger '+esc(className||'')+'" role="table">' +
      '<div class="v242-book-ledger-head" role="row">' + columns.map(c=>'<span class="v242-col-'+esc(c.key||c.label||'col')+'">'+(c.sort?sortButton(c.sort,c.label):esc(c.label))+'</span>').join('') + '</div>' +
      rows.map(row=>'<div class="v242-book-ledger-row" role="row">'+columns.map(c=>'<span class="v242-col-'+esc(c.key||c.label||'col')+' '+esc(c.align==='right'?'v242-num':'')+'">'+row[c.key]+'</span>').join('')+'</div>').join('') +
      '</div>';
  }
  function totalHtml(){
    const rows = sortRows(aggregateRows(), 'total', 'total');
    const columns = [
      {key:'rank', label:'#'},
      {key:'owner', label:'Owner', sort:'owner'},
      {key:'team', label:'Team', sort:'team'},
      {key:'total', label:'FPTS', sort:'total', align:'right'},
      {key:'seasons', label:'YRS', sort:'seasons', align:'right'}
    ];
    const ledgerRows = rows.map((r,i)=>({
      rank:String(i+1),
      owner:esc(r.owner),
      team:esc(r.team),
      total:fmt(r.total),
      seasons:String(r.seasons)
    }));
    return '<h2 class="v242-book-title">All-Time Stats</h2>'+v242LedgerHtml(columns, ledgerRows, 'v242-alltime-ledger');
  }
  function seasonHtml(id){
    const s = allSeasons().find(x=>x.id===id) || allSeasons()[0];
    const rows = sortRows(s.standings.map(r=>({
      ...r,
      owner:(OWNER_META[r.ownerId]&&OWNER_META[r.ownerId].owner)||r.ownerId
    })), s.id, 'pts');
    const columns = [
      {key:'rank', label:'#'},
      {key:'owner', label:'Owner', sort:'owner'},
      {key:'team', label:'Team', sort:'team'},
      {key:'pts', label:'FPTS', sort:'pts', align:'right'}
    ];
    const ledgerRows = rows.map((r,i)=>({
      rank:String(i+1),
      owner:esc(r.owner),
      team:esc(r.team),
      pts:fmt(r.pts)
    }));
    return '<h2 class="v242-book-title">'+esc(seasonYearLabel(s))+'</h2>'+v242LedgerHtml(columns, ledgerRows, 'v242-season-ledger');
  }
  function rightHtml(){ return activeView==='total' ? totalHtml() : seasonHtml(activeView); }
  function draw(){
    if(!modal) return;
    modal.querySelector('.v219-page.left').innerHTML = collectorHtml();
    modal.querySelector('.v219-page.right').innerHTML = rightHtml();
    modal.querySelectorAll('[data-v228-view]').forEach(b=>b.classList.toggle('is-active', b.dataset.v228View===activeView));
    const controls = modal.querySelector('.v219-book-controls'); if(controls) controls.style.display='none';
  }
  function ensureModal(){
    if(modal) return modal;
    modal=document.createElement('div'); modal.className='v219-history-modal v228-history-book-modal';
    modal.innerHTML='<div class="v219-history-shell" role="dialog" aria-modal="true" aria-label="Hockey History book"><button class="v219-history-close" type="button">Close</button><div class="v219-book-spread"><article class="v219-page left"></article><article class="v219-page right"></article></div><div class="v219-book-controls"></div></div>';
    document.body.appendChild(modal);
    modal.querySelector('.v219-history-close').addEventListener('click',()=>modal.classList.remove('is-open'));
    modal.addEventListener('click',e=>{
      if(e.target===modal) modal.classList.remove('is-open');
      const sort=e.target.closest&&e.target.closest('[data-v232-book-sort]');
      if(sort){ const key=sort.dataset.v232BookSort; const view=activeView; if(bookSort.view===view && bookSort.key===key) bookSort.dir=bookSort.dir==='asc'?'desc':'asc'; else bookSort={view:view,key:key,dir:(key==='owner'||key==='team')?'asc':'desc'}; draw(); return; }
      const btn=e.target.closest&&e.target.closest('[data-v228-view]'); if(btn){ activeView=btn.dataset.v228View||'total'; draw(); }
    });
    return modal;
  }
  function openBook(){ activeView='total'; ensureModal().classList.add('is-open'); draw(); }
  window.refreshHockeyHistoryBook = function(){ if(modal) draw(); };
  window.getHockeyHistoryBookSeasons = allSeasons;
  document.addEventListener('click',function(e){
    const b=e.target.closest&&e.target.closest('#rosterCards .straight-book-hotzone, #rosters .straight-book-hotzone');
    if(!b) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); openBook();
  }, true);
  window.openHockeyHistoryBook=openBook;
})();


(function(){
  function activateRosterTab(){
    var rosterTab = document.querySelector('button.tab[data-tab="rosters"], [data-tab="rosters"]');
    var rosterPanel = document.getElementById('rosters');
    if (rosterTab && rosterPanel) {
      document.querySelectorAll('.tab').forEach(function(b){ b.classList.toggle('active', b === rosterTab); });
      document.querySelectorAll('.panel').forEach(function(panel){ panel.classList.toggle('active', panel === rosterPanel); });
      document.body.dataset.activeTab = 'rosters';
      document.body.classList.add('v217-rosters-active','v218-rosters-active');
    }
    return rosterPanel;
  }

  function openTrophyLobby(){
    var rosterPanel = activateRosterTab();
    try {
      if (typeof window.__forceRosterTrophyLobby === 'function') {
        window.__forceRosterTrophyLobby(window.__exactLobbyDraft || {});
      } else if (typeof window.__renderExactTrophyLobby === 'function') {
        window.__renderExactTrophyLobby(window.__exactLobbyDraft || {});
      } else if (typeof window.renderDraftRosters === 'function') {
        window.renderDraftRosters(window.__exactLobbyDraft || {});
      }
    } catch(err) {
      console.warn('Trophy Room lobby reset failed:', err);
    }
    setTimeout(function(){
      try { if (typeof window.__renderExactTrophyLobby === 'function') window.__renderExactTrophyLobby(window.__exactLobbyDraft || {}); } catch(err) {}
      if (rosterPanel) rosterPanel.scrollIntoView({behavior:'smooth', block:'start'});
    }, 60);
  }

  window.openTrophyRoomLobby = openTrophyLobby;

  document.addEventListener('click', function(e){
    var trophyLink = e.target.closest && e.target.closest('[data-open-trophy-room]');
    var rosterTab = e.target.closest && e.target.closest('[data-tab="rosters"]');
    var fromHomeTrophy = e.target.closest && e.target.closest('.home-image-hotspot-trophy[data-tab="rosters"]');
    var isMainTrophyTab = rosterTab && !e.target.closest('[data-enter-door], [data-roster-owner], [data-walk-stall]');
    if (!trophyLink && !fromHomeTrophy && !isMainTrophyTab) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    openTrophyLobby();
  }, true);
})();


(function(){
  var suppressUntil = 0;
  var allowOwnerOpenUntil = 0;

  function now(){ return Date.now ? Date.now() : new Date().getTime(); }
  function markRealOwnerIntent(){ allowOwnerOpenUntil = now() + 1200; }

  document.addEventListener('click', function(e){
    if (!e.target || !e.target.closest) return;
    if (e.target.closest('[data-enter-door], .home-image-hotspot-owner[data-roster-owner], [data-walk-stall], [data-lobby-enter], [data-door-id]')) {
      markRealOwnerIntent();
    }
  }, true);

  function activateRostersPanel(){
    var rosterPanel = document.getElementById('rosters');
    var rosterTab = document.querySelector('button.tab[data-tab="rosters"]');
    document.querySelectorAll('.tab').forEach(function(b){ b.classList.toggle('active', b === rosterTab); });
    document.querySelectorAll('.panel').forEach(function(panel){ panel.classList.toggle('active', panel === rosterPanel); });
    document.body.dataset.activeTab = 'rosters';
    document.body.classList.add('v217-rosters-active','v218-rosters-active');
    return rosterPanel;
  }

  function renderLobbyAgain(){
    try {
      if (typeof window.__forceRosterTrophyLobby === 'function') {
        window.__forceRosterTrophyLobby(window.__exactLobbyDraft || {});
      } else if (typeof window.__renderExactTrophyLobby === 'function') {
        window.__renderExactTrophyLobby(window.__exactLobbyDraft || {});
      } else if (typeof window.renderDraftRosters === 'function') {
        window.renderDraftRosters(window.__exactLobbyDraft || {});
      }
    } catch(err) { console.warn('v226 Trophy Room lobby render failed:', err); }
  }

  function forceTrophyLobby(){
    suppressUntil = now() + 3200;
    var panel = activateRostersPanel();
    renderLobbyAgain();
    [80, 260, 700, 1300, 2300].forEach(function(delay){
      setTimeout(function(){
        if (now() <= suppressUntil) {
          activateRostersPanel();
          renderLobbyAgain();
        }
      }, delay);
    });
    setTimeout(function(){ if (panel) panel.scrollIntoView({behavior:'smooth', block:'start'}); }, 90);
  }

  var oldOpenRosterStall = window.openRosterStall;
  Object.defineProperty(window, 'openRosterStall', {
    configurable: true,
    get: function(){
      return function(ownerId){
        var staleBlocked = now() < suppressUntil && now() > allowOwnerOpenUntil;
        if (staleBlocked) return;
        suppressUntil = 0;
        if (typeof oldOpenRosterStall === 'function') return oldOpenRosterStall.apply(this, arguments);
      };
    },
    set: function(fn){
      oldOpenRosterStall = fn;
    }
  });

  window.openTrophyRoomLobby = forceTrophyLobby;

  document.addEventListener('click', function(e){
    if (!e.target || !e.target.closest) return;
    var trophyRequest = e.target.closest('[data-open-trophy-room], .home-image-hotspot-trophy[data-tab="rosters"], button.tab[data-tab="rosters"]');
    if (!trophyRequest) return;
    if (e.target.closest('[data-enter-door], [data-roster-owner], [data-walk-stall]')) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    forceTrophyLobby();
  }, true);
})();


(function(){
  function activateRostersPanel(){
    var rosterPanel = document.getElementById('rosters');
    var rosterTab = document.querySelector('button.tab[data-tab="rosters"]');
    document.querySelectorAll('.tab').forEach(function(b){ b.classList.toggle('active', b === rosterTab); });
    document.querySelectorAll('.panel').forEach(function(panel){ panel.classList.toggle('active', panel === rosterPanel); });
    document.body.dataset.activeTab = 'rosters';
    document.body.classList.add('v217-rosters-active','v218-rosters-active');
    return rosterPanel;
  }
  function hardOpenTrophyLobby(){
    window.__trophyRoomNavigationToken = (window.__trophyRoomNavigationToken || 0) + 1;
    var panel = activateRostersPanel();
    try {
      if (typeof window.__forceRosterTrophyLobby === 'function') {
        window.__forceRosterTrophyLobby(window.__exactLobbyDraft || {});
      } else if (typeof window.__renderExactTrophyLobby === 'function') {
        window.__renderExactTrophyLobby(window.__exactLobbyDraft || {});
      }
    } catch(err) { console.warn('v227 Trophy Room lobby open failed:', err); }
    [50, 180, 420, 900].forEach(function(delay){
      setTimeout(function(){
        try {
          activateRostersPanel();
          if (typeof window.__forceRosterTrophyLobby === 'function') window.__forceRosterTrophyLobby(window.__exactLobbyDraft || {});
          else if (typeof window.__renderExactTrophyLobby === 'function') window.__renderExactTrophyLobby(window.__exactLobbyDraft || {});
        } catch(err) {}
      }, delay);
    });
    setTimeout(function(){ if(panel) panel.scrollIntoView({behavior:'smooth', block:'start'}); }, 80);
  }
  window.openTrophyRoomLobby = hardOpenTrophyLobby;
  document.addEventListener('click', function(e){
    if (!e.target || !e.target.closest) return;
    var trophy = e.target.closest('[data-open-trophy-room], .home-image-hotspot-trophy, button.tab[data-tab="rosters"]');
    if (!trophy) return;
    if (e.target.closest('[data-enter-door], .straight-door-hotzone, [data-roster-owner], [data-walk-stall]')) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    hardOpenTrophyLobby();
  }, true);
})();


(function(){
  function isMobile(){ return window.matchMedia && window.matchMedia('(max-width: 820px)').matches; }
  function important(el, prop, value){ if(el && el.style) el.style.setProperty(prop, value, 'important'); }
  function fix(){
    if(!isMobile()) return;
    var host = document.getElementById('leaderboardTable');
    if(!host || !host.classList.contains('home-chalk-leaderboard-overlay')) return;
    host.querySelectorAll('.v182-standings-table th').forEach(function(el){
      important(el,'font-size','8.75px');
      important(el,'line-height','.98');
      important(el,'padding-top','0');
      important(el,'padding-bottom','2px');
      important(el,'letter-spacing','-.048em');
      important(el,'white-space','nowrap');
    });
    host.querySelectorAll('.v182-standings-table td').forEach(function(el){
      important(el,'font-size','10.85px');
      important(el,'line-height','1.02');
      important(el,'padding-top','2px');
      important(el,'padding-bottom','2px');
      important(el,'letter-spacing','-.05em');
      important(el,'white-space','nowrap');
    });
  }
  document.addEventListener('DOMContentLoaded', function(){ fix(); setTimeout(fix,80); setTimeout(fix,300); setTimeout(fix,900); setTimeout(fix,1800); setTimeout(fix,3600); });
  window.addEventListener('load', function(){ fix(); setTimeout(fix,250); setTimeout(fix,1000); setTimeout(fix,2500); });
  window.addEventListener('resize', fix, {passive:true});
  if(document.readyState !== 'loading') fix();
})();


(function(){
  function isMobile(){ return window.matchMedia && window.matchMedia('(max-width: 820px)').matches; }
  function important(el, prop, value){ if(el && el.style) el.style.setProperty(prop, value, 'important'); }
  function fix(){
    if(!isMobile()) return;
    var host = document.getElementById('leaderboardTable');
    if(!host || !host.classList.contains('home-chalk-leaderboard-overlay')) return;
    host.querySelectorAll('.v182-standings-table th').forEach(function(el){
      important(el,'font-size','9.35px');
      important(el,'line-height','.98');
      important(el,'padding-top','0');
      important(el,'padding-bottom','2px');
      important(el,'letter-spacing','-.05em');
      important(el,'white-space','nowrap');
    });
    host.querySelectorAll('.v182-standings-table td').forEach(function(el){
      important(el,'font-size','11.65px');
      important(el,'line-height','1.02');
      important(el,'padding-top','2px');
      important(el,'padding-bottom','2px');
      important(el,'letter-spacing','-.052em');
      important(el,'white-space','nowrap');
    });
  }
  document.addEventListener('DOMContentLoaded', function(){ fix(); setTimeout(fix,80); setTimeout(fix,350); setTimeout(fix,1200); });
  window.addEventListener('load', function(){ fix(); setTimeout(fix,250); setTimeout(fix,1500); });
  window.addEventListener('resize', fix, {passive:true});
  if(document.readyState !== 'loading') fix();
})();


(function(){
  'use strict';
  const TEST_KEY = 'custom-hockey-pool-test-history-seasons';
  const RESET_KEY = 'custom-hockey-pool-rosters-manually-cleared';
  const OWNERS = [
    {id:'nick', owner:'Nick', team:'Glizzy Disposal'},
    {id:'chris', owner:'Chris', team:'CeCe Hairless Horde'},
    {id:'andrew', owner:'Andrew', team:'Between The Pipes'},
    {id:'tyler', owner:'Tyler', team:'Puck Slut'},
    {id:'scott', owner:'Scott', team:'Scott'}
  ];
  function toast(message){ const t=document.getElementById('toast'); if(!t) return alert(message); t.textContent=message; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2800); }
  function readTests(){ try{ const v=JSON.parse(localStorage.getItem(TEST_KEY)||'[]'); return Array.isArray(v)?v:[]; }catch(e){ return []; } }
  function writeTests(items){ try{ localStorage.setItem(TEST_KEY, JSON.stringify(items)); }catch(e){} }
  function markReset(){ try{ localStorage.setItem(RESET_KEY,'true'); }catch(e){} }
  function yearTextFromId(id){ return String(id||'').replace(/^(\d{4})(\d{4})$/,'$1-$2'); }
  function nextSeasonId(){
    const base = ['20232024','20242025','20252026'];
    const tests = readTests().map(s=>String(s.id||''));
    let maxStart = 2025;
    base.concat(tests).forEach(id=>{ const m=String(id).match(/^(\d{4})(\d{4})$/); if(m) maxStart=Math.max(maxStart, Number(m[1])); });
    const start = maxStart + 1;
    return String(start) + String(start + 1);
  }
  function playerPts(player){
    const p = player || {};
    const explicit = Number(p.fantasyPoints ?? p.fpts);
    if (Number.isFinite(explicit) && explicit) return explicit;
    const pos = String(p.position || p.type || '').toUpperCase();
    if (pos === 'G' || pos === 'TG' || pos === 'GOALIE') {
      return (Number(p.goalieWins||0)*2) + (Number(p.goalieAssists||p.assists||0)*5) + (Number(p.goalieGoals||p.goals||0)*10) + (Number(p.goalieShutouts||0)*5);
    }
    return (Number(p.goals||0)*2) + Number(p.assists||0) + (Number(p.shortHandedGoals||p.shGoals||0)*5) + (Number(p.gameWinningGoals||p.gwGoals||0)*5);
  }
  async function loadDraft(){
    if (window.officialDraftApi && window.officialDraftApi.load) return await window.officialDraftApi.load();
    return window.__currentLiveDraft || {owners:OWNERS,picks:[]};
  }
  async function resetDraftToBlank(){
    markReset();
    let fresh = null;
    if (window.officialDraftApi && window.officialDraftApi.reset) fresh = await window.officialDraftApi.reset();
    else fresh = {owners:OWNERS.map(o=>({id:o.id,name:o.owner,teamName:o.owner})), draftOrder:OWNERS.map(o=>o.id), picks:[]};
    fresh.picks = [];
    fresh.draftClosed = false;
    fresh.__manualRosterReset = true;
    fresh.__rostersClearedAt = new Date().toISOString();
    delete fresh.__seasonLockedRecord;
    delete fresh.__fromStaticSeasonRecord;
    if (window.officialDraftApi && window.officialDraftApi.save) fresh = await window.officialDraftApi.save(fresh);
    window.__currentLiveDraft = fresh;
    if (window.renderDraftRosters) window.renderDraftRosters(fresh);
    if (window.renderDraftRoomLottery) window.renderDraftRoomLottery(fresh);
    if (window.v91DraftRoom && window.v91DraftRoom.refreshRoom) setTimeout(()=>window.v91DraftRoom.refreshRoom(), 50);
    return fresh;
  }
  async function endSeason(){
    const draft = await loadDraft();
    const picks = Array.isArray(draft && draft.picks) ? draft.picks : [];
    if (!picks.length) return toast('No drafted rosters found. Run the draft first.');
    const seasonId = nextSeasonId();
    const totals = {};
    OWNERS.forEach(o=>totals[o.id]={ownerId:o.id, team:o.team, pts:0});
    picks.forEach(p=>{
      const ownerId = String(p.ownerId||'').toLowerCase();
      if (!totals[ownerId]) totals[ownerId] = {ownerId, team:p.ownerName||ownerId, pts:0};
      totals[ownerId].pts += playerPts(p.player||{});
    });
    const standings = Object.values(totals).filter(r=>r.pts || picks.some(p=>String(p.ownerId).toLowerCase()===r.ownerId))
      .sort((a,b)=>b.pts-a.pts || String(a.team).localeCompare(String(b.team)))
      .map((r,i)=>({rank:i+1, ownerId:r.ownerId, team:r.team, pts:Math.round(r.pts)}));
    const record = {
      id: seasonId,
      label: yearTextFromId(seasonId) + ' Test Season',
      source: 'end-season-test-button',
      testSeason: true,
      savedAt: new Date().toISOString(),
      championOwnerId: standings[0] && standings[0].ownerId,
      standings
    };
    const tests = readTests().filter(s=>String(s.id)!==seasonId);
    tests.push(record);
    tests.sort((a,b)=>String(b.id).localeCompare(String(a.id)));
    writeTests(tests);
    if (window.refreshHockeyHistoryBook) window.refreshHockeyHistoryBook();
    await resetDraftToBlank();
    toast('Ended season: saved '+yearTextFromId(seasonId)+' to test history and reset draft.');
  }
  async function clearTestSeasons(){
    if (!confirm('Clear only fake/test seasons and reset the draft back to blank? Real 2023-2024, 2024-2025, and 2025-2026 history stays safe.')) return;
    try{ localStorage.removeItem(TEST_KEY); }catch(e){}
    if (window.refreshHockeyHistoryBook) window.refreshHockeyHistoryBook();
    await resetDraftToBlank();
    toast('Cleared test seasons. Real saved history is unchanged.');
  }
  function installButtons(){
    const host = document.querySelector('.admin-draft-actions') || document.querySelector('#cleanAutoDraftBtn')?.parentElement;
    if (!host || document.getElementById('endSeasonBtn')) return;
    const end = document.createElement('button');
    end.id = 'endSeasonBtn'; end.type = 'button'; end.className = 'primary v252-end-season-btn'; end.textContent = 'End Season';
    const clear = document.createElement('button');
    clear.id = 'clearTestSeasonsBtn'; clear.type = 'button'; clear.className = 'danger v252-clear-test-btn'; clear.textContent = 'Clear Test Seasons';
    host.appendChild(end); host.appendChild(clear);
  }
  document.addEventListener('click', function(e){
    const end = e.target.closest && e.target.closest('#endSeasonBtn');
    if (end){ e.preventDefault(); e.stopPropagation(); endSeason(); return; }
    const clear = e.target.closest && e.target.closest('#clearTestSeasonsBtn');
    if (clear){ e.preventDefault(); e.stopPropagation(); clearTestSeasons(); return; }
  }, true);
  window.addEventListener('load', ()=>setTimeout(installButtons, 350));
  window.endHockeyPoolSeasonForTest = endSeason;
  window.clearHockeyPoolTestSeasons = clearTestSeasons;
})();


(function(){
  'use strict';
  const RESET_KEY = 'custom-hockey-pool-rosters-manually-cleared';
  const OWNERS = [
    { id:'nick', ownerName:'Nick', teamName:'Glizzy Disposal' },
    { id:'chris', ownerName:'Chris', teamName:'CeCe Hairless Horde' },
    { id:'andrew', ownerName:'Andrew', teamName:'Between The Pipes' },
    { id:'tyler', ownerName:'Tyler', teamName:'Puck Slut' },
    { id:'scott', ownerName:'Scott', teamName:'Scott' }
  ];
  function esc(value){ return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function num(value){ const n=Number(value); return Number.isFinite(n) ? n : 0; }
  function fp(player){
    const p = player || {};
    for (const key of ['fpts','fantasyPoints','pts','points']) {
      if (p[key] !== undefined && p[key] !== null && p[key] !== '') {
        const n = Number(p[key]);
        if (Number.isFinite(n)) return n;
      }
    }
    const pos = String(p.position || p.type || '').toUpperCase();
    if (pos === 'G' || pos === 'TG' || pos === 'GOALIE') {
      return (num(p.goalieWins || p.wins) * 2) + (num(p.goalieAssists || p.assists) * 5) + (num(p.goalieGoals || p.goals) * 10) + (num(p.goalieShutouts || p.shutouts) * 5);
    }
    return (num(p.goals) * 2) + num(p.assists) + (num(p.shortHandedGoals || p.shg) * 5) + (num(p.gameWinningGoals || p.gwg) * 5);
  }
  function isGoalie(player){
    const p = player || {};
    const pos = String(p.position || p.type || '').toUpperCase();
    return pos === 'G' || pos === 'TG' || pos === 'GOALIE' || String(p.name || '').toLowerCase().includes('goalie');
  }
  function shortName(name){
    const s=String(name||'').trim();
    if(!s || s.toUpperCase()==='TBA') return 'TBA';
    const parts=s.split(/\s+/);
    return parts.length<=2 ? s : parts[0]+' '+parts[parts.length-1];
  }
  function resetFlag(){
    try { if (localStorage.getItem(RESET_KEY) === 'true') return true; } catch(e) {}
    const d = window.__currentLiveDraft;
    return !!(d && d.__manualRosterReset && (!Array.isArray(d.picks) || d.picks.length === 0));
  }
  function currentDraft(){ return window.__currentLiveDraft || null; }
  function hasRealDraftPicks(){
    const d = currentDraft();
    return !!(d && Array.isArray(d.picks) && d.picks.length > 0 && !d.__fromStaticSeasonRecord && !d.__seasonLockedRecord);
  }
  function shouldUseLiveOrBlank(){ return resetFlag() || hasRealDraftPicks(); }
  function ownerLabel(owner){ return owner.ownerName || owner.name || owner.teamName || owner.id; }
  function teamLabel(owner){ return owner.teamName || owner.team || ownerLabel(owner); }
  function playerRow(player, goalie){
    if (!player || String(player.name || '').toUpperCase() === 'TBA') {
      return { name:'TBA', fpts:0, position: goalie ? 'G' : 'F', type: goalie ? 'goalie' : 'skater', goals:0, assists:0, shortHandedGoals:0, gameWinningGoals:0 };
    }
    const fixed = Object.assign({}, player);
    if (!String(fixed.name || '').trim() && isGoalie(fixed)) fixed.name = (fixed.nhlTeam || fixed.team || 'NHL') + ' Team Goalies';
    if (!String(fixed.name || '').trim()) fixed.name = 'Drafted Player';
    fixed.fpts = fp(fixed);
    return fixed;
  }
  function blankPlayers(){
    const skaters = Array.from({length:10}, () => playerRow(null, false));
    const goalies = Array.from({length:2}, () => playerRow(null, true));
    return skaters.concat(goalies);
  }
  function buildRowsFromDraft(){
    const draft = currentDraft();
    const ownerDefs = (draft && Array.isArray(draft.owners) && draft.owners.length ? draft.owners : OWNERS).map(o => {
      const id = String(o.id || '').toLowerCase();
      const meta = OWNERS.find(x => x.id === id) || {};
      return { id, ownerName: meta.ownerName || o.name || o.teamName || id, teamName: meta.teamName || o.teamName || o.name || id };
    });
    const grouped = new Map(ownerDefs.map(o => [o.id, []]));
    if (draft && Array.isArray(draft.picks)) {
      draft.picks.forEach(pick => {
        const ownerId = String(pick.ownerId || '').toLowerCase();
        if (!grouped.has(ownerId)) grouped.set(ownerId, []);
        if (pick.player) grouped.get(ownerId).push(playerRow(pick.player, isGoalie(pick.player)));
      });
    }
    return ownerDefs.map(owner => {
      const rawPlayers = grouped.get(owner.id) || [];
      const skaters = rawPlayers.filter(p => !isGoalie(p)).slice(0, 10);
      const goalies = rawPlayers.filter(isGoalie).slice(0, 2);
      while (skaters.length < 10) skaters.push(playerRow(null, false));
      while (goalies.length < 2) goalies.push(playerRow(null, true));
      const players = skaters.concat(goalies);
      return {
        ownerId: owner.id,
        ownerName: owner.ownerName,
        teamName: owner.teamName,
        total: Math.round(players.reduce((sum,p)=>sum+fp(p),0)),
        players
      };
    });
  }
  function totals(row){
    const players = Array.isArray(row.players) ? row.players : [];
    return {
      goals: players.reduce((s,p)=>s+num(p.goals),0),
      assists: players.reduce((s,p)=>s+num(p.assists),0),
      shg: players.reduce((s,p)=>s+num(p.shortHandedGoals||p.shg),0),
      gwg: players.reduce((s,p)=>s+num(p.gameWinningGoals||p.gwg),0)
    };
  }
  function renderStandings(rows){
    return '<section class="v182-standings"><table class="v182-standings-table" aria-label="Pool standings"><thead><tr><th>Team</th><th>FPTS</th><th>G</th><th>A</th><th>SHG</th><th>GWG</th></tr></thead><tbody>' +
      rows.map(row => { const t=totals(row); return '<tr><td>'+esc(row.ownerName)+'</td><td>'+num(row.total)+'</td><td>'+t.goals+'</td><td>'+t.assists+'</td><td>'+t.shg+'</td><td>'+t.gwg+'</td></tr>'; }).join('') +
      '</tbody></table></section>';
  }
  function renderV182Card(row){
    const players = Array.isArray(row.players) ? row.players : blankPlayers();
    const skaters = players.filter(p => !isGoalie(p)).slice(0,10);
    const goalies = players.filter(isGoalie).slice(0,2);
    const line = p => '<div class="v182-player-row'+(String(p.name).toUpperCase()==='TBA'?' v253-tba-row':'')+'"><span>'+esc(shortName(p.name))+'</span><span>'+num(fp(p))+'</span></div>';
    return '<article class="v182-roster-card"><h3 class="v182-owner-name">'+esc(row.ownerName)+'</h3><div class="v182-roster-head"><span>Player Name</span><span>FPTS</span></div>'+skaters.map(line).join('')+'<div class="v182-goalie-break">'+goalies.map(line).join('')+'</div></article>';
  }
  function renderV182Rosters(rows){
    const order=['nick','chris','andrew','tyler','scott'];
    const byId=new Map(rows.map(r=>[r.ownerId,r]));
    const ordered=order.map(id=>byId.get(id)).filter(Boolean);
    rows.forEach(r=>{ if(!ordered.includes(r)) ordered.push(r); });
    return '<section class="v182-rosters"><div class="v182-roster-grid">'+ordered.slice(0,5).map(renderV182Card).join('')+'</div></section>';
  }
  function renderHomeFromRows(){
    if (!shouldUseLiveOrBlank()) return false;
    const host = document.getElementById('leaderboardTable');
    if (!host || !host.classList.contains('home-chalk-leaderboard-overlay')) return false;
    const rows = buildRowsFromDraft().sort((a,b)=>num(b.total)-num(a.total) || String(a.ownerName).localeCompare(String(b.ownerName)));
    window.__lastSeasonApiDiagnostics = { rows: rows.map(r => Object.assign({}, r, { players: r.players.map(p=>Object.assign({}, p)) })), source:'live-draft-or-blank-reset-v253' };
    host.innerHTML = '<div class="v182-chalk-layout">'+renderStandings(rows)+renderV182Rosters(rows)+'</div>';
    if (window.__v243BuildMobileHomeRosterChart) setTimeout(window.__v243BuildMobileHomeRosterChart, 0);
    return true;
  }
  function maybeRender(){
    if (renderHomeFromRows()) {
      setTimeout(renderHomeFromRows,80);
      setTimeout(function(){ if(window.__v243BuildMobileHomeRosterChart) window.__v243BuildMobileHomeRosterChart(); },160);
    }
  }
  const oldRender = window.renderV182HomeChalkboard;
  window.renderV182HomeChalkboard = function(){
    if (renderHomeFromRows()) return true;
    return typeof oldRender === 'function' ? oldRender.apply(this, arguments) : false;
  };
  window.__v253RenderBlankOrLiveHomeRosters = maybeRender;
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(maybeRender,350); setTimeout(maybeRender,1200); });
  window.addEventListener('load', function(){ setTimeout(maybeRender,350); setTimeout(maybeRender,1400); setTimeout(maybeRender,3200); });
  document.addEventListener('click', function(e){
    if (e.target.closest && e.target.closest('#cleanResetDraftBtn,#resetDraftBtn,#resetSharedDraftBtn,#resetLiveDraftBtn,#endSeasonBtn,#clearTestSeasonsBtn')) {
      setTimeout(maybeRender,250); setTimeout(maybeRender,900); setTimeout(maybeRender,1800);
    }
  }, true);
})();


(function(){
  'use strict';
  const RESET_KEY = 'custom-hockey-pool-rosters-manually-cleared';
  function markReset(){ try{ localStorage.setItem(RESET_KEY,'true'); }catch(e){} }
  function rerender(){ if (window.__v253RenderBlankOrLiveHomeRosters) window.__v253RenderBlankOrLiveHomeRosters(); }
  const oldEnd = window.endHockeyPoolSeasonForTest;
  if (typeof oldEnd === 'function') {
    window.endHockeyPoolSeasonForTest = async function(){
      const result = await oldEnd.apply(this, arguments);
      markReset();
      setTimeout(rerender, 120); setTimeout(rerender, 700); setTimeout(rerender, 1600);
      return result;
    };
  }
  const oldClear = window.clearHockeyPoolTestSeasons;
  if (typeof oldClear === 'function') {
    window.clearHockeyPoolTestSeasons = async function(){
      const result = await oldClear.apply(this, arguments);
      markReset();
      setTimeout(rerender, 120); setTimeout(rerender, 700); setTimeout(rerender, 1600);
      return result;
    };
  }
})();


(function(){
  'use strict';
  const RESET_KEY = 'custom-hockey-pool-rosters-manually-cleared';
  const DRAFT_BACKUP_KEY = 'custom-hockey-pool-v40-clean-live-draft';
  const OLD_APP_STATE_KEY = 'custom-hockey-pool-v30-last-year-rosters';
  const TEST_SEASON_KEY = 'hockey-pool-test-seasons-v1';

  function status(msg){ try{ if (typeof toast === 'function') toast(msg); }catch(e){} }

  async function reloadLiveDraftToHome(){
    if (window.__v255SyncDraftToHomeRosters) { try { await window.__v255SyncDraftToHomeRosters(); } catch(e){} }
    if (window.__v253RenderBlankOrLiveHomeRosters) {
      try { window.__v253RenderBlankOrLiveHomeRosters(); } catch(e){}
      setTimeout(function(){ try { window.__v253RenderBlankOrLiveHomeRosters(); } catch(e){} }, 120);
      setTimeout(function(){ try { window.__v253RenderBlankOrLiveHomeRosters(); } catch(e){} }, 650);
    }
    if (window.__v243BuildMobileHomeRosterChart) {
      setTimeout(function(){ try { window.__v243BuildMobileHomeRosterChart(); } catch(e){} }, 180);
      setTimeout(function(){ try { window.__v243BuildMobileHomeRosterChart(); } catch(e){} }, 780);
    }
  }

  async function clearRosterDisplayCache(){
    let hadLivePicks = false;
    try {
      const res = await fetch('/api/draft?t=' + Date.now(), { cache:'no-store' });
      const data = await res.json().catch(function(){ return {}; });
      hadLivePicks = !!(data && data.draft && Array.isArray(data.draft.picks) && data.draft.picks.length);
      if (hadLivePicks) {
        window.__currentLiveDraft = data.draft;
        try { localStorage.removeItem(RESET_KEY); } catch(e){}
      }
    } catch(e) {}

    // Remove only stale display/cache states that can flash the old static 2025-2026 roster.
    // Do not remove the permanent history JSON and do not remove test-season history.
    try { localStorage.removeItem(OLD_APP_STATE_KEY); } catch(e){}
    try { localStorage.removeItem(DRAFT_BACKUP_KEY); } catch(e){}
    if (!hadLivePicks) { try { localStorage.setItem(RESET_KEY, 'true'); } catch(e){} }

    await reloadLiveDraftToHome();
    status(hadLivePicks ? 'Roster display cache cleared. Showing live drafted rosters.' : 'Roster display cache cleared. No live picks found, so rosters show TBA.');
  }

  function installButton(){
    const host = document.querySelector('.admin-draft-actions') || document.querySelector('#cleanAutoDraftBtn')?.parentElement;
    if (!host || document.getElementById('clearRosterDisplayCacheBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'clearRosterDisplayCacheBtn';
    btn.type = 'button';
    btn.className = 'warning';
    btn.textContent = 'Clear Roster Cache';
    btn.title = 'Clears stale roster display cache only. It does not delete saved history.';
    host.appendChild(btn);
  }

  document.addEventListener('click', function(e){
    const btn = e.target && e.target.closest && e.target.closest('#clearRosterDisplayCacheBtn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    clearRosterDisplayCache();
  }, true);

  document.addEventListener('DOMContentLoaded', function(){ installButton(); setTimeout(installButton, 500); });
  window.addEventListener('load', function(){ installButton(); setTimeout(installButton, 900); setTimeout(reloadLiveDraftToHome, 1100); });

  window.__v256ClearRosterDisplayCache = clearRosterDisplayCache;
})();


(function(){
  function syncRosterActive(){
    var rosters = document.getElementById('rosters');
    var active = !!(rosters && rosters.classList.contains('active'));
    document.body.classList.toggle('v217-rosters-active', active);
    if (active) document.body.dataset.activeTab = 'rosters';
  }

  function addBottomNav(){
    var shell = document.querySelector('#rosterCards .straight-lobby-shell');
    if (!shell || shell.querySelector('.trophy-lobby-bottom-nav')) return;
    var nav = document.createElement('nav');
    nav.className = 'trophy-lobby-bottom-nav';
    nav.setAttribute('aria-label', 'Trophy room bottom navigation');
    nav.innerHTML = '<button class="trophy-lobby-bottom-link" type="button" data-tab="previousSeason">Previous Season</button>' +
      '<button class="trophy-lobby-bottom-link" type="button" data-tab="teams">Teams</button>' +
      '<button class="trophy-lobby-bottom-link" type="button" data-tab="rules">Rules</button>' +
      '<button class="trophy-lobby-bottom-link" type="button" data-tab="admin">Admin</button>';
    shell.appendChild(nav);
  }

  function patchImageVersion(){
    document.querySelectorAll('#rosterCards .straight-lobby-scene').forEach(function(img){
      img.src = 'assets/images/trophy-room-lobby-reference.png?v=217';
    });
  }

  function refresh(){ syncRosterActive(); addBottomNav(); patchImageVersion(); }
  document.addEventListener('DOMContentLoaded', function(){
    refresh();
    var rosters = document.getElementById('rosters');
    if (rosters) new MutationObserver(refresh).observe(rosters, {attributes:true, attributeFilter:['class']});
    var cards = document.getElementById('rosterCards');
    if (cards) new MutationObserver(refresh).observe(cards, {childList:true, subtree:true});
  });
  document.addEventListener('click', function(e){
    if (e.target.closest && e.target.closest('[data-tab]')) setTimeout(refresh, 40);
  }, true);
  window.addEventListener('load', function(){ setTimeout(refresh, 180); setTimeout(refresh, 650); });
})();


(function(){
  const seasons = {
    '20242025': {
      title:'2024-2025 Ricoh Abandon Pool', champion:'CeCe Hairless Horde',
      standings:[['1','CeCe Hairless Horde','1,380'],['2','Glizzy Disposal','1,301'],['3','Between The Pipes','1,172'],['4','Puck Slut','1,163']],
      teams:[
        {name:'CeCe Hairless Horde', total:'1,380', skaters:'MacKinnon 173; Draisaitl 213; Kaprizov 106; Crosby 174; Nylander 169; Tkachuk M 89; Fox 81; Morrissey 86; Dahlin 90; Karlsson 69.', goalies:'Oettinger 87; DeSmith 43.'},
        {name:'Glizzy Disposal', total:'1,301', skaters:'Rantanen 150; Hughes J 132; Marner 164; Robertson 145; Aho 148; Bedard 115; Makar 142; Bouchard 91; Heiskanen 30; Rielly 58.', goalies:'Quick 42; Shesterkin 84.'},
        {name:'Between The Pipes', total:'1,172', skaters:'McDavid 141; Kucherov 203; Reinhart 140; Pettersson 65; Thomas 127; Michkov 104; Josi 52; Dobson 54; Werenski 130; McAvoy 40.', goalies:'Skinner 67; Pickard 49.'},
        {name:'Puck Slut', total:'1,163', skaters:'Matthews 121; Pastrnak 169; Miller 102; Panarin 141; Forsberg 122; Stamkos 110; Hughes Q 107; Hedman 80; Seider 54; Skjei 54.', goalies:'Saros 65; Wedgewood 38.'}
      ]
    },
    '20232024': {
      title:'2023-2024 Legend Of Ricoh', champion:'CeCe Hairless Horde',
      standings:[['1','CeCe Hairless Horde','1,515'],['2','Glizzy Disposal','1,418'],['3','Between The Pipes','1,265'],['4','Puck Slut','1,249'],['5','Senile Cely','1,143']],
      teams:[
        {name:'CeCe Hairless Horde', total:'1,515', skaters:'MacKinnon 236; Kucherov 218; Tkachuk B 121; Tkachuk M 124; Kaprizov 182; Hintz 125; Makar 116; Karlsson 87; Josi 133; Carlson 87.', goalies:'Georgiev 86; Francouz 0.'},
        {name:'Glizzy Disposal', total:'1,418', skaters:'McDavid 189; Crosby 151; Nylander 173; Stutzle 98; Eichel 134; Aho 175; Fox 115; Seider 51; Bouchard 135; Jones 59.', goalies:'Quick 46; Shesterkin 92.'},
        {name:'Between The Pipes', total:'1,265', skaters:'Matthews 216; Thompson 100; Rantanen 191; Verhaeghe 141; Ovechkin 121; Stamkos 151; Dahlin 89; Morrissey 84; Montour 56; Toews 72.', goalies:'Vanecek 34; Schmid 10.'},
        {name:'Puck Slut', total:'1,249', skaters:'Draisaitl 182; Hughes J 121; Pettersson 173; Robertson 129; Hischier 114; Tavares 124; Hughes Q 119; Hamilton 21; Heiskanen 73; McAvoy 74.', goalies:'Ullmark 54; Swayman 65.'},
        {name:'Senile Cely', total:'1,143', skaters:'Pastrnak 182; Marner 121; Bedard 93; Point 196; Zibanejad 113; Panarin 194; Dunn 57; Sergachev 21; Barrie 16; Pietrangelo 47.', goalies:'Sorokin 60; Varlamov 43.'}
      ]
    }
  };
  function esc(s){return String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function renderStaticSeason(key){
    const s=seasons[key]; const target=document.getElementById('previousSeasonTable'); const status=document.getElementById('previousSeasonStatus');
    if(!s||!target) return false;
    if(status) status.textContent='Source: saved history file';
    target.innerHTML='<div class="v220-prev-archive"><div class="season-arena-banner"><div class="season-arena-logo">🏆</div><div><strong>'+esc(s.title)+'</strong><span>Champion: '+esc(s.champion)+'. Saved historical season record.</span></div><div class="season-arena-pill">Archive</div></div>'+ 
      '<table><thead><tr><th>Rank</th><th>Team</th><th>FPTS</th></tr></thead><tbody>'+s.standings.map(r=>'<tr><td>'+esc(r[0])+'</td><td>'+esc(r[1])+'</td><td>'+esc(r[2])+'</td></tr>').join('')+'</tbody></table>'+ 
      '<div class="v220-history-team-grid">'+s.teams.map(t=>'<article class="v220-history-team-card"><h3>'+esc(t.name)+'</h3><p><b>Total:</b> '+esc(t.total)+' pts</p><p><b>Skaters:</b> '+esc(t.skaters)+'</p><p><b>Goalies:</b> '+esc(t.goalies)+'</p></article>').join('')+'</div></div>';
    return true;
  }
  function upgradePicker(){
    const table=document.getElementById('previousSeasonTable'); if(!table) return;
    let picker=document.getElementById('previousSeasonPicker');
    if(!picker){ picker=document.createElement('div'); picker.id='previousSeasonPicker'; picker.className='season-prev-picker'; table.parentNode.insertBefore(picker,table); }
    picker.innerHTML='<label for="previousSeasonSelect">Season</label><select id="previousSeasonSelect"><option value="">Select a season…</option><option value="20252026">2025-2026 Regular Season</option><option value="20242025">2024-2025 Ricoh Abandon Pool</option><option value="20232024">2023-2024 Legend Of Ricoh</option></select>';
    const head=document.querySelector('.previous-season-card .section-head div');
    if(head){ const h=head.querySelector('h2'); if(h) h.textContent='Previous Season Archive'; const p=head.querySelector('p'); if(p) p.textContent='Choose a saved season to view standings and roster breakdowns.'; }
  }
  document.addEventListener('change',function(e){
    if(e.target && e.target.id==='previousSeasonSelect' && seasons[e.target.value]){
      e.preventDefault(); e.stopImmediatePropagation(); renderStaticSeason(e.target.value);
    }
  },true);
  window.addEventListener('load',function(){
    setTimeout(upgradePicker,1800); setTimeout(upgradePicker,2600); setTimeout(upgradePicker,4200);
  });
  document.addEventListener('click',function(e){
    // If a later script re-renders the picker, restore our extra saved seasons shortly after tab clicks/refreshes.
    if(e.target && (e.target.closest('[data-tab="previousSeason"]') || e.target.closest('#refreshPreviousSeasonBtn'))){ setTimeout(upgradePicker,250); setTimeout(upgradePicker,900); }
  },true);
})();


(function(){
  function activateRostersPanel(){
    var rosterPanel = document.getElementById('rosters');
    var rosterTab = document.querySelector('button.tab[data-tab="rosters"]');
    document.querySelectorAll('.tab').forEach(function(b){ b.classList.toggle('active', b === rosterTab); });
    document.querySelectorAll('.panel').forEach(function(panel){ panel.classList.toggle('active', panel === rosterPanel); });
    document.body.dataset.activeTab = 'rosters';
    document.body.classList.add('v217-rosters-active','v218-rosters-active');
    return rosterPanel;
  }
  function hardOpenTrophyLobby(){
    window.__trophyRoomNavigationToken = (window.__trophyRoomNavigationToken || 0) + 1;
    var panel = activateRostersPanel();
    try {
      if (typeof window.__forceRosterTrophyLobby === 'function') window.__forceRosterTrophyLobby(window.__exactLobbyDraft || {});
      else if (typeof window.__renderExactTrophyLobby === 'function') window.__renderExactTrophyLobby(window.__exactLobbyDraft || {});
    } catch(err) { console.warn('v227 final Trophy Room lobby open failed:', err); }
    [40, 160, 360, 760, 1400].forEach(function(delay){
      setTimeout(function(){
        try {
          activateRostersPanel();
          if (typeof window.__forceRosterTrophyLobby === 'function') window.__forceRosterTrophyLobby(window.__exactLobbyDraft || {});
          else if (typeof window.__renderExactTrophyLobby === 'function') window.__renderExactTrophyLobby(window.__exactLobbyDraft || {});
        } catch(err) {}
      }, delay);
    });
    setTimeout(function(){ if(panel) panel.scrollIntoView({behavior:'smooth', block:'start'}); }, 80);
  }
  window.openTrophyRoomLobby = hardOpenTrophyLobby;
  document.addEventListener('click', function(e){
    if (!e.target || !e.target.closest) return;
    var trophy = e.target.closest('[data-open-trophy-room], .home-image-hotspot-trophy, button.tab[data-tab="rosters"]');
    if (!trophy) return;
    if (e.target.closest('[data-enter-door], .straight-door-hotzone, [data-roster-owner], [data-walk-stall]')) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    hardOpenTrophyLobby();
  }, true);
})();


(function(){
  function isMobile(){ return window.matchMedia && window.matchMedia('(max-width: 820px)').matches; }
  function esc(value){ return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]; }); }
  function num(value){ var n = Number(value); return Number.isFinite(n) ? n : 0; }
  function shortName(name){
    var s = String(name || '').trim();
    if (!s) return '';
    var parts = s.split(/\s+/);
    return parts.length <= 2 ? s : parts[0] + ' ' + parts[parts.length - 1];
  }
  function isGoalie(player){ return player && (player.type === 'goalie' || player.position === 'G'); }
  function orderedRows(rows){
    var order = ['nick','chris','andrew','tyler','scott','ricoh'];
    var byId = new Map(rows.map(function(row){ return [row.ownerId, row]; }));
    var out = order.map(function(id){ return byId.get(id); }).filter(Boolean);
    rows.forEach(function(row){ if (out.indexOf(row) === -1) out.push(row); });
    return out;
  }
  function playerLine(player){
    var name = player && player.name ? player.name : '';
    if (!name && isGoalie(player)) name = (player.nhlTeam || player.team || 'NHL') + ' Team Goalies';
    if (!name) name = 'TBA';
    var pts = player && (player.fpts ?? player.fantasyPoints ?? player.pts ?? player.points);
    return '<div class="v243-player-row"><span class="v243-player-name">' + esc(shortName(name)) + '</span><span class="v243-player-fpts">' + num(pts) + '</span></div>';
  }
  function card(row){
    var players = Array.isArray(row.players) ? row.players.slice() : [];
    var skaters = players.filter(function(p){ return !isGoalie(p); }).slice(0, 10);
    var goalies = players.filter(isGoalie).slice(0, 2);
    return '<article class="v243-roster-card">' +
      '<h3 class="v243-owner-name">' + esc(row.ownerName) + '</h3>' +
      '<div class="v243-roster-head"><span class="v243-player-name">Player</span><span class="v243-player-fpts">FPTS</span></div>' +
      skaters.map(playerLine).join('') +
      '<div class="v243-goalie-break">' + goalies.map(playerLine).join('') + '</div>' +
      '</article>';
  }
  function build(){
    if (!isMobile()) return;
    var host = document.getElementById('leaderboardTable');
    if (!host || !host.classList.contains('home-chalk-leaderboard-overlay')) return;
    var layout = host.querySelector('.v182-chalk-layout');
    if (!layout) return;
    var diag = window.__lastSeasonApiDiagnostics;
    if (!diag || !Array.isArray(diag.rows) || !diag.rows.length) return;
    var rows = orderedRows(diag.rows).slice(0, 5);
    var signature = rows.map(function(r){ return r.ownerId + ':' + num(r.total) + ':' + (Array.isArray(r.players) ? r.players.map(function(p){ return [p.id,p.name,p.nhlTeam,p.fpts,p.fantasyPoints].join('~'); }).join(',') : ''); }).join('|');
    var existing = layout.querySelector('.v243-mobile-rosters');
    if (existing && existing.getAttribute('data-signature') === signature) return;
    if (existing) existing.remove();
    var section = document.createElement('section');
    section.className = 'v243-mobile-rosters';
    section.setAttribute('data-signature', signature);
    section.innerHTML = '<div class="v243-roster-title">Rosters</div><div class="v243-roster-grid">' + rows.map(card).join('') + '</div>';
    layout.appendChild(section);
  }
  function schedule(){ build(); setTimeout(build, 120); setTimeout(build, 550); setTimeout(build, 1400); }
  window.__v243BuildMobileHomeRosterChart = build;
  document.addEventListener('DOMContentLoaded', schedule);
  window.addEventListener('load', schedule);
  window.addEventListener('resize', schedule, {passive:true});
  document.addEventListener('click', function(){ setTimeout(build, 120); }, true);
  new MutationObserver(function(){ requestAnimationFrame(build); }).observe(document.documentElement, {childList:true, subtree:true});
})();


(function(){
  function isMobile(){ return window.matchMedia && window.matchMedia('(max-width: 820px)').matches; }
  function important(el, prop, value){ if(el && el.style) el.style.setProperty(prop, value, 'important'); }
  function fix(){
    if(!isMobile()) return;
    var host = document.getElementById('leaderboardTable');
    if(!host || !host.classList.contains('home-chalk-leaderboard-overlay')) return;
    host.querySelectorAll('.v182-standings-table th').forEach(function(el){
      important(el,'font-size','10.15px');
      important(el,'line-height','1.02');
      important(el,'padding-top','0');
      important(el,'padding-bottom','2.2px');
      important(el,'letter-spacing','-.05em');
      important(el,'white-space','nowrap');
    });
    host.querySelectorAll('.v182-standings-table td').forEach(function(el){
      important(el,'font-size','12.95px');
      important(el,'line-height','1.05');
      important(el,'padding-top','2.25px');
      important(el,'padding-bottom','2.25px');
      important(el,'letter-spacing','-.054em');
      important(el,'white-space','nowrap');
    });
  }
  document.addEventListener('DOMContentLoaded', function(){ fix(); setTimeout(fix,80); setTimeout(fix,350); setTimeout(fix,1200); });
  window.addEventListener('load', function(){ fix(); setTimeout(fix,250); setTimeout(fix,1500); });
  window.addEventListener('resize', fix, {passive:true});
  if(document.readyState !== 'loading') fix();
})();


(function(){
  'use strict';
  const RESET_KEY = 'custom-hockey-pool-rosters-manually-cleared';
  const API_URL = '/api/draft';
  let lastSignature = '';

  function hasLivePicks(draft){
    return !!(draft && Array.isArray(draft.picks) && draft.picks.length > 0 && !draft.__fromStaticSeasonRecord && !draft.__seasonLockedRecord);
  }
  function clearResetFlag(){
    try { localStorage.removeItem(RESET_KEY); } catch(e) {}
  }
  function signature(draft){
    if (!draft || !Array.isArray(draft.picks)) return 'empty';
    return String(draft.updatedAt || '') + '|' + draft.picks.length + '|' + draft.picks.map(function(p){
      return [p.pickNumber,p.ownerId,p.player && p.player.id,p.player && p.player.name,p.player && (p.player.fantasyPoints ?? p.player.fpts ?? p.player.points)].join(':');
    }).join('|');
  }
  function publishDraft(draft){
    if (!draft || !Array.isArray(draft.picks)) return false;
    if (hasLivePicks(draft)) {
      clearResetFlag();
      draft.__manualRosterReset = false;
      delete draft.__rostersClearedAt;
    }
    window.__currentLiveDraft = draft;
    lastSignature = signature(draft);
    if (typeof window.renderDraftRosters === 'function') {
      try { window.renderDraftRosters(draft); } catch(e) {}
    }
    if (window.liveLottery && typeof window.liveLottery.renderLiveDraftTicker === 'function') {
      try { window.liveLottery.renderLiveDraftTicker(draft, true); } catch(e) {}
    }
    if (typeof window.__v253RenderBlankOrLiveHomeRosters === 'function') {
      try { window.__v253RenderBlankOrLiveHomeRosters(); } catch(e) {}
      setTimeout(function(){ try { window.__v253RenderBlankOrLiveHomeRosters(); } catch(e) {} }, 120);
      setTimeout(function(){ try { window.__v253RenderBlankOrLiveHomeRosters(); } catch(e) {} }, 550);
    }
    if (typeof window.__v243BuildMobileHomeRosterChart === 'function') {
      setTimeout(function(){ try { window.__v243BuildMobileHomeRosterChart(); } catch(e) {} }, 180);
      setTimeout(function(){ try { window.__v243BuildMobileHomeRosterChart(); } catch(e) {} }, 700);
    }
    return true;
  }
  async function syncFromApi(force){
    try {
      const res = await fetch(API_URL + '?t=' + Date.now(), { cache:'no-store' });
      const data = await res.json().catch(function(){ return {}; });
      const draft = data && data.draft;
      if (!draft || !Array.isArray(draft.picks)) return;
      const sig = signature(draft);
      if (force || sig !== lastSignature || hasLivePicks(draft)) publishDraft(draft);
    } catch(e) {}
  }

  function hookOfficialDraftApi(){
    if (!window.officialDraftApi || window.officialDraftApi.__v255Hooked) return;
    const api = window.officialDraftApi;
    const oldLoad = api.load;
    const oldSave = api.save;
    const oldReset = api.reset;
    if (typeof oldLoad === 'function') {
      api.load = async function(){
        const draft = await oldLoad.apply(this, arguments);
        publishDraft(draft);
        return draft;
      };
    }
    if (typeof oldSave === 'function') {
      api.save = async function(draft){
        if (hasLivePicks(draft)) clearResetFlag();
        const saved = await oldSave.apply(this, arguments);
        publishDraft(saved || draft);
        return saved;
      };
    }
    if (typeof oldReset === 'function') {
      api.reset = async function(){
        const fresh = await oldReset.apply(this, arguments);
        publishDraft(fresh);
        return fresh;
      };
    }
    api.__v255Hooked = true;
  }

  function install(){
    hookOfficialDraftApi();
    publishDraft(window.__currentLiveDraft);
    setTimeout(function(){ syncFromApi(true); }, 300);
    setTimeout(function(){ syncFromApi(true); }, 1200);
    setTimeout(function(){ syncFromApi(true); }, 2800);
  }

  document.addEventListener('click', function(e){
    if (e.target && e.target.closest && e.target.closest('#cleanAutoDraftBtn,[data-clean-sign],#resetLiveDraftBtn,#resetDraftBtn,#adminResetDraftBtn,#endSeasonBtn,#clearTestSeasonsBtn')) {
      setTimeout(hookOfficialDraftApi, 0);
      setTimeout(function(){ syncFromApi(true); }, 250);
      setTimeout(function(){ syncFromApi(true); }, 950);
      setTimeout(function(){ syncFromApi(true); }, 2200);
    }
  }, true);

  document.addEventListener('DOMContentLoaded', install);
  window.addEventListener('load', install);
  setInterval(function(){ hookOfficialDraftApi(); syncFromApi(false); }, 2500);

  window.__v255SyncDraftToHomeRosters = function(){ return syncFromApi(true); };
})();
