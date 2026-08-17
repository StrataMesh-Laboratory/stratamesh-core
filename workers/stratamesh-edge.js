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
          iot: 'https://stratamesh-iot.stratamesh.workers.dev',
          substrate: 'agnostic',
          repaired: true,
          version: '2.0.0-iot-hub'
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
      if (path === '/iot' || path.startsWith('/iot/')) {
        const target = 'https://stratamesh-iot.stratamesh.workers.dev' + (path === '/iot' ? '/health' : path.slice(4) || '/health');
        try {
          const r = await fetch(target, { method: request.method, headers: request.headers, body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer() });
          return new Response(await r.arrayBuffer(), { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json', 'Access-Control-Allow-Origin': '*' } });
        } catch (e) {
          return j({ error: String(e.message || e), service: 'stratamesh-edge', proxy: 'iot' }, 502);
        }
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
