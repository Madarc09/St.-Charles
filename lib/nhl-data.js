'use strict';
const Core=require('../assets/js/pool-core');
const Store=require('./pool-store');
const cache=new Map(), pending=new Map();
const STATS='https://api.nhle.com/stats/rest/en';
async function json(url) {
  const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':'BasementBarLeague/259'},signal:AbortSignal.timeout(12000)});
  if(!res.ok)throw Store.error(`NHL data is unavailable (${res.status}). Your saved draft is safe.`,502);
  return res.json();
}
async function cached(name,ttl,load,{fresh=false,allowStale=true}={}) {
  const key=`hockey-pool:nhl:v259:${name}`;let old=cache.get(key);
  if(!old && Store.config().configured) {try{const value=await Store.redis(['GET',key]);if(value)old=typeof value==='string'?JSON.parse(value):value;}catch{}}
  if(!fresh && old && Date.now()-old.at<ttl)return {...old.data,stale:false};
  // A final archive must not inherit a background request's stale-data fallback.
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
async function statistics(season,options={}) {
  if(!/^\d{8}$/.test(String(season)) || Number(String(season).slice(4))!==Number(String(season).slice(0,4))+1)throw Store.error('Choose a valid NHL season.');
  const ttl=String(season)<Core.seasonId()?21600000:300000;
  return cached(`stats-${season}`,ttl,async()=>{
    const [skaters,goalies]=await Promise.all([report('skater/summary',season),report('goalie/summary',season)]);
    const teamRows=new Map(Object.keys(Core.TEAMS).map(t=>[t,[]]));
    const splitTeams=new Set();
    for(const g of goalies){const codes=teamCodes(g);if(codes.length>1)codes.forEach(t=>splitTeams.add(t));else if(teamRows.has(codes[0]))teamRows.get(codes[0]).push(g);}
    // Fetch traded-goalie team splits only where needed, never duplicate season totals.
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
async function rosters() {
  return cached('current-rosters',43200000,async()=>{
    const results=await Promise.all(Object.keys(Core.TEAMS).map(async team=>{
      const payload=await json(`https://api-web.nhle.com/v1/roster/${team}/current`);
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
module.exports={statistics,board,rosters,report};
