/**
 * PoC mint priced via Agora:
 *   external value of contributed resources (global market) × quality
 *   → STRATA using Agora P2P rate (STRATA per quote asset)
 *
 * Protocol does not set a mint rate. Agora book discovers STRATA↔external.
 * Resource external unit values are inputs from global resource markets (lab refs),
 * quality is proof-derived; final STRATA = f(external, quality, agora_rate).
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

/** Lab references for global resource spot — NOT protocol emission rates */
const EXTERNAL_RESOURCE_EUR = {
  ipfs_pin: { eur_per_unit: 0.00002, unit: 'MB-month-equivalent lab proxy' },
  validate: { eur_per_unit: 0.00001, unit: 'validation-work unit lab proxy' },
  gossip: { eur_per_unit: 0.000005, unit: 'propagation unit lab proxy' },
  fog_uptime: { eur_per_unit: 0.0001, unit: 'uptime slice lab proxy' },
  starter_task: { eur_per_unit: 0.000001, unit: 'onboarding micro unit' },
};

const RESOURCE_CLASSES = Object.fromEntries(
  Object.entries(EXTERNAL_RESOURCE_EUR).map(([k, v]) => [k, v.unit])
);

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
      `CREATE TABLE IF NOT EXISTS proof_chain (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        previous_hash TEXT, current_hash TEXT, action TEXT, actor TEXT,
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
  for (const k of Object.keys(RESOURCE_CLASSES)) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO resource_meters (resource_class, contributed, consumed, updated_at) VALUES (?,0,0,datetime('now'))`
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
    const r = await fetch('https://stratamesh-agora.stratamesh.workers.dev/agora/rate?quote=' + encodeURIComponent(quote));
    return await r.json();
  } catch (e) {
    return { success: false, error: String(e.message || e), strata_per_quote: null };
  }
}

function clampQuality(q) {
  const n = Number(q);
  if (!Number.isFinite(n)) return 1;
  // quality in (0, 2] — 1 baseline; cannot invent value via absurd quality alone without bound
  return Math.min(2, Math.max(0.05, n));
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
          version: '5.0.0-agora-priced',
          sole_mint_path: true,
          policy: {
            mint: 'DLT resource contribution only',
            pricing:
              'External global value of resources × quality → STRATA via Agora P2P rate (not protocol-set)',
            acquire_otherwise: 'Agora vs external value',
          },
        });
      }

      if (path === '/emission-policy') {
        return j({
          sole_mint_path: true,
          formula: 'STRATA = external_value_quote * quality * agora.strata_per_quote',
          rate_source: 'Agora open-book VWAP',
          external_value: 'Global resource market value of contributed units (lab proxies until live oracles)',
          quality: 'Proof-derived multiplier on contribution usefulness/reliability',
          not: ['fixed minting_rate', 'admin rate-setter', 'pure D/C without Agora'],
        });
      }

      if (path === '/market' || path === '/scarcity') {
        const rate = await agoraRate(env, url.searchParams.get('quote') || 'EUR');
        const meters = await db.prepare('SELECT * FROM resource_meters').all();
        return j({
          success: true,
          agora: rate,
          meters: meters.results || [],
          pricing: 'agora_rate_x_external_resource_value_x_quality',
        });
      }

      // Optional: still record mesh draw for analytics (does not set mint rate)
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
        return j({ success: true, resource_class, consumed_added: units, note: 'meter only — mint priced via Agora' });
      }

      if (path === '/mint' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const node_id = body.node_id;
        const contribution_type = body.contribution_type || body.resource_class;
        const units = Number(body.contribution_points || body.units || 0);
        const quality = clampQuality(body.quality != null ? body.quality : 1);
        const quote_asset = (body.quote_asset || 'EUR').toUpperCase();
        const proof_hash = body.proof_hash || null;
        if (!node_id || !contribution_type || !(units > 0)) {
          return j({ error: 'node_id, contribution_type, contribution_points > 0 required' }, 400);
        }
        if (!EXTERNAL_RESOURCE_EUR[contribution_type]) {
          return j({ error: 'unknown contribution_type', known: Object.keys(EXTERNAL_RESOURCE_EUR) }, 400);
        }

        // External value of resources (global), override allowed when caller supplies audited quote
        let external_quote_value;
        if (body.external_value != null && Number(body.external_value) > 0) {
          external_quote_value = Number(body.external_value);
        } else {
          const ref = EXTERNAL_RESOURCE_EUR[contribution_type];
          external_quote_value = units * ref.eur_per_unit * quality;
        }
        // quality already in external if using ref path; if external_value provided, still apply quality once
        if (body.external_value != null) {
          external_quote_value = Number(body.external_value) * quality;
        }

        const rate = await agoraRate(env, quote_asset);
        const strata_per_quote = rate && rate.strata_per_quote != null ? Number(rate.strata_per_quote) : null;
        if (strata_per_quote == null || !(strata_per_quote > 0)) {
          return j(
            {
              success: false,
              error: 'agora_rate_unavailable',
              message:
                'Cannot price PoC in STRATA without Agora book (STRATA listed vs external value). List on Agora or wait for liquidity.',
              agora: rate,
              external_value: { asset: quote_asset, value: external_quote_value, quality },
            },
            503
          );
        }

        let amount = external_quote_value * strata_per_quote;
        if (!Number.isFinite(amount) || amount < 0) amount = 0;
        amount = Math.floor(amount * 1e8) / 1e8;

        // meters analytics
        try {
          await db
            .prepare(
              `INSERT INTO resource_meters (resource_class, contributed, consumed, updated_at) VALUES (?, ?, 0, datetime('now'))
               ON CONFLICT(resource_class) DO UPDATE SET contributed = contributed + excluded.contributed, updated_at = excluded.updated_at`
            )
            .bind(contribution_type, units)
            .run();
        } catch (_) {}

        if (amount <= 0) {
          return j({
            success: true,
            amount_minted: 0,
            node_id,
            contribution_type,
            external_value: { asset: quote_asset, value: external_quote_value },
            agora_rate: { strata_per_quote, quote_per_strata: rate.quote_per_strata },
            message: 'Priced to zero at current Agora rate / external value',
          });
        }

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

        let eventId = null;
        try {
          const ins = await db
            .prepare(
              `INSERT INTO minting_events (node_id, contribution_type, contribution_score, amount, proof_hash, status, scarcity, contributed_after, consumed_at_mint)
               VALUES (?,?,?,?,?,'confirmed',?,?,?)`
            )
            .bind(
              node_id,
              contribution_type,
              units,
              amount,
              proof_hash,
              strata_per_quote,
              external_quote_value,
              quality
            )
            .run();
          eventId = ins.meta?.last_row_id ?? null;
        } catch (_) {
          try {
            await db
              .prepare(
                `INSERT INTO minting_events (node_id, contribution_type, contribution_score, amount, proof_hash, status)
                 VALUES (?,?,?,?,?,'confirmed')`
              )
              .bind(node_id, contribution_type, units, amount, proof_hash)
              .run();
          } catch (__) {}
        }

        return j({
          success: true,
          minting_event_id: eventId,
          node_id,
          contribution_type,
          contribution_points: units,
          quality,
          amount_minted: amount,
          pricing: {
            model: 'external_resource_value_x_quality_x_agora_rate',
            external_value: { asset: quote_asset, value: external_quote_value },
            agora: {
              quote_asset,
              strata_per_quote,
              quote_per_strata: rate.quote_per_strata,
              liquidity_strata: rate.liquidity_strata,
              source: rate.source,
            },
          },
          message:
            'PoC STRATA from global resource value × quality, converted at Agora rate — protocol does not set the rate.',
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
        const types = Object.entries(EXTERNAL_RESOURCE_EUR).map(([name, meta]) => ({
          name,
          unit: meta.unit,
          fixed_protocol_rate: null,
          external_ref_eur_per_unit_lab: meta.eur_per_unit,
          note: 'Lab external resource proxy until live global feeds; STRATA via Agora rate',
          agora_strata_per_eur: rate.strata_per_quote,
        }));
        return j({ contribution_types: types, pricing: 'agora_x_external_x_quality' });
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
          endpoints: ['/health', '/mint', '/market', '/consume', '/balance', '/contribution-types', '/history', '/emission-policy'],
        },
        404
      );
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
