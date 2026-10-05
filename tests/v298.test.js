const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const C=require('../assets/js/pool-core'),V=require('../assets/js/home-board-v293'),Bot=require('../assets/js/bot-team');
const saved=require('../data/draft-history/20262027.json');
const copy=x=>JSON.parse(JSON.stringify(x));

function fixture(){
 const draft={...copy(saved.draft),locked:true,comparisonSeason:''};
 const players=[...draft.picks.map(p=>p.player),...Bot.record.players].map((p,i)=>({...p,
  goals:C.bucket(p)==='G'?0:i%4,assists:i%3,shortHandedGoals:0,gameWinningGoals:0,
  goalieWins:C.bucket(p)==='G'?i%4:0,goalieShutouts:0,goalieGoals:0,goalieAssists:0
 }));
 const teams=[...new Set(players.map(p=>p.nhlTeam))],active=new Set(teams.slice(0,4));
 const day={date:'2026-10-05',games:[{id:1,away:teams[0],home:teams[1],state:'LIVE'},{id:2,away:teams[2],home:teams[3],state:'OFF'}],players:{},teamGoalies:{}};
 players.filter(p=>active.has(p.nhlTeam)).forEach(p=>{if(C.bucket(p)==='G')day.teamGoalies[p.nhlTeam]={goalieWins:1};else day.players[p.id]={goals:1,assists:1};});
 const live={season:draft.seasonId,players,today:day,matchups:{today:day,yesterday:{...day,date:'2026-10-04'},tomorrow:{...day,date:'2026-10-06',players:{},teamGoalies:{}}},
  goalies:teams.flatMap((team,i)=>[{playerId:9000+i*2,goalieFullName:team+' Goalie One',teamAbbrevs:team,gamesPlayed:4},{playerId:9001+i*2,goalieFullName:team+' Goalie Two',teamAbbrevs:team,gamesPlayed:2}])};
 const rows=Bot.standings(C.standings(draft,players),draft,players);
 return {draft,rows,live};
}
function article(html,owner){return [...html.matchAll(/<article\b[^>]*data-owner="([^"]+)"[^>]*>[\s\S]*?<\/article>/g)].find(m=>m[1]===owner)?.[0]||'';}
function presentation(html,owner){return article(html,owner).match(/data-roster-presentation="([^"]+)"/)?.[1];}
function total(html){return html.match(/class="pool-roster-total"><b>([^<]+)/)?.[1];}

test('all five managers and BOT start as charts and render their own exact 6F/4D/2TG on ice',()=>{
 const {rows,live,draft}=fixture(),before=JSON.stringify({rows,live,draft});
 const html=V.renderRosters(rows,draft,{left:'nick',right:'andrew',mode:'season'},live);
 for(const row of rows){
  assert.equal(presentation(html,row.ownerId),'chart');
  const chart=article(html,row.ownerId);
  assert.ok(chart.includes('data-roster-view-toggle="'+row.ownerId+'"'));assert.ok(!chart.includes('data-roster-owner='));
  const ice=V.rosterCard(row,'roster','left','ice',live);
  for(const [bucket,count] of [['F',6],['D',4],['G',2]])assert.equal((ice.match(new RegExp('data-dream-position="'+bucket+'"','g'))||[]).length,count);
  assert.deepEqual([...ice.matchAll(/data-player-id="([^"]+)"/g)].map(m=>m[1]).sort(),row.players.map(p=>String(p.id)).sort());
  assert.ok(!ice.includes('<table'));assert.equal(total(ice),total(chart));
  assert.ok(!ice.includes('class="dream-player-owner"'),'Named roster ice cards omit redundant ownership');
  assert.equal((ice.match(/class="dream-goalie-face"/g)||[]).length,4);
  if(row.ownerId==='andrew')assert.ok(ice.includes('data-champion="true"'));
 }
 assert.equal(presentation(html,'dream-team'),'ice');
 assert.equal(JSON.stringify({rows,live,draft}),before);
});

test('ice and chart views agree on daily totals, keep all ice slots and retain tappable hockey cards',()=>{
 const {rows,live}=fixture();
 for(const mode of ['yesterday','today','tomorrow'])for(const row of rows){
  const chart=V.matchupCard(row,live,'left',mode,'chart'),ice=V.matchupCard(row,live,'left',mode,'ice');
  assert.equal(total(ice),total(chart),row.ownerName+' '+mode);
  assert.equal((ice.match(/data-player-card /g)||[]).length,12);
  assert.equal((ice.match(/data-card-kind="teamGoalie"/g)||[]).length,2);
  assert.equal((ice.match(/is-off-day/g)||[]).length,row.players.filter(p=>!V.gameForTeam(p.nhlTeam,live,mode)).length);
  assert.ok(ice.includes('data-roster-view="ice" aria-pressed="true"'));
 }
});

test('Dream Team also flips to a chart with its ownership tally, without entering actual standings',()=>{
 const {rows,live,draft}=fixture();
 const html=V.render(rows,draft,{left:'dream-team',right:'nick',mode:'season',views:{'dream-team':'chart',nick:'ice'}},live);
 assert.equal(presentation(html,'dream-team'),'chart');assert.equal(presentation(html,'nick'),'ice');
 const dream=article(html,'dream-team');assert.ok(dream.includes('<table'));assert.ok(dream.includes('Dream Team spots by roster'));
 assert.ok(dream.includes('pool-dream-owner'));assert.ok(!dream.includes('data-roster-owner='));
 assert.ok(!V.renderStandings(rows,draft,'season',live).includes('The Dream Team'));
 const index=fs.readFileSync(require.resolve('../index.html'),'utf8');
 for(const owner of C.OWNERS)assert.match(index,new RegExp('class="pool-image-link pool-nav-'+owner.id+'" data-roster-owner="'+owner.id+'"'));
});

// Minimal DOM adapter for the real browser event controller, with rebuilt buttons
// and scroll nodes. It makes no network requests and cannot touch the live draft.
function host(events){
 let html='';const buttons=new Map(),scrolls=new Map();
 const h={dataset:{},querySelectorAll(selector){
  if(selector==='[data-scroll-key]')return [...scrolls.values()];
  if(!/^\[data-/.test(selector))return [];
  if(buttons.has(selector))return buttons.get(selector);
  const attr=selector.slice(1,-1),found=[];
  for(const match of html.matchAll(/<button\b([^>]*)>/g)){
   if(!new RegExp('(?:^|\\s)'+attr+'(?:[\\s=]|$)').test(match[1]))continue;
   const dataset={};for(const a of match[1].matchAll(/data-([\w-]+)(?:="([^"]*)")?/g))dataset[a[1].replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=a[2]||'';
   found.push({dataset,listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},focus(){events.focus=dataset.rosterViewToggle;},closest(){return {animate(){events.animations++;}};}});
  }
  buttons.set(selector,found);return found;
 },querySelector(selector){if(selector==='.pool-roster-track')return scrolls.get('roster-track');return this.querySelectorAll(selector)[0]||null;}};
 Object.defineProperty(h,'innerHTML',{get:()=>html,set(value){html=value;buttons.clear();scrolls.clear();for(const m of html.matchAll(/data-scroll-key="([^"]+)"/g))scrolls.set(m[1],{dataset:{scrollKey:m[1]},scrollLeft:0});}});
 return h;
}
function browser({reduced=false}={}){
 const events={animations:0,focus:null};
 const board=()=>{const root=host(events),dashboard=host(events),standings=host(events),rosters=host(events);
  dashboard.querySelector=s=>({'[data-v280-standings-host]':standings,'[data-v280-rosters-host]':rosters}[s]||null);
  root.querySelector=s=>s==='[data-v280-dashboard]'?dashboard:dashboard.querySelector(s);
  return {root,standings,rosters};};
 const main=board(),enlarged=board(),dialog={open:true};
 const document={getElementById:id=>({seasonBoard:main.root,enlargedChalkboard:dialog,enlargedChalkboardContent:enlarged.root}[id]||null),addEventListener(){}};
 const window={document,PoolCore:C,matchMedia:()=>({matches:reduced})};
 vm.runInNewContext(fs.readFileSync(require.resolve('../assets/js/home-board-v293'),'utf8'),{window,URLSearchParams,fetch(){throw Error('Unexpected network request');}});
 const data=fixture();window.renderSeasonBoard(data.rows,data.draft,data.live);
 const click=(h,selector,predicate=()=>true)=>{const button=h.querySelectorAll(selector).find(predicate);assert.ok(button,selector);button.listeners.click({preventDefault(){}});};
 return {main,enlarged,events,data,dialog,window,click,flip(owner,board=main){click(board.rosters,'[data-roster-view-toggle]',b=>b.dataset.rosterViewToggle===owner);}};
}

test('clicking names flips only that roster, keeps both board scroll positions and never changes standings',()=>{
 const b=browser(),before=JSON.stringify(b.data);
 const mainStanding=b.main.standings.innerHTML,largeStanding=b.enlarged.standings.innerHTML;
 b.main.rosters.querySelector('.pool-roster-track').scrollLeft=870;
 b.enlarged.rosters.querySelector('.pool-roster-track').scrollLeft=1234;
 b.flip('nick');
 for(const board of [b.main,b.enlarged]){
  assert.equal(presentation(board.rosters.innerHTML,'nick'),'ice');assert.equal(presentation(board.rosters.innerHTML,'andrew'),'chart');
 }
 assert.equal(b.main.rosters.querySelector('.pool-roster-track').scrollLeft,870);
 assert.equal(b.enlarged.rosters.querySelector('.pool-roster-track').scrollLeft,1234);
 assert.equal(b.events.focus,'nick');assert.equal(b.events.animations,1);
 b.flip('bot',b.enlarged);b.flip('nick');
 assert.equal(presentation(b.main.rosters.innerHTML,'nick'),'chart');assert.equal(presentation(b.main.rosters.innerHTML,'bot'),'ice');
 assert.equal(b.main.standings.innerHTML,mainStanding);assert.equal(b.enlarged.standings.innerHTML,largeStanding);
 assert.equal(b.dialog.open,true);assert.equal(JSON.stringify(b.data),before);
});

test('view choices survive date changes, roster arrows and fresh stats; new visits restore defaults',()=>{
 const b=browser({reduced:true});b.flip('nick');b.flip('dream-team');
 b.click(b.main.rosters,'[data-v291-roster-mode]',x=>x.dataset.v291RosterMode==='today');
 assert.equal(presentation(b.main.rosters.innerHTML,'nick'),'ice');assert.equal(presentation(b.main.rosters.innerHTML,'dream-team'),'chart');
 b.click(b.main.rosters,'[data-v280-compare-shift]',x=>x.dataset.compareSide==='left'&&x.dataset.v280CompareShift==='1');
 const selected=b.main.rosters.innerHTML.match(/<article[^>]*data-compare-role="left"[^>]*data-owner="([^"]+)"/)?.[1];
 assert.equal(selected,'scott');
 const live=copy(b.data.live);live.today.players[b.data.rows.find(r=>r.ownerId==='nick').players[0].id]={goals:3};live.matchups.today=live.today;
 b.window.renderSeasonBoard(b.data.rows,b.data.draft,live);
 assert.equal(presentation(b.main.rosters.innerHTML,'nick'),'ice');assert.equal(presentation(b.main.rosters.innerHTML,'dream-team'),'chart');
 assert.ok(b.main.rosters.innerHTML.includes('data-v291-roster-mode="today" aria-pressed="true"'));
 assert.equal(b.events.animations,0,'Reduced-motion preference skips the flip animation');
 const fresh=browser();assert.equal(presentation(fresh.main.rosters.innerHTML,'nick'),'chart');assert.equal(presentation(fresh.main.rosters.innerHTML,'dream-team'),'ice');
});
