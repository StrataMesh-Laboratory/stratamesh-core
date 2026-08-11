/**
 * Holon 2 — Multi-User Persistent Open-Worlds (whitepaper)
 * Shared persistent worlds; sandbox contributions integrate as dynamic portions.
 * Worlds are instantiated/operated INSIDE Virtual Realm hypervisors (realm_id required).
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.startsWith('/api/v1/worlds')) path = path.slice('/api/v1/worlds'.length) || '/';
    const j = (d, s = 200) =>
      new Response(JSON.stringify(d), {
        status: s,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    const db = env.LEDGER || env.DB;

    const parseRow = (r) => {
      try {
        return { id: r.id, ...JSON.parse(r.data || '{}') };
      } catch {
        return { id: r.id, data: r.data };
      }
    };

    try {
      if (path === '/health' || path === '/' || path === '') {
        let count = 0;
        try {
          const r = await db.prepare('SELECT COUNT(*) as c FROM worlds').first();
          count = r?.c ?? 0;
        } catch (_) {}
        return j({
          status: 'ok',
          service: 'stratamesh-worlds',
          holon: 'open_world',
          order: 2,
          role: 'Multi-User Persistent Open-Worlds — shared experience namespaces',
          hosts_in: 'virtual_realm',
          accepts_from: 'ugc_sandbox',
          worlds: count,
          version: '2.1.0-whitepaper',
        });
      }

      if (path === '/list') {
        const realm_id = url.searchParams.get('realm_id');
        const rows = await db.prepare('SELECT id, data FROM worlds LIMIT 50').all();
        let worlds = (rows.results || []).map(parseRow);
        if (realm_id) worlds = worlds.filter((w) => w.realm_id === realm_id);
        return j({ worlds, count: worlds.length, holon: 'open_world', order: 2 });
      }

      if (path === '/get') {
        const id = url.searchParams.get('id');
        if (!id) return j({ error: 'id required' }, 400);
        const row = await db.prepare('SELECT id, data FROM worlds WHERE id = ?').bind(id).first();
        if (!row) return j({ error: 'not found' }, 404);
        return j({ world: parseRow(row) });
      }

      if ((path === '/create' || path === '/ensure-lab') && (request.method === 'POST' || path === '/ensure-lab')) {
        const body = path === '/ensure-lab' ? {} : await request.json().catch(() => ({}));
        const id = path === '/ensure-lab' ? 'cmn-lab-world' : body.id || 'world_' + crypto.randomUUID().slice(0, 10);
        // Whitepaper: open worlds operated within Virtual Realms
        const realm_id = body.realm_id || 'cmn-lab';
        const record = {
          title: body.title || (path === '/ensure-lab' ? 'Calhegas Morais Lab Open-World' : 'Untitled Open-World'),
          owner: body.owner || 'FOG-NODE-PT-CM-001',
          realm_id,
          root_cid: body.root_cid || body.cid || null,
          portions: body.portions || [], // integrated sandbox items
          status: 'active',
          holon: 'open_world',
          created_at: new Date().toISOString(),
        };
        await db.prepare('INSERT OR REPLACE INTO worlds (id, data) VALUES (?, ?)').bind(id, JSON.stringify(record)).run();
        // register with realm hypervisor (best-effort)
        try {
          await fetch('https://stratamesh-realms.stratamesh.workers.dev/host-world', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ realm_id, world_id: id, title: record.title }),
          });
        } catch (_) {}
        return j({ success: true, world: { id, ...record }, holon_flow: 'open_world ⊂ virtual_realm' });
      }

      // Attach sandbox portion into this open-world
      if (path === '/attach' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const world_id = body.world_id || 'cmn-lab-world';
        const row = await db.prepare('SELECT id, data FROM worlds WHERE id = ?').bind(world_id).first();
        if (!row) return j({ error: 'world not found — create open-world first' }, 404);
        const w = parseRow(row);
        const portions = Array.isArray(w.portions) ? w.portions : [];
        portions.push({
          sandbox_id: body.sandbox_id,
          cid: body.cid,
          nft_id: body.nft_id,
          owner: body.owner,
          label: body.label,
          attached_at: new Date().toISOString(),
        });
        w.portions = portions;
        w.updated_at = new Date().toISOString();
        await db.prepare('INSERT OR REPLACE INTO worlds (id, data) VALUES (?, ?)').bind(world_id, JSON.stringify(w)).run();
        return j({ success: true, world_id, portions: portions.length, holon_flow: 'sandbox → open_world' });
      }

      return j({
        error: 'not found',
        holon: 'open_world',
        endpoints: ['/health', '/list', '/get', '/create', '/ensure-lab', '/attach'],
      }, 404);
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
