/* Shared rules: browser, draft validation, live scoring, and season archives. */
(function(root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else root.PoolCore = core;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const OWNERS = [
    {id:'nick', name:'Nick', teamName:'Glizzy Disposal'},
    {id:'chris', name:'Chris', teamName:'CeCe Hairless Horde'},
    {id:'andrew', name:'Andrew', teamName:'Between The Pipes'},
    {id:'tyler', name:'Tyler', teamName:'Puck Slut'},
    {id:'scott', name:'Scott', teamName:'Scott'}
  ];
  const TEAMS = {ANA:'Anaheim Ducks',BOS:'Boston Bruins',BUF:'Buffalo Sabres',CAR:'Carolina Hurricanes',CBJ:'Columbus Blue Jackets',CGY:'Calgary Flames',CHI:'Chicago Blackhawks',COL:'Colorado Avalanche',DAL:'Dallas Stars',DET:'Detroit Red Wings',EDM:'Edmonton Oilers',FLA:'Florida Panthers',LAK:'Los Angeles Kings',MIN:'Minnesota Wild',MTL:'Montreal Canadiens',NJD:'New Jersey Devils',NSH:'Nashville Predators',NYI:'New York Islanders',NYR:'New York Rangers',OTT:'Ottawa Senators',PHI:'Philadelphia Flyers',PIT:'Pittsburgh Penguins',SEA:'Seattle Kraken',SJS:'San Jose Sharks',STL:'St. Louis Blues',TBL:'Tampa Bay Lightning',TOR:'Toronto Maple Leafs',UTA:'Utah Mammoth',VAN:'Vancouver Canucks',VGK:'Vegas Golden Knights',WPG:'Winnipeg Jets',WSH:'Washington Capitals'};
  const RULES = {F:6,D:4,G:2};
  const SCORING = {goals:2,assists:1,shortHandedGoals:5,gameWinningGoals:5,goalieWins:2,goalieAssists:5,goalieGoals:10,goalieShutouts:5};
  const num = n => Number.isFinite(Number(n)) ? Number(n) : 0;
  const text = v => typeof v === 'object' && v ? String(v.default || v.en || '') : String(v ?? '');
  const bucket = p => ['G','TG','GOALIE','TEAMGOALIE'].includes(String(typeof p === 'object' ? p.position || p.type : p).toUpperCase()) ? 'G' : (String(typeof p === 'object' ? p.position : p).toUpperCase() === 'D' ? 'D' : 'F');
  const seasonId = (date = new Date()) => { const y = date.getUTCFullYear() - (date.getUTCMonth() < 6 ? 1 : 0); return `${y}${y+1}`; };
  const previousSeason = s => `${Number(String(s).slice(0,4))-1}${String(s).slice(0,4)}`;
  const seasonLabel = s => String(s).replace(/^(\d{4})(\d{4})$/, '$1–$2');
  const points = p => bucket(p) === 'G' ? num(p.goalieWins)*2 + num(p.goalieAssists ?? p.assists)*5 + num(p.goalieGoals ?? p.goals)*10 + num(p.goalieShutouts)*5 : num(p.goals)*2 + num(p.assists) + num(p.shortHandedGoals ?? p.shGoals)*5 + num(p.gameWinningGoals)*5;
  function skater(row) {
    const p = {id:String(row.playerId || row.id),name:row.skaterFullName || row.playerFullName || [text(row.firstName),text(row.lastName)].join(' ').trim(),position:row.positionCode || row.position || 'F',nhlTeam:row.teamAbbrev || row.teamAbbrevs || '',type:'skater',gamesPlayed:num(row.gamesPlayed),goals:num(row.goals),assists:num(row.assists),points:num(row.points),shortHandedGoals:num(row.shGoals ?? row.shortHandedGoals),gameWinningGoals:num(row.gameWinningGoals)};
    p.fantasyPoints = p.fpts = points(p); return p;
  }
  function teamGoalies(rows, team) {
    const p = {id:`TG-${team}`,name:`${TEAMS[team] || team} Goalies`,position:'TG',type:'teamGoalie',nhlTeam:team,gamesPlayed:0,goalieWins:0,goalieShutouts:0,goalieGoals:0,goalieAssists:0,saves:0,shotsAgainst:0,goalsAgainst:0,timeOnIce:0};
    rows.forEach(r => {
      // One starter per team/game; relief appearances must not inflate team GP.
      p.gamesPlayed += num(r.gamesStarted ?? r.gamesPlayed); p.goalieWins += num(r.wins ?? r.goalieWins); p.goalieShutouts += num(r.shutouts ?? r.goalieShutouts);
      p.goalieGoals += num(r.goals ?? r.goalieGoals); p.goalieAssists += num(r.assists ?? r.goalieAssists);
      p.saves += num(r.saves); p.shotsAgainst += num(r.shotsAgainst); p.goalsAgainst += num(r.goalsAgainst);
      // NHL summary timeOnIce is seconds. Never average individual percentages/GAA.
      p.timeOnIce += num(r.timeOnIce);
    });
    p.savePct = p.shotsAgainst ? p.saves / p.shotsAgainst : null;
    p.goalsAgainstAverage = p.timeOnIce ? p.goalsAgainst * 3600 / p.timeOnIce : null;
    p.goals = p.goalieGoals; p.assists = p.goalieAssists;
    p.fantasyPoints = p.fpts = points(p); return p;
  }
  function currentPick(draft) {
    const order = draft?.draftOrder || [];
    const index = draft?.picks?.length || 0;
    if (order.length !== OWNERS.length || index >= OWNERS.length * 12) return null;
    const round = Math.floor(index / order.length) + 1, slot = index % order.length;
    return {pickNumber:index+1,round,slot:slot+1,ownerId:(round%2 ? order : [...order].reverse())[slot]};
  }
  function counts(draft, ownerId) {
    const result = {F:0,D:0,G:0};
    (draft?.picks || []).filter(p=>p.ownerId===ownerId).forEach(p=>result[bucket(p.player)]++); return result;
  }
  function sortRoster(players) {
    const order={F:0,D:1,G:2};
    return [...(players||[])].sort((a,b)=>order[bucket(a)]-order[bucket(b)] || String(a.name||'').localeCompare(String(b.name||'')));
  }
  function standings(draft, players) {
    const map = new Map((players || []).map(p=>[String(p.id),p]));
    return OWNERS.map(o=>{
      const roster = (draft.picks || []).filter(p=>p.ownerId===o.id).map(p=>{
        const stat = map.get(String(p.player.id));
        // Draft comparison stats must never leak into current-season scoring.
        const zero = {gamesPlayed:0,goals:0,assists:0,points:0,shortHandedGoals:0,gameWinningGoals:0,goalieWins:0,goalieShutouts:0,goalieGoals:0,goalieAssists:0,saves:0,shotsAgainst:0,goalsAgainst:0,timeOnIce:0,savePct:null,goalsAgainstAverage:null,fpts:0,fantasyPoints:0};
        const player = {...p.player,...zero,...(stat || {})};
        player.fpts = player.fantasyPoints = points(player); return player;
      });
      return {ownerId:o.id,ownerName:o.name,team:o.teamName,teamName:o.teamName,players:sortRoster(roster),pts:roster.reduce((s,p)=>s+points(p),0),total:roster.reduce((s,p)=>s+points(p),0)};
    }).sort((a,b)=>b.pts-a.pts || a.ownerName.localeCompare(b.ownerName)).map((r,i,rows)=>({...r,rank:i && r.pts===rows[i-1].pts ? rows.findIndex(x=>x.pts===r.pts)+1 : i+1}));
  }
  return {OWNERS,TEAMS,RULES,SCORING,num,text,bucket,seasonId,previousSeason,seasonLabel,points,skater,teamGoalies,currentPick,counts,sortRoster,standings};
});
