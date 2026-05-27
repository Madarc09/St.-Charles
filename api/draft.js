const STORAGE_KEY = process.env.DRAFT_STORAGE_KEY || 'hockey-pool:official-draft:v1';

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

async function getDraft() {
  const key = encodeURIComponent(STORAGE_KEY);
  const data = await redisCommand(`/get/${key}`);
  if (!data.configured || !data.result) return { configured: data.configured, draft: null };
  try {
    return { configured: true, draft: typeof data.result === 'string' ? JSON.parse(data.result) : data.result };
  } catch {
    return { configured: true, draft: null };
  }
}

async function setDraft(draft) {
  const key = encodeURIComponent(STORAGE_KEY);
  const payload = encodeURIComponent(JSON.stringify(draft));
  return redisCommand(`/set/${key}/${payload}`);
}

const allowedOwners = new Set(['nick', 'chris', 'andrew', 'tyler', 'scott']);

function cleanDraft(input) {
  const body = input && typeof input === 'object' ? input : {};
  const owners = Array.isArray(body.owners) ? body.owners : [];
  const draftOrder = Array.isArray(body.draftOrder) ? body.draftOrder.map(String).filter(id => allowedOwners.has(id)) : [];
  const picks = Array.isArray(body.picks) ? body.picks : [];
  return {
    owners: owners.filter(o => allowedOwners.has(String(o.id))).map(o => ({
      id: String(o.id),
      teamName: String(o.teamName || o.name || o.id),
      name: String(o.name || o.teamName || o.id)
    })),
    draftOrder: draftOrder.length ? draftOrder : ['nick','chris','andrew','tyler','scott'],
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
        fantasyPoints: Number(p.player?.fantasyPoints || 0)
      }
    })).filter(p => p.ownerId && p.player.id),
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
      const current = await getDraft();
      return res.status(200).json({ ok: true, ...current });
    }

    if (req.method === 'POST') {
      const { configured } = redisConfig();
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const draft = cleanDraft(body);
      if (!configured) {
        return res.status(200).json({ ok: true, configured: false, draft, message: 'Persistent draft storage is not configured.' });
      }
      await setDraft(draft);
      return res.status(200).json({ ok: true, configured: true, draft });
    }

    if (req.method === 'DELETE') {
      const { configured } = redisConfig();
      if (configured) await redisCommand(`/del/${encodeURIComponent(STORAGE_KEY)}`);
      return res.status(200).json({ ok: true, configured, deleted: true });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, error: error.message || 'Draft storage failed' });
  }
};
