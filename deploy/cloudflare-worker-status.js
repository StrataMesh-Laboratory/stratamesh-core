const STATUS = {
  node_id: "FOG-NODE-PT-CM-001",
  name: "Calhegas Morais",
  location: { lat: 38.7169, lon: -9.1427, label: "Lisbon, Portugal" },
  version: "0.1.1-dev",
  phase: "1",
  phase_name: "Core DAG + IPFS Linkage",
  status: "scaffolding",
  timestamp: new Date().toISOString(),
  progress: {
    tip_selection: "v0.1 reference implemented",
    persistent_dag: "SQLite-backed, verified",
    local_node: "HTTP + persistent storage",
    multi_node_sim: "gossip verified",
    testnet_launcher: "3-node private testnet working",
    spa_template: "draft ready",
    public_repo: "https://github.com/amcmorais/stratamesh-core"
  },
  dag: { height_approx: 0, tip_count: 0, transaction_count: 0 },
  ipfs: {
    pins_total: 0,
    pins_active: 0,
    dnslink_cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf4dfuylqabf3oclgtqy55fbzdi"
  },
  spa: { active_spas: 0, roles: ["fog"] },
  aiops: { orchestrator: "active", agents: ["security", "devops", "analysis"] },
  links: {
    repo: "https://github.com/amcmorais/stratamesh-core",
    portal: "https://aiops.calhegasmorais.pt/"
  }
};

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StrataMesh · Calhegas Morais Fog Node</title>
  <style>
    :root { --bg:#0b0f14; --card:#141a22; --text:#e6edf3; --muted:#8b9bb4; --accent:#3b82f6; --ok:#22c55e; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:ui-sans-serif,system-ui,sans-serif; background:var(--bg); color:var(--text); padding:2rem 1rem; }
    .c { max-width:720px; margin:0 auto; }
    h1 { font-size:1.5rem; }
    .motto { color:var(--muted); font-size:.9rem; margin:0.25rem 0 1.5rem; }
    .card { background:var(--card); border-radius:12px; padding:1.25rem 1.5rem; margin-bottom:1rem; border:1px solid #1e293b; }
    .label { color:var(--muted); font-size:.75rem; text-transform:uppercase; letter-spacing:.05em; }
    .value { font-size:1.15rem; font-weight:600; margin-top:.25rem; }
    .pill { display:inline-block; background:#14532d; color:var(--ok); padding:.2rem .6rem; border-radius:999px; font-size:.8rem; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
    footer { margin-top:2rem; color:var(--muted); font-size:.8rem; text-align:center; }
    a { color:var(--accent); }
    ul { margin:.5rem 0 0 1.1rem; color:var(--muted); font-size:.9rem; }
  </style>
</head>
<body>
  <div class="c">
    <h1>Calhegas Morais Fog Node</h1>
    <p class="motto">Intelligentia · Vigilantia · Veritas · FOG-NODE-PT-CM-001</p>
    <div class="card">
      <div class="label">Status</div>
      <div class="value"><span class="pill">Phase 1 — Core DAG + IPFS Linkage</span></div>
      <p style="margin-top:.75rem;color:var(--muted);font-size:.9rem">
        Persistent DAG, multi-node testnet launcher, and public repository are live.
      </p>
    </div>
    <div class="grid">
      <div class="card"><div class="label">Location</div><div class="value" style="font-size:1rem">38.7169° N, 9.1427° W</div><div style="color:var(--muted);font-size:.85rem">Lisbon, Portugal</div></div>
      <div class="card"><div class="label">Role</div><div class="value" style="font-size:1rem">Fog Node</div><div style="color:var(--muted);font-size:.85rem">DAG + IPFS pinning</div></div>
    </div>
    <div class="card">
      <div class="label">Progress</div>
      <ul>
        <li>Tip selection v0.1 reference</li>
        <li>PersistentDAG (SQLite)</li>
        <li>3-node private testnet launcher</li>
        <li>Public repo: <a href="https://github.com/amcmorais/stratamesh-core">stratamesh-core</a></li>
      </ul>
    </div>
    <div class="card">
      <div class="label">Links</div>
      <p style="margin-top:.5rem"><a href="/status">JSON status</a> · <a href="https://github.com/amcmorais/stratamesh-core">GitHub</a> · <a href="https://aiops.calhegasmorais.pt/">Portal</a></p>
    </div>
    <footer>UNCLASSIFIED // FOG-NODE-PT-CM-001<br>© 2026 Calhegas Morais · StrataMesh DLT</footer>
  </div>
</body>
</html>`;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/status" || url.pathname === "/v1/status") {
      const body = { ...STATUS, timestamp: new Date().toISOString() };
      return new Response(JSON.stringify(body, null, 2), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
    return new Response(HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
};
