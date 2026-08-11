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
          service: 'stratamesh-sandbox',
          node_type: 'trial',
          mesh: 'stratamesh-fog',
          node_id: 'FOG-NODE-PT-CM-SANDBOX',
          repaired: true,
          version: '1.1.0-repaired'
        });
      }

      if (path === '/spawn' && request.method === 'POST') {
        return j({ spa_id: crypto.randomUUID(), status: 'spawned', trial: true });
      }

      return j({ error: 'Not found', service: 'stratamesh-sandbox' }, 404);
    } catch (err) {
      return j({ error: String(err.message || err) }, 500);
    }
  }
};
