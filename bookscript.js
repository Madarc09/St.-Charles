
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
    const seasons = STATIC_SEASONS.map(s=>({...s, standings:s.standings.map(r=>({...r}))}));
    const live = liveSeasonRows();
    if(live){ seasons[0] = {...seasons[0], note:'Live 2025-2026 values from the Previous Season standings board/NHL API pull.', standings:live}; }
    seasons.forEach(season=>{ season.standings.sort((a,b)=>b.pts-a.pts || String(a.team).localeCompare(String(b.team))); season.standings.forEach((r,i)=>r.rank=i+1); });
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
  function collectorHtml(){
    return '<h2>Collector</h2><p>Choose the record you want to open.</p>'+ 
      '<div class="v228-book-nav"><button type="button" data-v228-view="total">All-Time Stats</button>'+allSeasons().map(s=>'<button type="button" data-v228-view="'+esc(s.id)+'">'+esc(s.label.replace(' Regular Season',''))+'</button>').join('')+'</div>'+ 
      '<p class="v228-book-note">Left page = collector/index. Right page = the selected board only. Six owners total: Nick, Andrew, Tyler, Chris, Ricoh, and Scott.</p>';
  }
  function rankText(seasonId, ownerId){
    const s = allSeasons().find(x=>x.id===seasonId);
    if(!s) return '—';
    const row = s.standings.find(r=>r.ownerId===ownerId);
    return row ? ('#'+row.rank+' / '+fmt(row.pts)+' pts') : '—';
  }
  function totalHtml(){
    const rows = sortRows(aggregateRows(), 'total', 'total');
    return '<h2>All-Time Stats</h2>'+table([{label:'Rank'},{key:'owner',label:'Owner'},{key:'team',label:'Team'},{key:'total',label:'FPTS'},{key:'seasons',label:'YRS'}], rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.owner)+'</td><td>'+esc(r.team)+'</td><td>'+fmt(r.total)+'</td><td>'+r.seasons+'</td></tr>')); 
  }
  function seasonHtml(id){
    const s = allSeasons().find(x=>x.id===id) || allSeasons()[0];
    const rows = sortRows(s.standings.map(r=>({
      ...r, owner:(OWNER_META[r.ownerId]&&OWNER_META[r.ownerId].owner)||r.ownerId,
      goals:r.hasFullStats?Number(r.goals)||0:null, assists:r.hasFullStats?Number(r.assists)||0:null, shortHandedGoals:r.hasFullStats?Number(r.shortHandedGoals)||0:null,
      gameWinningGoals:r.hasFullStats?Number(r.gameWinningGoals)||0:null, goalieWins:r.hasFullStats?Number(r.goalieWins)||0:null, goalieShutouts:r.hasFullStats?Number(r.goalieShutouts)||0:null,
      goalieAssists:r.hasFullStats?Number(r.goalieAssists)||0:null, goalieGoals:r.hasFullStats?Number(r.goalieGoals)||0:null
    })), s.id, 'pts');
    const full = rows.some(r=>r.hasFullStats);
    return '<h2>'+esc(s.label)+'</h2>'+table([
      {label:'Rank'},{key:'owner',label:'Owner'},{key:'team',label:'Team'},{key:'pts',label:'Fantasy Pts'}
    ], rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.owner)+'</td><td>'+esc(r.team)+'</td><td>'+fmt(r.pts)+'</td></tr>'));
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
  document.addEventListener('click',function(e){
    const b=e.target.closest&&e.target.closest('#rosterCards .straight-book-hotzone, #rosters .straight-book-hotzone');
    if(!b) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); openBook();
  }, true);
  window.openHockeyHistoryBook=openBook;
})();
