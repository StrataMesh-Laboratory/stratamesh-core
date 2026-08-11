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
    if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });

    const db = env.LEDGER || env.DB;
    const ensure = async () => {
      if (!db) return;
      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS ugc_sandbox (
            id TEXT PRIMARY KEY, owner TEXT, cid TEXT, label TEXT, status TEXT,
            nft_id TEXT, world_id TEXT, created_at TEXT, published_at TEXT
          )`
        )
        .run();
    };

    try {
      await ensure();
      if (path === '/health' || path === '/' || path === '') {
        let count = 0;
        try {
          const r = await db.prepare('SELECT COUNT(*) as c FROM ugc_sandbox').first();
          count = r?.c ?? 0;
        } catch (_) {}
        return j({
          status: 'ok',
          service: 'stratamesh-sandbox',
          holon: 'sandbox',
          layer: 1,
          role: 'UGC trial / draft assets before world publish',
          items: count,
          version: '2.0.0-holonic',
        });
      }

      if (path === '/list' || path === '/sandbox') {
        const rows = await db.prepare('SELECT * FROM ugc_sandbox ORDER BY created_at DESC LIMIT 50').all();
        return j({ items: rows.results || [], holon: 'sandbox' });
      }

      if (path === '/create' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        let cid = body.cid;
        const label = body.label || body.name || 'draft';
        const owner = body.owner || 'FOG-NODE-PT-CM-001';
        const content = body.content || { label, type: 'ugc_draft', owner };
        // real IPFS add if no cid
        if (!cid) {
          try {
            const r = await fetch('https://stratamesh-ipfs.stratamesh.workers.dev/add', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content, name: label, node_id: owner }),
            });
            const ij = await r.json();
            cid = ij.cid;
          } catch (_) {
            cid = 'pending';
          }
        }
        const id = 'sbx_' + crypto.randomUUID().slice(0, 12);
        await db
          .prepare(
            'INSERT INTO ugc_sandbox (id, owner, cid, label, status, created_at) VALUES (?,?,?,?,?,?)'
          )
          .bind(id, owner, cid, label, 'draft', new Date().toISOString())
          .run();
        return j({ success: true, item: { id, owner, cid, label, status: 'draft' }, holon: 'sandbox' });
      }

      if (path === '/publish' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const item_id = body.item_id || body.id;
        const as_nft = !!body.as_nft;
        const row = await db.prepare('SELECT * FROM ugc_sandbox WHERE id = ?').bind(item_id).first();
        if (!row) return j({ error: 'not found' }, 404);
        let nft_id = null;
        if (as_nft) {
          try {
            const r = await fetch('https://stratamesh-token.stratamesh.workers.dev/mint', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                owner: row.owner,
                name: row.label,
                asset_type: 'digital',
                metadata_cid: row.cid,
                description: 'Published from UGC Sandbox',
              }),
            });
            const mj = await r.json();
            nft_id = mj.nft?.id || null;
          } catch (_) {}
        }
        await db
          .prepare('UPDATE ugc_sandbox SET status = ?, nft_id = ?, published_at = ? WHERE id = ?')
          .bind('published', nft_id, new Date().toISOString(), item_id)
          .run();
        return j({ success: true, item_id, status: 'published', nft_id, holon: 'sandbox→world-eligible' });
      }

      return j({ error: 'not found', endpoints: ['/health', '/list', '/create', '/publish'] }, 404);
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
