export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-StrataMesh-Key' } });
    }

    if (url.pathname === '/ipfs/health') {
      return Response.json({ status: 'ok', service: 'stratamesh-ipfs-pinner', timestamp: new Date().toISOString() });
    }

    if (request.method === 'POST' && url.pathname === '/ipfs/pin') {
      if (!env.PINATA_JWT) {
        return Response.json({ error: 'Pinata JWT not configured. Set PINATA_JWT secret via dashboard or API.' }, { status: 503 });
      }
      try {
        const body = await request.json();
        const { content, metadata } = body;
        if (!content) return Response.json({ error: 'content field required' }, { status: 400 });

        const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.PINATA_JWT },
          body: JSON.stringify({ pinataContent: content, pinataMetadata: { name: metadata?.name || 'stratamesh-pin' } })
        });

        if (!pinataRes.ok) {
          const err = await pinataRes.text();
          return Response.json({ error: 'Pinata pin failed', details: err }, { status: 502 });
        }

        const pinataData = await pinataRes.json();
        const cid = pinataData.IpfsHash;

        if (env.STRATAMESH_D1) {
          await env.STRATAMESH_D1.prepare('INSERT OR REPLACE INTO cid_registry (cid, vertex_id, pin_status, byte_size, first_seen, last_verified) VALUES (?, ?, ?, ?, datetime("now"), datetime("now"))').bind(cid, metadata?.vertex_id || 'GENESIS', 'pinned', metadata?.byte_size || 0).run();
        }
        if (env.CID_CACHE) {
          await env.CID_CACHE.put('cid:' + cid, JSON.stringify({ cid, pinned_at: new Date().toISOString(), source: 'pinata', metadata }), { expirationTtl: 86400 });
        }

        return Response.json({ success: true, cid, pin_status: 'pinned', gateway_url: 'https://cloudflare-ipfs.com/ipfs/' + cid, timestamp: new Date().toISOString() }, { headers: { 'Access-Control-Allow-Origin': '*' } });
      } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
    }

    if (request.method === 'POST' && url.pathname === '/ipfs/pin-file') {
      if (!env.PINATA_JWT) {
        return Response.json({ error: 'Pinata JWT not configured' }, { status: 503 });
      }
      try {
        const formData = await request.formData();
        const file = formData.get('file');
        if (!file) return Response.json({ error: 'file field required' }, { status: 400 });

        const pinFormData = new FormData();
        pinFormData.append('file', file);

        const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + env.PINATA_JWT },
          body: pinFormData
        });

        if (!pinataRes.ok) return Response.json({ error: 'Pinata file pin failed' }, { status: 502 });

        const pinataData = await pinataRes.json();
        const cid = pinataData.IpfsHash;

        if (env.STRATAMESH_D1) {
          await env.STRATAMESH_D1.prepare('INSERT OR REPLACE INTO cid_registry (cid, vertex_id, pin_status, byte_size, first_seen, last_verified) VALUES (?, ?, ?, ?, datetime("now"), datetime("now"))').bind(cid, 'FILE_PIN', 'pinned', file.size || 0).run();
        }

        return Response.json({ success: true, cid, pin_status: 'pinned', gateway_url: 'https://cloudflare-ipfs.com/ipfs/' + cid, timestamp: new Date().toISOString() }, { headers: { 'Access-Control-Allow-Origin': '*' } });
      } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
    }

    if (request.method === 'GET' && url.pathname.startsWith('/ipfs/cid/')) {
      const cid = url.pathname.split('/ipfs/cid/')[1];
      if (env.CID_CACHE) {
        const cached = await env.CID_CACHE.get('cid:' + cid);
        if (cached) return Response.json({ source: 'cache', ...JSON.parse(cached) }, { headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      if (env.STRATAMESH_D1) {
        const row = await env.STRATAMESH_D1.prepare('SELECT * FROM cid_registry WHERE cid = ?').bind(cid).first();
        if (row) {
          if (env.CID_CACHE) await env.CID_CACHE.put('cid:' + cid, JSON.stringify(row), { expirationTtl: 86400 });
          return Response.json({ source: 'd1', ...row }, { headers: { 'Access-Control-Allow-Origin': '*' } });
        }
      }
      return Response.json({ error: 'CID not found' }, { status: 404 });
    }

    if (url.pathname === '/ipfs/pins') {
      if (!env.STRATAMESH_D1) return Response.json({ error: 'D1 not bound' }, { status: 503 });
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const rows = await env.STRATAMESH_D1.prepare('SELECT cid, vertex_id, pin_status, byte_size, first_seen, last_verified FROM cid_registry ORDER BY first_seen DESC LIMIT ?').bind(limit).all();
      return Response.json({ pins: rows.results }, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    return Response.json({ error: 'Not found', endpoints: ['/ipfs/health', '/ipfs/pin', '/ipfs/pin-file', '/ipfs/cid/:cid', '/ipfs/pins'] }, { status: 404 });
  }
};
