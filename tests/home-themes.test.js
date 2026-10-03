const test = require('node:test');
const assert = require('node:assert/strict');
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
  assert.ok(html.includes('Season Totals'));
  assert.ok(html.includes('<h2>Standings</h2>'));
  const managerAt=html.indexOf('>Manager</th>');
  const fptsAt=html.indexOf('pool-fpts-first',managerAt);
  const goalsAt=html.indexOf('>Goals</span>',managerAt);
  assert.ok(managerAt>=0 && fptsAt>managerAt && goalsAt>fptsAt,'FPTS is the first stat after identity');
  assert.ok(html.includes('data-player-card'));
  const card=Board.cardMarkup({type:'skater',season:'20262027',player:{id:'1',name:'Nick Skater',team:'TOR',position:'C',headshot:'x',teamLogo:'y'},last5:[{date:'2026-10-01',label:'vs MTL',goals:1,assists:2,shortHandedGoals:0,gameWinningGoals:1,fpts:9}],last10:{games:10,goals:3,assists:4,shortHandedGoals:0,gameWinningGoals:1,fpts:15},last25:{games:25,goals:9,assists:12,shortHandedGoals:1,gameWinningGoals:2,fpts:45}});
  assert.ok(card.includes('1996 SERIES'));
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

test('v278 card removes league branding and uses the 1996 black-and-white profile structure', () => {
  const card=Board.cardMarkup({type:'skater',season:'20262027',player:{id:'8478402',name:'Test Player',team:'TOR',position:'C',headshot:'x',teamLogo:'y'},last5:[{date:'2026-10-02',label:'vs MTL',goals:1,assists:1,shortHandedGoals:0,gameWinningGoals:0,fpts:3}],last10:{fpts:8},last25:{fpts:20}});
  assert.ok(!card.includes('BASEMENT BAR'));
  assert.ok(card.includes('1996 SERIES'));
  assert.ok(card.includes('pool-opc-nameplate'));
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
  assert.ok(standingsSeason.includes('Today’s Totals'));
  assert.ok(standingsToday.includes('Season Totals'));
  assert.ok(rostersSeason.includes('Tonight’s Matchup'));
  assert.ok(rostersSeason.includes('>Andrew</strong>'));
  assert.ok(rostersTonight.includes('Season Totals'));
  assert.ok(rostersTonight.includes('>Scott</strong>'));
  assert.ok(!rostersTonight.includes('data-v280-standings-toggle'));
  assert.ok(!standingsToday.includes('data-v280-roster-toggle'));
});
