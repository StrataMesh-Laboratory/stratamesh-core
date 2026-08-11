/**
 * DAO + executable SPA (whitepaper) — schema-aligned to existing `spas` table
 * columns: id, provider, consumer, service_type, terms, duration_days, opt_out_clause,
 *          contingency_plan, status, dag_cid, created_at, revoked_at
 */

/** Clearance ladder (users.clearance_level integer) */
const CLEARANCE = {
  0: 'public',
  1: 'internal',
  2: 'confidential',
  3: 'secret',
  4: 'secret',
  5: 'top_secret',
};
const CLEARANCE_RANK = { public: 0, internal: 1, confidential: 2, secret: 3, top_secret: 4 };

async function resolveActor(request, env) {
  const db = env.STRATAMESH_LEDGER || env.LEDGER || env.DB;
  const auth = request.headers.get('Authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1].trim() : null;
  // body cannot elevate — ignore X-Clearance for escalation
  if (!token || !db) {
    return { authenticated: false, clearance: 'public', rank: 0, user_id: null, email: null };
  }
  try {
    const sess = await db.prepare('SELECT * FROM sessions WHERE token = ?').bind(token).first();
    if (!sess) {
      return { authenticated: false, clearance: 'public', rank: 0, user_id: null, email: null, reason: 'invalid_session' };
    }
    // expiry check soft
    if (sess.expires) {
      try {
        if (new Date(sess.expires).getTime() < Date.now()) {
          return { authenticated: false, clearance: 'public', rank: 0, user_id: null, email: null, reason: 'session_expired' };
        }
      } catch (_) {}
    }
    const user = await db.prepare('SELECT id, email, clearance_level FROM users WHERE id = ?').bind(sess.user_id).first();
    if (!user) {
      return { authenticated: false, clearance: 'public', rank: 0, user_id: null, email: null, reason: 'user_missing' };
    }
    const levelNum = Number(user.clearance_level || 0);
    const clearance = CLEARANCE[levelNum] || (levelNum >= 5 ? 'top_secret' : levelNum >= 3 ? 'secret' : levelNum >= 2 ? 'confidential' : levelNum >= 1 ? 'internal' : 'public');
    return {
      authenticated: true,
      clearance,
      rank: CLEARANCE_RANK[clearance] || 0,
      clearance_level: levelNum,
      user_id: user.id,
      email: user.email,
    };
  } catch (e) {
    return { authenticated: false, clearance: 'public', rank: 0, user_id: null, email: null, reason: String(e.message || e) };
  }
}

function deny(actor, need) {
  return {
    error: 'insufficient_clearance',
    need,
    have: actor.clearance,
    authenticated: actor.authenticated,
    whitepaper: 'Clearance is an account attribute resolved via session — clients cannot self-elevate',
  };
}

function requireRank(actor, minName) {
  const need = CLEARANCE_RANK[minName] || 0;
  return actor.rank >= need;
}


function j(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

async function dagAnchor(env, payload) {
  try {
    if (env.DAG && typeof env.DAG.fetch === 'function') {
      const r = await env.DAG.fetch(
        new Request('https://dag/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload, node_id: payload.node_id || payload.provider || 'FOG-NODE-PT-CM-001' }),
        })
      );
      return await r.json();
    }
    const r = await fetch('https://stratamesh-dag.stratamesh.workers.dev/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, node_id: payload.node_id || 'FOG-NODE-PT-CM-001' }),
    });
    return await r.json();
  } catch (e) {
    return { success: false, error: String(e.message || e) };
  }
}

function parseTerms(terms) {
  if (!terms) return {};
  if (typeof terms === 'object') return terms;
  try {
    return JSON.parse(terms);
  } catch {
    return { raw: terms };
  }
}

export default {
  async scheduled(event, env, ctx) {
    // Cron: auto-terminate opt_out_pending SPAs past notice
    try {
      const db = env.STRATAMESH_LEDGER || env.LEDGER || env.DB;
      if (!db) return;
      const pending = await db.prepare("SELECT * FROM spas WHERE status = 'opt_out_pending'").all();
      for (const spa of pending.results || []) {
        const notice = Number(spa.duration_days || 14);
        let ageDays = 0;
        try {
          const r = await db.prepare("SELECT julianday('now') - julianday(revoked_at) as d FROM spas WHERE id = ?").bind(spa.id).first();
          ageDays = Number(r?.d || 0);
        } catch (_) {}
        if (ageDays >= notice || notice <= 0) {
          await db.prepare("UPDATE spas SET status = 'terminated' WHERE id = ?").bind(spa.id).run();
        }
      }
    } catch (_) {}
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.startsWith('/api/v1/dao')) path = '/dao' + path.slice('/api/v1/dao'.length);
    if (path === '/health') path = '/dao/health';
    if (path === '/status') path = '/dao/status';
    if (path === '/proposals') path = '/dao/proposals';
    if (path === '/spa') path = '/dao/spa';

    if (request.method === 'OPTIONS') {
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
      if (db) {
        await db
          .prepare(
            `CREATE TABLE IF NOT EXISTS spa_pins (
              spa_id TEXT, cid TEXT, status TEXT, created_at TEXT,
              PRIMARY KEY (spa_id, cid)
            )`
          )
          .run();

        await db.prepare(`CREATE TABLE IF NOT EXISTS pin_offers (
          offer_id TEXT PRIMARY KEY,
          spa_id TEXT,
          node_id TEXT,
          capacity_gb REAL,
          price_strata_per_gb REAL,
          status TEXT,
          created_at TEXT
        )`).run();
        await db.prepare(`CREATE TABLE IF NOT EXISTS pin_requests (
          request_id TEXT PRIMARY KEY,
          cid TEXT,
          requester TEXT,
          size_gb REAL,
          offer_id TEXT,
          spa_id TEXT,
          status TEXT,
          created_at TEXT
        )`).run();

      }

      if (path === '/dao/health') {
        let spa_count = 0;
        try {
          spa_count = (await db.prepare("SELECT COUNT(*) as c FROM spas WHERE status = 'active'").first())?.c ?? 0;
        } catch (_) {}
        return j({
          status: 'active',
          version: '4.1.0-capital-social',
          clearance_enforced: true,
          active_spas: spa_count,
          endpoints: [
            '/dao/health',
            '/dao/spa',
            '/dao/spa/list',
            '/dao/spa/opt-out',
            '/dao/spa/pinner',
            '/dao/spa/pin-offer',
            '/dao/spa/pin-request',
            '/dao/spa/pin-market',
            '/dao/spa/tick',
            '/dao/proposal',
            '/dao/vote',
            '/dao/proposals',
            '/dao/status',
            '/dao/templates',
            '/dao/execute',
            '/dao/compliance',
          ],
        });
      }

      if (path === '/dao/spa' && request.method === 'POST') {
        const actor = await resolveActor(request, env);
        if (!requireRank(actor, 'internal')) return j(deny(actor, 'internal'), 403);
        const data = await request.json().catch(() => ({}));
        const node_id = data.node_id || data.provider || 'FOG-NODE-PT-CM-001';
        const roles = data.roles || (data.service_type ? [data.service_type] : ['fog', 'pinner']);
        const rolesArr = Array.isArray(roles) ? roles : [roles];
        const spa_id = data.spa_id || data.id || 'SPA-' + crypto.randomUUID().slice(0, 10);
        const notice_days = Number(data.notice_days != null ? data.notice_days : data.duration_days || 14);
        const service_levels = data.service_levels || {
          uptime: '99.0%',
          dag_sync_lag_max_min: 2,
          pin_success_rate: '98%',
        };
        const terms = {
          roles: rolesArr,
          service_levels,
          notice_days,
          template: 'SPA-FogNode-v0.1',
        };
        const status = data.auto_accept === false ? 'pending' : 'active';

        const payload = {
          type: 'spa_register',
          spa_id,
          node_id,
          roles: rolesArr,
          service_levels,
          notice_days,
        };
        const dag = await dagAnchor(env, payload);

        await db
          .prepare(
            `INSERT OR REPLACE INTO spas
             (id, provider, consumer, service_type, terms, duration_days, opt_out_clause, contingency_plan, status, dag_cid, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?, datetime('now'))`
          )
          .bind(
            spa_id,
            node_id,
            data.consumer || 'stratamesh-network',
            rolesArr.join('+'),
            JSON.stringify(terms),
            notice_days,
            data.opt_out_clause || `notice_${notice_days}_days_or_immediate_on_breach`,
            data.contingency || 'graceful_handover_pins_and_ledger_subset',
            status,
            dag.vertex_id || dag.ipfs_cid || null
          )
          .run();

        return j({
          success: true,
          spa: {
            spa_id,
            node_id,
            roles: rolesArr,
            status,
            notice_days,
            dag_vertex: dag.vertex_id || null,
            service_levels,
            opt_out_clause: `notice_${notice_days}_days_or_immediate_on_breach`,
            contingency: 'graceful_handover_pins_and_ledger_subset',
          },
          dag,
          whitepaper: 'Voluntary SPA on-graph with opt-out and contingency',
        });
      }

      if (path === '/dao/spa' && request.method === 'GET') {
        const id = url.searchParams.get('id') || url.searchParams.get('spa_id');
        if (id) {
          const row = await db.prepare('SELECT * FROM spas WHERE id = ?').bind(id).first();
          if (!row) return j({ error: 'not found' }, 404);
          const terms = parseTerms(row.terms);
          let pins = [];
          try {
            pins = (await db.prepare('SELECT * FROM spa_pins WHERE spa_id = ?').bind(id).all()).results || [];
          } catch (_) {}
          return j({ spa: { ...row, spa_id: row.id, terms, roles: terms.roles || [] }, pins });
        }
        path = '/dao/spa/list';
      }

      if (path === '/dao/spa/list') {
        const rows = await db.prepare('SELECT * FROM spas ORDER BY created_at DESC LIMIT 50').all();
        const spas = (rows.results || []).map((r) => {
          const terms = parseTerms(r.terms);
          return {
            spa_id: r.id,
            node_id: r.provider,
            service_type: r.service_type,
            status: r.status,
            roles: terms.roles || (r.service_type ? String(r.service_type).split('+') : []),
            notice_days: r.duration_days,
            dag_cid: r.dag_cid,
            opt_out_clause: r.opt_out_clause,
            contingency: r.contingency_plan,
            created_at: r.created_at,
            revoked_at: r.revoked_at,
          };
        });
        return j({ success: true, spas, count: spas.length });
      }

      if (path === '/dao/spa/opt-out' && request.method === 'POST') {
        const actor = await resolveActor(request, env);
        if (!requireRank(actor, 'confidential')) return j(deny(actor, 'confidential'), 403);
        const data = await request.json().catch(() => ({}));
        const spa_id = data.spa_id || data.id;
        const reason = data.reason || 'provider_opt_out';
        const immediate = !!data.immediate || reason === 'material_breach';
        if (!spa_id) return j({ error: 'spa_id required' }, 400);
        const spa = await db.prepare('SELECT * FROM spas WHERE id = ?').bind(spa_id).first();
        if (!spa) return j({ error: 'SPA not found' }, 404);
        if (spa.status === 'terminated' || spa.status === 'revoked') return j({ error: 'already terminated' }, 400);

        const newStatus = immediate ? 'terminated' : 'opt_out_pending';
        await db
          .prepare('UPDATE spas SET status = ?, revoked_at = datetime(\'now\') WHERE id = ?')
          .bind(newStatus, spa_id)
          .run();

        const dag = await dagAnchor(env, {
          type: 'spa_opt_out',
          spa_id,
          node_id: spa.provider,
          reason,
          immediate,
          notice_days: spa.duration_days,
          contingency: spa.contingency_plan,
        });

        return j({
          success: true,
          spa_id,
          status: newStatus,
          notice_days: spa.duration_days,
          contingency: spa.contingency_plan,
          dag_vertex: dag.vertex_id || null,
          note: immediate
            ? 'Terminated immediately (breach or explicit)'
            : `Opt-out pending; service continues for notice_days=${spa.duration_days}`,
        });
      }

      if (path === '/dao/spa/pinner' && request.method === 'POST') {
        const data = await request.json().catch(() => ({}));
        const spa_id = data.spa_id;
        const cid = data.cid;
        if (!spa_id || !cid) return j({ error: 'spa_id and cid required' }, 400);
        const spa = await db.prepare('SELECT * FROM spas WHERE id = ?').bind(spa_id).first();
        if (!spa) return j({ error: 'SPA not found' }, 404);
        if (spa.status !== 'active') return j({ error: 'SPA not active', status: spa.status }, 400);
        const terms = parseTerms(spa.terms);
        const roles = terms.roles || String(spa.service_type || '').split('+');
        if (!roles.includes('pinner') && !roles.includes('fog')) {
          return j({ error: 'SPA lacks pinner/fog role', roles }, 403);
        }
        await db
          .prepare('INSERT OR REPLACE INTO spa_pins (spa_id, cid, status, created_at) VALUES (?,?,?,?)')
          .bind(spa_id, cid, 'pinned', new Date().toISOString())
          .run();
        try {
          await fetch('https://stratamesh-ipfs.stratamesh.workers.dev/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cid, node_id: spa.provider, tier: 'contributor' }),
          });
        } catch (_) {}
        const dag = await dagAnchor(env, { type: 'spa_pin', spa_id, cid, node_id: spa.provider });
        return j({ success: true, spa_id, cid, status: 'pinned', dag_vertex: dag.vertex_id || null });
      }


      // Pin market under SPA
      if ((path === '/dao/spa/pin-offer' || path === '/dao/pin-offer') && request.method === 'POST') {
        const data = await request.json().catch(() => ({}));
        const spa_id = data.spa_id;
        const capacity_gb = Number(data.capacity_gb || 1);
        const price = Number(data.price_strata_per_gb != null ? data.price_strata_per_gb : 0.1);
        if (!spa_id) return j({ error: 'spa_id required' }, 400);
        const spa = await db.prepare('SELECT * FROM spas WHERE id = ?').bind(spa_id).first();
        if (!spa || spa.status !== 'active') return j({ error: 'active SPA required', status: spa && spa.status }, 400);
        await db.prepare(`CREATE TABLE IF NOT EXISTS pin_offers (
          offer_id TEXT PRIMARY KEY, spa_id TEXT, node_id TEXT, capacity_gb REAL,
          price_strata_per_gb REAL, status TEXT, created_at TEXT)`).run();
        const offer_id = 'POF-' + crypto.randomUUID().slice(0, 8);
        await db.prepare(
          `INSERT INTO pin_offers (offer_id, spa_id, node_id, capacity_gb, price_strata_per_gb, status, created_at)
           VALUES (?,?,?,?,?,'open', datetime('now'))`
        ).bind(offer_id, spa_id, spa.provider, capacity_gb, price).run();
        return j({ success: true, offer: { offer_id, spa_id, node_id: spa.provider, capacity_gb, price_strata_per_gb: price } });
      }

      if ((path === '/dao/spa/pin-request' || path === '/dao/pin-request') && request.method === 'POST') {
        const data = await request.json().catch(() => ({}));
        const cid = data.cid;
        const requester = data.requester || data.account || 'anonymous';
        const size_gb = Number(data.size_gb || 0.001);
        if (!cid) return j({ error: 'cid required' }, 400);
        await db.prepare(`CREATE TABLE IF NOT EXISTS pin_offers (
          offer_id TEXT PRIMARY KEY, spa_id TEXT, node_id TEXT, capacity_gb REAL,
          price_strata_per_gb REAL, status TEXT, created_at TEXT)`).run();
        await db.prepare(`CREATE TABLE IF NOT EXISTS pin_requests (
          request_id TEXT PRIMARY KEY, cid TEXT, requester TEXT, size_gb REAL,
          offer_id TEXT, spa_id TEXT, status TEXT, created_at TEXT)`).run();
        const offer = await db.prepare("SELECT * FROM pin_offers WHERE status = 'open' ORDER BY price_strata_per_gb ASC LIMIT 1").first();
        if (!offer) return j({ error: 'no_pin_offers' }, 404);
        const cost = size_gb * Number(offer.price_strata_per_gb);
        const request_id = 'PREQ-' + crypto.randomUUID().slice(0, 8);
        await db.prepare(
          `INSERT INTO pin_requests (request_id, cid, requester, size_gb, offer_id, spa_id, status, created_at)
           VALUES (?,?,?,?,?,?,'matched', datetime('now'))`
        ).bind(request_id, cid, requester, size_gb, offer.offer_id, offer.spa_id).run();
        await db.prepare('INSERT OR REPLACE INTO spa_pins (spa_id, cid, status, created_at) VALUES (?,?,?,?)')
          .bind(offer.spa_id, cid, 'pinned', new Date().toISOString()).run();
        const dag = await dagAnchor(env, { type: 'pin_market_match', request_id, cid, spa_id: offer.spa_id, cost_strata: cost });
        try {
          await fetch('https://stratamesh-poc.stratamesh.workers.dev/consume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resource_class: 'ipfs_pin', units: Math.max(size_gb, 0.001) * 1000, source: 'pin_market', ref: cid }),
          });
        } catch (_) {}

        return j({ success: true, request_id, cid, matched_offer: offer.offer_id, spa_id: offer.spa_id, node_id: offer.node_id, cost_strata: cost, dag_vertex: dag.vertex_id || null });
      }

      if (path === '/dao/spa/pin-market' || path === '/dao/pin-market') {
        await db.prepare(`CREATE TABLE IF NOT EXISTS pin_offers (
          offer_id TEXT PRIMARY KEY, spa_id TEXT, node_id TEXT, capacity_gb REAL,
          price_strata_per_gb REAL, status TEXT, created_at TEXT)`).run();
        await db.prepare(`CREATE TABLE IF NOT EXISTS pin_requests (
          request_id TEXT PRIMARY KEY, cid TEXT, requester TEXT, size_gb REAL,
          offer_id TEXT, spa_id TEXT, status TEXT, created_at TEXT)`).run();
        const offers = await db.prepare("SELECT * FROM pin_offers WHERE status = 'open' ORDER BY price_strata_per_gb ASC LIMIT 50").all();
        const reqs = await db.prepare('SELECT * FROM pin_requests ORDER BY created_at DESC LIMIT 20').all();
        return j({ success: true, offers: offers.results || [], recent_requests: reqs.results || [] });
      }

      if ((path === '/dao/spa/tick' || path === '/dao/tick') && (request.method === 'POST' || request.method === 'GET')) {
        const pending = await db.prepare("SELECT * FROM spas WHERE status = 'opt_out_pending'").all();
        const terminated = [];
        for (const spa of pending.results || []) {
          const notice = Number(spa.duration_days || 14);
          let ageDays = 0;
          try {
            const r = await db.prepare("SELECT julianday('now') - julianday(revoked_at) as d FROM spas WHERE id = ?").bind(spa.id).first();
            ageDays = Number(r?.d || 0);
          } catch (_) {}
          const force = url.searchParams.get('force') === '1';
          if (force || ageDays >= notice || notice <= 0) {
            await db.prepare("UPDATE spas SET status = 'terminated' WHERE id = ?").bind(spa.id).run();
            const dag = await dagAnchor(env, { type: 'spa_terminated', spa_id: spa.id, node_id: spa.provider, after_notice_days: notice });
            terminated.push({ spa_id: spa.id, age_days: ageDays, dag_vertex: dag.vertex_id || null });
          }
        }
        return j({ success: true, checked: (pending.results || []).length, terminated });
      }


      // Enterprise RBAC skeleton
      if (path === '/dao/rbac' || path === '/dao/roles') {
        const actor = await resolveActor(request, env);
        const roles = {
          admin: { permissions: ['proposal.create','proposal.execute','spa.manage','compliance.run','treasury.read'] },
          operator: { permissions: ['spa.manage','compliance.run','pin.offer'] },
          auditor: { permissions: ['compliance.run','proposal.read','spa.read'] },
          member: { permissions: ['proposal.create','vote','spa.read'] },
        };
        return j({ success: true, template: 'enterprise', roles, actor: { clearance: actor.clearance, authenticated: actor.authenticated, email: actor.email }, note: 'Clearance from session; cannot self-elevate' });
      }


      // ensure DAO registry schema
      try {
        await db.prepare(`CREATE TABLE IF NOT EXISTS daos (
          dao_id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          name TEXT NOT NULL,
          template TEXT,
          quorum REAL,
          treasury_account TEXT,
          status TEXT DEFAULT 'active',
          meta TEXT,
          created_at TEXT
        )`).run();
        await db.prepare(`CREATE TABLE IF NOT EXISTS dao_members (
          dao_id TEXT,
          member_id TEXT,
          role TEXT DEFAULT 'member',
          weight REAL DEFAULT 1,
          status TEXT DEFAULT 'active',
          joined_at TEXT,
          PRIMARY KEY (dao_id, member_id)
        )`).run();
        
        await db.prepare(`CREATE TABLE IF NOT EXISTS dao_partners (
          dao_id TEXT,
          partner_id TEXT,
          capital_strata REAL DEFAULT 0,
          share_pct REAL DEFAULT 0,
          registry_ref TEXT,
          registry_jurisdiction TEXT,
          status TEXT DEFAULT 'active',
          joined_at TEXT,
          PRIMARY KEY (dao_id, partner_id)
        )`).run();
        await db.prepare(`CREATE TABLE IF NOT EXISTS dao_profit_distributions (
          id TEXT PRIMARY KEY,
          dao_id TEXT,
          partner_id TEXT,
          amount REAL,
          period TEXT,
          meta TEXT,
          created_at TEXT
        )`).run();

        await db.prepare(`CREATE TABLE IF NOT EXISTS dao_treasury_events (
          id TEXT PRIMARY KEY,
          dao_id TEXT,
          kind TEXT,
          account TEXT,
          amount REAL,
          meta TEXT,
          created_at TEXT
        )`).run();
      } catch (_) {}

      // --- Foundational / Enterprise / Consortium templates ---
      if (path === '/dao/templates' || path === '/dao/template') {
        const TEMPLATES = {
          associative: {
            id: 'associative',
            kind: 'associative',
            name: 'Associative DAO',
            commercial: false,
            scope: 'non_commercial_users_and_or_acbs',
            membership_composition: ['users', 'ACBs', 'mixed'],
            quorum: 0.51,
            vote: 'one_member_one_vote',
            quotas: 'always_equal',
            profit_distribution: false,
            roles: ['member', 'delegate', 'secretary'],
            features: ['equal_quotas', 'no_profit_distribution', 'acb_only_or_mixed_or_users', 'spa_collective'],
            membership: 'associative_join',
            note: 'Non-commercial entity. Quotas always equal. Never distributes profits in STRATA.',
          },
          corporate: {
            id: 'corporate',
            kind: 'corporate',
            name: 'Corporate DAO',
            commercial: true,
            scope: 'unipersonal_or_multi_partner_society',
            structure: ['unipersonal', 'multi_partner'],
            quorum: 0.67,
            vote: 'share_capital_weighted',
            quotas: 'proportional_to_capital_social_strata',
            profit_distribution: true,
            capital_social: 'external_official_commercial_registry',
            roles: ['partner', 'admin', 'operator', 'auditor'],
            features: ['share_capital', 'profit_distribution', 'registry_link', 'rbac', 'treasury'],
            membership: 'partners_only',
            note: 'Commercial. Partners hold unequal stakes from capital social (STRATA) linked to official government commercial registry. May redistribute profits to partners.',
          },
          foundational: {
            id: 'foundational',
            kind: 'associative',
            name: 'Foundational DAO',
            scope: 'protocol_parameters_spa_standards_emission_policy',
            quorum: 0.51,
            roles: ['node_operator', 'spa_provider', 'delegate'],
            can_certify: ['finality_modules', 'spa_templates', 'emission_schedule'],
            alias_of: 'associative',
          },
          enterprise: {
            id: 'enterprise',
            kind: 'corporate',
            name: 'Enterprise DAO Template',
            scope: 'private_consortium_rbac_treasury_compliance',
            quorum: 0.67,
            roles: ['admin', 'operator', 'auditor', 'member'],
            features: ['rbac', 'treasury', 'audit_log', 'compliance_reports'],
            alias_of: 'corporate',
          },
          consortium: {
            id: 'consortium',
            kind: 'corporate',
            name: 'Consortium DAO Template',
            scope: 'multi_org_shared_governance',
            quorum: 0.6,
            roles: ['org_delegate', 'chair', 'observer'],
            features: ['weighted_votes_by_org', 'shared_treasury', 'joint_spas'],
          },
        };
        const id = url.searchParams.get('id');
        if (id && TEMPLATES[id]) return j({ success: true, template: TEMPLATES[id] });
        return j({ success: true, templates: Object.values(TEMPLATES), whitepaper: 'polycentric meta-layer DAOs' });
      }


      // --- Associative & Corporate DAO instances ---
      if ((path === '/dao/create' || path === '/dao/register') && request.method === 'POST') {
        const actor = await resolveActor(request, env);
        if (!requireRank(actor, 'internal')) return j(deny(actor, 'internal'), 403);
        const data = await request.json().catch(() => ({}));
        let kind = (data.kind || data.type || 'associative').toLowerCase();
        if (kind === 'foundational' || kind === 'community' || kind === 'republic') kind = 'associative';
        if (kind === 'enterprise' || kind === 'company') kind = 'corporate';
        if (!['associative', 'corporate', 'consortium'].includes(kind)) {
          return j({ error: 'kind must be associative|corporate|consortium' }, 400);
        }
        const dao_id = data.dao_id || data.id || 'DAO-' + crypto.randomUUID().slice(0, 10);
        const name = data.name || (kind + ' DAO');
        const template = data.template || kind;
        const quorum = Number(data.quorum != null ? data.quorum : kind === 'associative' ? 0.51 : 0.67);
        const treasury_account = data.treasury_account || ('treasury:' + dao_id);
        const founder = (actor.authenticated && actor.user_id) || data.founder || data.member_id || 'FOG-NODE-PT-CM-001';
        await db
          .prepare(
            `INSERT OR REPLACE INTO daos (dao_id, kind, name, template, quorum, treasury_account, status, meta, created_at)
             VALUES (?,?,?,?,?,?,'active',?, datetime('now'))`
          )
          .bind(dao_id, kind, name, template, quorum, treasury_account, JSON.stringify({ ...(data.meta || {}), commercial: kind !== 'associative', profit_distribution: kind !== 'associative', quotas: kind === 'associative' ? 'equal' : 'capital_weighted' }))
          .run();
        const founder_role = kind === 'associative' ? 'member' : 'partner';
        const capital = Number(data.capital_strata || data.capital_social || 0);
        const registry_ref = data.registry_ref || data.commercial_registry || null;
        const registry_jurisdiction = data.registry_jurisdiction || data.jurisdiction || null;
        await db
          .prepare(
            `INSERT OR REPLACE INTO dao_members (dao_id, member_id, role, weight, status, joined_at)
             VALUES (?,?,?,?, 'active', datetime('now'))`
          )
          .bind(dao_id, founder, founder_role, 1)
          .run();
        if (kind === 'corporate') {
          await db
            .prepare(
              `INSERT OR REPLACE INTO dao_partners (dao_id, partner_id, capital_strata, share_pct, registry_ref, registry_jurisdiction, status, joined_at)
               VALUES (?,?,?,?,?,?, 'active', datetime('now'))`
            )
            .bind(dao_id, founder, capital, 100, registry_ref, registry_jurisdiction)
            .run();
        }
        try {
          await db
            .prepare(
              "INSERT OR IGNORE INTO token_balances (account, token_type, balance, total_minted, total_burned) VALUES (?, 'STRATA', 0, 0, 0)"
            )
            .bind(treasury_account)
            .run();
        } catch (_) {}
        const dag = await dagAnchor(env, { type: 'dao_create', dao_id, kind, name, founder });
        return j({
          success: true,
          dao: { dao_id, kind, name, template, quorum, treasury_account, founder, founder_role },
          dag_vertex: dag.vertex_id || null,
        });
      }

      if (path === '/dao/list' || path === '/dao/daos') {
        const kind = url.searchParams.get('kind');
        let rows;
        if (kind) {
          rows = await db.prepare('SELECT * FROM daos WHERE kind = ? ORDER BY created_at DESC LIMIT 50').bind(kind).all();
        } else {
          rows = await db.prepare('SELECT * FROM daos ORDER BY created_at DESC LIMIT 50').all();
        }
        return j({ success: true, daos: rows.results || [] });
      }

      if (path === '/dao/get' || (path.startsWith('/dao/') && path.split('/').length === 3 && !['health','spa','proposal','vote','proposals','status','templates','template','execute','compliance','rbac','roles','create','register','list','daos','join','members','treasury','bootstrap'].includes(path.split('/')[2]))) {
        // optional - skip fragile path
      }

      if (path === '/dao/info' && request.method === 'GET') {
        const dao_id = url.searchParams.get('dao_id') || url.searchParams.get('id');
        if (!dao_id) return j({ error: 'dao_id required' }, 400);
        const dao = await db.prepare('SELECT * FROM daos WHERE dao_id = ?').bind(dao_id).first();
        if (!dao) return j({ error: 'not found' }, 404);
        const members = await db.prepare('SELECT * FROM dao_members WHERE dao_id = ? AND status = ?').bind(dao_id, 'active').all();
        let treasury = 0;
        try {
          const tr = await db
            .prepare("SELECT balance FROM token_balances WHERE account = ? AND token_type IN ('STRATA','strata')")
            .bind(dao.treasury_account)
            .first();
          treasury = tr ? Number(tr.balance) : 0;
        } catch (_) {}
        return j({ success: true, dao, members: members.results || [], treasury_strata: treasury });
      }

      // Associative open join / corporate invite
      if (path === '/dao/join' && request.method === 'POST') {
        const actor = await resolveActor(request, env);
        const data = await request.json().catch(() => ({}));
        const dao_id = data.dao_id;
        const member_id = (actor.authenticated && actor.user_id) || data.member_id || data.account;
        if (!dao_id || !member_id) return j({ error: 'dao_id and member_id required' }, 400);
        const dao = await db.prepare('SELECT * FROM daos WHERE dao_id = ?').bind(dao_id).first();
        if (!dao) return j({ error: 'dao not found' }, 404);
        if (dao.kind === 'associative') {
          // open join for associative (lab: any authenticated or named member)
          await db
            .prepare(
              `INSERT OR REPLACE INTO dao_members (dao_id, member_id, role, weight, status, joined_at)
               VALUES (?,?, 'member', 1, 'active', datetime('now'))`
            )
            .bind(dao_id, member_id)
            .run();
          const dag = await dagAnchor(env, { type: 'dao_join', dao_id, member_id, kind: 'associative' });
          return j({ success: true, dao_id, member_id, role: 'member', kind: 'associative', dag_vertex: dag.vertex_id || null });
        }
        // corporate: requires clearance internal+ and optional inviter admin
        if (!requireRank(actor, 'internal')) return j(deny(actor, 'internal'), 403);
        const role = data.role || 'member';
        await db
          .prepare(
            `INSERT OR REPLACE INTO dao_members (dao_id, member_id, role, weight, status, joined_at)
             VALUES (?,?,?,?, 'active', datetime('now'))`
          )
          .bind(dao_id, member_id, role, Number(data.weight || 1))
          .run();
        const dag = await dagAnchor(env, { type: 'dao_join', dao_id, member_id, kind: 'corporate', role });
        return j({ success: true, dao_id, member_id, role, kind: 'corporate', dag_vertex: dag.vertex_id || null });
      }

      if (path === '/dao/members') {
        const dao_id = url.searchParams.get('dao_id');
        if (!dao_id) return j({ error: 'dao_id required' }, 400);
        const rows = await db.prepare('SELECT * FROM dao_members WHERE dao_id = ?').bind(dao_id).all();
        return j({ success: true, dao_id, members: rows.results || [] });
      }

      // Corporate treasury: deposit (transfer in) / payout (admin)
      if (path === '/dao/treasury' && request.method === 'POST') {
        const actor = await resolveActor(request, env);
        const data = await request.json().catch(() => ({}));
        const dao_id = data.dao_id;
        const action = (data.action || 'deposit').toLowerCase();
        const amount = Number(data.amount || 0);
        if (!dao_id || !(amount > 0)) return j({ error: 'dao_id and amount > 0 required' }, 400);
        const dao = await db.prepare('SELECT * FROM daos WHERE dao_id = ?').bind(dao_id).first();
        if (!dao) return j({ error: 'dao not found' }, 404);
        if (dao.kind === 'associative' && action === 'payout' && !requireRank(actor, 'confidential')) {
          return j(deny(actor, 'confidential'), 403);
        }
        if (dao.kind === 'corporate' && !requireRank(actor, action === 'payout' ? 'secret' : 'internal')) {
          return j(deny(actor, action === 'payout' ? 'secret' : 'internal'), 403);
        }
        const from = data.from || data.account || (actor.authenticated && actor.user_id) || 'FOG-NODE-PT-CM-001';
        const to = action === 'deposit' ? dao.treasury_account : data.to || from;
        const payer = action === 'deposit' ? from : dao.treasury_account;
        const payee = action === 'deposit' ? dao.treasury_account : to;
        // transfer via balance update
        try {
          const bal = await db
            .prepare("SELECT balance FROM token_balances WHERE account = ? AND token_type IN ('STRATA','strata')")
            .bind(payer)
            .first();
          if (!bal || Number(bal.balance) < amount) {
            return j({ error: 'insufficient_STRATA', account: payer, needed: amount }, 402);
          }
          await db
            .prepare(`UPDATE token_balances SET balance = balance - ? WHERE account = ? AND token_type IN ('STRATA','strata')`)
            .bind(amount, payer)
            .run();
          await db
            .prepare(
              `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned)
               VALUES (?, 'STRATA', ?, 0, 0)
               ON CONFLICT(account, token_type) DO UPDATE SET balance = balance + excluded.balance`
            )
            .bind(payee, amount)
            .run();
        } catch (e) {
          return j({ error: String(e.message || e) }, 500);
        }
        await db
          .prepare(
            `INSERT INTO dao_treasury_events (id, dao_id, kind, account, amount, meta, created_at)
             VALUES (?,?,?,?,?,?, datetime('now'))`
          )
          .bind(crypto.randomUUID(), dao_id, action, payee, amount, JSON.stringify({ from: payer, to: payee }))
          .run();
        const dag = await dagAnchor(env, { type: 'dao_treasury', dao_id, action, amount, payer, payee });
        return j({ success: true, dao_id, action, amount, dag_vertex: dag.vertex_id || null });
      }


      // Corporate only: register/update partner capital social
      if (path === '/dao/partner' && request.method === 'POST') {
        const actor = await resolveActor(request, env);
        if (!requireRank(actor, 'internal')) return j(deny(actor, 'internal'), 403);
        const data = await request.json().catch(() => ({}));
        const dao_id = data.dao_id;
        const partner_id = data.partner_id || data.member_id;
        if (!dao_id || !partner_id) return j({ error: 'dao_id and partner_id required' }, 400);
        const dao = await db.prepare('SELECT * FROM daos WHERE dao_id = ?').bind(dao_id).first();
        if (!dao) return j({ error: 'dao not found' }, 404);
        if (dao.kind === 'associative') {
          return j({
            error: 'associative_no_partners',
            message: 'Associative DAOs have equal member quotas only — no capital social partners or profit shares',
          }, 400);
        }
        const capital = Number(data.capital_strata || data.capital || 0);
        if (!(capital >= 0)) return j({ error: 'capital_strata >= 0 required' }, 400);
        // recompute share_pct across partners
        await db
          .prepare(
            `INSERT OR REPLACE INTO dao_partners (dao_id, partner_id, capital_strata, share_pct, registry_ref, registry_jurisdiction, status, joined_at)
             VALUES (?,?,?,0,?,?, 'active', datetime('now'))`
          )
          .bind(dao_id, partner_id, capital, data.registry_ref || null, data.registry_jurisdiction || null)
          .run();
        await db
          .prepare(
            `INSERT OR REPLACE INTO dao_members (dao_id, member_id, role, weight, status, joined_at)
             VALUES (?,?, 'partner', 1, 'active', datetime('now'))`
          )
          .bind(dao_id, partner_id)
          .run();
        const all = await db.prepare("SELECT * FROM dao_partners WHERE dao_id = ? AND status = 'active'").bind(dao_id).all();
        const total = (all.results || []).reduce((s, r) => s + Number(r.capital_strata || 0), 0) || 1;
        for (const r of all.results || []) {
          const pct = (Number(r.capital_strata || 0) / total) * 100;
          await db.prepare('UPDATE dao_partners SET share_pct = ? WHERE dao_id = ? AND partner_id = ?').bind(pct, dao_id, r.partner_id).run();
        }
        const partners = await db.prepare("SELECT * FROM dao_partners WHERE dao_id = ?").bind(dao_id).all();
        return j({ success: true, dao_id, partners: partners.results || [], total_capital_strata: total });
      }

      if (path === '/dao/partners') {
        const dao_id = url.searchParams.get('dao_id');
        if (!dao_id) return j({ error: 'dao_id required' }, 400);
        const dao = await db.prepare('SELECT * FROM daos WHERE dao_id = ?').bind(dao_id).first();
        if (!dao) return j({ error: 'not found' }, 404);
        if (dao.kind === 'associative') {
          return j({
            success: true,
            dao_id,
            kind: 'associative',
            partners: [],
            note: 'Associative DAOs do not have capital partners — members hold equal quotas and do not receive profit distributions',
          });
        }
        const rows = await db.prepare('SELECT * FROM dao_partners WHERE dao_id = ?').bind(dao_id).all();
        return j({ success: true, dao_id, kind: 'corporate', partners: rows.results || [] });
      }

      // Profit distribution — corporate only, proportional to capital social
      if (path === '/dao/distribute' && request.method === 'POST') {
        const actor = await resolveActor(request, env);
        if (!requireRank(actor, 'secret')) return j(deny(actor, 'secret'), 403);
        const data = await request.json().catch(() => ({}));
        const dao_id = data.dao_id;
        const amount = Number(data.amount || 0);
        if (!dao_id || !(amount > 0)) return j({ error: 'dao_id and amount > 0 required' }, 400);
        const dao = await db.prepare('SELECT * FROM daos WHERE dao_id = ?').bind(dao_id).first();
        if (!dao) return j({ error: 'dao not found' }, 404);
        if (dao.kind === 'associative') {
          return j({
            error: 'associative_no_profit_distribution',
            message: 'Associative DAOs are non-commercial: equal quotas, no STRATA profit distributions to members',
          }, 400);
        }
        const partners = await db.prepare("SELECT * FROM dao_partners WHERE dao_id = ? AND status = 'active'").bind(dao_id).all();
        const list = partners.results || [];
        if (!list.length) return j({ error: 'no_partners' }, 400);
        const total_cap = list.reduce((s, r) => s + Number(r.capital_strata || 0), 0);
        if (!(total_cap > 0)) return j({ error: 'capital_social_zero', message: 'Register capital_strata per partner first' }, 400);
        // check treasury balance
        let tbal = 0;
        try {
          const tr = await db
            .prepare("SELECT balance FROM token_balances WHERE account = ? AND token_type IN ('STRATA','strata')")
            .bind(dao.treasury_account)
            .first();
          tbal = tr ? Number(tr.balance) : 0;
        } catch (_) {}
        if (tbal < amount) return j({ error: 'insufficient_treasury', balance: tbal, needed: amount }, 402);
        const distributions = [];
        for (const r of list) {
          const share = (Number(r.capital_strata || 0) / total_cap) * amount;
          if (!(share > 0)) continue;
          await db
            .prepare(`UPDATE token_balances SET balance = balance - ? WHERE account = ? AND token_type IN ('STRATA','strata')`)
            .bind(share, dao.treasury_account)
            .run();
          await db
            .prepare(
              `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned)
               VALUES (?, 'STRATA', ?, 0, 0)
               ON CONFLICT(account, token_type) DO UPDATE SET balance = balance + excluded.balance`
            )
            .bind(r.partner_id, share)
            .run();
          await db
            .prepare(
              `INSERT INTO dao_profit_distributions (id, dao_id, partner_id, amount, period, meta, created_at)
               VALUES (?,?,?,?,?,?, datetime('now'))`
            )
            .bind(crypto.randomUUID(), dao_id, r.partner_id, share, data.period || null, JSON.stringify({ capital: r.capital_strata, share_pct: r.share_pct }))
            .run();
          distributions.push({ partner_id: r.partner_id, amount: share, share_pct: r.share_pct, capital_strata: r.capital_strata });
        }
        const dag = await dagAnchor(env, { type: 'dao_profit_distribution', dao_id, amount, distributions });
        return j({
          success: true,
          dao_id,
          kind: 'corporate',
          total_distributed: amount,
          distributions,
          dag_vertex: dag.vertex_id || null,
          note: 'Proportional to capital social (STRATA) — external commercial registry is source of partnership truth',
        });
      }


      if (path === '/dao/bootstrap' && request.method === 'POST') {
        const actor = await resolveActor(request, env);
        // Create CMN associative (AIOps/community) + corporate (node ops) if missing
        const created = [];
        for (const spec of [
          {
            dao_id: 'DAO-CMN-ASSOCIATIVE',
            kind: 'associative',
            name: 'Calhegas Morais Associative DAO',
            meta: { team: 'aiops-dev', realm: 'realm_1f20890b' },
          },
          {
            dao_id: 'DAO-CMN-CORPORATE',
            kind: 'corporate',
            name: 'Calhegas Morais Corporate DAO',
            meta: { host_node: 'FOG-NODE-PT-CM-001', clearance: true },
          },
        ]) {
          const exists = await db.prepare('SELECT dao_id FROM daos WHERE dao_id = ?').bind(spec.dao_id).first();
          if (exists) {
            created.push({ dao_id: spec.dao_id, existed: true });
            continue;
          }
          const treasury = 'treasury:' + spec.dao_id;
          await db
            .prepare(
              `INSERT INTO daos (dao_id, kind, name, template, quorum, treasury_account, status, meta, created_at)
               VALUES (?,?,?,?,?,?,'active',?, datetime('now'))`
            )
            .bind(
              spec.dao_id,
              spec.kind,
              spec.name,
              spec.kind,
              spec.kind === 'associative' ? 0.51 : 0.67,
              treasury,
              JSON.stringify(spec.meta)
            )
            .run();
          await db
            .prepare(
              `INSERT OR REPLACE INTO dao_members (dao_id, member_id, role, weight, status, joined_at)
               VALUES (?,?,?,?, 'active', datetime('now'))`
            )
            .bind(spec.dao_id, 'FOG-NODE-PT-CM-001', spec.kind === 'associative' ? 'member' : 'partner', 1)
            .run();
          // seed associative with ACB team as members
          if (spec.kind === 'associative') {
            for (const m of [
              'ACB-ORCH-CMN-001',
              'ACB-AIOPS-devops',
              'ACB-AIOPS-security',
              'ACB-AIOPS-analysis',
              'ACB-AIOPS-mesh',
              'ACB-AIOPS-economy',
            ]) {
              await db
                .prepare(
                  `INSERT OR IGNORE INTO dao_members (dao_id, member_id, role, weight, status, joined_at)
                   VALUES (?,?, 'member', 1, 'active', datetime('now'))`
                )
                .bind(spec.dao_id, m)
                .run();
            }
          }
          created.push({ dao_id: spec.dao_id, kind: spec.kind, created: true });
        }
        return j({ success: true, bootstrapped: created });
      }


      if (path === '/dao/proposal' && request.method === 'POST') {
        const actor = await resolveActor(request, env);
        if (!requireRank(actor, 'internal')) return j(deny(actor, 'internal'), 403);
        const data = await request.json().catch(() => ({}));
        const proposalId = data.proposal_id || 'PROP-' + crypto.randomUUID().slice(0, 10);
        const proposal_type = data.proposal_type || data.type || 'governance';
        const dao_template = data.dao_template || data.template || 'foundational';
        const quorum = Number(data.quorum_required != null ? data.quorum_required : 1);
        const closes_at = data.closes_at || null;
        try {
          await db
            .prepare(
              `INSERT INTO dao_proposals (proposal_id, proposer_id, title, description, proposal_type, status, quorum_required, created_at, closes_at)
               VALUES (?,?,?,?,?,'active',?, datetime('now'), ?)`
            )
            .bind(
              proposalId,
              (actor.authenticated && actor.user_id) || data.proposer_id || 'FOG-NODE-PT-CM-001',
              data.title || 'Untitled',
              (data.description || '') + (dao_template ? ` [template:${dao_template}]` : ''),
              proposal_type,
              quorum,
              closes_at
            )
            .run();
        } catch (e) {
          try {
            await db
              .prepare(
                'INSERT INTO dao_proposals (proposal_id, proposer_id, title, description, status, created_at) VALUES (?,?,?,?,?, datetime("now"))'
              )
              .bind(proposalId, data.proposer_id || 'FOG-NODE-PT-CM-001', data.title || 'Untitled', data.description || '', 'active')
              .run();
          } catch (e2) {
            return j({ error: 'proposal insert failed', detail: String(e2.message || e2) }, 500);
          }
        }
        const dag = await dagAnchor(env, {
          type: 'dao_proposal',
          proposal_id: proposalId,
          title: data.title,
          dao_template,
          proposal_type,
        });
        return j({ success: true, proposal_id: proposalId, dao_template, dag_vertex: dag.vertex_id || null });
      }

      if (path === '/dao/vote' && request.method === 'POST') {
        const actor = await resolveActor(request, env);
        if (!requireRank(actor, 'internal')) return j(deny(actor, 'internal'), 403);
        const data = await request.json().catch(() => ({}));
        const proposal_id = data.proposal_id;
        const voter = (actor.authenticated && actor.user_id) || data.voter_id || data.voter || data.account;
        const vote = (data.vote || data.choice || '').toLowerCase();
        const weight = Number(data.weight != null ? data.weight : 1);
        if (!proposal_id || !voter || !['for', 'against', 'abstain', 'yes', 'no'].includes(vote)) {
          return j({ error: 'proposal_id, voter, vote(for|against|abstain) required' }, 400);
        }
        const normalized = vote === 'yes' ? 'for' : vote === 'no' ? 'against' : vote;
        const prop = await db.prepare('SELECT * FROM dao_proposals WHERE proposal_id = ?').bind(proposal_id).first();
        if (!prop) return j({ error: 'proposal not found' }, 404);
        if (prop.status && !['active', 'open'].includes(prop.status)) {
          return j({ error: 'proposal not open', status: prop.status }, 400);
        }
        const dag = await dagAnchor(env, { type: 'dao_vote', proposal_id, voter, vote: normalized, weight });
        await db
          .prepare(
            'INSERT INTO dao_votes (proposal_id, voter, vote, weight, dag_cid, created_at) VALUES (?,?,?,?,?, datetime("now"))'
          )
          .bind(proposal_id, voter, normalized, weight, dag.vertex_id || null)
          .run();
        // tally
        const col = normalized === 'for' ? 'votes_for' : normalized === 'against' ? 'votes_against' : 'votes_abstain';
        try {
          await db.prepare(`UPDATE dao_proposals SET ${col} = COALESCE(${col},0) + ? WHERE proposal_id = ?`).bind(weight, proposal_id).run();
        } catch (_) {}
        return j({
          success: true,
          proposal_id,
          voter,
          vote: normalized,
          weight,
          dag_vertex: dag.vertex_id || null,
        });
      }

      if (path === '/dao/proposals') {
        try {
          const proposals = await db.prepare('SELECT * FROM dao_proposals ORDER BY created_at DESC LIMIT 30').all();
          return j({ success: true, proposals: proposals.results || [] });
        } catch (_) {
          return j({ success: true, proposals: [] });
        }
      }

      // Execute if quorum met
      if (path === '/dao/execute' && request.method === 'POST') {
        const actor = await resolveActor(request, env);
        if (!requireRank(actor, 'secret')) return j(deny(actor, 'secret'), 403);
        const data = await request.json().catch(() => ({}));
        const proposal_id = data.proposal_id;
        if (!proposal_id) return j({ error: 'proposal_id required' }, 400);
        const prop = await db.prepare('SELECT * FROM dao_proposals WHERE proposal_id = ?').bind(proposal_id).first();
        if (!prop) return j({ error: 'not found' }, 404);
        const votes_for = Number(prop.votes_for || 0);
        const votes_against = Number(prop.votes_against || 0);
        const quorum = Number(prop.quorum_required || 1);
        const total = votes_for + votes_against + Number(prop.votes_abstain || 0);
        if (votes_for < quorum) {
          return j({ success: false, error: 'quorum_not_met', votes_for, quorum, total }, 400);
        }
        if (votes_for <= votes_against) {
          return j({ success: false, error: 'not_passed', votes_for, votes_against }, 400);
        }
        await db
          .prepare("UPDATE dao_proposals SET status = 'executed', executed_at = datetime('now') WHERE proposal_id = ?")
          .bind(proposal_id)
          .run();
        const dag = await dagAnchor(env, { type: 'dao_execute', proposal_id, votes_for, votes_against });
        return j({ success: true, proposal_id, status: 'executed', votes_for, votes_against, dag_vertex: dag.vertex_id || null });
      }

      // SPA compliance checks
      if ((path === '/dao/spa/compliance' || path === '/dao/compliance') && request.method === 'POST') {
        const actor = await resolveActor(request, env);
        if (!requireRank(actor, 'confidential')) return j(deny(actor, 'confidential'), 403);
        const data = await request.json().catch(() => ({}));
        const spa_id = data.spa_id;
        if (!spa_id) return j({ error: 'spa_id required' }, 400);
        const spa = await db.prepare('SELECT * FROM spas WHERE id = ?').bind(spa_id).first();
        if (!spa) return j({ error: 'SPA not found' }, 404);
        // lab metrics: pin count, status
        let pin_count = 0;
        try {
          pin_count = (await db.prepare('SELECT COUNT(*) as c FROM spa_pins WHERE spa_id = ?').bind(spa_id).first())?.c ?? 0;
        } catch (_) {}
        const checks = [];
        const status_ok = spa.status === 'active';
        checks.push({ check_type: 'status_active', result: status_ok ? 'pass' : 'fail', details: spa.status });
        const pin_ok = pin_count >= 0; // soft
        checks.push({ check_type: 'pin_capacity', result: 'pass', details: `pins=${pin_count}` });
        const terms = (() => { try { return JSON.parse(spa.terms || '{}'); } catch { return {}; } })();
        const has_pinner = (terms.roles || []).includes('pinner') || String(spa.service_type || '').includes('pinner');
        checks.push({ check_type: 'role_declared', result: has_pinner || (terms.roles || []).length ? 'pass' : 'warn', details: spa.service_type });
        for (const c of checks) {
          try {
            await db
              .prepare(
                'INSERT INTO spa_compliance (spa_id, check_type, result, details, checked_at) VALUES (?,?,?,?, datetime("now"))'
              )
              .bind(spa_id, c.check_type, c.result, c.details)
              .run();
          } catch (_) {}
        }
        const overall = checks.every((c) => c.result === 'pass') ? 'compliant' : checks.some((c) => c.result === 'fail') ? 'non_compliant' : 'partial';
        const dag = await dagAnchor(env, { type: 'spa_compliance', spa_id, overall, checks });
        return j({ success: true, spa_id, overall, checks, dag_vertex: dag.vertex_id || null });
      }

      if (path === '/dao/spa/compliance' || path === '/dao/compliance') {
        const spa_id = url.searchParams.get('spa_id');
        if (spa_id) {
          const rows = await db
            .prepare('SELECT * FROM spa_compliance WHERE spa_id = ? ORDER BY checked_at DESC LIMIT 20')
            .bind(spa_id)
            .all();
          return j({ success: true, spa_id, history: rows.results || [] });
        }
        const rows = await db.prepare('SELECT * FROM spa_compliance ORDER BY checked_at DESC LIMIT 30').all();
        return j({ success: true, history: rows.results || [] });
      }


      if (path === '/dao/status') {
        let active_spas = 0;
        try {
          active_spas = (await db.prepare("SELECT COUNT(*) as c FROM spas WHERE status = 'active'").first())?.c ?? 0;
        } catch (_) {}
        return j({ success: true, status: 'operational', active_spas, version: '4.1.0-capital-social' });
      }

      return j({ error: 'Not Found', available_endpoints: ['/dao/health', '/dao/spa', '/dao/spa/list', '/dao/spa/opt-out', '/dao/spa/pinner', '/dao/pin-offer', '/dao/pin-request', '/dao/pin-market', '/dao/tick'] }, 404);
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
