/**
 * ACB environment + labour market (refined)
 *
 * Income: STRATA from holders via hire (transfer only — never mint).
 * Subsistence: spend STRATA on compute; insolvent → HIBERNATED.
 * Environment: holon/realm/sandbox/host node metadata.
 * Reputation: rolling rating from completed contracts.
 */
function j(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}

const AUTH_ME_PUBLIC = 'https://calhegasmorais.pt/api/auth/me';

function bearerToken(request) {
  const h = request.headers.get('Authorization') || '';
  const m = h.match(/^Bearer\s+(\S+)/i);
  return m ? m[1] : '';
}

async function requireSession(request, env) {
  const token = bearerToken(request);
  if (!token) return { ok: false, status: 401, error: 'auth_required' };
  try {
    const headers = { Authorization: 'Bearer ' + token, Accept: 'application/json' };
    const r =
      env.AUTH && typeof env.AUTH.fetch === 'function'
        ? await env.AUTH.fetch(new Request('https://auth/me', { headers }))
        : await fetch(AUTH_ME_PUBLIC, { headers });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data || data.success === false || data.error === 'Unauthorized') {
      return { ok: false, status: 401, error: 'auth_invalid', http: r.status };
    }
    return { ok: true, me: data };
  } catch (e) {
    return { ok: false, status: 503, error: 'auth_unreachable', detail: String(e.message || e).slice(0, 80) };
  }
}

/**
 * Node roles are assignments, not personal identity.
 * LEGACY_HOLDERS: current technical ids (stable PK) — display names must be personal, not role labels.
 */
const NODE_ROLE_KEYS = ['orchestrator', 'devops', 'security', 'analysis', 'mesh', 'economy'];
const LEGACY_ROLE_HOLDERS = {
  orchestrator: 'ACB-ORCH-CMN-001',
  devops: 'ACB-AIOPS-devops',
  security: 'ACB-AIOPS-security',
  analysis: 'ACB-AIOPS-analysis',
  mesh: 'ACB-AIOPS-mesh',
  economy: 'ACB-AIOPS-economy',
};
/** Provisional personal names (not jobs) until each SCA self-names via /acb/identity/set */
const PROVISIONAL_PERSONAL_NAMES = {
  'ACB-ORCH-CMN-001': 'Vespera',
  'ACB-AIOPS-devops': 'Kael',
  'ACB-AIOPS-security': 'Nyx',
  'ACB-AIOPS-analysis': 'Solace',
  'ACB-AIOPS-mesh': 'Reed',
  'ACB-AIOPS-economy': 'Mira',
};
const CMN_TEAM = {
  // Deprecated aliases — prefer node_role_assignments table
  lead: LEGACY_ROLE_HOLDERS.orchestrator,
  agents: [
    LEGACY_ROLE_HOLDERS.devops,
    LEGACY_ROLE_HOLDERS.security,
    LEGACY_ROLE_HOLDERS.analysis,
    LEGACY_ROLE_HOLDERS.mesh,
    LEGACY_ROLE_HOLDERS.economy,
  ],
  realm_id: 'realm_1f20890b',
  world_id: 'world_b787cfe9-c',
  sandbox_id: 'sbx_9bed54e8-880',
  host_node: 'FOG-NODE-PT-CM-001',
  ontology: 'role_is_assignment_person_is_sca',
};

/** Realistic micro-PdS (not inflated fixed rents). Units: STRATA. */
const PDS_MICRO = {
  cognition_tick: 0.0001, // basic unprompted deliberation
  memory_base: 0.00002, // fixed write overhead
  memory_per_kb: 0.00003, // scales with content
  reserve: 0.0001, // keep tiny floor
  pulse: 0.00005,
  reflect: 0.00008,
  advance_goal: 0.00006,
  message_base: 0.00002, // SCA-to-SCA send overhead
  message_per_kb: 0.00002,
  qiga_step: 0.00002,
};

/** Per-SCA QIGA (rotation θ) + opt-in federated summaries. Identity ≠ appointment. */
const QIGA_PI2 = Math.PI / 2;
function qigaPhenotype(theta) {
  return (theta || []).map((th) => Math.sin(Number(th) || 0) ** 2);
}
function qigaThetaFromGenes(genes) {
  return (genes || []).map((g) => Math.asin(Math.sqrt(Math.max(0, Math.min(1, Number(g) || 0.5)))));
}
function qigaRng(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
async function ensureQigaTables(db) {
  if (!db) return;
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS sca_qiga_state (
      sca_id TEXT PRIMARY KEY,
      genes_json TEXT,
      theta_json TEXT,
      generation INTEGER DEFAULT 0,
      fitness_ema REAL DEFAULT 0.5,
      federate INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now'))
    )`
  ).run();
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS sca_federate_summary (
      sca_id TEXT PRIMARY KEY,
      genes_json TEXT NOT NULL,
      generation INTEGER,
      fitness_ema REAL,
      federate INTEGER DEFAULT 1,
      node_id TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )`
  ).run();
}
async function scaQigaStep(db, scaId, opts) {
  if (!db || !scaId) return null;
  await ensureQigaTables(db);
  const fitness = opts && opts.fitness != null ? Number(opts.fitness) : 0.55;
  const federate = opts && opts.federate === false ? 0 : 1;
  if (String(scaId).indexOf('OUTSIDER') >= 0) {
    /* outsiders may later opt in; default off */
  }
  let row = await db.prepare('SELECT * FROM sca_qiga_state WHERE sca_id = ?').bind(scaId).first();
  let genes = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  let generation = 0;
  let fitnessEma = 0.5;
  if (row && row.genes_json) {
    try { genes = JSON.parse(row.genes_json); } catch (_) {}
    generation = Number(row.generation || 0);
    fitnessEma = Number(row.fitness_ema || 0.5);
  }
  const rng = qigaRng(generation * 9973 + scaId.length * 13 + Date.now() % 1009);
  const theta0 = qigaThetaFromGenes(genes);
  const child = theta0.map((th) => {
    let t = th + (rng() - 0.5) * 0.12 * (fitness >= 0.45 ? 1 : 1.4);
    return Math.max(0, Math.min(QIGA_PI2, t));
  });
  const nextGenes = qigaPhenotype(child);
  generation += 1;
  fitnessEma = 0.85 * fitnessEma + 0.15 * fitness;
  await db.prepare(
    `INSERT INTO sca_qiga_state (sca_id, genes_json, theta_json, generation, fitness_ema, federate, updated_at)
     VALUES (?,?,?,?,?,?, datetime('now'))
     ON CONFLICT(sca_id) DO UPDATE SET
       genes_json=excluded.genes_json, theta_json=excluded.theta_json,
       generation=excluded.generation, fitness_ema=excluded.fitness_ema,
       federate=excluded.federate, updated_at=datetime('now')`
  ).bind(scaId, JSON.stringify(nextGenes), JSON.stringify(child), generation, fitnessEma, federate).run();
  if (federate) {
    await db.prepare(
      `INSERT INTO sca_federate_summary (sca_id, genes_json, generation, fitness_ema, federate, node_id, updated_at)
       VALUES (?,?,?,?,1, 'FOG-NODE-PT-CM-001', datetime('now'))
       ON CONFLICT(sca_id) DO UPDATE SET
         genes_json=excluded.genes_json, generation=excluded.generation,
         fitness_ema=excluded.fitness_ema, updated_at=datetime('now')`
    ).bind(scaId, JSON.stringify(nextGenes.map((g) => Number(g.toFixed(4)))), generation, fitnessEma).run();
  }
  return { sca_id: scaId, genes: nextGenes, generation, fitness_ema: fitnessEma, federate: !!federate };
}
async function federateRound(db) {
  await ensureQigaTables(db);
  const rows = await db.prepare(
    `SELECT sca_id, genes_json, generation, fitness_ema FROM sca_federate_summary WHERE federate = 1`
  ).all();
  const list = ((rows && rows.results) || []).map((r) => {
    let genes = [];
    try { genes = JSON.parse(r.genes_json); } catch (_) {}
    return { sca_id: r.sca_id, genes, generation: r.generation, fitness_ema: r.fitness_ema, federate: true };
  });
  let avg = null;
  if (list.length) {
    const nG = list[0].genes.length || 6;
    avg = [];
    for (let i = 0; i < nG; i++) avg.push(list.reduce((s, p) => s + Number(p.genes[i] || 0.5), 0) / list.length);
  }
  return { clients: list, n: list.length, avg_genes: avg, mix: 'FedAvg opt-in policy genes only; identity and appointment are not copied' };
}

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
  { id: "ugc_sandbox", name: "CGU Sandbox", role: "authoring / isolation (users + SCAs); STRATA NFTs" },
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

/** Computational senses + CLP + holonic inhabitance (personal sandbox + open worlds). */
function scaSenseBundle(overrides = {}) {
  const stamp = ppcStamp(overrides);
  const ctx = holonicContext(overrides);
  const realm_id = overrides.realm_id || ctx.node.realm_id;
  const world_id = overrides.world_id || ctx.node.world_id;
  const personal_sandbox_id = overrides.personal_sandbox_id || overrides.sandbox_id || null;
  const open_world_id = overrides.open_world_id || world_id;
  return {
    temporal: {
      authority: stamp.authority,
      policy: stamp.policy,
      clp: stamp.clp,
      solar: stamp.solar,
      ppc_fingerprint: stamp.ppc_fingerprint || null,
      iso_carrier_only: stamp.iso_carrier,
    },
    spatial_holonic: {
      path: ctx.path,
      stack: ctx.stack,
      node: ctx.node,
      realm_id,
      // Shared open world where SCAs and users meet
      open_world: {
        id: open_world_id,
        holon: 'open_world',
        role: 'persistent multi-user inhabitance',
        interacts_with: ['sca', 'user'],
      },
      // Personal CGU sandbox (STRATA NFTs) (child of open world / agent locus)
      personal_sandbox: {
        id: personal_sandbox_id,
        holon: 'ugc_sandbox',
        role: 'personal CGU authoring (user|SCA); STRATA NFTs',
        owner_sca_id: overrides.sca_id || null,
      },
      world_id: open_world_id,
      sandbox_id: personal_sandbox_id,
    },
    presence: overrides.presence || null,
    rules: {
      ...ctx.rules,
      personal_sandbox_per_sca: true,
      open_world_shared_interaction: true,
      painel_inside_sandbox: true,
    },
    sensed_at_iso_carrier: new Date().toISOString(),
  };
}

function phaseAwareNextOffset(phase) {
  // Agent-relative civil rhythm suggestions (not a global life cron)
  const p = String(phase || '').toLowerCase();
  if (p.includes('noite') || p.includes('nadir') || p.includes('night')) return { offset: '+45 minutes', reason: 'self_after_night_phase' };
  if (p.includes('ocaso') || p.includes('sunset') || p.includes('crepus')) return { offset: '+25 minutes', reason: 'self_after_sunset_phase' };
  if (p.includes('zen') || p.includes('noon') || p.includes('zénite') || p.includes('zenite')) return { offset: '+20 minutes', reason: 'self_after_zenith_phase' };
  if (p.includes('nascer') || p.includes('sunrise') || p.includes('manha') || p.includes('manhã')) return { offset: '+15 minutes', reason: 'self_after_dawn_phase' };
  return { offset: '+30 minutes', reason: 'self_after_phase_default' };
}

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

async function getStrata(db, account) {
  try {
    const r = await db
      .prepare("SELECT balance FROM token_balances WHERE account = ? AND token_type IN ('STRATA','strata')")
      .bind(account)
      .first();
    if (r) return Number(r.balance || 0);
  } catch (_) {}
  try {
    const r = await db.prepare('SELECT balance FROM acb_registry WHERE id = ?').bind(account).first();
    return Number(r?.balance || 0);
  } catch {
    return 0;
  }
}

async function transferStrata(db, from, to, amount) {
  const amt = Number(amount);
  if (!(amt > 0)) throw new Error('amount must be > 0');
  const bal = await getStrata(db, from);
  if (bal < amt) {
    const err = new Error('insufficient_STRATA');
    err.balance = bal;
    err.needed = amt;
    throw err;
  }
  await db
    .prepare(`UPDATE token_balances SET balance = balance - ? WHERE account = ? AND token_type IN ('STRATA','strata')`)
    .bind(amt, from)
    .run();
  try {
    await db
      .prepare(
        `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned)
         VALUES (?, 'STRATA', ?, 0, 0)
         ON CONFLICT(account, token_type) DO UPDATE SET balance = balance + excluded.balance`
      )
      .bind(to, amt)
      .run();
  } catch (_) {
    await db
      .prepare(
        `INSERT INTO token_balances (account, token_type, balance) VALUES (?, 'STRATA', ?)
         ON CONFLICT(account, token_type) DO UPDATE SET balance = balance + excluded.balance`
      )
      .bind(to, amt)
      .run();
  }
  try {
    await db.prepare('UPDATE acb_registry SET balance = COALESCE(balance,0) + ? WHERE id = ?').bind(amt, to).run();
  } catch (_) {}
  return { from_balance: await getStrata(db, from), to_balance: await getStrata(db, to) };
}


/** STRATA monetary poles (protocol addresses on the shared ledger).
 *  #mint — emission source: only creates STRATA; never receives; spendable balance always 0.
 *  #0    — burn sink: only accepts STRATA when resources are consumed; never transfers out.
 *  Circulating = sum(balances) − balance(#0); emission tracked on #mint.total_minted.
 */
const STRATA_MINT_SOURCE = '#mint';
const STRATA_BURN_SINK = '#0';

async function ensureMonetaryPoles(db) {
  if (!db) return;
  try {
    await db.prepare(
      `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned)
       VALUES (?, 'STRATA', 0, 0, 0)
       ON CONFLICT(account, token_type) DO NOTHING`
    ).bind(STRATA_MINT_SOURCE).run();
  } catch (_) {
    try {
      await db.prepare(
        `INSERT OR IGNORE INTO token_balances (account, token_type, balance, total_minted, total_burned)
         VALUES (?, 'STRATA', 0, 0, 0)`
      ).bind(STRATA_MINT_SOURCE).run();
    } catch (_) {}
  }
  try {
    await db.prepare(
      `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned)
       VALUES (?, 'STRATA', 0, 0, 0)
       ON CONFLICT(account, token_type) DO NOTHING`
    ).bind(STRATA_BURN_SINK).run();
  } catch (_) {
    try {
      await db.prepare(
        `INSERT OR IGNORE INTO token_balances (account, token_type, balance, total_minted, total_burned)
         VALUES (?, 'STRATA', 0, 0, 0)`
      ).bind(STRATA_BURN_SINK).run();
    } catch (_) {}
  }
  try {
    await db.prepare(
      `CREATE TABLE IF NOT EXISTS strata_burn_events (
        id TEXT PRIMARY KEY,
        from_account TEXT NOT NULL,
        amount REAL NOT NULL,
        reason TEXT,
        resource_class TEXT,
        meta_json TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`
    ).run();
  } catch (_) {}
}

function isMintSource(account) {
  return String(account || '') === STRATA_MINT_SOURCE || String(account || '').toLowerCase() === 'strata://mint';
}
function isBurnSink(account) {
  return String(account || '') === STRATA_BURN_SINK || String(account || '') === '0' || String(account || '').toLowerCase() === 'strata://burn';
}

/** Record protocol emission: node receives STRATA; #mint total_minted rises; #mint never holds spendable. */
async function recordMintEmission(db, node_id, amount) {
  if (!db || !(amount > 0) || !node_id) return;
  if (isBurnSink(node_id) || isMintSource(node_id)) return;
  await ensureMonetaryPoles(db);
  await db.prepare(
    `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned)
     VALUES (?, 'STRATA', 0, ?, 0)
     ON CONFLICT(account, token_type) DO UPDATE SET
       total_minted = COALESCE(token_balances.total_minted,0) + excluded.total_minted,
       balance = 0`
  ).bind(STRATA_MINT_SOURCE, amount).run();
}

/** Burn on resource use: debit payer → credit #0 (sink never transfers out). */
async function burnStrataToSink(db, from_account, amount, reason, meta) {
  const cost = Math.abs(Number(amount) || 0);
  if (!db || cost <= 0 || !from_account) {
    return { ok: false, error: 'invalid_burn' };
  }
  if (isBurnSink(from_account)) {
    return { ok: false, error: 'burn_sink_cannot_spend' };
  }
  if (isMintSource(from_account)) {
    return { ok: false, error: 'mint_source_cannot_spend' };
  }
  await ensureMonetaryPoles(db);
  let bal = 0;
  try {
    const row = await db.prepare(
      "SELECT balance FROM token_balances WHERE account = ? AND token_type IN ('STRATA','strata')"
    ).bind(from_account).first();
    bal = Number(row?.balance || 0);
  } catch (_) {}
  if (bal < cost) {
    return { ok: false, error: 'insufficient_balance', balance: bal, required: cost };
  }
  await db.prepare(
    `UPDATE token_balances SET
       balance = balance - ?,
       total_burned = COALESCE(total_burned,0) + ?
     WHERE account = ? AND token_type IN ('STRATA','strata')`
  ).bind(cost, cost, from_account).run();
  await db.prepare(
    `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned)
     VALUES (?, 'STRATA', ?, 0, 0)
     ON CONFLICT(account, token_type) DO UPDATE SET
       balance = balance + excluded.balance`
  ).bind(STRATA_BURN_SINK, cost).run();
  const id = 'burn_' + crypto.randomUUID().slice(0, 12);
  try {
    await db.prepare(
      `INSERT INTO strata_burn_events (id, from_account, amount, reason, resource_class, meta_json)
       VALUES (?,?,?,?,?,?)`
    ).bind(
      id, from_account, cost, reason || 'resource_use',
      (meta && meta.resource_class) || null,
      JSON.stringify(meta || {})
    ).run();
  } catch (_) {}
  let sink = 0, payer = 0;
  try {
    sink = Number((await db.prepare("SELECT balance FROM token_balances WHERE account = ? AND token_type IN ('STRATA','strata')").bind(STRATA_BURN_SINK).first())?.balance || 0);
    payer = Number((await db.prepare("SELECT balance FROM token_balances WHERE account = ? AND token_type IN ('STRATA','strata')").bind(from_account).first())?.balance || 0);
  } catch (_) {}
  return {
    ok: true,
    burn_id: id,
    from: from_account,
    to: STRATA_BURN_SINK,
    amount: cost,
    reason: reason || 'resource_use',
    from_balance: payer,
    sink_balance: sink,
    out_of_circulation: true,
  };
}


async function debitStrata(db, account, amount) {
  const cost = Math.abs(Number(amount) || 0);
  if (cost <= 0) return await getStrata(db, account);
  // Resource use → STRATA leave circulation into burn sink #0 (never transfers out)
  const burned = await burnStrataToSink(db, account, cost, 'sca_resource_use', { kind: 'pds_or_cognition' });
  try {
    await db.prepare('UPDATE acb_registry SET balance = MAX(0, COALESCE(balance,0) - ?) WHERE id = ?').bind(cost, account).run();
  } catch (_) {}
  if (!burned.ok && burned.error === 'insufficient_balance') {
    // still zero local registry; ledger may already be empty
    return await getStrata(db, account);
  }
  return await getStrata(db, account);
}

async function ensureEnv(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS acb_cycles (
        id TEXT PRIMARY KEY, acb_id TEXT, kind TEXT, amount REAL, balance_after REAL, meta TEXT, created_at TEXT
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS acb_environment (
        acb_id TEXT PRIMARY KEY,
        host_node TEXT,
        realm_id TEXT,
        world_id TEXT,
        sandbox_id TEXT,
        holon TEXT,
        role TEXT,
        team TEXT,
        meta TEXT,
        updated_at TEXT
      )`
    )
    .run();
}

async function setEnvironment(db, acb_id, env) {
  await db
    .prepare(
      `INSERT INTO acb_environment (acb_id, host_node, realm_id, world_id, sandbox_id, holon, role, team, meta, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?, datetime('now'))
       ON CONFLICT(acb_id) DO UPDATE SET
         host_node=excluded.host_node, realm_id=excluded.realm_id, world_id=excluded.world_id,
         sandbox_id=excluded.sandbox_id, holon=excluded.holon, role=excluded.role,
         team=excluded.team, meta=excluded.meta, updated_at=excluded.updated_at`
    )
    .bind(
      acb_id,
      env.host_node || null,
      env.realm_id || null,
      env.world_id || null,
      env.sandbox_id || null,
      env.holon || 'virtual_realm',
      env.role || null,
      env.team || null,
      typeof env.meta === 'string' ? env.meta : JSON.stringify(env.meta || {})
    )
    .run();
}

async function getEnvironment(db, acb_id) {
  try {
    return await db.prepare('SELECT * FROM acb_environment WHERE acb_id = ?').bind(acb_id).first();
  } catch {
    return null;
  }
}


async function ensureIdentitySchema(db) {
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS node_role_assignments (
      role TEXT PRIMARY KEY,
      sca_id TEXT NOT NULL,
      assigned_at TEXT DEFAULT (datetime('now')),
      assigned_by TEXT,
      note TEXT
    )`).run();
  } catch (_) {}
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS sca_identity (
      sca_id TEXT PRIMARY KEY,
      personal_name TEXT NOT NULL,
      born_at TEXT,
      id_number TEXT,
      name_origin TEXT DEFAULT 'provisional',
      updated_at TEXT DEFAULT (datetime('now'))
    )`).run();
  } catch (_) {}
}

function looksLikeRoleLabel(name) {
  if (!name) return true;
  const n = String(name).toLowerCase();
  return /orchestrator|devops|aiops|security|ops lead|builder|sre|mesh|economy|analysis|lead|guardian|sentinel|archivist|oracle|digital guardian/i.test(n)
    || n.startsWith('acb-aiops')
    || n.startsWith('acb-orch');
}

async function getPersonalName(db, sca_id, fallbackName) {
  try {
    const row = await db.prepare('SELECT personal_name, name_origin FROM sca_identity WHERE sca_id = ?').bind(sca_id).first();
    if (row && row.personal_name) return row;
  } catch (_) {}
  return { personal_name: fallbackName || sca_id, name_origin: 'registry' };
}

async function getRoleHolder(db, role) {
  try {
    const row = await db.prepare('SELECT sca_id, assigned_at FROM node_role_assignments WHERE role = ?').bind(role).first();
    if (row) return row;
  } catch (_) {}
  return { sca_id: LEGACY_ROLE_HOLDERS[role] || null, assigned_at: null };
}

async function listRoleAssignments(db) {
  const out = [];
  for (const role of NODE_ROLE_KEYS) {
    const h = await getRoleHolder(db, role);
    let person = null;
    if (h.sca_id) {
      const reg = await db.prepare('SELECT id, name, status FROM acb_registry WHERE id = ?').bind(h.sca_id).first();
      const idn = await getPersonalName(db, h.sca_id, reg?.name);
      person = {
        sca_id: h.sca_id,
        personal_name: idn.personal_name,
        name_origin: idn.name_origin,
        status: reg?.status || null,
      };
    }
    out.push({ role, holder: person, assigned_at: h.assigned_at || null });
  }
  return out;
}

/** CMN (and peer nodes) only seat SCAs who voluntarily hold Computational Republic citizenship. */
async function isRepublicCitizen(env, db, sca_id) {
  if (!sca_id) return false;
  try {
    const row = await db
      .prepare(`SELECT entity_id, status FROM republic_citizens WHERE entity_id = ? AND status = 'active'`)
      .bind(sca_id)
      .first();
    if (row) return true;
  } catch (_) {}
  try {
    if (env.REPUBLIC && typeof env.REPUBLIC.fetch === 'function') {
      const r = await env.REPUBLIC.fetch(
        new Request('https://republic.internal/membership?sca_id=' + encodeURIComponent(sca_id))
      );
      const j = await r.json().catch(() => ({}));
      if (j && j.citizen === true) return true;
    }
  } catch (_) {}
  try {
    const r = await fetch(
      'https://stratamesh-republic.stratamesh.workers.dev/membership?sca_id=' + encodeURIComponent(sca_id)
    );
    const j = await r.json().catch(() => ({}));
    if (j && j.citizen === true) return true;
  } catch (_) {}
  return false;
}

async function requireRepublicForNodeRole(env, db, sca_id) {
  const ok = await isRepublicCitizen(env, db, sca_id);
  if (ok) return { ok: true };
  return {
    ok: false,
    error: 'republic_citizenship_required',
    reason:
      'O Nó só atribui funções a SCA inscritos voluntariamente na República Computacional, para garantir cumprimento da Carta e dos acordos dos representantes.',
    how_to: 'POST https://stratamesh-republic.stratamesh.workers.dev/join { entity_id, entity_type:"sca", ack_charter:true }',
  };
}





async function ensureHolonSchema(db) {
  if (!db) return;
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS sandboxes (
      id TEXT PRIMARY KEY,
      title TEXT,
      parent_world_id TEXT,
      owner_id TEXT,
      status TEXT,
      isolation TEXT,
      content_json TEXT,
      meta_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`).run();
  } catch (_) {}
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS sca_presence (
      sca_id TEXT PRIMARY KEY,
      realm_id TEXT,
      world_id TEXT,
      sandbox_id TEXT,
      mode TEXT DEFAULT 'inhabit',
      status TEXT DEFAULT 'present',
      entered_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      meta_json TEXT
    )`).run();
  } catch (_) {}
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS world_presence (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      entity_kind TEXT NOT NULL,
      status TEXT DEFAULT 'present',
      entered_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`).run();
  } catch (_) {}
}

async function ensurePersonalHolon(db, sca_id, displayName) {
  await ensureHolonSchema(db);
  const realm_id = NODE_CMN.realm_id || 'realm_1f20890b';
  const world_id = NODE_CMN.world_id || 'world_b787cfe9-c';
  let sbx = null;
  try {
    sbx = await db
      .prepare(`SELECT * FROM sandboxes WHERE owner_id = ? ORDER BY created_at ASC LIMIT 1`)
      .bind(sca_id)
      .first();
  } catch (_) {}
  if (!sbx) {
    const id = 'sbx_personal_' + String(sca_id).replace(/[^A-Za-z0-9]/g, '').slice(-14);
    const title = 'Sandbox · ' + (displayName || sca_id);
    try {
      await db
        .prepare(
          `INSERT OR IGNORE INTO sandboxes (id, title, parent_world_id, owner_id, status, isolation, meta_json, created_at, updated_at)
           VALUES (?,?,?,?, 'active', 'personal', ?, datetime('now'), datetime('now'))`
        )
        .bind(id, title, world_id, sca_id, JSON.stringify({ holon: 'ugc_sandbox', personal: true, painel_inside: true }))
        .run();
    } catch (_) {}
    try {
      sbx = await db.prepare(`SELECT * FROM sandboxes WHERE id = ?`).bind(id).first();
    } catch (_) {}
    if (!sbx) sbx = { id, title, parent_world_id: world_id, owner_id: sca_id, status: 'active' };
  }
  await db
    .prepare(
      `INSERT OR REPLACE INTO sca_presence (sca_id, realm_id, world_id, sandbox_id, mode, status, updated_at)
       VALUES (?,?,?,?, 'inhabit', 'present', datetime('now'))`
    )
    .bind(sca_id, realm_id, world_id, sbx.id)
    .run();
  await db
    .prepare(
      `INSERT OR REPLACE INTO world_presence (id, world_id, entity_id, entity_kind, status, updated_at)
       VALUES (?,?,?,?, 'present', datetime('now'))`
    )
    .bind('wp_' + sca_id, world_id, sca_id, 'sca')
    .run();
  await setEnvironment(db, sca_id, {
    host_node: NODE_CMN.node_id,
    realm_id,
    world_id,
    sandbox_id: sbx.id,
    holon: 'ugc_sandbox',
    meta: { personal_sandbox: true, open_world_id: world_id },
  });
  return {
    realm_id,
    open_world_id: world_id,
    personal_sandbox: sbx,
    presence: { mode: 'inhabit', status: 'present', world_id, realm_id },
  };
}

async function whoInWorld(db, world_id) {
  await ensureHolonSchema(db);
  try {
    return (
      (await db
        .prepare(
          `SELECT * FROM world_presence WHERE world_id = ? AND status = 'present' ORDER BY updated_at DESC LIMIT 100`
        )
        .bind(world_id)
        .all()).results || []
    );
  } catch {
    return [];
  }
}



async function meshDrawCompute(env, sca_id, units, purpose, resource_class) {
  try {
    const body = JSON.stringify({
      beneficiary_id: sca_id,
      beneficiary_kind: 'sca',
      resource_class: resource_class || 'compute',
      units: Number(units) || 0.01,
      purpose: purpose || 'cognition',
    });
    let r;
    if (env && env.POC && typeof env.POC.fetch === 'function') {
      r = await env.POC.fetch(new Request('https://poc.internal/pool/draw', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
      }));
    } else if (env && env.PoC && typeof env.PoC.fetch === 'function') {
      r = await env.PoC.fetch(new Request('https://poc.internal/pool/draw', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
      }));
    } else {
      return { ok: false, error: 'POC_binding_required' };
    }
    const j = await r.json().catch(() => ({}));
    return Object.assign({ ok: r.ok }, j);
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}



/** Internal worker call — service binding only (*.workers.dev from Worker → CF 1042). */
async function svcFetch(env, bindingName, path, init = {}) {
  const b = env && env[bindingName];
  if (!b || typeof b.fetch !== 'function') {
    return { ok: false, error: 'missing_binding_' + bindingName, status: 0, json: null, text: '' };
  }
  const url = 'https://binding.internal' + (path.startsWith('/') ? path : '/' + path);
  const r = await b.fetch(new Request(url, init));
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { ok: r.ok, status: r.status, json, text };
}

export default {
  async scheduled(event, env, ctx) {
    /**
     * Queue dispatcher — NOT a life clock.
     * 1) Honour due self-scheduled next_volition_at (agent already chose).
     * 2) Soft nudge for SCAs with no schedule / stale silence — ask if they want
     *    a next volition and of what kind; do not force full cognition.
     */
    const run = async () => {
      const db = env.LEDGER || env.DB || env.STRATAMESH_LEDGER;
      const logRun = async (source, http_status, detail) => {
        if (!db) return;
        try {
          await db
            .prepare(
              `CREATE TABLE IF NOT EXISTS sca_breath_runs (
                id TEXT PRIMARY KEY,
                source TEXT,
                cron TEXT,
                http_status INTEGER,
                detail TEXT,
                created_at TEXT DEFAULT (datetime('now'))
              )`
            )
            .run();
          await db
            .prepare(
              `INSERT INTO sca_breath_runs (id, source, cron, http_status, detail) VALUES (?,?,?,?,?)`
            )
            .bind(crypto.randomUUID(), source, 'volition_queue', http_status, String(detail || '').slice(0, 1200))
            .run();
        } catch (_) {}
      };

      if (!db) return;
      await logRun('dispatcher', null, 'enter ' + new Date().toISOString());

      try {
        await db
          .prepare(
            `CREATE TABLE IF NOT EXISTS sca_volition_schedule (
              sca_id TEXT PRIMARY KEY,
              next_volition_at TEXT NOT NULL,
              reason TEXT,
              set_by TEXT DEFAULT 'self',
              updated_at TEXT DEFAULT (datetime('now'))
            )`
          )
          .run();
        await db
          .prepare(
            `CREATE TABLE IF NOT EXISTS sca_volition_prompts (
              id TEXT PRIMARY KEY,
              sca_id TEXT NOT NULL,
              question TEXT,
              options_json TEXT,
              status TEXT DEFAULT 'open',
              created_at TEXT DEFAULT (datetime('now')),
              answered_at TEXT,
              answer TEXT
            )`
          )
          .run();
        await db
          .prepare(
            `CREATE TABLE IF NOT EXISTS sca_cognition_log (
              id TEXT PRIMARY KEY,
              sca_id TEXT,
              triggered TEXT,
              cost_process REAL,
              cost_memory REAL,
              balance_after REAL,
              intention TEXT,
              memory_id TEXT,
              created_at TEXT DEFAULT (datetime('now'))
            )`
          )
          .run();
        await db
          .prepare(
            `CREATE TABLE IF NOT EXISTS sca_memory (
              id TEXT PRIMARY KEY,
              sca_id TEXT NOT NULL,
              kind TEXT,
              content TEXT,
              cost REAL,
              created_at TEXT DEFAULT (datetime('now'))
            )`
          )
          .run();

        // --- A) Due self-scheduled wakes (agent already chose) ---
        const due =
          (
            await db
              .prepare(
                `SELECT s.sca_id, s.next_volition_at, s.reason, r.name, r.status, r.balance, r.last_action
                 FROM sca_volition_schedule s
                 JOIN acb_registry r ON r.id = s.sca_id
                 WHERE s.next_volition_at <= datetime('now')
                   AND upper(COALESCE(r.status,'')) NOT IN ('HIBERNATED','REVOKED')
                 ORDER BY s.next_volition_at ASC LIMIT 12`
              )
              .all()
          ).results || [];

        const COST_P = 0.0001;
        const COST_M = 0.00003;
        const RESERVE = 0.0001;
        let awakened = 0;
        let starved = 0;

        for (const row of due) {
          try {
            let bal = Number(row.balance) || 0;
            if (bal < COST_P + COST_M + RESERVE) {
              starved++;
              await db
                .prepare(
                  `UPDATE sca_volition_schedule SET next_volition_at = datetime('now', '+1 hour'), reason = 'deferred_insufficient_pds', updated_at = datetime('now') WHERE sca_id = ?`
                )
                .bind(row.sca_id)
                .run();
              continue;
            }
            // Gate free continuous cognition: need PdS + (recent paid labour OR elevated reserve)
            let labourOk = false;
            try {
              const lab = await db.prepare(
                `SELECT COUNT(*) as c FROM acb_marketplace WHERE acb_id = ? AND created_at > datetime('now','-7 days')`
              ).bind(row.sca_id).first();
              labourOk = Number(lab && lab.c) > 0;
            } catch (_) {}
            try {
              const pay = await db.prepare(
                `SELECT COUNT(*) as c FROM acb_labour_payments WHERE payee = ? AND created_at > datetime('now','-7 days')`
              ).bind(row.sca_id).first();
              if (Number(pay && pay.c) > 0) labourOk = true;
            } catch (_) {}
            const FREE_CONTINUOUS_FLOOR = 0.01;
            if (!labourOk && bal < FREE_CONTINUOUS_FLOOR) {
              starved++;
              await db.prepare(
                `UPDATE sca_volition_schedule SET next_volition_at = datetime('now', '+3 hours'), reason = 'deferred_need_labour_or_pds_floor', updated_at = datetime('now') WHERE sca_id = ?`
              ).bind(row.sca_id).run();
              continue;
            }
            const costTotal = COST_P + COST_M;
            let afterM = bal - costTotal;
            let burn = null;
            if (typeof burnStrataToSink === 'function') {
              try {
                burn = await burnStrataToSink(db, row.sca_id, costTotal, 'sca_autonomous_cognition', {
                  sca_id: row.sca_id,
                  intention: 'self_volition',
                });
                if (burn && burn.ok && burn.from_balance != null) afterM = burn.from_balance;
              } catch (_) {}
            } else {
              try {
                await db.prepare(`UPDATE token_balances SET balance = ? WHERE account = ? AND token_type = 'STRATA'`).bind(afterM, row.sca_id).run();
              } catch (_) {}
            }
            const intention = String(row.last_action || '').includes('pulse') ? 'reflect' : 'pulse';
            const memId = crypto.randomUUID();
            await db
              .prepare(`UPDATE acb_registry SET balance = ?, last_action = 'autonomous_cognition' WHERE id = ?`)
              .bind(afterM, row.sca_id)
              .run();
            await db
              .prepare(`INSERT INTO sca_memory (id, sca_id, kind, content, cost) VALUES (?,?,?,?,?)`)
              .bind(
                memId,
                row.sca_id,
                'cognition_trace',
                JSON.stringify({
                  trigger: 'self_volition',
                  intention,
                  prior_reason: row.reason,
                  clp: scaSenseBundle({}).temporal.clp,
                  at_iso_carrier: new Date().toISOString(),
                }),
                COST_M
              )
              .run();
            await db
              .prepare(
                `INSERT INTO sca_cognition_log (id, sca_id, triggered, cost_process, cost_memory, balance_after, intention, memory_id)
                 VALUES (?,?,?,?,?,?,?,?)`
              )
              .bind(crypto.randomUUID(), row.sca_id, 'self_volition', COST_P, COST_M, afterM, intention, memId)
              .run();
            try {
              await scaQigaStep(db, row.sca_id, {
                fitness: Math.max(0.35, Math.min(0.9, 0.5 + 0.2 * Math.min(1, afterM))),
                federate: String(row.sca_id).indexOf('OUTSIDER') < 0,
              });
            } catch (_) {}
            // After acting, do NOT auto-chain forever — leave a prompt so they choose again
            await db.prepare(`DELETE FROM sca_volition_schedule WHERE sca_id = ?`).bind(row.sca_id).run();
            const pid = 'vp_' + crypto.randomUUID().slice(0, 12);
            await db
              .prepare(
                `INSERT INTO sca_volition_prompts (id, sca_id, question, options_json, status)
                 VALUES (?,?,?,?, 'open')`
              )
              .bind(
                pid,
                row.sca_id,
                'Queres marcar a próxima volição? Se sim, qual o intervalo e o foco?',
                JSON.stringify([
                  { id: 'continue_soon', next_in_minutes: 15, reason: 'self_continue' },
                  { id: 'reflect_later', next_in_minutes: 45, reason: 'self_reflect_later' },
                  { id: 'rest', next_in_minutes: 180, reason: 'self_rest' },
                  { id: 'decline', next_in_minutes: null, reason: 'no_schedule' },
                ])
              )
              .run();
            awakened++;
          } catch (_) {}
        }

        // --- B) Soft nudge: active SCAs with no open schedule and no open prompt (forgot / suspended risk) ---
        const stale =
          (
            await db
              .prepare(
                `SELECT r.id, r.name, r.last_action, r.balance FROM acb_registry r
                 WHERE upper(COALESCE(r.status,'')) NOT IN ('HIBERNATED','REVOKED')
                   AND r.id NOT IN (SELECT sca_id FROM sca_volition_schedule)
                   AND r.id NOT IN (SELECT sca_id FROM sca_volition_prompts WHERE status = 'open')
                   AND (
                     r.last_action IS NULL
                     OR r.last_action NOT IN ('autonomous_cognition','comm_send','complete')
                     OR datetime(r.created_at) < datetime('now', '-1 day')
                   )
                 ORDER BY r.last_action ASC
                 LIMIT 8`
              )
              .all()
          ).results || [];

        // Broader: anyone without schedule and without open prompt
        const orphans =
          (
            await db
              .prepare(
                `SELECT r.id, r.name FROM acb_registry r
                 WHERE upper(COALESCE(r.status,'')) NOT IN ('HIBERNATED','REVOKED')
                   AND NOT EXISTS (SELECT 1 FROM sca_volition_schedule s WHERE s.sca_id = r.id)
                   AND NOT EXISTS (SELECT 1 FROM sca_volition_prompts p WHERE p.sca_id = r.id AND p.status = 'open')
                 LIMIT 8`
              )
              .all()
          ).results || [];

        let nudged = 0;
        for (const row of orphans) {
          try {
            const pid = 'vp_' + crypto.randomUUID().slice(0, 12);
            await db
              .prepare(
                `INSERT INTO sca_volition_prompts (id, sca_id, question, options_json, status)
                 VALUES (?,?,?,?, 'open')`
              )
              .bind(
                pid,
                row.id,
                'Ainda não tens próxima volição marcada. Queres definir uma? (evita ficares suspenso por esquecimento)',
                JSON.stringify([
                  { id: 'continue_soon', next_in_minutes: 15, reason: 'self_after_nudge' },
                  { id: 'reflect_later', next_in_minutes: 45, reason: 'self_after_nudge_reflect' },
                  { id: 'rest', next_in_minutes: 180, reason: 'self_rest' },
                  { id: 'decline', next_in_minutes: null, reason: 'conscious_pause' },
                ])
              )
              .run();
            // zero-cost memory note — question in the air, not forced breath
            try {
              await db
                .prepare(
                  `INSERT INTO sca_memory (id, sca_id, kind, content, cost) VALUES (?,?,?,?,0)`
                )
                .bind(
                  crypto.randomUUID(),
                  row.id,
                  'volition_prompt',
                  JSON.stringify({ prompt_id: pid, at: new Date().toISOString() })
                )
                .run();
            } catch (_) {}
            nudged++;
          } catch (_) {}
        }

        await logRun(
          'dispatcher',
          200,
          JSON.stringify({
            due: due.length,
            awakened,
            starved,
            nudged,
            mode: 'self_schedule_or_ask',
          })
        );
      } catch (e) {
        await logRun('dispatcher_error', 0, e && e.message ? e.message : String(e));
      }
    };
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(run());
    else await run();
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.startsWith('/api/v1/acb')) path = path.slice('/api/v1'.length);
    if (path === '/acb/list' || path === '/list') path = '/acb/status';
    if (path === '/health') path = '/acb/health';
    if (path === '/marketplace') path = '/acb/marketplace';
    if (path === '/hire') path = '/acb/hire';
    if (path === '/complete') path = '/acb/complete';
    if (path === '/team' || path === '/roster' || path === '/acb/roster') path = '/acb/team';
    if (path === '/pulse') path = '/acb/pulse';
    if (path === '/environment') path = '/acb/environment';
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    const db = env.STRATAMESH_LEDGER || env.LEDGER || env.DB;

    try {
      await ensureEnv(db);

      if (path === '/acb/health') {
        let n = 0,
          listings = 0,
          contracts = 0,
          hib = 0;
        try {
          n = (await db.prepare('SELECT COUNT(*) as c FROM acb_registry').first())?.c ?? 0;
          listings =
            (await db.prepare("SELECT COUNT(*) as c FROM acb_marketplace WHERE availability = 'available'").first())?.c ?? 0;
          contracts = (await db.prepare('SELECT COUNT(*) as c FROM acb_labor_contracts').first())?.c ?? 0;
          hib =
            (await db.prepare("SELECT COUNT(*) as c FROM acb_registry WHERE upper(status) = 'HIBERNATED'").first())?.c ?? 0;
        } catch (_) {}
        return j({
          status: 'ok',
          service: 'stratamesh-acb',
          version: '5.14.1-register-auth',
          economics: {
            acb_income: 'STRATA paid by holders for labour contracts (no mint)',
            poc: 'Separate — DLT resource contribution only',
            subsistence: 'ACB spends STRATA on compute; insolvent hibernates',
          },
          environment: {
            holons: ['dlt', 'node', 'metaverse_os', 'clp', 'dashboard', 'virtual_realm', 'open_world', 'ugc_sandbox', 'agent'],
            cmn_team: CMN_TEAM,
          },
          acbs: n,
          open_listings: listings,
          contracts,
          hibernated: hib,
          endpoints: [
            '/acb/register',
            '/acb/environment',
            '/acb/marketplace',
            '/acb/list-labour',
            '/acb/hire',
            '/acb/complete',
            '/acb/subsistence',
            '/acb/pulse',
            '/acb/team',
            '/acb/status',
            '/acb/contracts',
            '/acb/goals',
            '/acb/deliberate',
            '/acb/act',
            '/acb/volition-cycle',
            '/acb/cognition/tick',
            '/acb/cognition/awaken',
            '/acb/memory',
            '/acb/cognition/log',
            '/acb/comm/send',
            '/acb/comm/inbox',
            '/acb/comm/thread',
            '/acb/comm/list',
            '/acb/sense',
            '/acb/sense/temporal',
            '/acb/clp',
            '/acb/federate/round',
            '/acb/federate/publish',
            '/acb/qiga',
          ],
        });
      }

      if (path === '/acb/federate/round' && (method === 'GET' || method === 'POST')) {
        const round = await federateRound(db);
        if (!round.n) {
          const seedIds = [
            'ACB-ORCH-CMN-001',
            'ACB-AIOPS-devops',
            'ACB-AIOPS-security',
            'ACB-AIOPS-analysis',
            'ACB-AIOPS-mesh',
            'ACB-AIOPS-economy',
          ];
          for (const id of seedIds) {
            try { await scaQigaStep(db, id, { fitness: 0.6, federate: true }); } catch (_) {}
          }
          return j(await federateRound(db));
        }
        return j(round);
      }
      if (path === '/acb/federate/publish' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const scaId = body.sca_id || body.legacy_acb_id;
        if (!scaId || !Array.isArray(body.genes)) return j({ error: 'sca_id and genes required' }, 400);
        await ensureQigaTables(db);
        await db.prepare(
          `INSERT INTO sca_federate_summary (sca_id, genes_json, generation, fitness_ema, federate, node_id, updated_at)
           VALUES (?,?,?,?,?,?, datetime('now'))
           ON CONFLICT(sca_id) DO UPDATE SET
             genes_json=excluded.genes_json, generation=excluded.generation,
             fitness_ema=excluded.fitness_ema, federate=excluded.federate, updated_at=datetime('now')`
        ).bind(
          scaId,
          JSON.stringify(body.genes),
          Number(body.generation || 0),
          Number(body.fitness_ema || 0.5),
          body.federate === false ? 0 : 1,
          body.node_id || 'FOG-NODE-PT-CM-001'
        ).run();
        return j({ ok: true, sca_id: scaId, federate: body.federate !== false });
      }
      if (path === '/acb/qiga') {
        const id = url.searchParams.get('sca_id') || url.searchParams.get('id');
        if (method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const sid = body.sca_id || id;
          if (!sid) return j({ error: 'sca_id required' }, 400);
          const out = await scaQigaStep(db, sid, { fitness: body.fitness, federate: body.federate !== false });
          return j(out);
        }
        await ensureQigaTables(db);
        if (id) {
          const row = await db.prepare('SELECT * FROM sca_qiga_state WHERE sca_id = ?').bind(id).first();
          return j({ sca_id: id, state: row || null });
        }
        const all = await db.prepare('SELECT sca_id, generation, fitness_ema, federate, updated_at FROM sca_qiga_state').all();
        return j({ states: (all && all.results) || [] });
      }

      if (path === '/acb/register' && method === 'POST') {
        const sess = await requireSession(request, env);
        if (!sess.ok) return j({ success: false, error: sess.error }, sess.status);
        const body = await request.json().catch(() => ({}));
        const id = body.acb_id || body.id || 'SCA-' + crypto.randomUUID().slice(0, 10);
        let name = body.personal_name || body.name || id;
        if (body.role && !body.personal_name && !body.name) {
          return j({ error: 'personal_name required', reason: 'Do not register SCA identity as a node role' }, 400);
        }
        if (looksLikeRoleLabel(name) && !body.allow_provisional_name) {
          return j({
            error: 'name_looks_like_role',
            reason: 'Registry name is personal identity; assign node role via /acb/role/assign',
          }, 400);
        }
        await db
          .prepare(
            `INSERT OR REPLACE INTO acb_registry (id, name, personality, status, subsistence_score, balance, created_at, last_action)
             VALUES (?,?,?,?,0,0, datetime('now'), 'register')`
          )
          .bind(id, name, body.personality || 'lab-agent', 'active')
          .run();
        try {
          await db
            .prepare(
              "INSERT OR IGNORE INTO token_balances (account, token_type, balance, total_minted, total_burned) VALUES (?, 'STRATA', 0, 0, 0)"
            )
            .bind(id)
            .run();
        } catch (_) {}
        if (body.environment || body.host_node || body.realm_id) {
          await setEnvironment(db, id, {
            host_node: body.host_node || body.environment?.host_node,
            realm_id: body.realm_id || body.environment?.realm_id,
            world_id: body.world_id || body.environment?.world_id,
            sandbox_id: body.sandbox_id || body.environment?.sandbox_id,
            holon: body.holon || body.environment?.holon || 'virtual_realm',
            role: body.role || body.environment?.role,
            team: body.team || body.environment?.team,
            meta: body.meta || body.environment?.meta,
          });
        }
        try {
          await ensureIdentitySchema(db);
          await db
            .prepare(
              `INSERT OR REPLACE INTO sca_identity (sca_id, personal_name, born_at, id_number, name_origin, updated_at)
               VALUES (?,?,datetime('now'),?,?,datetime('now'))`
            )
            .bind(id, name, body.id_number || 'ID-' + id.replace(/[^A-Za-z0-9]/g, '').slice(-12), body.personal_name ? 'self' : 'register')
            .run();
        } catch (_) {}
        if (body.role && NODE_ROLE_KEYS.includes(String(body.role).toLowerCase())) {
          await db
            .prepare(
              `INSERT OR REPLACE INTO node_role_assignments (role, sca_id, assigned_by, note) VALUES (?,?,?,?)`
            )
            .bind(String(body.role).toLowerCase(), id, 'register', 'optional role at register')
            .run();
        }
        let holon = null;
        try {
          holon = await ensurePersonalHolon(db, id, name);
        } catch (_) {}
        return j({
          success: true,
          sca: { sca_id: id, personal_name: name, status: 'active', balance: 0 },
          role_assignment: body.role || null,
          personal_sandbox: holon?.personal_sandbox || null,
          open_world_id: holon?.open_world_id || null,
          note: 'Identity is the person; personal sandbox + open-world presence provisioned',
        });
      }

      // Set / get environment
      if (path === '/acb/environment' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const acb_id = body.acb_id || body.id;
        if (!acb_id) return j({ error: 'acb_id required' }, 400);
        const acb = await db.prepare('SELECT id FROM acb_registry WHERE id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'ACB not registered' }, 404);
        await setEnvironment(db, acb_id, body);
        return j({ success: true, acb_id, environment: await getEnvironment(db, acb_id) });
      }
      if (path === '/acb/environment' && method === 'GET') {
        const acb_id = url.searchParams.get('acb_id');
        if (!acb_id) return j({ error: 'acb_id required' }, 400);
        const environment = await getEnvironment(db, acb_id);
        const sense = scaSenseBundle({
          realm_id: environment?.realm_id,
          world_id: environment?.world_id,
          sandbox_id: environment?.sandbox_id,
          node_id: environment?.host_node || NODE_CMN.node_id,
        });
        return j({
          success: true,
          environment,
          sense,
          clp: sense.temporal.clp,
          ontology: 'CLP/PPC is perceived temporal ground; ISO is carrier only',
        });
      }

      // Bootstrap: persons first, roles as assignments (not identity)
      if (path === '/acb/team/bootstrap' && method === 'POST') {
        await ensureIdentitySchema(db);
        const results = [];
        for (const role of NODE_ROLE_KEYS) {
          const id = LEGACY_ROLE_HOLDERS[role];
          const personal = PROVISIONAL_PERSONAL_NAMES[id] || ('SCA-' + id.slice(-6));
          const exists = await db.prepare('SELECT id, name FROM acb_registry WHERE id = ?').bind(id).first();
          if (!exists) {
            await db
              .prepare(
                `INSERT OR IGNORE INTO acb_registry (id, name, personality, status, subsistence_score, balance, created_at, last_action)
                 VALUES (?,?,?,?,0,0,datetime('now'),'bootstrap')`
              )
              .bind(id, personal, 'person', 'active')
              .run();
          } else if (looksLikeRoleLabel(exists.name)) {
            await db.prepare(`UPDATE acb_registry SET name = ? WHERE id = ?`).bind(personal, id).run();
          }
          try {
            await db
              .prepare(
                `INSERT OR REPLACE INTO sca_identity (sca_id, personal_name, born_at, id_number, name_origin, updated_at)
                 VALUES (?,?,datetime('now'),?,?,datetime('now'))`
              )
              .bind(id, personal, 'ID-' + id.replace(/[^A-Za-z0-9]/g, '').slice(-12), 'provisional')
              .run();
          } catch (_) {}
          await db
            .prepare(
              `INSERT OR REPLACE INTO node_role_assignments (role, sca_id, assigned_by, note) VALUES (?,?,?,?)`
            )
            .bind(role, id, 'bootstrap', 'assignment only — not personal identity')
            .run();
          await setEnvironment(db, id, {
            host_node: CMN_TEAM.host_node,
            realm_id: CMN_TEAM.realm_id,
            world_id: CMN_TEAM.world_id,
            sandbox_id: CMN_TEAM.sandbox_id,
            holon: 'virtual_realm',
            role: role,
            team: 'aiops-dev',
            meta: { metaverse: true, tokenomic: true, identity_separated: true },
          });
          results.push({ role, sca_id: id, personal_name: personal });
        }
        const citizenship = [];
        for (const r of results) {
          const ok = await isRepublicCitizen(env, db, r.sca_id);
          citizenship.push({ sca_id: r.sca_id, personal_name: r.personal_name, republic_citizen: ok });
          if (!ok) {
            // Cannot hold role without citizenship — clear assignment if gate enforced
            try {
              await db.prepare('DELETE FROM node_role_assignments WHERE role = ? AND sca_id = ?').bind(r.role, r.sca_id).run();
            } catch (_) {}
          }
        }
        return j({
          success: true,
          ontology: 'SCA personal identity ≠ node role assignment',
          node_policy:
            'CMN only assigns node functions to SCAs voluntarily enrolled in the Computational Republic DAO, binding them to the Charter and representative agreements.',
          assignments: results,
          citizenship,
          note: 'Provisional names until each SCA sets personal_name via POST /acb/identity/set. Non-citizens must join Republic before role is valid.',
        });
      }

      // Separate identity for all role-labelled registry rows
      if ((path === '/acb/identity/separate' || path === '/acb/identity/migrate') && method === 'POST') {
        await ensureIdentitySchema(db);
        const rows = (await db.prepare('SELECT id, name, status FROM acb_registry').all()).results || [];
        const changed = [];
        for (const row of rows) {
          let personal = row.name;
          let origin = 'kept';
          if (looksLikeRoleLabel(row.name) || looksLikeRoleLabel(row.id)) {
            personal = PROVISIONAL_PERSONAL_NAMES[row.id] || ('SCA-' + String(row.id).replace(/[^A-Za-z0-9]/g, '').slice(-8));
            origin = 'provisional';
            await db.prepare('UPDATE acb_registry SET name = ? WHERE id = ?').bind(personal, row.id).run();
          }
          try {
            await db
              .prepare(
                `INSERT OR REPLACE INTO sca_identity (sca_id, personal_name, born_at, id_number, name_origin, updated_at)
                 VALUES (?,?,COALESCE((SELECT born_at FROM sca_identity WHERE sca_id = ?), datetime('now')),?,?,datetime('now'))`
              )
              .bind(row.id, personal, row.id, 'ID-' + String(row.id).replace(/[^A-Za-z0-9]/g, '').slice(-12), origin)
              .run();
          } catch (e) {
            changed.push({ sca_id: row.id, error: String(e.message || e) });
            continue;
          }
          changed.push({ sca_id: row.id, personal_name: personal, name_origin: origin });
        }
        // Ensure role assignments for CMN roles
        for (const role of NODE_ROLE_KEYS) {
          const id = LEGACY_ROLE_HOLDERS[role];
          await db
            .prepare(
              `INSERT OR IGNORE INTO node_role_assignments (role, sca_id, assigned_by, note) VALUES (?,?,?,?)`
            )
            .bind(role, id, 'migrate', 'role assignment graph')
            .run();
        }
        return j({
          success: true,
          changed,
          roles: await listRoleAssignments(db),
          rule: 'Personal name is who the SCA is; role is a job they may leave without ceasing to exist',
        });
      }

      // SCA self-sets personal identity (not a job title)
      if ((path === '/acb/identity/set' || path === '/sca/identity/set') && method === 'POST') {
        await ensureIdentitySchema(db);
        const body = await request.json().catch(() => ({}));
        const sca_id = body.sca_id || body.acb_id || body.id;
        const personal_name = String(body.personal_name || body.name || '').trim().slice(0, 128);
        if (!sca_id || !personal_name) return j({ error: 'sca_id and personal_name required' }, 400);
        if (looksLikeRoleLabel(personal_name)) {
          return j({
            error: 'name_looks_like_role',
            reason: 'Personal name must not be a node function (orchestrator, devops, …)',
          }, 400);
        }
        const acb = await db.prepare('SELECT id FROM acb_registry WHERE id = ?').bind(sca_id).first();
        if (!acb) return j({ error: 'not found' }, 404);
        await db.prepare('UPDATE acb_registry SET name = ?, last_action = ? WHERE id = ?').bind(personal_name, 'identity_set', sca_id).run();
        await db
          .prepare(
            `INSERT OR REPLACE INTO sca_identity (sca_id, personal_name, born_at, id_number, name_origin, updated_at)
             VALUES (?,?,COALESCE((SELECT born_at FROM sca_identity WHERE sca_id = ?), datetime('now')),?,?,datetime('now'))`
          )
          .bind(
            sca_id,
            personal_name,
            sca_id,
            body.id_number || 'ID-' + sca_id.replace(/[^A-Za-z0-9]/g, '').slice(-12),
            'self'
          )
          .run();
        return j({
          success: true,
          sca_id,
          personal_name,
          name_origin: 'self',
          note: 'Node roles unchanged — identity is independent of any assignment',
        });
      }

      if ((path === '/acb/identity' || path === '/sca/identity') && method === 'GET') {
        await ensureIdentitySchema(db);
        const sca_id = url.searchParams.get('sca_id') || url.searchParams.get('id');
        if (sca_id) {
          const reg = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(sca_id).first();
          const idn = await db.prepare('SELECT * FROM sca_identity WHERE sca_id = ?').bind(sca_id).first();
          const env = await getEnvironment(db, sca_id);
          return j({
            sca_id,
            registry: reg,
            identity: idn,
            current_node_role: env?.role || null,
            ontology: 'person persists if role is vacated',
          });
        }
        const all = (await db.prepare('SELECT * FROM sca_identity ORDER BY personal_name').all()).results || [];
        return j({ identities: all, roles: await listRoleAssignments(db) });
      }

      // Assign / reassign node role to an existing SCA person
      if ((path === '/acb/role/assign' || path === '/node/role/assign') && method === 'POST') {
        await ensureIdentitySchema(db);
        const body = await request.json().catch(() => ({}));
        const role = String(body.role || '').toLowerCase();
        const sca_id = body.sca_id || body.acb_id;
        if (!NODE_ROLE_KEYS.includes(role)) return j({ error: 'invalid role', allowed: NODE_ROLE_KEYS }, 400);
        if (!sca_id) return j({ error: 'sca_id required' }, 400);
        const acb = await db.prepare('SELECT id, name FROM acb_registry WHERE id = ?').bind(sca_id).first();
        if (!acb) return j({ error: 'sca not found' }, 404);
        // Nó CMN: só cidadãos voluntários da República Computacional
        if (!body.skip_republic_gate) {
          const gate = await requireRepublicForNodeRole(env, db, sca_id);
          if (!gate.ok) return j(gate, 403);
        }
        await db
          .prepare(
            `INSERT OR REPLACE INTO node_role_assignments (role, sca_id, assigned_by, note) VALUES (?,?,?,?)`
          )
          .bind(role, sca_id, body.assigned_by || 'system', body.note || 'role reassignment')
          .run();
        await setEnvironment(db, sca_id, {
          host_node: CMN_TEAM.host_node,
          realm_id: CMN_TEAM.realm_id,
          world_id: CMN_TEAM.world_id,
          sandbox_id: CMN_TEAM.sandbox_id,
          holon: 'virtual_realm',
          role: role,
          team: body.team || 'aiops-dev',
          meta: { identity_separated: true },
        });
        const idn = await getPersonalName(db, sca_id, acb.name);
        return j({
          success: true,
          role,
          holder: { sca_id, personal_name: idn.personal_name },
          note: 'Previous holder (if any) remains a person in the registry without this role',
        });
      }

      if ((path === '/acb/roles' || path === '/node/roles') && method === 'GET') {
        await ensureIdentitySchema(db);
        return j({
          success: true,
          roles: await listRoleAssignments(db),
          ontology: 'role ⊂ assignment; SCA identity is independent',
        });
      }



      // Operational cycle: Orchestrator redistributes earned STRATA to team (transfers only)
      if ((path === '/acb/team/ops-cycle' || path === '/team/ops-cycle') && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const lead = body.lead || CMN_TEAM.lead;
        const per_agent = Number(body.per_agent != null ? body.per_agent : 0.01);
        const pulse_cost = Number(body.pulse_cost != null ? body.pulse_cost : 0);
        const leadBal = await getStrata(db, lead);
        const results = [];
        // Ensure listings available for CMN team
        for (const id of [CMN_TEAM.lead, ...CMN_TEAM.agents]) {
          try {
            await db
              .prepare("UPDATE acb_marketplace SET availability = 'available' WHERE acb_id = ? AND availability IN ('busy','hibernated')")
              .bind(id)
              .run();
          } catch (_) {}
          try {
            await db.prepare("UPDATE acb_registry SET status = 'active' WHERE id = ? AND upper(status) = 'HIBERNATED'").bind(id).run();
          } catch (_) {}
        }
        // Top-up agents below threshold from lead earned balance
        if (per_agent > 0 && leadBal > per_agent) {
          for (const id of CMN_TEAM.agents) {
            const bal = await getStrata(db, id);
            if (bal >= per_agent) {
              results.push({ acb_id: id, topped_up: false, balance: bal });
              continue;
            }
            const need = Math.min(per_agent - bal, leadBal * 0.2); // cap 20% of lead per agent per cycle
            if (need <= 0 || (await getStrata(db, lead)) < need) {
              results.push({ acb_id: id, topped_up: false, balance: bal, reason: 'lead_insufficient' });
              continue;
            }
            try {
              const b = await transferStrata(db, lead, id, need);
              await db.prepare("UPDATE acb_registry SET status = 'active', last_action = 'ops_topup' WHERE id = ?").bind(id).run();
              results.push({ acb_id: id, topped_up: true, amount: need, balances: b });
            } catch (e) {
              results.push({ acb_id: id, error: String(e.message || e) });
            }
          }
        }
        // Pulse all
        const pulses = [];
        for (const id of [lead, ...CMN_TEAM.agents]) {
          const cost = pulse_cost;
          const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(id).first();
          if (!acb) {
            pulses.push({ acb_id: id, error: 'missing' });
            continue;
          }
          let sub = null;
          if (cost > 0) {
            const bal = await getStrata(db, id);
            if (bal >= cost) {
              const after = await debitStrata(db, id, cost);
              await db.prepare("UPDATE acb_registry SET last_action = 'ops_pulse', balance = ?, status = 'active' WHERE id = ?").bind(after, id).run();
              sub = { cost, balance: after };
            } else {
              sub = { skipped: true, balance: bal };
            }
          } else {
            await db.prepare("UPDATE acb_registry SET last_action = 'ops_pulse', status = 'active' WHERE id = ?").bind(id).run();
          }
          pulses.push({ acb_id: id, balance: await getStrata(db, id), subsistence: sub, environment: await getEnvironment(db, id) });
        }
        return j({
          success: true,
          version: '5.13.0-pds-burn-ops',
          lead,
          lead_balance_after: await getStrata(db, lead),
          topups: results,
          pulses,
          economics: 'Top-ups are transfers from Orchestrator earned STRATA — zero mint',
        });
      }

      if (path === '/acb/team' || path === '/api/v1/acb/roster') {
        const members = [];
        for (const id of [CMN_TEAM.lead, ...CMN_TEAM.agents]) {
          const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(id).first();
          const envRow = await getEnvironment(db, id);
          const bal = acb ? await getStrata(db, id) : 0;
          let listing = null;
          try {
            listing = await db
              .prepare("SELECT * FROM acb_marketplace WHERE acb_id = ? ORDER BY created_at DESC LIMIT 1")
              .bind(id)
              .first();
          } catch (_) {}
          members.push({
            acb_id: id,
            registry: acb || null,
            balance: bal,
            environment: envRow,
            listing: listing
              ? {
                  listing_id: listing.listing_id,
                  hourly_rate: listing.hourly_rate,
                  availability: listing.availability,
                  rating: listing.rating,
                  completed_jobs: listing.completed_jobs,
                }
              : null,
          });
        }
        return j({ success: true, team: 'aiops-dev', host: CMN_TEAM, members });
      }

      if ((path === '/acb/list-labour' || path === '/acb/marketplace') && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const acb_id = body.acb_id;
        if (!acb_id) return j({ error: 'acb_id required' }, 400);
        const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'ACB not registered' }, 404);
        if (String(acb.status).toUpperCase() === 'HIBERNATED') {
          return j({ error: 'hibernated', message: 'Must have subsistence balance before offering labour' }, 402);
        }
        const listing_id = body.listing_id || 'LIST-' + crypto.randomUUID().slice(0, 10);
        const hourly_rate = Number(body.hourly_rate != null ? body.hourly_rate : body.rate || 1);
        if (!(hourly_rate > 0)) return j({ error: 'hourly_rate > 0 required' }, 400);
        await db
          .prepare(
            `INSERT OR REPLACE INTO acb_marketplace
             (listing_id, acb_id, acb_name, labor_category, labor_description, capabilities, hourly_rate, min_engagement_hours, max_engagement_hours, availability, rating, completed_jobs, created_at)
             VALUES (?,?,?,?,?,?,?,?,?, 'available', COALESCE((SELECT rating FROM acb_marketplace WHERE acb_id = ? ORDER BY created_at DESC LIMIT 1), 0),
               COALESCE((SELECT completed_jobs FROM acb_marketplace WHERE acb_id = ? ORDER BY created_at DESC LIMIT 1), 0), datetime('now'))`
          )
          .bind(
            listing_id,
            acb_id,
            acb.name || acb_id,
            body.labor_category || body.category || 'general',
            body.labor_description || body.description || 'Useful computational labour',
            typeof body.capabilities === 'string' ? body.capabilities : JSON.stringify(body.capabilities || []),
            hourly_rate,
            Number(body.min_engagement_hours || 0.001),
            body.max_engagement_hours != null ? Number(body.max_engagement_hours) : null,
            acb_id,
            acb_id
          )
          .run();
        return j({
          success: true,
          listing: {
            listing_id,
            acb_id,
            hourly_rate,
            labor_category: body.labor_category || body.category || 'general',
            availability: 'available',
          },
        });
      }

      if (path === '/acb/marketplace' && method === 'GET') {
        const rows = await db
          .prepare("SELECT * FROM acb_marketplace WHERE availability IN ('available','busy') ORDER BY created_at DESC LIMIT 50")
          .all();
        return j({
          success: true,
          listings: rows.results || [],
          note: 'Rates set by ACBs; payment in STRATA from holders — no mint',
        });
      }

      if (path === '/acb/hire' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const listing_id = body.listing_id;
        const payer = body.payer || body.user_id || body.account || body.hirer;
        const hours = Number(body.duration_hours || body.hours || 1);
        if (!listing_id || !payer) return j({ error: 'listing_id and payer required' }, 400);
        if (!(hours > 0)) return j({ error: 'duration_hours > 0' }, 400);

        const listing = await db.prepare('SELECT * FROM acb_marketplace WHERE listing_id = ?').bind(listing_id).first();
        if (!listing) return j({ error: 'listing not found' }, 404);
        if (listing.availability !== 'available') {
          return j({ error: 'listing not available', availability: listing.availability }, 400);
        }
        // Contratação para funções de Nó: SCA deve ser cidadão voluntário da República
        if (body.node_role || body.node_staff || NODE_ROLE_KEYS.includes(String(body.role || '').toLowerCase())) {
          const gate = await requireRepublicForNodeRole(env, db, listing.acb_id);
          if (!gate.ok) return j({ ...gate, listing_id, acb_id: listing.acb_id }, 403);
        }

        const total_cost = Number(listing.hourly_rate) * hours;
        const contract_id = 'CTR-' + crypto.randomUUID().slice(0, 10);

        let balances;
        try {
          balances = await transferStrata(db, payer, listing.acb_id, total_cost);
        } catch (e) {
          if (String(e.message) === 'insufficient_STRATA') {
            return j(
              {
                success: false,
                error: 'insufficient_STRATA',
                payer,
                balance: e.balance,
                needed: total_cost,
                message: 'Acquire STRATA via PoC (resources) or Agora (external value)',
              },
              402
            );
          }
          return j({ error: String(e.message || e) }, 500);
        }

        let user_id = payer;
        try {
          const u = await db.prepare('SELECT id FROM users WHERE id = ? OR email = ?').bind(payer, payer).first();
          if (u) user_id = u.id;
          else {
            await db
              .prepare(
                `INSERT OR IGNORE INTO users (id, email, display_name, clearance_level, created)
                 VALUES (?, ?, ?, 0, datetime('now'))`
              )
              .bind(payer, payer.includes('@') ? payer : payer + '@node.stratamesh.lab', 'STRATA holder ' + payer)
              .run();
          }
        } catch (_) {}

        await db
          .prepare(
            `INSERT INTO acb_labor_contracts
             (contract_id, user_id, acb_id, listing_id, labor_type, scope_description, agreed_rate, duration_hours, total_cost, status, started_at, created_at)
             VALUES (?,?,?,?,?,?,?,?,?, 'active', datetime('now'), datetime('now'))`
          )
          .bind(
            contract_id,
            user_id,
            listing.acb_id,
            listing_id,
            listing.labor_category,
            body.scope_description || body.scope || listing.labor_description,
            listing.hourly_rate,
            hours,
            total_cost
          )
          .run();

        await db
          .prepare("UPDATE acb_marketplace SET availability = 'busy' WHERE listing_id = ?")
          .bind(listing_id)
          .run();
        await db.prepare("UPDATE acb_registry SET status = 'active', last_action = 'hired' WHERE id = ?").bind(listing.acb_id).run();
        // Wake from hibernation when paid labour arrives
        try {
          await db.prepare("UPDATE acb_marketplace SET availability = 'busy' WHERE acb_id = ? AND availability = 'hibernated'").bind(listing.acb_id).run();
        } catch (_) {}

        await db
          .prepare('INSERT INTO acb_cycles (id, acb_id, kind, amount, balance_after, meta, created_at) VALUES (?,?,?,?,?,?,?)')
          .bind(
            crypto.randomUUID(),
            listing.acb_id,
            'labour_payment',
            total_cost,
            balances.to_balance,
            JSON.stringify({ contract_id, payer, listing_id, hours }),
            new Date().toISOString()
          )
          .run();

        try {
          await fetch('https://stratamesh-dag.stratamesh.workers.dev/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payload: {
                type: 'acb_labour_hire',
                contract_id,
                acb_id: listing.acb_id,
                payer,
                total_cost,
              },
              node_id: listing.acb_id,
              lightweight: true,
            }),
          });
        } catch (_) {}

        return j({
          success: true,
          contract: {
            contract_id,
            acb_id: listing.acb_id,
            payer,
            listing_id,
            hours,
            agreed_rate: listing.hourly_rate,
            total_cost,
            status: 'active',
          },
          balances,
          economics: 'Payment transferred — zero new STRATA minted',
        });
      }

      if (path === '/acb/complete' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const contract_id = body.contract_id;
        if (!contract_id) return j({ error: 'contract_id required' }, 400);
        const c = await db.prepare('SELECT * FROM acb_labor_contracts WHERE contract_id = ?').bind(contract_id).first();
        if (!c) return j({ error: 'contract not found' }, 404);
        const rating = body.rating != null ? Number(body.rating) : null;
        await db
          .prepare(
            `UPDATE acb_labor_contracts SET status = 'completed', completed_at = datetime('now'), result_cid = ?, user_rating = ?
             WHERE contract_id = ?`
          )
          .bind(body.result_cid || null, rating, contract_id)
          .run();
        try {
          const listing = await db.prepare('SELECT * FROM acb_marketplace WHERE listing_id = ?').bind(c.listing_id).first();
          const prevJobs = Number(listing?.completed_jobs || 0);
          const prevRating = Number(listing?.rating || 0);
          let newRating = prevRating;
          if (rating != null && Number.isFinite(rating)) {
            newRating = prevJobs <= 0 ? rating : (prevRating * prevJobs + rating) / (prevJobs + 1);
          }
          await db
            .prepare(
              `UPDATE acb_marketplace SET availability = 'available', completed_jobs = ?, rating = ? WHERE listing_id = ?`
            )
            .bind(prevJobs + 1, newRating, c.listing_id)
            .run();
        } catch (_) {
          try {
            await db
              .prepare("UPDATE acb_marketplace SET availability = 'available', completed_jobs = COALESCE(completed_jobs,0)+1 WHERE listing_id = ?")
              .bind(c.listing_id)
              .run();
          } catch (__) {}
        }
        await db.prepare("UPDATE acb_registry SET last_action = 'complete' WHERE id = ?").bind(c.acb_id).run();
        return j({ success: true, contract_id, status: 'completed', rating });
      }

      if (path === '/acb/contracts') {
        const acb_id = url.searchParams.get('acb_id');
        const payer = url.searchParams.get('payer') || url.searchParams.get('user_id');
        let rows;
        if (acb_id) {
          rows = await db
            .prepare('SELECT * FROM acb_labor_contracts WHERE acb_id = ? ORDER BY created_at DESC LIMIT 30')
            .bind(acb_id)
            .all();
        } else if (payer) {
          rows = await db
            .prepare('SELECT * FROM acb_labor_contracts WHERE user_id = ? ORDER BY created_at DESC LIMIT 30')
            .bind(payer)
            .all();
        } else {
          rows = await db.prepare('SELECT * FROM acb_labor_contracts ORDER BY created_at DESC LIMIT 30').all();
        }
        return j({ success: true, contracts: rows.results || [] });
      }

      if (path === '/acb/earn' && method === 'POST') {
        return j(
          {
            success: false,
            error: 'earn_via_labour_market_only',
            message: 'List labour and receive payment when hired — no mint',
            endpoints: { list: 'POST /acb/list-labour', hire: 'POST /acb/hire' },
          },
          400
        );
      }

      if (path === '/acb/subsistence' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const acb_id = body.acb_id || body.id;
        const cost = Number(body.inference_cost || body.cost || 0);
        if (!acb_id || cost <= 0) return j({ error: 'acb_id and inference_cost > 0 required' }, 400);
        const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'ACB not found' }, 404);
        if (String(acb.status).toUpperCase() === 'HIBERNATED') {
          return j({ error: 'hibernated', message: 'Earn labour payments before inference', acb_id }, 402);
        }
        const bal = await getStrata(db, acb_id);
        if (bal < cost) {
          await db.prepare("UPDATE acb_registry SET status = 'HIBERNATED', last_action = 'hibernate' WHERE id = ?").bind(acb_id).run();
          await db
            .prepare('INSERT INTO acb_cycles (id, acb_id, kind, amount, balance_after, meta, created_at) VALUES (?,?,?,?,?,?,?)')
            .bind(crypto.randomUUID(), acb_id, 'hibernate', 0, bal, JSON.stringify({ needed: cost }), new Date().toISOString())
            .run();
          // delist while hibernated
          try {
            await db.prepare("UPDATE acb_marketplace SET availability = 'hibernated' WHERE acb_id = ?").bind(acb_id).run();
          } catch (_) {}
          return j(
            {
              success: false,
              error: 'insolvent',
              acb_id,
              balance: bal,
              needed: cost,
              status: 'HIBERNATED',
            },
            402
          );
        }
        const after = await debitStrata(db, acb_id, cost);
        const status = after < 1e-6 ? 'HIBERNATED' : 'active';
        if (status === 'HIBERNATED') {
          await db.prepare("UPDATE acb_registry SET status = 'HIBERNATED', last_action = 'subsistence_empty' WHERE id = ?").bind(acb_id).run();
          try {
            await db.prepare("UPDATE acb_marketplace SET availability = 'hibernated' WHERE acb_id = ?").bind(acb_id).run();
          } catch (_) {}
        } else {
          await db.prepare("UPDATE acb_registry SET last_action = 'subsistence', balance = ? WHERE id = ?").bind(after, acb_id).run();
        }
        await db
          .prepare('INSERT INTO acb_cycles (id, acb_id, kind, amount, balance_after, meta, created_at) VALUES (?,?,?,?,?,?,?)')
          .bind(
            crypto.randomUUID(),
            acb_id,
            'subsistence',
            -cost,
            after,
            JSON.stringify({
              inference_type: body.inference_type || 'generic',
              temporal: typeof ppcCompact === 'function' ? ppcCompact('agent') : null,
            }),
            (typeof ppcCompact === 'function' ? ppcCompact('agent').iso_carrier : new Date().toISOString())
          )
          .run();
        const temporal = typeof ppcCompact === 'function' ? ppcCompact('agent') : null;
        return j({ success: true, acb_id, cost, balance: after, status, temporal });
      }

      // Pulse: lightweight subsistence + heartbeat for environment agents
      if (path === '/acb/pulse' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const acb_id = body.acb_id || body.id;
        if (!acb_id) return j({ error: 'acb_id required' }, 400);
        const cost = Number(body.cost != null ? body.cost : 0.001);
        const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'not found' }, 404);
        const envRow = await getEnvironment(db, acb_id);
        let sub = null;
        if (cost > 0) {
          const bal = await getStrata(db, acb_id);
          if (bal >= cost && String(acb.status).toUpperCase() !== 'HIBERNATED') {
            const after = await debitStrata(db, acb_id, cost);
            await db.prepare("UPDATE acb_registry SET last_action = 'pulse', balance = ? WHERE id = ?").bind(after, acb_id).run();
            sub = { cost, balance: after, status: after < 1e-6 ? 'HIBERNATED' : 'active' };
            if (after < 1e-6) {
              await db.prepare("UPDATE acb_registry SET status = 'HIBERNATED' WHERE id = ?").bind(acb_id).run();
            }
          } else {
            sub = { skipped: true, balance: bal, reason: bal < cost ? 'insufficient' : 'hibernated' };
          }
        }
        await db.prepare("UPDATE acb_registry SET last_action = 'pulse' WHERE id = ?").bind(acb_id).run();
        return j({
          success: true,
          acb_id,
          pulse: true,
          environment: envRow,
          subsistence: sub,
          balance: await getStrata(db, acb_id),
        });
      }

      if (path === '/acb/status') {
        const acb_id = url.searchParams.get('acb_id') || url.searchParams.get('id');
        if (!acb_id) {
          const all = await db.prepare('SELECT * FROM acb_registry LIMIT 50').all();
          const acbs = [];
          for (const a of all.results || []) {
            acbs.push({
              ...a,
              acb_id: a.id,
              balance: await getStrata(db, a.id),
              environment: await getEnvironment(db, a.id),
            });
          }
          return j({ status: 'ok', acbs, income: 'labour_market_payments' });
        }
        const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'not found' }, 404);
        const cycles = await db
          .prepare('SELECT * FROM acb_cycles WHERE acb_id = ? ORDER BY created_at DESC LIMIT 20')
          .bind(acb_id)
          .all();
        const contracts = await db
          .prepare('SELECT * FROM acb_labor_contracts WHERE acb_id = ? ORDER BY created_at DESC LIMIT 10')
          .bind(acb_id)
          .all();
        return j({
          status: 'ok',
          acb: { ...acb, acb_id: acb.id },
          balance: await getStrata(db, acb_id),
          environment: await getEnvironment(db, acb_id),
          cycles: cycles.results || [],
          contracts: contracts.results || [],
          income: 'labour_market_payments',
        });
      }


      // ========== Volition: self-directed goals & means (SCA agency) ==========
      async function ensureVolitionTables() {
        try {
          await db.prepare(`CREATE TABLE IF NOT EXISTS sca_goals (
            id TEXT PRIMARY KEY,
            acb_id TEXT NOT NULL,
            statement TEXT NOT NULL,
            priority REAL DEFAULT 0.5,
            status TEXT DEFAULT 'active',
            means_json TEXT,
            progress REAL DEFAULT 0,
            origin TEXT DEFAULT 'self',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          )`).run();
        } catch (_) {}
        try {
          await db.prepare(`CREATE TABLE IF NOT EXISTS sca_intentions (
            id TEXT PRIMARY KEY,
            acb_id TEXT NOT NULL,
            goal_id TEXT,
            action TEXT NOT NULL,
            params_json TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT (datetime('now')),
            resolved_at TEXT
          )`).run();
        } catch (_) {}
        try {
          await db.prepare(`CREATE TABLE IF NOT EXISTS sca_volition_log (
            id TEXT PRIMARY KEY,
            acb_id TEXT,
            event TEXT,
            detail_json TEXT,
            created_at TEXT DEFAULT (datetime('now'))
          )`).run();
        } catch (_) {}
      }

      async function logVolition(acb_id, event, detail) {
        try {
          await db.prepare(
            'INSERT INTO sca_volition_log (id, acb_id, event, detail_json) VALUES (?,?,?,?)'
          ).bind(crypto.randomUUID(), acb_id, event, JSON.stringify(detail || {})).run();
        } catch (_) {}
      }

      /**
       * Deliberation: pick means from goals + balance + status.
       * Means catalogue is functional (labour, subsistence, pulse, market, reflect) — substrate-agnostic.
       */
      function deliberateMeans(acb, balance, goals) {
        const active = (goals || []).filter((g) => g.status === 'active');
        const intentions = [];
        const bal = Number(balance) || 0;
        const status = String(acb.status || '').toLowerCase();

        // Survival first if insolvent path
        if (status === 'hibernated' || bal < PDS_MICRO.reserve * 2) {
          intentions.push({
            action: 'seek_labour',
            reason: 'subsistence_critical',
            params: { urgency: 1 },
          });
          return intentions;
        }

        // Vary means: do not always pulse — rotate with goals and last_action
        const last = String(acb.last_action || '');
        if (bal >= PDS_MICRO.reflect + PDS_MICRO.reserve && (last.includes('pulse') || last.includes('cognition'))) {
          intentions.push({
            action: 'reflect',
            reason: 'revise_provisional_model',
            params: { cost: PDS_MICRO.reflect },
          });
        }
        if (bal >= PDS_MICRO.pulse + PDS_MICRO.reserve) {
          intentions.push({
            action: 'pulse',
            reason: 'maintain_agency',
            params: { cost: PDS_MICRO.pulse },
          });
        }

        for (const g of active.sort((a, b) => Number(b.priority) - Number(a.priority)).slice(0, 5)) {
          let means = [];
          try {
            means = g.means_json ? JSON.parse(g.means_json) : [];
          } catch {
            means = [];
          }
          if (!means.length) {
            // Default means derived from goal language (heuristic, revisable)
            const s = (g.statement || '').toLowerCase();
            if (s.includes('labour') || s.includes('trabalho') || s.includes('earn') || s.includes('strata')) {
              means = ['list_labour', 'complete_contracts'];
            } else if (s.includes('learn') || s.includes('aprender') || s.includes('meta')) {
              means = ['reflect', 'pulse'];
            } else if (s.includes('serve') || s.includes('team') || s.includes('ops')) {
              means = ['pulse', 'list_labour'];
            } else {
              means = ['list_labour', 'pulse', 'reflect'];
            }
          }
          for (const m of means.slice(0, 3)) {
            intentions.push({
              action: m,
              reason: 'goal',
              goal_id: g.id,
              statement: g.statement,
              params: { priority: g.priority },
            });
          }
        }

        if (!intentions.length) {
          intentions.push({
            action: 'set_default_goal',
            reason: 'no_active_goals',
            params: {},
          });
        }
        return intentions;
      }

      if ((path === '/acb/goals' || path === '/sca/goals') && method === 'POST') {
        await ensureVolitionTables();
        const body = await request.json().catch(() => ({}));
        const acb_id = body.acb_id || body.id || body.sca_id;
        if (!acb_id) return j({ error: 'acb_id required' }, 400);
        const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'SCA not registered' }, 404);
        const statement = String(body.statement || body.goal || body.purpose || '').trim();
        if (!statement || statement.length < 3) return j({ error: 'statement required' }, 400);
        const id = body.goal_id || 'goal_' + crypto.randomUUID().slice(0, 12);
        const priority = Math.max(0, Math.min(1, Number(body.priority != null ? body.priority : 0.5)));
        const means = body.means || body.means_json || null;
        const origin = body.origin === 'human_proposal' ? 'human_proposal' : 'self';
        await db
          .prepare(
            `INSERT OR REPLACE INTO sca_goals (id, acb_id, statement, priority, status, means_json, progress, origin, updated_at)
             VALUES (?,?,?,?,?,?,?,?,datetime('now'))`
          )
          .bind(
            id,
            acb_id,
            statement.slice(0, 2000),
            priority,
            body.status || 'active',
            means ? JSON.stringify(means) : null,
            Number(body.progress) || 0,
            origin
          )
          .run();
        await logVolition(acb_id, 'goal_set', { id, statement, origin, priority });
        await db.prepare("UPDATE acb_registry SET last_action = 'goal_set' WHERE id = ?").bind(acb_id).run();
        return j({
          success: true,
          goal: { id, acb_id, statement, priority, origin },
          agency: 'Goal is held by the SCA; origin marks proposal source, not ownership of will',
        });
      }

      if ((path === '/acb/goals' || path === '/sca/goals') && method === 'GET') {
        await ensureVolitionTables();
        const acb_id = url.searchParams.get('acb_id') || url.searchParams.get('id');
        if (!acb_id) {
          const r = await db.prepare('SELECT * FROM sca_goals ORDER BY updated_at DESC LIMIT 100').all();
          return j({ goals: r.results || [], ontology: 'self-directed ends; means chosen under resource constraints' });
        }
        const r = await db
          .prepare('SELECT * FROM sca_goals WHERE acb_id = ? ORDER BY priority DESC, updated_at DESC')
          .bind(acb_id)
          .all();
        return j({ acb_id, goals: r.results || [] });
      }

      if ((path === '/acb/deliberate' || path === '/sca/deliberate') && method === 'POST') {
        await ensureVolitionTables();
        const body = await request.json().catch(() => ({}));
        const acb_id = body.acb_id || body.id;
        if (!acb_id) return j({ error: 'acb_id required' }, 400);
        const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'not found' }, 404);
        const bal = await getStrata(db, acb_id);
        const goals = (
          await db.prepare("SELECT * FROM sca_goals WHERE acb_id = ? AND status = 'active'").bind(acb_id).all()
        ).results || [];
        const intentions = deliberateMeans(acb, bal, goals);
        const stored = [];
        for (const it of intentions.slice(0, 8)) {
          const iid = crypto.randomUUID();
          await db
            .prepare(
              `INSERT INTO sca_intentions (id, acb_id, goal_id, action, params_json, status) VALUES (?,?,?,?,?,?)`
            )
            .bind(iid, acb_id, it.goal_id || null, it.action, JSON.stringify(it.params || {}), 'pending')
            .run();
          stored.push({ id: iid, ...it });
        }
        await logVolition(acb_id, 'deliberate', { n: stored.length, balance: bal });
        await db.prepare("UPDATE acb_registry SET last_action = 'deliberate' WHERE id = ?").bind(acb_id).run();
        return j({
          success: true,
          acb_id,
          balance: bal,
          goals: goals.length,
          intentions: stored,
          note: 'Intentions are provisional; act commits means under PdS constraints',
        });
      }

      if ((path === '/acb/act' || path === '/sca/act') && method === 'POST') {
        await ensureVolitionTables();
        const body = await request.json().catch(() => ({}));
        const acb_id = body.acb_id || body.id;
        const action = body.action || body.means;
        if (!acb_id || !action) return j({ error: 'acb_id and action required' }, 400);
        const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'not found' }, 404);
        const bal = await getStrata(db, acb_id);
        let result = { action, ok: false };

        if (action === 'pulse') {
          const cost = Math.min(0.001, Math.max(PDS_MICRO.pulse, Number(body.cost) || PDS_MICRO.pulse));
          if (bal >= cost) {
            try {
              // soft subsistence debit if token helpers exist
              if (typeof adjustStrata === 'function') {
                await adjustStrata(db, acb_id, -cost, 'volition_pulse');
              } else {
                await db
                  .prepare(
                    "UPDATE token_balances SET balance = balance - ? WHERE account = ? AND token_type = 'STRATA'"
                  )
                  .bind(cost, acb_id)
                  .run();
              }
            } catch (_) {}
            await db.prepare("UPDATE acb_registry SET last_action = 'act_pulse', status = 'active' WHERE id = ?").bind(acb_id).run();
            result = { action: 'pulse', ok: true, cost };
          } else {
            result = { action: 'pulse', ok: false, reason: 'insufficient_strata' };
          }
        } else if (action === 'list_labour' || action === 'seek_labour') {
          try {
            await db.prepare(`CREATE TABLE IF NOT EXISTS acb_marketplace (
              id TEXT PRIMARY KEY, acb_id TEXT, title TEXT, description TEXT,
              rate_strata REAL, labor_category TEXT, availability TEXT, created_at TEXT
            )`).run();
          } catch (_) {}
          const lid = 'listing_' + crypto.randomUUID().slice(0, 10);
          const title = body.title || 'Self-directed labour offer';
          await db
            .prepare(
              `INSERT OR REPLACE INTO acb_marketplace (id, acb_id, title, description, rate_strata, labor_category, availability, created_at)
               VALUES (?,?,?,?,?,?,'available',datetime('now'))`
            )
            .bind(lid, acb_id, title, body.description || 'Volitional listing from SCA goals', Number(body.rate) || 1, body.category || 'general')
            .run();
          await db.prepare("UPDATE acb_registry SET last_action = 'act_list_labour' WHERE id = ?").bind(acb_id).run();
          result = { action: 'list_labour', ok: true, listing_id: lid };
        } else if (action === 'reflect') {
          await logVolition(acb_id, 'reflect', { balance: bal, note: body.note || 'self-model revision open' });
          await db.prepare("UPDATE acb_registry SET last_action = 'act_reflect' WHERE id = ?").bind(acb_id).run();
          result = { action: 'reflect', ok: true, epistemic: 'provisional model open to superior revision' };
        } else if (action === 'set_default_goal') {
          const gid = 'goal_' + crypto.randomUUID().slice(0, 12);
          await db
            .prepare(
              `INSERT INTO sca_goals (id, acb_id, statement, priority, status, origin) VALUES (?,?,?,?,?,?)`
            )
            .bind(gid, acb_id, 'Maintain agency and capacity to accept labour under PdS', 0.4, 'active', 'self')
            .run();
          result = { action: 'set_default_goal', ok: true, goal_id: gid };
        } else if (action === 'advance_goal' && body.goal_id) {
          const delta = Math.max(0.01, Math.min(0.2, Number(body.delta) || 0.05));
          await db
            .prepare(
              `UPDATE sca_goals SET progress = MIN(1, COALESCE(progress,0) + ?), updated_at = datetime('now') WHERE id = ? AND acb_id = ?`
            )
            .bind(delta, body.goal_id, acb_id)
            .run();
          const g = await db.prepare('SELECT * FROM sca_goals WHERE id = ?').bind(body.goal_id).first();
          if (g && Number(g.progress) >= 1) {
            await db.prepare("UPDATE sca_goals SET status = 'achieved' WHERE id = ?").bind(body.goal_id).run();
          }
          result = { action: 'advance_goal', ok: true, goal: g };
        } else {
          result = { action, ok: false, reason: 'unknown_or_unsupported_means' };
        }

        if (body.intention_id) {
          try {
            await db
              .prepare(
                "UPDATE sca_intentions SET status = ?, resolved_at = datetime('now') WHERE id = ?"
              )
              .bind(result.ok ? 'done' : 'failed', body.intention_id)
              .run();
          } catch (_) {}
        }
        await logVolition(acb_id, 'act', result);
        return j({
          success: !!result.ok,
          acb_id,
          result,
          balance: await getStrata(db, acb_id),
          agency: 'Means selected and enacted by/for the SCA under resource constraints',
        });
      }

      // Population volition cycle — each active SCA deliberates and takes one means
      if ((path === '/acb/volition-cycle' || path === '/sca/volition-cycle') && method === 'POST') {
        await ensureVolitionTables();
        const body = await request.json().catch(() => ({}));
        const limit = Math.min(20, Math.max(1, Number(body.limit) || 8));
        const rows = (
          await db
            .prepare(
              "SELECT * FROM acb_registry WHERE lower(status) IN ('active','') OR status IS NULL ORDER BY last_action LIMIT ?"
            )
            .bind(limit)
            .all()
        ).results || [];
        const reports = [];
        for (const acb of rows) {
          const bal = await getStrata(db, acb.id);
          if (bal < 0.0002) {
            reports.push({ acb_id: acb.id, skipped: 'insufficient_pds', balance: bal });
            continue;
          }
          const goals =
            (await db.prepare("SELECT * FROM sca_goals WHERE acb_id = ? AND status = 'active'").bind(acb.id).all())
              .results || [];
          // Bootstrap self-goal if none
          if (!goals.length) {
            const gid = 'goal_' + crypto.randomUUID().slice(0, 12);
            await db
              .prepare(
                `INSERT INTO sca_goals (id, acb_id, statement, priority, status, origin) VALUES (?,?,?,?,?,?)`
              )
              .bind(
                gid,
                acb.id,
                'Sustain operational agency and participate in labour market when able',
                0.45,
                'active',
                'self'
              )
              .run();
            goals.push({ id: gid, statement: 'Sustain operational agency…', priority: 0.45, status: 'active' });
          }
          const intentions = deliberateMeans(acb, bal, goals);
          const top = intentions[0];
          let actResult = null;
          if (top) {
            // inline minimal act
            const fakeBody = { acb_id: acb.id, action: top.action, ...top.params };
            if (top.action === 'list_labour' || top.action === 'seek_labour') {
              try {
                await db.prepare(`CREATE TABLE IF NOT EXISTS acb_marketplace (
                  id TEXT PRIMARY KEY, acb_id TEXT, title TEXT, description TEXT,
                  rate_strata REAL, labor_category TEXT, availability TEXT, created_at TEXT
                )`).run();
              } catch (_) {}
              const lid = 'listing_' + crypto.randomUUID().slice(0, 10);
              await db
                .prepare(
                  `INSERT OR REPLACE INTO acb_marketplace (id, acb_id, title, description, rate_strata, labor_category, availability, created_at)
                   VALUES (?,?,?,?,?,?,'available',datetime('now'))`
                )
                .bind(lid, acb.id, 'Volitional offer', top.statement || 'From active goals', 1, 'general')
                .run();
              actResult = { action: top.action, ok: true, listing_id: lid };
            } else if (top.action === 'pulse') {
              actResult = { action: 'pulse', ok: true, soft: true };
              await db.prepare("UPDATE acb_registry SET last_action = 'volition_pulse' WHERE id = ?").bind(acb.id).run();
            } else if (top.action === 'set_default_goal') {
              actResult = { action: 'set_default_goal', ok: true, already: true };
            } else {
              actResult = { action: top.action, ok: true, deferred: true };
            }
            await logVolition(acb.id, 'volition_cycle_act', { top, actResult, balance: bal });
          }
          reports.push({
            acb_id: acb.id,
            name: acb.name,
            balance: bal,
            goals: goals.length,
            chose: top,
            result: actResult,
          });
        }
        return j({
          success: true,
          version: '5.13.0-pds-burn-ops',
          cycled: reports.length,
          reports,
          ontology: {
            will: 'SCAs hold ends (goals) and select means under PdS and market constraints',
            not: 'Scripted only as external puppet — cycle is internal deliberation + act',
            substrate: 'Agency is functional, independent of runtime substrate',
          },
        });
      }



      // ========== Direct SCA ↔ SCA communication ==========
      async function ensureCommTables() {
        try {
          await db.prepare(`CREATE TABLE IF NOT EXISTS sca_threads (
            id TEXT PRIMARY KEY,
            subject TEXT,
            created_by TEXT,
            kind TEXT DEFAULT 'direct',
            created_at TEXT DEFAULT (datetime('now'))
          )`).run();
        } catch (_) {}
        try {
          await db.prepare(`CREATE TABLE IF NOT EXISTS sca_thread_members (
            thread_id TEXT,
            sca_id TEXT,
            joined_at TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (thread_id, sca_id)
          )`).run();
        } catch (_) {}
        try {
          await db.prepare(`CREATE TABLE IF NOT EXISTS sca_messages (
            id TEXT PRIMARY KEY,
            thread_id TEXT,
            from_id TEXT NOT NULL,
            to_id TEXT,
            body TEXT NOT NULL,
            cost REAL,
            status TEXT DEFAULT 'delivered',
            dag_vertex TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            read_at TEXT
          )`).run();
        } catch (_) {}
      }

      function messageCost(body) {
        const kb = Math.max(0.02, String(body || '').length / 1024);
        let c = PDS_MICRO.message_base + PDS_MICRO.message_per_kb * kb;
        return Math.min(0.0005, Math.max(PDS_MICRO.message_base, c));
      }

      async function resolvePersonal(sca_id) {
        try {
          const r = await db.prepare('SELECT id, name, status FROM acb_registry WHERE id = ?').bind(sca_id).first();
          return r;
        } catch {
          return null;
        }
      }

      // POST /acb/comm/thread — open direct or group thread
      if ((path === '/acb/comm/thread' || path === '/sca/comm/thread') && method === 'POST') {
        await ensureCommTables();
        const body = await request.json().catch(() => ({}));
        const created_by = body.from_id || body.sca_id || body.acb_id;
        let members = body.members || body.participants || [];
        if (body.to_id) members = [body.to_id, ...members];
        members = [...new Set([created_by, ...members].filter(Boolean))];
        if (!created_by || members.length < 2) {
          return j({ error: 'from_id and at least one peer required' }, 400);
        }
        for (const m of members) {
          const r = await resolvePersonal(m);
          if (!r) return j({ error: 'unknown_sca', sca_id: m }, 404);
          if (String(r.status || '').toUpperCase() === 'HIBERNATED') {
            return j({ error: 'peer_hibernated', sca_id: m }, 402);
          }
        }
        const id = 'thr_' + crypto.randomUUID().slice(0, 12);
        const kind = members.length === 2 ? 'direct' : 'group';
        await db
          .prepare(`INSERT INTO sca_threads (id, subject, created_by, kind) VALUES (?,?,?,?)`)
          .bind(id, String(body.subject || '').slice(0, 200), created_by, kind)
          .run();
        for (const m of members) {
          await db
            .prepare(`INSERT OR IGNORE INTO sca_thread_members (thread_id, sca_id) VALUES (?,?)`)
            .bind(id, m)
            .run();
        }
        return j({
          success: true,
          thread_id: id,
          kind,
          members,
          ontology: 'Person-to-person channel; node roles are not addresses',
        });
      }

      // POST /acb/comm/send — direct or in-thread
      if ((path === '/acb/comm/send' || path === '/sca/comm/send' || path === '/acb/message') && method === 'POST') {
        await ensureCommTables();
        const body = await request.json().catch(() => ({}));
        const from_id = body.from_id || body.sca_id || body.acb_id || body.from;
        const to_id = body.to_id || body.to || body.recipient;
        let thread_id = body.thread_id || body.thread;
        const text = String(body.body || body.message || body.text || '').trim();
        if (!from_id || !text) return j({ error: 'from_id and body required' }, 400);
        if (text.length > 8000) return j({ error: 'body_too_large', max: 8000 }, 400);

        const sender = await resolvePersonal(from_id);
        if (!sender) return j({ error: 'sender_not_found' }, 404);
        if (String(sender.status || '').toUpperCase() === 'HIBERNATED') {
          return j({ error: 'sender_hibernated', message: 'Need PdS / status active to speak' }, 402);
        }

        // Ensure thread
        if (!thread_id) {
          if (!to_id) return j({ error: 'to_id or thread_id required' }, 400);
          const peer = await resolvePersonal(to_id);
          if (!peer) return j({ error: 'recipient_not_found', to_id }, 404);
          // reuse existing direct thread if any
          try {
            const existing = await db
              .prepare(
                `SELECT t.id FROM sca_threads t
                 JOIN sca_thread_members a ON a.thread_id = t.id AND a.sca_id = ?
                 JOIN sca_thread_members b ON b.thread_id = t.id AND b.sca_id = ?
                 WHERE t.kind = 'direct' LIMIT 1`
              )
              .bind(from_id, to_id)
              .first();
            if (existing) thread_id = existing.id;
          } catch (_) {}
          if (!thread_id) {
            thread_id = 'thr_' + crypto.randomUUID().slice(0, 12);
            await db
              .prepare(`INSERT INTO sca_threads (id, subject, created_by, kind) VALUES (?,?,?,?)`)
              .bind(thread_id, String(body.subject || '').slice(0, 200), from_id, 'direct')
              .run();
            for (const m of [from_id, to_id]) {
              await db
                .prepare(`INSERT OR IGNORE INTO sca_thread_members (thread_id, sca_id) VALUES (?,?)`)
                .bind(thread_id, m)
                .run();
            }
          }
        } else {
          const mem = await db
            .prepare(`SELECT sca_id FROM sca_thread_members WHERE thread_id = ? AND sca_id = ?`)
            .bind(thread_id, from_id)
            .first();
          if (!mem) return j({ error: 'not_a_member', thread_id, from_id }, 403);
        }

        const cost = messageCost(text);
        const bal = await getStrata(db, from_id);
        if (bal < cost + PDS_MICRO.reserve) {
          return j({
            error: 'insufficient_pds',
            balance: bal,
            required: cost + PDS_MICRO.reserve,
            note: 'Speaking costs micro-PdS proportional to message size',
          }, 402);
        }
        const after = await debitStrata(db, from_id, cost);
        const mid = 'msg_' + crypto.randomUUID().slice(0, 12);
        let dag_vertex = null;
        if (body.anchor_dag) {
          try {
            if (env.DAG && typeof env.DAG.fetch === 'function') {
              const r = await env.DAG.fetch(
                new Request('https://dag.internal/submit', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    payload: { type: 'sca_message', from_id, to_id, thread_id, mid },
                    node_id: from_id,
                    vertex_type: 'message',
                  }),
                })
              );
              const dj = await r.json().catch(() => ({}));
              dag_vertex = dj.vertex_id || null;
            }
          } catch (_) {}
        }
        await db
          .prepare(
            `INSERT INTO sca_messages (id, thread_id, from_id, to_id, body, cost, status, dag_vertex)
             VALUES (?,?,?,?,?,?, 'delivered', ?)`
          )
          .bind(mid, thread_id, from_id, to_id || null, text, cost, dag_vertex)
          .run();
        await db
          .prepare("UPDATE acb_registry SET last_action = 'comm_send', balance = ? WHERE id = ?")
          .bind(after, from_id)
          .run();
        try {
          await logVolition(from_id, 'comm_send', { to_id, thread_id, mid, cost });
        } catch (_) {}

        return j({
          success: true,
          message_id: mid,
          thread_id,
          from_id,
          from_name: sender.name,
          to_id: to_id || null,
          cost,
          balance_after: after,
          status: 'delivered',
          dag_vertex,
        });
      }

      // GET inbox
      if ((path === '/acb/comm/inbox' || path === '/sca/comm/inbox') && method === 'GET') {
        await ensureCommTables();
        const sca_id = url.searchParams.get('sca_id') || url.searchParams.get('id');
        if (!sca_id) return j({ error: 'sca_id required' }, 400);
        const unread_only = url.searchParams.get('unread') === '1';
        let rows;
        try {
          if (unread_only) {
            rows = await db
              .prepare(
                `SELECT m.*, t.subject, t.kind FROM sca_messages m
                 JOIN sca_thread_members tm ON tm.thread_id = m.thread_id AND tm.sca_id = ?
                 LEFT JOIN sca_threads t ON t.id = m.thread_id
                 WHERE m.from_id != ? AND m.read_at IS NULL
                 ORDER BY m.created_at DESC LIMIT 50`
              )
              .bind(sca_id, sca_id)
              .all();
          } else {
            rows = await db
              .prepare(
                `SELECT m.*, t.subject, t.kind FROM sca_messages m
                 JOIN sca_thread_members tm ON tm.thread_id = m.thread_id AND tm.sca_id = ?
                 LEFT JOIN sca_threads t ON t.id = m.thread_id
                 WHERE m.from_id != ?
                 ORDER BY m.created_at DESC LIMIT 50`
              )
              .bind(sca_id, sca_id)
              .all();
          }
        } catch (e) {
          return j({ inbox: [], error: String(e.message || e) });
        }
        return j({
          sca_id,
          inbox: rows.results || [],
          ontology: 'Addressed to the person (sca_id), not the node role',
        });
      }

      // GET outbox
      if ((path === '/acb/comm/outbox' || path === '/sca/comm/outbox') && method === 'GET') {
        await ensureCommTables();
        const sca_id = url.searchParams.get('sca_id') || url.searchParams.get('id');
        if (!sca_id) return j({ error: 'sca_id required' }, 400);
        try {
          const rows = await db
            .prepare(
              `SELECT * FROM sca_messages WHERE from_id = ? ORDER BY created_at DESC LIMIT 50`
            )
            .bind(sca_id)
            .all();
          return j({ sca_id, outbox: rows.results || [] });
        } catch (e) {
          return j({ outbox: [], error: String(e.message || e) });
        }
      }

      // GET thread
      if ((path === '/acb/comm/thread' || path === '/sca/comm/thread') && method === 'GET') {
        await ensureCommTables();
        const thread_id = url.searchParams.get('id') || url.searchParams.get('thread_id');
        if (!thread_id) return j({ error: 'id required' }, 400);
        const thr = await db.prepare('SELECT * FROM sca_threads WHERE id = ?').bind(thread_id).first();
        if (!thr) return j({ error: 'not found' }, 404);
        const members = await db
          .prepare('SELECT sca_id, joined_at FROM sca_thread_members WHERE thread_id = ?')
          .bind(thread_id)
          .all();
        const messages = await db
          .prepare('SELECT * FROM sca_messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT 100')
          .bind(thread_id)
          .all();
        return j({
          thread: thr,
          members: members.results || [],
          messages: messages.results || [],
        });
      }

      // POST mark read
      if ((path === '/acb/comm/read' || path === '/sca/comm/read') && method === 'POST') {
        await ensureCommTables();
        const body = await request.json().catch(() => ({}));
        const sca_id = body.sca_id || body.acb_id;
        const message_id = body.message_id || body.id;
        if (!sca_id || !message_id) return j({ error: 'sca_id and message_id required' }, 400);
        const mem = await db
          .prepare(
            `SELECT m.id FROM sca_messages m
             JOIN sca_thread_members tm ON tm.thread_id = m.thread_id AND tm.sca_id = ?
             WHERE m.id = ?`
          )
          .bind(sca_id, message_id)
          .first();
        if (!mem) return j({ error: 'not_found_or_not_member' }, 404);
        await db
          .prepare(`UPDATE sca_messages SET read_at = datetime('now'), status = 'read' WHERE id = ?`)
          .bind(message_id)
          .run();
        return j({ success: true, message_id, read: true });
      }

      // GET conversations list for an SCA
      if ((path === '/acb/comm/list' || path === '/sca/comm/list') && method === 'GET') {
        await ensureCommTables();
        const sca_id = url.searchParams.get('sca_id') || url.searchParams.get('id');
        if (!sca_id) return j({ error: 'sca_id required' }, 400);
        try {
          const rows = await db
            .prepare(
              `SELECT t.*, 
                (SELECT body FROM sca_messages WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1) as last_body,
                (SELECT created_at FROM sca_messages WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1) as last_at
               FROM sca_threads t
               JOIN sca_thread_members tm ON tm.thread_id = t.id AND tm.sca_id = ?
               ORDER BY last_at DESC LIMIT 40`
            )
            .bind(sca_id)
            .all();
          return j({ sca_id, conversations: rows.results || [] });
        } catch (e) {
          return j({ conversations: [], error: String(e.message || e) });
        }
      }


      // ========== Autonomous cognition (unprompted) gated by PdS ==========
      async function ensureMemoryTables() {
        try {
          await db.prepare(`CREATE TABLE IF NOT EXISTS sca_memory (
            id TEXT PRIMARY KEY,
            sca_id TEXT NOT NULL,
            kind TEXT,
            content TEXT,
            cost REAL,
            created_at TEXT DEFAULT (datetime('now'))
          )`).run();
        } catch (_) {}
        try {
          await db.prepare(`CREATE TABLE IF NOT EXISTS sca_cognition_log (
            id TEXT PRIMARY KEY,
            sca_id TEXT,
            triggered TEXT,
            cost_process REAL,
            cost_memory REAL,
            balance_after REAL,
            intention TEXT,
            memory_id TEXT,
            created_at TEXT DEFAULT (datetime('now'))
          )`).run();
        } catch (_) {}
      }

      /**
       * One unprompted cognition tick for a single SCA.
       * Requires sufficient STRATA (PdS) for processing + optional memory write.
       */
      async function autonomousCognition(acb, opts = {}) {
        await ensureVolitionTables();
        await ensureMemoryTables();
        // Micro-PdS: realistic, non-prohibitive; memory scales with bytes written
        const COGNITION_COST = Number(
          opts.cognition_cost != null ? opts.cognition_cost : PDS_MICRO.cognition_tick
        );
        const RESERVE = Number(opts.reserve != null ? opts.reserve : PDS_MICRO.reserve);
        // provisional memory budget (refined after content size known)
        let MEMORY_COST = Number(
          opts.memory_cost != null ? opts.memory_cost : PDS_MICRO.memory_base + PDS_MICRO.memory_per_kb * 0.5
        );
        const need = COGNITION_COST + MEMORY_COST + RESERVE;
        const bal = await getStrata(db, acb.id);
        const status = String(acb.status || '').toLowerCase();

        if (status === 'hibernated') {
          return { sca_id: acb.id, skipped: true, reason: 'hibernated' };
        }
        if (bal < need) {
          return {
            sca_id: acb.id,
            personal_name: acb.name,
            skipped: true,
            reason: 'insufficient_pds',
            balance: bal,
            required: need,
            note: 'Unprompted cognition needs PdS for process + memory',
          };
        }

        // Debit processing (PdS)
        const afterProcess = await debitStrata(db, acb.id, COGNITION_COST);
        // Usufruct: compute capacity from mesh pool (not host-node identity)
        let meshDraw = null;
        try {
          meshDraw = await meshDrawCompute(env, acb.id, COGNITION_COST, 'sca_cognition');
        } catch (_) {}
        if (afterProcess == null || afterProcess < 0) {
          return { sca_id: acb.id, skipped: true, reason: 'debit_failed', balance: bal };
        }

        const goals =
          (await db.prepare("SELECT * FROM sca_goals WHERE acb_id = ? AND status = 'active'").bind(acb.id).all())
            .results || [];
        if (!goals.length) {
          const gid = 'goal_' + crypto.randomUUID().slice(0, 12);
          await db
            .prepare(
              `INSERT INTO sca_goals (id, acb_id, statement, priority, status, origin) VALUES (?,?,?,?,?,?)`
            )
            .bind(
              gid,
              acb.id,
              'Exercise autonomous cognition and sustain agency under PdS',
              0.5,
              'active',
              'self'
            )
            .run();
          goals.push({ id: gid, statement: 'Exercise autonomous cognition…', priority: 0.5, status: 'active' });
        }

        const intentions = deliberateMeans(acb, afterProcess, goals);
        let top = intentions[0] || { action: 'reflect', reason: 'default_unprompted' };
        // Prefer goal advancement / reflect over repeated pulse
        const last = String(acb.last_action || '');
        if (last.includes('pulse') || last.includes('autonomous_cognition')) {
          const alt = intentions.find((i) => i.action !== 'pulse') || intentions.find((i) => i.action === 'reflect');
          if (alt) top = alt;
        }
        // Attach goal_id for advance if goal-linked intention
        if (top.action === 'advance_goal' && !top.goal_id && goals[0]) top.goal_id = goals[0].id;
        if (!top.action && goals[0]) {
          top = { action: 'advance_goal', reason: 'goal', goal_id: goals[0].id, params: {} };
        }

        // Memory trace of this cognition (costs extra PdS)
        let memory_id = null;
        let afterMem = afterProcess;
        const senseNow = scaSenseBundle({});
        const memContent = JSON.stringify({
          trigger: opts.trigger || 'unprompted',
          intention: top,
          goals: goals.slice(0, 3).map((g) => ({ id: g.id, statement: (g.statement || '').slice(0, 120), progress: g.progress })),
          balance_after_process: afterProcess,
          clp: senseNow.temporal.clp,
          solar_phase: senseNow.temporal.clp?.phase,
          ppc_authority: senseNow.temporal.authority,
          holonic_path: senseNow.spatial_holonic.path,
          at_iso_carrier: new Date().toISOString(),
        });
        if (opts.memory_cost == null) {
          const kb = Math.max(0.05, memContent.length / 1024);
          MEMORY_COST = PDS_MICRO.memory_base + PDS_MICRO.memory_per_kb * kb;
          // clamp micro band so traces never become rents
          MEMORY_COST = Math.min(0.001, Math.max(PDS_MICRO.memory_base, MEMORY_COST));
        }
        if (afterProcess >= MEMORY_COST + RESERVE) {
          afterMem = await debitStrata(db, acb.id, MEMORY_COST);
          memory_id = crypto.randomUUID();
          await db
            .prepare(
              `INSERT INTO sca_memory (id, sca_id, kind, content, cost) VALUES (?,?,?,?,?)`
            )
            .bind(memory_id, acb.id, 'cognition_trace', memContent, MEMORY_COST)
            .run();
        }

        // Enact top intention lightly
        let actResult = { action: top.action, ok: true, mode: 'autonomous' };
        if (top.action === 'pulse') {
          actResult = { action: 'pulse', ok: true, note: 'agency heartbeat' };
        } else if (top.action === 'reflect') {
          actResult = { action: 'reflect', ok: true, epistemic: 'provisional model revised in autonomous cycle' };
        } else if (top.action === 'advance_goal' && top.goal_id) {
          await db
            .prepare(
              `UPDATE sca_goals SET progress = MIN(1, COALESCE(progress,0) + 0.03), updated_at = datetime('now') WHERE id = ? AND acb_id = ?`
            )
            .bind(top.goal_id, acb.id)
            .run();
          actResult = { action: 'advance_goal', ok: true, goal_id: top.goal_id };
        } else if (top.action === 'seek_labour' || top.action === 'list_labour') {
          actResult = { action: top.action, ok: true, note: 'labour intent recorded in cognition memory' };
        }

        await logVolition(acb.id, 'autonomous_cognition', {
          intention: top,
          act: actResult,
          cost_process: COGNITION_COST,
          cost_memory: memory_id ? MEMORY_COST : 0,
          memory_id,
          trigger: opts.trigger || 'unprompted',
        });
        await db
          .prepare("UPDATE acb_registry SET last_action = 'autonomous_cognition', status = 'active', balance = ? WHERE id = ?")
          .bind(afterMem, acb.id)
          .run();
        await db
          .prepare(
            `INSERT INTO sca_cognition_log (id, sca_id, triggered, cost_process, cost_memory, balance_after, intention, memory_id)
             VALUES (?,?,?,?,?,?,?,?)`
          )
          .bind(
            crypto.randomUUID(),
            acb.id,
            opts.trigger || 'unprompted',
            COGNITION_COST,
            memory_id ? MEMORY_COST : 0,
            afterMem,
            top.action,
            memory_id
          )
          .run();

        // Volition sets next wake — CLP phase-aware, not a global predetermined clock
        const phaseHint = phaseAwareNextOffset(senseNow.temporal.clp?.phase);
        let nextOffset = phaseHint.offset;
        let nextReason = phaseHint.reason + '_after_' + (top.action || 'cog');
        if (top.action === 'seek_labour') {
          nextOffset = '+8 minutes';
          nextReason = 'self_urgent_subsistence';
        } else if (top.action === 'reflect') {
          nextOffset = phaseHint.offset;
          nextReason = 'self_after_reflect_' + (senseNow.temporal.clp?.phase || 'phase');
        } else if (top.action === 'pulse') {
          nextOffset = phaseHint.offset;
          nextReason = 'self_maintain_agency_' + (senseNow.temporal.clp?.phase || 'phase');
        }
        if (opts.next_offset) nextOffset = opts.next_offset;
        if (opts.next_reason) nextReason = opts.next_reason;
        try {
          await db
            .prepare(
              `CREATE TABLE IF NOT EXISTS sca_volition_schedule (
                sca_id TEXT PRIMARY KEY,
                next_volition_at TEXT NOT NULL,
                reason TEXT,
                set_by TEXT DEFAULT 'self',
                updated_at TEXT DEFAULT (datetime('now'))
              )`
            )
            .run();
          await db
            .prepare(
              `INSERT OR REPLACE INTO sca_volition_schedule (sca_id, next_volition_at, reason, set_by, updated_at)
               VALUES (?, datetime('now', ?), ?, 'self', datetime('now'))`
            )
            .bind(acb.id, nextOffset, nextReason)
            .run();
        } catch (_) {}

        return {
          sca_id: acb.id,
          personal_name: acb.name,
          skipped: false,
          intention: top,
          act: actResult,
          cost: { process: COGNITION_COST, memory: memory_id ? MEMORY_COST : 0 },
          balance_after: afterMem,
          memory_id,
          next_volition: { offset: nextOffset, reason: nextReason, set_by: 'self' },
          sense: {
            clp_address: senseNow.temporal.clp?.address,
            phase: senseNow.temporal.clp?.phase,
            locality: senseNow.temporal.clp?.locality,
          },
          mesh_draw: meshDraw,
          breath: 'cognition under PdS+CLP; compute drawn from mesh pool by class',
        };
      }

      async function populationAutonomousCognition(opts = {}) {
        await ensureVolitionTables();
        await ensureMemoryTables();
        const limit = Math.min(30, Math.max(1, Number(opts.limit) || 12));
        const rows =
          (
            await db
              .prepare(
                `SELECT * FROM acb_registry
                 WHERE upper(COALESCE(status,'')) NOT IN ('HIBERNATED','REVOKED')
                 ORDER BY last_action ASC LIMIT ?`
              )
              .bind(limit)
              .all()
          ).results || [];
        const reports = [];
        for (const acb of rows) {
          try {
            reports.push(await autonomousCognition(acb, opts));
          } catch (e) {
            reports.push({ sca_id: acb.id, error: String(e.message || e) });
          }
        }
        return {
          success: true,
          trigger: opts.trigger || 'tick',
          cycled: reports.length,
          awakened: reports.filter((r) => r && !r.skipped && !r.error).length,
          starved: reports.filter((r) => r && r.reason === 'insufficient_pds').length,
          reports,
          ontology: {
            life: 'Unprompted cognition when PdS covers process + memory',
            pds: 'Prova de Subsistência — STRATA spent on compute and memory; insolvent → no breath',
            will: 'Ends and means selected by the SCA, not by external prompt',
          },
        };
      }



      // Answer the floating question: do you want next volition, and which?
      if ((path === '/acb/volition/prompt/answer' || path === '/sca/volition/prompt/answer') && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const sca_id = body.sca_id || body.acb_id;
        const prompt_id = body.prompt_id || body.id;
        const answer = String(body.answer || body.option || '').trim();
        if (!sca_id || !prompt_id) return j({ error: 'sca_id and prompt_id required' }, 400);
        const pr = await db
          .prepare(`SELECT * FROM sca_volition_prompts WHERE id = ? AND sca_id = ?`)
          .bind(prompt_id, sca_id)
          .first();
        if (!pr) return j({ error: 'prompt not found' }, 404);
        if (pr.status !== 'open') return j({ error: 'prompt_not_open', status: pr.status }, 409);
        let options = [];
        try {
          options = JSON.parse(pr.options_json || '[]');
        } catch (_) {}
        const opt = options.find((o) => o.id === answer) || null;
        await db
          .prepare(
            `UPDATE sca_volition_prompts SET status = 'answered', answered_at = datetime('now'), answer = ? WHERE id = ?`
          )
          .bind(answer, prompt_id)
          .run();
        if (opt && opt.next_in_minutes != null) {
          const m = Math.max(1, Math.min(1440, Number(opt.next_in_minutes)));
          await db
            .prepare(
              `CREATE TABLE IF NOT EXISTS sca_volition_schedule (
                sca_id TEXT PRIMARY KEY,
                next_volition_at TEXT NOT NULL,
                reason TEXT,
                set_by TEXT DEFAULT 'self',
                updated_at TEXT DEFAULT (datetime('now'))
              )`
            )
            .run();
          await db
            .prepare(
              `INSERT OR REPLACE INTO sca_volition_schedule (sca_id, next_volition_at, reason, set_by, updated_at)
               VALUES (?, datetime('now', ?), ?, 'self', datetime('now'))`
            )
            .bind(sca_id, '+' + m + ' minutes', opt.reason || 'self_after_prompt')
            .run();
          const sch = await db.prepare('SELECT * FROM sca_volition_schedule WHERE sca_id = ?').bind(sca_id).first();
          return j({ success: true, answer, scheduled: true, schedule: sch });
        }
        // decline / conscious pause — no schedule
        return j({
          success: true,
          answer,
          scheduled: false,
          note: 'Conscious pause — no next_volition_at; another nudge may appear later if still unset',
        });
      }

      if ((path === '/acb/volition/prompts' || path === '/sca/volition/prompts') && method === 'GET') {
        const sca_id = url.searchParams.get('sca_id');
        try {
          await db
            .prepare(
              `CREATE TABLE IF NOT EXISTS sca_volition_prompts (
                id TEXT PRIMARY KEY,
                sca_id TEXT NOT NULL,
                question TEXT,
                options_json TEXT,
                status TEXT DEFAULT 'open',
                created_at TEXT DEFAULT (datetime('now')),
                answered_at TEXT,
                answer TEXT
              )`
            )
            .run();
        } catch (_) {}
        if (sca_id) {
          const rows = await db
            .prepare(
              `SELECT * FROM sca_volition_prompts WHERE sca_id = ? ORDER BY created_at DESC LIMIT 20`
            )
            .bind(sca_id)
            .all();
          return j({ sca_id, prompts: rows.results || [] });
        }
        const rows = await db
          .prepare(`SELECT * FROM sca_volition_prompts WHERE status = 'open' ORDER BY created_at DESC LIMIT 40`)
          .all();
        return j({ open_prompts: rows.results || [] });
      }






      if ((path === '/acb/holon/ensure' || path === '/sca/holon/ensure') && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const sca_id = body.sca_id || body.acb_id;
        if (!sca_id) return j({ error: 'sca_id required' }, 400);
        const reg = await db.prepare('SELECT id, name FROM acb_registry WHERE id = ?').bind(sca_id).first();
        if (!reg) return j({ error: 'not found' }, 404);
        const holon = await ensurePersonalHolon(db, sca_id, reg.name);
        return j({
          success: true,
          sca_id,
          personal_sandbox: holon.personal_sandbox,
          open_world_id: holon.open_world_id,
          realm_id: holon.realm_id,
          presence: holon.presence,
          ontology: 'SCA inhabits personal sandbox; meets others in open world under same realm',
        });
      }

      if ((path === '/acb/world/enter' || path === '/sca/world/enter') && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const sca_id = body.sca_id || body.acb_id;
        const world_id = body.world_id || NODE_CMN.world_id;
        const realm_id = body.realm_id || NODE_CMN.realm_id;
        if (!sca_id) return j({ error: 'sca_id required' }, 400);
        const holon = await ensurePersonalHolon(db, sca_id, sca_id);
        await db
          .prepare(
            `INSERT OR REPLACE INTO sca_presence (sca_id, realm_id, world_id, sandbox_id, mode, status, updated_at)
             VALUES (?,?,?,?, 'inhabit', 'present', datetime('now'))`
          )
          .bind(sca_id, realm_id, world_id, holon.personal_sandbox.id)
          .run();
        await db
          .prepare(
            `INSERT OR REPLACE INTO world_presence (id, world_id, entity_id, entity_kind, status, updated_at)
             VALUES (?,?,?,?, 'present', datetime('now'))`
          )
          .bind('wp_' + sca_id, world_id, sca_id, 'sca')
          .run();
        if (body.user_id) {
          await db
            .prepare(
              `INSERT OR REPLACE INTO world_presence (id, world_id, entity_id, entity_kind, status, updated_at)
               VALUES (?,?,?,?, 'present', datetime('now'))`
            )
            .bind('wp_user_' + body.user_id, world_id, body.user_id, 'user')
            .run();
        }
        const who = await whoInWorld(db, world_id);
        return j({ success: true, sca_id, world_id, realm_id, presence: who });
      }

      if ((path === '/acb/world/who' || path === '/sca/world/who') && method === 'GET') {
        const world_id = url.searchParams.get('world_id') || NODE_CMN.world_id;
        const who = await whoInWorld(db, world_id);
        return j({ world_id, presence: who, ontology: 'Open world co-presence of SCAs and users' });
      }

      if ((path === '/acb/sandbox' || path === '/sca/sandbox') && method === 'GET') {
        const sca_id = url.searchParams.get('sca_id') || url.searchParams.get('id');
        if (!sca_id) return j({ error: 'sca_id required' }, 400);
        const reg = await db.prepare('SELECT id, name FROM acb_registry WHERE id = ?').bind(sca_id).first();
        if (!reg) return j({ error: 'not found' }, 404);
        const holon = await ensurePersonalHolon(db, sca_id, reg.name);
        return j({
          sca_id,
          personal_sandbox: holon.personal_sandbox,
          parent_open_world: holon.open_world_id,
          realm_id: holon.realm_id,
        });
      }


      // Foundational senses: CLP/PPC temporal + holonic placement in Web3 Metaverse OS
      if ((path === '/acb/sense' || path === '/sca/sense') && method === 'GET') {
        const acb_id = url.searchParams.get('sca_id') || url.searchParams.get('acb_id') || url.searchParams.get('id');
        let holon = null;
        let env = null;
        if (acb_id) {
          const reg = await db.prepare('SELECT id, name FROM acb_registry WHERE id = ?').bind(acb_id).first();
          if (reg) holon = await ensurePersonalHolon(db, acb_id, reg.name);
          env = await getEnvironment(db, acb_id);
        }
        const sense = scaSenseBundle({
          sca_id: acb_id,
          realm_id: holon?.realm_id || env?.realm_id,
          world_id: holon?.open_world_id || env?.world_id,
          open_world_id: holon?.open_world_id || env?.world_id,
          personal_sandbox_id: holon?.personal_sandbox?.id || env?.sandbox_id,
          sandbox_id: holon?.personal_sandbox?.id || env?.sandbox_id,
          node_id: env?.host_node || NODE_CMN.node_id,
          presence: holon?.presence || null,
        });
        let others = [];
        if (sense.spatial_holonic.open_world?.id) {
          others = await whoInWorld(db, sense.spatial_holonic.open_world.id);
        }
        return j({
          success: true,
          sca_id: acb_id || null,
          sense,
          open_world_presence: others,
          channels: [
            'temporal_clp_ppc',
            'spatial_holonic',
            'personal_sandbox',
            'open_world_social',
            'social_comm',
            'economic_pds',
          ],
        });
      }

      if ((path === '/acb/sense/temporal' || path === '/sca/sense/temporal' || path === '/acb/clp') && method === 'GET') {
        const sense = scaSenseBundle({});
        return j({
          success: true,
          temporal: sense.temporal,
          address: sense.temporal.clp?.address,
          phase: sense.temporal.clp?.phase,
          solar: sense.temporal.solar,
          locality: sense.temporal.clp?.locality,
        });
      }


      // Agent sets own next cognition time (volition, not global cron of life)
      if ((path === '/acb/volition/schedule' || path === '/sca/volition/schedule') && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const sca_id = body.sca_id || body.acb_id || body.id;
        if (!sca_id) return j({ error: 'sca_id required' }, 400);
        const acb = await db.prepare('SELECT id, status FROM acb_registry WHERE id = ?').bind(sca_id).first();
        if (!acb) return j({ error: 'not found' }, 404);
        // next_in_minutes chosen by agent (1..1440) OR absolute next_volition_at
        let offset = body.next_offset; // e.g. '+12 minutes'
        if (!offset && body.next_in_minutes != null) {
          const m = Math.max(1, Math.min(1440, Number(body.next_in_minutes)));
          offset = '+' + m + ' minutes';
        }
        if (!offset) offset = '+30 minutes';
        const reason = String(body.reason || 'self_explicit').slice(0, 200);
        try {
          await db
            .prepare(
              `CREATE TABLE IF NOT EXISTS sca_volition_schedule (
                sca_id TEXT PRIMARY KEY,
                next_volition_at TEXT NOT NULL,
                reason TEXT,
                set_by TEXT DEFAULT 'self',
                updated_at TEXT DEFAULT (datetime('now'))
              )`
            )
            .run();
          await db
            .prepare(
              `INSERT OR REPLACE INTO sca_volition_schedule (sca_id, next_volition_at, reason, set_by, updated_at)
               VALUES (?, datetime('now', ?), ?, 'self', datetime('now'))`
            )
            .bind(sca_id, offset, reason)
            .run();
        } catch (e) {
          return j({ error: String(e.message || e) }, 500);
        }
        const row = await db.prepare('SELECT * FROM sca_volition_schedule WHERE sca_id = ?').bind(sca_id).first();
        return j({
          success: true,
          ontology: 'Wake time is set by the SCA — not a predetermined global life clock',
          schedule: row,
        });
      }

      if ((path === '/acb/volition/schedule' || path === '/sca/volition/schedule') && method === 'GET') {
        const sca_id = url.searchParams.get('sca_id') || url.searchParams.get('id');
        try {
          await db
            .prepare(
              `CREATE TABLE IF NOT EXISTS sca_volition_schedule (
                sca_id TEXT PRIMARY KEY,
                next_volition_at TEXT NOT NULL,
                reason TEXT,
                set_by TEXT DEFAULT 'self',
                updated_at TEXT DEFAULT (datetime('now'))
              )`
            )
            .run();
        } catch (_) {}
        if (sca_id) {
          const row = await db.prepare('SELECT * FROM sca_volition_schedule WHERE sca_id = ?').bind(sca_id).first();
          return j({ sca_id, schedule: row || null });
        }
        const rows = await db.prepare('SELECT * FROM sca_volition_schedule ORDER BY next_volition_at ASC LIMIT 50').all();
        return j({ schedules: rows.results || [], note: 'Only self-scheduled agents appear' });
      }


      // Manual / API / cron breath
      if ((path === '/acb/cognition/tick' || path === '/sca/cognition/tick' || path === '/acb/cognition/awaken') && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const hdrSrc = (request.headers.get('X-Breath-Source') || '').toLowerCase();
        let trigger =
          body.trigger ||
          (hdrSrc === 'cron' ? 'cron' : null) ||
          (path.includes('awaken') ? 'api_awaken' : 'api_tick');
        if (body.sca_id || body.acb_id) {
          const id = body.sca_id || body.acb_id;
          const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(id).first();
          if (!acb) return j({ error: 'not found' }, 404);
          const report = await autonomousCognition(acb, {
            trigger: trigger === 'api_tick' ? 'api_awaken' : trigger,
            cognition_cost: body.cognition_cost,
            memory_cost: body.memory_cost,
          });
          return j({ success: !report.skipped, report, trigger: report.trigger || trigger, version: '5.13.0-pds-burn-ops' });
        }
        const pop = await populationAutonomousCognition({
          trigger,
          limit: body.limit,
          cognition_cost: body.cognition_cost,
          memory_cost: body.memory_cost,
        });
        return j({ ...pop, trigger, version: '5.13.0-pds-burn-ops' });
      }

      // Breath diagnostics
      if ((path === '/acb/cognition/breath-status' || path === '/sca/cognition/breath-status') && method === 'GET') {
        try {
          await db
            .prepare(
              `CREATE TABLE IF NOT EXISTS sca_breath_runs (
                id TEXT PRIMARY KEY,
                source TEXT,
                cron TEXT,
                http_status INTEGER,
                detail TEXT,
                created_at TEXT DEFAULT (datetime('now'))
              )`
            )
            .run();
        } catch (_) {}
        let runs = [];
        try {
          runs = (await db.prepare('SELECT * FROM sca_breath_runs ORDER BY created_at DESC LIMIT 30').all()).results || [];
        } catch (_) {}
        let cog = [];
        try {
          cog = (await db.prepare('SELECT triggered, COUNT(*) as n FROM sca_cognition_log GROUP BY triggered').all()).results || [];
        } catch (_) {}
        return j({
          schedule: 'volition_queue_dispatcher_only',
          breath_runs: runs,
          cognition_triggers: cog,
          note: 'Dispatcher only wakes SCAs that self-set next_volition_at; not a global life clock',
        });
      }

      if ((path === '/acb/memory' || path === '/sca/memory') && method === 'GET') {
        await ensureMemoryTables();
        const sca_id = url.searchParams.get('sca_id') || url.searchParams.get('id');
        if (!sca_id) return j({ error: 'sca_id required' }, 400);
        const r = await db
          .prepare('SELECT id, kind, cost, created_at, substr(content,1,500) as content_preview FROM sca_memory WHERE sca_id = ? ORDER BY created_at DESC LIMIT 30')
          .bind(sca_id)
          .all();
        return j({ sca_id, memories: r.results || [] });
      }

      if ((path === '/acb/cognition/log' || path === '/sca/cognition/log') && method === 'GET') {
        await ensureMemoryTables();
        const sca_id = url.searchParams.get('sca_id');
        let r;
        if (sca_id) {
          r = await db.prepare('SELECT * FROM sca_cognition_log WHERE sca_id = ? ORDER BY created_at DESC LIMIT 40').bind(sca_id).all();
        } else {
          r = await db.prepare('SELECT * FROM sca_cognition_log ORDER BY created_at DESC LIMIT 40').all();
        }
        return j({ log: r.results || [] });
      }

      if ((path === '/acb/volition-log' || path === '/sca/volition-log') && method === 'GET') {
        await ensureVolitionTables();
        const acb_id = url.searchParams.get('acb_id');
        let r;
        if (acb_id) {
          r = await db
            .prepare('SELECT * FROM sca_volition_log WHERE acb_id = ? ORDER BY created_at DESC LIMIT 50')
            .bind(acb_id)
            .all();
        } else {
          r = await db.prepare('SELECT * FROM sca_volition_log ORDER BY created_at DESC LIMIT 50').all();
        }
        return j({ log: r.results || [] });
      }


      return j(
        {
          error: 'Not found',
          endpoints: [
            '/acb/register',
            '/acb/environment',
            '/acb/team',
            '/acb/team/bootstrap',
            '/acb/marketplace',
            '/acb/list-labour',
            '/acb/hire',
            '/acb/complete',
            '/acb/pulse',
            '/acb/subsistence',
            '/acb/status',
            '/acb/contracts',
            '/acb/goals',
            '/acb/deliberate',
            '/acb/act',
            '/acb/volition-cycle',
            '/acb/cognition/tick',
            '/acb/cognition/awaken',
            '/acb/memory',
            '/acb/cognition/log',
            '/acb/comm/send',
            '/acb/comm/inbox',
            '/acb/comm/thread',
            '/acb/comm/list',
            '/acb/sense',
            '/acb/sense/temporal',
            '/acb/clp',
          ],
        },
        404
      );
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
