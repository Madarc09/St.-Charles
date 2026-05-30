const NHL_STATS_BASE = 'https://api.nhle.com/stats/rest/en';

function cleanNumber(value, fallback) {
  const raw = String(value ?? '').trim();
  if (raw === '-1') return -1;
  const n = Number(raw.replace(/[^0-9]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function statUrl(report, season, gameType, sort, limit, extraCayenne) {
  const cayenne = `seasonId=${season} and gameTypeId=${gameType}` + (extraCayenne ? ` and ${extraCayenne}` : '');
  const params = new URLSearchParams({
    isAggregate: 'false',
    isGame: 'false',
    start: '0',
    limit: String(limit),
    sort,
    dir: 'desc',
    cayenneExp: cayenne
  });
  return `${NHL_STATS_BASE}/${report}/summary?${params.toString()}`;
}

function valueText(v) {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object') return String(v.default || v.en || v.fr || '');
  return '';
}

function playerKey(row) {
  return String(row.playerId || row.skaterId || row.goalieId || row.id || `${valueText(row.firstName)}-${valueText(row.lastName)}-${row.teamAbbrevs || row.teamAbbrev || ''}`);
}

function mergeUniquePlayers(lists) {
  const map = new Map();
  for (const list of lists) {
    for (const row of Array.isArray(list) ? list : []) {
      const id = playerKey(row);
      const existing = map.get(id) || {};
      map.set(id, { ...existing, ...row });
    }
  }
  return Array.from(map.values());
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'custom-hockey-pool/1.0'
    }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`NHL API HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`NHL API returned non-JSON response: ${text.slice(0, 300)}`);
  }
}

async function firstWorking(urls) {
  const errors = [];
  for (const url of urls) {
    try {
      const data = await getJson(url);
      return { url, data };
    } catch (err) {
      errors.push(`${url} :: ${err.message}`);
    }
  }
  const error = new Error(errors.join('\n'));
  error.allErrors = errors;
  throw error;
}

async function fetchReport(report, season, gameType, sort, limit, extraCayenne) {
  // Try the all-rows pull first. If the NHL endpoint rejects it, fall back to a large paged leaderboard.
  const allRowsUrl = statUrl(report, season, gameType, sort, -1, extraCayenne);
  const largeUrl = statUrl(report, season, gameType, sort, limit, extraCayenne);
  const result = await firstWorking([allRowsUrl, largeUrl]);
  return { url: result.url, rows: Array.isArray(result.data.data) ? result.data.data : [] };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const season = cleanNumber(req.query.season, 20252026);
  const gameType = cleanNumber(req.query.gameType, 2);
  const limit = Math.min(cleanNumber(req.query.limit, 2000), 5000);

  try {
    const skaterJobs = [
      fetchReport('skater', season, gameType, 'points', limit),
      fetchReport('skater', season, gameType, 'goals', limit),
      fetchReport('skater', season, gameType, 'assists', limit),
      fetchReport('skater', season, gameType, 'gameWinningGoals', limit),
      fetchReport('skater', season, gameType, 'shGoals', limit),
      fetchReport('skater', season, gameType, 'timeOnIcePerGame', limit),
      fetchReport('skater', season, gameType, 'points', limit, 'positionCode="D"'),
      fetchReport('skater', season, gameType, 'timeOnIcePerGame', limit, 'positionCode="D"'),
      fetchReport('skater', season, gameType, 'shots', limit, 'positionCode="D"')
    ];
    const goalieJobs = [
      fetchReport('goalie', season, gameType, 'wins', limit),
      fetchReport('goalie', season, gameType, 'shutouts', limit),
      fetchReport('goalie', season, gameType, 'savePct', limit),
      fetchReport('goalie', season, gameType, 'assists', limit)
    ];

    const [skaterResults, goalieResults] = await Promise.all([
      Promise.all(skaterJobs),
      Promise.all(goalieJobs)
    ]);

    const skaters = mergeUniquePlayers(skaterResults.map(r => r.rows));
    const goalies = mergeUniquePlayers(goalieResults.map(r => r.rows));

    return res.status(200).json({
      ok: true,
      source: 'api.nhle.com/stats/rest',
      season: String(season),
      gameType: String(gameType),
      fetchedAt: new Date().toISOString(),
      counts: { skaters: skaters.length, goalies: goalies.length },
      urls: {
        skaters: skaterResults.map(r => r.url),
        goalies: goalieResults.map(r => r.url)
      },
      skaters,
      goalies
    });
  } catch (error) {
    console.error(error);
    return res.status(502).json({
      ok: false,
      error: 'NHL stat pull failed',
      detail: error.message,
      season: String(season),
      gameType: String(gameType)
    });
  }
};
