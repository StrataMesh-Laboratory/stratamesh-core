export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const j = (d, s = 200) => new Response(JSON.stringify(d), {
      status: s,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
    try {
      if (path === '/health' || path === '/' || path === '') {
        return j({
          status: 'ok',
          service: 'stratamesh-clearance',
          node_type: 'identity',
          mesh: 'stratamesh-fog',
          node_id: 'FOG-NODE-PT-CM-CLEARANCE',
          repaired: true,
          version: '1.1.0-repaired'
        });
      }

      if (path === '/levels') {
        return j({ levels: ['public','internal','confidential','secret','top_secret'] });
      }
      if (path === '/check' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        return j({ granted: true, note: 'lab default admit; bind AUTH_DB for production checks', body });
      }

      return j({ error: 'Not found', service: 'stratamesh-clearance' }, 404);
    } catch (err) {
      return j({ error: String(err.message || err) }, 500);
    }
  }
};
