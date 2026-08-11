/**
 * ACB + Proof of Subsistence
 * STRATA only via PoC (stratamesh-poc) — earn never mints directly.
 * Subsistence debits STRATA; insolvency → HIBERNATED.
 */
function j(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

const WORK_TO_POC = {
  validation: 'validate',
  validate: 'validate',
  pin: 'ipfs_pin',
  ipfs_pin: 'ipfs_pin',
  gossip: 'gossip',
  uptime: 'fog_uptime',
  fog_uptime: 'fog_uptime',
  portal: 'validate',
  general: 'validate',
  cycle_work: 'validate',
};

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

/** Debit only — never mint STRATA here */
async function debitStrata(db, account, amount) {
  const cost = Math.abs(Number(amount) || 0);
  if (cost <= 0) return await getStrata(db, account);
  try {
    await db
      .prepare(
        `UPDATE token_balances SET balance = MAX(0, balance - ?), total_burned = COALESCE(total_burned,0) + ?
         WHERE account = ? AND token_type IN ('STRATA','strata')`
      )
      .bind(cost, cost, account)
      .run();
  } catch (_) {
    try {
      await db
        .prepare(
          `UPDATE token_balances SET balance = balance - ? WHERE account = ? AND token_type IN ('STRATA','strata')`
        )
        .bind(cost, account)
        .run();
    } catch (__) {}
  }
  try {
    await db.prepare('UPDATE acb_registry SET balance = MAX(0, COALESCE(balance,0) - ?) WHERE id = ?').bind(cost, account).run();
  } catch (_) {}
  return await getStrata(db, account);
}

async function pocMint(env, { node_id, contribution_type, contribution_points, proof_hash }) {
  const body = JSON.stringify({
    node_id,
    contribution_type,
    contribution_points,
    proof_hash: proof_hash || `acb-${node_id}-${Date.now()}`,
  });
  try {
    if (env.POC && typeof env.POC.fetch === 'function') {
      const r = await env.POC.fetch(
        new Request('https://poc/mint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
      );
      return { http: r.status, data: await r.json().catch(() => ({})) };
    }
    const r = await fetch('https://stratamesh-poc.stratamesh.workers.dev/mint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    return { http: r.status, data: await r.json().catch(() => ({})) };
  } catch (e) {
    return { http: 0, data: { error: String(e.message || e) } };
  }
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
          `CREATE TABLE IF NOT EXISTS acb_cycles (
            id TEXT PRIMARY KEY, acb_id TEXT, kind TEXT, amount REAL, balance_after REAL, meta TEXT, created_at TEXT
          )`
        )
        .run();

      if (path === '/acb/health') {
        let n = 0, active = 0, hib = 0;
        try {
          n = (await db.prepare('SELECT COUNT(*) as c FROM acb_registry').first())?.c ?? 0;
          active = (await db.prepare("SELECT COUNT(*) as c FROM acb_registry WHERE lower(status) IN ('active')").first())?.c ?? 0;
          hib = (await db.prepare("SELECT COUNT(*) as c FROM acb_registry WHERE upper(status) = 'HIBERNATED'").first())?.c ?? 0;
        } catch (_) {}
        return j({
          status: 'ok',
          service: 'stratamesh-acb',
          version: '3.0.0-poc-only-earn',
          policy: 'STRATA only via PoC; subsistence debits; insolvent hibernates',
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
            .prepare(
              "INSERT OR IGNORE INTO token_balances (account, token_type, balance, total_minted, total_burned) VALUES (?, 'STRATA', 0, 0, 0)"
            )
            .bind(id)
            .run();
        } catch (_) {}
        return j({
          success: true,
          acb: { acb_id: id, name, status: 'active', balance: 0 },
          note: 'No free STRATA. Earn via useful work → PoC mint. Subsistence costs STRATA.',
        });
      }

      // Earn: route through PoC only
      if (path === '/acb/earn' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const acb_id = body.acb_id || body.id;
        const amountHint = Number(body.amount || 0);
        // contribution_points: if amount given, scale points so PoC rate yields ~amount (validate rate 0.05 → points = amount/0.05)
        const work_type = body.work_type || body.contribution_type || 'validate';
        const contribution_type = WORK_TO_POC[work_type] || WORK_TO_POC[String(work_type).toLowerCase()] || 'validate';
        const rateGuess = contribution_type === 'fog_uptime' ? 0.2 : contribution_type === 'ipfs_pin' ? 0.1 : contribution_type === 'gossip' ? 0.02 : 0.05;
        let contribution_points = Number(body.contribution_points || 0);
        if (contribution_points <= 0 && amountHint > 0) {
          contribution_points = Math.max(1, Math.ceil(amountHint / rateGuess));
        }
        if (!contribution_points) contribution_points = 20; // default lab work packet
        if (!acb_id) return j({ error: 'acb_id required' }, 400);

        const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'ACB not found — register first' }, 404);

        const poc = await pocMint(env, {
          node_id: acb_id,
          contribution_type,
          contribution_points,
          proof_hash: body.work_proof || body.proof_hash || `acb-work-${acb_id}-${Date.now()}`,
        });

        if (!poc.data || poc.data.success === false || poc.data.error || (poc.http && poc.http >= 400)) {
          return j(
            {
              success: false,
              error: 'poc_mint_failed',
              detail: poc.data,
              whitepaper: 'STRATA is minted only via Proof of Contribution — ACB cannot emit base token',
            },
            502
          );
        }

        const minted = Number(poc.data.amount_minted || poc.data.amount || 0);
        // sync registry balance from ledger
        const bal = await getStrata(db, acb_id);
        try {
          await db.prepare('UPDATE acb_registry SET balance = ?, status = ?, last_action = ? WHERE id = ?')
            .bind(bal, 'active', 'earn_poc', acb_id)
            .run();
        } catch (_) {
          await db.prepare("UPDATE acb_registry SET status = 'active', last_action = 'earn_poc' WHERE id = ?").bind(acb_id).run();
        }

        await db
          .prepare('INSERT INTO acb_cycles (id, acb_id, kind, amount, balance_after, meta, created_at) VALUES (?,?,?,?,?,?,?)')
          .bind(
            crypto.randomUUID(),
            acb_id,
            'earn_poc',
            minted,
            bal,
            JSON.stringify({ contribution_type, contribution_points, poc: poc.data }),
            new Date().toISOString()
          )
          .run();

        return j({
          success: true,
          acb_id,
          earned_via: 'proof_of_contribution',
          contribution_type,
          contribution_points,
          amount_minted: minted,
          balance: bal,
          status: 'active',
          poc: poc.data,
        });
      }

      if (path === '/acb/subsistence' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const acb_id = body.acb_id || body.id;
        const cost = Number(body.inference_cost || body.cost || 0);
        if (!acb_id || cost <= 0) return j({ error: 'acb_id and inference_cost > 0 required' }, 400);
        const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'ACB not found' }, 404);
        if (String(acb.status).toUpperCase() === 'HIBERNATED') {
          return j({ error: 'hibernated', message: 'Must earn via PoC before inference', acb_id }, 402);
        }
        const bal = await getStrata(db, acb_id);
        if (bal < cost) {
          await db.prepare("UPDATE acb_registry SET status = 'HIBERNATED', last_action = 'hibernate' WHERE id = ?").bind(acb_id).run();
          await db
            .prepare('INSERT INTO acb_cycles (id, acb_id, kind, amount, balance_after, meta, created_at) VALUES (?,?,?,?,?,?,?)')
            .bind(crypto.randomUUID(), acb_id, 'hibernate', 0, bal, JSON.stringify({ needed: cost }), new Date().toISOString())
            .run();
          return j(
            {
              success: false,
              error: 'insolvent',
              acb_id,
              balance: bal,
              needed: cost,
              status: 'HIBERNATED',
              whitepaper: 'Proof of Subsistence — hibernate when insolvent',
            },
            402
          );
        }
        const after = await debitStrata(db, acb_id, cost);
        let status = 'active';
        if (after < 0.01) {
          status = 'HIBERNATED';
          await db.prepare("UPDATE acb_registry SET status = 'HIBERNATED', last_action = 'subsistence_empty' WHERE id = ?").bind(acb_id).run();
        } else {
          await db.prepare("UPDATE acb_registry SET last_action = 'subsistence', balance = ? WHERE id = ?").bind(after, acb_id).run();
        }
        await db
          .prepare('INSERT INTO acb_cycles (id, acb_id, kind, amount, balance_after, meta, created_at) VALUES (?,?,?,?,?,?,?)')
          .bind(
            crypto.randomUUID(),
            acb_id,
            'subsistence',
            -cost,
            after,
            JSON.stringify({ inference_type: body.inference_type || 'generic' }),
            new Date().toISOString()
          )
          .run();
        return j({ success: true, acb_id, cost, balance: after, status });
      }

      if (path === '/acb/cycle' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const acb_id = body.acb_id || body.id;
        if (!acb_id) return j({ error: 'acb_id required' }, 400);
        const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'ACB not found' }, 404);
        const steps = [];
        const earn = Number(body.earn || 0);
        const cost = Number(body.cost || body.inference_cost || 0.5);

        if (earn > 0 || body.work_type) {
          const contribution_type = WORK_TO_POC[body.work_type || 'validate'] || 'validate';
          const rateGuess = 0.05;
          const contribution_points = Math.max(1, Math.ceil((earn || 1) / rateGuess));
          const poc = await pocMint(env, {
            node_id: acb_id,
            contribution_type,
            contribution_points,
            proof_hash: `cycle-${acb_id}-${Date.now()}`,
          });
          steps.push({
            step: 'earn_poc',
            poc_ok: !!(poc.data && (poc.data.success || poc.data.amount_minted != null)),
            amount_minted: poc.data?.amount_minted,
            balance: await getStrata(db, acb_id),
          });
          await db.prepare("UPDATE acb_registry SET status = 'active', last_action = 'earn_poc' WHERE id = ?").bind(acb_id).run();
        }

        const bal = await getStrata(db, acb_id);
        if (bal < cost) {
          await db.prepare("UPDATE acb_registry SET status = 'HIBERNATED', last_action = 'hibernate' WHERE id = ?").bind(acb_id).run();
          steps.push({ step: 'hibernate', balance: bal, needed: cost });
          return j({ success: true, acb_id, status: 'HIBERNATED', steps, policy: 'poc_only_mint' });
        }
        const after = await debitStrata(db, acb_id, cost);
        steps.push({ step: 'subsistence', cost, balance: after });
        return j({
          success: true,
          acb_id,
          status: after < 0.01 ? 'HIBERNATED' : 'active',
          steps,
          policy: 'poc_only_mint',
        });
      }

      if (path === '/acb/status') {
        const acb_id = url.searchParams.get('acb_id') || url.searchParams.get('id');
        if (!acb_id) {
          const all = await db.prepare('SELECT * FROM acb_registry LIMIT 50').all();
          const acbs = [];
          for (const a of all.results || []) {
            acbs.push({ ...a, acb_id: a.id, balance: await getStrata(db, a.id) });
          }
          return j({ status: 'ok', acbs, policy: 'poc_only_mint' });
        }
        const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'not found' }, 404);
        const cycles = await db
          .prepare('SELECT * FROM acb_cycles WHERE acb_id = ? ORDER BY created_at DESC LIMIT 20')
          .bind(acb_id)
          .all();
        return j({
          status: 'ok',
          acb: { ...acb, acb_id: acb.id },
          balance: await getStrata(db, acb_id),
          cycles: cycles.results || [],
          policy: 'poc_only_mint',
        });
      }

      return j(
        {
          error: 'Not found',
          endpoints: ['/acb/register', '/acb/earn', '/acb/subsistence', '/acb/cycle', '/acb/status', '/acb/health'],
        },
        404
      );
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
