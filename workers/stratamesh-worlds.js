export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const j = (d, s=200) => new Response(JSON.stringify(d), { status:s, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'} });
    if (path === '/health' || path === '/') return j({ status:'ok', service:'stratamesh-worlds', role:'experience-namespaces', version:'1.1.0' });
    if (path === '/list') return j({ worlds:[{ id:'cmn-lab', title:'Calhegas Morais Lab' }] });
    return j({ error:'Not found', endpoints:['/health','/list'] }, 404);
  }
};
