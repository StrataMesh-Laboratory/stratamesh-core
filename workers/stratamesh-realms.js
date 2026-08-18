const TOKEN_URL = "https://stratamesh-token.stratamesh.workers.dev";
/**
 * Holon 3 — Virtual Realm (hypervisor) · open structures as STRATA NFTs
 * Parent: metaverse_os · Children: open_world
 * Contract: worlds live inside realms; realm ≠ world.
 */
const HOLON = {
  id: "virtual_realm",
  order: 3,
  parent: "metaverse_os",
  children: ["open_world"],
  version: "3.2.0-so-bus",
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
      `CREATE TABLE IF NOT EXISTS realms (
        id TEXT PRIMARY KEY,
        name TEXT,
        sovereignty TEXT,
        operator TEXT,
        spa_id TEXT,
        status TEXT,
        node_id TEXT,
        rules_json TEXT,
        world_capacity INTEGER,
        meta_json TEXT,
        created_at TEXT,
        updated_at TEXT
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS realm_worlds (
        realm_id TEXT,
        world_id TEXT,
        title TEXT,
        status TEXT,
        hosted_at TEXT,
        meta_json TEXT,
        PRIMARY KEY (realm_id, world_id)
      )`
    )
    .run();
  // soft migrations
  for (const col of [
    "ALTER TABLE realms ADD COLUMN node_id TEXT",
    "ALTER TABLE realms ADD COLUMN rules_json TEXT",
    "ALTER TABLE realms ADD COLUMN world_capacity INTEGER",
    "ALTER TABLE realms ADD COLUMN meta_json TEXT",
    "ALTER TABLE realms ADD COLUMN updated_at TEXT",
    "ALTER TABLE realm_worlds ADD COLUMN status TEXT",
    "ALTER TABLE realm_worlds ADD COLUMN meta_json TEXT",
  ]) {
    try {
      await db.prepare(col).run();
    } catch (_) {}
  }
}


      // STRATA: open world structure is STRATA NFT blocks
      async function ensureWorldStrataStructure(world_id, owner, title, realm_id) {
        try {
          const res = await fetch(TOKEN_URL + "/world/compose", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ world_id, owner, title, realm_id }),
          });
          return await res.json();
        } catch (e) {
          return { error: String(e.message || e) };
        }
      }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.startsWith("/api/v1/realms")) path = path.slice("/api/v1/realms".length) || "/";
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
    }
    const db = env.LEDGER || env.DB;

    try {
      await ensureSchema(db);

      if (path === "/health" || path === "/" || path === "") {
        let count = 0;
        let hosted = 0;
        try {
          count = (await db.prepare("SELECT COUNT(*) as c FROM realms").first())?.c ?? 0;
          hosted = (await db.prepare("SELECT COUNT(*) as c FROM realm_worlds").first())?.c ?? 0;
        } catch (_) {}
        return j({
          status: "ok",
          service: "stratamesh-realms",
          holon: HOLON,
          realms: count,
          hosted_worlds: hosted,
          endpoints: [
            "/health",
            "/contract",
            "/list",
            "/get",
            "/create",
            "/ensure-lab",
            "/host-world",
            "/children",
            "/describe",
            "/metaverse",
          ],
        });
      }

      if (path === "/contract") {
        return j({
          holon: HOLON,
          nome: "Domínio Virtual",
          lingua: "pt-PT",
          invariants: ["open_world ⊂ virtual_realm", "realm is hypervisor not experience"],
          integration: {
            emits: ["realm.created", "realm.host_world"],
            consumes: ["os.schedule", "open_world.ready"],
            upstream: "metaverse_os",
            downstream: "open_world",
          },
          schema: {
            realm: ["id", "name", "sovereignty", "operator", "spa_id", "status", "node_id", "rules_json", "world_capacity"],
            binding: ["realm_id", "world_id", "title", "status", "hosted_at"],
          },
        });
      }

      if (path === "/list" || path === "/realms") {
        const rows = await db.prepare("SELECT * FROM realms ORDER BY created_at DESC LIMIT 100").all();
        const realms = (rows.results || []).map((r) => ({
          ...r,
          holon: "virtual_realm",
          parent_holon: "metaverse_os",
        }));
        return j({ realms, count: realms.length, holon: HOLON });
      }

      if (path === "/get") {
        const id = url.searchParams.get("id") || url.searchParams.get("realm_id");
        if (!id) return j({ error: "id required" }, 400);
        const realm = await db.prepare("SELECT * FROM realms WHERE id = ?").bind(id).first();
        if (!realm) return j({ error: "not_found", id }, 404);
        const worlds = await db
          .prepare("SELECT * FROM realm_worlds WHERE realm_id = ?")
          .bind(id)
          .all()
          .catch(() => ({ results: [] }));
        return j({
          realm,
          children: { open_worlds: worlds.results || [] },
          holon: HOLON,
          path: `metaverse_os / virtual_realm:${id}`,
        });
      }

      if (path === "/children") {
        const id = url.searchParams.get("id") || "cmn-lab";
        const worlds = await db
          .prepare("SELECT * FROM realm_worlds WHERE realm_id = ?")
          .bind(id)
          .all()
          .catch(() => ({ results: [] }));
        return j({
          realm_id: id,
          holon: "virtual_realm",
          child_holon: "open_world",
          children: worlds.results || [],
          count: (worlds.results || []).length,
        });
      }

      if (path === "/create" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const id = body.id || "realm_" + crypto.randomUUID().slice(0, 8);
        const now = new Date().toISOString();
        const rules = JSON.stringify(body.rules || { worlds_inside: true, max_public: true });
        const meta = JSON.stringify({
          source: body.source || "api",
          node_id: body.node_id || "FOG-NODE-PT-CM-001",
        });
        await db
          .prepare(
            `INSERT OR REPLACE INTO realms
            (id, name, sovereignty, operator, spa_id, status, node_id, rules_json, world_capacity, meta_json, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
          )
          .bind(
            id,
            body.name || id,
            body.sovereignty || "operator",
            body.operator || "André Manuel Calhegas Morais",
            body.spa_id || null,
            body.status || "active",
            body.node_id || "FOG-NODE-PT-CM-001",
            rules,
            body.world_capacity ?? 64,
            meta,
            now,
            now
          )
          .run();
        return j({
          success: true,
          id,
          holon: HOLON,
          event: "realm.created",
          parent: "metaverse_os",
        });
      }

      if (path === "/ensure-lab" || path === "/ensure-lab/") {
        const row = await db.prepare("SELECT id FROM realms WHERE id = ?").bind("cmn-lab").first();
        if (!row) {
          const now = new Date().toISOString();
          await db
            .prepare(
              `INSERT INTO realms
              (id, name, sovereignty, operator, spa_id, status, node_id, rules_json, world_capacity, meta_json, created_at, updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
            )
            .bind(
              "cmn-lab",
              "Calhegas Morais Lab Realm",
              "operator",
              "André Manuel Calhegas Morais",
              "spa-cmn-lab",
              "active",
              "FOG-NODE-PT-CM-001",
              JSON.stringify({ worlds_inside: true, lab: true }),
              64,
              JSON.stringify({ lab: true }),
              now,
              now
            )
            .run();
        }
        return j({ success: true, id: "cmn-lab", holon: HOLON, role: "hypervisor" });
      }

      if (path === "/host-world" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const realm_id = body.realm_id || "cmn-lab";
        const world_id = body.world_id;
        if (!world_id) return j({ error: "world_id required" }, 400);
        const realm = await db.prepare("SELECT id FROM realms WHERE id = ?").bind(realm_id).first();
        if (!realm) return j({ error: "realm_not_found", realm_id }, 404);
        await db
          .prepare(
            `INSERT OR REPLACE INTO realm_worlds (realm_id, world_id, title, status, hosted_at, meta_json)
             VALUES (?,?,?,?,?,?)`
          )
          .bind(
            realm_id,
            world_id,
            body.title || world_id,
            body.status || "hosted",
            new Date().toISOString(),
            JSON.stringify({ source: body.source || "host-world" })
          )
          .run();
        let holon_event = null;
        try {
          const payload = {
            de: "virtual_realm",
            evento: "realm.host_world",
            para: "open_world",
            carga: { realm_id, world_id },
          };
          let hr;
          if (env.HOLONS && typeof env.HOLONS.fetch === "function") {
            hr = await env.HOLONS.fetch(
              new Request("https://holons.internal/emitir", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              })
            );
          } else {
            hr = await fetch("https://stratamesh-holons.stratamesh.workers.dev/emitir", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
          }
          const text = await hr.text();
          try {
            holon_event = JSON.parse(text);
          } catch {
            holon_event = { aceite: hr.ok, http: hr.status, raw: text.slice(0, 120) };
          }
        } catch (e) {
          holon_event = { aceite: false, erro: String(e.message || e).slice(0, 120) };
        }
        
        const _wid = body.world_id || body.id || world_id;
        const strata_structure = await ensureWorldStrataStructure(
          _wid, body.owner || body.operator || "FOG-NODE-PT-CM-001", body.title || body.name || _wid, id || body.realm_id
        );
return j({
          success: true, strata_structure,
          realm_id,
          world_id,
          event: "realm.host_world",
          holon_flow: "mundo_aberto ⊂ dominio_virtual",
          integration: { next: "stratamesh-worlds /attach or ensure parent_realm_id" },
          holon_event,
        });
      }

      if (path === "/describe") {
        return j({
          holon: HOLON,
          depth: {
            hypervisor: "SPA/fog infrastructure instantiates open-worlds",
            policy: "realm rules_json constrain world admission",
            capacity: "world_capacity soft limit per realm",
            coalescence: "multiple realms aggregate into metaverse view",
          },
          seamless: {
            up: "metaverse_os schedules and orchestrates realm lifecycle",
            down: "open_world registers via host-world; must set parent_realm_id",
          },
        });
      }

      if (path === "/metaverse" || path === "/metaverse/") {
        const realms = await db.prepare("SELECT * FROM realms").all().catch(() => ({ results: [] }));
        const hosted = await db.prepare("SELECT * FROM realm_worlds").all().catch(() => ({ results: [] }));
        return j({
          holon: { id: "web3_metaverse_view", via: "virtual_realm" },
          parent_os: "metaverse_os",
          realms: (realms.results || []).length,
          hosted_worlds: (hosted.results || []).length,
          realm_list: realms.results || [],
          world_bindings: hosted.results || [],
          substrate: ["dag", "ipfs", "fog", "edge", "spa"],
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
            "/host-world",
            "/children",
            "/describe",
            "/metaverse",
          ],
        },
        404
      );
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
