#!/usr/bin/env node
/**
 * SPA + auth fallback :8791 — no KV. Proxies CF auth; if workerd/1027/HTML, JSON stasis.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const ROOT = process.env.FOG_SRC
  ? path.join(process.env.FOG_SRC, "frontend")
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend");
const PORT = Number(process.env.SPA_NODE_PORT || process.env.FOG_MW_NODE_PORT || 8791);
const CF_AUTH = process.env.CF_AUTH_ORIGIN || "https://calhegasmorais.pt";
const sessions = new Map();

const MAP = {
  "/": "sandbox.html",
  "/index.html": "sandbox.html",
  "/dashboard": "portal-pt.html",
  "/login": "portal-pt.html",
};

function cors(res, extra = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "Authorization, Content-Type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    ...extra,
  };
}

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, cors(res, { "content-type": "application/json", "cache-control": "no-store" }));
  res.end(body);
}

async function proxyAuth(reqPath, method, headers, body) {
  const url = CF_AUTH.replace(/\/$/, "") + reqPath;
  try {
    const r = await fetch(url, {
      method,
      headers: { accept: "application/json", "content-type": "application/json", ...(headers.authorization ? { authorization: headers.authorization } : {}) },
      body: method === "GET" ? undefined : body,
      signal: AbortSignal.timeout(4000),
    });
    const ct = r.headers.get("content-type") || "";
    if (r.status === 429 || r.status === 405 || r.status === 1027 || !ct.includes("json")) {
      return { stasis: true, status: r.status, ct };
    }
    return { stasis: false, status: r.status, json: await r.json() };
  } catch (e) {
    return { stasis: true, status: 0, error: String(e && e.message || e) };
  }
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url || "/", "http://127.0.0.1");
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors(res));
    return res.end();
  }
  if (u.pathname === "/health") {
    return send(res, 200, { ok: true, runtime: "node", role: "spa-auth-fallback", port: PORT });
  }
  if (u.pathname === "/api/auth/me" && req.method === "GET") {
    const auth = req.headers.authorization || "";
    const tok = auth.replace(/^Bearer\s+/i, "");
    if (tok && sessions.has(tok)) return send(res, 200, sessions.get(tok));
    const prox = await proxyAuth("/api/auth/me", "GET", req.headers, null);
    if (!prox.stasis) return send(res, prox.status, prox.json);
    return send(res, 503, { ok: false, error: "cf_stasis", hop: "node:8791", renewal: "00:00 UTC" });
  }
  if (u.pathname === "/api/auth/login" && req.method === "POST") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8");
    const prox = await proxyAuth("/api/auth/login", "POST", req.headers, raw);
    if (!prox.stasis && prox.json && (prox.json.token || prox.json.session_token)) {
      return send(res, prox.status, prox.json);
    }
    return send(res, 503, { ok: false, error: "cf_stasis", message: "workerd auth down; node hop up; retry 00:00 UTC", hop: "node:8791" });
  }

  let rel = MAP[u.pathname];
  if (!rel) {
    const cut = u.pathname.replace(/^\/+/, "");
    if (cut && !cut.includes("..")) rel = cut;
  }
  const fp = rel ? path.join(ROOT, rel) : "";
  if (fp && fp.startsWith(ROOT) && fs.existsSync(fp) && fs.statSync(fp).isFile()) {
    const buf = fs.readFileSync(fp);
    res.writeHead(200, cors(res, { "content-type": rel.endsWith(".js") ? "text/javascript" : "text/html; charset=utf-8" }));
    return res.end(buf);
  }
  res.writeHead(404, cors(res, { "content-type": "application/json" }));
  res.end(JSON.stringify({ error: "not found", hop: "node:8791" }));
});

server.listen(PORT, "127.0.0.1", () => console.log("cmn-spa-node", PORT, ROOT));
