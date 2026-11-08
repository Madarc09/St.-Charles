const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('v309 exposes thePool installable app metadata and iPhone icon', () => {
  const html = read('index.html');
  assert.match(html, /<title>thePool<\/title>/);
  assert.match(html, /apple-mobile-web-app-title" content="thePool"/);
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest\?v=310"/);
  assert.match(html, /pwa-v309\.js\?v=309/);
  assert.match(html, /pwa-v309\.css\?v=309/);
  assert.ok(fs.existsSync(path.join(root, 'assets/icons/apple-touch-icon.png')));
});

test('v309 manifest launches thePool as a standalone app', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.name, 'thePool');
  assert.equal(manifest.short_name, 'thePool');
  assert.equal(manifest.display, 'standalone');
  assert.doesNotMatch(JSON.stringify(manifest), /Basement Bar League|BBL/);
});

test('v309 service worker uses thePool cache and retires old BBL PWA cache', () => {
  const sw = read('service-worker.js');
  assert.match(sw, /thepool-pwa-v310/);
  assert.match(sw, /bbl-pwa-/);
  assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/);
});

test('v309 user-facing PWA shell contains no BBL branding', () => {
  const files = ['manifest.webmanifest','offline.html','assets/js/pwa-v309.js','assets/css/pwa-v309.css'];
  for (const file of files) assert.doesNotMatch(read(file), /Basement Bar League|\bBBL\b/);
});
