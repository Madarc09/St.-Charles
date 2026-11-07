const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('v306 uses the clean Your Pick artwork and dynamically injects NHL team logos',()=>{
  const index=read('index.html');
  const js=read('assets/js/pickem-v306.js');
  assert.ok(index.includes('pickem-v306.js?v=306'));
  assert.ok(index.includes('pickem-v306.css?v=306'));
  assert.ok(fs.existsSync(path.join(root,'assets/images/your-pick-matchup-v306.png')));
  assert.ok(js.includes('assets/images/your-pick-matchup-v306.png'));
  assert.ok(js.includes('assets.nhle.com/logos/nhl/svg/'));
  assert.ok(js.includes('pool-pickem-matchup-team is-'));
  assert.ok(js.includes('is-picked'));
});

test('v306 enlarges and centers the Just the Tip week label in its artwork panel',()=>{
  const css=read('assets/css/pickem-v306.css');
  assert.match(css,/\.pool-pickem-week-label\s*\{[\s\S]*bottom:17\.8%[\s\S]*height:20\.8%/);
  assert.match(css,/font-size:clamp\(24px,3\.15vw,58px\)/);
  assert.ok(css.includes('align-items:center'));
  assert.ok(css.includes('justify-content:center'));
});
