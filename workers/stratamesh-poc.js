/**
 * Proof of Contribution — dynamic market emission (no fixed rates, no rate-setter)
 *
 * STRATA minted only for verified DLT resource contribution.
 * Amount emerges from contribution vs consumption scarcity on that resource class:
 *   scarcity = consumed / max(contributed, ε)
 *   amount   = contribution_units * scarcity
 * (clamped for lab stability; not an admin-chosen “minting_rate” schedule)
 *
 * Acquire without contributing: Strata Agora vs external value only.
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
  ipfs_pin: 'Storage / pin capacity offered to the mesh',
  validate: 'DAG validation / tip work',
  gossip: 'Propagation bandwidth',
  fog_uptime: 'Fog always-on capacity',
  starter_task: 'Lab onboarding micro-contribution',
};

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

async function getMeter(db, resource_class) {
  let row = await db.prepare('SELECT * FROM resource_meters WHERE resource_class = ?').bind(resource_class).first();
  if (!row) {
    await db
      .prepare(
        `INSERT INTO resource_meters (resource_class, contributed, consumed, updated_at) VALUES (?, 0, 0, datetime('now'))`
      )
      .bind(resource_class)
      .run();
    row = { resource_class, contributed: 0, consumed: 0 };
  }
  return row;
}

/**
 * Endogenous reward — no external index, no DAO-set rate table.
 * High consumption / low contribution → higher STRATA per unit contributed.
 * Contribution flood / low demand → approaches zero.
 */
function marketAmount(units, contributed_before, consumed) {
  const u = Math.max(0, Number(units) || 0);
  const C0 = Math.max(0, Number(contributed_before) || 0);
  const D = Math.max(0, Number(consumed) || 0);
  const C1 = C0 + u;
  const scarcity = D / Math.max(C1, 1e-9);
  // lab clamps: avoid dust spam and hyperinflation on first units
  let amount = u * scarcity;
  if (D <= 0) {
    // no measured demand yet → negligible recognition only
    amount = Math.min(u * 1e-6, 1e-4);
  }
  // soft cap per event (anti-lab-exploit), still proportional to scarcity
  amount = Math.min(amount, Math.max(D, 1e-6) * 10);
  // quantize to 6 decimals
  amount = Math.floor(amount * 1e6) / 1e6;
  return { amount, scarcity, contributed_after: C1, consumed: D };
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
          version: '4.0.0-dynamic-market',
          sole_mint_path: true,
          policy: {
            mint: 'Only for verified DLT resource contribution',
            amount: 'Endogenous: units × (consumed/contributed) — no fixed rates, no rate-setter',
            acquire_otherwise: 'Strata Agora vs external value only',
            forbidden: ['free mint', 'admin airdrop', 'fixed schedule emission', 'ACB wage mint'],
          },
        });
      }

      if (path === '/emission-policy') {
        return j({
          sole_mint_path: true,
          mechanism: 'Proof of Contribution — market-dynamic amount',
          formula: 'amount = contribution_units * (consumed / contributed_after) for that resource class',
          not: ['fixed minting_rate', 'admin-chosen APR', 'indexed external oracle rate'],
          acquire_path: 'Strata Agora P2P vs external value only',
        });
      }

      // Live resource market meters
      if (path === '/market' || path === '/scarcity') {
        const rows = await db.prepare('SELECT * FROM resource_meters').all();
        const market = (rows.results || []).map((r) => {
          const C = Number(r.contributed) || 0;
          const D = Number(r.consumed) || 0;
          const scarcity = D / Math.max(C, 1e-9);
          return {
            resource_class: r.resource_class,
            description: RESOURCE_CLASSES[r.resource_class] || '',
            contributed: C,
            consumed: D,
            scarcity,
            marginal_hint: D <= 0 ? 'near-zero until consumption registers demand' : scarcity,
          };
        });
        return j({ success: true, market, note: 'Scarcity is endogenous to mesh contribution vs consumption' });
      }

      // Record consumption / demand pressure (fees, pin requests, validation load, etc.)
      if (path === '/consume' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const resource_class = body.resource_class || body.type || body.contribution_type;
        const units = Number(body.units || body.amount || body.points || 0);
        if (!resource_class || !(units > 0)) return j({ error: 'resource_class and units > 0 required' }, 400);
        if (!RESOURCE_CLASSES[resource_class] && !body.allow_custom) {
          return j({ error: 'unknown resource_class', known: Object.keys(RESOURCE_CLASSES) }, 400);
        }
        await db
          .prepare(
            `INSERT INTO resource_meters (resource_class, contributed, consumed, updated_at) VALUES (?, 0, ?, datetime('now'))
             ON CONFLICT(resource_class) DO UPDATE SET consumed = consumed + excluded.consumed, updated_at = excluded.updated_at`
          )
          .bind(resource_class, units)
          .run();
        const m = await getMeter(db, resource_class);
        return j({
          success: true,
          resource_class,
          consumed_added: units,
          meter: { contributed: m.contributed, consumed: m.consumed, scarcity: Number(m.consumed) / Math.max(Number(m.contributed), 1e-9) },
        });
      }

      // Mint via contribution — dynamic amount
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

        const meter = await getMeter(db, contribution_type);
        const { amount, scarcity, contributed_after, consumed } = marketAmount(
          contribution_points,
          meter.contributed,
          meter.consumed
        );

        // update contributed supply of this resource class
        await db
          .prepare(
            `UPDATE resource_meters SET contributed = ?, updated_at = datetime('now') WHERE resource_class = ?`
          )
          .bind(contributed_after, contribution_type)
          .run();

        if (amount <= 0) {
          return j({
            success: true,
            amount_minted: 0,
            node_id,
            contribution_type,
            contribution_points,
            scarcity,
            message:
              'Contribution recorded; market scarcity yields ~0 STRATA (no demand pressure on this resource class). Register consumption via /consume or use capacity that the mesh actually draws.',
            meter: { contributed: contributed_after, consumed },
          });
        }

        // credit STRATA
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
              `INSERT INTO minting_events
               (node_id, contribution_type, contribution_score, amount, proof_hash, status, scarcity, contributed_after, consumed_at_mint)
               VALUES (?,?,?,?,?,'confirmed',?,?,?)`
            )
            .bind(node_id, contribution_type, contribution_points, amount, proof_hash, scarcity, contributed_after, consumed)
            .run();
          eventId = ins.meta?.last_row_id;
        } catch (_) {
          try {
            await db
              .prepare(
                `INSERT INTO minting_events (node_id, contribution_type, contribution_score, amount, proof_hash, status)
                 VALUES (?,?,?,?,?,'confirmed')`
              )
              .bind(node_id, contribution_type, contribution_points, amount, proof_hash)
              .run();
          } catch (__) {}
        }

        try {
          await db
            .prepare(`INSERT INTO proof_chain (previous_hash, current_hash, action, actor) VALUES (?,?,?,?)`)
            .bind(proof_hash || 'none', proof_hash || 'none', 'poc_mint_dynamic', node_id)
            .run();
        } catch (_) {}

        return j({
          success: true,
          minting_event_id: eventId,
          node_id,
          contribution_type,
          contribution_points,
          amount_minted: amount,
          scarcity,
          meter: { contributed: contributed_after, consumed },
          pricing: 'endogenous_market',
          message:
            'STRATA minted from contribution vs consumption scarcity — not a fixed rate. Non-contributors acquire only on Strata Agora for external value.',
        });
      }

      if (path === '/balance') {
        const node_id = url.searchParams.get('node_id') || url.searchParams.get('account');
        if (!node_id) return j({ error: 'node_id required' }, 400);
        const row = await db
          .prepare("SELECT * FROM token_balances WHERE account = ? AND token_type IN ('STRATA','strata')")
          .bind(node_id)
          .first();
        return j({ success: true, account: node_id, balance: row ? Number(row.balance) : 0, row });
      }

      // Classes without fixed rates
      if (path === '/contribution-types') {
        const meters = await db.prepare('SELECT * FROM resource_meters').all();
        const by = Object.fromEntries((meters.results || []).map((m) => [m.resource_class, m]));
        const types = Object.entries(RESOURCE_CLASSES).map(([name, description]) => {
          const m = by[name] || { contributed: 0, consumed: 0 };
          const scarcity = Number(m.consumed) / Math.max(Number(m.contributed), 1e-9);
          return {
            name,
            description,
            fixed_rate: null,
            scarcity,
            contributed: Number(m.contributed) || 0,
            consumed: Number(m.consumed) || 0,
            note: 'Reward per unit is market-dynamic, not a preset minting_rate',
          };
        });
        return j({ contribution_types: types, pricing: 'endogenous_market' });
      }

      if (path === '/history') {
        const node_id = url.searchParams.get('node_id');
        const events = node_id
          ? await db.prepare('SELECT * FROM minting_events WHERE node_id = ? ORDER BY id DESC LIMIT 50').bind(node_id).all()
          : await db.prepare('SELECT * FROM minting_events ORDER BY id DESC LIMIT 50').all();
        return j({ events: events.results || [] });
      }

      if (path === '/proof-chain') {
        const chain = await db.prepare('SELECT * FROM proof_chain ORDER BY id DESC LIMIT 50').all();
        return j({ chain: chain.results || [] });
      }

      // Starter tasks: same market formula (usually ~0 until demand); not a faucet
      if (path === '/starter-tasks') {
        return j({
          tasks: [
            { id: 'read_whitepaper', name: 'Acknowledge mesh role', units: 1, resource_class: 'starter_task' },
            { id: 'run_health', name: 'Probe node health', units: 1, resource_class: 'starter_task' },
          ],
          note: 'Claims use dynamic PoC — not fixed rewards',
        });
      }

      if (path === '/starter-claim' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        return j({
          success: false,
          error: 'use_mint',
          message: 'POST /mint with contribution_type starter_task and contribution_points — amount is market-dynamic',
          example: { node_id: body.node_id || 'YOUR_NODE', contribution_type: 'starter_task', contribution_points: 1 },
        }, 400);
      }

      return j(
        {
          error: 'Not found',
          endpoints: ['/health', '/mint', '/consume', '/market', '/balance', '/contribution-types', '/history', '/emission-policy'],
        },
        404
      );
    } catch (err) {
      return j({ error: String(err.message || err) }, 500);
    }
  },
};
