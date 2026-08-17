/**
 * StrataMesh IoT Edge — general, substrate-agnostic, background-friendly
 *
 * Principles:
 * - Standing by function (agent_id + capability), not by hardware class
 * - Device activity undisturbed: ingest is fire-and-forget; heavy work in waitUntil
 * - Lightweight DAG path (type=iot, lightweight=true); IPFS only on optional batch seal
 * - Edge always-on; fog optional
 */
const VERSION = '2.0.0-edge-iot';
const MAX_BATCH = 64;
const MAX_PAYLOAD_BYTES = 4096;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-Id, X-StrataMesh-Key',
      'Cache-Control': 'no-store',
    },
  });
}

function agentIdFrom(body, headers) {
  const h = headers.get('X-Agent-Id') || headers.get('X-Device-Id') || '';
  const b = (body && (body.agent_id || body.device_id || body.node_id || body.id)) || '';
  const id = String(b || h || '').trim().slice(0, 128);
  return id || null;
}

/** Normalize any reading into a functional event (substrate fields optional metadata only). */
function normalizeEvent(raw, defaultAgent) {
  const e = raw && typeof raw === 'object' ? raw : { value: raw };
  const agent_id = String(e.agent_id || e.device_id || defaultAgent || 'anonymous').slice(0, 128);
  const kind = String(e.kind || e.type || e.metric || 'telemetry').slice(0, 64);
  const ts = e.ts || e.timestamp || e.t || new Date().toISOString();
  // strip large blobs — keep function-relevant fields
  const payload = {
    kind,
    ts,
    value: e.value !== undefined ? e.value : e.v !== undefined ? e.v : e.data,
    unit: e.unit || undefined,
    tags: e.tags || undefined,
    // optional hints — never required for acceptance
    substrate_hint: e.substrate || e.platform || e.hw || undefined,
  };
  const s = JSON.stringify(payload);
  if (s.length > MAX_PAYLOAD_BYTES) {
    return { error: 'payload_too_large', max: MAX_PAYLOAD_BYTES };
  }
  return { agent_id, kind, ts, payload, payload_str: s };
}

async function ensureTables(db) {
  if (!db) return;
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS iot_agents (
        agent_id TEXT PRIMARY KEY,
        label TEXT,
        last_seen TEXT,
        event_count INTEGER DEFAULT 0,
        substrate_hint TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`
      )
      .run();
  } catch (_) {}
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS iot_events (
        id TEXT PRIMARY KEY,
        agent_id TEXT,
        kind TEXT,
        payload_json TEXT,
        received_at TEXT,
        dag_vertex TEXT,
        status TEXT
      )`
      )
      .run();
  } catch (_) {}
}

async function touchAgent(db, agent_id, substrate_hint) {
  if (!db || !agent_id) return;
  try {
    await db
      .prepare(
        `INSERT INTO iot_agents (agent_id, last_seen, event_count, substrate_hint)
         VALUES (?, datetime('now'), 1, ?)
         ON CONFLICT(agent_id) DO UPDATE SET
           last_seen = datetime('now'),
           event_count = event_count + 1,
           substrate_hint = COALESCE(excluded.substrate_hint, iot_agents.substrate_hint)`
      )
      .bind(agent_id, substrate_hint || null)
      .run();
  } catch (_) {}
}

async function recordEvent(db, id, agent_id, kind, payload_str, status) {
  if (!db) return;
  try {
    await db
      .prepare(
        `INSERT INTO iot_events (id, agent_id, kind, payload_json, received_at, status)
         VALUES (?, ?, ?, ?, datetime('now'), ?)`
      )
      .bind(id, agent_id, kind, payload_str, status)
      .run();
  } catch (_) {}
}

async function markDag(db, id, vertex) {
  if (!db || !vertex) return;
  try {
    await db
      .prepare(`UPDATE iot_events SET dag_vertex = ?, status = 'on_dag' WHERE id = ?`)
      .bind(vertex, id)
      .run();
  } catch (_) {}
}

/** Background: one lightweight DAG vertex (does not block device ACK). */
async function backgroundToDag(env, events, batchId) {
  if (!events.length) return null;
  const payload = {
    type: 'iot',
    tx_class: 'lightweight',
    lightweight: true,
    batch_id: batchId,
    n: events.length,
    agents: [...new Set(events.map((e) => e.agent_id))].slice(0, 16),
    // sample only — full series stays on edge ledger; keeps graph lean
    sample: events.slice(0, 8).map((e) => ({
      agent_id: e.agent_id,
      kind: e.kind,
      ts: e.ts,
      value: e.payload.value,
    })),
  };

  const trySubmit = async (url, init) => {
    const r = await fetch(url, init);
    return r.json().catch(() => ({}));
  };

  try {
    if (env.DAG && typeof env.DAG.fetch === 'function') {
      const r = await env.DAG.fetch(
        new Request('https://dag.internal/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payload,
            node_id: 'EDGE-IOT-CMN',
            vertex_type: 'iot',
          }),
        })
      );
      const j = await r.json().catch(() => ({}));
      if (j && (j.vertex_id || j.success)) return j;
    }
  } catch (_) {}

  try {
    return await trySubmit('https://stratamesh-dag.stratamesh.workers.dev/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, node_id: 'EDGE-IOT-CMN', vertex_type: 'iot' }),
    });
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

/** Optional: seal a batch summary to IPFS edge (rare; not per-tick). */
async function backgroundSealIpfs(env, batchId, summary) {
  try {
    if (env.IPFS && typeof env.IPFS.fetch === 'function') {
      const r = await env.IPFS.fetch(
        new Request('https://ipfs.internal/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: JSON.stringify(summary),
            name: 'iot-batch-' + batchId,
            node_id: 'EDGE-IOT-CMN',
            tier: 'contributor',
          }),
        })
      );
      return await r.json().catch(() => null);
    }
  } catch (_) {}
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.startsWith('/api/v1/iot')) path = path.slice('/api/v1/iot'.length) || '/';
    if (path.startsWith('/iot')) path = path.slice('/iot'.length) || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    const db = env.LEDGER || env.DB || env.AUTH_DB;

    if (path === '/health' || path === '/' || path === '') {
      let agents = 0;
      try {
        const r = await db.prepare('SELECT COUNT(*) as c FROM iot_agents').first();
        agents = r?.c || 0;
      } catch (_) {}
      return json({
        status: 'ok',
        service: 'stratamesh-iot',
        version: VERSION,
        substrate: 'agnostic',
        mode: 'edge-background',
        device_impact: 'none_required',
        agents_known: agents,
        endpoints: ['/health', '/ingest', '/batch', '/agents', '/stats'],
        ontology: 'standing by function and agreement, not substrate',
      });
    }

    // POST /ingest — single event or {events:[...]}
    if ((path === '/ingest' || path === '/telemetry' || path === '/t') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const defaultAgent = agentIdFrom(body, request.headers);
      let rawList = Array.isArray(body.events)
        ? body.events
        : Array.isArray(body)
          ? body
          : [body];
      if (rawList.length > MAX_BATCH) rawList = rawList.slice(0, MAX_BATCH);

      const accepted = [];
      const rejected = [];
      await ensureTables(db);

      for (const raw of rawList) {
        const n = normalizeEvent(raw, defaultAgent);
        if (n.error) {
          rejected.push(n);
          continue;
        }
        const id = crypto.randomUUID();
        await recordEvent(db, id, n.agent_id, n.kind, n.payload_str, 'accepted');
        await touchAgent(db, n.agent_id, n.payload.substrate_hint);
        accepted.push({ id, agent_id: n.agent_id, kind: n.kind });
      }

      const batchId = crypto.randomUUID();
      // ACK first — device can sleep; DAG/IPFS in background
      if (accepted.length && ctx && typeof ctx.waitUntil === 'function') {
        ctx.waitUntil(
          (async () => {
            const events = [];
            for (const a of accepted) {
              events.push({
                agent_id: a.agent_id,
                kind: a.kind,
                ts: new Date().toISOString(),
                payload: { value: undefined },
              });
            }
            // rebuild minimal from accepted ids is enough for sample
            const dag = await backgroundToDag(
              env,
              accepted.map((a) => ({
                agent_id: a.agent_id,
                kind: a.kind,
                ts: new Date().toISOString(),
                payload: { value: null },
              })),
              batchId
            );
            const vid = dag && (dag.vertex_id || (dag.success && dag.vertex_id));
            if (vid) {
              for (const a of accepted) await markDag(db, a.id, vid);
            }
            if (body.seal_ipfs || body.ipfs) {
              await backgroundSealIpfs(env, batchId, {
                batch_id: batchId,
                n: accepted.length,
                agents: [...new Set(accepted.map((x) => x.agent_id))],
                dag_vertex: vid || null,
              });
            }
          })()
        );
      }

      return json({
        success: true,
        accepted: accepted.length,
        rejected: rejected.length,
        batch_id: batchId,
        items: accepted,
        errors: rejected.length ? rejected : undefined,
        ack: 'immediate',
        processing: 'background',
        note: 'Device may disconnect; edge continues without requiring substrate class.',
      });
    }

    // POST /batch — alias with explicit background
    if (path === '/batch' && request.method === 'POST') {
      // reuse ingest by rewriting
      const body = await request.json().catch(() => ({}));
      const events = body.events || body.readings || body.data || [];
      const fake = new Request(url.origin + '/ingest', {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify({
          events: Array.isArray(events) ? events : [body],
          agent_id: body.agent_id,
          seal_ipfs: body.seal_ipfs,
        }),
      });
      return this.fetch(fake, env, ctx);
    }

    // GET /agents
    if (path === '/agents' && request.method === 'GET') {
      await ensureTables(db);
      try {
        const r = await db
          .prepare(
            'SELECT agent_id, label, last_seen, event_count, substrate_hint FROM iot_agents ORDER BY last_seen DESC LIMIT 100'
          )
          .all();
        return json({
          success: true,
          agents: r.results || [],
          ontology: 'agent_id is functional identity; substrate_hint is optional metadata only',
        });
      } catch (e) {
        return json({ success: true, agents: [], error: String(e.message || e) });
      }
    }

    // GET /agents/:id
    if (path.startsWith('/agents/') && request.method === 'GET') {
      const id = decodeURIComponent(path.slice('/agents/'.length).split('/')[0]);
      await ensureTables(db);
      try {
        const agent = await db.prepare('SELECT * FROM iot_agents WHERE agent_id = ?').bind(id).first();
        const ev = await db
          .prepare(
            'SELECT id, kind, received_at, status, dag_vertex FROM iot_events WHERE agent_id = ? ORDER BY received_at DESC LIMIT 20'
          )
          .bind(id)
          .all();
        return json({ success: true, agent: agent || null, recent: ev.results || [] });
      } catch (e) {
        return json({ success: false, error: String(e.message || e) }, 500);
      }
    }

    // GET /stats
    if (path === '/stats' && request.method === 'GET') {
      await ensureTables(db);
      try {
        const a = await db.prepare('SELECT COUNT(*) as c FROM iot_agents').first();
        const e = await db.prepare('SELECT COUNT(*) as c FROM iot_events').first();
        const d = await db.prepare("SELECT COUNT(*) as c FROM iot_events WHERE status = 'on_dag'").first();
        return json({
          agents: a?.c || 0,
          events: e?.c || 0,
          on_dag: d?.c || 0,
          version: VERSION,
        });
      } catch (e) {
        return json({ agents: 0, events: 0, on_dag: 0, note: String(e.message || e) });
      }
    }

    return json({ error: 'Not found', service: 'stratamesh-iot', version: VERSION }, 404);
  },
};
