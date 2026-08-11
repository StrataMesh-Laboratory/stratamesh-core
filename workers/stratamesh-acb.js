/**
 * ACB + Proof of Subsistence — schema: acb_registry(id, name, status, balance, ...)
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
    if (r) return Number(r.balance || 0);
  } catch (_) {}
  try {
    const r = await db.prepare('SELECT balance FROM acb_registry WHERE id = ?').bind(account).first();
    return Number(r?.balance || 0);
  } catch {
    return 0;
  }
}

async function deltaStrata(db, account, delta) {
  // token_balances
  try {
    await db
      .prepare(
        `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned)
         VALUES (?, 'STRATA', ?, ?, ?)
         ON CONFLICT(account, token_type) DO UPDATE SET balance = MAX(0, balance + excluded.balance)`
      )
      .bind(account, delta, delta > 0 ? delta : 0, delta < 0 ? -delta : 0)
      .run();
  } catch (_) {
    try {
      await db
        .prepare(
          `INSERT INTO token_balances (account, token_type, balance) VALUES (?, 'STRATA', ?)
           ON CONFLICT(account, token_type) DO UPDATE SET balance = balance + excluded.balance`
        )
        .bind(account, delta)
        .run();
    } catch (__) {}
  }
  // mirror on registry.balance
  try {
    await db.prepare('UPDATE acb_registry SET balance = MAX(0, COALESCE(balance,0) + ?) WHERE id = ?').bind(delta, account).run();
  } catch (_) {}
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
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': '*' } });
    }
    const db = env.STRATAMESH_LEDGER || env.LEDGER || env.DB;

    try {
      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS acb_cycles (
            id TEXT PRIMARY KEY, acb_id TEXT, kind TEXT, amount REAL, balance_after REAL, meta TEXT, created_at TEXT
          )`
        )
        .run();

      if (path === '/acb/health') {
        let n = 0, active = 0, hib = 0;
        try {
          n = (await db.prepare('SELECT COUNT(*) as c FROM acb_registry').first())?.c ?? 0;
          active = (await db.prepare("SELECT COUNT(*) as c FROM acb_registry WHERE lower(status) IN ('active','ACTIVE')").first())?.c ?? 0;
          hib = (await db.prepare("SELECT COUNT(*) as c FROM acb_registry WHERE upper(status) = 'HIBERNATED'").first())?.c ?? 0;
        } catch (_) {}
        return j({
          status: 'ok',
          service: 'stratamesh-acb',
          version: '2.1.1-subsistence',
          acbs: n,
          active,
          hibernated: hib,
          endpoints: ['/acb/register', '/acb/earn', '/acb/subsistence', '/acb/cycle', '/acb/status'],
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
            .prepare("INSERT OR IGNORE INTO token_balances (account, token_type, balance, total_minted, total_burned) VALUES (?, 'STRATA', 0, 0, 0)")
            .bind(id)
            .run();
        } catch (_) {}
        return j({
          success: true,
          acb: { acb_id: id, name, status: 'active', balance: 0 },
          note: 'Proof of Subsistence: earn STRATA to cover compute or hibernate',
        });
      }

      if (path === '/acb/earn' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const acb_id = body.acb_id || body.id;
        const amount = Number(body.amount || 0);
        if (!acb_id || amount <= 0) return j({ error: 'acb_id and amount > 0 required' }, 400);
        const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'ACB not found — register first' }, 404);
        await deltaStrata(db, acb_id, amount);
        await db
          .prepare("UPDATE acb_registry SET status = 'active', last_action = 'earn' WHERE id = ?")
          .bind(acb_id)
          .run();
        const bal = await getStrata(db, acb_id);
        await db
          .prepare('INSERT INTO acb_cycles (id, acb_id, kind, amount, balance_after, meta, created_at) VALUES (?,?,?,?,?,?,?)')
          .bind(crypto.randomUUID(), acb_id, 'earn', amount, bal, JSON.stringify({ work_type: body.work_type || 'general' }), new Date().toISOString())
          .run();
        return j({ success: true, acb_id, earned: amount, balance: bal, status: 'active' });
      }

      if (path === '/acb/subsistence' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const acb_id = body.acb_id || body.id;
        const cost = Number(body.inference_cost || body.cost || 0);
        if (!acb_id || cost <= 0) return j({ error: 'acb_id and inference_cost > 0 required' }, 400);
        const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'ACB not found' }, 404);
        if (String(acb.status).toUpperCase() === 'HIBERNATED') {
          return j({ error: 'hibernated', message: 'Must earn before inference', acb_id }, 402);
        }
        const bal = await getStrata(db, acb_id);
        if (bal < cost) {
          await db.prepare("UPDATE acb_registry SET status = 'HIBERNATED', last_action = 'hibernate' WHERE id = ?").bind(acb_id).run();
          await db
            .prepare('INSERT INTO acb_cycles (id, acb_id, kind, amount, balance_after, meta, created_at) VALUES (?,?,?,?,?,?,?)')
            .bind(crypto.randomUUID(), acb_id, 'hibernate', 0, bal, JSON.stringify({ needed: cost }), new Date().toISOString())
            .run();
          return j({
            success: false,
            error: 'insolvent',
            acb_id,
            balance: bal,
            needed: cost,
            status: 'HIBERNATED',
            whitepaper: 'Proof of Subsistence — hibernate when insolvent',
          }, 402);
        }
        await deltaStrata(db, acb_id, -cost);
        const after = await getStrata(db, acb_id);
        let status = 'active';
        if (after < 0.01) {
          status = 'HIBERNATED';
          await db.prepare("UPDATE acb_registry SET status = 'HIBERNATED', last_action = 'subsistence_empty' WHERE id = ?").bind(acb_id).run();
        } else {
          await db.prepare("UPDATE acb_registry SET last_action = 'subsistence' WHERE id = ?").bind(acb_id).run();
        }
        await db
          .prepare('INSERT INTO acb_cycles (id, acb_id, kind, amount, balance_after, meta, created_at) VALUES (?,?,?,?,?,?,?)')
          .bind(crypto.randomUUID(), acb_id, 'subsistence', -cost, after, JSON.stringify({ inference_type: body.inference_type || 'generic' }), new Date().toISOString())
          .run();
        return j({ success: true, acb_id, cost, balance: after, status });
      }

      if (path === '/acb/cycle' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const acb_id = body.acb_id || body.id;
        if (!acb_id) return j({ error: 'acb_id required' }, 400);
        const earn = Number(body.earn || 0);
        const cost = Number(body.cost || body.inference_cost || 0.5);
        const steps = [];
        const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'ACB not found' }, 404);
        if (earn > 0) {
          await deltaStrata(db, acb_id, earn);
          await db.prepare("UPDATE acb_registry SET status = 'active', last_action = 'earn' WHERE id = ?").bind(acb_id).run();
          steps.push({ step: 'earn', amount: earn, balance: await getStrata(db, acb_id) });
        }
        const bal = await getStrata(db, acb_id);
        if (bal < cost) {
          await db.prepare("UPDATE acb_registry SET status = 'HIBERNATED', last_action = 'hibernate' WHERE id = ?").bind(acb_id).run();
          steps.push({ step: 'hibernate', balance: bal, needed: cost });
          return j({ success: true, acb_id, status: 'HIBERNATED', steps });
        }
        await deltaStrata(db, acb_id, -cost);
        const after = await getStrata(db, acb_id);
        steps.push({ step: 'subsistence', cost, balance: after });
        return j({ success: true, acb_id, status: after < 0.01 ? 'HIBERNATED' : 'active', steps });
      }

      if (path === '/acb/status') {
        const acb_id = url.searchParams.get('acb_id') || url.searchParams.get('id');
        if (!acb_id) {
          const all = await db.prepare('SELECT * FROM acb_registry LIMIT 50').all();
          const acbs = [];
          for (const a of all.results || []) {
            acbs.push({ ...a, acb_id: a.id, balance: await getStrata(db, a.id) });
          }
          return j({ status: 'ok', acbs });
        }
        const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'not found' }, 404);
        const cycles = await db.prepare('SELECT * FROM acb_cycles WHERE acb_id = ? ORDER BY created_at DESC LIMIT 20').bind(acb_id).all();
        return j({ status: 'ok', acb: { ...acb, acb_id: acb.id }, balance: await getStrata(db, acb_id), cycles: cycles.results || [] });
      }

      return j({ error: 'Not found', endpoints: ['/acb/register', '/acb/earn', '/acb/subsistence', '/acb/cycle', '/acb/status', '/acb/health'] }, 404);
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
