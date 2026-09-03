#!/usr/bin/env node
/**
 * Node mw :8791 — compose hop JSON in parallel.
 * Not cap (Python). Not metabol math (workerd). Not public origin.
 */
import http from "node:http";

const PORT = parseInt(process.env.FOG_MW_NODE_PORT || "8791", 10);
const WORKERD = process.env.WORKERD_HEALTH || "http://127.0.0.1:8788";
const PY = process.env.FOG_MW_PY || "http://127.0.0.1:8790";
const DENO = process.env.FOG_MW_DENO || "http://127.0.0.1:8792";
const FOG = process.env.FOG_HEALTH || "http://127.0.0.1:8787";
const MESH = {
  fog: 8787,
  role: "kernel",
  ipc: { workerd: 8788, python: 8790, node: 8791, deno: 8792 },
  mw: ["workerd:8788", "python:8790", "node:8791", "deno:8792"],
  routes: {
    auth_wb_session: ["python:8790", "node:8791", "deno:8792", "cf-auth:ALLOW", "frontend/maintenance-1xxx.html"],
    compose_assemble_desk: ["node:8791", "python:8790", "deno:8792", "cf-pages:ALLOW", "frontend/maintenance-1xxx.html"],
    object_cid_mail: ["deno:8792", "python:8790", "node:8791", "cf-deomail:ALLOW", "frontend/maintenance-1xxx.html"],
    html_atelier: ["node:8791/atelier", "python:8790", "workerd:8788", "cf-pages:ALLOW", "frontend/maintenance-1xxx.html"],
    html: ["pages", "node:8791/atelier", "python:8790", "workerd:8788", "frontend/maintenance-1xxx.html"],
    metabol_origin: ["workerd:8788", "python:8790", "node:8791", "cf-metabol:ALLOW", "frontend/maintenance-1xxx.html"],
  },
};
const HOP_BASE = {
  "python:8790": PY,
  "node:8791": "http://127.0.0.1:" + PORT,
  "node:8791/atelier": "http://127.0.0.1:" + PORT,
  "deno:8792": DENO,
  "workerd:8788": WORKERD,
};
const HOLD_HTML = "<!DOCTYPE html><html lang=\"pt-PT\"><head><meta charset=utf-8><title>Nó em stasis</title></head><body><p>MW hops down. Never workers.dev.</p></body></html>";

function moduleFor(path) {
  if (path.startsWith("/api/auth") || path.startsWith("/api/wb") || path === "/login" || path === "/me") return "auth_wb_session";
  if (path.startsWith("/object") || path.startsWith("/mail") || path.startsWith("/resolve")) return "object_cid_mail";
  if (path.startsWith("/metabol")) return "metabol_origin";
  if (path.startsWith("/atelier") || path.startsWith("/dashboard") || path.startsWith("/desk")) return "html_atelier";
  if (path.startsWith("/assemble")) return "compose_assemble_desk";
  return "compose_assemble_desk";
}
function splitSlots(route) {
  const mw = [], hold = "frontend/maintenance-1xxx.html";
  let cf = null;
  for (const s of route || []) {
    const low = String(s).toLowerCase();
    if (low.endsWith(".html") || low.includes("maintenance")) { /* hold */ continue; }
    if (low.startsWith("cf-") || low === "pages" || low.includes(":allow")) { cf = s; continue; }
    if (low.startsWith("fog:")) continue;
    if (mw.length < 3) mw.push(s);
  }
  return { mw, cf, hold };
}
function sameHop(slot) {
  return String(slot).startsWith("node:");
}
async function proxyHop(slot, req, url) {
  const base = HOP_BASE[slot] || HOP_BASE[String(slot).split("/")[0]];
  if (!base) return null;
  try {
    const r = await fetch(String(base).replace(/\/$/, "") + url, {
      method: req.method,
      headers: { "X-Fog-Chain": "1", "content-type": req.headers["content-type"] || "application/json" },
      signal: AbortSignal.timeout(1200),
    });
    if (r.status >= 500) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return { status: r.status, body: buf, type: r.headers.get("content-type") || "application/json", via: slot };
  } catch {
    return null;
  }
}
async function tryNext(req, url, res, localOk) {
  if (["/", "/health", "/mw/health"].includes(url) || String(url).endsWith("/health")) return false;
  if (req.headers["x-fog-chain"]) return false;
  const { mw, cf } = splitSlots(MESH.routes[moduleFor(url)] || []);
  let seen = false;
  const before = [], after = [];
  for (const slot of mw) {
    if (sameHop(slot)) { seen = true; continue; }
    (seen ? after : before).push(slot);
  }
  for (const slot of before) {
    const hit = await proxyHop(slot, req, url);
    if (hit) { sendRaw(res, hit.status, hit.body, hit.type, hit.via); return true; }
  }
  if (localOk) return false;
  for (const slot of after) {
    const hit = await proxyHop(slot, req, url);
    if (hit) { sendRaw(res, hit.status, hit.body, hit.type, hit.via); return true; }
  }
  if (cf && String(cf).includes("pages") && String(cf).includes("ALLOW")) {
    try {
      const r = await fetch("https://calhegasmorais-pt.pages.dev" + url, { signal: AbortSignal.timeout(1200), headers: { "X-Fog-Chain": "1" } });
      if (r.ok && !String(r.url || "").includes("workers.dev")) {
        const buf = Buffer.from(await r.arrayBuffer());
        sendRaw(res, r.status, buf, r.headers.get("content-type") || "text/html", cf);
        return true;
      }
    } catch { /* layer 5 */ }
  }
  sendHtml(res, HOLD_HTML);
  return true;
}
function sendRaw(res, code, buf, type, via) {
  res.writeHead(code, {
    "Content-Type": type || "application/json",
    "Access-Control-Allow-Origin": "*",
    "X-Fog-Via": String(via || ""),
    "Content-Length": buf.length,
  });
  res.end(buf);
}
function sendHtml(res, html) {
  const buf = Buffer.from(html);
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "X-Fog-Hold": "maintenance",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Content-Length": buf.length,
  });
  res.end(buf);
}
const SESS = new Map();

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function pull(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(1200) });
    return await r.json();
  } catch (e) {
    return { ok: false, error: String(e && e.message || e), url };
  }
}


const ROOMS = ["atelier","wallet","agora","economy","dao","spa","acb","sca-self","iot","diagnostics","orch","clp","profile","va","kyc","holons"];

async function desk(kind) {
  const snap = await assemble();
  return {
    ok: true,
    runtime: "node",
    role: kind,
    release: "v0.5.1-lab",
    locus: "mw-node:8791",
    hop: snap.hop,
    cmn: snap.cmn,
    rooms: kind === "atelier"
      ? ["workbench","open-world","acb-office"]
      : ROOMS,
    note: "session-bound JSON; HTML stays D1/spa; mint still oracle_live",
  };
}

async function assemble() {
  const [workerd, py, fog, metabol, deno] = await Promise.all([
    pull(WORKERD + "/health"),
    pull(PY + "/plugins"),
    pull(FOG + "/health"),
    pull(WORKERD + "/metabol"),
    pull(DENO + "/health"),
  ]);
  return {
    ok: !!(workerd.ok || py.ok || fog.ok || deno.ok),
    runtime: "node",
    role: "compose",
    release: "v0.5.1-lab",
    mesh: MESH,
    metabol_pace: { hop: "node", cf_daily: false, decision: "ALLOW", reason: "local node — no CF daily clock" },
    hop: {
      workerd: { port: 8788, isolate: true, metabol: metabol.decision || metabol.cf?.decision || null, origin: workerd.origin || null, ok: !!workerd.ok },
      python: { port: 8790, cap: py.plugins?.host_cap || null, plugins: py.plugins ? Object.keys(py.plugins) : [], ok: !!py.ok },
      fog: { port: 8787, node_id: fog.node_id || "FOG-NODE-PT-CM-001", version: fog.version || null, ok: !!fog.ok },
      node: { port: PORT, ok: true },
      deno: { port: 8792, ok: !!deno.ok },
    },
    cmn: { n: 2, mesh_member: true, edge_id: "EDGE-GROK-CMN-001", oracle_live: false },
    public: { fog: "https://fog.calhegasmorais.pt", edge: "https://edge.calhegasmorais.pt" },
  };
}

function authFallback(req, url, body) {
  const path = url;
  if (path.endsWith("/health")) {
    return { ok: true, hop: "node:8791", role: "auth-fallback", stasis_503: false, metabol_pace: "host_cap only" };
  }
  if (path.endsWith("/login") || path.endsWith("/email") || path.endsWith("/verify")) {
    const token = "n" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    const email = String((body && body.email) || "session");
    SESS.set(token, { email, exp: Date.now() + 3600_000 });
    return { ok: true, success: true, hop: "node:8791", mode: "fallback", token, email, need_2fa: false, stasis_503: false };
  }
  return { ok: true, hop: "node:8791", role: "auth-fallback", stasis_503: false, path };
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}")); }
      catch { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

const ORCH_PATHS = [
  "/api/orchestrator/chat",
  "/api/orchestrator/health",
  "/api/v1/orchestrator/chat",
  "/api/v1/orchestrator/health",
  "/orchestrator/chat",
];

async function orchChat(req) {
  let body = {};
  if (req.method === "POST") body = await readBody(req);
  const headline = String(body.headline || body.message || body.text || "").slice(0, 160);
  let origin = { forwarded: false };
  if (req.method === "POST") {
    try {
      const r = await fetch("https://calhegasmorais.pt/api/orchestrator/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "fog-mw-node/orch" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(4000),
      });
      const text = await r.text();
      let obj = {};
      try { obj = JSON.parse(text); } catch { /* raw */ }
      origin = { forwarded: true, http: r.status, version: obj.version || null, ok: r.ok };
    } catch (e) {
      origin = { forwarded: false, fail_open: true, error: String(e && e.message || e).slice(0, 80) };
    }
  }
  return {
    ok: true,
    hop: "node:8791",
    role: "orchestrator-chat",
    accepted: true,
    dest: "AIOps Dev Team via Orchestrator",
    headline,
    origin,
    methods: ["GET", "POST", "OPTIONS"],
    version: "fog-mw-orch-chat-1",
    service: "stratamesh-orchestrator",
    status: "ok",
  };
}

const server = http.createServer(async (req, res) => {
  const url = String(req.url || "/").split("?")[0];
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    return res.end();
  }
  if (await tryNext(req, url, res, true)) return;
  if (ORCH_PATHS.includes(url) && (req.method === "GET" || req.method === "HEAD" || req.method === "POST")) {
    return send(res, 200, await orchChat(req));
  }
  if (String(url).startsWith("/api/auth") || String(url).startsWith("/api/wb")) {
    let body = {};
    if (req.method === "POST" || req.method === "PUT") body = await readBody(req);
    return send(res, 200, authFallback(req, url, body));
  }
  if (req.method !== "GET") return send(res, 405, { ok: false, error: "method" });
  if (["/", "/health", "/mw/health"].includes(url)) {
    return send(res, 200, {
      ok: true, runtime: "node", role: "compose", port: PORT,
      listening: true, release: "v0.5.1-lab",
    });
  }
  if (["/assemble", "/cmn", "/mw/cmn", "/mw/assemble"].includes(url)) {
    return send(res, 200, await assemble());
  }
  if (["/atelier", "/atelier/health", "/mw/atelier"].includes(url)) {
    return send(res, 200, await desk("atelier"));
  }
  if (["/dashboard", "/dashboard/health", "/desk", "/mw/dashboard"].includes(url)) {
    return send(res, 200, await desk("dashboard"));
  }
  if (["/metabol", "/mw/metabol"].includes(url)) {
    return send(res, 200, {
      ok: true, runtime: "node", hop: "node:8791",
      metabol_pace: { hop: "node", cf_daily: false, decision: "ALLOW" },
      snap: await pull(WORKERD + "/metabol"),
    });
  }
  if (["/mesh", "/mw/mesh"].includes(url)) {
    return send(res, 200, { ok: true, runtime: "node", mesh: MESH, metabol_pace: { hop: "node", cf_daily: false, decision: "ALLOW" } });
  }
  if (url.startsWith("/object") || url.startsWith("/mail") || url.startsWith("/resolve")) {
    const hitPy = await proxyHop("python:8790", req, url);
    if (hitPy) return sendRaw(res, hitPy.status, hitPy.body, hitPy.type, hitPy.via);
    const hitDeno = await proxyHop("deno:8792", req, url);
    if (hitDeno) return sendRaw(res, hitDeno.status, hitDeno.body, hitDeno.type, hitDeno.via);
    return send(res, 200, { ok: true, hop: "node:8791", role: "object-mail-contingency", path: url });
  }
  if (await tryNext(req, url, res, false)) return;
  send(res, 404, { ok: false });
});
server.on("error", (err) => {
  process.stderr.write(String(err && err.stack || err) + "\n");
  process.exit(1);
});
server.listen(PORT, "127.0.0.1", () => {
  process.stderr.write("fog-mw node compose 127.0.0.1:" + PORT + "\n");
});
