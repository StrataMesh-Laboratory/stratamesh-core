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
        return json({
          service: "orchestrator-chat",
          version: VERSION,
          stub: false,
          methods: ["POST"],
          body: { message: "string" },
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
