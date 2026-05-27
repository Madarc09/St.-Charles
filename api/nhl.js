const NHL_STATS_BASE = 'https://api.nhle.com/stats/rest/en';

function cleanNumber(value, fallback) {
  const n = Number(String(value || '').replace(/[^0-9]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function statUrl(report, season, gameType, sort, limit) {
  const params = new URLSearchParams({
    isAggregate: 'false',
    isGame: 'false',
    start: '0',
    limit: String(limit),
    sort,
    dir: 'desc',
    cayenneExp: `seasonId=${season} and gameTypeId=${gameType}`
  });
  return `${NHL_STATS_BASE}/${report}/summary?${params.toString()}`;
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'custom-hockey-pool/1.0'
    }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`NHL API HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  return response.json();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const season = cleanNumber(req.query.season, 20252026);
  const gameType = cleanNumber(req.query.gameType, 2);
  const limit = Math.min(cleanNumber(req.query.limit, 1000), 1000);

  const skaterUrl = statUrl('skater', season, gameType, 'points', limit);
  const goalieUrl = statUrl('goalie', season, gameType, 'wins', limit);

  try {
    const [skaters, goalies] = await Promise.all([getJson(skaterUrl), getJson(goalieUrl)]);
    return res.status(200).json({
      ok: true,
      source: 'api.nhle.com/stats/rest',
      season: String(season),
      gameType: String(gameType),
      fetchedAt: new Date().toISOString(),
      counts: {
        skaters: Array.isArray(skaters.data) ? skaters.data.length : 0,
        goalies: Array.isArray(goalies.data) ? goalies.data.length : 0
      },
      urls: req.query.debug ? { skaterUrl, goalieUrl } : undefined,
      skaters: skaters.data || [],
      goalies: goalies.data || []
    });
  } catch (error) {
    console.error(error);
    return res.status(502).json({
      ok: false,
      error: 'NHL stat pull failed',
      detail: error.message,
      season: String(season),
      gameType: String(gameType),
      attempted: req.query.debug ? { skaterUrl, goalieUrl } : undefined
    });
  }
};
