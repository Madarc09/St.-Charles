const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Themes = require('../assets/js/home-themes');
const Board = require('../assets/js/home-board');
const C = require('../assets/js/pool-core');
const memory = () => {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), values };
};
test('theme survives new page instances while two different browsers keep independent choices', () => {
  const phone = memory(), computer = memory(), friendsPhone = memory();
  assert.equal(Themes.read(phone), 'chalkboard');
  for (const theme of Themes.themes) {
    assert.equal(Themes.write(phone, theme.id).saved, true);
    assert.equal(Themes.read(phone), theme.id);
    assert.equal(Themes.read(friendsPhone), 'chalkboard');
  }
  Themes.write(computer, 'press');
  Themes.write(friendsPhone, 'ice');
  assert.equal(Themes.read(phone), 'arcade');
  assert.equal(Themes.read(computer), 'press');
  assert.equal(Themes.read(friendsPhone), 'ice');
  assert.deepEqual([...phone.values.keys()], [Themes.storageKey], 'Only the local theme preference is saved');
});
test('blocked storage and obsolete preferences do not prevent the page or themes from working', () => {
  const blocked = { getItem() { throw Error('Private browser'); }, setItem() { throw Error('Quota'); } };
  assert.equal(Themes.read(blocked), Themes.defaultTheme);
  assert.deepEqual(Themes.write(blocked, 'arena'), { theme: 'arena', saved: false });
  const storage = memory();
  storage.setItem(Themes.storageKey, 'deleted-theme');
  assert.equal(Themes.read(storage), Themes.defaultTheme);
  assert.deepEqual(Themes.write(storage, '<script>'), { theme: Themes.defaultTheme, saved: true });
});
test('saved theme is applied before DOM readiness and radio changes update it without a server request', () => {
  const storage = memory();
  Themes.write(storage, 'press');
  const docEvents = {}, winEvents = {}, labels = [], inputs = Themes.themes.map(theme => ({
    value: theme.id, checked: false,
    closest() { return labels[Themes.themes.indexOf(theme)]; },
    matches(selector) { return selector === 'input[name="pool-home-theme"]'; }
  }));
  Themes.themes.forEach(() => labels.push({ dataset: {} }));
  const name = {}, status = {}, options = {};
  const doc = {
    readyState: 'loading', documentElement: { dataset: {} },
    addEventListener(name, cb) { docEvents[name] = cb; },
    getElementById(id) { return { themeSaveStatus: status, poolThemeOptions: options }[id]; },
    querySelectorAll(selector) { return selector === '[data-current-theme]' ? [name] : inputs; }
  };
  const win = { document: doc, localStorage: storage, addEventListener(name, cb) { winEvents[name] = cb; }, fetch() { throw Error('Theme must not contact a server'); } };
  Themes.mount(win);
  assert.equal(doc.documentElement.dataset.poolTheme, 'press', 'No flash of the default theme');
  docEvents.DOMContentLoaded();
  assert.ok(options.innerHTML.includes('Arcade Hockey'));
  assert.equal(inputs.filter(i => i.checked).length, 1);
  docEvents.change({ target: inputs.find(i => i.value === 'arena') });
  assert.equal(Themes.read(storage), 'arena');
  assert.equal(doc.documentElement.dataset.poolTheme, 'arena');
  assert.equal(name.textContent, 'Arena Scoreboard');
  // A second tab in the SAME browser follows the device's saved preference.
  Themes.write(storage, 'ice');
  winEvents.storage({ key: Themes.storageKey });
  assert.equal(doc.documentElement.dataset.poolTheme, 'ice');
  // Closing/reopening the browser creates a new document using the same storage.
  const fresh = { ...doc, documentElement: { dataset: {} } };
  Themes.mount({ ...win, document: fresh });
  assert.equal(fresh.documentElement.dataset.poolTheme, 'ice');
});
test('standings separate goalie stats so displayed stat contributions match the unchanged scoring total', () => {
  const players = [
    { id: '1', name: 'A forward', position: 'C', goals: 7, assists: 20, shortHandedGoals: 0, gameWinningGoals: 1 },
    { id: '2', name: 'A defender', position: 'D', goals: 2, assists: 9, shGoals: 1, gameWinningGoals: 0 },
    { id: '3', name: 'New York Islanders Goalies', position: 'TG', goalieWins: 6, goalieAssists: 1, goalieGoals: 1, goalieShutouts: 1, goals: 1, assists: 1 }
  ];
  const total = players.reduce((sum, p) => sum + C.points(p), 0);
  const row = { ownerId: 'nick', ownerName: 'Nick', rank: 1, players, total };
  const summary = Board.summary(row);
  assert.deepEqual(summary, { goals: 9, assists: 29, shortHandedGoals: 1, gameWinningGoals: 1, goalieFpts: 32 });
  assert.equal(summary.goals * 2 + summary.assists + summary.shortHandedGoals * 5 + summary.gameWinningGoals * 5 + summary.goalieFpts, total);
  const html = Board.render([row], { seasonId: '20262027', picks: [], locked: false });
  for (const weight of ['(2 FPTS)', '(1 FPT)', '(5 FPTS)', '(10 FPTS)']) assert.ok(html.includes(weight), weight);
  assert.ok(html.includes('New York Islanders Goalies'));
  assert.ok(!html.includes('SAMPLE DATA'));
});

test('roster cards include NHL player art and Tonight matchup renders only scheduled selections', () => {
  const row = {
    ownerId:'nick', ownerName:'Nick', rank:1, total:2,
    players:[
      {id:'8479999',name:'Test Maple Leaf',position:'C',nhlTeam:'TOR',goals:1,assists:0,shortHandedGoals:0,gameWinningGoals:0},
      {id:'TG-TOR',name:'Toronto Maple Leafs Goalies',position:'TG',nhlTeam:'TOR',goalieWins:0,goalieAssists:0,goalieGoals:0,goalieShutouts:0}
    ]
  };
  const live={fetchedAt:'2026-10-02T23:00:00Z',today:{date:'2026-10-02',games:[{id:1,state:'LIVE',away:'MTL',home:'TOR',awayScore:0,homeScore:1,period:2,timeRemaining:'10:00'}],players:{'8479999':{goals:1,assists:0,shortHandedGoals:0,gameWinningGoals:0}},teamGoalies:{TOR:{goalieWins:0,goalieAssists:0,goalieGoals:0,goalieShutouts:0}}}};
  const seasonHtml=Board.render([row],{seasonId:'20262027',picks:[],locked:false},{left:'nick',right:'nick',mode:'season'},live);
  assert.ok(seasonHtml.includes('assets.nhle.com/mugs/nhl/latest/8479999.png'));
  assert.ok(seasonHtml.includes('assets.nhle.com/logos/nhl/svg/TOR_light.svg'));
  assert.ok(seasonHtml.includes('Tonight’s Matchup'));
  const tonightHtml=Board.render([row],{seasonId:'20262027',picks:[],locked:false},{left:'nick',right:'nick',mode:'tonight'},live);
  assert.ok(tonightHtml.includes('Test Maple Leaf'));
  assert.ok(tonightHtml.includes('vs MTL'));
  assert.ok(tonightHtml.includes('TODAY'));
  assert.equal(Board.todayLine(row.players[0],live).fpts,2);
});

test('v277 puts FPTS first, ranks Today totals, and renders retro recent-games cards', () => {
  const rows = [
    { ownerId:'nick', ownerName:'Nick', rank:1, total:7, players:[{id:'1',name:'Nick Skater',position:'C',nhlTeam:'TOR',goals:1,assists:0,shortHandedGoals:0,gameWinningGoals:0}] },
    { ownerId:'andrew', ownerName:'Andrew', rank:2, total:6, players:[{id:'2',name:'Andrew Skater',position:'C',nhlTeam:'MTL',goals:0,assists:1,shortHandedGoals:0,gameWinningGoals:0}] }
  ];
  const live={today:{date:'2026-10-02',games:[],players:{'1':{goals:0,assists:0,shortHandedGoals:0,gameWinningGoals:0},'2':{goals:1,assists:1,shortHandedGoals:0,gameWinningGoals:0}},teamGoalies:{}}};
  const today=Board.todayStandingRows(rows,live);
  assert.equal(today[0].ownerId,'andrew');
  assert.equal(today[0]._today.total,3);
  const html=Board.render(rows,{seasonId:'20262027',picks:[],locked:false},{left:'nick',right:'andrew',mode:'season',standingsMode:'today'},live);
  assert.ok(html.includes('View Season Standings'));
  assert.ok(html.includes('<h2>Standings</h2>'));
  const managerAt=html.indexOf('>Manager</th>');
  const fptsAt=html.indexOf('pool-fpts-first',managerAt);
  const goalsAt=html.indexOf('>Goals</span>',managerAt);
  assert.ok(managerAt>=0 && fptsAt>managerAt && goalsAt>fptsAt,'FPTS is the first stat after identity');
  assert.ok(html.includes('data-player-card'));
  const card=Board.cardMarkup({type:'skater',season:'20262027',player:{id:'1',name:'Nick Skater',team:'TOR',position:'C',headshot:'x',teamLogo:'y'},last5:[{date:'2026-10-01',label:'vs MTL',goals:1,assists:2,shortHandedGoals:0,gameWinningGoals:1,fpts:9}],last10:{games:10,goals:3,assists:4,shortHandedGoals:0,gameWinningGoals:1,fpts:15},last25:{games:25,goals:9,assists:12,shortHandedGoals:1,gameWinningGoals:2,fpts:45}});
  assert.ok(card.includes('LAST 5 GAMES'));
  assert.ok(card.includes('LAST 5 GAMES'));
  assert.ok(card.includes('LAST 10'));
  assert.ok(card.includes('LAST 25'));
});

test('v280 exposes independent standings and roster controls with arrow-only team selection', () => {
  const rows = [
    { ownerId:'nick', ownerName:'Nick', rank:1, total:2, players:[{id:'1',name:'Nick Skater',position:'C',nhlTeam:'TOR',goals:1,assists:0,shortHandedGoals:0,gameWinningGoals:0}] },
    { ownerId:'andrew', ownerName:'Andrew', rank:2, total:1, players:[{id:'2',name:'Andrew Skater',position:'C',nhlTeam:'MTL',goals:0,assists:1,shortHandedGoals:0,gameWinningGoals:0}] }
  ];
  const live={today:{date:'2026-10-02',games:[{id:1,state:'LIVE',away:'MTL',home:'TOR',awayScore:0,homeScore:1,period:1,timeRemaining:'10:00'}],players:{'1':{goals:1},'2':{}},teamGoalies:{}}};
  const draft={seasonId:'20262027',picks:[],locked:false};
  const season = Board.render(rows,draft,{left:'nick',right:'andrew',mode:'season',standingsMode:'season'},live);
  assert.ok(season.includes('data-v280-roster-toggle'));
  assert.ok(season.includes('data-v280-standings-toggle'));
  assert.ok(season.includes('data-v280-compare-shift'));
  assert.ok(!season.includes('data-compare-select'));
  assert.ok(!season.includes('BASEMENT BAR LEAGUE'));
  const tonight = Board.render(rows,draft,{left:'nick',right:'andrew',mode:'tonight',standingsMode:'season'},live);
  assert.ok(tonight.includes('Season Totals'));
  assert.ok(tonight.includes('<h2>Standings</h2>'), 'roster Tonight mode leaves standings title and season mode alone');
});

test('v281 card restores colour-era structure, draft history copy, and five filled game rows', () => {
  const card=Board.cardMarkup({type:'skater',season:'20262027',player:{id:'8478402',name:'Test Player',team:'TOR',position:'C',headshot:'x',teamLogo:'y',nhlDraft:{team:'TOR',teamName:'Toronto Maple Leafs',round:1,pick:7,overallPick:7}},fantasyDraft:{teamName:'Glizzy Disposal',ownerName:'Nick',round:2,pick:3,overallPick:8},last5:[{date:'2026-10-02',label:'vs MTL',goals:1,assists:1,shortHandedGoals:0,gameWinningGoals:0,fpts:3}],last10:{fpts:8},last25:{fpts:20}});
  assert.ok(!card.includes('BASEMENT BAR'));
  assert.ok(card.includes('pool-opc-top-name'));
  assert.ok(card.includes('Test Player'));
  assert.ok(card.includes('Drafted in the NHL by the Toronto Maple Leafs — Round 1, Pick 7.'));
  assert.ok(card.includes('Fantasy drafted by Nick — Round 2, Pick 3.'));
  assert.equal((card.match(/TO BE PLAYED/g)||[]).length,4);
  assert.ok(card.includes('pool-opc-position'));
});


test('v280 roster and standings renderers are independent by construction', () => {
  const rows = [
    { ownerId:'nick', ownerName:'Nick', rank:1, total:2, players:[{id:'1',name:'Nick Skater',position:'C',nhlTeam:'TOR',goals:1,assists:0,shortHandedGoals:0,gameWinningGoals:0}] },
    { ownerId:'andrew', ownerName:'Andrew', rank:2, total:1, players:[{id:'2',name:'Andrew Skater',position:'C',nhlTeam:'MTL',goals:0,assists:1,shortHandedGoals:0,gameWinningGoals:0}] },
    { ownerId:'scott', ownerName:'Scott', rank:3, total:0, players:[{id:'3',name:'Scott Skater',position:'C',nhlTeam:'COL',goals:0,assists:0,shortHandedGoals:0,gameWinningGoals:0}] }
  ];
  const live={today:{date:'2026-10-02',games:[{id:1,state:'LIVE',away:'MTL',home:'TOR',awayScore:0,homeScore:1,period:1,timeRemaining:'10:00'}],players:{'1':{goals:1},'2':{}},teamGoalies:{}}};
  const draft={seasonId:'20262027',picks:[],locked:false};
  const standingsSeason=Board.renderStandings(rows,draft,'season',live);
  const standingsToday=Board.renderStandings(rows,draft,'today',live);
  const rostersSeason=Board.renderRosters(rows,draft,{left:'nick',right:'andrew',mode:'season'},live);
  const rostersTonight=Board.renderRosters(rows,draft,{left:'nick',right:'scott',mode:'tonight'},live);
  assert.ok(standingsSeason.includes('<h2>Standings</h2>'));
  assert.ok(standingsSeason.includes('View Today’s Totals'));
  assert.ok(standingsToday.includes('View Season Standings'));
  assert.ok(rostersSeason.includes('Tonight’s Matchup'));
  assert.ok(rostersSeason.includes('>Andrew</strong>'));
  assert.ok(rostersTonight.includes('Season Totals'));
  assert.ok(rostersTonight.includes('>Scott</strong>'));
  assert.ok(!rostersTonight.includes('data-v280-standings-toggle'));
  assert.ok(!standingsToday.includes('data-v280-roster-toggle'));
});

test('v282 player card includes NHL bio details and current drafted-player FPTS rank', () => {
  const card=Board.cardMarkup({
    type:'skater',season:'20262027',
    player:{id:'8477939',name:'William Nylander',team:'TOR',position:'R',headshot:'x',teamLogo:'y',
      bio:{jerseyNumber:88,heightInInches:72,weightInPounds:204,shootsCatches:'R',birthDate:'1996-05-01',birthCity:'Calgary',birthCountry:'CAN'},
      nhlDraft:{team:'TOR',teamName:'Toronto Maple Leafs',round:1,pick:8,overallPick:8}},
    fantasyDraft:{teamName:'Glizzy Disposal',round:1,pick:2},fantasyRank:{rank:4,fieldSize:50,fpts:12,scope:'skaters'},last5:[],last10:{},last25:{}
  });
  for (const text of ['JERSEY','#88','HEIGHT','6&#39; 0&quot;','WEIGHT','204 lbs','SHOOTS','Right','Calgary, Canada','May 1, 1996','AGE','R · Toronto Maple Leafs · RANKED #4 IN FANTASY PTS']) assert.ok(card.includes(text), text);
});


test('v283 binds both desktop and mobile roster-mode buttons', () => {
  const source = fs.readFileSync(path.join(__dirname, '../assets/js/home-board-v283.js'), 'utf8');
  assert.ok(source.includes("host.querySelectorAll('[data-v280-roster-toggle]').forEach"));
  assert.ok(!source.includes("const toggle = host.querySelector('[data-v280-roster-toggle]')"));
  const rows = [
    { ownerId:'nick', ownerName:'Nick', rank:1, total:0, players:[] },
    { ownerId:'andrew', ownerName:'Andrew', rank:2, total:0, players:[] }
  ];
  const html = Board.renderRosters(rows,{seasonId:'20262027',picks:[]},{left:'nick',right:'andrew',mode:'season'},{today:{games:[]}});
  assert.equal((html.match(/data-v280-roster-toggle/g)||[]).length, 2, 'desktop and mobile each render their own Tonight button');
});

test('v283 browser-side fantasy rank uses PoolCore instead of undefined factory C', () => {
  const source = fs.readFileSync(path.join(__dirname, '../assets/js/home-board-v283.js'), 'utf8');
  const browserController = source.split("})(typeof window !== 'undefined' ? window : this, function (C) {")[0];
  assert.ok(browserController.includes('const core = root.PoolCore;'));
  assert.ok(browserController.includes('core?.points?.(player)'));
  assert.ok(!/\bC\.points\s*\(/.test(browserController));
});

test('v284 card integrates crest with bio, places rank before draft copy, and adds season totals/team styling', () => {
  const V284 = require('../assets/js/home-board-v284');
  const card=V284.cardMarkup({
    type:'skater',season:'20262027',
    player:{id:'8477939',name:'William Nylander',team:'TOR',position:'R',headshot:'headshot.png',teamLogo:'tor-logo.svg',
      bio:{jerseyNumber:88,heightInInches:72,weightInPounds:204,shootsCatches:'R',birthDate:'1996-05-01',birthCity:'Calgary',birthCountry:'CAN'},
      nhlDraft:{team:'TOR',teamName:'Toronto Maple Leafs',round:1,pick:8,overallPick:8}},
    fantasyDraft:{teamName:'Glizzy Disposal',round:1,pick:2},fantasyRank:{rank:4,fieldSize:50,fpts:12,scope:'skaters'},
    seasonTotals:{goals:2,assists:3,shortHandedGoals:1,gameWinningGoals:1,fpts:17},last5:[],last10:{},last25:{}
  });
  assert.ok(card.includes('pool-opc-bio-logo'));
  assert.ok(card.includes('pool-opc-watermark'));
  assert.ok(card.includes('--opc-team-primary:#003E7E'));
  assert.ok(card.includes('CURRENT SEASON TOTALS'));
  assert.ok(card.includes('<span>FPTS</span><strong>17</strong>'));
  const heroEnd=card.indexOf('</div><div class="pool-opc-position">');
  const positionAt=card.indexOf('R · Toronto Maple Leafs · RANKED #4 IN FANTASY PTS');
  const draftAt=card.indexOf('Drafted in the NHL by the Toronto Maple Leafs');
  const totalsAt=card.indexOf('CURRENT SEASON TOTALS');
  const lastFiveAt=card.indexOf('LAST 5 GAMES');
  assert.ok(heroEnd>=0 && positionAt>heroEnd && draftAt>positionAt && totalsAt>draftAt && lastFiveAt>totalsAt);
  assert.equal((card.match(/TO BE PLAYED/g)||[]).length,5);
});


test('v286 fantasy draft copy resolves fantasy team names back to manager names and bio crest is oversized/lower', () => {
  const V286 = require('../assets/js/home-board-v286');
  const card = V286.cardMarkup({
    type:'skater', season:'20262027',
    player:{id:'1',name:'Test Player',team:'SJS',position:'C',headshot:'x',teamLogo:'y',bio:{},nhlDraft:{undrafted:true}},
    fantasyDraft:{teamName:'Glizzy Disposal',round:3,pick:4},
    fantasyRank:{rank:1}, seasonTotals:{}, last5:[], last10:{}, last25:{}
  });
  assert.ok(card.includes('Fantasy drafted by Nick — Round 3, Pick 4.'));
  assert.ok(!card.includes('Fantasy drafted by Glizzy Disposal'));
  const css = fs.readFileSync(path.join(__dirname, '../assets/css/home-v286.css'), 'utf8');
  assert.ok(css.includes('width:min(92%,178px)!important'));
  assert.ok(css.includes('height:94px!important'));
  assert.ok(css.includes('top:14px!important'));
  assert.ok(css.includes('padding:107px 9px 7px!important'));
});


test('v287 standings masthead makes current mode explicit and ranks drafted skaters/goalie tandems', () => {
  const V287 = require('../assets/js/home-board-v287');
  const rows = [
    {ownerId:'nick',ownerName:'Nick',rank:1,total:30,players:[
      {id:'1',name:'Alpha Skater',position:'C',nhlTeam:'TOR',goals:5,assists:2,shortHandedGoals:0,gameWinningGoals:0},
      {id:'TG-TOR',name:'Toronto Maple Leafs Goalies',position:'TG',nhlTeam:'TOR',goalieWins:4,goalieAssists:0,goalieGoals:0,goalieShutouts:0}
    ]},
    {ownerId:'scott',ownerName:'Scott',rank:2,total:20,players:[
      {id:'2',name:'Beta Skater',position:'C',nhlTeam:'COL',goals:2,assists:1,shortHandedGoals:0,gameWinningGoals:0},
      {id:'TG-COL',name:'Colorado Avalanche Goalies',position:'TG',nhlTeam:'COL',goalieWins:2,goalieAssists:0,goalieGoals:0,goalieShutouts:0}
    ]}
  ];
  const draft={seasonId:'20262027',picks:[],locked:false};
  const season=V287.renderStandings(rows,draft,'season',{today:{players:{},teamGoalies:{},games:[]}});
  assert.ok(season.includes('CURRENT VIEW') || season.includes('Current View'));
  assert.ok(season.includes('SEASON STANDINGS'));
  assert.ok(season.includes('View Today’s Totals'));
  assert.ok(season.includes('Top 5 Skaters'));
  assert.ok(season.includes('Top 5 Goalie Tandems'));
  assert.ok(season.includes('Drafted by Nick'));
  assert.ok(season.includes('Toronto Maple Leafs'));
  const leaders=V287.topFantasyEntries(rows,false);
  assert.equal(leaders[0].player.name,'Alpha Skater');
  assert.equal(leaders[0].ownerName,'Nick');
  const today=V287.renderStandings(rows,draft,'today',{today:{players:{},teamGoalies:{},games:[]}});
  assert.ok(today.includes('TODAY’S SCORES'));
  assert.ok(today.includes('View Season Standings'));
});

test('v288 roster comparison makes season vs dated daily matchup view explicit', () => {
  const V288 = require('../assets/js/home-board-v288');
  const rows = [
    {ownerId:'nick',ownerName:'Nick',rank:1,total:10,players:[]},
    {ownerId:'andrew',ownerName:'Andrew',rank:2,total:8,players:[]}
  ];
  const draft={seasonId:'20262027',picks:[],locked:false};
  const live={today:{date:'2026-10-03',players:{},teamGoalies:{},games:[{away:'TOR',home:'MTL'}]}};
  assert.equal(V288.matchupDateLabel(live,false),'Saturday October 3rd');
  assert.equal(V288.rosterCurrentView('season',live),'SEASON TOTALS');
  assert.equal(V288.rosterCurrentView('tonight',live),'SATURDAY OCTOBER 3RD MATCHUPS');
  const season=V288.renderRosters(rows,draft,{left:'nick',right:'andrew',mode:'season'},live);
  assert.ok(season.includes('Current View'));
  assert.ok(season.includes('SEASON TOTALS'));
  assert.ok(season.includes('View Saturday October 3rd Matchups'));
  const tonight=V288.renderRosters(rows,draft,{left:'nick',right:'andrew',mode:'tonight'},live);
  assert.ok(tonight.includes('SATURDAY OCTOBER 3RD MATCHUPS'));
  assert.ok(tonight.includes('View Season Totals'));
});

test('v289 roster masthead ranks fantasy teams for this week and this month without changing mobile controls', () => {
  const V289 = require('../assets/js/home-board-v289');
  const rows = [
    {ownerId:'nick',ownerName:'Nick',teamName:'Glizzy Disposal',rank:1,total:10,players:[
      {id:'1',name:'Nick Skater',position:'C',nhlTeam:'TOR'},
      {id:'TG-TOR',name:'Toronto Maple Leafs Goalies',position:'TG',nhlTeam:'TOR'}
    ]},
    {ownerId:'andrew',ownerName:'Andrew',teamName:'Between The Pipes',rank:2,total:8,players:[
      {id:'2',name:'Andrew Skater',position:'C',nhlTeam:'MTL'}
    ]}
  ];
  const live={
    today:{date:'2026-10-03',games:[],players:{},teamGoalies:{}},
    periods:{
      week:{players:{'1':{fpts:6},'2':{fpts:8}},teamGoalies:{TOR:{fpts:4}}},
      month:{players:{'1':{fpts:12},'2':{fpts:9}},teamGoalies:{TOR:{fpts:3}}}
    }
  };
  const week=V289.periodTeamRankings(rows,live.periods.week);
  assert.equal(week[0].ownerId,'nick');
  assert.equal(week[0]._periodFpts,10);
  const month=V289.periodTeamRankings(rows,live.periods.month);
  assert.equal(month[0].ownerId,'nick');
  assert.equal(month[0]._periodFpts,15);
  const html=V289.renderRosters(rows,{seasonId:'20262027',picks:[],locked:false},{left:'nick',right:'andrew',mode:'season'},live);
  assert.ok(html.includes('pool-v289-roster-mast'));
  assert.ok(html.includes('This Week'));
  assert.ok(html.includes('This Month'));
  assert.ok(html.includes('Glizzy Disposal'));
  assert.ok(html.includes('Between The Pipes'));
  assert.equal((html.match(/data-v280-roster-toggle/g)||[]).length,2,'desktop and mobile retain separate roster-mode buttons');
});

test('v289 NHL period bounds use Monday-start week and calendar month', () => {
  const NHL = require('../lib/nhl-data');
  assert.deepEqual(NHL.periodDateBounds('2026-10-03'), {
    date:'2026-10-03', weekStart:'2026-09-28', monthStart:'2026-10-01', pastEnd:'2026-10-02'
  });
});


test('v290 mobile roster header includes this week and this month rankings', () => {
  const V290 = require('../assets/js/home-board-v290');
  const rows = [
    {ownerId:'nick',ownerName:'Nick',teamName:'Glizzy Disposal',rank:1,total:10,players:[{id:'1',name:'Nick Skater',position:'C',nhlTeam:'TOR'}]},
    {ownerId:'andrew',ownerName:'Andrew',teamName:'Between The Pipes',rank:2,total:8,players:[{id:'2',name:'Andrew Skater',position:'C',nhlTeam:'MTL'}]}
  ];
  const live={
    today:{date:'2026-10-03',games:[],players:{},teamGoalies:{}},
    periods:{
      week:{players:{'1':{fpts:6},'2':{fpts:8}},teamGoalies:{}},
      month:{players:{'1':{fpts:12},'2':{fpts:9}},teamGoalies:{}}
    }
  };
  const html=V290.renderRosters(rows,{seasonId:'20262027',picks:[],locked:false},{left:'nick',right:'andrew',mode:'season'},live);
  assert.ok(html.includes('pool-v290-mobile-roster-mast'));
  const mobileStart=html.indexOf('pool-v290-mobile-roster-mast');
  const mobileEnd=html.indexOf('</header>',mobileStart);
  const mobile=html.slice(mobileStart,mobileEnd);
  assert.ok(mobile.includes('This Week'));
  assert.ok(mobile.includes('This Month'));
  assert.ok(mobile.includes('Glizzy Disposal'));
  assert.ok(mobile.includes('Between The Pipes'));
  assert.equal((html.match(/data-v280-roster-toggle/g)||[]).length,2,'desktop and mobile each retain one roster-mode button');
});

test('v291 roster comparison supports independent Season Yesterday Today Tomorrow views', () => {
  const V291 = require('../assets/js/home-board-v291');
  const rows=[
    {ownerId:'nick',ownerName:'Nick',teamName:'Glizzy Disposal',rank:1,total:2,players:[{id:'1',name:'Nick Skater',position:'C',nhlTeam:'TOR',goals:1,assists:0,shortHandedGoals:0,gameWinningGoals:0}]},
    {ownerId:'andrew',ownerName:'Andrew',teamName:'Between The Pipes',rank:2,total:1,players:[{id:'2',name:'Andrew Skater',position:'C',nhlTeam:'MTL',goals:0,assists:1,shortHandedGoals:0,gameWinningGoals:0}]}
  ];
  const live={
    today:{date:'2026-10-03',games:[{id:2,state:'LIVE',away:'MTL',home:'TOR',awayScore:0,homeScore:1}],players:{'1':{goals:1}},teamGoalies:{}},
    matchups:{
      yesterday:{date:'2026-10-02',games:[{id:1,state:'FINAL',away:'TOR',home:'OTT',awayScore:2,homeScore:1}],players:{'1':{goals:1,assists:1}},teamGoalies:{}},
      today:{date:'2026-10-03',games:[{id:2,state:'LIVE',away:'MTL',home:'TOR',awayScore:0,homeScore:1}],players:{'1':{goals:1}},teamGoalies:{}},
      tomorrow:{date:'2026-10-04',games:[{id:3,state:'FUT',away:'TOR',home:'BOS',awayScore:0,homeScore:0}],players:{},teamGoalies:{}}
    },
    periods:{week:{players:{},teamGoalies:{}},month:{players:{},teamGoalies:{}}}
  };
  const draft={seasonId:'20262027',picks:[]};
  const season=V291.renderRosters(rows,draft,{left:'nick',right:'andrew',mode:'season'},live);
  for(const mode of ['season','yesterday','today','tomorrow']) assert.ok(season.includes('data-v291-roster-mode="'+mode+'"'));
  assert.ok(!season.includes('Glizzy Disposal'));
  assert.ok(!season.includes('Between The Pipes'));
  const yesterday=V291.renderRosters(rows,draft,{left:'nick',right:'andrew',mode:'yesterday'},live);
  assert.ok(yesterday.includes('FRIDAY OCTOBER 2ND MATCHUPS'));
  assert.equal(V291.dailyLine(rows[0].players[0],live,'yesterday').fpts,3);
  const tomorrow=V291.renderRosters(rows,draft,{left:'nick',right:'andrew',mode:'tomorrow'},live);
  assert.ok(tomorrow.includes('SUNDAY OCTOBER 4TH MATCHUPS'));
  assert.ok(tomorrow.includes('@ BOS'));
  assert.equal(V291.dailyLine(rows[0].players[0],live,'tomorrow').fpts,0);
});

test('v291 adjacent matchup date helper crosses day boundaries safely', () => {
  const NHL = require('../lib/nhl-data');
  assert.equal(NHL.shiftIsoDate('2026-10-03',-1),'2026-10-02');
  assert.equal(NHL.shiftIsoDate('2026-10-03',1),'2026-10-04');
  assert.equal(NHL.shiftIsoDate('2026-03-01',-1),'2026-02-28');
});
