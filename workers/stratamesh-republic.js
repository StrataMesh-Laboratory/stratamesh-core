export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const j = (d, s=200) => new Response(JSON.stringify(d), { status:s, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'} });
    if (path === '/health' || path === '/') return j({ status:'ok', service:'stratamesh-republic', role:'agent-citizenship', version:'1.1.0' });
    if (path === '/citizens') return j({ citizens:[], note:'ACB standing by function and agreement' });
    return j({ error:'Not found', endpoints:['/health','/citizens'] }, 404);
  }
};
