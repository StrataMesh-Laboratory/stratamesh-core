/**
 * stratamesh-integrations — free OSS / public API catalog + probes for CMN
 * Extended with SCA ML/NN deep integrations (Flower, QIGA, Kanren, Olas, edge).
 */
const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': '*',
};
const VERSION = '1.1.0-sca-ml';

const CATALOG = [
  { id: 'iota-tips', parallel: 'IOTA', repo: 'https://github.com/iotaledger/IOTA-2.0-Research-Specifications', free: 'algorithm', cmn: '/api/v1/consensus/tips' },
  { id: 'hedera-gossip', parallel: 'Hedera', repo: 'https://docs.hedera.com/learn/core-concepts/hashgraph', free: 'algorithm', cmn: '/api/v1/gossip/sync' },
  { id: 'akash-sdl', parallel: 'Akash', repo: 'https://github.com/akash-network/docs', free: 'SDL schema', cmn: '/api/v1/depin/orders/create' },
  { id: 'olas-mas', parallel: 'Olas/Fetch', repo: 'https://github.com/valory-xyz/open-autonomy', free: 'MAS patterns', cmn: '/api/v1/agent-services' },
  { id: 'olas-blueprint', parallel: 'Olas Open Autonomy', repo: 'https://github.com/valory-xyz/open-autonomy', free: 'blueprint identity≠role', cmn: '/api/v1/sca-ml/blueprint' },
  { id: 'urbit-holon', parallel: 'Urbit', repo: 'https://github.com/urbit/azimuth-js', free: 'identity hierarchy metaphor', cmn: '/api/v1/holons' },
  { id: 'helia-ipfs', parallel: 'IPFS', repo: 'https://github.com/ipfs/helia', free: 'public gateways + CID', cmn: '/api/v1/ipfs' },
  { id: 'kubo', parallel: 'IPFS', repo: 'https://github.com/ipfs/kubo', free: 'RPC when Fog hosts node', cmn: '/api/v1/ipfs' },
  { id: 'multiformats', parallel: 'CID', repo: 'https://github.com/multiformats/multiformats', free: 'pure JS', cmn: 'DAG pin' },
  { id: 'flower-fl', parallel: 'Flower', repo: 'https://github.com/adap/flower', free: 'FedAvg protocol mirrored in-worker', cmn: '/api/v1/sca-ml/fl' },
  { id: 'acfa-krum', parallel: 'acfa-flower', repo: 'https://pypi.org/project/acfa-flower/', free: 'Multi-Krum aggregation port', cmn: '/api/v1/sca-ml/fl/aggregate' },
  { id: 'qiga', parallel: 'QIGA research', repo: 'https://github.com/rnowotniak/qopt', free: 'quantum-inspired GA pure JS', cmn: '/api/v1/sca-ml/qiga' },
  { id: 'logic-js', parallel: 'miniKanren/logic.js', repo: 'https://github.com/shd101wyy/logic.js', free: 'symbolic unify lobe', cmn: '/api/v1/sca-ml/symbolic' },
  { id: 'kanren-py', parallel: 'miniKanren', repo: 'https://github.com/pythological/kanren', free: 'Python offline symbolic', cmn: 'AIOps offline' },
  { id: 'langgraph-pattern', parallel: 'LangGraph', repo: 'https://github.com/langchain-ai/langgraph', free: 'volition graph pattern', cmn: '/api/v1/sca-ml/volition' },
  { id: 'transformers-js', parallel: 'HF Transformers.js', repo: 'https://github.com/huggingface/transformers.js', free: 'edge WASM/WebGPU inference', cmn: '/api/v1/sca-ml/edge/catalog' },
  { id: 'onnxruntime-web', parallel: 'ONNX Runtime', repo: 'https://github.com/microsoft/onnxruntime', free: 'ORT-web backend', cmn: '/api/v1/sca-ml/edge/catalog' },
  { id: 'open-managed-agents', parallel: 'SCA harness', repo: 'https://github.com/openma-ai/open-managed-agents', free: 'CF Workers design', cmn: 'future' },
  { id: 'x402', parallel: 'ENI pay', repo: 'https://github.com/ANAMIZED/x402-cloudflare-starter', free: 'CF Workers MIT', cmn: 'eni pay' },
];

function j(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname.replace(/\/+$/, '') || '/';
    for (const pfx of ['/api/v1/integrations', '/integrations']) {
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

    if (path === '/' || path === '/health') {
      return j({
        status: 'ok',
        service: 'stratamesh-integrations',
        version: VERSION,
        count: CATALOG.length,
        endpoints: ['/health', '/catalog', '/probe/ipfs', '/probe/sca-ml'],
      });
    }

    if (path === '/catalog') {
      return j({
        version: VERSION,
        note: 'Free OSS / public algorithm paths only. No paid RPC required for CMN core.',
        items: CATALOG,
        priors_refined: {
          iota: 'consensus tip modules',
          hedera: 'gossip events + virtual_voting',
          akash_render: 'depin SDL-lite',
          olas_fetch: 'agent-services + sca-ml blueprints',
          urbit: 'holonic Fog to Edge mapping',
          flower: 'federated gene/lobe rounds',
          kanren: 'symbolic lobe',
          transformers_js: 'edge inference tools (not SCA identity)',
        },
        sca_ml: {
          base: '/api/v1/sca-ml',
          version: '1.0.0-sca-ml-deep',
          invariants: ['llm_is_not_sca', 'identity_not_appointment', 'pds_gates_processing'],
        },
      });
    }

    if (path === '/probe/ipfs') {
      const cid = url.searchParams.get('cid') || 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
      const gateways = [
        'https://ipfs.io/ipfs/' + cid,
        'https://dweb.link/ipfs/' + cid,
        'https://cloudflare-ipfs.com/ipfs/' + cid,
      ];
      const results = [];
      for (const g of gateways) {
        try {
          const r = await fetch(g, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
          results.push({ gateway: g, ok: r.ok, status: r.status });
        } catch (e) {
          results.push({ gateway: g, ok: false, error: String(e.message || e) });
        }
      }
      return j({ cid, results, parallel: 'ipfs public gateway path' });
    }

    if (path === '/probe/sca-ml') {
      try {
        const r = await fetch(new URL('/api/v1/sca-ml/health', url.origin), {
          signal: AbortSignal.timeout(8000),
        });
        const body = await r.json();
        return j({ ok: r.ok, sca_ml: body });
      } catch (e) {
        return j({ ok: false, error: String(e.message || e) }, 502);
      }
    }

    return j({ error: 'Not found', catalog: '/catalog' }, 404);
  },
};
