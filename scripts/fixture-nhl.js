/* Synthetic data used ONLY by npm test and npm run preview:test. Never imported by an API. */
const C=require('../assets/js/pool-core');
const clubs=Object.keys(C.TEAMS);
let statMultiplier=1;
let outage=false,pageLimit=Infinity;
const skaters=Array.from({length:130},(_,i)=>({playerId:8000000+i,skaterFullName:i===0?'Test Forward One':`Test ${i<85?'Forward':'Defense'} ${String(i+1).padStart(3,'0')}`,positionCode:i<85?'C':'D',teamAbbrevs:clubs[i%clubs.length],gamesPlayed:82,goals:Math.max(0,50-i),assists:Math.max(0,75-i),points:Math.max(0,50-i)+Math.max(0,75-i),shGoals:i%3,gameWinningGoals:i%5}));
const goalies=clubs.map((team,i)=>({playerId:9000000+i,goalieFullName:`Test ${team} Goalie`,teamAbbrevs:team,gamesPlayed:60,wins:25+i%12,shutouts:3,goals:0,assists:i%3,saves:1600,shotsAgainst:1760,goalsAgainst:160,timeOnIce:216000}));
goalies.push({playerId:9999999,goalieFullName:'Test Traded Goalie',teamAbbrevs:'ANA, TOR',gamesPlayed:20,wins:10,shutouts:2,goals:1,assists:2,saves:500,shotsAgainst:550,goalsAgainst:50,timeOnIce:72000});
function install(){
 const original=global.fetch;
 global.fetch=async function(url,options){
  const u=new URL(String(url));
  if(u.hostname==='api-web.nhle.com'){
   if(u.pathname==='/v1/score/now')return Response.json({games:[{id:2026020002,season:Number(C.seasonId()),gameType:2,gameState:'LIVE',awayTeam:{abbrev:'MTL',score:0},homeTeam:{abbrev:'TOR',score:1},goals:[{eventId:101,playerId:skaters[0].playerId,name:{default:skaters[0].skaterFullName},teamAbbrev:{default:'TOR'},strength:'EV',goalsToDate:skaters[0].goals*statMultiplier+1,awayScore:0,homeScore:1,assists:[{playerId:skaters[1].playerId,name:{default:skaters[1].skaterFullName},assistsToDate:skaters[1].assists*statMultiplier+1}]}]}]});
   if(u.pathname==='/v1/standings/now')return Response.json({standings:[{teamAbbrev:{default:'TOR'},gamesPlayed:0,wins:0}]});
   if(u.pathname==='/v1/gamecenter/2026020002/landing')return Response.json({gameState:'LIVE',awayTeam:{abbrev:'MTL',score:0},homeTeam:{abbrev:'TOR',score:1},scoring:[{periodDescriptor:{number:1},goals:[{eventId:101,playerId:skaters[0].playerId,name:{default:skaters[0].skaterFullName},teamAbbrev:{default:'TOR'},strength:'EV',goalsToDate:skaters[0].goals*statMultiplier+1,awayScore:0,homeScore:1,assists:[{playerId:skaters[1].playerId,name:{default:skaters[1].skaterFullName},assistsToDate:skaters[1].assists*statMultiplier+1}]}]}]});
   const team=u.pathname.split('/')[3];const rows=skaters.filter(p=>p.teamAbbrevs===team).map(p=>({id:p.playerId,firstName:{default:p.skaterFullName},lastName:{default:''},positionCode:p.positionCode}));
   if(team==='TOR')rows.push({id:8999999,firstName:{default:'Test Rookie'},lastName:{default:'Zero'},positionCode:'C'});
   return Response.json({forwards:rows.filter(p=>p.positionCode!=='D'),defensemen:rows.filter(p=>p.positionCode==='D'),goalies:[]});
  }
  if(u.hostname==='api.nhle.com'){
   if(outage)return Response.json({error:'Synthetic upstream outage'},{status:503});
   if(u.pathname.endsWith('/team'))return Response.json({data:clubs.map((triCode,i)=>({triCode,id:i+1}))});
   let rows=u.pathname.includes('/skater/')?skaters.map(p=>({...p,goals:p.goals*statMultiplier,assists:p.assists*statMultiplier})):goalies.map(p=>({...p}));
   const exp=u.searchParams.get('cayenneExp')||'',teamId=Number(exp.match(/teamId=(\d+)/)?.[1]);
   if(teamId){const t=clubs[teamId-1];rows=goalies.filter(g=>g.teamAbbrevs===t).map(g=>({...g}));if(['ANA','TOR'].includes(t))rows.push({...goalies.at(-1),teamAbbrevs:t,gamesPlayed:10,wins:5,shutouts:1,goals:t==='TOR'?1:0,assists:1,saves:250,shotsAgainst:275,goalsAgainst:25,timeOnIce:36000});}
   const total=rows.length,start=Number(u.searchParams.get('start')||0),limit=Number(u.searchParams.get('limit')||100);
   rows=rows.slice(start,start+Math.min(limit<0?rows.length:limit,pageLimit));
   return Response.json({data:rows,total});
  }
  return original(url,options);
 };
 return ()=>{global.fetch=original;};
}
module.exports={install,setMultiplier:n=>{statMultiplier=n;},setOutage:value=>{outage=value;},setPageLimit:value=>{pageLimit=value;},skaters,goalies};
