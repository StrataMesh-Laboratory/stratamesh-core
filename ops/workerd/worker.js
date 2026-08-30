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
      const mac_live = origin === "macbook";
      const n = mac_live ? 2 : 1;
      return Response.json({
        ok: true,
        runtime: "workerd",
        plugin: "fog-workerd",
        origin,
        mac_live,
        trusted: mac_live,
        n,
        mesh_member: n >= 2,
        mesh_provision: mac_live,
        layer: "tunnel→workerd:8788→fog:8787",
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
