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
        mesh_member: false,
      });
    }
    return env.FOG.fetch(request);
  },
};
