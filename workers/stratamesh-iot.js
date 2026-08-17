/**
 * StrataMesh IoT Edge — universal device compatibility
 * Substrate-agnostic · background DAG · minimal device burden
 *
 * Accepts: JSON, SenML-ish, form, querystring GET, plain text "k=v", CSV line,
 *          Home Assistant / TTN-ish envelopes, arrays, {data:{...}}
 * Responds: JSON (default), text/plain (?fmt=text|ok), 204 (?fmt=empty)
 */
const VERSION = '2.1.0-universal';
const MAX_BATCH = 128;
const MAX_PAYLOAD_BYTES = 8192;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Agent-Id, X-Device-Id, X-Device-ID, X-Node-Id, X-Client-Id, X-StrataMesh-Key, X-API-Key, X-Request-Id',
  'Access-Control-Max-Age': '86400',
};

function respond(data, status, fmt) {
  if (fmt === 'empty' || fmt === '204') {
    return new Response(null, { status: status === 200 ? 204 : status, headers: { ...CORS } });
  }
  if (fmt === 'text' || fmt === 'ok' || fmt === 'plain') {
    const line =
      status >= 400
        ? 'ERR ' + (data.error || status)
        : 'OK ' + (data.accepted != null ? data.accepted : 1) + (data.batch_id ? ' ' + data.batch_id : '');
    return new Response(line + '\n', {
      status,
      headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function pickFmt(url, headers) {
  const q = url.searchParams.get('fmt') || url.searchParams.get('format') || '';
  if (q) return q.toLowerCase();
  const accept = (headers.get('Accept') || '').toLowerCase();
  if (accept.includes('text/plain')) return 'text';
  if (accept === 'application/json' || accept.includes('json')) return 'json';
  return 'json';
}

function agentIdFrom(body, headers, url) {
  const q =
    url.searchParams.get('agent') ||
    url.searchParams.get('agent_id') ||
    url.searchParams.get('device') ||
    url.searchParams.get('device_id') ||
    url.searchParams.get('id') ||
    url.searchParams.get('node') ||
    '';
  const h =
    headers.get('X-Agent-Id') ||
    headers.get('X-Device-Id') ||
    headers.get('X-Device-ID') ||
    headers.get('X-Node-Id') ||
    headers.get('X-Client-Id') ||
    headers.get('X-M2M-Origin') ||
    '';
  const b =
    (body &&
      (body.agent_id ||
        body.device_id ||
        body.deviceId ||
        body.node_id ||
        body.client_id ||
        body.end_device_ids?.device_id ||
        body.dev_id ||
        body.thingName ||
        body.id)) ||
    '';
  const id = String(b || h || q || '').trim().slice(0, 128);
  return id || null;
}

/** Parse kv line: temp=21.5 unit=C or temp:21.5 */
function parseKvLine(line) {
  const o = {};
  const parts = String(line).trim().split(/[\s,;]+/);
  for (const p of parts) {
    const m = p.match(/^([A-Za-z0-9_.-]+)[=:](.+)$/);
    if (m) o[m[1]] = isFinite(Number(m[2])) ? Number(m[2]) : m[2];
  }
  if (o.temp != null && o.value == null) o.value = o.temp;
  if (o.temperature != null && o.value == null) o.value = o.temperature;
  if (o.humidity != null && o.kind == null) {
    o.kind = 'humidity';
    if (o.value == null) o.value = o.humidity;
  }
  return o;
}

/** SenML-ish: [{n,u,v,t}] or {n,u,v} */
function fromSenML(item) {
  if (Array.isArray(item)) return item.map(fromSenML);
  if (!item || typeof item !== 'object') return { value: item };
  return {
    kind: item.n || item.name || item.bn || 'telemetry',
    unit: item.u || item.unit,
    value: item.v != null ? item.v : item.vs != null ? item.vs : item.vb != null ? item.vb : item.value,
    ts: item.t != null ? (typeof item.t === 'number' ? new Date(item.t * (item.t < 1e12 ? 1000 : 1)).toISOString() : item.t) : undefined,
    agent_id: item.agent_id || item.device_id,
  };
}

function unwrapEnvelope(body) {
  if (!body || typeof body !== 'object') return body;
  // The Things Network uplink-ish
  if (body.uplink_message && body.uplink_message.decoded_payload) {
    return {
      ...body.uplink_message.decoded_payload,
      agent_id: body.end_device_ids?.device_id || body.agent_id,
      substrate: 'lorawan',
    };
  }
  // Home Assistant state
  if (body.entity_id && (body.state != null || body.attributes)) {
    return {
      agent_id: body.entity_id,
      kind: body.attributes?.device_class || 'state',
      value: body.state,
      unit: body.attributes?.unit_of_measurement,
      substrate: 'homeassistant',
    };
  }
  // AWS IoT / generic shadow
  if (body.state && body.state.reported) {
    return { ...body.state.reported, agent_id: body.thingName || body.agent_id, substrate: 'shadow' };
  }
  if (body.payload && typeof body.payload === 'object') return { ...body.payload, agent_id: body.agent_id || body.device_id };
  if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    return { ...body.data, agent_id: body.agent_id || body.device_id || body.data.agent_id };
  }
  if (body.fields && typeof body.fields === 'object') {
    return { ...body.fields, agent_id: body.agent_id || body.name, kind: body.measurement || body.kind };
  }
  return body;
}

function normalizeEvent(raw, defaultAgent) {
  let e = raw;
  if (typeof e === 'string') {
    const t = e.trim();
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        e = JSON.parse(t);
      } catch {
        e = parseKvLine(t);
      }
    } else if (t.includes('=') || t.includes(':')) {
      e = parseKvLine(t);
    } else if (isFinite(Number(t))) {
      e = { value: Number(t), kind: 'telemetry' };
    } else {
      e = { value: t, kind: 'message' };
    }
  }
  if (Array.isArray(e) && e.length && e[0] && (e[0].n != null || e[0].v != null)) {
    // SenML array handled by caller
    e = fromSenML(e[0]);
  }
  e = unwrapEnvelope(e && typeof e === 'object' ? e : { value: e });
  if (e && e.n != null && (e.v != null || e.vs != null)) e = fromSenML(e);

  const agent_id = String(
    e.agent_id || e.device_id || e.deviceId || e.dev_id || e.entity_id || defaultAgent || 'anonymous'
  ).slice(0, 128);
  const kind = String(e.kind || e.type || e.metric || e.measurement || e.name || e.n || 'telemetry').slice(0, 64);
  let ts = e.ts || e.timestamp || e.t || e.time || e.datetime;
  if (typeof ts === 'number') ts = new Date(ts < 1e12 ? ts * 1000 : ts).toISOString();
  if (!ts) ts = new Date().toISOString();

  let value = e.value;
  if (value === undefined) value = e.v;
  if (value === undefined) value = e.val;
  if (value === undefined) value = e.reading;
  if (value === undefined) value = e.state;
  if (value === undefined && e.data != null && typeof e.data !== 'object') value = e.data;

  const payload = {
    kind,
    ts,
    value,
    unit: e.unit || e.u || e.unit_of_measurement || undefined,
    tags: e.tags || e.tag || undefined,
    substrate_hint: e.substrate || e.platform || e.hw || e.protocol || undefined,
  };
  // pass through numeric extras without large blobs
  for (const k of Object.keys(e)) {
    if (['agent_id', 'device_id', 'deviceId', 'kind', 'type', 'metric', 'ts', 'timestamp', 't', 'value', 'v', 'unit', 'u', 'tags', 'substrate', 'platform', 'hw', 'data', 'payload', 'state'].includes(k))
      continue;
    const v = e[k];
    if (v == null) continue;
    if (typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && v.length < 64)) {
      if (!payload.extra) payload.extra = {};
      payload.extra[k] = v;
    }
  }
  const s = JSON.stringify(payload);
  if (s.length > MAX_PAYLOAD_BYTES) return { error: 'payload_too_large', max: MAX_PAYLOAD_BYTES };
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
    await db.prepare(`UPDATE iot_events SET dag_vertex = ?, status = 'on_dag' WHERE id = ?`).bind(vertex, id).run();
  } catch (_) {}
}

async function backgroundToDag(env, accepted, batchId) {
  const payload = {
    type: 'iot',
    tx_class: 'lightweight',
    lightweight: true,
    batch_id: batchId,
    n: accepted.length,
    agents: [...new Set(accepted.map((e) => e.agent_id))].slice(0, 24),
    sample: accepted.slice(0, 8).map((e) => ({
      agent_id: e.agent_id,
      kind: e.kind,
      ts: e.ts || new Date().toISOString(),
    })),
  };
  try {
    if (env.DAG && typeof env.DAG.fetch === 'function') {
      const r = await env.DAG.fetch(
        new Request('https://dag.internal/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload, node_id: 'EDGE-IOT-CMN', vertex_type: 'iot' }),
        })
      );
      const j = await r.json().catch(() => ({}));
      if (j && (j.vertex_id || j.success)) return j;
    }
  } catch (_) {}
  try {
    const r = await fetch('https://stratamesh-dag.stratamesh.workers.dev/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, node_id: 'EDGE-IOT-CMN', vertex_type: 'iot' }),
    });
    return await r.json().catch(() => ({}));
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

async function parseBody(request) {
  const ct = (request.headers.get('Content-Type') || '').toLowerCase();
  if (request.method === 'GET' || request.method === 'HEAD') return {};
  if (ct.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    const o = {};
    for (const [k, v] of params.entries()) o[k] = v;
    return o;
  }
  if (ct.includes('multipart/form-data')) {
    const fd = await request.formData();
    const o = {};
    for (const [k, v] of fd.entries()) o[k] = typeof v === 'string' ? v : v.name || 'file';
    return o;
  }
  const text = await request.text();
  if (!text || !text.trim()) return {};
  if (ct.includes('json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
    try {
      return JSON.parse(text);
    } catch {
      return { value: text.trim(), kind: 'raw' };
    }
  }
  // plain text / csv single line
  if (text.includes('\n')) {
    return { events: text.split(/\r?\n/).filter((l) => l.trim()).map((l) => parseKvLine(l)) };
  }
  return parseKvLine(text);
}

function eventsFromBody(body, url) {
  if (Array.isArray(body)) {
    if (body.length && body[0] && (body[0].n != null || body[0].v != null)) {
      return body.map(fromSenML);
    }
    return body;
  }
  if (body.events && Array.isArray(body.events)) return body.events;
  if (body.readings && Array.isArray(body.readings)) return body.readings;
  if (body.data && Array.isArray(body.data)) return body.data;
  if (body.payloads && Array.isArray(body.payloads)) return body.payloads;
  // query-only ingest
  if (!body || Object.keys(body).length === 0) {
    const v = url.searchParams.get('v') || url.searchParams.get('value') || url.searchParams.get('val');
    const kind = url.searchParams.get('kind') || url.searchParams.get('metric') || url.searchParams.get('n') || 'telemetry';
    if (v != null) {
      return [{ kind, value: isFinite(Number(v)) ? Number(v) : v, unit: url.searchParams.get('unit') || url.searchParams.get('u') || undefined }];
    }
  }
  return [body];
}

async function handleIngest(request, env, ctx, url) {
  const fmt = pickFmt(url, request.headers);
  const body = await parseBody(request);
  const defaultAgent = agentIdFrom(body, request.headers, url);
  let rawList = eventsFromBody(body, url);
  if (rawList.length > MAX_BATCH) rawList = rawList.slice(0, MAX_BATCH);

  const accepted = [];
  const rejected = [];
  const db = env.LEDGER || env.DB || env.AUTH_DB;
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
    accepted.push({ id, agent_id: n.agent_id, kind: n.kind, ts: n.ts });
  }

  const batchId = crypto.randomUUID();
  if (accepted.length && ctx && typeof ctx.waitUntil === 'function') {
    const seal = !!(body.seal_ipfs || body.ipfs || url.searchParams.get('ipfs') === '1');
    ctx.waitUntil(
      (async () => {
        const dag = await backgroundToDag(env, accepted, batchId);
        const vid = dag && dag.vertex_id;
        if (vid) for (const a of accepted) await markDag(db, a.id, vid);
        if (seal && env.IPFS) {
          try {
            await env.IPFS.fetch(
              new Request('https://ipfs.internal/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  content: JSON.stringify({ batch_id: batchId, n: accepted.length, dag_vertex: vid }),
                  name: 'iot-batch-' + batchId,
                  node_id: 'EDGE-IOT-CMN',
                }),
              })
            );
          } catch (_) {}
        }
      })()
    );
  }

  return respond(
    {
      success: true,
      accepted: accepted.length,
      rejected: rejected.length,
      batch_id: batchId,
      items: fmt === 'json' ? accepted : undefined,
      errors: rejected.length ? rejected : undefined,
      ack: 'immediate',
      processing: 'background',
      version: VERSION,
    },
    200,
    fmt
  );
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.startsWith('/api/v1/iot')) path = path.slice('/api/v1/iot'.length) || '/';
    if (path.startsWith('/iot')) path = path.slice('/iot'.length) || '/';
    // trailing slash
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const db = env.LEDGER || env.DB || env.AUTH_DB;
    const fmt = pickFmt(url, request.headers);

    if (path === '/health' || path === '/' || path === '/status') {
      let agents = 0;
      try {
        const r = await db.prepare('SELECT COUNT(*) as c FROM iot_agents').first();
        agents = r?.c || 0;
      } catch (_) {}
      return respond(
        {
          status: 'ok',
          service: 'stratamesh-iot',
          version: VERSION,
          substrate: 'agnostic',
          mode: 'edge-background',
          device_impact: 'none_required',
          agents_known: agents,
          accept: [
            'application/json',
            'application/senml+json',
            'text/plain',
            'application/x-www-form-urlencoded',
            'querystring GET',
          ],
          endpoints: ['/health', '/ingest', '/t', '/telemetry', '/batch', '/agents', '/stats', '/compat'],
          ontology: 'standing by function and agreement, not substrate',
        },
        200,
        fmt === 'text' ? 'text' : 'json'
      );
    }

    // Compatibility matrix for implementers
    if (path === '/compat' && request.method === 'GET') {
      return respond(
        {
          version: VERSION,
          identity_headers: ['X-Agent-Id', 'X-Device-Id', 'X-Node-Id', 'X-Client-Id'],
          identity_query: ['agent', 'agent_id', 'device', 'device_id', 'id', 'node'],
          body_shapes: [
            '{kind,value,unit}',
            '{n,u,v,t} SenML',
            '[{n,u,v}] SenML array',
            'temp=21.5 unit=C',
            'form: value=1&kind=rpm',
            'GET /ingest?agent=x&v=21.5&kind=temperature',
            'TTN uplink_message.decoded_payload',
            'Home Assistant entity_id+state',
            'AWS IoT state.reported',
          ],
          response_fmt: ['json (default)', 'fmt=text', 'fmt=empty (204)'],
          max_batch: MAX_BATCH,
          max_payload_bytes: MAX_PAYLOAD_BYTES,
          dag: 'lightweight type=iot in background',
          substrate: 'never required for acceptance',
        },
        200,
        'json'
      );
    }

    // Universal ingest aliases (POST/PUT/GET)
    const ingestPaths = ['/ingest', '/telemetry', '/t', '/up', '/data', '/event', '/events', '/publish', '/message'];
    if (ingestPaths.includes(path) && (request.method === 'POST' || request.method === 'PUT' || request.method === 'GET')) {
      return handleIngest(request, env, ctx, url);
    }
    if (path === '/batch' && (request.method === 'POST' || request.method === 'PUT')) {
      return handleIngest(request, env, ctx, url);
    }

    if (path === '/agents' && request.method === 'GET') {
      await ensureTables(db);
      try {
        const r = await db
          .prepare(
            'SELECT agent_id, label, last_seen, event_count, substrate_hint FROM iot_agents ORDER BY last_seen DESC LIMIT 100'
          )
          .all();
        return respond(
          {
            success: true,
            agents: r.results || [],
            ontology: 'agent_id is functional identity; substrate_hint is optional metadata only',
          },
          200,
          fmt
        );
      } catch (e) {
        return respond({ success: true, agents: [], error: String(e.message || e) }, 200, fmt);
      }
    }

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
        return respond({ success: true, agent: agent || null, recent: ev.results || [] }, 200, fmt);
      } catch (e) {
        return respond({ success: false, error: String(e.message || e) }, 500, fmt);
      }
    }

    if (path === '/stats' && request.method === 'GET') {
      await ensureTables(db);
      try {
        const a = await db.prepare('SELECT COUNT(*) as c FROM iot_agents').first();
        const e = await db.prepare('SELECT COUNT(*) as c FROM iot_events').first();
        const d = await db.prepare("SELECT COUNT(*) as c FROM iot_events WHERE status = 'on_dag'").first();
        return respond({ agents: a?.c || 0, events: e?.c || 0, on_dag: d?.c || 0, version: VERSION }, 200, fmt);
      } catch (e) {
        return respond({ agents: 0, events: 0, on_dag: 0, note: String(e.message || e) }, 200, fmt);
      }
    }

    return respond({ error: 'Not found', service: 'stratamesh-iot', version: VERSION, see: '/compat' }, 404, fmt);
  },
};
