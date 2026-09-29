/* One shared controller for identity, draft, chat, live scoring and archives. */
(function(){
 'use strict';
 const C=window.PoolCore,$=id=>document.getElementById(id),q=new URLSearchParams(location.search);
 const room=/^test-[a-z0-9-]{1,40}$/.test(q.get('room')||'')?q.get('room'):'live',testMode=room!=='live',identityKey=`bbl:259:${room}:owner`;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const uuid=()=>crypto.randomUUID?crypto.randomUUID():`request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
 const stored=k=>{try{return sessionStorage.getItem(k)||'';}catch{return '';}};
 const remember=(k,v)=>{try{sessionStorage.setItem(k,v);}catch{}};
 let ownerId=stored(identityKey),state=null,players=[],boardSeason='',boardPayload=null,boardBusy=false,boardError='',boardToken=0;
 let liveStats=null,statsSeason='',lastStats=0,statsBusy=false,connectionError='',refreshJob=null,poll=null,lastHeartbeat=0;
 const LIVE_STATS_REFRESH_MS=60000;
 let limit=75,pickBusy=false,adminBusy=false,chatOpen=false,chatSig='',lastSeen=stored(`${identityKey}:chat`),homeSig='',boardSig='',historySig='',rosterSig='';
 if(!C.OWNERS.some(o=>o.id===ownerId))ownerId='';
 const name=id=>C.OWNERS.find(o=>o.id===id)?.name||id;
 const inDraft=()=>Boolean($('draft')?.classList.contains('active'));
 const endpoint=p=>`/api/${p}${p.includes('?')?'&':'?'}room=${encodeURIComponent(room)}`;
 function toast(message){const t=$('toast');if(!t)return;t.textContent=message;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),4500);}
 async function json(url,options={}){let res;try{res=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(45000),...options});}catch{throw new Error('Connection interrupted. Your saved pool is safe; please retry.');}const d=await res.json().catch(()=>({}));if(!res.ok||d.ok===false){const e=new Error(d.error||'The room could not be loaded.');e.status=res.status;throw e;}return d;}
 function apply(data){
  if(!data?.draft)return data;if(state&&data.version<state.version)return state;const previousSeason=state?.draft.comparisonSeason;state=data;connectionError='';
  window.__currentLiveDraft=data.draft;window.__presenceMap=data.presence||{};
  if((previousSeason&&previousSeason!==data.draft.comparisonSeason)||(boardSeason&&boardSeason!==data.draft.comparisonSeason)){players=[];boardSeason='';boardPayload=null;boardToken++;boardBusy=false;boardError='';}
  if(statsSeason&&statsSeason!==data.draft.seasonId){liveStats=null;statsSeason='';lastStats=0;}
  const hs=JSON.stringify(data.historySummary||[]);if(hs!==historySig){historySig=hs;loadHistory().catch(()=>{});}
  render();renderHome();window.liveLottery?.renderState(data.state).catch(error=>toast(error.message));return data;
 }
 async function request(path,body){return apply(await json(endpoint(path),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ownerId,...body})}));}
 async function refresh(){if(refreshJob)return refreshJob;refreshJob=(async()=>{try{return apply(await json(endpoint('draft')));}catch(e){connectionError=e.message;render();throw e;}finally{refreshJob=null;}})();return refreshJob;}
 async function loadHistory(){const d=await json(endpoint('history'));window.__sharedHistorySeasons=d.seasons||[];window.refreshHockeyHistoryBook?.();$('historySaveStatus').textContent=`${d.seasons.length} ${testMode?'test':'permanent'} seasons saved.`;return d;}
 async function heartbeat(){if(!ownerId||!inDraft()||document.hidden||Date.now()-lastHeartbeat<14000)return;lastHeartbeat=Date.now();try{await request('draft',{action:'presence'});}catch(e){connectionError=e.message;render();}}
 function schedule(){clearTimeout(poll);poll=setTimeout(async()=>{if(!document.hidden){await refresh().catch(()=>{});await heartbeat();refreshScores();}schedule();},inDraft()?3500:15000);}
 function ensureIdentity(){if(ownerId)return true;const m=$('draftIdentityDialog');if(m&&!m.open)m.showModal();return false;}
 function syncPage(){const active=inDraft();document.body.classList.toggle('v259-draft-active',active);document.body.classList.toggle('v259-test-mode',testMode);if(active)ensureIdentity();else{if($('draftIdentityDialog').open)$('draftIdentityDialog').close();if(App.lotteryOpen){App.lotteryOpen=false;$('liveLotteryOverlay').hidden=true;}}$('draftChat').hidden=!active||!ownerId;renderAdmin();if(active)render();}
 function activate(id){document.querySelectorAll('main > section.panel').forEach(p=>p.classList.toggle('active',p.id===id));document.querySelectorAll('.tabs [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));document.body.dataset.activeTab=id;document.body.classList.toggle('v180-home-active',id==='dashboard');syncPage();schedule();if(id==='draft'){refresh().catch(()=>{});heartbeat();}if(id==='dashboard')refreshScores();window.scrollTo({top:0,behavior:'instant'});}
 function chooseIdentity(id){if(!C.OWNERS.some(o=>o.id===id))return;ownerId=id;remember(identityKey,id);$('draftIdentityDialog').close();lastHeartbeat=0;boardSig='';chatSig='';render();renderAdmin();heartbeat();}
 function render(){
  if(!$('lotteryOrderResults'))return;
  $('changeDraftName').textContent=ownerId?`${name(ownerId)} · change`:'Choose your name';$('roomModeBadge').textContent=testMode?'TEST ROOM':'LIVE POOL';
  $('draftConnection').textContent=connectionError||(state?`${testMode?'Test room · ':''}${state.draft.picks.length}/60 picks saved · Everyone shares this room`:'Connecting to the room…');$('draftConnection').classList.toggle('has-error',!!connectionError);
  const l=state?.state,d=state?.draft,done=!!l?.finalized,order=done?l.order:[];
  $('lotteryOrderResults').innerHTML=Array.from({length:5},(_,i)=>`<div><span>${i+1}</span><strong>${esc(order[i]?name(order[i]):'TBA')}</strong></div>`).join('');
  $('lotteryStateCaption').textContent=done?'The order is official':l?.phase==='waiting'?`${l.joined.length}/5 managers ready`:l?.phase==='revealing'?'The reveal is underway':'Waiting for the lottery';
  $('runLiveLotteryBtn').hidden=done;$('runLiveLotteryBtn').disabled=!state||!ownerId||!!connectionError;$('runLiveLotteryBtn').textContent=l?.phase==='revealing'?'Return to Lottery':'Enter Draft Lottery';$('replayLotteryBtn').hidden=!done;
  $('draftSeasonLabel').textContent=d?`${C.seasonLabel(d.seasonId)} season${testMode?' · Rehearsal':''}`:'';
  window.renderRosterNeeds?.(d||{picks:[]},ownerId,name(ownerId));
  const next=done?C.currentPick(d):null;
  $('currentDraftTurn').textContent=next?`${name(next.ownerId)} is drafting · Round ${next.round}, pick ${next.pickNumber}`:done?'Draft complete':'Order to be announced';
  const strip=[];if(done)for(let i=d.picks.length;i<Math.min(60,d.picks.length+10);i++){const p=C.currentPick({...d,picks:Array(i)});strip.push(`<span class="${i===d.picks.length?'current':''}"><b>${p.pickNumber}.</b> ${esc(name(p.ownerId))}</span>`);}
  $('cleanDraftOrderStrip').innerHTML=strip.join('')||'<span>TBA after the lottery</span>';
  $('draftWaitingNotice').hidden=done;$('draftWaitingNotice').textContent=connectionError||'Enter the draft lottery to get started. Player selections open when the order is saved.';
  $('draftPlayerSection').hidden=!done||!ownerId;$('draftChat').hidden=!inDraft()||!ownerId;
  const own=d?.picks.filter(p=>p.ownerId===ownerId)||[];$('myDraftCount').textContent=`${own.length} / 12`;
  const rs=ownerId+JSON.stringify(own.map(p=>p.player.id));if(rs!==rosterSig){rosterSig=rs;$('myDraftPlayers').innerHTML=own.length?own.map(p=>`<span><b>${esc(p.player.position)}</b> ${esc(p.player.name)}</span>`).join(''):'Your picks will appear here.';}
  if(done&&ownerId&&inDraft()&&boardSeason!==d.comparisonSeason&&!boardBusy&&!boardError)loadPlayers();
  const sig=[d?.revision,ownerId,boardBusy,boardError,connectionError,players.length,$('draftPosition').value,$('draftTeam').value,$('draftSearch').value,$('draftSort').value,limit,pickBusy].join('|');if(sig!==boardSig){boardSig=sig;renderBoard();}
  renderChat();renderAdmin();if(d)window.liveLottery?.renderLiveDraftTicker(d);
 }
 async function loadPlayers(){if(!state||boardBusy)return;const season=state.draft.comparisonSeason,token=++boardToken;boardBusy=true;boardError='';render();try{const data=await json(`/api/nhl?mode=board&season=${season}`);if(token!==boardToken)return;players=data.players;boardSeason=season;boardPayload=data;}catch(e){if(token===boardToken)boardError=e.message;}finally{if(token===boardToken){boardBusy=false;boardSig='';render();}}}
 function filtered(){
  const taken=new Set(state?.draft.picks.map(p=>String(p.player.id))||[]),position=$('draftPosition').value,team=$('draftTeam').value,q=$('draftSearch').value.trim().toLowerCase(),sort=$('draftSort').value;
  return players.filter(p=>!taken.has(p.id)).filter(p=>position==='ALL'||C.bucket(p)===(position==='TG'?'G':position)).filter(p=>team==='ALL'||(p.teamVerified&&p.nhlTeam===team)).filter(p=>!q||`${p.name} ${p.nhlTeam} ${C.TEAMS[p.nhlTeam]||''}`.toLowerCase().includes(q)).sort((a,b)=>{if(['name','nhlTeam'].includes(sort))return String(a[sort]).localeCompare(String(b[sort]))||a.name.localeCompare(b.name);if(a[sort]==null&&b[sort]!=null)return 1;if(b[sort]==null&&a[sort]!=null)return -1;return (C.num(a[sort])-C.num(b[sort]))*(sort==='goalsAgainstAverage'?1:-1)||a.name.localeCompare(b.name);});
 }
 function renderBoard(){
  const board=$('cleanDraftBoard');if(!board)return;$('boardDataStatus').textContent=boardPayload?`${C.seasonLabel(boardPayload.season)} regular-season stats · Updated ${new Date(boardPayload.fetchedAt).toLocaleString()}${boardPayload.stale?' · Saved update':''}${boardPayload.warning?' · '+boardPayload.warning:''}`:'';
  if(boardBusy&&!players.length){board.innerHTML='<div class="draft-board-message">Loading the player board…</div>';return;}if(boardError){board.innerHTML=`<div class="draft-board-message">${esc(boardError)}<button id="retryBoard" type="button">Try again</button></div>`;return;}if(!state||!players.length){board.innerHTML='';return;}
  const list=filtered(),d=state.draft,next=C.currentPick(d),myTurn=next?.ownerId===ownerId&&state.state.finalized&&!connectionError&&!pickBusy,counts=C.counts(d,ownerId),gMode=$('draftPosition').value==='TG';
  $('draftBoardCount').textContent=`${list.length} available${next?.ownerId===ownerId?' · Your pick':next?` · Waiting for ${name(next.ownerId)}`:' · All 60 picks saved'}`;$('showMorePlayers').hidden=list.length<=limit;
  board.innerHTML=`<div class="draft-player-row draft-player-heading"><span>Player</span><span>${gMode?'W':'G / W'}</span><span>${gMode?'SV%':'A / SV%'}</span><span>${gMode?'GAA':'PTS / GAA'}</span><span>FPTS</span><span></span></div>`+list.slice(0,limit).map(p=>{
   const g=C.bucket(p)==='G',full=counts[C.bucket(p)]>=C.RULES[C.bucket(p)],enabled=myTurn&&!full,logo=`https://assets.nhle.com/logos/nhl/svg/${encodeURIComponent(p.nhlTeam)}_light.svg`,image=g?logo:`https://assets.nhle.com/mugs/nhl/latest/${encodeURIComponent(p.id)}.png`;
   const a=g?p.goalieWins:p.goals,b=g?(p.savePct==null?'—':Number(p.savePct).toFixed(3)):p.assists,c=g?(p.goalsAgainstAverage==null?'—':Number(p.goalsAgainstAverage).toFixed(2)):p.points;
   return `<article class="draft-player-row ${g?'team-goalie-row':''}" style="--team-logo:url('${esc(logo)}')"><div class="draft-player-identity"><img src="${esc(image)}" alt="" loading="lazy"><div><strong>${esc(p.name)}</strong><small>${g?'Team Goalies':esc(p.position)} · ${esc(p.nhlTeam)}${!p.teamVerified?' · last-season team':''}${p.rookie?' · No prior-season stats':''}</small></div></div><div class="draft-stat"><small>${g?'W':'G'}</small>${a??0}</div><div class="draft-stat"><small>${g?'SV%':'A'}</small>${b??0}</div><div class="draft-stat"><small>${g?'GAA':'PTS'}</small>${c??0}</div><div class="draft-stat draft-fpts"><small>FPTS</small>${C.points(p)}</div><button type="button" class="${enabled?'draft-puck-button':'draft-status-button'}" data-pick-player="${esc(p.id)}" ${enabled?'':'disabled'}>${full?'Full':pickBusy?'Saving…':enabled?'Draft':next?`${esc(name(next.ownerId))} is picking`:'Draft complete'}</button></article>`;
  }).join('');if(!list.length)board.innerHTML='<div class="draft-board-message">No available players match these filters.</div>';
 }
 async function pick(id){if(pickBusy||!ensureIdentity())return;pickBusy=true;render();try{await request('draft',{action:'pick',playerId:id,expectedRevision:state.draft.revision,requestId:uuid()});toast('Pick saved for everyone.');}catch(e){toast(e.message);await refresh().catch(()=>{});}finally{pickBusy=false;render();}}
 function renderChat(){
  const messages=state?.messages||[],sig=messages.map(m=>m.id).join('|');if(sig!==chatSig){chatSig=sig;const log=$('chatMessages'),bottom=log.scrollHeight-log.scrollTop-log.clientHeight<70;log.innerHTML=messages.length?messages.map(m=>`<div class="chat-message ${m.ownerId===ownerId?'mine':''}"><div><strong>${esc(name(m.ownerId))}</strong><time>${new Date(m.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time></div><p>${esc(m.text)}</p></div>`).join(''):'<p class="chat-empty">The table is quiet. Start the chirping.</p>';if(chatOpen&&bottom)log.scrollTop=log.scrollHeight;}
  if(chatOpen&&messages.length){lastSeen=messages.at(-1).id;remember(`${identityKey}:chat`,lastSeen);}const seen=messages.findIndex(m=>m.id===lastSeen),unread=chatOpen?0:messages.slice(seen+1).filter(m=>m.ownerId!==ownerId).length;$('chatUnread').textContent=unread?String(unread):'';
 }
 function toggleChat(open){chatOpen=open;$('chatPanel').hidden=!open;$('chatToggle').setAttribute('aria-expanded',String(open));renderChat();if(open){$('chatMessages').scrollTop=$('chatMessages').scrollHeight;$('chatInput').focus();}}
 async function refreshScores(force=false){if(!state||statsBusy||(!force&&Date.now()-lastStats<LIVE_STATS_REFRESH_MS))return;const season=state.draft.seasonId;statsBusy=true;lastStats=Date.now();try{const data=await json(`/api/nhl?season=${season}`);if(state.draft.seasonId===season){liveStats=data;statsSeason=season;homeSig='';renderHome();}}catch(e){if($('homeStatsStatus'))$('homeStatsStatus').textContent=liveStats?'Showing the last saved NHL update.':'Current-season points could not be loaded. Try again shortly.';}finally{statsBusy=false;}}
 function renderHome(){if(!state)return;const d=state.draft,sig=`${d.revision}|${liveStats?.fetchedAt||''}|${d.seasonId}`;if(sig===homeSig)return;homeSig=sig;const rows=C.standings(d,statsSeason===d.seasonId?liveStats?.players:[]);rows.forEach(r=>{const s=r.players.filter(p=>C.bucket(p)!=='G'),g=r.players.filter(p=>C.bucket(p)==='G');while(s.length<10)s.push({name:'TBA',position:'F',fpts:0});while(g.length<2)g.push({name:'TBA',position:'TG',fpts:0});r.players=[...s,...g];});window.__lastSeasonApiDiagnostics={rows,season:d.seasonId,usedApi:!!liveStats,source:'shared-room-v265'};window.renderV182HomeChalkboard?.();window.__v243BuildMobileHomeRosterChart?.();let status=$('homeStatsStatus');if(!status){status=document.createElement('div');status.id='homeStatsStatus';$('dashboard').appendChild(status);}status.textContent=`${testMode?'TEST ROOM · ':''}${C.seasonLabel(d.seasonId)}${liveStats?' · '+(liveStats.stale?'Saved update · ':'')+'LIVE NHL · updated '+new Date(liveStats.fetchedAt).toLocaleTimeString([], {hour:'numeric', minute:'2-digit', second:'2-digit'})+' · checks about every 60 sec':' · Connecting to live NHL stats…'}`;}
 function renderAdmin(){if(!$('adminRoomDescription'))return;$('adminRoomDescription').textContent=testMode?'Test room: all actions here apply only to this rehearsal.':'Live pool: shared by all five managers.';$('commissionerGate').hidden=ownerId==='nick';$('commissionerActions').hidden=ownerId!=='nick';$('returnLiveRoom').hidden=!testMode;$('openSharedTestRoom').hidden=testMode;$('clearTestSeasonsBtn').hidden=!testMode;$('autoFillTestDraft').hidden=!testMode;$('endSeasonBtn').textContent=testMode?'End Test Season':'End Season';$('resetSharedRoom').textContent=testMode?'Reset test draft & lottery':'Reset live draft & lottery';if(state&&document.activeElement!==$('adminSeason'))$('adminSeason').value=state.draft.seasonId;$('commissionerActions').querySelectorAll('button').forEach(b=>b.disabled=adminBusy||!state||!!connectionError);}
 async function adminAction(action){
  if(ownerId!=='nick'||adminBusy)return;const body={action,expectedRevision:state.draft.revision};
  if(action==='reset'){const expected=testMode?'RESET TEST':'RESET LIVE DRAFT';if(prompt(`This clears ${testMode?'test':'live'} picks, chat and lottery. Archived seasons are kept. Type ${expected} to confirm.`)!==expected)return;body.confirm=expected;}
  if(action==='clear-tests'){if(!confirm('Remove this test room’s picks, lottery, chat, and test archives? Your live pool and permanent history are separate.'))return;body.confirm='CLEAR TEST DATA';}
  if(action==='undo'&&!confirm('Undo the most recent pick for everyone?'))return;
  if(action==='season')body.seasonId=$('adminSeason').value;
  if(action==='auto-fill'&&!confirm('Fill all remaining picks in this test room?'))return;
  if(action==='end-season'){if(!confirm(testMode?'Archive this TEST season using last season’s statistics, then clear the test draft?':`End ${C.seasonLabel(state.draft.seasonId)}? Final NHL points, rosters, and picks will be archived for everyone. The next season will open with empty rosters.`))return;body.requestId=uuid();}
  adminBusy=true;renderAdmin();try{const data=await request(action==='end-season'?'history':'draft',body);if(['reset','clear-tests','end-season'].includes(action)){App.lotteryOpen=false;$('liveLotteryOverlay').hidden=true;boardError='';}if(data.archived){download(`${data.archived.id}-season-backup.json`,data.archived);toast('Season archived for everyone. A backup has also been downloaded.');await loadHistory();}else toast(action==='clear-tests'?'Test data cleared. Permanent history is unchanged.':'Shared room updated.');refreshScores(true);}catch(e){toast(e.message);await refresh().catch(()=>{});}finally{adminBusy=false;render();}
 }
 function download(filename,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function showArchive(season){
  const dialog=$('seasonArchiveDialog');if(!season||!dialog)return;
  const label=season.label||C.seasonLabel(season.seasonId||season.id);
  $('seasonArchiveTitle').textContent=label;
  const rosterHtml=(season.standings||[]).map(row=>{
   const roster=row.players||season.rosters?.[row.ownerId]||[...(row.skaters||[]),...(row.goalies||[])];
   return `<section class="archive-roster"><h3>${esc(row.ownerName||name(row.ownerId))} <span>${C.num(row.pts??row.total)} FPTS</span></h3><p>${esc(row.teamName||row.team||'')}</p><table><thead><tr><th>Player</th><th>Team</th><th>FPTS</th></tr></thead><tbody>${roster.map(p=>`<tr><td>${esc(p.name)}${p.position?` <small>${esc(p.position)}</small>`:''}</td><td>${esc(p.nhlTeam||'—')}</td><td>${C.num(p.fpts??p.fantasyPoints??p.pts)}</td></tr>`).join('')||'<tr><td colspan="3">No player breakdown was saved for this roster.</td></tr>'}</tbody></table></section>`;
  }).join('');
  const picks=season.draftPicks||[];
  $('seasonArchiveContent').innerHTML=`<p class="archive-note">${season.testSeason?'TEST SEASON · ':''}${season.savedAt?'Saved '+esc(new Date(season.savedAt).toLocaleString()):'Original saved season record'}</p><div class="archive-roster-grid">${rosterHtml}</div>${picks.length?`<details class="archive-picks"><summary>All ${picks.length} draft picks</summary><ol>${picks.map(p=>`<li>Round ${p.round} · ${esc(name(p.ownerId))} · ${esc(p.player.name)}</li>`).join('')}</ol></details>`:''}`;
  $('downloadSeasonArchive').onclick=()=>download(`${season.id}-season-backup.json`,season);
  if(!dialog.open)dialog.showModal();
 }
 function roomLink(which){const u=new URL(location.href);u.search='';if(which!=='live')u.searchParams.set('room',which);u.hash='draft';return u.href;}
 async function copyLink(){const link=roomLink(room);try{await navigator.clipboard.writeText(link);toast('Room link copied. Open it on your other device.');}catch{const input=$('shareRoomLink');input.hidden=false;input.value=link;input.select();}}
 function bind(){
  $('draftTeam').insertAdjacentHTML('beforeend',Object.entries(C.TEAMS).sort((a,b)=>a[1].localeCompare(b[1])).map(([id,label])=>`<option value="${id}">${esc(label)}</option>`).join(''));
  const year=Number(C.seasonId().slice(0,4));$('adminSeason').innerHTML=Array.from({length:7},(_,i)=>{const n=year-1+i,id=`${n}${n+1}`;return `<option value="${id}">${C.seasonLabel(id)}</option>`;}).join('');
  $('draftIdentityChoices').innerHTML=C.OWNERS.map(o=>`<button type="button" data-identity="${o.id}"><strong>${o.name}</strong><span>${esc(o.teamName)}</span></button>`).join('');
  $('draftIdentityDialog').addEventListener('cancel',e=>{e.preventDefault();activate('dashboard');});$('draftIdentityChoices').addEventListener('click',e=>{const b=e.target.closest('[data-identity]');if(b)chooseIdentity(b.dataset.identity);});$('changeDraftName').onclick=()=>$('draftIdentityDialog').showModal();$('cancelDraftIdentity').onclick=()=>activate('dashboard');
  $('draftPosition').onchange=$('draftTeam').onchange=$('draftSort').onchange=()=>{limit=75;render();};$('draftSearch').oninput=()=>{limit=75;render();};$('refreshDraftPlayers').onclick=()=>{boardError='';loadPlayers();};$('showMorePlayers').onclick=()=>{limit+=75;render();};
  $('cleanDraftBoard').addEventListener('click',e=>{const p=e.target.closest('[data-pick-player]');if(p&&!p.disabled)pick(p.dataset.pickPlayer);if(e.target.id==='retryBoard'){boardError='';loadPlayers();}});
  $('chatToggle').onclick=()=>toggleChat(!chatOpen);$('chatClose').onclick=()=>toggleChat(false);$('chatForm').onsubmit=async e=>{e.preventDefault();const input=$('chatInput'),text=input.value.trim();if(!text)return;const b=e.target.querySelector('button');b.disabled=true;try{await request('draft',{action:'chat',text,requestId:uuid()});input.value='';$('chatStatus').textContent='';$('chatMessages').scrollTop=$('chatMessages').scrollHeight;}catch(error){$('chatStatus').textContent=error.message;}finally{b.disabled=false;}};
  $('openSharedTestRoom').onclick=()=>location.assign(roomLink('test-rehearsal'));$('returnLiveRoom').onclick=()=>location.assign(roomLink('live'));$('copyRoomLink').onclick=copyLink;$('openSharedHistory').onclick=()=>window.openHockeyHistoryBook?.();
  $('closeSeasonArchive').onclick=()=>$('seasonArchiveDialog').close();
  $('exportSharedBackup').onclick=async()=>{try{const [d,h]=await Promise.all([refresh(),loadHistory()]);download(`basement-bar-${room}-${new Date().toISOString().slice(0,10)}.json`,{version:265,room,savedAt:new Date().toISOString(),draft:d.draft,lottery:d.state,history:h.seasons,scoring:C.SCORING,rosterRules:C.RULES});toast('Full backup downloaded.');}catch(e){toast(e.message);}};
  for(const [id,action] of Object.entries({undoSharedPick:'undo',resetSharedRoom:'reset',clearTestSeasonsBtn:'clear-tests',endSeasonBtn:'end-season',setPoolSeason:'season',autoFillTestDraft:'auto-fill'}))$(id).onclick=()=>adminAction(action);
  document.addEventListener('click',e=>{const b=e.target.closest('[data-tab], [data-tab-jump]');if(b){const id=b.dataset.tab||b.dataset.tabJump;if($(id)){e.preventDefault();activate(id);}}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){refresh().catch(()=>{});heartbeat();refreshScores(true);}schedule();});window.addEventListener('online',()=>{refresh().catch(()=>{});heartbeat();refreshScores(true);});
  document.addEventListener('error',e=>{if(e.target.tagName==='IMG'&&e.target.closest('#cleanDraftBoard'))e.target.style.visibility='hidden';},true);
  $('teamManagerList').innerHTML=C.OWNERS.map(o=>`<article class="card"><h3>${o.name}</h3><p>${esc(o.teamName)}</p><p class="muted">6 forwards · 4 defense · 2 team goalies</p></article>`).join('');
  $('poolRulesContent').innerHTML='<article class="card"><h3>Draft</h3><p>Five managers. Twelve rounds in snake order. Each roster has 6 forwards, 4 defensemen and 2 NHL team-goalie units.</p><p>A player or team-goalie unit can be drafted once. Only the manager on the clock can make the next pick.</p></article><article class="card"><h3>Fantasy points</h3><p>Skaters: goals 2 · assists 1 · shorthanded goals +5 · game-winning goals +5.</p><p>Team goalies: wins 2 · assists 5 · goals 10 · shutouts 5. Each unit includes that NHL club’s goalie statistics, including the correct portions of traded goalies’ seasons.</p><p>Regular season only. The draft board uses the previous season for comparison. Home standings use the current pool season.</p></article>';
  new MutationObserver(syncPage).observe($('draft'),{attributes:true,attributeFilter:['class']});
 }
 const App=window.PoolApp={get ownerId(){return ownerId;},get state(){return state;},get inDraft(){return inDraft();},testMode,room,lotteryOpen:false,ensureIdentity,refresh,request,render,loadHistory,showArchive,toast,activate};
 window.officialDraftApi={load:async()=>state?.draft||(await refresh()).draft,describe:()=>connectionError||'Saved for everyone',updateSourceStatus:()=>{}};window.renderDraftRoomLottery=()=>render();
 async function init(){bind();syncPage();await refresh().catch(()=>{});refreshScores(true);schedule();if(location.hash==='#draft')activate('draft');}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
