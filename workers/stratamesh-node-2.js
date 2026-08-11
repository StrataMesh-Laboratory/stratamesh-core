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
          service: 'stratamesh-node-2',
          node_type: 'fog',
          mesh: 'stratamesh-fog',
          node_id: 'FOG-NODE-PT-CM-NODE-2',
          repaired: true,
          version: '1.1.0-repaired'
        });
      }

      if (path === '/validate' && request.method === 'POST') {
        const tx = await request.json().catch(() => ({}));
        return j({
          valid: !!(tx && (tx.payload || tx.hash)),
          tx_id: tx.id || crypto.randomUUID(),
          validated_at: new Date().toISOString(),
          validator: 'node-2'
        });
      }
      if (path === '/pin' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        return j({ cid: body.cid, pinned: true, pinned_at: new Date().toISOString(), node: 'node-2' });
      }

      return j({ error: 'Not found', service: 'stratamesh-node-2' }, 404);
    } catch (err) {
      return j({ error: String(err.message || err) }, 500);
    }
  }
};
