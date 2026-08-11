/**
 * Holon 3 — Virtual Realms (whitepaper)
 * Hypervisor layer: fog nodes under SPA instantiate & operate Open-Worlds.
 * Realms coalesce into the Web3 Metaverse (holon 4).
 */
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
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }
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
        await db
          .prepare(
            `CREATE TABLE IF NOT EXISTS realm_worlds (
              realm_id TEXT, world_id TEXT, title TEXT, hosted_at TEXT,
              PRIMARY KEY (realm_id, world_id)
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
          holon: 'virtual_realm',
          order: 3,
          role: 'Virtual Realm hypervisor — fog SPA infrastructure that hosts Open-Worlds',
          hosts: 'open_world',
          coalesces_into: 'web3_metaverse',
          realms: count,
          version: '2.1.0-whitepaper',
        });
      }

      if (path === '/list' || path === '/realms') {
        let rows = { results: [] };
        try {
          rows = await db.prepare('SELECT * FROM realms ORDER BY created_at DESC LIMIT 50').all();
        } catch (_) {}
        let realms = rows.results || [];
        if (!realms.length) {
          realms = [
            {
              id: 'cmn-lab',
              name: 'Calhegas Morais Lab Realm',
              sovereignty: 'operator',
              operator: 'André Manuel Calhegas Morais',
              spa_id: 'spa-cmn-lab',
              status: 'active',
              holon: 'virtual_realm',
            },
          ];
        }
        // attach hosted worlds
        for (const realm of realms) {
          try {
            const ww = await db
              .prepare('SELECT world_id, title, hosted_at FROM realm_worlds WHERE realm_id = ?')
              .bind(realm.id)
              .all();
            realm.hosted_worlds = ww.results || [];
          } catch (_) {
            realm.hosted_worlds = [];
          }
        }
        return j({ realms, count: realms.length, holon: 'virtual_realm', order: 3 });
      }

      if (path === '/create' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const id = body.id || 'realm_' + crypto.randomUUID().slice(0, 8);
        await db
          .prepare(
            'INSERT OR REPLACE INTO realms (id, name, sovereignty, operator, spa_id, status, created_at) VALUES (?,?,?,?,?,?,?)'
          )
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
        return j({
          success: true,
          realm: { id, name: body.name || id, role: 'hypervisor' },
          holon: 'virtual_realm',
          note: 'Create Open-Worlds with realm_id=' + id,
        });
      }

      if (path === '/ensure-lab' || path === '/ensure-lab/') {
        const ex = await db.prepare("SELECT id FROM realms WHERE id = 'cmn-lab'").first().catch(() => null);
        if (!ex) {
          await db
            .prepare(
              'INSERT INTO realms (id, name, sovereignty, operator, spa_id, status, created_at) VALUES (?,?,?,?,?,?,?)'
            )
            .bind(
              'cmn-lab',
              'Calhegas Morais Lab Realm',
              'operator',
              'André Manuel Calhegas Morais',
              'spa-cmn-lab',
              'active',
              new Date().toISOString()
            )
            .run();
        }
        return j({ success: true, id: 'cmn-lab', holon: 'virtual_realm', role: 'hypervisor' });
      }

      // Host an open-world inside this realm (hypervisor binding)
      if (path === '/host-world' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const realm_id = body.realm_id || 'cmn-lab';
        const world_id = body.world_id;
        if (!world_id) return j({ error: 'world_id required' }, 400);
        await db
          .prepare(
            'INSERT OR REPLACE INTO realm_worlds (realm_id, world_id, title, hosted_at) VALUES (?,?,?,?)'
          )
          .bind(realm_id, world_id, body.title || world_id, new Date().toISOString())
          .run();
        return j({
          success: true,
          realm_id,
          world_id,
          holon_flow: 'open_world ⊂ virtual_realm',
          note: 'Realm is the hypervisor; world is the persistent open experience',
        });
      }

      // Metaverse aggregate (holon 4 view from realm side)
      if (path === '/metaverse' || path === '/metaverse/') {
        const realms = await db.prepare('SELECT * FROM realms').all().catch(() => ({ results: [] }));
        const hosted = await db.prepare('SELECT * FROM realm_worlds').all().catch(() => ({ results: [] }));
        return j({
          holon: 'web3_metaverse',
          order: 4,
          role: 'Overarching tapestry — Virtual Realms coalesce here',
          realms: (realms.results || []).length,
          hosted_worlds: (hosted.results || []).length,
          realm_list: realms.results || [],
          world_bindings: hosted.results || [],
          substrate: ['dag', 'ipfs', 'fog', 'edge', 'spa'],
          agency: ['acb', 'dao_republic', 'proof_of_subsistence'],
        });
      }

      return j({
        error: 'not found',
        holon: 'virtual_realm',
        endpoints: ['/health', '/list', '/create', '/ensure-lab', '/host-world', '/metaverse'],
      }, 404);
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
