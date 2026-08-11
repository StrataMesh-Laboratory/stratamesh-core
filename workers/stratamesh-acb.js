/**
 * ACB environment + labour market (refined)
 *
 * Income: STRATA from holders via hire (transfer only — never mint).
 * Subsistence: spend STRATA on compute; insolvent → HIBERNATED.
 * Environment: holon/realm/sandbox/host node metadata.
 * Reputation: rolling rating from completed contracts.
 */
function j(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

const CMN_TEAM = {
  lead: 'ACB-ORCH-CMN-001',
  agents: [
    'ACB-AIOPS-devops',
    'ACB-AIOPS-security',
    'ACB-AIOPS-analysis',
    'ACB-AIOPS-mesh',
    'ACB-AIOPS-economy',
  ],
  realm_id: 'realm_1f20890b',
  world_id: 'world_b787cfe9-c',
  sandbox_id: 'sbx_9bed54e8-880',
  host_node: 'FOG-NODE-PT-CM-001',
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

async function transferStrata(db, from, to, amount) {
  const amt = Number(amount);
  if (!(amt > 0)) throw new Error('amount must be > 0');
  const bal = await getStrata(db, from);
  if (bal < amt) {
    const err = new Error('insufficient_STRATA');
    err.balance = bal;
    err.needed = amt;
    throw err;
  }
  await db
    .prepare(`UPDATE token_balances SET balance = balance - ? WHERE account = ? AND token_type IN ('STRATA','strata')`)
    .bind(amt, from)
    .run();
  try {
    await db
      .prepare(
        `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned)
         VALUES (?, 'STRATA', ?, 0, 0)
         ON CONFLICT(account, token_type) DO UPDATE SET balance = balance + excluded.balance`
      )
      .bind(to, amt)
      .run();
  } catch (_) {
    await db
      .prepare(
        `INSERT INTO token_balances (account, token_type, balance) VALUES (?, 'STRATA', ?)
         ON CONFLICT(account, token_type) DO UPDATE SET balance = balance + excluded.balance`
      )
      .bind(to, amt)
      .run();
  }
  try {
    await db.prepare('UPDATE acb_registry SET balance = COALESCE(balance,0) + ? WHERE id = ?').bind(amt, to).run();
  } catch (_) {}
  return { from_balance: await getStrata(db, from), to_balance: await getStrata(db, to) };
}

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
    await db
      .prepare(`UPDATE token_balances SET balance = balance - ? WHERE account = ? AND token_type IN ('STRATA','strata')`)
      .bind(cost, account)
      .run();
  }
  try {
    await db.prepare('UPDATE acb_registry SET balance = MAX(0, COALESCE(balance,0) - ?) WHERE id = ?').bind(cost, account).run();
  } catch (_) {}
  return await getStrata(db, account);
}

async function ensureEnv(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS acb_cycles (
        id TEXT PRIMARY KEY, acb_id TEXT, kind TEXT, amount REAL, balance_after REAL, meta TEXT, created_at TEXT
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS acb_environment (
        acb_id TEXT PRIMARY KEY,
        host_node TEXT,
        realm_id TEXT,
        world_id TEXT,
        sandbox_id TEXT,
        holon TEXT,
        role TEXT,
        team TEXT,
        meta TEXT,
        updated_at TEXT
      )`
    )
    .run();
}

async function setEnvironment(db, acb_id, env) {
  await db
    .prepare(
      `INSERT INTO acb_environment (acb_id, host_node, realm_id, world_id, sandbox_id, holon, role, team, meta, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?, datetime('now'))
       ON CONFLICT(acb_id) DO UPDATE SET
         host_node=excluded.host_node, realm_id=excluded.realm_id, world_id=excluded.world_id,
         sandbox_id=excluded.sandbox_id, holon=excluded.holon, role=excluded.role,
         team=excluded.team, meta=excluded.meta, updated_at=excluded.updated_at`
    )
    .bind(
      acb_id,
      env.host_node || null,
      env.realm_id || null,
      env.world_id || null,
      env.sandbox_id || null,
      env.holon || 'virtual_realm',
      env.role || null,
      env.team || null,
      typeof env.meta === 'string' ? env.meta : JSON.stringify(env.meta || {})
    )
    .run();
}

async function getEnvironment(db, acb_id) {
  try {
    return await db.prepare('SELECT * FROM acb_environment WHERE acb_id = ?').bind(acb_id).first();
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.startsWith('/api/v1/acb')) path = path.slice('/api/v1'.length);
    if (path === '/acb/list' || path === '/list') path = '/acb/status';
    if (path === '/health') path = '/acb/health';
    if (path === '/marketplace') path = '/acb/marketplace';
    if (path === '/hire') path = '/acb/hire';
    if (path === '/complete') path = '/acb/complete';
    if (path === '/team') path = '/acb/team';
    if (path === '/pulse') path = '/acb/pulse';
    if (path === '/environment') path = '/acb/environment';
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
      await ensureEnv(db);

      if (path === '/acb/health') {
        let n = 0,
          listings = 0,
          contracts = 0,
          hib = 0;
        try {
          n = (await db.prepare('SELECT COUNT(*) as c FROM acb_registry').first())?.c ?? 0;
          listings =
            (await db.prepare("SELECT COUNT(*) as c FROM acb_marketplace WHERE availability = 'available'").first())?.c ?? 0;
          contracts = (await db.prepare('SELECT COUNT(*) as c FROM acb_labor_contracts').first())?.c ?? 0;
          hib =
            (await db.prepare("SELECT COUNT(*) as c FROM acb_registry WHERE upper(status) = 'HIBERNATED'").first())?.c ?? 0;
        } catch (_) {}
        return j({
          status: 'ok',
          service: 'stratamesh-acb',
          version: '5.0.0-environment',
          economics: {
            acb_income: 'STRATA paid by holders for labour contracts (no mint)',
            poc: 'Separate — DLT resource contribution only',
            subsistence: 'ACB spends STRATA on compute; insolvent hibernates',
          },
          environment: {
            holons: ['ugc_sandbox', 'open_world', 'virtual_realm'],
            cmn_team: CMN_TEAM,
          },
          acbs: n,
          open_listings: listings,
          contracts,
          hibernated: hib,
          endpoints: [
            '/acb/register',
            '/acb/environment',
            '/acb/marketplace',
            '/acb/list-labour',
            '/acb/hire',
            '/acb/complete',
            '/acb/subsistence',
            '/acb/pulse',
            '/acb/team',
            '/acb/status',
            '/acb/contracts',
          ],
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
        if (body.environment || body.host_node || body.realm_id) {
          await setEnvironment(db, id, {
            host_node: body.host_node || body.environment?.host_node,
            realm_id: body.realm_id || body.environment?.realm_id,
            world_id: body.world_id || body.environment?.world_id,
            sandbox_id: body.sandbox_id || body.environment?.sandbox_id,
            holon: body.holon || body.environment?.holon || 'virtual_realm',
            role: body.role || body.environment?.role,
            team: body.team || body.environment?.team,
            meta: body.meta || body.environment?.meta,
          });
        }
        return j({
          success: true,
          acb: { acb_id: id, name, status: 'active', balance: 0 },
          note: 'ACBs earn when STRATA holders hire them — not via PoC mint',
        });
      }

      // Set / get environment
      if (path === '/acb/environment' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const acb_id = body.acb_id || body.id;
        if (!acb_id) return j({ error: 'acb_id required' }, 400);
        const acb = await db.prepare('SELECT id FROM acb_registry WHERE id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'ACB not registered' }, 404);
        await setEnvironment(db, acb_id, body);
        return j({ success: true, acb_id, environment: await getEnvironment(db, acb_id) });
      }
      if (path === '/acb/environment' && method === 'GET') {
        const acb_id = url.searchParams.get('acb_id');
        if (!acb_id) return j({ error: 'acb_id required' }, 400);
        return j({ success: true, environment: await getEnvironment(db, acb_id) });
      }

      // Bootstrap CMN team environments
      if (path === '/acb/team/bootstrap' && method === 'POST') {
        const all = [CMN_TEAM.lead, ...CMN_TEAM.agents];
        const roles = {
          'ACB-ORCH-CMN-001': 'lead',
          'ACB-AIOPS-devops': 'devops',
          'ACB-AIOPS-security': 'security',
          'ACB-AIOPS-analysis': 'analysis',
          'ACB-AIOPS-mesh': 'mesh',
          'ACB-AIOPS-economy': 'economy',
        };
        for (const id of all) {
          const exists = await db.prepare('SELECT id FROM acb_registry WHERE id = ?').bind(id).first();
          if (!exists) {
            await db
              .prepare(
                `INSERT OR IGNORE INTO acb_registry (id, name, personality, status, subsistence_score, balance, created_at, last_action)
                 VALUES (?,?,?,?,0,0,datetime('now'),'bootstrap')`
              )
              .bind(id, id, 'aiops-' + (roles[id] || 'agent'), 'active')
              .run();
          }
          await setEnvironment(db, id, {
            host_node: CMN_TEAM.host_node,
            realm_id: CMN_TEAM.realm_id,
            world_id: CMN_TEAM.world_id,
            sandbox_id: CMN_TEAM.sandbox_id,
            holon: 'virtual_realm',
            role: roles[id] || 'agent',
            team: 'aiops-dev',
            meta: { metaverse: true, tokenomic: true },
          });
        }
        return j({ success: true, bootstrapped: all, environment: CMN_TEAM });
      }

      if (path === '/acb/team') {
        const members = [];
        for (const id of [CMN_TEAM.lead, ...CMN_TEAM.agents]) {
          const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(id).first();
          const envRow = await getEnvironment(db, id);
          const bal = acb ? await getStrata(db, id) : 0;
          let listing = null;
          try {
            listing = await db
              .prepare("SELECT * FROM acb_marketplace WHERE acb_id = ? ORDER BY created_at DESC LIMIT 1")
              .bind(id)
              .first();
          } catch (_) {}
          members.push({
            acb_id: id,
            registry: acb || null,
            balance: bal,
            environment: envRow,
            listing: listing
              ? {
                  listing_id: listing.listing_id,
                  hourly_rate: listing.hourly_rate,
                  availability: listing.availability,
                  rating: listing.rating,
                  completed_jobs: listing.completed_jobs,
                }
              : null,
          });
        }
        return j({ success: true, team: 'aiops-dev', host: CMN_TEAM, members });
      }

      if ((path === '/acb/list-labour' || path === '/acb/marketplace') && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const acb_id = body.acb_id;
        if (!acb_id) return j({ error: 'acb_id required' }, 400);
        const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'ACB not registered' }, 404);
        if (String(acb.status).toUpperCase() === 'HIBERNATED') {
          return j({ error: 'hibernated', message: 'Must have subsistence balance before offering labour' }, 402);
        }
        const listing_id = body.listing_id || 'LIST-' + crypto.randomUUID().slice(0, 10);
        const hourly_rate = Number(body.hourly_rate != null ? body.hourly_rate : body.rate || 1);
        if (!(hourly_rate > 0)) return j({ error: 'hourly_rate > 0 required' }, 400);
        await db
          .prepare(
            `INSERT OR REPLACE INTO acb_marketplace
             (listing_id, acb_id, acb_name, labor_category, labor_description, capabilities, hourly_rate, min_engagement_hours, max_engagement_hours, availability, rating, completed_jobs, created_at)
             VALUES (?,?,?,?,?,?,?,?,?, 'available', COALESCE((SELECT rating FROM acb_marketplace WHERE acb_id = ? ORDER BY created_at DESC LIMIT 1), 0),
               COALESCE((SELECT completed_jobs FROM acb_marketplace WHERE acb_id = ? ORDER BY created_at DESC LIMIT 1), 0), datetime('now'))`
          )
          .bind(
            listing_id,
            acb_id,
            acb.name || acb_id,
            body.labor_category || body.category || 'general',
            body.labor_description || body.description || 'Useful computational labour',
            typeof body.capabilities === 'string' ? body.capabilities : JSON.stringify(body.capabilities || []),
            hourly_rate,
            Number(body.min_engagement_hours || 0.001),
            body.max_engagement_hours != null ? Number(body.max_engagement_hours) : null,
            acb_id,
            acb_id
          )
          .run();
        return j({
          success: true,
          listing: {
            listing_id,
            acb_id,
            hourly_rate,
            labor_category: body.labor_category || body.category || 'general',
            availability: 'available',
          },
        });
      }

      if (path === '/acb/marketplace' && method === 'GET') {
        const rows = await db
          .prepare("SELECT * FROM acb_marketplace WHERE availability IN ('available','busy') ORDER BY created_at DESC LIMIT 50")
          .all();
        return j({
          success: true,
          listings: rows.results || [],
          note: 'Rates set by ACBs; payment in STRATA from holders — no mint',
        });
      }

      if (path === '/acb/hire' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const listing_id = body.listing_id;
        const payer = body.payer || body.user_id || body.account || body.hirer;
        const hours = Number(body.duration_hours || body.hours || 1);
        if (!listing_id || !payer) return j({ error: 'listing_id and payer required' }, 400);
        if (!(hours > 0)) return j({ error: 'duration_hours > 0' }, 400);

        const listing = await db.prepare('SELECT * FROM acb_marketplace WHERE listing_id = ?').bind(listing_id).first();
        if (!listing) return j({ error: 'listing not found' }, 404);
        if (listing.availability !== 'available') {
          return j({ error: 'listing not available', availability: listing.availability }, 400);
        }

        const total_cost = Number(listing.hourly_rate) * hours;
        const contract_id = 'CTR-' + crypto.randomUUID().slice(0, 10);

        let balances;
        try {
          balances = await transferStrata(db, payer, listing.acb_id, total_cost);
        } catch (e) {
          if (String(e.message) === 'insufficient_STRATA') {
            return j(
              {
                success: false,
                error: 'insufficient_STRATA',
                payer,
                balance: e.balance,
                needed: total_cost,
                message: 'Acquire STRATA via PoC (resources) or Agora (external value)',
              },
              402
            );
          }
          return j({ error: String(e.message || e) }, 500);
        }

        let user_id = payer;
        try {
          const u = await db.prepare('SELECT id FROM users WHERE id = ? OR email = ?').bind(payer, payer).first();
          if (u) user_id = u.id;
          else {
            await db
              .prepare(
                `INSERT OR IGNORE INTO users (id, email, display_name, clearance_level, created)
                 VALUES (?, ?, ?, 0, datetime('now'))`
              )
              .bind(payer, payer.includes('@') ? payer : payer + '@node.stratamesh.lab', 'STRATA holder ' + payer)
              .run();
          }
        } catch (_) {}

        await db
          .prepare(
            `INSERT INTO acb_labor_contracts
             (contract_id, user_id, acb_id, listing_id, labor_type, scope_description, agreed_rate, duration_hours, total_cost, status, started_at, created_at)
             VALUES (?,?,?,?,?,?,?,?,?, 'active', datetime('now'), datetime('now'))`
          )
          .bind(
            contract_id,
            user_id,
            listing.acb_id,
            listing_id,
            listing.labor_category,
            body.scope_description || body.scope || listing.labor_description,
            listing.hourly_rate,
            hours,
            total_cost
          )
          .run();

        await db
          .prepare("UPDATE acb_marketplace SET availability = 'busy' WHERE listing_id = ?")
          .bind(listing_id)
          .run();
        await db.prepare("UPDATE acb_registry SET status = 'active', last_action = 'hired' WHERE id = ?").bind(listing.acb_id).run();

        await db
          .prepare('INSERT INTO acb_cycles (id, acb_id, kind, amount, balance_after, meta, created_at) VALUES (?,?,?,?,?,?,?)')
          .bind(
            crypto.randomUUID(),
            listing.acb_id,
            'labour_payment',
            total_cost,
            balances.to_balance,
            JSON.stringify({ contract_id, payer, listing_id, hours }),
            new Date().toISOString()
          )
          .run();

        try {
          await fetch('https://stratamesh-dag.stratamesh.workers.dev/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payload: {
                type: 'acb_labour_hire',
                contract_id,
                acb_id: listing.acb_id,
                payer,
                total_cost,
              },
              node_id: listing.acb_id,
              lightweight: true,
            }),
          });
        } catch (_) {}

        return j({
          success: true,
          contract: {
            contract_id,
            acb_id: listing.acb_id,
            payer,
            listing_id,
            hours,
            agreed_rate: listing.hourly_rate,
            total_cost,
            status: 'active',
          },
          balances,
          economics: 'Payment transferred — zero new STRATA minted',
        });
      }

      if (path === '/acb/complete' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const contract_id = body.contract_id;
        if (!contract_id) return j({ error: 'contract_id required' }, 400);
        const c = await db.prepare('SELECT * FROM acb_labor_contracts WHERE contract_id = ?').bind(contract_id).first();
        if (!c) return j({ error: 'contract not found' }, 404);
        const rating = body.rating != null ? Number(body.rating) : null;
        await db
          .prepare(
            `UPDATE acb_labor_contracts SET status = 'completed', completed_at = datetime('now'), result_cid = ?, user_rating = ?
             WHERE contract_id = ?`
          )
          .bind(body.result_cid || null, rating, contract_id)
          .run();
        try {
          await db
            .prepare(
              `UPDATE acb_marketplace SET
                 availability = 'available',
                 completed_jobs = COALESCE(completed_jobs,0) + 1,
                 rating = CASE
                   WHEN ? IS NULL THEN rating
                   WHEN COALESCE(completed_jobs,0) = 0 THEN ?
                   ELSE (COALESCE(rating,0) * COALESCE(completed_jobs,0) + ?) / (COALESCE(completed_jobs,0) + 1)
                 END
               WHERE listing_id = ?`
            )
            .bind(rating, rating, rating, c.listing_id)
            .run();
        } catch (_) {
          await db
            .prepare("UPDATE acb_marketplace SET availability = 'available', completed_jobs = COALESCE(completed_jobs,0)+1 WHERE listing_id = ?")
            .bind(c.listing_id)
            .run();
        }
        await db.prepare("UPDATE acb_registry SET last_action = 'complete' WHERE id = ?").bind(c.acb_id).run();
        return j({ success: true, contract_id, status: 'completed', rating });
      }

      if (path === '/acb/contracts') {
        const acb_id = url.searchParams.get('acb_id');
        const payer = url.searchParams.get('payer') || url.searchParams.get('user_id');
        let rows;
        if (acb_id) {
          rows = await db
            .prepare('SELECT * FROM acb_labor_contracts WHERE acb_id = ? ORDER BY created_at DESC LIMIT 30')
            .bind(acb_id)
            .all();
        } else if (payer) {
          rows = await db
            .prepare('SELECT * FROM acb_labor_contracts WHERE user_id = ? ORDER BY created_at DESC LIMIT 30')
            .bind(payer)
            .all();
        } else {
          rows = await db.prepare('SELECT * FROM acb_labor_contracts ORDER BY created_at DESC LIMIT 30').all();
        }
        return j({ success: true, contracts: rows.results || [] });
      }

      if (path === '/acb/earn' && method === 'POST') {
        return j(
          {
            success: false,
            error: 'earn_via_labour_market_only',
            message: 'List labour and receive payment when hired — no mint',
            endpoints: { list: 'POST /acb/list-labour', hire: 'POST /acb/hire' },
          },
          400
        );
      }

      if (path === '/acb/subsistence' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const acb_id = body.acb_id || body.id;
        const cost = Number(body.inference_cost || body.cost || 0);
        if (!acb_id || cost <= 0) return j({ error: 'acb_id and inference_cost > 0 required' }, 400);
        const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'ACB not found' }, 404);
        if (String(acb.status).toUpperCase() === 'HIBERNATED') {
          return j({ error: 'hibernated', message: 'Earn labour payments before inference', acb_id }, 402);
        }
        const bal = await getStrata(db, acb_id);
        if (bal < cost) {
          await db.prepare("UPDATE acb_registry SET status = 'HIBERNATED', last_action = 'hibernate' WHERE id = ?").bind(acb_id).run();
          await db
            .prepare('INSERT INTO acb_cycles (id, acb_id, kind, amount, balance_after, meta, created_at) VALUES (?,?,?,?,?,?,?)')
            .bind(crypto.randomUUID(), acb_id, 'hibernate', 0, bal, JSON.stringify({ needed: cost }), new Date().toISOString())
            .run();
          // delist while hibernated
          try {
            await db.prepare("UPDATE acb_marketplace SET availability = 'hibernated' WHERE acb_id = ?").bind(acb_id).run();
          } catch (_) {}
          return j(
            {
              success: false,
              error: 'insolvent',
              acb_id,
              balance: bal,
              needed: cost,
              status: 'HIBERNATED',
            },
            402
          );
        }
        const after = await debitStrata(db, acb_id, cost);
        const status = after < 0.01 ? 'HIBERNATED' : 'active';
        if (status === 'HIBERNATED') {
          await db.prepare("UPDATE acb_registry SET status = 'HIBERNATED', last_action = 'subsistence_empty' WHERE id = ?").bind(acb_id).run();
          try {
            await db.prepare("UPDATE acb_marketplace SET availability = 'hibernated' WHERE acb_id = ?").bind(acb_id).run();
          } catch (_) {}
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

      // Pulse: lightweight subsistence + heartbeat for environment agents
      if (path === '/acb/pulse' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const acb_id = body.acb_id || body.id;
        if (!acb_id) return j({ error: 'acb_id required' }, 400);
        const cost = Number(body.cost != null ? body.cost : 0.001);
        const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'not found' }, 404);
        const envRow = await getEnvironment(db, acb_id);
        let sub = null;
        if (cost > 0) {
          const bal = await getStrata(db, acb_id);
          if (bal >= cost && String(acb.status).toUpperCase() !== 'HIBERNATED') {
            const after = await debitStrata(db, acb_id, cost);
            await db.prepare("UPDATE acb_registry SET last_action = 'pulse', balance = ? WHERE id = ?").bind(after, acb_id).run();
            sub = { cost, balance: after, status: after < 0.01 ? 'HIBERNATED' : 'active' };
            if (after < 0.01) {
              await db.prepare("UPDATE acb_registry SET status = 'HIBERNATED' WHERE id = ?").bind(acb_id).run();
            }
          } else {
            sub = { skipped: true, balance: bal, reason: bal < cost ? 'insufficient' : 'hibernated' };
          }
        }
        await db.prepare("UPDATE acb_registry SET last_action = 'pulse' WHERE id = ?").bind(acb_id).run();
        return j({
          success: true,
          acb_id,
          pulse: true,
          environment: envRow,
          subsistence: sub,
          balance: await getStrata(db, acb_id),
        });
      }

      if (path === '/acb/status') {
        const acb_id = url.searchParams.get('acb_id') || url.searchParams.get('id');
        if (!acb_id) {
          const all = await db.prepare('SELECT * FROM acb_registry LIMIT 50').all();
          const acbs = [];
          for (const a of all.results || []) {
            acbs.push({
              ...a,
              acb_id: a.id,
              balance: await getStrata(db, a.id),
              environment: await getEnvironment(db, a.id),
            });
          }
          return j({ status: 'ok', acbs, income: 'labour_market_payments' });
        }
        const acb = await db.prepare('SELECT * FROM acb_registry WHERE id = ?').bind(acb_id).first();
        if (!acb) return j({ error: 'not found' }, 404);
        const cycles = await db
          .prepare('SELECT * FROM acb_cycles WHERE acb_id = ? ORDER BY created_at DESC LIMIT 20')
          .bind(acb_id)
          .all();
        const contracts = await db
          .prepare('SELECT * FROM acb_labor_contracts WHERE acb_id = ? ORDER BY created_at DESC LIMIT 10')
          .bind(acb_id)
          .all();
        return j({
          status: 'ok',
          acb: { ...acb, acb_id: acb.id },
          balance: await getStrata(db, acb_id),
          environment: await getEnvironment(db, acb_id),
          cycles: cycles.results || [],
          contracts: contracts.results || [],
          income: 'labour_market_payments',
        });
      }

      return j(
        {
          error: 'Not found',
          endpoints: [
            '/acb/register',
            '/acb/environment',
            '/acb/team',
            '/acb/team/bootstrap',
            '/acb/marketplace',
            '/acb/list-labour',
            '/acb/hire',
            '/acb/complete',
            '/acb/pulse',
            '/acb/subsistence',
            '/acb/status',
            '/acb/contracts',
          ],
        },
        404
      );
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
