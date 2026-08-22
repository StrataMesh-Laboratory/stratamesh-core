/**
 * Nó Calhegas Morais — Briefing diário (instrumento de comando).
 * Output institucional do SCA-Orquestrador para o proprietário.
 * Biografia e diário do SCA permanecem internos — não são secções deste documento.
 *
 * Canais: DeoMail → amcmorais@icloud.com · WhatsApp · TTS opcional
 * Cron: 11:00 Europe/Lisbon
 */
const VERSION = "2.0.0-command";
const OWNER_EMAIL = "amcmorais@icloud.com";
const OWNER_WA = "447404796458";
const LISBON_TZ = "Europe/Lisbon";
const CYCLE_CACHE = "https://briefing.internal/cycle/last";

const SEV = { CRITICAL: "CRITICAL", ACTION: "ACTION", WATCH: "WATCH", STABLE: "STABLE", INFO: "INFO" };
const ST = {
  COMPLETED: "COMPLETED",
  PARTIAL: "PARTIAL",
  BLOCKED: "BLOCKED",
  FAILED: "FAILED",
  DEFERRED: "DEFERRED",
  CANCELLED: "CANCELLED",
  SUPERSEDED: "SUPERSEDED",
  ACTIVE: "ACTIVE",
  RECURRING: "RECURRING",
};

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
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: parseInt(parts.hour, 10), minute: parseInt(parts.minute, 10) };
}

async function fetchJson(url, ms = 4000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { "User-Agent": "StrataMesh-Briefing/2.0 (No Calhegas Morais)" } });
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
  return { ok: false, error: "no_binding_" + name };
}

const FEEDS = [
  { id: "bbc-world", region: "global", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { id: "nyt-world", region: "global", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml" },
  { id: "nyt-tech", region: "global", url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml" },
  { id: "nyt-business", region: "global", url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml" },
  { id: "hn", region: "global", url: "https://hnrss.org/frontpage" },
  { id: "cf-blog", region: "global", url: "https://blog.cloudflare.com/rss/" },
  { id: "kreb", region: "global", url: "https://krebsonsecurity.com/feed/" },
  { id: "ecb", region: "europa", url: "https://www.ecb.europa.eu/rss/press.html" },
  { id: "ec-press", region: "europa", url: "https://ec.europa.eu/commission/presscorner/api/rss?language=en" },
  { id: "bdpt", region: "portugal", url: "https://www.bportugal.pt/rss.xml" },
  { id: "govpt", region: "portugal", url: "https://www.portugal.gov.pt/pt/gc24/comunicacao/noticias?mime=rss" },
  { id: "publico", region: "portugal", url: "https://feeds.feedburner.com/PublicoRSS" },
];

const NEEDLES = [
  { re: /ai act|artificial intelligence act|dora\b|nis2|gdpr|rgpd|aml|cft|eidas|mica\b|digital operational resilience/i, tag: "regulamentação", rel: "HIGH" },
  { re: /cloudflare|workers ai|\br2\b|\bd1\b|durable object/i, tag: "fornecedor", rel: "HIGH" },
  { re: /whatsapp|meta business|business api|cloud api/i, tag: "canal", rel: "HIGH" },
  { re: /ciber|cyber|ransomware|breach|zero.?day|privacidade|dados pessoais/i, tag: "segurança", rel: "HIGH" },
  { re: /blockchain|distributed ledger|\bdlt\b|tokeni[sz]ation|stablecoin|cbdc/i, tag: "TRD", rel: "HIGH" },
  { re: /\bllm\b|inteligência artificial|\bIA\b|foundation model/i, tag: "tecnologia", rel: "MED" },
  { re: /bce|ecb|euro digital|taxa de juro|ouro|gold price|brent|energia|gás/i, tag: "mercados", rel: "MED" },
  { re: /portugal|lisboa|orçamento|irs\b|irc\b|cmvm|banco de portugal|segurança social|imobili/i, tag: "jurisdição", rel: "MED" },
  { re: /euronext|mercado de capitais|financiamento|venture|seed/i, tag: "financiamento", rel: "MED" },
];

function scoreTitle(title) {
  const t = String(title || "");
  let rel = "LOW";
  const tags = [];
  for (const n of NEEDLES) {
    if (n.re.test(t)) {
      tags.push(n.tag);
      if (n.rel === "HIGH") rel = "HIGH";
      else if (rel !== "HIGH") rel = "MED";
    }
  }
  return { rel, tags };
}

function parseRssTitles(xml, max = 8) {
  const titles = [];
  const re = /<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([^<[\]\n]+)(?:\]\]>)?<\/title>/gi;
  let m;
  while ((m = re.exec(xml)) && titles.length < max) {
    const title = String(m[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    if (title && title.length > 12 && !/^BBC News/i.test(title)) titles.push(title);
  }
  return titles;
}

async function ingestFeeds() {
  const rows = await Promise.all(
    FEEDS.map(async (f) => {
      try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 4000);
        const r = await fetch(f.url, { signal: c.signal, headers: { "User-Agent": "StrataMesh-Briefing/2.0" } });
        clearTimeout(t);
        if (!r.ok) return { ...f, ok: false, titles: [] };
        const xml = await r.text();
        return { ...f, ok: true, titles: parseRssTitles(xml, 6) };
      } catch (_) {
        return { ...f, ok: false, titles: [] };
      }
    }),
  );
  const events = [];
  for (const f of rows) {
    for (const title of f.titles) {
      const sc = scoreTitle(title);
      events.push({
        title,
        source: f.id,
        region: f.region,
        rel: sc.rel,
        tags: sc.tags,
        kind: "OBSERVED",
        disposition: sc.rel === "HIGH" ? "MONITORIZAÇÃO" : sc.rel === "MED" ? "MONITORIZAÇÃO" : "IGNORAR",
      });
    }
  }
  const shown = events.filter((e) => e.rel !== "LOW");
  shown.sort((a, b) => (a.rel === "HIGH" ? -1 : 1) - (b.rel === "HIGH" ? -1 : 1));
  return { ingested: events.length, feeds_ok: rows.filter((r) => r.ok).length, feeds_n: rows.length, events: shown.slice(0, 12), all: events };
}

function seedBacklog() {
  return [
    {
      id: "T-026",
      title: "Verificação Meta / WhatsApp Business",
      priority: "P0",
      objective: "Concluir verificação do canal de voz/texto do Nó.",
      deps: "documentação externa do proprietário",
      doneWhen: "conta Business verificada e allowlist +351",
      state: ST.BLOCKED,
      cause: "documentação externa insuficiente",
      diagnosis: "bloqueio externo, não falha operacional do Nó",
      correction: "T-026A — preparar internamente; execução externa suspensa até desbloqueio documental",
    },
    {
      id: "T-026A",
      title: "Preparação documental Meta",
      priority: "P0",
      objective: "Deixar o processo pronto para execução imediata após recepção dos documentos.",
      deps: "nenhuma",
      doneWhen: "checklist interna validada",
      state: ST.ACTIVE,
    },
    {
      id: "T-027",
      title: "Briefing diário como projecção do estado SCA",
      priority: "P1",
      objective: "Produzir o instrumento de comando a partir do backlog e das observações, não como tarefa paralela inventada.",
      deps: "telemetria do Fog · feeds lícitos",
      doneWhen: "briefing enviado ao proprietário com arco ontem→hoje",
      state: ST.RECURRING,
    },
    {
      id: "T-028",
      title: "Manter Fog / AIOps / Ágora / PdC",
      priority: "P1",
      objective: "Continuidade operacional do Nó.",
      deps: "plano gratuito Workers",
      doneWhen: "probes do ciclo ok",
      state: ST.RECURRING,
    },
    {
      id: "T-029",
      title: "Segundo Fog (M9 BFT) quando existir operador",
      priority: "P2",
      objective: "Não inventar um segundo nó. Abrir quando houver operador.",
      deps: "operador humano / DAO / SCA com STRATA",
      doneWhen: "segundo Fog honesto em laboratório",
      state: ST.DEFERRED,
    },
  ];
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
    await caches.default.put(CYCLE_CACHE, new Response(body, { headers: { "Content-Type": "application/json", "Cache-Control": "max-age=259200" } }));
  } catch (_) {}
  try {
    if (env.KV && typeof env.KV.put === "function") await env.KV.put("cycle:last", body);
  } catch (_) {}
}

function fingerprint(probes, health) {
  return ["fog:" + (probes.status ? "ok" : "down"), "agora:" + (probes.agora ? "ok" : "down"), "pdc:" + (probes.poc ? "ok" : "down"), "qiga:" + (health.gen != null ? "ok" : "na")].join("|");
}

function classifyYesterday(last, todayFp, probes) {
  const plan = (last && last.plan) || seedBacklog().filter((t) => t.state === ST.ACTIVE || t.state === ST.RECURRING || t.state === ST.BLOCKED);
  const results = plan.map((t) => {
    const row = { ...t };
    if (t.id === "T-026") {
      row.state = ST.BLOCKED;
      row.result = "não concluída";
    } else if (t.id === "T-026A") {
      row.state = ST.PARTIAL;
      row.result = "checklist em curso — sem desbloqueio documental";
    } else if (t.id === "T-027") {
      row.state = ST.COMPLETED;
      row.result = last ? "briefing do ciclo anterior emitido" : "primeiro ciclo deste formato";
    } else if (t.id === "T-028") {
      row.state = probes.status && probes.agora && probes.poc ? ST.COMPLETED : ST.PARTIAL;
      row.result = probes.status ? "Fog a responder" : "Fog sem leitura";
    } else if (t.id === "T-029") {
      row.state = ST.DEFERRED;
      row.result = "sem operador para segundo Fog";
    }
    return row;
  });
  const counts = { planned: results.length, completed: 0, partial: 0, blocked: 0, failed: 0, deferred: 0 };
  for (const r of results) {
    if (r.state === ST.COMPLETED) counts.completed++;
    else if (r.state === ST.PARTIAL) counts.partial++;
    else if (r.state === ST.BLOCKED) counts.blocked++;
    else if (r.state === ST.FAILED) counts.failed++;
    else if (r.state === ST.DEFERRED) counts.deferred++;
  }
  counts.rate = counts.planned ? Math.round((counts.completed / counts.planned) * 100) : 0;
  const unchanged = last && last.fingerprint === todayFp;
  return { results, counts, unchanged };
}

function todayPlan(backlog) {
  return backlog
    .filter((t) => t.state === ST.ACTIVE || t.state === ST.RECURRING || t.state === ST.BLOCKED)
    .map((t) => ({
      id: t.id,
      priority: t.priority,
      title: t.title,
      objective: t.objective,
      deps: t.deps,
      doneWhen: t.doneWhen,
      state: t.state,
    }));
}

function ownerAttention(backlog) {
  const blockedOnOwner = backlog.filter((t) => t.state === ST.BLOCKED && /proprietário|documentação externa|owner/i.test((t.deps || "") + (t.cause || "")));
  if (!blockedOnOwner.length) {
    return { n: 0, sev: SEV.STABLE, line: "ATENÇÃO DO PROPRIETÁRIO: nenhuma.", items: [] };
  }
  return {
    n: blockedOnOwner.length,
    sev: SEV.ACTION,
    line: "ATENÇÃO DO PROPRIETÁRIO: " + blockedOnOwner.length + " decisão" + (blockedOnOwner.length > 1 ? "ões" : "") + " necessária" + (blockedOnOwner.length > 1 ? "s" : "") + ".",
    items: blockedOnOwner.map((t) => ({
      decision: "Disponibilizar a documentação Meta em falta para " + t.id,
      rec: "preparação interna (T-026A) continua; execução externa suspensa",
      why: t.cause || t.deps,
    })),
  };
}

function impactFromEvents(events) {
  const high = events.filter((e) => e.rel === "HIGH");
  return high.slice(0, 5).map((e) => ({
    event: e.title,
    relevance: "Alta",
    tags: e.tags.join(", ") || "Stratamesh",
    impact: "Pode afectar " + (e.tags[0] || "operação") + " do Nó / da malha.",
    state: "Monitorizar",
    action: "nenhuma neste ciclo",
    kind: "ASSESSED",
  }));
}

async function composeBriefing(env, mode) {
  const lisbon = nowLisbonParts();
  const [status, state, fed, agora, poc, intel, last] = await Promise.all([
    fetchBound(env, "STATUS", "/status"),
    fetchBound(env, "ORCH", "/state"),
    fetchBound(env, "ACB", "/acb/federate/round"),
    fetchBound(env, "AGORA", "/"),
    fetchBound(env, "POC", "/"),
    ingestFeeds(),
    loadLast(env),
  ]);

  const st = (status.ok && status.json) || {};
  const lobe = (state.ok && state.json) || {};
  const meta = lobe.meta || {};
  const probes = { status: status.ok, agora: agora.ok, poc: poc.ok };
  const health = {
    node: st.node_id || "FOG-NODE-PT-CM-001",
    version: st.version || "UNAVAILABLE",
    loc: (st.location && (st.location.locality_pt || st.location.label)) || "Lisboa, Portugal",
    lab: st.lab === true ? "sim" : status.ok ? "não" : "UNAVAILABLE",
    gen: meta.generation,
    ema: meta.fitness_ema,
    persist: lobe.persist_ok,
    fog: probes.status ? "operational" : "UNAVAILABLE",
    agora: probes.agora ? "active" : "UNAVAILABLE",
    pdc: probes.poc ? "active / sole mint path" : "UNAVAILABLE",
    aiops: probes.status ? "active" : "UNAVAILABLE",
  };
  const fp = fingerprint(probes, health);
  const yest = classifyYesterday(last, fp, probes);
  const backlog = seedBacklog();
  const plan = todayPlan(backlog);
  const attn = ownerAttention(backlog);
  const impact = impactFromEvents(intel.events);
  const envSev = impact.length ? SEV.WATCH : SEV.STABLE;
  const nodeSev = !probes.status ? SEV.CRITICAL : (!probes.agora || !probes.poc) ? SEV.WATCH : SEV.STABLE;

  const changes = [];
  if (!last) changes.push({ kind: "DERIVED", text: "Primeiro ciclo neste contrato de comando — sem arco anterior a comparar." });
  else if (yest.unchanged) changes.push({ kind: "OBSERVED", text: "Estado estático do Nó sem alteração desde ontem (" + (last.date || "ciclo anterior") + ")." });
  else changes.push({ kind: "OBSERVED", text: "Assinatura operacional mudou: " + (last.fingerprint || "—") + " → " + fp + "." });
  if (intel.feeds_ok < 3) changes.push({ kind: "OBSERVED", text: "Intelligence: " + intel.feeds_ok + "/" + intel.feeds_n + " feeds responderam." });

  const deviations = yest.results.filter((r) => r.state === ST.BLOCKED || r.state === ST.FAILED || r.state === ST.PARTIAL);
  const corrections = deviations.map((r) => ({
    id: r.id,
    failed: r.result || r.state,
    why: r.cause || r.diagnosis || r.deps,
    learning: r.id === "T-026" ? "a task estava demasiado agregada — separar preparação interna da acção dependente de terceiro" : "manter no backlog até critério de conclusão",
    correction: r.correction || "permanece no plano de hoje com o mesmo estado",
  }));

  const lines = [];
  lines.push("BRIEFING DIÁRIO · " + lisbon.date + " · 11h " + LISBON_TZ);
  lines.push("Destinatário: André Manuel Calhegas Morais · AMCM ENI · proprietário");
  lines.push("Emissor: SCA no cargo de Orquestrador · Nó Calhegas Morais");
  lines.push("Contrato: instrumento de comando — não é dump da arquitectura interna nem diário do SCA.");
  lines.push("");
  lines.push("1. ESTADO EXECUTIVO");
  lines.push("   NODE STATUS: " + nodeSev + " · Fog " + health.fog);
  lines.push("   EXTERNAL ENVIRONMENT: " + envSev);
  lines.push("   " + attn.line);
  lines.push("");
  lines.push("2. MUDANÇAS DESDE O ÚLTIMO BRIEFING");
  changes.forEach((c, i) => lines.push("   " + (i + 1) + ". [" + c.kind + "] " + c.text));
  lines.push("");
  lines.push("3. INTELLIGENCE EXTERNA RELEVANTE");
  lines.push("   Ingerido: " + intel.ingested + " títulos · " + intel.feeds_ok + " feeds · apresentados só os com relevância Stratamesh/Nó.");
  const byR = { global: [], europa: [], portugal: [] };
  for (const e of intel.events) (byR[e.region] || byR.global).push(e);
  for (const [k, arr] of Object.entries(byR)) {
    lines.push("   — " + k);
    if (!arr.length) lines.push("      (nada com relevância suficiente neste ciclo)");
    arr.slice(0, 4).forEach((e) => lines.push("      [" + e.rel + " · " + e.disposition + "] " + e.title + " · " + e.source));
  }
  lines.push("");
  lines.push("4. IMPACTO NO NÓ");
  if (!impact.length) lines.push("   Nenhum evento HIGH a gerar acção neste ciclo. Monitorização passiva.");
  impact.forEach((im, i) => {
    lines.push("   " + (i + 1) + ". Evento: " + im.event);
    lines.push("      Relevância: " + im.relevance + " · Impacto: " + im.impact);
    lines.push("      Estado: " + im.state + " · Acção do SCA: " + im.action);
  });
  lines.push("");
  lines.push("5. PLANO DE ONTEM → RESULTADOS");
  lines.push("   Previstas: " + yest.counts.planned + " · Concluídas: " + yest.counts.completed + " · Parciais: " + yest.counts.partial + " · Bloqueadas: " + yest.counts.blocked + " · Falhadas: " + yest.counts.failed + " · Taxa: " + yest.counts.rate + "% (secundária).");
  yest.results.forEach((r) => lines.push("   " + r.id + " · " + r.state + " — " + (r.result || r.title)));
  lines.push("");
  lines.push("6. FALHAS / BLOQUEIOS / CAUSAS");
  if (!deviations.length) lines.push("   Nenhuma falha operacional neste ciclo.");
  deviations.forEach((r) => {
    lines.push("   " + r.id + " · " + r.state);
    lines.push("      O que: " + (r.result || r.title));
    lines.push("      Porquê: " + (r.cause || r.diagnosis || r.deps || "—"));
    lines.push("      Responsabilidade causal: " + (r.diagnosis || "ver causa"));
  });
  lines.push("");
  lines.push("7. CORRECÇÕES INCORPORADAS NO PLANO");
  if (!corrections.length) lines.push("   Sem correcção estrutural neste ciclo.");
  corrections.forEach((c) => {
    lines.push("   " + c.id + " · " + c.correction);
    lines.push("      Aprendizagem operacional: " + c.learning);
  });
  lines.push("");
  lines.push("8. PLANO DE ACÇÃO — HOJE");
  plan.forEach((p) => {
    lines.push("   " + p.priority + " · " + p.id + " — " + p.title);
    lines.push("      Objectivo: " + p.objective);
    lines.push("      Dependência: " + p.deps + " · Critério: " + p.doneWhen + " · Estado: " + p.state);
  });
  lines.push("");
  lines.push("9. RISCOS / RESTRIÇÕES / DEPENDÊNCIAS");
  lines.push("   CONSTRAINT — tecto diário de Workers no plano gratuito.");
  lines.push("   BLOCKER — T-026: documentação externa Meta.");
  lines.push("   DEPENDENCY — segundo Fog (T-029) aguarda operador.");
  lines.push("   WATCHPOINT — persistência QIGA " + (health.persist === false ? "falhou neste ciclo" : "ok ou sem leitura"));
  if (!probes.status) lines.push("   INCIDENT — /status do Fog UNAVAILABLE neste ciclo.");
  lines.push("");
  lines.push("10. DECISÕES DO PROPRIETÁRIO");
  if (!attn.n) lines.push("   Nenhuma.");
  attn.items.forEach((it) => {
    lines.push("   DECISÃO: " + it.decision);
    lines.push("   Recomendação do SCA: " + it.rec);
    lines.push("   Motivo: " + it.why);
  });
  lines.push("");
  lines.push("11. NODE HEALTH (compacto)");
  lines.push("   " + health.node + " · " + health.version + " · lab " + health.lab + " · " + health.loc);
  lines.push("   Fog: " + health.fog + " · AIOps: " + health.aiops + " · Ágora: " + health.agora + " · PdC: " + health.pdc);
  lines.push("   QIGA: geração " + (health.gen != null ? health.gen : "UNAVAILABLE") + " / fitness EMA " + (health.ema != null ? Number(health.ema).toFixed(4) : "UNAVAILABLE"));
  lines.push("");
  lines.push("12. PRÓXIMO CICLO");
  lines.push("   Amanhã, 11h Lisboa — o mesmo arco: onde estávamos → o que aconteceu → onde estamos → para onde vamos.");
  lines.push("");
  lines.push("Proveniência: status=" + (status.ok ? "ok" : "UNAVAILABLE") + " · orch=" + (state.ok ? "ok" : "UNAVAILABLE") + " · federate=" + (fed.ok ? "ok" : "UNAVAILABLE") + " · intel=" + intel.feeds_ok + "/" + intel.feeds_n + ".");
  if (mode !== "daily") lines.push("(pedido pontual — o mesmo contrato do briefing das 11h Lisboa)");

  const flag = (sev) => ({ CRITICAL: "CRITICAL", ACTION: "ACTION", WATCH: "WATCH", STABLE: "STABLE", INFO: "INFO" }[sev] || sev);

  const sections = [
    { kicker: "00 · Atenção do proprietário", title: attn.line, kind: "attention", flag: flag(attn.sev), items: attn.items.map((it) => "DECISÃO: " + it.decision + " · Recomendação: " + it.rec) },
    {
      kicker: "01 · Estado executivo",
      title: "Nó " + flag(nodeSev) + " · Mundo " + flag(envSev),
      items: ["NODE STATUS: " + nodeSev + " · Fog " + health.fog, "EXTERNAL ENVIRONMENT: " + envSev + " — o mundo pode estar elevado sem o Nó estar em risco."],
    },
    { kicker: "02 · Mudanças desde o último briefing", title: last ? "vs " + last.date : "ciclo zero", items: changes.map((c) => "[" + c.kind + "] " + c.text) },
    {
      kicker: "03 · Intelligence externa",
      title: intel.ingested + " títulos ingeridos · " + intel.events.length + " relevantes",
      body: "O SCA ingere mais do que apresenta. Só entra o que possa afectar operação, arquitectura, fornecedores, custos, regulamentação, financiamento, segurança, mercados, tecnologia, comércio ou jurisdição.",
      items: intel.events.slice(0, 8).map((e) => "[" + e.region + " · " + e.rel + " · " + e.disposition + "] " + e.title),
    },
    {
      kicker: "04 · Impacto no Nó",
      title: impact.length ? impact.length + " evento(s) HIGH" : "Nenhuma acção neste ciclo",
      items: impact.length ? impact.map((im) => im.event + " → " + im.state + " · " + im.action) : ["Nenhum evento gera T-nova neste ciclo."],
    },
    {
      kicker: "05 · Plano de ontem",
      title: "Taxa " + yest.counts.rate + "% · " + yest.counts.completed + "/" + yest.counts.planned + " concluídas",
      items: yest.results.map((r) => r.id + " · " + r.state + " — " + (r.result || r.title)),
    },
    {
      kicker: "06 · Falhas / bloqueios / causas",
      title: deviations.length ? deviations.length + " desvio(s) material(is)" : "Sem falha operacional",
      items: deviations.length
        ? deviations.map((r) => r.id + " · " + r.state + " · " + (r.cause || r.diagnosis || r.result || ""))
        : ["Não tratar adiamentos e bloqueios externos como falhas do Nó."],
    },
    {
      kicker: "07 · Correcções no plano",
      title: corrections.length ? "incorporadas hoje" : "sem correcção estrutural",
      items: corrections.length ? corrections.map((c) => c.id + " · " + c.correction) : ["O backlog persiste; nada foi abandonado por omissão."],
    },
    {
      kicker: "08 · Plano de acção — hoje",
      title: plan.length + " acções",
      items: plan.map((p) => p.priority + " · " + p.id + " — " + p.title + " · " + p.state + " · critério: " + p.doneWhen),
    },
    {
      kicker: "09 · Riscos / restrições / dependências",
      title: "INCIDENT · RISK · CONSTRAINT · BLOCKER · DEPENDENCY · WATCHPOINT",
      items: [
        "CONSTRAINT — tecto diário de Workers (plano gratuito).",
        "BLOCKER — T-026 documentação externa Meta.",
        "DEPENDENCY — T-029 segundo Fog aguarda operador.",
        "WATCHPOINT — QIGA persistência " + (health.persist === false ? "falhou" : "sem incidente observado"),
      ],
    },
    {
      kicker: "10 · Decisões do proprietário",
      title: attn.n ? attn.n + " necessária(s)" : "Nenhuma",
      items: attn.n ? attn.items.map((it) => it.decision + " · " + it.why) : ["Nenhuma interrupção. A força do sistema é não interromper quando nada exige intervenção."],
    },
    {
      kicker: "11 · Node health",
      title: health.node,
      kind: "health",
      items: [
        health.version + " · lab " + health.lab + " · " + health.loc,
        "Fog " + health.fog + " · AIOps " + health.aiops + " · Ágora " + health.agora + " · PdC " + health.pdc,
        "QIGA gen " + (health.gen != null ? health.gen : "UNAVAILABLE") + " · EMA " + (health.ema != null ? Number(health.ema).toFixed(4) : "UNAVAILABLE"),
      ],
    },
    { kicker: "12 · Próximo ciclo", title: "amanhã 11h Lisboa", items: ["Arco: onde estávamos → o que aconteceu → onde estamos → para onde vamos."] },
  ];

  const userSections = [
    {
      kicker: "01 · Malha",
      title: health.node,
      items: yest.unchanged
        ? ["Sem alteração material do Nó desde o último ciclo."]
        : ["Fog " + health.fog + " · Ágora " + health.agora + " · PdC " + health.pdc],
    },
    {
      kicker: "02 · Contexto",
      title: "Títulos com relevância para a malha (OBSERVED)",
      items: intel.events.filter((e) => e.rel === "HIGH").slice(0, 3).map((e) => e.title).concat(intel.events.filter((e) => e.rel === "HIGH").length ? [] : ["Nenhum evento HIGH neste ciclo."]),
    },
    {
      kicker: "03 · A sua conta",
      title: "Clearance interna",
      body: "A sua conta confirmada permanece no piso interno. O Painel é o dashboard privado desta conta. Visitante anónimo fica na clearance pública.",
    },
  ];

  const cycle = {
    date: lisbon.date,
    version: VERSION,
    fingerprint: fp,
    plan,
    backlog,
    counts: yest.counts,
    attn: attn.n,
  };

  return {
    text: lines.join("\n"),
    sections,
    userSections,
    headlines: { ok: intel.feeds_ok > 0, titles: intel.events.map((e) => e.title), source: intel.feeds_ok + " feeds" },
    provenance: { status: status.ok, orch: state.ok, federate: fed.ok, intel: intel.feeds_ok + "/" + intel.feeds_n },
    cycle,
    attention: attn,
    health,
  };
}

async function sendEmail(env, subject, text, extra) {
  const payload = {
    to: (extra && extra.to) || OWNER_EMAIL,
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
        new Request("https://deomail.internal/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
      );
      return { ok: r.ok, via: "binding", body: await r.json().catch(() => ({})) };
    }
  } catch (_) {}
  try {
    const r = await fetch("https://stratamesh-deomail.stratamesh.workers.dev/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { ok: r.ok, via: "http", body: await r.json().catch(() => ({})) };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

async function sendWhatsAppText(env, text) {
  try {
    if (env.WHATSAPP && typeof env.WHATSAPP.fetch === "function") {
      const r = await env.WHATSAPP.fetch(
        new Request("https://wa.internal/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: OWNER_WA, text: text.slice(0, 4000) }) }),
      );
      return { ok: r.ok, via: "binding", body: await r.json().catch(() => ({})) };
    }
  } catch (_) {}
  try {
    const r = await fetch("https://stratamesh-whatsapp.stratamesh.workers.dev/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: OWNER_WA, text: text.slice(0, 4000) }),
    });
    return { ok: r.ok, via: "http", body: await r.json().catch(() => ({})) };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

async function tts(env, text) {
  if (!env.AI) return { ok: false, error: "no_ai_binding" };
  try {
    const result = await env.AI.run("@cf/deepgram/aura-1-en", { text: String(text || "").slice(0, 2000), speaker: "luna", encoding: "mp3" });
    if (result instanceof ArrayBuffer || result instanceof Uint8Array) return { ok: true, mime: "audio/mpeg", bytes: result };
    if (result && result.audio) return { ok: true, mime: "audio/mpeg", bytes: Uint8Array.from(atob(result.audio), (c) => c.charCodeAt(0)) };
    return { ok: false, error: "tts_unexpected_shape" };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

async function stt(env, audioBase64) {
  if (!env.AI) return { ok: false, error: "no_ai_binding" };
  try {
    const res = await env.AI.run("@cf/openai/whisper", { audio: audioBase64 });
    return { ok: true, text: res.text || res.transcription || "", raw: res };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

async function confirmedUserEmails(env) {
  try {
    let r;
    const headers = { "X-AMCM-Role": "briefing", Accept: "application/json" };
    if (env.AUTH && typeof env.AUTH.fetch === "function") r = await env.AUTH.fetch(new Request("https://auth.internal/users/confirmed", { headers }));
    else r = await fetch("https://stratamesh-auth.stratamesh.workers.dev/users/confirmed", { headers });
    const data = await r.json().catch(() => ({}));
    const emails = Array.isArray(data.emails) ? data.emails : [];
    return emails.filter((e) => e && String(e).toLowerCase() !== OWNER_EMAIL.toLowerCase()).slice(0, 80);
  } catch (_) {
    return [];
  }
}

async function sweepStubAccounts(env) {
  try {
    const headers = { "X-AMCM-Role": "briefing", Accept: "application/json" };
    const init = { method: "POST", headers };
    if (env.AUTH && typeof env.AUTH.fetch === "function") {
      const r = await env.AUTH.fetch(new Request("https://auth.internal/users/sweep-stubs", init));
      return await r.json().catch(() => null);
    }
    const r = await fetch("https://stratamesh-auth.stratamesh.workers.dev/users/sweep-stubs", init);
    return await r.json().catch(() => null);
  } catch (_) {
    return null;
  }
}

async function runBriefing(env, { voice = false, mode = "daily" } = {}) {
  const lisbon = nowLisbonParts();
  const pack = await composeBriefing(env, mode);
  await saveLast(env, pack.cycle);
  const subject = `Nó Calhegas Morais · Briefing ${lisbon.date} · ${pack.attention.n ? pack.attention.n + " decisão" : "STABLE"}`;
  const email = await sendEmail(env, subject, pack.text, {
    kind: "briefing",
    sections: pack.sections,
    cta: { label: "Abrir portal", href: "https://calhegasmorais.pt/dashboard" },
    preheader: pack.attention.line,
    flag: pack.attention.sev,
  });
  const sweep = await sweepStubAccounts(env);
  const users = await confirmedUserEmails(env);
  const userMail = { recipients: users.length, sent: 0, failed: 0 };
  for (const to of users) {
    const r = await sendEmail(env, `Nó Calhegas Morais · actualização ${lisbon.date}`, "", {
      to,
      kind: "update",
      sections: pack.userSections,
      cta: { label: "Abrir painel", href: "https://calhegasmorais.pt/painel" },
      preheader: "Actualização da malha · conta confirmada",
    });
    if (r.ok) userMail.sent++;
    else userMail.failed++;
  }
  const wa = await sendWhatsAppText(
    env,
    "Nó Calhegas Morais · " + lisbon.date + "\n" + pack.attention.line + "\n\n" + pack.text.slice(0, 3200) + "\n\nResponda «voz» para áudio, «resumo» para repetir.",
  );
  let ttsResult = null;
  if (voice) ttsResult = await tts(env, pack.text.slice(0, 1200));
  return {
    ok: true,
    date: lisbon.date,
    email,
    user_updates: userMail,
    sweep,
    whatsapp: wa,
    voice_requested: voice,
    tts: ttsResult ? { ok: ttsResult.ok, error: ttsResult.error || null } : null,
    summary_preview: pack.text.slice(0, 400),
    attention: pack.attention.line,
    version: VERSION,
  };
}

function wantsBriefing(text) {
  return /\b(resumo|briefing|brief|sum[aá]rio|executivo|voz|voice|audio|ligar|chamada)\b/i.test(String(text || ""));
}
function wantsVoice(text) {
  return /\b(voz|voice|audio|ouvir|chamada|ligar|speak)\b/i.test(String(text || ""));
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runBriefing(env, { voice: false, mode: "daily" }).then((r) => console.log("briefing_cron", JSON.stringify({ ok: r.ok, date: r.date, email: r.email?.ok }))));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "*" } });
    }
    try {
      if (path === "/health" || path === "/") {
        return j({
          status: "ok",
          service: "stratamesh-briefing",
          contract: "command-instrument",
          owner_email: OWNER_EMAIL,
          schedule: "11:00 Europe/Lisbon",
          version: VERSION,
          note: "Briefing is a projection of SCA state to the owner. Biography and diary stay internal.",
        });
      }
      if (path === "/preview") {
        const pack = await composeBriefing(env, "daily");
        return j({ ok: true, version: VERSION, preview: true, text: pack.text, sections: pack.sections, provenance: pack.provenance, attention: pack.attention });
      }
      if (path === "/run" && (request.method === "POST" || request.method === "GET")) {
        const voice = url.searchParams.get("voice") === "1" || url.searchParams.get("voz") === "1";
        return j(await runBriefing(env, { voice, mode: "daily" }));
      }
      if (path === "/tts" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const result = await tts(env, body.text || body.message || "");
        if (result.ok && result.bytes) return new Response(result.bytes, { headers: { "Content-Type": result.mime || "audio/mpeg", "Access-Control-Allow-Origin": "*" } });
        return j({ ok: false, error: result.error || "tts_failed" }, 502);
      }
      if (path === "/stt" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        if (!body.audio && !body.base64) return j({ error: "audio_base64_required" }, 400);
        const result = await stt(env, body.audio || body.base64);
        return j(result, result.ok ? 200 : 502);
      }
      if (path === "/wa-hook" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const text = body.text || body.message || body.body || "";
        if (!wantsBriefing(text)) return j({ ok: true, handled: false, reason: "no_keyword" });
        const voice = wantsVoice(text);
        return j({ ok: true, handled: true, voice, result: await runBriefing(env, { voice, mode: "on_demand" }) });
      }
      return j({ error: "not_found", version: VERSION }, 404);
    } catch (e) {
      return j({ error: String(e.message || e), version: VERSION }, 500);
    }
  },
};
