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
          service: 'stratamesh-realms',
          node_type: 'governance',
          mesh: 'stratamesh-fog',
          node_id: 'FOG-NODE-PT-CM-REALMS',
          repaired: true,
          version: '1.1.0-repaired'
        });
      }

      if (path === '/list' || path === '/realms') {
        return j({ realms: [{ id: 'cmn-lab', name: 'Calhegas Morais Lab', sovereignty: 'operator' }], count: 1 });
      }

      return j({ error: 'Not found', service: 'stratamesh-realms' }, 404);
    } catch (err) {
      return j({ error: String(err.message || err) }, 500);
    }
  }
};
