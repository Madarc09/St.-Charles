const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../assets/js/pool-core');
function collector(){delete require.cache[require.resolve('../lib/nhl-data')];return require('../lib/nhl-data');}

// Reproduce the observed 3–2 game with score-feed periods on each goal and
// GameCenter periods on the surrounding block. Event IDs can differ or be absent.
function winnipegGame(){
  const connor=8478398,morrissey=8477504,perfetti=8482149;
  const goal=(id,away,home,total,assists,time)=>({playerId:id,name:{default:String(id)},teamAbbrev:{default:id===99?'DET':'WPG'},awayScore:away,homeScore:home,goalsToDate:total,strength:'PP',timeInPeriod:time,assists});
  const helper=(id,total)=>({playerId:id,assistsToDate:total});
  const goals=[goal(connor,1,0,2,[helper(morrissey,1)],'01:00'),goal(99,1,1,1,[],'02:00'),goal(perfetti,2,1,1,[helper(connor,2)],'03:00'),goal(99,2,2,2,[],'04:00'),goal(connor,3,2,3,[helper(morrissey,2)],'05:00')];
  return {game:{id:2026020035,gameState:'OFF',awayTeam:{abbrev:'WPG',score:3},homeTeam:{abbrev:'DET',score:2},goals:goals.map(g=>({...g,period:1}))},landing:{gameState:'OFF',scoring:[{periodDescriptor:{number:1},goals:goals.map(g=>({...g}))}]}};
}
function observedBase(){return {season:'20262027',players:[
  {id:'8478398',name:'Kyle Connor',position:'L',nhlTeam:'WPG',goals:3,assists:2,gameWinningGoals:1},
  {id:'8477504',name:'Josh Morrissey',position:'D',nhlTeam:'WPG',goals:0,assists:2},
  {id:'8482149',name:'Cole Perfetti',position:'C',nhlTeam:'WPG',goals:1,assists:2}
],goalies:[],teamGoalies:[]};}

test('one NHL goal is counted once across score and GameCenter shapes',()=>{
  const N=collector(),item=winnipegGame(),before=JSON.stringify(item);
  assert.equal(N.goalsFrom(item).length,5);
  // A feed-local event ID must not prevent the score/time identity from matching.
  item.landing.scoring[0].goals.forEach((g,i)=>g.eventId=100+i);
  assert.equal(N.goalsFrom(item).length,5);
  delete item.landing.scoring[0].goals[0].eventId;
  const merged=N.applyLive(observedBase(),{currentDate:'2026-10-04',games:[item],standings:[]});
  assert.equal(merged.liveGoalEvents,5);
  assert.deepEqual([merged.today.players['8478398'].goals,merged.today.players['8478398'].assists,merged.today.players['8478398'].gameWinningGoals,merged.today.players['8478398'].fpts],[2,1,1,10]);
  assert.equal(merged.today.players['8477504'].assists,2);
  assert.equal(merged.players.find(p=>p.id==='8478398').fpts,13);
  assert.equal(merged.players.find(p=>p.id==='8477504').fpts,2);
  assert.equal(N.goalsFrom(JSON.parse(before)).length,5);
});

test('fallback feeds and repeated scorers retain real goals and richer assist details',()=>{
  const N=collector(),item=winnipegGame();
  assert.equal(N.goalsFrom({game:item.game}).length,5);
  assert.equal(N.goalsFrom({game:{id:item.game.id},landing:item.landing}).length,5);
  // Even an upstream repeated goals-to-date value cannot merge different scores.
  item.game.goals.filter(g=>g.playerId===8478398).forEach(g=>g.goalsToDate=3);
  item.landing.scoring[0].goals.filter(g=>g.playerId===8478398).forEach(g=>g.goalsToDate=3);
  assert.equal(N.goalsFrom(item).length,5);
  const partial={playerId:1,eventId:7,period:1,timeInPeriod:'02:22'};
  const richer={playerId:1,eventNumber:7,timeInPeriod:'02:22',assists:[{playerId:2}],awayScore:0,homeScore:1};
  const result=N.goalsFrom({game:{id:12,goals:[partial]},landing:{summary:{scoring:[{periodDescriptor:{number:1},goals:[richer]}]}}});
  assert.equal(result.length,1);assert.deepEqual(result[0].assists,[{playerId:2}]);
});

test('duplicate feeds do not double a team goalie assist',()=>{
  const N=collector(),goal={playerId:1,teamAbbrev:{default:'NYR'},awayScore:0,homeScore:1,goalsToDate:1,assists:[{playerId:8478048,assistsToDate:1}]};
  const base={players:[],goalies:[{playerId:8478048}],teamGoalies:[]};
  const result=N.applyLive(base,{currentDate:'2026-10-04',games:[{game:{id:13,gameState:'LIVE',awayTeam:{abbrev:'UTA',score:0},homeTeam:{abbrev:'NYR',score:1},goals:[{...goal,period:1}]},landing:{scoring:[{periodDescriptor:{number:1},goals:[goal]}]}}],standings:[]});
  assert.equal(result.today.teamGoalies.NYR.goalieAssists,1);
  assert.equal(result.today.teamGoalies.NYR.fpts,5);
});

function mockReports(t,skaters,goalies=[]){
  const original=global.fetch,calls=[];
  t.after(()=>global.fetch=original);
  global.fetch=async raw=>{
    const url=new URL(raw);assert.equal(url.hostname,'api.nhle.com');
    assert.equal(url.searchParams.get('isGame'),'true');calls.push(url);
    const rows=url.pathname.includes('/goalie/')?goalies:skaters;
    return Response.json({data:rows,total:rows.length});
  };
  return calls;
}
test('a week crossing October includes September, while the month includes only October',async t=>{
  const N=collector(),season='20262027';
  const skaters=[
    {playerId:8477939,gameId:1,seasonId:20262027,gameDate:'2026-09-30',goals:2},
    {playerId:8477939,gameId:2,seasonId:20262027,gameDate:'2026-10-02',assists:1},
    {playerId:8478398,gameId:2,seasonId:20262027,gameDate:'2026-10-02',goals:1,assists:1},
    {playerId:8478398,gameId:3,seasonId:20262027,gameDate:'2026-10-04',goals:2,assists:1,gameWinningGoals:1},
    {playerId:999,gameId:4,seasonId:20252026,gameDate:'2026-10-02',goals:99}
  ];
  const goalies=[{playerId:31,gameId:1,seasonId:20262027,gameDate:'2026-09-30',teamAbbrev:'TOR',wins:1,shutouts:1},{playerId:31,gameId:2,seasonId:20262027,gameDate:'2026-10-02',teamAbbrev:'TOR',wins:1,assists:1}];
  const calls=mockReports(t,skaters,goalies);
  const today=N.applyLive(observedBase(),{currentDate:'2026-10-04',games:[winnipegGame()],standings:[]}).today;
  today.teamGoalies.TOR={goalieWins:1};
  const periods=await N.fantasyPeriods(season,today);
  assert.equal(periods.week.start,'2026-09-28');assert.equal(periods.month.start,'2026-10-01');
  assert.equal(periods.week.players['8477939'].fpts,5);assert.equal(periods.month.players['8477939'].fpts,1);
  for(const period of [periods.week,periods.month]){
    assert.equal(period.players['8478398'].fpts,13);assert.equal(period.players['8477504'].fpts,2);
    assert.equal(period.players['999'],undefined);
  }
  assert.equal(periods.week.teamGoalies.TOR.fpts,16);assert.equal(periods.month.teamGoalies.TOR.fpts,9);
  assert.equal(calls.length,2);
  for(const url of calls){const query=url.searchParams.get('cayenneExp');assert.match(query,/gameDate>="2026-09-28"/);assert.match(query,/gameDate<="2026-10-03 23:59:59"/);assert.match(query,/seasonId=20262027/);assert.match(query,/gameTypeId=2/);}
});

test('cross-year and Monday boundaries keep week and month independent',async t=>{
  const N=collector();
  const calls=mockReports(t,[{playerId:1,gameId:1,seasonId:20262027,gameDate:'2026-12-31',goals:1},{playerId:1,gameId:2,seasonId:20262027,gameDate:'2027-01-01',assists:1}]);
  const january=await N.fantasyPeriods('20262027',{date:'2027-01-02',players:{},teamGoalies:{}});
  assert.equal(january.week.start,'2026-12-28');assert.equal(january.week.players['1'].fpts,3);assert.equal(january.month.players['1'].fpts,1);
  // On Monday only today's points belong to the new week; earlier month stays.
  const monday=await N.fantasyPeriods('20262027',{date:'2027-01-04',players:{1:{goals:1}},teamGoalies:{}});
  assert.equal(monday.week.players['1'].fpts,2);assert.equal(monday.month.players['1'].fpts,3);
  assert.ok(calls.length>=2);
});

test('incomplete or duplicate NHL game reports fail instead of publishing bad totals',async t=>{
  const original=global.fetch;t.after(()=>global.fetch=original);
  const row={playerId:1,gameId:1,gameDate:'2026-10-02',goals:1};
  global.fetch=async raw=>Response.json(new URL(raw).searchParams.get('start')==='0'?{data:[row],total:2}:{data:[],total:2});
  await assert.rejects(collector().gameReport('skater/summary','2026-10-01','2026-10-03','20262027'),/truncated/);
  global.fetch=async()=>Response.json({data:[row,row],total:2});
  await assert.rejects(collector().gameReport('skater/summary','2026-10-01','2026-10-03','20262027'),/duplicate/);
});
