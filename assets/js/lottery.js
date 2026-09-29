
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
      let playingSession = "";
      let pollTimer = null;
      let lastLiveTickerSignature = "";

      let tickerOffset = 0;
      let tickerLastTime = 0;
      let tickerAnimationId = 0;
      let resultsTickerSignature = "";
      let lastObservedPickCount = null;
      window.__v127ResultsTicker = window.__v127ResultsTicker || {
        cards: [],
        index: 0,
        intervalId: 0,
        lastRenderedKey: "",
        started: false,
        takeoverActive: false,
        takeoverQueue: [],
        takeoverTimer: 0
      };
      // V262: keep these fields available when upgrading from an older in-memory ticker object.
      window.__v127ResultsTicker.takeoverActive = false;
      window.__v127ResultsTicker.takeoverQueue = [];
      window.__v127ResultsTicker.takeoverTimer = 0;
      let skipLotteryReveal = false;

      function startSportsTicker(){
        // V120: ticker movement is pure CSS on brand-new containers.
      }

      function ownerName(id){
        const o = OWNERS.find(x => x.id === id);
        return o ? (o.teamName || o.name || o.id) : id;
      }
      function activeOwnerId(){ return window.PoolApp?.ownerId || ""; }
      function showOverlay(){ const el=document.getElementById("liveLotteryOverlay"); if(el && activeOwnerId()) el.hidden=false; }
      function hideOverlay(){ const el=document.getElementById("liveLotteryOverlay"); if(el) el.hidden=true; if(window.PoolApp) window.PoolApp.lotteryOpen=false; window.PoolApp?.render(); }

      function setText(id, text){ const el = document.getElementById(id); if (el) el.textContent = text; }
      function setSpeech(text){ setText("garySpeechBubble", text); }
      function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

      function renderJoined(state){
        const target=document.getElementById("liveLotteryJoined"); if(!target)return;
        const joined=new Set(state.joined||[]), online=state.presence||window.PoolApp?.state?.presence||{};
        target.innerHTML=OWNERS.map(o=>`<span class="${joined.has(o.id)?'in':''}">${joined.has(o.id)?'✓':online[o.id]?'●':'○'} ${o.name}<small>${joined.has(o.id)?'Ready':online[o.id]?'Online':'Not here yet'}</small></span>`).join('');
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

      function cancelPickTakeover(){
        const state = window.__v127ResultsTicker;
        if (!state) return;
        clearTimeout(state.takeoverTimer);
        state.takeoverTimer = 0;
        state.takeoverActive = false;
        state.takeoverQueue = [];
        state.lastRenderedKey = "";
        document.querySelector("#v120TickerSystem .v126-results-row")?.classList.remove("v262-pick-takeover-active");
        setResultsTickerTitle("Draft Results");
      }

      function observeNewPickCards(cards, pickCount){
        const currentCount = Number(pickCount || 0);
        if (lastObservedPickCount === null) {
          // First paint is only a baseline. Do not announce an old pick when somebody opens the page mid-draft.
          lastObservedPickCount = currentCount;
          return [];
        }

        if (currentCount <= lastObservedPickCount) {
          // Covers undo/reset/end-season. The next real pick should still announce normally.
          if (currentCount < lastObservedPickCount) cancelPickTakeover();
          lastObservedPickCount = currentCount;
          return [];
        }

        const firstNewIndex = lastObservedPickCount;
        lastObservedPickCount = currentCount;
        if (!window.PoolApp?.inDraft) return [];

        const announced = cards.slice(firstNewIndex, currentCount).filter(card => card && card.type === "filled");
        // Normal live drafting produces one at a time. If a commissioner auto-fills a test draft,
        // avoid trapping the ticker in a minute-long announcement queue.
        return announced.length > 3 ? announced.slice(-1) : announced;
      }

      function setResultsTickerTitle(text){
        const title = document.getElementById("v262ResultsTitleText");
        if (title) title.textContent = text;
      }

      function queuePickTakeover(cards){
        const state = window.__v127ResultsTicker;
        if (!state || !Array.isArray(cards) || !cards.length) return;

        for (const card of cards) {
          if (!card || card.type !== "filled") continue;
          const key = `takeover-${card.key}`;
          if (state.takeoverQueue.some(item => item._takeoverKey === key)) continue;
          state.takeoverQueue.push({ ...card, _takeoverKey:key });
        }
        if (!state.takeoverActive) runNextPickTakeover();
      }

      function pickRevealHtml(card){
        const image = card.pic
          ? `<img class="v262-pick-reveal-image ${card.picType === "team-logo" ? "v136-team-goalie-logo" : ""}" src="${safeHtml(card.pic)}" alt="" loading="eager">`
          : `<span class="v262-pick-reveal-number">${safeHtml(card.pickNumber)}</span>`;
        return `<div class="v262-pick-takeover is-reveal">
          ${image}
          <span class="v262-pick-reveal-copy">
            <small>${safeHtml(String(card.owner || "").toUpperCase())} SELECTS</small>
            <strong>${safeHtml(card.player)}</strong>
            <em>${safeHtml(card.pos)}${card.team ? " • " + safeHtml(card.team) : ""} • Overall pick ${safeHtml(card.pickNumber)}</em>
          </span>
        </div>`;
      }

      function runNextPickTakeover(){
        const state = window.__v127ResultsTicker;
        const host = document.getElementById("v126ResultsCardHost");
        const row = document.querySelector("#v120TickerSystem .v126-results-row");
        const roundPickLabel = document.getElementById("v135RoundPickLabel");
        if (!state || !host || !row || state.takeoverActive || !state.takeoverQueue.length) return;

        const card = state.takeoverQueue.shift();
        state.takeoverActive = true;
        state.lastRenderedKey = "";
        clearTimeout(state.takeoverTimer);
        row.classList.add("v262-pick-takeover-active");
        setResultsTickerTitle("LIVE PICK");
        if (roundPickLabel) roundPickLabel.textContent = `R:${card.roundNumber || ""} P:${card.pickInRound || ""}`;

        host.innerHTML = `<div class="v262-pick-takeover is-alert"><strong>THE PICK IS IN</strong></div>`;

        state.takeoverTimer = setTimeout(() => {
          host.innerHTML = pickRevealHtml(card);
          const reveal = host.querySelector(".v262-pick-takeover.is-reveal");
          if (reveal) {
            void reveal.offsetWidth;
            reveal.classList.add("show");
            // V263 visibility guard: never allow the saved-pick reveal to remain black/hidden.
            reveal.style.setProperty("opacity", "1", "important");
            reveal.style.setProperty("transform", "scale(1) translateY(0)", "important");
          }

          state.takeoverTimer = setTimeout(() => {
            state.takeoverActive = false;
            row.classList.remove("v262-pick-takeover-active");
            setResultsTickerTitle("Draft Results");
            state.lastRenderedKey = "";

            // Continue the regular results ticker after the announcement.
            const justPickedIndex = state.cards.findIndex(item => item && item.key === card.key);
            if (justPickedIndex >= 0 && state.cards.length) state.index = (justPickedIndex + 1) % state.cards.length;
            renderSingleResultCard(state.cards[state.index] || state.cards[0]);

            if (state.takeoverQueue.length) {
              state.takeoverTimer = setTimeout(runNextPickTakeover, 450);
            }
          }, 4300);
        }, 1800);
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

        const newlyPickedCards = observeNewPickCards(newCards, picks.length);
        const resultsSignature = `${picks.length}|${picks.map(p => (p.pickNumber || "") + ":" + (p.player && (p.player.id || p.player.playerId || p.player.nhlId) || "")).join(",")}`;
        const signature = `${pickIndex}|${order.join(",")}|${resultsSignature}`;

        if (!force && signature === lastLiveTickerSignature && cardHost.dataset.v129Ready === "1") return;
        lastLiveTickerSignature = signature;
        cardHost.dataset.v129Ready = "1";

        // Bottom Draft Results ticker only. No live/upcoming ticker is rendered in V129.
        setV127ResultsCards(newCards, resultsSignature);
        if (newlyPickedCards.length) queuePickTakeover(newlyPickedCards);
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
        } else if (!state.takeoverActive && !document.getElementById("v126ResultsCard")) {
          renderSingleResultCard(state.cards[state.index] || state.cards[0]);
        }
      }

      function startV127ResultsTicker(){
        const state = window.__v127ResultsTicker;
        if (state.intervalId) clearInterval(state.intervalId);

        function tick(){
          const currentState = window.__v127ResultsTicker;
          if (!currentState.cards.length || currentState.takeoverActive || document.hidden || !window.PoolApp?.inDraft) return;

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

      async function loadState(){ return (await window.PoolApp.refresh()).state; }
      async function postAction(action,extra){
        const data=await window.PoolApp.request('live-lottery',{action,sessionId:window.PoolApp.state?.state?.sessionId,...(extra||{})});return data.state;
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
        if(playingSession)return;
        playingSession=window.PoolApp.state?.state?.sessionId || sessionId;
        window.PoolApp.lotteryOpen=true;
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
        try {
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

        if(window.PoolApp.state?.state?.sessionId!==playingSession){hideOverlay();return;}
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
        } finally {playingSession="";if(close)close.disabled=false;}
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
        await window.PoolApp.refresh();
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
        if(!window.PoolApp?.inDraft || !activeOwnerId() || !window.PoolApp.lotteryOpen)return;
        if(state.phase==='idle'){skipLotteryReveal=true;hideOverlay();return;}
        // Polling keeps the shared room current without interrupting an active replay.
        if(playingSession){if(state.sessionId!==playingSession)skipLotteryReveal=true;return;}
        if(state.phase==='complete' && state.finalized && revealStartedFor!==state.sessionId){
          showOverlay();showFinalBoard(state.order);renderJoined(state);
          document.getElementById('enterLiveLotteryBtn').hidden=true;
          document.getElementById('testJoinAllLotteryBtn').hidden=true;
          document.getElementById('skipLotteryRevealBtn').hidden=true;
          document.getElementById('closeLiveLotteryBtn').disabled=false;
          return;
        }

        if (state.phase === "waiting") {
          showOverlay();
          setRevealMode("ready");
          const enterBtn = document.getElementById("enterLiveLotteryBtn");
          const testBtn = document.getElementById("testJoinAllLotteryBtn");
          const leave = document.getElementById("leaveLotteryBtn");
          const board = document.getElementById("familyFeudBoard");
          if (board) board.hidden = true;
          if (enterBtn) enterBtn.hidden = false;
          if (enterBtn) {enterBtn.disabled=(state.joined||[]).includes(activeOwnerId());enterBtn.textContent=enterBtn.disabled?'You’re ready':'I’m Ready';}
          if (testBtn) testBtn.hidden = activeOwnerId() !== "nick";
          if (leave) leave.hidden = true;
          setText("liveLotteryTitle", "Ready Check");
          setText("liveLotteryMessage", "The commissioner has started the live draft lottery. Confirm when you are ready.");
          setSpeech("I'm Commissioner Bettman. The lottery will begin once every manager is ready.");
          renderJoined(state);
          return;
        }

        if (state.phase === "revealing") {
          revealBoard(state).catch(error=>window.PoolApp?.toast(error.message));
          return;
        }

        if ((state.phase === "complete" || state.phase === "idle") && Array.isArray(state.order) && state.order.length && state.finalized) {
          refreshLiveDraftTicker();
        }
      }

      async function runLottery(){
        if(!window.PoolApp.ensureIdentity())return;
        window.PoolApp.lotteryOpen=true;
        const state=await postAction("start"); renderState(state);
      }

      async function enterLotto(){
        const ownerId = activeOwnerId();
        if (!ownerId) {
          window.PoolApp.ensureIdentity();
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
        setSpeech("I'm Commissioner Bettman. All managers have been confirmed by the commissioner.");
        state = await postAction("confirmAll");
        renderState(state);
      }

      document.addEventListener("click", async function(event){
        try {
        const replay = event.target.closest && event.target.closest("#replayLotteryBtn");
        if (replay) {
          event.preventDefault();
          event.stopPropagation();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          await replayCurrentLottery();
          return;
        }
        const run = event.target.closest && event.target.closest("#runLiveLotteryBtn");
        if (run) {
          event.preventDefault();
          event.stopPropagation();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          await runLottery();
          return;
        }
        const enter = event.target.closest && event.target.closest("#enterLiveLotteryBtn");
        if (enter) {
          event.preventDefault();
          await enterLotto();
          return;
        }
        const testAll = event.target.closest && event.target.closest("#testJoinAllLotteryBtn, #testJoinAllLotteryAdminBtn");
        if (testAll) {
          event.preventDefault();
          event.stopPropagation();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          await testJoinAllLottery();
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
          await finalizeLotteryAndLeave();
          return;
        }
        const close = event.target.closest && event.target.closest("#closeLiveLotteryBtn");
        if (close) {
          event.preventDefault();
          hideOverlay();
          return;
        }
        } catch(error){ window.PoolApp?.toast(error.message); const close=document.getElementById('closeLiveLotteryBtn');if(close)close.disabled=false; }
      }, true);

      window.addEventListener("load", () => refreshLiveDraftTicker(true));
      window.liveLottery = { runLottery, enterLotto, testJoinAllLottery, replayCurrentLottery, finalizeLotteryAndLeave, refreshLiveDraftTicker, renderLiveDraftTicker, loadState, renderState };
    })();
  
