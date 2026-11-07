const S=require('../lib/pool-store');
const P=require('../lib/pickem-store');
const Clock=require('../lib/pool-clock');
module.exports=async function(req,res){
  S.headers(res);
  try{
    const room=S.roomName(req),pool=(await S.preserved(room)).state,season=String(pool.draft?.seasonId||S.Core.seasonId()),bounds=P.weekBounds(Clock.gameDate());
    let state=await P.resolveFinished(room,(await P.read(room)).state),games=await P.weekSchedule(season,bounds);
    if(req.method==='GET')return res.status(200).json(P.publicData(state,{season,bounds,games}));
    if(req.method!=='POST')throw S.error('Method not allowed.',405);
    const b=S.body(req);const owner=S.owner(b.ownerId);
    if(b.action!=='pick')throw S.error('Unknown Pick’em action.');
    const game=games.find(g=>String(g.id)===String(b.gameId));if(!game)throw S.error('Choose a game from this week.');
    const pickedTeam=String(b.pickedTeam||'').toUpperCase();if(![game.away,game.home].includes(pickedTeam))throw S.error('Choose one of the two teams in that game.');
    if(P.isStarted(game))throw S.error('That game has already started. Choose another game this week.',409);
    const existing=P.currentWeekPicks(state,bounds).find(p=>p.ownerId===owner.id);
    if(existing){
      const oldGame=games.find(g=>String(g.id)===String(existing.gameId));
      if(existing.result||P.isStarted(oldGame||existing))throw S.error('Your weekly pick is locked because the selected game has started.',409);
    }
    state=await P.mutate(room,current=>{
      const currentExisting=(current.picks||[]).find(p=>p.weekStart===bounds.start&&p.ownerId===owner.id);
      const record={id:currentExisting?.id||S.randomUUID(),seasonId:season,weekStart:bounds.start,weekEnd:bounds.end,ownerId:owner.id,ownerName:owner.name,gameId:String(game.id),date:game.date,away:game.away,home:game.home,startTimeUTC:game.startTimeUTC||null,pickedTeam,result:null,updatedAt:new Date().toISOString(),createdAt:currentExisting?.createdAt||new Date().toISOString()};
      if(currentExisting)Object.assign(currentExisting,record);else current.picks.push(record);
    });
    return res.status(200).json(P.publicData(state,{season,bounds,games}));
  }catch(e){return S.sendError(res,e);}
};
