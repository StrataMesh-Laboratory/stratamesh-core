/**
 * Meta-finality layer (whitepaper) — opt-in modules over probabilistic DAG core
 * Modules: probabilistic | cw_threshold | instant_lab (lab ABFT-placeholder)
 */
function j(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function confidenceFromWeight(w) {
  const n = Number(w) || 0;
  return Math.round((1 - 1 / (1 + n)) * 10000) / 10000;
}

const MODULES = {
  probabilistic: {
    name: 'probabilistic',
    description: 'Core DAG tip confidence only; never claims deterministic finality',
    evaluate(tx) {
      const conf = confidenceFromWeight(tx.cumulative_weight);
      return {
        module: 'probabilistic',
        finalized: false,
        confidence: conf,
        verdict: conf >= 0.75 ? 'high_confidence' : conf >= 0.5 ? 'medium_confidence' : 'pending',
        note: 'Whitepaper: core remains probabilistic',
      };
    },
  },
  cw_threshold: {
    name: 'cw_threshold',
    description: 'Lab module: finalized if cumulative_weight ≥ threshold',
    evaluate(tx, opts = {}) {
      const thr = Number(opts.weight_threshold != null ? opts.weight_threshold : 3);
      const confMin = Number(opts.confidence_min != null ? opts.confidence_min : 0.5);
      const w = Number(tx.cumulative_weight || 0);
      const conf = confidenceFromWeight(w);
      const finalized = w >= thr && conf >= confMin;
      return {
        module: 'cw_threshold',
        finalized,
        confidence: conf,
        cumulative_weight: w,
        threshold: thr,
        verdict: finalized ? 'finalized' : 'not_yet',
      };
    },
  },
  instant_lab: {
    name: 'instant_lab',
    description: 'Lab stand-in for opt-in deterministic/ABFT module (NOT real BFT)',
    evaluate(tx) {
      return {
        module: 'instant_lab',
        finalized: true,
        confidence: 1,
        verdict: 'lab_instant_final',
        warning: 'Placeholder only — not Byzantine fault tolerant cryptography',
      };
    },
  },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.startsWith('/api/v1/consensus')) path = path.slice('/api/v1/consensus'.length) || '/';
    if (path.startsWith('/api/v1/finality')) path = path.replace('/api/v1/finality', '') || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': '*' } });
    }

    const db = env.LEDGER || env.STRATAMESH_LEDGER || env.DB;

    try {
      if (path === '/health' || path === '/') {
        return j({
          status: 'ok',
          service: 'stratamesh-consensus',
          role: 'meta-finality + tip-selection',
          version: '2.0.1-meta-finality',
          modules: Object.keys(MODULES),
          endpoints: ['/health', '/tips', '/agree', '/finality', '/finality/modules', '/evaluate'],
        });
      }

      if (path === '/tips') {
        let tips = [];
        try {
          const r = await db
            .prepare(
              'SELECT vertex_id as id, cumulative_weight, payload_hash FROM vertices ORDER BY cumulative_weight DESC LIMIT 10'
            )
            .all();
          tips = (r.results || []).map((t) => ({
            ...t,
            confidence: confidenceFromWeight(t.cumulative_weight),
          }));
        } catch (_) {}
        return j({ tips, algorithm: 'heaviest-first-lab' });
      }

      if (path === '/finality/modules') {
        return j({
          modules: Object.values(MODULES).map((m) => ({ name: m.name, description: m.description })),
          note: 'Platforms opt-in via meta-layer; core DAG stays probabilistic',
        });
      }

      // GET /finality?id=vertex  OR POST body { vertex_id, modules: [] }
      if (path === '/finality' || path === '/evaluate') {
        let vertex_id = url.searchParams.get('id') || url.searchParams.get('vertex_id');
        let moduleNames = (url.searchParams.get('modules') || 'probabilistic,cw_threshold').split(',').map((s) => s.trim()).filter(Boolean);
        let opts = {};
        if (request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          vertex_id = body.vertex_id || body.id || vertex_id;
          if (body.modules) moduleNames = body.modules;
          opts = body.opts || {};
        }
        if (!vertex_id) {
          // batch: top tips
          let tips = [];
          try {
            const r = await db
              .prepare('SELECT vertex_id, cumulative_weight FROM vertices ORDER BY cumulative_weight DESC LIMIT 5')
              .all();
            tips = r.results || [];
          } catch (_) {}
          const report = [];
          for (const t of tips) {
            const verdicts = moduleNames.map((n) => (MODULES[n] ? MODULES[n].evaluate(t, opts) : { module: n, error: 'unknown' }));
            report.push({ vertex_id: t.vertex_id, cumulative_weight: t.cumulative_weight, verdicts });
          }
          return j({ mode: 'tips_batch', report, modules: moduleNames });
        }

        let tx = null;
        try {
          tx = await db
            .prepare('SELECT vertex_id, cumulative_weight, payload_hash, parent_vertices, emission_node FROM vertices WHERE vertex_id = ?')
            .bind(vertex_id)
            .first();
        } catch (_) {}
        if (!tx) return j({ error: 'vertex not found' }, 404);

        const verdicts = moduleNames.map((n) => (MODULES[n] ? MODULES[n].evaluate(tx, opts) : { module: n, error: 'unknown module' }));
        return j({
          vertex_id,
          cumulative_weight: tx.cumulative_weight,
          confidence_core: confidenceFromWeight(tx.cumulative_weight),
          verdicts,
          any_finalized: verdicts.some((v) => v.finalized),
        });
      }

      if (path === '/agree' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        return j({ agreed: true, echo: body, note: 'lab peer agree' });
      }

      return j({ error: 'Not found', endpoints: ['/health', '/tips', '/finality', '/finality/modules', '/evaluate'] }, 404);
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
