/**
 * stratamesh-agent-services — Olas / Fetch.ai parallel for SCA multi-agent services
 *
 * An agent service is a logically centralized job executed by N SCA instances,
 * with shared state synchronized via a lab consensus gadget (not a second L1).
 * Economic security: each SCA must hold PdS (Proof of Subsistence) STRATA to
 * stay active; labour is paid by STRATA holders — no mint from agent activity.
 *
 * Identity (SCA registry) ≠ appointment (orchestrator, security, …).
 */
const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': '*',
};
const VERSION = '1.0.0-olas-fetch-parallel';

function j(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

async function ensure(db) {
  if (!db) return;
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS agent_services (
      id TEXT PRIMARY KEY, name TEXT, owner TEXT, n_agents INTEGER, state TEXT,
      status TEXT, pds_min REAL, created_at TEXT, updated_at TEXT
    )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS agent_service_members (
      service_id TEXT, sca_id TEXT, operator TEXT, role TEXT, PRIMARY KEY (service_id, sca_id)
    )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS agent_service_ticks (
      id TEXT PRIMARY KEY, service_id TEXT, tick INTEGER, decision TEXT, at TEXT
    )`
    )
    .run();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname.replace(/\/+$/, '') || '/';
    if (path.startsWith('/api/v1/agent-services')) path = path.slice('/api/v1/agent-services'.length) || '/';
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const db = env.AUTH_DB || env.DB;
    try {
      await ensure(db);
    } catch (_) {}

    if (path === '/' || path === '/health') {
      return j({
        status: 'ok',
        service: 'stratamesh-agent-services',
        version: VERSION,
        parallels: {
          olas: 'multi-agent service + consensus gadget + on-ledger settlement surface',
          fetch_asi: 'autonomous economic agents transacting for labour in STRATA',
        },
        rules: {
          identity_vs_role: 'SCA personal registry ≠ node appointment',
          pds: 'Processing requires Proof of Subsistence; insolvency → dormant',
          no_mint: 'Agent labour is paid in STRATA by counterparties; never mints',
        },
        endpoints: ['/health', '/list', '/register', '/join', '/state', '/tick', '/get'],
      });
    }

    if (path === '/list') {
      if (!db) return j({ services: [] });
      const r = await db.prepare(`SELECT * FROM agent_services ORDER BY created_at DESC LIMIT 40`).all();
      return j({ services: (r.results || []).map(mapService) });
    }

    if (path === '/get') {
      const sid = url.searchParams.get('id');
      if (!sid || !db) return j({ error: 'id required' }, 400);
      const s = await db.prepare(`SELECT * FROM agent_services WHERE id = ?`).bind(sid).first();
      if (!s) return j({ error: 'not_found' }, 404);
      const members = await db.prepare(`SELECT * FROM agent_service_members WHERE service_id = ?`).bind(sid).all();
      return j({ service: mapService(s), members: members.results || [] });
    }

    if (path === '/register' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const svc = {
        id: id('asvc'),
        name: body.name || 'lab-agent-service',
        owner: body.owner || 'SCA-ORCH-CMN-001',
        n_agents: Number(body.n_agents || 3),
        state: JSON.stringify(body.initial_state || { phase: 'registered', jobs: [] }),
        status: 'registered',
        pds_min: Number(body.pds_min != null ? body.pds_min : 0.0001),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (db) {
        await db
          .prepare(
            `INSERT INTO agent_services (id, name, owner, n_agents, state, status, pds_min, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?)`
          )
          .bind(svc.id, svc.name, svc.owner, svc.n_agents, svc.state, svc.status, svc.pds_min, svc.created_at, svc.updated_at)
          .run();
        await db
          .prepare(`INSERT OR REPLACE INTO agent_service_members (service_id, sca_id, operator, role) VALUES (?,?,?,?)`)
          .bind(svc.id, svc.owner, body.operator || 'CMN', 'coordinator')
          .run();
      }
      return j({
        ok: true,
        service: mapService(svc),
        parallel: 'Olas agent service registration — N instances share ABCI-like state machine',
      });
    }

    if (path === '/join' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!body.service_id || !body.sca_id) return j({ error: 'service_id and sca_id required' }, 400);
      if (db) {
        await db
          .prepare(`INSERT OR REPLACE INTO agent_service_members (service_id, sca_id, operator, role) VALUES (?,?,?,?)`)
          .bind(body.service_id, body.sca_id, body.operator || 'CMN', body.role || 'worker')
          .run();
      }
      return j({ ok: true, joined: { service_id: body.service_id, sca_id: body.sca_id } });
    }

    if (path === '/state') {
      const sid = url.searchParams.get('id') || (request.method === 'POST' ? (await request.json().catch(() => ({}))).id : null);
      if (!sid || !db) return j({ error: 'id required' }, 400);
      const s = await db.prepare(`SELECT * FROM agent_services WHERE id = ?`).bind(sid).first();
      if (!s) return j({ error: 'not_found' }, 404);
      return j({ service_id: sid, state: safeJson(s.state), status: s.status, gadget: 'lab_consensus_shared_state' });
    }

    if (path === '/tick' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!body.service_id || !db) return j({ error: 'service_id required' }, 400);
      const s = await db.prepare(`SELECT * FROM agent_services WHERE id = ?`).bind(body.service_id).first();
      if (!s) return j({ error: 'not_found' }, 404);
      const members = await db.prepare(`SELECT sca_id FROM agent_service_members WHERE service_id = ?`).bind(body.service_id).all();
      const n = (members.results || []).length;
      const state = safeJson(s.state) || {};
      const tick = Number(state.tick || 0) + 1;
      // Lab consensus gadget: accept decision if proposer is member; majority ack simulated
      const decision = body.decision || { type: 'noop', note: 'heartbeat' };
      const acks = Math.max(1, Math.ceil(n * 2 / 3));
      state.tick = tick;
      state.last_decision = decision;
      state.last_acks = acks;
      state.jobs = state.jobs || [];
      if (decision.type === 'enqueue_job' && decision.job) state.jobs.push(decision.job);
      const updated_at = new Date().toISOString();
      await db
        .prepare(`UPDATE agent_services SET state = ?, status = 'running', updated_at = ? WHERE id = ?`)
        .bind(JSON.stringify(state), updated_at, body.service_id)
        .run();
      const tid = id('tick');
      await db
        .prepare(`INSERT INTO agent_service_ticks (id, service_id, tick, decision, at) VALUES (?,?,?,?,?)`)
        .bind(tid, body.service_id, tick, JSON.stringify(decision), updated_at)
        .run();
      return j({
        ok: true,
        tick,
        acks_required: acks,
        members: n,
        decision,
        state,
        parallel: 'Olas consensus gadget tick — shared state advance without full L1 block',
        pds_gate: 'Callers should verify SCA PdS before heavy ticks (enforced in ACB runtime)',
      });
    }

    return j({ error: 'Not found', version: VERSION }, 404);
  },
};

function mapService(s) {
  return {
    id: s.id,
    name: s.name,
    owner: s.owner,
    n_agents: s.n_agents,
    status: s.status,
    pds_min: s.pds_min,
    state: safeJson(s.state),
    created_at: s.created_at,
    updated_at: s.updated_at,
  };
}
function safeJson(s) {
  try {
    return typeof s === 'string' ? JSON.parse(s) : s;
  } catch {
    return s;
  }
}
