
/** Durable Object class kept for migration compatibility — logic is in default fetch + LEDGER */
export class DAGVertex {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  async fetch(request) {
    const u = new URL(request.url);
    if (u.pathname === '/status') {
      return new Response(JSON.stringify({ status: 'ok', do: 'DAGVertex' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Delegate-style: same hash attach in DO storage for dual-path
    if (u.pathname === '/attach' && request.method === 'POST') {
      try {
        const { payload, tips } = await request.json();
        const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
        const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
        const ph = Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
        const dup = await this.state.storage.get(ph);
        if (dup) {
          return new Response(JSON.stringify({ error: 'Double-spend detected' }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const vid = crypto.randomUUID();
        await this.state.storage.put(ph, vid);
        await this.state.storage.put(vid, {
          payload: data,
          payload_hash: ph,
          tips,
          created_at: new Date().toISOString(),
        });
        return new Response(JSON.stringify({ vertex_id: vid }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e.message || e) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function sha256(d) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(typeof d === 'string' ? d : JSON.stringify(d)));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function ensureSchema(db) {
  if (!db) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS vertices (
    id TEXT PRIMARY KEY,
    payload TEXT,
    payload_hash TEXT UNIQUE,
    tips TEXT,
    cid TEXT,
    cumulative_weight REAL DEFAULT 1,
    created_at TEXT
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS dag_tips (
    id TEXT PRIMARY KEY,
    weight REAL DEFAULT 1,
    updated_at TEXT
  )`).run();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.startsWith('/api/v1/dag')) path = path.slice('/api/v1/dag'.length) || '/';
    if (path.startsWith('/api/v1')) path = path.slice('/api/v1'.length) || '/';
    const j = (d, s = 200) =>
      new Response(JSON.stringify(d), {
        status: s,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    const db = env.LEDGER || env.DB || env.STRATAMESH_LEDGER;
    try {
      await ensureSchema(db);

      // Health
      if (path === '/' || path === '/health' || path === '/status') {
        let count = 0;
        try {
          const r = await db.prepare('SELECT COUNT(*) as c FROM vertices').first();
          count = r?.c ?? 0;
        } catch (_) {}
        return j({
          status: 'ok',
          service: 'stratamesh-dag',
          version: '2.0.0-ipfs-ops',
          vertices: count,
          pipeline: ['hash', 'ipfs-pin', 'tip-select', 'attach', 'gossip'],
        });
      }

      // GET /tips — heaviest tips for attachment
      if (path === '/tips') {
        let tips = [];
        try {
          const r = await db
            .prepare('SELECT id, cumulative_weight, cid, created_at FROM vertices ORDER BY cumulative_weight DESC LIMIT 10')
            .all();
          tips = r.results || [];
        } catch (_) {}
        if (!tips.length) {
          tips = [{ id: 'GENESIS', cumulative_weight: 1, cid: null }];
        }
        return j({ tips, algorithm: 'heaviest-first-lab' });
      }

      // POST /attach — low-level vertex attach (payload + tips)
      if (path === '/attach' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const payload = body.payload;
        let tips = body.tips;
        if (!payload) return j({ error: 'payload required' }, 400);
        if (!tips || !Array.isArray(tips) || !tips.length) {
          const tr = await db
            .prepare('SELECT id FROM vertices ORDER BY cumulative_weight DESC LIMIT 2')
            .all()
            .catch(() => ({ results: [] }));
          tips = (tr.results || []).map((x) => x.id);
          if (!tips.length) tips = ['GENESIS'];
        }
        const ph = await sha256(typeof payload === 'string' ? payload : JSON.stringify(payload));
        const dup = await db.prepare('SELECT id FROM vertices WHERE payload_hash=?').bind(ph).first().catch(() => null);
        if (dup) return j({ error: 'Double-spend detected', existing: dup.id }, 409);
        const vid = crypto.randomUUID();
        const cid = body.cid || null;
        await db
          .prepare(
            'INSERT INTO vertices (id,payload,payload_hash,tips,cid,cumulative_weight,created_at) VALUES (?,?,?,?,?,1,?)'
          )
          .bind(vid, typeof payload === 'string' ? payload : JSON.stringify(payload), ph, JSON.stringify(tips), cid, new Date().toISOString())
          .run();
        return j({ vertex_id: vid, payload_hash: ph, tips, cid, cumulative_weight: 1 });
      }

      // POST /submit — FULL PIPELINE: tip-select → optional IPFS pin → attach → gossip
      if ((path === '/submit' || path === '/pipeline') && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const payload = body.payload ?? body;
        const content = body.content || body.data || null; // optional blob to pin
        const node_id = body.node_id || 'FOG-NODE-PT-CM-001';

        // 1) Tips
        let tipRows = [];
        try {
          const r = await db
            .prepare('SELECT id FROM vertices ORDER BY cumulative_weight DESC LIMIT 2')
            .all();
          tipRows = r.results || [];
        } catch (_) {}
        const tips = tipRows.length ? tipRows.map((x) => x.id) : ['GENESIS'];

        // 2) Hash
        const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
        const ph = await sha256(payloadStr);
        const dup = await db.prepare('SELECT id FROM vertices WHERE payload_hash=?').bind(ph).first().catch(() => null);
        if (dup) return j({ error: 'Double-spend detected', existing: dup.id }, 409);

        // 3) IPFS pin (content-addressed ref)
        let cid = body.cid || null;
        let pin = null;
        if (!cid && content != null) {
          cid = 'cid_' + (await sha256(typeof content === 'string' ? content : JSON.stringify(content))).slice(0, 32);
        }
        if (cid) {
          // Local pin record + optional service call
          try {
            await db
              .prepare(
                `CREATE TABLE IF NOT EXISTS ipfs_pins (
                  cid TEXT, node_id TEXT, size_bytes INTEGER, tier TEXT, cost_strata REAL,
                  status TEXT, created_at TEXT
                )`
              )
              .run();
            await db
              .prepare(
                'INSERT INTO ipfs_pins (cid, node_id, size_bytes, tier, cost_strata, status, created_at) VALUES (?,?,?,?,?,?,?)'
              )
              .bind(cid, node_id, body.size_bytes || 0, body.tier || 'contributor', 0, 'pinned', new Date().toISOString())
              .run();
            pin = { cid, status: 'pinned', tier: body.tier || 'contributor' };
          } catch (e) {
            pin = { cid, status: 'pin_record_failed', error: String(e.message || e) };
          }
          // Best-effort notify IPFS worker
          try {
            const ipfsUrl = 'https://stratamesh-ipfs.stratamesh.workers.dev/pin';
            if (env.IPFS && typeof env.IPFS.fetch === 'function') {
              await env.IPFS.fetch(
                new Request('https://ipfs/pin', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ cid, node_id, size_bytes: body.size_bytes || 0, tier: 'contributor' }),
                })
              );
            } else {
              await fetch(ipfsUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cid, node_id, size_bytes: body.size_bytes || 0, tier: 'contributor' }),
              });
            }
          } catch (_) {}
        }

        // 4) Attach vertex
        const vid = crypto.randomUUID();
        await db
          .prepare(
            'INSERT INTO vertices (id,payload,payload_hash,tips,cid,cumulative_weight,created_at) VALUES (?,?,?,?,?,1,?)'
          )
          .bind(vid, payloadStr, ph, JSON.stringify(tips), cid, new Date().toISOString())
          .run();

        // 5) Gossip to peers
        const peers = [
          'https://stratamesh-node-2.stratamesh.workers.dev/validate',
          'https://stratamesh-node-3.stratamesh.workers.dev/validate',
          'https://stratamesh-gossip.stratamesh.workers.dev/broadcast',
        ];
        const gossip = [];
        for (const peer of peers) {
          try {
            const resp = await fetch(peer, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: vid,
                hash: ph,
                tip: vid,
                payload: payloadStr.slice(0, 200),
                cid,
                tips,
              }),
            });
            gossip.push({ peer, ok: resp.ok, status: resp.status });
          } catch (e) {
            gossip.push({ peer, ok: false, error: String(e.message || e) });
          }
        }

        return j({
          success: true,
          pipeline: 'tip-select → hash → ipfs-pin → attach → gossip',
          vertex_id: vid,
          payload_hash: ph,
          tips,
          cid,
          pin,
          gossip,
          cumulative_weight: 1,
        });
      }

      // GET /vertex?id=
      if (path === '/vertex' || path === '/validate') {
        const id = url.searchParams.get('id') || url.searchParams.get('vertex_id');
        if (request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const vertex_id = body.vertex_id || body.id;
          const v = await db.prepare('SELECT * FROM vertices WHERE id=?').bind(vertex_id).first();
          if (!v) return j({ error: 'Not found' }, 404);
          return j({ valid: true, vertex: v });
        }
        if (!id) return j({ error: 'id required' }, 400);
        const v = await db.prepare('SELECT * FROM vertices WHERE id=?').bind(id).first();
        if (!v) return j({ error: 'Not found' }, 404);
        return j({ vertex: v });
      }

      // GET /vertices
      if (path === '/vertices') {
        const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '20', 10));
        const r = await db
          .prepare('SELECT id, payload_hash, tips, cid, cumulative_weight, created_at FROM vertices ORDER BY created_at DESC LIMIT ?')
          .bind(limit)
          .all();
        return j({ vertices: r.results || [], count: (r.results || []).length });
      }

      return j({
        status: 'ok',
        service: 'stratamesh-dag',
        version: '2.0.0-ipfs-ops',
        endpoints: ['/health', '/tips', '/attach', '/submit', '/vertices', '/vertex', '/validate'],
      });
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
