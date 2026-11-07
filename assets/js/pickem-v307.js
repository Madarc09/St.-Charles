(function(){
'use strict';
const C=window.PoolCore,host=document.getElementById('weeklyPickem');if(!host||!C)return;
const q=new URLSearchParams(location.search),room=/^test-[a-z0-9-]{1,40}$/.test(q.get('room')||'')?q.get('room'):'live';
let data=null,selectedDate='',selectedGame='',selectedTeam='',busy=false,timer=null,lastOwner='',choosingName=false;
let savedOwner='';try{savedOwner=localStorage.getItem('hockey-pool:pickem-owner:v1')||'';}catch{}
if(!C.OWNERS.some(o=>o.id===savedOwner))savedOwner='';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ownerId=()=>String(savedOwner||window.PoolApp?.ownerId||'');
const ownerName=id=>C.OWNERS.find(o=>o.id===id)?.name||id;
const endpoint=()=>'/api/pickem?room='+encodeURIComponent(room);
function started(g){const s=String(g?.state||'').toUpperCase(),t=Date.parse(g?.startTimeUTC||'');if(['FINAL','OFF','LIVE','CRIT','SUSP','PPD'].includes(s))return true;if(Number.isFinite(t))return t<=Date.now();return false;}
function final(g){return ['FINAL','OFF'].includes(String(g?.state||'').toUpperCase());}
function fmtDate(raw,opts={weekday:'short',month:'short',day:'numeric'}){const [y,m,d]=String(raw||'').split('-').map(Number);return y?new Intl.DateTimeFormat('en-CA',opts).format(new Date(y,m-1,d)):'—';}
function fmtTime(raw){const d=new Date(raw);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-CA',{hour:'numeric',minute:'2-digit'}).format(d):'TBD';}
function weekRangeLabel(start,end){const parse=raw=>{const [y,m,d]=String(raw||'').split('-').map(Number);return y?new Date(y,m-1,d):null;},a=parse(start),b=parse(end);if(!a||!b)return 'WEEK';const mon=d=>new Intl.DateTimeFormat('en-CA',{month:'long'}).format(d).toUpperCase();return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()?'WEEK OF · '+mon(a)+' '+a.getDate()+' — '+b.getDate():'WEEK OF · '+mon(a)+' '+a.getDate()+' — '+mon(b)+' '+b.getDate();}
function teamLogo(team){return 'https://assets.nhle.com/logos/nhl/svg/'+encodeURIComponent(team||'')+'_light.svg';}
function teamButton(team,g){const isSelected=String(g.id)===selectedGame&&team===selectedTeam,disabled=started(g);return '<button type="button" class="pool-pickem-team'+(isSelected?' is-selected':'')+'" data-pickem-game="'+esc(g.id)+'" data-pickem-team="'+esc(team)+'" aria-pressed="'+(isSelected?'true':'false')+'" '+(disabled?'disabled':'')+'><img src="'+esc(teamLogo(team))+'" alt="" loading="lazy" onerror="this.style.display=\'none\'"><strong>'+esc(team)+'</strong><span>'+esc(C.TEAMS[team]||team)+'</span></button>';}
function gameCard(g){let status=final(g)?'FINAL '+g.awayScore+'–'+g.homeScore:started(g)?'IN PROGRESS':fmtTime(g.startTimeUTC),pickedHere=String(g.id)===selectedGame;return '<article class="pool-pickem-game'+(started(g)?' is-locked':'')+(pickedHere?' has-selection':'')+'"><div class="pool-pickem-game-meta"><span>'+esc(status)+'</span><small>'+esc(g.away)+' @ '+esc(g.home)+'</small></div><div class="pool-pickem-team-row">'+teamButton(g.away,g)+'<span class="pool-pickem-at">@</span>'+teamButton(g.home,g)+'</div></article>';}

function matchupDisplay(myPick){
  const pendingGame=(data?.games||[]).find(g=>String(g.id)===String(selectedGame));
  const savedGame=(data?.games||[]).find(g=>String(g.id)===String(myPick?.gameId));
  const game=pendingGame||savedGame||null;
  const pickedTeam=(pendingGame&&selectedTeam)?selectedTeam:(myPick?.pickedTeam||'');
  const pending=!!(pendingGame&&selectedTeam);
  const result=!pending?myPick?.result?.outcome:'';
  const stateClass=result==='W'?' is-win':result==='L'?' is-loss':!game?' is-empty':'';
  const away=game?.away||myPick?.away||'',home=game?.home||myPick?.home||'';
  let title='Select a matchup below',sub='Tap the team you think will win';
  if(game){
    if(result==='W')title='✓ Winning pick · '+pickedTeam;
    else if(result==='L')title='✕ Pick lost · '+pickedTeam;
    else if(pending)title='Selected · '+pickedTeam+' to win';
    else title='Saved pick · '+pickedTeam+' to win';
    const date=game?.date||myPick?.date||'';
    const status=final(game)?'FINAL '+game.awayScore+'–'+game.homeScore:started(game)?'LOCKED / IN PROGRESS':fmtTime(game.startTimeUTC);
    sub=(date?fmtDate(date,{weekday:'long',month:'long',day:'numeric'})+' · ':'')+status;
  }
  const teamPanel=(team,side)=>'<div class="pool-pickem-matchup-team is-'+side+(team&&team===pickedTeam?' is-picked':'')+'">'+(team?'<img src="'+esc(teamLogo(team))+'" alt="'+esc(C.TEAMS[team]||team)+' logo" onerror="this.style.display=\'none\'">':'')+'</div><div class="pool-pickem-matchup-name is-'+side+'">'+esc(team?(C.TEAMS[team]||team):'')+'</div>';
  return '<div class="pool-pickem-matchup-display'+stateClass+'"><img src="assets/images/your-pick-matchup-v306.png" alt="Your Pick hockey matchup display">'+teamPanel(away,'away')+teamPanel(home,'home')+'<div class="pool-pickem-matchup-status"><strong>'+esc(title)+'</strong><span>'+esc(sub)+'</span></div></div>';
}
function pickStatus(pick){if(!pick)return '<strong>No pick yet</strong><span>Choose one game before puck drop.</span>';const game=(data?.games||[]).find(g=>String(g.id)===String(pick.gameId));const result=pick.result?.outcome;if(result)return '<strong class="is-'+result.toLowerCase()+'">'+(result==='W'?'✓ WIN':'✕ LOSS')+' · '+esc(pick.pickedTeam)+'</strong><span>'+esc(pick.away)+' @ '+esc(pick.home)+' · '+esc(fmtDate(pick.date))+'</span>';const locked=started(game||pick);return '<strong>'+esc(pick.pickedTeam)+' to win</strong><span>'+esc(pick.away)+' @ '+esc(pick.home)+' · '+esc(fmtDate(pick.date))+(locked?' · LOCKED':' · can change until puck drop')+'</span>';}
function weekPicks(){return C.OWNERS.map(owner=>{const p=(data?.currentWeekPicks||[]).find(x=>x.ownerId===owner.id);return '<li><b>'+esc(owner.name)+'</b><span>'+pickStatus(p)+'</span></li>';}).join('');}
function leaderboard(){return (data?.leaderboard||[]).map(r=>'<li><b>'+esc(r.rank)+'</b><span><strong>'+esc(r.ownerName)+'</strong><small>'+r.wins+'–'+r.losses+(r.pending?' · '+r.pending+' pending':'')+'</small></span><em>'+((r.winPct||0)*100).toFixed(r.wins+r.losses?1:0)+'%</em></li>').join('');}
function standingsNote(){if(!data?.isExhibitionWeek)return '';const start=data.countingStartWeek||'';return '<p class="pool-pickem-exhibition">EXHIBITION WEEK · PICKS SAVE NORMALLY · SEASON RECORDS BEGIN '+esc(fmtDate(start,{month:'long',day:'numeric'}).toUpperCase())+'</p>';}
function render(){
  if(!data){host.innerHTML='<div class="pool-pickem-loading"><strong>Weekly Pick’em</strong><span>Loading this week’s NHL games…</span></div>';return;}
  const me=ownerId(),myPick=(data.currentWeekPicks||[]).find(p=>p.ownerId===me),myGame=(data.games||[]).find(g=>String(g.id)===String(myPick?.gameId)),locked=!!myPick&&(!!myPick.result||started(myGame||myPick));
  const dates=[...new Set((data.games||[]).map(g=>g.date))],today=data.bounds?.date;
  if(!selectedDate||!dates.includes(selectedDate)){const openDate=dates.find(d=>(data.games||[]).some(g=>g.date===d&&!started(g)));const todayOpen=dates.includes(today)&&(data.games||[]).some(g=>g.date===today&&!started(g));selectedDate=todayOpen?today:(openDate||today||dates[0]||'');}
  const games=(data.games||[]).filter(g=>g.date===selectedDate);
  const days=dates.map(date=>'<button type="button" data-pickem-date="'+esc(date)+'" class="'+(date===selectedDate?'is-active':'')+'"><span>'+esc(fmtDate(date,{weekday:'short'}))+'</span><strong>'+esc(fmtDate(date,{month:'short',day:'numeric'}))+'</strong></button>').join('');
  const chooser='<div class="pool-pickem-identity-choices">'+C.OWNERS.map(o=>'<button type="button" data-pickem-owner="'+esc(o.id)+'">'+esc(o.name)+'</button>').join('')+'</div>';
  const identity=me&&!choosingName?'<span>Picking as <strong>'+esc(ownerName(me))+'</strong></span><button type="button" data-pickem-change-name>Change</button>':'<span>Who is making this pick?</span>'+chooser;
  const saveDisabled=busy||locked||!me||!selectedGame||!selectedTeam;
  const saveLabel=locked?'Weekly pick locked':myPick?'Update weekly pick':'Save weekly pick';
  host.innerHTML='<section class="pool-pickem"><header class="pool-pickem-hero" aria-label="Just the Tip weekly Pick’em"><img src="assets/images/just-the-tip-pickem-header.png" alt="Just the Tip hockey Pick’em"><div class="pool-pickem-week-label">'+esc(weekRangeLabel(data.bounds.start,data.bounds.end))+'</div></header><div class="pool-pickem-identity-bar"><div class="pool-pickem-identity">'+identity+'</div></div><div class="pool-pickem-grid"><div class="pool-pickem-picker">'+matchupDisplay(myPick)+'<nav class="pool-pickem-days" aria-label="Pick an NHL game day">'+days+'</nav><div class="pool-pickem-games">'+(games.map(gameCard).join('')||'<p class="pool-pickem-empty">No NHL games on this day.</p>')+'</div><div class="pool-pickem-save"><button type="button" data-pickem-save '+(saveDisabled?'disabled':'')+'>'+esc(saveLabel)+'</button><small>'+(locked?'Locked at puck drop.':selectedTeam?'Selected: '+esc(selectedTeam)+' to win.':'Tap a team, then save your one pick for the week.')+'</small></div><p class="pool-pickem-message" data-pickem-message role="status"></p></div><aside class="pool-pickem-side"><section><h3>This Week</h3><ul class="pool-pickem-week-list">'+weekPicks()+'</ul></section><section><h3>Pick’em Standings</h3>'+standingsNote()+'<div class="pool-pickem-record-head"><span>Manager</span><span>W–L</span><span>Win%</span></div><ol class="pool-pickem-leaderboard">'+leaderboard()+'</ol></section></aside></div></section>';
}

function handleClick(event){
  const button=event.target.closest('button');if(!button||!host.contains(button))return;
  if(button.matches('[data-pickem-date]')){event.preventDefault();selectedDate=button.dataset.pickemDate;selectedGame='';selectedTeam='';render();return;}
  if(button.matches('[data-pickem-game][data-pickem-team]')){event.preventDefault();if(button.disabled)return;selectedGame=button.dataset.pickemGame;selectedTeam=button.dataset.pickemTeam;render();return;}
  if(button.matches('[data-pickem-save]')){event.preventDefault();save();return;}
  if(button.matches('[data-pickem-owner]')){event.preventDefault();savedOwner=button.dataset.pickemOwner;choosingName=false;try{localStorage.setItem('hockey-pool:pickem-owner:v1',savedOwner);}catch{}lastOwner=savedOwner;render();return;}
  if(button.matches('[data-pickem-change-name]')){event.preventDefault();choosingName=true;render();}
}
async function load(){try{const r=await fetch(endpoint(),{cache:'no-store',headers:{accept:'application/json'}}),p=await r.json();if(!r.ok||p.ok===false)throw Error(p.error||'Pick’em unavailable');data=p;render();}catch(e){host.innerHTML='<div class="pool-pickem-loading is-error"><strong>Weekly Pick’em</strong><span>'+esc(e.message||'Unable to load this week.')+'</span></div>';}}
async function save(){const me=ownerId();if(!me){window.PoolApp?.ensureIdentity?.();return;}if(busy||!selectedGame||!selectedTeam)return;busy=true;render();try{const r=await fetch(endpoint(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'pick',ownerId:me,gameId:selectedGame,pickedTeam:selectedTeam})}),p=await r.json();if(!r.ok||p.ok===false)throw Error(p.error||'Pick could not be saved');data=p;selectedGame='';selectedTeam='';busy=false;render();const m=host.querySelector('[data-pickem-message]');if(m)m.textContent='Weekly pick saved.';}catch(e){busy=false;render();const m=host.querySelector('[data-pickem-message]');if(m)m.textContent=e.message||'Pick could not be saved.';}}
function tickIdentity(){const now=ownerId();if(now!==lastOwner){lastOwner=now;if(data)render();}}
host.addEventListener('click',handleClick);load();lastOwner=ownerId();setInterval(tickIdentity,800);timer=setInterval(()=>{if(!document.hidden)load();},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
})();
