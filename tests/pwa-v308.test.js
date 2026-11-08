const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('v308 exposes installable app metadata and iPhone icon', () => {
  const html = read('index.html');
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest\?v=310"/);
  assert.match(html, /apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /apple-touch-icon/);
  assert.match(html, /pwa-v309\.js\?v=309/);
  assert.ok(fs.existsSync(path.join(root, 'assets/icons/apple-touch-icon.png')));
  assert.ok(fs.existsSync(path.join(root, 'assets/icons/icon-192.png')));
  assert.ok(fs.existsSync(path.join(root, 'assets/icons/icon-512.png')));
});

test('PWA manifest launches thePool as a standalone app', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.name, 'thePool');
  assert.equal(manifest.short_name, 'thePool');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, '/');
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
});

test('v308 service worker never caches live API routes', () => {
  const sw = read('service-worker.js');
  assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(sw, /return;/);
  assert.match(sw, /fetch\(request\)\.catch\(\(\) => caches\.match\(OFFLINE_URL\)\)/);
});
