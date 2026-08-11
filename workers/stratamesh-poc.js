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

export default {
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
          version: '5.2.0-process-refined',
          sole_mint_path: true,
          process: ['measure', 'value_global_avg', 'quality_premium_discount', 'agora_fx', 'allocate', 'settle'],
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

      if (path === '/mint' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const node_id = body.node_id;
        const contribution_type = body.contribution_type || body.resource_class;
        const units = Number(body.contribution_points || body.units || 0);
        const proof_hash = body.proof_hash || body.proof || null;
        const quality = scoreQuality(body);
        if (!node_id || !contribution_type || !(units > 0)) {
          return j({ error: 'node_id, contribution_type, contribution_points > 0 required' }, 400);
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

        return j({
          success: true,
          amount_minted_total: priced.strata,
          attributions: shares,
          epoch_id,
          process: {
            measure: { contribution_type, units, proof_hash },
            value: {
              global_average: {
                resource_class: contribution_type,
                avg_per_unit: avg.avg_per_unit,
                source: avg.source,
                unit: avg.unit,
              },
              global_avg_value: { asset: quote_asset, value: priced.global_avg_value },
            },
            quality: {
              factor: quality.factor,
              tier: quality.tier,
              method: quality.method,
              components: quality.components,
            },
            fx: {
              agora: {
                strata_per_quote,
                quote_per_strata: rate.quote_per_strata,
                liquidity_strata: rate.liquidity_strata,
                source: rate.source || 'agora_open_book_vwap',
              },
              value_after_quality: { asset: quote_asset, value: priced.value_after_quality },
            },
            allocate: 'quality-weighted proportional shares',
            settle: 'balances credited',
          },
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
