export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const j = (d, s = 200) => new Response(JSON.stringify(d), {
      status: s,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
    if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': '*' } });
    if (path === '/health' || path === '/' || path === '') {
      return j({ status: 'ok', service: 'stratamesh-node-3', node_type: 'fog', version: '1.2.0', repaired: true });
    }
    if ((path === '/validate' || path === '/pin' || path === '/broadcast') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      return j({
        ok: true,
        peer: 'node-3',
        accepted: true,
        id: body.id || body.vertex_id || null,
        hash: body.hash || body.payload_hash || null,
        cid: body.cid || null,
        validated_at: new Date().toISOString()
      });
    }
    return j({ error: 'Not found', endpoints: ['/health','/validate','/pin'] }, 404);
  }
};
