/** Deno Deploy — TS APIs only. Not apex HTML. Not /api/auth. */
const HEAD = "v0.5.1-lab";

async function deomailKey(): Promise<string> {
  const env = Deno.env.get("DEOMAIL_API_KEY");
  if (env) return env.trim();
  try {
    const home = Deno.env.get("HOME") || "";
    return (await Deno.readTextFile(home + "/.config/stratamesh/deomail.key")).trim();
  } catch {
    return "";
  }
}

async function mailSend(req: Request): Promise<Response> {
  const key = await deomailKey();
  if (!key) return json({ ok: false, error: "no deomail.key in vault" }, 503);
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const to = body.to || body.email || body.recipient;
  const toList = Array.isArray(to) ? to : [to].filter(Boolean);
  if (!toList.length) return json({ ok: false, error: "to_required" }, 400);
  const subject = String(body.subject || body.assunto || "");
  if (!subject) return json({ ok: false, error: "subject_required" }, 400);
  const payload: Record<string, unknown> = {
    from: body.from || "noreply@eni.calhegasmorais.pt",
    to: toList,
    subject: subject.slice(0, 500),
    text: String(body.text || body.body || body.message || ""),
  };
  const r = await fetch("https://api.deomail.com/v1/emails", {
    method: "POST",
    headers: { "X-API-Key": key, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch { /* raw */ }
  return json({ ok: r.ok, status: r.status, hop: "deno:8792", deomail: parsed }, r.ok ? 200 : 502);
}


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
  if (req.method !== "GET" && !(req.method === "POST" && path.startsWith("/mail"))) {
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
  if (path === "/mail/health" || path === "/mail") {
    const key = await deomailKey();
    return json({ ok: true, hop: "deno-mail", has_key: Boolean(key), inbound: "cf-email-routing" });
  }
  if (path === "/mail/send" && req.method === "POST") return mailSend(req);
  if (path === "/mail/send" && req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);
  return json({ ok: false, error: "not found", hop: "deno" }, 404);
});
