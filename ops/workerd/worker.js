/**
 * Structural hop: tunnel → this host’s workerd :8788 → this host’s fog :8787
 * /health and /workerd are local (never call fog — avoids single-thread deadlock).
 * ORIGIN binding is this process’s role (session | macbook), not the other host.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" || url.pathname === "/workerd") {
      const origin = env.ORIGIN || "session";
      return Response.json({
        ok: true,
        runtime: "workerd",
        plugin: "fog-workerd",
        origin,
        layer: "tunnel→workerd:8788→fog:8787",
        version: "0.2.3-lab",
        oracle_live: false,
        mesh_member: false,
        substrate: "workerd-hop",
      }, {
        headers: {
          "access-control-allow-origin": "*",
          "cache-control": "no-store",
        },
      });
    }
    return env.FOG.fetch(request);
  },
};
