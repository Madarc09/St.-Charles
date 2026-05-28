const STORAGE_KEY = process.env.DRAFT_STORAGE_KEY || 'hockey-pool:official-draft:v1';
let MEMORY_DRAFT = null;

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

async function getStoredDraft() {
  const { configured } = redisConfig();
  if (!configured) return { configured: false, draft: MEMORY_DRAFT, storage: 'server-memory', mode: 'temporary', warning: 'Persistent KV storage is not configured. Draft memory is temporary and may not sync across devices or deploys.' };
  const key = encodeURIComponent(STORAGE_KEY);
  const data = await redisCommand(`/get/${key}`);
  if (!data.result) return { configured: true, draft: null, storage: 'kv', mode: 'persistent' };
  try {
    return { configured: true, draft: typeof data.result === 'string' ? JSON.parse(data.result) : data.result, storage: 'kv', mode: 'persistent' };
  } catch {
    return { configured: true, draft: null, storage: 'kv', mode: 'persistent' };
  }
}

async function setStoredDraft(draft) {
  const { configured } = redisConfig();
  if (!configured) {
    MEMORY_DRAFT = draft;
    return { configured: false, storage: 'server-memory', warning: 'Persistent KV storage is not configured. Draft memory is temporary and may not sync across devices or deploys.' };
  }
  const key = encodeURIComponent(STORAGE_KEY);
  const payload = encodeURIComponent(JSON.stringify(draft));
  await redisCommand(`/set/${key}/${payload}`);
  return { configured: true, storage: 'kv' };
}

async function clearStoredDraft() {
  const { configured } = redisConfig();
  if (!configured) {
    MEMORY_DRAFT = null;
    return { configured: false, storage: 'server-memory', warning: 'Persistent KV storage is not configured. Draft memory is temporary and may not sync across devices or deploys.' };
  }
  await redisCommand(`/del/${encodeURIComponent(STORAGE_KEY)}`);
  return { configured: true, storage: 'kv' };
}

const allowedOwners = new Set(['nick', 'chris', 'andrew', 'tyler', 'scott']);
const defaultOwners = [
  { id: 'nick', name: 'Nick', teamName: 'Nick' },
  { id: 'chris', name: 'Chris', teamName: 'Chris' },
  { id: 'andrew', name: 'Andrew', teamName: 'Andrew' },
  { id: 'tyler', name: 'Tyler', teamName: 'Tyler' },
  { id: 'scott', name: 'Scott', teamName: 'Scott' }
];

function cleanDraft(input) {
  const body = input && typeof input === 'object' ? input : {};
  const owners = Array.isArray(body.owners) && body.owners.length ? body.owners : defaultOwners;
  const cleanedOwners = owners.filter(o => allowedOwners.has(String(o.id))).map(o => ({
    id: String(o.id),
    teamName: String(o.teamName || o.name || o.id),
    name: String(o.name || o.teamName || o.id)
  }));
  const draftOrder = Array.isArray(body.draftOrder) ? body.draftOrder.map(String).filter(id => allowedOwners.has(id)) : [];
  const picks = Array.isArray(body.picks) ? body.picks : [];

  return {
    owners: cleanedOwners.length ? cleanedOwners : defaultOwners,
    draftOrder: draftOrder.length === 5 ? draftOrder : ['nick', 'chris', 'andrew', 'tyler', 'scott'],
    picks: picks.map((p, index) => ({
      pickNumber: Number(p.pickNumber || index + 1),
      round: Number(p.round || 1),
      slot: Number(p.slot || 1),
      ownerId: String(p.ownerId || ''),
      ownerName: String(p.ownerName || ''),
      timestamp: String(p.timestamp || new Date().toISOString()),
      player: {
        id: String(p.player?.id || ''),
        name: String(p.player?.name || ''),
        position: String(p.player?.position || ''),
        nhlTeam: String(p.player?.nhlTeam || ''),
        gamesPlayed: Number(p.player?.gamesPlayed || 0),
        goals: Number(p.player?.goals || 0),
        assists: Number(p.player?.assists || 0),
        points: Number(p.player?.points || 0),
        goalieWins: Number(p.player?.goalieWins || 0),
        goalieShutouts: Number(p.player?.goalieShutouts || 0),
        savePct: Number(p.player?.savePct || 0),
        goalsAgainstAverage: Number(p.player?.goalsAgainstAverage || 0),
        fantasyPoints: Number(p.player?.fantasyPoints || 0)
      }
    })).filter(p => allowedOwners.has(p.ownerId) && p.player.id),
    updatedAt: new Date().toISOString()
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const current = await getStoredDraft();
      return res.status(200).json({ ok: true, ...current });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const draft = cleanDraft(body);
      const storage = await setStoredDraft(draft);
      return res.status(200).json({ ok: true, ...storage, draft });
    }

    if (req.method === 'DELETE') {
      const storage = await clearStoredDraft();
      return res.status(200).json({ ok: true, ...storage, deleted: true });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, error: error.message || 'Draft storage failed' });
  }
};
