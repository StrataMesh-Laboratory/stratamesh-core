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
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

const CMN_TEAM = {
  lead: 'ACB-ORCH-CMN-001',
  agents: [
    'ACB-AIOPS-devops',
    'ACB-AIOPS-security',
    'ACB-AIOPS-analysis',
    'ACB-AIOPS-mesh',
    'ACB-AIOPS-economy',
  ],
  realm_id: 'realm_1f20890b',
  world_id: 'world_b787cfe9-c',
  sandbox_id: 'sbx_9bed54e8-880',
  host_node: 'FOG-NODE-PT-CM-001',
};

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

async function debitStrata(db, account, amount) {
  const cost = Math.abs(Number(amount) || 0);
  if (cost <= 0) return await getStrata(db, account);
  try {
    await db
      .prepare(
        `UPDATE token_balances SET balance = MAX(0, balance - ?), total_burned = COALESCE(total_burned,0) + ?
         WHERE account = ? AND token_type IN ('STRATA','strata')`
      )
      .bind(cost, cost, account)
      .run();
  } catch (_) {
    await db
      .prepare(`UPDATE token_balances SET balance = balance - ? WHERE account = ? AND token_type IN ('STRATA','strata')`)
      .bind(cost, account)
      .run();
  }
  try {
    await db.prepare('UPDATE acb_registry SET balance = MAX(0, COALESCE(balance,0) - ?) WHERE id = ?').bind(cost, account).run();
  } catch (_) {}
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.startsWith('/api/v1/acb')) path = path.slice('/api/v1'.length);
    if (path === '/acb/list' || path === '/list') path = '/acb/status';
    if (path === '/health') path = '/acb/health';
    if (path === '/marketplace') path = '/acb/marketplace';
    if (path === '/hire') path = '/acb/hire';
    if (path === '/complete') path = '/acb/complete';
    if (path === '/team') path = '/acb/team';
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
          version: '5.3.0-holonic',
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
          ],
        });
      }

      if (path === '/acb/register' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const id = body.acb_id || body.id || 'ACB-' + crypto.randomUUID().slice(0, 10);
        const name = body.name || id;
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
        return j({
          success: true,
          acb: { acb_id: id, name, status: 'active', balance: 0 },
          note: 'ACBs earn when STRATA holders hire them — not via PoC mint',
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
        return j({ success: true, environment: await getEnvironment(db, acb_id) });
      }

      // Bootstrap CMN team environments
      if (path === '/acb/team/bootstrap' && method === 'POST') {
        const all = [CMN_TEAM.lead, ...CMN_TEAM.agents];
        const roles = {
          'ACB-ORCH-CMN-001': 'lead',
          'ACB-AIOPS-devops': 'devops',
          'ACB-AIOPS-security': 'security',
          'ACB-AIOPS-analysis': 'analysis',
          'ACB-AIOPS-mesh': 'mesh',
          'ACB-AIOPS-economy': 'economy',
        };
        for (const id of all) {
          const exists = await db.prepare('SELECT id FROM acb_registry WHERE id = ?').bind(id).first();
          if (!exists) {
            await db
              .prepare(
                `INSERT OR IGNORE INTO acb_registry (id, name, personality, status, subsistence_score, balance, created_at, last_action)
                 VALUES (?,?,?,?,0,0,datetime('now'),'bootstrap')`
              )
              .bind(id, id, 'aiops-' + (roles[id] || 'agent'), 'active')
              .run();
          }
          await setEnvironment(db, id, {
            host_node: CMN_TEAM.host_node,
            realm_id: CMN_TEAM.realm_id,
            world_id: CMN_TEAM.world_id,
            sandbox_id: CMN_TEAM.sandbox_id,
            holon: 'virtual_realm',
            role: roles[id] || 'agent',
            team: 'aiops-dev',
            meta: { metaverse: true, tokenomic: true },
          });
        }
        return j({ success: true, bootstrapped: all, environment: CMN_TEAM });
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
          version: '5.3.0-holonic',
          lead,
          lead_balance_after: await getStrata(db, lead),
          topups: results,
          pulses,
          economics: 'Top-ups are transfers from Orchestrator earned STRATA — zero mint',
        });
      }

      if (path === '/acb/team') {
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
          ],
        },
        404
      );
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
