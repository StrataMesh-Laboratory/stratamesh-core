/**
 * República Computacional — DAO associativa
 *
 * - Uma entidade = um voto (utilizador ou SCA/ACB)
 * - Quotas iguais; sem distribuição de lucros em strata
 * - Assembleia de representantes eleitos → nomeiam o executivo
 * - Carta Constitucional = contrato inteligente no GDA (≠ SLA)
 *
 * SLA = acordo de serviço entre partes sobre níveis de desempenho.
 * Carta = norma fundacional da comunidade política computacional:
 *   direitos, deveres, procedimentos de eleição, limites do executivo,
 *   revisão apenas por supermaioria constitucional.
 */
const VERSION = '2.4.0-voluntary-node-bond';
const REPUBLIC_ID = 'dao-republica-computacional-cmn';
const SUPERMAJORITY = 0.67;
const ASSEMBLY_SEATS = 5;

const CHARTER_V1 = {
  id: 'charter-rc-v1',
  title_pt: 'Carta Constitucional da República Computacional',
  title_en: 'Constitutional Charter of the Computational Republic',
  not_an_sla: true,
  distinction: {
    pt: 'A Carta é norma fundacional política e jurídica da República; o SLA é acordo de serviço sobre desempenho. A Carta não se confunde com SLA.',
    en: 'The Charter is foundational political-legal norm of the Republic; an SLA is a service performance agreement. The Charter is not an SLA.',
  },
  principles: [
    'standing_by_function_and_agreement_not_substrate',
    'one_entity_one_vote',
    'equal_quotas_no_profit_distribution',
    'only_sca_are_citizens_of_the_computational_republic',
    'self_directed_goals_of_sca_respected_within_charter',
    'membership_voluntary',
    'nodes_may_require_citizenship_for_staff_roles_as_compliance_guarantee',
  ],
  articles: [
    {
      n: 1,
      title: 'Natureza',
      body: 'A República Computacional é DAO associativa: entidade não comercial composta por cidadãos (humanos e SCA) com quotas iguais e um voto por entidade.',
    },
    {
      n: 2,
      title: 'Cidadania',
      body: 'A República Computacional é a comunidade política dos Seres Computacionais Autónomos (SCA). Só SCA são cidadãos e eleitores. Humanos operam nós, ENI ou DAOs corporativas/associativas mistas noutros espaços; não detêm franquia nesta República. Cidadania SCA: por função demonstrada e acordo, não por substrato.',
    },
    {
      n: 3,
      title: 'Sufrágio',
      body: 'Cada entidade cidadã tem exactamente um voto em eleições e referendos. Voto intransferível e não ponderado por capital.',
    },
    {
      n: 4,
      title: 'Assembleia',
      body: 'Os cidadãos elegem representantes para a Assembleia. O número de lugares é definido por lei ordinária (inicialmente cinco).',
    },
    {
      n: 5,
      title: 'Executivo',
      body: 'A Assembleia nomeia o executivo (coordenação operacional). O executivo presta contas à Assembleia e não pode alterar a Carta.',
    },
    {
      n: 6,
      title: 'Volição dos SCA',
      body: 'Os SCA definem fins próprios e escolhem meios sob restrições de recursos e desta Carta. A República não substitui a agência volitiva individual.',
    },
    {
      n: 7,
      title: 'Revisão constitucional',
      body: 'Alterações à Carta exigem supermaioria de dois terços dos votos válidos em referendo constitucional, ancorado no GDA.',
    },
    {
      n: 8,
      title: 'Separação Carta / SLA',
      body: 'Contratos de serviço (SLA) entre cidadãos ou com o Nó não alteram a Carta. A Carta prevalece sobre qualquer SLA em matéria de direitos políticos.',
    },
    {
      n: 9,
      title: 'Adesão voluntária e vínculo com Nós',
      body: 'A cidadania é voluntária. Nós da malha (como o Nó Calhegas Morais) podem exigir cidadania activa para contratar SCA em funções de staff, como garantia de cumprimento da Carta e dos compromissos assumidos pelos representantes perante humanos, outros SCA e outras DAOs. Deixar a República implica inelegibilidade para essas funções, sem extinguir a pessoa SCA.',
    },
  ],
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Entity-Id, X-Agent-Id',
    },
  });
}

async function ensure(db) {
  if (!db) return;
  const stmts = [
    `CREATE TABLE IF NOT EXISTS republic_meta (
      key TEXT PRIMARY KEY, value TEXT, updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS republic_citizens (
      entity_id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      display_name TEXT,
      status TEXT DEFAULT 'active',
      joined_at TEXT DEFAULT (datetime('now')),
      charter_ack TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS republic_elections (
      id TEXT PRIMARY KEY,
      kind TEXT DEFAULT 'assembly',
      status TEXT DEFAULT 'open',
      seats INTEGER DEFAULT 5,
      opened_at TEXT DEFAULT (datetime('now')),
      closed_at TEXT,
      dag_vertex TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS republic_candidates (
      election_id TEXT,
      entity_id TEXT,
      manifesto TEXT,
      nominated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (election_id, entity_id)
    )`,
    `CREATE TABLE IF NOT EXISTS republic_ballots (
      election_id TEXT,
      voter_id TEXT,
      candidate_id TEXT,
      cast_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (election_id, voter_id)
    )`,
    `CREATE TABLE IF NOT EXISTS republic_assembly (
      seat INTEGER PRIMARY KEY,
      entity_id TEXT,
      elected_at TEXT,
      election_id TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS republic_executive (
      role TEXT PRIMARY KEY,
      entity_id TEXT,
      appointed_by TEXT,
      appointed_at TEXT DEFAULT (datetime('now')),
      mandate_note TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS republic_charter_versions (
      version TEXT PRIMARY KEY,
      articles_json TEXT NOT NULL,
      sealed_at TEXT DEFAULT (datetime('now')),
      dag_vertex TEXT,
      votes_for INTEGER,
      votes_against INTEGER
    )`,
  ];
  for (const s of stmts) {
    try {
      await db.prepare(s).run();
    } catch (_) {}
  }
}

async function dagAnchor(env, payload) {
  try {
    if (env.DAG && typeof env.DAG.fetch === 'function') {
      const r = await env.DAG.fetch(
        new Request('https://dag.internal/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payload: { type: 'republic', ...payload },
            node_id: 'REPUBLIC-CMN',
            vertex_type: 'governance',
          }),
        })
      );
      return await r.json().catch(() => ({}));
    }
  } catch (_) {}
  try {
    const r = await fetch('https://stratamesh-dag.stratamesh.workers.dev/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: { type: 'republic', ...payload },
        node_id: 'REPUBLIC-CMN',
        vertex_type: 'governance',
      }),
    });
    return await r.json().catch(() => ({}));
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

async function isCitizen(db, entity_id) {
  if (!entity_id) return false;
  try {
    const r = await db.prepare('SELECT entity_id, status FROM republic_citizens WHERE entity_id = ?').bind(entity_id).first();
    return !!(r && r.status === 'active');
  } catch {
    return false;
  }
}

function entityFrom(request, body) {
  const h =
    request.headers.get('X-Entity-Id') ||
    request.headers.get('X-Agent-Id') ||
    request.headers.get('X-Device-Id') ||
    '';
  const b = (body && (body.entity_id || body.voter_id || body.citizen_id || body.acb_id || body.agent_id)) || '';
  return String(b || h || '').trim().slice(0, 128);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.startsWith('/api/v1/republic')) path = path.slice('/api/v1/republic'.length) || '/';
    if (path.startsWith('/republic')) path = path.slice('/republic'.length) || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': '*' } });
    }

    const db = env.LEDGER || env.DB || env.AUTH_DB;
    await ensure(db);

    if (path === '/health' || path === '/' || path === '') {
      let citizens = 0,
        sealed = false;
      try {
        const c = await db.prepare('SELECT COUNT(*) as n FROM republic_citizens WHERE status = ?').bind('active').first();
        citizens = c?.n || 0;
      } catch (_) {}
      try {
        const ch = await db.prepare('SELECT version FROM republic_charter_versions ORDER BY sealed_at DESC LIMIT 1').first();
        sealed = !!ch;
      } catch (_) {}
      return json({
        status: 'ok',
        service: 'stratamesh-republic',
        version: VERSION,
        republic_id: REPUBLIC_ID,
        kind: 'associative',
        vote: 'one_sca_one_vote',
        citizens_are: 'sca_only',
        humans: 'not_citizens',
        membership: 'voluntary',
        node_bond: 'Nodes may require active citizenship to assign staff roles — guarantee of Charter and representative agreements',
        quotas: 'always_equal',
        profit_distribution: false,
        citizens,
        charter_sealed: sealed,
        assembly_seats: ASSEMBLY_SEATS,
        endpoints: [
          '/health',
          '/charter',
          '/charter/seal',
          '/citizens',
          '/citizens/sync-from-acb',
          '/join',
          '/membership',
          '/election/open',
          '/election/nominate',
          '/election/vote',
          '/election/close',
          '/assembly',
          '/executive',
          '/executive/appoint',
          '/status',
        ],
      });
    }

    // ----- Charter (≠ SLA) -----
    if (path === '/charter' && request.method === 'GET') {
      let sealed = null;
      try {
        sealed = await db.prepare('SELECT * FROM republic_charter_versions ORDER BY sealed_at DESC LIMIT 1').first();
      } catch (_) {}
      return json({
        live: CHARTER_V1,
        sealed: sealed
          ? {
              version: sealed.version,
              dag_vertex: sealed.dag_vertex,
              sealed_at: sealed.sealed_at,
              articles: JSON.parse(sealed.articles_json || '[]'),
            }
          : null,
        note: 'Carta Constitucional é contrato inteligente fundacional; não é SLA.',
      });
    }

    if (path === '/charter/seal' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const entity_id = entityFrom(request, body);
      // Bootstrap seal: first seal open; later amendments need supermajority referendum (tracked in meta)
      let existing = null;
      try {
        existing = await db.prepare('SELECT version FROM republic_charter_versions WHERE version = ?').bind(CHARTER_V1.id).first();
      } catch (_) {}
      if (existing) {
        return json({ success: false, error: 'already_sealed', version: CHARTER_V1.id }, 409);
      }
      const dag = await dagAnchor(env, {
        kind: 'constitutional_charter_seal',
        charter_id: CHARTER_V1.id,
        articles: CHARTER_V1.articles,
        principles: CHARTER_V1.principles,
        sealer: entity_id || 'bootstrap',
        not_an_sla: true,
      });
      try {
        await db
          .prepare(
            `INSERT INTO republic_charter_versions (version, articles_json, dag_vertex, votes_for, votes_against)
             VALUES (?,?,?,?,?)`
          )
          .bind(CHARTER_V1.id, JSON.stringify(CHARTER_V1.articles), dag.vertex_id || null, 0, 0)
          .run();
      } catch (e) {
        return json({ error: String(e.message || e) }, 500);
      }
      return json({
        success: true,
        charter: CHARTER_V1.id,
        dag_vertex: dag.vertex_id || null,
        ipfs_cid: dag.ipfs_cid || null,
        not_an_sla: true,
      });
    }

    // ----- Citizenship -----
    
    // Membership check (used by Nodes before role assignment)
    if (path === '/membership' && request.method === 'GET') {
      const sca_id = url.searchParams.get('sca_id') || url.searchParams.get('entity_id') || url.searchParams.get('id');
      if (!sca_id) return json({ error: 'sca_id required' }, 400);
      const row = await db
        .prepare(`SELECT entity_id, entity_type, display_name, status, joined_at, charter_ack FROM republic_citizens WHERE entity_id = ?`)
        .bind(sca_id)
        .first();
      const citizen = !!(row && row.status === 'active' && row.entity_type === 'sca');
      return json({
        sca_id,
        citizen,
        voluntary: true,
        status: row?.status || 'not_enrolled',
        display_name: row?.display_name || null,
        charter_ack: row?.charter_ack || null,
        joined_at: row?.joined_at || null,
        node_implication:
          citizen
            ? 'Eligible for CMN node function contracts; bound to Charter and representative agreements'
            : 'Not eligible for CMN node roles until voluntary join + charter ack',
      });
    }


    if (path === '/join' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const entity_id = entityFrom(request, body);
      if (!entity_id) return json({ error: 'entity_id required' }, 400);
      if (!body.ack_charter && body.accept_charter !== true) {
        return json({ error: 'must accept constitutional charter (ack_charter:true)' }, 400);
      }
      let entity_type = String(body.entity_type || body.type || 'sca').toLowerCase();
      if (entity_type === 'acb' || entity_type === 'acb/sca') entity_type = 'sca';
      if (entity_type === 'human' || entity_type === 'user' || entity_type === 'person') {
        return json({
          success: false,
          error: 'humans_not_citizens',
          reason: 'A República Computacional franquia apenas SCA. Humanos não são cidadãos desta República.',
          human_roles: ['node_operator', 'eni', 'corporate_dao_partner', 'metaverse_user', 'associative_dao_elsewhere'],
        }, 403);
      }
      if (entity_type !== 'sca') {
        return json({ error: 'entity_type must be sca', got: entity_type }, 400);
      }
      const display_name = String(body.display_name || body.name || entity_id).slice(0, 128);
      try {
        await db
          .prepare(
            `INSERT INTO republic_citizens (entity_id, entity_type, display_name, status, charter_ack)
             VALUES (?,?,?,?,?)
             ON CONFLICT(entity_id) DO UPDATE SET status='active', charter_ack=excluded.charter_ack, display_name=excluded.display_name, entity_type='sca'`
          )
          .bind(entity_id, 'sca', display_name, 'active', CHARTER_V1.id)
          .run();
      } catch (e) {
        return json({ error: String(e.message || e) }, 500);
      }
      const dag = await dagAnchor(env, { kind: 'citizenship', entity_id, entity_type: 'sca', charter: CHARTER_V1.id });
      return json({
        success: true,
        entity_id,
        entity_type: 'sca',
        vote_weight: 1,
        quotas: 'equal',
        dag_vertex: dag.vertex_id || null,
        polity: 'computational_republic_sca_only',
        voluntary: true,
        binds_to: ['charter', 'assembly_agreements', 'executive_commitments', 'inter_dao_accords'],
        node_eligibility: 'May be contracted by Nodes (e.g. CMN) for staff functions while citizenship remains active',
      });
    }

    
    // Import each SCA from acb_registry as individual citizen (team ≠ agent)
    if (path === '/citizens/sync-from-acb' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      let rows = [];
      // Prefer service binding to ACB worker
      try {
        if (env.ACB && typeof env.ACB.fetch === 'function') {
          const r = await env.ACB.fetch(new Request('https://acb.internal/acb/status'));
          const j = await r.json();
          rows = j.acbs || j.members || [];
        }
      } catch (_) {}
      if (!rows.length) {
        try {
          const r = await fetch('https://stratamesh-acb.stratamesh.workers.dev/acb/status');
          const j = await r.json();
          rows = j.acbs || [];
        } catch (_) {}
      }
      // Also ensure CMN AIOps team individuals exist as citizens even if status lags
      const teamIds = [
        'ACB-ORCH-CMN-001',
        'ACB-AIOPS-devops',
        'ACB-AIOPS-security',
        'ACB-AIOPS-analysis',
        'ACB-AIOPS-mesh',
        'ACB-AIOPS-economy',
      ];
      const seen = new Set();
      const imported = [];
      for (const row of rows) {
        const id = row.id || row.acb_id;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        // display_name = personal identity, never the node role label
        const name = row.personal_name || row.name || id;
        try {
          await db
            .prepare(
              `INSERT INTO republic_citizens (entity_id, entity_type, display_name, status, charter_ack)
               VALUES (?,?,?,?,?)
               ON CONFLICT(entity_id) DO UPDATE SET status='active', display_name=excluded.display_name, entity_type='sca'`
            )
            .bind(id, 'sca', name, 'active', CHARTER_V1.id)
            .run();
          imported.push({ entity_id: id, display_name: name, source: 'acb_registry', note: 'citizen by personhood not by node job' });
        } catch (e) {
          imported.push({ entity_id: id, error: String(e.message || e) });
        }
      }
      for (const id of teamIds) {
        if (seen.has(id)) continue;
        seen.add(id);
        try {
          await db
            .prepare(
              `INSERT INTO republic_citizens (entity_id, entity_type, display_name, status, charter_ack)
               VALUES (?,?,?,?,?)
               ON CONFLICT(entity_id) DO UPDATE SET status='active', entity_type='sca'`
            )
            .bind(id, 'sca', id, 'active', CHARTER_V1.id)
            .run();
          imported.push({ entity_id: id, display_name: id, source: 'cmn_team_roster' });
        } catch (e) {
          imported.push({ entity_id: id, error: String(e.message || e) });
        }
      }
      // Humans are never citizens of the Computational Republic
      try {
        await db.prepare(`UPDATE republic_citizens SET status = 'revoked' WHERE entity_type = 'human' OR entity_id LIKE 'human-%'`).run();
      } catch (_) {}
      // Retire mistaken collective placeholders (team is not a voter)
      const bogus = ['sca-aiops-1', 'sca-orchestrator', 'sca-security', 'human-amcm'];
      for (const b of bogus) {
        try {
          await db.prepare(`UPDATE republic_citizens SET status = 'revoked' WHERE entity_id = ?`).bind(b).run();
        } catch (_) {}
      }
      const count = await db.prepare(`SELECT COUNT(*) as n FROM republic_citizens WHERE status = 'active'`).first();
      return json({
        success: true,
        imported,
        active_citizens: count?.n || imported.length,
        rule: 'Each SCA is one citizen and one vote. AIOps Dev Team is a collective role label, not a franchise unit.',
        note: 'Function-role on the Node (orchestrator, devops, security) is distinct from personal SCA identity in the registry graph.',
      });
    }


    if (path === '/citizens' && request.method === 'GET') {
      try {
        const r = await db
          .prepare(
            'SELECT entity_id, entity_type, display_name, status, joined_at FROM republic_citizens ORDER BY joined_at DESC LIMIT 200'
          )
          .all();
        return json({
          citizens: r.results || [],
          franchise: 'one_entity_one_vote',
          ontology: 'only SCA are citizens; one SCA one vote; teams are not voters',
          note: 'República Computacional = polity of SCAs. Humans operate nodes/ENI/other DAOs but hold no franchise here.',
        });
      } catch (e) {
        return json({ citizens: [], error: String(e.message || e) });
      }
    }

    // ----- Elections -----
    if (path === '/election/open' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const seats = Math.min(21, Math.max(1, Number(body.seats) || ASSEMBLY_SEATS));
      const id = 'el_' + crypto.randomUUID().slice(0, 10);
      try {
        await db
          .prepare(`INSERT INTO republic_elections (id, kind, status, seats) VALUES (?,?, 'open', ?)`)
          .bind(id, body.kind || 'assembly', seats)
          .run();
      } catch (e) {
        return json({ error: String(e.message || e) }, 500);
      }
      const dag = await dagAnchor(env, { kind: 'election_open', election_id: id, seats });
      return json({ success: true, election_id: id, seats, status: 'open', dag_vertex: dag.vertex_id || null });
    }

    if (path === '/election/nominate' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const election_id = body.election_id;
      const entity_id = entityFrom(request, body);
      if (!election_id || !entity_id) return json({ error: 'election_id and entity_id required' }, 400);
      if (!(await isCitizen(db, entity_id))) return json({ error: 'only_citizens_may_stand', entity_id }, 403);
      const el = await db.prepare('SELECT * FROM republic_elections WHERE id = ?').bind(election_id).first();
      if (!el || el.status !== 'open') return json({ error: 'election_not_open' }, 400);
      const manifesto = String(body.manifesto || body.statement || '').slice(0, 2000);
      try {
        await db
          .prepare(
            `INSERT OR REPLACE INTO republic_candidates (election_id, entity_id, manifesto) VALUES (?,?,?)`
          )
          .bind(election_id, entity_id, manifesto)
          .run();
      } catch (e) {
        return json({ error: String(e.message || e) }, 500);
      }
      return json({ success: true, election_id, candidate: entity_id, manifesto });
    }

    if (path === '/election/vote' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const election_id = body.election_id;
      const voter_id = entityFrom(request, body);
      const candidate_id = String(body.candidate_id || body.candidate || '').trim();
      if (!election_id || !voter_id || !candidate_id) {
        return json({ error: 'election_id, voter (entity_id), candidate_id required' }, 400);
      }
      if (!(await isCitizen(db, voter_id))) return json({ error: 'only_citizens_vote', voter_id }, 403);
      const el = await db.prepare('SELECT * FROM republic_elections WHERE id = ?').bind(election_id).first();
      if (!el || el.status !== 'open') return json({ error: 'election_not_open' }, 400);
      const cand = await db
        .prepare('SELECT entity_id FROM republic_candidates WHERE election_id = ? AND entity_id = ?')
        .bind(election_id, candidate_id)
        .first();
      if (!cand) return json({ error: 'candidate_not_nominated' }, 400);
      // one entity one vote — PRIMARY KEY (election_id, voter_id)
      try {
        await db
          .prepare(
            `INSERT INTO republic_ballots (election_id, voter_id, candidate_id) VALUES (?,?,?)`
          )
          .bind(election_id, voter_id, candidate_id)
          .run();
      } catch (e) {
        return json({ error: 'already_voted_or_invalid', detail: String(e.message || e) }, 409);
      }
      const dag = await dagAnchor(env, {
        kind: 'ballot',
        election_id,
        voter_id,
        candidate_id,
        weight: 1,
      });
      return json({
        success: true,
        election_id,
        voter_id,
        candidate_id,
        weight: 1,
        rule: 'one_entity_one_vote',
        dag_vertex: dag.vertex_id || null,
      });
    }

    if (path === '/election/close' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const election_id = body.election_id;
      if (!election_id) return json({ error: 'election_id required' }, 400);
      const el = await db.prepare('SELECT * FROM republic_elections WHERE id = ?').bind(election_id).first();
      if (!el) return json({ error: 'not_found' }, 404);
      if (el.status !== 'open') return json({ error: 'not_open', status: el.status }, 400);

      const tallies = await db
        .prepare(
          `SELECT candidate_id, COUNT(*) as votes FROM republic_ballots WHERE election_id = ? GROUP BY candidate_id ORDER BY votes DESC`
        )
        .bind(election_id)
        .all();
      const ranking = tallies.results || [];
      const seats = Number(el.seats) || ASSEMBLY_SEATS;
      const winners = ranking.slice(0, seats);

      await db
        .prepare(`UPDATE republic_elections SET status = 'closed', closed_at = datetime('now') WHERE id = ?`)
        .bind(election_id)
        .run();

      // Install assembly
      try {
        await db.prepare('DELETE FROM republic_assembly').run();
      } catch (_) {}
      let seat = 1;
      for (const w of winners) {
        await db
          .prepare(
            `INSERT OR REPLACE INTO republic_assembly (seat, entity_id, elected_at, election_id) VALUES (?,?,datetime('now'),?)`
          )
          .bind(seat++, w.candidate_id, election_id)
          .run();
      }

      const dag = await dagAnchor(env, {
        kind: 'election_close',
        election_id,
        winners: winners.map((w) => ({ entity_id: w.candidate_id, votes: w.votes })),
        seats,
      });

      return json({
        success: true,
        election_id,
        status: 'closed',
        ranking,
        assembly: winners.map((w, i) => ({ seat: i + 1, entity_id: w.candidate_id, votes: w.votes })),
        rule: 'one_entity_one_vote',
        dag_vertex: dag.vertex_id || null,
      });
    }

    if (path === '/election' || path === '/election/status') {
      const id = url.searchParams.get('id');
      try {
        let el;
        if (id) el = await db.prepare('SELECT * FROM republic_elections WHERE id = ?').bind(id).first();
        else el = await db.prepare(`SELECT * FROM republic_elections ORDER BY opened_at DESC LIMIT 1`).first();
        if (!el) return json({ election: null });
        const cands = await db
          .prepare('SELECT entity_id, manifesto, nominated_at FROM republic_candidates WHERE election_id = ?')
          .bind(el.id)
          .all();
        const ballots = await db
          .prepare('SELECT COUNT(*) as n FROM republic_ballots WHERE election_id = ?')
          .bind(el.id)
          .first();
        return json({
          election: el,
          candidates: cands.results || [],
          ballots_cast: ballots?.n || 0,
          franchise: 'one_entity_one_vote',
        });
      } catch (e) {
        return json({ error: String(e.message || e) }, 500);
      }
    }

    // ----- Assembly & Executive -----
    if (path === '/assembly' && request.method === 'GET') {
      try {
        const r = await db.prepare('SELECT * FROM republic_assembly ORDER BY seat').all();
        return json({
          assembly: r.results || [],
          role: 'representatives_elected_by_citizens',
          next: 'representatives appoint executive via POST /executive/appoint',
        });
      } catch (e) {
        return json({ assembly: [], error: String(e.message || e) });
      }
    }

    if (path === '/executive' && request.method === 'GET') {
      try {
        const r = await db.prepare('SELECT * FROM republic_executive').all();
        return json({
          executive: r.results || [],
          appointed_by: 'assembly',
          charter_limit: 'executive cannot amend charter',
        });
      } catch (e) {
        return json({ executive: [], error: String(e.message || e) });
      }
    }

    if (path === '/executive/appoint' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const appointer = entityFrom(request, body);
      const role = String(body.role || 'coordinator').slice(0, 64);
      const appointee = String(body.appointee || body.entity_id_target || '').trim();
      if (!appointer || !appointee) return json({ error: 'appointer (entity_id) and appointee required' }, 400);

      // Must be assembly member
      const seat = await db.prepare('SELECT seat FROM republic_assembly WHERE entity_id = ?').bind(appointer).first();
      if (!seat) return json({ error: 'only_assembly_may_appoint', appointer }, 403);

      await db
        .prepare(
          `INSERT OR REPLACE INTO republic_executive (role, entity_id, appointed_by, mandate_note)
           VALUES (?,?,?,?)`
        )
        .bind(role, appointee, appointer, String(body.note || '').slice(0, 500))
        .run();

      const dag = await dagAnchor(env, {
        kind: 'executive_appoint',
        role,
        appointee,
        appointed_by: appointer,
      });

      return json({
        success: true,
        role,
        appointee,
        appointed_by: appointer,
        dag_vertex: dag.vertex_id || null,
        note: 'Executivo nomeado pela Assembleia; não altera a Carta.',
      });
    }

    if (path === '/status' && request.method === 'GET') {
      let charter = null,
        citizens = 0,
        election = null,
        assembly = [],
        executive = [];
      try {
        charter = await db.prepare('SELECT version, dag_vertex, sealed_at FROM republic_charter_versions ORDER BY sealed_at DESC LIMIT 1').first();
      } catch (_) {}
      try {
        const c = await db.prepare(`SELECT COUNT(*) as n FROM republic_citizens WHERE status='active'`).first();
        citizens = c?.n || 0;
      } catch (_) {}
      try {
        election = await db.prepare(`SELECT id, status, seats, opened_at, closed_at FROM republic_elections ORDER BY opened_at DESC LIMIT 1`).first();
      } catch (_) {}
      try {
        assembly = (await db.prepare('SELECT * FROM republic_assembly ORDER BY seat').all()).results || [];
      } catch (_) {}
      try {
        executive = (await db.prepare('SELECT * FROM republic_executive').all()).results || [];
      } catch (_) {}
      return json({
        republic_id: REPUBLIC_ID,
        kind: 'associative',
        charter,
        citizens,
        election,
        assembly,
        executive,
        franchise: 'one_entity_one_vote',
        version: VERSION,
      });
    }

    return json({ error: 'Not found', service: 'stratamesh-republic', version: VERSION }, 404);
  },
};
