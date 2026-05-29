const PRESENCE_KEY = process.env.PRESENCE_STORAGE_KEY || 'hockey-pool:presence:v1';
const TTL_SECONDS = 45;
let MEMORY_PRESENCE = {};

function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_REST_API_TOKEN;
  return { url, token, configured: Boolean(url && token) };
}

async function redisCommand(path) {
  const { url, token, configured } = redisConfig();
  if (!configured) return { configured: false, result: null };
  const response = await fetch(`${url}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Redis HTTP ${response.status}`);
  return { configured: true, result: data.result };
}

function cleanPresence(input) {
  const now = Date.now();
  const src = input && typeof input === 'object' ? input : {};
  const out = {};
  for (const [ownerId, value] of Object.entries(src)) {
    const ts = Number(value && value.ts || 0);
    if (ownerId && ts && now - ts < TTL_SECONDS * 1000) {
      out[ownerId] = { ownerId, ts, online: true };
    }
  }
  return out;
}

async function getPresence() {
  const { configured } = redisConfig();
  if (!configured) return { configured: false, storage: 'server-memory', mode: 'temporary', presence: cleanPresence(MEMORY_PRESENCE) };
  const data = await redisCommand(`/get/${encodeURIComponent(PRESENCE_KEY)}`);
  let parsed = {};
  try { parsed = data.result ? (typeof data.result === 'string' ? JSON.parse(data.result) : data.result) : {}; } catch(e) {}
  return { configured: true, storage: 'kv', mode: 'persistent', presence: cleanPresence(parsed) };
}

async function setPresence(ownerId) {
  const current = await getPresence();
  const presence = current.presence || {};
  presence[String(ownerId)] = { ownerId: String(ownerId), ts: Date.now(), online: true };
  if (!current.configured) {
    MEMORY_PRESENCE = presence;
    return { configured: false, storage: 'server-memory', mode: 'temporary', presence: cleanPresence(MEMORY_PRESENCE) };
  }
  await redisCommand(`/set/${encodeURIComponent(PRESENCE_KEY)}/${encodeURIComponent(JSON.stringify(presence))}`);
  return { configured: true, storage: 'kv', mode: 'persistent', presence: cleanPresence(presence) };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, ...(await getPresence()) });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const ownerId = String(body.ownerId || '').toLowerCase();
      if (!['nick','chris','andrew','tyler','scott'].includes(ownerId)) {
        return res.status(400).json({ ok: false, error: 'Invalid ownerId' });
      }
      return res.status(200).json({ ok: true, ...(await setPresence(ownerId)) });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, error: error.message || 'Presence failed' });
  }
};
