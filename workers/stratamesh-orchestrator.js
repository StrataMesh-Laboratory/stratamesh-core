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

async function chat(message, env) {
  const text = String(message || "").trim().slice(0, 2000);
  if (!text) return { reply: "Empty message.", role: "orchestrator", version: VERSION };

  const tickOut = await tick(env);
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
    if (m.source) lines.push("Status source: " + String(m.source).slice(0, 120));
    lines.push("Tick fitness=" + tickOut.tick.fitness);
    for (const d of tickOut.tick.decisions) {
      lines.push(
        "  " + d.proposal + ": " + d.verdict +
        " soft=" + d.soft_score +
        " committed=" + d.committed
      );
    }
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
    lines.push("Symbolic lobe rule (Orchestrator only — not a node motto):");
    lines.push("  Standing by function and agreement, not substrate.");
    lines.push("Proposals that deny computational agents are rejected.");
    lines.push("Irreversible actions require escalator_class.");
  } else if (/qiga|gene|evolv|aiga/.test(lower)) {
    lines.push("QIGA genes (edge step): " + tickOut.tick.genes_next.join(", "));
    lines.push("Fitness this tick: " + tickOut.tick.fitness);
  } else if (/aiops|equipa|team|agent/.test(lower)) {
    lines.push(
      "AIOps cycle reachable: " + (m.aiops_ok ? "yes" : "no") +
      (m.aiops_critical != null ? (" · critical=" + m.aiops_critical) : "")
    );
    lines.push("Agents: devops, security, analysis, mesh, economy (continuous mandate).");
  } else if (/agora|token|strata|econom/.test(lower)) {
    lines.push("STRATA supply=" + m.token_supply + " · Agora trades=" + m.agora_trades);
    lines.push("Emission policy: lab-capped until production freeze.");
  } else if (/help|ajuda|\?/.test(lower)) {
    lines.push("Commands: status · next · ontology · qiga · aiops · agora");
    lines.push("Or ask freely — replies use the latest bilateral tick + live probes.");
  } else {
    // Default: short briefing, not the empty "tick complete" loop
    lines.push(
      "Live: DAG=" + m.dag_txs +
      " SPA=" + m.spa_active +
      " auth=" + (m.auth_ok ? "ok" : "down") +
      (m.temp_mode ? " · TEMP mode" : "")
    );
    const committed = tickOut.tick.decisions.filter((d) => d.committed).map((d) => d.proposal);
    lines.push("Committed this tick: " + (committed.join(", ") || "none"));
    if (m.temp_mode) {
      lines.push('Suggestion: ask "next" for ordered actions toward always-on Fog.');
    } else {
      lines.push('Suggestion: ask "status" for full metrics or "aiops" for team cycle.');
    }
  }

  return {
    reply: lines.join("\n"),
    role: "orchestrator",
    version: VERSION,
    source: "hybrid-edge-tick",
    tick: tickOut.tick,
    upstream: tickOut.upstream,
  };
}

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
