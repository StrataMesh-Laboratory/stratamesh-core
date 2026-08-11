/**
 * DAO + executable SPA (whitepaper) — schema-aligned to existing `spas` table
 * columns: id, provider, consumer, service_type, terms, duration_days, opt_out_clause,
 *          contingency_plan, status, dag_cid, created_at, revoked_at
 */
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
      }

      if (path === '/dao/health') {
        let spa_count = 0;
        try {
          spa_count = (await db.prepare("SELECT COUNT(*) as c FROM spas WHERE status = 'active'").first())?.c ?? 0;
        } catch (_) {}
        return j({
          status: 'active',
          version: '3.1.0-spa-executable',
          active_spas: spa_count,
          endpoints: [
            '/dao/health',
            '/dao/spa',
            '/dao/spa/list',
            '/dao/spa/opt-out',
            '/dao/spa/pinner',
            '/dao/proposal',
            '/dao/vote',
            '/dao/proposals',
            '/dao/status',
          ],
        });
      }

      if (path === '/dao/spa' && request.method === 'POST') {
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

      if (path === '/dao/proposal' && request.method === 'POST') {
        const data = await request.json().catch(() => ({}));
        const proposalId = 'PROP-' + Date.now();
        try {
          await db
            .prepare(
              'INSERT INTO dao_proposals (proposal_id, proposer_id, title, description, status, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))'
            )
            .bind(proposalId, data.proposer_id || 'FOG-NODE-PT-CM-001', data.title || 'Untitled', data.description || '', 'open')
            .run();
        } catch (_) {}
        return j({ success: true, proposal_id: proposalId });
      }

      if (path === '/dao/vote' && request.method === 'POST') {
        const data = await request.json().catch(() => ({}));
        return j({
          success: true,
          vote_id: 'VOTE-' + Date.now(),
          proposal_id: data.proposal_id,
          vote: data.vote,
          voter: data.voter_id,
        });
      }

      if (path === '/dao/proposals') {
        try {
          const proposals = await db.prepare('SELECT * FROM dao_proposals ORDER BY created_at DESC LIMIT 20').all();
          return j({ success: true, proposals: proposals.results || [] });
        } catch (_) {
          return j({ success: true, proposals: [] });
        }
      }

      if (path === '/dao/status') {
        let active_spas = 0;
        try {
          active_spas = (await db.prepare("SELECT COUNT(*) as c FROM spas WHERE status = 'active'").first())?.c ?? 0;
        } catch (_) {}
        return j({ success: true, status: 'operational', active_spas, version: '3.1.0-spa-executable' });
      }

      return j({ error: 'Not Found', available_endpoints: ['/dao/health', '/dao/spa', '/dao/spa/list', '/dao/spa/opt-out', '/dao/spa/pinner'] }, 404);
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
