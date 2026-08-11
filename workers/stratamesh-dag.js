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
async function contentCid(d) {
  const hex = await sha256(d);
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = '';
  for (let i = 0; i < hex.length; i += 2) bits += parseInt(hex.slice(i, i + 2), 16).toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += alphabet[parseInt(bits.slice(i, i + 5), 2)];
  return 'bafy' + out.slice(0, 52);
}


async function ensureConflictTables(db) {
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS spend_claims (
      spend_key TEXT PRIMARY KEY,
      vertex_id TEXT NOT NULL,
      payload_hash TEXT,
      emission_node TEXT,
      created_at TEXT
    )`).run();
  } catch (_) {}
}

function extractSpendKey(payload) {
  let o = payload;
  if (typeof payload === 'string') {
    try { o = JSON.parse(payload); } catch { return null; }
  }
  if (!o || typeof o !== 'object') return null;
  // explicit key
  if (o.spend_key) return String(o.spend_key);
  const typ = (o.type || o.kind || '').toLowerCase();
  // token transfer / nft transfer conflict surface
  if (typ.includes('transfer') || typ.includes('spend') || typ === 'payment') {
    const asset = o.asset_id || o.nft_id || o.token || 'STRATA';
    const from = o.from || o.owner || o.seller || o.account || '';
    const nonce = o.nonce || o.utxo || o.tx_ref || o.id || '';
    if (from || nonce) return `spend:${asset}:${from}:${nonce}`;
  }
  if (typ === 'nft_mint' && o.id) return `mint:${o.id}`;
  return null;
}

async function bumpWeights(db, tipIds, delta = 1) {
  // Increase cumulative_weight on referenced tips (parents) — lab approximation of cumulative confirmation weight
  for (const tid of tipIds || []) {
    if (!tid || tid === 'GENESIS') continue;
    try {
      await db.prepare('UPDATE vertices SET cumulative_weight = COALESCE(cumulative_weight,0) + ? WHERE vertex_id = ?').bind(delta, tid).run();
    } catch (_) {}
    try {
      await db.prepare('UPDATE dag_tips SET weight = COALESCE(weight,0) + ? WHERE vertex_id = ? OR cid = ?').bind(delta, tid, tid).run();
    } catch (_) {}
    // one level up: parents of tip
    try {
      const row = await db.prepare('SELECT parent_vertices FROM vertices WHERE vertex_id = ?').bind(tid).first();
      if (row && row.parent_vertices) {
        let parents = [];
        try { parents = JSON.parse(row.parent_vertices); } catch { parents = []; }
        for (const pid of parents.slice(0, 4)) {
          if (!pid || pid === 'GENESIS') continue;
          try {
            await db.prepare('UPDATE vertices SET cumulative_weight = COALESCE(cumulative_weight,0) + ? WHERE vertex_id = ?').bind(Math.max(1, Math.floor(delta / 2)), pid).run();
          } catch (_) {}
        }
      }
    } catch (_) {}
  }
}

function confidenceFromWeight(w) {
  const n = Number(w) || 0;
  return Math.round((1 - 1 / (1 + n)) * 10000) / 10000;
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
          version: '2.5.1-weight-conflict',
          anti_double_spend: true,
          cumulative_weight: true,
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

        await ensureConflictTables(db);

        // Exact duplicate payload
        let dup = null;
        try {
          dup = await db.prepare('SELECT vertex_id FROM vertices WHERE payload_hash=?').bind(ph).first();
        } catch (_) {}
        if (dup) {
          return j({
            error: 'duplicate_payload',
            reason: 'Identical payload already on DAG',
            existing: dup.vertex_id,
            rule: 'payload_hash unique',
          }, 409);
        }

        // Semantic double-spend / conflict (spend_key)
        const spendKey = extractSpendKey(payload);
        if (spendKey) {
          let claim = null;
          try {
            claim = await db.prepare('SELECT * FROM spend_claims WHERE spend_key = ?').bind(spendKey).first();
          } catch (_) {}
          if (claim && claim.payload_hash !== ph) {
            return j({
              error: 'Double-spend detected',
              reason: 'Conflicting spend_key already claimed by another vertex',
              spend_key: spendKey,
              existing: claim.vertex_id,
              existing_hash: claim.payload_hash,
              rule: 'one spend_key → one accepted payload on DAG',
            }, 409);
          }
        }

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
          cid = await contentCid(typeof content === 'string' ? content : JSON.stringify(content));
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

                // Register spend claim (anti-double-spend surface)
        if (spendKey) {
          try {
            await db
              .prepare(
                'INSERT OR IGNORE INTO spend_claims (spend_key, vertex_id, payload_hash, emission_node, created_at) VALUES (?,?,?,?,?)'
              )
              .bind(spendKey, vid, ph, node_id, new Date().toISOString())
              .run();
          } catch (_) {}
        }

        // Cumulative weight: new vertex weight=1; bump parents (whitepaper confirmation via subsequent references)
        await bumpWeights(db, tipIds, 1);
        try {
          for (const tip of tipIds) {
            await db
              .prepare(
                'INSERT INTO dag_tips (cid, weight, updated_at, vertex_id) VALUES (?,1,?,?) ON CONFLICT(cid) DO UPDATE SET weight = weight + 1, updated_at = excluded.updated_at'
              )
              .bind(tip, new Date().toISOString(), vid)
              .run();
          }
        } catch (_) {}


        // Gossip
        const gossipBody = JSON.stringify({ id: vid, hash: ph, tip: vid, cid, tips: tipIds, payload: payloadStr.slice(0, 200) });
        const gossip = [];
        const peerBindings = [
          ['node-2', env.NODE2, 'https://stratamesh-node-2.stratamesh.workers.dev', '/validate'],
          ['node-3', env.NODE3, 'https://stratamesh-node-3.stratamesh.workers.dev', '/validate'],
          ['gossip', env.GOSSIP, 'https://stratamesh-gossip.stratamesh.workers.dev', '/broadcast'],
        ];
        for (const [name, binding, base, pth] of peerBindings) {
          try {
            let resp;
            if (binding && typeof binding.fetch === 'function') {
              resp = await binding.fetch(new Request('https://peer' + pth, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: gossipBody,
              }));
            } else {
              resp = await fetch(base + pth, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: gossipBody,
              });
            }
            gossip.push({ peer: name, ok: resp.ok, status: resp.status });
          } catch (e) {
            gossip.push({ peer: name, ok: false, error: String(e.message || e).slice(0, 80) });
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
          spend_key: spendKey,
          confidence: confidenceFromWeight(1),
          version: '2.5.1-weight-conflict',
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


      // GET /confidence?id= — cumulative weight → probabilistic confidence
      if (path === '/confidence') {
        const id = url.searchParams.get('id') || url.searchParams.get('vertex_id');
        if (!id) return j({ error: 'id required' }, 400);
        const v = await db.prepare('SELECT vertex_id, cumulative_weight, payload_hash, parent_vertices FROM vertices WHERE vertex_id = ?').bind(id).first();
        if (!v) return j({ error: 'not found' }, 404);
        const w = Number(v.cumulative_weight || 0);
        return j({
          vertex_id: v.vertex_id,
          cumulative_weight: w,
          confidence: confidenceFromWeight(w),
          model: 'lab: confidence = 1 - 1/(1+weight); weight grows when later txs reference this vertex as tip',
        });
      }

      // GET /conflicts — spend claims ledger
      if (path === '/conflicts' || path === '/spend-claims') {
        await ensureConflictTables(db);
        const rows = await db.prepare('SELECT * FROM spend_claims ORDER BY created_at DESC LIMIT 50').all();
        return j({ claims: rows.results || [], rule: 'one spend_key → one vertex' });
      }

      return j({
        status: 'ok',
        service: 'stratamesh-dag',
        version: '2.5.1-weight-conflict',
        endpoints: ['/health', '/tips', '/submit', '/attach', '/vertices', '/vertex', '/validate', '/confidence', '/conflicts'],
      });
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
