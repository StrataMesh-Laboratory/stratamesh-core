/**
 * Cloudflare Pages Function — origin POST /api/orchestrator/chat
 * Custom domain calhegasmorais.pt (never workers.dev).
 * Returns 200 JSON { reply nonempty, clearance, pulse_id }.
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
  }, extra || {});
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors(new Headers()) });
  }
  if (request.method === 'GET') {
    const accept = request.headers.get('Accept') || '';
    if (accept.includes('application/json')) {
      return json({
        status: 'ok',
        service: 'stratamesh-orchestrator',
        methods: ['POST'],
        pulse_id: pulseId(),
        origin: 'calhegasmorais.pt',
      });
    }
  }
  let body = {};
  if (request.method === 'POST') {
    try { body = await request.json(); } catch (_) { body = {}; }
  }
  const msg = (body && (body.message || body.text || body.prompt)) || '';
  try {
    const orch = env && (env.ORCH || env.ORCHESTRATOR);
    if (orch && typeof orch.fetch === 'function' && request.method === 'POST') {
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      const auth = request.headers.get('Authorization');
      if (auth) headers.Authorization = auth;
      const resp = await orch.fetch(new Request('https://orchestrator.internal/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify(Object.assign({}, body, { message: msg || 'lab pulse' })),
      }));
      const text = await resp.text();
      let obj = null;
      try { obj = JSON.parse(text); } catch (_) {}
      if (obj && typeof obj === 'object') {
        if (!obj.reply) obj.reply = localReply(msg).reply;
        if (!obj.clearance) obj.clearance = obj.account_clearance || 'public';
        if (!obj.pulse_id) obj.pulse_id = pulseId();
        return json(obj, 200);
      }
    }
  } catch (e) {
    return json(localReply(msg, { error: String(e && e.message ? e.message : e).slice(0, 180) }), 200);
  }
  return json(localReply(msg || 'lab pulse'), 200);
}
