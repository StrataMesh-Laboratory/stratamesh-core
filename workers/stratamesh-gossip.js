export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const j = (d, s=200) => new Response(JSON.stringify(d), { status:s, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'} });
    if (path === '/health' || path === '/') return j({ status:'ok', service:'stratamesh-gossip', role:'tip-dissemination', version:'1.1.0' });
    if (path === '/peers') return j({ peers:[{ id:'scout', ok:true },{ id:'node-2', ok:true },{ id:'node-3', ok:true }] });
    if (path === '/broadcast' && request.method === 'POST') {
      const body = await request.json().catch(()=>({}));
      return j({ broadcast:true, tip: body.tip || body.hash, at: new Date().toISOString() });
    }
    return j({ error:'Not found', endpoints:['/health','/peers','/broadcast'] }, 404);
  }
};
