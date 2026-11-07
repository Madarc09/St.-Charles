const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');

test('v304 desktop standings uses a full-width heading row and three equal leader boards',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../assets/css/home-v304.css'),'utf8');
  assert.match(css,/@media \(min-width:1001px\)/);
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/grid-template-columns:1fr!important/);
});

test('v304 does not patch Tyler jersey artwork with pseudo-elements',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../assets/css/home-v304.css'),'utf8');
  assert.doesNotMatch(css,/pool-nav-tyler/);
  assert.doesNotMatch(css,/content:\s*["']13["']/);
});

test('v304 Pickem makes selected team visually explicit',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../assets/css/pickem-v304.css'),'utf8');
  const js=fs.readFileSync(path.join(__dirname,'../assets/js/pickem-v303.js'),'utf8');
  assert.match(css,/✓ PICKED/);
  assert.match(css,/\.pool-pickem-team\.is-selected/);
  assert.match(css,/has-selection/);
  assert.match(js,/aria-pressed/);
  assert.match(js,/has-selection/);
});
