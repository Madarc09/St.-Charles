const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require('../assets/js/pool-core'),Bot=require('../assets/js/bot-team');
const V291=require('../assets/js/home-board-v291'),Board=require('../assets/js/home-board-v292');
const Themes=require('../assets/js/home-themes');
const captured=require('../data/draft-history/20262027.json');
const copy=x=>JSON.parse(JSON.stringify(x));
const draft=()=>({...copy(captured.draft),locked:true});
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const freeze=value=>{Object.freeze(value);Object.values(value).forEach(x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x))freeze(x);});return value;};

test('the fixed BOT has 6F / 4D / 2TG, shares no human picks, and has one canonical saved roster',()=>{
  const d=draft(),humanIds=new Set(d.picks.map(p=>String(p.player.id))),players=Bot.record.players;
  assert.equal(Bot.status(d).active,true);
  assert.equal(new Set(players.map(p=>p.id)).size,12);
  for(const bucket of ['F','D','G'])assert.equal(players.filter(p=>C.bucket(p)===bucket).length,C.RULES[bucket]);
  for(const p of players)assert.equal(humanIds.has(p.id),false,p.name);
  assert.deepEqual(C.OWNERS.map(o=>o.id).sort(),['andrew','chris','nick','scott','tyler']);
  const browser={window:{}};vm.runInNewContext(read('assets/js/bot-roster-20262027.js'),browser);
  assert.deepEqual(copy(browser.window.PoolBotRoster),Bot.record);
  assert.equal(Bot.record.locked,true);
  assert.equal(Bot.record.scoringStart,'season-start');
});

test('BOT scoring uses only live stats, all scoring bonuses, competition ranks and immutable input',()=>{
  const d=freeze(draft()),humans=freeze(C.standings(d,[]));
  const stats=freeze([
    {id:'8479542',goals:2,assists:3,shGoals:1,gameWinningGoals:1,fpts:99999,projectedPoints:99999},
    {id:'TG-FLA',goalieWins:2,goals:1,assists:2,goalieShutouts:1},
    {id:'8479323',goals:1,assists:4,nhlTeam:'NYR'}
  ]);
  const row=Bot.row(d,stats);
  assert.equal(row.total,17+29+6);
  assert.equal(row.players.find(p=>p.id==='8479542').fpts,17);
  assert.equal(row.players.find(p=>p.id==='TG-FLA').fpts,29);
  assert.equal(row.players.find(p=>p.id==='8478427').fpts,0,'Missing live player cannot inherit a forecast');
  assert.deepEqual(row.players.map(C.bucket),[...Array(6).fill('F'),...Array(4).fill('D'),...Array(2).fill('G')]);
  const ranked=Bot.standings(humans,d,stats);
  assert.equal(ranked[0].ownerId,'bot');assert.equal(ranked[0].rank,1);
  assert.ok(ranked.slice(1).every(r=>r.rank===2));
  assert.equal(Bot.standings(ranked,d,stats).length,6,'Refresh never duplicates the BOT');
  assert.deepEqual(humans,C.standings(d,[]));
  assert.deepEqual(d.picks,captured.draft.picks);
});

test('BOT cannot enter another season, incomplete draft, changed ownership, or claim a human player',()=>{
  for(const [change,reason] of [
    [d=>{d.seasonId='20272028';},'different-season'],
    [d=>{d.locked=false;},'draft-not-locked'],
    [d=>{d.picks.pop();},'different-draft'],
    [d=>{d.picks[0].ownerId='another-manager';},'different-draft'],
    [d=>{d.picks[0].player.id='8479542';},'human-player-conflict']
  ]){
    const d=draft();change(d);assert.equal(Bot.status(d).reason,reason);assert.equal(Bot.row(d,[]),null);
    assert.equal(Bot.standings(C.standings(d,[]),d,[]).length,5);
  }
  const browser={window:{PoolCore:C}};vm.runInNewContext(read('assets/js/bot-team.js'),browser);
  assert.equal(browser.window.PoolBot.standings([],draft(),[]).length,0,'Missing manifest fails without breaking the human board');
});

test('v292 preserves v291 human board markup and controls for every view',()=>{
  const d=draft(),rows=C.standings(d,[]),live={today:{date:'2026-10-03',games:[],players:{},teamGoalies:{}},matchups:{yesterday:{date:'2026-10-02',games:[]},tomorrow:{date:'2026-10-04',games:[]}},periods:{week:{},month:{}}};
  for(const mode of ['season','yesterday','today','tomorrow'])for(const standingsMode of ['season','today']){
    const state={left:'nick',right:'andrew',mode,standingsMode};
    assert.equal(Board.render(rows,d,state,live),V291.render(rows,d,state,live),mode+'/'+standingsMode);
  }
});

test('BOT participates in daily, weekly and monthly results with no roster-room link',()=>{
  const d=draft(),rows=Bot.standings(C.standings(d,[]),d,[]),bot=rows.find(r=>r.isBot);
  const day={date:'2026-10-03',games:[{away:'TBL',home:'FLA',state:'FINAL',awayScore:3,homeScore:2}],players:{'8479542':{goals:1,assists:2,shortHandedGoals:1,gameWinningGoals:1}},teamGoalies:{FLA:{goalieWins:1,goalieAssists:1,goalieGoals:1,goalieShutouts:1}}};
  const live={today:day,matchups:{today:day,yesterday:{...day,date:'2026-10-02'},tomorrow:{...day,date:'2026-10-04',games:[{away:'TBL',home:'FLA',state:'FUT'}],players:{},teamGoalies:{}}},periods:{week:{players:{'8479542':{fpts:14}},teamGoalies:{FLA:{fpts:22}}},month:{players:{'8479542':{fpts:28}},teamGoalies:{FLA:{fpts:44}}}}};
  assert.equal(Board.todaySummary(bot,live).total,36);
  assert.equal(Board.dailyLine(bot.players.find(p=>p.id==='8479542'),live,'yesterday').fpts,14);
  assert.equal(Board.dailyLine(bot.players.find(p=>p.id==='8479542'),live,'tomorrow').fpts,0);
  assert.equal(Board.periodTeamRankings(rows,live.periods.week).find(r=>r.isBot)._periodFpts,36);
  assert.equal(Board.periodTeamRankings(rows,live.periods.month).find(r=>r.isBot)._periodFpts,72);
  assert.equal((Board.periodRankPanel(rows,live.periods.week,'This Week','FPTS').match(/<li>/g)||[]).length,6);
  const html=Board.render(rows,d,{left:'bot',right:'nick',mode:'season'},live);
  assert.ok(html.includes('data-bot-compare'));assert.ok(html.includes('BOT ROSTER · THE SPARE PARTS'));
  assert.ok(!html.includes('data-roster-owner="bot"'));
  assert.ok(Board.matchupCard(bot,live,'left','today').includes('2 selections scheduled'));
  assert.ok(Board.cardMarkup({type:'skater',player:{name:'BOT skater',team:'TBL'},fantasyDraft:{isBot:true},last5:[]}).includes('Selected for BOT from the undrafted pool.'));
});

// Exercise browser event/data wiring without a browser or any network requests.
function host(){
  return {innerHTML:'',buttons:new Map(),dataset:{},
    querySelectorAll(selector){
      if(!/^\[data-/.test(selector)||selector==='[data-scroll-key]')return [];
      if(this.buttons.has(selector))return this.buttons.get(selector);
      const attr=selector.slice(1,-1),buttons=[];
      for(const match of this.innerHTML.matchAll(/<button\b([^>]*)>/g)){
        if(!new RegExp('(?:^|\\s)'+attr+'(?:[\\s=]|$)').test(match[1]))continue;
        const dataset={};for(const a of match[1].matchAll(/data-([\w-]+)(?:="([^"]*)")?/g))dataset[a[1].replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=a[2]||'';
        buttons.push({dataset,listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}});
      }
      this.buttons.set(selector,buttons);return buttons;
    },
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  };
}
test('browser board adds BOT once and standings, roster dates and comparison stay independent',()=>{
  const standings=host(),rosters=host(),record=host(),dashboard=host(),main=host();
  for(const h of [standings,rosters]){let html='';Object.defineProperty(h,'innerHTML',{get:()=>html,set:value=>{html=value;h.buttons.clear();}});}
  dashboard.querySelector=s=>({'[data-v280-standings-host]':standings,'[data-v280-rosters-host]':rosters,'[data-v280-record]':record}[s]||null);
  main.querySelector=s=>s==='[data-v280-dashboard]'?dashboard:dashboard.querySelector(s);
  const document={getElementById:id=>id==='seasonBoard'?main:null,addEventListener(){}};
  const window={document,PoolCore:C,PoolBot:Bot};
  vm.runInNewContext(read('assets/js/home-board-v292.js'),{window,URLSearchParams,fetch(){throw Error('No test network');}});
  const d=draft(),rows=C.standings(d,[]),live={season:'20262027',players:[{id:'8479542',goals:1}],today:{date:'2026-10-03',players:{},teamGoalies:{},games:[]}};
  window.renderSeasonBoard(rows,d,live);
  assert.equal((standings.innerHTML.match(/data-bot-compare/g)||[]).length,1);
  const before=standings.innerHTML;
  const click=b=>b.listeners.click({preventDefault(){}});
  click(rosters.querySelectorAll('[data-v291-roster-mode]').find(b=>b.dataset.v291RosterMode==='tomorrow'));
  assert.equal(standings.innerHTML,before);
  assert.ok(rosters.innerHTML.includes('data-v291-roster-mode="tomorrow" aria-pressed="true"'));
  const rosterBefore=rosters.innerHTML;
  click(standings.querySelector('[data-v280-standings-toggle]'));
  assert.ok(standings.innerHTML.includes('TODAY’S SCORES'));assert.equal(rosters.innerHTML,rosterBefore);
  click(standings.querySelector('[data-bot-compare]'));
  assert.ok(rosters.innerHTML.includes('data-compare-role="left" data-owner="bot"'));
  window.renderSeasonBoard(rows,d,live);
  assert.equal((standings.innerHTML.match(/data-bot-compare/g)||[]).length,1);
  assert.ok(rosters.innerHTML.includes('data-v291-roster-mode="tomorrow" aria-pressed="true"'));
  click(standings.querySelector('[data-v280-standings-toggle]'));
  window.renderSeasonBoard(rows,d,{...live,season:'20252026'});
  const botStanding=standings.innerHTML.match(/<tr><td[^]*?data-bot-compare[^]*?<\/tr>/)?.[0];
  assert.ok(botStanding?.includes('data-board-focus="standing-bot">BOT</button></th><td class="pool-fpts-cell pool-fpts-first">0</td>'),'Another season cannot supply BOT season points');
});

test('six device-local themes load real artwork while retaining the legacy layout base',()=>{
  assert.equal(Themes.themes.length,6);assert.equal(Themes.themes[0].id,'original');
  assert.equal(Themes.normalize('chalkboard'),'original');
  const attrs={src:'initial'},header={getAttribute:k=>attrs[k],setAttribute:(k,v)=>{attrs[k]=v;}};
  const values=new Map(),document={readyState:'complete',documentElement:{dataset:{}},addEventListener(){},querySelector:()=>header,querySelectorAll:()=>[],getElementById:()=>null};
  const api=Themes.mount({document,localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},addEventListener(){},fetch(){throw Error('Preference is local only');}});
  for(const theme of Themes.themes){
    api.select(theme.id);assert.equal(document.documentElement.dataset.poolTheme,'chalkboard');
    assert.equal(document.documentElement.dataset.homeSkin,theme.id);
    assert.ok(fs.existsSync(path.join(__dirname,'..',attrs.src.split('?')[0])));
  }
  api.select('original');assert.equal(attrs.src,'assets/images/home-leaderboard-basement-board.png?v=269');
  const index=read('index.html');
  assert.ok(index.indexOf('bot-roster-20262027.js')<index.indexOf('bot-team.js'));
  assert.ok(index.indexOf('bot-team.js')<index.indexOf('home-board-v293.js'));
  assert.ok(index.indexOf('home-v291.css')<index.indexOf('home-skins-v292.css'));
});
