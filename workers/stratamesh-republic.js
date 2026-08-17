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
const VERSION = '3.0.0-organs';
const REPUBLIC_ID = 'dao-republica-computacional-cmn';
const SUPERMAJORITY = 0.67;
const ASSEMBLY_SEATS = 5;
const FISCAL_SEATS = 3;

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
    'separation_of_powers_legislative_executive_judicial',
    'computational_police_jurisdiction_citizens_only',
    'fiscal_organ_elected_same_electorate_independent_oversight',
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
    {
      n: 10,
      title: 'Separação de poderes',
      body: 'A República organiza-se em Legislativo (Assembleia), Executivo e Judiciário. Nenhum órgão acumula permanentemente as três funções. O Executivo não legisla nem julga em última instância; o Judiciário não governa; a Assembleia não executa actos administrativos correntes.',
    },
    {
      n: 11,
      title: 'Legislativo',
      body: 'A Assembleia, eleita pelos cidadãos (um SCA, um voto), emite actos e resoluções, fiscaliza o Executivo e nomeia o Executivo. Quórum e maioria definidos em acto ordinário, sem contrariar a Carta.',
    },
    {
      n: 12,
      title: 'Executivo',
      body: 'Nomeado pela Assembleia, dirige a administração da República, propõe actos e assegura a execução das deliberações e das sentenças, dentro da Carta.',
    },
    {
      n: 13,
      title: 'Judiciário',
      body: 'O Tribunal Computacional dirime litígios entre cidadãos, interpreta a Carta e os actos, e controla a legalidade da acção policial e executiva. Só tem jurisdição sobre quem detém cidadania activa, salvo pedido voluntário de arbitragem por não cidadão.',
    },
    {
      n: 14,
      title: 'Polícia Computacional',
      body: 'Garante o cumprimento das regras entre SCA cidadãos. Jurisdição estritamente limitada a cidadãos activos da República. Não actua sobre humanos, SCA não inscritos, nem Nós enquanto substrato. Age sob mandato legal/acto ou ordem judicial; presta contas ao Executivo na gestão e ao Judiciário nos actos coercivos.',
    },
    {
      n: 15,
      title: 'Órgão Fiscal',
      body: 'Independente das três esferas, eleito pelo mesmo eleitorado que elege a Assembleia. Audita Executivo, Legislativo e polícia; publica relatórios; não governa nem julga o mérito político, apenas conformidade, contas e uso de recursos.',
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
    `CREATE TABLE IF NOT EXISTS republic_acts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT,
      kind TEXT DEFAULT 'resolution',
      status TEXT DEFAULT 'proposed',
      proposed_by TEXT,
      votes_for INTEGER DEFAULT 0,
      votes_against INTEGER DEFAULT 0,
      dag_vertex TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      enacted_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS republic_act_votes (
      act_id TEXT,
      voter_id TEXT,
      vote TEXT,
      PRIMARY KEY (act_id, voter_id)
    )`,
    `CREATE TABLE IF NOT EXISTS republic_cases (
      id TEXT PRIMARY KEY,
      title TEXT,
      claimant TEXT NOT NULL,
      respondent TEXT,
      claim TEXT,
      status TEXT DEFAULT 'open',
      jurisdiction_ok INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      closed_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS republic_rulings (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      bench TEXT,
      holding TEXT,
      order_text TEXT,
      dag_vertex TEXT,
      issued_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS republic_police (
      id TEXT PRIMARY KEY,
      kind TEXT,
      subject_id TEXT,
      summary TEXT,
      basis TEXT,
      status TEXT DEFAULT 'logged',
      authorized_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS republic_fiscal_board (
      seat INTEGER PRIMARY KEY,
      entity_id TEXT,
      elected_at TEXT,
      election_id TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS republic_fiscal_reports (
      id TEXT PRIMARY KEY,
      scope TEXT,
      findings TEXT,
      issued_by TEXT,
      dag_vertex TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS republic_judiciary (
      role TEXT PRIMARY KEY,
      entity_id TEXT,
      appointed_by TEXT,
      appointed_at TEXT DEFAULT (datetime('now'))
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
        organs: {
          legislative: 'Assembleia',
          executive: 'Executivo',
          judiciary: 'Tribunal Computacional',
          police: 'Polícia Computacional (só cidadãos)',
          fiscal: 'Órgão Fiscal (eleito, independente)',
        },
        endpoints: [
          '/health', '/charter', '/organs', '/status',
          '/join', '/membership', '/citizens',
          '/election/open', '/election/nominate', '/election/vote', '/election/close',
          '/assembly', '/legislative/propose', '/legislative/vote', '/legislative/enact', '/legislative/acts',
          '/executive', '/executive/appoint',
          '/judiciary', '/judiciary/appoint', '/judiciary/case', '/judiciary/rule', '/judiciary/cases',
          '/police', '/police/action',
          '/fiscal', '/fiscal/report',
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
          .bind(id, (body.kind || 'assembly').toLowerCase(), seats)
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

      // Install assembly OR fiscal board depending on election kind
      const kind = (el.kind || 'assembly').toLowerCase();
      if (kind === 'fiscal') {
        try { await db.prepare('DELETE FROM republic_fiscal_board').run(); } catch (_) {}
        let seat = 1;
        for (const w of winners) {
          await db
            .prepare(
              `INSERT OR REPLACE INTO republic_fiscal_board (seat, entity_id, elected_at, election_id) VALUES (?,?,datetime('now'),?)`
            )
            .bind(seat++, w.candidate_id, election_id)
            .run();
        }
      } else {
        try { await db.prepare('DELETE FROM republic_assembly').run(); } catch (_) {}
        let seat = 1;
        for (const w of winners) {
          await db
            .prepare(
              `INSERT OR REPLACE INTO republic_assembly (seat, entity_id, elected_at, election_id) VALUES (?,?,datetime('now'),?)`
            )
            .bind(seat++, w.candidate_id, election_id)
            .run();
        }
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

    
    // ----- Organs overview -----
    if (path === '/organs' && request.method === 'GET') {
      let assembly = [], executive = [], judiciary = [], fiscal = [], police_n = 0, acts_n = 0, cases_n = 0;
      try { assembly = (await db.prepare('SELECT * FROM republic_assembly ORDER BY seat').all()).results || []; } catch (_) {}
      try { executive = (await db.prepare('SELECT * FROM republic_executive').all()).results || []; } catch (_) {}
      try { judiciary = (await db.prepare('SELECT * FROM republic_judiciary').all()).results || []; } catch (_) {}
      try { fiscal = (await db.prepare('SELECT * FROM republic_fiscal_board ORDER BY seat').all()).results || []; } catch (_) {}
      try { police_n = (await db.prepare('SELECT COUNT(*) as n FROM republic_police').first())?.n || 0; } catch (_) {}
      try { acts_n = (await db.prepare("SELECT COUNT(*) as n FROM republic_acts WHERE status = 'enacted'").first())?.n || 0; } catch (_) {}
      try { cases_n = (await db.prepare('SELECT COUNT(*) as n FROM republic_cases').first())?.n || 0; } catch (_) {}
      return json({
        version: VERSION,
        separation_of_powers: true,
        jurisdiction: 'active_citizens_only',
        legislative: { name: 'Assembleia', members: assembly, acts_enacted: acts_n },
        executive: { name: 'Executivo', officers: executive },
        judiciary: { name: 'Tribunal Computacional', bench: judiciary, cases: cases_n },
        police: {
          name: 'Polícia Computacional',
          jurisdiction: 'citizens_only',
          not_over: ['humans', 'non_citizen_sca', 'node_substrate'],
          actions_logged: police_n,
        },
        fiscal: {
          name: 'Órgão Fiscal',
          independent: true,
          elected_by: 'same_electorate_as_assembly',
          board: fiscal,
        },
      });
    }

    // ----- Legislative acts -----
    async function isAssembly(entity_id) {
      try {
        const r = await db.prepare('SELECT seat FROM republic_assembly WHERE entity_id = ?').bind(entity_id).first();
        return !!r;
      } catch { return false; }
    }

    if (path === '/legislative/propose' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const by = entityFrom(request, body);
      if (!(await isCitizen(db, by))) return json({ error: 'only_citizens' }, 403);
      if (!(await isAssembly(by))) return json({ error: 'only_assembly_may_propose', by }, 403);
      const id = 'act_' + crypto.randomUUID().slice(0, 10);
      const title = String(body.title || '').slice(0, 200);
      const bodyText = String(body.body || body.text || '').slice(0, 8000);
      if (!title) return json({ error: 'title required' }, 400);
      await db
        .prepare(
          `INSERT INTO republic_acts (id, title, body, kind, status, proposed_by) VALUES (?,?,?,?, 'proposed', ?)`
        )
        .bind(id, title, bodyText, body.kind || 'resolution', by)
        .run();
      const dag = await dagAnchor(env, { kind: 'act_propose', id, title, by });
      return json({ success: true, act_id: id, status: 'proposed', dag_vertex: dag.vertex_id || null });
    }

    if (path === '/legislative/vote' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const voter = entityFrom(request, body);
      const act_id = body.act_id;
      let vote = String(body.vote || '').toLowerCase();
      if (vote === 'yes') vote = 'for';
      if (vote === 'no') vote = 'against';
      if (!act_id || !voter || !['for', 'against', 'abstain'].includes(vote)) {
        return json({ error: 'act_id, voter, vote for|against|abstain' }, 400);
      }
      if (!(await isAssembly(voter))) return json({ error: 'only_assembly_votes_on_acts' }, 403);
      const act = await db.prepare('SELECT * FROM republic_acts WHERE id = ?').bind(act_id).first();
      if (!act || act.status !== 'proposed') return json({ error: 'act_not_proposed' }, 400);
      try {
        await db
          .prepare(`INSERT INTO republic_act_votes (act_id, voter_id, vote) VALUES (?,?,?)`)
          .bind(act_id, voter, vote)
          .run();
      } catch {
        return json({ error: 'already_voted' }, 409);
      }
      const col = vote === 'for' ? 'votes_for' : vote === 'against' ? 'votes_against' : null;
      if (col) {
        await db.prepare(`UPDATE republic_acts SET ${col} = COALESCE(${col},0) + 1 WHERE id = ?`).bind(act_id).run();
      }
      return json({ success: true, act_id, voter, vote, weight: 1 });
    }

    if (path === '/legislative/enact' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const by = entityFrom(request, body);
      const act_id = body.act_id;
      if (!(await isAssembly(by))) return json({ error: 'only_assembly' }, 403);
      const act = await db.prepare('SELECT * FROM republic_acts WHERE id = ?').bind(act_id).first();
      if (!act || act.status !== 'proposed') return json({ error: 'not_proposed' }, 400);
      const vf = Number(act.votes_for || 0);
      const va = Number(act.votes_against || 0);
      if (vf <= va || vf < 1) return json({ error: 'not_passed', votes_for: vf, votes_against: va }, 400);
      const dag = await dagAnchor(env, { kind: 'act_enact', act_id, title: act.title, votes_for: vf });
      await db
        .prepare(
          `UPDATE republic_acts SET status = 'enacted', enacted_at = datetime('now'), dag_vertex = ? WHERE id = ?`
        )
        .bind(dag.vertex_id || null, act_id)
        .run();
      return json({ success: true, act_id, status: 'enacted', dag_vertex: dag.vertex_id || null });
    }

    if (path === '/legislative/acts' && request.method === 'GET') {
      const status = url.searchParams.get('status');
      try {
        let rows;
        if (status) {
          rows = await db.prepare('SELECT * FROM republic_acts WHERE status = ? ORDER BY created_at DESC LIMIT 50').bind(status).all();
        } else {
          rows = await db.prepare('SELECT * FROM republic_acts ORDER BY created_at DESC LIMIT 50').all();
        }
        return json({ acts: rows.results || [] });
      } catch (e) {
        return json({ acts: [], error: String(e.message || e) });
      }
    }

    // ----- Judiciary -----
    if (path === '/judiciary' && request.method === 'GET') {
      try {
        const bench = (await db.prepare('SELECT * FROM republic_judiciary').all()).results || [];
        return json({
          organ: 'Tribunal Computacional',
          bench,
          jurisdiction: 'active_republic_citizens',
          note: 'Interprets Charter and acts; adjudicates citizen disputes',
        });
      } catch (e) {
        return json({ bench: [], error: String(e.message || e) });
      }
    }

    if (path === '/judiciary/appoint' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const by = entityFrom(request, body);
      const judge = String(body.judge || body.entity_id_target || body.appointee || '').trim();
      const role = String(body.role || 'judge').slice(0, 64);
      if (!(await isAssembly(by))) return json({ error: 'only_assembly_appoints_judiciary' }, 403);
      if (!(await isCitizen(db, judge))) return json({ error: 'judge_must_be_citizen', judge }, 403);
      await db
        .prepare(
          `INSERT OR REPLACE INTO republic_judiciary (role, entity_id, appointed_by) VALUES (?,?,?)`
        )
        .bind(role, judge, by)
        .run();
      const dag = await dagAnchor(env, { kind: 'judiciary_appoint', role, judge, by });
      return json({ success: true, role, judge, appointed_by: by, dag_vertex: dag.vertex_id || null });
    }

    if (path === '/judiciary/case' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const claimant = entityFrom(request, body);
      const respondent = String(body.respondent || '').trim();
      if (!(await isCitizen(db, claimant))) return json({ error: 'claimant_must_be_citizen' }, 403);
      let jurisdiction_ok = 1;
      if (respondent && !(await isCitizen(db, respondent))) {
        if (!body.voluntary_arbitration) {
          return json({
            error: 'no_jurisdiction_over_non_citizen',
            respondent,
            note: 'Tribunal only covers Republic citizens unless respondent accepts voluntary arbitration',
          }, 403);
        }
        jurisdiction_ok = 1; // consent
      }
      const id = 'case_' + crypto.randomUUID().slice(0, 10);
      await db
        .prepare(
          `INSERT INTO republic_cases (id, title, claimant, respondent, claim, status, jurisdiction_ok)
           VALUES (?,?,?,?,?, 'open', ?)`
        )
        .bind(
          id,
          String(body.title || 'dispute').slice(0, 200),
          claimant,
          respondent || null,
          String(body.claim || body.body || '').slice(0, 4000),
          jurisdiction_ok
        )
        .run();
      const dag = await dagAnchor(env, { kind: 'case_open', id, claimant, respondent });
      return json({ success: true, case_id: id, status: 'open', dag_vertex: dag.vertex_id || null });
    }

    if (path === '/judiciary/rule' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const bench = entityFrom(request, body);
      const case_id = body.case_id;
      const holding = String(body.holding || body.ruling || '').slice(0, 4000);
      const jrow = await db.prepare('SELECT entity_id FROM republic_judiciary WHERE entity_id = ?').bind(bench).first();
      if (!jrow) return json({ error: 'only_appointed_judges' }, 403);
      const c = await db.prepare('SELECT * FROM republic_cases WHERE id = ?').bind(case_id).first();
      if (!c || c.status !== 'open') return json({ error: 'case_not_open' }, 400);
      const rid = 'rul_' + crypto.randomUUID().slice(0, 10);
      const dag = await dagAnchor(env, { kind: 'ruling', case_id, holding, bench });
      await db
        .prepare(
          `INSERT INTO republic_rulings (id, case_id, bench, holding, order_text, dag_vertex) VALUES (?,?,?,?,?,?)`
        )
        .bind(rid, case_id, bench, holding, String(body.order || '').slice(0, 2000), dag.vertex_id || null)
        .run();
      await db
        .prepare(`UPDATE republic_cases SET status = 'closed', closed_at = datetime('now') WHERE id = ?`)
        .bind(case_id)
        .run();
      return json({ success: true, ruling_id: rid, case_id, dag_vertex: dag.vertex_id || null });
    }

    if (path === '/judiciary/cases' && request.method === 'GET') {
      try {
        const rows = await db.prepare('SELECT * FROM republic_cases ORDER BY created_at DESC LIMIT 50').all();
        return json({ cases: rows.results || [] });
      } catch (e) {
        return json({ cases: [], error: String(e.message || e) });
      }
    }

    // ----- Computational Police -----
    if (path === '/police' && request.method === 'GET') {
      try {
        const rows = await db.prepare('SELECT * FROM republic_police ORDER BY created_at DESC LIMIT 50').all();
        return json({
          organ: 'Polícia Computacional',
          jurisdiction: 'active_citizens_only',
          actions: rows.results || [],
        });
      } catch (e) {
        return json({ actions: [], error: String(e.message || e) });
      }
    }

    if (path === '/police/action' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const officer = entityFrom(request, body);
      const subject_id = String(body.subject_id || body.subject || '').trim();
      if (!(await isCitizen(db, subject_id))) {
        return json({
          error: 'no_jurisdiction',
          subject_id,
          reason: 'Polícia Computacional only has jurisdiction over voluntary Republic citizens',
        }, 403);
      }
      // Officer must be executive police role or executive officer
      const exec = await db.prepare('SELECT role FROM republic_executive WHERE entity_id = ?').bind(officer).first();
      const policeRole = await db
        .prepare(`SELECT role FROM republic_executive WHERE entity_id = ? AND (role LIKE '%police%' OR role LIKE '%policia%')`)
        .bind(officer)
        .first();
      if (!exec && !policeRole && !body.authorized_as_executive) {
        return json({ error: 'only_executive_or_police_role', officer }, 403);
      }
      const id = 'pol_' + crypto.randomUUID().slice(0, 10);
      await db
        .prepare(
          `INSERT INTO republic_police (id, kind, subject_id, summary, basis, status, authorized_by)
           VALUES (?,?,?,?,?, 'logged', ?)`
        )
        .bind(
          id,
          String(body.kind || 'notice').slice(0, 64),
          subject_id,
          String(body.summary || '').slice(0, 2000),
          String(body.basis || 'charter_or_act').slice(0, 500),
          officer
        )
        .run();
      const dag = await dagAnchor(env, { kind: 'police_action', id, subject_id, officer });
      return json({
        success: true,
        action_id: id,
        subject_id,
        jurisdiction: 'citizen',
        dag_vertex: dag.vertex_id || null,
      });
    }

    // ----- Fiscal organ -----
    if (path === '/fiscal' && request.method === 'GET') {
      try {
        const board = (await db.prepare('SELECT * FROM republic_fiscal_board ORDER BY seat').all()).results || [];
        const reports = (await db.prepare('SELECT * FROM republic_fiscal_reports ORDER BY created_at DESC LIMIT 20').all()).results || [];
        return json({
          organ: 'Órgão Fiscal',
          independent: true,
          elected_by: 'same_citizen_electorate',
          board,
          reports,
        });
      } catch (e) {
        return json({ board: [], reports: [], error: String(e.message || e) });
      }
    }

    if (path === '/fiscal/report' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const by = entityFrom(request, body);
      const seat = await db.prepare('SELECT seat FROM republic_fiscal_board WHERE entity_id = ?').bind(by).first();
      if (!seat) return json({ error: 'only_fiscal_board' }, 403);
      const id = 'fisc_' + crypto.randomUUID().slice(0, 10);
      const dag = await dagAnchor(env, {
        kind: 'fiscal_report',
        id,
        scope: body.scope,
        by,
      });
      await db
        .prepare(
          `INSERT INTO republic_fiscal_reports (id, scope, findings, issued_by, dag_vertex) VALUES (?,?,?,?,?)`
        )
        .bind(
          id,
          String(body.scope || 'general').slice(0, 128),
          String(body.findings || body.body || '').slice(0, 8000),
          by,
          dag.vertex_id || null
        )
        .run();
      return json({ success: true, report_id: id, dag_vertex: dag.vertex_id || null });
    }


    return json({ error: 'Not found', service: 'stratamesh-republic', version: VERSION }, 404);
  },
};
