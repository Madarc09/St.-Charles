/* v293: full available-pool rankings; original layout and roster controls retained. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./pool-core'));
  else {
    const view = factory(root.PoolCore);
    const doc = root.document;
    const core = root.PoolCore;
    let latest = null;
    const standingsState = { mode: 'season' };
    let rankingCatalog = { season:'', players:null, pending:false, retryAfter:0 };
    let cardSession = 0, cardRefreshTimer = null;
    // View choices last for this page visit only; real rosters open as charts.
    const rosterState = { left: 'nick', right: 'andrew', mode: 'season', views: {} };

    function availableIds(rows) {
      const order = ['nick','andrew','scott','chris','tyler','bot','dream-team'];
      return order.filter(id => id === 'dream-team' || (rows || []).some(row => row.ownerId === id));
    }
    function normalizeRosterState() {
      if (!latest) return;
      const ids = availableIds(latest.rows);
      if (!ids.length) return;
      if (!ids.includes(rosterState.left)) rosterState.left = ids[0];
      if (!ids.includes(rosterState.right) || rosterState.right === rosterState.left) {
        rosterState.right = ids.find(id => id !== rosterState.left) || rosterState.left;
      }
      if (rosterState.mode === 'tonight') rosterState.mode = 'today';
      if (!['season','yesterday','today','tomorrow'].includes(rosterState.mode)) rosterState.mode = 'season';
      if (standingsState.mode !== 'today') standingsState.mode = 'season';
    }
    function boardRoots() {
      const roots = [];
      const main = doc.getElementById('seasonBoard');
      if (main) roots.push(main);
      const dialog = doc.getElementById('enlargedChalkboard');
      const enlarged = doc.getElementById('enlargedChalkboardContent');
      if (dialog?.open && enlarged) roots.push(enlarged);
      return roots;
    }
    function shellMarkup(draft) {
      return '<div class="pool-v280-dashboard" data-v280-dashboard>' +
        '<div class="pool-v280-standings-host" data-v280-standings-host></div>' +
        '<div class="pool-v280-rosters-host" data-v280-rosters-host></div>' +
        '<div class="pool-v273-record" data-v280-record>' +
          (draft?.locked ? '<button type="button" data-view-final-draft data-board-focus="final-draft">✓ Final draft locked · View complete draft record ↗</button>' : '<span>Draft in progress · live rosters update automatically</span>') +
        '</div></div>';
    }
    function ensureShell(rootEl) {
      if (!rootEl) return null;
      let dashboard = rootEl.querySelector('[data-v280-dashboard]');
      if (!dashboard) {
        rootEl.innerHTML = shellMarkup(latest?.draft);
        dashboard = rootEl.querySelector('[data-v280-dashboard]');
      }
      return dashboard;
    }
    function preserveScroll(host) {
      return new Map(Array.from(host?.querySelectorAll?.('[data-scroll-key]') || [], el => [el.dataset.scrollKey, el.scrollLeft]));
    }
    function restoreScroll(host, scroll) {
      host?.querySelectorAll?.('[data-scroll-key]').forEach(el => { el.scrollLeft = scroll.get(el.dataset.scrollKey) || 0; });
    }
    function replaceHost(host, html) {
      if (!host) return;
      const scroll = preserveScroll(host);
      host.innerHTML = html;
      restoreScroll(host, scroll);
    }

    function ensureCardDialog() {
      let dialog = doc.getElementById('playerStatCardDialog');
      if (dialog) return dialog;
      dialog = doc.createElement('dialog');
      dialog.id = 'playerStatCardDialog';
      dialog.className = 'pool-player-card-dialog';
      dialog.setAttribute('aria-label', 'Player recent games card');
      dialog.innerHTML = '<div class="pool-card-dialog-shell"><button type="button" class="pool-card-close" data-close-player-card aria-label="Close player card">×</button><div id="playerStatCardContent"></div></div>';
      doc.body.appendChild(dialog);
      dialog.addEventListener('click', e => { if (e.target === dialog || e.target.closest('[data-close-player-card]')) dialog.close(); });
      dialog.addEventListener('close', () => { cardSession += 1; clearTimeout(cardRefreshTimer); });
      return dialog;
    }
    function fantasyRankFor(playerKey, kind) {
      return latest ? view.poolRankFor(latest.rows, playerKey, kind, latest.live, latest.draft) : null;
    }

    // Load the same available-player catalogue as the draft board once per page.
    // It contributes identities only. Previous-season comparison scores are never used.
    async function loadRankingPool(draft) {
      const season = String(draft?.comparisonSeason || '');
      if (!/^\d{8}$/.test(season)) return;
      if (rankingCatalog.season !== season) rankingCatalog = {season,players:null,pending:false,retryAfter:0};
      const job = rankingCatalog;
      if (job.players || job.pending || Date.now() < job.retryAfter) return;
      job.pending = true;
      try {
        const response = await fetch('/api/nhl?mode=board&season=' + encodeURIComponent(season), {
          headers:{accept:'application/json'},
          signal:typeof AbortSignal !== 'undefined' ? AbortSignal.timeout(45000) : undefined
        });
        const payload = await response.json();
        if (!response.ok || payload.ok === false || String(payload.season) !== season || !Array.isArray(payload.players)) throw Error('Player catalogue unavailable');
        if (rankingCatalog !== job) return;
        job.players = payload.players.map(p => ({id:String(p.id),name:p.name,position:p.position,nhlTeam:p.nhlTeam,type:p.type}));
        if (latest && String(latest.draft.comparisonSeason) === season) {
          latest.live = {...latest.live,rankingPool:job.players};
          boardRoots().forEach(renderRoot);
        }
      } catch (_) {
        // The full current NHL feed can still rank every scorer while the
        // catalogue (including players with no current games) reconnects.
        job.retryAfter = Date.now() + 60000;
      } finally { job.pending = false; }
    }

    async function openPlayerCard(trigger, refresh = false) {
      if (!latest) return;
      const dialog = ensureCardDialog();
      const content = dialog.querySelector('#playerStatCardContent');
      if (!refresh) { cardSession += 1; clearTimeout(cardRefreshTimer); content.innerHTML = '<div class="pool-card-loading"><span></span><strong>Pulling the last games from the NHL…</strong></div>'; }
      const session = cardSession, selection = {dataset:{cardKind:trigger.dataset.cardKind,team:trigger.dataset.team,playerId:trigger.dataset.playerId}};
      let pollAgain = refresh;
      if (!dialog.open) dialog.showModal();
      const q = new URLSearchParams({ mode: 'card', season: latest.draft.seasonId });
      if (trigger.dataset.cardKind === 'teamGoalie') { q.set('type','teamGoalie'); q.set('team', trigger.dataset.team || ''); }
      else { q.set('type','skater'); q.set('playerId', trigger.dataset.playerId || ''); }
      try {
        const response = await fetch('/api/nhl?' + q.toString(), { headers: { accept: 'application/json' }, cache: 'no-store', signal:typeof AbortSignal !== 'undefined' ? AbortSignal.timeout(45000) : undefined });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.error) throw new Error(payload.error || 'Player card could not be loaded.');
        if (session !== cardSession || !dialog.open) return;
        const playerKey = trigger.dataset.cardKind === 'teamGoalie' ? ('TG-' + String(trigger.dataset.team || '').toUpperCase()) : String(trigger.dataset.playerId || '');
        payload.fantasyRank = fantasyRankFor(playerKey, trigger.dataset.cardKind || 'skater');
        const picks = Array.isArray(latest.draft?.picks) ? latest.draft.picks : [];
        const pickIndex = picks.findIndex(p => String(p?.player?.id || '') === playerKey);
        const savedPick = pickIndex >= 0 ? picks[pickIndex] : null;
        if (savedPick) {
          const owner = (view.owners || []).find(o => o.id === savedPick.ownerId);
          const totalOwners = Math.max(1, (view.owners || []).length || 5);
          const overall = Number(savedPick.pickNumber || savedPick.pick || (pickIndex + 1));
          payload.fantasyDraft = {
            ownerId: savedPick.ownerId || '',
            ownerName: savedPick.ownerName || owner?.name || savedPick.ownerId || '',
            teamName: owner?.teamName || savedPick.ownerName || owner?.name || savedPick.ownerId || '',
            round: Number(savedPick.round || Math.floor((overall - 1) / totalOwners) + 1),
            pick: Number(savedPick.slot || ((overall - 1) % totalOwners) + 1),
            overallPick: overall
          };
        }
        if (!savedPick) payload.fantasyDraft = latest.rows.some(r => r.isBot && r.players.some(p => String(p.id) === playerKey)) ? {isBot:true} : {undrafted:true};
        const scrollTop=dialog.scrollTop,tableScroll=content.querySelector('.pool-card-table-scroll')?.scrollLeft||0;
        content.innerHTML = view.cardMarkup(payload);
        dialog.scrollTop=scrollTop;
        const table=content.querySelector('.pool-card-table-scroll');if(table)table.scrollLeft=tableScroll;
        pollAgain=!!payload.currentGame?.isToday && ['LIVE','CRIT','FUT','PRE'].includes(String(payload.currentGame.state).toUpperCase());
      } catch (error) {
        if(session!==cardSession||!dialog.open)return;
        if(refresh){const status=content.querySelector('[data-card-refresh-status]');if(status)status.textContent='Showing the last update · reconnecting…';}
        else content.innerHTML = '<div class="pool-card-error"><strong>Card temporarily unavailable</strong><p>' + view.escape(error.message || 'Try again shortly.') + '</p></div>';
      } finally {
        if(session===cardSession&&dialog.open&&pollAgain)cardRefreshTimer=setTimeout(()=>{
          if(!dialog.open||session!==cardSession)return;
          openPlayerCard(selection,true);
        },15000);
      }
    }

    function cycleSide(side, delta) {
      if (!latest) return;
      const ids = availableIds(latest.rows);
      if (!ids.length) return;
      const other = side === 'left' ? 'right' : 'left';
      let index = Math.max(0, ids.indexOf(rosterState[side]));
      for (let tries = 0; tries < ids.length; tries++) {
        index = (index + delta + ids.length) % ids.length;
        const candidate = ids[index];
        if (ids.length === 1 || candidate !== rosterState[other]) {
          rosterState[side] = candidate;
          break;
        }
      }
    }

    function bindStandings(host) {
      host.querySelectorAll('[data-bot-compare]').forEach(button => button.addEventListener('click', event => {
        event.preventDefault();rosterState.left='bot';normalizeRosterState();
        boardRoots().forEach(rootEl => {
          const target=rootEl.querySelector('[data-v280-rosters-host]');renderRostersHost(target);
          const bot=target?.querySelector('.pool-roster[data-owner="bot"]');
          bot?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
        });
      }));
      const toggle = host.querySelector('[data-v280-standings-toggle]');
      if (toggle) toggle.addEventListener('click', event => {
        event.preventDefault();
        standingsState.mode = standingsState.mode === 'today' ? 'season' : 'today';
        renderStandingsHost(host);
      });
    }
    function bindRosters(host) {
      host.querySelectorAll('[data-roster-view-toggle]').forEach(button => button.addEventListener('click', event => {
        event.preventDefault();
        const ownerId = button.dataset.rosterViewToggle;
        if (!latest || !availableIds(latest.rows).includes(ownerId)) return;
        rosterState.views[ownerId] = button.dataset.rosterView === 'ice' ? 'chart' : 'ice';
        // Refresh comparison cards only. Preserve both boards' horizontal scroll,
        // the selected date, each other roster's view and the standings controls.
        boardRoots().forEach(rootEl => renderRostersHost(rootEl.querySelector('[data-v280-rosters-host]')));
        const next = Array.from(host.querySelectorAll('[data-roster-view-toggle]')).find(el => el.dataset.rosterViewToggle === ownerId);
        next?.focus?.({preventScroll:true});
        const card = next?.closest?.('.pool-roster');
        if (card?.animate && !root.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          card.animate([
            {transform:'perspective(1400px) rotateY(-65deg)',opacity:.3,transformOrigin:'center top'},
            {transform:'perspective(1400px) rotateY(0deg)',opacity:1,transformOrigin:'center top'}
          ], {duration:260,easing:'ease-out'});
        }
      }));
      host.querySelectorAll('[data-v291-roster-mode]').forEach(button => button.addEventListener('click', event => {
        event.preventDefault();
        const requested = String(button.dataset.v291RosterMode || 'season');
        rosterState.mode = ['season','yesterday','today','tomorrow'].includes(requested) ? requested : 'season';
        renderRostersHost(host);
      }));
      host.querySelectorAll('[data-v280-compare-shift]').forEach(button => button.addEventListener('click', event => {
        event.preventDefault();
        const side = button.dataset.compareSide === 'right' ? 'right' : 'left';
        const delta = Number(button.dataset.v280CompareShift || 1) < 0 ? -1 : 1;
        cycleSide(side, delta);
        renderRostersHost(host);
      }));
      host.querySelectorAll('[data-v280-mobile-shift]').forEach(button => button.addEventListener('click', event => {
        event.preventDefault();
        const track = host.querySelector('.pool-roster-track');
        if (track) track.scrollBy({ left: Number(button.dataset.v280MobileShift || 1) * Math.max(280, track.clientWidth * .82), behavior: 'smooth' });
      }));
      host.querySelectorAll('[data-roster-jump]').forEach(button => button.addEventListener('click', event => {
        event.preventDefault();
        const target = Array.from(host.querySelectorAll('.pool-roster[data-owner]')).find(el => el.dataset.owner === button.dataset.rosterJump);
        target?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }));
      host.querySelectorAll('[data-player-card]').forEach(button => button.addEventListener('click', event => {
        event.preventDefault();
        openPlayerCard(button);
      }));
    }

    function renderStandingsHost(host) {
      if (!latest || !host) return;
      replaceHost(host, view.renderStandings(latest.rows, latest.draft, standingsState.mode, latest.live));
      bindStandings(host);
    }
    function renderRostersHost(host) {
      if (!latest || !host) return;
      normalizeRosterState();
      replaceHost(host, view.renderRosters(latest.rows, latest.draft, rosterState, latest.live));
      bindRosters(host);
    }
    function renderRoot(rootEl) {
      const dashboard = ensureShell(rootEl);
      if (!dashboard) return;
      dashboard.dataset.standingsMode = standingsState.mode;
      dashboard.dataset.rosterMode = rosterState.mode;
      const record = dashboard.querySelector('[data-v280-record]');
      if (record) record.innerHTML = latest.draft?.locked ? '<button type="button" data-view-final-draft data-board-focus="final-draft">✓ Final draft locked · View complete draft record ↗</button>' : '<span>Draft in progress · live rosters update automatically</span>';
      renderStandingsHost(dashboard.querySelector('[data-v280-standings-host]'));
      renderRostersHost(dashboard.querySelector('[data-v280-rosters-host]'));
    }

    root.renderSeasonBoard = function(rows, draft, live) {
      const displayRows = root.PoolBot ? root.PoolBot.standings(rows, draft, String(live?.season) === String(draft?.seasonId) ? live?.players : []) : rows;
      latest = { rows: displayRows || [], draft: draft || {}, live: {...(live || {}),rankingPool:rankingCatalog.season === String(draft?.comparisonSeason) ? rankingCatalog.players : null} };
      normalizeRosterState();
      boardRoots().forEach(renderRoot);
      loadRankingPool(draft);
    };

    // Enlarged board is the only document-level Home-board interaction left.
    doc.addEventListener('click', event => {
      const dialog = doc.getElementById('enlargedChalkboard');
      if (!dialog) return;
      if (event.target.closest?.('[data-enlarge-chalkboard]')) {
        event.preventDefault();
        const target = doc.getElementById('enlargedChalkboardContent');
        if (target && latest) { target.innerHTML = ''; renderRoot(target); }
        if (!dialog.open) dialog.showModal();
        return;
      }
      if (event.target.closest?.('[data-close-chalkboard]') || (dialog.open && event.target.closest?.('[data-roster-owner], [data-view-final-draft]'))) dialog.close();
    }, true);
  }
})(typeof window !== 'undefined' ? window : this, function (C) {

  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fmt = value => C.num(value).toLocaleString('en-CA', { maximumFractionDigits: 2 });
  const skaterColumns = [['goals','G','Goals'],['assists','A','Assists'],['shortHandedGoals','SHG','SHG'],['gameWinningGoals','GWG','GWG']];
  const goalieColumns = [['goalieWins','W','Wins'],['goalieAssists','A','Assists'],['goalieGoals','G','Goals'],['goalieShutouts','SO','Shutouts']];
  const TEAM_CARD_COLORS = {
    ANA:['#FC4C02','#B9975B','#111111'], BOS:['#FFB81C','#000000','#FFFFFF'], BUF:['#003087','#FFB81C','#FFFFFF'],
    CAR:['#CC0000','#000000','#FFFFFF'], CBJ:['#002654','#CE1126','#A4A9AD'], CGY:['#C8102E','#F1BE48','#111111'],
    CHI:['#CF0A2C','#000000','#FF671B'], COL:['#6F263D','#236192','#A2AAAD'], DAL:['#006847','#8F8F8C','#FFFFFF'],
    DET:['#CE1126','#FFFFFF','#111111'], EDM:['#041E42','#FF4C00','#FFFFFF'], FLA:['#041E42','#C8102E','#B9975B'],
    LAK:['#111111','#A2AAAD','#FFFFFF'], MIN:['#154734','#A6192E','#EAAA00'], MTL:['#AF1E2D','#192168','#FFFFFF'],
    NJD:['#CE1126','#000000','#FFFFFF'], NSH:['#FFB81C','#041E42','#FFFFFF'], NYI:['#00539B','#F47D30','#FFFFFF'],
    NYR:['#0038A8','#CE1126','#FFFFFF'], OTT:['#C52032','#C2912C','#000000'], PHI:['#F74902','#000000','#FFFFFF'],
    PIT:['#FCB514','#000000','#FFFFFF'], SEA:['#001628','#99D9D9','#355464'], SJS:['#006D75','#EA7200','#000000'],
    STL:['#002F87','#FCB514','#041E42'], TBL:['#002868','#FFFFFF','#111111'], TOR:['#003E7E','#FFFFFF','#111111'],
    UTA:['#6CACE4','#000000','#FFFFFF'], VAN:['#00205B','#00843D','#FFFFFF'], VGK:['#B4975A','#333F48','#C8102E'],
    WPG:['#041E42','#004C97','#AC162C'], WSH:['#041E42','#C8102E','#FFFFFF']
  };
  function teamPalette(team){return TEAM_CARD_COLORS[String(team||'').toUpperCase()]||['#173f79','#b3262f','#f7f4e9'];}
  function contrastInk(hex){const h=String(hex||'').replace('#','');if(!/^[0-9a-f]{6}$/i.test(h))return '#ffffff';const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);return ((r*299+g*587+b*114)/1000)>155?'#111111':'#ffffff';}
  function stat(p,key){ if(key==='goalieAssists')return C.num(p?.goalieAssists??p?.assists);if(key==='goalieGoals')return C.num(p?.goalieGoals??p?.goals);if(key==='shortHandedGoals')return C.num(p?.shortHandedGoals??p?.shGoals);return C.num(p?.[key]); }
  function contribution(value,key){return C.num(value)*C.num(C.SCORING[key]);}
  function weighted(value,key){return '<span class="pool-stat-count">'+fmt(value)+'</span><span class="pool-stat-contribution">('+fmt(contribution(value,key))+')</span>';}
  function heading(key,short,full){const weight=C.SCORING[key];return '<th scope="col"><span class="pool-head-long">'+esc(full)+'</span><span class="pool-head-short">'+esc(short)+'</span><small>('+fmt(weight)+' '+(weight===1?'FPT':'FPTS')+')</small></th>';}
  function statHeaders(columns){return columns.map(([key,short,full])=>heading(key,short,full)).join('');}
  function summary(row){const skaters=row.players.filter(p=>C.bucket(p)!=='G'),goalies=row.players.filter(p=>C.bucket(p)==='G');const totals=Object.fromEntries(skaterColumns.map(([key])=>[key,skaters.reduce((s,p)=>s+stat(p,key),0)]));return {...totals,goalieFpts:goalies.reduce((s,p)=>s+C.points(p),0)};}
  function initials(name){return String(name||'?').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'?';}
  function playerImage(p){const goalie=C.bucket(p)==='G',teamLogo='https://assets.nhle.com/logos/nhl/svg/'+encodeURIComponent(p.nhlTeam||'')+'_light.svg',src=goalie?teamLogo:'https://assets.nhle.com/mugs/nhl/latest/'+encodeURIComponent(p.id||'')+'.png';return '<span class="pool-player-avatar '+(goalie?'is-team-logo':'')+'"><span aria-hidden="true">'+esc(initials(goalie?p.nhlTeam:p.name))+'</span><img class="pool-player-headshot" src="'+esc(src)+'" alt="" loading="lazy" onerror="this.style.display=\'none\'">'+(goalie?'':'<img class="pool-player-team-badge" src="'+esc(teamLogo)+'" alt="" loading="lazy" onerror="this.style.display=\'none\'">')+'</span>';}
  function cardTrigger(p,goalie,subline){const label=goalie?String(p.name||'').replace(/\s+Goalies$/i,''):p.name;return '<button type="button" class="pool-player-card-trigger" data-player-card data-card-kind="'+(goalie?'teamGoalie':'skater')+'" data-player-id="'+esc(p.id)+'" data-team="'+esc(p.nhlTeam||'')+'" aria-label="Open recent games card for '+esc(label)+'">'+playerImage(p)+'<span class="pool-player-copy"><strong>'+esc(label)+'</strong><small>'+esc(subline??p.nhlTeam??'')+'</small>'+(p.dreamOwnerLabel?'<small class="pool-dream-owner">'+esc(p.dreamOwnerLabel)+'</small>':'')+'</span></button>';}
  function rosterGroup(players,bucket,label,ownerId,instance){
    const roster=C.sortRoster(players).filter(p=>C.bucket(p)===bucket),columns=bucket==='G'?goalieColumns:skaterColumns,first=bucket==='G'?'Team Goalies':'Player Name';
    const table='<table class="pool-stat-table pool-roster-table"><caption class="pool-visually-hidden">'+esc(label)+' stats. Parentheses show fantasy-point contribution.</caption><thead><tr><th class="pool-name-cell" scope="col">'+first+'</th><th class="pool-fpts-cell pool-fpts-first" scope="col">FPTS <small>TOTAL</small></th>'+statHeaders(columns)+'</tr></thead><tbody>'+
      (roster.map(p=>'<tr class="pool-player" data-player-id="'+esc(p.id)+'"><th class="pool-name-cell" scope="row" title="'+esc(p.name)+'">'+cardTrigger(p,bucket==='G')+'</th><td class="pool-fpts-cell pool-fpts-first">'+fmt(C.points(p))+'</td>'+columns.map(([key])=>'<td>'+weighted(stat(p,key),key)+'</td>').join('')+'</tr>').join('')||'<tr><td colspan="6" class="pool-empty">No selections yet.</td></tr>')+'</tbody></table>';
    return '<section class="pool-position" data-position="'+bucket+'"><h4><span>'+esc(label)+'</span><em>'+roster.length+'</em></h4><div class="pool-stat-scroll" data-scroll-key="'+esc((instance||'roster')+'-'+(ownerId||'')+'-'+bucket)+'" role="region" aria-label="'+esc(label)+' statistics" tabindex="0">'+table+'</div></section>';
  }
  function mobileCardArrow(dir){return '<button type="button" class="pool-mobile-card-arrow" data-v280-mobile-shift="'+dir+'" aria-label="'+(dir<0?'Previous':'Next')+' team">'+(dir<0?'‹':'›')+'</button>';}
  function dreamRosterCounts(row){
    if(!row?.isDream)return '';
    const counts=(row.ownerCounts||[]).map(owner=>'<li data-dream-owner="'+esc(owner.ownerId||'undrafted')+'"><span>'+esc(owner.ownerName)+'</span><b>'+fmt(owner.count)+'</b></li>').join('');
    return '<section class="pool-dream-counts" aria-label="Full Dream Team selections by roster, including team goalie groups"><p>Dream Team spots by roster</p>'+(row.players.length?'<ul>'+counts+'</ul>':'<p>Loading current selections…</p>')+'</section>';
  }
  function rosterPresentation(row,requested){
    return requested==='ice'||requested==='chart'?requested:row.isDream?'ice':'chart';
  }
  function rosterNameToggle(row,presentation){
    const ice=presentation==='ice',action='Switch '+row.ownerName+' to '+(ice?'chart':'ice')+' view';
    return '<button type="button" class="pool-roster-view-toggle" data-roster-view-toggle="'+esc(row.ownerId)+'" data-roster-view="'+presentation+'" aria-pressed="'+ice+'" aria-label="'+esc(action)+'" title="'+esc(action)+'"><span>'+esc(row.ownerName)+'</span><span class="pool-roster-view-symbol" aria-hidden="true">↻</span></button>';
  }
  function rosterHeading(row,total,pointsLabel,presentation,mode='season',scheduled=null){
    const daily=mode!=='season',kicker=daily?rosterDayShort(mode).toUpperCase()+' MATCHUP':row.isDream?'CURRENT SEASON LEADERS':row.isBot?'BOT ROSTER · THE SPARE PARTS':'MANAGER ROSTER';
    const count=daily&&scheduled!==null?'<small class="pool-tonight-count">'+scheduled+(row.isBot||row.isDream?' selection':' drafted selection')+(scheduled===1?'':'s')+' scheduled</small>':'';
    return '<header class="pool-roster-heading">'+mobileCardArrow(-1)+'<div class="pool-roster-heading-center"><span class="pool-roster-kicker">'+esc(kicker)+'</span><h3>'+rosterNameToggle(row,presentation)+'</h3><small class="pool-roster-view-hint">Tap name for '+(presentation==='ice'?'chart':'ice')+' view</small>'+count+'<small class="pool-mobile-roster-total">'+fmt(total)+' '+esc(pointsLabel)+'</small></div><span class="pool-roster-total"><b>'+fmt(total)+'</b><small>'+esc(pointsLabel)+'</small></span>'+mobileCardArrow(1)+'</header>';
  }
  function goaliePortraits(team,live){
    return (live?.goalies||[]).filter(g=>String(g.teamAbbrevs||g.teamAbbrev||'').split(/[,/\s]+/).includes(team))
      .sort((a,b)=>C.num(b.gamesPlayed)-C.num(a.gamesPlayed)).slice(0,2)
      .map(g=>({id:String(g.playerId),name:g.goalieFullName||g.playerFullName||'Goalie'}));
  }
  function rinkPlayers(row,live){
    return (row.players||[]).map(p=>({...p,
      dreamOwnerLabel:row.isDream?p.dreamOwnerLabel:row.isBot?'Undrafted ('+(row.teamName||'The Spare Parts')+')':'Team: '+row.ownerName,
      dreamGoalies:C.bucket(p)==='G'?(p.dreamGoalies||goaliePortraits(p.nhlTeam,live)):[]
    }));
  }
  function dreamRinkPlayer(p,x,y,live,mode){
    if(!p)return '';
    const goalie=C.bucket(p)==='G',daily=mode!=='season',game=daily?gameForTeam(p.nhlTeam,live,mode):null;
    const points=daily?dailyLine(p,live,mode).fpts:C.points(p),label=goalie?(C.TEAMS[p.nhlTeam]||p.nhlTeam)+' Goalies':p.name,displayName=goalie?p.nhlTeam+' Goalies':p.name;
    const logo='https://assets.nhle.com/logos/nhl/svg/'+encodeURIComponent(p.nhlTeam||'')+'_light.svg';
    const portrait=goalie?'<span class="dream-goalie-portraits"><img class="dream-goalie-crest" src="'+logo+'" alt="" onerror="this.style.display=\'none\'">'+(p.dreamGoalies||[]).map(g=>'<img class="dream-goalie-face" src="https://assets.nhle.com/mugs/nhl/latest/'+encodeURIComponent(g.id)+'.png" alt="'+esc(g.name)+'" loading="lazy" onerror="this.style.display=\'none\'">').join('')+'</span>':'<span class="dream-skater-portrait"><span aria-hidden="true">'+esc(initials(p.name))+'</span><img src="https://assets.nhle.com/mugs/nhl/latest/'+encodeURIComponent(p.id)+'.png" alt="" loading="lazy" onerror="this.style.display=\'none\'"><img class="dream-team-crest" src="'+logo+'" alt="" onerror="this.style.display=\'none\'"></span>';
    return '<button type="button" class="dream-rink-player'+(goalie?' is-goalie':'')+(daily&&!game?' is-off-day':'')+'" style="--dream-x:'+x+'%;--dream-y:'+y+'%" data-dream-position="'+C.bucket(p)+'" data-player-card data-card-kind="'+(goalie?'teamGoalie':'skater')+'" data-player-id="'+esc(p.id)+'" data-team="'+esc(p.nhlTeam)+'" aria-label="'+esc(label+', '+fmt(points)+' fantasy points, '+p.dreamOwnerLabel)+'. Open hockey card">'+portrait+'<span class="dream-player-label"><strong>'+esc(displayName)+'</strong><span class="dream-player-points">'+fmt(points)+' <small>FPTS</small></span><span class="dream-player-owner">'+esc(p.dreamOwnerLabel)+'</span>'+(daily&&!game?'<small class="dream-off-day">No game</small>':'')+'</span></button>';
  }
  function iceRinkCard(row,live,compareRole,mode='season'){
    const players=rinkPlayers(row,live);
    const group=bucket=>players.filter(p=>C.bucket(p)===bucket).sort((a,b)=>C.points(b)-C.points(a)||String(a.name).localeCompare(String(b.name)));
    const forwards=group('F'),defence=group('D'),goalies=group('G'),daily=mode!=='season';
    const scheduled=players.filter(p=>gameForTeam(p.nhlTeam,live,mode));
    const total=daily?scheduled.reduce((sum,p)=>sum+dailyLine(p,live,mode).fpts,0):row.total;
    const pointsLabel=daily?rosterDayShort(mode,live).toUpperCase()+' FPTS':'SEASON FPTS';
    const slots=[[goalies[0],50,9],[defence[0],31,24],[defence[1],69,24],[forwards[0],19,40],[forwards[1],50,40],[forwards[2],81,40],[forwards[3],19,60],[forwards[4],50,60],[forwards[5],81,60],[defence[2],31,76],[defence[3],69,76],[goalies[1],50,91]];
    const champion=row.ownerId==='andrew'?' data-champion="true"':'';
    return '<article class="pool-roster pool-ice-rink-card'+(row.isDream?' pool-dream-rink-card':'')+'"'+(compareRole?' data-compare-role="'+esc(compareRole)+'"':'')+champion+' data-owner="'+esc(row.ownerId)+'" data-roster-presentation="ice" aria-label="'+esc(row.ownerName)+' rink lineup">'+rosterHeading(row,total,pointsLabel,'ice',mode,daily?scheduled.length:null)+'<p class="dream-rink-caption">'+forwards.length+' forwards · '+defence.length+' defence · '+goalies.length+' goalie groups <span>Tap a player to open their card</span></p>'+dreamRosterCounts(row)+'<div class="dream-rink" aria-label="Goalies at the nets, defence behind each blue line, forwards near centre ice">'+(players.length?slots.map(([p,x,y])=>dreamRinkPlayer(p,x,y,live,mode)).join(''):'<p class="dream-rink-loading">'+(row.isDream?'Loading the Dream Team…':'No selections yet.')+'</p>')+'</div></article>';
  }
  function rosterCard(row,instance,compareRole,presentation,live){
    if(!row)return '';
    if(rosterPresentation(row,presentation)==='ice')return iceRinkCard(row,live,compareRole,'season');
    const champion=row.ownerId==='andrew'?' data-champion="true"':'',compareAttr=compareRole?' data-compare-role="'+esc(compareRole)+'"':'';
    return '<article class="pool-roster"'+compareAttr+champion+' data-owner="'+esc(row.ownerId)+'" data-roster-presentation="chart" aria-label="'+esc(row.ownerName)+' roster">'+rosterHeading(row,row.total,'FPTS','chart')+dreamRosterCounts(row)+rosterGroup(row.players,'F','Forwards',row.ownerId,instance)+rosterGroup(row.players,'D','Defence',row.ownerId,instance)+rosterGroup(row.players,'G','Team Goalies',row.ownerId,instance)+'</article>';
  }
  function dayPayload(live,mode){
    const key=mode==='tonight'?'today':mode;
    if(key==='today')return live?.matchups?.today||live?.today||null;
    if(key==='yesterday'||key==='tomorrow')return live?.matchups?.[key]||null;
    return null;
  }
  function gameForTeam(team,live,mode='today'){
    const day=dayPayload(live,mode);
    return(day?.games||[]).find(game=>game.away===team||game.home===team)||null;
  }
  function gameStatus(game,team,mode='today'){
    if(!game)return'';
    const opponent=game.away===team?game.home:game.away,venue=game.away===team?'@ ':'vs ',state=String(game.state||'').toUpperCase();
    if(['FINAL','OFF'].includes(state))return venue+opponent+' · FINAL '+fmt(game.awayScore)+'–'+fmt(game.homeScore);
    if(!['FUT','PRE'].includes(state)){
      const period=game.period?'P'+game.period:'LIVE',clock=game.timeRemaining?' '+game.timeRemaining:'';
      return venue+opponent+' · '+period+clock+' · '+fmt(game.awayScore)+'–'+fmt(game.homeScore);
    }
    if(game.startTimeUTC){
      const time=new Date(game.startTimeUTC).toLocaleTimeString('en-CA',{hour:'numeric',minute:'2-digit'});
      return venue+opponent+' · '+time;
    }
    return venue+opponent+(mode==='tomorrow'?' · Tomorrow':mode==='yesterday'?' · Yesterday':' · Today');
  }
  function dailyLine(p,live,mode='today'){
    const day=dayPayload(live,mode)||{};
    if(C.bucket(p)==='G'){
      const row=day?.teamGoalies?.[p.nhlTeam]||{};
      return{position:'TG',goalieWins:stat(row,'goalieWins'),goalieAssists:stat(row,'goalieAssists'),goalieGoals:stat(row,'goalieGoals'),goalieShutouts:stat(row,'goalieShutouts'),fpts:C.points({position:'TG',...row})};
    }
    const row=day?.players?.[String(p.id)]||{};
    return{goals:stat(row,'goals'),assists:stat(row,'assists'),shortHandedGoals:stat(row,'shortHandedGoals'),gameWinningGoals:stat(row,'gameWinningGoals'),fpts:C.points(row)};
  }
  function todayLine(p,live){return dailyLine(p,live,'today');}
  function todaySummary(row,live){const totals={goals:0,assists:0,shortHandedGoals:0,gameWinningGoals:0,goalieFpts:0,total:0};for(const p of row.players){const line=todayLine(p,live);if(C.bucket(p)==='G')totals.goalieFpts+=line.fpts;else skaterColumns.forEach(([key])=>totals[key]+=stat(line,key));totals.total+=line.fpts;}return totals;}
  function todayStandingRows(rows,live){const out=rows.map(row=>({...row,_today:todaySummary(row,live)})).sort((a,b)=>b._today.total-a._today.total||a.ownerName.localeCompare(b.ownerName));return out.map((r,i,all)=>({...r,_todayRank:i&&r._today.total===all[i-1]._today.total?all.findIndex(x=>x._today.total===r._today.total)+1:i+1}));}
  function matchupRows(row,live,bucket,mode){return C.sortRoster(row.players).filter(p=>C.bucket(p)===bucket&&gameForTeam(p.nhlTeam,live,mode));}
  function matchupGroup(row,live,bucket,label,instance,mode){
    const roster=matchupRows(row,live,bucket,mode),goalie=bucket==='G',columns=goalie?goalieColumns:skaterColumns,dayLabel=rosterDayShort(mode,live);
    const table='<table class="pool-stat-table pool-roster-table pool-matchup-table"><caption class="pool-visually-hidden">'+esc(label)+' scheduled on '+esc(dayLabel)+' with fantasy stats for that day.</caption><thead><tr><th class="pool-name-cell" scope="col">'+(goalie?'Team Goalies':'Player Name')+'</th><th class="pool-fpts-cell pool-fpts-first" scope="col">'+esc(dayLabel.toUpperCase())+' <small>FPTS</small></th>'+statHeaders(columns)+'</tr></thead><tbody>'+(roster.map(p=>{const line=dailyLine(p,live,mode),game=gameForTeam(p.nhlTeam,live,mode);return '<tr class="pool-player pool-tonight-player" data-player-id="'+esc(p.id)+'"><th class="pool-name-cell" scope="row">'+cardTrigger(p,goalie,gameStatus(game,p.nhlTeam,mode))+'</th><td class="pool-fpts-cell pool-fpts-first">'+fmt(line.fpts)+'</td>'+columns.map(([key])=>'<td>'+weighted(stat(line,key),key)+'</td>').join('')+'</tr>';}).join('')||'<tr><td colspan="6" class="pool-empty pool-tonight-empty">No '+(row.isBot||row.isDream?'selected ':'drafted ')+esc(label.toLowerCase())+' are scheduled '+esc(dayLabel.toLowerCase())+'.</td></tr>')+'</tbody></table>';
    return '<section class="pool-position pool-matchup-position" data-position="'+bucket+'"><h4><span>'+esc(label)+' · '+esc(dayLabel)+'</span><em>'+roster.length+'</em></h4><div class="pool-stat-scroll" data-scroll-key="'+esc((instance||mode)+'-'+row.ownerId+'-'+bucket)+'" role="region" aria-label="'+esc(label)+' scheduled '+esc(dayLabel)+'" tabindex="0">'+table+'</div></section>';
  }
  function matchupCard(row,live,compareRole,mode,presentation){
    if(!row)return'';
    if(rosterPresentation(row,presentation)==='ice')return iceRinkCard(row,live,compareRole,mode);
    const champion=row.ownerId==='andrew'?' data-champion="true"':'',compareAttr=compareRole?' data-compare-role="'+esc(compareRole)+'"':'',all=['F','D','G'].flatMap(bucket=>matchupRows(row,live,bucket,mode)),dayTotal=all.reduce((sum,p)=>sum+dailyLine(p,live,mode).fpts,0),dayLabel=rosterDayShort(mode,live);
    return '<article class="pool-roster pool-matchup-card"'+compareAttr+champion+' data-owner="'+esc(row.ownerId)+'" data-roster-presentation="chart" aria-label="'+esc(row.ownerName)+' '+esc(dayLabel)+'">'+rosterHeading(row,dayTotal,dayLabel.toUpperCase()+' FPTS','chart',mode,all.length)+dreamRosterCounts(row)+matchupGroup(row,live,'F','Forwards',mode,mode)+matchupGroup(row,live,'D','Defence',mode,mode)+matchupGroup(row,live,'G','Team Goalies',mode,mode)+'</article>';
  }
  function comparePicker(side,row,rows){if(!row)return'';return '<div class="pool-compare-picker pool-v280-picker" data-compare-picker="'+side+'"><button type="button" data-v280-compare-shift="-1" data-compare-side="'+side+'" aria-label="Previous manager on '+side+'">‹</button><div><span>'+(side==='left'?'TEAM ONE':'TEAM TWO')+'</span><strong>'+esc(row.ownerName)+'</strong></div><button type="button" data-v280-compare-shift="1" data-compare-side="'+side+'" aria-label="Next manager on '+side+'">›</button></div>';}
  function ordinalDay(day){
    const n=Number(day)||0,mod100=n%100;
    if(mod100>=11&&mod100<=13)return n+'th';
    return n+(n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th');
  }
  function matchupDateLabelFromRaw(raw,upper=false){
    const value=String(raw||'');
    let label='Today';
    if(/^\d{4}-\d{2}-\d{2}$/.test(value)){
      const [y,m,d]=value.split('-').map(Number);
      const date=new Date(y,m-1,d,12,0,0);
      const weekday=new Intl.DateTimeFormat('en-CA',{weekday:'long'}).format(date);
      const month=new Intl.DateTimeFormat('en-CA',{month:'long'}).format(date);
      label=weekday+' '+month+' '+ordinalDay(d);
    }
    return upper?label.toUpperCase():label;
  }
  function matchupDateLabel(live,upper=false,mode='today'){
    const raw=dayPayload(live,mode)?.date||live?.today?.date||'';
    return matchupDateLabelFromRaw(raw,upper);
  }
  function rosterDayShort(mode,live){
    if(mode==='yesterday')return'Yesterday';
    if(mode==='tomorrow')return'Tomorrow';
    if(mode==='today'||mode==='tonight')return'Today';
    return matchupDateLabel(live,false,mode);
  }
  function rosterCurrentView(mode,live){
    if(mode==='season')return'SEASON TOTALS';
    return matchupDateLabel(live,true,mode)+' MATCHUPS';
  }
  function rosterModeTabs(mode,live){
    const modes=[['season','Season'],['yesterday','Yesterday'],['today','Today'],['tomorrow','Tomorrow']];
    return '<nav class="pool-v291-day-tabs" aria-label="Roster comparison date">'+modes.map(([key,label])=>{
      const selected=mode===key;
      const day=key==='season'?'':matchupDateLabel(live,false,key);
      return '<button type="button" data-v291-roster-mode="'+key+'" aria-pressed="'+(selected?'true':'false')+'" class="'+(selected?'is-active':'')+'"><strong>'+label+'</strong>'+(day?'<small>'+esc(day)+'</small>':'<small>Full season</small>')+'</button>';
    }).join('')+'</nav>';
  }
  function modeSwitch(mode,live){return rosterModeTabs(mode,live);}
  function standingsSwitch(mode){
    const today=mode==='today';
    return '<button type="button" class="pool-standings-mode pool-v280-standings-toggle" data-v280-standings-toggle aria-pressed="'+(today?'true':'false')+'"><span aria-hidden="true">'+(today?'↩':'☀')+'</span><strong>'+(today?'View Season Standings':'View Today’s Totals')+'</strong></button>';
  }
  function rankedPoolEntries(rows,goalies,live,draft){
    if(!Array.isArray(live?.players) || (draft?.seasonId && String(live.season)!==String(draft.seasonId)))return [];
    const owners=new Map(),identities=new Map(),stats=new Map();
    const remember=p=>{if(p?.id!=null)identities.set(String(p.id),{id:String(p.id),name:p.name,position:p.position,nhlTeam:p.nhlTeam,type:p.type});};
    (live.rankingPool||[]).forEach(remember);
    (rows||[]).filter(row=>!row.isDream&&row.ownerId!=='dream-team').forEach(row=>(row.players||[]).forEach(player=>{
      remember(player);owners.set(String(player.id),row);
    }));
    live.players.forEach(player=>{remember(player);stats.set(String(player.id),player);});
    Object.entries(C.TEAMS).forEach(([team,name])=>{
      const id='TG-'+team;if(!identities.has(id))remember({id,name:name+' Goalies',position:'TG',nhlTeam:team,type:'teamGoalie'});
    });
    const entries=[];
    for(const identity of identities.values()){
      const isTeamGoalie=identity.id.startsWith('TG-') || identity.position==='TG' || identity.type==='teamGoalie';
      if(isTeamGoalie!==!!goalies || (!isTeamGoalie && C.bucket(identity)==='G'))continue;
      const source=stats.get(identity.id)||{},owner=owners.get(identity.id);
      const player={...identity,goals:C.num(source.goals),assists:C.num(source.assists),
        shortHandedGoals:C.num(source.shortHandedGoals??source.shGoals),gameWinningGoals:C.num(source.gameWinningGoals),
        goalieWins:C.num(source.goalieWins),goalieShutouts:C.num(source.goalieShutouts),
        goalieAssists:C.num(source.goalieAssists??source.assists),goalieGoals:C.num(source.goalieGoals??source.goals)};
      if(isTeamGoalie)player.position='TG';
      entries.push({player,isBot:!!owner?.isBot,ownerId:owner?.ownerId||null,
        ownerName:owner?.ownerName||C.OWNERS.find(o=>o.id===owner?.ownerId)?.name||owner?.ownerId||'',
        undrafted:!owner,fpts:C.points(player)});
    }
    entries.sort((a,b)=>b.fpts-a.fpts||String(a.player.name||'').localeCompare(String(b.player.name||''))||a.player.id.localeCompare(b.player.id));
    let previous=null,rank=0;
    return entries.map((entry,index)=>{if(previous===null||entry.fpts!==previous)rank=index+1;previous=entry.fpts;return {...entry,rank};});
  }
  function topFantasyEntries(rows,goalies,live,draft){return rankedPoolEntries(rows,goalies,live,draft).slice(0,5);}
  function poolRankFor(rows,playerKey,kind,live,draft){
    const goalies=kind==='teamGoalie',entries=rankedPoolEntries(rows,goalies,live,draft);
    const entry=entries.find(e=>e.player.id===String(playerKey));
    return entry?{rank:entry.rank,fieldSize:entries.length,fpts:entry.fpts,scope:goalies?'allTeamGoalies':'allSkaters'}:null;
  }
  function topFantasyPanel(rows,goalies,live,draft){
    const entries=topFantasyEntries(rows,goalies,live,draft);
    const title=goalies?'Top 5 Team Goalies':'Top 5 Skaters';
    const rowsHtml=Array.from({length:5},(_,index)=>{
      const entry=entries[index];
      if(!entry)return '<li class="is-empty"><b>—</b><span><strong>Loading season stats</strong><small>Full available pool</small></span><em>—</em></li>';
      const player=entry.player||{};
      const label=goalies?String(player.name||C.TEAMS?.[player.nhlTeam]||player.nhlTeam||'Team Goalies').replace(/\s+Goalies$/i,''):String(player.name||'Player');
      const ownership=entry.undrafted?'Undrafted in our pool':(entry.isBot?'Selected by ':'Drafted by ')+entry.ownerName;
      return '<li><b>'+fmt(entry.rank)+'</b><span><strong title="'+esc(label)+'">'+esc(label)+'</strong><small>'+esc(ownership)+'</small></span><em>'+fmt(entry.fpts)+' <small>FPTS</small></em></li>';
    }).join('');
    return '<section class="pool-v287-top5 '+(goalies?'is-goalies':'is-skaters')+'" data-ranking-scope="available-pool" aria-label="'+esc(title)+' across the full available pool by season fantasy points"><div class="pool-v287-top5-title"><h3>'+title+'</h3><span>Season FPTS</span></div><ol>'+rowsHtml+'</ol></section>';
  }
  function dreamTeam(rows,live,draft){
    const skaters=rankedPoolEntries(rows,false,live,draft),goalies=rankedPoolEntries(rows,true,live,draft);
    const chosen=[...skaters.filter(e=>C.bucket(e.player)==='F').slice(0,C.RULES.F),
      ...skaters.filter(e=>C.bucket(e.player)==='D').slice(0,C.RULES.D),...goalies.slice(0,C.RULES.G)];
    const players=C.sortRoster(chosen.map(entry=>{
      const owner=(rows||[]).find(row=>row.ownerId===entry.ownerId);
      const label=entry.isBot?'Undrafted ('+(owner?.teamName||'The Spare Parts')+')':entry.undrafted?'Undrafted':'Team: '+entry.ownerName;
      const goalies=C.bucket(entry.player)==='G'?goaliePortraits(entry.player.nhlTeam,live):[];
      return {...entry.player,dreamOwnerLabel:label,dreamGoalies:goalies};
    })),total=players.reduce((sum,p)=>sum+C.points(p),0);
    const ownerCounts=orderedRows((rows||[]).filter(row=>!row.isDream&&row.ownerId!=='dream-team')).map(row=>({
      ownerId:row.ownerId,ownerName:row.ownerName||C.OWNERS.find(owner=>owner.id===row.ownerId)?.name||row.ownerId,
      count:chosen.filter(entry=>entry.ownerId===row.ownerId).length
    }));
    ownerCounts.push({ownerId:null,ownerName:'Undrafted',count:chosen.filter(entry=>entry.undrafted).length});
    return {ownerId:'dream-team',ownerName:'The Dream Team',teamName:'The Dream Team',isDream:true,players,total,pts:total,ownerCounts};
  }
  function comparisonRows(rows,live,draft){
    return [...(rows||[]).filter(row=>!row.isDream&&row.ownerId!=='dream-team'),dreamTeam(rows,live,draft)];
  }
  function periodTeamRankings(rows,period){
    const ranked=(rows||[]).filter(row=>!row.isDream&&row.ownerId!=='dream-team').map(row=>{
      const fpts=(row.players||[]).reduce((sum,player)=>{
        const source=C.bucket(player)==='G' ? period?.teamGoalies?.[player.nhlTeam] : period?.players?.[String(player.id)];
        return sum+CoreNumber(source?.fpts??source?.fantasyPoints??(source?C.points(source):0));
      },0);
      return {...row,_periodFpts:fpts};
    }).sort((a,b)=>b._periodFpts-a._periodFpts||String(a.ownerName||'').localeCompare(String(b.ownerName||'')));
    return ranked.map((row,index,all)=>({...row,_periodRank:index&&row._periodFpts===all[index-1]._periodFpts?all.findIndex(x=>x._periodFpts===row._periodFpts)+1:index+1}));
  }
  function CoreNumber(value){return C.num(value);}
  function periodRankPanel(rows,period,title,subtitle){
    const ranked=periodTeamRankings(rows,period);
    const items=Array.from({length:Math.max(5,ranked.length)},(_,index)=>{
      const row=ranked[index];
      if(!row)return '<li class="is-empty"><b>'+(index+1)+'</b><span><strong>Awaiting team</strong><small>—</small></span><em>—</em></li>';
      const owner=C.OWNERS.find(o=>o.id===row.ownerId);
      return '<li><b>'+fmt(row._periodRank)+'</b><span><strong>'+esc(row.ownerName||owner?.name||row.ownerId)+'</strong></span><em>'+fmt(row._periodFpts)+' <small>FPTS</small></em></li>';
    }).join('');
    return '<section class="pool-v289-period-rank" aria-label="'+esc(title)+' fantasy team rankings"><div class="pool-v289-period-title"><h3>'+esc(title)+'</h3><span>'+esc(subtitle)+'</span></div><ol>'+items+'</ol></section>';
  }
  function orderedRows(rows){
    const rosterOrder=['nick','andrew','scott','chris','tyler','bot','dream-team'];
    return rosterOrder.map(id=>rows.find(r=>r.ownerId===id)).filter(Boolean);
  }
  function renderStandings(rows,draft,mode,live){
    rows=(rows||[]).filter(row=>!row.isDream&&row.ownerId!=='dream-team');
    const standingsMode=mode==='today'?'today':'season';
    const displayRows=standingsMode==='today'?todayStandingRows(rows,live):rows;
    const table='<table class="pool-stat-table pool-standings-table"><caption class="pool-visually-hidden">'+(standingsMode==='today'?'Today’s manager totals':'Manager season standings')+'. Parentheses show fantasy points earned from each scoring category.</caption><thead><tr><th class="pool-rank-cell" scope="col">#</th><th class="pool-name-cell" scope="col">Manager</th><th class="pool-fpts-cell pool-fpts-first" scope="col">Total<small>FPTS</small></th>'+statHeaders(skaterColumns)+'<th scope="col">Goalie<small>FPTS</small></th></tr></thead><tbody>'+displayRows.map(row=>{
      const totals=standingsMode==='today'?row._today:summary(row),rank=standingsMode==='today'?row._todayRank:row.rank,total=standingsMode==='today'?totals.total:row.total;
      return '<tr><td class="pool-rank-cell"><span class="pool-rank-badge">'+fmt(rank)+'</span></td><th class="pool-name-cell" scope="row"><button type="button" '+(row.isBot?'data-bot-compare aria-label="Compare the BOT roster"':'data-roster-owner="'+esc(row.ownerId)+'"')+' data-board-focus="standing-'+esc(row.ownerId)+'">'+esc(row.ownerName)+'</button></th><td class="pool-fpts-cell pool-fpts-first">'+fmt(total)+'</td>'+skaterColumns.map(([key])=>'<td>'+weighted(totals[key],key)+'</td>').join('')+'<td><strong class="pool-goalie-total">'+fmt(totals.goalieFpts)+'</strong></td></tr>';
    }).join('')+'</tbody></table>';
    const currentLabel=standingsMode==='today'?'TODAY’S SCORES':'SEASON STANDINGS';
    const header='<header class="pool-v280-standings-header pool-v287-standings-header"><div class="pool-v287-standings-heading"><h2>Standings</h2><div class="pool-v287-current-view"><span>Current View</span><strong>'+currentLabel+'</strong></div><div class="pool-v280-standings-controls">'+standingsSwitch(standingsMode)+'</div></div>'+topFantasyPanel(rows,false,live,draft)+topFantasyPanel(rows,true,live,draft)+'</header>';
    return '<section class="pool-standings pool-neon-module pool-v280-standings" aria-label="League standings">'+header+'<div class="pool-stat-scroll" data-scroll-key="standings" role="region" aria-label="Standings statistics" tabindex="0">'+table+'</div><div class="pool-module-foot"><span>'+(standingsMode==='today'?'Showing live fantasy points earned today only.':'Season totals · numbers in parentheses show fantasy points from that stat.')+'</span><span>'+(draft.picks?.length||0)+'/60 draft picks saved</span></div></section>';
  }
  function renderRosters(rows,draft,rosterState,live){
    const ordered=orderedRows(comparisonRows(rows,live,draft)),requested=rosterState||{left:'nick',right:'andrew',mode:'season'},mode=['yesterday','today','tomorrow'].includes(requested.mode)?requested.mode:'season';
    const left=ordered.find(r=>r.ownerId===requested.left)||ordered[0];
    const right=ordered.find(r=>r.ownerId===requested.right&&r.ownerId!==left?.ownerId)||ordered.find(r=>r.ownerId!==left?.ownerId)||left;
    const managerNav=ordered.map(row=>'<button type="button" data-roster-jump="'+esc(row.ownerId)+'">'+esc(row.ownerName)+'</button>').join('');
    const cards=ordered.map(row=>{
      const role=row.ownerId===left?.ownerId?'left':row.ownerId===right?.ownerId?'right':'',presentation=requested.views?.[row.ownerId];
      return mode!=='season'?matchupCard(row,live,role,mode,presentation):rosterCard(row,'roster',role,presentation,live);
    }).join('');
    const currentView=rosterCurrentView(mode,live);
    const desktopMast='<header class="pool-v289-roster-mast"><div class="pool-v289-roster-heading"><h2>Roster Comparison</h2><div class="pool-v289-roster-current-view"><span>Current View</span><strong>'+currentView+'</strong></div>'+modeSwitch(mode,live)+'</div>'+periodRankPanel(rows,live?.periods?.week,'This Week','Fantasy points')+periodRankPanel(rows,live?.periods?.month,'This Month','Fantasy points')+'</header>';
    const mobileMast='<header class="pool-rosters-mast pool-mobile-rosters-mast pool-v280-mobile-roster-header pool-v288-roster-header pool-v290-mobile-roster-mast"><div class="pool-v290-mobile-roster-heading"><h2>Roster Comparison</h2><div class="pool-v288-roster-current-view"><span>Current View</span><strong>'+currentView+'</strong></div></div>'+periodRankPanel(rows,live?.periods?.week,'This Week','Fantasy points')+periodRankPanel(rows,live?.periods?.month,'This Month','Fantasy points')+'</header>';
    return '<section class="pool-rosters pool-v280-rosters" aria-label="Roster comparison"><div class="pool-rosters-desktop-controls">'+desktopMast+'<div class="pool-compare-toolbar">'+comparePicker('left',left,ordered)+'<span class="pool-versus" aria-hidden="true">VS</span>'+comparePicker('right',right,ordered)+'</div></div><div class="pool-rosters-mobile-controls">'+mobileMast+modeSwitch(mode,live)+'<nav class="pool-roster-jumpbar" aria-label="Jump to manager roster">'+managerNav+'</nav></div><div class="pool-roster-track pool-v275-roster-track pool-v276-roster-track" data-scroll-key="roster-track">'+cards+'</div></section>';
  }
  function render(rows,draft,compareState,live){
    const requested=compareState||{left:'nick',right:'andrew',mode:'season',standingsMode:'season'};
    const mode=['yesterday','today','tomorrow'].includes(requested.mode)?requested.mode:'season',standingsMode=requested.standingsMode==='today'?'today':'season';
    return '<div class="pool-v280-dashboard" data-v280-dashboard data-roster-mode="'+mode+'" data-standings-mode="'+standingsMode+'"><div class="pool-v280-standings-host" data-v280-standings-host>'+renderStandings(rows,draft,standingsMode,live)+'</div><div class="pool-v280-rosters-host" data-v280-rosters-host>'+renderRosters(rows,draft,{left:requested.left,right:requested.right,mode,views:requested.views},live)+'</div><div class="pool-v273-record">'+(draft.locked?'<button type="button" data-view-final-draft data-board-focus="final-draft">✓ Final draft locked · View complete draft record ↗</button>':'<span>Draft in progress · live rosters update automatically</span>')+'</div></div>';
  }
  function dateLabel(v){const s=String(v||'');if(!/^\d{4}-\d{2}-\d{2}/.test(s))return s||'—';const [y,m,d]=s.slice(0,10).split('-').map(Number);return new Intl.DateTimeFormat('en-CA',{month:'short',day:'numeric'}).format(new Date(y,m-1,d));}
  function cardGameStatus(game){
    const state=String(game?.state||'').toUpperCase(),type=String(game?.periodType||'').toUpperCase();
    if(['OFF','FINAL'].includes(state))return 'Final'+(type==='SO'?' / SO':type==='OT'||C.num(game.period)>3?' / OT':'');
    if(['LIVE','CRIT'].includes(state))return 'Live · '+(type==='SO'?'Shootout':type==='OT'||C.num(game.period)>3?'OT':'P'+fmt(game.period||1))+(game.inIntermission?' · Intermission':game.timeRemaining?' · '+game.timeRemaining:'');
    if(['FUT','PRE'].includes(state))return 'Scheduled';
    return state==='SUSP'?'Suspended':state==='PPD'?'Postponed':'Score unavailable';
  }
  function cardGameScoreline(game){
    if(!game?.away||!game?.home)return '';
    if(['FUT','PRE','PPD'].includes(String(game.state).toUpperCase()))return esc(game.away)+' <span class="pool-card-score-pending">vs</span> '+esc(game.home);
    const score=value=>value!==null&&value!==undefined&&Number.isFinite(Number(value))?fmt(value):'—';
    return esc(game.away)+' <b>'+score(game.awayScore)+'</b> <span aria-hidden="true">–</span> <b>'+score(game.homeScore)+'</b> '+esc(game.home);
  }
  function cardGameScore(data){
    const game=data.currentGame;if(!game?.away||!game?.home)return '';
    const live=['LIVE','CRIT'].includes(String(game.state).toUpperCase());
    return '<section class="pool-card-game-score'+(live?' is-live':'')+'" aria-label="NHL game score"><div class="pool-card-score-status"><span>'+esc(cardGameStatus(game))+'</span><span>'+esc(dateLabel(game.date))+'</span></div><div class="pool-card-scoreline">'+cardGameScoreline(game)+'</div><small data-card-refresh-status>'+(live?'Game score refreshes automatically':game.isToday?'Today’s NHL game':'Most recent NHL game')+'</small></section>';
  }
  function cardStatsTable(data){
    const goalie=data.type==='teamGoalie',cols=goalie?goalieColumns:skaterColumns;
    const games=(data.last5||[]).slice(0,5);
    while(games.length<5)games.push({tbp:true});
    const rows=games.map(g=>{
      if(g.tbp)return '<tr class="is-tbp"><td><strong>TBP</strong></td><td>TO BE PLAYED</td><td>—</td>'+cols.map(()=>'<td>—</td>').join('')+'</tr>';
      const result=g.result?'<span class="pool-card-game-result'+(g.live?' is-live':'')+'">'+cardGameScoreline(g.result)+'<br>'+esc(cardGameStatus(g.result))+'</span>':'<span class="pool-card-game-result">Score unavailable</span>';
      return '<tr'+(g.live?' class="is-live"':'')+'><td>'+esc(dateLabel(g.date))+(g.live?'<small>LIVE</small>':'')+'</td><td>'+esc(g.label||('vs '+(g.opponent||'')))+result+'</td><td><strong>'+fmt(g.fpts)+'</strong></td>'+cols.map(([key])=>'<td>'+fmt(stat(g,key))+'</td>').join('')+'</tr>';
    }).join('');
    return '<div class="pool-card-last-five"><h4>LAST 5 GAMES</h4><div class="pool-card-table-scroll"><table><thead><tr><th>DATE</th><th>GAME</th><th>FPTS</th>'+cols.map(([,short])=>'<th>'+esc(short)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div></div>';
  }
  function rollingBlock(label,row,goalie){const cols=goalie?goalieColumns:skaterColumns;return '<section class="pool-card-roll"><span>'+esc(label)+'</span><strong>'+fmt(row?.fpts||0)+' FPTS</strong><small>'+cols.map(([key,short])=>esc(short)+' '+fmt(stat(row||{},key))).join(' · ')+'</small></section>';}
  function fantasyDraftLine(data){
    const f=data?.fantasyDraft;if(!f)return 'Fantasy draft information unavailable';
    if(f.isBot)return 'Selected for BOT from the undrafted pool. The original draft is unchanged.';
    if(f.undrafted)return 'Undrafted in our pool.';
    const owners=Array.isArray(C.OWNERS)?C.OWNERS:[];
    const byId=owners.find(o=>String(o.id||'').toLowerCase()===String(f.ownerId||'').toLowerCase());
    const byTeam=owners.find(o=>String(o.teamName||'').toLowerCase()===String(f.teamName||'').toLowerCase());
    const byName=owners.find(o=>String(o.name||'').toLowerCase()===String(f.ownerName||'').toLowerCase());
    const manager=(byName||byId||byTeam)?.name||'Manager';
    return 'Fantasy drafted by '+manager+' — Round '+fmt(f.round)+', Pick '+fmt(f.pick)+'.';
  }
  function nhlDraftLine(identity){
    const d=identity?.nhlDraft;
    if(!d || d.undrafted)return 'NHL Draft: Undrafted.';
    const team=d.teamName||d.team||'NHL team';
    return 'Drafted in the NHL by the '+team+' — Round '+fmt(d.round)+', Pick '+fmt(d.pick)+'.';
  }
  function countryName(code){
    const key=String(code||'').toUpperCase();
    const names={CAN:'Canada',USA:'United States',SWE:'Sweden',FIN:'Finland',RUS:'Russia',CZE:'Czechia',SVK:'Slovakia',CHE:'Switzerland',DEU:'Germany',AUT:'Austria',LVA:'Latvia',NOR:'Norway',DNK:'Denmark',BLR:'Belarus',FRA:'France',GBR:'United Kingdom',SVN:'Slovenia',KAZ:'Kazakhstan',UKR:'Ukraine'};
    return names[key]||key||'—';
  }
  function heightLabel(inches){const n=Number(inches)||0;return n?Math.floor(n/12)+"' "+(n%12)+'\"':'—';}
  function dateOfBirthLabel(value){
    const s=String(value||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s||'—';
    const [y,m,d]=s.split('-').map(Number);return new Intl.DateTimeFormat('en-CA',{month:'short',day:'numeric',year:'numeric'}).format(new Date(y,m-1,d));
  }
  function ageFromBirthDate(value){
    const s=String(value||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return '—';
    const [y,m,d]=s.split('-').map(Number),now=new Date();let age=now.getFullYear()-y;
    if(now.getMonth()+1<m || (now.getMonth()+1===m && now.getDate()<d))age--;return age>=0?String(age):'—';
  }
  function shootsLabel(v){const s=String(v||'').toUpperCase();return s==='L'?'Left':s==='R'?'Right':s||'—';}
  function cardBio(identity,logo){
    const b=identity?.bio||{};
    const birthplace=[b.birthCity,countryName(b.birthCountry)].filter(Boolean).join(', ')||'—';
    const items=[['JERSEY',b.jerseyNumber?('#'+b.jerseyNumber):'—'],['HEIGHT',heightLabel(b.heightInInches)],['WEIGHT',b.weightInPounds?(b.weightInPounds+' lbs'):'—'],['SHOOTS',shootsLabel(b.shootsCatches)],['BORN',birthplace],['DOB',dateOfBirthLabel(b.birthDate)],['AGE',ageFromBirthDate(b.birthDate)]];
    const badge=logo?'<div class="pool-opc-bio-logo"><img src="'+esc(logo)+'" alt="" onerror="this.style.display=\'none\'"></div>':'';
    return '<aside class="pool-opc-bio" aria-label="Player bio">'+badge+'<div class="pool-opc-bio-grid">'+items.map(([k,v])=>'<div><span>'+k+'</span><strong>'+esc(v)+'</strong></div>').join('')+'</div></aside>';
  }
  function cardSeasonTotals(data){
    const goalie=data?.type==='teamGoalie',row=data?.seasonTotals||{},cols=goalie?goalieColumns:skaterColumns;
    return '<section class="pool-card-season-totals"><h4>CURRENT SEASON TOTALS</h4><div class="pool-card-season-grid"><div class="is-fpts"><span>FPTS</span><strong>'+fmt(row?.fpts??row?.fantasyPoints??0)+'</strong></div>'+cols.map(([key,short])=>'<div><span>'+esc(short)+'</span><strong>'+fmt(stat(row,key))+'</strong></div>').join('')+'</div></section>';
  }
  function rankCopy(data,goalie){
    const r=data?.fantasyRank;if(!r?.rank)return '';
    return ' · RANKED #'+fmt(r.rank)+' IN FANTASY PTS';
  }
  function cardMarkup(data){
    const goalie=data.type==='teamGoalie',identity=goalie?data.team:data.player||{},name=goalie?(identity.name||identity.code||'Team Goalies'):(identity.name||'Player'),team=goalie?(identity.code||''):(identity.team||''),logo=goalie?identity.logo:identity.teamLogo;
    const [primary,secondary,accent]=teamPalette(team);
    const cardStyle='--opc-team-primary:'+primary+';--opc-team-secondary:'+secondary+';--opc-team-accent:'+accent+';--opc-team-on-primary:'+contrastInk(primary)+';';
    const cardNumber=goalie?team:String(identity?.id||'96').slice(-3);
    const hero=goalie?'<div class="pool-opc-goalie-collage">'+((data.goalies||[]).map((g,i)=>'<figure style="--i:'+i+'"><img src="'+esc(g.headshot)+'" alt="'+esc(g.name)+'" onerror="this.style.display=\'none\'"><figcaption>'+esc(g.name)+'</figcaption></figure>').join('')||'<div class="pool-card-no-photo">No goalie appearance yet</div>')+'</div>':'<div class="pool-opc-photo"><img src="'+esc(identity?.headshot||'')+'" alt="'+esc(name)+'" onerror="this.style.display=\'none\'"></div>'+cardBio(identity,logo);
    const draftCopy=goalie?'<p class="pool-opc-draft-line pool-opc-fantasy-draft">'+esc(fantasyDraftLine(data))+'</p>':'<p class="pool-opc-draft-line">'+esc(nhlDraftLine(identity))+'</p><p class="pool-opc-draft-line pool-opc-fantasy-draft">'+esc(fantasyDraftLine(data))+'</p>';
    const teamLabel=goalie?(identity.name||identity.code||'Team Goalies'):(C.TEAMS?.[team]||team);
    const positionLine=esc(goalie?'GOALTENDER UNIT · '+teamLabel:((identity?.position||'PLAYER')+' · '+teamLabel))+esc(rankCopy(data,goalie));
    const goalieLogo=goalie?'<div class="pool-opc-logo-block"><img src="'+esc(logo||'')+'" alt="" onerror="this.style.display=\'none\'"></div>':'';
    const watermark=logo?'<img class="pool-opc-watermark" src="'+esc(logo)+'" alt="" aria-hidden="true" onerror="this.style.display=\'none\'">':'';
    return '<article class="pool-opc-card '+(goalie?'is-goalie-unit':'')+'" data-nhl-team="'+esc(team)+'" style="'+esc(cardStyle)+'">'+watermark+'<header class="pool-opc-brand"><span class="pool-opc-number">#'+esc(cardNumber||'96')+'</span><strong class="pool-opc-top-name">'+esc(name)+'</strong><i class="pool-opc-stripes" aria-hidden="true"></i></header><div class="pool-opc-frame"><div class="pool-opc-hero">'+hero+goalieLogo+'</div><div class="pool-opc-position">'+positionLine+'</div><div class="pool-opc-draft-copy">'+draftCopy+'</div>'+cardGameScore(data)+cardSeasonTotals(data)+cardStatsTable(data)+'<div class="pool-card-rolling"><h4>RECENT FORM</h4><div>'+rollingBlock('LAST 10',data.last10,goalie)+rollingBlock('LAST 25',data.last25,goalie)+'</div></div></div><footer><span>'+esc(C.seasonLabel(data.season||''))+'</span><strong>FANTASY GAME LOG</strong><span>'+esc(goalie?team:'#'+(identity?.id||''))+'</span></footer></article>';
  }

  return {render,renderStandings,renderRosters,rosterCard,rosterGroup,matchupCard,matchupGroup,iceRinkCard,rosterPresentation,summary,stat,dayPayload,gameForTeam,dailyLine,todayLine,todaySummary,todayStandingRows,rankedPoolEntries,topFantasyEntries,poolRankFor,dreamTeam,comparisonRows,periodTeamRankings,periodRankPanel,matchupDateLabel,rosterCurrentView,cardMarkup,owners:C.OWNERS,escape:esc};
});
