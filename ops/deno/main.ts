/** Deno Deploy — TS APIs only. Not apex HTML. Not /api/auth. */
const HEAD = "v0.5.0-lab";

function cors(extra: Record<string, string> = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
    "cache-control": "no-store",
    ...extra,
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: cors({ "content-type": "application/json" }),
  });
}

Deno.serve({ hostname: "0.0.0.0", port: 8792 }, (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  if (req.method !== "GET") {
    return json({ ok: false, error: "method", hint: "auth is python:8790" }, 405);
  }
  if (path === "/" || path === "/health") {
    return json({ ok: true, runtime: "deno-deploy", role: "ts-api", head: HEAD, auth: "python:8790" });
  }
  if (path === "/status" || path === "/api/status") {
    return json({
      ok: true,
      hop: "deno",
      head: HEAD,
      pages: "calhegasmorais.pt",
      auth: "mw.calhegasmorais.pt",
    });
  }
  if (path === "/api/mesh" || path === "/mesh") {
    return json({ ok: true, n: 2, f_max: 0, oracle_live: false, head: HEAD });
  }
  return json({ ok: false, error: "not found", hop: "deno" }, 404);
});
