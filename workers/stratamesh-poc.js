/**
 * PoC refined process pipeline
 *
 * MECHANISM
 * ---------
 * 1. MEASURE  — contribution units + proof metadata for a resource class on the DLT
 * 2. VALUE    — units × global market average for that resource (exogenous)
 * 3. QUALITY  — premium / discount from scored quality (par = 1)
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

const GLOBAL_RESOURCE_AVG = {
  ipfs_pin: { quote_asset: 'EUR', avg_per_unit: 0.00002, unit: 'MB-month storage capacity equivalent' },
  validate: { quote_asset: 'EUR', avg_per_unit: 0.00001, unit: 'DAG validation work unit' },
  gossip: { quote_asset: 'EUR', avg_per_unit: 0.000005, unit: 'propagation bandwidth unit' },
  fog_uptime: { quote_asset: 'EUR', avg_per_unit: 0.0001, unit: 'fog always-on capacity slice' },
  starter_task: { quote_asset: 'EUR', avg_per_unit: 0.000001, unit: 'onboarding micro-contribution' },
};

const QUALITY_BOUNDS = { min: 0.1, max: 2.5, par: 1.0 };

/** Composite quality from explicit factor and/or proof dimensions */
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
    validate: 0,
    fog_uptime: 0,
    ipfs_pin: 0,
    gossip: 0,
    sources: {},
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
        out.sources.validate_subsidy = (out.sources.validate_subsidy || 0) + c;
      } else {
        out.fog_uptime += c;
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
      out.sources.spa_pins = c;
    }
  } catch (_) {
    try {
      const spa = await db.prepare('SELECT COUNT(*) as c FROM spa_pins').first();
      // network-wide not attributed — skip
    } catch (__) {}
  }
  // Mesh demand (consumption) from pin_requests matched
  let demand = { ipfs_pin: 0, validate: 0 };
  try {
    const req = await db
      .prepare("SELECT COALESCE(SUM(size_gb),0) as gb, COUNT(*) as c FROM pin_requests WHERE status IN ('matched','filled','active','completed')")
      .first();
    demand.ipfs_pin = (Number(req?.gb) || 0) * 1024 + (Number(req?.c) || 0); // MB-ish + count
  } catch (_) {}
  try {
    const n = await db.prepare('SELECT COUNT(*) as c FROM subsidy_events').first();
    demand.validate = Number(n?.c) || 0;
  } catch (_) {}
  out.demand = demand;
  out.total_units =
    out.validate + out.fog_uptime + out.ipfs_pin + out.gossip;
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

      if (path === '/health' || path === '/' || path === '') {
        return j({
          status: 'healthy',
          service: 'stratamesh-poc',
          version: '5.4.0-onchain-cron',
          sole_mint_path: true,
          process: ['measure_onchain', 'value_global_avg', 'quality_premium_discount', 'agora_fx', 'allocate', 'settle', 'dag_anchor'],
        });
      }

      if (path === '/emission-policy' || path === '/process') {
        return j({
          sole_mint_path: true,
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
        const contribution_type = body.contribution_type || body.resource_class;
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
        const node_id = body.node_id;
        let contribution_type = body.contribution_type || body.resource_class;
        let units = Number(body.contribution_points || body.units || 0);
        let onchain = null;
        const proof_hash = body.proof_hash || body.proof || null;
        const quality = scoreQuality(body);

        // Integrate on-graph data: derive units from DAG/IPFS/SPA when requested
        if (body.from_onchain || body.onchain) {
          if (!node_id) return j({ error: 'node_id required for on-chain mint' }, 400);
          onchain = await measureOnchain(db, node_id);
          if (!contribution_type) {
            // pick class with max measured units
            const classes = ['ipfs_pin', 'validate', 'fog_uptime', 'gossip'];
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
        if (!GLOBAL_RESOURCE_AVG[contribution_type]) {
          return j({ error: 'unknown contribution_type', known: Object.keys(GLOBAL_RESOURCE_AVG) }, 400);
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
          ],
        },
        404
      );
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
