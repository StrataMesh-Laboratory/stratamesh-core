#!/usr/bin/env node
/**
 * CMN Pages/Node fallback — no KV, no Workers bill.
 * Serves frontend/* from disk (or memory). Bind EDGE_PORT or 8791.
 * Intensive loops belong here, not on stratamesh-spa / AUTH_DB / RATE_LIMIT.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.FOG_SRC
  ? path.join(process.env.FOG_SRC, "frontend")
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend");
const PORT = Number(process.env.SPA_NODE_PORT || process.env.EDGE_PORT || 8791);

const MAP = {
  "/": "index.html",
  "/index.html": "index.html",
  "/en": "index-en.html",
  "/dashboard": "portal-pt.html",
  "/dashboard/": "portal-pt.html",
  "/login": "portal-pt.html",
};

function type(p) {
  if (p.endsWith(".html")) return "text/html; charset=utf-8";
  if (p.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (p.endsWith(".css")) return "text/css; charset=utf-8";
  if (p.endsWith(".json")) return "application/json";
  if (p.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

const mem = new Map();
function load(rel) {
  if (mem.has(rel)) return mem.get(rel);
  const fp = path.join(ROOT, rel);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || !fs.statSync(fp).isFile()) return null;
  const buf = fs.readFileSync(fp);
  mem.set(rel, buf);
  return buf;
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url || "/", "http://127.0.0.1");
  let rel = MAP[u.pathname];
  if (!rel) {
    const cut = u.pathname.replace(/^\/+/, "");
    if (cut && !cut.includes("..")) rel = cut;
  }
  const buf = rel ? load(rel) : null;
  if (!buf) {
    const dash = load("portal-pt.html");
    if (dash && (u.pathname.startsWith("/dashboard") || u.pathname.startsWith("/login"))) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" });
      return res.end(dash);
    }
    res.writeHead(404, { "content-type": "text/plain" });
    return res.end("cmn-spa-node: not found\n");
  }
  res.writeHead(200, {
    "content-type": type(rel),
    "cache-control": "public, max-age=60",
    "x-cmn-locus": "node-spa-fallback",
  });
  res.end(buf);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("cmn-spa-node", PORT, "root", ROOT);
});
