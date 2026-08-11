export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const j = (d, s = 200) => new Response(JSON.stringify(d), {
      status: s,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
    if (path === '/health' || path === '/') {
      return j({
        status: 'ok',
        service: 'stratamesh-chat',
        note: 'Legacy chat — use orchestrator /chat',
        redirect: 'https://stratamesh-orchestrator.stratamesh.workers.dev/chat',
        version: '1.2.0-redirect'
      });
    }
    // Proxy POST to orchestrator chat when possible
    if ((path === '/send' || path === '/chat') && request.method === 'POST') {
      const target = env.ORCH
        ? null
        : 'https://stratamesh-orchestrator.stratamesh.workers.dev/chat';
      try {
        if (env.ORCH && typeof env.ORCH.fetch === 'function') {
          const u = new URL(request.url);
          u.pathname = '/chat';
          const resp = await env.ORCH.fetch(new Request(u.toString(), {
            method: 'POST',
            headers: request.headers,
            body: request.body
          }));
          return resp;
        }
        const body = await request.text();
        const resp = await fetch(target, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body
        });
        return new Response(resp.body, {
          status: resp.status,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return j({ error: String(e.message || e), hint: 'use orchestrator /chat' }, 502);
      }
    }
    return Response.redirect('https://stratamesh-orchestrator.stratamesh.workers.dev/chat', 302);
  }
};
