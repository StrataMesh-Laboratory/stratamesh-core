/**
 * Edge hub for Calhegas Morais Fog — indexes child Edge Nodes
 */
const CHILDREN = [
  {
    node_id: "EDGE-NODE-PT-CM-001",
    role: "env_gateway",
    url: "https://stratamesh-edge-cmn-01.stratamesh.workers.dev",
    device_class: "synthetic_iot_environmental_gateway",
  },
  {
    node_id: "EDGE-NODE-PT-CM-002",
    role: "storage_cache",
    url: "https://stratamesh-edge-cmn-02.stratamesh.workers.dev",
    device_class: "synthetic_iot_storage_cache",
  },
];

const j = (d, s = 200) =>
  new Response(JSON.stringify(d, null, 2), {
    status: s,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

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

    if (path === "/health" || path === "/") {
      return j({
        status: "ok",
        service: "stratamesh-edge",
        node_type: "edge_hub",
        parent_fog: "FOG-NODE-PT-CM-001",
        version: "2.1.0-cmn-children",
        children: CHILDREN,
        child_count: CHILDREN.length,
      });
    }

    if (path === "/children" || path === "/edges") {
      const detailed = [];
      for (const c of CHILDREN) {
        try {
          const r = await fetch(c.url + "/health", { signal: AbortSignal.timeout(8000) });
          const body = r.ok ? await r.json() : null;
          detailed.push({ ...c, online: r.ok, health: body });
        } catch (e) {
          detailed.push({ ...c, online: false, error: String(e.message || e) });
        }
      }
      return j({ parent_fog: "FOG-NODE-PT-CM-001", edges: detailed });
    }

    if (path === "/pulse-all" && (request.method === "POST" || request.method === "GET")) {
      const results = [];
      for (const c of CHILDREN) {
        try {
          const r = await fetch(c.url + "/heartbeat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: "hub_pulse_all" }),
            signal: AbortSignal.timeout(25000),
          });
          const body = await r.json().catch(() => ({}));
          results.push({ node_id: c.node_id, ok: r.ok, contributions: body.contributions });
        } catch (e) {
          results.push({ node_id: c.node_id, ok: false, error: String(e.message || e) });
        }
      }
      return j({ parent_fog: "FOG-NODE-PT-CM-001", pulsed: results });
    }

    // proxy to child by id
    const m = path.match(/^\/edge\/(EDGE-NODE-PT-CM-00[12])(\/.*)?$/);
    if (m) {
      const child = CHILDREN.find((c) => c.node_id === m[1]);
      if (!child) return j({ error: "unknown_edge" }, 404);
      const sub = m[2] || "/health";
      const r = await fetch(child.url + sub, {
        method: request.method,
        headers: request.headers,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      });
      return new Response(await r.arrayBuffer(), {
        status: r.status,
        headers: { "Content-Type": r.headers.get("Content-Type") || "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    return j({ error: "not_found", endpoints: ["/health", "/children", "/pulse-all", "/edge/:id/*"] }, 404);
  },
};
