const test=require('node:test'),assert=require('node:assert/strict');
const Clock=require('../lib/pool-clock'),V=require('../assets/js/home-board-v293');
function collector(){delete require.cache[require.resolve('../lib/nhl-data')];return require('../lib/nhl-data');}

test('the hockey day changes at 4 a.m. Eastern across DST, year and leap-day boundaries',()=>{
 const cases=[
  ['2026-10-05T07:59:59Z','2026-10-04'],['2026-10-05T08:00:00Z','2026-10-05'],
  ['2026-10-05T12:00:00Z','2026-10-05'],['2026-10-06T03:59:59Z','2026-10-05'],
  ['2026-03-08T07:59:59Z','2026-03-07'],['2026-03-08T08:00:00Z','2026-03-08'],
  ['2026-11-01T05:30:00Z','2026-10-31'],['2026-11-01T06:30:00Z','2026-10-31'],
  ['2026-11-01T08:59:59Z','2026-10-31'],['2026-11-01T09:00:00Z','2026-11-01'],
  ['2027-01-01T08:59:59Z','2026-12-31'],['2027-01-01T09:00:00Z','2027-01-01'],
  ['2028-03-01T08:59:59Z','2028-02-29'],['2028-03-01T09:00:00Z','2028-03-01']
 ];
 for(const [instant,expected] of cases)assert.equal(Clock.gameDate(new Date(instant)),expected,instant);
 const N=collector();
 assert.equal(N.periodDateBounds(Clock.gameDate(new Date('2026-10-05T07:59:59Z'))).weekStart,'2026-09-28');
 assert.equal(N.periodDateBounds(Clock.gameDate(new Date('2026-10-05T08:00:00Z'))).weekStart,'2026-10-05');
});

test('dated NHL lookups and cache keys switch together at 4 a.m., retaining only that season and date',async t=>{
 const N=collector(),original=global.fetch,calls=[];t.after(()=>global.fetch=original);
 global.fetch=async raw=>{
  const url=new URL(raw);calls.push(url.pathname);
  if(url.pathname==='/v1/standings/now')return Response.json({standings:[]});
  const date=url.pathname.split('/').at(-1);
  const game={id:1,season:20262027,gameType:2,gameDate:date,gameState:'FUT',awayTeam:{abbrev:'TOR'},homeTeam:{abbrev:'MTL'}};
  return Response.json({currentDate:date,games:[game,{...game,id:2,season:20252026},{...game,id:3,gameType:1},{...game,id:4,gameDate:'2026-10-01'}]});
 };
 const before=await N.liveFeed('20262027',new Date('2026-10-05T07:59:59Z'));
 const after=await N.liveFeed('20262027',new Date('2026-10-05T08:00:00Z'));
 const cached=await N.liveFeed('20262027',new Date('2026-10-05T08:00:01Z'));
 assert.equal(before.currentDate,'2026-10-04');assert.equal(after.currentDate,'2026-10-05');
 assert.deepEqual(cached,after);assert.equal(before.todayGames.length,1);assert.equal(after.todayGames.length,1);
 assert.deepEqual(calls.filter(p=>p.includes('/score/')),['/v1/score/2026-10-04','/v1/score/2026-10-05']);
});

test('a wrong date or missing NHL slate is unavailable, not a fabricated off day',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);
 global.fetch=async raw=>Response.json(String(raw).includes('/standings/')?{standings:[]}:{currentDate:'2026-10-04',games:[]});
 await assert.rejects(collector().liveFeed('20262027',new Date('2026-10-05T12:00:00Z')),/mismatched daily schedule/);
 global.fetch=async()=>Response.json({currentDate:'2026-10-05'});
 await assert.rejects(collector().matchupDay('20262027','2026-10-05'),/unavailable/);
});

test('daily filtering keeps active players in their season slots and restores the whole roster',()=>{
 const players=[{id:'1',name:'First',position:'F',nhlTeam:'TOR',goals:5},{id:'2',name:'Second',position:'F',nhlTeam:'DAL',goals:4},{id:'3',name:'Third',position:'F',nhlTeam:'MTL',goals:3},{id:'TG-TOR',position:'TG',nhlTeam:'TOR',goalieWins:2},{id:'TG-DAL',position:'TG',nhlTeam:'DAL',goalieWins:1}];
 const row={ownerId:'nick',ownerName:'Nick',players,total:30},day={date:'2026-10-05',games:[{away:'DAL',home:'BOS',state:'FUT'}],players:{},teamGoalies:{}};
 const live={today:day},before=JSON.stringify({row,live});
 const season=V.rosterCard(row,'roster','left',undefined,live),daily=V.matchupCard(row,live,'left','today');
 const positions=html=>Object.fromEntries([...html.matchAll(/style="([^"]+)"[^>]*data-player-id="([^"]+)"/g)].map(m=>[m[2],m[1]]));
 assert.equal(V.rosterPresentation(row),'ice');assert.deepEqual(Object.keys(positions(daily)).sort(),['2','TG-DAL']);
 for(const id of ['2','TG-DAL'])assert.equal(positions(daily)[id],positions(season)[id]);
 assert.equal(V.rosterCard(row,'roster','left',undefined,live),season);
 assert.ok(V.rosterCard(row,'roster','left','chart',live).includes('<table'));
 const dream={...row,isDream:true,ownerId:'dream-team',ownerName:'The Dream Team',ownerCounts:[]};
 assert.ok(V.rosterCard(dream,'roster','left',undefined,live).includes('data-rink-logo="ALL-STAR"'));
 assert.equal(JSON.stringify({row,live}),before);
});
