/**
 * Holon 5 — Bancada CGU / UGC Sandbox (users + SCAs)
 * Creations are STRATA NFTs · Parent: open_world (STRATA NFTs) · Children: agent
 */
const TOKEN_URL = "https://stratamesh-token.stratamesh.workers.dev";
const HOLON = {
  id: "ugc_sandbox",
  order: 5,
  parent: "open_world",
  children: ["agent"],
  version: "3.4.0-static-dynamic",
};

function j(d, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

async function ensureSchema(db) {
  if (!db) return;
  for (const col of [
    "ALTER TABLE sandboxes ADD COLUMN title TEXT",
    "ALTER TABLE sandboxes ADD COLUMN name TEXT",
    "ALTER TABLE sandboxes ADD COLUMN parent_world_id TEXT",
    "ALTER TABLE sandboxes ADD COLUMN owner_id TEXT",
    "ALTER TABLE sandboxes ADD COLUMN status TEXT",
    "ALTER TABLE sandboxes ADD COLUMN isolation TEXT",
    "ALTER TABLE sandboxes ADD COLUMN content_json TEXT",
    "ALTER TABLE sandboxes ADD COLUMN meta_json TEXT",
    "ALTER TABLE sandboxes ADD COLUMN created_at TEXT",
    "ALTER TABLE sandboxes ADD COLUMN updated_at TEXT",
    "ALTER TABLE sandboxes ADD COLUMN published_at TEXT",
  ]) {
    try { await db.prepare(col).run(); } catch (_) {}
  }
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS sandboxes (
        id TEXT PRIMARY KEY,
        title TEXT,
        parent_world_id TEXT,
        owner_id TEXT,
        status TEXT,
        isolation TEXT,
        content_json TEXT,
        meta_json TEXT,
        created_at TEXT,
        updated_at TEXT,
        published_at TEXT
      )`
    )
    .run();
  for (const col of [
    "ALTER TABLE sandboxes ADD COLUMN parent_world_id TEXT",
    "ALTER TABLE sandboxes ADD COLUMN owner_id TEXT",
    "ALTER TABLE sandboxes ADD COLUMN isolation TEXT",
    "ALTER TABLE sandboxes ADD COLUMN content_json TEXT",
    "ALTER TABLE sandboxes ADD COLUMN meta_json TEXT",
    "ALTER TABLE sandboxes ADD COLUMN updated_at TEXT",
    "ALTER TABLE sandboxes ADD COLUMN published_at TEXT",
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
    if (path.startsWith("/api/v1/sandbox")) path = path.slice("/api/v1/sandbox".length) || "/";
    if (path.startsWith("/api/v1/sandboxes")) path = path.slice("/api/v1/sandboxes".length) || "/";
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
    }
    const db = env.LEDGER || env.DB;

    try {
      await ensureSchema(db);

      if (path === "/health" || path === "/" || path === "") {
        let count = 0;
        try {
          count = (await db.prepare("SELECT COUNT(*) as c FROM sandboxes").first())?.c ?? 0;
        } catch (_) {}
        return j({
          status: "ok",
          service: "stratamesh-sandbox",
          holon: HOLON,
          sandboxes: count,
          endpoints: [
            "/health",
            "/contract",
            "/list",
            "/get",
            "/create",
            "/publish",
            "/integrate",
            "/describe",
          ],
        });
      }

      if (path === "/contract") {
        return j({
          holon: HOLON,
          nome: "Bancada CGU",
          lingua: "pt-PT",
          superficie: ["painel", "portal", "chat"],
          nota: "Painel/Portal vivem nesta bancada — não são camada acima",
          invariants: ["isolation until publish", "publish targets parent open_world"],
          integration: {
            emits: ["sandbox.publish", "sandbox.integrate"],
            consumes: ["world.attach_sandbox", "agent.edit"],
            upstream: "open_world",
            downstream: "agent",
          },
        });
      }

      if (path === "/list" || path === "/sandbox") {
        const world = url.searchParams.get("world_id");
        let rows;
        if (world) {
          rows = await db.prepare("SELECT * FROM sandboxes WHERE parent_world_id = ? ORDER BY created_at DESC LIMIT 100").bind(world).all();
        } else {
          rows = await db.prepare("SELECT * FROM sandboxes ORDER BY created_at DESC LIMIT 100").all();
        }
        return j({
          sandboxes: (rows.results || []).map((s) => ({ ...s, holon: "ugc_sandbox" })),
          count: (rows.results || []).length,
          holon: HOLON,
          structure: "sandbox_cgu_is_strata_nft",
          valuation_note: "Colateral STRATA ≠ valor de mercado; resgate se mercado < colateral",
        });
      }

      if (path === "/get") {
        const id = url.searchParams.get("id");
        if (!id) return j({ error: "id required" }, 400);
        const sb = await db.prepare("SELECT * FROM sandboxes WHERE id = ?").bind(id).first();
        if (!sb) return j({ error: "not_found", id }, 404);
        return j({
          sandbox: sb,
          holon: HOLON,
          path: `open_world:${sb.parent_world_id || "?"} / ugc_sandbox:${id}`,
        });
      }

      if (path === "/create" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const id = body.id || "sbx_" + crypto.randomUUID().slice(0, 10);
        const now = new Date().toISOString();
        const title = body.title || body.name || "Untitled sandbox";
        const parent = body.parent_world_id || body.world_id || "cmn-lab-world";
        const meta = JSON.stringify({ source: "create" });
        const content = JSON.stringify(body.content || {});
        for (const col of ["title","name","parent_world_id","owner_id","status","isolation","content_json","meta_json","created_at","updated_at","published_at"]) {
          try { await db.prepare(`ALTER TABLE sandboxes ADD COLUMN ${col} TEXT`).run(); } catch (_) {}
        }
        let inserted = false, lastErr = null;
        const attempts = [
          { sql: `INSERT OR REPLACE INTO sandboxes (id, title, parent_world_id, owner_id, status, isolation, content_json, meta_json, created_at, updated_at, published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            binds: [id, title, parent, body.owner_id || null, "isolated", body.isolation || "strict", content, meta, now, now, null] },
          { sql: `INSERT OR REPLACE INTO sandboxes (id, name, parent_world_id, status, content_json, created_at) VALUES (?,?,?,?,?,?)`,
            binds: [id, title, parent, "isolated", content, now] },
          { sql: `INSERT OR REPLACE INTO sandboxes (id, data, created_at) VALUES (?,?,?)`,
            binds: [id, JSON.stringify({ title, parent, status: "isolated" }), now] },
          { sql: `INSERT OR REPLACE INTO sandboxes (id) VALUES (?)`, binds: [id] },
        ];
        for (const a of attempts) {
          try { await db.prepare(a.sql).bind(...a.binds).run(); inserted = true; break; }
          catch (e) { lastErr = String(e.message || e); }
        }
        if (!inserted) return j({ error: lastErr || "insert_failed", id }, 500);
        let holon_event = null;
        try {
          const payload = { de: "ugc_sandbox", evento: "sandbox.created", para: "agent", carga: { id, title, parent } };
          let hr;
          if (env.HOLONS && typeof env.HOLONS.fetch === "function") {
            hr = await env.HOLONS.fetch(new Request("https://holons.internal/emitir", {
              method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
            }));
          } else {
            hr = await fetch("https://stratamesh-holons.stratamesh.workers.dev/emitir", {
              method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
            });
          }
          const tx = await hr.text();
          try { holon_event = JSON.parse(tx); } catch { holon_event = { aceite: hr.ok, http: hr.status, raw: tx.slice(0, 100) }; }
        } catch (e) { holon_event = { aceite: false, erro: String(e.message || e).slice(0, 100) }; }
        let strata_nft = null;
        try {
          const cguBody = JSON.stringify({
            sandbox_id: id,
            world_id: parent,
            title: title || id,
            author_id: body.owner_id || body.owner || "portal",
            author_kind: body.author_kind || (String(body.owner_id || "").startsWith("sca") || String(body.owner_id || "").startsWith("SCA") || String(body.owner_id || "").startsWith("ACB") ? "sca" : "user"),
            status: "isolated",
            collateral_strata: body.collateral_strata != null ? body.collateral_strata : 0.01,
            mode: body.mode || "static",
            burn_rate_per_hour: body.burn_rate_per_hour,
          });
          let tr;
          if (env.TOKEN && typeof env.TOKEN.fetch === "function") {
            tr = await env.TOKEN.fetch(new Request("https://token.internal/cgu/mint", {
              method: "POST", headers: { "Content-Type": "application/json" }, body: cguBody,
            }));
          } else if (env.STRATAMESH_TOKEN && typeof env.STRATAMESH_TOKEN.fetch === "function") {
            tr = await env.STRATAMESH_TOKEN.fetch(new Request("https://token.internal/cgu/mint", {
              method: "POST", headers: { "Content-Type": "application/json" }, body: cguBody,
            }));
          } else {
            // workers.dev inter-worker fetch returns 1042 — skip; surface clear error
            strata_nft = { error: "TOKEN_service_binding_required", note: "bind TOKEN → stratamesh-token" };
            tr = null;
          }
          if (tr) {
            const raw = await tr.text();
            try {
              strata_nft = JSON.parse(raw);
              strata_nft.http = tr.status;
            } catch {
              strata_nft = { error: "non_json", http: tr.status, raw: String(raw).slice(0, 200) };
            }
          }
        } catch (e) {
          strata_nft = { error: String(e.message || e).slice(0, 160) };
        }
        return j({
          success: true,
          id,
          status: "isolated",
          parent_world_id: parent,
          holon: HOLON,
          event: "sandbox.created",
          holon_event,
          strata_cgu: strata_nft,
          structure: "sandbox_cgu_is_strata_nft",
          seamless: { next: "POST /publish; world blocks via token /world/block" },
        });
      }

      if (path === "/publish" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const id = body.id || body.sandbox_id;
        if (!id) return j({ error: "id required" }, 400);
        const sb = await db.prepare("SELECT * FROM sandboxes WHERE id = ?").bind(id).first();
        if (!sb) return j({ error: "not_found", id }, 404);
        const now = new Date().toISOString();
        await db
          .prepare("UPDATE sandboxes SET status = ?, published_at = ?, updated_at = ?, content_json = COALESCE(?, content_json) WHERE id = ?")
          .bind("published", now, now, body.content ? JSON.stringify(body.content) : null, id)
          .run();
        return j({
          success: true,
          id,
          status: "published",
          parent_world_id: sb.parent_world_id,
          event: "sandbox.publish",
          holon_event: await (async () => {
            try {
              const payload = { de: "ugc_sandbox", evento: "sandbox.publish", para: "open_world", carga: body };
              let hr;
              hr = await fetch("https://stratamesh-holons.stratamesh.workers.dev/emitir", {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
              });
              const tx = await hr.text();
              try { return JSON.parse(tx); } catch { return { aceite: hr.ok, http: hr.status }; }
            } catch (e) { return { aceite: false, erro: String(e.message || e).slice(0, 80) }; }
          })(),

          holon_flow: "ugc_sandbox → open_world portion",
          seamless: { notify_world: "world may attach or already attached" },
        });
      }

      if (path === "/integrate" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const id = body.id || body.sandbox_id;
        if (!id) return j({ error: "id required" }, 400);
        const sb = await db.prepare("SELECT * FROM sandboxes WHERE id = ?").bind(id).first();
        if (!sb) return j({ error: "not_found", id }, 404);
        if (sb.status !== "published" && !body.force) {
          return j({ error: "must_publish_first", status: sb.status }, 409);
        }
        await db
          .prepare("UPDATE sandboxes SET status = ?, updated_at = ? WHERE id = ?")
          .bind("integrated", new Date().toISOString(), id)
          .run();
        return j({
          success: true,
          id,
          status: "integrated",
          parent_world_id: sb.parent_world_id,
          event: "sandbox.integrate",
          holon_flow: "sandbox content becomes world portion",
        });
      }

      if (path === "/describe") {
        return j({
          holon: HOLON,
          depth: {
            isolation: "authoring cell until publish",
            lifecycle: "isolated → published → integrated",
            agency: "agents edit inside sandbox under owner_id",
          },
          seamless: {
            up: "parent_world_id + worlds.attach-sandbox",
            down: "agent inhabitance and edits",
          },
        });
      }

      return j(
        {
          error: "not found",
          holon: HOLON,
          endpoints: ["/health", "/contract", "/list", "/get", "/create", "/publish", "/integrate", "/describe"],
        },
        404
      );
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
