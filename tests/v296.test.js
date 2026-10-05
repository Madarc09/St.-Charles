const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../assets/js/pool-core'),V=require('../assets/js/home-board-v293');
function collector(){delete require.cache[require.resolve('../lib/nhl-data')];return require('../lib/nhl-data');}
const season='20262027';
function lineup(){
 const players=[...Array.from({length:6},(_,i)=>({id:'F'+i,name:'Forward '+i,position:'C',nhlTeam:'TOR',goals:10-i})),...Array.from({length:4},(_,i)=>({id:'D'+i,name:'Defence '+i,position:'D',nhlTeam:'MTL',goals:6-i})),{id:'TG-TOR',name:'Toronto Maple Leafs Goalies',position:'TG',nhlTeam:'TOR',goalieWins:10},{id:'TG-MTL',name:'Montreal Canadiens Goalies',position:'TG',nhlTeam:'MTL',goalieWins:8}];
 const rows=[{ownerId:'nick',ownerName:'Nick',players:players.filter(p=>['F0','D0','TG-TOR'].includes(p.id)),total:44},{ownerId:'bot',ownerName:'BOT',teamName:'The Spare Parts',isBot:true,players:players.filter(p=>p.id==='F1'),total:18}];
 return {rows,live:{season,players,goalies:[{playerId:31,goalieFullName:'Goalie One',teamAbbrevs:'TOR',gamesPlayed:10},{playerId:32,goalieFullName:'Goalie Two',teamAbbrevs:'TOR',gamesPlayed:4}]},draft:{seasonId:season,picks:[]}};
}
test('Dream Team renders 6F / 4D / 2TG on the rink with truthful ownership and tappable portraits',()=>{
 const {rows,live,draft}=lineup(),before=JSON.stringify({rows,live,draft});
 const dream=V.dreamTeam(rows,live,draft),html=V.rosterCard(dream,'roster','left');
 assert.equal((html.match(/data-dream-position="F"/g)||[]).length,6);
 assert.equal((html.match(/data-dream-position="D"/g)||[]).length,4);
 assert.equal((html.match(/data-dream-position="G"/g)||[]).length,2);
 assert.equal((html.match(/data-player-card /g)||[]).length,12);
 assert.ok(!html.includes('<table'));assert.ok(html.includes('dream-rink'));
 assert.ok(html.includes('Team: Nick'));assert.ok(html.includes('Undrafted (The Spare Parts)'));
 assert.ok(!html.includes('Team: BOT'));assert.ok(html.includes('>Undrafted</span>'));
 assert.ok(html.includes('/31.png'));assert.ok(html.includes('/32.png'));
 assert.ok(html.indexOf('pool-dream-counts')>html.indexOf('dream-rink-player'));
 assert.equal(dream.ownerCounts.reduce((n,o)=>n+o.count,0),12);
 assert.equal(JSON.stringify({rows,live,draft}),before);
});
test('daily Dream Team view retains the rink, shows daily points and marks off days',()=>{
 const {rows,live,draft}=lineup();live.today={date:'2026-10-04',games:[{id:1,away:'TOR',home:'OTT',state:'LIVE'}],players:{F0:{goals:2}},teamGoalies:{}};
 const dream=V.dreamTeam(rows,live,draft),html=V.matchupCard(dream,live,'left','today');
 assert.ok(html.includes('dream-rink'));assert.ok(html.includes('is-off-day'));
 assert.ok(html.includes('>4 <small>FPTS</small>'));assert.ok(!html.includes('<table'));
 assert.ok(!V.renderStandings([...rows,dream],draft,'season',live).includes('The Dream Team'));
});
test('card score lookup matches game IDs, handles trades and reuses the live feed',async t=>{
 const N=collector(),original=global.fetch,calls=[];t.after(()=>global.fetch=original);
 global.fetch=async raw=>{calls.push(String(raw));return Response.json({currentDate:'2026-10-02',games:[{id:2,season:Number(season),gameType:2,gameDate:'2026-10-02',gameState:'OFF',awayTeam:{abbrev:'TOR',score:4},homeTeam:{abbrev:'MTL',score:0},periodDescriptor:{number:3}}]});};
 const current={id:1,away:'NYR',home:'BOS',awayScore:2,homeScore:1,state:'LIVE',period:2,timeRemaining:'04:12'};
 const stats={today:{date:'2026-10-04',games:[current]}};
 const games=[{gameId:'1',date:'2026-10-04',fpts:4},{gameId:'2',date:'2026-10-02',team:'TOR',fpts:6}];
 const result=await N.cardGameResults(games,season,stats,'NYR');
 assert.equal(calls.length,1);assert.ok(calls[0].endsWith('/score/2026-10-02'));
 assert.equal(result.currentGame.awayScore,2);assert.equal(result.currentGame.isToday,true);
 assert.equal(result.games[0].live,true);assert.equal(result.games[1].live,false);
 assert.equal(result.games[1].result.away,'TOR');assert.equal(result.games[1].result.homeScore,0);
 assert.deepEqual(games,[{gameId:'1',date:'2026-10-04',fpts:4},{gameId:'2',date:'2026-10-02',team:'TOR',fpts:6}]);
});
test('missing game scores leave fantasy points intact and do not invent a result',async t=>{
 const N=collector(),original=global.fetch;t.after(()=>global.fetch=original);
 global.fetch=async()=>{throw Error('offline');};
 const result=await N.cardGameResults([{gameId:'12',date:'2026-10-03',fpts:7}],season,null,'TOR');
 assert.equal(result.games[0].fpts,7);assert.equal(result.games[0].result,undefined);assert.equal(result.currentGame,null);
});
test('player and goalie cards show labelled live/final scores, clock and shutouts',()=>{
 const game={id:1,date:'2026-10-04',away:'TOR',home:'MTL',awayScore:4,homeScore:0,state:'LIVE',period:2,timeRemaining:'06:12',isToday:true};
 for(const type of ['skater','teamGoalie']){
  const data={type,season,player:{id:'1',name:'Player',team:'TOR'},team:{code:'TOR',name:'Toronto Maple Leafs'},currentGame:game,last5:[{date:game.date,label:'@ MTL',fpts:4,result:game,live:true}]};
  const live=V.cardMarkup(data);assert.ok(live.includes('Live · P2 · 06:12'));assert.ok(live.includes('<b>4</b>'));assert.ok(live.includes('<b>0</b>'));
  const final={...game,state:'OFF',period:3,timeRemaining:'00:00'};
  const html=V.cardMarkup({...data,currentGame:final,last5:[{...data.last5[0],result:final,live:false}]});
  assert.ok(html.includes('>Final</span>'));assert.ok(!html.includes('Live ·'));assert.ok(html.includes('pool-card-game-result'));
  const scheduled=V.cardMarkup({...data,currentGame:{...game,state:'FUT'},last5:[]});
  assert.ok(scheduled.includes('Scheduled'));assert.ok(scheduled.includes('pool-card-score-pending'));assert.ok(!scheduled.includes('<b>4</b>'));
 }
});

// Exercise the actual browser controller with isolated responses and a manual clock.
function cardBrowser(fetcher){
 const vm=require('node:vm'),fs=require('node:fs'),timers=new Map();let timerId=0;
 const button={dataset:{cardKind:'skater',playerId:'F0',team:'TOR'},listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}};
 const host=()=>({innerHTML:'',dataset:{},querySelectorAll:()=>[],querySelector:()=>null});
 const standings=host(),rosters=host(),dashboard=host(),main=host();
 rosters.querySelectorAll=s=>s==='[data-player-card]'?[button]:[];
 dashboard.querySelector=s=>({'[data-v280-standings-host]':standings,'[data-v280-rosters-host]':rosters}[s]||null);
 main.querySelector=()=>dashboard;
 const table={scrollLeft:0},status={textContent:''},content={innerHTML:'',querySelector:s=>s==='.pool-card-table-scroll'?table:s==='[data-card-refresh-status]'?status:null};
 const dialog={open:false,scrollTop:0,listeners:{},setAttribute(){},addEventListener(type,fn){this.listeners[type]=fn;},showModal(){this.open=true;},close(){this.open=false;this.listeners.close();},querySelector:()=>content};
 let mounted=false;
 const document={getElementById:id=>id==='seasonBoard'?main:id==='playerStatCardDialog'&&mounted?dialog:null,addEventListener(){},createElement:()=>dialog,body:{appendChild(){mounted=true;}}};
 const window={document,PoolCore:C};
 vm.runInNewContext(fs.readFileSync(require.resolve('../assets/js/home-board-v293'),'utf8'),{window,URLSearchParams,fetch:fetcher,setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);}});
 const {rows,live,draft}=lineup();window.renderSeasonBoard(rows,{...draft,seasonId:season},live);
 return {content,dialog,table,status,timers,click:()=>button.listeners.click({preventDefault(){}}),tick(){const [id,timer]=timers.entries().next().value;timers.delete(id);assert.equal(timer.ms,15000);timer.fn();}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function cardPayload(state='LIVE'){
 return {type:'skater',season,player:{id:'F0',name:'Forward Zero',team:'TOR'},last5:[],currentGame:{id:1,away:'TOR',home:'MTL',awayScore:4,homeScore:0,state,period:3,timeRemaining:'02:00',date:'2026-10-04',isToday:true}};
}
test('an open live card refreshes, survives a failed update and stops after Final',async()=>{
 let calls=0;const browser=cardBrowser(async()=>{calls++;if(calls===2)throw Error('offline');return {ok:true,json:async()=>cardPayload(calls===3?'OFF':'LIVE')};});
 browser.click();await settle();assert.ok(browser.content.innerHTML.includes('Live · P3'));assert.equal(browser.timers.size,1);
 browser.dialog.scrollTop=110;browser.table.scrollLeft=42;const before=browser.content.innerHTML;
 browser.tick();await settle();assert.equal(browser.content.innerHTML,before);assert.match(browser.status.textContent,/reconnecting/);assert.equal(browser.timers.size,1);
 browser.tick();await settle();assert.ok(browser.content.innerHTML.includes('>Final</span>'));assert.equal(calls,3);assert.equal(browser.timers.size,0);
 assert.equal(browser.dialog.scrollTop,110);assert.equal(browser.table.scrollLeft,42);
});
test('closing or switching a card prevents late responses from replacing the current card',async()=>{
 const pending=[];const browser=cardBrowser(()=>new Promise(resolve=>pending.push(resolve)));
 browser.click();browser.dialog.close();const closed=browser.content.innerHTML;
 pending.shift()({ok:true,json:async()=>cardPayload()});await settle();
 assert.equal(browser.content.innerHTML,closed);assert.equal(browser.timers.size,0);
 browser.click();browser.click();
 pending.pop()({ok:true,json:async()=>cardPayload('OFF')});await settle();const newest=browser.content.innerHTML;
 pending.shift()({ok:true,json:async()=>cardPayload()});await settle();
 assert.equal(browser.content.innerHTML,newest);assert.ok(newest.includes('>Final</span>'));assert.equal(browser.timers.size,0);
});
