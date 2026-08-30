/**
 * Fog-supervised workerd. Lab n=1.
 * FOG is a capability binding to :8787 (not unrestricted loopback fetch).
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" || url.pathname === "/workerd") {
      return Response.json({
        ok: true,
        runtime: "workerd",
        plugin: "fog-workerd",
        fog: "binding:FOG",
        mesh_member: false,
      });
    }
    return env.FOG.fetch(request);
  },
};
