const SNAPSHOT = {"node_id": "FOG-NODE-PT-CM-001", "name": "Calhegas Morais", "location": {"lat": 38.7169, "lon": -9.1427, "label": "Lisbon, Portugal"}, "version": "0.2.1-dev", "phase": "2", "phase_name": "Nodal Hierarchy & SPAs", "status": "operational", "timestamp": "2026-08-10T16:57:40Z", "dag": {"transaction_count": 8, "tip_count": 1, "tips_sample": ["2f5fa8383bd69929"]}, "spa": {"total": 2, "active": 2, "by_role": {"fog": 1, "pinner": 1, "edge": 1}}, "subsistence": {"agent_id": "FOG-NODE-PT-CM-001", "reserve": 10.0, "surplus": 12.0, "tau": 0.0, "solvent": true, "status": "active"}, "ipfs": {"dnslink_cid": "bafybeigdyrzt5sfp7udm7hu76uh7y26nf4dfuylqabf3oclgtqy55fbzdi", "pins": {"total": 5, "by_status": {"queued": 0, "pinning": 0, "pinned": 5, "failed": 0}, "note": "stub \u2014 replace with real IPFS client under SPA"}}, "links": {"repo": "https://github.com/amcmorais/stratamesh-core", "status_worker": "https://stratamesh-status.stratamesh.workers.dev/status", "portal": "https://calhegasmorais.pt/dashboard"}, "progress": {"phase0": "complete", "phase1_scaffold": "complete", "phase2_spa_registry": "scaffolded", "orchestrator_hybrid": "live", "proof_of_subsistence": "live", "epistemic_ontology": "normative"}, "uptime_seconds": 0, "storage": {"backend": "sqlite", "path": "/tmp/stratamesh-live.db"}, "finality_tips": [{"tx_id": "2f5fa8383bd69929", "confidence": 0.125, "cumulative_weight": 1.0, "type": "spa"}], "contribution": {"events": 7, "agents": 1, "total_minted": 1.5, "balances": {"FOG-NODE-PT-CM-001": 1.5}}, "source": "node_persistent snapshot (local \u2192 Worker publish)", "note": "Public pulse; continuous push from Fog node is the Phase 2 exit step"};

function page(s) {
  const tips = (s.finality_tips || []).map(t =>
    `<li><code>${t.tx_id}</code> conf=${(t.confidence*100).toFixed(1)}% cw=${t.cumulative_weight} type=${t.type}</li>`
  ).join('') || '<li>none</li>';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>StrataMesh Status · Calhegas Morais</title>
<style>
:root{--bg:#0b0f14;--card:#141a22;--text:#e6edf3;--muted:#8b9bb4;--accent:#3b82f6;--ok:#22c55e}
*{box-sizing:border-box;margin:0;padding:0}body{font-family:ui-sans-serif,system-ui,sans-serif;background:var(--bg);color:var(--text);padding:2rem 1rem}
.c{max-width:800px;margin:0 auto}h1{font-size:1.4rem}.motto{color:var(--muted);font-size:.85rem;margin:.25rem 0 1.25rem}
.card{background:var(--card);border-radius:12px;padding:1.1rem 1.35rem;margin-bottom:.9rem;border:1px solid #1e293b}
.label{color:var(--muted);font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.35rem}
.pill{display:inline-block;background:#14532d;color:var(--ok);padding:.2rem .55rem;border-radius:999px;font-size:.78rem}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}
@media(max-width:600px){.grid{grid-template-columns:1fr}}
.stat{font-size:1.4rem;font-weight:600} .sub{color:var(--muted);font-size:.8rem}
a{color:var(--accent)} code{font-size:.75rem;color:#93c5fd}
ul{margin:.4rem 0 0 1rem;color:var(--muted);font-size:.85rem}
footer{margin-top:1.5rem;color:var(--muted);font-size:.75rem;text-align:center}
</style></head><body><div class="c">
<h1>${s.name} · ${s.node_id}</h1>
<p class="motto">Intelligentia · Vigilantia · Veritas</p>
<div class="card"><div class="label">Phase</div>
<span class="pill">Phase ${s.phase} — ${s.phase_name}</span>
<p class="sub" style="margin-top:.5rem">status=${s.status} · ${s.timestamp}</p></div>
<div class="grid">
<div class="card"><div class="label">DAG</div><div class="stat">${s.dag?.transaction_count ?? 0}</div><div class="sub">transactions · ${s.dag?.tip_count ?? 0} tips</div></div>
<div class="card"><div class="label">SPAs</div><div class="stat">${s.spa?.active ?? 0}</div><div class="sub">active of ${s.spa?.total ?? 0} · roles ${JSON.stringify(s.spa?.by_role||{})}</div></div>
<div class="card"><div class="label">PoC minted</div><div class="stat">${(s.contribution?.total_minted??0).toFixed?.(2) ?? s.contribution?.total_minted ?? 0}</div><div class="sub">${s.contribution?.events??0} events</div></div>
<div class="card"><div class="label">Subsistence</div><div class="stat">${s.subsistence?.solvent ? 'solvent' : 'check'}</div><div class="sub">reserve ${s.subsistence?.reserve ?? '—'}</div></div>
</div>
<div class="card"><div class="label">Finality tips</div><ul>${tips}</ul></div>
<div class="card"><div class="label">Links</div>
<p style="margin-top:.4rem"><a href="/status">JSON</a> · <a href="https://github.com/amcmorais/stratamesh-core">GitHub</a> · <a href="https://calhegasmorais.pt/dashboard">Portal</a></p>
<p class="sub" style="margin-top:.5rem">${s.note||''}</p></div>
<footer>UNCLASSIFIED // FOG-NODE-PT-CM-001 · snapshot publish</footer>
</div></body></html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Optional push from Fog node: POST /ingest with header X-Status-Token
    if (url.pathname === '/ingest' && request.method === 'POST') {
      const token = request.headers.get('X-Status-Token') || '';
      const expected = env.STATUS_TOKEN || '';
      if (!expected || token !== expected) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      try {
        const body = await request.json();
        if (env.STATUS_KV) {
          await env.STATUS_KV.put('live', JSON.stringify(body));
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e.message||e) }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
    }

    let data = SNAPSHOT;
    if (env.STATUS_KV) {
      try {
        const live = await env.STATUS_KV.get('live');
        if (live) data = JSON.parse(live);
      } catch (_) {}
    }
    data = { ...data, timestamp: data.timestamp || new Date().toISOString() };

    if (url.pathname === '/status' || url.pathname === '/v1/status') {
      return new Response(JSON.stringify(data, null, 2), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' }
      });
    }
    return new Response(page(data), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } });
  }
};
