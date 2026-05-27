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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const season = cleanNumber(req.query.season, 20252026);
  const gameType = cleanNumber(req.query.gameType, 2);
  const limit = Math.min(cleanNumber(req.query.limit, 1000), 1000);

  const skaterUrls = [
    statUrl('skater', season, gameType, 'points', limit),
    statUrl('skater', season, gameType, 'goals', limit)
  ];
  const goalieUrls = [
    statUrl('goalie', season, gameType, 'wins', limit),
    statUrl('goalie', season, gameType, 'savePct', limit)
  ];

  try {
    const [skaterResult, goalieResult] = await Promise.all([
      firstWorking(skaterUrls),
      firstWorking(goalieUrls)
    ]);

    const skaters = Array.isArray(skaterResult.data.data) ? skaterResult.data.data : [];
    const goalies = Array.isArray(goalieResult.data.data) ? goalieResult.data.data : [];

    return res.status(200).json({
      ok: true,
      source: 'api.nhle.com/stats/rest',
      season: String(season),
      gameType: String(gameType),
      fetchedAt: new Date().toISOString(),
      counts: { skaters: skaters.length, goalies: goalies.length },
      urls: { skaters: skaterResult.url, goalies: goalieResult.url },
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
