/**
 * StrataMesh Calhegas Morais Edge Node
 * Real Worker isolate = synthetic IoT edge substrate of FOG-NODE-PT-CM-001
 *
 * Not a mock UI: each deploy is a separate Worker (separate process space on CF).
 * Capacity is contributed to the mesh pool via PoC service binding.
 * Telemetry is deterministic from wall-clock + node seed (same pattern as firmware
 * polling sensors — here the "sensors" are isolate uptime, scheduled ticks, and state).
 *
 * Bindings expected:
 *   NODE_ID (text)     e.g. EDGE-NODE-PT-CM-001
 *   EDGE_ROLE (text)   e.g. env_gateway | storage_cache
 *   PARENT_FOG (text)  FOG-NODE-PT-CM-001
 *   POC (service)      stratamesh-poc
 *   DAG (service)      stratamesh-dag (optional)
 *   EDGE_KV (kv)       optional durable last_state
 */

const VERSION = "1.0.0-cmn-edge";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

function cfg(env) {
  const node_id = (env.NODE_ID || "EDGE-NODE-PT-CM-UNSET").trim();
  const role = (env.EDGE_ROLE || "generic_iot").trim();
  const parent = (env.PARENT_FOG || "FOG-NODE-PT-CM-001").trim();
  return { node_id, role, parent };
}

/** Deterministic synthetic telemetry from time + node id (stable, reproducible). */
function telemetry(node_id, role, nowMs = Date.now()) {
  const seed = [...node_id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const t = nowMs / 1000;
  const wave = (period, phase) => Math.sin((2 * Math.PI * t) / period + phase + seed * 0.01);

  if (role === "env_gateway") {
    return {
      device_class: "synthetic_iot_environmental_gateway",
      sensors: {
        temperature_c: Number((18 + 6 * wave(3600, 0.2)).toFixed(2)),
        humidity_pct: Number((45 + 20 * wave(4200, 1.1)).toFixed(1)),
        rssi_dbm: Math.round(-55 + 8 * wave(900, 0.4)),
      },
      link: { up: true, protocol: "worker-isolate", qos: "lab" },
      resource_profile: {
        bandwidth: { units: 2.5 + 0.5 * Math.abs(wave(1800, 0)), class: "bandwidth" },
        availability: { units: 1.0, class: "availability" },
      },
    };
  }

  // storage_cache default second edge
  return {
    device_class: "synthetic_iot_storage_cache",
    sensors: {
      cache_fill_pct: Number((35 + 25 * Math.abs(wave(7200, 0.7))).toFixed(1)),
      retrieval_latency_ms: Math.round(12 + 8 * Math.abs(wave(600, 0.3))),
      objects_held: Math.floor(40 + 30 * Math.abs(wave(5400, 1.4))),
    },
    link: { up: true, protocol: "worker-isolate", qos: "lab" },
    resource_profile: {
      storage: { units: 3.0 + 1.0 * Math.abs(wave(3600, 0.5)), class: "storage" },
      compute: { units: 0.5 + 0.2 * Math.abs(wave(1200, 0.9)), class: "compute" },
    },
  };
}

async function kvGet(env, key) {
  if (!env.EDGE_KV) return null;
  try {
    const v = await env.EDGE_KV.get(key);
    return v ? JSON.parse(v) : null;
  } catch (_) {
    return null;
  }
}

async function kvPut(env, key, obj) {
  if (!env.EDGE_KV) return false;
  try {
    await env.EDGE_KV.put(key, JSON.stringify(obj), { expirationTtl: 60 * 60 * 24 * 30 });
    return true;
  } catch (_) {
    return false;
  }
}

async function callService(env, name, path, init = {}) {
  const b = env[name];
  if (!b || typeof b.fetch !== "function") {
    // public fallback
    const map = {
      POC: "https://stratamesh-poc.stratamesh.workers.dev",
      DAG: "https://stratamesh-dag.stratamesh.workers.dev",
    };
    const base = map[name];
    if (!base) return { ok: false, error: "no_binding_" + name };
    const r = await fetch(base + path, init);
    const text = await r.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch (_) {
      body = { raw: text.slice(0, 200) };
    }
    return { ok: r.ok, status: r.status, body };
  }
  const r = await b.fetch(new Request("https://binding.internal" + path, init));
  const text = await r.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch (_) {
    body = { raw: text.slice(0, 200) };
  }
  return { ok: r.ok, status: r.status, body };
}

/**
 * Heartbeat: publish telemetry + contribute resource capacity to mesh pool.
 * Units are real writes to PoC mesh_resource_pool (not display-only).
 */
async function heartbeat(env, reason = "manual") {
  const { node_id, role, parent } = cfg(env);
  const now = new Date().toISOString();
  const tel = telemetry(node_id, role);
  const profile = tel.resource_profile || {};
  const contributions = [];

  for (const key of Object.keys(profile)) {
    const item = profile[key];
    if (!item || !item.class) continue;
    const units = Math.max(0.01, Number(item.units) || 0);
    // Contribute a small slice per tick so free-tier stays safe
    const slice = Number((units * 0.1).toFixed(4));
    const res = await callService(env, "POC", "/pool/contribute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource_class: item.class,
        units: slice,
        node_id,
        meta: {
          edge_role: role,
          parent_fog: parent,
          reason,
          device_class: tel.device_class,
          telemetry_sample: tel.sensors,
        },
      }),
    });
    contributions.push({
      resource_class: item.class,
      units: slice,
      ok: res.ok,
      result: res.body,
    });
  }

  // Optional DAG edge pulse (lightweight)
  let dag = null;
  try {
    dag = await callService(env, "DAG", "/attach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: {
          type: "edge_heartbeat",
          node_id,
          parent_fog: parent,
          role,
          reason,
          at: now,
          sensors: tel.sensors,
        },
        node_id,
        vertex_type: "edge_heartbeat",
      }),
    });
  } catch (_) {
    dag = { ok: false };
  }

  const state = {
    node_id,
    role,
    parent_fog: parent,
    version: VERSION,
    last_heartbeat: now,
    reason,
    telemetry: tel,
    contributions,
    dag: dag && dag.ok ? { ok: true, body: dag.body } : { ok: false, body: dag && dag.body },
    substrate: {
      kind: "cloudflare_worker_isolate",
      note: "Synthetic IoT edge: isolate is the physical process; sensors are derived drivers over time+state",
    },
  };

  await kvPut(env, "last_state:" + node_id, state);
  await kvPut(env, "last_heartbeat:" + node_id, { at: now, reason });
  return state;
}

async function identity(env) {
  const { node_id, role, parent } = cfg(env);
  const last = await kvGet(env, "last_state:" + node_id);
  return {
    status: "ok",
    service: "stratamesh-edge-node",
    version: VERSION,
    node_type: "edge",
    node_id,
    edge_role: role,
    parent_fog: parent,
    fog_name: "Calhegas Morais",
    mesh: "stratamesh",
    last_heartbeat: last && last.last_heartbeat,
    endpoints: ["/health", "/identity", "/telemetry", "/heartbeat", "/status", "/contribute"],
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    try {
      if (path === "/health" || path === "/" || path === "/identity") {
        return json(await identity(env));
      }

      if (path === "/telemetry") {
        const { node_id, role, parent } = cfg(env);
        return json({
          node_id,
          parent_fog: parent,
          role,
          at: new Date().toISOString(),
          telemetry: telemetry(node_id, role),
        });
      }

      if (path === "/status") {
        const { node_id } = cfg(env);
        const last = await kvGet(env, "last_state:" + node_id);
        const id = await identity(env);
        return json({ ...id, last_state: last });
      }

      if ((path === "/heartbeat" || path === "/pulse" || path === "/contribute") && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const state = await heartbeat(env, body.reason || path.slice(1));
        return json({ success: true, ...state });
      }

      if (path === "/heartbeat" && request.method === "GET") {
        // GET allowed for lab triggers / cron-like external pokes
        const state = await heartbeat(env, "get_trigger");
        return json({ success: true, ...state });
      }

      return json({ error: "not_found", path, version: VERSION }, 404);
    } catch (e) {
      return json({ error: String(e && e.message ? e.message : e), version: VERSION }, 500);
    }
  },

  /** Cloudflare Cron Trigger — enable in dashboard for always-on edge pulse */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(heartbeat(env, "cron:" + (event.cron || "scheduled")));
  },
};
