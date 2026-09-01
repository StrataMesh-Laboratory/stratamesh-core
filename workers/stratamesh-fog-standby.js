/**
 * Fog never-dark guard.
 * Probe Mac named-tunnel, then Edge. After 1800s with both down, answer as origin=cf-standby.
 * Does not PATCH DNS. Does not steal macbook-server / stratamesh-fog-lab connectors.
 * Metabolic stasis deflates to 0.5x while origin=cf-standby (Workers burn).
 */
const MAC_TUNNEL = "https://d1323a93-21e4-4ea2-bce8-8b74eece2e13.cfargotunnel.com";
const EDGE = "https://edge.calhegasmorais.pt";
const AFTER = 1800;
const KV_KEY = "fog:origin:lease";

function hoursLeftUtcMidnight(now = new Date()) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max((next - now.getTime()) / 3600000, 1 / 60);
}

function metabolFor(origin, daySpent = 0) {
  const remaining = Math.max(0, 1000 - daySpent);
  const hoursLeft = hoursLeftUtcMidnight();
  const hourlyCap = remaining / hoursLeft;
  const elapsed = Math.max(24 - hoursLeft, 1 / 60);
  const spentFrac = daySpent <= 0 ? 0 : daySpent / 1000;
  const timeFrac = elapsed / 24;
  let pace = spentFrac === 0 ? 1 : Math.min(1.5, Math.max(0.5, timeFrac / spentFrac));
  if (origin === "cf-standby") pace = Math.min(pace, 0.5);
  else if (origin === "edge-standby") pace = Math.min(pace, 0.85);
  const burn_rate = hourlyCap * pace;
  return {
    circuit: "metabol-v1.3",
    night_freeze: false,
    origin,
    state_change: origin !== "macbook",
    decision: remaining > 0 ? "ALLOW" : "STASIS",
    pace,
    hourlyCap,
    burn_rate,
    remaining,
    hoursLeft,
    reason: origin === "cf-standby"
      ? "cf-standby: pace deflated 0.5 — Workers burn"
      : origin === "edge-standby"
        ? "edge-standby: pace 0.85"
        : "macbook primary",
  };
}

function cors() {
  return {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
  };
}

async function probe(url) {
  try {
    const r = await fetch(url, {
      headers: { "user-agent": "stratamesh-fog-standby/1" },
      redirect: "manual",
    });
    const text = await r.text();
    let json = {};
    try { json = JSON.parse(text); } catch (_) {}
    const ok = r.ok && (json.ok === true || json.status === "operational" || json.origin);
    return { ok, status: r.status, json, origin: json.origin || null };
  } catch (e) {
    return { ok: false, status: 0, json: {}, origin: null, error: String(e && e.message || e) };
  }
}

async function readLease(env) {
  if (!env.ORIGIN_KV) return {};
  try {
    return JSON.parse((await env.ORIGIN_KV.get(KV_KEY)) || "{}") || {};
  } catch (_) {
    return {};
  }
}

async function writeLease(env, lease) {
  if (!env.ORIGIN_KV) return;
  const dec = metabolFor(lease.origin || "cf-standby", lease.kv_day || 0);
  if (dec.decision !== "ALLOW") return;
  lease.kv_day = (lease.kv_day || 0) + 1;
  lease.metabol = dec;
  await env.ORIGIN_KV.put(KV_KEY, JSON.stringify(lease), { expirationTtl: 86400 * 7 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors() });

    const now = Date.now();
    const lease = await readLease(env);
    // Probe tunnel paths that this worker does NOT own — avoids a fetch loop on /health.
    const mac = await probe("https://fog.calhegasmorais.pt/workerd");
    const mac2 = mac.ok ? mac : await probe(MAC_TUNNEL + "/health");
    const edge = await probe(EDGE + "/health");
    const macOk = (mac.ok && (mac.origin === "macbook" || mac.json.mac_live === true || mac.json.ok === true))
      || (mac2.ok && (mac2.origin === "macbook" || mac2.json.ok === true));
    const macUnknown = !macOk && !!(mac.error || mac2.error) && (mac.status === 0 && mac2.status === 0);


    let origin = "dark";
    if (macOk) {
      origin = "macbook";
      lease.mac_last_ok = new Date(now).toISOString();
      lease.mac_down_since = null;
    } else if (macUnknown) {
      origin = "macbook";
    } else {
      lease.mac_down_since = lease.mac_down_since || new Date(now).toISOString();
    }
    const downSec = lease.mac_down_since ? Math.max(0, (now - Date.parse(lease.mac_down_since)) / 1000) : 0;
    const due = downSec >= AFTER;

    if (origin !== "macbook" && due && edge.ok) origin = "edge-standby";
    else if (origin !== "macbook" && due) origin = "cf-standby";
    else if (origin !== "macbook") origin = "waiting";

    const prev = lease.origin || "macbook";
    lease.origin = origin === "waiting" ? "macbook-dark" : origin;
    lease.updated = new Date(now).toISOString();
    lease.fallback_after_sec = AFTER;
    lease.down_sec = Math.round(downSec);
    lease.edge_ok = !!edge.ok;
    lease.mac_ok = !!macOk;
    lease.state_change = prev !== lease.origin;
    const meta = metabolFor(origin === "waiting" ? "macbook" : origin, lease.kv_day || 0);
    if (lease.state_change) await writeLease(env, lease);

    if (url.pathname === "/metabol" || url.pathname.startsWith("/metabol/")) {
      return Response.json({ ok: true, ...meta, lease }, { headers: cors() });
    }

    if (origin === "macbook" && macOk) {
      const src = mac.ok ? mac.json : mac2.json;
      if (url.pathname === "/health" || url.pathname === "/health/") {
        return Response.json({ ...src, metabol: meta, standby: false }, { headers: cors() });
      }
      const up = await probe(MAC_TUNNEL + url.pathname);
      if (up.ok) return Response.json({ ...up.json, metabol: meta, standby: false }, { headers: cors() });
    }

    if (origin === "edge-standby" && edge.ok) {
      return Response.json({
        ok: true,
        runtime: "edge-standby",
        plugin: "edge-grok",
        origin: "edge",
        fallback_of: "fog",
        mac_live: false,
        edge_live: true,
        trusted: true,
        n: 2,
        mesh_member: true,
        oracle_live: false,
        version: "0.3.1",
        layer: "cf-worker→edge.calhegasmorais.pt",
        metabol: meta,
        lease: { down_sec: lease.down_sec, mac_down_since: lease.mac_down_since },
      }, { headers: cors() });
    }

    if (origin === "cf-standby") {
      return Response.json({
        ok: true,
        runtime: "cf-standby",
        plugin: "stratamesh-fog-standby",
        origin: "cf-standby",
        fallback_of: "fog",
        mac_live: false,
        edge_live: false,
        trusted: false,
        n: 2,
        mesh_member: true,
        oracle_live: false,
        version: "0.3.1",
        layer: "Internet→CF Worker standby",
        status: url.pathname.indexOf("status") >= 0 ? "degraded-standby" : undefined,
        node_id: "FOG-NODE-PT-CM-001",
        note: "Mac down >=30min and Edge not up. CF holds /health /status /metabol only. Named tunnels untouched.",
        metabol: meta,
        lease: { down_sec: lease.down_sec, mac_down_since: lease.mac_down_since },
      }, { headers: cors() });
    }

    return Response.json({
      ok: false,
      origin: "macbook-dark",
      waiting_sec: Math.round(AFTER - downSec),
      fallback_after_sec: AFTER,
      mac_ok: !!macOk,
      edge_ok: !!edge.ok,
      metabol: meta,
      note: "Mac hop dark. CF standby arms at 30 min if Edge is also down.",
    }, { status: 503, headers: { ...cors(), "retry-after": "60" } });
  },
};
