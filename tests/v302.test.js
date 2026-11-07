const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../assets/js/pool-core');
const Board=require('../assets/js/home-board-v302');
const P=require('../lib/pickem-store');

function player(id,name,position,nhlTeam,goals=0,assists=0){return {id:String(id),name,position,nhlTeam,goals,assists,shortHandedGoals:0,gameWinningGoals:0};}

test('v302 splits Top 5 into forwards, defence and team goalies',()=>{
  const rows=[{ownerId:'nick',ownerName:'Nick',players:[player(1,'Forward One','C','TOR'),player(2,'Defence One','D','COL'),{id:'TG-BOS',name:'Boston Bruins Goalies',position:'TG',type:'teamGoalie',nhlTeam:'BOS'}]}];
  const live={season:'20262027',players:[player(1,'Forward One','C','TOR',5,1),player(2,'Defence One','D','COL',1,8),{id:'TG-BOS',position:'TG',nhlTeam:'BOS',goalieWins:4}],rankingPool:[]};
  const draft={seasonId:'20262027'};
  const f=Board.topFantasyPanel(rows,'F',live,draft),d=Board.topFantasyPanel(rows,'D',live,draft),g=Board.topFantasyPanel(rows,'G',live,draft);
  assert.match(f,/Top 5 Forwards/);assert.match(f,/Forward One/);assert.doesNotMatch(f,/Defence One/);
  assert.match(d,/Top 5 Defence/);assert.match(d,/Defence One/);assert.doesNotMatch(d,/Forward One/);
  assert.match(g,/Top 5 Team Goalies/);assert.match(g,/Boston Bruins/);
});

test('v302 ice surface advertises chart toggle and Spare Parts replaces BOT display',()=>{
  const roster={ownerId:'bot',ownerName:'BOT',teamName:'The Spare Parts',isBot:true,players:[player(1,'F','C','TOR')],total:2};
  const html=Board.iceRinkCard(roster,{today:{date:'2026-11-07',games:[]}},'left','season');
  assert.match(html,/data-rink-view-toggle="bot"/);assert.match(html,/Spare Parts/);assert.doesNotMatch(html,/BOT ROSTER/);
});

test('weekly Pick’em weeks run Monday through Sunday and NHL finals resolve W-L',()=>{
  assert.deepEqual(P.weekBounds('2026-11-07'),{date:'2026-11-07',start:'2026-11-02',end:'2026-11-08'});
  const pick={pickedTeam:'TOR'};
  assert.deepEqual(P.resultFor(pick,{state:'FINAL',away:'MTL',home:'TOR',awayScore:2,homeScore:4}),{winner:'TOR',outcome:'W',awayScore:2,homeScore:4});
  assert.equal(P.resultFor(pick,{state:'LIVE',away:'MTL',home:'TOR',awayScore:2,homeScore:3}),null);
});

test('Pick’em leaderboard is Win% first and scoped to the active season',()=>{
  const state={picks:[
    {ownerId:'nick',seasonId:'20262027',result:{outcome:'W'}},{ownerId:'nick',seasonId:'20262027',result:{outcome:'L'}},
    {ownerId:'andrew',seasonId:'20262027',result:{outcome:'W'}},{ownerId:'andrew',seasonId:'20252026',result:{outcome:'L'}},
    {ownerId:'scott',seasonId:'20262027',result:null}
  ]};
  const rows=P.leaderboard(state,'20262027');
  assert.equal(rows[0].ownerId,'andrew');assert.equal(rows[0].winPct,1);assert.equal(rows[0].losses,0);
  assert.equal(rows.find(r=>r.ownerId==='nick').winPct,.5);
  assert.equal(rows.find(r=>r.ownerId==='scott').pending,1);
});

test('Pick’em API saves one manager selection and allows replacement before puck drop',async()=>{
  process.env.POOL_LOCAL_TEST='1';
  const API=require('../api/pickem');
  const original=P.weekSchedule;
  P.weekSchedule=async()=>[{id:'game-1',date:P.weekBounds().date,state:'FUT',startTimeUTC:'2099-11-07T23:00:00Z',away:'TOR',home:'MTL',awayScore:0,homeScore:0},{id:'game-2',date:P.weekBounds().date,state:'FUT',startTimeUTC:'2099-11-08T23:00:00Z',away:'BOS',home:'NYR',awayScore:0,homeScore:0}];
  const response=()=>{const out={statusCode:0,payload:null,headers:{}};return {out,setHeader(k,v){out.headers[k]=v;},status(n){out.statusCode=n;return this;},json(v){out.payload=v;return v;}};};
  try{
    let res=response();await API({method:'POST',query:{room:'test-v302-pickem'},body:{action:'pick',ownerId:'nick',gameId:'game-1',pickedTeam:'TOR'}},res);assert.equal(res.out.statusCode,200);assert.equal(res.out.payload.currentWeekPicks.find(p=>p.ownerId==='nick').pickedTeam,'TOR');
    res=response();await API({method:'POST',query:{room:'test-v302-pickem'},body:{action:'pick',ownerId:'nick',gameId:'game-2',pickedTeam:'NYR'}},res);assert.equal(res.out.statusCode,200);const pick=res.out.payload.currentWeekPicks.find(p=>p.ownerId==='nick');assert.equal(pick.gameId,'game-2');assert.equal(pick.pickedTeam,'NYR');
  } finally {P.weekSchedule=original;}
});
