'use strict';
const {randomInt,randomUUID} = require('node:crypto');
const Core = require('../assets/js/pool-core');
const STATIC_HISTORY = require('../assets/data/history.json');
const Locks = require('./draft-lock');
const mem = new Map();
const CAS = "local old=redis.call('GET',KEYS[1]); if (old or '')~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1";
// Room and independent draft ledger commit together; neither has an expiry.
const LOCKED_CAS = "local old=redis.call('GET',KEYS[1]); local ledger=redis.call('GET',KEYS[2]); if (old or '')~=ARGV[1] or (ledger or '')~=ARGV[3] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); redis.call('SET',KEYS[2],ARGV[4]); return 1";
function config() { const url=process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_REST_API_URL; const token=process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_REST_API_TOKEN; return {url,token,configured:Boolean(url&&token)}; }
function error(message,status=400) { return Object.assign(new Error(message),{status}); }
async function redis(command) {
  const c=config(); if (!c.configured) throw error('Shared storage is not configured. Add your existing Redis REST variables in Vercel.',503);
  const response=await fetch(c.url.replace(/\/$/,''),{method:'POST',headers:{Authorization:`Bearer ${c.token}`,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(10000)});
  const payload=await response.json(); if(!response.ok || payload.error) throw error('Shared storage is temporarily unavailable. Please retry.',503); return payload.result;
}
function roomName(req) { const room=String(req.query?.room || 'live'); if(room==='live' || /^test-[a-z0-9-]{1,40}$/.test(room)) return room; throw error('Invalid room.'); }
function key(room) { return `${process.env.DRAFT_STORAGE_KEY || 'hockey-pool:official-draft:v1'}:room:v259:${room}`; }
function freshDraft(season=Core.seasonId()) { return {owners:Core.OWNERS,draftOrder:[],picks:[],seasonId:season,comparisonSeason:Core.previousSeason(season),revision:0,updatedAt:new Date().toISOString(),__manualRosterReset:true}; }
function freshLottery() { return {phase:'idle',sessionId:'',joined:[],order:[],owners:Core.OWNERS,finalized:false}; }
function freshRoom(room) { return {schemaVersion:259,version:0,room,draft:freshDraft(),lottery:freshLottery(),presence:{},messages:[],archives:[],recentActions:[],updatedAt:new Date().toISOString()}; }
function normalizeLiveSeason(state,room) {
  if(room!=='live' || !state?.draft) return state;
  const current=Core.seasonId(), stored=String(state.draft.seasonId||'');
  const currentStart=Number(current.slice(0,4)), storedStart=Number(stored.slice(0,4));
  // A live room can survive across summers in Redis. If it is still pointing at an
  // older season and the new draft is not complete, score the real current season.
  // Never pull a commissioner-selected future season backwards.
  if(/^20\d{6}$/.test(stored) && storedStart<currentStart && (state.draft.picks?.length||0)<60){
    state.draft.seasonId=current;
    state.draft.comparisonSeason=Core.previousSeason(current);
    state.draft.seasonAutoCorrectedFrom=stored;
  }
  return state;
}
const parse = s => { try {return typeof s==='string' ? JSON.parse(s) : s;} catch {return null;} };
function migrateLegacy(state,draft,lottery,locked) {
  const validOrder=order=>Array.isArray(order)&&order.length===5&&new Set(order).size===5&&order.every(id=>Core.OWNERS.some(o=>o.id===id));
  const historical=Boolean(draft?.__fromStaticSeasonRecord || draft?.__seasonLockedRecord);
  if(draft && Array.isArray(draft.picks) && !historical) state.draft={...freshDraft(),...draft,owners:Core.OWNERS,seasonId:draft.seasonId || Core.seasonId(),comparisonSeason:draft.comparisonSeason || Core.previousSeason(draft.seasonId || Core.seasonId()),revision:0};
  const clearedAt=Date.parse(draft?.__rostersClearedAt)||0;
  const newerThanReset=value=>!clearedAt || (Date.parse(value)||0)>clearedAt;
  if(!historical && lottery && newerThanReset(lottery.requestedAt || lottery.finalizedAt) && validOrder(lottery.order)) state.lottery={...freshLottery(),...lottery,finalized:lottery.finalized===true || state.draft.picks.length>0};
  else if(state.draft.picks.length && validOrder(state.draft.draftOrder)) state.lottery={...freshLottery(),phase:'complete',order:state.draft.draftOrder,finalized:true,sessionId:'migrated'};
  else if(!historical && lottery?.phase==='waiting' && newerThanReset(lottery.requestedAt)) state.lottery={...freshLottery(),...lottery,order:[],finalized:false};
  else if(!historical && validOrder(locked?.orderIds) && locked.locked && newerThanReset(locked.timestamp)) state.lottery={...freshLottery(),phase:'complete',order:locked.orderIds,finalized:true,sessionId:'migrated'};
  if(state.lottery.finalized) {state.lottery.phase='complete';state.draft.draftOrder=state.lottery.order;}
  else if(!state.draft.picks.length) {state.draft.draftOrder=[];if(validOrder(state.lottery.order))state.lottery.phase='revealing';}
  state.migratedFromV258=true;
  return state;
}
async function read(room) {
  let raw,ledgerRaw='';
  if(!config().configured) {
    if(process.env.POOL_LOCAL_TEST !== '1') throw error('Shared storage is not configured. Add your existing Redis REST variables in Vercel.',503);
    raw=mem.get(key(room)) || '';ledgerRaw=mem.get(key(room)+':final-drafts') || '';
  } else {
    if(room==='live')[raw,ledgerRaw]=await redis(['MGET',key(room),key(room)+':final-drafts']);
    else raw=await redis(['GET',key(room)]);
  }
  raw=raw ? (typeof raw==='string'?raw:JSON.stringify(raw)) : '';
  ledgerRaw=ledgerRaw ? (typeof ledgerRaw==='string'?ledgerRaw:JSON.stringify(ledgerRaw)) : '';
  const state=raw ? parse(raw) : freshRoom(room);
  if(!state?.draft)throw error('The saved room could not be read. No records were overwritten.',503);
  if(!raw && room==='live' && config().configured) {
    // Read-only migration: old keys remain as a rollback copy. No browser cache is imported.
    const values=await redis(['MGET',process.env.DRAFT_STORAGE_KEY || 'hockey-pool:official-draft:v1',process.env.LIVE_LOTTERY_STORAGE_KEY || 'hockey-pool:live-lottery:v1',process.env.LOTTERY_STORAGE_KEY || 'hockey-pool:locked-lottery:v1']);
    const [draft,lottery,locked]=(values||[]).map(parse);
    migrateLegacy(state,draft,lottery,locked);
  }
  normalizeLiveSeason(state,room);
  if(room==='live'){
    const ledger=ledgerRaw ? parse(ledgerRaw) : [];
    if(!Array.isArray(ledger))throw error('The final draft ledger could not be read. No records were overwritten.',503);
    Locks.protect(state,ledger,{missing:!raw});
  }
  return {raw,ledgerRaw,state};
}
async function preserved(room){
  const loaded=await read(room);
  if(room==='live' && (JSON.stringify(loaded.state)!==loaded.raw || JSON.stringify(loaded.state.finalDrafts)!==loaded.ledgerRaw))return mutate(room,()=>{});
  return loaded;
}
async function mutate(room, fn) {
  for(let attempt=0;attempt<7;attempt++) {
    const {raw,ledgerRaw,state}=await read(room); const result=await fn(state);
    if(room==='live')Locks.protect(state);
    state.version=(state.version||0)+1;state.updatedAt=new Date().toISOString(); const next=JSON.stringify(state);
    let saved;
    const ledgerNext=JSON.stringify(state.finalDrafts||[]);
    if(!config().configured && process.env.POOL_LOCAL_TEST==='1') {
      saved=(mem.get(key(room)) || '')===raw && (room!=='live' || (mem.get(key(room)+':final-drafts')||'')===ledgerRaw);
      if(saved){mem.set(key(room),next);if(room==='live')mem.set(key(room)+':final-drafts',ledgerNext);}
    }
    else saved=room==='live' ? Number(await redis(['EVAL',LOCKED_CAS,2,key(room),key(room)+':final-drafts',raw,next,ledgerRaw,ledgerNext]))===1 : Number(await redis(['EVAL',CAS,1,key(room),raw,next]))===1;
    if(saved) return {state,result};
  }
  throw error('The room changed while saving. Refresh and try again.',409);
}
function owner(id) { const result=Core.OWNERS.find(o=>o.id===id);if(!result)throw error('Choose your name before entering the draft.',401);return result; }
function commissioner(body) { owner(body.ownerId);if(body.ownerId!=='nick')throw error('Nick runs the commissioner controls.',403); }
function revision(draft, expected) { if(!Number.isInteger(expected) || expected!==draft.revision)throw error('The draft has changed. The latest picks have been loaded; please choose again.',409); }
function touch(draft) { draft.revision++;draft.updatedAt=new Date().toISOString(); }
function presence(state) { const now=Date.now();return Object.fromEntries(Object.entries(state.presence||{}).filter(([,at])=>now-Number(at)<45000).map(([id])=>[id,true])); }
function publicRoom(state) { return {ok:true,version:state.version||0,configured:config().configured,storage:config().configured?'kv':'local-test',mode:config().configured?'persistent':'local-test',room:state.room,testMode:state.room!=='live',draft:state.draft,state:{...state.lottery,presence:presence(state)},presence:presence(state),messages:state.messages,finalDrafts:(state.finalDrafts||[]).map(r=>({seasonId:r.seasonId,lockedAt:r.lockedAt,fingerprint:r.fingerprint})),historySummary:(state.archives||[]).map(s=>({id:s.id,label:s.label,testSeason:s.testSeason,savedAt:s.savedAt})),updatedAt:state.updatedAt}; }
function body(req) { let result;try{result=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{throw error('Invalid request.');}if(!result || typeof result!=='object')throw error('Invalid request.');if(JSON.stringify(result).length>200000)throw error('Request is too large.',413);return result; }
function headers(res) {res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');}
function sendError(res,e) {return res.status(e.status || 500).json({ok:false,error:e.status?e.message:'The request could not be completed. Please retry.'});}
function shuffle() { const a=Core.OWNERS.map(o=>o.id);for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a; }
function readyLottery(s) {s.lottery.order=shuffle();s.lottery.phase='revealing';s.lottery.revealedAt=new Date().toISOString();s.lottery.finalized=false;}
function reset(s,{season=s.draft.seasonId,clearArchives=false,archivedSeason=null}={}) {if(s.room==='live' && s.draft.locked && !(archivedSeason===s.draft.seasonId && season!==archivedSeason && s.archives.some(a=>a.seasonId===archivedSeason && Locks.fingerprint({...s.draft,picks:a.draftPicks})===Locks.fingerprint(s.draft))))Locks.assertEditable(s);const rev=s.draft.revision;s.draft=freshDraft(season);s.draft.revision=rev+1;s.lottery=freshLottery();s.messages=[];s.recentActions=[];if(clearArchives)s.archives=[];}
function staticSeasons() { return Array.isArray(STATIC_HISTORY) ? STATIC_HISTORY : STATIC_HISTORY.seasons || []; }
module.exports={Core,config,redis,error,roomName,read,preserved,mutate,assertEditable:Locks.assertEditable,owner,commissioner,revision,touch,presence,publicRoom,body,headers,sendError,shuffle,readyLottery,freshDraft,freshLottery,freshRoom,normalizeLiveSeason,migrateLegacy,reset,staticSeasons,randomUUID};
