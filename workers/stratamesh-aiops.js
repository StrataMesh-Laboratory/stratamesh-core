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

const AIOPS_VERSION = "1.10.5-destyle";
const STRATAGROK = {
  name: "STRATAGROK",
  bot_id: "c02df87b-0431-46b7-abfc-6f65d751af8e",
  mailbox: "grok@calhegasmorais.pt",
};

/** Standing lab backlog — executed hourly without a human prompt. */
const STANDING_BACKLOG = [
  { id: "SG-SPA", agent: "mesh", action: "Expose SPA registry metrics on public status pulse", success_check: "status.spa.total is a number" },
  { id: "SG-DAG", agent: "devops", action: "Expose DAG transaction_count on status pulse used by AIOps", success_check: "status.dag.transaction_count is a number" },
  { id: "SG-DELTA", agent: "analysis", action: "Persist cycle work evidence (not only health) for the 11h briefing", success_check: "AIOPS_KV worklog_latest exists" },
  { id: "SG-GOSSIP", agent: "mesh", action: "Keep fog+edge gossip peers listed and honest (no fabricated members)", success_check: "gossip count >= 1" },
];

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
      r = null; // no workers.dev (1042); require env.ACB binding
      if (false) r = await fetch('https://stratamesh-acb.stratamesh.workers.dev/acb/team/ops-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    }
    const j = await r.json().catch(() => null);
    if (j && j.success) return j.pulses || j;
  } catch (_) {}
  if (!ACB_ROSTER || !ACB_ROSTER.lead) return [];
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
        r = null;
        if (false) r = await fetch('https://stratamesh-acb.stratamesh.workers.dev/acb/pulse', {
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

const DEFAULT_STATUS = "https://stratamesh-status.stratamesh.workers.dev/health";
// Note: plain_text STATUS_URL/AUTH_URL/ORCH_URL may be origin-only — probe() normalizes paths.
const DEFAULT_ORCH = "https://stratamesh-orchestrator.stratamesh.workers.dev/health";
const DEFAULT_AUTH = "https://stratamesh-auth.stratamesh.workers.dev/health";

/** EMBEDDED from shared/holonic-clp.js — edit shared/ only */
/**
 * StrataMesh foundational holarchy + CLP temporal kernel (shared source of truth).
 * Workers embed or mirror this module — it is not decorative UI logic.
 *
 * Holonic stack (infra top → inhabitance bottom):
 *   DLT → Node(OS/VM) → Web3 Metaverse OS (shared) → {CLP, Dashboard} → Realm → World → Sandbox → User|SCA
 *
 * CLP: relative civil time.
 * Phase-1 temporal authority: PPC is planetary truth; ISO-8601 is dual wire/interop only.
 * Migration ISO→PPC does not delete ISO — it demotes UTC from authority to carrier.
 */

/** Temporal migration policy (phase 1) */
const TEMPORAL_POLICY = {
  phase: 1,
  authority: "PPC", // planetary convention points + local solar frame
  civil: "CLP",
  wire_carrier: "ISO-8601", // interop only — not civil authority
  gains: [
    "location_proof_baked_in",
    "no_utc_trusted_third_party_for_civil_time",
    "inertial_frame_sun_position",
    "self_validating_across_centuries",
    "poc_bindable_to_astronomical_reality",
    "contracts_astronomically_enforceable",
  ],
  loses: ["comfort_of_abstract_universal_time"],
};

const NODE_CMN = {
  node_id: "FOG-NODE-PT-CM-001",
  name: "Calhegas Morais Node",
  lat: 38.7169,
  lon: -9.1427,
  locality: "Lisboa, Portugal",
  realm_id: "realm_1f20890b",
  world_id: "world_b787cfe9-c",
  sandbox_id: "sbx_9bed54e8-880",
};

/** Ordered from substrate mesh to agent inhabitance */
const HOLONIC_LAYERS = [
  { id: "dlt", name: "StrataMesh DLT", role: "mesh DAG, PdC, PdS, Agora, gossip" },
  { id: "node", name: "Node OS/VM", role: "fog/edge host substrate" },
  { id: "metaverse_os", name: "Web3 Metaverse OS", role: "shared OS across nodes" },
  { id: "clp", name: "CLP temporal kernel", role: "relative lunisolar civil time + PPC matrix" },
  { id: "dashboard", name: "Dashboard/Portal", role: "OS application surface inside holarchy" },
  { id: "virtual_realm", name: "Virtual Realm", role: "hypervisor domain for worlds" },
  { id: "open_world", name: "Open-World", role: "multi-user persistent world" },
  { id: "ugc_sandbox", name: "CGU / UGC Sandbox", role: "CGU authoring (users+SCAs); STRATA NFTs" },
  { id: "agent", name: "User | SCA", role: "standing by function and agreement" },
];

const PPC = [
  [38.5575, -8.0611, "Almendres (PT)"],
  [47.5914, -3.0786, "Carnac (FR)"],
  [37.0242, -4.5483, "Menga (ES)"],
  [53.6944, -6.4750, "Newgrange (IE)"],
  [51.1789, -1.8261, "Stonehenge (UK)"],
];

const SYNODIC_MONTH = 29.53058868;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

function julianDate(ms) {
  return ms / 86400000 + 2440587.5;
}

function lunarAge(ms = Date.now()) {
  const days = (ms - KNOWN_NEW_MOON) / 86400000;
  return ((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
}

/** Simplified solar events for lat/lon (same model as CLP UI kernel). */
function solarTimes(date, lat, lon) {
  const jd = julianDate(date.getTime());
  const jc = (jd - 2451545.0) / 36525.0;
  let geomMeanLongSun = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360;
  const geomMeanAnomSun = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
  const eccentEarthOrbit = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);
  const sunEqOfCtr =
    Math.sin((geomMeanAnomSun * Math.PI) / 180) *
      (1.914602 - jc * (0.004817 + 0.000014 * jc)) +
    Math.sin((2 * geomMeanAnomSun * Math.PI) / 180) * (0.019993 - 0.000101 * jc) +
    Math.sin((3 * geomMeanAnomSun * Math.PI) / 180) * 0.000289;
  const sunTrueLong = geomMeanLongSun + sunEqOfCtr;
  const meanObliq =
    23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60;
  const obliqCorr =
    meanObliq + 0.00256 * Math.cos(((125.04 - 1934.136 * jc) * Math.PI) / 180);
  const sunDecl =
    (Math.asin(Math.sin((obliqCorr * Math.PI) / 180) * Math.sin((sunTrueLong * Math.PI) / 180)) *
      180) /
    Math.PI;
  const varY = Math.tan(((obliqCorr / 2) * Math.PI) / 180) ** 2;
  const eqOfTime =
    4 *
    ((varY * Math.sin((2 * geomMeanLongSun * Math.PI) / 180) -
      2 * eccentEarthOrbit * Math.sin((geomMeanAnomSun * Math.PI) / 180) +
      4 *
        eccentEarthOrbit *
        varY *
        Math.sin((geomMeanAnomSun * Math.PI) / 180) *
        Math.cos((2 * geomMeanLongSun * Math.PI) / 180) -
      0.5 * varY * varY * Math.sin((4 * geomMeanLongSun * Math.PI) / 180)) *
      180) /
    Math.PI;
  const tzMinutes = -date.getTimezoneOffset();
  const trueSolarNoon = (720 - 4 * lon - eqOfTime + tzMinutes) / 1440;
  const haArg =
    Math.cos((90.833 * Math.PI) / 180) /
      (Math.cos((lat * Math.PI) / 180) * Math.cos((sunDecl * Math.PI) / 180)) -
    Math.tan((lat * Math.PI) / 180) * Math.tan((sunDecl * Math.PI) / 180);
  let haSunrise = 0;
  if (haArg >= 1) haSunrise = 0;
  else if (haArg <= -1) haSunrise = 180;
  else haSunrise = (Math.acos(haArg) * 180) / Math.PI;
  const sunriseUTC = trueSolarNoon - (haSunrise * 4) / 1440;
  const sunsetUTC = trueSolarNoon + (haSunrise * 4) / 1440;
  const msInDay = 86400000;
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return {
    noon: new Date(startOfDay + trueSolarNoon * msInDay),
    sunrise: new Date(startOfDay + sunriseUTC * msInDay),
    sunset: new Date(startOfDay + sunsetUTC * msInDay),
    nadir: new Date(startOfDay + trueSolarNoon * msInDay + msInDay / 2),
  };
}

function intraDayPhase(now, lat, lon) {
  const times = solarTimes(now, lat, lon);
  const next = solarTimes(new Date(now.getTime() + 86400000), lat, lon);
  let phase, vector, ms;
  if (now >= times.sunrise && now < times.noon) {
    phase = "manha";
    vector = "divergencia_cumulativa_nascer";
    ms = now - times.sunrise;
  } else if (now >= times.noon && now < times.sunset) {
    phase = "tarde";
    vector = "convergencia_antecipatoria_ocaso";
    ms = times.sunset - now;
  } else if (now >= times.sunset && now < times.nadir) {
    phase = "noite_divergente";
    vector = "divergencia_ocaso";
    ms = now - times.sunset;
  } else {
    phase = "noite_convergente";
    vector = "convergencia_nascer_subsequente";
    const target = now < times.sunrise ? times.sunrise : next.sunrise;
    ms = target - now;
  }
  return { phase, vector, ms, times };
}

function seasonName(date) {
  const m = date.getMonth();
  if (m >= 2 && m <= 4) return "Primavera";
  if (m >= 5 && m <= 7) return "Verao";
  if (m >= 8 && m <= 10) return "Outono";
  return "Inverno";
}

/** Civil CLP address for a locality (foundational temporal label). */
function clpAddress(opts = {}) {
  const now = opts.date ? new Date(opts.date) : new Date();
  const lat = opts.lat != null ? opts.lat : NODE_CMN.lat;
  const lon = opts.lon != null ? opts.lon : NODE_CMN.lon;
  const locality = opts.locality || NODE_CMN.locality;
  const age = lunarAge(now.getTime());
  const lunarWeek = Math.floor(age / (SYNODIC_MONTH / 4)) + 1;
  const lunarDay = Math.floor(age % (SYNODIC_MONTH / 4)) + 1;
  const monthOfSeason = Math.floor(now.getMonth() % 3) + 1;
  const season = seasonName(now);
  const phase = intraDayPhase(now, lat, lon);
  const address = `${locality}, ${lunarDay}º dia da ${lunarWeek}ª semana do ${monthOfSeason}º mês do/a ${season} do Ano Corrente`;
  return {
    address,
    locality,
    lunar_day: lunarDay,
    lunar_week: lunarWeek,
    month_of_season: monthOfSeason,
    season,
    lunar_age_days: Number(age.toFixed(3)),
    lunar_pct: Number(((age / SYNODIC_MONTH) * 100).toFixed(2)),
    phase: phase.phase,
    vector: phase.vector,
    iso: now.toISOString(),
    node_id: opts.node_id || NODE_CMN.node_id,
  };
}

/** Full holonic placement for CMN lab (or override). */
function holonicContext(overrides = {}) {
  const n = { ...NODE_CMN, ...overrides };
  const clp = clpAddress({
    lat: n.lat,
    lon: n.lon,
    locality: n.locality,
    node_id: n.node_id,
  });
  return {
    stack: HOLONIC_LAYERS.map((l) => l.id),
    layers: HOLONIC_LAYERS,
    path: [
      "dlt:stratamesh",
      `node:${n.node_id}`,
      "metaverse_os:shared",
      "clp:kernel",
      `realm:${n.realm_id}`,
      `world:${n.world_id}`,
      `sandbox:${n.sandbox_id}`,
    ].join(" / "),
    node: n,
    clp,
    rules: {
      metaverse_os_shared_across_nodes: true,
      dashboard_inside_holarchy: true,
      worlds_inside_realms: true,
      standing_by_function_not_substrate: true,
      wire_time_iso8601: true,
      civil_time_clp: true,
    },
  };
}

function ppcMatrix(ms = Date.now()) {
  const jd = julianDate(ms);
  const age = lunarAge(ms);
  return PPC.map(([lat, lon, name]) => {
    const pseudoSolar = Math.abs(Math.sin(((jd + lon) / 360) * Math.PI));
    const pseudoLunar = Math.abs(Math.cos((age / SYNODIC_MONTH) * Math.PI * 2));
    return {
      name,
      lat,
      lon,
      theta: Math.log(pseudoSolar + 0.001).toFixed(6),
      lambda: Math.log(pseudoLunar + 0.001).toFixed(6),
    };
  });
}


/** Deterministic short fingerprint (FNV-1a 32-bit hex) — no crypto dependency. */
function fnv1aHex(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

/**
 * Phase-1 PPC stamp: dual encoding.
 * - iso: wire carrier (interop)
 * - clp: civil relative address
 * - ppc: inertial planetary matrix (truth layer)
 * - solar: local astronomical phase at claimed locality
 */
function ppcStamp(opts = {}) {
  const now = opts.date ? new Date(opts.date) : new Date();
  const ms = now.getTime();
  const lat = opts.lat != null ? opts.lat : NODE_CMN.lat;
  const lon = opts.lon != null ? opts.lon : NODE_CMN.lon;
  const locality = opts.locality || NODE_CMN.locality;
  const node_id = opts.node_id || NODE_CMN.node_id;
  const clp = clpAddress({ date: now, lat, lon, locality, node_id });
  const matrix = ppcMatrix(ms);
  const phase = intraDayPhase(now, lat, lon);
  const payload = {
    schema: "stratamesh.ppc.stamp.v1",
    policy: TEMPORAL_POLICY.phase,
    authority: TEMPORAL_POLICY.authority,
    node_id,
    locality,
    lat,
    lon,
    iso_carrier: now.toISOString(), // demoted: carrier, not authority
    jd: Number(julianDate(ms).toFixed(6)),
    clp,
    solar: {
      phase: phase.phase,
      vector: phase.vector,
      sunrise: phase.times.sunrise.toISOString(),
      noon: phase.times.noon.toISOString(),
      sunset: phase.times.sunset.toISOString(),
      nadir: phase.times.nadir.toISOString(),
    },
    ppc: matrix,
  };
  // Fingerprint binds locality + phase + PPC θ/λ — location-proof without TTP
  const canon =
    node_id +
    "|" +
    lat.toFixed(4) +
    "," +
    lon.toFixed(4) +
    "|" +
    phase.phase +
    "|" +
    matrix.map((p) => p.name + ":" + p.theta + "/" + p.lambda).join(";");
  payload.ppc_fingerprint = fnv1aHex(canon);
  payload.canon = canon;
  return payload;
}

/**
 * Self-validate a PPC stamp against recomputed astronomical/PPC state.
 * Phase 1: tolerance on fingerprint match + phase consistency + locality bounds.
 */
function validatePpcStamp(stamp, opts = {}) {
  if (!stamp || stamp.schema !== "stratamesh.ppc.stamp.v1") {
    return { ok: false, reason: "invalid_schema" };
  }
  const ms = stamp.iso_carrier ? Date.parse(stamp.iso_carrier) : Date.now();
  if (!Number.isFinite(ms)) return { ok: false, reason: "bad_iso_carrier" };
  const recomputed = ppcStamp({
    date: new Date(ms),
    lat: stamp.lat,
    lon: stamp.lon,
    locality: stamp.locality,
    node_id: stamp.node_id,
  });
  const fpMatch = recomputed.ppc_fingerprint === stamp.ppc_fingerprint;
  const phaseMatch = recomputed.solar.phase === (stamp.solar && stamp.solar.phase);
  // JD drift check (carrier vs astronomical continuum)
  const jdDelta = Math.abs(recomputed.jd - (stamp.jd || 0));
  const jdOk = jdDelta < 0.0002; // ~17s
  const ok = fpMatch && phaseMatch && jdOk;
  return {
    ok,
    authority: "PPC",
    fp_match: fpMatch,
    phase_match: phaseMatch,
    jd_delta: jdDelta,
    jd_ok: jdOk,
    expected_fingerprint: recomputed.ppc_fingerprint,
    claimed_fingerprint: stamp.ppc_fingerprint,
    location_proof: ok,
    note: ok
      ? "Stamp self-validates against PPC inertial matrix + local solar frame"
      : "Stamp failed astronomical/PPC self-validation",
  };
}

/** Explicit migration helper: ISO string → PPC-authoritative stamp */
function isoToPpc(iso, opts = {}) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) throw new Error("invalid_iso");
  return ppcStamp({ ...opts, date: new Date(ms) });
}


/**
 * Compact temporal envelope for embedding in DAG/ACB/PoC/diary (holon-aware).
 * holon: dlt | node | metaverse_os | clp | dashboard | virtual_realm | open_world | ugc_sandbox | agent
 */
function ppcCompact(holon = "dlt", opts = {}) {
  const full = ppcStamp(opts);
  return {
    schema: "stratamesh.ppc.compact.v1",
    holon,
    authority: "PPC",
    phase_policy: TEMPORAL_POLICY.phase,
    fp: full.ppc_fingerprint,
    jd: full.jd,
    phase: full.solar.phase,
    vector: full.solar.vector,
    iso_carrier: full.iso_carrier,
    locality: full.locality,
    node_id: full.node_id,
    lat: full.lat,
    lon: full.lon,
    clp_address: full.clp.address,
    ppc_anchors: full.ppc.map((p) => ({ name: p.name, theta: p.theta, lambda: p.lambda })),
  };
}

/** Attach temporal to a domain object without losing original fields. */
function withPpc(obj, holon, opts = {}) {
  const base = obj && typeof obj === "object" ? obj : { value: obj };
  return Object.assign({}, base, { temporal: ppcCompact(holon, opts) });
}


/** Origins in env (e.g. …workers.dev) need a health/status path appended. */
function normalizeServiceUrl(url, kind) {
  const u = String(url || "").replace(/\/$/, "");
  if (!u) {
    if (kind === "status") return DEFAULT_STATUS;
    if (kind === "orch") return DEFAULT_ORCH;
    return DEFAULT_AUTH;
  }
  if (/\/(health|status|cycle|tick)(\/|$)/i.test(u)) return u;
  if (kind === "status") return u.replace(/\/status$/i, "") + "/health";
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

  async function probe(binding, pathOnly) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 5000);
    try {
      // Worker-to-worker MUST use service bindings (public *.workers.dev → 1042/404 from inside Workers)
      if (!binding || typeof binding.fetch !== "function") {
        return { ok: false, error: "binding_missing" };
      }
      const r = await binding.fetch(
        new Request("https://service-binding" + pathOnly, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: ac.signal,
        })
      );
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

  const [statusHealth, orch, auth, iot] = await Promise.all([
    probe(env.STATUS, "/health"),
    probe(env.ORCH, "/health"),
    probe(env.AUTH, "/health"),
    probe(env.IOT, "/health"),
  ]);
  // Full pulse carries phase/spa/agora; /health is thin (version only)
  let status = statusHealth;
  const fullPulse = await probe(env.STATUS, "/");
  if (fullPulse.ok && fullPulse.data) {
    status = {
      ok: true,
      status: fullPulse.status,
      data: Object.assign({}, statusHealth.data || {}, fullPulse.data),
    };
  }
  const handoff = await loadHandoff(env);

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
  const dagNa = !status.ok || (status.data && status.data.dag && status.data.dag.transaction_count) == null;
  if (status.ok && dagNa) dev.push("DAG txs missing from pulse — mandate gap, not green");
  reports.push(agentReport("devops", dev, !orch.ok || !status.ok ? "critical" : dagNa ? "warn" : "info"));

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
    if (d.phase == null && d.phase_name == null) an.push("phase missing on pulse");
    else an.push("phase=" + d.phase + " (" + (d.phase_name || "") + ")");
    const spaA = d.spa && d.spa.active;
    const spaT = d.spa && d.spa.total;
    an.push("SPA " + (spaA ?? "?") + "/" + (spaT ?? "?"));
    if (spaA == null || spaT == null) an.push("SPA counts absent — mesh work unfinished");
    if ((d.dag && d.dag.transaction_count) != null && d.dag.transaction_count < 1) {
      an.push("DAG idle — seed or peer sync recommended");
    }
  } else an.push("No status metrics");
  const spaGap = an.some((x) => /SPA counts absent|SPA \?\/\?/.test(x));
  reports.push(agentReport("analysis", an, !status.ok ? "warn" : spaGap ? "warn" : "info"));

  // mesh
  const mesh = [];
  if (status.ok && status.data && status.data.spa) {
    const roles = status.data.spa.by_role || {};
    mesh.push("roles=" + JSON.stringify(roles));
    if (!roles.fog && !roles.pinner) mesh.push("No fog/pinner SPA — register when host ready");
  } else mesh.push("SPA metrics missing");
  if (iot && iot.ok) {
    const iv = (iot.data && iot.data.version) || "ok";
    const ag = iot.data && iot.data.agents_known;
    mesh.push("IoT edge " + iv + (ag != null ? "; agents_known=" + ag : ""));
  } else {
    mesh.push("IoT edge unreachable or binding missing");
  }
  const spaMissing = mesh.some((x) => /SPA metrics missing/.test(x));
  reports.push(agentReport("mesh", mesh, spaMissing || !(iot && iot.ok) ? "warn" : "info"));

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
      iot: { ok: !!(iot && iot.ok), http: iot && iot.status, version: iot && iot.data && iot.data.version },
    },
    reports,
    next_actions: buildNextActions(reports, status.data, handoff),
    autonomous: true,
    handoff: handoff ? { posture: handoff.posture, generated_at: handoff.generated_at, headline: handoff.headline, mandatory: (handoff.mandatory_actions || []).length } : null,
    acb_ops,
    temporal: typeof ppcCompact === "function" ? ppcCompact("metaverse_os") : null,
    foundation_path: typeof holonicContext === "function" ? holonicContext().path : null,
    version: AIOPS_VERSION,
  };

  if (env.AIOPS_KV) {
    try {
      await env.AIOPS_KV.put("last_cycle", JSON.stringify(cycle));
      await env.AIOPS_KV.put("next_actions", JSON.stringify({ at: cycle.at, actions: cycle.next_actions || [] }));
    } catch (_) {}
  }
  try {
    cycle.work = await executeAutonomousSlice(env, cycle);
  } catch (e) {
    cycle.work = { ok: false, error: String(e.message || e) };
  }
  return cycle;
}

async function runTeamCycleLight(env) {
  async function probe(binding, pathOnly) {
    try {
      if (!binding || typeof binding.fetch !== "function") return { ok: false, error: "binding_missing" };
      const r = await binding.fetch(new Request("https://service-binding" + pathOnly, {
        method: "GET", headers: { Accept: "application/json" },
      }));
      return { ok: r.ok, status: r.status };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }
  const [status, orch] = await Promise.all([
    probe(env.STATUS, "/health"),
    probe(env.ORCH, "/health"),
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

  const iotUrl = normalizeServiceUrl(env.IOT_URL || "https://stratamesh-iot.stratamesh.workers.dev/health", "iot");
  const [status, orch, auth, iot] = await Promise.all([
    probe(env.STATUS, "/health"),
    probe(env.ORCH, "/health"),
    probe(env.AUTH, "/health"),
    probe(env.IOT, "/health"),
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
      iot: { ok: !!(iot && iot.ok), http: iot && iot.status, version: iot && iot.data && iot.data.version },
    },
    reports,
    next_actions: buildNextActions(reports, status.data, null),
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

function buildNextActions(reports, status, handoff) {
  const actions = [];
  // 1) External handoff mandatory (from Night Diagnostic / Dev Cycle)
  if (handoff && Array.isArray(handoff.mandatory_actions)) {
    for (const a of handoff.mandatory_actions) {
      actions.push({
        priority: a.priority === "P0" || a.priority === 0 ? 0 : a.priority === "P1" || a.priority === 1 ? 1 : 2,
        agent: a.owner || a.agent || "devops",
        action: a.verb || a.action || JSON.stringify(a),
        success_check: a.success_check || null,
        source: "handoff",
        id: a.id || null,
      });
    }
  }
  // 2) Critical / warn from live agents only
  for (const r of reports) {
    if (r.severity === "critical") {
      actions.push({ priority: 0, agent: r.agent, action: r.findings.join("; "), source: "aiops" });
    } else if (r.severity === "warn") {
      actions.push({ priority: 1, agent: r.agent, action: r.findings.join("; "), source: "aiops" });
    }
  }
  if (status && (status.temp_mode || String(status.version || "").includes("temp"))) {
    actions.push({
      priority: 1,
      agent: "devops",
      action: "Migrate Fog from temp session to always-on + publish_loop",
      source: "status",
    });
  }
  // 3) Optional handoff P2 (only if no P0/P1)
  const hasHard = actions.some((a) => a.priority <= 1);
  if (!hasHard && handoff && Array.isArray(handoff.optional_actions)) {
    for (const a of handoff.optional_actions.slice(0, 2)) {
      actions.push({
        priority: 2,
        agent: a.owner || a.agent || "docs",
        action: a.verb || a.action || JSON.stringify(a),
        success_check: a.success_check || null,
        source: "handoff_optional",
        id: a.id || null,
      });
    }
  }
  // Standing lab backlog — always at least one self-initiated item
  const have = new Set(actions.map((a) => a.id).filter(Boolean));
  for (const b of STANDING_BACKLOG) {
    if (have.has(b.id)) continue;
    actions.push({
      priority: 2,
      agent: b.agent,
      action: b.action,
      success_check: b.success_check,
      source: "standing_backlog",
      id: b.id,
    });
    have.add(b.id);
  }
  actions.sort((a, b) => a.priority - b.priority);
  return actions.slice(0, 8);
}

function orchCoordinate(proposals, cycle, pulse, extras) {
  const orch = "ACB-ORCH-CMN-001";
  const approved = [];
  const rejected = [];
  const deferred = [];
  const adjusted = [];
  const originated = [];
  const seen = new Set();
  const reports = (cycle && cycle.reports) || [];
  const summary = (cycle && cycle.summary) || {};
  const upstream = (cycle && cycle.upstream) || {};
  const findings = reports.flatMap((r) => (r.findings || []).map((f) => "[" + r.agent + "] " + f));
  const pulseSpa = pulse && typeof pulse.spa_total === "number" && pulse.spa_total > 0;
  const pulseDag = pulse && typeof pulse.dag_txs === "number";

  function deny(p, reason) {
    rejected.push({ id: p.id, cargo: p.agent, reason });
  }
  function defer(p, reason) {
    deferred.push({ id: p.id, cargo: p.agent, reason });
  }
  function ok(p, reason) {
    approved.push({
      id: p.id,
      agent: p.agent,
      action: p.action || p.verb,
      success_check: p.success_check,
      orch: "OK",
      orch_id: orch,
      scrutiny: reason,
    });
  }

  for (const p of proposals || []) {
    const id = p.id || p.action;
    const text = String(p.action || p.verb || "");
    if (!id || seen.has(id)) {
      deny(p, "duplicado — o Orquestrador não deixa a equipa repetir o mesmo cartão");
      continue;
    }
    seen.add(id);
    if (/mainnet|token.?sale|payout|secret|private.?key/i.test(text)) {
      deny(p, "fora de mandato lab — risco económico ou de segredo");
      continue;
    }
    if (id === "SG-SPA" && pulseSpa) {
      defer(p, "já medido no pulse (spa.total=" + pulse.spa_total + ") — não reabrir o mesmo gap");
      continue;
    }
    if (id === "SG-DAG" && pulseDag) {
      defer(p, "já medido no pulse (dag.txs=" + pulse.dag_txs + ") — fechar o cartão, não repetir");
      continue;
    }
    if (id === "SG-DELTA" && extras && extras.worklog) {
      defer(p, "worklog já existe — persistir o mesmo cartão 72 vezes não é desenvolvimento");
      continue;
    }
    if (/whatsapp|meta api|B-META-WA/i.test(text + id)) {
      defer(p, "canal secundário — não monopoliza o ciclo da malha");
      continue;
    }
    // Sequence: security/upstream before cosmetics
    if ((summary.critical || 0) > 0 && p.agent !== "security" && p.agent !== "devops" && /SG-DELTA|SG-REDDIT|docs/i.test(id + text)) {
      defer(p, "há critical no ciclo — primeiro Security/DevOps");
      continue;
    }
    ok(p, "gap ainda aberto e alinhado com o pulse");
  }

  // System-wide adjustments originated by the Orchestrator
  if ((summary.critical || 0) > 0) {
    originated.push({
      id: "ORCH-CRIT",
      agent: "security",
      action: "Tratar findings critical do ciclo antes de qualquer cartão de roadmap",
      success_check: "summary.critical === 0 no ciclo seguinte",
      orch: "ORIGINATED",
      orch_id: orch,
    });
  }
  if (upstream && upstream.status && upstream.status.ok === false) {
    originated.push({
      id: "ORCH-STATUS",
      agent: "devops",
      action: "Status pulse down — restaurar publicação do Fog antes de métricas novas",
      success_check: "status.ok === true",
      orch: "ORIGINATED",
      orch_id: orch,
    });
  }
  if (pulseSpa && pulseDag) {
    originated.push({
      id: "ORCH-NEXT",
      agent: "analysis",
      action: "SPA e DAG já no pulse — passar à qualidade da métrica (não nula, não seed-only) e Agora settlements numéricos",
      success_check: "agora.settlements is a number OR spa.source === gossip.peers",
      orch: "ORIGINATED",
      orch_id: orch,
    });
  }
  if (!findings.length) {
    originated.push({
      id: "ORCH-SILENCE",
      agent: "analysis",
      action: "Ciclo sem findings — o mandato falhou; obrigar cada cargo a um gap mensurável",
      success_check: "reports[].findings.length >= 1 para todos os cargos",
      orch: "ORIGINATED",
      orch_id: orch,
    });
  }

  for (const o of originated) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    approved.push(o);
    adjusted.push({ id: o.id, from: "orchestrator", why: o.action });
  }

  const decision =
    approved.length && rejected.length ? "OK_PARTIAL" :
    approved.length ? "OK_IMPLEMENT" :
    deferred.length && !rejected.length ? "DEFER" : "HOLD";

  return {
    orch,
    role: "coordinate+supervise+moderate+propose",
    decision,
    approved,
    rejected,
    deferred,
    adjusted,
    originated: originated.map((o) => o.id),
    view: {
      critical: summary.critical || 0,
      warn: summary.warn || 0,
      pulse_spa: pulse && pulse.spa_total,
      pulse_dag: pulse && pulse.dag_txs,
      pulse_ver: pulse && pulse.version,
    },
    note: "O Orquestrador não carimba a equipa. Deduplica, sequencia, defere o já medido, recusa fora de mandato, e origina ajustes com vista de sistema.",
  };
}

async function escalateStratagrok(env, work, cycle) {
  const subject = "ESCALADE · ORCH-SILENCE · FOG-NODE-PT-CM-001";
  const text = [
    "STRATAGROK " + STRATAGROK.bot_id,
    "Mailbox: " + STRATAGROK.mailbox,
    "",
    "O Orquestrador declarou SILENCE / mandato falhado neste ciclo horário.",
    "A equipa AIOps não deixou findings acionáveis o suficiente para implementar.",
    "",
    "cycle_id: " + ((cycle && cycle.cycle_id) || "?"),
    "at: " + (work.at || ""),
    "orch: " + JSON.stringify((work.orch_ok && {
      decision: work.orch_ok.decision,
      originated: work.orch_ok.originated,
      deferred: (work.orch_ok.deferred || []).map((d) => d.id),
      view: work.orch_ok.view,
    }) || {}, null, 2),
    "",
    "Pedido: retomar propose → escrutínio → implementar → verificar.",
    "Não responder com health-theatre. Fechar um gap mensurável (SPA source, Agora settlements, DAG qualidade).",
  ].join("\n");
  const payload = {
    to: STRATAGROK.mailbox,
    cc: ["amcmorais@icloud.com"],
    subject,
    text,
    lang: "pt-PT",
    kind: "system",
    preheader: "ORCH-SILENCE — escalade STRATAGROK",
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
      return { ok: r.ok, via: "binding", body };
    }
  } catch (e) {
    /* fall through */
  }
  // INC-1027: workers.dev hole burned (STASIS). Binding-only; do not reopen HTTP.
  if (false) {
    const r = await fetch("https://stratamesh-deomail.stratamesh.workers.dev/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await r.json().catch(() => ({}));
    return { ok: r.ok, via: "http", body };
  }
  return { ok: false, error: "deomail_http_disabled_inc1027", via: "disabled" };
}

async function verifyPulse() {
  try {
    const r = await fetch("https://status.calhegasmorais.pt/", {
      headers: { Accept: "application/json", "User-Agent": "aiops-verify" },
    });
    const j = await r.json().catch(() => null);
    const spaN = !!(j && j.spa && typeof j.spa.total === "number");
    const dagN = !!(j && j.dag && typeof j.dag.transaction_count === "number");
    return { ok: r.ok, version: j && j.version, spa_total: spaN ? j.spa.total : null, dag_txs: dagN ? j.dag.transaction_count : null, SG_SPA: spaN, SG_DAG: dagN };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

async function executeAutonomousSlice(env, cycle) {
  const work = { at: new Date().toISOString(), phase: "propose-ok-implement-verify", attempted: [], results: [] };
  const proposals = ((cycle && cycle.next_actions) || []).slice();
  if (!proposals.length) proposals.push(...STANDING_BACKLOG);
  work.team_proposals = proposals.map((p) => ({ cargo: p.agent, id: p.id, action: p.action }));
  const pulse = await verifyPulse();
  work.system_view = pulse;
  let worklogExists = false;
  try { worklogExists = !!(env.AIOPS_KV && (await env.AIOPS_KV.get("worklog_latest"))); } catch (_) {}
  const decision = orchCoordinate(proposals, cycle, pulse, { worklog: worklogExists });
  work.orch_ok = decision;
  const silence = (decision.originated || []).includes("ORCH-SILENCE");
  if (silence) {
    try {
      work.escalation = await escalateStratagrok(env, work, cycle);
    } catch (e) {
      work.escalation = { ok: false, error: String(e.message || e) };
    }
  }
  const approved = decision.approved || [];
  if (!approved.length) {
    work.results.push({ step: "implement", ok: false, skipped: "orch_hold" });
    return work;
  }
  for (const pick of approved) work.attempted.push(pick.id || pick.action);
  const pick = approved[0];
  // 1) Persist evidence in KV (always)
  try {
    if (env.AIOPS_KV) {
      const entry = {
        at: work.at,
        cycle_id: cycle && cycle.cycle_id,
        action: pick,
        actions: approved,
        summary: cycle && cycle.summary,
        mandate: "propose → orch OK → implement → verify",
        orch_ok: work.orch_ok,
        verify: work.verify || null,
        escalation: work.escalation || null,
      };
      await env.AIOPS_KV.put("worklog_latest", JSON.stringify(entry));
      const hist = JSON.parse((await env.AIOPS_KV.get("worklog_history")) || "[]");
      hist.unshift(entry);
      await env.AIOPS_KV.put("worklog_history", JSON.stringify(hist.slice(0, 72)));
      work.results.push({ step: "kv_worklog", ok: true });
    }
  } catch (e) {
    work.results.push({ step: "kv_worklog", ok: false, error: String(e.message || e) });
  }
  // 2) Refresh standing handoff so the next cycle is never empty
  try {
    const handoff = {
      schema: "stratamesh.handoff.v1",
      generated_at: work.at,
      posture: "lab_autonomous",
      headline: "Self-initiated AIOps slice — " + (pick.id || pick.action),
      mandatory_actions: STANDING_BACKLOG.slice(0, 3).map((b) => ({
        id: b.id,
        owner: b.agent,
        verb: b.action,
        priority: "P1",
        success_check: b.success_check,
      })),
    };
    await persistHandoff(env, handoff);
    work.results.push({ step: "handoff", ok: true });
  } catch (e) {
    work.results.push({ step: "handoff", ok: false, error: String(e.message || e) });
  }
  // 3) GitHub issue once per approved action per calendar day (if token bound)
  const token = env.GITHUB_PAT || env.GITHUB_TOKEN || env.GH_PAT;
  for (const pick of approved) {
  if (token && pick.id) {
    try {
      const day = work.at.slice(0, 10);
      const stampKey = "gh_issue_" + pick.id + "_" + day;
      const already = env.AIOPS_KV ? await env.AIOPS_KV.get(stampKey) : null;
      if (already) {
        work.results.push({ step: "github_issue", ok: true, id: pick.id, skipped: "already_today" });
      } else {
        const body = {
          title: "[AIOps autonomous] " + pick.id + " — " + String(pick.action).slice(0, 80),
          body:
            "Self-initiated by stratamesh-aiops " +
            AIOPS_VERSION +
            " (no human prompt).\n\nAction: " +
            pick.action +
            "\nOwner agent: " +
            (pick.agent || "?") +
            "\nSuccess: " +
            (pick.success_check || "n/a") +
            "\nCycle: " +
            ((cycle && cycle.cycle_id) || "") +
            "\nNode: FOG-NODE-PT-CM-001 · lab / pre-testnet\n",
          labels: ["aiops", "lab", "autonomous"],
        };
        const r = await fetch(
          "https://api.github.com/repos/StrataMesh-Laboratory/stratamesh-core/issues",
          {
            method: "POST",
            headers: {
              Authorization: "Bearer " + token,
              Accept: "application/vnd.github+json",
              "User-Agent": "stratamesh-aiops-autonomous",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          },
        );
        const j = await r.json().catch(() => ({}));
        const ok = r.status === 201;
        if (ok && env.AIOPS_KV) await env.AIOPS_KV.put(stampKey, String(j.number || "1"), { expirationTtl: 172800 });
        work.results.push({ step: "github_issue", ok, status: r.status, number: j.number, url: j.html_url });
      }
    } catch (e) {
      work.results.push({ step: "github_issue", ok: false, error: String(e.message || e) });
    }
  } else {
    work.results.push({ step: "github_issue", ok: false, id: pick.id, skipped: "no_token_or_id" });
  }
  }
  // 4) Nudge Orchestrator (binding) so the SCA records the slice
  try {
    if (env.ORCH && typeof env.ORCH.fetch === "function") {
      await env.ORCH.fetch(
        new Request("https://orch.internal/tick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "aiops-workflow", orch_ok: work.orch_ok, action: pick, at: work.at }),
        }),
      );
      work.results.push({ step: "orch_tick", ok: true });
    }
  } catch (e) {
    work.results.push({ step: "orch_tick", ok: false, error: String(e.message || e) });
  }
  const verified = await verifyPulse();
  work.verify = verified;
  work.results.push({ step: "verify_pulse", ok: !!verified.ok, SG_SPA: verified.SG_SPA, SG_DAG: verified.SG_DAG });
  try {
    if (env.AIOPS_KV) {
      const prev = JSON.parse((await env.AIOPS_KV.get("worklog_latest")) || "{}");
      prev.verify = verified;
      prev.attempted = work.attempted;
      await env.AIOPS_KV.put("worklog_latest", JSON.stringify(prev));
    }
  } catch (_) {}
  return work;
}

async function loadHandoff(env) {
  // Tier 1: KV (POST /handoff)
  try {
    if (env.AIOPS_KV) {
      const raw = await env.AIOPS_KV.get("handoff_latest");
      if (raw) {
        const j = JSON.parse(raw);
        if (j && j.schema === "stratamesh.handoff.v1") {
          j._source = "kv";
          return j;
        }
      }
    }
  } catch (_) {}

  // Tier 2: GitHub JSON
  const jsonUrls = [
    env.HANDOFF_JSON_URL && String(env.HANDOFF_JSON_URL),
    "https://raw.githubusercontent.com/StrataMesh-Laboratory/stratamesh-core/main/ops/HANDOFF-LATEST.json",
  ].filter(Boolean);
  for (const url of jsonUrls) {
    try {
      const r = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "stratamesh-aiops/1.7" },
        cf: { cacheTtl: 30, cacheEverything: false },
      });
      if (!r.ok) continue;
      const j = await r.json();
      if (j && j.schema === "stratamesh.handoff.v1") {
        j._source = "github_json";
        return j;
      }
    } catch (_) {}
  }

  // Tier 3: Markdown JSON fence then legacy yaml
  const mdUrl =
    (env.HANDOFF_URL && String(env.HANDOFF_URL)) ||
    "https://raw.githubusercontent.com/StrataMesh-Laboratory/stratamesh-core/main/ops/HANDOFF-LATEST.md";
  try {
    const r = await fetch(mdUrl, {
      headers: { Accept: "text/plain", "User-Agent": "stratamesh-aiops/1.7" },
      cf: { cacheTtl: 30 },
    });
    if (r.ok) {
      const text = await r.text();
      const jm = text.match(/```json\s*([\s\S]*?)```/);
      if (jm) {
        try {
          const j = JSON.parse(jm[1]);
          if (j && j.schema === "stratamesh.handoff.v1") {
            j._source = "github_md_json";
            return j;
          }
        } catch (_) {}
      }
      const ym = text.match(/```ya?ml\s*([\s\S]*?)```/);
      if (ym) {
        const yaml = ym[1];
        const handoff = { schema: "stratamesh.handoff.v1", _source: "github_md_yaml", mandatory_actions: [], optional_actions: [] };
        const post = yaml.match(/posture:\s*(\w+)/);
        if (post) handoff.posture = post[1];
        const gen = yaml.match(/generated_at:\s*(\S+)/);
        if (gen) handoff.generated_at = gen[1];
        const head = yaml.match(/headline:\s*(.+)/);
        if (head) handoff.headline = head[1].trim();
        return handoff;
      }
    }
  } catch (_) {}
  return null;
}

async function persistHandoff(env, handoff) {
  if (!env.AIOPS_KV || !handoff) return false;
  try {
    await env.AIOPS_KV.put("handoff_latest", JSON.stringify(handoff));
    await env.AIOPS_KV.put("handoff_at", new Date().toISOString());
    return true;
  } catch (_) {
    return false;
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


async function orchestratorChat(message, env) {
  const text = String(message || "").trim().slice(0, 2000);
  if (!text) {
    return { reply: "Send a non-empty message.", role: "orchestrator" };
  }

  const cycle = await runTeamCycleBudgeted(env);
  const handoff = cycle.handoff || (await loadHandoff(env));
  const ctx = {
    node: "FOG-NODE-PT-CM-001",
    operator: "André Manuel Calhegas Morais",
    lab: true,
    cycle_ok: cycle.ok,
    summary: cycle.summary,
    upstream: cycle.upstream,
    findings: (cycle.reports || []).map((r) => ({
      agent: r.agent,
      severity: r.severity,
      findings: r.findings,
    })),
    next_actions: cycle.next_actions || [],
    handoff: handoff || null,
    delegation_rule:
      "Prefer handoff.mandatory_actions; AIOps warns/criticals; never invent mainnet work when green with empty mandatory.",
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


function wantsHtml(request) {
  return String(request.headers.get("Accept") || "").includes("text/html");
}

function publicPage() {
  const body = `<!DOCTYPE html>
<html lang="pt-PT">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>AIOps · v${AIOPS_VERSION}</title>
<style>
:root { --bg:#0a0a0b; --fg:#e8e6e3; --muted:#8a8780; --line:#1c1c1f; --acc:#c4a574; }
body { margin:0; font:16px/1.45 system-ui,sans-serif; background:var(--bg); color:var(--fg); }
main { max-width:40rem; margin:0 auto; padding:2.5rem 1.25rem 4rem; }
h1 { font-size:1.25rem; font-weight:600; }
p,li { color:var(--muted); }
a { color:var(--acc); }
code { color:var(--fg); }
.badge { display:inline-block; border:1px solid var(--line); padding:.15rem .5rem; font-size:.75rem; letter-spacing:.04em; }
</style>
</head>
<body>
<main>
<p class="badge">LAB · prerelease · not mainnet</p>
<h1>AIOps</h1>
<p>v<code>${AIOPS_VERSION}</code> · n=2 · mesh_member=true · f_max=0</p>
<p>Dev team worker. Not aBFT. Cycle roster is JSON (<code>/health</code>, <code>/status</code>), not this page. Fog Mac continuous · EDGE session expected.</p>
<ul>
<li><a href="/health">/health</a> JSON</li>
<li><a href="/status">/status</a> JSON</li>
<li><a href="https://fog.calhegasmorais.pt/health">Fog /health</a></li>
<li><a href="https://gossip.calhegasmorais.pt/health">Gossip /health</a></li>
<li><a href="https://github.com/StrataMesh-Laboratory/stratamesh-core/releases/tag/v0.3.0">tag v0.3.0</a></li>
</ul>
</main>
</body></html>`;
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleFetch(request, env, ctx);
    } catch (e) {
      return json({ error: "internal", message: String(e && e.message || e) }, 500);
    }
  },

  /** Cloudflare Cron Trigger — budgeted development cycle (free-tier safe) */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      runTeamCycleBudgeted(env)
        .catch(() => runTeamCycleLight(env))
        .then(async (cycle) => {
          if (cycle && !cycle.work) {
            try { cycle.work = await executeAutonomousSlice(env, cycle); } catch (_) {}
          }
          return cycle;
        })
    );
  },
};

async function handleFetch(request, env, ctx) {
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
      return new Response(JSON.stringify({ success: true, version: '1.5.0-ppc', pulses }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    if (path === "/health" || path === "/api/health" || path === "/api/aiops/health") {
      try {
        let last = null;
        let work = null;
        try {
          if (env.AIOPS_KV) {
            const raw = await env.AIOPS_KV.get("last_cycle");
            if (raw) last = JSON.parse(raw);
            const wraw = await env.AIOPS_KV.get("worklog_latest");
            if (wraw) work = JSON.parse(wraw);
          }
        } catch (_) {}
        return json({
          status: "ok",
          worker: "stratamesh-aiops",
          version: AIOPS_VERSION,
          n: 2,
          mesh_member: true,
          f_max: 0,
          lab: true,
          pre_release: true,
          host: "aiops.calhegasmorais.pt",
          acb_roster: ACB_ROSTER,
          team: TEAM.map((a) => a.id),
          mode: "continuous-development",
          continuous: {
            workers_cron: "0 1 * * *",
            workers_cron_note: "INC-1027 stop-probes; was hourly 0 * * * *; not re-enabled",
            host_loop: "scripts/aiops_continuous_loop.sh (true continuous)",
            note: "Workers cannot while(true); host process is the real continuous loop",
          },
          latest_cycle: last,
          worklog_latest: work ? { at: work.at, cycle_id: work.cycle_id, action: work.action } : null,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        return json({
          status: "ok",
          worker: "stratamesh-aiops",
          version: AIOPS_VERSION,
          error: String(e && e.message || e),
          timestamp: new Date().toISOString(),
        });
      }
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
      if (path === "/" && wantsHtml(request) && request.method === "GET") return publicPage();
      try {
        const last = env.AIOPS_KV ? await env.AIOPS_KV.get("last_cycle") : null;
        const work = env.AIOPS_KV ? await env.AIOPS_KV.get("worklog_latest") : null;
        return json({
          service: "StrataMesh AIOps Dev Team",
          version: AIOPS_VERSION,
          mandate: "Continuous development and operations of the Calhegas Morais Fog Node — not health-check theatre",
          note: "GET / serves last persisted cycle. POST or GET /cycle runs a live slice.",
          latest_cycle: last ? JSON.parse(last) : null,
          worklog_latest: work ? JSON.parse(work) : null,
        });
      } catch (e) {
        return json({
          service: "StrataMesh AIOps Dev Team",
          version: AIOPS_VERSION,
          error: "kv_read_failed",
          message: String(e && e.message || e),
        }, 200);
      }
    }


    if (path === "/handoff" || path === "/handoff/latest" || path === "/api/aiops/handoff" || path === "/api/aiops/handoff/latest") {
      if (request.method === "GET") {
        const h = await loadHandoff(env);
        return json({ ok: !!h, handoff: h, version: AIOPS_VERSION });
      }
      if (request.method === "POST") {
        let body = {};
        try { body = await request.json(); } catch (_) {}
        const h = body.handoff || body;
        if (!h || h.schema !== "stratamesh.handoff.v1") {
          return json({ error: "schema must be stratamesh.handoff.v1" }, 400);
        }
        const saved = await persistHandoff(env, h);
        return json({ ok: true, persisted_kv: saved, posture: h.posture, mandatory: (h.mandatory_actions || []).length });
      }
      return json({ error: "method_not_allowed" }, 405);
    }

    if (path === "/worklog" || path === "/api/aiops/worklog") {
      if (!env.AIOPS_KV) return json({ ok: false, error: "no_kv" }, 200);
      const latest = await env.AIOPS_KV.get("worklog_latest");
      const hist = await env.AIOPS_KV.get("worklog_history");
      return json({
        ok: true,
        version: AIOPS_VERSION,
        latest: latest ? JSON.parse(latest) : null,
        history: hist ? JSON.parse(hist) : [],
      });
    }

    if (path === "/actions" || path === "/api/aiops/actions" || path === "/delegate") {
      const cycle = await runTeamCycleBudgeted(env);
      return json({
        ok: cycle.ok,
        at: cycle.at,
        summary: cycle.summary,
        handoff: cycle.handoff,
        next_actions: cycle.next_actions,
        reports: cycle.reports,
        version: AIOPS_VERSION,
        note: "Orchestrator + Night/Dev automations should consume next_actions; empty when green is valid",
      });
    }

    return json({ error: "not_found", path }, 404);
}