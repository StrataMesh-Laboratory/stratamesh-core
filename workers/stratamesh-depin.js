/**
 * stratamesh-depin — DePIN resource marketplace (Akash / Render parallels)
 *
 * StrataMesh mapping:
 *  - Provider = Fog/Edge node offering residual or installed capacity to the mesh
 *  - Order = demand for a resource class (storage|compute|bandwidth|render) — NOT by function
 *  - Reverse auction: providers bid; tenant accepts → lease + STRATA escrow
 *  - Settlement burns/transfers from escrow to provider (Agora-priced resource units)
 *  - Distinct from PdC mint path: leases consume STRATA; PdC mints from contribution
 */
const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': '*',
};
const VERSION = '1.1.0-sdl-lite';
const RESOURCE_CLASSES = ['storage', 'compute', 'bandwidth', 'render', 'memory'];

function j(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

async function ensureSchema(db) {
  if (!db) return;
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS depin_providers (
      id TEXT PRIMARY KEY, node_id TEXT, capacity TEXT, pricing TEXT, attributes TEXT, created_at TEXT
    )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS depin_orders (
      id TEXT PRIMARY KEY, tenant TEXT, resource_class TEXT, quantity REAL, max_price_strata REAL,
      status TEXT, created_at TEXT, attributes TEXT
    )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS depin_bids (
      id TEXT PRIMARY KEY, order_id TEXT, provider_id TEXT, price_strata_per_unit REAL,
      deposit_strata REAL, status TEXT, created_at TEXT
    )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS depin_leases (
      id TEXT PRIMARY KEY, order_id TEXT, bid_id TEXT, provider_id TEXT, tenant TEXT,
      resource_class TEXT, quantity REAL, price_strata_per_unit REAL, escrow_strata REAL,
      status TEXT, created_at TEXT, settled_at TEXT
    )`
    )
    .run();
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}


function parseSdlLite(sdl) {
  if (!sdl) return null;
  if (typeof sdl === 'object') return sdl;
  const text = String(sdl);
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([a-zA-Z0-9_]+)\s*:\s*(.+?)\s*$/);
    if (!m) continue;
    const k = m[1], v = m[2].replace(/^["']|["']$/g, '');
    if (k === 'resource_class' || k === 'resource') out.resource_class = v.toLowerCase();
    else if (k === 'quantity' || k === 'count') out.quantity = Number(v);
    else if (k === 'max_price_strata' || k === 'max_price') out.max_price_strata = Number(v);
    else if (k === 'tenant') out.tenant = v;
  }
  return Object.keys(out).length ? out : null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname.replace(/\/+$/, '') || '/';
    // strip worker name prefixes if routed under /api/v1/depin
    if (path.startsWith('/api/v1/depin')) path = path.slice('/api/v1/depin'.length) || '/';
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const db = env.AUTH_DB || env.DB || env.LEDGER;
    try {
      await ensureSchema(db);
    } catch (_) {}

    if (path === '/' || path === '/health') {
      return j({
        status: 'ok',
        service: 'stratamesh-depin',
        version: VERSION,
        resource_classes: RESOURCE_CLASSES,
        model: {
          parallel: ['Akash Network reverse auction + escrow', 'Render Network GPU/render capacity'],
          strata_rule: 'Price by resource class only; quality adjusts premium/discount; function never sets rate',
          mint_boundary: 'Leases settle in existing STRATA — they do not mint. Mint remains PdC-only.',
        },
        endpoints: [
          '/health',
          '/providers',
          '/providers/register',
          '/orders',
          '/orders/create',
          '/bids',
          '/bids/create',
          '/leases',
          '/leases/accept',
          '/leases/settle',
        ],
      });
    }

    if (path === '/providers' && request.method === 'GET') {
      if (!db) return j({ providers: [], note: 'no db' });
      const r = await db.prepare(`SELECT * FROM depin_providers ORDER BY created_at DESC LIMIT 50`).all();
      return j({
        providers: (r.results || []).map((p) => ({
          ...p,
          capacity: safeJson(p.capacity),
          pricing: safeJson(p.pricing),
          attributes: safeJson(p.attributes),
        })),
      });
    }

    if (path === '/providers/register' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const pid = body.id || id('prov');
      const row = {
        id: pid,
        node_id: body.node_id || 'FOG-NODE-PT-CM-001',
        capacity: JSON.stringify(body.capacity || { compute: 1, storage: 10, bandwidth: 1, render: 0 }),
        pricing: JSON.stringify(body.pricing || { compute: 0.01, storage: 0.001, bandwidth: 0.002, render: 0.05 }),
        attributes: JSON.stringify(body.attributes || { region: 'PT-Lisboa', tier: 'fog' }),
        created_at: new Date().toISOString(),
      };
      if (db) {
        await db
          .prepare(
            `INSERT OR REPLACE INTO depin_providers (id, node_id, capacity, pricing, attributes, created_at) VALUES (?,?,?,?,?,?)`
          )
          .bind(row.id, row.node_id, row.capacity, row.pricing, row.attributes, row.created_at)
          .run();
      }
      return j({ ok: true, provider: { ...row, capacity: safeJson(row.capacity), pricing: safeJson(row.pricing), attributes: safeJson(row.attributes) } });
    }

    if (path === '/orders' && request.method === 'GET') {
      if (!db) return j({ orders: [] });
      const r = await db.prepare(`SELECT * FROM depin_orders ORDER BY created_at DESC LIMIT 50`).all();
      return j({ orders: r.results || [] });
    }

    if (path === '/orders/create' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const sdl = parseSdlLite(body.sdl || body.manifest || body.deploy);
      if (sdl) {
        if (sdl.resource_class) body.resource_class = sdl.resource_class;
        if (sdl.quantity != null) body.quantity = sdl.quantity;
        if (sdl.max_price_strata != null) body.max_price_strata = sdl.max_price_strata;
        if (sdl.tenant) body.tenant = sdl.tenant;
      }
      const rc = String(body.resource_class || 'compute').toLowerCase();
      if (!RESOURCE_CLASSES.includes(rc)) return j({ error: 'invalid_resource_class', allowed: RESOURCE_CLASSES }, 400);
      const order = {
        id: id('ord'),
        tenant: body.tenant || body.account || 'tenant-lab',
        resource_class: rc,
        quantity: Number(body.quantity || 1),
        max_price_strata: Number(body.max_price_strata || 0.1),
        status: 'open',
        created_at: new Date().toISOString(),
        attributes: JSON.stringify(body.attributes || {}),
      };
      if (db) {
        await db
          .prepare(
            `INSERT INTO depin_orders (id, tenant, resource_class, quantity, max_price_strata, status, created_at, attributes)
             VALUES (?,?,?,?,?,?,?,?)`
          )
          .bind(order.id, order.tenant, order.resource_class, order.quantity, order.max_price_strata, order.status, order.created_at, order.attributes)
          .run();
      }
      return j({ ok: true, order, auction: 'reverse — providers bid at or below max_price_strata' });
    }

    if (path === '/bids' && request.method === 'GET') {
      const orderId = url.searchParams.get('order_id');
      if (!db) return j({ bids: [] });
      const r = orderId
        ? await db.prepare(`SELECT * FROM depin_bids WHERE order_id = ? ORDER BY price_strata_per_unit ASC`).bind(orderId).all()
        : await db.prepare(`SELECT * FROM depin_bids ORDER BY created_at DESC LIMIT 50`).all();
      return j({ bids: r.results || [] });
    }

    if (path === '/bids/create' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!body.order_id || !body.provider_id) return j({ error: 'order_id and provider_id required' }, 400);
      const bid = {
        id: id('bid'),
        order_id: body.order_id,
        provider_id: body.provider_id,
        price_strata_per_unit: Number(body.price_strata_per_unit || 0.01),
        deposit_strata: Number(body.deposit_strata || 0.001),
        status: 'open',
        created_at: new Date().toISOString(),
      };
      if (db) {
        await db
          .prepare(
            `INSERT INTO depin_bids (id, order_id, provider_id, price_strata_per_unit, deposit_strata, status, created_at)
             VALUES (?,?,?,?,?,?,?)`
          )
          .bind(bid.id, bid.order_id, bid.provider_id, bid.price_strata_per_unit, bid.deposit_strata, bid.status, bid.created_at)
          .run();
      }
      return j({ ok: true, bid, note: 'Deposit is lab-accounted; production binds token worker escrow' });
    }

    if (path === '/leases' && request.method === 'GET') {
      if (!db) return j({ leases: [] });
      const r = await db.prepare(`SELECT * FROM depin_leases ORDER BY created_at DESC LIMIT 50`).all();
      return j({ leases: r.results || [] });
    }

    if (path === '/leases/accept' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!db) return j({ error: 'db_unavailable' }, 503);
      const bid = await db.prepare(`SELECT * FROM depin_bids WHERE id = ?`).bind(body.bid_id).first();
      const order = bid ? await db.prepare(`SELECT * FROM depin_orders WHERE id = ?`).bind(bid.order_id).first() : null;
      if (!bid || !order) return j({ error: 'bid_or_order_not_found' }, 404);
      if (order.status !== 'open') return j({ error: 'order_not_open' }, 409);
      const escrow = Number(order.quantity) * Number(bid.price_strata_per_unit);
      const lease = {
        id: id('lease'),
        order_id: order.id,
        bid_id: bid.id,
        provider_id: bid.provider_id,
        tenant: order.tenant,
        resource_class: order.resource_class,
        quantity: order.quantity,
        price_strata_per_unit: bid.price_strata_per_unit,
        escrow_strata: escrow,
        status: 'active',
        created_at: new Date().toISOString(),
        settled_at: null,
      };
      await db
        .prepare(
          `INSERT INTO depin_leases (id, order_id, bid_id, provider_id, tenant, resource_class, quantity, price_strata_per_unit, escrow_strata, status, created_at, settled_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
        )
        .bind(
          lease.id,
          lease.order_id,
          lease.bid_id,
          lease.provider_id,
          lease.tenant,
          lease.resource_class,
          lease.quantity,
          lease.price_strata_per_unit,
          lease.escrow_strata,
          lease.status,
          lease.created_at,
          null
        )
        .run();
      await db.prepare(`UPDATE depin_orders SET status = 'leased' WHERE id = ?`).bind(order.id).run();
      await db.prepare(`UPDATE depin_bids SET status = 'accepted' WHERE id = ?`).bind(bid.id).run();
      return j({
        ok: true,
        lease,
        economics: {
          escrow_strata: escrow,
          parallel: 'Akash deployment escrow → provider withdraw per work unit',
          capital_note: 'Provider recovery of equipment cost is via aggregate STRATA income (Q_C), not per-lease mint',
        },
      });
    }

    if (path === '/leases/settle' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!db) return j({ error: 'db_unavailable' }, 503);
      const lease = await db.prepare(`SELECT * FROM depin_leases WHERE id = ?`).bind(body.lease_id).first();
      if (!lease) return j({ error: 'lease_not_found' }, 404);
      if (lease.status !== 'active') return j({ error: 'lease_not_active', status: lease.status }, 409);
      const settled_at = new Date().toISOString();
      await db.prepare(`UPDATE depin_leases SET status = 'settled', settled_at = ? WHERE id = ?`).bind(settled_at, lease.id).run();
      return j({
        ok: true,
        lease_id: lease.id,
        paid_to_provider_strata: lease.escrow_strata,
        resource_class: lease.resource_class,
        settlement: 'escrow released to provider account (lab book-entry; token worker hook optional)',
        parallel: 'Akash lease settle / Render burn-for-work payout',
      });
    }

    return j({ error: 'Not found', service: 'stratamesh-depin', version: VERSION }, 404);
  },
};

function safeJson(s) {
  try {
    return typeof s === 'string' ? JSON.parse(s) : s;
  } catch {
    return s;
  }
}
