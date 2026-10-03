const test=require('node:test'),assert=require('node:assert/strict');
process.env.POOL_LOCAL_TEST='1';
const fixture=require('../scripts/fixture-nhl');fixture.install();
const C=require('../assets/js/pool-core'),S=require('../lib/pool-store'),L=require('../lib/draft-lock');
const View=require('../assets/js/home-board');
const handlers={draft:require('../api/draft'),lottery:require('../api/live-lottery'),history:require('../api/history')};
const captured=require('../data/draft-history/20262027.json');
const copy=x=>JSON.parse(JSON.stringify(x));
async function call(api,body=null,room='live'){
 let status=200,payload;const res={setHeader(){},status(n){status=n;return this;},json(p){payload=p;return this;}};
 await handlers[api]({method:body?'POST':'GET',query:{room},body},res);return {status,...payload};
}
test('the real 60-pick draft locks unchanged and rejects edits from every manager',async()=>{
 const loaded=await call('draft');assert.equal(loaded.status,200);assert.equal(loaded.draft.locked,true);
 assert.deepEqual(loaded.draft.picks,captured.draft.picks);assert.deepEqual(loaded.draft.draftOrder,captured.draft.draftOrder);
 for(const owner of C.OWNERS)assert.deepEqual(C.counts(loaded.draft,owner.id),C.RULES);
 for(const action of ['undo','reset','season','clear-tests']){
  const result=await call('draft',{action,ownerId:'nick',expectedRevision:loaded.draft.revision,confirm:'RESET LIVE DRAFT',seasonId:'20272028'});
  assert.equal(result.status,409,action);assert.match(result.error,/locked/);
 }
 for(const o of C.OWNERS){
  const result=await call('draft',{action:'pick',ownerId:o.id,expectedRevision:loaded.draft.revision,playerId:'8000000',requestId:'blocked-final-pick-'+o.id});
  assert.equal(result.status,409);assert.match(result.error,/locked/);
 }
 assert.equal((await call('lottery',{action:'start',ownerId:'nick'})).status,409);
 // A retried confirmation for a pick already saved must remain idempotent.
 const last=loaded.draft.picks.at(-1);
 assert.equal((await call('draft',{action:'pick',ownerId:last.ownerId,requestId:last.requestId,playerId:last.player.id,expectedRevision:loaded.draft.revision-1})).status,200);
 assert.deepEqual((await call('draft')).draft.picks,captured.draft.picks);
 const history=await call('history');assert.equal(history.finalDrafts.length,1);assert.equal(history.seasons.length,3);
 assert.deepEqual(history.finalDrafts[0].draft.picks,captured.draft.picks);
 assert.equal(history.finalDrafts[0].fingerprint,L.fingerprint(captured.draft));
});
test('future drafts lock automatically, integrity conflicts stop safely, and next season remains open',()=>{
 const room=S.freshRoom('live');room.draft=copy(captured.draft);room.draft.seasonId='20272028';room.lottery=copy(captured.lottery);
 L.protect(room,[],{bundled:[]});assert.equal(room.draft.locked,true);assert.equal(room.finalDrafts.length,1);
 const saved=copy(room.finalDrafts),changed=copy(room);changed.draft.picks[0].player.id='different-player';
 assert.throws(()=>L.protect(changed,saved,{bundled:[]}),/differs/);
 const corrupt=copy(saved);corrupt[0].draft.picks[0].player.name='Changed name';
 assert.throws(()=>L.mergeRecords(corrupt),/integrity/);
 const missing=S.freshRoom('live');L.protect(missing,saved,{missing:true,bundled:[]});assert.deepEqual(missing.draft.picks,room.draft.picks);
 const reset=copy(room);reset.draft.picks=[];L.protect(reset,saved,{bundled:[]});assert.deepEqual(reset.draft.picks,room.draft.picks);
 assert.equal(reset.draft.recoveredFromFinalDraft,true);
 const next=S.freshRoom('live');next.draft.seasonId='20282029';L.protect(next,saved,{bundled:[]});assert.equal(next.draft.picks.length,0);assert.equal(next.draft.locked,undefined);assert.equal(next.finalDrafts.length,1);
 const rehearsal=S.freshRoom('test-only');L.protect(rehearsal,saved);assert.equal(rehearsal.draft.picks.length,0);assert.equal(rehearsal.finalDrafts,undefined);
});
test('End Season retains the immutable draft record and archives the picks before advancing',async()=>{
 const before=await call('draft'),fingerprint=before.draft.finalDraftFingerprint;
 fixture.setOutage(true);
 const failed=await call('history',{action:'end-season',ownerId:'nick',expectedRevision:before.draft.revision,requestId:'final-season-outage'});
 fixture.setOutage(false);assert.notEqual(failed.status,200);assert.deepEqual((await call('draft')).draft.picks,before.draft.picks);
 const body={action:'end-season',ownerId:'nick',expectedRevision:before.draft.revision,requestId:'final-season-preservation'};
 const end=await call('history',body);assert.equal(end.status,200);assert.equal(end.draft.seasonId,'20272028');assert.equal(end.draft.picks.length,0);
 assert.deepEqual(end.archived.draftPicks,before.draft.picks);
 assert.equal(end.archived.botTeam.ownerId,'bot');assert.equal(end.archived.botTeam.players.length,12);
 assert.deepEqual(end.archived.botTeam.selection,require('../data/bot-teams/20262027.json'));
 assert.equal(end.archived.standings.length,5,'BOT snapshot does not rewrite human championship history');
 assert.equal(end.archived.rosters.bot,undefined);
 const history=await call('history');assert.equal(history.finalDrafts[0].fingerprint,fingerprint);assert.equal(history.seasons.length,4);
 assert.deepEqual(history.finalDrafts[0].draft.picks,before.draft.picks);
 assert.equal((await call('history',body)).status,200);assert.equal((await call('history')).seasons.length,4);
 // A fresh read must not restore the previous draft over the new season.
 assert.equal((await call('draft')).draft.picks.length,0);
});
test('Redis commits the room and independent ledger atomically; a lost room recovers from the ledger',async()=>{
 const originalFetch=global.fetch,env={url:process.env.KV_REST_API_URL,token:process.env.KV_REST_API_TOKEN,key:process.env.DRAFT_STORAGE_KEY};
 process.env.KV_REST_API_URL='https://draft-storage.invalid';process.env.KV_REST_API_TOKEN='local-unit-test';process.env.DRAFT_STORAGE_KEY='unit-draft-preservation';
 const db=new Map(),commands=[];let successful=0;
 global.fetch=async(url,options)=>{
  if(String(url)!=='https://draft-storage.invalid')return originalFetch(url,options);
  const cmd=JSON.parse(options.body);commands.push(cmd);let result;
  if(cmd[0]==='MGET')result=cmd.slice(1).map(k=>db.get(k)||null);
  else if(cmd[0]==='GET')result=db.get(cmd[1])||null;
  else if(cmd[0]==='EVAL'){
   assert.equal(cmd[2],2);const [, , ,roomKey,ledgerKey,raw,next,ledgerRaw,ledgerNext]=cmd;
   if((db.get(roomKey)||'')===raw && (db.get(ledgerKey)||'')===ledgerRaw){db.set(roomKey,next);db.set(ledgerKey,ledgerNext);result=1;successful++;}else result=0;
  }else throw new Error('Unexpected storage command '+cmd[0]);
  return new Response(JSON.stringify({result}),{status:200,headers:{'Content-Type':'application/json'}});
 };
 try{
  const loaded=await call('draft');assert.equal(loaded.status,200);assert.ok(successful>0);assert.equal(db.size,2);
  const activeKey='unit-draft-preservation:room:v259:live',ledgerKey=activeKey+':final-drafts';
  assert.deepEqual(JSON.parse(db.get(ledgerKey))[0].draft.picks,captured.draft.picks);
  const savedCount=successful;await call('draft');assert.equal(successful,savedCount,'An unchanged GET must not rewrite the room');
  const updates=await Promise.all(C.OWNERS.map(o=>call('draft',{action:'presence',ownerId:o.id})));assert.ok(updates.every(r=>r.status===200));
  assert.deepEqual(JSON.parse(db.get(activeKey)).draft.picks,captured.draft.picks);
  db.delete(activeKey);const recovered=await call('draft');assert.equal(recovered.status,200);assert.equal(recovered.draft.locked,true);assert.deepEqual(recovered.draft.picks,captured.draft.picks);
  assert.ok(commands.filter(c=>c[0]==='EVAL').every(c=>!c[1].includes('EXPIRE')));
  const before=db.get(activeKey);db.set(ledgerKey,'broken JSON');assert.equal((await call('draft')).status,503);assert.equal(db.get(activeKey),before);
 }finally{
  global.fetch=originalFetch;
  for(const [key,value] of [['KV_REST_API_URL',env.url],['KV_REST_API_TOKEN',env.token],['DRAFT_STORAGE_KEY',env.key]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
});
test('all players appear once in forwards / defence / goalies order without changing draft history',()=>{
 const before=JSON.stringify(captured.draft.picks),rows=C.standings(captured.draft,[]),html=View.render(rows,{...captured.draft,locked:true});
 assert.equal((html.match(/class="pool-roster"/g)||[]).length,5);assert.equal((html.match(/class="pool-position"/g)||[]).length,15);
 for(const row of rows){
  assert.deepEqual(row.players.map(C.bucket),[...Array(6).fill('F'),...Array(4).fill('D'),...Array(2).fill('G')]);
  const card=View.rosterCard(row);assert.ok(card.indexOf('Forwards')<card.indexOf('Defence'));assert.ok(card.indexOf('Defence')<card.indexOf('Goalies'));
  assert.equal((card.match(/class="pool-player"/g)||[]).length,12);
  for(const p of row.players)assert.ok(card.includes(p.name),p.name);
 }
 assert.ok(html.includes('New York Islanders Goalies'),'Never shorten the goalies to ambiguous “New Goalies”');
 assert.equal(JSON.stringify(captured.draft.picks),before,'Display sorting must never rearrange saved picks');
 const safe=View.rosterGroup([{name:'<script>alert(1)</script>',position:'F'}],'F','Forwards',6);assert.ok(safe.includes('&lt;script&gt;'));assert.ok(!safe.includes('<script>'));
});
