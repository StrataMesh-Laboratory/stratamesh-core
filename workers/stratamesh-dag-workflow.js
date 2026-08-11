export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const j = (d, s=200) => new Response(JSON.stringify(d), { status:s, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'} });
    if (path === '/health' || path === '/' || path === '') {
      return j({ status:'ok', service:'stratamesh-dag-workflow', role:'dag-validation-workflow', version:'1.1.0-repaired' });
    }
    if (path === '/validate' && request.method === 'POST') {
      const tx = await request.json().catch(()=>({}));
      const valid = !!(tx.hash || tx.payload);
      return j({ valid, tx_id: tx.id || crypto.randomUUID(), step: 'schema-check' });
    }
    return j({ error:'Not found', endpoints:['/health','/validate'] }, 404);
  }
};
