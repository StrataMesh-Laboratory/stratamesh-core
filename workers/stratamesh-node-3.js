/**
 * Independent validator node — tip weight contributor.
 * node_id: NODE-VAL-PT-CM-003
 */
const NODE_ID = 'NODE-VAL-PT-CM-003';
const VERSION = '2.0.0-independent-validator';
const DAG = 'https://stratamesh-dag.stratamesh.workers.dev';

function j(d, s = 200) {
  return new Response(JSON.stringify(d, null, 2), {
    status: s,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

async function sha256hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s || '')));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    if (path === '/health' || path === '/' || path === '/identity') {
      return j({
        status: 'ok',
        service: 'stratamesh-node-3',
        node_id: NODE_ID,
        node_type: 'independent_validator',
        operator: 'lab-validator-3',
        independent_of_fog_operator: true,
        tip_weight: true,
        version: VERSION,
      });
    }

    if ((path === '/validate' || path === '/pin' || path === '/broadcast') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const material = body.hash || body.payload_hash || body.cid || body.id || JSON.stringify(body).slice(0, 200);
      const local_hash = await sha256hex(NODE_ID + ':' + material);
      const tips = [];
      if (body.tip) tips.push(body.tip);
      if (body.id) tips.push(body.id);
      if (Array.isArray(body.tips)) tips.push(...body.tips);
      const vertex_ids = [...new Set(tips.filter(Boolean))].slice(0, 4);

      let weight = null;
      if (vertex_ids.length) {
        try {
          const dag = env.DAG;
          const init = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ peer_id: NODE_ID, vertex_ids, delta: 1 }),
          };
          let resp;
          if (dag && typeof dag.fetch === 'function') {
            resp = await dag.fetch(new Request('https://binding.internal/peer-weight', init));
          } else {
            resp = await fetch(DAG + '/peer-weight', init);
          }
          weight = await resp.json().catch(() => ({}));
        } catch (e) {
          weight = { ok: false, error: String(e.message || e).slice(0, 80) };
        }
      }

      return j({
        ok: true,
        peer: NODE_ID,
        accepted: true,
        local_hash,
        id: body.id || body.vertex_id || null,
        hash: body.hash || body.payload_hash || null,
        cid: body.cid || null,
        tip_weight: weight,
        validated_at: new Date().toISOString(),
        version: VERSION,
      });
    }

    return j({ error: 'not_found', endpoints: ['/health', '/validate', '/pin'] }, 404);
  },
};
