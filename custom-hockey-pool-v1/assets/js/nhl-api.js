export function currentSeasonId(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const start = month >= 7 ? year : year - 1;
  return `${start}${start + 1}`;
}

function normalizeSkater(row) {
  const first = row.firstName || row.firstNameDefault || '';
  const last = row.lastName || row.lastNameDefault || '';
  const name = row.skaterFullName || row.playerFullName || row.fullName || `${first} ${last}`.trim();
  return {
    id: String(row.playerId || row.skaterId || row.id || name),
    name,
    position: row.positionCode || row.position || 'F',
    nhlTeam: row.teamAbbrevs || row.teamAbbrev || row.team || '',
    type: 'skater',
    gamesPlayed: Number(row.gamesPlayed || 0),
    goals: Number(row.goals || 0),
    assists: Number(row.assists || 0),
    points: Number(row.points || 0),
    powerPlayGoals: Number(row.ppGoals || row.powerPlayGoals || 0),
    powerPlayPoints: Number(row.ppPoints || row.powerPlayPoints || 0),
    shortHandedGoals: Number(row.shGoals || row.shortHandedGoals || 0),
    gameWinningGoals: Number(row.gameWinningGoals || row.gwGoals || 0),
    shots: Number(row.shots || row.shotsOnGoal || 0),
    hits: Number(row.hits || 0),
    blocks: Number(row.blockedShots || row.blocks || 0),
    raw: row
  };
}

function normalizeGoalie(row) {
  const first = row.firstName || row.firstNameDefault || '';
  const last = row.lastName || row.lastNameDefault || '';
  const name = row.goalieFullName || row.playerFullName || row.fullName || `${first} ${last}`.trim();
  return {
    id: String(row.playerId || row.goalieId || row.id || name),
    name,
    position: 'G',
    nhlTeam: row.teamAbbrevs || row.teamAbbrev || row.team || '',
    type: 'goalie',
    gamesPlayed: Number(row.gamesPlayed || 0),
    goalieWins: Number(row.wins || 0),
    goalieShutouts: Number(row.shutouts || 0),
    goalieSaves: Number(row.saves || 0),
    goalieGoalsAgainst: Number(row.goalsAgainst || 0),
    goalieSavePct: Number(row.savePct || row.savePercentage || 0),
    raw: row
  };
}

async function requestJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function directStats(kind, seasonId, gameTypeId = 2) {
  const report = kind === 'goalies' ? 'goalie/summary' : 'skater/summary';
  const exp = encodeURIComponent(`seasonId=${seasonId} and gameTypeId=${gameTypeId}`);
  const url = `https://api.nhle.com/stats/rest/en/${report}?limit=1000&sort=${kind === 'goalies' ? 'wins' : 'points'}&cayenneExp=${exp}`;
  return requestJson(url);
}

export async function fetchNhlStats(seasonId, gameTypeId = 2) {
  const proxyUrl = `/api/nhl?season=${encodeURIComponent(seasonId)}&gameType=${encodeURIComponent(gameTypeId)}`;
  let payload;
  try {
    payload = await requestJson(proxyUrl);
  } catch (proxyError) {
    const [skaters, goalies] = await Promise.all([
      directStats('skaters', seasonId, gameTypeId),
      directStats('goalies', seasonId, gameTypeId)
    ]);
    payload = { skaters: skaters.data || [], goalies: goalies.data || [], source: 'direct-browser' };
  }
  const players = [
    ...(payload.skaters || []).map(normalizeSkater).filter(p => p.name),
    ...(payload.goalies || []).map(normalizeGoalie).filter(p => p.name)
  ];
  const deduped = new Map();
  for (const player of players) deduped.set(`${player.id}-${player.position}`, player);
  return {
    source: payload.source || 'nhl-api',
    fetchedAt: new Date().toISOString(),
    seasonId,
    gameTypeId,
    players: [...deduped.values()].sort((a, b) => a.name.localeCompare(b.name))
  };
}
