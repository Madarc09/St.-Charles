const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Board=require('../assets/js/home-board-v303');
const P=require('../lib/pickem-store');
function player(id,name,position,nhlTeam,goals=0,assists=0){return {id:String(id),name,position,nhlTeam,goals,assists,shortHandedGoals:0,gameWinningGoals:0};}

test('v303 standings leader window orders Team Goalies, Forwards, Defence',()=>{
  const rows=[{ownerId:'nick',ownerName:'Nick',players:[player(1,'Forward One','C','TOR',2),player(2,'Defence One','D','COL',1),{id:'TG-BOS',name:'Boston Goalies',position:'TG',type:'teamGoalie',nhlTeam:'BOS',goalieWins:3}],total:0,rank:1}];
  const html=Board.renderStandings(rows,{seasonId:'20262027',picks:[]},'season',{season:'20262027',players:[],rankingPool:[]});
  const g=html.indexOf('Top 5 Team Goalies'),f=html.indexOf('Top 5 Forwards'),d=html.indexOf('Top 5 Defence');
  assert.ok(g>-1&&f>g&&d>f,'leader boards should be Goalies → Forwards → Defence');
  assert.match(html,/pool-v303-top5-window/);
});

test('v303 one requested roster presentation applies to every comparison card',()=>{
  const rows=[
    {ownerId:'nick',ownerName:'Nick',players:[player(1,'A','C','TOR')],total:0},
    {ownerId:'andrew',ownerName:'Andrew',players:[player(2,'B','C','CAR')],total:0}
  ];
  const html=Board.renderRosters(rows,{seasonId:'20262027'},{left:'nick',right:'andrew',mode:'season',view:'chart'},{});
  assert.doesNotMatch(html,/data-roster-presentation="ice"/);
  assert.ok((html.match(/data-roster-presentation="chart"/g)||[]).length>=2);
});

test('Pickem future game remains selectable even with an unfamiliar schedule state',()=>{
  const future=Date.now()+60*60*1000;
  assert.equal(P.isStarted({state:'SCHEDULED',startTimeUTC:new Date(future).toISOString()},Date.now()),false);
  assert.equal(P.isStarted({state:'LIVE',startTimeUTC:new Date(future).toISOString()},Date.now()),true);
});

test('v303 Pickem uses delegated team selection',()=>{
  const js=fs.readFileSync(path.join(__dirname,'../assets/js/pickem-v303.js'),'utf8');
  assert.match(js,/host\.addEventListener\('click',handleClick\)/);
  assert.match(js,/data-pickem-game/);
});
