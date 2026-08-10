const SNAPSHOT = {"node_id": "FOG-NODE-PT-CM-001", "name": "Calhegas Morais", "location": {"lat": 38.7169, "lon": -9.1427, "label": "Lisbon, Portugal"}, "version": "0.2.1-dev", "phase": "2", "phase_name": "Nodal Hierarchy & SPAs", "status": "operational", "timestamp": "2026-08-10T16:57:40Z", "dag": {"transaction_count": 8, "tip_count": 1, "tips_sample": ["2f5fa8383bd69929"]}, "spa": {"total": 2, "active": 2, "by_role": {"fog": 1, "pinner": 1, "edge": 1}}, "subsistence": {"agent_id": "FOG-NODE-PT-CM-001", "reserve": 10.0, "surplus": 12.0, "tau": 0.0, "solvent": true, "status": "active"}, "ipfs": {"dnslink_cid": "bafybeigdyrzt5sfp7udm7hu76uh7y26nf4dfuylqabf3oclgtqy55fbzdi", "pins": {"total": 5, "by_status": {"queued": 0, "pinning": 0, "pinned": 5, "failed": 0}, "note": "stub \u2014 replace with real IPFS client under SPA"}}, "links": {"repo": "https://github.com/amcmorais/stratamesh-core", "status_worker": "https://stratamesh-status.stratamesh.workers.dev/status", "portal": "https://calhegasmorais.pt/dashboard"}, "progress": {"phase0": "complete", "phase1_scaffold": "complete", "phase2_spa_registry": "scaffolded", "orchestrator_hybrid": "live", "proof_of_subsistence": "live", "epistemic_ontology": "normative"}, "uptime_seconds": 0, "storage": {"backend": "sqlite", "path": "/tmp/stratamesh-live.db"}, "finality_tips": [{"tx_id": "2f5fa8383bd69929", "confidence": 0.125, "cumulative_weight": 1.0, "type": "spa"}], "contribution": {"events": 7, "agents": 1, "total_minted": 1.5, "balances": {"FOG-NODE-PT-CM-001": 1.5}}};
const LIVE_HTML = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>StrataMesh \u00b7 Live Mesh Status</title>\n<style>\n:root{--bg:#0b0f14;--card:#141a22;--text:#e6edf3;--muted:#8b9bb4;--accent:#3b82f6;--ok:#22c55e;--warn:#fbbf24}\n*{box-sizing:border-box;margin:0;padding:0}\nbody{font-family:ui-sans-serif,system-ui,sans-serif;background:var(--bg);color:var(--text);padding:1.5rem}\n.c{max-width:900px;margin:0 auto}\nh1{font-size:1.25rem;margin-bottom:.25rem}\n.sub{color:var(--muted);font-size:.8rem;margin-bottom:1rem}\n.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.75rem}\n.card{background:var(--card);border:1px solid #1e293b;border-radius:12px;padding:1rem}\n.label{font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}\n.stat{font-size:1.35rem;font-weight:600;margin-top:.2rem}\n.ok{color:var(--ok)}.warn{color:var(--warn)}\ntable{width:100%;border-collapse:collapse;font-size:.8rem;margin-top:.5rem}\nth,td{text-align:left;padding:.35rem .25rem;border-bottom:1px solid #1e293b;color:var(--muted)}\nth{color:#93c5fd;font-weight:500}\na{color:var(--accent)}\n#error{color:#f87171;font-size:.85rem}\n</style>\n</head>\n<body>\n<div class=\"c\">\n  <h1>StrataMesh live status</h1>\n  <p class=\"sub\">Source: <a id=\"src\" href=\"https://stratamesh-status.stratamesh.workers.dev/status\">status Worker</a> \u00b7 auto-refresh 30s</p>\n  <div id=\"error\"></div>\n  <div class=\"grid\" id=\"cards\"></div>\n  <div class=\"card\" style=\"margin-top:.75rem\">\n    <div class=\"label\">Finality tips</div>\n    <table><thead><tr><th>tx</th><th>confidence</th><th>weight</th><th>type</th></tr></thead>\n    <tbody id=\"tips\"></tbody></table>\n  </div>\n  <div class=\"card\" style=\"margin-top:.75rem\">\n    <div class=\"label\">SPA roles</div>\n    <pre id=\"spa\" style=\"color:var(--muted);font-size:.8rem;margin-top:.4rem\"></pre>\n  </div>\n</div>\n<script>\nconst STATUS_URL = 'https://stratamesh-status.stratamesh.workers.dev/status';\nasync function load(){\n  try{\n    const r = await fetch(STATUS_URL+'?t='+Date.now());\n    const s = await r.json();\n    document.getElementById('error').textContent = '';\n    const cards = [\n      ['Phase', (s.phase||'?')+' \u2014 '+(s.phase_name||''), ''],\n      ['DAG txs', s.dag?.transaction_count ?? '\u2014', ''],\n      ['Tips', s.dag?.tip_count ?? '\u2014', ''],\n      ['SPAs active', s.spa?.active ?? '\u2014', ''],\n      ['PoC minted', (s.contribution?.total_minted ?? '\u2014'), ''],\n      ['Solvent', s.subsistence?.solvent ? 'yes' : 'no', s.subsistence?.solvent ? 'ok' : 'warn'],\n    ];\n    document.getElementById('cards').innerHTML = cards.map(([l,v,c])=>\n      `<div class=\"card\"><div class=\"label\">${l}</div><div class=\"stat ${c}\">${v}</div></div>`\n    ).join('');\n    const tips = s.finality_tips || [];\n    document.getElementById('tips').innerHTML = tips.length ? tips.map(t=>\n      `<tr><td><code>${t.tx_id}</code></td><td>${((t.confidence||0)*100).toFixed(1)}%</td><td>${t.cumulative_weight}</td><td>${t.type||''}</td></tr>`\n    ).join('') : '<tr><td colspan=\"4\">none</td></tr>';\n    document.getElementById('spa').textContent = JSON.stringify(s.spa||{}, null, 2);\n  }catch(e){\n    document.getElementById('error').textContent = 'Failed to load status: '+e.message;\n  }\n}\nload();\nsetInterval(load, 30000);\n</script>\n</body>\n</html>\n";

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
<p class="sub" style="margin-top:.5rem">status=${s.status} · ${s.timestamp}</p>
<p class="sub"><a href="/live">Open live dashboard widget</a></p></div>
<div class="grid">
<div class="card"><div class="label">DAG</div><div class="stat">${s.dag?.transaction_count ?? 0}</div><div class="sub">transactions · ${s.dag?.tip_count ?? 0} tips</div></div>
<div class="card"><div class="label">SPAs</div><div class="stat">${s.spa?.active ?? 0}</div><div class="sub">active of ${s.spa?.total ?? 0}</div></div>
<div class="card"><div class="label">PoC minted</div><div class="stat">${(s.contribution?.total_minted??0)}</div><div class="sub">${s.contribution?.events??0} events</div></div>
<div class="card"><div class="label">Subsistence</div><div class="stat">${s.subsistence?.solvent ? 'solvent' : 'check'}</div><div class="sub">reserve ${s.subsistence?.reserve ?? '—'}</div></div>
</div>
<div class="card"><div class="label">Finality tips</div><ul>${tips}</ul></div>
<div class="card"><div class="label">Links</div>
<p style="margin-top:.4rem"><a href="/status">JSON</a> · <a href="/live">Live widget</a> · <a href="https://github.com/amcmorais/stratamesh-core">GitHub</a> · <a href="https://calhegasmorais.pt/dashboard">Portal</a></p></div>
<footer>UNCLASSIFIED // FOG-NODE-PT-CM-001</footer>
</div></body></html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ingest' && request.method === 'POST') {
      const token = request.headers.get('X-Status-Token') || '';
      const expected = env.STATUS_TOKEN || '';
      if (!expected || token !== expected) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      try {
        const body = await request.json();
        if (env.STATUS_KV) await env.STATUS_KV.put('live', JSON.stringify(body));
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e.message||e) }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
    }
    if (url.pathname === '/live' || url.pathname === '/widget') {
      return new Response(LIVE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } });
    }
    let data = SNAPSHOT;
    if (env.STATUS_KV) {
      try {
        const live = await env.STATUS_KV.get('live');
        if (live) data = JSON.parse(live);
      } catch (_) {}
    }
    if (url.pathname === '/status' || url.pathname === '/v1/status') {
      return new Response(JSON.stringify(data, null, 2), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' }
      });
    }
    return new Response(page(data), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } });
  }
};
