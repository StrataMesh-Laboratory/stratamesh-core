
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


/**
 * PoC refined process pipeline
 *
 * MECHANISM
 * ---------
 * 1. MEASURE  — contribution units + proof metadata for a resource class on the DLT
 * 2. VALUE    — units × global market average for that resource (exogenous)
 * 3. QUALITY  — premium / discount within the same resource (par = 1); function/purpose never prices
 * 4. FX       — convert quote value → STRATA at Agora open-book rate
 * 5. ALLOCATE — mint attributed proportionally to quality-weighted shares
 * 6. SETTLE   — balances + minting_events + optional epoch rollup
 *
 * Protocol never sets a STRATA-per-unit emission rate.
 */
function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
}
function j(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors() });
}

/**
 * Resource classes = physical/measurable capacity ONLY.
 * Function (what capacity is used for) NEVER defines price.
 * Only: quantity × market avg × quality(premium|discount) × Agora FX → STRATA.
 */
const GLOBAL_RESOURCE_AVG = {
  storage: {
    quote_asset: 'EUR',
    avg_per_unit: 0.000014,
    unit: 'MB-month',
    note: 'Capacity — independent of which object or app uses it',
  },
  compute: {
    quote_asset: 'EUR',
    avg_per_unit: 0.00002,
    unit: 'work-unit',
    note: 'Work capacity — not priced by task purpose',
  },
  bandwidth: {
    quote_asset: 'EUR',
    avg_per_unit: 0.000008,
    unit: 'propagation-unit',
    note: 'Transfer capacity — not priced by message type',
  },
  availability: {
    quote_asset: 'EUR',
    avg_per_unit: 0.00015,
    unit: 'uptime-slice',
    note: 'Always-on capacity — not priced by service name',
  },
};

/** Legacy labels → resource class (compat only; not separate prices) */
const RESOURCE_ALIASES = {
  ipfs_pin: 'storage',
  pin: 'storage',
  storage_mb: 'storage',
  validate: 'compute',
  validation: 'compute',
  starter_task: 'compute',
  gossip: 'bandwidth',
  fog_uptime: 'availability',
  uptime: 'availability',
};

function normalizeResourceClass(name) {
  if (!name) return null;
  const k = String(name).toLowerCase().trim();
  if (GLOBAL_RESOURCE_AVG[k]) return k;
  return RESOURCE_ALIASES[k] || null;
}

const QUALITY_BOUNDS = { min: 0.1, max: 2.5, par: 1.0 };

/** Audited quality of the contributed *resource capacity* (not of its function/purpose). */
function auditQualityFromMeasurement(m) {
  if (!m) return scoreQuality({});
  const pins = (m.sources && m.sources.ipfs_pins && m.sources.ipfs_pins.count) || 0;
  const mb = (m.sources && m.sources.ipfs_pins && m.sources.ipfs_pins.mb) || 0;
  const computeU = Number(m.compute || m.validate || 0);
  const demandStorage = (m.demand && (m.demand.storage || m.demand.ipfs_pin)) || 0;
  const reliability = clamp(0.35 + Math.log10(1 + pins + computeU) / 4, 0, 1);
  const usefulness =
    demandStorage > 0
      ? clamp(0.35 + Math.min(pins + mb, demandStorage) / Math.max(demandStorage, 1e-9) * 0.55, 0, 1)
      : clamp(0.25 + Math.min(pins, 20) / 40, 0, 0.55);
  const availability_dim = mb >= 1 ? 0.9 : mb > 0.01 ? 0.7 : pins > 0 ? 0.5 : 0.2;
  const verifiability = computeU > 0 ? 0.85 : pins > 0 ? 0.55 : 0.3;
  return scoreQuality({
    reliability,
    usefulness,
    availability: availability_dim,
    verifiability,
  });
}

/** Billable units by resource class (capacity), never by function. */
function billableUnits(resource_class, onchain) {
  if (!onchain) return 0;
  const rc = normalizeResourceClass(resource_class) || resource_class;
  if (rc === 'storage') {
    const mb = Number(onchain.sources?.ipfs_pins?.mb) || Number(onchain.storage) || 0;
    const cnt = Number(onchain.sources?.ipfs_pins?.count) || 0;
    return Math.max(mb, cnt * (4 / 1024));
  }
  if (rc === 'compute') return Number(onchain.compute ?? onchain.validate) || 0;
  if (rc === 'availability') return Number(onchain.availability ?? onchain.fog_uptime) || 0;
  if (rc === 'bandwidth') return Number(onchain.bandwidth ?? onchain.gossip) || 0;
  return Number(onchain[rc]) || 0;
}

function scoreQuality(body) {
  if (body.quality != null && Number.isFinite(Number(body.quality))) {
    const f = clamp(Number(body.quality), QUALITY_BOUNDS.min, QUALITY_BOUNDS.max);
    return {
      factor: f,
      tier: tierOf(f),
      components: { explicit: f },
      method: 'explicit',
    };
  }
  // proof-derived dimensions (0..1 each) → geometric mean → map to [min,max] around par
  const dims = {
    reliability: num01(body.reliability ?? body.proof_reliability),
    usefulness: num01(body.usefulness ?? body.proof_usefulness),
    availability: num01(body.availability ?? body.proof_availability),
    verifiability: num01(body.verifiability ?? body.proof_verifiability),
  };
  const present = Object.values(dims).filter((v) => v != null);
  if (!present.length) {
    return { factor: QUALITY_BOUNDS.par, tier: 'par', components: dims, method: 'default_par' };
  }
  const geo = Math.exp(present.reduce((s, v) => s + Math.log(Math.max(v, 1e-6)), 0) / present.length);
  // geo in (0,1] → factor in [min, max] with 1.0 at geo≈0.85 baseline
  const factor = clamp(QUALITY_BOUNDS.min + geo * (QUALITY_BOUNDS.max - QUALITY_BOUNDS.min) * 0.85, QUALITY_BOUNDS.min, QUALITY_BOUNDS.max);
  return { factor, tier: tierOf(factor), components: dims, method: 'proof_dimensions' };
}

function num01(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return clamp(n, 0, 1);
}
function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}
function tierOf(f) {
  if (f > 1.05) return 'premium';
  if (f < 0.95) return 'discount';
  return 'par';
}
function quant8(n) {
  return Math.floor(Number(n) * 1e8) / 1e8;
}

async function ensure(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS minting_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT,
        contribution_type TEXT,
        contribution_score REAL,
        amount REAL,
        proof_hash TEXT,
        status TEXT,
        scarcity REAL,
        contributed_after REAL,
        consumed_at_mint REAL,
        created_at TEXT DEFAULT (datetime('now'))
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS resource_meters (
        resource_class TEXT PRIMARY KEY,
        contributed REAL DEFAULT 0,
        consumed REAL DEFAULT 0,
        updated_at TEXT
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS global_resource_avgs (
        resource_class TEXT PRIMARY KEY,
        quote_asset TEXT,
        avg_per_unit REAL,
        source TEXT,
        updated_at TEXT
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS poc_epochs (
        epoch_id TEXT PRIMARY KEY,
        resource_class TEXT,
        status TEXT,
        total_units REAL,
        total_strata REAL,
        agora_strata_per_quote REAL,
        quote_asset TEXT,
        created_at TEXT,
        closed_at TEXT
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS poc_epoch_shares (
        epoch_id TEXT,
        node_id TEXT,
        units REAL,
        quality_factor REAL,
        weight REAL,
        amount REAL,
        PRIMARY KEY (epoch_id, node_id)
      )`
    )
    .run();
  
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS poc_rewarded_units (
        node_id TEXT,
        contribution_type TEXT,
        units_rewarded REAL DEFAULT 0,
        updated_at TEXT,
        PRIMARY KEY (node_id, contribution_type)
      )`
    )
    .run();

  for (const [k, v] of Object.entries(GLOBAL_RESOURCE_AVG)) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO global_resource_avgs (resource_class, quote_asset, avg_per_unit, source, updated_at)
         VALUES (?,?,?,?, datetime('now'))`
      )
      .bind(k, v.quote_asset, v.avg_per_unit, 'lab_global_market_proxy')
      .run();
    await db
      .prepare(
        `INSERT OR IGNORE INTO resource_meters (resource_class, contributed, consumed, updated_at)
         VALUES (?,0,0,datetime('now'))`
      )
      .bind(k)
      .run();
  }
}


async function measureOnchain(db, node_id) {
  const out = {
    node_id,
    // Resource quantities (price by resource, never by function)
    storage: 0,
    compute: 0,
    bandwidth: 0,
    availability: 0,
    // Legacy aliases (same numbers — measurement evidence labels)
    validate: 0,
    fog_uptime: 0,
    ipfs_pin: 0,
    gossip: 0,
    sources: {},
    demand: {},
  };
  // DAG subsidy / lightweight work
  try {
    const rows = await db
      .prepare('SELECT reason, COUNT(*) as c FROM subsidy_events WHERE node_id = ? GROUP BY reason')
      .bind(node_id)
      .all();
    for (const r of rows.results || []) {
      const c = Number(r.c) || 0;
      if (String(r.reason).includes('lightweight') || String(r.reason).includes('valid')) {
        out.validate += c;
        out.compute += c;
        out.sources.validate_subsidy = (out.sources.validate_subsidy || 0) + c;
      } else {
        out.fog_uptime += c;
        out.availability += c;
        out.sources.fog_subsidy = (out.sources.fog_subsidy || 0) + c;
      }
    }
  } catch (_) {}
  // Vertices referencing node in payload
  try {
    const verts = await db
      .prepare("SELECT COUNT(*) as c FROM dag_vertices WHERE payload LIKE ?")
      .bind('%' + node_id + '%')
      .first();
    const c = Number(verts?.c) || 0;
    if (c) {
      out.validate += c;
      out.compute += c;
      out.sources.dag_vertices_payload = c;
    }
  } catch (_) {}
  // IPFS pins by node
  try {
    const pins = await db
      .prepare("SELECT COUNT(*) as c, COALESCE(SUM(size_bytes),0) as bytes FROM ipfs_pins WHERE node_id = ? AND status IN ('pinned','active','pinning','ok')")
      .bind(node_id)
      .first();
    const c = Number(pins?.c) || 0;
    const mb = (Number(pins?.bytes) || 0) / (1024 * 1024);
    // units: count + MB as capacity proxy
    const u = c + mb;
    if (u > 0) {
      out.ipfs_pin += u;
      out.storage += u;
      out.sources.ipfs_pins = { count: c, mb };
    }
  } catch (_) {}
  // SPA pins linked via spas owned by node (spa_id contains node or spas table)
  try {
    const spa = await db
      .prepare(
        `SELECT COUNT(*) as c FROM spa_pins sp
         JOIN spas s ON s.spa_id = sp.spa_id
         WHERE s.node_id = ? OR s.spa_id LIKE ? OR sp.spa_id LIKE ?`
      )
      .bind(node_id, '%' + node_id + '%', '%' + node_id + '%')
      .first();
    const c = Number(spa?.c) || 0;
    if (c) {
      out.ipfs_pin += c;
      out.storage += c;
      out.sources.spa_pins = c;
    }
  } catch (_) {
    try {
      const spa = await db.prepare('SELECT COUNT(*) as c FROM spa_pins').first();
      // network-wide not attributed — skip
    } catch (__) {}
  }
  // Mesh demand (consumption) from pin_requests matched
  let demand = { storage: 0, compute: 0, bandwidth: 0, availability: 0 };
  try {
    const req = await db
      .prepare("SELECT COALESCE(SUM(size_gb),0) as gb, COUNT(*) as c FROM pin_requests WHERE status IN ('matched','filled','active','completed')")
      .first();
    // Mesh demand for storage capacity (not "demand for function X")
    demand.storage = (Number(req?.gb) || 0) * 1024 + (Number(req?.c) || 0);
  } catch (_) {}
  try {
    const n = await db.prepare('SELECT COUNT(*) as c FROM subsidy_events').first();
    demand.compute = Number(n?.c) || 0;
  } catch (_) {}
  out.demand = demand;
  // Compat mirrors
  out.demand.ipfs_pin = demand.storage;
  out.demand.validate = demand.compute;
  out.total_units = out.storage + out.compute + out.bandwidth + out.availability;
  return out;
}

async function dagAnchorMint(env, payload) {
  try {
    const body = JSON.stringify({
      payload: { type: 'poc_mint_settlement', ...payload },
      node_id: payload.node_id || payload.attributions?.[0]?.node_id || 'poc',
      lightweight: true,
    });
    if (env.DAG && typeof env.DAG.fetch === 'function') {
      const r = await env.DAG.fetch(
        new Request('https://dag/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
      );
      return await r.json().catch(() => ({ ok: false }));
    }
    const r = await fetch('https://stratamesh-dag.stratamesh.workers.dev/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    return await r.json().catch(() => ({ ok: false }));
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}


async function agoraRate(env, quote = 'EUR') {
  try {
    if (env.AGORA && typeof env.AGORA.fetch === 'function') {
      const r = await env.AGORA.fetch(new Request('https://agora/rate?quote=' + encodeURIComponent(quote)));
      return await r.json();
    }
    const r = await fetch(
      'https://stratamesh-agora.stratamesh.workers.dev/agora/rate?quote=' + encodeURIComponent(quote)
    );
    return await r.json();
  } catch (e) {
    return { success: false, strata_per_quote: null, error: String(e.message || e) };
  }
}

async function globalAvg(db, resource_class) {
  resource_class = normalizeResourceClass(resource_class) || resource_class;
  try {
    const row = await db.prepare('SELECT * FROM global_resource_avgs WHERE resource_class = ?').bind(resource_class).first();
    if (row) {
      return {
        quote_asset: row.quote_asset || 'EUR',
        avg_per_unit: Number(row.avg_per_unit),
        source: row.source || 'db',
        unit: (GLOBAL_RESOURCE_AVG[resource_class] || {}).unit,
        updated_at: row.updated_at,
      };
    }
  } catch (_) {}
  const g = GLOBAL_RESOURCE_AVG[resource_class];
  if (!g) return null;
  return { quote_asset: g.quote_asset, avg_per_unit: g.avg_per_unit, source: 'lab_proxy', unit: g.unit };
}


/** Measurement receipt — binds evidence hash so mint cannot use bare self-asserted units alone. */
async function ensureMeasurementSchema(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS measurement_receipts (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    evidence_hash TEXT NOT NULL,
    sources_json TEXT,
    score REAL,
    peer_confirms INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`).run();
}

async function issueMeasurementReceipt(db, node_id, onchain, peer_confirms = 0) {
  await ensureMeasurementSchema(db);
  const sources = onchain && onchain.sources ? onchain.sources : onchain;
  const material = JSON.stringify({ node_id, sources, t: Math.floor(Date.now() / 60000) });
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  const evidence_hash = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  // Score: more non-zero evidence fields + peer confirms
  let fields = 0;
  const src = sources || {};
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (v && typeof v === 'object') {
      if (Number(v.count || v.mb || v.units || 0) > 0) fields++;
    } else if (Number(v) > 0) fields++;
  }
  const score = Math.min(1, 0.15 * fields + 0.2 * Number(peer_confirms || 0) + (Number(peer_confirms || 0) >= 2 ? 0.15 : 0));
  const id = 'meas_' + crypto.randomUUID().slice(0, 12);
  await db.prepare(
    `INSERT INTO measurement_receipts (id, node_id, evidence_hash, sources_json, score, peer_confirms, created_at)
     VALUES (?,?,?,?,?,?,datetime('now'))`
  ).bind(id, node_id, evidence_hash, JSON.stringify(sources || {}), score, peer_confirms).run();
  return { id, evidence_hash, score, peer_confirms, node_id };
}

async function requireMeasurementForMint(db, node_id, body) {
  await ensureMeasurementSchema(db);
  const MIN_SCORE = 0.25;
  const mid = body.measurement_id || body.receipt_id;
  if (mid) {
    const row = await db.prepare('SELECT * FROM measurement_receipts WHERE id = ? AND node_id = ?').bind(mid, node_id).first();
    if (!row) return { ok: false, error: 'measurement_receipt_not_found' };
    if (Number(row.score) < MIN_SCORE && !body.allow_lab_low_score) {
      return { ok: false, error: 'measurement_score_too_low', score: row.score, min: MIN_SCORE };
    }
    return { ok: true, receipt: row };
  }
  const onchain = await measureOnchain(db, node_id);
  let edge_nodes = 0;
  let edge_units = 0;
  try {
    const edges = await db.prepare(
      `SELECT COUNT(DISTINCT node_id) as c, COALESCE(SUM(units),0) as u FROM mesh_pool_ledger
       WHERE kind = 'contribute' AND created_at > datetime('now','-1 day')
         AND (node_id LIKE 'EDGE-%' OR node_id LIKE 'NODE-VAL-%')`
    ).first();
    edge_nodes = Number(edges && edges.c) || 0;
    edge_units = Number(edges && edges.u) || 0;
  } catch (_) {}
  // Validator peer confirms from DAG peer_weight if same DB, else edge_nodes proxy
  let peer_confirms = edge_nodes;
  try {
    const pw = await db.prepare(
      `SELECT COUNT(DISTINCT peer_id) as c FROM peer_weight_events WHERE created_at > datetime('now','-1 day')`
    ).first();
    if (pw && Number(pw.c) > peer_confirms) peer_confirms = Number(pw.c);
  } catch (_) {}
  const receipt = await issueMeasurementReceipt(db, node_id, {
    ...onchain,
    sources: {
      ...(onchain && onchain.sources ? onchain.sources : {}),
      edge_contributors_24h: edge_nodes,
      edge_units_24h: edge_units,
      peer_confirms,
    },
  }, peer_confirms);
  // Operational gate: deny by default under min score
  if (receipt.score < MIN_SCORE && !body.allow_lab_low_score) {
    return {
      ok: false,
      error: 'insufficient_measurement_for_mint',
      policy: {
        min_score: MIN_SCORE,
        how: 'Need edge/validator contributes in last 24h and/or multi-source on-graph evidence',
        issue_receipt: 'GET /measure?node_id=... then pass measurement_id',
      },
      receipt,
    };
  }
  return { ok: true, receipt, onchain, edge_nodes, peer_confirms };
}


function priceContribution({ units, avg, quality, strata_per_quote }) {
  const global_avg_value = units * avg.avg_per_unit;
  const value_after_quality = global_avg_value * quality.factor;
  const strata = quant8(value_after_quality * strata_per_quote);
  return { global_avg_value, value_after_quality, strata };
}

function buildShares(body, node_id, quality, totalStrata, units) {
  // Explicit multi-party shares: [{node_id, units?, quality?, weight?}]
  if (Array.isArray(body.shares) && body.shares.length > 0) {
    const raw = body.shares.map((s) => {
      const q = scoreQuality({ quality: s.quality });
      const u = Number(s.units != null ? s.units : s.weight != null ? s.weight : 0);
      const weight = Math.max(0, u) * q.factor;
      return { node_id: s.node_id, units: u, quality: q, weight };
    });
    const wsum = raw.reduce((a, s) => a + s.weight, 0) || 1;
    return raw.map((s) => ({
      node_id: s.node_id,
      units: s.units,
      quality_factor: s.quality.factor,
      quality_tier: s.quality.tier,
      weight: s.weight / wsum,
      amount: quant8(totalStrata * (s.weight / wsum)),
    }));
  }
  return [
    {
      node_id,
      units,
      quality_factor: quality.factor,
      quality_tier: quality.tier,
      weight: 1,
      amount: totalStrata,
    },
  ];
}

async function credit(db, node_id, amount, meta) {
  if (!(amount > 0) || !node_id) return;
  await db
    .prepare(
      `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned)
       VALUES (?, 'STRATA', ?, ?, 0)
       ON CONFLICT(account, token_type) DO UPDATE SET
         balance = balance + excluded.balance,
         total_minted = COALESCE(token_balances.total_minted,0) + excluded.balance`
    )
    .bind(node_id, amount, amount)
    .run();
  try {
    await db
      .prepare(
        `INSERT INTO minting_events
         (node_id, contribution_type, contribution_score, amount, proof_hash, status, scarcity, contributed_after, consumed_at_mint)
         VALUES (?,?,?,?,?,'confirmed',?,?,?)`
      )
      .bind(
        node_id,
        meta.contribution_type,
        meta.units,
        amount,
        meta.proof_hash,
        meta.quality_factor,
        meta.global_avg_value,
        meta.value_after_quality
      )
      .run();
  } catch (_) {}
  try { await recordMintEmission(db, node_id, amount); } catch (_) {}
  // Mesh pool: capacity is mesh-level by class; node_id is payee of mint only
  try {
    const cls = normalizeResourceClass(meta.contribution_type) || meta.contribution_type;
    if (cls && meta.units > 0) {
      await meshContribute(db, cls, meta.units, node_id, {
        proof_hash: meta.proof_hash,
        quality_factor: meta.quality_factor,
        strata_minted: amount,
      });
      try {
        await db.prepare(`CREATE TABLE IF NOT EXISTS strata_origin_ledger (
          id TEXT PRIMARY KEY, account TEXT, amount REAL, origin TEXT, transit_eligible INTEGER, lab_only INTEGER, meta_json TEXT, created_at TEXT DEFAULT (datetime('now'))
        )`).run();
        await db.prepare(`INSERT INTO strata_origin_ledger (id, account, amount, origin, transit_eligible, lab_only, meta_json) VALUES (?,?,?,?,1,0,?)`)
          .bind('so_'+crypto.randomUUID().slice(0,12), node_id, amount, 'poc_contribution', JSON.stringify({proof_hash: meta.proof_hash})).run();
      } catch (_) {}
    }
  } catch (_) {}

}


/**
 * Mesh resource pool — universal capacity of the DLT mesh.
 * Contribution credits class capacity (who is paid = node_id).
 * Usufruct draws class capacity for beneficiary (user|sca|spa|system).
 * placement_node_id is optional physical placement — never the identity of the resource for the consumer.
 */
async function ensureMeshPool(db) {
  if (!db) return;
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS mesh_resource_pool (
        resource_class TEXT PRIMARY KEY,
        capacity_contributed REAL DEFAULT 0,
        capacity_reserved REAL DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now'))
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS mesh_pool_ledger (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        resource_class TEXT NOT NULL,
        units REAL NOT NULL,
        node_id TEXT,
        beneficiary_id TEXT,
        beneficiary_kind TEXT,
        placement_node_id TEXT,
        purpose TEXT,
        status TEXT,
        meta_json TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`
    )
    .run();
  for (const cls of Object.keys(GLOBAL_RESOURCE_AVG)) {
    try {
      await db
        .prepare(
          `INSERT OR IGNORE INTO mesh_resource_pool (resource_class, capacity_contributed, capacity_reserved, updated_at)
           VALUES (?, 0, 0, datetime('now'))`
        )
        .bind(cls)
        .run();
    } catch (_) {}
  }
}

async function meshContribute(db, resource_class, units, node_id, meta = {}) {
  await ensureMeshPool(db);
  const cls = normalizeResourceClass(resource_class) || resource_class;
  const u = Math.max(0, Number(units) || 0);
  if (!(u > 0)) return { ok: false, reason: 'zero_units' };
  await db
    .prepare(
      `INSERT INTO mesh_resource_pool (resource_class, capacity_contributed, capacity_reserved, updated_at)
       VALUES (?, ?, 0, datetime('now'))
       ON CONFLICT(resource_class) DO UPDATE SET
         capacity_contributed = capacity_contributed + excluded.capacity_contributed,
         updated_at = datetime('now')`
    )
    .bind(cls, u)
    .run();
  const id = 'mpc_' + crypto.randomUUID().slice(0, 12);
  await db
    .prepare(
      `INSERT INTO mesh_pool_ledger (id, kind, resource_class, units, node_id, status, meta_json)
       VALUES (?, 'contribute', ?, ?, ?, 'settled', ?)`
    )
    .bind(id, cls, u, node_id || null, JSON.stringify(meta || {}))
    .run();
  return { ok: true, id, resource_class: cls, units: u, node_id };
}

async function meshDraw(db, opts) {
  await ensureMeshPool(db);
  const cls = normalizeResourceClass(opts.resource_class) || opts.resource_class;
  const u = Math.max(0, Number(opts.units) || 0);
  if (!(u > 0) || !cls) return { ok: false, error: 'resource_class and units required' };
  const beneficiary_id = opts.beneficiary_id || opts.account || opts.sca_id || opts.user_id;
  const beneficiary_kind = opts.beneficiary_kind || (opts.sca_id ? 'sca' : opts.user_id ? 'user' : 'system');
  if (!beneficiary_id) return { ok: false, error: 'beneficiary_id required' };

  const row = await db.prepare('SELECT * FROM mesh_resource_pool WHERE resource_class = ?').bind(cls).first();
  const contributed = Number(row?.capacity_contributed || 0);
  const reserved = Number(row?.capacity_reserved || 0);
  const available = contributed - reserved;
  // Soft mesh: allow draw even if slightly over if pool empty in lab bootstrap — prefer hard fail when strict
  const strict = opts.strict !== false && opts.strict !== 0;
  if (strict && available < u) {
    return {
      ok: false,
      error: 'insufficient_mesh_capacity',
      resource_class: cls,
      requested: u,
      available,
      contributed,
      reserved,
      note: 'Usufruct is from mesh pool by class — not from a host node identity',
    };
  }
  await db
    .prepare(
      `INSERT INTO mesh_resource_pool (resource_class, capacity_contributed, capacity_reserved, updated_at)
       VALUES (?, 0, ?, datetime('now'))
       ON CONFLICT(resource_class) DO UPDATE SET
         capacity_reserved = capacity_reserved + excluded.capacity_reserved,
         updated_at = datetime('now')`
    )
    .bind(cls, u)
    .run();
  const id = 'mpd_' + crypto.randomUUID().slice(0, 12);
  // placement is optional physical detail only
  const placement = opts.placement_node_id || opts.placement || null;
  await db
    .prepare(
      `INSERT INTO mesh_pool_ledger (id, kind, resource_class, units, beneficiary_id, beneficiary_kind, placement_node_id, purpose, status, meta_json)
       VALUES (?, 'draw', ?, ?, ?, ?, ?, ?, 'active', ?)`
    )
    .bind(
      id,
      cls,
      u,
      beneficiary_id,
      beneficiary_kind,
      placement,
      String(opts.purpose || '').slice(0, 200),
      JSON.stringify({ abstraction: 'mesh_pool', host_not_identity: true })
    )
    .run();
  return {
    ok: true,
    draw_id: id,
    resource_class: cls,
    units: u,
    beneficiary_id,
    beneficiary_kind,
    placement_node_id: placement,
    ontology: 'Consumer draws mesh capacity by class; placement_node_id is routing only',
  };
}

async function meshRelease(db, draw_id) {
  await ensureMeshPool(db);
  const row = await db.prepare(`SELECT * FROM mesh_pool_ledger WHERE id = ? AND kind = 'draw'`).bind(draw_id).first();
  if (!row) return { ok: false, error: 'draw_not_found' };
  if (row.status === 'released') return { ok: true, already: true, draw_id };
  const u = Number(row.units) || 0;
  const cls = row.resource_class;
  await db
    .prepare(
      `UPDATE mesh_resource_pool SET capacity_reserved = MAX(0, capacity_reserved - ?), updated_at = datetime('now') WHERE resource_class = ?`
    )
    .bind(u, cls)
    .run();
  await db
    .prepare(`UPDATE mesh_pool_ledger SET status = 'released' WHERE id = ?`)
    .bind(draw_id)
    .run();
  return { ok: true, draw_id, released_units: u, resource_class: cls };
}

async function meshPoolSnapshot(db) {
  await ensureMeshPool(db);
  const rows = (await db.prepare('SELECT * FROM mesh_resource_pool ORDER BY resource_class').all()).results || [];
  return rows.map((r) => {
    const c = Number(r.capacity_contributed) || 0;
    const res = Number(r.capacity_reserved) || 0;
    return {
      resource_class: r.resource_class,
      capacity_contributed: c,
      capacity_reserved: res,
      capacity_available: c - res,
      updated_at: r.updated_at,
    };
  });
}

async function syncNetworkDemand(db) {
  const demand = { ipfs_pin: 0, validate: 0, fog_uptime: 0, gossip: 0 };
  try {
    const req = await db
      .prepare("SELECT COALESCE(SUM(size_gb),0) as gb, COUNT(*) as c FROM pin_requests WHERE status IN ('matched','filled','active','completed','pending')")
      .first();
    demand.ipfs_pin = (Number(req?.gb) || 0) * 1024 + (Number(req?.c) || 0);
  } catch (_) {}
  try {
    const n = await db.prepare('SELECT COUNT(*) as c FROM subsidy_events').first();
    demand.validate = Number(n?.c) || 0;
  } catch (_) {}
  try {
    const v = await db.prepare('SELECT COUNT(*) as c FROM dag_vertices').first();
    demand.gossip = Math.max(0, (Number(v?.c) || 0) * 0.1);
  } catch (_) {}
  for (const [cls, units] of Object.entries(demand)) {
    if (!(units > 0)) continue;
    try {
      await db
        .prepare(
          `INSERT INTO resource_meters (resource_class, contributed, consumed, updated_at) VALUES (?,0,?,datetime('now'))
           ON CONFLICT(resource_class) DO UPDATE SET consumed = excluded.consumed, updated_at = excluded.updated_at`
        )
        .bind(cls, units)
        .run();
    } catch (_) {}
  }
  return demand;
}

export default {
  async scheduled(event, env, ctx) {
    const db = env.LEDGER || env.STRATAMESH_LEDGER || env.DB;
    try {
      await ensure(db);
      const demand = await syncNetworkDemand(db);
      console.log('poc_sync_demand', JSON.stringify(demand));
    } catch (e) {
      console.log('poc_sync_error', String(e.message || e));
    }
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.startsWith('/api/v1/poc')) path = path.slice('/api/v1/poc'.length) || '/health';
    if (path.startsWith('/api/v1/')) path = path.slice('/api/v1'.length);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors() });
    const db = env.LEDGER || env.STRATAMESH_LEDGER || env.DB;

    try {
      await ensure(db);

      if (path === '/health' || path === '/status' || path === '/' || path === '') {
        return j({
          status: 'healthy',
          service: 'stratamesh-poc',
          version: '5.9.0-measurement-gate',
          sole_mint_path: true,
          resource_vs_function: 'Price by resource class only; function/purpose never defines rate; quality is the only intra-resource premium/discount',
          resource_classes: Object.keys(GLOBAL_RESOURCE_AVG),
          process: ['measure_onchain', 'value_global_avg', 'quality_premium_discount_within_resource', 'agora_fx', 'allocate', 'settle', 'dag_anchor', 'mesh_pool'],
          mesh_pool: 'contribute capacity by class; draw usufruct by beneficiary; placement_node optional routing only',
        });
      }

      if (path === '/emission-policy' || path === '/process') {
        return j({
          sole_mint_path: true,
          resource_vs_function: 'Price by resource class only; function/purpose never defines rate; quality is the only intra-resource premium/discount',
          resource_classes: Object.keys(GLOBAL_RESOURCE_AVG),
          process: {
            measure: 'units + proof for a DLT resource class',
            value: 'units × global market average (exogenous resource markets)',
            quality: 'premium/discount vs par=1 from explicit quality or proof dimensions',
            fx: '× Agora strata_per_quote (open-book VWAP)',
            allocate: 'proportional to quality-weighted shares',
            settle: 'token_balances + minting_events (+ optional epoch)',
          },
          quality_bounds: QUALITY_BOUNDS,
          formula: 'STRATA_i = (units × global_avg × Q_i) × agora_rate × (w_i / Σw)',
        });
      }

      if (path === '/global-avg' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const resource_class = body.resource_class || body.type;
        const avg_per_unit = Number(body.avg_per_unit);
        const quote_asset = (body.quote_asset || 'EUR').toUpperCase();
        if (!resource_class || !(avg_per_unit > 0)) return j({ error: 'resource_class and avg_per_unit > 0' }, 400);
        if (!GLOBAL_RESOURCE_AVG[resource_class]) {
          return j({ error: 'unknown resource_class', known: Object.keys(GLOBAL_RESOURCE_AVG) }, 400);
        }
        await db
          .prepare(
            `INSERT INTO global_resource_avgs (resource_class, quote_asset, avg_per_unit, source, updated_at)
             VALUES (?,?,?,?, datetime('now'))
             ON CONFLICT(resource_class) DO UPDATE SET
               quote_asset=excluded.quote_asset, avg_per_unit=excluded.avg_per_unit,
               source=excluded.source, updated_at=excluded.updated_at`
          )
          .bind(resource_class, quote_asset, avg_per_unit, body.source || 'feed')
          .run();
        return j({
          success: true,
          resource_class,
          avg_per_unit,
          quote_asset,
          source: body.source || 'feed',
          note: 'Updated exogenous global resource average — not a protocol mint rate',
        });
      }

      if (path === '/global-avg' || path === '/global-avgs') {
        const rows = await db.prepare('SELECT * FROM global_resource_avgs').all();
        return j({ success: true, averages: rows.results || [] });
      }

      if (path === '/market') {
        const quote = url.searchParams.get('quote') || 'EUR';
        const rate = await agoraRate(env, quote);
        const avgs = await db.prepare('SELECT * FROM global_resource_avgs').all();
        return j({
          success: true,
          agora_rate: rate,
          global_resource_averages: avgs.results || [],
          process: 'global_avg → quality → agora_fx → allocate',
        });
      }

      // Preview pricing without settling
      if (path === '/quote' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const contribution_type = normalizeResourceClass(body.contribution_type || body.resource_class || body.resource);
        const units = Number(body.contribution_points || body.units || 0);
        const quality = scoreQuality(body);
        if (!contribution_type || !(units > 0)) return j({ error: 'contribution_type and units required' }, 400);
        const avg = await globalAvg(db, contribution_type);
        if (!avg) return j({ error: 'unknown resource' }, 400);
        const quote_asset = (body.quote_asset || avg.quote_asset || 'EUR').toUpperCase();
        const rate = await agoraRate(env, quote_asset);
        if (!(rate.strata_per_quote > 0)) {
          return j({ success: false, error: 'agora_rate_unavailable', agora: rate }, 503);
        }
        const priced = priceContribution({
          units,
          avg,
          quality,
          strata_per_quote: Number(rate.strata_per_quote),
        });
        return j({
          success: true,
          preview: true,
          contribution_type,
          units,
          quality,
          pricing: {
            global_avg_value: { asset: quote_asset, value: priced.global_avg_value },
            after_quality: { asset: quote_asset, value: priced.value_after_quality },
            strata: priced.strata,
            agora: { strata_per_quote: rate.strata_per_quote, quote_per_strata: rate.quote_per_strata },
          },
        });
      }


      // On-chain / on-graph measurement for a node
      if (path === '/onchain' || path === '/measure') {
        const node_id = url.searchParams.get('node_id') || url.searchParams.get('account');
        if (!node_id) return j({ error: 'node_id required' }, 400);
        const m = await measureOnchain(db, node_id);
        return j({
          success: true,
          measurement: m,
          note: 'Units derived from DAG subsidy_events, dag_vertices, ipfs_pins, spa_pins; demand from pin_requests',
        });
      }

      // Sync mesh demand into analytics meters (does not set mint rate)
      if (path === '/sync' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const demand = await syncNetworkDemand(db);
        let measurement = null;
        if (body.node_id) {
          measurement = await measureOnchain(db, body.node_id);
        }
        return j({ success: true, meters_synced: demand, measurement, triggered: 'manual' });
      }

      if (path === '/mint' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const _measGate = await requireMeasurementForMint(db, body.node_id || 'FOG-NODE-PT-CM-001', body);
        if (!_measGate.ok) {
          return j({ success: false, ..._measGate, version: '5.9.0-measurement-gate' }, 403);
        }
        body._measurement_receipt = _measGate.receipt;

        // Anti-fragility: adversarial subjects do not receive STRATA (resources already absorbed by mesh)
        try {
          const gate = env.GATE;
          const ginit = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject: body.node_id, node_id: body.node_id }),
          };
          let gresp;
          if (gate && typeof gate.fetch === 'function') {
            gresp = await gate.fetch(new Request('https://binding.internal/check-mint', ginit));
          } else {
            gresp = await fetch('https://stratamesh-gate.stratamesh.workers.dev/check-mint', ginit);
          }
          const gj = await gresp.json().catch(() => ({}));
          if (gj && gj.eligible === false) {
            return j({
              success: false,
              error: 'antifragile_no_mint',
              policy: gj.policy || 'Adversarial subject: mesh absorbed attack resources; STRATA withheld',
              gate: gj,
              version: '5.10.0-antifragile',
            }, 403);
          }
        } catch (_) {}
        const node_id = body.node_id;
        let contribution_type = normalizeResourceClass(body.contribution_type || body.resource_class || body.resource);
        let units = Number(body.contribution_points || body.units || 0);
        let onchain = null;
        const proof_hash = body.proof_hash || body.proof || null;

        // Integrate on-graph data: derive units from DAG/IPFS/SPA when requested
        if (body.from_onchain || body.onchain) {
          if (!node_id) return j({ error: 'node_id required for on-chain mint' }, 400);
          onchain = await measureOnchain(db, node_id);
          if (!contribution_type) {
            // pick class with max measured units
            const classes = ['storage', 'compute', 'availability', 'bandwidth'];
            contribution_type = classes.sort((a, b) => (onchain[b] || 0) - (onchain[a] || 0))[0];
          }
          if (!(units > 0)) {
            units = Number(onchain[contribution_type]) || 0;
          }
          if (!(units > 0)) {
            return j({
              success: false,
              error: 'no_onchain_contribution',
              measurement: onchain,
              message: 'No measurable DAG/IPFS/SPA contribution for this node and class',
            }, 400);
          }
        }

        if (!node_id || !contribution_type || !(units > 0)) {
          return j({ error: 'node_id, contribution_type, contribution_points > 0 required (or from_onchain:true)' }, 400);
        }
        let quality;
        let quality_audit = null;
        if (onchain && body.audit_quality !== false && body.quality == null) {
          quality = auditQualityFromMeasurement(onchain);
          quality_audit = { method: 'onchain_audit', components: quality.components };
        } else {
          quality = scoreQuality(body);
        }
        // Market-aligned billable units from on-chain evidence
        if (onchain) {
          const billed = billableUnits(contribution_type, onchain);
          if (billed > 0) units = billed;
        }
        // Incremental only: subtract units already rewarded for this node+class (anti double-claim)
        let baseline = 0;
        try {
          const keys = [contribution_type];
          for (const [alias, canon] of Object.entries(RESOURCE_ALIASES)) {
            if (canon === contribution_type) keys.push(alias);
          }
          for (const k of keys) {
            const prev = await db
              .prepare('SELECT units_rewarded as s FROM poc_rewarded_units WHERE node_id = ? AND contribution_type = ?')
              .bind(node_id, k)
              .first();
            baseline = Math.max(baseline, Number(prev?.s) || 0);
          }
        } catch (_) {}
        const gross_units = units;
        const delta = Math.max(0, gross_units - baseline);
        units = delta;
        if (!(units > 0)) {
          return j({
            success: true,
            amount_minted_total: 0,
            incremental: true,
            version: '5.9.0-measurement-gate',
            gross_units,
            baseline_already_rewarded: baseline,
            message: 'No new on-chain contribution since last confirmed PoC for this class',
            onchain_measurement: onchain,
          });
        }

        if (!GLOBAL_RESOURCE_AVG[contribution_type]) {
          return j({ error: 'unknown resource_class', known: Object.keys(GLOBAL_RESOURCE_AVG), aliases: RESOURCE_ALIASES, note: 'Price by resource (storage/compute/bandwidth/availability), never by function' }, 400);
        }

        const avg = await globalAvg(db, contribution_type);
        const quote_asset = (body.quote_asset || avg.quote_asset || 'EUR').toUpperCase();
        const rate = await agoraRate(env, quote_asset);
        const strata_per_quote = rate && rate.strata_per_quote != null ? Number(rate.strata_per_quote) : null;
        if (strata_per_quote == null || !(strata_per_quote > 0)) {
          return j(
            {
              success: false,
              error: 'agora_rate_unavailable',
              step_failed: 'fx',
              message: 'Agora book required to express global resource value in STRATA',
              agora: rate,
            },
            503
          );
        }

        const priced = priceContribution({ units, avg, quality, strata_per_quote });
        const shares = buildShares(body, node_id, quality, priced.strata, units);

        try {
          await db
            .prepare(
              `INSERT INTO poc_rewarded_units (node_id, contribution_type, units_rewarded, updated_at)
               VALUES (?,?,?,datetime('now'))
               ON CONFLICT(node_id, contribution_type) DO UPDATE SET
                 units_rewarded = excluded.units_rewarded,
                 updated_at = excluded.updated_at`
            )
            .bind(node_id, contribution_type, gross_units)
            .run();
        } catch (_) {}

        for (const s of shares) {
          await credit(db, s.node_id, s.amount, {
            contribution_type,
            units: s.units,
            proof_hash,
            quality_factor: s.quality_factor,
            global_avg_value: priced.global_avg_value,
            value_after_quality: priced.value_after_quality,
          });
        }

        try {
          await db
            .prepare(
              `INSERT INTO resource_meters (resource_class, contributed, consumed, updated_at) VALUES (?,?,0,datetime('now'))
               ON CONFLICT(resource_class) DO UPDATE SET contributed = contributed + excluded.contributed, updated_at = excluded.updated_at`
            )
            .bind(contribution_type, units)
            .run();
        } catch (_) {}

        // Optional epoch registration (batch accounting)
        let epoch_id = body.epoch_id || null;
        if (body.open_epoch || epoch_id) {
          epoch_id = epoch_id || 'EP-' + crypto.randomUUID().slice(0, 10);
          try {
            await db
              .prepare(
                `INSERT OR IGNORE INTO poc_epochs (epoch_id, resource_class, status, total_units, total_strata, agora_strata_per_quote, quote_asset, created_at)
                 VALUES (?,?, 'open', 0, 0, ?, ?, datetime('now'))`
              )
              .bind(epoch_id, contribution_type, strata_per_quote, quote_asset)
              .run();
            await db
              .prepare(
                `UPDATE poc_epochs SET total_units = total_units + ?, total_strata = total_strata + ? WHERE epoch_id = ?`
              )
              .bind(units, priced.strata, epoch_id)
              .run();
            for (const s of shares) {
              await db
                .prepare(
                  `INSERT INTO poc_epoch_shares (epoch_id, node_id, units, quality_factor, weight, amount)
                   VALUES (?,?,?,?,?,?)
                   ON CONFLICT(epoch_id, node_id) DO UPDATE SET
                     units = units + excluded.units,
                     amount = amount + excluded.amount,
                     weight = excluded.weight,
                     quality_factor = excluded.quality_factor`
                )
                .bind(epoch_id, s.node_id, s.units, s.quality_factor, s.weight, s.amount)
                .run();
            }
          } catch (_) {}
        }


        let graph = null;
        if (body.anchor !== false) {
          graph = await dagAnchorMint(env, {
            node_id,
            contribution_type,
            units,
            amount_minted_total: priced.strata,
            attributions: shares,
            quality: quality.factor,
            agora_strata_per_quote: strata_per_quote,
            proof_hash,
            onchain: onchain ? { sources: onchain.sources, total_units: onchain.total_units } : null,
          });
        }

        return j({
          success: true,
          amount_minted_total: priced.strata,
          attributions: shares,
          epoch_id,
          onchain_measurement: onchain,
          graph_settlement: graph,
          message:
            'Settled: global resource average × quality premium/discount × Agora rate; attributed proportionally.',
        });
      }

      if (path === '/epoch/close' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const epoch_id = body.epoch_id;
        if (!epoch_id) return j({ error: 'epoch_id required' }, 400);
        await db
          .prepare(`UPDATE poc_epochs SET status = 'closed', closed_at = datetime('now') WHERE epoch_id = ?`)
          .bind(epoch_id)
          .run();
        const ep = await db.prepare('SELECT * FROM poc_epochs WHERE epoch_id = ?').bind(epoch_id).first();
        const shares = await db.prepare('SELECT * FROM poc_epoch_shares WHERE epoch_id = ?').bind(epoch_id).all();
        return j({ success: true, epoch: ep, shares: shares.results || [] });
      }

      if (path === '/epoch') {
        const epoch_id = url.searchParams.get('id');
        if (epoch_id) {
          const ep = await db.prepare('SELECT * FROM poc_epochs WHERE epoch_id = ?').bind(epoch_id).first();
          const shares = await db.prepare('SELECT * FROM poc_epoch_shares WHERE epoch_id = ?').bind(epoch_id).all();
          return j({ success: true, epoch: ep, shares: shares.results || [] });
        }
        const rows = await db.prepare('SELECT * FROM poc_epochs ORDER BY created_at DESC LIMIT 20').all();
        return j({ success: true, epochs: rows.results || [] });
      }

      if (path === '/balance') {
        const node_id = url.searchParams.get('node_id') || url.searchParams.get('account');
        if (!node_id) return j({ error: 'node_id required' }, 400);
        const row = await db
          .prepare("SELECT * FROM token_balances WHERE account = ? AND token_type IN ('STRATA','strata')")
          .bind(node_id)
          .first();
        return j({ success: true, account: node_id, balance: row ? Number(row.balance) : 0 });
      }

      if (path === '/contribution-types') {
        const rate = await agoraRate(env, 'EUR');
        const types = [];
        for (const name of Object.keys(GLOBAL_RESOURCE_AVG)) {
          const avg = await globalAvg(db, name);
          types.push({
            name,
            unit: avg?.unit,
            global_avg_per_unit: avg?.avg_per_unit,
            quote_asset: avg?.quote_asset,
            global_avg_source: avg?.source,
            fixed_protocol_rate: null,
            agora_strata_per_quote: rate.strata_per_quote,
            quality: 'premium >1 / discount <1 / par =1',
          });
        }
        return j({ contribution_types: types });
      }


      if ((path === '/pool' || path === '/mesh/pool') && request.method === 'GET') {
        await ensure(db);
        const pool = await meshPoolSnapshot(db);
        let recent = [];
        try {
          recent = (await db.prepare('SELECT * FROM mesh_pool_ledger ORDER BY created_at DESC LIMIT 40').all()).results || [];
        } catch (_) {}
        return j({
          success: true,
          pool,
          recent,
          ontology: {
            contribute: 'Nodes add capacity to mesh by resource class and receive STRATA',
            draw: 'Users/SCAs/system draw capacity from mesh by class (usufruct)',
            placement: 'placement_node_id is optional routing — not resource identity for consumer',
            resource_not_function: true,
          },
          version: '5.9.0-measurement-gate',
        });
      }

      if ((path === '/pool/contribute' || path === '/mesh/pool/contribute') && request.method === 'POST') {
        await ensure(db);
        const body = await request.json().catch(() => ({}));
        const r = await meshContribute(db, body.resource_class || body.class, body.units, body.node_id, body.meta || {});
        return j({ ...r, version: '5.9.0-measurement-gate' }, r.ok ? 200 : 400);
      }

      if ((path === '/pool/draw' || path === '/mesh/pool/draw') && request.method === 'POST') {
        await ensure(db);
        const body = await request.json().catch(() => ({}));
        const r = await meshDraw(db, body);
        let strata_burn = null;
        if (r.ok && (body.pay_strata || body.strata_cost || body.burn_strata)) {
          const cost = Number(body.strata_cost || body.pay_strata || body.burn_strata || 0);
          const payer = body.beneficiary_id || body.account || body.payer;
          if (cost > 0 && payer) {
            strata_burn = await burnStrataToSink(db, payer, cost, 'mesh_pool_draw', {
              resource_class: body.resource_class || r.resource_class,
              draw_id: r.draw_id || r.id,
            });
          }
        }
        const code = r.ok ? 200 : r.error === 'insufficient_mesh_capacity' ? 409 : 400;
        return j({ ...r, strata_burn, version: '5.9.0-mint-burn' }, code);
      }

      if ((path === '/pool/release' || path === '/mesh/pool/release') && request.method === 'POST') {
        await ensure(db);
        const body = await request.json().catch(() => ({}));
        const r = await meshRelease(db, body.draw_id || body.id);
        return j({ ...r, version: '5.9.0-measurement-gate' }, r.ok ? 200 : 404);
      }

      if (path === '/history') {
        const node_id = url.searchParams.get('node_id');
        const events = node_id
          ? await db.prepare('SELECT * FROM minting_events WHERE node_id = ? ORDER BY id DESC LIMIT 50').bind(node_id).all()
          : await db.prepare('SELECT * FROM minting_events ORDER BY id DESC LIMIT 50').all();
        return j({ events: events.results || [] });
      }

      return j(
        {
          error: 'Not found',
          endpoints: [
            '/health',
            '/process',
            '/onchain',
            '/measure',
            '/sync',
            '/quote',
            '/mint',
            '/market',
            '/global-avg',
            '/epoch',
            '/epoch/close',
            '/contribution-types',
            '/balance',
            '/history',
            '/pool',
            '/pool/contribute',
            '/pool/draw',
            '/pool/release',
          ],
        },
        404
      );
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
