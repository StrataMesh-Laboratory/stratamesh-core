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
      return j({ status: 'ok', service: 'stratamesh-gossip', role: 'tip-dissemination', version: '1.2.0' });
    }
    if (path === '/peers') {
      return j({ peers: [{ id: 'node-2' }, { id: 'node-3' }, { id: 'scout' }, { id: 'edge' }] });
    }
    if ((path === '/broadcast' || path === '/validate' || path === '/gossip') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      return j({
        broadcast: true,
        tip: body.tip || body.id || body.hash,
        cid: body.cid || null,
        fanout: ['node-2', 'node-3', 'edge'],
        at: new Date().toISOString()
      });
    }
    return j({ error: 'Not found', endpoints: ['/health', '/peers', '/broadcast'] }, 404);
  }
};
