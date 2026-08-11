/** Durable Object class kept for migration compatibility */
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
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function sha256(d) {
  const h = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(typeof d === 'string' ? d : JSON.stringify(d))
  );
  return Array.from(new Uint8Array(h))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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
      if (path === '/' || path === '/health' || path === '/status') {
        let count = 0;
        try {
          const r = await db.prepare('SELECT COUNT(*) as c FROM vertices').first();
          count = r?.c ?? 0;
        } catch (_) {
          try {
            const r = await db.prepare('SELECT COUNT(*) as c FROM dag_vertices').first();
            count = r?.c ?? 0;
          } catch (_) {}
        }
        return j({
          status: 'ok',
          service: 'stratamesh-dag',
          version: '2.1.0-ipfs-ops',
          vertices: count,
          pipeline: ['tip-select', 'hash', 'ipfs-pin', 'attach', 'gossip'],
          schema: 'vertices + dag_vertices + ipfs_pins',
        });
      }

      // GET /tips
      if (path === '/tips') {
        let tips = [];
        try {
          const r = await db
            .prepare(
              'SELECT vertex_id as id, cumulative_weight, ipfs_cid as cid, created_at FROM vertices ORDER BY cumulative_weight DESC LIMIT 10'
            )
            .all();
          tips = r.results || [];
        } catch (_) {}
        if (!tips.length) {
          try {
            const r = await db
              .prepare('SELECT cid as id, weight as cumulative_weight, cid, updated_at as created_at FROM dag_tips ORDER BY weight DESC LIMIT 10')
              .all();
            tips = r.results || [];
          } catch (_) {}
        }
        if (!tips.length) tips = [{ id: 'GENESIS', cumulative_weight: 1, cid: null }];
        return j({ tips, algorithm: 'heaviest-first-lab' });
      }

      // POST /submit — full pipeline
      if ((path === '/submit' || path === '/pipeline' || path === '/attach') && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const payload = body.payload ?? body;
        const content = body.content || body.data || null;
        const node_id = body.node_id || 'FOG-NODE-PT-CM-001';
        const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
        const ph = await sha256(payloadStr);

        // double-spend
        let dup = null;
        try {
          dup = await db.prepare('SELECT vertex_id FROM vertices WHERE payload_hash=?').bind(ph).first();
        } catch (_) {}
        if (dup) return j({ error: 'Double-spend detected', existing: dup.vertex_id }, 409);

        // tips
        let tipIds = body.tips;
        if (!tipIds || !Array.isArray(tipIds) || !tipIds.length) {
          try {
            const r = await db
              .prepare('SELECT vertex_id FROM vertices ORDER BY cumulative_weight DESC LIMIT 2')
              .all();
            tipIds = (r.results || []).map((x) => x.vertex_id);
          } catch (_) {
            tipIds = [];
          }
          if (!tipIds.length) tipIds = ['GENESIS'];
        }

        // CID / IPFS
        let cid = body.cid || body.ipfs_cid || null;
        let pin = null;
        if (!cid && content != null) {
          cid = 'cid_' + (await sha256(typeof content === 'string' ? content : JSON.stringify(content))).slice(0, 46);
        }
        if (cid) {
          try {
            await db
              .prepare(
                'INSERT INTO ipfs_pins (node_id, cid, pin_name, size_bytes, tier, status, strata_cost) VALUES (?,?,?,?,?,?,?)'
              )
              .bind(node_id, cid, body.pin_name || 'dag-payload', body.size_bytes || 0, body.tier || 'contributor', 'pinned', 0)
              .run();
            pin = { cid, status: 'pinned', tier: body.tier || 'contributor' };
          } catch (e) {
            pin = { cid, status: 'pin_best_effort', note: String(e.message || e).slice(0, 120) };
          }
          try {
            if (env.IPFS && typeof env.IPFS.fetch === 'function') {
              await env.IPFS.fetch(
                new Request('https://ipfs/pin', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ cid, node_id, tier: 'contributor' }),
                })
              );
            }
          } catch (_) {}
        }

        const vid = crypto.randomUUID();
        const now = new Date().toISOString();
        const parents = JSON.stringify(tipIds);
        // Prefer existing vertices schema
        try {
          await db
            .prepare(
              `INSERT INTO vertices (
                vertex_id, vertex_type, parent_vertices, ipfs_cid, payload_hash,
                emission_timestamp, emission_node, cumulative_weight, signature, signature_algorithm, confirmed
              ) VALUES (?,?,?,?,?,?,?,1,?,?,0)`
            )
            .bind(
              vid,
              body.vertex_type || 'transaction',
              parents,
              cid,
              ph,
              now,
              node_id,
              body.signature || 'lab-unsigned',
              body.signature_algorithm || 'none'
            )
            .run();
        } catch (e1) {
          // Fallback dag_vertices
          try {
            await db
              .prepare(
                `INSERT INTO dag_vertices (cid, type, parents, payload, weight, confirmed, vertex_id)
                 VALUES (?,?,?,?,1,0,?)`
              )
              .bind(cid || ph, 'transaction', parents, payloadStr, vid)
              .run();
          } catch (e2) {
            return j({ error: 'attach failed', e1: String(e1.message || e1), e2: String(e2.message || e2) }, 500);
          }
        }

        // Update tip weights lightly
        try {
          await db
            .prepare(
              'INSERT INTO dag_tips (cid, weight, updated_at, vertex_id) VALUES (?,1,?,?) ON CONFLICT(cid) DO UPDATE SET weight = weight + 1, updated_at = excluded.updated_at'
            )
            .bind(cid || vid, now, vid)
            .run();
        } catch (_) {}

        // Gossip
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
              body: JSON.stringify({ id: vid, hash: ph, tip: vid, cid, tips: tipIds, payload: payloadStr.slice(0, 200) }),
            });
            gossip.push({ peer: peer.split('.')[0].replace('https://', ''), ok: resp.ok, status: resp.status });
          } catch (e) {
            gossip.push({ peer, ok: false, error: String(e.message || e).slice(0, 80) });
          }
        }

        return j({
          success: true,
          pipeline: 'tip-select → hash → ipfs-pin → attach → gossip',
          vertex_id: vid,
          payload_hash: ph,
          tips: tipIds,
          ipfs_cid: cid,
          pin,
          gossip,
          cumulative_weight: 1,
          version: '2.1.0-ipfs-ops',
        });
      }

      // GET /vertices
      if (path === '/vertices') {
        const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '10', 10));
        try {
          const r = await db
            .prepare(
              'SELECT vertex_id, vertex_type, parent_vertices, ipfs_cid, payload_hash, cumulative_weight, emission_node, created_at FROM vertices ORDER BY created_at DESC LIMIT ?'
            )
            .bind(limit)
            .all();
          return j({ vertices: r.results || [], count: (r.results || []).length });
        } catch (e) {
          return j({ vertices: [], error: String(e.message || e) });
        }
      }

      // validate
      if (path === '/validate' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const id = body.vertex_id || body.id;
        const v = await db.prepare('SELECT * FROM vertices WHERE vertex_id=?').bind(id).first();
        if (!v) return j({ error: 'Not found' }, 404);
        return j({ valid: true, vertex: v });
      }

      if (path === '/vertex') {
        const id = url.searchParams.get('id');
        const v = await db.prepare('SELECT * FROM vertices WHERE vertex_id=?').bind(id).first();
        if (!v) return j({ error: 'Not found' }, 404);
        return j({ vertex: v });
      }

      return j({
        status: 'ok',
        service: 'stratamesh-dag',
        version: '2.1.0-ipfs-ops',
        endpoints: ['/health', '/tips', '/submit', '/attach', '/vertices', '/vertex', '/validate'],
      });
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
