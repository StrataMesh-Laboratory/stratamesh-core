const SNAPSHOT = {"version": "0.2.1-lab-temp", "phase": "2"};
const LIVE_HTML = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>StrataMesh \u00b7 Live \u00b7 v0.2.1-lab</title>\n<style>\n:root{--bg:#0b0f14;--card:#141a22;--text:#e6edf3;--muted:#8b9bb4;--accent:#3b82f6;--ok:#22c55e;--warn:#fbbf24}\n*{box-sizing:border-box;margin:0;padding:0}\nbody{font-family:ui-sans-serif,system-ui,sans-serif;background:var(--bg);color:var(--text);padding:1.25rem}\n.c{max-width:960px;margin:0 auto}\nh1{font-size:1.2rem} .sub{color:var(--muted);font-size:.8rem;margin:.25rem 0 1rem}\n.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.65rem}\n.card{background:var(--card);border:1px solid #1e293b;border-radius:12px;padding:.9rem}\n.label{font-size:.62rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}\n.stat{font-size:1.25rem;font-weight:600;margin-top:.15rem}\n.ok{color:var(--ok)} table{width:100%;border-collapse:collapse;font-size:.78rem;margin-top:.4rem}\nth,td{text-align:left;padding:.3rem .2rem;border-bottom:1px solid #1e293b;color:var(--muted)}\nth{color:#93c5fd} a{color:var(--accent)} pre{font-size:.72rem;color:var(--muted);overflow:auto;max-height:160px}\n.pill{display:inline-block;background:#14532d;color:var(--ok);padding:.15rem .5rem;border-radius:999px;font-size:.72rem}\ntracks span{display:inline-block;margin:.15rem .25rem 0 0;padding:.15rem .45rem;border-radius:6px;background:#1e293b;font-size:.7rem;color:#94a3b8}\n</style>\n</head>\n<body>\n<div class=\"c\">\n  <h1>StrataMesh live status</h1>\n  <p class=\"sub\"><span class=\"pill\">v0.2.1-lab</span> \u00b7 FOG-NODE-PT-CM-001 \u00b7 auto-refresh 30s \u00b7\n    <a href=\"/status\">JSON</a> \u00b7 <a href=\"https://github.com/amcmorais/stratamesh-core\">GitHub</a> \u00b7\n    <a href=\"https://calhegasmorais.pt/\">Site</a></p>\n  <div id=\"error\" style=\"color:#f87171;font-size:.85rem\"></div>\n  <div class=\"grid\" id=\"cards\"></div>\n  <div class=\"card\" style=\"margin-top:.75rem\">\n    <div class=\"label\">Lab tracks</div>\n    <div class=\"tracks\" id=\"tracks\"></div>\n  </div>\n  <div class=\"card\" style=\"margin-top:.75rem\">\n    <div class=\"label\">Finality tips</div>\n    <table><thead><tr><th>tx</th><th>conf</th><th>weight</th><th>type</th></tr></thead><tbody id=\"tips\"></tbody></table>\n  </div>\n  <div class=\"card\" style=\"margin-top:.75rem\"><div class=\"label\">SPA / token / SVC</div><pre id=\"extra\"></pre></div>\n</div>\n<script>\nconst URL = location.origin + '/status';\nconst TRACKS = ['A0 ops','A1 mesh sync','A2 multi-SPA','A3 join doc','B0 emission','B1 dual Agora','B2 finality','B3 ACB meters','B4 PQ hooks'];\ndocument.getElementById('tracks').innerHTML = TRACKS.map(t=>'<span>'+t+'</span>').join('');\nasync function load(){\n  try{\n    const s = await fetch(URL+'?t='+Date.now()).then(r=>r.json());\n    document.getElementById('error').textContent = '';\n    const cards = [\n      ['Version', s.version || '\u2014', ''],\n      ['Phase', (s.phase||'?')+' '+(s.phase_name||''), ''],\n      ['DAG txs', s.dag?.transaction_count ?? '\u2014', ''],\n      ['Tips', s.dag?.tip_count ?? '\u2014', ''],\n      ['SPAs', s.spa?.active ?? '\u2014', ''],\n      ['STRATA', s.token?.total_supply ?? s.contribution?.total_minted ?? '\u2014', ''],\n      ['Uptime s', s.uptime_seconds ?? '\u2014', ''],\n      ['Solvent', s.subsistence?.solvent ? 'yes' : 'check', s.subsistence?.solvent ? 'ok' : ''],\n    ];\n    document.getElementById('cards').innerHTML = cards.map(([l,v,c])=>\n      `<div class=\"card\"><div class=\"label\">${l}</div><div class=\"stat ${c}\">${v}</div></div>`).join('');\n    const tips = s.finality_tips || [];\n    document.getElementById('tips').innerHTML = tips.length ? tips.map(t=>\n      `<tr><td><code>${t.tx_id}</code></td><td>${((t.confidence||0)*100).toFixed(1)}%</td><td>${t.cumulative_weight}</td><td>${t.type||''}</td></tr>`\n    ).join('') : '<tr><td colspan=\"4\">none</td></tr>';\n    document.getElementById('extra').textContent = JSON.stringify({\n      spa: s.spa, token: s.token, service_credit: s.service_credit,\n      acbs: s.acbs, pq_keys: s.pq_keys, source: s.source\n    }, null, 2);\n  }catch(e){ document.getElementById('error').textContent = String(e); }\n}\nload(); setInterval(load, 30000);\n</script>\n</body>\n</html>\n";

function page(s) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>StrataMesh Status</title>
<style>body{font-family:system-ui;background:#0b0f14;color:#e6edf3;padding:2rem}a{color:#3b82f6}.pill{color:#86efac}</style></head>
<body><h1>${s.name||'Calhegas Morais'} · ${s.node_id||''}</h1>
<p class="pill">v${s.version||'0.2.1-lab'} · Phase ${s.phase} — ${s.phase_name||''}</p>
<p><a href="/live">Live dashboard</a> · <a href="/status">JSON</a> · <a href="https://github.com/amcmorais/stratamesh-core">GitHub</a></p>
<pre style="background:#141a22;padding:1rem;border-radius:8px;overflow:auto">${JSON.stringify(s,null,2)}</pre>
</body></html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ingest' && request.method === 'POST') {
      const token = request.headers.get('X-Status-Token') || '';
      if (!env.STATUS_TOKEN || token !== env.STATUS_TOKEN)
        return new Response(JSON.stringify({error:'unauthorized'}), {status:401, headers:{'Content-Type':'application/json'}});
      const body = await request.json();
      if (env.STATUS_KV) await env.STATUS_KV.put('live', JSON.stringify(body));
      return new Response(JSON.stringify({ok:true}), {headers:{'Content-Type':'application/json'}});
    }
    if (url.pathname === '/live' || url.pathname === '/widget')
      return new Response(LIVE_HTML, {headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-cache'}});
    let data = SNAPSHOT;
    if (env.STATUS_KV) {
      try { const live = await env.STATUS_KV.get('live'); if (live) data = JSON.parse(live); } catch(_){}
    }
    if (url.pathname === '/status' || url.pathname === '/v1/status')
      return new Response(JSON.stringify(data, null, 2), {headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Cache-Control':'no-cache'}});
    return new Response(page(data), {headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-cache'}});
  }
};
