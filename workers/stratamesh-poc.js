/**
 * PoC mint (whitepaper-aligned pricing):
 *
 * 1) Global market average value of the resource class being contributed to the DLT
 * 2) Convert that external value → STRATA at the Agora P2P market rate
 * 3) Attribute mint with variable quality premium / discount (par = 1.0)
 *
 * Protocol does not set STRATA emission rates — Agora discovers STRATA↔external;
 * global resource averages are exogenous market inputs.
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
 * Lab stand-ins for "average of global markets" per resource class (quote = EUR).
 * Replace with live aggregated feeds; not a protocol emission schedule.
 */
const GLOBAL_RESOURCE_AVG = {
  ipfs_pin: {
    quote_asset: 'EUR',
    avg_per_unit: 0.00002,
    unit: 'MB-month storage capacity equivalent',
    markets_note: 'lab proxy for global storage/CDN capacity averages',
  },
  validate: {
    quote_asset: 'EUR',
    avg_per_unit: 0.00001,
    unit: 'DAG validation work unit',
    markets_note: 'lab proxy for compute/validation market averages',
  },
  gossip: {
    quote_asset: 'EUR',
    avg_per_unit: 0.000005,
    unit: 'propagation bandwidth unit',
    markets_note: 'lab proxy for bandwidth market averages',
  },
  fog_uptime: {
    quote_asset: 'EUR',
    avg_per_unit: 0.0001,
    unit: 'fog always-on capacity slice',
    markets_note: 'lab proxy for always-on edge/fog hosting averages',
  },
  starter_task: {
    quote_asset: 'EUR',
    avg_per_unit: 0.000001,
    unit: 'onboarding micro-contribution',
    markets_note: 'lab proxy — negligible external resource value',
  },
};

/** quality: 1.0 = par; >1 premium; <1 discount. Soft bounds. */
function qualityFactor(q) {
  const n = Number(q);
  if (!Number.isFinite(n)) return { factor: 1, tier: 'par' };
  const factor = Math.min(2.5, Math.max(0.1, n));
  let tier = 'par';
  if (factor > 1.05) tier = 'premium';
  else if (factor < 0.95) tier = 'discount';
  return { factor, tier };
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
    const row = await db
      .prepare('SELECT * FROM global_resource_avgs WHERE resource_class = ?')
      .bind(resource_class)
      .first();
    if (row) {
      return {
        quote_asset: row.quote_asset || 'EUR',
        avg_per_unit: Number(row.avg_per_unit),
        source: row.source || 'db',
        unit: (GLOBAL_RESOURCE_AVG[resource_class] || {}).unit,
      };
    }
  } catch (_) {}
  const g = GLOBAL_RESOURCE_AVG[resource_class];
  if (!g) return null;
  return { quote_asset: g.quote_asset, avg_per_unit: g.avg_per_unit, source: 'lab_proxy', unit: g.unit };
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
          version: '5.1.0-global-avg-agora-quality',
          sole_mint_path: true,
          policy: {
            step1: 'Global market average value of the contributed resource',
            step2: 'Convert to STRATA at Agora market rate',
            step3: 'Attribute with quality premium or discount (variable)',
            not: ['protocol-fixed mint rate', 'admin rate-setter'],
          },
        });
      }

      if (path === '/emission-policy') {
        return j({
          sole_mint_path: true,
          steps: [
            'global_avg_value = units × global_market_average_per_unit(resource_class)',
            'external_after_quality = global_avg_value × quality_factor  (premium if >1, discount if <1)',
            'STRATA = external_after_quality × agora.strata_per_quote',
          ],
          proportional: 'Mint attributed to the contributing node proportional to its quality-adjusted share of that contribution event',
          rate_source: 'Agora open-book VWAP only',
          global_avg_source: 'Aggregated external resource markets (lab proxies until live feeds)',
        });
      }

      // Update global average from feed (operator/oracle) — still not a mint rate
      if (path === '/global-avg' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const resource_class = body.resource_class || body.type;
        const avg_per_unit = Number(body.avg_per_unit);
        const quote_asset = (body.quote_asset || 'EUR').toUpperCase();
        if (!resource_class || !(avg_per_unit > 0)) {
          return j({ error: 'resource_class and avg_per_unit > 0 required' }, 400);
        }
        if (!GLOBAL_RESOURCE_AVG[resource_class]) {
          return j({ error: 'unknown resource_class', known: Object.keys(GLOBAL_RESOURCE_AVG) }, 400);
        }
        await db
          .prepare(
            `INSERT INTO global_resource_avgs (resource_class, quote_asset, avg_per_unit, source, updated_at)
             VALUES (?,?,?,?, datetime('now'))
             ON CONFLICT(resource_class) DO UPDATE SET
               quote_asset = excluded.quote_asset,
               avg_per_unit = excluded.avg_per_unit,
               source = excluded.source,
               updated_at = excluded.updated_at`
          )
          .bind(resource_class, quote_asset, avg_per_unit, body.source || 'feed')
          .run();
        return j({
          success: true,
          resource_class,
          avg_per_unit,
          quote_asset,
          note: 'Global resource market average updated — mint still uses Agora for STRATA conversion',
        });
      }

      if (path === '/global-avg' || path === '/global-avgs') {
        const rows = await db.prepare('SELECT * FROM global_resource_avgs').all();
        return j({
          success: true,
          averages: rows.results || [],
          note: 'Averages of global markets for resources contributed to the DLT (exogenous)',
        });
      }

      if (path === '/market') {
        const quote = url.searchParams.get('quote') || 'EUR';
        const rate = await agoraRate(env, quote);
        const avgs = await db.prepare('SELECT * FROM global_resource_avgs').all();
        return j({
          success: true,
          agora_rate: rate,
          global_resource_averages: avgs.results || [],
          pricing_chain: 'global_avg → quality premium/discount → Agora STRATA rate',
        });
      }

      if (path === '/mint' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const node_id = body.node_id;
        const contribution_type = body.contribution_type || body.resource_class;
        const units = Number(body.contribution_points || body.units || 0);
        const q = qualityFactor(body.quality);
        const proof_hash = body.proof_hash || null;
        if (!node_id || !contribution_type || !(units > 0)) {
          return j({ error: 'node_id, contribution_type, contribution_points > 0 required' }, 400);
        }

        const avg = await globalAvg(db, contribution_type);
        if (!avg || !(avg.avg_per_unit > 0)) {
          return j({ error: 'no global market average for resource_class', contribution_type }, 400);
        }
        const quote_asset = (body.quote_asset || avg.quote_asset || 'EUR').toUpperCase();

        // Step 1: global average value of contributed resource
        const global_avg_value = units * avg.avg_per_unit;
        // Step 2: quality premium / discount
        const value_after_quality = global_avg_value * q.factor;
        // Step 3: Agora rate → STRATA
        const rate = await agoraRate(env, quote_asset);
        const strata_per_quote =
          rate && rate.strata_per_quote != null ? Number(rate.strata_per_quote) : null;
        if (strata_per_quote == null || !(strata_per_quote > 0)) {
          return j(
            {
              success: false,
              error: 'agora_rate_unavailable',
              message: 'Need Agora book to express external resource value in STRATA',
              global_avg_value: { asset: quote_asset, value: global_avg_value },
              quality: q,
              agora: rate,
            },
            503
          );
        }

        let amount = value_after_quality * strata_per_quote;
        if (!Number.isFinite(amount) || amount < 0) amount = 0;
        amount = Math.floor(amount * 1e8) / 1e8;

        // Proportional attribution: single contributor event → 100% to node_id;
        // multi-share optional via body.shares [{node_id, weight}]
        let attributions = [{ node_id, weight: 1, amount }];
        if (Array.isArray(body.shares) && body.shares.length > 0) {
          const weights = body.shares.map((s) => ({
            node_id: s.node_id,
            weight: Math.max(0, Number(s.weight) || 0) * clampQualityShare(s.quality),
          }));
          const wsum = weights.reduce((a, s) => a + s.weight, 0) || 1;
          attributions = weights.map((s) => ({
            node_id: s.node_id,
            weight: s.weight / wsum,
            amount: Math.floor(amount * (s.weight / wsum) * 1e8) / 1e8,
          }));
        }

        function clampQualityShare(qq) {
          const n = Number(qq);
          if (!Number.isFinite(n)) return 1;
          return Math.min(2.5, Math.max(0.1, n));
        }

        for (const a of attributions) {
          if (a.amount <= 0 || !a.node_id) continue;
          await db
            .prepare(
              `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned)
               VALUES (?, 'STRATA', ?, ?, 0)
               ON CONFLICT(account, token_type) DO UPDATE SET
                 balance = balance + excluded.balance,
                 total_minted = COALESCE(token_balances.total_minted,0) + excluded.balance`
            )
            .bind(a.node_id, a.amount, a.amount)
            .run();
          try {
            await db
              .prepare(
                `INSERT INTO minting_events
                 (node_id, contribution_type, contribution_score, amount, proof_hash, status, scarcity, contributed_after, consumed_at_mint)
                 VALUES (?,?,?,?,?,'confirmed',?,?,?)`
              )
              .bind(
                a.node_id,
                contribution_type,
                units * a.weight,
                a.amount,
                proof_hash,
                q.factor,
                global_avg_value,
                value_after_quality
              )
              .run();
          } catch (_) {}
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

        return j({
          success: true,
          amount_minted_total: amount,
          attributions,
          contribution_type,
          units,
          pricing: {
            chain: [
              'global_market_average × units',
              '× quality premium/discount',
              '× Agora strata_per_quote',
            ],
            global_average: {
              resource_class: contribution_type,
              avg_per_unit: avg.avg_per_unit,
              quote_asset,
              source: avg.source,
              unit: avg.unit,
              value: global_avg_value,
            },
            quality: { factor: q.factor, tier: q.tier, input: body.quality != null ? body.quality : 1 },
            value_after_quality: { asset: quote_asset, value: value_after_quality },
            agora: {
              strata_per_quote,
              quote_per_strata: rate.quote_per_strata,
              liquidity_strata: rate.liquidity_strata,
              source: rate.source || 'agora_open_book_vwap',
            },
          },
          message:
            'Minted STRATA = global avg resource value × quality premium/discount, converted at Agora market rate. Attributed proportionally to contributor(s).',
        });
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
            quality: 'premium if >1, discount if <1, par at 1',
          });
        }
        return j({ contribution_types: types, pricing: 'global_avg_x_quality_x_agora' });
      }

      if (path === '/history') {
        const node_id = url.searchParams.get('node_id');
        const events = node_id
          ? await db.prepare('SELECT * FROM minting_events WHERE node_id = ? ORDER BY id DESC LIMIT 50').bind(node_id).all()
          : await db.prepare('SELECT * FROM minting_events ORDER BY id DESC LIMIT 50').all();
        return j({ events: events.results || [] });
      }

      if (path === '/consume' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const resource_class = body.resource_class || body.type;
        const units = Number(body.units || 0);
        if (!resource_class || !(units > 0)) return j({ error: 'resource_class and units > 0' }, 400);
        await db
          .prepare(
            `INSERT INTO resource_meters (resource_class, contributed, consumed, updated_at) VALUES (?,0,?,datetime('now'))
             ON CONFLICT(resource_class) DO UPDATE SET consumed = consumed + excluded.consumed, updated_at = excluded.updated_at`
          )
          .bind(resource_class, units)
          .run();
        return j({ success: true, resource_class, consumed_added: units, note: 'analytics meter only' });
      }

      return j(
        {
          error: 'Not found',
          endpoints: [
            '/health',
            '/mint',
            '/market',
            '/global-avg',
            '/contribution-types',
            '/balance',
            '/history',
            '/emission-policy',
          ],
        },
        404
      );
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
