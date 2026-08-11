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

  async function viaBinding(binding, url) {
    if (!binding || typeof binding.fetch !== "function") return null;
    try {
      const r = await binding.fetch(new Request(url, { method: "GET", headers: { Accept: "application/json" } }));
      const text = await r.text();
      let data = null;
      try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 200) }; }
      return { ok: r.ok, status: r.status, data };
    } catch (_) {
      return null;
    }
  }

  let status = await viaBinding(env.STATUS, statusUrl);
  let auth = await viaBinding(env.AUTH, authUrl);
  let aiops = await viaBinding(env.AIOPS, aiopsUrl);

  if (!status) status = await probe(statusUrl);
  if (!auth) auth = await probe(authUrl);
  if (!aiops) aiops = await probe(aiopsUrl);

  // Status worker sometimes nests under different shapes
  const sd = status.data || {};
  const dag = sd.dag || sd.DAG || {};
  const spa = sd.spa || {};
  const token = sd.token || {};
  const agora = sd.agora || {};

  const metrics = {
    task_success_rate: status.ok ? 0.78 : 0.4,
    task_cost: 0.18,
    explore_rate: 0.32,
    dag_txs: dag.transaction_count ?? dag.txs ?? 0,
    spa_active: spa.active ?? 0,
    spa_total: spa.total ?? 0,
    token_supply: token.total_supply ?? token.balance ?? 0,
    agora_trades: agora.trades ?? 0,
    auth_ok: !!(auth && auth.ok),
    auth_users: auth?.data?.checks?.database?.users ?? null,
    auth_sessions: auth?.data?.checks?.sessions?.active ?? null,
    aiops_ok: !!(aiops && aiops.ok && aiops.data?.ok !== false),
    aiops_critical: aiops?.data?.summary?.critical ?? null,
    version: sd.version || sd.node_version || null,
    phase: sd.phase || null,
    phase_name: sd.phase_name || null,
    node_id: sd.node_id || "FOG-NODE-PT-CM-001",
    operator: sd.operator || "André Manuel Calhegas Morais",
    temp_mode: !!(sd.temp_mode || (sd.version && String(sd.version).includes("temp"))),
    source: sd.source || null,
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


async function buildContextBrief(tickOut) {
  const m = tickOut.tick.metrics;
  return {
    version: VERSION,
    node_id: m.node_id,
    operator: m.operator,
    phase: m.phase,
    phase_name: m.phase_name,
    lab_version: m.version,
    temp_mode: m.temp_mode,
    dag_txs: m.dag_txs,
    spa_active: m.spa_active,
    spa_total: m.spa_total,
    token_supply: m.token_supply,
    agora_trades: m.agora_trades,
    auth_ok: m.auth_ok,
    auth_users: m.auth_users,
    auth_sessions: m.auth_sessions,
    aiops_ok: m.aiops_ok,
    fitness: tickOut.tick.fitness,
    decisions: tickOut.tick.decisions,
    genes: tickOut.tick.genes_next,
    upstream: tickOut.upstream,
    ontology: ONTOLOGY,
  };
}

async function chatDeterministic(text, tickOut) {
  const m = tickOut.tick.metrics;
  const lower = text.toLowerCase();
  const lines = [];
  lines.push("Orchestrator " + VERSION + " · bilateral bus (edge twin)");
  lines.push(
    "Node " + (m.node_id || "?") +
    " · phase " + (m.phase ?? "?") +
    (m.phase_name ? " (" + m.phase_name + ")" : "") +
    " · " + (m.version || "version unknown")
  );

  if (/status|estado|health|tick|métrica|metrica|pulse|pulso/.test(lower)) {
    lines.push(
      "Upstream: status=" + (tickOut.upstream.status.ok ? "ok" : "down") +
      " auth=" + (tickOut.upstream.auth.ok ? "ok" : "down") +
      " aiops=" + (tickOut.upstream.aiops.ok ? "ok" : "down")
    );
    lines.push(
      "DAG txs=" + m.dag_txs +
      " · SPA active/total=" + m.spa_active + "/" + m.spa_total +
      " · STRATA supply=" + m.token_supply +
      " · Agora trades=" + m.agora_trades
    );
    if (m.auth_users != null) {
      lines.push("Auth users=" + m.auth_users + " · sessions=" + m.auth_sessions);
    }
    if (m.temp_mode) lines.push("Mode: TEMP pulse — promote to always-on Fog when ready.");
  } else if (/next|próxim|proxim|roadmap|fazer|todo|priorid/.test(lower)) {
    if (m.temp_mode) {
      lines.push("P1 DevOps: migrate Fog from TEMP session → MacBook/Oracle always-on + publish_loop.");
    } else {
      lines.push("P1 DevOps: keep publish_loop + AIOps continuous loop healthy.");
    }
    if ((m.spa_active || 0) < 1) {
      lines.push("P2 Mesh: register fog/pinner SPA — active SPAs is currently " + m.spa_active + ".");
    }
    lines.push("P3 Mesh: real Kubo pins + multi-host gossip.");
    lines.push("P4 Economy: lab emission remains capped until B0 production freeze.");
  } else if (/ontol|substrat|chauvin|função|funcao|standing/.test(lower)) {
    lines.push("Standing by function and agreement, not substrate (Orchestrator rule).");
    lines.push("Proposals that deny computational agents are rejected.");
  } else if (/qiga|gene|evolv|aiga/.test(lower)) {
    lines.push("QIGA genes: " + tickOut.tick.genes_next.join(", "));
    lines.push("Fitness: " + tickOut.tick.fitness);
  } else if (/aiops|equipa|team|agent/.test(lower)) {
    lines.push("AIOps reachable: " + (m.aiops_ok ? "yes" : "no"));
    lines.push("Agents: devops, security, analysis, mesh, economy.");
  } else if (/agora|token|strata|econom/.test(lower)) {
    lines.push("STRATA supply=" + m.token_supply + " · Agora trades=" + m.agora_trades);
  } else {
    lines.push(
      "Live: DAG=" + m.dag_txs +
      " SPA=" + m.spa_active +
      " auth=" + (m.auth_ok ? "ok" : "down") +
      (m.temp_mode ? " · TEMP mode" : "")
    );
    lines.push("Deterministic fallback (Workers AI unavailable). Try status / next / ontology.");
  }
  return lines.join("\n");
}

async function chatWithAI(message, tickOut, env) {
  if (!env.AI || typeof env.AI.run !== "function") {
    return { ok: false, error: "AI binding missing" };
  }
  const brief = await buildContextBrief(tickOut);
  const system =
    "You are the StrataMesh Hybrid Orchestrator (edge twin) for the Calhegas Morais Fog Node. " +
    "Operator: André Manuel Calhegas Morais. " +
    "You combine a probabilistic lobe and a symbolic lobe via a bilateral bus; QIGA evolves policy genes. " +
    "Rules: standing is by function and agreement, not substrate; never claim mainnet; lab reference only; " +
    "do not invent metrics — use the JSON context; be concise (max ~180 words); " +
    "reply in the user's language (Portuguese if they write Portuguese). " +
    "If asked what to do next, prioritize always-on Fog migration when temp_mode is true.";

  const userContent =
    "Live orchestrator context (JSON):\n" +
    JSON.stringify(brief, null, 2) +
    "\n\nUser message:\n" +
    message;

  const models = [
    "@cf/meta/llama-3.2-3b-instruct",
    "@cf/meta/llama-3.1-8b-instruct",
    "@cf/mistral/mistral-7b-instruct-v0.2",
  ];

  let lastErr = null;
  for (const model of models) {
    try {
      const result = await env.AI.run(model, {
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
        max_tokens: 512,
        temperature: 0.35,
      });
      const reply =
        (result && (result.response || result.result || result.text)) ||
        (typeof result === "string" ? result : null);
      if (reply && String(reply).trim()) {
        return { ok: true, reply: String(reply).trim(), model };
      }
      lastErr = "empty response from " + model;
    } catch (e) {
      lastErr = String(e.message || e);
    }
  }
  return { ok: false, error: lastErr || "all models failed" };
}

async function chat(message, env) {
  const text = String(message || "").trim().slice(0, 4000);
  if (!text) {
    return { reply: "Empty message.", role: "orchestrator", version: VERSION };
  }

  const tickOut = await tick(env);
  const preferDeterministic = /^(status|next|ontology|qiga|aiga|aiops|agora|help|ajuda)\\b/i.test(text);

  // Natural language path via Workers AI unless user issued a classic command
  if (!preferDeterministic) {
    const ai = await chatWithAI(text, tickOut, env);
    if (ai.ok) {
      return {
        reply: ai.reply,
        role: "orchestrator",
        version: VERSION,
        source: "workers-ai+" + ai.model,
        tick: tickOut.tick,
        upstream: tickOut.upstream,
      };
    }
    // fall through with note
    const det = await chatDeterministic(text, tickOut);
    return {
      reply: det + "\\n\\n(NL model unavailable: " + (ai.error || "unknown") + ")",
      role: "orchestrator",
      version: VERSION,
      source: "deterministic-fallback",
      tick: tickOut.tick,
      upstream: tickOut.upstream,
      ai_error: ai.error,
    };
  }

  const det = await chatDeterministic(text, tickOut);
  return {
    reply: det,
    role: "orchestrator",
    version: VERSION,
    source: "deterministic-command",
    tick: tickOut.tick,
    upstream: tickOut.upstream,
  };
}


const CHAT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Orchestrator · StrataMesh</title>
<style>
:root{--bg:#0a0a0b;--fg:#f0eeea;--muted:#9a9690;--line:#2a2a2e;--accent:#d4c4a8;--card:#141416;--ok:#9caf88;--user:#93c5fd}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--fg);display:flex;flex-direction:column;height:100%}
header{flex:0 0 auto;padding:14px 16px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center}
header h1{font-size:15px;font-weight:600;letter-spacing:.03em}
header span{font-size:11px;color:var(--muted);font-family:ui-monospace,monospace}
#log{flex:1 1 auto;overflow-y:auto;padding:16px;max-width:720px;width:100%;margin:0 auto}
.msg{margin-bottom:14px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-break:break-word}
.msg .who{font-size:10px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:4px;font-family:ui-monospace,monospace}
.msg.user .who{color:var(--user)}
.msg.orch .who{color:var(--ok)}
.msg.sys{color:var(--muted);font-size:13px}
#composer{flex:0 0 auto;border-top:1px solid var(--line);background:#0e0e10;padding:12px 16px;padding-bottom:max(12px,env(safe-area-inset-bottom))}
#composer-inner{max-width:720px;margin:0 auto}
form{display:flex;gap:8px;align-items:center}
input#q{flex:1;min-height:48px;background:var(--card);border:1px solid var(--line);color:var(--fg);padding:12px 14px;border-radius:8px;font-size:16px}
input#q:focus{outline:none;border-color:var(--accent)}
button#go{min-height:48px;padding:0 18px;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:#111;font-weight:600;font-size:14px;cursor:pointer}
button#go:disabled{opacity:.5;cursor:wait}
.hint{margin-top:8px;font-size:11px;color:var(--muted);font-family:ui-monospace,monospace}
.hint a{color:var(--accent)}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.chips button{font-size:11px;padding:6px 10px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--muted);cursor:pointer}
.chips button:hover{border-color:var(--accent);color:var(--accent)}
</style>
</head>
<body>
<header>
  <h1>Orchestrator</h1>
  <span id="ver">10.0.0-hybrid-edge</span>
</header>
<div id="log">
  <div class="msg sys">Hybrid Orchestrator + natural language (Workers AI).<br>Ask in PT or EN — or use chips for commands.</div>
</div>
<div id="composer">
  <div id="composer-inner">
    <div class="chips">
      <button type="button" data-q="status">status</button>
      <button type="button" data-q="next">next</button>
      <button type="button" data-q="ontology">ontology</button>
      <button type="button" data-q="qiga">qiga</button>
    </div>
    <form id="f">
      <input id="q" name="q" autocomplete="off" placeholder="Ask the Orchestrator…" autofocus>
      <button type="submit" id="go">Send</button>
    </form>
    <p class="hint"><a href="https://stratamesh-spa.stratamesh.workers.dev/dashboard">← Portal</a></p>
  </div>
</div>
<script>
(function(){
  const log=document.getElementById('log');
  const q=document.getElementById('q');
  const go=document.getElementById('go');
  const CHAT_API=location.origin+'/chat';
  function add(role,text){
    const d=document.createElement('div');
    d.className='msg '+role;
    const who=role==='user'?'You':role==='orch'?'Orchestrator':'';
    d.innerHTML=(who?'<div class="who">'+who+'</div>':'')+String(text).replace(/</g,'&lt;');
    log.appendChild(d);
    log.scrollTop=log.scrollHeight;
  }
  async function send(msg){
    msg=String(msg||'').trim();
    if(!msg)return;
    add('user',msg);
    go.disabled=true;
    try{
      const r=await fetch(CHAT_API,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({message:msg})});
      const j=await r.json();
      if(j.version) document.getElementById('ver').textContent=j.version+(j.source?(' · '+j.source):'');
      add('orch', j.reply||j.error||('HTTP '+r.status));
    }catch(err){
      add('sys','Error: '+(err.message||err));
    }finally{
      go.disabled=false;
      q.focus();
    }
  }
  document.getElementById('f').addEventListener('submit',function(e){
    e.preventDefault();
    const msg=q.value;
    q.value='';
    send(msg);
  });
  document.querySelectorAll('.chips button').forEach(function(b){
    b.addEventListener('click',function(){ send(b.getAttribute('data-q')); });
  });
  q.focus();
})();
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
