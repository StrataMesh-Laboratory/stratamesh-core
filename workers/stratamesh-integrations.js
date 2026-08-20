/**
 * stratamesh-integrations — free OSS / public API catalog + probes for CMN
 */
const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': '*',
};
const VERSION = '1.0.0-oss-sweep';

const CATALOG = [
  { id: 'iota-tips', parallel: 'IOTA', repo: 'https://github.com/iotaledger/IOTA-2.0-Research-Specifications', free: 'algorithm', cmn: '/api/v1/consensus/tips' },
  { id: 'hedera-gossip', parallel: 'Hedera', repo: 'https://docs.hedera.com/learn/core-concepts/hashgraph', free: 'algorithm', cmn: '/api/v1/gossip/sync' },
  { id: 'akash-sdl', parallel: 'Akash', repo: 'https://github.com/akash-network/docs', free: 'SDL schema', cmn: '/api/v1/depin/orders/create' },
  { id: 'olas-mas', parallel: 'Olas/Fetch', repo: 'https://github.com/valory-xyz/open-autonomy', free: 'MAS patterns', cmn: '/api/v1/agent-services' },
  { id: 'urbit-holon', parallel: 'Urbit', repo: 'https://github.com/urbit/azimuth-js', free: 'identity hierarchy metaphor', cmn: '/api/v1/holons' },
  { id: 'helia-ipfs', parallel: 'IPFS', repo: 'https://github.com/ipfs/helia', free: 'public gateways + CID', cmn: '/api/v1/ipfs' },
  { id: 'kubo', parallel: 'IPFS', repo: 'https://github.com/ipfs/kubo', free: 'RPC when Fog hosts node', cmn: '/api/v1/ipfs' },
  { id: 'multiformats', parallel: 'CID', repo: 'https://github.com/multiformats/multiformats', free: 'pure JS', cmn: 'DAG pin' },
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
        endpoints: ['/health', '/catalog', '/probe/ipfs'],
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
          olas_fetch: 'agent-services',
          urbit: 'holonic Fog to Edge mapping',
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

    return j({ error: 'Not found', catalog: '/catalog' }, 404);
  },
};
