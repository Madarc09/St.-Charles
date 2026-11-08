const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('v311 Pickem uses live scoreboard assets on all shared surfaces',()=>{
  const index=read('index.html'),js=read('assets/js/pickem-v311.js'),css=read('assets/css/pickem-v311.css'),sw=read('service-worker.js');
  assert.match(index,/pickem-v311\.js\?v=311/);
  assert.match(index,/pickem-v311\.css\?v=311/);
  assert.match(js,/pool-pickem-scoreboard/);
  assert.match(js,/data-pickem-detail-game/);
  assert.match(js,/goalieCard/);
  assert.match(js,/Scoring/);
  assert.match(js,/POWER PLAY/);
  assert.match(js,/SOG/);
  assert.match(css,/@media\(max-width:640px\)/);
  assert.match(css,/@media\(display-mode:standalone\)/);
  assert.match(sw,/thepool-pwa-v311/);
});

test('v311 NHL detail parser exposes goalie matchup, scoring, shots and official PP',async()=>{
  const oldFetch=global.fetch;
  global.fetch=async url=>{
    const u=String(url);
    let payload;
    if(u.endsWith('/boxscore'))payload={id:2026020268,gameDate:'2026-11-07',gameState:'LIVE',periodDescriptor:{number:1,periodType:'REG'},clock:{timeRemaining:'10:19',running:false,inIntermission:false},awayTeam:{id:8,abbrev:'MTL',score:1,sog:5},homeTeam:{id:10,abbrev:'TOR',score:0,sog:3},playerByGameStats:{awayTeam:{forwards:[],defense:[],goalies:[{playerId:1,name:{default:'Away Goalie'},starter:true,saves:3,shotsAgainst:3,goalsAgainst:0,savePctg:1,toi:'09:41'}]},homeTeam:{forwards:[],defense:[],goalies:[{playerId:2,name:{default:'Home Goalie'},starter:true,saves:4,shotsAgainst:5,goalsAgainst:1,savePctg:.8,toi:'09:41'}]}}};
    else if(u.endsWith('/play-by-play'))payload={rosterSpots:[{playerId:1,teamId:8,firstName:{default:'Away'},lastName:{default:'Goalie'},positionCode:'G',headshot:'away.png'},{playerId:2,teamId:10,firstName:{default:'Home'},lastName:{default:'Goalie'},positionCode:'G',headshot:'home.png'}],plays:[{sortOrder:1,situationCode:'1451',details:{goalieInNetId:1}},{sortOrder:2,situationCode:'1451',details:{goalieInNetId:2}}]};
    else if(u.endsWith('/landing'))payload={summary:{scoring:[{periodDescriptor:{number:1,periodType:'REG'},goals:[{playerId:8481618,name:{default:'A. Kapanen'},teamAbbrev:'MTL',goalsToDate:4,timeInPeriod:'05:56',awayScore:1,homeScore:0,strength:'ev',assists:[{playerId:99,name:{default:'N. Suzuki'},assistsToDate:8}]}]}]}};
    else if(u.endsWith('/right-rail'))payload={teamGameStats:[{category:'powerPlay',awayValue:'0/1',homeValue:'0/2'}]};
    else throw new Error('unexpected '+u);
    return {ok:true,status:200,json:async()=>payload};
  };
  delete require.cache[require.resolve('../lib/nhl-data')];
  const NHL=require('../lib/nhl-data');
  const detail=await NHL.gameDetail('2026020268');
  assert.equal(detail.game.awaySog,5);
  assert.equal(detail.game.homeSog,3);
  assert.equal(detail.goalies.away.name,'Away Goalie');
  assert.equal(detail.goalies.home.name,'Home Goalie');
  assert.equal(detail.goals[0].scorer,'A. Kapanen');
  assert.equal(detail.goals[0].assists[0].name,'N. Suzuki');
  assert.equal(detail.powerPlay.away.label,'0/1');
  assert.equal(detail.powerPlay.home.label,'0/2');
  assert.equal(detail.currentPowerPlay,'TOR');
  global.fetch=oldFetch;
});
