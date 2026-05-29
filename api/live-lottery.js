const LIVE_KEY = process.env.LIVE_LOTTERY_STORAGE_KEY || 'hockey-pool:live-lottery:v1';
const DRAFT_KEY = process.env.DRAFT_STORAGE_KEY || 'hockey-pool:official-draft:v1';

const OWNERS = [
  { id:'nick', teamName:'Nick', name:'Nick' },
  { id:'chris', teamName:'Chris', name:'Chris' },
  { id:'andrew', teamName:'Andrew', name:'Andrew' },
  { id:'tyler', teamName:'Tyler', name:'Tyler' },
  { id:'scott', teamName:'Scott', name:'Scott' }
];

let MEMORY_STATE = null;
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

function freshState() {
  return {
    phase: 'idle',
    sessionId: '',
    requestedAt: '',
    joined: [],
    order: [],
    owners: OWNERS
  };
}

function shuffle(ids) {
  const arr = ids.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function getState() {
  const { configured } = redisConfig();
  if (!configured) return { configured:false, storage:'server-memory', state: MEMORY_STATE || freshState() };
  const data = await redisCommand(`/get/${encodeURIComponent(LIVE_KEY)}`);
  if (!data.result) return { configured:true, storage:'kv', state:freshState() };
  try {
    const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
    return { configured:true, storage:'kv', state: parsed || freshState() };
  } catch {
    return { configured:true, storage:'kv', state:freshState() };
  }
}

async function setState(state) {
  const { configured } = redisConfig();
  if (!configured) {
    MEMORY_STATE = state;
    return { configured:false, storage:'server-memory', state };
  }
  await redisCommand(`/set/${encodeURIComponent(LIVE_KEY)}/${encodeURIComponent(JSON.stringify(state))}`);
  return { configured:true, storage:'kv', state };
}

async function setDraftOrder(order) {
  const { configured } = redisConfig();
  let draft = null;

  if (configured) {
    const data = await redisCommand(`/get/${encodeURIComponent(DRAFT_KEY)}`);
    if (data.result) {
      try { draft = typeof data.result === 'string' ? JSON.parse(data.result) : data.result; } catch(e) {}
    }
  } else {
    draft = MEMORY_DRAFT;
  }

  if (!draft || typeof draft !== 'object') {
    draft = { owners: OWNERS, draftOrder: order, picks: [], updatedAt: new Date().toISOString() };
  }

  draft.owners = Array.isArray(draft.owners) && draft.owners.length ? draft.owners : OWNERS;
  draft.draftOrder = order;
  draft.updatedAt = new Date().toISOString();

  if (!configured) {
    MEMORY_DRAFT = draft;
    return;
  }

  await redisCommand(`/set/${encodeURIComponent(DRAFT_KEY)}/${encodeURIComponent(JSON.stringify(draft))}`);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const current = await getState();
      return res.status(200).json({ ok:true, ...current });
    }

    if (req.method === 'DELETE') {
      const saved = await setState(freshState());
      return res.status(200).json({ ok:true, ...saved });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const action = String(body.action || '');

      let { configured, storage, state } = await getState();

      if (action === 'start') {
        state = {
          phase: 'waiting',
          sessionId: String(Date.now()),
          requestedAt: new Date().toISOString(),
          joined: [],
          order: [],
          owners: OWNERS
        };
        const saved = await setState(state);
        return res.status(200).json({ ok:true, ...saved });
      }

      if (action === 'join') {
        const ownerId = String(body.ownerId || '').toLowerCase();
        if (!OWNERS.some(o => o.id === ownerId)) return res.status(400).json({ ok:false, error:'Invalid ownerId' });

        if (state.phase !== 'waiting') {
          return res.status(200).json({ ok:true, configured, storage, state });
        }

        if (!state.joined.includes(ownerId)) state.joined.push(ownerId);

        if (state.joined.length >= OWNERS.length) {
          const order = shuffle(OWNERS.map(o => o.id));
          state.phase = 'revealing';
          state.order = order;
          state.revealedAt = new Date().toISOString();
          await setDraftOrder(order);
        }

        const saved = await setState(state);
        return res.status(200).json({ ok:true, ...saved });
      }

      if (action === 'complete') {
        if (state.phase === 'revealing') state.phase = 'complete';
        const saved = await setState(state);
        return res.status(200).json({ ok:true, ...saved });
      }

      return res.status(400).json({ ok:false, error:'Unknown action' });
    }

    return res.status(405).json({ ok:false, error:'Method not allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok:false, error:error.message || 'Live lottery failed' });
  }
};
