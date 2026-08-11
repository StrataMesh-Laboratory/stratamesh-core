export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const j = (d, s=200) => new Response(JSON.stringify(d), { status:s, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'} });
    if (path === '/health' || path === '/') return j({ status:'ok', service:'stratamesh-gate', role:'policy-gate', version:'1.1.0' });
    if (path === '/admit' && request.method === 'POST') {
      const body = await request.json().catch(()=>({}));
      return j({ admitted: true, subject: body.subject || 'anonymous', policy: 'lab-open' });
    }
    return j({ error:'Not found', endpoints:['/health','/admit'] }, 404);
  }
};
