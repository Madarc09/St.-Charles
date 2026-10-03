/* A fixed extra competitor. NEVER adds a draft owner, pick or room identity. */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports) module.exports=factory(require('./pool-core'),require('../../data/bot-teams/20262027.json'));
  else root.PoolBot=factory(root.PoolCore,root.PoolBotRoster);
})(typeof window!=='undefined'?window:this,function(C,record){
  'use strict';
  const statKeys=['gamesPlayed','goals','assists','points','shortHandedGoals','gameWinningGoals','goalieWins','goalieShutouts','goalieGoals','goalieAssists','saves','shotsAgainst','goalsAgainst','timeOnIce'];
  function status(draft){
    if(!record||String(draft?.seasonId)!==record.seasonId)return {active:false,reason:'different-season'};
    if(!draft?.locked)return {active:false,reason:'draft-not-locked'};
    const picks=draft.picks||[],taken=new Set(picks.map(p=>String(p.player?.id)));
    const roster=record.players||[],counts={F:0,D:0,G:0},ids=new Set();
    for(const p of roster){
      if(!p.id||ids.has(String(p.id)))return {active:false,reason:'invalid-bot-roster'};
      if(taken.has(String(p.id)))return {active:false,reason:'human-player-conflict'};
      ids.add(String(p.id));counts[C.bucket(p)]++;
    }
    if(['F','D','G'].some(key=>counts[key]!==C.RULES[key]))return {active:false,reason:'invalid-roster-limits'};
    const saved=picks.map(p=>p.ownerId+':'+String(p.player?.id)).sort();
    if(saved.length!==60||JSON.stringify(saved)!==JSON.stringify(record.humanSelections))return {active:false,reason:'different-draft'};
    return {active:true,reason:null};
  }
  function row(draft,stats){
    if(!status(draft).active)return null;
    const byId=new Map((stats||[]).map(p=>[String(p.id),p]));
    const players=record.players.map(p=>{
      const source=byId.get(String(p.id))||{};
      // Projection/history fields are deliberately never merged into live scoring.
      const out={id:p.id,name:p.name,position:p.position,nhlTeam:p.nhlTeam,type:p.type};
      statKeys.forEach(key=>{out[key]=C.num(source[key]);});
      out.shortHandedGoals=C.num(source.shortHandedGoals??source.shGoals);
      if(C.bucket(p)==='G'){
        out.goalieGoals=C.num(source.goalieGoals??source.goals);
        out.goalieAssists=C.num(source.goalieAssists??source.assists);
      }
      if(C.TEAMS[source.nhlTeam])out.nhlTeam=source.nhlTeam;
      out.fpts=out.fantasyPoints=C.points(out);return out;
    });
    const total=players.reduce((sum,p)=>sum+C.points(p),0);
    return {ownerId:record.ownerId,ownerName:record.ownerName,team:record.teamName,teamName:record.teamName,isBot:true,players:C.sortRoster(players),pts:total,total};
  }
  function standings(humans,draft,stats){
    const bot=row(draft,stats),ownerId=record?.ownerId||'bot';
    if(!bot)return (humans||[]).filter(r=>r.ownerId!==ownerId);
    const ranked=[...(humans||[]).filter(r=>r.ownerId!==ownerId),bot]
      .sort((a,b)=>b.total-a.total||a.ownerName.localeCompare(b.ownerName));
    return ranked.map((r,i,all)=>({...r,rank:all.findIndex(x=>x.total===r.total)+1}));
  }
  return Object.freeze({status,row,standings,record});
});
