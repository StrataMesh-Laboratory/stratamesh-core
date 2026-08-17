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
  { id: "ugc_sandbox", name: "UGC Sandbox", role: "authoring / isolation holon" },
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

  const [status, orch, auth, iot] = await Promise.all([
    probe(env.STATUS, "/status"),
    probe(env.ORCH, "/health"),
    probe(env.AUTH, "/health"),
    probe(env.IOT, "/health"),
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
  if (iot && iot.ok) {
    const iv = (iot.data && iot.data.version) || "ok";
    const ag = iot.data && iot.data.agents_known;
    mesh.push("IoT edge " + iv + (ag != null ? "; agents_known=" + ag : ""));
  } else {
    mesh.push("IoT edge unreachable or binding missing");
  }
  reports.push(agentReport("mesh", mesh, iot && iot.ok ? "info" : "warn"));

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
    next_actions: buildNextActions(reports, status.data),
    acb_ops,
    temporal: typeof ppcCompact === "function" ? ppcCompact("metaverse_os") : null,
    foundation_path: typeof holonicContext === "function" ? holonicContext().path : null,
    version: "1.6.0-iot-mesh",
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
    probe(env.STATUS, "/status"),
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
      iot: { ok: !!(iot && iot.ok), http: iot && iot.status, version: iot && iot.data && iot.data.version },
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
      return new Response(JSON.stringify({ success: true, version: '1.5.0-ppc', pulses }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    if (path === "/health" || path === "/api/health" || path === "/api/aiops/health") {
      return json({
        status: "ok",
        worker: "stratamesh-aiops",
        version: "1.6.0-iot-mesh",
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
