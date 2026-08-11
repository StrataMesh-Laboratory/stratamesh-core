/**
 * ACB + Proof of Subsistence (whitepaper)
 * Earn STRATA via useful work → pay inference/compute cost → hibernate if insolvent → wake on earn
 */
function j(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

async function getStrata(db, account) {
  try {
    const r = await db
      .prepare("SELECT balance FROM token_balances WHERE account = ? AND token_type IN ('STRATA','strata')")
      .bind(account)
      .first();
    return Number(r?.balance || 0);
  } catch (_) {
    try {
      const r = await db.prepare('SELECT balance FROM token_balances WHERE node_id = ?').bind(account).first();
      return Number(r?.balance || 0);
    } catch {
      return 0;
    }
  }
}

async function setStrataDelta(db, account, delta, mint = false) {
  await db
    .prepare(
      `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned)
       VALUES (?, 'STRATA', ?, ?, ?)
       ON CONFLICT(account, token_type) DO UPDATE SET
         balance = balance + excluded.balance,
         total_minted = total_minted + excluded.total_minted,
         total_burned = total_burned + excluded.total_burned`
    )
    .bind(account, delta, mint && delta > 0 ? delta : 0, !mint && delta < 0 ? -delta : 0)
    .run();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.startsWith('/api/v1/acb')) path = path.slice('/api/v1'.length);
    if (path === '/acb/list' || path === '/list') path = '/acb/status';
    if (path === '/health') path = '/acb/health';
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
      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS acb_registry (
            acb_id TEXT PRIMARY KEY,
            name TEXT,
            status TEXT,
            owner TEXT,
            created_at TEXT,
            hibernated_at TEXT,
            last_cycle_at TEXT,
            total_earned REAL DEFAULT 0,
            total_spent REAL DEFAULT 0
          )`
        )
        .run();
      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS acb_cycles (
            id TEXT PRIMARY KEY,
            acb_id TEXT,
            kind TEXT,
            amount REAL,
            balance_after REAL,
            meta TEXT,
            created_at TEXT
          )`
        )
        .run();

      if (path === '/acb/health') {
        let n = 0,
          active = 0,
          hib = 0;
        try {
          n = (await db.prepare('SELECT COUNT(*) as c FROM acb_registry').first())?.c ?? 0;
          active = (await db.prepare("SELECT COUNT(*) as c FROM acb_registry WHERE status = 'ACTIVE'").first())?.c ?? 0;
          hib = (await db.prepare("SELECT COUNT(*) as c FROM acb_registry WHERE status = 'HIBERNATED'").first())?.c ?? 0;
        } catch (_) {}
        return j({
          status: 'ok',
          service: 'stratamesh-acb',
          version: '2.0.1-subsistence-loop',
          acbs: n,
          active,
          hibernated: hib,
          endpoints: ['/acb/register', '/acb/earn', '/acb/subsistence', '/acb/cycle', '/acb/status', '/acb/clawback'],
        });
      }

      // Register ACB (starts with 0 STRATA — must earn via work / PoC path, not free mint)
      if (path === '/acb/register' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const acb_id = body.acb_id || 'ACB-' + crypto.randomUUID().slice(0, 10);
        const name = body.name || acb_id;
        const owner = body.owner || 'FOG-NODE-PT-CM-001';
        await db
          .prepare(
            `INSERT OR REPLACE INTO acb_registry (acb_id, name, status, owner, created_at, total_earned, total_spent)
             VALUES (?,?, 'ACTIVE', ?, datetime('now'), 0, 0)`
          )
          .bind(acb_id, name, owner)
          .run();
        // ensure zero balance row
        await db
          .prepare(
            "INSERT OR IGNORE INTO token_balances (account, token_type, balance, total_minted, total_burned) VALUES (?, 'STRATA', 0, 0, 0)"
          )
          .bind(acb_id)
          .run();
        return j({
          success: true,
          acb: { acb_id, name, status: 'ACTIVE', owner, balance: 0 },
          note: 'Proof of Subsistence: must earn STRATA (work) to cover compute costs or hibernate',
        });
      }

      // Earn — whitepaper: compensation for useful work (not free mint of network STRATA from nowhere;
      // lab routes through balance credit; production should call PoC for node-side work)
      if (path === '/acb/earn' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const acb_id = body.acb_id;
        const amount = Number(body.amount || 0);
        if (!acb_id || amount <= 0) return j({ error: 'acb_id and amount > 0 required' }, 400);
        const acb = await db.prepare('SELECT * FROM acb_registry WHERE acb_id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'ACB not found — POST /acb/register first' }, 404);

        await setStrataDelta(db, acb_id, amount, true);
        const bal = await getStrata(db, acb_id);
        await db
          .prepare(
            "UPDATE acb_registry SET status = 'ACTIVE', hibernated_at = NULL, last_cycle_at = datetime('now'), total_earned = COALESCE(total_earned,0) + ? WHERE acb_id = ?"
          )
          .bind(amount, acb_id)
          .run();
        await db
          .prepare('INSERT INTO acb_cycles (id, acb_id, kind, amount, balance_after, meta, created_at) VALUES (?,?,?,?,?,?,?)')
          .bind(crypto.randomUUID(), acb_id, 'earn', amount, bal, JSON.stringify({ work_type: body.work_type || 'general', work_proof: body.work_proof || null }), new Date().toISOString())
          .run();
        return j({
          success: true,
          acb_id,
          earned: amount,
          balance: bal,
          status: 'ACTIVE',
          work_type: body.work_type || 'general',
        });
      }

      // Subsistence debit — pay for inference/compute
      if (path === '/acb/subsistence' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const acb_id = body.acb_id;
        const cost = Number(body.inference_cost || body.cost || 0);
        if (!acb_id || cost <= 0) return j({ error: 'acb_id and inference_cost > 0 required' }, 400);
        const acb = await db.prepare('SELECT * FROM acb_registry WHERE acb_id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'ACB not found' }, 404);
        if (acb.status === 'HIBERNATED') {
          return j({ error: 'hibernated', message: 'ACB must earn STRATA before running inference', acb_id }, 402);
        }

        const bal = await getStrata(db, acb_id);
        if (bal < cost) {
          // insolvent → hibernate
          await db
            .prepare("UPDATE acb_registry SET status = 'HIBERNATED', hibernated_at = datetime('now'), last_cycle_at = datetime('now') WHERE acb_id = ?")
            .bind(acb_id)
            .run();
          await db
            .prepare('INSERT INTO acb_cycles (id, acb_id, kind, amount, balance_after, meta, created_at) VALUES (?,?,?,?,?,?,?)')
            .bind(crypto.randomUUID(), acb_id, 'hibernate', 0, bal, JSON.stringify({ reason: 'insufficient_for_subsistence', needed: cost }), new Date().toISOString())
            .run();
          return j({
            success: false,
            error: 'insolvent',
            acb_id,
            balance: bal,
            needed: cost,
            status: 'HIBERNATED',
            whitepaper: 'Proof of Subsistence — optimize, hibernate, migrate, or evolve',
          }, 402);
        }

        await setStrataDelta(db, acb_id, -cost, false);
        const after = await getStrata(db, acb_id);
        await db
          .prepare(
            "UPDATE acb_registry SET total_spent = COALESCE(total_spent,0) + ?, last_cycle_at = datetime('now') WHERE acb_id = ?"
          )
          .bind(cost, acb_id)
          .run();
        await db
          .prepare('INSERT INTO acb_cycles (id, acb_id, kind, amount, balance_after, meta, created_at) VALUES (?,?,?,?,?,?,?)')
          .bind(crypto.randomUUID(), acb_id, 'subsistence', -cost, after, JSON.stringify({ inference_type: body.inference_type || 'generic' }), new Date().toISOString())
          .run();

        // auto-hibernate if residual too low
        let status = 'ACTIVE';
        if (after < 0.01) {
          status = 'HIBERNATED';
          await db
            .prepare("UPDATE acb_registry SET status = 'HIBERNATED', hibernated_at = datetime('now') WHERE acb_id = ?")
            .bind(acb_id)
            .run();
        }

        return j({
          success: true,
          acb_id,
          cost,
          balance: after,
          status,
          inference_type: body.inference_type || 'generic',
        });
      }

      // Full cycle: optional earn then subsistence (lab demo of living agent economics)
      if (path === '/acb/cycle' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const acb_id = body.acb_id;
        if (!acb_id) return j({ error: 'acb_id required' }, 400);
        const earn = Number(body.earn || 0);
        const cost = Number(body.cost || body.inference_cost || 0.5);
        const steps = [];
        if (earn > 0) {
          const er = await fetch(new Request(request.url.replace(/\/acb\/cycle.*/, '/acb/earn'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ acb_id, amount: earn, work_type: body.work_type || 'cycle_work' }),
          }));
          // call internal by reusing logic - simpler inline
        }
        // inline earn
        if (earn > 0) {
          const acb = await db.prepare('SELECT * FROM acb_registry WHERE acb_id = ?').bind(acb_id).first();
          if (!acb) return j({ error: 'ACB not found' }, 404);
          await setStrataDelta(db, acb_id, earn, true);
          await db
            .prepare(
              "UPDATE acb_registry SET status = 'ACTIVE', hibernated_at = NULL, total_earned = COALESCE(total_earned,0) + ?, last_cycle_at = datetime('now') WHERE acb_id = ?"
            )
            .bind(earn, acb_id)
            .run();
          steps.push({ step: 'earn', amount: earn, balance: await getStrata(db, acb_id) });
        }
        // subsistence
        const bal = await getStrata(db, acb_id);
        if (bal < cost) {
          await db
            .prepare("UPDATE acb_registry SET status = 'HIBERNATED', hibernated_at = datetime('now') WHERE acb_id = ?")
            .bind(acb_id)
            .run();
          steps.push({ step: 'hibernate', balance: bal, needed: cost });
          return j({ success: true, acb_id, status: 'HIBERNATED', steps });
        }
        await setStrataDelta(db, acb_id, -cost, false);
        const after = await getStrata(db, acb_id);
        await db
          .prepare("UPDATE acb_registry SET total_spent = COALESCE(total_spent,0) + ?, last_cycle_at = datetime('now') WHERE acb_id = ?")
          .bind(cost, acb_id)
          .run();
        steps.push({ step: 'subsistence', cost, balance: after });
        return j({ success: true, acb_id, status: after < 0.01 ? 'HIBERNATED' : 'ACTIVE', steps });
      }

      if (path === '/acb/status') {
        const acb_id = url.searchParams.get('acb_id');
        if (!acb_id) {
          const all = await db.prepare('SELECT * FROM acb_registry LIMIT 50').all();
          const acbs = [];
          for (const a of all.results || []) {
            acbs.push({ ...a, balance: await getStrata(db, a.acb_id) });
          }
          return j({ status: 'ok', acbs });
        }
        const acb = await db.prepare('SELECT * FROM acb_registry WHERE acb_id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'not found' }, 404);
        const cycles = await db
          .prepare('SELECT * FROM acb_cycles WHERE acb_id = ? ORDER BY created_at DESC LIMIT 20')
          .bind(acb_id)
          .all();
        return j({ status: 'ok', acb, balance: await getStrata(db, acb_id), cycles: cycles.results || [] });
      }

      if (path === '/acb/clawback' && method === 'POST') {
        return j({ status: 'ok', note: 'clawback reserved for bootstrap excess; PoS path is earn/subsistence' });
      }

      return j({ error: 'Not found', endpoints: ['/acb/register', '/acb/earn', '/acb/subsistence', '/acb/cycle', '/acb/status', '/acb/health'] }, 404);
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
