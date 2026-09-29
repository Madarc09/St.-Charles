'use strict';
const Core=require('../assets/js/pool-core');
const Store=require('./pool-store');
const cache=new Map(), pending=new Map();
const STATS='https://api.nhle.com/stats/rest/en';
const WEB='https://api-web.nhle.com/v1';
async function json(url) {
  const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':'BasementBarLeague/267'},signal:AbortSignal.timeout(12000)});
  if(!res.ok)throw Store.error(`NHL data is unavailable (${res.status}). Your saved draft is safe.`,502);
  return res.json();
}
async function cached(name,ttl,load,{fresh=false,allowStale=true}={}) {
  const key=`hockey-pool:nhl:v267:${name}`;let old=cache.get(key);
  if(!old && Store.config().configured) {try{const value=await Store.redis(['GET',key]);if(value)old=typeof value==='string'?JSON.parse(value):value;}catch{}}
  if(!fresh && old && Date.now()-old.at<ttl)return {...old.data,stale:false};
  const pendingKey=`${key}:${fresh?'fresh':'cached'}:${allowStale?'fallback':'strict'}`;
  if(pending.has(pendingKey))return pending.get(pendingKey);
  const job=(async()=>{
    try{
      const data=await load();const record={at:Date.now(),data};cache.set(key,record);
      if(Store.config().configured) {try{await Store.redis(['SET',key,JSON.stringify(record),'EX',60*60*24*45]);}catch{}}
      return {...data,stale:false};
    }catch(e){if(old && allowStale)return {...old.data,stale:true,warning:'Showing the last successful NHL update. '+e.message};throw e;}
    finally{pending.delete(pendingKey);}
  })();pending.set(pendingKey,job);return job;
}
async function report(kind,season,extra='') {
  const exp=`seasonId=${season} and gameTypeId=2${extra?' and '+extra:''}`;
  const url=(start,limit)=>`${STATS}/${kind}?${new URLSearchParams({isAggregate:'false',isGame:'false',start:String(start),limit:String(limit),sort:JSON.stringify([{property:'playerId',direction:'ASC'}]),cayenneExp:exp})}`;
  let first;
  try{first=await json(url(0,-1));}catch{first=await json(url(0,100));}
  if(!Array.isArray(first.data))throw Store.error('NHL returned an incomplete statistics response.',502);
  const rows=first.data.slice();const total=Number(first.total ?? rows.length);
  if(total>0 && !rows.length)throw Store.error('NHL statistics are incomplete. Try refreshing shortly.',502);
  while(rows.length<total) {
    const page=await json(url(rows.length,100));if(!page.data?.length)throw Store.error('NHL statistics were truncated. No partial totals were saved.',502);
    rows.push(...page.data);
  }
  if(rows.length!==total || new Set(rows.map(p=>String(p.playerId))).size!==rows.length)throw Store.error('NHL returned incomplete or duplicate statistics. No partial totals were saved.',502);
  return rows;
}
function teamCodes(row){return String(row.teamAbbrevs || row.teamAbbrev || '').split(/[,/\s]+/).filter(Boolean);}
async function teams() {
  return cached('teams',86400000,async()=>{
    const result=await json(`${STATS}/team`);if(!Array.isArray(result.data))throw Store.error('NHL team lookup failed.',502);
    return {teams:result.data};
  });
}
function objText(v){return Core.text(v);}
function teamAbbrev(v){return objText(v?.abbrev ?? v?.teamAbbrev ?? v?.triCode ?? v);}
function isStartedState(s){return !['FUT','PRE'].includes(String(s||'').toUpperCase());}
function isFinalState(s){return ['FINAL','OFF'].includes(String(s||'').toUpperCase());}
function livePlayerShell(id,name,team){
  return {id:String(id),name:name||`NHL player ${id}`,nhlTeam:team||'',type:'skater',gamesPlayed:0,goals:0,assists:0,points:0,shortHandedGoals:0,gameWinningGoals:0,fpts:0,fantasyPoints:0};
}
async function liveFeed(season) {
  return cached(`live-feed-${season}`,6000,async()=>{
    const [score,standingsPayload]=await Promise.all([
      json(`${WEB}/score/now`),
      json(`${WEB}/standings/now`).catch(()=>({standings:[]}))
    ]);
    const games=(score.games||[]).filter(g=>{
      if(String(g.season)!==String(season) || Number(g.gameType)!==2)return false;
      // Score state can trail the first event by a few seconds. A non-zero score or a
      // published goal is enough to treat the game as started even if it still says FUT.
      return isStartedState(g.gameState) || (g.goals||[]).length>0 || Core.num(g.awayTeam?.score)>0 || Core.num(g.homeTeam?.score)>0;
    });
    const details=await Promise.all(games.map(async g=>{
      // The daily score feed already includes live goal cards. GameCenter adds richer
      // season-to-date totals. Keep either source usable if the other is briefly late.
      const landing=await json(`${WEB}/gamecenter/${g.id}/landing`).catch(()=>({}));
      return {game:g,landing};
    }));
    return {games:details,standings:Array.isArray(standingsPayload.standings)?standingsPayload.standings:[],fetchedAt:new Date().toISOString()};
  },{allowStale:true});
}
function goalEventKey(goal,gameId){
  return String(goal.eventId ?? goal.eventNumber ?? [gameId,goal.playerId,goal.period ?? goal.periodDescriptor?.number,goal.timeInPeriod,goal.awayScore,goal.homeScore].join(':'));
}
function goalsFrom(item){
  const out=[],seen=new Set(),game=item.game||{},landing=item.landing||{};
  const add=goal=>{if(!goal)return;const key=goalEventKey(goal,game.id);if(seen.has(key))return;seen.add(key);out.push(goal);};
  (game.goals||[]).forEach(add);
  const blocks=[...(Array.isArray(landing.scoring)?landing.scoring:[]),...(Array.isArray(landing.summary?.scoring)?landing.summary.scoring:[])];
  blocks.forEach(block=>(block.goals||[]).forEach(add));
  return out;
}

function applyLive(base,live) {
  const players=base.players.map(p=>({...p})), byId=new Map(players.map(p=>[String(p.id),p]));
  const rawGoalies=new Map((base.goalies||[]).map(g=>[String(g.playerId),g]));
  const teamGoalies=new Map(players.filter(p=>p.position==='TG').map(p=>[p.nhlTeam,p]));
  const liveGames=[];
  for(const item of live.games||[]){
    const g=item.game||{}, landing=item.landing||{};
    const goals=goalsFrom(item);
    const seenGoalEvents=[];
    for(const goal of goals){
      const id=String(goal.playerId||'');if(!id)continue;
      const team=teamAbbrev(goal.teamAbbrev)||teamAbbrev(goal.team)||'';
      let p=byId.get(id);
      if(!p){p=livePlayerShell(id,objText(goal.name)||[objText(goal.firstName),objText(goal.lastName)].filter(Boolean).join(' '),team);players.push(p);byId.set(id,p);}
      const beforeGoals=Core.num(p.goals), toDate=Core.num(goal.goalsToDate ?? goal.scoringPlayerTotal);
      const unseen=toDate>beforeGoals;
      if(toDate)p.goals=Math.max(beforeGoals,toDate); else if(unseen)p.goals=beforeGoals+1;
      const strength=objText(goal.strength||'').toUpperCase();
      if(unseen && strength.startsWith('SH'))p.shortHandedGoals=Core.num(p.shortHandedGoals)+1;
      p.nhlTeam=p.nhlTeam||team;
      seenGoalEvents.push({goal,player:p,unseen,team});
      for(const assist of goal.assists||[]){
        const aid=String(assist.playerId||'');if(!aid)continue;
        let a=byId.get(aid);
        if(!a){a=livePlayerShell(aid,objText(assist.name),team);players.push(a);byId.set(aid,a);}
        const total=Core.num(assist.assistsToDate ?? assist.assistPlayerTotal);
        if(total)a.assists=Math.max(Core.num(a.assists),total);
        a.nhlTeam=a.nhlTeam||team;
      }
    }
    const state=landing.gameState||g.gameState;
    const awayScore=Core.num(landing.awayTeam?.score ?? g.awayTeam?.score), homeScore=Core.num(landing.homeTeam?.score ?? g.homeTeam?.score);
    const away=teamAbbrev(landing.awayTeam)||teamAbbrev(g.awayTeam), home=teamAbbrev(landing.homeTeam)||teamAbbrev(g.homeTeam);
    if(isFinalState(state)&&awayScore!==homeScore){
      const winner=homeScore>awayScore?home:away, losingScore=Math.min(homeScore,awayScore);
      const gwg=seenGoalEvents.find(x=>x.team===winner&&Core.num(winner===home?x.goal.homeScore:x.goal.awayScore)===losingScore+1);
      if(gwg?.unseen)gwg.player.gameWinningGoals=Core.num(gwg.player.gameWinningGoals)+1;
    }
    liveGames.push({id:g.id,state,away,home,awayScore,homeScore});
  }
  // Team-goalie units own every win by their NHL club. Standings are a much faster
  // source for a just-finished team win than the season goalie summary report.
  for(const row of live.standings||[]){
    const team=teamAbbrev(row.teamAbbrev)||teamAbbrev(row.teamName);const tg=teamGoalies.get(team);if(!tg)continue;
    tg.goalieWins=Math.max(Core.num(tg.goalieWins),Core.num(row.wins));
    tg.gamesPlayed=Math.max(Core.num(tg.gamesPlayed),Core.num(row.gamesPlayed));
  }
  // If a just-finished game is a shutout and the standings already show the extra
  // team game while the goalie summary does not, award the team-goalie shutout now.
  for(const g of liveGames.filter(x=>isFinalState(x.state))){
    for(const side of [{team:g.home,opp:g.awayScore},{team:g.away,opp:g.homeScore}]){
      if(side.opp!==0)continue;const tg=teamGoalies.get(side.team);if(!tg)continue;
      const stand=(live.standings||[]).find(r=>teamAbbrev(r.teamAbbrev)===side.team);
      const baseGp=Core.num((base.teamGoalies||[]).find(x=>x.nhlTeam===side.team)?.gamesPlayed);
      if(stand&&Core.num(stand.gamesPlayed)>baseGp)tg.goalieShutouts=Core.num(tg.goalieShutouts)+1;
    }
  }
  for(const p of players){
    if(p.position==='TG'){p.goals=p.goalieGoals;p.assists=p.goalieAssists;}
    p.fantasyPoints=p.fpts=Core.points(p);
  }
  return {...base,players,teamGoalies:players.filter(p=>p.position==='TG'),fetchedAt:live.fetchedAt||base.fetchedAt,liveOverlay:true,liveGames,liveGoalEvents:(live.games||[]).reduce((n,item)=>n+goalsFrom(item).length,0)};
}
async function baseStatistics(season,options={}) {
  const ttl=String(season)===Core.seasonId()?45000:21600000;
  return cached(`stats-${season}`,ttl,async()=>{
    const [skaters,goalies]=await Promise.all([report('skater/summary',season),report('goalie/summary',season)]);
    const teamRows=new Map(Object.keys(Core.TEAMS).map(t=>[t,[]]));
    const splitTeams=new Set();
    for(const g of goalies){const codes=teamCodes(g);if(codes.length>1)codes.forEach(t=>splitTeams.add(t));else if(teamRows.has(codes[0]))teamRows.get(codes[0]).push(g);}
    if(splitTeams.size){
      const lookup=await teams();
      await Promise.all([...splitTeams].map(async t=>{
        const info=lookup.teams.find(x=>x.triCode===t || x.abbrev===t);
        if(!info)throw Store.error(`Could not verify the goalie totals for ${t}.`,502);
        const rows=await report('goalie/summary',season,`teamId=${Number(info.id)}`);
        teamRows.set(t,rows);
      }));
    }
    const grouped=Object.keys(Core.TEAMS).map(t=>Core.teamGoalies(teamRows.get(t)||[],t));
    const players=[...skaters.map(Core.skater),...grouped];
    if(new Set(skaters.map(p=>String(p.playerId))).size!==skaters.length)throw Store.error('NHL returned duplicate skater totals; refresh before using this update.',502);
    return {ok:true,season:String(season),gameType:'2',source:'NHL',fetchedAt:new Date().toISOString(),skaters,goalies,teamGoalies:grouped,players,counts:{skaters:skaters.length,goalies:goalies.length,teamGoalies:grouped.length},splitTeams:[...splitTeams]};
  },options);
}
async function statistics(season,options={}) {
  if(!/^\d{8}$/.test(String(season)) || Number(String(season).slice(4))!==Number(String(season).slice(0,4))+1)throw Store.error('Choose a valid NHL season.');
  const base=await baseStatistics(season,options);
  if(String(season)!==Core.seasonId())return base;
  try{return applyLive(base,await liveFeed(season));}
  catch(e){return {...base,liveOverlay:false,warning:[base.warning,`Live GameCenter overlay is reconnecting: ${e.message}`].filter(Boolean).join(' ')}};
}
async function rosters() {
  return cached('current-rosters',43200000,async()=>{
    const results=await Promise.all(Object.keys(Core.TEAMS).map(async team=>{
      const payload=await json(`${WEB}/roster/${team}/current`);
      if(!Array.isArray(payload.forwards) || !Array.isArray(payload.defensemen))throw Store.error(`Current ${team} roster is not available.`,502);
      return [...payload.forwards,...payload.defensemen].map(p=>({id:String(p.id),name:[Core.text(p.firstName),Core.text(p.lastName)].join(' '),position:p.positionCode || 'F',nhlTeam:team,type:'skater'}));
    }));
    return {players:results.flat(),fetchedAt:new Date().toISOString()};
  });
}
async function board(season,options={}) {
  const [stats,roster]=await Promise.all([statistics(season,options),rosters().catch(e=>({players:[],warning:e.message,stale:true}))]);
  const current=new Map(roster.players.map(p=>[p.id,p]));
  const players=stats.players.map(p=>({...p,...(current.get(p.id)||{}),statsSeason:String(season),teamVerified:p.position==='TG'||current.has(p.id)}));
  const ids=new Set(players.map(p=>p.id));
  roster.players.forEach(p=>{if(!ids.has(p.id)){players.push({...Core.skater({id:p.id}),...p,gamesPlayed:0,fantasyPoints:0,fpts:0,statsSeason:String(season),teamVerified:true,rookie:true});ids.add(p.id);}});
  return {ok:true,players,season:String(season),fetchedAt:stats.fetchedAt,rostersUpdatedAt:roster.fetchedAt,stale:stats.stale||roster.stale,warning:stats.warning || (roster.warning?'Current team lookup is temporarily unavailable. Historical teams are labelled; rookies will appear when it reconnects.':null),counts:{players:players.length,teamGoalies:stats.teamGoalies.length}};
}
module.exports={statistics,board,rosters,report,applyLive,liveFeed,goalsFrom};
