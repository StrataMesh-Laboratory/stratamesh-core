export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (path === '/health' || path === '/dashboard/health') {
      return jsonResponse({
        status: 'ok',
        worker: 'stratamesh-spa',
        timestamp: new Date().toISOString()
      }, corsHeaders);
    }

    // API proxy — never use non-existent api.calhegasmorais.pt
    if (path.startsWith('/api/')) {
      return proxyApi(request, env, path, url, corsHeaders);
    }

    if (path === '/dashboard/aiops' || path === '/dashboard/aiops/') {
      return Response.redirect(url.origin + '/dashboard', 301);
    }

    if (path === '/dashboard' || path === '/dashboard/' || path.startsWith('/dashboard/')) {
      return servePortal(env, corsHeaders);
    }

    if (path === '/' || path === '') {
      return Response.redirect(url.origin + '/dashboard', 302);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};

async function proxyApi(request, env, path, url, corsHeaders) {
  try {
    let target;
    // Prefer service bindings when available; fall back to same-account workers.dev
    if (path.startsWith('/api/auth')) {
      const stripped = path.slice('/api/auth'.length) || '/';
      if (env.AUTH) {
        const authUrl = new URL(request.url);
        authUrl.pathname = stripped;
        const authReq = new Request(authUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
          redirect: 'manual'
        });
        const resp = await env.AUTH.fetch(authReq);
        return withCors(resp, corsHeaders);
      }
      target = 'https://stratamesh-auth.stratamesh.workers.dev' + stripped + url.search;
    } else if (path.startsWith('/api/v1')) {
      if (env.GATEWAY) {
        const gUrl = new URL(request.url);
        const gReq = new Request(gUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
          redirect: 'manual'
        });
        const resp = await env.GATEWAY.fetch(gReq);
        return withCors(resp, corsHeaders);
      }
      target = 'https://stratamesh-dag-gateway.stratamesh.workers.dev' + path + url.search;
    } else if (path.startsWith('/api/aiops')) {
      target = 'https://stratamesh-aiops.stratamesh.workers.dev' + path.replace(/^\/api\/aiops/, '') + url.search;
    } else if (path.startsWith('/api/ipfs')) {
      target = 'https://stratamesh-ipfs.stratamesh.workers.dev' + path.replace(/^\/api\/ipfs/, '') + url.search;
    } else if (path.startsWith('/api/pq')) {
      target = 'https://stratamesh-pq-keys.stratamesh.workers.dev' + path.replace(/^\/api\/pq/, '') + url.search;
    } else {
      return jsonResponse({ error: 'Unknown API prefix', path }, corsHeaders, 404);
    }

    const apiResponse = await fetch(new Request(target, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'manual'
    }));
    return withCors(apiResponse, corsHeaders);
  } catch (e) {
    return jsonResponse({ error: 'API unavailable', details: String(e.message || e) }, corsHeaders, 503);
  }
}

function withCors(resp, corsHeaders) {
  const newHeaders = new Headers(resp.headers);
  Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
  return new Response(resp.body, { status: resp.status, headers: newHeaders });
}

async function servePortal(env, corsHeaders) {
  try {
    if (env.LEDGER) {
      const { results } = await env.LEDGER.prepare("SELECT value FROM site_content WHERE key = 'portal-en' LIMIT 1").all();
      if (results && results[0]) {
        return new Response(results[0].value, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }
        });
      }
    }
  } catch (e) {
    console.error('LEDGER error:', e);
  }
  return new Response(fallbackPortal, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
  });
}

function jsonResponse(data, corsHeaders, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

const fallbackPortal = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>StrataMesh</title><style>body{font-family:sans-serif;background:#0a0a1a;color:#e0e0e0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.box{background:#1a1a3e;border:1px solid #2a2a5a;border-radius:12px;padding:40px;text-align:center}h1{color:#6366f1}</style></head><body><div class="box"><h1>StrataMesh Portal</h1><p>Portal content unavailable — check D1 site_content key portal-en.</p></div></body></html>';
