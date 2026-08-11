/**
 * Holon 1 — UGC Sandbox (whitepaper)
 * Personal private crucible → mint assets → integrate into Open-Worlds
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.startsWith('/api/v1/sandbox')) path = path.slice('/api/v1/sandbox'.length) || '/';
    const j = (d, s = 200) =>
      new Response(JSON.stringify(d), {
        status: s,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': '*' } });
    }

    const db = env.LEDGER || env.DB;
    try {
      if (db) {
        await db
          .prepare(
            `CREATE TABLE IF NOT EXISTS ugc_sandbox (
              id TEXT PRIMARY KEY, owner TEXT, cid TEXT, label TEXT, status TEXT,
              nft_id TEXT, world_id TEXT, created_at TEXT, published_at TEXT
            )`
          )
          .run();
      }

      if (path === '/health' || path === '/' || path === '') {
        let count = 0;
        try {
          const r = await db.prepare('SELECT COUNT(*) as c FROM ugc_sandbox').first();
          count = r?.c ?? 0;
        } catch (_) {}
        return j({
          status: 'ok',
          service: 'stratamesh-sandbox',
          holon: 'ugc_sandbox',
          order: 1,
          role: 'Personal UGC crucible — private mint before Open-World integration',
          next_holon: 'open_world',
          items: count,
          version: '2.1.0-whitepaper',
        });
      }

      if (path === '/list' || path === '/sandbox') {
        const owner = url.searchParams.get('owner');
        let rows;
        if (owner) {
          rows = await db.prepare('SELECT * FROM ugc_sandbox WHERE owner = ? ORDER BY created_at DESC LIMIT 50').bind(owner).all();
        } else {
          rows = await db.prepare('SELECT * FROM ugc_sandbox ORDER BY created_at DESC LIMIT 50').all();
        }
        return j({ items: rows.results || [], holon: 'ugc_sandbox', order: 1 });
      }

      if (path === '/create' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        let cid = body.cid || null;
        const label = body.label || body.name || 'draft';
        const owner = body.owner || 'FOG-NODE-PT-CM-001';
        const content = body.content || { label, type: 'ugc_draft', owner, holon: 'sandbox' };
        if (!cid) {
          const payload = JSON.stringify({ content, name: label, node_id: owner });
          for (let attempt = 0; attempt < 3 && !cid; attempt++) {
            try {
              let r;
              if (env.IPFS && typeof env.IPFS.fetch === 'function') {
                r = await env.IPFS.fetch(new Request('https://ipfs/add', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: payload,
                }));
              } else {
                r = await fetch('https://stratamesh-ipfs.stratamesh.workers.dev/add', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: payload,
                });
              }
              const ij = await r.json();
              if (ij && ij.cid) cid = ij.cid;
            } catch (_) {}
          }
        }
        if (!cid) cid = 'pending';
        const id = 'sbx_' + crypto.randomUUID().slice(0, 12);
        await db
          .prepare('INSERT INTO ugc_sandbox (id, owner, cid, label, status, created_at) VALUES (?,?,?,?,?,?)')
          .bind(id, owner, cid, label, 'draft', new Date().toISOString())
          .run();
        return j({
          success: true,
          item: { id, owner, cid, label, status: 'draft' },
          holon: 'ugc_sandbox',
          order: 1,
          next: 'POST /publish then POST /integrate into an Open-World',
        });
      }

      if (path === '/publish' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const item_id = body.item_id || body.id;
        const as_nft = body.as_nft !== false; // default true per whitepaper mint path
        const row = await db.prepare('SELECT * FROM ugc_sandbox WHERE id = ?').bind(item_id).first();
        if (!row) return j({ error: 'not found' }, 404);
        let nft_id = row.nft_id || null;
        if (as_nft && !nft_id) {
          try {
            const r = await fetch('https://stratamesh-token.stratamesh.workers.dev/mint', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                owner: row.owner,
                name: row.label,
                asset_type: 'digital',
                metadata_cid: row.cid && row.cid !== 'pending' ? row.cid : undefined,
                description: 'Published from UGC Sandbox (whitepaper flow)',
              }),
            });
            const mj = await r.json();
            nft_id = mj.nft?.id || null;
            if (mj.nft?.metadata_cid && (!row.cid || row.cid === 'pending')) {
              await db.prepare('UPDATE ugc_sandbox SET cid = ? WHERE id = ?').bind(mj.nft.metadata_cid, item_id).run();
            }
          } catch (_) {}
        }
        await db
          .prepare('UPDATE ugc_sandbox SET status = ?, nft_id = ?, published_at = ? WHERE id = ?')
          .bind('published', nft_id, new Date().toISOString(), item_id)
          .run();
        return j({
          success: true,
          item_id,
          status: 'published',
          nft_id,
          holon: 'ugc_sandbox',
          next: 'POST /integrate { item_id, world_id } → Open-World',
        });
      }

      // Integrate published sandbox item into an Open-World (whitepaper: contributions become dynamic portions)
      if (path === '/integrate' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const item_id = body.item_id || body.id;
        const world_id = body.world_id || 'cmn-lab-world';
        const row = await db.prepare('SELECT * FROM ugc_sandbox WHERE id = ?').bind(item_id).first();
        if (!row) return j({ error: 'not found' }, 404);
        if (row.status !== 'published' && !body.force) {
          return j({ error: 'publish before integrate', status: row.status }, 400);
        }
        await db.prepare('UPDATE ugc_sandbox SET world_id = ?, status = ? WHERE id = ?').bind(world_id, 'integrated', item_id).run();
        // notify worlds layer (best-effort)
        try {
          await fetch('https://stratamesh-worlds.stratamesh.workers.dev/attach', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              world_id,
              sandbox_id: item_id,
              cid: row.cid,
              nft_id: row.nft_id,
              owner: row.owner,
              label: row.label,
            }),
          });
        } catch (_) {}
        return j({
          success: true,
          item_id,
          world_id,
          status: 'integrated',
          holon_flow: 'sandbox → open_world',
          note: 'Open-World must reside in a Virtual Realm hypervisor',
        });
      }

      return j({
        error: 'not found',
        holon: 'ugc_sandbox',
        endpoints: ['/health', '/list', '/create', '/publish', '/integrate'],
      }, 404);
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
