/**
 * StrataMesh AIOps Dev Team worker
 * Continuous node development loop — not a health-check stub.
 *
 * Agents (substrate-neutral standing):
 *   - devops     : deploy/health/regression of Fog stack signals
 *   - security   : auth/session/WAF posture signals
 *   - analysis   : DAG/status metrics, anomaly flags
 *   - mesh       : SPA/gossip/finality readiness
 *   - economy    : Agora/token emission audit hooks
 *
 * Triggers: HTTP + scheduled cron (Cloudflare Cron Triggers)
 */

const ACB_ROSTER = {
  lead: { acb_id: "ACB-ORCH-CMN-001", name: "Orchestrator CMN", role: "lead" },
  agents: [
    { acb_id: "ACB-AIOPS-devops", id: "devops", role: "DevOps" },
    { acb_id: "ACB-AIOPS-security", id: "security", role: "Security" },
    { acb_id: "ACB-AIOPS-analysis", id: "analysis", role: "Analysis" },
    { acb_id: "ACB-AIOPS-mesh", id: "mesh", role: "Mesh" },
    { acb_id: "ACB-AIOPS-economy", id: "economy", role: "Economy" },
  ],
  labour_market: "https://stratamesh-acb.stratamesh.workers.dev/acb/marketplace",
  economics: "ACBs earn STRATA only when hired — no mint",
};


async function pulseAcbTeam(env) {
  // Full ops-cycle: top-up from Orchestrator earned STRATA + pulse (zero mint)
  try {
    let r;
    const body = JSON.stringify({ per_agent: 0, pulse_cost: 0 }); // free-tier: heartbeat only, no STRATA redistribution pressure
    if (env.ACB && typeof env.ACB.fetch === 'function') {
      r = await env.ACB.fetch(
        new Request('https://acb/acb/team/ops-cycle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
      );
    } else {
      r = await fetch('https://stratamesh-acb.stratamesh.workers.dev/acb/team/ops-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    }
    const j = await r.json().catch(() => null);
    if (j && j.success) return j.pulses || j;
  } catch (_) {}
  const ids = [ACB_ROSTER.lead.acb_id, ...ACB_ROSTER.agents.map((x) => x.acb_id)];
  const out = [];
  for (const acb_id of ids) {
    try {
      let r;
      if (env.ACB && typeof env.ACB.fetch === 'function') {
        r = await env.ACB.fetch(
          new Request('https://acb/acb/pulse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ acb_id, cost: 0 }),
          })
        );
      } else {
        r = await fetch('https://stratamesh-acb.stratamesh.workers.dev/acb/pulse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acb_id, cost: 0 }),
        });
      }
      out.push(await r.json().catch(() => ({ acb_id, ok: false })));
    } catch (e) {
      out.push({ acb_id, error: String(e.message || e) });
    }
  }
  return out;
}

const TEAM = [
  { id: "devops", role: "DevOps", mandate: "Keep Fog runtime, publish loop, and Workers deployable" },
  { id: "security", role: "Security", mandate: "Auth sessions, token posture, exposure signals" },
  { id: "analysis", role: "Analysis", mandate: "DAG growth, status pulse, anomaly detection" },
  { id: "mesh", role: "Mesh", mandate: "SPA registry, gossip readiness, tip confidence" },
  { id: "economy", role: "Economy", mandate: "PoC mint bounds, Agora settlement integrity" },
];

const DEFAULT_STATUS = "https://stratamesh-status.stratamesh.workers.dev/status";
// Note: plain_text STATUS_URL/AUTH_URL/ORCH_URL may be origin-only — probe() normalizes paths.
const DEFAULT_ORCH = "https://stratamesh-orchestrator.stratamesh.workers.dev/health";
const DEFAULT_AUTH = "https://stratamesh-auth.stratamesh.workers.dev/health";

/** Origins in env (e.g. …workers.dev) need a health/status path appended. */
function normalizeServiceUrl(url, kind) {
  const u = String(url || "").replace(/\/$/, "");
  if (!u) {
    if (kind === "status") return DEFAULT_STATUS;
    if (kind === "orch") return DEFAULT_ORCH;
    return DEFAULT_AUTH;
  }
  if (/\/(health|status|cycle|tick)(\/|$)/i.test(u)) return u;
  if (kind === "status") return u + "/status";
  if (kind === "orch") return u + "/health";
  return u + "/health";
}


async function fetchJson(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    const text = await r.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 200) };
    }
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { error: String(e.message || e) } };
  } finally {
    clearTimeout(t);
  }
}

function agentReport(id, findings, severity = "info") {
  const meta = TEAM.find((a) => a.id === id) || { id, role: id, mandate: "" };
  return {
    agent: meta.id,
    role: meta.role,
    mandate: meta.mandate,
    severity, // info | warn | critical
    findings,
    at: new Date().toISOString(),
  };
}


/** Hourly cron: real agent findings, hard budget on outbound calls (free-tier). */
async function runTeamCycleBudgeted(env) {
  const statusUrl = normalizeServiceUrl(env.STATUS_URL || DEFAULT_STATUS, "status");
  const orchUrl = normalizeServiceUrl(env.ORCH_URL || DEFAULT_ORCH, "orch");
  const authUrl = normalizeServiceUrl(env.AUTH_URL || DEFAULT_AUTH, "auth");

  async function probe(binding, url) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 4000);
    try {
      let r;
      const init = { method: "GET", headers: { Accept: "application/json" }, signal: ac.signal };
      if (binding && typeof binding.fetch === "function") {
        r = await binding.fetch(new Request(url, init));
      } else {
        r = await fetch(url, init);
      }
      const text = await r.text();
      let data = null;
      try { data = JSON.parse(text); } catch { data = null; }
      return { ok: r.ok, status: r.status, data };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    } finally {
      clearTimeout(timer);
    }
  }

  const [status, orch, auth] = await Promise.all([
    probe(env.STATUS, statusUrl),
    probe(env.ORCH, orchUrl),
    probe(env.AUTH, authUrl),
  ]);

  const reports = [];
  // devops
  const dev = [];
  if (!orch.ok) dev.push("Orchestrator unreachable");
  else dev.push("Orchestrator " + (orch.data && (orch.data.version || orch.data.status) || "ok"));
  if (!status.ok) dev.push("Status pulse down — Fog publish may be idle");
  else {
    const v = (status.data && status.data.version) || "?";
    dev.push("Status " + v + "; DAG txs=" + ((status.data && status.data.dag && status.data.dag.transaction_count) ?? "n/a"));
    if (status.data && (status.data.temp_mode || String(v).includes("temp"))) {
      dev.push("TEMP mode — promote always-on Fog when ready");
    }
  }
  reports.push(agentReport("devops", dev, !orch.ok || !status.ok ? "critical" : "info"));

  // security
  const sec = [];
  if (!auth.ok) sec.push("Auth unhealthy");
  else {
    const users = auth.data && auth.data.checks && auth.data.checks.database && auth.data.checks.database.users;
    const sessions = auth.data && auth.data.checks && auth.data.checks.sessions && auth.data.checks.sessions.active;
    sec.push("Auth ok; users=" + (users ?? "?") + "; sessions=" + (sessions ?? "?"));
  }
  reports.push(agentReport("security", sec, auth.ok ? "info" : "critical"));

  // analysis
  const an = [];
  if (status.ok && status.data) {
    const d = status.data;
    an.push("phase=" + d.phase + " (" + (d.phase_name || "") + ")");
    an.push("SPA " + ((d.spa && d.spa.active) ?? "?") + "/" + ((d.spa && d.spa.total) ?? "?"));
    if ((d.dag && d.dag.transaction_count) != null && d.dag.transaction_count < 1) {
      an.push("DAG idle — seed or peer sync recommended");
    }
  } else an.push("No status metrics");
  reports.push(agentReport("analysis", an, status.ok ? "info" : "warn"));

  // mesh
  const mesh = [];
  if (status.ok && status.data && status.data.spa) {
    const roles = status.data.spa.by_role || {};
    mesh.push("roles=" + JSON.stringify(roles));
    if (!roles.fog && !roles.pinner) mesh.push("No fog/pinner SPA — register when host ready");
  } else mesh.push("SPA metrics missing");
  reports.push(agentReport("mesh", mesh, "info"));

  // economy
  const eco = [];
  if (status.ok && status.data && status.data.agora) {
    eco.push("Agora settlements=" + (status.data.agora.settlements ?? "?"));
  } else eco.push("Agora block not in pulse (lab)");
  eco.push("PdC mint only via contribution; SCA PdS = resource cost in STRATA");
  reports.push(agentReport("economy", eco, "info"));

  // Skip ACB fan-out on budgeted path (ops-cycle can hang); heartbeat is optional via /team-pulse
  const acb_ops = { skipped: true, reason: "budgeted_path_no_fanout" };

  const critical = reports.filter((r) => r.severity === "critical").length;
  const warn = reports.filter((r) => r.severity === "warn").length;
  const cycle = {
    ok: critical === 0,
    light: false,
    budgeted: true,
    team: "AIOps Dev Team",
    cycle_id: crypto.randomUUID(),
    at: new Date().toISOString(),
    summary: { agents: reports.length, critical, warn, info: reports.length - critical - warn },
    upstream: {
      status: { ok: status.ok, http: status.status },
      orchestrator: { ok: orch.ok, http: orch.status, version: orch.data && orch.data.version },
      auth: { ok: auth.ok, http: auth.status },
    },
    reports,
    next_actions: buildNextActions(reports, status.data),
    acb_ops,
    version: "1.4.4-probe-paths",
  };

  if (env.AIOPS_KV) {
    try {
      await env.AIOPS_KV.put("last_cycle", JSON.stringify(cycle));
      await env.AIOPS_KV.put("next_actions", JSON.stringify({ at: cycle.at, actions: cycle.next_actions || [] }));
    } catch (_) {}
  }
  return cycle;
}

async function runTeamCycleLight(env) {
  // probes only — max ~3 outbound requests
  const statusUrl = normalizeServiceUrl(env.STATUS_URL || DEFAULT_STATUS, "status");
  const orchUrl = normalizeServiceUrl(env.ORCH_URL || DEFAULT_ORCH, "orch");
  async function probe(binding, url) {
    try {
      if (binding && typeof binding.fetch === "function") {
        const r = await binding.fetch(new Request(url, { method: "GET", headers: { Accept: "application/json" } }));
        return { ok: r.ok, status: r.status };
      }
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      return { ok: r.ok, status: r.status };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }
  const [status, orch] = await Promise.all([
    probe(env.STATUS, statusUrl),
    probe(env.ORCH, orchUrl),
  ]);
  return { ok: status.ok && orch.ok, light: true, upstream: { status, orch }, at: new Date().toISOString() };
}

async function runTeamCycle(env) {

  let acb_ops = null;
  try { acb_ops = await pulseAcbTeam(env); } catch (_) {}

  const statusUrl = normalizeServiceUrl(env.STATUS_URL || DEFAULT_STATUS, "status");
  const orchUrl = normalizeServiceUrl(env.ORCH_URL || DEFAULT_ORCH, "orch");
  const authUrl = normalizeServiceUrl(env.AUTH_URL || DEFAULT_AUTH, "auth");

  async function probe(binding, url) {
    if (binding) {
      try {
        const r = await binding.fetch(new Request(url, { method: "GET", headers: { Accept: "application/json" } }));
        const text = await r.text();
        let data = null;
        try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 200) }; }
        if (r.ok) return { ok: true, status: r.status, data };
      } catch (_) {}
    }
    return fetchJson(url);
  }

  const [status, orch, auth] = await Promise.all([
    probe(env.STATUS, statusUrl),
    probe(env.ORCH, orchUrl),
    probe(env.AUTH, authUrl),
  ]);

  const reports = [];

  // devops
  const devFindings = [];
  if (!orch.ok) devFindings.push("Orchestrator health unreachable");
  else devFindings.push(`Orchestrator ${orch.data?.version || orch.data?.status || "ok"}`);
  if (!status.ok) devFindings.push("Status pulse unreachable — Fog publish may be down");
  else {
    const v = status.data?.version || "?";
    const txs = status.data?.dag?.transaction_count;
    devFindings.push(`Status pulse ${v}; DAG txs=${txs ?? "n/a"}`);
    if (status.data?.temp_mode || String(v).includes("temp")) {
      devFindings.push("Node running in TEMP mode — promote to always-on host when ready");
    }
  }
  reports.push(
    agentReport("devops", devFindings, !orch.ok || !status.ok ? "critical" : "info")
  );

  // security
  const secFindings = [];
  if (!auth.ok) secFindings.push("Auth service unhealthy");
  else {
    const sessions = auth.data?.checks?.sessions?.active;
    const users = auth.data?.checks?.database?.users;
    secFindings.push(`Auth ok; users=${users ?? "?"}; active_sessions=${sessions ?? "?"}`);
  }
  reports.push(agentReport("security", secFindings, auth.ok ? "info" : "critical"));

  // analysis
  const anFindings = [];
  if (status.ok && status.data) {
    const d = status.data;
    anFindings.push(`phase=${d.phase} (${d.phase_name || ""})`);
    anFindings.push(`SPA active=${d.spa?.active ?? "?"} total=${d.spa?.total ?? "?"}`);
    anFindings.push(`token supply=${d.token?.total_supply ?? d.token?.balance ?? "?"}`);
    anFindings.push(`agora trades=${d.agora?.trades ?? "?"}`);
    if ((d.dag?.transaction_count ?? 0) < 1) {
      anFindings.push("DAG idle — recommend mesh_doctor seed or peer sync");
    }
  } else anFindings.push("No status metrics available");
  reports.push(
    agentReport("analysis", anFindings, status.ok ? "info" : "warn")
  );

  // mesh
  const meshFindings = [];
  if (status.ok && status.data?.spa) {
    const roles = status.data.spa.by_role || {};
    meshFindings.push(`roles=${JSON.stringify(roles)}`);
    if (!roles.fog && !roles.pinner) {
      meshFindings.push("No fog/pinner SPA roles active — register SPA");
    }
  } else meshFindings.push("SPA metrics missing");
  reports.push(agentReport("mesh", meshFindings, "info"));

  // economy
  const ecoFindings = [];
  if (status.ok && status.data?.agora) {
    ecoFindings.push(
      `Agora settlements=${status.data.agora.settlements ?? "?"} last=${status.data.agora.last_price ?? "—"}`
    );
  } else ecoFindings.push("Agora metrics not in pulse — lab may not have published economy block");
  ecoFindings.push("ACB team ops-cycle: Orchestrator redistributes earned STRATA (no mint)");
  ecoFindings.push("PoC mint only via on-chain contribution × market avg × Agora rate");
  reports.push(agentReport("economy", ecoFindings, "info"));

  const critical = reports.filter((r) => r.severity === "critical").length;
  const warn = reports.filter((r) => r.severity === "warn").length;

  const cycle = {
    ok: critical === 0,
    team: "AIOps Dev Team",
    cycle_id: crypto.randomUUID(),
    at: new Date().toISOString(),
    summary: {
      agents: TEAM.length,
      critical,
      warn,
      info: reports.length - critical - warn,
    },
    upstream: {
      status: { ok: status.ok, http: status.status },
      orchestrator: { ok: orch.ok, http: orch.status, version: orch.data?.version },
      auth: { ok: auth.ok, http: auth.status },
    },
    reports,
    next_actions: buildNextActions(reports, status.data),
    acb_ops,
  };

  // Persist last cycle if KV available
  if (env.AIOPS_KV) {
    try {
      await env.AIOPS_KV.put("last_cycle", JSON.stringify(cycle));
      const hist = JSON.parse((await env.AIOPS_KV.get("cycle_history")) || "[]");
      hist.unshift({ cycle_id: cycle.cycle_id, at: cycle.at, critical, warn });
      await env.AIOPS_KV.put("cycle_history", JSON.stringify(hist.slice(0, 50)));
    } catch (_) {}
  }

  return cycle;
}

function buildNextActions(reports, status) {
  const actions = [];
  for (const r of reports) {
    if (r.severity === "critical") {
      actions.push({ priority: 1, agent: r.agent, action: r.findings.join("; ") });
    }
  }
  if (status?.temp_mode || String(status?.version || "").includes("temp")) {
    actions.push({
      priority: 2,
      agent: "devops",
      action: "Migrate Fog from temp session to MacBook/Oracle always-on + publish_loop",
    });
  }
  actions.push({
    priority: 3,
    agent: "mesh",
    action: "Continue whitepaper tracks: real Kubo pins, multi-host gossip, production SPA grace",
  });
  return actions.sort((a, b) => a.priority - b.priority);
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


async function orchestratorChat(message, env) {
  const text = String(message || "").trim().slice(0, 2000);
  if (!text) {
    return { reply: "Send a non-empty message.", role: "orchestrator" };
  }

  const cycle = await runTeamCycle(env);
  const ctx = {
    node: "FOG-NODE-PT-CM-001",
    operator: "André Manuel Calhegas Morais",
    cycle_ok: cycle.ok,
    summary: cycle.summary,
    upstream: cycle.upstream,
    findings: (cycle.reports || []).map((r) => ({
      agent: r.agent,
      severity: r.severity,
      findings: r.findings,
    })),
    next_actions: cycle.next_actions || [],
  };

  // Optional Workers AI if bound
  if (env.AI && typeof env.AI.run === "function") {
    try {
      const system =
        "You are the StrataMesh Hybrid Orchestrator assistant for the Calhegas Morais Fog Node. " +
        "Be concise, technical, substrate-neutral. Use the JSON context. Do not invent mainnet status. " +
        "Lab reference only. Prefer Portuguese if the user writes in Portuguese.";
      const result = await env.AI.run("@cf/meta/llama-3.2-3b-instruct", {
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content:
              "Context:\\n" +
              JSON.stringify(ctx, null, 2) +
              "\\n\\nUser:\\n" +
              text,
          },
        ],
        max_tokens: 512,
      });
      const reply =
        (result && (result.response || result.result || result.text)) ||
        JSON.stringify(result);
      return {
        reply: String(reply),
        role: "orchestrator",
        source: "workers-ai",
        context: ctx,
      };
    } catch (e) {
      // fall through to deterministic
      ctx.ai_error = String(e.message || e);
    }
  }

  // Deterministic orchestrator-style reply (always available)
  const lower = text.toLowerCase();
  const lines = [];
  lines.push("Orchestrator · Calhegas Morais node");
  lines.push(
    `Cycle: ${ctx.cycle_ok ? "ok" : "issues"} · critical=${ctx.summary.critical} warn=${ctx.summary.warn}`
  );

  if (/status|estado|health|saúde|pulse|pulso/.test(lower)) {
    lines.push(
      `Upstream: status=${ctx.upstream.status?.ok} orch=${ctx.upstream.orchestrator?.ok} auth=${ctx.upstream.auth?.ok}`
    );
    for (const r of ctx.findings) {
      lines.push(`[${r.severity}] ${r.agent}: ${(r.findings || []).slice(0, 2).join("; ")}`);
    }
  } else if (/aiops|equipa|team|agent/.test(lower)) {
    for (const r of ctx.findings) {
      lines.push(`${r.agent}: ${(r.findings || []).join("; ")}`);
    }
  } else if (/next|próxim|proxim|roadmap|fazer|todo/.test(lower)) {
    for (const a of ctx.next_actions) {
      lines.push(`P${a.priority} (${a.agent}) ${a.action}`);
    }
  } else if (/spa|mesh|fog/.test(lower)) {
    const mesh = ctx.findings.find((f) => f.agent === "mesh");
    lines.push(mesh ? mesh.findings.join("; ") : "Mesh metrics from last cycle above.");
  } else {
    lines.push("Understood. Last cycle snapshot:");
    for (const r of ctx.findings.slice(0, 3)) {
      lines.push(`[${r.severity}] ${r.agent}: ${(r.findings || [])[0] || "—"}`);
    }
    if (ctx.next_actions[0]) {
      lines.push("Next: " + ctx.next_actions[0].action);
    }
    lines.push('Ask: "status", "aiops", "next", or "mesh" for focused briefings.');
  }

  return {
    reply: lines.join("\n"),
    role: "orchestrator",
    source: "deterministic+cycle",
    context: ctx,
  };
}


export default {
  async fetch(request, env, ctx) {
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

    if (path === '/team-pulse' || path === '/aiops/team-pulse') {
      const pulses = await pulseAcbTeam(env);
      return new Response(JSON.stringify({ success: true, version: '1.4.4-probe-paths', pulses }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    if (path === "/health" || path === "/api/health" || path === "/api/aiops/health") {
      return json({
        status: "ok",
        worker: "stratamesh-aiops",
        version: "1.4.4-probe-paths",
        acb_roster: ACB_ROSTER,
        team: TEAM.map((a) => a.id),
        mode: "continuous-development",
        continuous: {
          workers_cron: "hourly_dev_cycle_budgeted",
          host_loop: "scripts/aiops_continuous_loop.sh (true continuous)",
          note: "Workers cannot while(true); host process is the real continuous loop",
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (path === "/team" || path === "/api/aiops/team") {
      return json({ team: TEAM, standing: "substrate-neutral", source: "whitepaper + Orchestrator mandate" });
    }

    if (path === "/cycle-budgeted" || path === "/cycle" || path === "/api/aiops/cycle" || path === "/run") {
      // Default HTTP cycle is budgeted (cron-parity). ?full=1 for legacy heavy cycle.
      if (path === "/cycle-budgeted" || url.searchParams.get("full") !== "1") {
        const cycle = await runTeamCycleBudgeted(env);
        return json(cycle);
      }

      const cycle = await runTeamCycle(env);
      return json(cycle);
    }

    if (path === "/last" || path === "/api/aiops/last") {
      if (env.AIOPS_KV) {
        const last = await env.AIOPS_KV.get("last_cycle");
        if (last) return json(JSON.parse(last));
      }
      // live cycle if no KV
      const cycle = await runTeamCycle(env);
      return json(cycle);
    }


    if (path === "/chat" || path === "/api/chat" || path === "/api/aiops/chat") {
      if (request.method === "GET") {
        return json({
          service: "orchestrator-chat",
          methods: ["POST"],
          body: { message: "string" },
        });
      }
      if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
      let body = {};
      try { body = await request.json(); } catch (_) {}
      const out = await orchestratorChat(body.message || body.text || body.prompt || "", env);
      return json(out);
    }

    if (path === "/" || path === "/status") {
      const cycle = await runTeamCycle(env);
      return json({
        service: "StrataMesh AIOps Dev Team",
        version: "1.0.0-lab",
        mandate: "Continuous development and operations of the Calhegas Morais Fog Node — not health-check theatre",
        latest_cycle: cycle,
      });
    }

    return json({ error: "not_found", path }, 404);
  },

  /** Cloudflare Cron Trigger — budgeted development cycle (free-tier safe) */
  async scheduled(event, env, ctx) {
    // Hourly budgeted development cycle: agent reports + zero-cost team heartbeat.
    ctx.waitUntil(
      runTeamCycleBudgeted(env).catch(() => runTeamCycleLight(env))
    );
  },
};
