/**
 * workerd :8788 — isolate hop + metabol burn.
 * Python :8790 — cap, plugins, fallback, STRATA observe.
 * Node :8791 — parallel compose (/assemble).
 * Public origin stays Fog :8787 via this hop. Never workers.dev.
 */
/**
 * Structural hop: tunnel → this host’s workerd :8788 → this host’s fog :8787
 * /health /workerd /metabol are local (never call fog — avoids single-thread deadlock).
 * ORIGIN binding is this process’s role (session | macbook | edge), not the other host.
 * Metabolic stasis v1.3: hourly_cap × pace_factor. Always-on burn_rate. No night freeze.
 */
const CF_METABOL = "https://status.calhegasmorais.pt/metabol";
const HOPMESH = true; // py/node/deno mutual; do not poll CF metabol on TUI tick

const KV_WRITE_DAILY = 1000;

function hoursLeftUtcMidnight(now = new Date()) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max((next - now.getTime()) / 3600000, 1 / 60);
}

function kvWriteDecision({ daySpent = 0, hourSpent = 0, cost = 1, now = new Date() } = {}) {
  const remaining = Math.max(0, KV_WRITE_DAILY - daySpent);
  const hoursLeft = hoursLeftUtcMidnight(now);
  const hourlyCap = remaining / hoursLeft;
  const elapsed = Math.max(24 - hoursLeft, 1 / 60);
  const timeFrac = elapsed / 24;
  const spentFrac = daySpent <= 0 ? 0 : daySpent / KV_WRITE_DAILY;
  const pace = spentFrac === 0 ? 1 : Math.min(1.5, Math.max(0.5, timeFrac / spentFrac));
  const adjusted = hourlyCap * pace;
  const burn_rate = adjusted;
  let decision = "ALLOW";
  let reason = "kv burn within paced range";
  if (remaining < cost) { decision = "STASIS"; reason = "remaining < cost"; }
  else if (hourSpent >= hourlyCap * 2) { decision = "STASIS"; reason = "hour_spent >= 2x hourly_cap"; }
  else if (hourSpent >= hourlyCap * 1.25) { decision = "HOLD"; reason = "hour_spent >= 1.25x hourly_cap"; }
  else if (hourSpent + cost > adjusted && hourSpent + cost > hourlyCap) {
    decision = "HOLD"; reason = "this write would exceed paced cap";
  }
  return { decision, reason, hourlyCap, adjusted, pace, remaining, hoursLeft, burn_rate, daySpent, hourSpent, cost };
}

function meter() {
  const m = globalThis.__fogMetabol || (globalThis.__fogMetabol = { day: 0, hour: 0, hourKey: "", ticks: 0 });
  const hk = new Date().toISOString().slice(0, 13);
  if (m.hourKey !== hk) { m.hourKey = hk; m.hour = 0; }
  return m;
}

function localSnap(extra = {}) {
  const m = meter();
  const v = kvWriteDecision({ daySpent: m.day, hourSpent: m.hour, cost: extra.cost || 0 });
  return {
    ok: true,
    circuit: "metabol-v1.3",
    formula: "hourly_cap=remaining/hours_left ; pace=clamp(time_frac/spent_frac,0.5,1.5) ; burn_rate=hourly_cap*pace",
    night_freeze: false,
    ...v,
    ticks: m.ticks,
    ...extra,
  };
}

async function pullCf(origin) {
  if (HOPMESH) return { ok: true, skipped: "local-mw", origin: origin || "" };
  try {
    const r = await fetch(CF_METABOL + "?source=workerd&origin=" + encodeURIComponent(origin || ""), {
      headers: { "user-agent": "stratamesh-workerd-metabol/1", "x-fog-origin": origin || "" },
    });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, ...j };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = env.ORIGIN || "session";
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "Content-Type, X-Fog-Origin, X-Fog-Node",
      "cache-control": "no-store",
      "content-type": "application/json",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    // GET /health is hop-live proof — do not chain it.
    const pth = url.pathname;
    const healthPath = pth === "/health" || pth === "/workerd" || pth.endsWith("/health");
    if (HOPMESH && !healthPath && !request.headers.get("x-fog-chain")) {
      const dead = globalThis.__hopDead || (globalThis.__hopDead = Object.create(null));
      const now = Date.now();
      let slots = [];
      if (pth.startsWith("/api") || pth.startsWith("/auth") || pth === "/login" || pth === "/me") {
        slots = ["http://127.0.0.1:8790", "http://127.0.0.1:8791", "http://127.0.0.1:8792"]; // auth: py node deno; workerd skipped (proxy only, no session store)
      } else if (pth.startsWith("/object") || pth.startsWith("/mail") || pth.startsWith("/resolve")) {
        slots = ["http://127.0.0.1:8792", "http://127.0.0.1:8790", "http://127.0.0.1:8791"]; // object: deno py node; workerd skipped (no object/mail handlers)
      } else if (pth.startsWith("/assemble") || pth.startsWith("/mw") || pth.startsWith("/desk")) {
        slots = ["http://127.0.0.1:8791", "http://127.0.0.1:8790", "http://127.0.0.1:8792"]; // compose: node py deno; workerd thin forward only
      } else if (pth.startsWith("/atelier") || pth.startsWith("/dashboard")) {
        slots = ["http://127.0.0.1:8791", "http://127.0.0.1:8790"]; // html_atelier: node py then this workerd local
      } else if (pth.startsWith("/metabol")) {
        slots = []; // metabol: this workerd is primary; py/node after local miss
      }
      const svc = { "http://127.0.0.1:8790": env.MW_PY, "http://127.0.0.1:8791": env.MW_NODE, "http://127.0.0.1:8792": env.MW_DENO };
      let any = false;
      for (const hop of slots) {
        const k = hop;
        if (dead[k] && now < dead[k]) continue;
        try {
          const ac = new AbortController();
          const to = setTimeout(() => ac.abort(), 400);
          const bound = svc[hop];
          let r;
          if (bound && typeof bound.fetch === "function") r = await bound.fetch(request);
          else r = await fetch(hop + pth + url.search, { method: request.method, headers: { ...Object.fromEntries(request.headers), "x-fog-chain": "1" }, redirect: "manual", signal: ac.signal });
          clearTimeout(to);
          if (r && r.status < 500 && r.status !== 0) return r;
          dead[k] = now + 8000;
          any = true;
        } catch (_) {
          dead[k] = now + 8000;
          any = true;
        }
      }
      // after local handlers miss, layer 5 is applied at the final FOG.fetch skip below for module paths
      globalThis.__hopTried = { pth, slots, any };
    }


    if (url.pathname === "/health" || url.pathname === "/workerd") {
      const mac_live = origin === "macbook";
      const edge_live = origin === "edge";
      // Lab mesh n is FOG_MESH_N (P1 n=2), not ORIGIN. session is a public-origin
      // flag; coupling n/member to origin made /health an outdated alias of P0.
      const n = Math.max(1, Number(env.FOG_MESH_N || 2) || 2);
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
        mesh_provision: n >= 2,
        layer,
        version: "v0.5.1-lab",
        release: "v0.5.1-lab",
        oracle_live: false,
        substrate: "workerd-hop",
        metabol: "/metabol",
        mw: "/mw/health",
        fallback: {
          after_sec: 1800,
          primary: "macbook",
          standby: "session",
          dns: "fog.calhegasmorais.pt CNAME → macbook-server | stratamesh-fog-lab",
        },
      }, { headers: cors });
    }

    if (url.pathname === "/metabol" && request.method === "GET") {
      const local = localSnap({ origin, hop: "workerd:8788" });
      const cf = await pullCf(origin);
      return Response.json({
        ...local,
        cf: {
          ok: !!cf.ok,
          decision: cf.decision || null,
          pace: cf.pace || null,
          burn_rate: cf.burn_rate || cf.adjusted || null,
          remaining: cf.remaining || null,
          error: cf.error || null,
        },
        talk: "tui → :8788/metabol local (HOPMESH; STASIS paces, freeze last)",
      }, { headers: cors });
    }

    if (url.pathname === "/metabol/consume" && request.method === "POST") {
      let body = {};
      try { body = await request.json(); } catch (_) {}
      const cost = Math.max(0, Number(body.cost || 1));
      const m = meter();
      const before = kvWriteDecision({ daySpent: m.day, hourSpent: m.hour, cost });
      if (before.decision === "ALLOW") {
        m.day += cost;
        m.hour += cost;
        m.ticks += 1;
      }
      const after = localSnap({ origin, cost, accepted: before.decision === "ALLOW" });
      let cf = { ok: true, skipped: "local-mw" };
      if (HOPMESH) { return Response.json({ ...after, cf }, { headers: cors }); }
      try {
        const r = await fetch(CF_METABOL + "/consume", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-fog-origin": origin,
            "x-fog-node": String(body.node_id || "FOG-NODE-PT-CM-001"),
            "user-agent": "stratamesh-workerd-metabol/1",
          },
          body: JSON.stringify({
            origin,
            node_id: body.node_id || "FOG-NODE-PT-CM-001",
            cost,
            persist: false,
            local: after,
          }),
        });
        cf = await r.json().catch(() => ({ ok: r.ok }));
        cf.ok = r.ok;
      } catch (e) {
        cf = { ok: false, error: String(e && e.message || e) };
      }
      return Response.json({ ...after, cf }, { headers: cors });
    }


    if (url.pathname === "/mw" || url.pathname === "/mw/health") {
      async function probe(svc, fallback) {
        try {
          if (svc && typeof svc.fetch === "function") {
            const r = await svc.fetch("http://mw/health");
            return await r.json();
          }
        } catch (_) {}
        try {
          const r = await fetch(fallback, { signal: AbortSignal.timeout(800) });
          return await r.json();
        } catch (e) {
          return { ok: false, error: String(e && e.message || e) };
        }
      }
      const [py, node, deno] = await Promise.all([
        probe(env.MW_PY, "http://127.0.0.1:8790/health"),
        probe(env.MW_NODE, "http://127.0.0.1:8791/health"),
        probe(env.MW_DENO, "http://127.0.0.1:8792/health"),
      ]);
      return Response.json({
        ok: !!(py && py.ok) || !!(node && node.ok) || !!(deno && deno.ok),
        role: "middleware-mesh",
        python: py,
        node,
        deno,
        cmn: { n: 2, fog: "FOG-NODE-PT-CM-001", edge: "EDGE-GROK-CMN-001" },
      }, { headers: cors });
    }
    if (url.pathname.startsWith("/mw/py")) {
      const rest = url.pathname.slice("/mw/py".length) || "/health";
      try {
        if (env.MW_PY) return env.MW_PY.fetch(new URL(rest, "http://mw/").toString());
        return fetch("http://127.0.0.1:8790" + (rest === "/" ? "/health" : rest));
      } catch (e) {
        return Response.json({ ok: false, error: String(e && e.message || e) }, { status: 502, headers: cors });
      }
    }
    if (url.pathname.startsWith("/mw/node")) {
      const rest = url.pathname.slice("/mw/node".length) || "/health";
      try {
        if (env.MW_NODE) return env.MW_NODE.fetch(new URL(rest, "http://mw/").toString());
        return fetch("http://127.0.0.1:8791" + (rest === "/" ? "/health" : rest));
      } catch (e) {
        return Response.json({ ok: false, error: String(e && e.message || e) }, { status: 502, headers: cors });
      }
    }


    if (url.pathname === "/fallback" || url.pathname === "/mw/fallback") {
      let fog = {};
      try { fog = await env.FOG.fetch("http://fog/mw"); fog = await fog.json(); } catch (_) {}
      return Response.json({
        ok: true,
        after_sec: 1800,
        primary: "macbook",
        standby: "edge+session",
        flip_fog_dns: false,
        note: "EDGE keeps :8788/:8789/mw; Fog DNS only if session persist sees mac dark >= 30min",
        fog_mw: fog,
      }, { headers: cors });
    }
    if (url.pathname === "/assemble" || url.pathname === "/mw/assemble") {
      let node = null;
      try {
        if (env.MW_NODE) {
          const r = await env.MW_NODE.fetch("http://mw/assemble");
          node = await r.json();
        }
      } catch (e) {
        node = { ok: false, error: String(e && e.message || e) };
      }
      return Response.json({
        ok: true,
        via: "workerd:8788",
        release: "v0.5.1-lab",
        origin: env.ORIGIN || "session",
        node,
        note: "compose body is Node :8791; this hop only forwards via MW_NODE binding",
      }, { headers: cors });
    }

    if (url.pathname === "/atelier" || url.pathname.startsWith("/atelier/")
        || url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/")
        || url.pathname === "/desk") {
      try {
        if (env.MW_NODE) {
          const rest = url.pathname.startsWith("/dashboard") ? "/dashboard" : (url.pathname.startsWith("/desk") ? "/dashboard" : "/atelier");
          return env.MW_NODE.fetch("http://mw" + rest);
        }
      } catch (e) {
        /* try-next: python then maintenance */
      }
    }
    if (pth.startsWith("/api") || pth.startsWith("/auth") || pth.startsWith("/object") || pth.startsWith("/mail") || pth.startsWith("/assemble") || pth.startsWith("/atelier") || pth.startsWith("/metabol")) {
      const rest = [];
      if (pth.startsWith("/metabol")) rest.push("http://127.0.0.1:8790", "http://127.0.0.1:8791");
      if (pth.startsWith("/atelier") || pth.startsWith("/dashboard")) rest.push("http://127.0.0.1:8792");
      for (const hop of rest) {
        try {
          const r = await fetch(hop + pth + url.search, { method: request.method, headers: { "x-fog-chain": "1" }, signal: AbortSignal.timeout(400) });
          if (r && r.status < 500) return r;
        } catch (_) {}
      }
      return new Response(
        "<!DOCTYPE html><html lang=\"pt-PT\"><head><meta charset=utf-8><title>Nó em stasis</title></head><body><p>MW hops down. Never workers.dev.</p></body></html>",
        { status: 200, headers: { ...cors, "content-type": "text/html; charset=utf-8", "x-fog-hold": "maintenance" } }
      );
    }
    return env.FOG.fetch(request);
  },
};
