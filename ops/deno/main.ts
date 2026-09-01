/** Local Deno :8792 — TS APIs only. Not apex HTML. Not /api/auth.
 * Deno Deploy SaaS is SIGNUP_UNAVAILABLE; this process is the workaround.
 */
import { composeManifest, OBJECT_KINDS, contentCid } from "./object.ts";
import { resolveHop } from "./fallback.ts";

const HEAD = "v0.5.2-lab-four-layer";

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
    "access-control-allow-methods": "GET,POST,OPTIONS",
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

Deno.serve({ hostname: "0.0.0.0", port: 8792 }, async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  const objectPost = req.method === "POST" && path.startsWith("/object");
  if (req.method !== "GET" && !(req.method === "POST" && (path.startsWith("/mail") || objectPost))) {
    return json({ ok: false, error: "method", hint: "auth is python:8790" }, 405);
  }
  if (path === "/" || path === "/health") {
    return json({
      ok: true,
      runtime: "deno-local",
      role: "ts-api",
      head: HEAD,
      auth: "python:8790",
      deploy: "SIGNUP_UNAVAILABLE",
      listen: ":8792",
    });
  }
  if (path === "/resolve") {
    return json({ ok: true, ...(await resolveHop()), deploy: "SIGNUP_UNAVAILABLE" });
  }
  if (path === "/object/kinds") {
    return json({ ok: true, kinds: OBJECT_KINDS });
  }
  if (path === "/object/cid") {
    const cid = url.searchParams.get("cid") || "";
    if (!cid) return json({ ok: false, error: "cid required" }, 400);
    return json({ ok: true, cid, layer: "content_identity", not: ["owner", "price", "world", "nft", "sca"] });
  }
  if (path === "/object/compose" && req.method === "POST") {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const parts = (body.parts || body.components || {}) as Record<string, unknown>;
    if (!parts || typeof parts !== "object" || !Object.keys(parts).length) {
      return json({ ok: false, error: "parts required" }, 400);
    }
    const composed = await composeManifest(parts, {
      name: String(body.name || body.kind || "ugc"),
      kind: String(body.kind || "ugc"),
      creator: String(body.creator || body.owner || "atelier"),
      world_id: body.world_id ? String(body.world_id) : null,
    });
    return json({
      ok: true,
      hop: "deno:8792",
      mode: "four_layer_compose_local",
      object: {
        layers: {
          cid: { manifest_cid: composed.manifest_cid, parts: composed.parts },
          dag: { vertex: null, note: "DAG submit stays on token worker / Fog when quota allows" },
          nft: { id: null, note: "CID is not the NFT; mint on stratamesh-token" },
          strata: { collateral_strata: 0 },
        },
        manifest: composed.manifest,
      },
    });
  }
  if (path === "/object/hash") {
    const q = url.searchParams.get("q") || "";
    return json({ ok: true, cid: await contentCid(q) });
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
