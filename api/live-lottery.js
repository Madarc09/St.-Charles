const S=require('../lib/pool-store');
module.exports=async function(req,res){
  S.headers(res);
  try{
    const room=S.roomName(req);
    if(req.method==='GET')return res.status(200).json(S.publicRoom((await S.read(room)).state));
    if(req.method!=='POST')throw S.error('Reset the lottery together with its draft in Admin.',405);
    const b=S.body(req);S.owner(b.ownerId);
    const {state}=await S.mutate(room,s=>{
      const l=s.lottery;s.presence[b.ownerId]=Date.now();
      if(b.action==='start') {
        if(l.phase!=='idle')return;
        if(s.draft.picks.length)throw S.error('This draft has already started.',409);
        s.lottery={...S.freshLottery(),phase:'waiting',sessionId:S.randomUUID(),requestedAt:new Date().toISOString()};return;
      }
      if(b.sessionId && b.sessionId!==l.sessionId)throw S.error('This lottery session has changed. Reopen the lottery.',409);
      if(b.action==='join') {if(l.phase!=='waiting')return;if(!l.joined.includes(b.ownerId))l.joined.push(b.ownerId);if(l.joined.length===5)S.readyLottery(s);return;}
      if(b.action==='confirmAll') {S.commissioner(b);if(l.phase!=='waiting')throw S.error('Open the lottery waiting room first.',409);l.joined=S.Core.OWNERS.map(o=>o.id);S.readyLottery(s);return;}
      if(b.action==='finalize' || b.action==='complete') {
        if(l.finalized)return;
        if(!['revealing','complete'].includes(l.phase)||l.order.length!==5)throw S.error('There is no lottery result to save.',409);
        if(s.draft.picks.length)throw S.error('The draft already has picks.',409);
        s.draft.draftOrder=[...l.order];l.finalized=true;l.phase='complete';l.finalizedAt=new Date().toISOString();S.touch(s.draft);return;
      }
      throw S.error('Unknown lottery action.');
    });return res.status(200).json(S.publicRoom(state));
  }catch(e){return S.sendError(res,e);}
};
