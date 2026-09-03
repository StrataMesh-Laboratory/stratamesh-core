/** Local Deno :8792 — TS APIs only. Not apex HTML. Not /api/auth.
 * Deno Deploy SaaS is SIGNUP_UNAVAILABLE; this process is the workaround.
 */
import { composeManifest, OBJECT_KINDS, contentCid } from "./object.ts";
import { resolveHop } from "./fallback.ts";

const HEAD = "v0.5.2-lab-object-ledger";

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


const FOG_MW = (Deno.env.get("FOG_MW") || "http://127.0.0.1:8790").replace(/\/+$/, "");
const OBJECT_STORE = (Deno.env.get("HOME") || "") + "/.config/stratamesh/objects.jsonl";
const DEFAULT_CREATOR = "FOG-NODE-PT-CM-001";

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function localObjectId(manifestCid: string, owner: string): Promise<string> {
  const hex = await sha256Hex(manifestCid + "|" + owner);
  return "obj_" + hex.slice(0, 16);
}

async function appendObjectStore(rec: Record<string, unknown>): Promise<void> {
  try {
    const dir = OBJECT_STORE.replace(/\/[^/]+$/, "");
    await Deno.mkdir(dir, { recursive: true });
    await Deno.writeTextFile(OBJECT_STORE, JSON.stringify(rec) + "\n", { append: true });
  } catch {
    /* fail-open */
  }
}

async function loadObjectStore(): Promise<Record<string, unknown>[]> {
  try {
    const text = await Deno.readTextFile(OBJECT_STORE);
    const rows: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const rec = JSON.parse(line) as Record<string, unknown>;
        const id = String(rec.object_id || "");
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        rows.push(rec);
      } catch { /* skip */ }
    }
    return rows;
  } catch {
    return [];
  }
}

async function registerFog(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(FOG_MW + "/object/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(1500),
    });
    const data = await r.json() as Record<string, unknown>;
    if (data && data.ok) return data;
    return null;
  } catch {
    return null;
  }
}

async function fetchFog(path: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(FOG_MW + path, { signal: AbortSignal.timeout(1200) });
    const data = await r.json() as Record<string, unknown>;
    if (data && data.ok) return data;
    return null;
  } catch {
    return null;
  }
}

async function prefixMw(req: Request, path: string, hops: string[]): Promise<Response | null> {
  if (req.headers.get("x-fog-chain")) return null;
  if (path === "/" || path === "/health") return null;
  for (const hop of hops) {
    try {
      const r = await fetch(hop + path, { method: req.method, headers: { "x-fog-chain": "1" }, signal: AbortSignal.timeout(1200) });
      if (r.status < 500) return r;
    } catch { /* next */ }
  }
  return null;
}

Deno.serve({ hostname: "0.0.0.0", port: 8792 }, async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  const objectPost = req.method === "POST" && path.startsWith("/object");
  const orchPath = path.startsWith("/api/orchestrator") || path === "/orchestrator/chat" || path.startsWith("/api/v1/orchestrator");
  const authPath = path.startsWith("/api/auth") || path.startsWith("/api/wb");
  if (req.method !== "GET" && !(req.method === "POST" && (path.startsWith("/mail") || objectPost || orchPath || authPath))) {
    return json({ ok: false, error: "method", hint: "auth complementary: py then node then deno" }, 405);
  }
  if (authPath) {
    const pre = await prefixMw(req, path, ["http://127.0.0.1:8790", "http://127.0.0.1:8791"]);
    if (pre) return pre;
    return json({
      ok: true,
      hop: "deno:8792",
      role: "auth-fallback",
      stasis_503: false,
      metabol_pace: { hop: "deno", cf_daily: false, decision: "ALLOW", reason: "local deno — no CF daily clock" },
      note: "complementary after python:8790 then node:8791; CF auth only if ALLOW",
    });
  }
  if (orchPath) {
    let body: Record<string, unknown> = {};
    if (req.method === "POST") body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const headline = String(body.headline || body.message || body.text || "").slice(0, 160);
    let origin: Record<string, unknown> = { forwarded: false };
    if (req.method === "POST") {
      try {
        const r = await fetch("https://calhegasmorais.pt/api/orchestrator/chat", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json", "user-agent": "fog-mw-deno/orch" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(4000),
        });
        const text = await r.text();
        let obj: Record<string, unknown> = {};
        try { obj = JSON.parse(text); } catch { /* raw */ }
        origin = { forwarded: true, http: r.status, version: obj.version || null, ok: r.ok };
      } catch (e) {
        origin = { forwarded: false, fail_open: true, error: String(e).slice(0, 80) };
      }
    }
    return json({
      ok: true,
      hop: "deno:8792",
      role: "orchestrator-chat",
      accepted: true,
      dest: "AIOps Dev Team via Orchestrator",
      headline,
      origin,
      methods: ["GET", "POST", "OPTIONS"],
      version: "fog-mw-orch-chat-1",
      service: "stratamesh-orchestrator",
      status: "ok",
    });
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
    const owner = String(body.owner || body.creator || DEFAULT_CREATOR);
    let creator = String(body.creator || body.owner || DEFAULT_CREATOR);
    if (creator.toLowerCase() === "atelier") creator = owner || DEFAULT_CREATOR;
    const composed = await composeManifest(parts, {
      name: String(body.name || body.kind || "ugc"),
      kind: String(body.kind || "ugc"),
      creator,
      world_id: body.world_id ? String(body.world_id) : null,
    });
    const fog = await registerFog({
      owner,
      creator,
      name: body.name || body.kind || "ugc",
      kind: body.kind || "ugc",
      renderer: body.renderer ?? null,
      parts,
      manifest_cid: composed.manifest_cid,
      manifest: composed.manifest,
    });
    const objectId = fog && fog.object_id
      ? String(fog.object_id)
      : await localObjectId(composed.manifest_cid, owner);
    const dagTx = fog && fog.dag_tx ? fog.dag_tx : null;
    const rec = {
      object_id: objectId,
      manifest_cid: composed.manifest_cid,
      owner,
      creator,
      kind: String(body.kind || "ugc"),
      renderer: body.renderer ?? null,
      dag_tx: dagTx,
      parts: composed.parts,
      at: Date.now(),
    };
    await appendObjectStore(rec);
    return json({
      ok: true,
      hop: "deno:8792",
      mode: fog ? "four_layer_compose_fog" : "four_layer_compose_local",
      fog: fog ? "python:8790" : "down",
      object_id: objectId,
      manifest_cid: composed.manifest_cid,
      dag_tx: dagTx,
      object: {
        layers: {
          cid: { manifest_cid: composed.manifest_cid, parts: composed.parts },
          dag: { vertex: dagTx, note: "Fog ledger DAG vertex when python:8790 is up" },
          nft: { id: objectId, note: "object_id is network identity; never the CID" },
          strata: { collateral_strata: 0, reserved: true, oracle_live: false },
        },
        manifest: composed.manifest,
      },
    });
  }
  if (path === "/object/list" && req.method === "GET") {
    const fog = await fetchFog("/object/list");
    const local = await loadObjectStore();
    const objects = (fog && Array.isArray(fog.objects) ? fog.objects : local) as unknown[];
    return json({ ok: true, hop: "deno:8792", fog: fog ? "python:8790" : "down", n: objects.length, objects });
  }
  if (path.startsWith("/object/") && req.method === "GET" && path !== "/object/kinds" && path !== "/object/cid" && path !== "/object/hash" && path !== "/object/list") {
    const id = path.slice("/object/".length);
    const fog = await fetchFog("/object/" + encodeURIComponent(id));
    if (fog) return json({ ...fog, hop: fog.hop || "python:8790" });
    const local = (await loadObjectStore()).find((r) => String(r.object_id) === id);
    if (!local) return json({ ok: false, error: "not found", object_id: id, hop: "deno:8792" }, 404);
    return json({ ok: true, hop: "deno:8792", fog: "down", ...local });
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
    return json({
      ok: true, n: 2, f_max: 0, oracle_live: false, head: HEAD, hop: "deno:8792",
      mesh: {
        fog: 8787,
        ipc: { workerd: 8788, python: 8790, node: 8791, deno: 8792 },
        routes: {
          auth_wb_session: ["python:8790", "node:8791", "deno:8792", "cf-auth:ALLOW", "frontend/maintenance-1xxx.html"],
          compose_assemble_desk: ["node:8791", "python:8790", "deno:8792", "cf-pages:ALLOW", "frontend/maintenance-1xxx.html"],
          object_cid_mail: ["deno:8792", "python:8790", "node:8791", "cf-deomail:ALLOW", "frontend/maintenance-1xxx.html"],
          html_atelier: ["node:8791/atelier", "python:8790", "workerd:8788", "cf-pages:ALLOW", "frontend/maintenance-1xxx.html"],
          html: ["pages", "node:8791/atelier", "python:8790", "workerd:8788", "frontend/maintenance-1xxx.html"],
          metabol_origin: ["workerd:8788", "python:8790", "node:8791", "cf-metabol:ALLOW", "frontend/maintenance-1xxx.html"],
        },
      },
      metabol_pace: { hop: "deno", cf_daily: false, decision: "ALLOW" },
    });
  }
  if (path === "/mail/health" || path === "/mail") {
    const key = await deomailKey();
    return json({ ok: true, hop: "deno-mail", has_key: Boolean(key), inbound: "cf-email-routing" });
  }
  if (path === "/mail/send" && req.method === "POST") return mailSend(req);
  if (path === "/mail/send" && req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);
  if (path.startsWith("/assemble") || path.startsWith("/atelier") || path.startsWith("/dashboard")) {
    const pre = await prefixMw(req, path, ["http://127.0.0.1:8791", "http://127.0.0.1:8790"]);
    if (pre) return pre;
  }
  if (path.startsWith("/metabol")) {
    const pre = await prefixMw(req, path, ["http://127.0.0.1:8788", "http://127.0.0.1:8790", "http://127.0.0.1:8791"]);
    if (pre) return pre;
  }
  return json({ ok: false, error: "not found", hop: "deno" }, 404);
});
