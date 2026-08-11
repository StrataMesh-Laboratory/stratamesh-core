export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const j = (d, s=200) => new Response(JSON.stringify(d), { status:s, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'} });
    if (path === '/health' || path === '/' || path === '') {
      return j({ status:'ok', service:'stratamesh-registry', version:'1.1.0-repaired', repaired:true });
    }
    return j({ error:'Not found', service:'stratamesh-registry' }, 404);
  }
};
