/**
 * PoC — refined endogenous market emission
 *
 * amount is not chosen: it falls out of contribution vs consumption of a resource class.
 * - No demand (consumed = 0) → amount = 0 exactly
 * - More contribution against fixed demand → lower marginal STRATA per unit
 * - Rolling window soft-decays old meters (natural forgetting, not an admin rate)
 *
 * Acquire without contributing: Agora only.
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

const RESOURCE_CLASSES = {
  ipfs_pin: 'Storage / pin capacity the mesh can draw',
  validate: 'DAG validation / tip selection work',
  gossip: 'Propagation bandwidth',
  fog_uptime: 'Fog always-on capacity',
  starter_task: 'Onboarding micro-contribution (still market-priced)',
};

/** Half-life for meter decay (hours) — old supply/demand loses weight */
const METER_HALF_LIFE_H = 72;

function decayFactor(updatedAtIso, now = Date.now()) {
  if (!updatedAtIso) return 1;
  try {
    const t = new Date(updatedAtIso).getTime();
    if (!Number.isFinite(t)) return 1;
    const hours = Math.max(0, (now - t) / 3600000);
    // continuous half-life: 0.5^(h/H)
    return Math.pow(0.5, hours / METER_HALF_LIFE_H);
  } catch {
    return 1;
  }
}

/**
 * Marginal market clearing for Δu new contribution units.
 *
 * Interpret consumed D as “demand mass” and contributed C as “supply mass”.
 * Average scarcity before = D/C0, after = D/(C0+Δu).
 * Reward = integral of marginal scarcity ≈ D * ln((C0+Δu)/C0)  when C0>0
 *         = D * (Δu / (C0+Δu))  style share when using harmonic form
 *
 * We use the exact integral of  D/(C) dC = D * ln(1 + Δu/C0):
 *   each infinitesimal unit gets D/C at that instant → diminishing returns.
 * If C0 == 0: first supply against demand D gets D * (Δu/(Δu+ε)) capped by D.
 * If D == 0: reward = 0.
 */
function marketReward(units, C0, D) {
  const u = Math.max(0, Number(units) || 0);
  const c0 = Math.max(0, Number(C0) || 0);
  const d = Math.max(0, Number(D) || 0);
  if (u <= 0 || d <= 0) {
    return {
      amount: 0,
      scarcity_before: c0 > 0 ? d / c0 : d > 0 ? Infinity : 0,
      scarcity_after: d / Math.max(c0 + u, 1e-15),
      contributed_after: c0 + u,
      consumed: d,
      model: 'integral_D_over_C',
    };
  }
  let amount;
  if (c0 <= 1e-15) {
    // first contributors split demand mass: amount → D as u grows, never exceeds D
    amount = d * (u / (u + 1)); // +1 unitless regularizer only for empty-supply bootstrap shape
  } else {
    amount = d * Math.log(1 + u / c0);
  }
  // numerical hygiene
  if (!Number.isFinite(amount) || amount < 0) amount = 0;
  amount = Math.floor(amount * 1e8) / 1e8;
  const c1 = c0 + u;
  return {
    amount,
    scarcity_before: d / c0,
    scarcity_after: d / c1,
    contributed_after: c1,
    consumed: d,
    model: 'integral_D_over_C',
  };
}

async function ensure(db) {
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
      `CREATE TABLE IF NOT EXISTS consumption_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resource_class TEXT,
        units REAL,
        source TEXT,
        ref TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`
    )
    .run();
  for (const k of Object.keys(RESOURCE_CLASSES)) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO resource_meters (resource_class, contributed, consumed, updated_at)
         VALUES (?, 0, 0, datetime('now'))`
      )
      .bind(k)
      .run();
  }
}

async function liveMeter(db, resource_class) {
  let row = await db.prepare('SELECT * FROM resource_meters WHERE resource_class = ?').bind(resource_class).first();
  if (!row) {
    await db
      .prepare(
        `INSERT INTO resource_meters (resource_class, contributed, consumed, updated_at) VALUES (?, 0, 0, datetime('now'))`
      )
      .bind(resource_class)
      .run();
    row = { resource_class, contributed: 0, consumed: 0, updated_at: new Date().toISOString() };
  }
  const f = decayFactor(row.updated_at);
  // Apply decay lazily into effective values (persist on write)
  return {
    resource_class,
    contributed: Number(row.contributed || 0) * f,
    consumed: Number(row.consumed || 0) * f,
    updated_at: row.updated_at,
    decay: f,
  };
}

async function persistMeter(db, resource_class, contributed, consumed) {
  await db
    .prepare(
      `INSERT INTO resource_meters (resource_class, contributed, consumed, updated_at) VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(resource_class) DO UPDATE SET
         contributed = excluded.contributed,
         consumed = excluded.consumed,
         updated_at = excluded.updated_at`
    )
    .bind(resource_class, contributed, consumed)
    .run();
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
          version: '4.1.0-refined-market',
          sole_mint_path: true,
          policy: {
            mint: 'Verified DLT resource contribution only',
            amount: '∫ (D/C) dC = D·ln(1+Δu/C) — zero if D=0; diminishing in supply',
            decay: `meters half-life ${METER_HALF_LIFE_H}h`,
            acquire_otherwise: 'Strata Agora vs external value',
            not: ['fixed rates', 'rate-setter', 'admin schedule', 'ACB wages'],
          },
        });
      }

      if (path === '/emission-policy') {
        return j({
          sole_mint_path: true,
          mechanism: 'Proof of Contribution — refined endogenous market',
          formula: {
            with_prior_supply: 'amount = consumed * ln(1 + units/contributed)',
            first_supply: 'amount = consumed * units/(units+1)',
            no_demand: 'amount = 0',
          },
          meter_decay_hours_half_life: METER_HALF_LIFE_H,
          acquire_path: 'Strata Agora P2P vs external value only',
        });
      }

      if (path === '/market' || path === '/scarcity') {
        const out = [];
        for (const name of Object.keys(RESOURCE_CLASSES)) {
          const m = await liveMeter(db, name);
          const scarcity = m.contributed > 0 ? m.consumed / m.contributed : m.consumed > 0 ? null : 0;
          out.push({
            resource_class: name,
            description: RESOURCE_CLASSES[name],
            contributed_effective: m.contributed,
            consumed_effective: m.consumed,
            scarcity: scarcity === null ? 'infinite_demand_no_supply' : scarcity,
            decay_factor: m.decay,
            marginal_next_unit:
              m.consumed <= 0 ? 0 : m.contributed > 0 ? m.consumed / (m.contributed + 1) : m.consumed / 2,
          });
        }
        return j({
          success: true,
          market: out,
          model: 'integral_D_over_C + exponential meter decay',
          note: 'No preset rates — scarcity is the only price signal',
        });
      }

      if (path === '/consume' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const resource_class = body.resource_class || body.type || body.contribution_type;
        const units = Number(body.units || body.amount || body.points || 0);
        const source = body.source || 'api';
        const ref = body.ref || body.cid || body.vertex_id || null;
        if (!resource_class || !(units > 0)) return j({ error: 'resource_class and units > 0 required' }, 400);
        if (!RESOURCE_CLASSES[resource_class]) {
          return j({ error: 'unknown resource_class', known: Object.keys(RESOURCE_CLASSES) }, 400);
        }
        const m = await liveMeter(db, resource_class);
        const consumed = m.consumed + units;
        await persistMeter(db, resource_class, m.contributed, consumed);
        try {
          await db
            .prepare(
              `INSERT INTO consumption_events (resource_class, units, source, ref) VALUES (?,?,?,?)`
            )
            .bind(resource_class, units, source, ref)
            .run();
        } catch (_) {}
        return j({
          success: true,
          resource_class,
          consumed_added: units,
          source,
          meter: {
            contributed: m.contributed,
            consumed,
            scarcity: m.contributed > 0 ? consumed / m.contributed : null,
          },
        });
      }

      if (path === '/mint' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const node_id = body.node_id;
        const contribution_type = body.contribution_type || body.resource_class;
        const contribution_points = Number(body.contribution_points || body.units || 0);
        const proof_hash = body.proof_hash || body.proof || null;
        if (!node_id || !contribution_type || !(contribution_points > 0)) {
          return j({ error: 'Missing node_id, contribution_type, contribution_points > 0' }, 400);
        }
        if (!RESOURCE_CLASSES[contribution_type]) {
          return j({ error: 'Unknown contribution_type', known: Object.keys(RESOURCE_CLASSES) }, 400);
        }

        const meter = await liveMeter(db, contribution_type);
        const reward = marketReward(contribution_points, meter.contributed, meter.consumed);
        await persistMeter(db, contribution_type, reward.contributed_after, reward.consumed);

        if (reward.amount <= 0) {
          return j({
            success: true,
            amount_minted: 0,
            node_id,
            contribution_type,
            contribution_points,
            scarcity_before: reward.scarcity_before,
            scarcity_after: reward.scarcity_after,
            meter: { contributed: reward.contributed_after, consumed: reward.consumed },
            model: reward.model,
            message:
              'Contribution recorded. Zero STRATA because effective demand (consumed) is zero for this class — market has no pull.',
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
          .bind(node_id, reward.amount, reward.amount)
          .run();

        let eventId = null;
        try {
          const ins = await db
            .prepare(
              `INSERT INTO minting_events
               (node_id, contribution_type, contribution_score, amount, proof_hash, status, scarcity, contributed_after, consumed_at_mint)
               VALUES (?,?,?,?,?,'confirmed',?,?,?)`
            )
            .bind(
              node_id,
              contribution_type,
              contribution_points,
              reward.amount,
              proof_hash,
              reward.scarcity_after,
              reward.contributed_after,
              reward.consumed
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
              .bind(node_id, contribution_type, contribution_points, reward.amount, proof_hash)
              .run();
          } catch (__) {}
        }

        try {
          await db
            .prepare(`INSERT INTO proof_chain (previous_hash, current_hash, action, actor) VALUES (?,?,?,?)`)
            .bind(proof_hash || 'none', proof_hash || 'none', 'poc_mint_refined', node_id)
            .run();
        } catch (_) {}

        return j({
          success: true,
          minting_event_id: eventId,
          node_id,
          contribution_type,
          contribution_points,
          amount_minted: reward.amount,
          scarcity_before: reward.scarcity_before,
          scarcity_after: reward.scarcity_after,
          meter: { contributed: reward.contributed_after, consumed: reward.consumed },
          model: reward.model,
          pricing: 'endogenous_integral_market',
          message:
            'STRATA from ∫(D/C)dC over your units. No fixed rate. Non-contributors use Agora only.',
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
        const types = [];
        for (const [name, description] of Object.entries(RESOURCE_CLASSES)) {
          const m = await liveMeter(db, name);
          types.push({
            name,
            description,
            fixed_rate: null,
            rate_setter: null,
            contributed_effective: m.contributed,
            consumed_effective: m.consumed,
            marginal_next_unit: m.consumed <= 0 ? 0 : m.contributed > 0 ? m.consumed / (m.contributed + 1) : m.consumed / 2,
            note: 'Price is the market path ∫D/C — not a preset',
          });
        }
        return j({ contribution_types: types, pricing: 'endogenous_integral_market' });
      }

      if (path === '/history') {
        const node_id = url.searchParams.get('node_id');
        const events = node_id
          ? await db.prepare('SELECT * FROM minting_events WHERE node_id = ? ORDER BY id DESC LIMIT 50').bind(node_id).all()
          : await db.prepare('SELECT * FROM minting_events ORDER BY id DESC LIMIT 50').all();
        return j({ events: events.results || [] });
      }

      if (path === '/consumption-history') {
        const rows = await db.prepare('SELECT * FROM consumption_events ORDER BY id DESC LIMIT 50').all();
        return j({ events: rows.results || [] });
      }

      if (path === '/proof-chain') {
        const chain = await db.prepare('SELECT * FROM proof_chain ORDER BY id DESC LIMIT 50').all();
        return j({ chain: chain.results || [] });
      }

      if (path === '/starter-tasks') {
        return j({
          tasks: [
            { id: 'read_whitepaper', units: 1, resource_class: 'starter_task' },
            { id: 'run_health', units: 1, resource_class: 'starter_task' },
          ],
          note: 'Use POST /mint — reward is 0 unless starter_task has demand via /consume',
        });
      }

      if (path === '/starter-claim' && request.method === 'POST') {
        return j({ success: false, error: 'use_mint', message: 'POST /mint with contribution_type starter_task' }, 400);
      }

      return j(
        {
          error: 'Not found',
          endpoints: [
            '/health',
            '/mint',
            '/consume',
            '/market',
            '/balance',
            '/contribution-types',
            '/history',
            '/consumption-history',
            '/emission-policy',
          ],
        },
        404
      );
    } catch (err) {
      return j({ error: String(err.message || err) }, 500);
    }
  },
};
