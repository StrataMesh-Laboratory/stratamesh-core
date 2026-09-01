#!/usr/bin/env node
import http from "node:http";

const PORT = parseInt(process.env.FOG_MW_NODE_PORT || "8791", 10);
const WORKERD = process.env.WORKERD_HEALTH || "http://127.0.0.1:8788";

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function metabol() {
  try {
    const r = await fetch(WORKERD + "/metabol", { signal: AbortSignal.timeout(1200) });
    return await r.json();
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

const server = http.createServer(async (req, res) => {
  const url = String(req.url || "/").split("?")[0];
  const base = {
    ok: true,
    runtime: "node",
    port: PORT,
    role: "middleware",
    listening: true,
    node_id: "FOG-NODE-PT-CM-001",
    edge_id: "EDGE-GROK-CMN-001",
    n: 2,
    mesh_member: true,
    oracle_live: false,
    hop: "workerd:8788 + fog:8787 + mw py:8790 node:8791",
  };
  if (req.method === "GET" && ["/","/health","/mw/health"].includes(url)) return send(res, 200, base);
  if (req.method === "GET" && ["/cmn","/mw/cmn"].includes(url)) {
    return send(res, 200, {
      ...base,
      public: { fog: "https://fog.calhegasmorais.pt", edge: "https://edge.calhegasmorais.pt" },
      plugins: ["host_cap","keepup","ping","rails","tmp_sweep","runtime_mesh","metabol"],
    });
  }
  if (req.method === "GET" && ["/metabol","/mw/metabol"].includes(url)) {
    return send(res, 200, { ok: true, runtime: "node", snap: await metabol() });
  }
  if (req.method === "GET" && ["/plugins","/mw/plugins"].includes(url)) {
    return send(res, 200, { ok: true, runtime: "node", plugins: ["host_cap","keepup","ping","rails","tmp_sweep","runtime_mesh"] });
  }
  send(res, 404, { ok: false });
});
server.on("error", (err) => {
  process.stderr.write(String(err && err.stack || err) + "\n");
  process.exit(1);
});
server.listen(PORT, "127.0.0.1", () => {
  process.stderr.write("fog-mw node listening 127.0.0.1:" + PORT + "\n");
});
