/**
 * Cloudflare Pages Function — origin POST /api/orchestrator/chat (fail-open).
 * Custom domain calhegasmorais.pt (never workers.dev).
 * GET/HEAD always 200 JSON. POST always 200 JSON in <2s (AbortSignal 1500ms).
 */
function pulseId() {
  return 'pulse-' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z') + '-' + Math.random().toString(36).slice(2, 8);
}

function cors(h) {
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Clearance, Accept');
  h.set('Cache-Control', 'no-store');
  return h;
}

function json(data, status) {
  const h = cors(new Headers({ 'Content-Type': 'application/json; charset=utf-8' }));
  return new Response(JSON.stringify(data), { status: status || 200, headers: h });
}

function localReply(message, extra) {
  const msg = String(message || '').trim();
  const reply = msg
    ? ('Orquestrador CMN (Pages origin). Recebi: «' + msg.slice(0, 280) + '». SCA-ORCH-CMN-001 · FOG-NODE-PT-CM-001 · n=1 · mesh_member=false · oracle_live=false.')
    : 'Orquestrador CMN (Pages origin). Pulso vazio aceite. FOG-NODE-PT-CM-001 · n=1.';
  return Object.assign({
    reply,
    clearance: 'public',
    account_clearance: 'public',
    pulse_id: pulseId(),
    role: 'orchestrator',
    source: 'pages-function-originOrchChat',
    lab: true,
    node_id: 'FOG-NODE-PT-CM-001',
    version: 'origin-orch-chat-1.1.0',
  }, extra || {});
}

function abortAfter(ms) {
  const c = new AbortController();
  const t = setTimeout(() => { try { c.abort(); } catch (_) {} }, ms);
  return { signal: c.signal, cancel() { clearTimeout(t); } };
}

async function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => {
      const e = new Error(label + '_timeout');
      e.name = 'AbortError';
      rej(e);
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(t);
  }
}

async function probeFogHealth1500() {
  const a = abortAfter(1500);
  try {
    const r = await withTimeout(fetch('https://fog.calhegasmorais.pt/health', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: a.signal,
    }), 1500, 'fog_health');
    const text = await r.text();
    let obj = null;
    try { obj = JSON.parse(text); } catch (_) {}
    return {
      ok: !!(obj && (obj.ok === true || obj.status === 'ok')),
      http: r.status,
      version: obj && obj.version,
      mesh_member: !!(obj && obj.mesh_member),
      oracle_live: !!(obj && obj.oracle_live),
    };
  } catch (e) {
    return { ok: false, error: String(e && e.name ? e.name : e).slice(0, 80), mesh_member: false, oracle_live: false };
  } finally {
    a.cancel();
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors(new Headers()) });
  }
  if (request.method === 'GET' || request.method === 'HEAD') {
    const body = {
      status: 'ok',
      service: 'stratamesh-orchestrator',
      methods: ['GET', 'POST', 'OPTIONS'],
      pulse_id: pulseId(),
      origin: 'calhegasmorais.pt',
      version: 'origin-orch-chat-1.1.0',
      lab: true,
      node_id: 'FOG-NODE-PT-CM-001',
    };
    if (request.method === 'HEAD') return new Response(null, { status: 200, headers: cors(new Headers()) });
    return json(body, 200);
  }
  let body = {};
  if (request.method === 'POST') {
    try { body = await request.json(); } catch (_) { body = {}; }
  }
  const msg = (body && (body.message || body.text || body.prompt)) || '';
  const fog = { skipped: true, ok: false, http: 0, mesh_member: false, oracle_live: false, reason: 'fog_health_not_awaited' };
  try {
    const orch = env && (env.ORCH || env.ORCHESTRATOR);
    if (orch && typeof orch.fetch === 'function' && request.method === 'POST') {
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      const auth = request.headers.get('Authorization');
      if (auth) headers.Authorization = auth;
      const resp = await withTimeout(orch.fetch(new Request('https://orchestrator.internal/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify(Object.assign({}, body, { message: msg || 'lab pulse' })),
      })), 1500, 'orch_fetch');
      const text = await resp.text();
      let obj = null;
      try { obj = JSON.parse(text); } catch (_) {}
      if (obj && typeof obj === 'object') {
        if (!obj.reply) obj.reply = localReply(msg).reply;
        if (!obj.clearance) obj.clearance = obj.account_clearance || 'public';
        if (!obj.pulse_id) obj.pulse_id = pulseId();
        obj.fog = fog;
        obj.version = 'origin-orch-chat-1.1.0';
        return json(obj, 200);
      }
    }
  } catch (e) {
    const extra = { fog, error: String(e && e.message ? e.message : e).slice(0, 180), source: 'pages-function-timeout' };
    const out = localReply(msg, extra);
    if (e && e.name === 'AbortError') out.pulse_id = 'unknown';
    return json(out, 200);
  }
  return json(localReply(msg || 'lab pulse', { fog }), 200);
}
