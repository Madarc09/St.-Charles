const test=require('node:test'),assert=require('node:assert/strict');
const V=require('../assets/js/home-board-v293');
const players=[{id:'1',name:'Toronto Forward',position:'F',nhlTeam:'TOR',goals:2},
 {id:'2',name:'Dallas Defender',position:'D',nhlTeam:'DAL',assists:2},
 {id:'TG-MTL',name:'Montreal Goalies',position:'TG',nhlTeam:'MTL',goalieWins:2}];
function fixture(){
 const today={date:'2026-10-05',games:[{id:1,away:'TOR',home:'BOS',state:'FUT'},{id:2,away:'OTT',home:'MTL',state:'LIVE'}],players:{'1':{goals:1}},teamGoalies:{MTL:{goalieWins:1}}};
 return {row:{ownerId:'nick',ownerName:'Nick',players,total:10},live:{today,matchups:{today,yesterday:{date:'2026-10-04',games:[{id:3,away:'NYR',home:'DAL',state:'OFF'}],players:{'2':{assists:1}},teamGoalies:{}},tomorrow:{date:'2026-10-06',games:[],players:{},teamGoalies:{}}}}};
}
function player(html,id){return [...html.matchAll(/<button\b[^>]*data-player-id="([^"]+)"[^>]*>[\s\S]*?<\/button>/g)].find(m=>m[1]===id)?.[0]||'';}

test('named rink labels follow the selected date and distinguish off days from unavailable schedules',()=>{
 const {row,live}=fixture(),before=JSON.stringify({row,live});
 const season=V.rosterCard(row,'roster','left','ice',live);
 assert.ok(!season.includes('dream-player-owner'));assert.ok(!season.includes('rink-player-availability'));
 const today=V.matchupCard(row,live,'left','today','ice');
 assert.match(player(today,'1'),/On the ice/);assert.match(player(today,'1'),/>vs BOS</);
 assert.match(player(today,'TG-MTL'),/On the ice/);assert.match(player(today,'TG-MTL'),/>vs OTT</);
 assert.match(player(today,'2'),/On the bench/);assert.ok(!today.includes('Team: Nick'));
 const yesterday=V.matchupCard(row,live,'left','yesterday','ice');
 assert.match(player(yesterday,'1'),/On the bench/);assert.match(player(yesterday,'2'),/>vs NYR</);
 const tomorrow=V.matchupCard(row,live,'left','tomorrow','ice');
 for(const p of players)assert.match(player(tomorrow,p.id),/On the bench/);
 const unavailable=V.matchupCard(row,{},'left','today','ice');
 assert.ok(unavailable.includes('Schedule unavailable'));assert.ok(!unavailable.includes('On the bench'));
 assert.equal(JSON.stringify({row,live}),before);
});

test('Dream Team always retains human, BOT and undrafted ownership alongside daily availability',()=>{
 const {row,live}=fixture();
 const labels=['Team: Nick','Undrafted (The Spare Parts)','Undrafted'];
 const dream={...row,ownerId:'dream-team',ownerName:'The Dream Team',isDream:true,players:players.map((p,i)=>({...p,dreamOwnerLabel:labels[i]})),ownerCounts:[]};
 for(const mode of ['season','yesterday','today','tomorrow']){
  const html=mode==='season'?V.rosterCard(dream,'roster','left','ice',live):V.matchupCard(dream,live,'left',mode,'ice');
  for(const [i,p] of players.entries())assert.ok(player(html,p.id).includes('>'+labels[i]+'</span>'));
  assert.equal(html.includes('rink-player-availability'),mode!=='season');
  assert.equal((html.match(/data-player-card /g)||[]).length,3);
 }
 const bot={...row,ownerId:'bot',ownerName:'BOT',isBot:true,teamName:'The Spare Parts'};
 assert.ok(!V.rosterCard(bot,'roster','left','ice',live).includes('dream-player-owner'));
});
