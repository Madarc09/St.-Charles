const S=require('../lib/pool-store');
const NHL=require('../lib/nhl-data');
module.exports=async function(req,res){
  S.headers(res);
  try{
    const room=S.roomName(req);let {state}=await S.read(room);
    if(req.method==='GET')return res.status(200).json({ok:true,room,seasons:room==='live'?[...S.staticSeasons(),...state.archives]:state.archives,protectedSeasons:S.staticSeasons().map(s=>s.id)});
    if(req.method!=='POST')throw S.error('Method not allowed.',405);
    const b=S.body(req);S.commissioner(b);
    if(b.action!=='end-season')throw S.error('Unknown history action.');
    if(!/^[a-zA-Z0-9-]{8,80}$/.test(String(b.requestId||'')))throw S.error('Missing season confirmation.');
    if(state.archives.some(a=>a.requestId===b.requestId))return res.status(200).json({...S.publicRoom(state),archived:state.archives.find(a=>a.requestId===b.requestId)});
    S.revision(state.draft,b.expectedRevision);
    if(state.draft.picks.length!==60)throw S.error('Complete all 60 picks before ending the season.');
    const season=state.draft.seasonId;
    if(room==='live' && S.staticSeasons().some(s=>s.id===season))throw S.error('This season is already in the permanent history book.');
    const statSeason=room==='live'?season:state.draft.comparisonSeason;
    const stats=await NHL.statistics(statSeason,{fresh:true,allowStale:false});
    if(!stats.skaters.length || !stats.goalies.length)throw S.error('There are no completed regular-season statistics for this season yet.');
    const result=await S.mutate(room,s=>{
      const existing=s.archives.find(a=>a.requestId===b.requestId);if(existing)return existing;
      S.revision(s.draft,b.expectedRevision);
      if(s.archives.some(a=>a.seasonId===season && room==='live'))throw S.error('This season is already archived.');
      const standings=S.Core.standings(s.draft,stats.players);
      const record={id:room==='live'?season:`${season}-test-${S.randomUUID().slice(0,8)}`,seasonId:season,label:`${S.Core.seasonLabel(season)} ${room==='live'?'Regular Season':'Test Season'}`,testSeason:room!=='live',savedAt:new Date().toISOString(),source:'NHL regular season',statsSeason:statSeason,statsUpdatedAt:stats.fetchedAt,scoring:S.Core.SCORING,rosterRules:S.Core.RULES,championOwnerId:standings.filter(r=>r.rank===1).length===1?standings[0].ownerId:null,championOwnerIds:standings.filter(r=>r.rank===1).map(r=>r.ownerId),standings,rosters:Object.fromEntries(standings.map(r=>[r.ownerId,r.players])),draftPicks:s.draft.picks,lottery:s.lottery,requestId:b.requestId};
      s.archives.push(record);
      const start=Number(season.slice(0,4))+1;
      S.reset(s,{season:room==='live'?`${start}${start+1}`:season});return record;
    });
    return res.status(200).json({...S.publicRoom(result.state),archived:result.result});
  }catch(e){return S.sendError(res,e);}
};
