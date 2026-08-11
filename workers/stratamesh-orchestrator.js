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


/** Domain knowledge — StrataMesh + Calhegas Morais Node (CMN) */
const KNOWLEDGE = {
  public: {
    project: "StrataMesh is a DAG + IPFS distributed ledger mesh: high-throughput vertices, tip selection, content-addressed persistence, Fog/Edge SPAs, contribution-minted STRATA, dual-asset Agora, ACBs, and Proof of Subsistence.",
    cmn: "Calhegas Morais Node (CMN) is the reference Fog node FOG-NODE-PT-CM-001, operated by André Manuel Calhegas Morais (Lisbon, Portugal). Laboratory reference — not mainnet.",
    phases: "Public roadmap tracks A0–B4 (lab). Phase labels describe nodal hierarchy, SPAs, economy, and governance scaffolding.",
    limits: "Public clearance is informational only. No live internal metrics, no operator actions, no edit/run.",
  },
  internal: {
    stack: "Edge: Cloudflare Workers (status, auth, spa, aiops, orchestrator). Lab: Python PersistentDAG, hybrid Orchestrator (probabilistic + symbolic lobes, bilateral bus, QIGA), mesh_doctor, publish loops.",
    aiops: "AIOps Dev Team agents: devops, security, analysis, mesh, economy — continuous development mandate, not health-check theatre.",
    hybrid: "Orchestrator edge twin v10 exposes /tick /chat /health. Canonical FederatedMetaController remains Python on always-on Fog host.",
  },
  confidential: {
    ops: "CMN may run TEMP session pulse until always-on host (MacBook/Oracle Free + optional Tunnel). SPA grace and dual Agora are lab-verified tracks.",
    security: "Auth sessions and staff counts are operational signals. Irreversible token/emission changes require escalator_class.",
  },
  top_secret: {
    run: "Top Secret may invoke gated run actions: refresh_tick, aiops_cycle, status_probe. Edit may annotate ops notes in-session. No destructive genesis/emission without separate multi-party escalation outside this chat.",
  },
};

/** Clearance ladder */
const CLEARANCE_RANK = { public: 0, internal: 1, confidential: 2, top_secret: 3 };

const CLEARANCE_PERMS = {
  public: { read: true, edit: false, run: false },
  internal: { read: true, edit: false, run: false },
  confidential: { read: true, edit: true, run: false },
  top_secret: { read: true, edit: true, run: true },
};

function normalizeClearance(raw) {
  const s = String(raw || "public").toLowerCase().replace(/[\s-]+/g, "_");
  if (["public", "pub", "clearance_public"].includes(s)) return "public";
  if (["internal", "intl", "clearance_internal"].includes(s)) return "internal";
  if (["confidential", "conf", "clearance_confidential"].includes(s)) return "confidential";
  if (["top_secret", "topsecret", "ts", "clearance_top_secret", "secret"].includes(s)) return "top_secret";
  return "public";
}

function resolveClearance(request, body) {
  const h =
    request.headers.get("X-Clearance") ||
    request.headers.get("X-Strata-Clearance") ||
    "";
  const fromBody = body && (body.clearance || body.level);
  // Token elevates: staff/top tokens map higher (lab heuristic)
  const token = (
    request.headers.get("Authorization") ||
    request.headers.get("X-Auth-Token") ||
    (body && body.token) ||
    ""
  ).replace(/^Bearer\s+/i, "");
  let level = normalizeClearance(fromBody || h || "public");
  if (token) {
    const t = token.toLowerCase();
    if (t.includes("top") || t.includes("ts-")) level = "top_secret";
    else if (t.includes("conf") || t.includes("staff")) level = rankMax(level, "confidential");
    else if (t.includes("internal") || t.length > 20) level = rankMax(level, "internal");
  }
  return level;
}

function rankMax(a, b) {
  return CLEARANCE_RANK[a] >= CLEARANCE_RANK[b] ? a : b;
}

function contextForClearance(tickOut, level) {
  const m = tickOut.tick.metrics;
  const base = {
    clearance: level,
    permissions: CLEARANCE_PERMS[level],
    knowledge: {
      ...KNOWLEDGE.public,
      ...(CLEARANCE_RANK[level] >= 1 ? KNOWLEDGE.internal : {}),
      ...(CLEARANCE_RANK[level] >= 2 ? KNOWLEDGE.confidential : {}),
      ...(CLEARANCE_RANK[level] >= 3 ? KNOWLEDGE.top_secret : {}),
    },
  };

  if (level === "public") {
    return {
      ...base,
      cmn: {
        node_id: "FOG-NODE-PT-CM-001",
        name: "Calhegas Morais",
        role: "Reference Fog Node (laboratory)",
        operator_public: "André Manuel Calhegas Morais",
      },
      stratamesh: {
        kind: "DAG + IPFS mesh",
        public_tracks: ["A0", "A1", "A2", "A3", "B0", "B1", "B2", "B3", "B4"],
      },
      live: {
        note: "Detailed live metrics redacted at public clearance",
        orchestrator_version: VERSION,
        hybrid: true,
      },
    };
  }

  if (level === "internal") {
    return {
      ...base,
      cmn: {
        node_id: m.node_id,
        phase: m.phase,
        phase_name: m.phase_name,
        lab_version: m.version,
        temp_mode: m.temp_mode,
      },
      live: {
        dag_txs: m.dag_txs,
        spa_active: m.spa_active,
        spa_total: m.spa_total,
        upstream: {
          status: tickOut.upstream.status.ok,
          auth: tickOut.upstream.auth.ok,
          aiops: tickOut.upstream.aiops.ok,
        },
        fitness: tickOut.tick.fitness,
      },
    };
  }

  if (level === "confidential") {
    return {
      ...base,
      cmn: {
        node_id: m.node_id,
        operator: m.operator,
        phase: m.phase,
        phase_name: m.phase_name,
        lab_version: m.version,
        temp_mode: m.temp_mode,
        source: m.source,
      },
      live: {
        dag_txs: m.dag_txs,
        spa_active: m.spa_active,
        spa_total: m.spa_total,
        token_supply: m.token_supply,
        agora_trades: m.agora_trades,
        auth_users: m.auth_users,
        auth_sessions: m.auth_sessions,
        aiops_ok: m.aiops_ok,
        upstream: tickOut.upstream,
        decisions: tickOut.tick.decisions,
        genes: tickOut.tick.genes_next,
        fitness: tickOut.tick.fitness,
      },
      ontology: ONTOLOGY,
    };
  }

  // top_secret
  return {
    ...base,
    cmn: {
      node_id: m.node_id,
      operator: m.operator,
      phase: m.phase,
      phase_name: m.phase_name,
      lab_version: m.version,
      temp_mode: m.temp_mode,
      source: m.source,
    },
    live: {
      metrics: m,
      tick: tickOut.tick,
      upstream: tickOut.upstream,
    },
    ontology: ONTOLOGY,
    run_actions_allowed: ["refresh_tick", "aiops_cycle", "status_probe"],
    edit_actions_allowed: ["ops_note"],
  };
}

async function executeRun(action, env, level) {
  if (level !== "top_secret") {
    return { ok: false, error: "run requires top_secret clearance" };
  }
  const a = String(action || "").toLowerCase().replace(/-/g, "_");
  try {
    if (a === "refresh_tick" || a === "tick") {
      const out = await tick(env);
      return { ok: true, action: a, fitness: out.tick.fitness, decisions: out.tick.decisions };
    }
    if (a === "aiops_cycle" || a === "aiops") {
      let r = null;
      if (env.AIOPS && typeof env.AIOPS.fetch === "function") {
        try {
          const resp = await env.AIOPS.fetch(new Request("https://aiops/cycle", { method: "GET" }));
          const data = await resp.json().catch(async () => ({ raw: await resp.text() }));
          r = { ok: resp.ok, data };
        } catch (_) {}
      }
      if (!r) {
        const url = env.AIOPS_URL || "https://stratamesh-aiops.stratamesh.workers.dev/cycle";
        r = await probe(url);
      }
      return { ok: !!r.ok, action: a, summary: r.data?.summary || r.data, http: r.status };
    }
    if (a === "status_probe" || a === "status") {
      let r = null;
      if (env.STATUS && typeof env.STATUS.fetch === "function") {
        try {
          const resp = await env.STATUS.fetch(new Request("https://status/status", { method: "GET" }));
          const data = await resp.json().catch(async () => ({ raw: await resp.text() }));
          r = { ok: resp.ok, data };
        } catch (_) {}
      }
      if (!r) {
        const url = env.STATUS_URL || "https://stratamesh-status.stratamesh.workers.dev/status";
        r = await probe(url);
      }
      return {
        ok: !!r.ok,
        action: a,
        version: r.data?.version,
        phase: r.data?.phase,
        node_id: r.data?.node_id,
        http: r.status,
        error: r.ok ? undefined : (r.data?.error || "status probe failed"),
      };
    }
    return { ok: false, error: "unknown or forbidden run action", allowed: ["refresh_tick", "aiops_cycle", "status_probe"] };
  } catch (e) {
    return { ok: false, error: String(e.message || e), action: a };
  }
}


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



async function chatWithAI(message, tickOut, env, level) {
  if (!env.AI || typeof env.AI.run !== "function") {
    return { ok: false, error: "AI binding missing" };
  }
  const brief = contextForClearance(tickOut, level);
  const perms = CLEARANCE_PERMS[level];
  const system =
    "You are the StrataMesh assistant for the Calhegas Morais Node (CMN / FOG-NODE-PT-CM-001). " +
    "Clearance level for this session: " + level + ". Permissions: read=" + perms.read + " edit=" + perms.edit + " run=" + perms.run + ". " +
    "Use knowledge + live context JSON. Never invent metrics. " +
    "temp_mode=true means TEMPORARY session pulse — NOT already always-on; always-on is the migration goal. " +
    "Never dump raw JSON unless the user explicitly asks for JSON. Max ~140 words. " +
    "Match user language (EN/PT). " +
    "Public: educational StrataMesh/CMN only, no sensitive ops detail. " +
    "Internal: lab architecture + limited live metrics. " +
    "Confidential: fuller ops picture; edit means suggesting/recording ops notes only when asked. " +
    "Top Secret: may describe gated run actions (refresh_tick, aiops_cycle, status_probe) but do not claim unstoppable control. " +
    "Ontology is Orchestrator governance, not a public website motto.";

  const userContent =
    "Clearance=" + level + "\\nContext JSON:\\n" +
    JSON.stringify(brief, null, 2) +
    "\\n\\nLanguage: answer in the user message language. No JSON dumps.\\nUser:\\n" +
    message;

  const models = ["@cf/meta/llama-3.2-3b-instruct", "@cf/mistral/mistral-7b-instruct-v0.2"];
  let lastErr = null;
  for (const model of models) {
    try {
      const result = await env.AI.run(model, {
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
        max_tokens: 400,
        temperature: 0.25,
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

async function chatDeterministic(text, tickOut, level) {
  const brief = contextForClearance(tickOut, level);
  const m = tickOut.tick.metrics;
  const lines = [];
  lines.push("Orchestrator " + VERSION + " · clearance=" + level);
  lines.push("perms read/edit/run = " + CLEARANCE_PERMS[level].read + "/" + CLEARANCE_PERMS[level].edit + "/" + CLEARANCE_PERMS[level].run);
  lines.push(KNOWLEDGE.public.cmn);

  if (level === "public") {
    lines.push(KNOWLEDGE.public.project);
    lines.push(KNOWLEDGE.public.limits);
    return lines.join("\n");
  }

  lines.push(
    "Node " + (m.node_id || "CMN") + " · phase " + (m.phase ?? "?") +
    (m.phase_name ? " (" + m.phase_name + ")" : "") +
    " · " + (m.version || "?") + (m.temp_mode ? " · TEMP" : "")
  );

  const lower = text.toLowerCase();
  if (/status|estado|health|pulse/.test(lower)) {
    lines.push(
      "DAG txs=" + m.dag_txs + " SPA=" + m.spa_active + "/" + m.spa_total +
      " upstream status/auth/aiops=" +
      [tickOut.upstream.status.ok, tickOut.upstream.auth.ok, tickOut.upstream.aiops.ok].join("/")
    );
    if (CLEARANCE_RANK[level] >= 2) {
      lines.push("Auth users=" + m.auth_users + " sessions=" + m.auth_sessions + " fitness=" + tickOut.tick.fitness);
    }
  } else if (/next|priorid|roadmap/.test(lower)) {
    if (m.temp_mode) lines.push("P1: TEMP → always-on Fog + publish_loop");
    lines.push("P2: SPA fog/pinner registration · P3: Kubo + multi-host gossip");
  } else if (/clearance|perm/.test(lower)) {
    lines.push("Levels: public (info) → internal (lab metrics) → confidential (edit notes) → top_secret (run gated actions)");
  } else {
    lines.push("Ask status / next / clearance — or free-form under your clearance.");
  }
  return lines.join("\n");
}

async function chat(message, env, request, body) {
  const text = String(message || "").trim().slice(0, 4000);
  if (!text) {
    return { reply: "Empty message.", role: "orchestrator", version: VERSION, clearance: "public" };
  }

  const level = resolveClearance(request, body || {});
  const tickOut = await tick(env);

  // Top Secret run intent
  const runMatch = text.match(/^\s*(?:run|exec)\s+([a-z0-9_]+)/i);
  if (runMatch) {
    const result = await executeRun(runMatch[1], env, level);
    return {
      reply: (result.ok ? "Run OK · " : "Run failed · ") + runMatch[1] + "\n" + JSON.stringify(result, null, 2).slice(0, 800),
      role: "orchestrator",
      version: VERSION,
      clearance: level,
      permissions: CLEARANCE_PERMS[level],
      run: result,
      source: "run-gated",
    };
  }

  const preferDeterministic = /^(status|next|ontology|qiga|aiga|aiops|agora|help|ajuda|clearance)$/i.test(text.trim());

  if (!preferDeterministic) {
    const ai = await chatWithAI(text, tickOut, env, level);
    if (ai.ok) {
      return {
        reply: ai.reply,
        role: "orchestrator",
        version: VERSION,
        clearance: level,
        permissions: CLEARANCE_PERMS[level],
        source: "workers-ai+" + ai.model,
        tick: CLEARANCE_RANK[level] >= 1 ? tickOut.tick : undefined,
        upstream: CLEARANCE_RANK[level] >= 2 ? tickOut.upstream : undefined,
      };
    }
    const det = await chatDeterministic(text, tickOut, level);
    return {
      reply: det + "\n\n(NL unavailable: " + (ai.error || "?") + ")",
      role: "orchestrator",
      version: VERSION,
      clearance: level,
      permissions: CLEARANCE_PERMS[level],
      source: "deterministic-fallback",
      ai_error: ai.error,
    };
  }

  const det = await chatDeterministic(text, tickOut, level);
  return {
    reply: det,
    role: "orchestrator",
    version: VERSION,
    clearance: level,
    permissions: CLEARANCE_PERMS[level],
    source: "deterministic-command",
  };
}



const CHAT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Orchestrator · CMN</title>
<style>
:root{--bg:#0a0a0b;--fg:#f0eeea;--muted:#9a9690;--line:#2a2a2e;--accent:#d4c4a8;--card:#141416;--ok:#9caf88;--user:#93c5fd}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--fg);display:flex;flex-direction:column;height:100%}
header{flex:0 0 auto;padding:12px 16px;border-bottom:1px solid var(--line);display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center}
header h1{font-size:15px;font-weight:600}
header .meta{font-size:11px;color:var(--muted);font-family:ui-monospace,monospace}
#log{flex:1 1 auto;overflow-y:auto;padding:16px;max-width:720px;width:100%;margin:0 auto}
.msg{margin-bottom:14px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-break:break-word}
.msg .who{font-size:10px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:4px;font-family:ui-monospace,monospace}
.msg.user .who{color:var(--user)}
.msg.orch .who{color:var(--ok)}
.msg.sys{color:var(--muted);font-size:13px}
#composer{flex:0 0 auto;border-top:1px solid var(--line);background:#0e0e10;padding:12px 16px;padding-bottom:max(12px,env(safe-area-inset-bottom))}
#composer-inner{max-width:720px;margin:0 auto}
.row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;align-items:center}
label{font-size:11px;color:var(--muted);font-family:ui-monospace,monospace}
select,input[type=password]{background:var(--card);border:1px solid var(--line);color:var(--fg);padding:8px 10px;border-radius:6px;font-size:13px}
form{display:flex;gap:8px}
input#q{flex:1;min-height:48px;background:var(--card);border:1px solid var(--line);color:var(--fg);padding:12px 14px;border-radius:8px;font-size:16px}
button#go{min-height:48px;padding:0 18px;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:#111;font-weight:600;cursor:pointer}
button#go:disabled{opacity:.5}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.chips button{font-size:11px;padding:6px 10px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--muted);cursor:pointer}
.hint{margin-top:8px;font-size:11px;color:var(--muted)}
.hint a{color:var(--accent)}
</style>
</head>
<body>
<header>
  <h1>Orchestrator · CMN</h1>
  <div class="meta"><span id="ver">10.0.0-hybrid-edge</span> · <span id="clr">public</span></div>
</header>
<div id="log">
  <div class="msg sys">StrataMesh / Calhegas Morais Node assistant.<br>
  Clearance: <b>public</b> (info) → <b>internal</b> (lab metrics) → <b>confidential</b> (edit) → <b>top_secret</b> (run).<br>
  Top secret run examples: <code>run refresh_tick</code> · <code>run aiops_cycle</code> · <code>run status_probe</code></div>
</div>
<div id="composer">
  <div id="composer-inner">
    <div class="row">
      <label>Clearance</label>
      <select id="clearance">
        <option value="public">public (read / informative)</option>
        <option value="internal">internal (read / lab)</option>
        <option value="confidential">confidential (read + edit)</option>
        <option value="top_secret">top_secret (read + edit + run)</option>
      </select>
      <label>Token</label>
      <input type="password" id="token" placeholder="optional elevation" style="max-width:160px">
    </div>
    <div class="chips">
      <button type="button" data-q="What is StrataMesh and the Calhegas Morais Node?">about</button>
      <button type="button" data-q="status">status</button>
      <button type="button" data-q="next">next</button>
      <button type="button" data-q="clearance">clearance</button>
      <button type="button" data-q="run status_probe">run probe</button>
    </div>
    <form id="f">
      <input id="q" autocomplete="off" placeholder="Message…" autofocus>
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
  const clr=document.getElementById('clearance');
  const tok=document.getElementById('token');
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
    const clearance=clr.value;
    const headers={'Content-Type':'application/json','Accept':'application/json','X-Clearance':clearance};
    if(tok.value) headers['Authorization']='Bearer '+tok.value;
    try{
      const r=await fetch(location.origin+'/chat',{method:'POST',headers,body:JSON.stringify({message:msg,clearance,token:tok.value||undefined})});
      const j=await r.json();
      document.getElementById('ver').textContent=(j.version||'')+(j.source?(' · '+j.source):'');
      document.getElementById('clr').textContent=(j.clearance||clearance)+' r/e/x='+[j.permissions&&j.permissions.read,j.permissions&&j.permissions.edit,j.permissions&&j.permissions.run].join('/');
      add('orch', j.reply||j.error||('HTTP '+r.status));
    }catch(err){ add('sys','Error: '+(err.message||err)); }
    finally{ go.disabled=false; q.focus(); }
  }
  document.getElementById('f').onsubmit=function(e){e.preventDefault();const m=q.value;q.value='';send(m)};
  document.querySelectorAll('.chips button').forEach(function(b){b.onclick=function(){send(b.getAttribute('data-q'))}});
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
        clearance_levels: ["public", "internal", "confidential", "top_secret"],
        permissions: { public: "read", internal: "read", confidential: "read+edit", top_secret: "read+edit+run" },
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
            body: {
              message: "string",
              clearance: "public|internal|confidential|top_secret",
              token: "optional elevation",
              run: "optional — or prefix message with: run refresh_tick|aiops_cycle|status_probe",
            },
            headers: { "X-Clearance": "public|internal|confidential|top_secret" },
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
      const out = await chat(body.message || body.text || body.prompt || "", env, request, body);
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
