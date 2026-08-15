
async function serveEni(env) {
  try {
    if (env.LEDGER || env.DB) {
      const db = env.LEDGER || env.DB;
      const { results: chunks } = await db.prepare(
        "SELECT idx, value FROM site_content_chunks WHERE key = ? ORDER BY idx ASC"
      ).bind("eni").all();
      if (chunks && chunks.length) {
        const html = chunks.map((c) => c.value || "").join("");
        return new Response(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=120",
            "X-ENI-Source": "site_content_chunks",
          },
        });
      }
    }
  } catch (e) {
    console.error("eni LEDGER", e);
  }
  try {
    const r = await fetch("https://stratamesh-eni.stratamesh.workers.dev/");
    if (r.ok) return new Response(await r.text(), {
      headers: { "Content-Type": "text/html; charset=utf-8", "X-ENI-Source": "worker" },
    });
  } catch (_) {}
  return new Response(
    "<!DOCTYPE html><html lang=pt-PT><head><meta charset=UTF-8><title>AMCM ENI</title></head><body style=\"background:#0a0a0b;color:#e8e6e3;font-family:sans-serif;padding:2rem\"><h1>AMCM ENI</h1><p>Página da entidade legal temporariamente indisponível. Contacto: amcmorais@icloud.com</p><p><a href=\"https://calhegasmorais.pt/\" style=\"color:#c4b5a0\">Nó CMN</a></p></body></html>",
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

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

    if (path === '/eni' || path === '/eni/' || path === '/amcm' || path === '/amcm-eni') {
      return serveEni(env);
    }
    if (path === '/clp' || path === '/clp/' || path === '/tempo' || path === '/temporal') {
      return serveClp(request, env, corsHeaders);
    }

    if (path === '/dashboard' || path === '/dashboard/' || path.startsWith('/dashboard/')) {
      return servePortal(request, env, corsHeaders);
    }

    if (
      path === '/' || path === '' || path === '/home' || path === '/index.html' ||
      path === '/pt' || path === '/pt/' || path.startsWith('/pt/') ||
      path === '/en' || path === '/en/' || path.startsWith('/en/')
    ) {
      const u = new URL(request.url);
      if (path === '/pt' || path === '/pt/' || path.startsWith('/pt/')) u.searchParams.set('lang', 'pt');
      if (path === '/en' || path === '/en/' || path.startsWith('/en/')) u.searchParams.set('lang', 'en');
      return serveHome(new Request(u.toString(), request), env, corsHeaders);
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
  const path = url.pathname || "/";
  if (path === "/en" || path.startsWith("/en/")) return "en";
  if (path === "/pt" || path.startsWith("/pt/")) return "pt";
  const q = (url.searchParams.get("lang") || "").toLowerCase();
  if (q === "en" || q === "pt") return q;
  // Domínio público CMN: português europeu por omissão (não depender do Accept-Language do datacenter)
  return "pt";
}



async function serveClp(request, env, corsHeaders) {
  try {
    if (env.LEDGER) {
      const { results: chunks } = await env.LEDGER.prepare(
        "SELECT idx, value FROM site_content_chunks WHERE key = ? ORDER BY idx ASC"
      ).bind("clp").all();
      if (chunks && chunks.length) {
        const html = chunks.map((c) => c.value || "").join("");
        if (html) {
          return new Response(html, {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "public, max-age=60",
              "Content-Language": "pt-PT",
              "X-CLP-Source": "site_content_chunks",
            },
          });
        }
      }
    }
  } catch (e) {
    console.error("clp LEDGER", e);
  }
  return new Response(
    "<!DOCTYPE html><html lang=pt-PT><head><meta charset=UTF-8><title>CLP</title></head><body style=\"background:#050505;color:#e5e5e5;font-family:sans-serif;padding:2rem\"><h1>CLP</h1><p>Conteúdo CLP indisponível no LEDGER (key clp).</p></body></html>",
    { status: 503, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
  );
}

async function serveHome(request, env, corsHeaders) {
  const lang = pickLang(request);
  const keys = [`home-${lang}`, lang === 'en' ? 'home-pt' : 'home-en', 'home', `landing-${lang}`];
  try {
    if (env.LEDGER) {
      for (const key of keys) {
        try {
          const { results: chunks } = await env.LEDGER.prepare(
            "SELECT idx, value FROM site_content_chunks WHERE key = ? ORDER BY idx ASC"
          ).bind(key).all();
          if (chunks && chunks.length) {
            const html = chunks.map((c) => c.value || "").join("");
            if (html) {
              return new Response(html, {
                status: 200,
                headers: {
                  ...corsHeaders,
                  "Content-Type": "text/html; charset=utf-8",
                  "Cache-Control": "public, max-age=120",
                  "Content-Language": lang === "pt" ? "pt-PT" : "en-GB",
                  "X-Home-Source": "site_content_chunks",
                },
              });
            }
          }
        } catch (_) {}
        try {
          const { results } = await env.LEDGER.prepare(
            "SELECT value FROM site_content WHERE key = ? LIMIT 1"
          ).bind(key).all();
          if (results && results[0] && results[0].value) {
            return new Response(results[0].value, {
              status: 200,
              headers: {
                ...corsHeaders,
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "public, max-age=120",
                "Content-Language": lang === "pt" ? "pt-PT" : "en-GB",
                "X-Home-Source": "site_content",
              },
            });
          }
        } catch (_) {}
      }
    }
  } catch (e) {
    console.error("home LEDGER", e);
  }
  try {
    const u = "https://stratamesh-portal.stratamesh.workers.dev/home?lang=" + lang;
    const pr = await fetch(u);
    if (pr.ok) {
      const html = await pr.text();
      if (html && html.includes("<html")) {
        return new Response(html, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=120",
            "X-Home-Source": "portal-worker",
          },
        });
      }
    }
  } catch (_) {}
  return new Response(fallbackHome(lang), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Language": lang === "pt" ? "pt-PT" : "en-GB",
    },
  });
}

function fallbackHome(lang) {
  const isPt = lang === "pt";
  const title = isPt ? "Calhegas Morais · StrataMesh" : "Calhegas Morais · StrataMesh";
  const body = isPt
    ? "<h1>Calhegas Morais</h1><p>Nó Fog de referência · laboratório StrataMesh DLT.</p><p><a href=\"/dashboard\">Portal</a></p>"
    : "<h1>Calhegas Morais</h1><p>Reference Fog node · StrataMesh DLT laboratory.</p><p><a href=\"/dashboard\">Portal</a></p>";
  return `<!DOCTYPE html><html lang="${isPt ? "pt-PT" : "en-GB"}"><head><meta charset="UTF-8"><title>${title}</title>
<style>body{font-family:system-ui;background:#0a0a0b;color:#e8e6e3;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.box{max-width:28rem;padding:2rem}a{color:#c4b5a0}</style></head><body><div class="box">${body}</div></body></html>`;
}

async function servePortal(request, env, corsHeaders) {
  const lang = pickLang(request);
  const keys = [`portal-${lang}`, lang === 'en' ? 'portal-pt' : 'portal-en', 'portal'];
  // Prefer chunked site_content (economy portal), then monolithic, then portal worker, then fallback
  try {
    if (env.LEDGER) {
      for (const key of keys) {
        try {
          const { results: chunks } = await env.LEDGER.prepare(
            "SELECT idx, value FROM site_content_chunks WHERE key = ? ORDER BY idx ASC"
          ).bind(key).all();
          if (chunks && chunks.length) {
            const html = chunks.map((c) => c.value || "").join("");
            if (html) {
              return new Response(html, {
                status: 200,
                headers: {
                  ...corsHeaders,
                  "Content-Type": "text/html; charset=utf-8",
                  "Cache-Control": "no-cache",
                  "Content-Language": lang,
                  "X-Portal-Source": "site_content_chunks",
                },
              });
            }
          }
        } catch (_) {}
        const { results } = await env.LEDGER.prepare(
          "SELECT value FROM site_content WHERE key = ? LIMIT 1"
        ).bind(key).all();
        if (results && results[0] && results[0].value) {
          return new Response(results[0].value, {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-cache",
              "Content-Language": lang,
              "X-Portal-Source": "site_content",
            },
          });
        }
      }
    }
  } catch (e) {
    console.error("LEDGER error:", e);
  }
  try {
    const pr = await fetch("https://stratamesh-portal.stratamesh.workers.dev/");
    if (pr.ok) {
      const html = await pr.text();
      return new Response(html, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Portal-Source": "stratamesh-portal",
        },
      });
    }
  } catch (_) {}
  return new Response(fallbackPortal, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

function jsonResponse(data, corsHeaders, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

const fallbackPortal = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>StrataMesh</title><style>body{font-family:sans-serif;background:#0a0a1a;color:#e0e0e0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.box{background:#1a1a3e;border:1px solid #2a2a5a;border-radius:12px;padding:40px;text-align:center}h1{color:#6366f1}</style></head><body><div class="box"><h1>StrataMesh Portal</h1><p>Portal content unavailable — check D1 site_content key portal-en / portal-pt.</p></div></body></html>';
