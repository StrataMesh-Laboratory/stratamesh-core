
async function loadSiteHtml(env, keys) {
  for (const key of keys) {
    try {
      const { results: chunks } = await env.SITE.prepare(
        "SELECT idx, value FROM site_content_chunks WHERE key = ? ORDER BY idx ASC"
      ).bind(key).all();
      if (chunks && chunks.length) {
        const html = chunks.map((c) => c.value || "").join("");
        if (html) return html;
      }
    } catch (_) {}
    try {
      const row = await env.SITE.prepare("SELECT value FROM site_content WHERE key = ?").bind(key).first();
      if (row && row.value) return row.value;
    } catch (_) {}
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    // Explicit language landings (path-based)
    if (path === '/pt' || path === '/pt/') {
      try {
        const html = (await loadSiteHtml(env, ['landing-pt', 'home-pt', 'landing'])) || '<h1>PT landing missing in D1</h1>';
        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'Content-Language': 'pt-PT' } });
      } catch (e) {
        return new Response('<h1>PT error</h1><pre>' + String(e.message || e) + '</pre>', { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    }
    if (path === '/en' || path === '/en/') {
      try {
        const html = (await loadSiteHtml(env, ['landing-en', 'home-en', 'landing'])) || '<h1>EN landing missing in D1</h1>';
        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'Content-Language': 'en-GB' } });
      } catch (e) {
        return new Response('<h1>EN error</h1><pre>' + String(e.message || e) + '</pre>', { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    }

    // CLP temporal kernel (also routed via stratamesh-spa; fallback here for apex /*)
    if (path === '/clp' || path === '/clp/' || path === '/tempo' || path === '/tempo/' || path === '/temporal' || path === '/temporal/') {
      try {
        const html = await loadSiteHtml(env, ['clp']);
        if (html) {
          return new Response(html, {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=60',
              'Content-Language': 'pt-PT',
              'X-CLP-Source': 'stratamesh-ui',
            },
          });
        }
        return new Response('<h1>CLP em falta no D1 (key clp)</h1>', {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      } catch (e) {
        return new Response('<h1>CLP error</h1><pre>' + String(e.message || e) + '</pre>', {
          status: 500,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
    }

    const country = request.headers.get('cf-ipcountry') || 'PT';

    const cplp = ['PT','BR','AO','MZ','CV','GW','ST','TL','GQ','MO'];
    const defaultLang = cplp.includes(country) ? 'pt' : 'en';
    const langParam = url.searchParams.get('lang');
    let lang = langParam || defaultLang;
    // Path-based language: /pt and /en
    if (path === '/pt' || path === '/pt/' || path.startsWith('/pt/')) {
      lang = 'pt';
    } else if (path === '/en' || path === '/en/') {
      lang = 'en';
    }

    // Password recovery proxy
    if (path.startsWith('/api/auth-recovery') || path.startsWith('/api/recovery')) {
      if (!env.RECOVERY) {
        return new Response(JSON.stringify({ success: false, error: 'RECOVERY binding missing' }), {
          status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      const subPath = path.replace(/^\/api\/(auth-recovery|recovery)/, '') || '/';
      const targetUrl = new URL(request.url);
      targetUrl.pathname = subPath.startsWith('/') ? subPath : '/' + subPath;
      const recReq = new Request(targetUrl.toString(), {
        method,
        headers: request.headers,
        body: method !== 'GET' && method !== 'HEAD' ? request.body : undefined,
        redirect: 'manual'
      });
      const recResponse = await env.RECOVERY.fetch(recReq);
      const headers = new Headers(recResponse.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(recResponse.body, { status: recResponse.status, headers });
    }

    // Transparent auth proxy (no debug wrapper)
    if (path.startsWith('/api/auth')) {
      if (!env.AUTH) {
        return new Response(JSON.stringify({ success: false, error: 'AUTH binding missing' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const subPath = path.slice('/api/auth'.length) || '/';
      const targetUrl = new URL(request.url);
      targetUrl.pathname = subPath.startsWith('/') ? subPath : '/' + subPath;
      const authReq = new Request(targetUrl.toString(), {
        method,
        headers: request.headers,
        body: method !== 'GET' && method !== 'HEAD' ? request.body : undefined,
        redirect: 'manual'
      });
      const authResponse = await env.AUTH.fetch(authReq);
      // Pass through status and body; ensure JSON content-type when appropriate
      const headers = new Headers(authResponse.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(authResponse.body, { status: authResponse.status, headers });
    }

    // Static pages from D1
    const keyMap = {
      '/': 'landing',
      '/pt': 'landing',
      '/pt/': 'landing',
      '/en': 'landing',
      '/en/': 'landing',
      '/request_access': 'request_access',
      '/request-access': 'request_access',
      '/accesspoint': 'accesspoint',
      '/access-point': 'accesspoint',
      '/access': 'accesspoint',
      '/portal': 'portal',
      '/recover': 'recover',
      '/recovery': 'recover'
    };
    const pageKey = keyMap[path] || keyMap[path.replace(/\/$/, '')];
    if (pageKey) {
      const fullKey = pageKey + '-' + lang;
      const fallbackKey = pageKey + '-' + (lang === 'en' ? 'pt' : 'en');
      try {
        const content = (await loadSiteHtml(env, [fullKey, fallbackKey, pageKey, pageKey === 'landing' ? 'home' : pageKey])) || '<h1>Not Found</h1>';
        return new Response(content, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache'
          }
        });
      } catch (e) {
        return new Response('<h1>Site content error</h1><pre>' + String(e.message || e) + '</pre>', {
          status: 500,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    }

    // Dashboard route helper
    if (path === '/dashboard' || path.startsWith('/dashboard/')) {
      return Response.redirect(url.origin + '/dashboard', 302);
    }

    return new Response('Not Found', { status: 404 });
  }
};
