const S=require('../lib/pool-store');
const NHL=require('../lib/nhl-data');
module.exports=async function(req,res){
  res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=60');
  try{
    if(req.method!=='GET')throw S.error('Method not allowed.',405);
    const season=String(req.query?.season || S.Core.previousSeason(S.Core.seasonId()));
    const data=req.query?.mode==='board'?await NHL.board(season):await NHL.statistics(season);
    return res.status(200).json(data);
  }catch(e){res.setHeader('Cache-Control','no-store');return S.sendError(res,e);}
};
