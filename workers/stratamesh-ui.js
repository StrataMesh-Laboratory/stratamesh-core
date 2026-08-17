/**
 * stratamesh-ui — legacy catch-all; proxies to stratamesh-spa (canonical).
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (env.SPA && typeof env.SPA.fetch === "function") {
      return env.SPA.fetch(request);
    }
    // Fallback: same-account workers.dev
    const target = new URL(url.pathname + url.search, "https://stratamesh-spa.stratamesh.workers.dev");
    try {
      const init = { method: request.method, headers: request.headers };
      if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = await request.arrayBuffer();
      }
      return fetch(new Request(target, init));
    } catch (e) {
      return new Response("SPA unavailable: " + String(e), { status: 502 });
    }
  },
};
