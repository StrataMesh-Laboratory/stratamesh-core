export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
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
        const row = await env.SITE.prepare('SELECT value FROM site_content WHERE key = ?').bind(fullKey).first();
        const fallback = !row ? await env.SITE.prepare('SELECT value FROM site_content WHERE key = ?').bind(fallbackKey).first() : null;
        const bare = !row && !fallback ? await env.SITE.prepare('SELECT value FROM site_content WHERE key = ?').bind(pageKey).first() : null;
        const content = row?.value || fallback?.value || bare?.value || '<h1>Not Found</h1>';
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
