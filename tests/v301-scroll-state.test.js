const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const board = fs.readFileSync(path.join(root, 'assets/js/home-board-v293.js'), 'utf8');

test('home live refresh preserves viewport and nested scroll state', () => {
  assert.match(board, /function renderRootsPreservingViewport\(\)/);
  assert.match(board, /root\.scrollTo\(x, y\)/);
  assert.match(board, /renderRootsPreservingViewport\(\);\s*loadRankingPool\(draft\)/);
  assert.match(board, /data-scroll-key/);
  assert.match(board, /restoreScroll\(host, scroll\)/);
});

test('roster rooms retain owner-specific horizontal pan and no longer mutation-recenter', () => {
  assert.match(html, /id="v301-roster-room-pan-preserver"/);
  assert.match(html, /panByOwner/);
  assert.match(html, /__restoreRosterStagePan\(stage, active\.id\)/);
  assert.match(html, /data-room-owner=/);
  assert.doesNotMatch(html, /id="v222-roster-room-mobile-center-pan"/);
  assert.match(html, /pool:live-stats-updated[\s\S]*window\.scrollTo\(x, y\)/);
});
