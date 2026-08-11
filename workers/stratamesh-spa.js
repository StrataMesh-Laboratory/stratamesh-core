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

    // Orchestrator — always proxy to known workers.dev (service binding optional)
    if (path === '/orchestrator' || path === '/orchestrator/' || path.startsWith('/orchestrator/')) {
      const sub = path.replace(/^\/orchestrator/, '') || '/health';
      let targetPath = sub.startsWith('/') ? sub : '/' + sub;
      if (targetPath === '/' || targetPath === '') targetPath = '/health';
      try {
        let resp = null;
        if (env.ORCH) {
          try {
            const oReq = new Request('https://orchestrator.internal' + targetPath, {
              method: 'GET',
              headers: { 'Accept': 'application/json' }
            });
            resp = await env.ORCH.fetch(oReq);
            if (resp.status === 404) resp = null;
          } catch (_) { resp = null; }
        }
        if (!resp) {
          const upstream = 'https://stratamesh-orchestrator.stratamesh.workers.dev' + targetPath;
          resp = await fetch(upstream, { method: 'GET', headers: { 'Accept': 'application/json' } });
        }
        return withCors(resp, corsHeaders);
      } catch (e) {
        return jsonResponse({ status: 'error', error: String(e.message || e), worker: 'stratamesh-orchestrator' }, corsHeaders, 503);
      }
    }

    if (path.startsWith('/api/')) {
      return proxyApi(request, env, path, url, corsHeaders);
    }

    if (path === '/dashboard/aiops' || path === '/dashboard/aiops/') {
      return Response.redirect(url.origin + '/dashboard', 301);
    }

    if (path === '/dashboard' || path === '/dashboard/' || path.startsWith('/dashboard/')) {
      return servePortal(request, env, corsHeaders);
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
    // Mesh economy — dashboard expects /api/v1/{agora,dao,acb,token,poc}/...
    const meshMap = [
      ['/api/v1/agora', 'AGORA', 'https://stratamesh-agora.stratamesh.workers.dev', '/agora'],
      ['/api/v1/dao', 'DAO', 'https://stratamesh-dao.stratamesh.workers.dev', '/dao'],
      ['/api/v1/acb', 'ACB', 'https://stratamesh-acb.stratamesh.workers.dev', '/acb'],
      ['/api/v1/token', 'TOKEN', 'https://stratamesh-token.stratamesh.workers.dev', ''],
      ['/api/v1/nft', 'TOKEN', 'https://stratamesh-token.stratamesh.workers.dev', ''],
      ['/api/v1/poc', 'POC', 'https://stratamesh-poc.stratamesh.workers.dev', ''],
      ['/api/v1/scout', 'SCOUT', 'https://stratamesh-scout.stratamesh.workers.dev', ''],
      ['/api/v1/sandbox', 'SANDBOX', 'https://stratamesh-sandbox.stratamesh.workers.dev', ''],
      ['/api/v1/worlds', 'WORLDS', 'https://stratamesh-worlds.stratamesh.workers.dev', ''],
      ['/api/v1/realms', 'REALMS', 'https://stratamesh-realms.stratamesh.workers.dev', ''],
    ];
    for (const [prefix, bindName, base, pathPrefix] of meshMap) {
      if (path === prefix || path.startsWith(prefix + '/')) {
        const rest = path.slice(prefix.length) || '';
        const upstreamPath = (pathPrefix + rest) || '/';
        const binding = env[bindName];
        if (binding && typeof binding.fetch === 'function') {
          const u = new URL(request.url);
          u.pathname = upstreamPath;
          const resp = await binding.fetch(new Request(u.toString(), {
            method: request.method,
            headers: request.headers,
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
            redirect: 'manual'
          }));
          return withCors(resp, corsHeaders);
        }
        target = base + upstreamPath + url.search;
        const apiResponse = await fetch(new Request(target, {
          method: request.method,
          headers: request.headers,
          body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
          redirect: 'manual'
        }));
        return withCors(apiResponse, corsHeaders);
      }
    }
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
    } else if (path.startsWith('/api/auth-recovery') || path.startsWith('/api/recovery')) {
      const stripped = path.replace(/^\/api\/(auth-recovery|recovery)/, '') || '/';
      if (env.RECOVERY) {
        const rUrl = new URL(request.url);
        rUrl.pathname = stripped;
        const rReq = new Request(rUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
          redirect: 'manual'
        });
        const resp = await env.RECOVERY.fetch(rReq);
        return withCors(resp, corsHeaders);
      }
      target = 'https://stratamesh-auth-recovery.stratamesh.workers.dev' + stripped + url.search;
    } else if (path.startsWith('/api/v1')) {
      if (env.GATEWAY) {
        const gReq = new Request(request.url, {
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
      let stripped = path.replace(/^\/api\/aiops/, '') || '/';
      if (stripped === '/health' || stripped === '') stripped = '/health';
      target = 'https://stratamesh-aiops.stratamesh.workers.dev' + stripped + url.search;
    } else if (path.startsWith('/api/ipfs')) {
      const stripped = path.replace(/^\/api\/ipfs/, '') || '/';
      target = 'https://stratamesh-ipfs-pinner.stratamesh.workers.dev' + stripped + url.search;
    } else if (path.startsWith('/api/pq')) {
      // pq worker documents GET /pq/status and POST /pq/generate
      let stripped = path.replace(/^\/api\/pq/, '') || '/';
      if (stripped === '/health' || stripped === '/') stripped = '/pq/status';
      if (!stripped.startsWith('/pq')) stripped = '/pq' + (stripped.startsWith('/') ? stripped : '/' + stripped);
      target = 'https://stratamesh-pq-keys.stratamesh.workers.dev' + stripped + url.search;
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

function pickLang(request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('lang');
  if (q === 'pt' || q === 'en') return q;
  const country = request.headers.get('cf-ipcountry') || '';
  const cplp = ['PT','BR','AO','MZ','CV','GW','ST','TL','GQ','MO'];
  if (cplp.includes(country)) return 'pt';
  const al = (request.headers.get('Accept-Language') || '').toLowerCase();
  if (al.startsWith('pt')) return 'pt';
  return 'en';
}

async function servePortal(request, env, corsHeaders) {
  const lang = pickLang(request);
  const keys = [`portal-${lang}`, lang === 'en' ? 'portal-pt' : 'portal-en', 'portal'];
  try {
    if (env.LEDGER) {
      for (const key of keys) {
        const { results } = await env.LEDGER.prepare(
          "SELECT value FROM site_content WHERE key = ? LIMIT 1"
        ).bind(key).all();
        if (results && results[0] && results[0].value) {
          return new Response(results[0].value, {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-cache',
              'Content-Language': lang
            }
          });
        }
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

const fallbackPortal = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>StrataMesh</title><style>body{font-family:sans-serif;background:#0a0a1a;color:#e0e0e0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.box{background:#1a1a3e;border:1px solid #2a2a5a;border-radius:12px;padding:40px;text-align:center}h1{color:#6366f1}</style></head><body><div class="box"><h1>StrataMesh Portal</h1><p>Portal content unavailable — check D1 site_content key portal-en / portal-pt.</p></div></body></html>';
