const S=require('../lib/pool-store');
const NHL=require('../lib/nhl-data');
module.exports=async function(req,res){
  S.headers(res);
  try{
    const room=S.roomName(req);
    if(req.method==='GET')return res.status(200).json(S.publicRoom((await S.preserved(room)).state));
    if(req.method!=='POST')throw S.error('Use the commissioner controls to change the draft.',405);
    const b=S.body(req);S.owner(b.ownerId);
    let selected=null,board=null;
    if(b.action==='pick' || b.action==='auto-fill') {
      if(b.action==='auto-fill'){S.commissioner(b);if(room==='live')throw S.error('Automatic fill is available only in a test room.');}
      const {state}=await S.read(room);
      if(b.action==='pick' && state.draft.picks.some(p=>p.requestId===b.requestId))return res.status(200).json(S.publicRoom(state));
      S.assertEditable(state);
      const data=await NHL.board(state.draft.comparisonSeason);
      board=data.players;
      if(b.action==='pick'){selected=board.find(p=>p.id===String(b.playerId));if(!selected)throw S.error('This player is not on the available NHL board.');}
    }
    const {state}=await S.mutate(room,s=>{
      const d=s.draft;
      if(b.action==='presence'){s.presence[b.ownerId]=Date.now();return;}
      if(b.action==='chat') {
        const text=String(b.text||'').trim();if(!text || text.length>300 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))throw S.error('Messages must be between 1 and 300 characters.');
        if(s.messages.some(m=>m.requestId===b.requestId))return;
        const last=[...s.messages].reverse().find(m=>m.ownerId===b.ownerId);
        if(last && Date.now()-Date.parse(last.at)<1000)throw S.error('Give the room a moment before sending another message.',429);
        s.messages.push({id:S.randomUUID(),ownerId:b.ownerId,text,at:new Date().toISOString(),requestId:String(b.requestId||'')});s.messages=s.messages.slice(-150);return;
      }
      if(b.action==='pick') {
        if(!/^[a-zA-Z0-9-]{8,80}$/.test(String(b.requestId||'')))throw S.error('Missing pick confirmation. Please try again.');
        if(d.picks.some(p=>p.requestId===b.requestId))return;
        S.assertEditable(s);
        S.revision(d,b.expectedRevision);
        if(!s.lottery.finalized)throw S.error('Finish the draft lottery first.',409);
        const pick=S.Core.currentPick(d);if(!pick)throw S.error('The draft is complete.',409);
        if(pick.ownerId!==b.ownerId)throw S.error('It is not your pick yet.',409);
        if(d.picks.some(p=>String(p.player.id)===selected.id))throw S.error('That player has already been drafted.',409);
        const position=S.Core.bucket(selected);if(S.Core.counts(d,b.ownerId)[position]>=S.Core.RULES[position])throw S.error('That roster position is already full.',409);
        d.picks.push({...pick,ownerName:S.owner(b.ownerId).name,player:selected,requestId:b.requestId,timestamp:new Date().toISOString()});
        d.draftClosed=d.picks.length===60;d.__manualRosterReset=false;S.touch(d);return;
      }
      S.commissioner(b);S.revision(d,b.expectedRevision);
      S.assertEditable(s);
      if(b.action==='auto-fill') {
        if(room==='live')throw S.error('Automatic fill is available only in a test room.');
        if(!s.lottery.finalized)throw S.error('Complete the test lottery first.');
        const available=[...board].sort((a,b)=>S.Core.points(b)-S.Core.points(a));
        while(d.picks.length<60){
          const pick=S.Core.currentPick(d),counts=S.Core.counts(d,pick.ownerId),taken=new Set(d.picks.map(p=>p.player.id));
          const player=available.find(p=>!taken.has(p.id)&&counts[S.Core.bucket(p)]<S.Core.RULES[S.Core.bucket(p)]);
          if(!player)throw S.error('Not enough eligible players to fill the test draft.');
          d.picks.push({...pick,ownerName:S.owner(pick.ownerId).name,player,requestId:S.randomUUID(),timestamp:new Date().toISOString()});
        }
        d.draftClosed=true;d.__manualRosterReset=false;S.touch(d);return;
      }
      if(b.action==='undo') {if(!d.picks.length)throw S.error('There are no picks to undo.');d.picks.pop();d.draftClosed=false;S.touch(d);return;}
      if(b.action==='reset') {if(b.confirm!==(room==='live'?'RESET LIVE DRAFT':'RESET TEST'))throw S.error('Reset confirmation is required.');S.reset(s);return;}
      if(b.action==='clear-tests') {if(room==='live')throw S.error('Open a test room to remove test data.');if(b.confirm!=='CLEAR TEST DATA')throw S.error('Test confirmation is required.');S.reset(s,{clearArchives:true});return;}
      if(b.action==='season') {if(d.picks.length || s.lottery.phase!=='idle')throw S.error('Choose the season before starting the lottery.');if(!/^20\d{6}$/.test(b.seasonId)||Number(b.seasonId.slice(4))!==Number(b.seasonId.slice(0,4))+1)throw S.error('Choose a valid season.');d.seasonId=b.seasonId;d.comparisonSeason=S.Core.previousSeason(b.seasonId);S.touch(d);return;}
      throw S.error('Unknown draft action.');
    });
    return res.status(200).json(S.publicRoom(state));
  }catch(e){return S.sendError(res,e);}
};
