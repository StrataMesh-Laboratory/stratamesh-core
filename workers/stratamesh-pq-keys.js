/**
 * Post-quantum path lab worker (placeholder algorithms until lattice suite lands).
 * CORS enabled for portal diagnostics from SPA origin.
 */
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    'Access-Control-Max-Age': '86400',
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (path === '/health' || path === '/pq/health' || path === '/') {
      return json({
        status: 'ok',
        service: 'stratamesh-pq-keys',
        version: '1.1.0-cors',
        note: 'Lab placeholders; production PQ suite pending (B4)',
        endpoints: ['GET /health', 'GET /pq/status', 'POST /pq/generate'],
      });
    }

    if (path === '/pq/status' || path === '/status') {
      try {
        await env.STRATAMESH_D1.prepare(
          `CREATE TABLE IF NOT EXISTS pq_keys (
            key_id TEXT PRIMARY KEY,
            algorithm TEXT,
            public_key TEXT,
            created_at TEXT
          )`
        ).run();
        const rows = await env.STRATAMESH_D1.prepare(
          'SELECT key_id, algorithm, created_at FROM pq_keys ORDER BY created_at DESC LIMIT 20'
        ).all();
        return json({ success: true, keys: rows.results || [], count: (rows.results || []).length });
      } catch (e) {
        return json({ success: false, error: String(e.message || e), keys: [] }, 500);
      }
    }

    if (path === '/pq/generate' && request.method === 'POST') {
      try {
        await env.STRATAMESH_D1.prepare(
          `CREATE TABLE IF NOT EXISTS pq_keys (
            key_id TEXT PRIMARY KEY,
            algorithm TEXT,
            public_key TEXT,
            created_at TEXT
          )`
        ).run();
        // Lab: Ed25519 stand-in until Dilithium/Kyber suite is wired (B4)
        const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
        const pubKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);
        const pubB64 = btoa(String.fromCharCode(...new Uint8Array(pubKey)));
        const keyId = crypto.randomUUID();
        await env.STRATAMESH_D1.prepare(
          'INSERT INTO pq_keys (key_id, algorithm, public_key, created_at) VALUES (?, ?, ?, datetime("now"))'
        ).bind(keyId, 'Ed25519-Placeholder-Dilithium-Pending', pubB64).run();
        return json({
          success: true,
          key_id: keyId,
          algorithm: 'Ed25519-Placeholder-Dilithium-Pending',
          public_key: pubB64,
          note: 'Placeholder only — not production post-quantum identity',
        });
      } catch (e) {
        return json({ success: false, error: String(e.message || e) }, 500);
      }
    }

    return json({ error: 'Not Found', path, endpoints: ['/health', '/pq/status', '/pq/generate'] }, 404);
  },
};
