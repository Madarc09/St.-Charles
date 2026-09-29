const test=require('node:test'),assert=require('node:assert/strict');
process.env.POOL_LOCAL_TEST='1';
const fixture=require('../scripts/fixture-nhl');fixture.install();
const C=require('../assets/js/pool-core'),S=require('../lib/pool-store'),NHL=require('../lib/nhl-data');
const handlers={draft:require('../api/draft'),lottery:require('../api/live-lottery'),history:require('../api/history')};
let seq=0;
async function call(api,body=null,room='test-unit'){
 let status=200,payload;const res={setHeader(){},status(n){status=n;return this;},json(p){payload=p;return this;}};
 await handlers[api]({method:body?'POST':'GET',query:{room},body},res);return {status,...payload};
}
const action=(action,extras={})=>({action,ownerId:'nick',requestId:`test-request-${++seq}`, ...extras});
test('shared draft, races, archive and test isolation',async()=>{
 let initial=await call('draft');assert.equal(initial.draft.picks.length,0);assert.deepEqual(initial.draft.draftOrder,[]);
 assert.equal((await call('draft',action('pick',{playerId:'8000000',expectedRevision:0}))).status,409);
 const started=await call('lottery',action('start'));
 await Promise.all(C.OWNERS.map(o=>call('lottery',action('join',{ownerId:o.id,sessionId:started.state.sessionId}))));
 let shared=await call('draft');assert.equal(shared.state.phase,'revealing');assert.equal(new Set(shared.state.order).size,5);
 const same=await call('lottery',action('start'));assert.deepEqual(same.state.order,shared.state.order);
 await Promise.all(C.OWNERS.map(o=>call('lottery',action('finalize',{ownerId:o.id,sessionId:shared.state.sessionId}))));
 shared=await call('draft');assert.equal(shared.state.finalized,true);assert.equal(shared.draft.revision,1);
 const first=C.currentPick(shared.draft),wrong=C.OWNERS.find(o=>o.id!==first.ownerId).id;
 assert.equal((await call('draft',action('pick',{ownerId:wrong,playerId:'8000000',expectedRevision:1}))).status,409);
 const b=action('pick',{ownerId:first.ownerId,playerId:'8000000',expectedRevision:1});
 const race=await Promise.all([call('draft',b),call('draft',{...b,playerId:'8000001',requestId:'competing-pick-01'})]);
 assert.equal(race.filter(r=>r.status===200).length,1);assert.equal((await call('draft',b)).draft.picks.length,1);
 shared=await call('draft');const next=C.currentPick(shared.draft);
 assert.equal((await call('draft',action('pick',{ownerId:next.ownerId,playerId:'8000000',expectedRevision:shared.draft.revision}))).status,409);
 assert.equal((await call('draft',action('chat',{ownerId:'outsider',text:'x'}))).status,401);
 await call('draft',action('chat',{ownerId:'andrew',text:'Nice pick <script>literal</script>'}));assert.equal((await call('draft')).messages.length,1);
 shared=await call('draft');const filled=await call('draft',action('auto-fill',{expectedRevision:shared.draft.revision}));assert.equal(filled.status,200);assert.equal(filled.draft.picks.length,60);
 assert.equal(new Set(filled.draft.picks.map(p=>p.player.id)).size,60);C.OWNERS.forEach(o=>assert.deepEqual(C.counts(filled.draft,o.id),C.RULES));
 // A background refresh may show stale data; End Season must fail safely instead.
 fixture.setOutage(true);
 try {
  const background=NHL.statistics(filled.draft.comparisonSeason,{fresh:true,allowStale:true});
  const failed=await call('history',action('end-season',{expectedRevision:filled.draft.revision}));
  assert.equal(failed.status,502);assert.equal((await background).stale,true);
  assert.equal((await call('draft')).draft.picks.length,60);assert.equal((await call('history')).seasons.length,0);
 } finally {fixture.setOutage(false);}
 const boardPoints=filled.draft.picks.reduce((sum,p)=>sum+C.points(p.player),0);fixture.setMultiplier(2);
 const end=action('end-season',{expectedRevision:filled.draft.revision});const saved=await call('history',end);
 assert.equal(saved.status,200);assert.ok(saved.archived.standings.reduce((s,r)=>s+r.pts,0)>boardPoints);assert.equal(saved.archived.draftPicks.length,60);assert.equal(saved.draft.picks.length,0);assert.equal(saved.archived.testSeason,true);
 const again=await call('history',end);assert.equal(again.status,200);assert.equal((await call('history')).seasons.length,1);
 const live=await call('draft',null,'live');const realHistory=await call('history',null,'live');assert.equal(live.draft.picks.length,0);assert.equal(realHistory.seasons.length,3);
 const cleared=await call('draft',action('clear-tests',{expectedRevision:saved.draft.revision,confirm:'CLEAR TEST DATA'}));assert.equal(cleared.status,200);assert.equal((await call('history')).seasons.length,0);assert.deepEqual((await call('history',null,'live')).seasons,realHistory.seasons);
 assert.equal((await call('draft',action('clear-tests',{expectedRevision:0,confirm:'CLEAR TEST DATA'}),'live')).status,400);
 assert.equal((await call('draft',action('auto-fill',{expectedRevision:0}),'live')).status,400);
});
test('NHL totals, traded goalies, rookies, season scoring and snake turns',async()=>{
 const data=await NHL.statistics('20242025',{fresh:true});const tor=data.teamGoalies.find(p=>p.nhlTeam==='TOR');
 const original=fixture.goalies.find(p=>p.teamAbbrevs==='TOR');assert.equal(tor.goalieWins,original.wins+5);assert.equal(tor.goalieGoals,1);assert.equal(tor.savePct,1850/2035);assert.equal(tor.goalsAgainstAverage,185*3600/252000);
 const board=await NHL.board('20242025');assert.equal(board.players.filter(p=>p.position==='TG').length,32);assert.ok(board.players.find(p=>p.id==='8999999'&&p.fpts===0&&p.teamVerified));
 assert.ok(board.players.find(p=>p.id==='TG-WSH'&&p.goalieWins>0&&p.teamVerified));assert.equal(C.TEAMS.WSH,'Washington Capitals');
 assert.equal(C.teamGoalies([{gamesPlayed:15,gamesStarted:12},{gamesPlayed:5,gamesStarted:3}],'TOR').gamesPlayed,15);
 const d={draftOrder:C.OWNERS.map(o=>o.id),picks:[]};assert.equal(C.currentPick({...d,picks:Array(4)}).ownerId,'scott');assert.equal(C.currentPick({...d,picks:Array(5)}).ownerId,'scott');assert.equal(C.currentPick({...d,picks:Array(9)}).ownerId,'nick');
 const rows=C.standings({...d,picks:[{ownerId:'nick',player:{id:'123',position:'C',goals:90,assists:80,fpts:500}}]},[]);assert.equal(rows.find(r=>r.ownerId==='nick').pts,0);
});

test('live GameCenter overlay shows an in-progress goal before season summary catches up',async()=>{
 fixture.setMultiplier(1);
 const season=C.seasonId();
 const data=await NHL.statistics(season,{fresh:true});
 const scorer=data.players.find(p=>p.id===String(fixture.skaters[0].playerId));
 const helper=data.players.find(p=>p.id===String(fixture.skaters[1].playerId));
 assert.equal(data.liveOverlay,true);
 assert.equal(data.liveGoalEvents,1); // score + GameCenter report the same event; count it once.
 assert.equal(scorer.goals,fixture.skaters[0].goals+1);
 assert.equal(helper.assists,fixture.skaters[1].assists+1);
 assert.equal(scorer.fpts,C.points(scorer));
 // The daily score payload alone must be sufficient if GameCenter is briefly late.
 const scoreOnly=NHL.goalsFrom({game:{id:77,goals:[{eventId:7,playerId:8477939,goalsToDate:1}]},landing:{}});
 assert.equal(scoreOnly.length,1);assert.equal(String(scoreOnly[0].playerId),'8477939');
 // Also cover opening-night zero-row behavior: the live event must create the stat row.
 const opening=NHL.applyLive({players:[],goalies:[],teamGoalies:[],fetchedAt:new Date().toISOString()},{fetchedAt:new Date().toISOString(),standings:[],games:[{game:{id:1,season:Number(season),gameType:2,gameState:'LIVE',awayTeam:{abbrev:'MTL',score:0},homeTeam:{abbrev:'TOR',score:1}},landing:{gameState:'LIVE',awayTeam:{abbrev:'MTL',score:0},homeTeam:{abbrev:'TOR',score:1},scoring:[{goals:[{playerId:8479999,name:{default:'Opening Night Scorer'},teamAbbrev:{default:'TOR'},strength:'EV',goalsToDate:1,awayScore:0,homeScore:1,assists:[]}]}]}}]});
 const created=opening.players.find(p=>p.id==='8479999');
 assert.ok(created);assert.equal(created.goals,1);assert.equal(created.fpts,2);
});
test('paged NHL responses and legacy migration preserve the intended room',async()=>{
 fixture.setPageLimit(25);
 try {const rows=await NHL.report('skater/summary','20232024');assert.equal(rows.length,130);assert.equal(new Set(rows.map(r=>r.playerId)).size,130);}finally{fixture.setPageLimit(Infinity);}
 const staleLive=S.freshRoom('live');staleLive.draft.seasonId='20252026';staleLive.draft.comparisonSeason='20242025';staleLive.draft.picks=[{ownerId:'nick',player:{id:'8477939',position:'C'}}];
 S.normalizeLiveSeason(staleLive,'live');assert.equal(staleLive.draft.seasonId,C.seasonId());assert.equal(staleLive.draft.comparisonSeason,C.previousSeason(C.seasonId()));
 const futureLive=S.freshRoom('live');futureLive.draft.seasonId='20272028';S.normalizeLiveSeason(futureLive,'live');assert.equal(futureLive.draft.seasonId,'20272028');
 const order=C.OWNERS.map(o=>o.id),old={picks:[],draftOrder:order,__manualRosterReset:true,__rostersClearedAt:'2026-09-20T12:00:00Z'};
 const staleLottery={phase:'complete',order,finalized:true,requestedAt:'2026-09-19T12:00:00Z'};
 const locked={orderIds:order,locked:true,timestamp:'2026-09-19T12:00:00Z'};
 const reset=S.migrateLegacy(S.freshRoom('live'),old,staleLottery,locked);assert.deepEqual(reset.draft.draftOrder,[]);assert.equal(reset.lottery.phase,'idle');
 const current=S.migrateLegacy(S.freshRoom('live'),old,{...staleLottery,requestedAt:'2026-09-21T12:00:00Z'},locked);assert.deepEqual(current.draft.draftOrder,order);assert.equal(current.lottery.finalized,true);
 const historic=S.migrateLegacy(S.freshRoom('live'),{...old,__fromStaticSeasonRecord:true},staleLottery,locked);assert.equal(historic.draft.picks.length,0);assert.equal(historic.lottery.phase,'idle');
 const picked={...old,picks:[{ownerId:'nick',player:{id:'8000000',position:'C'}}]};
 const inProgress=S.migrateLegacy(S.freshRoom('live'),picked,null,null);assert.equal(inProgress.draft.picks.length,1);assert.deepEqual(inProgress.draft.draftOrder,order);assert.equal(inProgress.lottery.finalized,true);
});
