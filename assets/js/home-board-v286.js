/* v286: larger bio crest and manager-name fantasy draft attribution. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./pool-core'));
  else {
    const view = factory(root.PoolCore);
    const doc = root.document;
    const core = root.PoolCore;
    let latest = null;
    const standingsState = { mode: 'season' };
    const rosterState = { left: 'nick', right: 'andrew', mode: 'season' };

    function availableIds(rows) {
      const order = ['nick','andrew','scott','chris','tyler'];
      return order.filter(id => (rows || []).some(row => row.ownerId === id));
    }
    function normalizeRosterState() {
      if (!latest) return;
      const ids = availableIds(latest.rows);
      if (!ids.length) return;
      if (!ids.includes(rosterState.left)) rosterState.left = ids[0];
      if (!ids.includes(rosterState.right) || rosterState.right === rosterState.left) {
        rosterState.right = ids.find(id => id !== rosterState.left) || rosterState.left;
      }
      if (rosterState.mode !== 'tonight') rosterState.mode = 'season';
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
      return dialog;
    }
    function fantasyRankFor(playerKey, kind) {
      if (!latest) return null;
      const goalie = kind === 'teamGoalie';
      const entries = [];
      (latest.rows || []).forEach(row => (row.players || []).forEach(player => {
        const isGoalie = String(player?.position || '').toUpperCase() === 'TG' || String(player?.id || '').startsWith('TG-');
        if (isGoalie !== goalie) return;
        entries.push({ id: String(player?.id || ''), name: String(player?.name || ''), fpts: Number(core?.points?.(player) || 0) });
      }));
      entries.sort((a,b) => b.fpts - a.fpts || a.name.localeCompare(b.name));
      let previous = null, rank = 0;
      for (let i=0;i<entries.length;i++) {
        if (previous === null || entries[i].fpts !== previous) rank = i + 1;
        entries[i].rank = rank; previous = entries[i].fpts;
      }
      const found = entries.find(entry => entry.id === String(playerKey || ''));
      return found ? { rank: found.rank, fieldSize: entries.length, fpts: found.fpts, scope: goalie ? 'teamGoalies' : 'skaters' } : null;
    }

    async function openPlayerCard(trigger) {
      if (!latest) return;
      const dialog = ensureCardDialog();
      const content = dialog.querySelector('#playerStatCardContent');
      content.innerHTML = '<div class="pool-card-loading"><span></span><strong>Pulling the last games from the NHL…</strong></div>';
      if (!dialog.open) dialog.showModal();
      const q = new URLSearchParams({ mode: 'card', season: latest.draft.seasonId });
      if (trigger.dataset.cardKind === 'teamGoalie') { q.set('type','teamGoalie'); q.set('team', trigger.dataset.team || ''); }
      else { q.set('type','skater'); q.set('playerId', trigger.dataset.playerId || ''); }
      try {
        const response = await fetch('/api/nhl?' + q.toString(), { headers: { accept: 'application/json' }, cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.error) throw new Error(payload.error || 'Player card could not be loaded.');
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
        content.innerHTML = view.cardMarkup(payload);
      } catch (error) {
        content.innerHTML = '<div class="pool-card-error"><strong>Card temporarily unavailable</strong><p>' + view.escape(error.message || 'Try again shortly.') + '</p></div>';
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
      const toggle = host.querySelector('[data-v280-standings-toggle]');
      if (toggle) toggle.addEventListener('click', event => {
        event.preventDefault();
        standingsState.mode = standingsState.mode === 'today' ? 'season' : 'today';
        renderStandingsHost(host);
      });
    }
    function bindRosters(host) {
      host.querySelectorAll('[data-v280-roster-toggle]').forEach(toggle => toggle.addEventListener('click', event => {
        event.preventDefault();
        rosterState.mode = rosterState.mode === 'tonight' ? 'season' : 'tonight';
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
      latest = { rows: rows || [], draft: draft || {}, live: live || null };
      normalizeRosterState();
      boardRoots().forEach(renderRoot);
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
  const skaterColumns = [['goals','G','Goals'],['assists','A','Assists'],['shortHandedGoals','SHG','Shorthanded Goals'],['gameWinningGoals','GWG','Game-Winning Goals']];
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
  function cardTrigger(p,goalie,subline){const label=goalie?String(p.name||'').replace(/\s+Goalies$/i,''):p.name;return '<button type="button" class="pool-player-card-trigger" data-player-card data-card-kind="'+(goalie?'teamGoalie':'skater')+'" data-player-id="'+esc(p.id)+'" data-team="'+esc(p.nhlTeam||'')+'" aria-label="Open recent games card for '+esc(label)+'">'+playerImage(p)+'<span class="pool-player-copy"><strong>'+esc(label)+'</strong><small>'+esc(subline??p.nhlTeam??'')+'</small></span></button>';}
  function rosterGroup(players,bucket,label,ownerId,instance){
    const roster=C.sortRoster(players).filter(p=>C.bucket(p)===bucket),columns=bucket==='G'?goalieColumns:skaterColumns,first=bucket==='G'?'Team Goalies':'Player Name';
    const table='<table class="pool-stat-table pool-roster-table"><caption class="pool-visually-hidden">'+esc(label)+' stats. Parentheses show fantasy-point contribution.</caption><thead><tr><th class="pool-name-cell" scope="col">'+first+'</th><th class="pool-fpts-cell pool-fpts-first" scope="col">FPTS <small>TOTAL</small></th>'+statHeaders(columns)+'</tr></thead><tbody>'+
      (roster.map(p=>'<tr class="pool-player" data-player-id="'+esc(p.id)+'"><th class="pool-name-cell" scope="row" title="'+esc(p.name)+'">'+cardTrigger(p,bucket==='G')+'</th><td class="pool-fpts-cell pool-fpts-first">'+fmt(C.points(p))+'</td>'+columns.map(([key])=>'<td>'+weighted(stat(p,key),key)+'</td>').join('')+'</tr>').join('')||'<tr><td colspan="6" class="pool-empty">No selections yet.</td></tr>')+'</tbody></table>';
    return '<section class="pool-position" data-position="'+bucket+'"><h4><span>'+esc(label)+'</span><em>'+roster.length+'</em></h4><div class="pool-stat-scroll" data-scroll-key="'+esc((instance||'roster')+'-'+(ownerId||'')+'-'+bucket)+'" role="region" aria-label="'+esc(label)+' statistics" tabindex="0">'+table+'</div></section>';
  }
  function mobileCardArrow(dir){return '<button type="button" class="pool-mobile-card-arrow" data-v280-mobile-shift="'+dir+'" aria-label="'+(dir<0?'Previous':'Next')+' team">'+(dir<0?'‹':'›')+'</button>';}
  function rosterCard(row,instance,compareRole){if(!row)return'';const champion=row.ownerId==='andrew'?' data-champion="true"':'',compareAttr=compareRole?' data-compare-role="'+esc(compareRole)+'"':'';return '<article class="pool-roster"'+compareAttr+champion+' data-owner="'+esc(row.ownerId)+'" aria-label="'+esc(row.ownerName)+' roster"><header class="pool-roster-heading">'+mobileCardArrow(-1)+'<div class="pool-roster-heading-center"><span class="pool-roster-kicker">MANAGER ROSTER</span><h3><button type="button" data-roster-owner="'+esc(row.ownerId)+'" data-board-focus="roster-'+esc(row.ownerId)+'" title="Open '+esc(row.ownerName)+' roster room">'+esc(row.ownerName)+' <span class="pool-room-arrow" aria-hidden="true">↗</span></button></h3><small class="pool-mobile-roster-total">'+fmt(row.total)+' FPTS</small></div><span class="pool-roster-total"><b>'+fmt(row.total)+'</b><small>FPTS</small></span>'+mobileCardArrow(1)+'</header>'+rosterGroup(row.players,'F','Forwards',row.ownerId,instance)+rosterGroup(row.players,'D','Defence',row.ownerId,instance)+rosterGroup(row.players,'G','Team Goalies',row.ownerId,instance)+'</article>';}
  function gameForTeam(team,live){return(live?.today?.games||[]).find(game=>game.away===team||game.home===team)||null;}
  function gameStatus(game,team){if(!game)return'';const opponent=game.away===team?game.home:game.away,venue=game.away===team?'@ ':'vs ',state=String(game.state||'').toUpperCase();if(['FINAL','OFF'].includes(state))return venue+opponent+' · FINAL '+fmt(game.awayScore)+'–'+fmt(game.homeScore);if(!['FUT','PRE'].includes(state)){const period=game.period?'P'+game.period:'LIVE',clock=game.timeRemaining?' '+game.timeRemaining:'';return venue+opponent+' · '+period+clock+' · '+fmt(game.awayScore)+'–'+fmt(game.homeScore);}if(game.startTimeUTC){const time=new Date(game.startTimeUTC).toLocaleTimeString('en-CA',{hour:'numeric',minute:'2-digit'});return venue+opponent+' · '+time;}return venue+opponent+' · Tonight';}
  function todayLine(p,live){if(C.bucket(p)==='G'){const row=live?.today?.teamGoalies?.[p.nhlTeam]||{};return{position:'TG',goalieWins:stat(row,'goalieWins'),goalieAssists:stat(row,'goalieAssists'),goalieGoals:stat(row,'goalieGoals'),goalieShutouts:stat(row,'goalieShutouts'),fpts:C.points({position:'TG',...row})};}const row=live?.today?.players?.[String(p.id)]||{};return{goals:stat(row,'goals'),assists:stat(row,'assists'),shortHandedGoals:stat(row,'shortHandedGoals'),gameWinningGoals:stat(row,'gameWinningGoals'),fpts:C.points(row)};}
  function todaySummary(row,live){const totals={goals:0,assists:0,shortHandedGoals:0,gameWinningGoals:0,goalieFpts:0,total:0};for(const p of row.players){const line=todayLine(p,live);if(C.bucket(p)==='G')totals.goalieFpts+=line.fpts;else skaterColumns.forEach(([key])=>totals[key]+=stat(line,key));totals.total+=line.fpts;}return totals;}
  function todayStandingRows(rows,live){const out=rows.map(row=>({...row,_today:todaySummary(row,live)})).sort((a,b)=>b._today.total-a._today.total||a.ownerName.localeCompare(b.ownerName));return out.map((r,i,all)=>({...r,_todayRank:i&&r._today.total===all[i-1]._today.total?all.findIndex(x=>x._today.total===r._today.total)+1:i+1}));}
  function matchupRows(row,live,bucket){return C.sortRoster(row.players).filter(p=>C.bucket(p)===bucket&&gameForTeam(p.nhlTeam,live));}
  function matchupGroup(row,live,bucket,label,instance){const roster=matchupRows(row,live,bucket),goalie=bucket==='G',columns=goalie?goalieColumns:skaterColumns;const table='<table class="pool-stat-table pool-roster-table pool-matchup-table"><caption class="pool-visually-hidden">'+esc(label)+' playing tonight and live fantasy stats for today.</caption><thead><tr><th class="pool-name-cell" scope="col">'+(goalie?'Team Goalies':'Player Name')+'</th><th class="pool-fpts-cell pool-fpts-first" scope="col">TODAY <small>FPTS</small></th>'+statHeaders(columns)+'</tr></thead><tbody>'+(roster.map(p=>{const line=todayLine(p,live),game=gameForTeam(p.nhlTeam,live);return '<tr class="pool-player pool-tonight-player" data-player-id="'+esc(p.id)+'"><th class="pool-name-cell" scope="row">'+cardTrigger(p,goalie,gameStatus(game,p.nhlTeam))+'</th><td class="pool-fpts-cell pool-fpts-first">'+fmt(line.fpts)+'</td>'+columns.map(([key])=>'<td>'+weighted(stat(line,key),key)+'</td>').join('')+'</tr>';}).join('')||'<tr><td colspan="6" class="pool-empty pool-tonight-empty">No drafted '+esc(label.toLowerCase())+' are scheduled tonight.</td></tr>')+'</tbody></table>';return '<section class="pool-position pool-matchup-position" data-position="'+bucket+'"><h4><span>'+esc(label)+' Tonight</span><em>'+roster.length+'</em></h4><div class="pool-stat-scroll" data-scroll-key="'+esc((instance||'tonight')+'-'+row.ownerId+'-'+bucket)+'" role="region" aria-label="'+esc(label)+' playing tonight" tabindex="0">'+table+'</div></section>';}
  function matchupCard(row,live,compareRole){if(!row)return'';const champion=row.ownerId==='andrew'?' data-champion="true"':'',compareAttr=compareRole?' data-compare-role="'+esc(compareRole)+'"':'',all=['F','D','G'].flatMap(bucket=>matchupRows(row,live,bucket)),todayTotal=all.reduce((s,p)=>s+todayLine(p,live).fpts,0);return '<article class="pool-roster pool-matchup-card"'+compareAttr+champion+' data-owner="'+esc(row.ownerId)+'" aria-label="'+esc(row.ownerName)+' tonight"><header class="pool-roster-heading">'+mobileCardArrow(-1)+'<div class="pool-roster-heading-center"><span class="pool-roster-kicker">TONIGHT’S MATCHUP</span><h3>'+esc(row.ownerName)+'</h3><small class="pool-tonight-count">'+all.length+' drafted selection'+(all.length===1?'':'s')+' scheduled</small><small class="pool-mobile-roster-total">'+fmt(todayTotal)+' TODAY FPTS</small></div><span class="pool-roster-total"><b>'+fmt(todayTotal)+'</b><small>TODAY FPTS</small></span>'+mobileCardArrow(1)+'</header>'+matchupGroup(row,live,'F','Forwards','tonight')+matchupGroup(row,live,'D','Defence','tonight')+matchupGroup(row,live,'G','Team Goalies','tonight')+'</article>';}
  function comparePicker(side,row,rows){if(!row)return'';return '<div class="pool-compare-picker pool-v280-picker" data-compare-picker="'+side+'"><button type="button" data-v280-compare-shift="-1" data-compare-side="'+side+'" aria-label="Previous manager on '+side+'">‹</button><div><span>'+(side==='left'?'TEAM ONE':'TEAM TWO')+'</span><strong>'+esc(row.ownerName)+'</strong></div><button type="button" data-v280-compare-shift="1" data-compare-side="'+side+'" aria-label="Next manager on '+side+'">›</button></div>';}
  function modeSwitch(mode,live){
    const tonight=mode==='tonight',games=live?.today?.games?.length||0;
    return '<div class="pool-matchup-switch pool-roster-mode-switch pool-v280-roster-switch"><button type="button" data-v280-roster-toggle aria-pressed="'+(tonight?'true':'false')+'"><span class="pool-matchup-switch-icon" aria-hidden="true">'+(tonight?'↩':'⚡')+'</span><span><strong>'+(tonight?'Season Totals':'Tonight’s Matchup')+'</strong><small>'+(tonight?'Return only these roster cards to season totals':(games?games+' NHL game'+(games===1?'':'s')+' on today’s slate':'Show only these roster cards’ players who play tonight'))+'</small></span></button></div>';
  }
  function standingsSwitch(mode){
    const today=mode==='today';
    return '<button type="button" class="pool-standings-mode pool-v280-standings-toggle" data-v280-standings-toggle aria-pressed="'+(today?'true':'false')+'"><span aria-hidden="true">'+(today?'↩':'☀')+'</span><strong>'+(today?'Season Totals':'Today’s Totals')+'</strong></button>';
  }
  function orderedRows(rows){
    const rosterOrder=['nick','andrew','scott','chris','tyler'];
    return rosterOrder.map(id=>rows.find(r=>r.ownerId===id)).filter(Boolean);
  }
  function renderStandings(rows,draft,mode,live){
    const standingsMode=mode==='today'?'today':'season';
    const displayRows=standingsMode==='today'?todayStandingRows(rows,live):rows;
    const table='<table class="pool-stat-table pool-standings-table"><caption class="pool-visually-hidden">'+(standingsMode==='today'?'Today’s manager totals':'Manager season standings')+'. Parentheses show fantasy points earned from each scoring category.</caption><thead><tr><th class="pool-rank-cell" scope="col">#</th><th class="pool-name-cell" scope="col">Manager</th><th class="pool-fpts-cell pool-fpts-first" scope="col">Total<small>FPTS</small></th>'+statHeaders(skaterColumns)+'<th scope="col">Goalie<small>FPTS</small></th></tr></thead><tbody>'+displayRows.map(row=>{
      const totals=standingsMode==='today'?row._today:summary(row),rank=standingsMode==='today'?row._todayRank:row.rank,total=standingsMode==='today'?totals.total:row.total;
      return '<tr><td class="pool-rank-cell"><span class="pool-rank-badge">'+fmt(rank)+'</span></td><th class="pool-name-cell" scope="row"><button type="button" data-roster-owner="'+esc(row.ownerId)+'" data-board-focus="standing-'+esc(row.ownerId)+'">'+esc(row.ownerName)+'</button></th><td class="pool-fpts-cell pool-fpts-first">'+fmt(total)+'</td>'+skaterColumns.map(([key])=>'<td>'+weighted(totals[key],key)+'</td>').join('')+'<td><strong class="pool-goalie-total">'+fmt(totals.goalieFpts)+'</strong></td></tr>';
    }).join('')+'</tbody></table>';
    return '<section class="pool-standings pool-neon-module pool-v280-standings" aria-label="League standings"><header class="pool-v280-standings-header"><h2>Standings</h2><div class="pool-v280-standings-controls">'+standingsSwitch(standingsMode)+'</div></header><div class="pool-stat-scroll" data-scroll-key="standings" role="region" aria-label="Standings statistics" tabindex="0">'+table+'</div><div class="pool-module-foot"><span>'+(standingsMode==='today'?'Showing live fantasy points earned today only.':'Season totals · numbers in parentheses show fantasy points from that stat.')+'</span><span>'+(draft.picks?.length||0)+'/60 draft picks saved</span></div></section>';
  }
  function renderRosters(rows,draft,rosterState,live){
    const ordered=orderedRows(rows),requested=rosterState||{left:'nick',right:'andrew',mode:'season'},mode=requested.mode==='tonight'?'tonight':'season';
    const left=ordered.find(r=>r.ownerId===requested.left)||ordered[0];
    const right=ordered.find(r=>r.ownerId===requested.right&&r.ownerId!==left?.ownerId)||ordered.find(r=>r.ownerId!==left?.ownerId)||left;
    const managerNav=ordered.map(row=>'<button type="button" data-roster-jump="'+esc(row.ownerId)+'">'+esc(row.ownerName)+'</button>').join('');
    const cards=ordered.map(row=>mode==='tonight'?matchupCard(row,live,row.ownerId===left?.ownerId?'left':(row.ownerId===right?.ownerId?'right':'')):rosterCard(row,'roster',row.ownerId===left?.ownerId?'left':(row.ownerId===right?.ownerId?'right':''))).join('');
    return '<section class="pool-rosters pool-v280-rosters" aria-label="Roster comparison"><div class="pool-rosters-desktop-controls"><header class="pool-rosters-mast pool-compare-mast pool-v280-roster-header"><div><h2>Roster Comparison</h2><span>'+(mode==='tonight'?'Tonight’s live roster stats':'Season totals')+'</span></div></header>'+modeSwitch(mode,live)+'<div class="pool-compare-toolbar">'+comparePicker('left',left,ordered)+'<span class="pool-versus" aria-hidden="true">VS</span>'+comparePicker('right',right,ordered)+'</div></div><div class="pool-rosters-mobile-controls"><header class="pool-rosters-mast pool-mobile-rosters-mast pool-v280-mobile-roster-header"><div><h2>Roster Comparison</h2><span>'+(mode==='tonight'?'Tonight’s live roster stats':'Season totals')+'</span></div></header>'+modeSwitch(mode,live)+'<nav class="pool-roster-jumpbar" aria-label="Jump to manager roster">'+managerNav+'</nav></div><div class="pool-roster-track pool-v275-roster-track pool-v276-roster-track" data-scroll-key="roster-track">'+cards+'</div></section>';
  }
  function render(rows,draft,compareState,live){
    const requested=compareState||{left:'nick',right:'andrew',mode:'season',standingsMode:'season'};
    const mode=requested.mode==='tonight'?'tonight':'season',standingsMode=requested.standingsMode==='today'?'today':'season';
    return '<div class="pool-v280-dashboard" data-v280-dashboard data-roster-mode="'+mode+'" data-standings-mode="'+standingsMode+'"><div class="pool-v280-standings-host" data-v280-standings-host>'+renderStandings(rows,draft,standingsMode,live)+'</div><div class="pool-v280-rosters-host" data-v280-rosters-host>'+renderRosters(rows,draft,{left:requested.left,right:requested.right,mode},live)+'</div><div class="pool-v273-record">'+(draft.locked?'<button type="button" data-view-final-draft data-board-focus="final-draft">✓ Final draft locked · View complete draft record ↗</button>':'<span>Draft in progress · live rosters update automatically</span>')+'</div></div>';
  }
  function dateLabel(v){const s=String(v||'');if(!/^\d{4}-\d{2}-\d{2}/.test(s))return s||'—';const [y,m,d]=s.slice(0,10).split('-').map(Number);return new Intl.DateTimeFormat('en-CA',{month:'short',day:'numeric'}).format(new Date(y,m-1,d));}
  function cardStatsTable(data){
    const goalie=data.type==='teamGoalie',cols=goalie?goalieColumns:skaterColumns;
    const games=(data.last5||[]).slice(0,5);
    while(games.length<5)games.push({tbp:true});
    const rows=games.map(g=>{
      if(g.tbp)return '<tr class="is-tbp"><td><strong>TBP</strong></td><td>TO BE PLAYED</td><td>—</td>'+cols.map(()=>'<td>—</td>').join('')+'</tr>';
      return '<tr'+(g.live?' class="is-live"':'')+'><td>'+esc(dateLabel(g.date))+(g.live?'<small>LIVE</small>':'')+'</td><td>'+esc(g.label||('vs '+(g.opponent||'')))+'</td><td><strong>'+fmt(g.fpts)+'</strong></td>'+cols.map(([key])=>'<td>'+fmt(stat(g,key))+'</td>').join('')+'</tr>';
    }).join('');
    return '<div class="pool-card-last-five"><h4>LAST 5 GAMES</h4><div class="pool-card-table-scroll"><table><thead><tr><th>DATE</th><th>GAME</th><th>FPTS</th>'+cols.map(([,short])=>'<th>'+esc(short)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div></div>';
  }
  function rollingBlock(label,row,goalie){const cols=goalie?goalieColumns:skaterColumns;return '<section class="pool-card-roll"><span>'+esc(label)+'</span><strong>'+fmt(row?.fpts||0)+' FPTS</strong><small>'+cols.map(([key,short])=>esc(short)+' '+fmt(stat(row||{},key))).join(' · ')+'</small></section>';}
  function fantasyDraftLine(data){
    const f=data?.fantasyDraft;if(!f)return 'Fantasy draft information unavailable';
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
    return '<article class="pool-opc-card '+(goalie?'is-goalie-unit':'')+'" data-nhl-team="'+esc(team)+'" style="'+esc(cardStyle)+'">'+watermark+'<header class="pool-opc-brand"><span class="pool-opc-number">#'+esc(cardNumber||'96')+'</span><strong class="pool-opc-top-name">'+esc(name)+'</strong><i class="pool-opc-stripes" aria-hidden="true"></i></header><div class="pool-opc-frame"><div class="pool-opc-hero">'+hero+goalieLogo+'</div><div class="pool-opc-position">'+positionLine+'</div><div class="pool-opc-draft-copy">'+draftCopy+'</div>'+cardSeasonTotals(data)+cardStatsTable(data)+'<div class="pool-card-rolling"><h4>RECENT FORM</h4><div>'+rollingBlock('LAST 10',data.last10,goalie)+rollingBlock('LAST 25',data.last25,goalie)+'</div></div></div><footer><span>'+esc(C.seasonLabel(data.season||''))+'</span><strong>FANTASY GAME LOG</strong><span>'+esc(goalie?team:'#'+(identity?.id||''))+'</span></footer></article>';
  }

  return {render,renderStandings,renderRosters,rosterCard,rosterGroup,matchupCard,matchupGroup,summary,stat,gameForTeam,todayLine,todaySummary,todayStandingRows,cardMarkup,owners:C.OWNERS,escape:esc};
});
