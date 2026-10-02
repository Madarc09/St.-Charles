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
