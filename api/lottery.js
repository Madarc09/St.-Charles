const STORAGE_KEY = process.env.LOTTERY_STORAGE_KEY || 'hockey-pool:locked-lottery:v1';

function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_REST_API_TOKEN;
  return { url, token, configured: Boolean(url && token) };
}

async function redisCommand(path) {
  const { url, token, configured } = redisConfig();
  if (!configured) return { configured: false, result: null };
  const response = await fetch(`${url}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Redis HTTP ${response.status}`);
  return { configured: true, result: data.result };
}

async function getLottery() {
  const key = encodeURIComponent(STORAGE_KEY);
  const data = await redisCommand(`/get/${key}`);
  if (!data.configured || !data.result) return { configured: data.configured, lottery: null };
  try {
    return { configured: true, lottery: typeof data.result === 'string' ? JSON.parse(data.result) : data.result };
  } catch {
    return { configured: true, lottery: null };
  }
}

function validOrderIds(orderIds) {
  if (!Array.isArray(orderIds)) return false;
  const cleaned = orderIds.map(String).map(s => s.trim()).filter(Boolean);
  const allowed = new Set(['nick', 'chris', 'andrew', 'tyler', 'scott']);
  return cleaned.length === 5 && new Set(cleaned).size === 5 && cleaned.every(id => allowed.has(id));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const current = await getLottery();
      return res.status(200).json({ ok: true, ...current });
    }

    if (req.method === 'POST') {
      const { configured } = redisConfig();
      if (!configured) return res.status(200).json({ ok: true, configured: false, lottery: null, message: 'Persistent lottery storage is not configured.' });

      const existing = await getLottery();
      if (existing.lottery?.orderIds?.length) {
        return res.status(200).json({ ok: true, configured: true, locked: true, saved: false, lottery: existing.lottery });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const orderIds = Array.isArray(body.orderIds) ? body.orderIds.map(String) : [];
      if (!validOrderIds(orderIds)) return res.status(400).json({ ok: false, configured: true, error: 'Invalid lottery order.' });

      const lottery = {
        orderIds,
        timestamp: new Date().toISOString(),
        odds: 'equal',
        locked: true
      };
      const key = encodeURIComponent(STORAGE_KEY);
      const value = encodeURIComponent(JSON.stringify(lottery));
      await redisCommand(`/set/${key}/${value}`);
      return res.status(200).json({ ok: true, configured: true, locked: true, saved: true, lottery });
    }

    if (req.method === 'DELETE') {
      const { configured } = redisConfig();
      if (!configured) return res.status(200).json({ ok: true, configured: false, cleared: false });
      const key = encodeURIComponent(STORAGE_KEY);
      await redisCommand(`/del/${key}`);
      return res.status(200).json({ ok: true, configured: true, cleared: true });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, configured: redisConfig().configured, error: error.message });
  }
};
