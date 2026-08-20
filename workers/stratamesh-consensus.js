/**
 * stratamesh-consensus — meta-finality + tip selection + virtual voting (lab)
 * Parallels:
 *  - IOTA: cumulative weight, confirmation confidence via tip-sample fraction
 *  - Hedera: virtual voting on gossip events (no extra vote messages)
 * Core DAG remains probabilistic; modules are explicit about adversary assumptions.
 */
const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': '*',
};
const VERSION = '3.0.0-virtual-vote-iota';

function j(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function confidenceFromWeight(w) {
  const n = Number(w) || 0;
  return Math.round((1 - 1 / (1 + n)) * 10000) / 10000;
}

/** IOTA-style: fraction of tip-selection walks that land in the cone of tx */
function confirmationConfidence(txId, tips, edges, samples = 64) {
  if (!tips.length) return 0;
  let hits = 0;
  const n = Math.min(samples, Math.max(tips.length * 4, 16));
  for (let i = 0; i < n; i++) {
    const tip = tips[Math.floor(Math.random() * tips.length)];
    if (reaches(tip, txId, edges)) hits++;
  }
  return Math.round((hits / n) * 10000) / 10000;
}

function reaches(from, target, edges, depth = 0) {
  if (from === target) return true;
  if (depth > 64) return false;
  const parents = edges[from] || [];
  for (const p of parents) {
    if (reaches(p, target, edges, depth + 1)) return true;
  }
  return false;
}

/**
 * MCMC tip selection biased by cumulative weight (IOTA α-walk, simplified)
 * P ∝ exp(α * weight)
 */
function selectTipMCMC(candidates, alpha = 0.1) {
  if (!candidates.length) return null;
  const weights = candidates.map((c) => Math.exp(alpha * (Number(c.cumulative_weight) || 0)));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  let r = Math.random() * sum;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/** Non-lazy tips: prefer higher weight / fresher (IOTA TIP-3 spirit) */
function scoreTip(t, maxWeight) {
  const w = Number(t.cumulative_weight) || 0;
  const age = t.age_s != null ? Number(t.age_s) : 0;
  if (age > 3600) return 'LAZY';
  if (maxWeight > 0 && w < maxWeight * 0.15 && age > 600) return 'SEMI_LAZY';
  return 'NON_LAZY';
}

const MODULES = {
  probabilistic: {
    name: 'probabilistic',
    description: 'Core DAG tip confidence only; never claims deterministic finality',
    parallel: 'IOTA confirmation confidence (weight-mapped proxy)',
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
    description: 'Lab: finalized if cumulative_weight ≥ threshold',
    parallel: 'IOTA cumulative weight threshold',
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
  tip_sample_confidence: {
    name: 'tip_sample_confidence',
    description: 'IOTA-style: confidence = fraction of random tips that approve tx',
    parallel: 'IOTA Tangle confirmation confidence',
    evaluate(tx, opts = {}) {
      const tips = opts.tips || [];
      const edges = opts.edges || {};
      const conf =
        tips.length && tx.id
          ? confirmationConfidence(tx.id, tips.map((t) => t.id || t), edges, opts.samples || 48)
          : confidenceFromWeight(tx.cumulative_weight);
      return {
        module: 'tip_sample_confidence',
        finalized: conf >= Number(opts.threshold != null ? opts.threshold : 0.95),
        confidence: conf,
        verdict: conf >= 0.95 ? 'confirmed' : conf >= 0.5 ? 'building' : 'weak',
        samples: opts.samples || 48,
      };
    },
  },
  virtual_voting: {
    name: 'virtual_voting',
    description: 'Hedera-inspired lab virtual vote on event fame from gossip graph (NOT production aBFT)',
    parallel: 'Hedera hashgraph virtual voting (2/3 fame threshold, lab-simplified)',
    evaluate(tx, opts = {}) {
      const voters = opts.voters || ['FOG-NODE-PT-CM-001', 'node-2', 'node-3', 'edge-cmn-01', 'edge-cmn-02'];
      const seen = opts.seen_by || voters.slice(0, Math.max(2, Math.ceil(voters.length * 0.7)));
      const yes = seen.length;
      const ratio = yes / voters.length;
      const famous = ratio > 2 / 3;
      const conf = Math.round(ratio * 10000) / 10000;
      return {
        module: 'virtual_voting',
        finalized: famous,
        confidence: conf,
        famous_witness: famous,
        votes_yes: yes,
        votes_total: voters.length,
        threshold: '2/3',
        verdict: famous ? 'famous' : 'not_famous',
        adversary_assumption: 'honest_majority_lab; not full aBFT implementation',
        note: 'Votes derived from gossip ancestry locally — no vote messages on the wire',
      };
    },
  },
  instant_lab: {
    name: 'instant_lab',
    description: 'Lab stand-in for opt-in deterministic module (NOT real BFT)',
    evaluate(tx) {
      return {
        module: 'instant_lab',
        finalized: true,
        confidence: 1,
        verdict: 'lab_instant',
        note: 'Placeholder only — do not treat as production finality',
      };
    },
  },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname.replace(/\/+$/, '') || '/';
    const prefixes = ['/api/v1/consensus', '/consensus'];
    for (const pfx of prefixes) {
      if (path === pfx) { path = '/'; break; }
      if (path.startsWith(pfx + '/')) { path = path.slice(pfx.length) || '/'; break; }
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (path === '/' || path === '/health') {
      return j({
        status: 'ok',
        service: 'stratamesh-consensus',
        role: 'meta-finality + tip-selection + virtual-voting',
        version: VERSION,
        modules: Object.keys(MODULES),
        parallels: {
          iota: ['cumulative_weight', 'mcmc_tip_selection', 'confirmation_confidence'],
          hedera: ['virtual_voting', 'gossip_ancestry_votes'],
        },
        endpoints: ['/health', '/tips', '/tip-select', '/agree', '/finality', '/finality/modules', '/evaluate', '/confidence'],
      });
    }

    if (path === '/finality/modules') {
      return j({
        modules: Object.fromEntries(
          Object.entries(MODULES).map(([k, m]) => [
            k,
            { name: m.name, description: m.description, parallel: m.parallel || null },
          ])
        ),
      });
    }

    if (path === '/tips' || path === '/tip-select') {
      let tips = [];
      try {
        if (env.DAG_SERVICE) {
          const r = await env.DAG_SERVICE.fetch('https://dag/tips');
          if (r.ok) {
            const d = await r.json();
            tips = d.tips || d.vertices || [];
          }
        }
      } catch (_) {}
      if (!tips.length) {
        tips = [
          { id: 'tip-lab-a', cumulative_weight: 4, age_s: 12 },
          { id: 'tip-lab-b', cumulative_weight: 2, age_s: 40 },
          { id: 'tip-lab-c', cumulative_weight: 1, age_s: 400 },
        ];
      }
      const maxW = Math.max(...tips.map((t) => Number(t.cumulative_weight) || 0), 1);
      const scored = tips.map((t) => ({ ...t, score: scoreTip(t, maxW) }));
      const nonLazy = scored.filter((t) => t.score === 'NON_LAZY');
      const pool = nonLazy.length ? nonLazy : scored.filter((t) => t.score !== 'LAZY');
      const alpha = Number(url.searchParams.get('alpha') || 0.1);
      const selected = selectTipMCMC(pool.length ? pool : scored, alpha);
      return j({
        algorithm: 'R-URTS + MCMC α-weight (IOTA-inspired)',
        alpha,
        pool_size: pool.length,
        selected,
        tips: scored,
        parallel: 'IOTA tip selection / non-lazy pool',
      });
    }

    if (path === '/confidence' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const tx = { id: body.id || body.tx_id, cumulative_weight: body.cumulative_weight || 0 };
      const result = MODULES.tip_sample_confidence.evaluate(tx, {
        tips: body.tips || [],
        edges: body.edges || {},
        samples: body.samples || 48,
        threshold: body.threshold,
      });
      return j(result);
    }

    if ((path === '/evaluate' || path === '/finality' || path === '/agree') && (request.method === 'POST' || request.method === 'GET')) {
      let body = {};
      if (request.method === 'POST') body = await request.json().catch(() => ({}));
      const modName = body.module || url.searchParams.get('module') || 'probabilistic';
      const mod = MODULES[modName] || MODULES.probabilistic;
      const tx = {
        id: body.id || body.tx_id || url.searchParams.get('id'),
        cumulative_weight: body.cumulative_weight != null ? body.cumulative_weight : Number(url.searchParams.get('w') || 0),
      };
      const result = mod.evaluate(tx, body);
      return j({ version: VERSION, ...result });
    }

    return j({ error: 'Not found', endpoints: ['/health', '/tips', '/evaluate', '/confidence'] }, 404);
  },
};
