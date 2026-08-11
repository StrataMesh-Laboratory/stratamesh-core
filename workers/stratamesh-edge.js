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
          service: 'stratamesh-edge',
          node_type: 'edge',
          mesh: 'stratamesh-fog',
          node_id: 'FOG-NODE-PT-CM-EDGE',
          repaired: true,
          version: '1.1.0-repaired'
        });
      }

      if (path === '/submit-tx' && request.method === 'POST') {
        const tx = await request.json().catch(() => ({}));
        const valid = !!(tx.payload && tx.signature);
        return j({ accepted: valid, tx_id: crypto.randomUUID(), timestamp: new Date().toISOString(), node: 'edge-1' });
      }
      if (path === '/cache' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        return j({ cid: body.cid, cached: true, cached_at: new Date().toISOString() });
      }
      if (path === '/sync') {
        return j({ status: 'synced', fog_node: 'calhegasmorais.pt', last_sync: new Date().toISOString() });
      }

      return j({ error: 'Not found', service: 'stratamesh-edge' }, 404);
    } catch (err) {
      return j({ error: String(err.message || err) }, 500);
    }
  }
};
