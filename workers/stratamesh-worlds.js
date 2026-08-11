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
      if (db) {
        await db
          .prepare(
            `CREATE TABLE IF NOT EXISTS worlds (
              id TEXT PRIMARY KEY, title TEXT, owner TEXT, realm_id TEXT,
              root_cid TEXT, status TEXT, created_at TEXT
            )`
          )
          .run();
      }
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
          version: '2.0.0-holonic',
        });
      }
      if (path === '/list') {
        const rows = await db.prepare('SELECT * FROM worlds ORDER BY created_at DESC LIMIT 50').all();
        return j({ worlds: rows.results || [] });
      }
      if (path === '/create' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const id = body.id || 'world_' + crypto.randomUUID().slice(0, 10);
        const title = body.title || 'Untitled World';
        const owner = body.owner || 'FOG-NODE-PT-CM-001';
        const root = body.root_cid || body.cid || null;
        await db
          .prepare('INSERT INTO worlds (id, title, owner, realm_id, root_cid, status, created_at) VALUES (?,?,?,?,?,?,?)')
          .bind(id, title, owner, body.realm_id || 'cmn-lab', root, 'active', new Date().toISOString())
          .run();
        return j({ success: true, world: { id, title, owner, root_cid: root, realm_id: body.realm_id || 'cmn-lab' } });
      }
      // seed default
      if (path === '/ensure-lab') {
        const existing = await db.prepare("SELECT id FROM worlds WHERE id = 'cmn-lab-world'").first();
        if (!existing) {
          await db
            .prepare('INSERT INTO worlds (id, title, owner, realm_id, root_cid, status, created_at) VALUES (?,?,?,?,?,?,?)')
            .bind('cmn-lab-world', 'Calhegas Morais Lab World', 'FOG-NODE-PT-CM-001', 'cmn-lab', null, 'active', new Date().toISOString())
            .run();
        }
        return j({ success: true, id: 'cmn-lab-world' });
      }
      return j({ error: 'not found', endpoints: ['/health', '/list', '/create', '/ensure-lab'] }, 404);
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
