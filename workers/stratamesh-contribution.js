export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const j = (d, s=200) => new Response(JSON.stringify(d), { status:s, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'} });
    if (path === '/health' || path === '/') return j({ status:'ok', service:'stratamesh-contribution', version:'1.1.0' });
    if (path === '/types') return j({ types:['compute','storage','validation','relay','analysis'] });
    if (path === '/submit' && request.method === 'POST') {
      const body = await request.json().catch(()=>({}));
      return j({ accepted:true, contribution_id: crypto.randomUUID(), type: body.type || 'compute' });
    }
    return j({ error:'Not found', endpoints:['/health','/types','/submit'] }, 404);
  }
};
