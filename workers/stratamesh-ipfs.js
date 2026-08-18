/**
 * StrataMesh IPFS edge — real CIDv1 (raw + sha2-256) + content store + gateway
 * Modes: local (R2/KV) always; optional Pinata if PINATA_JWT set
 */
const B32 = 'abcdefghijklmnopqrstuvwxyz234567';

function bytesToBase32(bytes) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

async function sha256Bytes(data) {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return new Uint8Array(hash);
}

/** CIDv1 multibase base32 (b...) for raw codec 0x55 + sha2-256 multihash */
async function cidV1Raw(data) {
  const hash = await sha256Bytes(data);
  // CID: version(1) + codec(raw=0x55) + multihash(sha2-256=0x12, len=0x20, digest)
  const cidBytes = new Uint8Array(2 + 2 + 32);
  cidBytes[0] = 0x01; // CIDv1
  cidBytes[1] = 0x55; // raw
  cidBytes[2] = 0x12; // sha2-256
  cidBytes[3] = 0x20; // 32 bytes
  cidBytes.set(hash, 4);
  return 'b' + bytesToBase32(cidBytes);
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-StrataMesh-Key',
      ...extra,
    },
  });
}

async function storeContent(env, cid, bytes, meta = {}) {
  const b64 =
    typeof bytes === 'string'
      ? btoa(unescape(encodeURIComponent(bytes)))
      : btoa(String.fromCharCode(...bytes));
  // Prefer R2
  if (env.FOG_BUCKET) {
    await env.FOG_BUCKET.put(`ipfs/${cid}`, typeof bytes === 'string' ? bytes : bytes, {
      httpMetadata: { contentType: meta.contentType || 'application/octet-stream' },
      customMetadata: { cid, source: 'stratamesh-ipfs' },
    });
  }
  // KV mirror for small payloads
  if (env.CID_CACHE) {
    const payload =
      typeof bytes === 'string'
        ? bytes.length < 900000
          ? bytes
          : null
        : bytes.length < 900000
          ? new TextDecoder().decode(bytes)
          : null;
    if (payload != null) {
      await env.CID_CACHE.put(`ipfs:${cid}`, payload, {
        metadata: { contentType: meta.contentType || 'text/plain', at: Date.now() },
      });
    }
  }
  // D1 pin ledger
  const db = env.LEDGER || env.AUTH_DB || env.DB;
  if (db) {
    try {
      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS ipfs_blocks (
            cid TEXT PRIMARY KEY,
            size_bytes INTEGER,
            content_type TEXT,
            node_id TEXT,
            created_at TEXT
          )`
        )
        .run();
      await db
        .prepare(
          'INSERT OR REPLACE INTO ipfs_blocks (cid, size_bytes, content_type, node_id, created_at) VALUES (?,?,?,?,?)'
        )
        .bind(
          cid,
          typeof bytes === 'string' ? bytes.length : bytes.length,
          meta.contentType || 'application/octet-stream',
          meta.node_id || 'FOG-NODE-PT-CM-001',
          new Date().toISOString()
        )
        .run();
    } catch (_) {}
    try {
      await db
        .prepare(
          'INSERT INTO ipfs_pins (node_id, cid, pin_name, size_bytes, tier, status, strata_cost) VALUES (?,?,?,?,?,?,?)'
        )
        .bind(
          meta.node_id || 'FOG-NODE-PT-CM-001',
          cid,
          meta.name || 'block',
          typeof bytes === 'string' ? bytes.length : bytes.length,
          meta.tier || 'contributor',
          'pinned',
          0
        )
        .run();
    } catch (_) {}
  }
}

async function loadContent(env, cid) {
  if (env.FOG_BUCKET) {
    const obj = await env.FOG_BUCKET.get(`ipfs/${cid}`);
    if (obj) {
      const text = await obj.text();
      return { body: text, contentType: obj.httpMetadata?.contentType || 'application/octet-stream' };
    }
  }
  if (env.CID_CACHE) {
    const v = await env.CID_CACHE.get(`ipfs:${cid}`, { type: 'text' });
    if (v != null) return { body: v, contentType: 'text/plain; charset=utf-8' };
  }
  return null;
}

async function pinataPinJSON(env, content, name) {
  if (!env.PINATA_JWT) return null;
  try {
    const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + env.PINATA_JWT,
      },
      body: JSON.stringify({
        pinataContent: typeof content === 'string' ? JSON.parse(content) : content,
        pinataMetadata: { name: name || 'stratamesh' },
      }),
    });
    if (!res.ok) return { error: await res.text(), status: res.status };
    const j = await res.json();
    return { IpfsHash: j.IpfsHash, pinata: true };
  } catch (e) {
    return { error: String(e.message || e) };
  }
}


async function meshDrawStorage(env, opts) {
  try {
    const r = await fetch('https://stratamesh-poc.stratamesh.workers.dev/pool/draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resource_class: 'storage',
        units: opts.units || 0.001,
        beneficiary_id: opts.beneficiary_id || opts.account || 'system',
        beneficiary_kind: opts.beneficiary_kind || 'system',
        placement_node_id: opts.placement_node_id || null,
        purpose: opts.purpose || 'ipfs_pin',
        strict: false,
      }),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}


export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    // normalize /api/v1/ipfs prefix
    if (path.startsWith('/api/v1/ipfs')) path = path.slice('/api/v1/ipfs'.length) || '/';
    if (path.startsWith('/ipfs/') && path !== '/ipfs/health') {
      // gateway path handled below
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    // Health
    if (path === '/health' || path === '/' || path === '/ipfs/health') {
      return json({
        status: 'ok',
        service: 'stratamesh-ipfs',
        version: '3.2.0-edge',
        cid: 'CIDv1 raw+sha2-256 multibase base32',
        storage: {
          r2: !!env.FOG_BUCKET,
          kv: !!env.CID_CACHE,
          pinata: !!env.PINATA_JWT,
        },
        gateway: true,
        endpoints: ['/health', '/edge', '/add', '/pin', '/verify', '/ipfs/{cid}', '/get', '/name', '/edge/index', '/tiers', '/pins'],
      });
    }

    // Gateway: GET /ipfs/{cid}
    if (path.startsWith('/ipfs/') && (request.method === 'GET' || request.method === 'HEAD')) {
      if (request.method === 'HEAD') {
        const cid = path.slice('/ipfs/'.length).split('/')[0];
        const hit = await loadContent(env, cid);
        if (!hit) return new Response(null, { status: 404, headers: { 'X-Content-CID': cid || '' } });
        return new Response(null, {
          status: 200,
          headers: {
            'Content-Type': hit.contentType || 'application/octet-stream',
            'X-Content-CID': cid,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      const cid = path.slice('/ipfs/'.length).split('/')[0];
      if (!cid || cid === 'health') return json({ error: 'cid required' }, 400);
      const hit = await loadContent(env, cid);
      if (!hit) {
        // Edge beyond fog: pull from public IPFS network and replicate onto this edge
        for (const gw of [
          'https://cloudflare-ipfs.com/ipfs/',
          'https://ipfs.io/ipfs/',
          'https://dweb.link/ipfs/',
          'https://gateway.pinata.cloud/ipfs/',
        ]) {
          try {
            const r = await fetch(gw + cid, {
              method: 'GET',
              redirect: 'follow',
              headers: { Accept: '*/*' },
            });
            if (r.ok) {
              const ab = await r.arrayBuffer();
              const bytes = new Uint8Array(ab);
              const ct = r.headers.get('content-type') || 'application/octet-stream';
              try {
                await storeContent(env, cid, bytes, { contentType: ct, node_id: 'edge-replicate' });
              } catch (_) {}
              return new Response(bytes, {
                status: 200,
                headers: {
                  'Content-Type': ct,
                  'Access-Control-Allow-Origin': '*',
                  'Cache-Control': 'public, max-age=31536000, immutable',
                  'X-StrataMesh-Gateway': 'public-replicate-to-edge',
                  'X-Content-CID': cid,
                  'X-Replicated-From': gw,
                },
              });
            }
          } catch (_) {}
        }
        return json({ error: 'not found', cid, tried: 'edge+public' }, 404);
      }
      return new Response(hit.body, {
        status: 200,
        headers: {
          'Content-Type': hit.contentType || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-StrataMesh-Gateway': 'edge',
          'X-Content-CID': cid,
        },
      });
    }

    // GET /get?cid=
    if (path === '/get' && request.method === 'GET') {
      const cid = url.searchParams.get('cid');
      if (!cid) return json({ error: 'cid required' }, 400);
      const hit = await loadContent(env, cid);
      if (!hit) return json({ found: false, cid }, 404);
      return json({ found: true, cid, content: hit.body, contentType: hit.contentType });
    }

    // POST /add — compute real CID, store, optional Pinata
    
    // POST /verify — confirm content matches CID
    if (path === '/verify' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const content =
        body.content != null
          ? typeof body.content === 'string'
            ? body.content
            : JSON.stringify(body.content)
          : null;
      const claim = body.cid;
      if (content == null) return json({ error: 'content required' }, 400);
      const cid = await cidV1Raw(content);
      const stored = claim ? await loadContent(env, claim) : await loadContent(env, cid);
      return json({
        success: true,
        cid,
        claim: claim || null,
        matches_claim: claim ? claim === cid : null,
        stored: !!stored,
        algorithm: 'CIDv1-raw-sha2-256-base32',
      });
    }

    if ((path === '/add' || path === '/pin' || path === '/upload') && request.method === 'POST') {
      let content;
      let meta = {};
      const ct = request.headers.get('content-type') || '';
      if (ct.includes('multipart/form-data')) {
        const form = await request.formData();
        const file = form.get('file') || form.get('content');
        if (file && typeof file === 'object' && file.arrayBuffer) {
          const ab = await file.arrayBuffer();
          content = new Uint8Array(ab);
          meta.contentType = file.type || 'application/octet-stream';
          meta.name = file.name || 'file';
        } else if (typeof file === 'string') {
          content = file;
          meta.contentType = 'text/plain';
        }
        meta.node_id = form.get('node_id') || 'FOG-NODE-PT-CM-001';
        meta.tier = form.get('tier') || 'contributor';
      } else {
        const body = await request.json().catch(() => ({}));
        if (body.content != null) {
          content =
            typeof body.content === 'string' ? body.content : JSON.stringify(body.content);
          meta.contentType =
            typeof body.content === 'object' ? 'application/json' : 'text/plain; charset=utf-8';
        } else if (body.data != null) {
          content = typeof body.data === 'string' ? body.data : JSON.stringify(body.data);
          meta.contentType = 'application/json';
        } else if (body.cid && !body.content) {
          // register-only pin of existing CID
          return json({
            success: true,
            mode: 'register',
            cid: body.cid,
            note: 'no content body — ledger pin only',
          });
        } else {
          content = JSON.stringify(body);
          meta.contentType = 'application/json';
        }
        meta.node_id = body.node_id || 'FOG-NODE-PT-CM-001';
        meta.tier = body.tier || 'contributor';
        meta.name = body.name || body.pin_name || 'block';
      }

      if (content == null) return json({ error: 'content required' }, 400);

      const cid = await cidV1Raw(content);
      await storeContent(env, cid, content, meta);
      try {
        if (env.CID_CACHE) {
          await env.CID_CACHE.put(
            'edge:cid:' + cid,
            JSON.stringify({ cid, at: new Date().toISOString(), size: typeof content === 'string' ? content.length : content.length }),
            { expirationTtl: 60 * 60 * 24 * 30 }
          );
        }
      } catch (_) {}

      let external = null;
      if (env.PINATA_JWT && meta.contentType.includes('json')) {
        try {
          const obj = typeof content === 'string' ? JSON.parse(content) : content;
          external = await pinataPinJSON(env, obj, meta.name);
        } catch (_) {
          external = await pinataPinJSON(env, { raw: String(content).slice(0, 50000) }, meta.name);
        }
      }

      return json({
        success: true,
        cid,
        size_bytes: typeof content === 'string' ? content.length : content.length,
        content_type: meta.contentType,
        gateway_path: `/ipfs/${cid}`,
        gateway_url: `https://calhegasmorais.pt/ipfs/${cid}`,
        gateway_workers: `https://stratamesh-ipfs.stratamesh.workers.dev/ipfs/${cid}`,
        public_gateways: [
          `https://ipfs.io/ipfs/${cid}`,
          `https://cloudflare-ipfs.com/ipfs/${cid}`,
        ],
        note: 'CIDv1 raw+sha2-256. Content stored on StrataMesh edge (R2/KV). Public gateways resolve only after network announcement or Pinata.',
        pinata: external,
        version: '3.2.0-edge',
      });
    }

    if (path === '/tiers') {
      return json({
        tiers: [
          { tier: 'contributor', storage: '1 GB', cost: 'PoC' },
          { tier: 'basic', storage: '5 GB', cost: '10 STRATA' },
          { tier: 'professional', storage: '50 GB', cost: '80 STRATA' },
          { tier: 'enterprise', storage: 'custom', cost: '0.5 STRATA/GB' },
        ],
      });
    }

    if (path === '/pins' && request.method === 'GET') {
      const db = env.LEDGER || env.AUTH_DB || env.DB;
      const node_id = url.searchParams.get('node_id');
      try {
        let rows;
        if (node_id) {
          rows = await db
            .prepare('SELECT * FROM ipfs_pins WHERE node_id = ? ORDER BY rowid DESC LIMIT 50')
            .bind(node_id)
            .all();
        } else {
          rows = await db.prepare('SELECT * FROM ipfs_pins ORDER BY rowid DESC LIMIT 50').all();
        }
        return json({ pins: rows.results || [] });
      } catch (e) {
        return json({ pins: [], error: String(e.message || e) });
      }
    }

    
    // --- Edge naming (IPNS-like pointer in KV) ---
    if (path === '/name' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const name = String(body.name || body.key || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
      const cid = String(body.cid || '').trim();
      if (!name || !cid) return json({ error: 'name and cid required' }, 400);
      if (!env.CID_CACHE) return json({ error: 'CID_CACHE KV required' }, 503);
      await env.CID_CACHE.put('ipns:' + name, JSON.stringify({
        name, cid, updated_at: new Date().toISOString(), node_id: body.node_id || 'edge',
      }));
      return json({
        success: true,
        name,
        cid,
        resolve: '/name/' + name,
        gateway: 'https://calhegasmorais.pt/ipfs/' + cid,
      });
    }
    if (path.startsWith('/name/') && request.method === 'GET') {
      const name = path.slice('/name/'.length).split('/')[0];
      if (!name) return json({ error: 'name required' }, 400);
      if (!env.CID_CACHE) return json({ error: 'CID_CACHE KV required' }, 503);
      const raw = await env.CID_CACHE.get('ipns:' + name);
      if (!raw) return json({ error: 'name not found', name }, 404);
      const rec = JSON.parse(raw);
      if (url.searchParams.get('redirect') === '1' && rec.cid) {
        return Response.redirect('https://calhegasmorais.pt/ipfs/' + rec.cid, 302);
      }
      return json({ success: true, ...rec, gateway: 'https://calhegasmorais.pt/ipfs/' + rec.cid });
    }

    // Edge catalog of recently added CIDs
    if (path === '/edge/index' && request.method === 'GET') {
      if (!env.CID_CACHE) return json({ index: [], note: 'no CID_CACHE' });
      const list = await env.CID_CACHE.list({ prefix: 'edge:cid:', limit: 50 });
      const keys = (list.keys || []).map((k) => k.name.replace(/^edge:cid:/, ''));
      return json({
        success: true,
        count: keys.length,
        cids: keys,
        gateway_base: 'https://calhegasmorais.pt/ipfs/',
      });
    }

    // Edge capability report
    if (path === '/edge' && request.method === 'GET') {
      return json({
        status: 'ok',
        layer: 'edge',
        beyond_fog: true,
        domain_gateway: 'https://calhegasmorais.pt/ipfs/{cid}',
        workers_gateway: 'https://stratamesh-ipfs.stratamesh.workers.dev/ipfs/{cid}',
        features: [
          'CIDv1 raw+sha2-256',
          'R2+KV content store',
          'public gateway fetch + replicate-to-edge',
          'IPNS-like names in KV',
          'DAG service binding /add',
          'optional Pinata if PINATA_JWT',
        ],
        storage: { r2: !!env.FOG_BUCKET, kv: !!env.CID_CACHE, pinata: !!env.PINATA_JWT },
        version: '3.2.0-edge',
      });
    }


    return json({ error: 'Not found', endpoints: ['/health', '/add', '/pin', '/ipfs/{cid}', '/get', '/tiers'] }, 404);
  },
};
