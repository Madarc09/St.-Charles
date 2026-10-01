'use strict';
const {createHash}=require('node:crypto');
const Core=require('../assets/js/pool-core');
// This is the verified, real 60-pick draft captured before the v269 update.
// Keep this file and every later season record in GitHub and future ZIPs.
const BUNDLED=[require('../data/draft-history/20262027.json')];
const clone=value=>JSON.parse(JSON.stringify(value));
const conflict=message=>Object.assign(new Error(message),{status:409});
function fingerprint(draft){
  return createHash('sha256').update(JSON.stringify({seasonId:draft.seasonId,order:draft.draftOrder,
    picks:(draft.picks||[]).map(p=>({ownerId:p.ownerId,id:String(p.player.id),name:p.player.name,position:p.player.position,nhlTeam:p.player.nhlTeam}))})).digest('hex');
}
function validate(draft){
  if(!draft || !/^20\d{6}$/.test(String(draft.seasonId)) || draft.picks?.length!==60)throw conflict('A final draft must contain all 60 saved picks.');
  if(new Set(draft.picks.map(p=>String(p.player?.id))).size!==60)throw conflict('A final draft cannot contain duplicate players.');
  if(draft.draftOrder?.length!==5 || new Set(draft.draftOrder).size!==5 || draft.draftOrder.some(id=>!Core.OWNERS.some(o=>o.id===id)))throw conflict('The saved lottery order is incomplete.');
  for(const o of Core.OWNERS){
    const counts=Core.counts(draft,o.id);
    if(Object.keys(Core.RULES).some(k=>counts[k]!==Core.RULES[k]))throw conflict(`${o.name}'s final roster must contain 6 forwards, 4 defence and 2 goalie units.`);
  }
}
function snapshot(draft,lottery,lockedAt=new Date().toISOString()){
  validate(draft);
  const record={format:'basement-bar-league-final-draft',schemaVersion:1,seasonId:draft.seasonId,lockedAt,
    fingerprint:fingerprint(draft),draft:clone(draft),lottery:clone(lottery),rosterRules:Core.RULES,scoring:Core.SCORING};
  delete record.lottery.presence;
  record.draft.locked=true;record.draft.draftClosed=true;record.draft.lockedAt=lockedAt;
  return record;
}
function mergeRecords(...lists){
  const bySeason=new Map();
  for(const record of lists.flat()){
    validate(record.draft);
    const hash=fingerprint(record.draft);
    if(record.seasonId!==record.draft.seasonId || (record.fingerprint && record.fingerprint!==hash))throw conflict('A saved draft backup failed its integrity check. No record was overwritten.');
    const existing=bySeason.get(record.seasonId);
    if(existing && existing.fingerprint!==hash)throw conflict('Two final draft records disagree. No saved selections were overwritten.');
    if(!existing)bySeason.set(record.seasonId,{...clone(record),fingerprint:hash});
  }
  return [...bySeason.values()].sort((a,b)=>a.seasonId.localeCompare(b.seasonId));
}
function protect(state,ledger=[],{missing=false,bundled=BUNDLED}={}){
  if(state.room!=='live')return state;
  state.finalDrafts=mergeRecords(ledger,state.finalDrafts||[],bundled);
  // If the active room was lost, recover the latest independently saved draft.
  // A normal End Season keeps the room and advances its season, so is unaffected.
  if(missing && state.finalDrafts.length){
    const latest=state.finalDrafts.at(-1);
    if(!(state.archives||[]).some(a=>a.seasonId===latest.seasonId || a.id===latest.seasonId)){
      state.draft=clone(latest.draft);state.lottery=clone(latest.lottery);
    }
  }
  let saved=state.finalDrafts.find(r=>r.seasonId===state.draft.seasonId);
  if(!saved && state.draft.picks?.length===60){
    saved=snapshot(state.draft,state.lottery);state.finalDrafts.push(saved);
  }
  if(saved){
    const same=fingerprint(state.draft)===saved.fingerprint;
    if(!same && state.draft.picks?.length===60)throw conflict('The active draft differs from its locked record. No selections were overwritten.');
    if(!same){
      const revision=Number(state.draft.revision)||0;
      state.draft=clone(saved.draft);state.draft.revision=Math.max(revision,Number(saved.draft.revision)||0)+1;
      state.draft.recoveredFromFinalDraft=true;state.lottery=clone(saved.lottery);
    }
    state.draft.locked=true;state.draft.draftClosed=true;state.draft.lockedAt=saved.lockedAt;
    state.draft.finalDraftFingerprint=saved.fingerprint;
  }
  return state;
}
function assertEditable(state){
  if(state.room==='live' && state.draft.locked)throw conflict('These final rosters are locked. Picks, lottery, undo and reset are closed for this season.');
}
module.exports={BUNDLED,fingerprint,validate,snapshot,mergeRecords,protect,assertEditable};
