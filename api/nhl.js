const NHL_STATS_BASE = 'https://api.nhle.com/stats/rest/en';

async function getJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`NHL API HTTP ${response.status}: ${text.slice(0, 200)}`);
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

  const season = String(req.query.season || '').replace(/[^0-9]/g, '') || '20252026';
  const gameType = String(req.query.gameType || '2').replace(/[^0-9]/g, '') || '2';
  const exp = encodeURIComponent(`seasonId=${season} and gameTypeId=${gameType}`);

  const skaterUrl = `${NHL_STATS_BASE}/skater/summary?limit=1000&sort=points&cayenneExp=${exp}`;
  const goalieUrl = `${NHL_STATS_BASE}/goalie/summary?limit=1000&sort=wins&cayenneExp=${exp}`;

  try {
    const [skaters, goalies] = await Promise.all([getJson(skaterUrl), getJson(goalieUrl)]);
    return res.status(200).json({
      source: 'vercel-proxy-api.nhle.com/stats/rest',
      season,
      gameType,
      skaters: skaters.data || [],
      goalies: goalies.data || []
    });
  } catch (error) {
    console.error(error);
    return res.status(502).json({
      error: 'NHL stat pull failed',
      detail: error.message,
      season,
      gameType
    });
  }
};
