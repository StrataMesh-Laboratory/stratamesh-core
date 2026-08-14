/**
 * Holon 4 — Open-World
 * Parent: virtual_realm · Children: ugc_sandbox
 */
const HOLON = {
  id: "open_world",
  order: 4,
  parent: "virtual_realm",
  children: ["ugc_sandbox"],
  version: "3.2.0-schema-title",
};

function j(d, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

async function ensureSchema(db) {
  if (!db) return;
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS worlds (
        id TEXT PRIMARY KEY,
        title TEXT,
        parent_realm_id TEXT,
        status TEXT,
        rules_json TEXT,
        inhabitant_count INTEGER,
        meta_json TEXT,
        created_at TEXT,
        updated_at TEXT
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS world_sandboxes (
        world_id TEXT,
        sandbox_id TEXT,
        title TEXT,
        status TEXT,
        attached_at TEXT,
        PRIMARY KEY (world_id, sandbox_id)
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS world_inhabitants (
        world_id TEXT,
        agent_id TEXT,
        agent_kind TEXT,
        joined_at TEXT,
        PRIMARY KEY (world_id, agent_id)
      )`
    )
    .run();
  for (const col of [
    "ALTER TABLE worlds ADD COLUMN parent_realm_id TEXT",
    "ALTER TABLE worlds ADD COLUMN rules_json TEXT",
    "ALTER TABLE worlds ADD COLUMN inhabitant_count INTEGER",
    "ALTER TABLE worlds ADD COLUMN meta_json TEXT",
    "ALTER TABLE worlds ADD COLUMN updated_at TEXT",
  ]) {
    try {
      await db.prepare(col).run();
    } catch (_) {}
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.startsWith("/api/v1/worlds")) path = path.slice("/api/v1/worlds".length) || "/";
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
    }
    const db = env.LEDGER || env.DB;

    try {
      await ensureSchema(db);

      if (path === "/schema") {
        try {
          const info = await db.prepare("PRAGMA table_info(worlds)").all();
          return j({ columns: info.results || [], holon: HOLON });
        } catch (e) {
          return j({ error: String(e.message || e) }, 500);
        }
      }

      if (path === "/health" || path === "/" || path === "") {
        let count = 0;
        try {
          count = (await db.prepare("SELECT COUNT(*) as c FROM worlds").first())?.c ?? 0;
        } catch (_) {}
        return j({
          status: "ok",
          service: "stratamesh-worlds",
          holon: HOLON,
          worlds: count,
          endpoints: [
            "/health",
            "/contract",
            "/list",
            "/get",
            "/create",
            "/ensure-lab",
            "/attach-sandbox",
            "/children",
            "/inhabitants",
            "/describe",
          ],
        });
      }

      if (path === "/contract") {
        return j({
          holon: HOLON,
          nome: "Mundo Aberto",
          lingua: "pt-PT",
          invariants: ["requires parent_realm_id", "ugc_sandbox ⊂ open_world"],
          integration: {
            emits: ["world.updated", "world.inhabitant", "world.attach_sandbox"],
            consumes: ["realm.host_world", "sandbox.publish"],
            upstream: "virtual_realm",
            downstream: "ugc_sandbox",
          },
        });
      }

      if (path === "/list") {
        const rows = await db.prepare("SELECT * FROM worlds ORDER BY created_at DESC LIMIT 100").all();
        return j({
          worlds: (rows.results || []).map((w) => ({ ...w, holon: "open_world" })),
          count: (rows.results || []).length,
          holon: HOLON,
        });
      }

      if (path === "/get") {
        const id = url.searchParams.get("id");
        if (!id) return j({ error: "id required" }, 400);
        const world = await db.prepare("SELECT * FROM worlds WHERE id = ?").bind(id).first();
        if (!world) return j({ error: "not_found", id }, 404);
        const sbs = await db
          .prepare("SELECT * FROM world_sandboxes WHERE world_id = ?")
          .bind(id)
          .all()
          .catch(() => ({ results: [] }));
        const inh = await db
          .prepare("SELECT * FROM world_inhabitants WHERE world_id = ?")
          .bind(id)
          .all()
          .catch(() => ({ results: [] }));
        return j({
          world,
          children: { sandboxes: sbs.results || [] },
          inhabitants: inh.results || [],
          holon: HOLON,
          path: `virtual_realm:${world.parent_realm_id || "?"} / open_world:${id}`,
        });
      }

      if (path === "/children") {
        const id = url.searchParams.get("id");
        if (!id) return j({ error: "id required" }, 400);
        const sbs = await db
          .prepare("SELECT * FROM world_sandboxes WHERE world_id = ?")
          .bind(id)
          .all()
          .catch(() => ({ results: [] }));
        return j({
          world_id: id,
          child_holon: "ugc_sandbox",
          children: sbs.results || [],
          count: (sbs.results || []).length,
        });
      }

      if ((path === "/create" || path === "/ensure-lab") && (request.method === "POST" || path === "/ensure-lab")) {
        const body = path === "/ensure-lab" ? {} : await request.json().catch(() => ({}));
        const id = path === "/ensure-lab" ? "cmn-lab-world" : body.id || "world_" + crypto.randomUUID().slice(0, 10);
        const title = body.title || body.name || (path === "/ensure-lab" ? "Calhegas Morais Lab Open-World" : "Untitled Open-World");
        const parent = body.parent_realm_id || body.realm_id || "cmn-lab";
        const status = body.status || "active";
        const rules = JSON.stringify(body.rules || { public: true, lab: path === "/ensure-lab" });
        const meta = JSON.stringify({ source: path === "/ensure-lab" ? "ensure-lab" : "create" });
        const now = new Date().toISOString();
        // Migrate schema aggressively
        for (const col of ["title", "name", "parent_realm_id", "status", "rules_json", "inhabitant_count", "meta_json", "created_at", "updated_at"]) {
          try { await db.prepare(`ALTER TABLE worlds ADD COLUMN ${col} TEXT`).run(); } catch (_) {}
        }
        let inserted = false;
        const attempts = [
          { sql: `INSERT OR REPLACE INTO worlds (id, title, parent_realm_id, status, rules_json, inhabitant_count, meta_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
            binds: [id, title, parent, status, rules, 0, meta, now, now] },
          { sql: `INSERT OR REPLACE INTO worlds (id, name, parent_realm_id, status, rules_json, meta_json, created_at) VALUES (?,?,?,?,?,?,?)`,
            binds: [id, title, parent, status, rules, meta, now] },
          { sql: `INSERT OR REPLACE INTO worlds (id, name, status, created_at) VALUES (?,?,?,?)`,
            binds: [id, title, status, now] },
          { sql: `INSERT OR REPLACE INTO worlds (id) VALUES (?)`,
            binds: [id] },
        ];
        let lastErr = null;
        for (const a of attempts) {
          try {
            await db.prepare(a.sql).bind(...a.binds).run();
            inserted = true;
            break;
          } catch (e) {
            lastErr = String(e.message || e);
          }
        }
        if (!inserted) return j({ error: lastErr || "insert_failed", id }, 500);

        return j({
          success: true,
          id,
          parent_realm_id: parent,
          holon: HOLON,
          event: "world.updated",
          seamless: { notify_realm: "POST /host-world on stratamesh-realms" },
        });
      }

      if ((path === "/attach-sandbox" || path === "/attach") && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const world_id = body.world_id;
        const sandbox_id = body.sandbox_id;
        if (!world_id || !sandbox_id) return j({ error: "world_id and sandbox_id required" }, 400);
        const world = await db.prepare("SELECT id FROM worlds WHERE id = ?").bind(world_id).first();
        if (!world) return j({ error: "world_not_found", world_id }, 404);
        await db
          .prepare(
            `INSERT OR REPLACE INTO world_sandboxes (world_id, sandbox_id, title, status, attached_at)
             VALUES (?,?,?,?,?)`
          )
          .bind(world_id, sandbox_id, body.title || sandbox_id, body.status || "attached", new Date().toISOString())
          .run();
        return j({
          success: true,
          world_id,
          sandbox_id,
          event: "world.attach_sandbox",
          holon_flow: "ugc_sandbox ⊂ open_world",
        });
      }

      if (path === "/inhabitants") {
        if (request.method === "POST") {
          const body = await request.json().catch(() => ({}));
          if (!body.world_id || !body.agent_id) return j({ error: "world_id and agent_id required" }, 400);
          await db
            .prepare(
              `INSERT OR REPLACE INTO world_inhabitants (world_id, agent_id, agent_kind, joined_at)
               VALUES (?,?,?,?)`
            )
            .bind(body.world_id, body.agent_id, body.agent_kind || "sca", new Date().toISOString())
            .run();
          try {
            await db
              .prepare(
                "UPDATE worlds SET inhabitant_count = (SELECT COUNT(*) FROM world_inhabitants WHERE world_id = ?), updated_at = ? WHERE id = ?"
              )
              .bind(body.world_id, new Date().toISOString(), body.world_id)
              .run();
          } catch (_) {}
          return j({ success: true, event: "world.inhabitant", world_id: body.world_id, agent_id: body.agent_id });
        }
        const id = url.searchParams.get("id") || url.searchParams.get("world_id");
        if (!id) return j({ error: "id required" }, 400);
        const rows = await db.prepare("SELECT * FROM world_inhabitants WHERE world_id = ?").bind(id).all();
        return j({ world_id: id, inhabitants: rows.results || [], count: (rows.results || []).length });
      }

      if (path === "/describe") {
        return j({
          holon: HOLON,
          depth: {
            persistence: "multi-user open-world state",
            portions: "sandbox contributions become dynamic world portions",
            agency: "users and SCA join as inhabitants",
          },
          seamless: {
            up: "must be hosted by virtual_realm (parent_realm_id + host-world)",
            down: "attach-sandbox binds ugc_sandbox children",
          },
        });
      }

      return j(
        {
          error: "not found",
          holon: HOLON,
          endpoints: [
            "/health",
            "/contract",
            "/list",
            "/get",
            "/create",
            "/ensure-lab",
            "/attach-sandbox",
            "/children",
            "/inhabitants",
            "/describe",
          ],
        },
        404
      );
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
