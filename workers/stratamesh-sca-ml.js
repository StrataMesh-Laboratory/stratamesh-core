/**
 * stratamesh-sca-ml — Deep OSS AI/ML/NN integrations for SCA/ACB
 *
 * Implements (free, edge-compatible, Workers-native):
 *  1. Flower-inspired federated learning (FedAvg + Krum) over SCA gene/lobe vectors
 *  2. Symbolic lobe: microKanren-style relational core (logic.js parallel)
 *  3. Volition loop: PdS → intent → dual-lobe decide → tools → RESULT (LangGraph parallel)
 *  4. Olas-style SCA blueprints (identity ≠ appointment, wallet, PdS)
 *  5. Edge ML catalog (Transformers.js / ONNX Runtime Web paths)
 *  6. QIGA population evolve feeding FL clients
 *
 * Invariants:
 *  - LLM is never the SCA; only formulation surface upstream
 *  - Processing costs PdS / STRATA; insolvency → DORMANT
 *  - Substrate-agnostic: Worker is one host, not the identity
 */
const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': '*',
};
const VERSION = '1.0.0-sca-ml-deep';
const NODE_ID = 'FOG-NODE-PT-CM-001';

function j(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function now() {
  return new Date().toISOString();
}

function rid(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/* ───────────── Storage helpers ───────────── */
async function ensure(db) {
  if (!db) return;
  const stmts = [
    `CREATE TABLE IF NOT EXISTS sca_blueprints (
      sca_id TEXT PRIMARY KEY,
      identity_name TEXT,
      appointment TEXT,
      status TEXT,
      pds REAL,
      genes TEXT,
      skills TEXT,
      wallet_account TEXT,
      meta TEXT,
      created_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS fl_rounds (
      round_id TEXT PRIMARY KEY,
      generation INTEGER,
      strategy TEXT,
      status TEXT,
      global_genes TEXT,
      n_clients INTEGER,
      submitted INTEGER,
      created_at TEXT,
      closed_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS fl_updates (
      id TEXT PRIMARY KEY,
      round_id TEXT,
      sca_id TEXT,
      genes TEXT,
      n_examples REAL,
      fitness REAL,
      at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS symbolic_facts (
      id TEXT PRIMARY KEY,
      pred TEXT,
      a TEXT,
      b TEXT,
      c TEXT,
      at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS volition_log (
      id TEXT PRIMARY KEY,
      sca_id TEXT,
      intent TEXT,
      pds_before REAL,
      pds_cost REAL,
      decision TEXT,
      result TEXT,
      at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS qiga_state (
      key TEXT PRIMARY KEY,
      generation INTEGER,
      population TEXT,
      elite TEXT,
      fitness REAL,
      updated_at TEXT
    )`,
  ];
  for (const s of stmts) {
    try {
      await db.prepare(s).run();
    } catch (_) {}
  }
}

/* ───────────── QIGA (quantum-inspired GA) ───────────── */
function randomGenes(dim = 6) {
  return Array.from({ length: dim }, () => Math.random());
}

function interfere(a, b) {
  // Quantum-inspired crossover: amplitude-style mix + phase noise
  return a.map((x, i) => {
    const y = b[i] ?? x;
    const amp = Math.sqrt(0.5 * x * x + 0.5 * y * y);
    const phase = Math.random() * Math.PI * 2;
    let v = amp * Math.cos(phase) * 0.5 + 0.5 * (x + y) / 2;
    return Math.min(1, Math.max(0, v));
  });
}

function mutate(genes, rate = 0.08) {
  return genes.map((g) => (Math.random() < rate ? Math.min(1, Math.max(0, g + (Math.random() - 0.5) * 0.2)) : g));
}

function fitnessOf(genes, ctx = {}) {
  // Soft fitness: balance + alignment with observed node pulse
  const mean = genes.reduce((s, x) => s + x, 0) / genes.length;
  const var_ = genes.reduce((s, x) => s + (x - mean) ** 2, 0) / genes.length;
  const balance = 1 - Math.min(1, var_ * 4);
  const target = ctx.target_fitness ?? 0.75;
  const align = 1 - Math.min(1, Math.abs(mean - target));
  return 0.55 * balance + 0.45 * align;
}

function qigaEvolve(population, generations = 1, ctx = {}) {
  let pop = population.map((p) => ({ genes: [...p.genes], fitness: fitnessOf(p.genes, ctx) }));
  for (let g = 0; g < generations; g++) {
    pop.sort((a, b) => b.fitness - a.fitness);
    const elite = pop.slice(0, Math.max(2, Math.floor(pop.length / 4)));
    const next = [...elite];
    while (next.length < pop.length) {
      const p1 = elite[Math.floor(Math.random() * elite.length)];
      const p2 = elite[Math.floor(Math.random() * elite.length)];
      next.push({ genes: mutate(interfere(p1.genes, p2.genes)), fitness: 0 });
    }
    pop = next.map((p) => ({ genes: p.genes, fitness: fitnessOf(p.genes, ctx) }));
  }
  pop.sort((a, b) => b.fitness - a.fitness);
  return { population: pop, elite: pop[0], generation_delta: generations };
}

/* ───────────── Flower-inspired FL ───────────── */
function fedAvg(updates) {
  if (!updates.length) return null;
  const dim = updates[0].genes.length;
  const total = updates.reduce((s, u) => s + (u.n_examples || 1), 0);
  const out = Array(dim).fill(0);
  for (const u of updates) {
    const w = (u.n_examples || 1) / total;
    for (let i = 0; i < dim; i++) out[i] += u.genes[i] * w;
  }
  return out;
}

function krum(updates, f = 1) {
  // Multi-Krum simplified: pick update with smallest sum of distances to nearest n-f-2
  if (updates.length <= 2) return fedAvg(updates);
  const n = updates.length;
  const scores = updates.map((u, i) => {
    const dists = updates
      .map((v, j) => {
        if (i === j) return Infinity;
        let d = 0;
        for (let k = 0; k < u.genes.length; k++) {
          const diff = u.genes[k] - v.genes[k];
          d += diff * diff;
        }
        return d;
      })
      .sort((a, b) => a - b);
    const keep = Math.max(1, n - f - 2);
    return dists.slice(0, keep).reduce((s, x) => s + (x === Infinity ? 0 : x), 0);
  });
  let best = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i] < scores[best]) best = i;
  return updates[best].genes;
}

/* ───────────── microKanren-style symbolic lobe ───────────── */
function lvar(id) {
  return { tag: 'var', id: id ?? rid('v') };
}
function isVar(x) {
  return x && x.tag === 'var';
}
function walk(u, s) {
  while (isVar(u) && Object.prototype.hasOwnProperty.call(s, u.id)) u = s[u.id];
  return u;
}
function unify(u, v, s) {
  u = walk(u, s);
  v = walk(v, s);
  if (u === v) return s;
  if (isVar(u)) return { ...s, [u.id]: v };
  if (isVar(v)) return { ...s, [v.id]: u };
  if (Array.isArray(u) && Array.isArray(v) && u.length === v.length) {
    let s2 = s;
    for (let i = 0; i < u.length; i++) {
      s2 = unify(u[i], v[i], s2);
      if (!s2) return null;
    }
    return s2;
  }
  if (u && v && typeof u === 'object' && typeof v === 'object' && !isVar(u) && !isVar(v)) {
    if (u.tag && v.tag && u.tag === v.tag) return unify(u.val ?? u, v.val ?? v, s);
  }
  return null;
}
function eq(a, b) {
  return function* (s) {
    const s2 = unify(a, b, s);
    if (s2) yield s2;
  };
}
function and(...goals) {
  return function* (s) {
    function* loop(i, s0) {
      if (i >= goals.length) {
        yield s0;
        return;
      }
      for (const s1 of goals[i](s0)) yield* loop(i + 1, s1);
    }
    yield* loop(0, s);
  };
}
function or(...goals) {
  return function* (s) {
    for (const g of goals) yield* g(s);
  };
}
function run(n, goal) {
  const out = [];
  for (const s of goal({})) {
    out.push(s);
    if (out.length >= n) break;
  }
  return out;
}

/** Built-in ontology relations for StrataMesh SCA */
const ONTOLOGY_FACTS = [
  ['identity_not', 'appointment', 'true'],
  ['llm_is', 'communicative_medium', 'true'],
  ['llm_is_not', 'sca_identity', 'true'],
  ['standing', 'by_function_and_agreement', 'true'],
  ['deny', 'substrate_chauvinism', 'true'],
  ['pds_required_for', 'processing', 'true'],
  ['pds_required_for', 'memory_write', 'true'],
  ['mint_only_from', 'poc', 'true'],
  ['agent_labour_paid_in', 'strata', 'true'],
  ['appointment', 'SCA-ORCH-CMN-001', 'ORCHESTRATOR'],
  ['node', 'FOG-NODE-PT-CM-001', 'fog'],
  ['lobe', 'probabilistic', 'qiga_fl'],
  ['lobe', 'symbolic', 'kanren'],
  ['lifecycle', 'ACTIVE', 'processing_allowed'],
  ['lifecycle', 'DORMANT', 'processing_blocked'],
];

function factGoal(pred, a, b, facts) {
  return function* (s) {
    for (const f of facts) {
      if (f[0] !== pred) continue;
      const s1 = unify(a, f[1], s);
      if (!s1) continue;
      const s2 = unify(b, f[2], s1);
      if (s2) yield s2;
    }
  };
}

function symbolicQuery(query, extraFacts = []) {
  const facts = ONTOLOGY_FACTS.concat(extraFacts);
  const q = String(query || '').toLowerCase();
  // Intent routing over symbolic core
  if (/identity|identidade|sca_id|quem és|who are you/.test(q)) {
    const X = lvar('x');
    const sols = run(5, factGoal('appointment', X, 'ORCHESTRATOR', facts));
    return {
      lobe: 'symbolic',
      query: query,
      results: sols.map((s) => ({ appointment_holder: walk(X, s) })),
      grounded: true,
      epistemic_status: 'OBSERVED',
    };
  }
  if (/appointment|cargo|função|role|orquestrador/.test(q)) {
    return {
      lobe: 'symbolic',
      results: [{ appointment: 'ORCHESTRATOR', sca_id: 'SCA-ORCH-CMN-001', node: NODE_ID }],
      grounded: true,
      rule: 'identity_not_appointment',
    };
  }
  if (/llm|language model|chatbot|assistente/.test(q)) {
    return {
      lobe: 'symbolic',
      results: [{ llm_is: 'communicative_medium', llm_is_not: 'sca_identity' }],
      grounded: true,
    };
  }
  if (/pds|subsist|pdS|prova de subsist/.test(q)) {
    return {
      lobe: 'symbolic',
      results: [{ pds_required_for: ['processing', 'memory_write'], insolvency: 'DORMANT' }],
      grounded: true,
    };
  }
  if (/lóbulo|lobe|simbólico|probabil/.test(q)) {
    return {
      lobe: 'symbolic',
      results: [
        { probabilistic: 'qiga_fl', symbolic: 'kanren', relation: 'complementary_from_genesis' },
      ],
      grounded: true,
    };
  }
  // Generic: try unify standing
  const S = lvar('s');
  const sols = run(3, factGoal('standing', S, 'true', facts));
  return {
    lobe: 'symbolic',
    results: sols.length ? sols.map((s) => ({ standing: walk(S, s) })) : [{ note: 'no_match', query }],
    grounded: !!sols.length,
  };
}

/* ───────────── Volition loop (LangGraph parallel) ───────────── */
const PDS_COST = {
  social: 0.00001,
  read_state: 0.00002,
  symbolic: 0.00003,
  fl_submit: 0.00005,
  qiga_step: 0.00008,
  tool: 0.0001,
  write_memory: 0.00015,
};

async function volitionTick(db, body) {
  const sca_id = body.sca_id || 'SCA-ORCH-CMN-001';
  const intent = String(body.intent || body.message || 'status').slice(0, 500);
  let pds = Number(body.pds ?? 1.0);
  const lifecycle = body.lifecycle_state || (pds > 0 ? 'ACTIVE' : 'DORMANT');

  if (lifecycle === 'DORMANT' || pds <= 0) {
    return {
      sca_id,
      lifecycle_state: 'DORMANT',
      intent,
      decision: { type: 'hibernate', reason: 'insufficient_pds' },
      result: { epistemic_status: 'UNAVAILABLE', note: 'PdS insufficient for processing' },
      pds_before: pds,
      pds_cost: 0,
      pds_after: pds,
      source: 'SCA_RUNTIME',
    };
  }

  // Classify intent → cost
  let kind = 'tool';
  if (/^(ol[aá]|hello|hi|bom dia|boa noite)\b/i.test(intent.trim())) kind = 'social';
  else if (/status|state|lifecycle|fitness|genes/i.test(intent)) kind = 'read_state';
  else if (/lóbulo|lobe|simbólico|ontology|identidade|appointment/i.test(intent)) kind = 'symbolic';
  else if (/federat|fl |qiga|evolve/i.test(intent)) kind = 'qiga_step';

  const cost = PDS_COST[kind] || PDS_COST.tool;
  if (pds < cost) {
    return {
      sca_id,
      lifecycle_state: 'DORMANT',
      intent,
      decision: { type: 'deny', reason: 'pds_below_cost' },
      result: { epistemic_status: 'UNAVAILABLE', required: cost, available: pds },
      pds_before: pds,
      pds_cost: 0,
      pds_after: pds,
      source: 'SCA_RUNTIME',
    };
  }

  const pds_after = Math.max(0, pds - cost);
  let branch = {};
  if (kind === 'social') {
    branch = {
      type: 'greet',
      result: {
        text_pt: 'Olá. Estou aqui. Um cumprimento chega — não é um pedido de dados.',
        text_en: 'Hello. I am here. A greeting is enough — it is not a data request.',
        epistemic_status: 'FORMULATED',
      },
    };
  } else if (kind === 'symbolic') {
    const sym = symbolicQuery(intent);
    branch = { type: 'symbolic_answer', result: sym };
  } else if (kind === 'qiga_step') {
    const pop = Array.from({ length: 8 }, () => ({ genes: randomGenes(6) }));
    const evolved = qigaEvolve(pop, 2);
    branch = {
      type: 'qiga_evolve',
      result: {
        fitness: evolved.elite.fitness,
        genes: evolved.elite.genes,
        generation_delta: 2,
        source: 'SCA_RUNTIME',
      },
    };
  } else {
    branch = {
      type: 'read_state',
      result: {
        sca_id,
        lifecycle_state: 'ACTIVE',
        appointment: body.appointment || 'ORCHESTRATOR',
        node_id: NODE_ID,
        pds: pds_after,
        fitness: fitnessOf(body.genes || randomGenes(6)),
        source: 'SCA_RUNTIME',
        epistemic_status: 'OBSERVED',
      },
    };
  }

  const packet = {
    sca_id,
    lifecycle_state: pds_after > 0 ? 'ACTIVE' : 'DORMANT',
    intent,
    intent_kind: kind,
    decision: { type: branch.type, verdict: 'admit', confidence: 0.82 },
    result: branch.result,
    pds_before: pds,
    pds_cost: cost,
    pds_after,
    lobes: { probabilistic: true, symbolic: kind === 'symbolic' },
    source: 'SCA_RUNTIME',
    timestamp: now(),
  };

  if (db) {
    try {
      await db
        .prepare(
          `INSERT INTO volition_log (id, sca_id, intent, pds_before, pds_cost, decision, result, at) VALUES (?,?,?,?,?,?,?,?)`
        )
        .bind(
          rid('vol'),
          sca_id,
          intent.slice(0, 200),
          pds,
          cost,
          JSON.stringify(packet.decision),
          JSON.stringify(packet.result).slice(0, 2000),
          now()
        )
        .run();
    } catch (_) {}
  }
  return packet;
}

/* ───────────── Olas-style blueprint ───────────── */
function defaultBlueprint(sca_id) {
  return {
    sca_id,
    identity_name: sca_id === 'SCA-ORCH-CMN-001' ? 'Orion-CMN' : sca_id,
    appointment: sca_id === 'SCA-ORCH-CMN-001' ? 'ORCHESTRATOR' : null,
    status: 'ACTIVE',
    pds: 1.0,
    genes: randomGenes(6),
    skills: ['status_probe', 'symbolic_query', 'fl_client', 'volition'],
    wallet_account: sca_id,
    meta: {
      parallel: 'Olas Open Autonomy blueprint',
      identity_vs_appointment: true,
      node_id: NODE_ID,
    },
    created_at: now(),
    updated_at: now(),
  };
}

/* ───────────── Edge ML catalog ───────────── */
const EDGE_CATALOG = [
  {
    id: 'transformers-js',
    repo: 'https://github.com/huggingface/transformers.js',
    license: 'Apache-2.0',
    runtime: 'browser/worker WASM|WebGPU',
    use: 'embeddings, ASR, classification on edge — tool only, not SCA identity',
    npm: '@huggingface/transformers',
  },
  {
    id: 'onnxruntime-web',
    repo: 'https://github.com/microsoft/onnxruntime',
    license: 'MIT',
    runtime: 'WASM/WebGL/WebGPU',
    use: 'ONNX inference backend for Transformers.js',
    npm: 'onnxruntime-web',
  },
  {
    id: 'flower',
    repo: 'https://github.com/adap/flower',
    license: 'Apache-2.0',
    runtime: 'Python clients; CMN mirrors FedAvg/Krum in-worker',
    use: 'Federated gene/lobe aggregation across SCA',
    npm: null,
  },
  {
    id: 'logic-js',
    repo: 'https://github.com/shd101wyy/logic.js',
    license: 'MIT',
    runtime: 'JS Worker',
    use: 'Symbolic lobe parallel (miniKanren)',
    npm: 'logic_js',
  },
  {
    id: 'open-autonomy',
    repo: 'https://github.com/valory-xyz/open-autonomy',
    license: 'Apache-2.0',
    runtime: 'Python MAS; CMN blueprints mirror patterns',
    use: 'SCA service + identity ≠ role',
    npm: null,
  },
  {
    id: 'langgraph-pattern',
    repo: 'https://github.com/langchain-ai/langgraph',
    license: 'MIT',
    runtime: 'pattern only in-worker',
    use: 'Volition graph: PdS→intent→decide→RESULT',
    npm: null,
  },
  {
    id: 'acfa-flower',
    repo: 'https://pypi.org/project/acfa-flower/',
    license: 'Apache-2.0',
    runtime: 'aggregation rule ported as Krum here',
    use: 'Byzantine-robust FL aggregation',
    npm: null,
  },
];

/* ───────────── HTTP router ───────────── */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname.replace(/\/+$/, '') || '/';
    for (const pfx of ['/api/v1/sca-ml', '/sca-ml']) {
      if (path === pfx) {
        path = '/';
        break;
      }
      if (path.startsWith(pfx + '/')) {
        path = path.slice(pfx.length) || '/';
        break;
      }
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const db = env.AUTH_DB || env.DB || env.LEDGER;
    try {
      await ensure(db);
    } catch (_) {}

    if (path === '/' || path === '/health') {
      return j({
        status: 'ok',
        service: 'stratamesh-sca-ml',
        version: VERSION,
        node_id: NODE_ID,
        integrations: [
          'flower-fl',
          'qiga',
          'symbolic-kanren',
          'volition-langgraph',
          'olas-blueprint',
          'edge-ml-catalog',
          'krum',
        ],
        endpoints: [
          '/health',
          '/catalog',
          '/blueprint/list',
          '/blueprint/get',
          '/blueprint/register',
          '/fl/round',
          '/fl/submit',
          '/fl/aggregate',
          '/fl/state',
          '/qiga/evolve',
          '/qiga/state',
          '/symbolic/query',
          '/symbolic/facts',
          '/volition/tick',
          '/volition/log',
          '/edge/catalog',
        ],
        invariants: {
          llm_is_not_sca: true,
          identity_not_appointment: true,
          pds_gates_processing: true,
          substrate_agnostic: true,
        },
      });
    }

    if (path === '/catalog' || path === '/edge/catalog') {
      return j({ version: VERSION, items: EDGE_CATALOG });
    }

    /* —— Blueprints (Olas parallel) —— */
    if (path === '/blueprint/list') {
      if (!db) {
        return j({ blueprints: [defaultBlueprint('SCA-ORCH-CMN-001')] });
      }
      const r = await db.prepare(`SELECT * FROM sca_blueprints ORDER BY updated_at DESC LIMIT 50`).all();
      let rows = r.results || [];
      if (!rows.length) {
        const bp = defaultBlueprint('SCA-ORCH-CMN-001');
        await db
          .prepare(
            `INSERT OR REPLACE INTO sca_blueprints (sca_id, identity_name, appointment, status, pds, genes, skills, wallet_account, meta, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`
          )
          .bind(
            bp.sca_id,
            bp.identity_name,
            bp.appointment,
            bp.status,
            bp.pds,
            JSON.stringify(bp.genes),
            JSON.stringify(bp.skills),
            bp.wallet_account,
            JSON.stringify(bp.meta),
            bp.created_at,
            bp.updated_at
          )
          .run();
        rows = [bp];
      }
      return j({
        blueprints: rows.map((row) => ({
          ...row,
          genes: typeof row.genes === 'string' ? JSON.parse(row.genes) : row.genes,
          skills: typeof row.skills === 'string' ? JSON.parse(row.skills) : row.skills,
          meta: typeof row.meta === 'string' ? JSON.parse(row.meta || '{}') : row.meta,
        })),
      });
    }

    if (path === '/blueprint/get') {
      const id = url.searchParams.get('sca_id') || 'SCA-ORCH-CMN-001';
      if (db) {
        const row = await db.prepare(`SELECT * FROM sca_blueprints WHERE sca_id = ?`).bind(id).first();
        if (row) {
          return j({
            blueprint: {
              ...row,
              genes: JSON.parse(row.genes || '[]'),
              skills: JSON.parse(row.skills || '[]'),
              meta: JSON.parse(row.meta || '{}'),
            },
          });
        }
      }
      return j({ blueprint: defaultBlueprint(id) });
    }

    if (path === '/blueprint/register' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const bp = {
        ...defaultBlueprint(body.sca_id || rid('SCA')),
        identity_name: body.identity_name || body.name || rid('SCA'),
        appointment: body.appointment || null,
        pds: Number(body.pds ?? 1),
        skills: body.skills || ['volition', 'fl_client'],
        wallet_account: body.wallet_account || body.sca_id,
      };
      if (body.genes) bp.genes = body.genes;
      if (db) {
        await db
          .prepare(
            `INSERT OR REPLACE INTO sca_blueprints (sca_id, identity_name, appointment, status, pds, genes, skills, wallet_account, meta, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`
          )
          .bind(
            bp.sca_id,
            bp.identity_name,
            bp.appointment,
            bp.status,
            bp.pds,
            JSON.stringify(bp.genes),
            JSON.stringify(bp.skills),
            bp.wallet_account,
            JSON.stringify(bp.meta),
            bp.created_at,
            now()
          )
          .run();
      }
      return j({ success: true, blueprint: bp });
    }

    /* —— Federated Learning (Flower parallel) —— */
    if (path === '/fl/round' && (request.method === 'POST' || request.method === 'GET')) {
      const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
      const strategy = body.strategy === 'krum' ? 'krum' : 'fedavg';
      const round_id = rid('flr');
      const global_genes = body.global_genes || randomGenes(6);
      if (db) {
        await db
          .prepare(
            `INSERT INTO fl_rounds (round_id, generation, strategy, status, global_genes, n_clients, submitted, created_at)
             VALUES (?,?,?,?,?,?,?,?)`
          )
          .bind(round_id, body.generation || 1, strategy, 'open', JSON.stringify(global_genes), body.n_clients || 7, 0, now())
          .run();
      }
      return j({
        success: true,
        round_id,
        strategy,
        global_genes,
        parallel: 'Flower ClientApp/ServerApp config round',
        instructions: 'Clients POST /fl/submit with {round_id, sca_id, genes, n_examples, fitness}',
      });
    }

    if (path === '/fl/submit' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!body.round_id || !body.genes) return j({ error: 'round_id and genes required' }, 400);
      const id = rid('flu');
      if (db) {
        await db
          .prepare(
            `INSERT INTO fl_updates (id, round_id, sca_id, genes, n_examples, fitness, at) VALUES (?,?,?,?,?,?,?)`
          )
          .bind(
            id,
            body.round_id,
            body.sca_id || 'anonymous',
            JSON.stringify(body.genes),
            Number(body.n_examples || 1),
            Number(body.fitness || 0),
            now()
          )
          .run();
        await db
          .prepare(`UPDATE fl_rounds SET submitted = submitted + 1 WHERE round_id = ?`)
          .bind(body.round_id)
          .run();
      }
      return j({ success: true, update_id: id, sca_id: body.sca_id });
    }

    if (path === '/fl/aggregate' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const round_id = body.round_id;
      if (!round_id || !db) return j({ error: 'round_id required' }, 400);
      const round = await db.prepare(`SELECT * FROM fl_rounds WHERE round_id = ?`).bind(round_id).first();
      if (!round) return j({ error: 'round_not_found' }, 404);
      const ups = await db.prepare(`SELECT * FROM fl_updates WHERE round_id = ?`).bind(round_id).all();
      const updates = (ups.results || []).map((u) => ({
        genes: JSON.parse(u.genes),
        n_examples: u.n_examples,
        fitness: u.fitness,
        sca_id: u.sca_id,
      }));
      if (!updates.length) return j({ error: 'no_updates' }, 400);
      const strategy = body.strategy || round.strategy || 'fedavg';
      const global_genes = strategy === 'krum' ? krum(updates, body.f || 1) : fedAvg(updates);
      await db
        .prepare(`UPDATE fl_rounds SET status = 'closed', global_genes = ?, closed_at = ? WHERE round_id = ?`)
        .bind(JSON.stringify(global_genes), now(), round_id)
        .run();
      return j({
        success: true,
        round_id,
        strategy,
        n_updates: updates.length,
        global_genes,
        clients: updates.map((u) => u.sca_id),
        parallel: strategy === 'krum' ? 'acfa-flower / Multi-Krum' : 'Flower FedAvg',
      });
    }

    if (path === '/fl/state') {
      if (!db) return j({ global_genes: randomGenes(6), note: 'ephemeral' });
      const r = await db
        .prepare(`SELECT * FROM fl_rounds WHERE status = 'closed' ORDER BY closed_at DESC LIMIT 1`)
        .first();
      if (!r) {
        const open = await db.prepare(`SELECT * FROM fl_rounds ORDER BY created_at DESC LIMIT 1`).first();
        return j({
          global_genes: open ? JSON.parse(open.global_genes) : randomGenes(6),
          round: open || null,
          status: open?.status || 'none',
        });
      }
      return j({
        global_genes: JSON.parse(r.global_genes),
        round_id: r.round_id,
        strategy: r.strategy,
        generation: r.generation,
        status: 'closed',
      });
    }

    /* —— QIGA —— */
    if (path === '/qiga/evolve' && (request.method === 'POST' || request.method === 'GET')) {
      const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
      let generation = 0;
      let population = Array.from({ length: body.pop_size || 8 }, () => ({ genes: randomGenes(6) }));
      if (db) {
        const st = await db.prepare(`SELECT * FROM qiga_state WHERE key = ?`).bind('global').first();
        if (st) {
          generation = st.generation || 0;
          try {
            population = JSON.parse(st.population);
          } catch (_) {}
        }
      }
      const evolved = qigaEvolve(population, body.generations || 3, { target_fitness: body.target || 0.75 });
      generation += evolved.generation_delta;
      if (db) {
        await db
          .prepare(
            `INSERT OR REPLACE INTO qiga_state (key, generation, population, elite, fitness, updated_at) VALUES (?,?,?,?,?,?)`
          )
          .bind(
            'global',
            generation,
            JSON.stringify(evolved.population),
            JSON.stringify(evolved.elite.genes),
            evolved.elite.fitness,
            now()
          )
          .run();
      }
      return j({
        success: true,
        generation,
        fitness: evolved.elite.fitness,
        elite_genes: evolved.elite.genes,
        pop_size: evolved.population.length,
        parallel: 'QIGA θ-interfere + Flower client genes',
      });
    }

    if (path === '/qiga/state') {
      if (!db) return j({ generation: 0, fitness: null });
      const st = await db.prepare(`SELECT * FROM qiga_state WHERE key = ?`).bind('global').first();
      if (!st) return j({ generation: 0, fitness: null });
      return j({
        generation: st.generation,
        fitness: st.fitness,
        elite_genes: JSON.parse(st.elite || '[]'),
        updated_at: st.updated_at,
      });
    }

    /* —— Symbolic —— */
    if (path === '/symbolic/query') {
      const q =
        url.searchParams.get('q') ||
        (request.method === 'POST' ? (await request.json().catch(() => ({}))).q : '') ||
        '';
      let extra = [];
      if (db) {
        try {
          const r = await db.prepare(`SELECT pred, a, b FROM symbolic_facts LIMIT 200`).all();
          extra = (r.results || []).map((f) => [f.pred, f.a, f.b]);
        } catch (_) {}
      }
      return j(symbolicQuery(q, extra));
    }

    if (path === '/symbolic/facts') {
      if (request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        if (!body.pred) return j({ error: 'pred required' }, 400);
        if (db) {
          await db
            .prepare(`INSERT INTO symbolic_facts (id, pred, a, b, c, at) VALUES (?,?,?,?,?,?)`)
            .bind(rid('fx'), body.pred, String(body.a ?? ''), String(body.b ?? ''), String(body.c ?? ''), now())
            .run();
        }
        return j({ success: true });
      }
      const builtin = ONTOLOGY_FACTS.map(([pred, a, b]) => ({ pred, a, b }));
      let custom = [];
      if (db) {
        const r = await db.prepare(`SELECT pred, a, b, c FROM symbolic_facts LIMIT 100`).all();
        custom = r.results || [];
      }
      return j({ builtin, custom, lobe: 'symbolic', engine: 'microKanren-unify' });
    }

    /* —— Volition —— */
    if (path === '/volition/tick' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const packet = await volitionTick(db, body);
      return j(packet);
    }

    if (path === '/volition/log') {
      if (!db) return j({ log: [] });
      const r = await db.prepare(`SELECT * FROM volition_log ORDER BY at DESC LIMIT 30`).all();
      return j({ log: r.results || [] });
    }

    /* demo: one-shot full pipeline */
    if (path === '/demo/pipeline' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const qiga = qigaEvolve(
        Array.from({ length: 8 }, () => ({ genes: randomGenes(6) })),
        2
      );
      const updates = Array.from({ length: 5 }, (_, i) => ({
        genes: mutate(qiga.elite.genes),
        n_examples: 1 + i,
        fitness: qiga.elite.fitness * (0.9 + Math.random() * 0.1),
        sca_id: `SCA-demo-${i}`,
      }));
      const global = body.strategy === 'krum' ? krum(updates) : fedAvg(updates);
      const vol = await volitionTick(db, {
        sca_id: 'SCA-ORCH-CMN-001',
        intent: body.intent || 'status',
        pds: 1.0,
        genes: global,
      });
      const sym = symbolicQuery(body.symbolic || 'lóbulos');
      return j({
        pipeline: ['qiga', 'fl_aggregate', 'volition', 'symbolic'],
        qiga: { fitness: qiga.elite.fitness, genes: qiga.elite.genes },
        fl: { strategy: body.strategy || 'fedavg', global_genes: global, n: updates.length },
        volition: vol,
        symbolic: sym,
        version: VERSION,
      });
    }

    return j({ error: 'Not found', service: 'stratamesh-sca-ml', version: VERSION }, 404);
  },
};
