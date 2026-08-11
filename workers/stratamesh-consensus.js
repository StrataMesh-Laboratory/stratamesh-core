export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const j = (d, s=200) => new Response(JSON.stringify(d), { status:s, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'} });
    if (path === '/health' || path === '/') return j({ status:'ok', service:'stratamesh-consensus', role:'tip-selection', version:'1.1.0' });
    if (path === '/tips') return j({ tips:[], algorithm:'lab-weighted', note:'edge consensus twin' });
    if (path === '/agree' && request.method === 'POST') {
      const body = await request.json().catch(()=>({}));
      return j({ agreed: true, hash: body.hash, weight: body.weight || 1 });
    }
    return j({ error:'Not found', endpoints:['/health','/tips','/agree'] }, 404);
  }
};
