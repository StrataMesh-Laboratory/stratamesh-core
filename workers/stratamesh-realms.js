export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.startsWith('/api/v1/realms')) path = path.slice('/api/v1/realms'.length) || '/';
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
            `CREATE TABLE IF NOT EXISTS realms (
              id TEXT PRIMARY KEY, name TEXT, sovereignty TEXT, operator TEXT,
              spa_id TEXT, status TEXT, created_at TEXT
            )`
          )
          .run();
      }
      if (path === '/health' || path === '/' || path === '') {
        let count = 0;
        try {
          const r = await db.prepare('SELECT COUNT(*) as c FROM realms').first();
          count = r?.c ?? 0;
        } catch (_) {}
        return j({
          status: 'ok',
          service: 'stratamesh-realms',
          holon: 'realm',
          layer: 3,
          role: 'governance / sovereignty namespaces under SPA',
          realms: count,
          version: '2.0.0-holonic',
        });
      }
      if (path === '/list' || path === '/realms') {
        let rows = { results: [] };
        try {
          rows = await db.prepare('SELECT * FROM realms ORDER BY created_at DESC LIMIT 50').all();
        } catch (_) {}
        if (!(rows.results || []).length) {
          return j({
            realms: [
              {
                id: 'cmn-lab',
                name: 'Calhegas Morais Lab',
                sovereignty: 'operator',
                operator: 'André Manuel Calhegas Morais',
                status: 'active',
              },
            ],
            count: 1,
          });
        }
        return j({ realms: rows.results, count: rows.results.length });
      }
      if (path === '/create' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const id = body.id || 'realm_' + crypto.randomUUID().slice(0, 8);
        await db
          .prepare('INSERT INTO realms (id, name, sovereignty, operator, spa_id, status, created_at) VALUES (?,?,?,?,?,?,?)')
          .bind(
            id,
            body.name || id,
            body.sovereignty || 'operator',
            body.operator || 'FOG-NODE-PT-CM-001',
            body.spa_id || null,
            'active',
            new Date().toISOString()
          )
          .run();
        return j({ success: true, realm: { id, name: body.name || id } });
      }
      if (path === '/ensure-lab') // {
        const ex = await db.prepare("SELECT id FROM realms WHERE id = 'cmn-lab'").first().catch(() => null);
        if (!ex) {
          await db
            .prepare('INSERT INTO realms (id, name, sovereignty, operator, spa_id, status, created_at) VALUES (?,?,?,?,?,?,?)')
            .bind('cmn-lab', 'Calhegas Morais Lab', 'operator', 'André Manuel Calhegas Morais', 'spa-cmn-lab', 'active', new Date().toISOString())
            .run();
        }
        return j({ success: true, id: 'cmn-lab' });
      }
      return j({ error: 'not found', endpoints: ['/health', '/list', '/create', '/ensure-lab'] }, 404);
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
