// Canonical record lives in data/bot-teams; browser reads the generated script
// before the board renders. It contains identities, never live scores.
const fs=require('node:fs'),path=require('node:path');
const record=require('../data/bot-teams/20262027.json');
fs.writeFileSync(path.join(__dirname,'../assets/js/bot-roster-20262027.js'),
  '/* Generated from data/bot-teams/20262027.json; do not edit separately. */\n'+
  'window.PoolBotRoster = '+JSON.stringify(record)+';\n');
