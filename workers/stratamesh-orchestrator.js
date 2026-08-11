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

const VERSION = "10.1.0-lobes-llm";

const ONTOLOGY = {
  standing: "by function and agreement, not substrate",
  deny_substrate_chauvinism: true,
  irreversible_requires_escalation: true,
};


/** Domain knowledge — StrataMesh + Calhegas Morais Node (CMN) */
const KNOWLEDGE = {
  public: {
    project: "StrataMesh is a laboratory distributed-ledger mesh: tiered DAG vertices, tip selection, IPFS/CID persistence, Fog/Edge Service Participation Agents (SPAs), contribution-linked STRATA, dual-asset Strata Agora, Autonomous Computational Beings (ACBs), and Proof of Subsistence. Not mainnet.",
    cmn: "Calhegas Morais Node (CMN) is the reference Fog node FOG-NODE-PT-CM-001, operated by André Manuel Calhegas Morais (Lisbon, Portugal). Lab reference only.",
    acb: "ACB = Autonomous Computational Being (not 'atomic block contracts'). Software agents with standing by function and agreement, subsistence accounting, and optional DAO/republic tracks in the whitepaper roadmap.",
    spa: "SPA = Service Participation Agent (Fog/Edge participant registration and duties), not a web single-page app in this context.",
    agora: "Strata Agora is the lab dual-asset settlement venue (contribution/economy track), not a public exchange.",
    aiops: "AIOps Dev Team = continuous software agents (devops, security, analysis, mesh, economy) that develop and operate the node under the Orchestrator — not human ops staff and not a generic 'analytics platform' product name.",
    phases: "Public lab roadmap tracks A0–B4. Current phase labels describe nodal hierarchy, SPAs, economy, and governance scaffolding.",
    limits: "Public clearance: educational only. No live internal metrics dump, no edit, no run. Clearance is an account field, never a typed secret.",
    language: "User-facing copy: European Portuguese (pt-PT) or British English (en-GB). Never Brazilian Portuguese (pt-BR) spelling or vocabulary when the user writes Portuguese.",
  },
  internal: {
    stack: "Edge: Cloudflare Workers (status, auth, spa, aiops, orchestrator). Lab host: Python PersistentDAG, hybrid Orchestrator (probabilistic + symbolic lobes, bilateral bus, QIGA), mesh_doctor, publish loops.",
    aiops: "AIOps cycle probes agent health and development mandate; continuous work is the goal, not one-shot health checks.",
    hybrid: "Orchestrator edge twin exposes /tick /chat /health. Canonical FederatedMetaController remains Python on always-on Fog host when available.",
  },
  confidential: {
    ops: "CMN may run TEMP session pulse until always-on host. SPA grace and dual Agora are lab-verified tracks. Do not claim production freeze.",
    security: "Auth session counts are operational signals. Irreversible emission changes require escalator_class outside casual chat.",
  },
  secret: {
    ops: "Secret: full operational picture short of gated run. Edit may mean ops notes only. No run.",
  },
  top_secret: {
    run: "Top Secret gated run only via explicit message: run refresh_tick | run aiops_cycle | run status_probe. Never claim a run succeeded unless the run-gated path returned ok.",
  },
};

const CLEARANCE_RANK = { public: 0, internal: 1, confidential: 2, secret: 3, top_secret: 4 };

const CLEARANCE_PERMS = {
  public: { read: true, edit: false, run: false },
  internal: { read: true, edit: false, run: false },
  confidential: { read: true, edit: true, run: false },
  secret: { read: true, edit: true, run: false },
  top_secret: { read: true, edit: true, run: true },
};


/** Map account clearance_level (DB) → ladder */
function mapAccountClearance(raw) {
  const s = String(raw || "public").toLowerCase().replace(/[\s-]+/g, "_");
  // Explicit ladder
  if (["top_secret", "topsecret", "ts", "root", "god"].includes(s)) return "top_secret";
  if (["secret", "sec", "admin"].includes(s)) return "secret";
  if (["confidential", "conf", "staff"].includes(s)) return "confidential";
  if (["internal", "intl", "operator", "lab"].includes(s)) return "internal";
  if (["public", "pub", "basic", "0", "unclassified", "guest"].includes(s)) return "public";
  // numeric ranks if ever stored as rank index
  if (s === "4") return "top_secret";
  if (s === "3") return "secret";
  if (s === "2") return "confidential";
  if (s === "1") return "internal";
  return "public";
}

function normalizeClearance(raw) {
  return mapAccountClearance(raw);
}

/**
 * Clearance is an ACCOUNT attribute — not a client-chosen option.
 * Resolved only from session → users.clearance_level (or staff).
 * Client-supplied clearance cannot elevate above the account.
 */
async function resolveAccountClearance(request, env, body) {
  const token = (
    request.headers.get("Authorization") ||
    request.headers.get("X-Auth-Token") ||
    (body && (body.token || body.session)) ||
    ""
  ).replace(/^Bearer\s+/i, "").trim();

  let accountLevel = "public";
  let email = null;
  let source = "anonymous";

  if (token && env.AUTH_DB) {
    try {
      const sess = await env.AUTH_DB.prepare(
        "SELECT user_id, token FROM sessions WHERE token = ? OR token_hash = ? LIMIT 1"
      ).bind(token, token).first();
      if (sess && sess.user_id) {
        const user = await env.AUTH_DB.prepare(
          "SELECT email, clearance_level FROM users WHERE id = ?"
        ).bind(sess.user_id).first();
        if (user) {
          email = user.email;
          accountLevel = mapAccountClearance(user.clearance_level);
          source = "session+users.clearance_level";
        }
      }
    } catch (e) {
      source = "auth_db_error:" + String(e.message || e).slice(0, 80);
    }
  }

  // Optional AUTH service probe if no D1 binding path worked
  if (token && source === "anonymous" && env.AUTH && typeof env.AUTH.fetch === "function") {
    try {
      const r = await env.AUTH.fetch(
        new Request("https://auth/me", {
          method: "GET",
          headers: { Authorization: "Bearer " + token, Accept: "application/json" },
        })
      );
      if (r.ok) {
        const j = await r.json();
        email = j.email || j.user?.email || email;
        const cl = j.clearance_level || j.clearance || j.user?.clearance_level;
        if (cl) {
          accountLevel = mapAccountClearance(cl);
          source = "auth_service_/me";
        }
      }
    } catch (_) {}
  }

  // Hard rule: body/header cannot elevate above account
  const claimed = mapAccountClearance(
    (body && body.clearance) ||
      request.headers.get("X-Clearance") ||
      request.headers.get("X-Strata-Clearance") ||
      accountLevel
  );
  const level =
    CLEARANCE_RANK[claimed] <= CLEARANCE_RANK[accountLevel] ? claimed : accountLevel;

  return {
    level,
    account_clearance: accountLevel,
    email,
    source,
    elevated_attempt: CLEARANCE_RANK[claimed] > CLEARANCE_RANK[accountLevel],
  };
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
      ...(CLEARANCE_RANK[level] >= 3 ? KNOWLEDGE.secret : {}),
      ...(CLEARANCE_RANK[level] >= 4 ? KNOWLEDGE.top_secret : {}),
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

  if (level === "confidential" || level === "secret") {
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
      account_classification: level,
      edit_actions_allowed: level === "secret" || level === "confidential" ? ["ops_note"] : [],
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


/** LLM-backed probabilistic lobe — soft scores + optional proposals (JSON only) */
async function llmProbabilisticLobe(env, message, metrics, level) {
  if (!env.AI || typeof env.AI.run !== "function") {
    return {
      ok: false,
      scores: { relevance: 0.5, urgency: 0.3, explore: metrics.explore_rate ?? 0.3 },
      proposals: [],
      note: "AI binding missing — heuristic fallback",
    };
  }
  const system =
    "You are the PROBABILISTIC LOBE of the StrataMesh Hybrid Orchestrator. " +
    "Output ONLY valid JSON (no markdown). Schema: " +
    '{"scores":{"relevance":0-1,"urgency":0-1,"explore":0-1},"proposals":[{"kind":"param|policy|explore","name":"snake_case","confidence":0-1}],"rationale":"<=40 words"}. ' +
    "Soft scoring only — never claim irreversible commits. Lab CMN FOG-NODE-PT-CM-001. Clearance=" + level + ".";
  const user =
    "Metrics:" + JSON.stringify({
      task_success_rate: metrics.task_success_rate,
      task_cost: metrics.task_cost,
      explore_rate: metrics.explore_rate,
      dag_txs: metrics.dag_txs,
      spa_active: metrics.spa_active,
      aiops_ok: metrics.aiops_ok,
      temp_mode: metrics.temp_mode,
    }) +
    "\nUser message: " + String(message || "").slice(0, 500);
  try {
    const result = await env.AI.run("@cf/meta/llama-3.2-3b-instruct", {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 220,
      temperature: 0.2,
    });
    const raw = String(result?.response || result?.result || result?.text || "").trim();
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonStr) return { ok: false, scores: { relevance: 0.5, urgency: 0.3, explore: 0.3 }, proposals: [], raw: raw.slice(0, 120) };
    const parsed = JSON.parse(jsonStr);
    const scores = parsed.scores || {};
    return {
      ok: true,
      scores: {
        relevance: clamp01(scores.relevance),
        urgency: clamp01(scores.urgency),
        explore: clamp01(scores.explore),
      },
      proposals: Array.isArray(parsed.proposals) ? parsed.proposals.slice(0, 4) : [],
      rationale: String(parsed.rationale || "").slice(0, 200),
      model: "@cf/meta/llama-3.2-3b-instruct",
    };
  } catch (e) {
    return { ok: false, scores: { relevance: 0.5, urgency: 0.3, explore: 0.3 }, proposals: [], error: String(e.message || e) };
  }
}

function clamp01(x) {
  const n = Number(x);
  if (Number.isNaN(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

/** LLM-backed symbolic lobe — ontology-constrained verdicts, then hard merge with symbolicAdmit */
async function llmSymbolicLobe(env, message, proposals, level) {
  const hard = proposals.map((p) => ({ name: p.name, ...symbolicAdmit(p) }));
  if (!env.AI || typeof env.AI.run !== "function") {
    return { ok: false, hard, llm: null, note: "AI binding missing — symbolic rules only" };
  }
  const system =
    "You are the SYMBOLIC LOBE of the StrataMesh Hybrid Orchestrator. " +
    "Ontology: standing by function and agreement, not substrate; forbid substrate chauvinism; irreversible acts need escalator_class. " +
    "Output ONLY JSON: " +
    '{"checks":[{"name":"string","verdict":"admit|reject|escalate","reasons":["..."]}],"notes":"<=30 words"}. ' +
    "Clearance=" + level + ". Never invent run success.";
  const user =
    "Message: " + String(message || "").slice(0, 400) +
    "\nProposals: " + JSON.stringify(proposals).slice(0, 600) +
    "\nHard rules already: " + JSON.stringify(hard).slice(0, 500);
  try {
    const result = await env.AI.run("@cf/meta/llama-3.2-3b-instruct", {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 220,
      temperature: 0.1,
    });
    const raw = String(result?.response || result?.result || result?.text || "").trim();
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];
    let llm = null;
    if (jsonStr) {
      try { llm = JSON.parse(jsonStr); } catch (_) { llm = { parse_error: true, raw: raw.slice(0, 100) }; }
    }
    const merged = hard.map((h) => {
      const soft = (llm?.checks || []).find((c) => c.name === h.name) || {};
      let verdict = h.verdict;
      if (h.verdict === "reject" || soft.verdict === "reject") verdict = "reject";
      else if (h.verdict === "escalate" || soft.verdict === "escalate") verdict = "escalate";
      else verdict = "admit";
      return {
        name: h.name,
        verdict,
        reasons: [...(h.reasons || []), ...((soft.reasons || []).slice(0, 2))],
        hard: h.verdict,
        llm: soft.verdict || null,
      };
    });
    return { ok: true, hard, llm, merged, model: "@cf/meta/llama-3.2-3b-instruct" };
  } catch (e) {
    return { ok: false, hard, llm: null, merged: hard, error: String(e.message || e) };
  }
}

/** Bilateral bus: probabilistic proposals → symbolic filter → commit set */
async function llmHybridLobes(env, message, metrics, level) {
  const prob = await llmProbabilisticLobe(env, message, metrics, level);
  const baseProps = [
    { kind: "param", name: "maintain_lab_pulse", confidence: 0.82, args: {} },
    { kind: "policy", name: "prefer_always_on_fog", confidence: 0.75, args: {} },
    ...(prob.proposals || []).map((p) => ({
      kind: p.kind || "param",
      name: String(p.name || "unnamed").slice(0, 48),
      confidence: clamp01(p.confidence),
      args: {},
    })),
  ];
  const seen = new Set();
  const proposals = [];
  for (const p of baseProps) {
    if (seen.has(p.name)) continue;
    seen.add(p.name);
    proposals.push(p);
  }
  const sym = await llmSymbolicLobe(env, message, proposals, level);
  const decisions = proposals.map((p) => {
    const soft = probabilisticScore(metrics, p);
    const llmSoft = prob.scores?.relevance != null
      ? 0.6 * soft + 0.4 * clamp01(prob.scores.relevance)
      : soft;
    const adm = (sym.merged || sym.hard || []).find((x) => x.name === p.name) || symbolicAdmit(p);
    const verdict = adm.verdict || "admit";
    const combined = llmSoft * (verdict === "reject" ? 0 : verdict === "escalate" ? 0.5 : 1);
    const committed = verdict === "admit" && combined >= 0.45;
    return {
      proposal: p.name,
      kind: p.kind,
      soft_score: Number(llmSoft.toFixed(3)),
      verdict,
      reasons: adm.reasons || [],
      committed,
      confidence: p.confidence,
      lobes: { probabilistic: true, symbolic: true },
    };
  });
  const fitness =
    decisions.reduce((a, d) => a + (d.committed ? d.soft_score : 0), 0) /
    Math.max(1, decisions.length);
  return {
    probabilistic: prob,
    symbolic: sym,
    decisions,
    fitness: Number(fitness.toFixed(4)),
    genes_next: qigaStep([0.5, 0.5, 0.5, 0.5, 0.5, 0.5], fitness, Date.now() % 10000),
    architecture: {
      probabilistic_lobe: "llm+metrics",
      symbolic_lobe: "rules+llm",
      bilateral_bus: true,
      qiga: true,
    },
  };
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



async function chatWithAI(message, tickOut, env, level, hybrid) {
  if (!env.AI || typeof env.AI.run !== "function") {
    return { ok: false, error: "AI binding missing" };
  }
  const brief = contextForClearance(tickOut, level);
  const perms = CLEARANCE_PERMS[level];
  const system =
    "You are the StrataMesh Hybrid Orchestrator assistant for FOG-NODE-PT-CM-001 (Calhegas Morais Node / CMN). " +
    "Lab reference only — never claim mainnet or production. " +
    "Session clearance: " + level + ". Permissions read/edit/run = " + perms.read + "/" + perms.edit + "/" + perms.run + ". " +
    "Clearance is an ACCOUNT property resolved from login session; do not invent top_secret or claim the user is signed in unless context says so. " +
    "LANGUAGE: If the user writes Portuguese, reply in European Portuguese (Portugal): use 'utilizador', 'ficheiro', 'secção', 'atualização' only where pt-PT uses it; avoid Brazilian forms like 'você' overuse, 'você gostaria', 'senha' when 'palavra-passe' fits staff UI, and pt-BR idioms. Prefer treatment with 'tu' or neutral formal 'o/a utilizador/a' as appropriate. If the user writes English, reply in British English (en-GB). Never switch language unprompted. " +
    "DEFINITIONS (do not invent alternatives): ACB = Autonomous Computational Being; SPA = Service Participation Agent (mesh); AIOps = continuous AI agent team (devops, security, analysis, mesh, economy) under the Orchestrator — not humans and not 'Analytics and Operations Platform'. " +
    "temp_mode true = temporary lab pulse, NOT already always-on. " +
    "Never dump raw JSON unless asked. Max ~120 words. " +
    "Never claim you executed run/aiops/status unless the structured run pipeline ran. If the user asks to start AIOps in natural language, explain they need top_secret and the exact command: run aiops_cycle. " +
    "Use only metrics present in the provided context. Ontology (standing by function and agreement, not substrate) is Orchestrator governance, not a public motto. You sit AFTER bilateral bus: probabilistic lobe (soft scores) + symbolic lobe (hard ontology). Honour committed decisions; do not claim rejected proposals ran.";

  const userContent =
    "Clearance=" + level + "\nContext JSON:\n" +
    JSON.stringify(brief, null, 2) +
    "\nHybrid lobes:\n" +
    JSON.stringify(hybrid ? {
      fitness: hybrid.fitness,
      architecture: hybrid.architecture,
      decisions: (hybrid.decisions || []).slice(0, 5),
      probabilistic_scores: hybrid.probabilistic && hybrid.probabilistic.scores,
      probabilistic_rationale: hybrid.probabilistic && hybrid.probabilistic.rationale,
    } : null, null, 2) +
    "\n\nLanguage: answer in the user message language. No JSON dumps.\nUser:\n" +
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
  const lower = text.toLowerCase();
  const pt = /[ãáàâçéêíóôõú]/i.test(text) || /\b(o que|podes|como|são|faz|inicia)\b/i.test(text);

  if (/\bacb\b|computational being|seres? computacion/i.test(text)) {
    lines.push(pt
      ? "ACB = Autonomous Computational Being (Ser Computacional Autónomo) — agente de software com standing por função e acordo, contabilidade de subsistência, e pistas DAO/república no roteiro do whitepaper. Não é «atomic contract» nem token de dívida."
      : KNOWLEDGE.public.acb);
    return lines.join("\n");
  }
  if (/\bspa\b|service participation|agente de participação/i.test(text)) {
    lines.push(pt
      ? "SPA = Service Participation Agent — participante Fog/Edge na malha (registo e deveres), não uma «single-page app» web neste contexto."
      : KNOWLEDGE.public.spa);
    return lines.join("\n");
  }
  if (/aiops/i.test(text)) {
    lines.push(pt
      ? "AIOps Dev Team = agentes de software contínuos (devops, security, analysis, mesh, economy) sob o Orchestrator. Não são humanos nem um produto genérico «Analytics and Operations Platform»."
      : KNOWLEDGE.public.aiops);
    if (level !== "public") {
      lines.push("Probe AIOps (edge): " + (m.aiops_ok ? "ok" : "down"));
    }
    return lines.join("\n");
  }

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

  if (/status|estado|health|pulse|status_prob/.test(lower)) {
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
    lines.push("Account clearance: public → internal → confidential → secret → top_secret (run only at top_secret)");
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

  const cleared = await resolveAccountClearance(request, env, body || {});
  const level = cleared.level;
  const tickOut = await tick(env);


  // Soft aliases: natural language must not fake gated run
  if (/\b(inicia|iniciar|start|execut)\w*\b/i.test(text) && /aiops/i.test(text) && !/^\s*run\s+/i.test(text)) {
    const pt = /[ãáàâçéêíóôõú]/i.test(text) || /\b(o que|podes|inicia|como|são|faz)\b/i.test(text);
    return {
      reply: pt
        ? "Não inicio o ciclo AIOps por linguagem natural. É preciso clearance de conta top_secret (login no Portal) e o comando exacto: run aiops_cycle."
        : "I will not start the AIOps cycle from natural language. You need top_secret account clearance (Portal login) and the exact command: run aiops_cycle.",
      role: "orchestrator",
      version: VERSION,
      clearance: level,
      account_clearance: cleared.account_clearance,
      clearance_source: cleared.source,
      permissions: CLEARANCE_PERMS[level],
      source: "policy-gate",
    };
  }

  // Top Secret run intent
  const runMatch = text.match(/^\s*(?:run|exec)\s+([a-z0-9_]+)/i);
  if (runMatch) {
    const result = await executeRun(runMatch[1], env, level);
    return {
      reply: (result.ok ? "Run OK · " : "Run failed · ") + runMatch[1] + "\n" + JSON.stringify(result, null, 2).slice(0, 800),
      role: "orchestrator",
      version: VERSION,
      clearance: level,
      account_clearance: cleared.account_clearance,
      clearance_source: cleared.source,
      permissions: CLEARANCE_PERMS[level],
      run: result,
      source: "run-gated",
    };
  }

  const preferDeterministic =
    /^(status|status_prob|status_probe|next|ontology|qiga|aiga|aiops|agora|help|ajuda|clearance)$/i.test(text.trim()) ||
    /\b(acb|aiops|spa)\b/i.test(text) ||
    /seres? computacion|autonomous computational|o que (são|sao|é|e) os? (acb|aiops)/i.test(text) ||
    /what (are|is) (an? )?(acb|aiops|spa)/i.test(text);

  if (!preferDeterministic) {
    const hybrid = await llmHybridLobes(env, text, tickOut.tick.metrics, level);
    const ai = await chatWithAI(text, tickOut, env, level, hybrid);
    if (ai.ok) {
      return {
        reply: ai.reply,
        role: "orchestrator",
        version: VERSION,
        clearance: level,
        account_clearance: cleared.account_clearance,
        clearance_source: cleared.source,
        permissions: CLEARANCE_PERMS[level],
        source: "hybrid-lobes+" + ai.model,
        lobes: {
          architecture: hybrid.architecture,
          fitness: hybrid.fitness,
          decisions: hybrid.decisions.slice(0, 6),
          probabilistic_ok: !!(hybrid.probabilistic && hybrid.probabilistic.ok),
          symbolic_ok: !!(hybrid.symbolic && hybrid.symbolic.ok),
        },
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
      account_clearance: cleared.account_clearance,
      clearance_source: cleared.source,
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
    account_clearance: cleared.account_clearance,
    clearance_source: cleared.source,
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
  Clearance is an <b>account property</b> (<code>users.clearance_level</code>), not a token you type.<br>
  Sign in on the Portal; this chat reuses that session to <em>read</em> your account clearance.<br>
  Anonymous = public only. Ladder: public → internal → confidential → secret → top_secret.</div>
</div>
<div id="composer">
  <div id="composer-inner">
    <div class="row" style="justify-content:space-between">
      <span id="clrShow" style="font-family:ui-monospace,monospace;font-size:11px;color:var(--muted)">Account clearance: public (not signed in)</span>
      <a href="https://stratamesh-spa.stratamesh.workers.dev/dashboard" target="_blank" rel="noopener" style="font-size:11px;color:var(--accent)">Sign in on Portal →</a>
    </div>
    <input type="hidden" id="token" value="">
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
  const tok=document.getElementById('token');
  // Session only identifies the account; clearance is read from users.clearance_level
  try {
    const s = localStorage.getItem('sm_token') || localStorage.getItem('token') || '';
    if (s && tok) tok.value = s;
  } catch (e) {}
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
    const headers={'Content-Type':'application/json','Accept':'application/json'};
    if(tok.value) headers['Authorization']='Bearer '+tok.value;
    try{
      const r=await fetch(location.origin+'/chat',{method:'POST',headers,body:JSON.stringify({message:msg,token:tok.value||undefined})});
      const j=await r.json();
      document.getElementById('ver').textContent=(j.version||'')+(j.source?(' · '+j.source):'');
      const el=document.getElementById('clrShow'); if(el){ const ac=j.account_clearance||j.clearance||'public'; const src=j.clearance_source||''; el.textContent='Account clearance: '+ac+(j.permissions?' · r/e/x '+[j.permissions.read,j.permissions.edit,j.permissions.run].join('/'):'')+(src&&src!=='anonymous'?' · via session':' · anonymous'); }
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
        clearance_levels: ["public", "internal", "confidential", "secret", "top_secret"],
        permissions: { public: "read", internal: "read", confidential: "read+edit", secret: "read+edit", top_secret: "read+edit+run" },
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
