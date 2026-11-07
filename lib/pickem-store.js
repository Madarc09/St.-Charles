'use strict';
const S=require('./pool-store');
const NHL=require('./nhl-data');
const Clock=require('./pool-clock');
const mem=new Map();
const CAS="local old=redis.call('GET',KEYS[1]); if (old or '')~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1";

function key(room){return `${process.env.PICKEM_STORAGE_KEY||'hockey-pool:weekly-pickem:v1'}:${room}`;}
function fresh(room){return {schemaVersion:1,room,picks:[],version:0,updatedAt:new Date().toISOString()};}
const parse=value=>{try{return typeof value==='string'?JSON.parse(value):value;}catch{return null;}};
function weekBounds(date=Clock.gameDate()){
  const raw=String(date||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))throw S.error('Invalid hockey date.',500);
  const [y,m,d]=raw.split('-').map(Number),current=new Date(Date.UTC(y,m-1,d,12));
  const monday=new Date(current);monday.setUTCDate(current.getUTCDate()-((current.getUTCDay()+6)%7));
  const sunday=new Date(monday);sunday.setUTCDate(monday.getUTCDate()+6);
  return {date:raw,start:monday.toISOString().slice(0,10),end:sunday.toISOString().slice(0,10)};
}
function days(start,end){
  const result=[];let cur=String(start||'');
  while(cur&&cur<=end&&result.length<8){result.push(cur);cur=NHL.shiftIsoDate(cur,1);}return result;
}
async function read(room){
  let raw='';
  if(!S.config().configured){if(process.env.POOL_LOCAL_TEST!=='1')throw S.error('Shared Pick’em storage is not configured.',503);raw=mem.get(key(room))||'';}
  else raw=await S.redis(['GET',key(room)])||'';
  raw=raw?(typeof raw==='string'?raw:JSON.stringify(raw)):'';
  const state=raw?parse(raw):fresh(room);
  if(!state||!Array.isArray(state.picks))throw S.error('The saved Pick’em board could not be read.',503);
  return {raw,state};
}
async function mutate(room,fn){
  for(let attempt=0;attempt<7;attempt++){
    const {raw,state}=await read(room);await fn(state);state.version=(state.version||0)+1;state.updatedAt=new Date().toISOString();const next=JSON.stringify(state);
    let saved=false;
    if(!S.config().configured&&process.env.POOL_LOCAL_TEST==='1'){saved=(mem.get(key(room))||'')===raw;if(saved)mem.set(key(room),next);}
    else saved=Number(await S.redis(['EVAL',CAS,1,key(room),raw,next]))===1;
    if(saved)return state;
  }
  throw S.error('Pick’em changed while saving. Please retry.',409);
}
async function weekSchedule(season,bounds=weekBounds()){
  const payloads=await Promise.all(days(bounds.start,bounds.end).map(date=>NHL.matchupDay(season,date,{withStats:false}).catch(()=>({date,games:[]}))));
  const games=payloads.flatMap(day=>(day.games||[]).map(game=>({...game,date:game.date||day.date}))).sort((a,b)=>String(a.startTimeUTC||a.date).localeCompare(String(b.startTimeUTC||b.date))||String(a.id).localeCompare(String(b.id)));
  return games;
}
function isStarted(game,now=Date.now()){
  const state=String(game?.state||'').toUpperCase();if(!['FUT','PRE',''].includes(state))return true;
  const at=Date.parse(game?.startTimeUTC||'');return Number.isFinite(at)&&at<=now;
}
function resultFor(pick,game){
  const state=String(game?.state||'').toUpperCase();if(!['FINAL','OFF'].includes(state))return null;
  const a=Number(game?.awayScore),h=Number(game?.homeScore);if(!Number.isFinite(a)||!Number.isFinite(h)||a===h)return null;
  const winner=a>h?game.away:game.home;return {winner,outcome:winner===pick.pickedTeam?'W':'L',awayScore:a,homeScore:h};
}
async function resolveFinished(room,state){
  const unresolved=(state.picks||[]).filter(p=>!p.result&&p.date&&p.gameId);
  if(!unresolved.length)return state;
  const unique=[...new Set(unresolved.map(p=>`${p.seasonId}|${p.date}`))];const gamesByKey=new Map();
  await Promise.all(unique.map(async pair=>{const [season,date]=pair.split('|');const day=await NHL.matchupDay(season,date,{withStats:false}).catch(()=>({games:[]}));for(const g of day.games||[])gamesByKey.set(String(g.id),g);}));
  const updates=[];for(const pick of unresolved){const result=resultFor(pick,gamesByKey.get(String(pick.gameId)));if(result)updates.push({id:pick.id,result});}
  if(!updates.length)return state;
  return mutate(room,current=>{for(const update of updates){const pick=current.picks.find(p=>p.id===update.id&&!p.result);if(pick){pick.result=update.result;pick.resolvedAt=new Date().toISOString();}}});
}
function currentWeekPicks(state,bounds){return (state.picks||[]).filter(p=>p.weekStart===bounds.start).sort((a,b)=>a.ownerId.localeCompare(b.ownerId));}
function leaderboard(state,season){
  return S.Core.OWNERS.map(owner=>{const picks=(state.picks||[]).filter(p=>p.ownerId===owner.id&&(!season||String(p.seasonId)===String(season))),wins=picks.filter(p=>p.result?.outcome==='W').length,losses=picks.filter(p=>p.result?.outcome==='L').length,decisions=wins+losses;return {ownerId:owner.id,ownerName:owner.name,wins,losses,pending:picks.length-decisions,winPct:decisions?wins/decisions:0};})
    .sort((a,b)=>b.winPct-a.winPct||b.wins-a.wins||a.losses-b.losses||a.ownerName.localeCompare(b.ownerName))
    .map((row,index,all)=>({...row,rank:index&&row.winPct===all[index-1].winPct&&row.wins===all[index-1].wins?all.findIndex(x=>x.winPct===row.winPct&&x.wins===row.wins)+1:index+1}));
}
function publicData(state,{season,bounds,games}){
  const current=currentWeekPicks(state,bounds);return {ok:true,season,bounds,games,currentWeekPicks:current,leaderboard:leaderboard(state,season),owners:S.Core.OWNERS.map(({id,name})=>({id,name})),updatedAt:state.updatedAt};
}
module.exports={key,fresh,weekBounds,days,read,mutate,weekSchedule,isStarted,resultFor,resolveFinished,currentWeekPicks,leaderboard,publicData};
