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
    if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
    const db = env.LEDGER || env.DB;
    try {
      // existing schema: worlds(id, data TEXT JSON)
      if (path === '/health' || path === '/' || path === '') {
        let count = 0;
        try {
          const r = await db.prepare('SELECT COUNT(*) as c FROM worlds').first();
          count = r?.c ?? 0;
        } catch (_) {}
        return j({
          status: 'ok',
          service: 'stratamesh-worlds',
          holon: 'world',
          layer: 2,
          role: 'experience namespaces / multi-user open world containers',
          worlds: count,
          version: '2.0.1-holonic',
        });
      }
      if (path === '/list') {
        const rows = await db.prepare('SELECT id, data FROM worlds LIMIT 50').all();
        const worlds = (rows.results || []).map((r) => {
          try {
            return { id: r.id, ...JSON.parse(r.data || '{}') };
          } catch {
            return { id: r.id, data: r.data };
          }
        });
        return j({ worlds, count: worlds.length });
      }
      if ((path === '/create' || path === '/ensure-lab') && (request.method === 'POST' || path === '/ensure-lab')) {
        const body = path === '/ensure-lab' ? {} : await request.json().catch(() => ({}));
        const id = path === '/ensure-lab' ? 'cmn-lab-world' : body.id || 'world_' + crypto.randomUUID().slice(0, 10);
        const record = {
          title: body.title || (path === '/ensure-lab' ? 'Calhegas Morais Lab World' : 'Untitled World'),
          owner: body.owner || 'FOG-NODE-PT-CM-001',
          realm_id: body.realm_id || 'cmn-lab',
          root_cid: body.root_cid || body.cid || null,
          status: 'active',
          created_at: new Date().toISOString(),
        };
        await db
          .prepare('INSERT OR REPLACE INTO worlds (id, data) VALUES (?, ?)')
          .bind(id, JSON.stringify(record))
          .run();
        return j({ success: true, world: { id, ...record } });
      }
      return j({ error: 'not found', endpoints: ['/health', '/list', '/create', '/ensure-lab'] }, 404);
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
