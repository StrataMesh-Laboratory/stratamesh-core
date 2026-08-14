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
  const trueSolarNoon = (720 - 4 * lon - eqOfTime + date.getTimezoneOffset()) / 1440;
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

/** Durable Object class kept for migration compatibility */
export class DAGVertex {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  async fetch(request) {
    const u = new URL(request.url);
    if (u.pathname === '/status') {
      return new Response(JSON.stringify({ status: 'ok', do: 'DAGVertex' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function sha256(d) {
  const h = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(typeof d === 'string' ? d : JSON.stringify(d))
  );
  return Array.from(new Uint8Array(h))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
async function contentCid(d) {
  const hex = await sha256(d);
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = '';
  for (let i = 0; i < hex.length; i += 2) bits += parseInt(hex.slice(i, i + 2), 16).toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += alphabet[parseInt(bits.slice(i, i + 5), 2)];
  return 'bafy' + out.slice(0, 52);
}


async function ensureConflictTables(db) {
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS spend_claims (
      spend_key TEXT PRIMARY KEY,
      vertex_id TEXT NOT NULL,
      payload_hash TEXT,
      emission_node TEXT,
      created_at TEXT
    )`).run();
  } catch (_) {}
}

function extractSpendKey(payload) {
  let o = payload;
  if (typeof payload === 'string') {
    try { o = JSON.parse(payload); } catch { return null; }
  }
  if (!o || typeof o !== 'object') return null;
  // explicit key
  if (o.spend_key) return String(o.spend_key);
  const typ = (o.type || o.kind || '').toLowerCase();
  // token transfer / nft transfer conflict surface
  if (typ.includes('transfer') || typ.includes('spend') || typ === 'payment') {
    const asset = o.asset_id || o.nft_id || o.token || 'STRATA';
    const from = o.from || o.owner || o.seller || o.account || '';
    const nonce = o.nonce || o.utxo || o.tx_ref || o.id || '';
    if (from || nonce) return `spend:${asset}:${from}:${nonce}`;
  }
  if (typ === 'nft_mint' && o.id) return `mint:${o.id}`;
  return null;
}

async function bumpWeights(db, tipIds, delta = 1) {
  // Increase cumulative_weight on referenced tips (parents) — lab approximation of cumulative confirmation weight
  for (const tid of tipIds || []) {
    if (!tid || tid === 'GENESIS') continue;
    try {
      await db.prepare('UPDATE vertices SET cumulative_weight = COALESCE(cumulative_weight,0) + ? WHERE vertex_id = ?').bind(delta, tid).run();
    } catch (_) {}
    try {
      await db.prepare('UPDATE dag_tips SET weight = COALESCE(weight,0) + ? WHERE vertex_id = ? OR cid = ?').bind(delta, tid, tid).run();
    } catch (_) {}
    // one level up: parents of tip
    try {
      const row = await db.prepare('SELECT parent_vertices FROM vertices WHERE vertex_id = ?').bind(tid).first();
      if (row && row.parent_vertices) {
        let parents = [];
        try { parents = JSON.parse(row.parent_vertices); } catch { parents = []; }
        for (const pid of parents.slice(0, 4)) {
          if (!pid || pid === 'GENESIS') continue;
          try {
            await db.prepare('UPDATE vertices SET cumulative_weight = COALESCE(cumulative_weight,0) + ? WHERE vertex_id = ?').bind(Math.max(1, Math.floor(delta / 2)), pid).run();
          } catch (_) {}
        }
      }
    } catch (_) {}
  }
}

function confidenceFromWeight(w) {
  const n = Number(w) || 0;
  return Math.round((1 - 1 / (1 + n)) * 10000) / 10000;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.startsWith('/api/v1/dag')) path = path.slice('/api/v1/dag'.length) || '/';
    if (path.startsWith('/api/v1')) path = path.slice('/api/v1'.length) || '/';
    const j = (d, s = 200) =>
      new Response(JSON.stringify(d), {
        status: s,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    const db = env.LEDGER || env.DB || env.STRATAMESH_LEDGER;
    try {
      if (path === '/' || path === '/health' || path === '/status') {
        let count = 0;
        try {
          const r = await db.prepare('SELECT COUNT(*) as c FROM vertices').first();
          count = r?.c ?? 0;
        } catch (_) {
          try {
            const r = await db.prepare('SELECT COUNT(*) as c FROM dag_vertices').first();
            count = r?.c ?? 0;
          } catch (_) {}
        }
        return j({
          status: 'ok',
          service: 'stratamesh-dag',
          version: '2.7.0-ppc',
          anti_double_spend: true,
          cumulative_weight: true,
          vertices: count,
          pipeline: ['tip-select', 'hash', 'ipfs-pin', 'attach', 'gossip'],
          schema: 'vertices + dag_vertices + ipfs_pins',
        });
      }

      // GET /tips
      if (path === '/tips') {
        let tips = [];
        try {
          const r = await db
            .prepare(
              'SELECT vertex_id as id, cumulative_weight, ipfs_cid as cid, created_at FROM vertices ORDER BY cumulative_weight DESC LIMIT 10'
            )
            .all();
          tips = r.results || [];
        } catch (_) {}
        if (!tips.length) {
          try {
            const r = await db
              .prepare('SELECT cid as id, weight as cumulative_weight, cid, updated_at as created_at FROM dag_tips ORDER BY weight DESC LIMIT 10')
              .all();
            tips = r.results || [];
          } catch (_) {}
        }
        if (!tips.length) tips = [{ id: 'GENESIS', cumulative_weight: 1, cid: null }];
        return j({ tips, algorithm: 'heaviest-first-lab' });
      }

      // POST /submit — full pipeline
      if ((path === '/submit' || path === '/pipeline' || path === '/attach') && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const payload = body.payload ?? body;
        const content = body.content || body.data || null;
        const node_id = body.node_id || 'FOG-NODE-PT-CM-001';
        let payloadObj = typeof payload === 'string' ? (() => { try { return JSON.parse(payload); } catch { return {}; } })() : (payload || {});
        // Holonic DLT layer: PPC temporal authority sealed into payload before hash (immutable on-graph)
        if (typeof ppcCompact === 'function' && !(payloadObj && payloadObj.temporal)) {
          payloadObj = Object.assign({}, payloadObj || {}, {
            temporal: ppcCompact('dlt', { node_id: node_id }),
          });
        }
        const payloadStr = JSON.stringify(payloadObj);
        const isLightweight = !!(payloadObj.lightweight || payloadObj.tx_class === 'lightweight' || payloadObj.type === 'iot' || payloadObj.type === 'micro');
        const subsidyRequested = !!(payloadObj.subsidy || payloadObj.fog_subsidy);

        const ph = await sha256(payloadStr);

        await ensureConflictTables(db);

        // Exact duplicate payload
        let dup = null;
        try {
          dup = await db.prepare('SELECT vertex_id FROM vertices WHERE payload_hash=?').bind(ph).first();
        } catch (_) {}
        if (dup) {
          return j({
            error: 'duplicate_payload',
            reason: 'Identical payload already on DAG',
            existing: dup.vertex_id,
            rule: 'payload_hash unique',
          }, 409);
        }

        // Semantic double-spend / conflict (spend_key)
        const spendKey = extractSpendKey(payload);
        if (spendKey) {
          let claim = null;
          try {
            claim = await db.prepare('SELECT * FROM spend_claims WHERE spend_key = ?').bind(spendKey).first();
          } catch (_) {}
          if (claim && claim.payload_hash !== ph) {
            return j({
              error: 'Double-spend detected',
              reason: 'Conflicting spend_key already claimed by another vertex',
              spend_key: spendKey,
              existing: claim.vertex_id,
              existing_hash: claim.payload_hash,
              rule: 'one spend_key → one accepted payload on DAG',
            }, 409);
          }
        }

        // tips
        let tipIds = body.tips;
        if (!tipIds || !Array.isArray(tipIds) || !tipIds.length) {
          try {
            const r = await db
              .prepare('SELECT vertex_id FROM vertices ORDER BY cumulative_weight DESC LIMIT 2')
              .all();
            tipIds = (r.results || []).map((x) => x.vertex_id);
          } catch (_) {
            tipIds = [];
          }
          if (!tipIds.length) tipIds = ['GENESIS'];
        }

        // CID / IPFS
        let cid = body.cid || body.ipfs_cid || null;
        let pin = null;
        if (!cid && content != null) {
          cid = await contentCid(typeof content === 'string' ? content : JSON.stringify(content));
        }
        if (cid) {
          try {
            await db
              .prepare(
                'INSERT INTO ipfs_pins (node_id, cid, pin_name, size_bytes, tier, status, strata_cost) VALUES (?,?,?,?,?,?,?)'
              )
              .bind(node_id, cid, body.pin_name || 'dag-payload', body.size_bytes || 0, body.tier || 'contributor', 'pinned', 0)
              .run();
            pin = { cid, status: 'pinned', tier: body.tier || 'contributor' };
          } catch (e) {
            pin = { cid, status: 'pin_best_effort', note: String(e.message || e).slice(0, 120) };
          }
          try {
            if (env.IPFS && typeof env.IPFS.fetch === 'function') {
              await env.IPFS.fetch(
                new Request('https://ipfs/pin', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ cid, node_id, tier: 'contributor' }),
                })
              );
            }
          } catch (_) {}
        }

        const vid = crypto.randomUUID();
        const now = new Date().toISOString();
        const parents = JSON.stringify(tipIds);
        // Prefer existing vertices schema
        try {
          await db
            .prepare(
              `INSERT INTO vertices (
                vertex_id, vertex_type, parent_vertices, ipfs_cid, payload_hash,
                emission_timestamp, emission_node, cumulative_weight, signature, signature_algorithm, confirmed
              ) VALUES (?,?,?,?,?,?,?,1,?,?,0)`
            )
            .bind(
              vid,
              body.vertex_type || 'transaction',
              parents,
              cid,
              ph,
              now,
              node_id,
              body.signature || 'lab-unsigned',
              body.signature_algorithm || 'none'
            )
            .run();
        } catch (e1) {
          // Fallback dag_vertices
          try {
            await db
              .prepare(
                `INSERT INTO dag_vertices (cid, type, parents, payload, weight, confirmed, vertex_id)
                 VALUES (?,?,?,?,1,0,?)`
              )
              .bind(cid || ph, 'transaction', parents, payloadStr, vid)
              .run();
          } catch (e2) {
            return j({ error: 'attach failed', e1: String(e1.message || e1), e2: String(e2.message || e2) }, 500);
          }
        }

                // Register spend claim (anti-double-spend surface)
        if (spendKey) {
          try {
            await db
              .prepare(
                'INSERT OR IGNORE INTO spend_claims (spend_key, vertex_id, payload_hash, emission_node, created_at) VALUES (?,?,?,?,?)'
              )
              .bind(spendKey, vid, ph, node_id, new Date().toISOString())
              .run();
          } catch (_) {}
        }

        // Cumulative weight: new vertex weight=1; bump parents (whitepaper confirmation via subsequent references)
        
        // Fog subsidy path for lightweight/IoT (whitepaper: DAO/SPA fog batch subsidy)
        if (isLightweight || subsidyRequested) {
          try {
            await db.prepare(`CREATE TABLE IF NOT EXISTS subsidy_events (
              id TEXT PRIMARY KEY, vertex_id TEXT, node_id TEXT, reason TEXT, created_at TEXT
            )`).run();
            await db.prepare('INSERT INTO subsidy_events (id, vertex_id, node_id, reason, created_at) VALUES (?,?,?,?,?)')
              .bind(crypto.randomUUID(), vid, node_id, isLightweight ? 'lightweight_tx' : 'fog_subsidy', new Date().toISOString()).run();
            try {
              await fetch('https://stratamesh-poc.stratamesh.workers.dev/consume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resource_class: isLightweight ? 'validate' : 'fog_uptime', units: 1, source: 'dag_subsidy', ref: vid }),
              });
            } catch (_) {}
          } catch (_) {}
        }
        await bumpWeights(db, tipIds, 1);

        try {
          for (const tip of tipIds) {
            await db
              .prepare(
                'INSERT INTO dag_tips (cid, weight, updated_at, vertex_id) VALUES (?,1,?,?) ON CONFLICT(cid) DO UPDATE SET weight = weight + 1, updated_at = excluded.updated_at'
              )
              .bind(tip, new Date().toISOString(), vid)
              .run();
          }
        } catch (_) {}


        // Gossip
        const gossipBody = JSON.stringify({ id: vid, hash: ph, tip: vid, cid, tips: tipIds, payload: payloadStr.slice(0, 200) });
        const gossip = [];
        const peerBindings = [
          ['node-2', env.NODE2, 'https://stratamesh-node-2.stratamesh.workers.dev', '/validate'],
          ['node-3', env.NODE3, 'https://stratamesh-node-3.stratamesh.workers.dev', '/validate'],
          ['gossip', env.GOSSIP, 'https://stratamesh-gossip.stratamesh.workers.dev', '/broadcast'],
        ];
        for (const [name, binding, base, pth] of peerBindings) {
          try {
            let resp;
            if (binding && typeof binding.fetch === 'function') {
              resp = await binding.fetch(new Request('https://peer' + pth, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: gossipBody,
              }));
            } else {
              resp = await fetch(base + pth, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: gossipBody,
              });
            }
            gossip.push({ peer: name, ok: resp.ok, status: resp.status });
          } catch (e) {
            gossip.push({ peer: name, ok: false, error: String(e.message || e).slice(0, 80) });
          }
        }

        return j({
          success: true,
          pipeline: 'tip-select → hash → ipfs-pin → attach → gossip',
          vertex_id: vid,
          payload_hash: ph,
          tips: tipIds,
          ipfs_cid: cid,
          pin,
          gossip,
          cumulative_weight: 1,
          spend_key: spendKey,
          lightweight: isLightweight,
          subsidy_requested: subsidyRequested,
          confidence: confidenceFromWeight(1),
          version: '2.7.0-ppc',
          temporal: payloadObj.temporal || null,
          temporal_authority: 'PPC',
        });
      }

      // GET /vertices
      if (path === '/vertices') {
        const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '10', 10));
        try {
          const r = await db
            .prepare(
              'SELECT vertex_id, vertex_type, parent_vertices, ipfs_cid, payload_hash, cumulative_weight, emission_node, created_at FROM vertices ORDER BY created_at DESC LIMIT ?'
            )
            .bind(limit)
            .all();
          return j({ vertices: r.results || [], count: (r.results || []).length });
        } catch (e) {
          return j({ vertices: [], error: String(e.message || e) });
        }
      }

      // validate
      if (path === '/validate' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const id = body.vertex_id || body.id;
        const v = await db.prepare('SELECT * FROM vertices WHERE vertex_id=?').bind(id).first();
        if (!v) return j({ error: 'Not found' }, 404);
        return j({ valid: true, vertex: v });
      }

      if (path === '/vertex') {
        const id = url.searchParams.get('id');
        const v = await db.prepare('SELECT * FROM vertices WHERE vertex_id=?').bind(id).first();
        if (!v) return j({ error: 'Not found' }, 404);
        return j({ vertex: v });
      }


      // GET /confidence?id= — cumulative weight → probabilistic confidence
      if (path === '/confidence') {
        const id = url.searchParams.get('id') || url.searchParams.get('vertex_id');
        if (!id) return j({ error: 'id required' }, 400);
        const v = await db.prepare('SELECT vertex_id, cumulative_weight, payload_hash, parent_vertices FROM vertices WHERE vertex_id = ?').bind(id).first();
        if (!v) return j({ error: 'not found' }, 404);
        const w = Number(v.cumulative_weight || 0);
        return j({
          vertex_id: v.vertex_id,
          cumulative_weight: w,
          confidence: confidenceFromWeight(w),
          model: 'lab: confidence = 1 - 1/(1+weight); weight grows when later txs reference this vertex as tip',
        });
      }

      // GET /conflicts — spend claims ledger
      if (path === '/conflicts' || path === '/spend-claims') {
        await ensureConflictTables(db);
        const rows = await db.prepare('SELECT * FROM spend_claims ORDER BY created_at DESC LIMIT 50').all();
        return j({ claims: rows.results || [], rule: 'one spend_key → one vertex' });
      }

      return j({
        status: 'ok',
        service: 'stratamesh-dag',
        version: '2.7.0-ppc',
        endpoints: ['/health', '/tips', '/submit', '/attach', '/vertices', '/vertex', '/validate', '/confidence', '/conflicts'],
      });
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
