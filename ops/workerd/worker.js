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
      const edge_live = origin === "edge";
      const n = (mac_live || edge_live) ? 2 : 1;
      const layer = edge_live
        ? "tunnel→workerd:8788→edge:8789"
        : "tunnel→workerd:8788→fog:8787";
      return Response.json({
        ok: true,
        runtime: "workerd",
        plugin: edge_live ? "edge-workerd" : "fog-workerd",
        origin,
        mac_live,
        edge_live,
        trusted: mac_live || edge_live,
        n,
        mesh_member: n >= 2,
        mesh_provision: mac_live || edge_live,
        layer,
        fallback: {
          after_sec: 1800,
          primary: "macbook",
          standby: "session",
          dns: "fog.calhegasmorais.pt CNAME → macbook-server | stratamesh-fog-lab",
        },
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
