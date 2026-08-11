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
const TEAM = [
  { id: "devops", role: "DevOps", mandate: "Keep Fog runtime, publish loop, and Workers deployable" },
  { id: "security", role: "Security", mandate: "Auth sessions, token posture, exposure signals" },
  { id: "analysis", role: "Analysis", mandate: "DAG growth, status pulse, anomaly detection" },
  { id: "mesh", role: "Mesh", mandate: "SPA registry, gossip readiness, tip confidence" },
  { id: "economy", role: "Economy", mandate: "PoC mint bounds, Agora settlement integrity" },
];

const DEFAULT_STATUS = "https://stratamesh-status.stratamesh.workers.dev/status";
const DEFAULT_ORCH = "https://stratamesh-orchestrator.stratamesh.workers.dev/health";
const DEFAULT_AUTH = "https://stratamesh-auth.stratamesh.workers.dev/health";

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

async function runTeamCycle(env) {
  const statusUrl = env.STATUS_URL || DEFAULT_STATUS;
  const orchUrl = env.ORCH_URL || DEFAULT_ORCH;
  const authUrl = env.AUTH_URL || DEFAULT_AUTH;

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
  ecoFindings.push("Emission policy remains lab-capped until B0 production freeze");
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

    if (path === "/health" || path === "/api/health" || path === "/api/aiops/health") {
      return json({
        status: "ok",
        worker: "stratamesh-aiops",
        version: "1.0.0-lab",
        team: TEAM.map((a) => a.id),
        mode: "continuous-development",
        continuous: {
          workers_cron: "min_interval_1_minute_on_CF",
          host_loop: "scripts/aiops_continuous_loop.sh (true continuous)",
          note: "Workers cannot while(true); host process is the real continuous loop",
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (path === "/team" || path === "/api/aiops/team") {
      return json({ team: TEAM, standing: "substrate-neutral", source: "whitepaper + Orchestrator mandate" });
    }

    if (path === "/cycle" || path === "/api/aiops/cycle" || path === "/run") {
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

  /** Cloudflare Cron Trigger — continuous development tick */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runTeamCycle(env));
  },
};
