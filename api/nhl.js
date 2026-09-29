const S=require('../lib/pool-store');
const NHL=require('../lib/nhl-data');
module.exports=async function(req,res){
  try{
    if(req.method!=='GET')throw S.error('Method not allowed.',405);
    const season=String(req.query?.season || S.Core.previousSeason(S.Core.seasonId()));
    // Current-season standings should feel live. The shared Redis cache in nhl-data.js
    // protects the NHL upstream, so do not let a browser/CDN hold a five-minute-old score.
    res.setHeader('Cache-Control',season===S.Core.seasonId()?'no-store':'s-maxage=300, stale-while-revalidate=600');
    const data=req.query?.mode==='board'?await NHL.board(season):await NHL.statistics(season);
    return res.status(200).json(data);
  }catch(e){res.setHeader('Cache-Control','no-store');return S.sendError(res,e);}
};
