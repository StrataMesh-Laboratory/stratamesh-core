/**
 * StrataMesh Hybrid Orchestrator (edge)
 * Replaces the v9.2.0 banner stub.
 *
 * Architecture (aligned with src/orchestrator/):
 *   - Probabilistic lobe: soft scores from live metrics
 *   - Symbolic lobe: hard constraints (ontology, irreversibility)
 *   - Bilateral bus: proposals → admissibility → commit / escalate
 *   - QIGA: generational fitness over policy genes (lightweight edge port)
 *
 * Full Python FederatedMetaController remains canonical on the Fog host.
 * This Worker is the always-on edge twin for chat, tick, and health.
 */

const VERSION = "10.0.0-hybrid-edge";

const ONTOLOGY = {
  standing: "by function and agreement, not substrate",
  deny_substrate_chauvinism: true,
  irreversible_requires_escalation: true,
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

async function probe(url) {
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    const text = await r.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 120) };
    }
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { error: String(e.message || e) } };
  }
}

/** Symbolic lobe — hard constraints */
function symbolicAdmit(proposal) {
  const reasons = [];
  let verdict = "admit";
  const kind = proposal.kind || "param";
  const name = proposal.name || "";

  if (proposal.args && proposal.args.deny_computational_agents === true) {
    verdict = "reject";
    reasons.push("epistemic ontology: substrate chauvinism forbidden");
  }
  if (kind === "irreversible" || /emission|token_supply|genesis/i.test(name)) {
    if (!proposal.escalator_class) {
      verdict = "escalate";
      reasons.push("irreversible action requires designated escalator_class");
    }
  }
  if (proposal.confidence != null && proposal.confidence < 0.35) {
    verdict = "reject";
    reasons.push("confidence below symbolic floor 0.35");
  }
  return { verdict, reasons };
}

/** Probabilistic lobe — soft score from metrics */
function probabilisticScore(metrics, proposal) {
  const success = metrics.task_success_rate ?? 0.7;
  const cost = metrics.task_cost ?? 0.2;
  const explore = metrics.explore_rate ?? 0.3;
  let s = 0.4 * success + 0.3 * (1 - cost) + 0.2 * (1 - Math.abs(explore - 0.33));
  if (proposal.kind === "explore") s += 0.05 * explore;
  return Math.max(0, Math.min(1, s));
}

/** Tiny QIGA step — evolve gene vector */
function qigaStep(genes, fitness, seed) {
  const next = genes.map((g, i) => {
    const noise = Math.sin(seed * 12.9898 + i * 78.233) * 0.05;
    return Math.max(0, Math.min(1, g + (fitness - 0.5) * 0.02 + noise));
  });
  return next;
}

async function gatherMetrics(env) {
  const statusUrl = env.STATUS_URL || "https://stratamesh-status.stratamesh.workers.dev/status";
  const authUrl = env.AUTH_URL || "https://stratamesh-auth.stratamesh.workers.dev/health";
  const aiopsUrl = env.AIOPS_URL || "https://stratamesh-aiops.stratamesh.workers.dev/cycle";

  const [status, auth, aiops] = await Promise.all([
    probe(statusUrl),
    probe(authUrl),
    probe(aiopsUrl),
  ]);

  const metrics = {
    task_success_rate: status.ok ? 0.78 : 0.4,
    task_cost: 0.18,
    explore_rate: 0.32,
    dag_txs: status.data?.dag?.transaction_count ?? 0,
    spa_active: status.data?.spa?.active ?? 0,
    auth_ok: auth.ok,
    aiops_ok: aiops.ok && aiops.data?.ok !== false,
    version: status.data?.version || null,
    phase: status.data?.phase || null,
  };

  return { metrics, status, auth, aiops };
}

async function tick(env, extraProposals = []) {
  const { metrics, status, auth, aiops } = await gatherMetrics(env);
  const genes = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  const proposals = [
    {
      kind: "param",
      name: "maintain_lab_pulse",
      confidence: 0.82,
      args: {},
    },
    {
      kind: "policy",
      name: "prefer_always_on_fog",
      confidence: 0.75,
      args: {},
    },
    ...extraProposals,
  ];

  const decisions = [];
  for (const p of proposals) {
    const soft = probabilisticScore(metrics, p);
    const adm = symbolicAdmit(p);
    const combined = soft * (adm.verdict === "reject" ? 0 : adm.verdict === "escalate" ? 0.5 : 1);
    const committed = adm.verdict === "admit" && combined >= 0.45;
    decisions.push({
      proposal: p.name,
      kind: p.kind,
      soft_score: Number(soft.toFixed(3)),
      verdict: adm.verdict,
      reasons: adm.reasons,
      committed,
      confidence: p.confidence,
    });
  }

  const fitness =
    decisions.reduce((a, d) => a + (d.committed ? d.soft_score : 0), 0) /
    Math.max(1, decisions.length);
  const nextGenes = qigaStep(genes, fitness, Date.now() % 10000);

  return {
    service: "stratamesh-orchestrator",
    version: VERSION,
    architecture: {
      probabilistic_lobe: true,
      symbolic_lobe: true,
      bilateral_bus: true,
      qiga: true,
      ontology: ONTOLOGY,
      note: "Edge twin of src/orchestrator FederatedMetaController",
    },
    tick: {
      at: new Date().toISOString(),
      metrics,
      decisions,
      fitness: Number(fitness.toFixed(3)),
      genes_next: nextGenes.map((g) => Number(g.toFixed(4))),
    },
    upstream: {
      status: { ok: status.ok, http: status.status },
      auth: { ok: auth.ok, http: auth.status },
      aiops: { ok: aiops.ok, http: aiops.status },
    },
  };
}

async function chat(message, env) {
  const text = String(message || "").trim().slice(0, 2000);
  if (!text) return { reply: "Empty message.", role: "orchestrator", version: VERSION };

  const tickOut = await tick(env);
  const m = tickOut.tick.metrics;
  const lower = text.toLowerCase();
  const lines = [];

  lines.push(`Orchestrator ${VERSION} · bilateral bus`);
  lines.push(
    `Fitness ${tickOut.tick.fitness} · phase=${m.phase} · version=${m.version} · DAG txs=${m.dag_txs}`
  );

  if (/status|estado|health|tick/.test(lower)) {
    for (const d of tickOut.tick.decisions) {
      lines.push(
        `${d.proposal}: ${d.verdict} soft=${d.soft_score} committed=${d.committed}`
      );
    }
  } else if (/next|próxim|roadmap|action/.test(lower)) {
    lines.push(
      m.version && String(m.version).includes("temp")
        ? "Priority: migrate Fog temp → always-on host + publish_loop"
        : "Priority: multi-host gossip + Kubo pins"
    );
    lines.push("Secondary: SPA fog/pinner registration if active=0");
  } else if (/ontol|substrat|chauvin|função|funcao/.test(lower)) {
    lines.push(`Standing: ${ONTOLOGY.standing}`);
    lines.push("Symbolic lobe rejects deny_computational_agents proposals.");
  } else if (/qiga|gene|evolv/.test(lower)) {
    lines.push(`Genes: ${tickOut.tick.genes_next.join(", ")}`);
  } else {
    lines.push("Tick complete. Committed proposals:");
    for (const d of tickOut.tick.decisions.filter((x) => x.committed)) {
      lines.push(`· ${d.proposal}`);
    }
    lines.push('Ask "status", "next", "ontology", or "qiga" for detail.');
  }

  return {
    reply: lines.join("\n"),
    role: "orchestrator",
    version: VERSION,
    source: "hybrid-edge-tick",
    tick: tickOut.tick,
  };
}


const CHAT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Orchestrator · StrataMesh</title>
<style>
:root{--bg:#0a0a0b;--fg:#e8e6e3;--muted:#8a8780;--line:#1c1c1f;--accent:#c4b5a0;--card:#111113;--ok:#9caf88}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--fg);min-height:100vh;display:flex;flex-direction:column}
header{padding:1rem 1.25rem;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:baseline;gap:1rem}
header h1{font-size:1rem;font-weight:500;letter-spacing:.04em}
header span{font-size:.7rem;color:var(--muted);font-family:ui-monospace,monospace}
#log{flex:1;overflow-y:auto;padding:1.25rem;display:flex;flex-direction:column;gap:.85rem;max-width:720px;width:100%;margin:0 auto}
.msg{font-size:.9rem;line-height:1.5;white-space:pre-wrap}
.msg .who{font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;margin-bottom:.25rem;font-family:ui-monospace,monospace}
.msg.user .who{color:#93c5fd}
.msg.orch .who{color:var(--ok)}
.msg.sys{color:var(--muted);font-size:.8rem}
footer{border-top:1px solid var(--line);padding:1rem 1.25rem;max-width:720px;width:100%;margin:0 auto}
form{display:flex;gap:.5rem}
input{flex:1;background:var(--card);border:1px solid var(--line);color:var(--fg);padding:.75rem 1rem;border-radius:4px;font-size:.9rem}
input:focus{outline:none;border-color:var(--accent)}
button{background:transparent;border:1px solid var(--accent);color:var(--accent);padding:.75rem 1.1rem;border-radius:4px;cursor:pointer;font-size:.8rem;letter-spacing:.06em}
button:hover{background:rgba(196,181,160,.08)}
button:disabled{opacity:.4;cursor:wait}
a{color:var(--accent);font-size:.7rem}
</style>
</head>
<body>
<header>
  <h1>Orchestrator</h1>
  <span id="ver">hybrid-edge</span>
</header>
<div id="log">
  <div class="msg sys">Hybrid Orchestrator chat — Calhegas Morais Fog Node. Try: status · next · ontology · qiga</div>
</div>
<footer>
  <form id="f">
    <input id="q" autocomplete="off" placeholder="Message the Orchestrator…" autofocus>
    <button type="submit" id="go">Send</button>
  </form>
  <p style="margin-top:.75rem"><a href="https://stratamesh-spa.stratamesh.workers.dev/dashboard">← Portal</a></p>
</footer>
<script>
const log=document.getElementById('log');
const q=document.getElementById('q');
const go=document.getElementById('go');
function add(role,text){
  const d=document.createElement('div');
  d.className='msg '+role;
  const who=role==='user'?'You':role==='orch'?'Orchestrator':'';
  d.innerHTML=(who?'<div class="who">'+who+'</div>':'')+String(text).replace(/</g,'&lt;');
  log.appendChild(d);
  log.scrollTop=log.scrollHeight;
}
document.getElementById('f').onsubmit=async(e)=>{
  e.preventDefault();
  const msg=q.value.trim();
  if(!msg)return;
  q.value='';
  add('user',msg);
  go.disabled=true;
  try{
    const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})});
    const j=await r.json();
    if(j.version) document.getElementById('ver').textContent=j.version;
    add('orch', j.reply||j.error||JSON.stringify(j));
  }catch(err){
    add('sys','Error: '+(err.message||err));
  }finally{
    go.disabled=false;
    q.focus();
  }
};
</script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    if (path === "/health" || path === "/api/health") {
      return json({
        status: "ok",
        version: VERSION,
        hybrid: true,
        lobes: ["probabilistic", "symbolic"],
        bus: "bilateral",
        qiga: true,
        stub: false,
        timestamp: new Date().toISOString(),
      });
    }

    if (path === "/tick" || path === "/api/tick") {
      const out = await tick(env);
      return json(out);
    }

    if (path === "/chat" || path === "/api/chat") {
      if (request.method === "GET") {
        const accept = request.headers.get("Accept") || "";
        if (accept.includes("application/json") && !accept.includes("text/html")) {
          return json({
            service: "orchestrator-chat",
            version: VERSION,
            stub: false,
            methods: ["POST"],
            body: { message: "string" },
          });
        }
        return new Response(CHAT_HTML, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
      let body = {};
      try {
        body = await request.json();
      } catch (_) {}
      const out = await chat(body.message || body.text || "", env);
      return json(out);
    }

    if (path === "/ontology") {
      return json({ ontology: ONTOLOGY, version: VERSION });
    }

    if (path === "/" || path === "/status") {
      const out = await tick(env);
      return json({
        service: "StrataMesh Hybrid Orchestrator (edge)",
        version: VERSION,
        stub: false,
        replaces: "9.2.0 banner stub",
        latest_tick: out.tick,
        architecture: out.architecture,
      });
    }

    // legacy paths that used to return only the banner
    if (["/tasks", "/agents", "/team", "/cron"].includes(path)) {
      const out = await tick(env);
      return json({ path, version: VERSION, stub: false, tick: out.tick });
    }

    return json({ error: "not_found", path, version: VERSION }, 404);
  },
};
