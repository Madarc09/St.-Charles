(function(){
'use strict';
const C=window.PoolCore,host=document.getElementById('weeklyPickem');if(!host||!C)return;
const q=new URLSearchParams(location.search),room=/^test-[a-z0-9-]{1,40}$/.test(q.get('room')||'')?q.get('room'):'live';
let data=null,selectedDate='',selectedGame='',selectedTeam='',busy=false,timer=null,detailTimer=null,lastOwner='',choosingName=false,expandedGames=new Set(),gameDetails=new Map(),detailBusy=new Set(),fantasyOwnership=new Map(),ownershipBusy=false,ownershipLoadedAt=0;
let savedOwner='';try{savedOwner=localStorage.getItem('hockey-pool:pickem-owner:v1')||'';}catch{}
if(!C.OWNERS.some(o=>o.id===savedOwner))savedOwner='';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ownerId=()=>String(savedOwner||window.PoolApp?.ownerId||'');
const ownerName=id=>C.OWNERS.find(o=>o.id===id)?.name||id;
const currentMyPick=()=>{const me=ownerId();return (data?.currentWeekPicks||[]).find(p=>p.ownerId===me)||null;};
const weeklyPickLocked=()=>{const pick=currentMyPick();if(!pick)return false;const game=(data?.games||[]).find(g=>String(g.id)===String(pick.gameId));return !!pick.result||started(game||pick);};
const poolPickers=(gameId,team)=>{const me=ownerId();return (data?.currentWeekPicks||[]).filter(p=>String(p.gameId)===String(gameId)&&p.pickedTeam===team).map(p=>({id:p.ownerId,name:ownerName(p.ownerId),isYou:p.ownerId===me}));};
const initials=name=>String(name||'').trim().split(/\s+/).map(x=>x[0]||'').join('').slice(0,2).toUpperCase();
const fantasyOwnerName=id=>id==='bot'?'Spare Parts':ownerName(id);
function rebuildFantasyOwnership(payload){
  const map=new Map(),draft=payload?.draft||payload?.state?.draft||{},picks=Array.isArray(draft?.picks)?draft.picks:[];
  for(const pick of picks){const player=pick?.player||{},id=String(player.id||'');if(!id)continue;map.set(id,{ownerId:String(pick.ownerId||''),ownerName:fantasyOwnerName(String(pick.ownerId||'')),playerId:id,playerName:player.name||'',team:player.nhlTeam||'',kind:String(id).startsWith('TG-')?'teamGoalie':'skater'});}
  const manifest=window.PoolBotRoster||window.PoolBot?.record||null;
  const botPlayers=room==='live'&&String(draft?.seasonId||'')==='20262027'&&(draft?.locked||draft?.draftClosed||picks.length===60)?(Array.isArray(manifest)?manifest:Array.isArray(manifest?.players)?manifest.players:Array.isArray(manifest?.roster)?manifest.roster:[]):[];
  for(const player of botPlayers){const id=String(player?.id||'');if(!id||map.has(id))continue;map.set(id,{ownerId:'bot',ownerName:'Spare Parts',playerId:id,playerName:player.name||'',team:player.nhlTeam||String(id).replace(/^TG-/,''),kind:String(id).startsWith('TG-')?'teamGoalie':'skater',isBot:true});}
  fantasyOwnership=map;ownershipLoadedAt=Date.now();
}
async function loadFantasyOwnership(force=false){
  if(ownershipBusy||(!force&&ownershipLoadedAt&&Date.now()-ownershipLoadedAt<300000))return;
  ownershipBusy=true;
  try{const r=await fetch('/api/draft?room='+encodeURIComponent(room),{cache:'no-store',headers:{accept:'application/json'}}),p=await r.json();if(r.ok&&p?.draft)rebuildFantasyOwnership(p);}catch(_){}finally{ownershipBusy=false;if(data)render();}
}
const ownershipFor=key=>fantasyOwnership.get(String(key||''))||null;
function isGoalieParticipant(id,team,detail){const key=detail?.game?.away===team?'away':detail?.game?.home===team?'home':'';return !!key&&(detail?.goalieIds?.[key]||[]).map(String).includes(String(id));}
function participantInfo(id,team,detail){
  const goalie=isGoalieParticipant(id,team,detail),key=goalie?'TG-'+team:String(id||''),ownership=ownershipFor(key);
  const line=goalie?(detail?.game?.away===team?detail?.teamGoalieFantasy?.away:detail?.teamGoalieFantasy?.home):(detail?.fantasyPlayers||[]).find(p=>String(p.id)===String(id));
  return {goalie,key,ownership,line,kind:goalie?'teamGoalie':'skater'};
}
function fpts(value){const n=Number(value)||0;return (Math.round(n*100)/100).toLocaleString('en-CA',{maximumFractionDigits:2});}
function fantasyBadge(info){if(!info?.ownership)return '';const me=ownerId(),points=Number(info?.line?.fpts||0);if(points<=0)return '';return '<span class="pool-pickem-fantasy-owner'+(info.ownership.ownerId===me?' is-you':'')+' has-points"><b>'+esc(info.ownership.ownerName)+'</b><em>+'+esc(fpts(points))+' FPTS</em></span>';}
function playerButton(name,id,team,detail,className='pool-pickem-player-link'){
  const info=participantInfo(id,team,detail);return '<button type="button" class="'+className+'" data-pickem-player-card data-card-kind="'+(info.goalie?'teamGoalie':'skater')+'" data-player-id="'+esc(id)+'" data-team="'+esc(team)+'">'+esc(name)+'</button>'+fantasyBadge(info);
}
function pickMarkers(gameId,team){const picks=poolPickers(gameId,team);if(!picks.length)return '';const names=picks.map(p=>p.name).join(', ');return '<span class="pool-pickem-pool-picks" title="Picked by '+esc(names)+'" aria-label="Picked by '+esc(names)+'"><span class="pool-pickem-pool-picks-label">PICKS</span>'+picks.map(p=>'<b class="'+(p.isYou?'is-you':'')+'">'+esc(initials(p.name))+'</b>').join('')+'</span>';};
const endpoint=()=>'/api/pickem?room='+encodeURIComponent(room);
function started(g){const s=String(g?.state||'').toUpperCase(),t=Date.parse(g?.startTimeUTC||'');if(['FINAL','OFF','LIVE','CRIT','SUSP','PPD'].includes(s))return true;if(Number.isFinite(t))return t<=Date.now();return false;}
function final(g){return ['FINAL','OFF'].includes(String(g?.state||'').toUpperCase());}
function fmtDate(raw,opts={weekday:'short',month:'short',day:'numeric'}){const [y,m,d]=String(raw||'').split('-').map(Number);return y?new Intl.DateTimeFormat('en-CA',opts).format(new Date(y,m-1,d)):'—';}
function fmtTime(raw){const d=new Date(raw);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-CA',{hour:'numeric',minute:'2-digit'}).format(d):'TBD';}
function weekRangeLabel(start,end){const parse=raw=>{const [y,m,d]=String(raw||'').split('-').map(Number);return y?new Date(y,m-1,d):null;},a=parse(start),b=parse(end);if(!a||!b)return 'WEEK';const mon=d=>new Intl.DateTimeFormat('en-CA',{month:'long'}).format(d).toUpperCase();return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()?'WEEK OF · '+mon(a)+' '+a.getDate()+' — '+b.getDate():'WEEK OF · '+mon(a)+' '+a.getDate()+' — '+mon(b)+' '+b.getDate();}
function teamLogo(team){return 'https://assets.nhle.com/logos/nhl/svg/'+encodeURIComponent(team||'')+'_light.svg';}
function teamButton(team,g){
  const myPick=currentMyPick(),isSelected=String(g.id)===selectedGame&&team===selectedTeam,isSaved=String(g.id)===String(myPick?.gameId)&&team===myPick?.pickedTeam,disabled=started(g)||weeklyPickLocked();
  return '<button type="button" class="pool-pickem-team'+(isSelected?' is-selected':'')+(isSaved?' is-my-pick':'')+'" data-pickem-game="'+esc(g.id)+'" data-pickem-team="'+esc(team)+'" aria-pressed="'+(isSelected?'true':'false')+'" '+(disabled?'disabled':'')+'><img src="'+esc(teamLogo(team))+'" alt="" loading="lazy" onerror="this.style.display=\'none\'"><strong>'+esc(team)+'</strong><span>'+esc(C.TEAMS[team]||team)+'</span>'+(isSaved?'<em>★ YOUR PICK</em>':'')+pickMarkers(g.id,team)+'</button>';
}
function periodText(g){const state=String(g?.state||'').toUpperCase();if(final(g))return 'FINAL';if(g?.inIntermission)return 'INTERMISSION';const p=Number(g?.period||0),type=String(g?.periodType||'').toUpperCase(),clock=String(g?.timeRemaining||'');let label=type==='SO'?'SO':type==='OT'?'OT':p?({1:'1ST',2:'2ND',3:'3RD'}[p]||('P'+p)):'LIVE';return [label,clock].filter(Boolean).join(' · ');}
function goalieCard(goalie,team,detail){
  const key=detail?.game?.away===team?'away':'home',unit=detail?.teamGoalieFantasy?.[key],info={goalie:true,key:'TG-'+team,ownership:ownershipFor('TG-'+team),line:unit,kind:'teamGoalie'},hasFantasyPoints=!!info.ownership&&Number(unit?.fpts||0)>0;
  if(!goalie)return '<button type="button" class="pool-pickem-goalie is-missing" data-pickem-player-card data-card-kind="teamGoalie" data-team="'+esc(team)+'"><img src="'+esc(teamLogo(team))+'" alt=""><div><small>Team Goalies</small><strong>Not available yet</strong></div></button>';
  const pct=Number.isFinite(goalie.savePctg)?' · '+(goalie.savePctg*100).toFixed(1)+'%':'';
  return '<button type="button" class="pool-pickem-goalie'+(hasFantasyPoints?' has-fantasy-points':'')+(hasFantasyPoints&&info.ownership?.ownerId===ownerId()?' is-yours':'')+'" data-pickem-player-card data-card-kind="teamGoalie" data-player-id="'+esc(goalie.id)+'" data-team="'+esc(team)+'"><img src="'+esc(goalie.headshot)+'" alt="'+esc(goalie.name)+'" loading="lazy" onerror="this.src=\''+esc(teamLogo(team))+'\'"><div><small>'+esc(team)+(goalie.active?' · IN NET':goalie.starter?' · STARTER':'')+'</small><strong>'+esc(goalie.name)+'</strong><span>'+goalie.saves+' saves / '+goalie.shotsAgainst+' shots'+pct+'</span>'+fantasyBadge(info)+'</div></button>';
}
function strengthLabel(goal){const s=String(goal?.strength||'').toUpperCase();if(s.startsWith('PP'))return 'PP';if(s.startsWith('SH'))return 'SH';if(s.startsWith('EN'))return 'EN';return '';}
function scoringList(detail){
  const goals=detail?.goals||[];if(!goals.length)return '<p class="pool-pickem-no-scoring">No goals yet.</p>';
  return '<ol class="pool-pickem-scoring-list">'+goals.map(goal=>{const assists=(goal.assists||[]).filter(a=>a.name);return '<li><img src="'+esc(teamLogo(goal.team))+'" alt=""><span class="pool-pickem-goal-time">'+esc(goal.periodType==='OT'?'OT':goal.period?'P'+goal.period:'')+' '+esc(goal.timeInPeriod)+'</span><span class="pool-pickem-goal-copy"><strong>'+playerButton(goal.scorer,goal.scorerId,goal.team,detail)+'</strong><small>'+(assists.length?'Assists: '+assists.map(a=>playerButton(a.name,a.id,goal.team,detail,'pool-pickem-assist-link')).join(' · '):'Unassisted')+'</small></span>'+(strengthLabel(goal)?'<b>'+esc(strengthLabel(goal))+'</b>':'')+'</li>';}).join('')+'</ol>';
}
function gameDetailPanel(g,detail){if(detailBusy.has(String(g.id))&&!detail)return '<div class="pool-pickem-game-detail is-loading"><span>Loading live GameCenter…</span></div>';if(!detail)return '<div class="pool-pickem-game-detail"><span>Game details are temporarily unavailable.</span></div>';const ppTeam=detail.currentPowerPlay||'',awayPP=detail.powerPlay?.away?.label||'—',homePP=detail.powerPlay?.home?.label||'—';return '<div class="pool-pickem-game-detail">'+(ppTeam?'<div class="pool-pickem-live-pp"><span>⚡ POWER PLAY</span><strong>'+esc(C.TEAMS[ppTeam]||ppTeam)+'</strong></div>':'')+'<div class="pool-pickem-goalies">'+goalieCard(detail.goalies?.away,g.away,detail)+'<span class="pool-pickem-goalie-vs">VS</span>'+goalieCard(detail.goalies?.home,g.home,detail)+'</div><div class="pool-pickem-detail-stats"><div><img src="'+esc(teamLogo(g.away))+'" alt=""><strong>'+esc(g.away)+'</strong><span>SOG '+Number(detail.game?.awaySog||0)+'</span><span>PP '+esc(awayPP)+'</span></div><div><img src="'+esc(teamLogo(g.home))+'" alt=""><strong>'+esc(g.home)+'</strong><span>SOG '+Number(detail.game?.homeSog||0)+'</span><span>PP '+esc(homePP)+'</span></div></div><div class="pool-pickem-scoring"><h4>Scoring</h4>'+scoringList(detail)+'</div></div>';}

function scoreboardCard(g){
  const id=String(g.id),open=expandedGames.has(id),detail=gameDetails.get(id),livePP=detail?.currentPowerPlay||'',status=periodText(detail?.game||g);
  const scoreAway=Number(detail?.game?.awayScore??g.awayScore??0),scoreHome=Number(detail?.game?.homeScore??g.homeScore??0),sogAway=detail?.game?.awaySog??g.awaySog??0,sogHome=detail?.game?.homeSog??g.homeSog??0;
  const myPick=currentMyPick(),isMyGame=id===String(myPick?.gameId||''),myTeam=isMyGame?myPick?.pickedTeam:'';
  const awayLead=scoreAway>scoreHome,homeLead=scoreHome>scoreAway;
  const teamRow=(team,score,sog,side,isLeader)=>'<div class="pool-pickem-scoreboard-team'+(team===myTeam?' is-my-pick':'')+(isLeader?' is-leading':'')+'" data-team="'+esc(team)+'"><img src="'+esc(teamLogo(team))+'" alt=""><span><strong>'+esc(team)+'</strong><small>'+esc(C.TEAMS[team]||team)+'</small></span><em>'+esc(score)+'</em><i>SOG '+esc(sog)+'</i><div class="pool-pickem-scoreboard-markers">'+(team===myTeam?'<span class="pool-pickem-your-pick-badge">★ YOUR PICK</span>':'')+pickMarkers(id,team)+(isLeader?'<span class="pool-pickem-leading-badge">'+(final(g)?'WINNER':'LEADING')+'</span>':'')+'</div></div>';
  return '<article class="pool-pickem-game pool-pickem-scoreboard '+(final(g)?'is-final':'is-live')+(open?' is-open':'')+(isMyGame?' is-my-game':'')+'">'+(isMyGame?'<div class="pool-pickem-my-game-ribbon">★ YOUR GAME</div>':'')+'<button type="button" class="pool-pickem-scoreboard-toggle" data-pickem-detail-game="'+esc(id)+'" aria-expanded="'+(open?'true':'false')+'"><div class="pool-pickem-scoreboard-status"><span>'+esc(status)+'</span>'+(livePP?'<b>⚡ '+esc(livePP)+' POWER PLAY</b>':'')+'<small>'+(open?'Hide details':'Game details')+' ▾</small></div>'+teamRow(g.away,scoreAway,sogAway,'away',awayLead)+teamRow(g.home,scoreHome,sogHome,'home',homeLead)+'</button>'+(open?gameDetailPanel(g,detail):'')+'</article>';
}
function gameCard(g){
  if(started(g))return scoreboardCard(g);
  const myPick=currentMyPick(),isMyGame=String(g.id)===String(myPick?.gameId||''),status=fmtTime(g.startTimeUTC),pickedHere=String(g.id)===selectedGame;
  return '<article class="pool-pickem-game'+(pickedHere?' has-selection':'')+(isMyGame?' is-my-game':'')+'">'+(isMyGame?'<div class="pool-pickem-my-game-ribbon">★ YOUR GAME</div>':'')+'<div class="pool-pickem-game-meta"><span>'+esc(status)+'</span><small>'+esc(g.away)+' @ '+esc(g.home)+'</small></div><div class="pool-pickem-team-row">'+teamButton(g.away,g)+'<span class="pool-pickem-at">@</span>'+teamButton(g.home,g)+'</div></article>';
}


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
  const me=ownerId(),myPick=(data.currentWeekPicks||[]).find(p=>p.ownerId===me),myGame=(data.games||[]).find(g=>String(g.id)===String(myPick?.gameId)),locked=weeklyPickLocked();if(locked&&(selectedGame||selectedTeam)){selectedGame='';selectedTeam='';}
  const dates=[...new Set((data.games||[]).map(g=>g.date))],today=data.bounds?.date;
  if(!selectedDate||!dates.includes(selectedDate)){const ownActiveDate=myGame&&started(myGame)&&!final(myGame)?myGame.date:'';const openDate=dates.find(d=>(data.games||[]).some(g=>g.date===d&&!started(g)));const todayOpen=dates.includes(today)&&(data.games||[]).some(g=>g.date===today&&!started(g));selectedDate=ownActiveDate||(todayOpen?today:(openDate||today||dates[0]||''));}
  const games=(data.games||[]).filter(g=>g.date===selectedDate).sort((a,b)=>{const myId=String(myPick?.gameId||''),aMine=String(a.id)===myId,bMine=String(b.id)===myId;if(aMine!==bMine)return aMine?-1:1;const aLive=started(a)&&!final(a),bLive=started(b)&&!final(b);if(aLive!==bLive)return aLive?-1:1;return Date.parse(a.startTimeUTC||0)-Date.parse(b.startTimeUTC||0);});
  const days=dates.map(date=>'<button type="button" data-pickem-date="'+esc(date)+'" class="'+(date===selectedDate?'is-active':'')+'"><span>'+esc(fmtDate(date,{weekday:'short'}))+'</span><strong>'+esc(fmtDate(date,{month:'short',day:'numeric'}))+'</strong></button>').join('');
  const chooser='<div class="pool-pickem-identity-choices">'+C.OWNERS.map(o=>'<button type="button" data-pickem-owner="'+esc(o.id)+'">'+esc(o.name)+'</button>').join('')+'</div>';
  const identity=me&&!choosingName?'<span>Picking as <strong>'+esc(ownerName(me))+'</strong></span><button type="button" data-pickem-change-name>Change</button>':'<span>Who is making this pick?</span>'+chooser;
  const saveDisabled=busy||locked||!me||!selectedGame||!selectedTeam;
  const saveLabel=locked?'Weekly pick locked':myPick?'Update weekly pick':'Save weekly pick';
  host.innerHTML='<section class="pool-pickem"><header class="pool-pickem-hero" aria-label="Just the Tip weekly Pick’em"><img src="assets/images/just-the-tip-pickem-header.png" alt="Just the Tip hockey Pick’em"><div class="pool-pickem-week-label">'+esc(weekRangeLabel(data.bounds.start,data.bounds.end))+'</div></header><div class="pool-pickem-identity-bar"><div class="pool-pickem-identity">'+identity+'</div></div><div class="pool-pickem-grid"><div class="pool-pickem-picker">'+matchupDisplay(myPick)+'<nav class="pool-pickem-days" aria-label="Pick an NHL game day">'+days+'</nav><div class="pool-pickem-games">'+(games.map(gameCard).join('')||'<p class="pool-pickem-empty">No NHL games on this day.</p>')+'</div><div class="pool-pickem-save"><button type="button" data-pickem-save '+(saveDisabled?'disabled':'')+'>'+esc(saveLabel)+'</button><small>'+(locked?'Locked at puck drop.':selectedTeam?'Selected: '+esc(selectedTeam)+' to win.':'Tap a team, then save your one pick for the week.')+'</small></div><p class="pool-pickem-message" data-pickem-message role="status"></p></div><aside class="pool-pickem-side"><section><h3>This Week</h3><ul class="pool-pickem-week-list">'+weekPicks()+'</ul></section><section><h3>Pick’em Standings</h3>'+standingsNote()+'<div class="pool-pickem-record-head"><span>Manager</span><span>W–L</span><span>Win%</span></div><ol class="pool-pickem-leaderboard">'+leaderboard()+'</ol></section></aside></div></section>';
}

function handleClick(event){
  const button=event.target.closest('button');if(!button||!host.contains(button))return;
  if(button.matches('[data-pickem-player-card]')){event.preventDefault();event.stopPropagation();window.PoolPlayerCards?.open?.({kind:button.dataset.cardKind||'skater',playerId:button.dataset.playerId||'',team:button.dataset.team||''});return;}
  if(button.matches('[data-pickem-detail-game]')){event.preventDefault();const id=String(button.dataset.pickemDetailGame||'');if(expandedGames.has(id))expandedGames.delete(id);else{expandedGames.add(id);loadGameDetail(id);}render();return;}
  if(button.matches('[data-pickem-date]')){event.preventDefault();selectedDate=button.dataset.pickemDate;selectedGame='';selectedTeam='';render();return;}
  if(button.matches('[data-pickem-game][data-pickem-team]')){event.preventDefault();if(button.disabled||weeklyPickLocked())return;selectedGame=button.dataset.pickemGame;selectedTeam=button.dataset.pickemTeam;render();return;}
  if(button.matches('[data-pickem-save]')){event.preventDefault();save();return;}
  if(button.matches('[data-pickem-owner]')){event.preventDefault();savedOwner=button.dataset.pickemOwner;choosingName=false;try{localStorage.setItem('hockey-pool:pickem-owner:v1',savedOwner);}catch{}lastOwner=savedOwner;render();return;}
  if(button.matches('[data-pickem-change-name]')){event.preventDefault();choosingName=true;render();}
}
async function loadGameDetail(id,{quiet=false}={}){id=String(id||'');if(!id||detailBusy.has(id))return;detailBusy.add(id);if(!quiet)render();try{const r=await fetch('/api/nhl?mode=game&gameId='+encodeURIComponent(id),{cache:'no-store',headers:{accept:'application/json'}}),p=await r.json();if(!r.ok||p.ok===false)throw Error(p.error||'Game details unavailable');gameDetails.set(id,p);}catch(e){if(!quiet)gameDetails.delete(id);}finally{detailBusy.delete(id);render();}}
function refreshExpandedDetails(){for(const id of expandedGames){const g=(data?.games||[]).find(x=>String(x.id)===id);if(g&&started(g)&&!final(g))loadGameDetail(id,{quiet:true});}}
async function load(){try{const r=await fetch(endpoint(),{cache:'no-store',headers:{accept:'application/json'}}),p=await r.json();if(!r.ok||p.ok===false)throw Error(p.error||'Pick’em unavailable');data=p;render();refreshExpandedDetails();}catch(e){host.innerHTML='<div class="pool-pickem-loading is-error"><strong>Weekly Pick’em</strong><span>'+esc(e.message||'Unable to load this week.')+'</span></div>';}}
async function save(){const me=ownerId();if(!me){window.PoolApp?.ensureIdentity?.();return;}if(busy||weeklyPickLocked()||!selectedGame||!selectedTeam)return;busy=true;render();try{const r=await fetch(endpoint(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'pick',ownerId:me,gameId:selectedGame,pickedTeam:selectedTeam})}),p=await r.json();if(!r.ok||p.ok===false)throw Error(p.error||'Pick could not be saved');data=p;selectedGame='';selectedTeam='';busy=false;render();const m=host.querySelector('[data-pickem-message]');if(m)m.textContent='Weekly pick saved.';}catch(e){busy=false;render();const m=host.querySelector('[data-pickem-message]');if(m)m.textContent=e.message||'Pick could not be saved.';}}
function tickIdentity(){const now=ownerId();if(now!==lastOwner){lastOwner=now;if(data)render();}}
host.addEventListener('click',handleClick);loadFantasyOwnership(true);load();lastOwner=ownerId();setInterval(tickIdentity,800);timer=setInterval(()=>{if(!document.hidden)load();},30000);detailTimer=setInterval(()=>{if(!document.hidden)refreshExpandedDetails();},15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){loadFantasyOwnership();load();refreshExpandedDetails();}});
})();
