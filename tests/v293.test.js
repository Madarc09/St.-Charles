const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const C=require('../assets/js/pool-core'),V=require('../assets/js/home-board-v293');
const Themes=require('../assets/js/home-themes');
const draft={seasonId:'20262027',comparisonSeason:'20252026',picks:[],locked:false};
const rows=[
  {ownerId:'nick',ownerName:'Nick',rank:1,total:4,players:[{id:'owned',name:'Owned Skater',position:'C',nhlTeam:'TOR'},{id:'TG-TOR',name:'Toronto Maple Leafs Goalies',position:'TG',nhlTeam:'TOR'}]},
  {ownerId:'bot',ownerName:'BOT',isBot:true,rank:2,total:6,players:[{id:'bot-skater',name:'BOT Skater',position:'D',nhlTeam:'OTT'}]}
];
const live={season:'20262027',rankingPool:[
  {id:'rookie',name:'Rookie Without Games',position:'C',nhlTeam:'MTL',goals:999,fpts:99999},
  {id:'duplicate',name:'Duplicate',position:'D',nhlTeam:'LAK'},
  {id:'duplicate',name:'Duplicate',position:'D',nhlTeam:'LAK'}
],players:[
  {id:'owned',name:'Owned Skater',position:'C',nhlTeam:'TOR',goals:1},
  {id:'free',name:'Free Agent Leader',position:'L',nhlTeam:'TBL',goals:1,assists:1,shGoals:1,gameWinningGoals:1},
  {id:'second',name:'Second Scorer',position:'C',nhlTeam:'NYR',goals:3,assists:2},
  {id:'bot-skater',name:'BOT Skater',position:'D',nhlTeam:'OTT',goals:2,assists:2},
  {id:'TG-ANA',name:'Anaheim Ducks Goalies',position:'TG',nhlTeam:'ANA',goalieWins:2,goalieShutouts:1,goalieAssists:1,goalieGoals:1},
  {id:'TG-TOR',name:'Toronto Maple Leafs Goalies',position:'TG',nhlTeam:'TOR',goalieWins:1},
  {id:'individual-goalie',name:'Individual Goalie',position:'G',goalieWins:99}
]};

test('Top 5 and player cards rank the whole available skater pool with correct ownership',()=>{
  const before=JSON.stringify({rows,live,draft});
  const entries=V.topFantasyEntries(rows,false,live,draft);
  assert.equal(entries[0].player.id,'free');assert.equal(entries[0].fpts,13);assert.equal(entries[0].undrafted,true);
  assert.equal(entries.find(e=>e.player.id==='bot-skater').isBot,true);
  assert.equal(entries.find(e=>e.player.id==='owned').ownerName,'Nick');
  const html=V.renderStandings(rows,draft,'season',live);
  assert.ok(html.includes('Undrafted in our pool'));assert.ok(html.includes('Drafted by Nick'));assert.ok(html.includes('Selected by BOT'));
  const rank=V.poolRankFor(rows,'owned','skater',live,draft);
  assert.equal(rank.rank,4);assert.equal(rank.fieldSize,6);assert.equal(rank.scope,'allSkaters');
  assert.equal(JSON.stringify({rows,live,draft}),before);
});

test('team-goalie rankings cover all 32 units, include undrafted teams and exclude individual goalies',()=>{
  const entries=V.rankedPoolEntries(rows,true,live,draft);
  assert.equal(entries.length,32);assert.equal(entries[0].player.id,'TG-ANA');assert.equal(entries[0].fpts,24);
  assert.equal(entries[0].undrafted,true);assert.equal(entries[1].ownerName,'Nick');
  assert.ok(entries.every(e=>e.player.id.startsWith('TG-')));
  assert.equal(V.poolRankFor(rows,'TG-TOR','teamGoalie',live,draft).rank,2);
  assert.equal(V.topFantasyEntries(rows,true,live,draft).length,5);
});

test('prior-season catalogue scores cannot leak into current rankings; ties, deduplication and season gates work',()=>{
  const entries=V.rankedPoolEntries(rows,false,live,draft);
  assert.equal(entries.find(e=>e.player.id==='rookie').fpts,0);
  assert.equal(entries.filter(e=>e.player.id==='duplicate').length,1);
  assert.equal(entries.find(e=>e.player.id==='rookie').rank,5);
  assert.equal(entries.find(e=>e.player.id==='duplicate').rank,5);
  assert.deepEqual(V.rankedPoolEntries(rows,false,{...live,season:'20252026'},draft),[]);
  assert.deepEqual(V.rankedPoolEntries(rows,false,null,draft),[]);
  assert.ok(V.renderStandings(rows,draft,'season',null).includes('Loading season stats'));
});

test('SHG and GWG remain abbreviated in desktop, mobile and daily table headings',()=>{
  for(const mode of ['season','yesterday','today','tomorrow']){
    const html=V.render(rows,draft,{left:'nick',right:'bot',mode},live);
    assert.ok(html.includes('class="pool-head-long">SHG</span>'));
    assert.ok(html.includes('class="pool-head-long">GWG</span>'));
    assert.ok(!/shorthanded goals|game-winning goals/i.test(html));
  }
});

test('the catalogue loads once per comparison season and contributes identities, never historical scores',async()=>{
  const calls=[];let finish;
  const response=new Promise(resolve=>{finish=resolve;});
  const window={PoolCore:C,document:{getElementById(){return null;},addEventListener(){}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../assets/js/home-board-v293'),'utf8'),{
    window,URLSearchParams,fetch:async url=>{calls.push(url);return response;}
  });
  window.renderSeasonBoard(rows,draft,live);window.renderSeasonBoard(rows,draft,live);
  assert.equal(calls.length,1);assert.equal(calls[0],'/api/nhl?mode=board&season=20252026');
  finish({ok:true,json:async()=>({ok:true,season:'20252026',players:live.rankingPool})});
  await new Promise(resolve=>setImmediate(resolve));
  window.renderSeasonBoard(rows,draft,live);assert.equal(calls.length,1);
});

test('each theme preview uses current banner markup, and the active page loads the new fixes',()=>{
  const options={};
  Themes.mount({document:{readyState:'complete',documentElement:{dataset:{}},querySelector(){return null;},querySelectorAll(){return [];},getElementById:id=>id==='poolThemeOptions'?options:null,addEventListener(){}},addEventListener(){}});
  assert.equal((options.innerHTML.match(/pool-theme-preview-header/g)||[]).length,6);
  assert.ok(options.innerHTML.includes('data-preview-theme="original"'));assert.ok(options.innerHTML.includes('data-preview-theme="midnight"'));
  const index=fs.readFileSync(require.resolve('../index.html'),'utf8');
  assert.ok(index.includes('home-board-v293.js?v=298'));assert.ok(!index.includes('src="assets/js/home-board-v292.js'));
  assert.ok(index.indexOf('home-fixes-v293.css')>index.indexOf('home-skins-v292.css'));
});

test('Dream Team chooses the best 6F / 4D / 2TG and changes with current season points',()=>{
  const players=[
    ...Array.from({length:9},(_,i)=>({id:'F'+i,name:'Forward '+i,position:'C',nhlTeam:'TOR',goals:i,assists:i})),
    ...Array.from({length:7},(_,i)=>({id:'D'+i,name:'Defence '+i,position:'D',nhlTeam:'MTL',goals:i,assists:i})),
    {id:'TG-TOR',name:'Toronto Maple Leafs Goalies',position:'TG',nhlTeam:'TOR',goalieWins:3},
    {id:'TG-MTL',name:'Montreal Canadiens Goalies',position:'TG',nhlTeam:'MTL',goalieWins:2,goalieShutouts:1},
    {id:'TG-ANA',name:'Anaheim Ducks Goalies',position:'TG',nhlTeam:'ANA',goalieGoals:1}
  ];
  const stats={season:draft.seasonId,players},human=[{ownerId:'nick',ownerName:'Nick',players:[players[8]],total:24,rank:1}];
  const before=JSON.stringify({human,stats}),dream=V.dreamTeam(human,stats,draft);
  assert.equal(dream.ownerName,'The Dream Team');assert.equal(dream.players.length,12);
  assert.deepEqual(dream.players.map(C.bucket),[...Array(6).fill('F'),...Array(4).fill('D'),...Array(2).fill('G')]);
  assert.deepEqual(dream.players.filter(p=>C.bucket(p)==='F').map(p=>p.id).sort(),['F3','F4','F5','F6','F7','F8']);
  assert.deepEqual(dream.players.filter(p=>C.bucket(p)==='D').map(p=>p.id).sort(),['D3','D4','D5','D6']);
  assert.deepEqual(dream.players.filter(p=>C.bucket(p)==='G').map(p=>p.id).sort(),['TG-ANA','TG-MTL']);
  assert.equal(dream.total,dream.players.reduce((n,p)=>n+C.points(p),0));
  assert.equal(JSON.stringify({human,stats}),before);
  const changed={...stats,players:players.map(p=>p.id==='F0'?{...p,goals:100}:p)};
  const next=V.dreamTeam(human,changed,draft);
  assert.ok(next.players.some(p=>p.id==='F0'));assert.ok(!next.players.some(p=>p.id==='F3'));
  assert.ok(dream.players.some(p=>p.id==='F3'),'Earlier results are not mutated');
});

test('Dream Team is viewable in comparisons but never enters standings, period rankings or ownership',()=>{
  const dream=V.dreamTeam(rows,live,draft),combined=[...rows,dream];
  const html=V.renderRosters(rows,draft,{left:'dream-team',right:'nick',mode:'season'},live);
  assert.ok(html.includes('data-compare-role="left" data-owner="dream-team"'));
  assert.ok(html.includes('data-roster-jump="dream-team"'));assert.ok(html.includes('The Dream Team'));
  assert.ok(!html.includes('data-roster-owner="dream-team"'));
  assert.ok(!V.renderStandings(combined,draft,'season',live).includes('The Dream Team'));
  assert.equal(V.periodTeamRankings(combined,{}).length,rows.length);
  assert.equal(V.rankedPoolEntries(combined,false,live,draft).find(e=>e.player.id==='owned').ownerName,'Nick');
  assert.equal(V.rankedPoolEntries(combined,false,live,draft).find(e=>e.player.id==='free').undrafted,true);
  assert.equal(V.comparisonRows(combined,live,draft).filter(r=>r.isDream).length,1);
  assert.ok(!C.OWNERS.some(o=>o.id==='dream-team'));
});
