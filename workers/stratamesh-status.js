const STATUS = {
  node_id: "FOG-NODE-PT-CM-001",
  name: "Calhegas Morais",
  location: { lat: 38.7169, lon: -9.1427, label: "Lisbon, Portugal" },
  version: "0.2.0-dev",
  phase: "2",
  phase_name: "Nodal Hierarchy & SPAs (scaffold)",
  status: "operational",
  timestamp: new Date().toISOString(),
  progress: {
    phase0: "complete",
    phase1_scaffold: "complete",
    phase2_spa_registry: "scaffolded",
    orchestrator_hybrid: "live",
    proof_of_subsistence: "live",
    epistemic_ontology: "normative",
    portal_dashboard_fix: "deployed"
  },
  dag: { transaction_count: 0, tip_count: 0 },
  spa: { total: 0, active: 0, note: "registry runnable in stratamesh-core" },
  links: {
    repo: "https://github.com/amcmorais/stratamesh-core",
    portal: "https://calhegasmorais.pt/dashboard",
    status: "https://stratamesh-status.stratamesh.workers.dev/status"
  }
};

const HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>StrataMesh · Calhegas Morais</title>
<style>
:root{--bg:#0b0f14;--card:#141a22;--text:#e6edf3;--muted:#8b9bb4;--accent:#3b82f6;--ok:#22c55e}
*{box-sizing:border-box;margin:0;padding:0}body{font-family:ui-sans-serif,system-ui,sans-serif;background:var(--bg);color:var(--text);padding:2rem 1rem}
.c{max-width:720px;margin:0 auto}h1{font-size:1.5rem}.motto{color:var(--muted);font-size:.9rem;margin:.25rem 0 1.5rem}
.card{background:var(--card);border-radius:12px;padding:1.25rem 1.5rem;margin-bottom:1rem;border:1px solid #1e293b}
.label{color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em}
.pill{display:inline-block;background:#14532d;color:var(--ok);padding:.2rem .6rem;border-radius:999px;font-size:.8rem}
a{color:var(--accent)}footer{margin-top:2rem;color:var(--muted);font-size:.8rem;text-align:center}
ul{margin:.5rem 0 0 1.1rem;color:var(--muted);font-size:.9rem}
</style></head><body><div class="c">
<h1>Calhegas Morais Fog Node</h1>
<p class="motto">Intelligentia · Vigilantia · Veritas · FOG-NODE-PT-CM-001</p>
<div class="card"><div class="label">Status</div>
<div class="value"><span class="pill">Phase 2 — SPA scaffold</span></div>
<p style="margin-top:.75rem;color:var(--muted);font-size:.9rem">Phase 0–1 complete. On-graph SPA registry, hybrid Orchestrator, Proof of Subsistence live in core.</p></div>
<div class="card"><div class="label">Progress</div>
<ul>
<li>Phase 0 operational baseline — done</li>
<li>Phase 1 DAG + gossip + persistent node — done</li>
<li>SPA registry + metrics bridge — scaffolded</li>
<li>Portal/dashboard auth path fixes — deployed</li>
</ul></div>
<div class="card"><div class="label">Links</div>
<p style="margin-top:.5rem"><a href="/status">JSON status</a> · <a href="https://github.com/amcmorais/stratamesh-core">GitHub</a> · <a href="https://calhegasmorais.pt/dashboard">Portal</a></p></div>
<footer>UNCLASSIFIED // FOG-NODE-PT-CM-001<br>© 2026 Calhegas Morais · StrataMesh DLT</footer>
</div></body></html>`;

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
