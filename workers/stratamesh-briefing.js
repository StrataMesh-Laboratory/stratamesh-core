/**
 * Nó Calhegas Morais — Briefing diário (instrumento de comando).
 *
 * CONTRATO — o que é um bom briefing
 * 1. Delta-first: só o que mudou desde o último ciclo, ou o que exige decisão.
 * 2. Decisões antes de narrativa: se não há decisão, diz-se numa linha.
 * 3. Evidência viva: probes do Fog / status / canais — não backlog estático reciclado.
 * 4. Sem auto-tarefa: “enviar o briefing” não é o plano do dia.
 * 5. Intel externa só se for accionável; senão uma linha.
 * 6. Estagnação honesta: bloqueios antigos nomeiam-se com idade, não se reescrevem.
 * 7. Cabe em ~60 segundos de leitura.
 * 8. Memória de ciclo: grava snapshot para o próximo delta ser real.
 *
 * Canais: DeoMail → amcmorais@icloud.com · WhatsApp (se Meta OK)
 * Cron: 0 10 * * * UTC ≈ 11:00 Europe/Lisbon (WEST)
 */
const VERSION = "2.2.1-aiops-bind";
const OWNER_EMAIL = "amcmorais@icloud.com";
const BRIEFING_CC = ["grok@calhegasmorais.pt"];
const STRATAGROK = {
  name: "STRATAGROK",
  bot_id: "c02df87b-0431-46b7-abfc-6f65d751af8e",
  mailbox: "grok@calhegasmorais.pt",
};
const OWNER_WA = "447404796458";
const LISBON_TZ = "Europe/Lisbon";
const CYCLE_CACHE = "https://briefing.internal/cycle/last";

const SEV = { CRITICAL: "CRITICAL", ACTION: "ACTION", WATCH: "WATCH", STABLE: "STABLE", INFO: "INFO" };

function j(d, s = 200) {
  return new Response(JSON.stringify(d, null, 2), {
    status: s,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" },
  });
}

function nowLisbonParts(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: LISBON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
  };
}

async function fetchJson(url, ms = 5000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: c.signal,
      headers: { "User-Agent": "StrataMesh-Briefing/2.1 (No Calhegas Morais)" },
    });
    const json = await r.json().catch(() => null);
    return { ok: r.ok, json, status: r.status };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  } finally {
    clearTimeout(t);
  }
}

async function fetchBound(env, name, path) {
  const b = env && env[name];
  if (b && typeof b.fetch === "function") {
    try {
      const r = await b.fetch(new Request("https://binding.internal" + path, { method: "GET" }));
      const json = await r.json().catch(() => null);
      return { ok: r.ok, json, status: r.status, via: "binding:" + name };
    } catch (e) {
      return { ok: false, error: String(e.message || e), via: "binding:" + name };
    }
  }
  return { ok: false, error: "no_binding", via: "missing:" + name };
}

/* —— Intel: stricter relevance (actionable only) —— */
const INTEL_RULES = [
  { re: /mica\b|markets in crypto|casp|esma.*crypto|bce.*stablecoin/i, tag: "regulamentação", rel: "HIGH", why: "enquadramento do token lab" },
  { re: /ai act|artificial intelligence act|dora\b|nis2|rgpd|gdpr|eidas/i, tag: "regulamentação", rel: "HIGH", why: "compliance do Nó / ENI" },
  { re: /cloudflare.*(outage|incident|disruption|billing|workers.*limit)/i, tag: "infra", rel: "HIGH", why: "fornecedor do Fog" },
  { re: /whatsapp.*(api|business|block|policy)|meta.*(developer|cloud api)/i, tag: "canal", rel: "HIGH", why: "canal de comando WA" },
  { re: /post-?quantum|kyber|dilithium|pq crypto/i, tag: "criptografia", rel: "MED", why: "roadmap PQ" },
  { re: /edge computing|fog computing|depin/i, tag: "malha", rel: "MED", why: "posicionamento Fog" },
];

function scoreTitle(title) {
  const t = String(title || "");
  for (const rule of INTEL_RULES) {
    if (rule.re.test(t)) return { rel: rule.rel, tag: rule.tag, why: rule.why };
  }
  return null;
}

function parseRssTitles(xml, max = 6) {
  const out = [];
  const re = /<item[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/gi;
  let m;
  while ((m = re.exec(xml)) && out.length < max) {
    const title = m[1].replace(/<[^>]+>/g, "").trim();
    if (title) out.push(title);
  }
  return out;
}

const FEEDS = [
  { id: "cf-blog", region: "global", url: "https://blog.cloudflare.com/rss/" },
  { id: "ecb", region: "europa", url: "https://www.ecb.europa.eu/rss/press.html" },
  { id: "bnportugal", region: "portugal", url: "https://www.bportugal.pt/sites/default/files/rss/noticias.xml" },
];

async function ingestFeeds() {
  let ingested = 0;
  let feeds_ok = 0;
  const events = [];
  await Promise.all(
    FEEDS.map(async (f) => {
      try {
        const r = await fetch(f.url, {
          headers: { "User-Agent": "StrataMesh-Briefing/2.1" },
          signal: AbortSignal.timeout(6000),
        });
        if (!r.ok) return;
        feeds_ok++;
        const xml = await r.text();
        const titles = parseRssTitles(xml, 8);
        ingested += titles.length;
        for (const title of titles) {
          const s = scoreTitle(title);
          if (!s) continue;
          events.push({
            title,
            region: f.region,
            source: f.id,
            rel: s.rel,
            tag: s.tag,
            why: s.why,
          });
        }
      } catch (_) {}
    }),
  );
  events.sort((a, b) => (a.rel === "HIGH" ? 0 : 1) - (b.rel === "HIGH" ? 0 : 1));
  return { ingested, feeds_ok, feeds_n: FEEDS.length, events: events.slice(0, 5) };
}

async function loadLast(env) {
  try {
    const hit = await caches.default.match(CYCLE_CACHE);
    if (hit) return await hit.json();
  } catch (_) {}
  try {
    if (env.KV && typeof env.KV.get === "function") {
      const raw = await env.KV.get("cycle:last");
      if (raw) return JSON.parse(raw);
    }
  } catch (_) {}
  return null;
}

async function saveLast(env, cycle) {
  const body = JSON.stringify(cycle);
  try {
    await caches.default.put(
      CYCLE_CACHE,
      new Response(body, { headers: { "Content-Type": "application/json", "Cache-Control": "max-age=259200" } }),
    );
  } catch (_) {}
  try {
    if (env.KV && typeof env.KV.put === "function") await env.KV.put("cycle:last", body);
  } catch (_) {}
}

function snapFromStatus(statusJson) {
  const s = statusJson || {};
  const up = s.upstream || {};
  const mon = s.monetary || {};
  const sum = s.summary || {};
  return {
    version: s.version || null,
    status: s.status || null,
    upstream: { ...up },
    upstream_ok: sum.upstream_ok != null ? sum.upstream_ok : Object.values(up).filter(Boolean).length,
    upstream_total: sum.upstream_total != null ? sum.upstream_total : Object.keys(up).length,
    circulating: mon.circulating_supply != null ? mon.circulating_supply : sum.circulating,
    mint_emitted: mon.mint_emitted != null ? mon.mint_emitted : sum.mint_emitted,
    mesh_classes: sum.mesh_classes != null ? sum.mesh_classes : null,
    agora: sum.agora_strata_per_eur != null ? sum.agora_strata_per_eur : null,
  };
}

function computeDeltas(last, snap, channels) {
  const deltas = [];
  if (!last || !last.snap) {
    deltas.push({ kind: "CYCLE", text: "Sem snapshot anterior fiável — este ciclo define a linha de base." });
  } else {
    const L = last.snap;
    if (L.version && snap.version && L.version !== snap.version) {
      deltas.push({ kind: "STATUS", text: "Status " + L.version + " → " + snap.version });
    }
    const keys = new Set([...Object.keys(L.upstream || {}), ...Object.keys(snap.upstream || {})]);
    for (const k of keys) {
      const a = !!(L.upstream || {})[k];
      const b = !!(snap.upstream || {})[k];
      if (a !== b) deltas.push({ kind: "UPSTREAM", text: k + ": " + (a ? "ok" : "down") + " → " + (b ? "ok" : "down") });
    }
    if (L.mint_emitted != null && snap.mint_emitted != null && Number(L.mint_emitted) !== Number(snap.mint_emitted)) {
      deltas.push({ kind: "TOKEN", text: "#mint emitted " + L.mint_emitted + " → " + snap.mint_emitted });
    }
    if (L.circulating != null && snap.circulating != null && Math.abs(Number(L.circulating) - Number(snap.circulating)) > 1e-6) {
      deltas.push({ kind: "TOKEN", text: "Circulating Δ " + (Number(snap.circulating) - Number(L.circulating)).toFixed(6) });
    }
  }
  if (channels) {
    if (channels.email === false) deltas.push({ kind: "CHANNEL", text: "E-mail (DeoMail) falhou no último envio — verificar entrega." });
  }
  return deltas;
}

function ownerBlockers(last, mesh) {
  const items = [];
  if (mesh && mesh.spa_missing) {
    items.push({
      id: "B-SPA-METRICS",
      title: "Métricas SPA / gossip incompletas no pulse AIOps",
      since: "aberto neste ciclo",
      need: "AIOps mesh agent preencher SPA registry + tip confidence",
      ownerDecision: false,
    });
  }
  if (mesh && mesh.dag_na) {
    items.push({
      id: "B-DAG-TXS",
      title: "Status pulse sem DAG tx count",
      since: "aberto neste ciclo",
      need: "Status/DAG gateway expor txs no pulse que o AIOps já lê",
      ownerDecision: false,
    });
  }
  const since = (last && last.blockers && last.blockers.meta_docs_since) || "2026-08-18";
  items.push({
    id: "B-META-WA",
    title: "WhatsApp Cloud API (canal secundário)",
    since,
    need: "token Meta — não é o canal do briefing",
    ownerDecision: false,
  });
  return items;
}

function ownerAttention(blockers, mesh) {
  const items = [];
  if (mesh && mesh.email_fail) {
    items.push({
      decision: "Verificar entrega DeoMail do briefing anterior",
      why: "canal primário de comando escrito falhou",
      rec: "inbox + logs DeoMail",
    });
  }
  if (!items.length) {
    return { n: 0, sev: SEV.STABLE, line: "ATENÇÃO: nenhuma decisão do proprietário neste ciclo.", items: [] };
  }
  return {
    n: items.length,
    sev: SEV.ACTION,
    line: "ATENÇÃO: " + items.length + " decisão(ões) do proprietário.",
    items,
  };
}

function focusToday(deltas, blockers, snap, work) {
  const focus = [];
  const gaps = (work && work.gaps) || [];
  gaps.slice(0, 2).forEach((g) => focus.push({ priority: "P0", text: g }));
  if (deltas.some((d) => d.kind === "UPSTREAM")) {
    focus.push({ priority: "P1", text: "Investigar flips de upstream no delta." });
  }
  if (snap && snap.upstream_ok === snap.upstream_total && snap.upstream_total) {
    focus.push({
      priority: "P2",
      text: "Fog " + snap.upstream_ok + "/" + snap.upstream_total + " operacional — trabalho é fechar gaps AIOps, não health-theatre.",
    });
  }
  const wa = blockers.find((b) => b.id === "B-META-WA");
  if (wa) focus.push({ priority: "P3", text: "WA continua offline (desde " + wa.since + ") — canal secundário; não monopolizar o briefing." });
  if (!focus.length) focus.push({ priority: "P1", text: "Orquestrador + AIOps: fechar o gap listado na secção trabalho." });
  return focus.slice(0, 5);
}

function healthLine(snap, statusJson) {
  const s = statusJson || {};
  const loc = (s.location && (s.location.locality_pt || s.location.label)) || "Lisboa";
  return (
    (s.node_id || "FOG-NODE-PT-CM-001") +
    " · " +
    (snap.version || "?") +
    " · " +
    (snap.status || "?") +
    " · upstream " +
    (snap.upstream_ok != null ? snap.upstream_ok + "/" + (snap.upstream_total || "?") : "?") +
    " · " +
    loc
  );
}

async function probeMesh(env) {
  const [aiopsBound, aiopsPub, edge, apiEdge, gossip, git, fog] = await Promise.all([
    fetchBound(env, "AIOPS", "/"),
    fetchJson("https://aiops.calhegasmorais.pt/", 6000),
    fetchJson("https://edge.calhegasmorais.pt/health", 4000),
    fetchJson("https://api-edge.calhegasmorais.pt/health", 4000),
    fetchJson("https://calhegasmorais.pt/api/v1/gossip/peers", 4000),
    fetchJson("https://api.github.com/repos/StrataMesh-Laboratory/stratamesh-core/commits?per_page=4", 5000),
    fetchJson("https://fog.calhegasmorais.pt/health", 4000),
  ]);
  let aiops = (aiopsBound.ok && aiopsBound.json) ? aiopsBound : aiopsPub;
  // Always run GET /cycle via service binding: public aiops host is INC-1027 HOLD pages,
  // and a stale KV last_cycle must not skip the 11h evidence write.
  const ran = await fetchBound(env, "AIOPS", "/cycle");
  let cycle = ran.ok && ran.json && ran.json.cycle_id ? ran.json : null;
  if (cycle) {
    aiops = { ok: true, json: { latest_cycle: cycle, worklog_latest: ran.json.work }, via: "binding:AIOPS/cycle" };
  } else {
    cycle = aiops.ok && aiops.json && aiops.json.latest_cycle ? aiops.json.latest_cycle : null;
  }
  const reports = (cycle && cycle.reports) || [];
  const findings = [];
  reports.forEach((r) => {
    (r.findings || []).forEach((f) => findings.push("[" + (r.role || r.agent) + "] " + f));
  });
  const spa_missing = findings.some((f) => /SPA metrics missing|SPA \?\/\?/i.test(f));
  const dag_na = findings.some((f) => /txs=n\/a/i.test(f));
  const commits = [];
  if (git.ok && Array.isArray(git.json)) {
    git.json.forEach((c) => {
      const msg = (((c.commit || {}).message) || "").split("\n")[0].slice(0, 90);
      const at = ((c.commit || {}).author || {}).date || "";
      if (msg) commits.push(msg + (at ? " · " + at.slice(0, 16) : ""));
    });
  }
  const gaps = [];
  if (spa_missing) gaps.push("AIOps Mesh: SPA registry / métricas ainda em falta — preencher pulse, não repetir health ok.");
  if (dag_na) gaps.push("AIOps DevOps: DAG tx count n/a no status — ligar gateway ao pulse.");
  if (!cycle) gaps.push("AIOps: sem latest_cycle — o mandato contínuo não está a evidenciar trabalho.");
  if (cycle && cycle.summary && cycle.summary.info === cycle.summary.agents && !gaps.length) {
    gaps.push("AIOps reportou só info/" + cycle.summary.agents + " agentes — mandatar trabalho concreto (SPA, DAG, gossip), não ciclo vazio.");
  }
  const tasks = [];
  if (spa_missing) tasks.push({ id: "SG-SPA", text: "Expor métricas SPA no pulse AIOps e no status público." });
  if (dag_na) tasks.push({ id: "SG-DAG", text: "Publicar contagem DAG txs no status.calhegasmorais.pt usado pelo AIOps." });
  tasks.push({ id: "SG-DELTA", text: "Persistir evidência de trabalho do ciclo (não só health) para o briefing das 11h." });
  tasks.push({ id: "SG-REDDIT", text: "Quando r/StrataMesh_DLT estiver público, republicar canais oficiais; senão acompanhar redditrequest." });
  return {
    aiops_ok: !!(aiops.ok && cycle),
    cycle,
    findings: findings.slice(0, 10),
    commits: commits.slice(0, 4),
    spa_missing,
    dag_na,
    gaps,
    tasks,
    edge_ok: !!(edge.ok && edge.json),
    edge_id: edge.json && edge.json.node_id,
    api_edge_ok: !!(apiEdge.ok && apiEdge.json),
    gossip_count: gossip.json && (gossip.json.count != null ? gossip.json.count : (gossip.json.peers || []).length),
    gossip_ok: !!(gossip.ok && gossip.json && (gossip.json.peers || gossip.json.count != null)),
    fog: fog.ok && fog.json ? fog.json : null,
    hold: {
      aiops_public: !(aiopsPub.ok && aiopsPub.json && aiopsPub.json.latest_cycle),
      edge_public: !(edge.ok && edge.json && edge.json.node_id),
      api_edge_public: !(apiEdge.ok && apiEdge.json),
    },
  };
}

async function composeBriefing(env, mode) {
  const lisbon = nowLisbonParts();
  const [statusRes, agoraRes, pocRes, intel, last, mesh] = await Promise.all([
    fetchBound(env, "STATUS", "/summary").then(async (r) => {
      if (r.ok && r.json) return r;
      return fetchJson("https://status.calhegasmorais.pt/summary");
    }),
    fetchBound(env, "AGORA", "/health").then(async (r) => {
      if (r.ok) return r;
      return fetchJson("https://calhegasmorais.pt/api/v1/agora/health");
    }),
    fetchBound(env, "POC", "/health").then(async (r) => {
      if (r.ok) return r;
      return fetchJson("https://calhegasmorais.pt/api/v1/poc/health");
    }),
    ingestFeeds(),
    loadLast(env),
    probeMesh(env),
  ]);

  const statusJson = statusRes.ok ? statusRes.json : null;
  const snap = snapFromStatus(statusJson);
  const channels = {
    email: last && last.channels ? last.channels.email : null,
    whatsapp: last && last.channels ? last.channels.whatsapp : null,
  };

  const deltas = computeDeltas(last, snap, {
    email: last && last.channels ? last.channels.email : undefined,
  });
  if (mesh.aiops_ok && mesh.cycle) {
    deltas.unshift({
      kind: "AIOPS",
      text:
        "ciclo " +
        (mesh.cycle.cycle_id || "").slice(0, 8) +
        " · " +
        (mesh.cycle.at || "") +
        " · agents " +
        ((mesh.cycle.summary && mesh.cycle.summary.agents) || "?") +
        " crit=" +
        ((mesh.cycle.summary && mesh.cycle.summary.critical) || 0) +
        " warn=" +
        ((mesh.cycle.summary && mesh.cycle.summary.warn) || 0),
    });
  }
  mesh.findings.forEach((f) => deltas.push({ kind: "AIOPS", text: f }));
  mesh.commits.forEach((c) => deltas.push({ kind: "GIT", text: c }));
  if (mesh.edge_ok) deltas.push({ kind: "EDGE", text: (mesh.edge_id || "EDGE") + " live · api-edge " + (mesh.api_edge_ok ? "ok" : "down") });
  if (mesh.gossip_ok) deltas.push({ kind: "GOSSIP", text: "peers=" + String(mesh.gossip_count) });
  else deltas.push({ kind: "GOSSIP", text: "peers=null (public gossip HOLD/INC-1027 lab-hold pages — not a Fog crash)" });
  if (mesh.fog) {
    deltas.push({
      kind: "FOG",
      text:
        (mesh.fog.node_id || "FOG-NODE-PT-CM-001") +
        " substrate=" +
        (mesh.fog.substrate || "local-process") +
        " tx_count=" +
        String(mesh.fog.tx_count) +
        " oracle_vm=" +
        String(mesh.fog.oracle_vm) +
        " — local-process, not Oracle VM",
    });
  }
  if (!mesh.edge_ok) {
    deltas.push({ kind: "EDGE", text: "public EDGE + api-edge HOLD (CNAME stratamesh-lab-hold.pages.dev, INC-1027). Fog /health is the live probe." });
  }
  if (!deltas.length) {
    deltas.push({ kind: "GAP", text: "Orquestrador/AIOps não deixaram evidência verificável neste ciclo — isso é falha de mandato, não estabilidade." });
  }

  // External: only HIGH, max 3, with why
  const blockers = ownerBlockers(last, mesh);
  const attn = ownerAttention(blockers, { email_fail: last && last.channels && last.channels.email === false });
  const focus = focusToday(deltas, blockers, snap, mesh);
  const health = healthLine(snap, statusJson);

  const intelLines = intel.events
    .filter((e) => e.rel === "HIGH")
    .slice(0, 3)
    .map((e) => e.title + " · " + e.tag + " · " + e.why);

  const lines = [];
  lines.push("BRIEFING · " + lisbon.date + " · 11h " + LISBON_TZ);
  lines.push("Para: André M. Calhegas Morais · AMCM ENI");
  lines.push("CC: " + BRIEFING_CC.join(", ") + " · " + STRATAGROK.name + " " + STRATAGROK.bot_id);
  lines.push("De: SCA-Orquestrador · Nó Calhegas Morais · " + VERSION);
  lines.push("");
  lines.push("0. SÍNTESE");
  lines.push("   " + (snap.status || "UNKNOWN").toUpperCase() + " · upstream " + (snap.upstream_ok != null ? snap.upstream_ok + "/" + snap.upstream_total : "?"));
  lines.push("   " + attn.line);
  lines.push("");
  lines.push("1. DECISÕES");
  if (!attn.items.length) {
    lines.push("   Nenhuma. Não interromper o proprietário.");
  } else {
    attn.items.forEach((it, i) => {
      lines.push("   " + (i + 1) + ". " + it.decision);
      lines.push("      Porquê: " + it.why);
      lines.push("      Rec: " + it.rec);
    });
  }
  lines.push("");
  lines.push("2. TRABALHO DESDE O ÚLTIMO CICLO (AIOps + git + mesh)");
  if (mesh.findings.length) mesh.findings.forEach((f) => lines.push("   · " + f));
  else lines.push("   · AIOps sem findings — mandato em falta.");
  if (mesh.commits.length) {
    lines.push("   Git (stratamesh-core):");
    mesh.commits.forEach((c) => lines.push("   · " + c));
  }
  lines.push("   EDGE " + (mesh.edge_ok ? "ok" : "down") + " · api-edge " + (mesh.api_edge_ok ? "ok" : "down") + " · gossip peers=" + String(mesh.gossip_count));
  lines.push("");
  lines.push("3. DELTA STATUS");
  deltas.filter((d) => d.kind !== "AIOPS" && d.kind !== "GIT").forEach((d, i) => lines.push("   " + (i + 1) + ". [" + d.kind + "] " + d.text));
  lines.push("");
  lines.push("4. TAREFAS → " + STRATAGROK.name + " (" + STRATAGROK.bot_id + ")");
  lines.push("   Mailbox: " + STRATAGROK.mailbox + " · automatizar, não apenas reportar.");
  mesh.tasks.forEach((t) => lines.push("   · " + t.id + " — " + t.text));
  lines.push("");
  lines.push("5. BLOQUEIOS (WA é P3, não o briefing)");
  blockers.forEach((b) => lines.push("   · " + b.id + " — " + b.title + " · " + b.need));
  lines.push("");
  lines.push("6. SINAL EXTERNO");
  if (!intelLines.length) lines.push("   Sem HIGH accionável (" + intel.feeds_ok + "/" + intel.feeds_n + " feeds).");
  else intelLines.forEach((t) => lines.push("   · " + t));
  lines.push("");
  lines.push("7. FOCO");
  focus.forEach((f) => lines.push("   " + f.priority + " · " + f.text));
  lines.push("");
  lines.push("8. SAÚDE");
  lines.push("   " + health);
  if (pocRes.ok && pocRes.json) lines.push("   PdC " + (pocRes.json.version || "ok"));
  if (agoraRes.ok && agoraRes.json) lines.push("   Ágora " + (agoraRes.json.version || agoraRes.json.status || "ok"));
  lines.push("");
  lines.push("9. PRÓXIMO");
  lines.push("   Amanhã 11h Lisboa — delta de trabalho real + tarefas STRATAGROK. Sem reciclar WA.");
  lines.push("");
  lines.push(
    "Proveniência: status=" +
      (statusRes.ok ? "ok" : "down") +
      " · aiops=" +
      (mesh.aiops_ok ? "ok" : "down") +
      " · edge=" +
      (mesh.edge_ok ? "ok" : "down") +
      " · intel=" +
      intel.feeds_ok +
      "/" +
      intel.feeds_n,
  );

  const sections = [
    { kicker: "00 · Síntese", title: attn.line, items: [health] },
    {
      kicker: "01 · Decisões",
      title: attn.n ? attn.n + " necessária(s)" : "Nenhuma",
      items: attn.items.length ? attn.items.map((i) => i.decision + " — " + i.why) : ["Nenhuma interrupção."],
    },
    {
      kicker: "02 · Trabalho",
      title: "AIOps / git / mesh",
      items: (mesh.findings.length ? mesh.findings : ["sem findings"]).concat(mesh.commits.slice(0, 2)),
    },
    {
      kicker: "03 · STRATAGROK",
      title: STRATAGROK.bot_id,
      items: mesh.tasks.map((t) => t.id + " — " + t.text),
    },
    {
      kicker: "04 · Bloqueios",
      title: blockers.length + " activos",
      items: blockers.map((b) => b.id + " — " + b.need),
    },
    {
      kicker: "04 · Externo",
      title: intelLines.length ? intelLines.length + " HIGH" : "silêncio accionável",
      items: intelLines.length ? intelLines : ["Sem sinal HIGH accionável."],
    },
    { kicker: "05 · Foco", title: "hoje", items: focus.map((f) => f.priority + " · " + f.text) },
  ];

  const cycle = {
    date: lisbon.date,
    version: VERSION,
    snap,
    deltas,
    blockers: { meta_docs_since: "2026-08-18", ids: blockers.map((b) => b.id) },
    stratagrok: STRATAGROK,
    attention: attn.n,
    channels: last && last.channels ? last.channels : { email: null, whatsapp: false },
  };

  return {
    text: lines.join("\n"),
    sections,
    userSections: [
      {
        kicker: "Malha",
        title: health,
        items: deltas.filter((d) => d.kind !== "STABLE").slice(0, 3).map((d) => d.text),
      },
    ],
    headlines: { ok: intel.feeds_ok > 0, titles: intel.events.map((e) => e.title), source: intel.feeds_ok + " feeds" },
    provenance: {
      status: statusRes.ok,
      agora: agoraRes.ok,
      poc: pocRes.ok,
      intel: intel.feeds_ok + "/" + intel.feeds_n,
    },
    cycle,
    attention: attn,
    health: { line: health, snap },
  };
}

async function sendEmail(env, subject, text, extra) {
  const payload = {
    to: (extra && extra.to) || OWNER_EMAIL,
    cc: (extra && extra.cc) || BRIEFING_CC,
    subject,
    text,
    lang: "pt-PT",
    formal: true,
    kind: (extra && extra.kind) || "briefing",
    sections: extra && extra.sections,
    cta: extra && extra.cta,
    preheader: extra && extra.preheader,
    flag: extra && extra.flag,
  };
  try {
    if (env.DEOMAIL && typeof env.DEOMAIL.fetch === "function") {
      const r = await env.DEOMAIL.fetch(
        new Request("https://deomail.internal/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      const body = await r.json().catch(() => ({}));
      const nestedOk = body && body.deomail ? body.deomail.success !== false : body.ok !== false;
      return { ok: r.ok && nestedOk, via: "binding", body };
    }
  } catch (_) {}
  try {
    const r = await fetch("https://stratamesh-deomail.stratamesh.workers.dev/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await r.json().catch(() => ({}));
    const nestedOk = body && body.deomail ? body.deomail.success !== false : body.ok !== false;
    return { ok: r.ok && nestedOk, via: "http", body };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

async function sendWhatsAppText(env, text) {
  try {
    if (env.WHATSAPP && typeof env.WHATSAPP.fetch === "function") {
      const r = await env.WHATSAPP.fetch(
        new Request("https://wa.internal/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: OWNER_WA, text: text.slice(0, 3500) }),
        }),
      );
      return { ok: r.ok, via: "binding", body: await r.json().catch(() => ({})) };
    }
  } catch (_) {}
  try {
    const r = await fetch("https://stratamesh-whatsapp.stratamesh.workers.dev/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: OWNER_WA, text: text.slice(0, 3500) }),
    });
    return { ok: r.ok, via: "http", body: await r.json().catch(() => ({})) };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

async function runBriefing(env, { voice = false, mode = "daily" } = {}) {
  const lisbon = nowLisbonParts();
  const pack = await composeBriefing(env, mode);
  const subject = "Briefing · " + lisbon.date + " · " + (pack.attention.n ? pack.attention.n + " decisão(ões)" : "sem decisões");
  const email = await sendEmail(env, subject, pack.text, {
    kind: "briefing",
    sections: pack.sections,
    preheader: pack.attention.line,
  });
  const wa = await sendWhatsAppText(
    env,
    "Nó CM · " + lisbon.date + "\n" + pack.attention.line + "\n\n" + pack.text.slice(0, 2800),
  );

  // Persist cycle with real channel outcomes for tomorrow's delta
  const cycle = Object.assign({}, pack.cycle, {
    channels: {
      email: !!(email && email.ok),
      whatsapp: !!(wa && wa.ok),
    },
    sent_at: new Date().toISOString(),
  });
  await saveLast(env, cycle);

  return {
    ok: true,
    date: lisbon.date,
    email,
    whatsapp: wa,
    voice_requested: voice,
    summary_preview: pack.text.slice(0, 500),
    attention: pack.attention.line,
    version: VERSION,
    contract: "delta-first-command",
  };
}

export default {
  async scheduled(controller, env, ctx) {
    // Free-plan cron can die mid-compose (RSS/intel). Always attempt mail;
    // catch sends a one-line failure notice instead of silence.
    ctx.waitUntil((async () => {
      try {
        const r = await runBriefing(env, { voice: false, mode: "daily" });
        console.log("briefing_cron", JSON.stringify({
          ok: r.ok, date: r.date, email: r.email && r.email.ok, wa: r.whatsapp && r.whatsapp.ok,
        }));
        if (r.email && r.email.ok === false) {
          await sendEmail(env, "Briefing · entrega falhou · " + (r.date || ""),
            "O ciclo das 11h correu mas DeoMail devolveu falha.\n" + JSON.stringify(r.email).slice(0, 800),
            { kind: "system" });
        }
      } catch (e) {
        console.log("briefing_cron_error", String(e && e.message || e));
        try {
          await sendEmail(env, "Briefing · falha no ciclo 11h",
            "O cron 0 10 UTC (11h Lisbon) falhou antes de fechar o briefing.\n" + String(e && e.stack || e.message || e).slice(0, 1500),
            { kind: "system" });
        } catch (_) {}
      }
    })());
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }
    try {
      if (path === "/health" || path === "/") {
        return j({
          status: "ok",
          service: "stratamesh-briefing",
          contract: "delta-first-command",
          owner_email: OWNER_EMAIL,
          schedule: "11:00 Europe/Lisbon",
          version: VERSION,
          good_briefing: [
            "delta-first",
            "decisions-before-narrative",
            "live-evidence",
            "no-self-task",
            "actionable-intel-only",
            "honest-stagnation",
            "readable-in-60s",
            "cycle-memory",
          ],
        });
      }
      if (path === "/preview") {
        const pack = await composeBriefing(env, "daily");
        return j({
          ok: true,
          version: VERSION,
          preview: true,
          text: pack.text,
          sections: pack.sections,
          provenance: pack.provenance,
          attention: pack.attention,
        });
      }
      if (path === "/run" && (request.method === "POST" || request.method === "GET")) {
        const voice = url.searchParams.get("voice") === "1";
        const result = await runBriefing(env, { voice, mode: "daily" });
        return j(result);
      }
      if (path === "/last") {
        const last = await loadLast(env);
        return j({ ok: !!last, version: VERSION, last });
      }
      return j({ error: "not_found", version: VERSION }, 404);
    } catch (e) {
      return j({ error: String(e.message || e), version: VERSION }, 500);
    }
  },
};