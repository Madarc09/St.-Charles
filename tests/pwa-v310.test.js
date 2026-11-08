const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

function pngSize(file) {
  const buf = fs.readFileSync(path.join(root, file));
  assert.equal(buf.toString('ascii', 1, 4), 'PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test('v310 uses cache-busted vintage thePool app icons', () => {
  const html = read('index.html');
  assert.match(html, /manifest\.webmanifest\?v=310/);
  assert.match(html, /apple-touch-icon\.png\?v=310/);
  assert.match(html, /icon-192\.png\?v=310/);
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.ok(manifest.icons.every(icon => /\?v=310$/.test(icon.src)));
});

test('v310 PWA icon files have the required dimensions', () => {
  assert.deepEqual(pngSize('assets/icons/apple-touch-icon.png'), {width:180,height:180});
  assert.deepEqual(pngSize('assets/icons/icon-192.png'), {width:192,height:192});
  assert.deepEqual(pngSize('assets/icons/icon-512.png'), {width:512,height:512});
  assert.deepEqual(pngSize('assets/icons/icon-maskable-512.png'), {width:512,height:512});
});

test('v310 rotates thePool PWA cache so old icons are retired', () => {
  const sw = read('service-worker.js');
  assert.match(sw, /thepool-pwa-v310/);
  assert.match(sw, /icon-512\.png\?v=310/);
  assert.match(sw, /apple-touch-icon\.png\?v=310/);
  assert.match(sw, /key\.startsWith\('thepool-pwa-'\)/);
});
