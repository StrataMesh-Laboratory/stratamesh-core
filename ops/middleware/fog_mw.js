#!/usr/bin/env node
/**
 * Node mw :8791 — compose hop JSON in parallel.
 * Not cap (Python). Not metabol math (workerd). Not public origin.
 */
import http from "node:http";

const PORT = parseInt(process.env.FOG_MW_NODE_PORT || "8791", 10);
const WORKERD = process.env.WORKERD_HEALTH || "http://127.0.0.1:8788";
const PY = process.env.FOG_MW_PY || "http://127.0.0.1:8790";
const FOG = process.env.FOG_HEALTH || "http://127.0.0.1:8787";

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
    release: "v0.5.0-lab",
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
  const [workerd, py, fog, metabol] = await Promise.all([
    pull(WORKERD + "/health"),
    pull(PY + "/plugins"),
    pull(FOG + "/health"),
    pull(WORKERD + "/metabol"),
  ]);
  return {
    ok: !!(workerd.ok || py.ok || fog.ok),
    runtime: "node",
    role: "compose",
    release: "v0.5.0-lab",
    hop: {
      workerd: { port: 8788, isolate: true, metabol: metabol.decision || metabol.cf?.decision || null, origin: workerd.origin || null, ok: !!workerd.ok },
      python: { port: 8790, cap: py.plugins?.host_cap || null, plugins: py.plugins ? Object.keys(py.plugins) : [], ok: !!py.ok },
      fog: { port: 8787, node_id: fog.node_id || "FOG-NODE-PT-CM-001", version: fog.version || null, ok: !!fog.ok },
      node: { port: PORT, ok: true },
    },
    cmn: { n: 2, mesh_member: true, edge_id: "EDGE-GROK-CMN-001", oracle_live: false },
    public: { fog: "https://fog.calhegasmorais.pt", edge: "https://edge.calhegasmorais.pt" },
  };
}

const server = http.createServer(async (req, res) => {
  const url = String(req.url || "/").split("?")[0];
  if (req.method !== "GET") return send(res, 405, { ok: false });
  if (["/", "/health", "/mw/health"].includes(url)) {
    return send(res, 200, {
      ok: true, runtime: "node", role: "compose", port: PORT,
      listening: true, release: "v0.5.0-lab",
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
    return send(res, 200, { ok: true, runtime: "node", snap: await pull(WORKERD + "/metabol") });
  }
  send(res, 404, { ok: false });
});
server.on("error", (err) => {
  process.stderr.write(String(err && err.stack || err) + "\n");
  process.exit(1);
});
server.listen(PORT, "127.0.0.1", () => {
  process.stderr.write("fog-mw node compose 127.0.0.1:" + PORT + "\n");
});
