/**
 * Structural hop: tunnel → workerd :8788 → FOG :8787
 * /health and /workerd are local (never call fog — avoids single-thread deadlock).
 * All other paths use the FOG capability.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" || url.pathname === "/workerd") {
      return Response.json({
        ok: true,
        runtime: "workerd",
        plugin: "fog-workerd",
        layer: "tunnel→workerd:8788→fog:8787",
        version: "0.2.3-lab",
        node_id: "FOG-NODE-PT-CM-001",
        lab: true,
        n: 1,
        mesh_member: false,
        oracle_live: false,
        substrate: "workerd-hop",
      });
    }
    return env.FOG.fetch(request);
  },
};
