/**
 * Fog never-dark guard.
 * Probe Mac named-tunnel, then Edge. After 1800s with both down, answer as origin=cf-standby.
 * Does not PATCH DNS. Does not steal macbook-server / stratamesh-fog-lab connectors.
 * Metabolic stasis deflates to 0.5x while origin=cf-standby (Workers burn).
 * metabol.remaining comes from live CF KV GraphQL (or HOLD) — never invent remaining=1000.
 */
const MAC_TUNNEL = "https://d1323a93-21e4-4ea2-bce8-8b74eece2e13.cfargotunnel.com";
const EDGE = "https://edge.calhegasmorais.pt";
const AFTER = 1800;
const KV_KEY = "fog:origin:lease";

/**
 * CF KV Free live metabol helpers (isomorphic).
 * Never invent remaining=1000 without a live UTC-day sample.
 * GraphQL: kvOperationsAdaptiveGroups actionType write|read.
 */
const KV_WRITE_DAILY = 1000;
const CF_ACCOUNT_DEFAULT = "f3645fcb56675cf7250d8ba7358eb252";
const SAMPLE_CACHE_KEY = "fog:metabol:cf-kv-live";
const SAMPLE_TTL_MS = 5 * 60 * 1000;

function hoursLeftUtcMidnight(now = new Date()) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max((next - now.getTime()) / 3600000, 1 / 60);
}

/** @param {{ ok: boolean, writes_used?: number, writes_hour?: number, sampled_at?: string, error?: string }|null|undefined} sample */
function metabolFromLiveSample(origin, sample, opts = {}) {
  const hourSpent = Number(opts.hourSpent || 0);
  const hoursLeft = hoursLeftUtcMidnight(opts.now || new Date());
  if (!sample || sample.ok !== true || sample.writes_used == null || !Number.isFinite(Number(sample.writes_used))) {
    return {
      circuit: "metabol-v1.3",
      rail: "cf-kv-writes",
      night_freeze: false,
      origin,
      state_change: origin !== "macbook",
      decision: "HOLD",
      pace: 0,
      hourlyCap: 0,
      burn_rate: 0,
      remaining: 0,
      day_spent: null,
      daySpent: null,
      hoursLeft,
      sample_unknown: true,
      sampled_at: sample && sample.sampled_at || null,
      reason: "no live KV sample — do not invent a cap",
    };
  }
  const daySpent = Math.max(0, Number(sample.writes_used) || 0);
  const remaining = Math.max(0, KV_WRITE_DAILY - daySpent);
  const hourlyCap = remaining / hoursLeft;
  const elapsed = Math.max(24 - hoursLeft, 1 / 60);
  const spentFrac = daySpent <= 0 ? 0 : daySpent / KV_WRITE_DAILY;
  const timeFrac = elapsed / 24;
  let pace = spentFrac === 0 ? 1 : Math.min(1.5, Math.max(0.5, timeFrac / spentFrac));
  if (origin === "cf-standby") pace = Math.min(pace, 0.5);
  else if (origin === "edge-standby") pace = Math.min(pace, 0.85);
  const burn_rate = hourlyCap * pace;
  let decision = "ALLOW";
  let reason = origin === "cf-standby"
    ? "cf-standby: pace deflated 0.5 — Workers burn"
    : origin === "edge-standby"
      ? "edge-standby: pace 0.85"
      : "macbook primary (live CF KV sample)";
  if (remaining <= 0) {
    decision = "STASIS";
    reason = "KV write quota exhausted until UTC midnight";
  } else if (hourSpent >= hourlyCap * 2) {
    decision = "STASIS";
    reason = "circuit STASIS — hour spent ≥ 2× hourly cap";
  } else if (hourSpent >= hourlyCap * 1.25) {
    decision = "HOLD";
    reason = "circuit HOLD — hour spent ≥ 1.25× hourly cap";
  }
  return {
    circuit: "metabol-v1.3",
    rail: "cf-kv-writes",
    night_freeze: false,
    origin,
    state_change: origin !== "macbook",
    decision,
    pace,
    hourlyCap,
    burn_rate,
    remaining,
    day_spent: daySpent,
    daySpent,
    hoursLeft,
    sample_unknown: false,
    sampled_at: sample.sampled_at || null,
    writes_hour: sample.writes_hour != null ? Number(sample.writes_hour) : null,
    reason,
  };
}

function parseKvOperationsGroups(dayRows) {
  let writes = 0;
  let reads = 0;
  for (const row of dayRows || []) {
    const action = String((row.dimensions && row.dimensions.actionType) || "").toLowerCase();
    const n = Number((row.sum && row.sum.requests) || 0);
    if (action === "write") writes += n;
    else if (action === "read" || action === "list") reads += n;
  }
  return { writes_used: writes, reads_used: reads };
}

async function sampleCfKvViaGraphql({ token, accountTag, fetchImpl, now }) {
  const fetchFn = fetchImpl || fetch;
  const acct = accountTag || CF_ACCOUNT_DEFAULT;
  if (!token) return { ok: false, error: "missing CF API token" };
  const utc = now || new Date();
  const dayStart = new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate()));
  const hourStart = new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), utc.getUTCHours()));
  const q = `query ($accountTag: String!, $dayFrom: Time!, $hourFrom: Time!, $to: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      day: kvOperationsAdaptiveGroups(
        limit: 20
        filter: { datetime_geq: $dayFrom, datetime_lt: $to }
      ) { sum { requests } dimensions { actionType } }
      hour: kvOperationsAdaptiveGroups(
        limit: 20
        filter: { datetime_geq: $hourFrom, datetime_lt: $to }
      ) { sum { requests } dimensions { actionType } }
    }
  }
}`;
  const body = {
    query: q,
    variables: {
      accountTag: acct,
      dayFrom: dayStart.toISOString().replace(/\.\d{3}Z$/, "Z"),
      hourFrom: hourStart.toISOString().replace(/\.\d{3}Z$/, "Z"),
      to: utc.toISOString().replace(/\.\d{3}Z$/, "Z"),
    },
  };
  try {
    const r = await fetchFn("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok || (data.errors && data.errors.length)) {
      return { ok: false, error: JSON.stringify((data.errors || [{ message: "http " + r.status }])[0]) };
    }
    const acct0 = (((data.data || {}).viewer || {}).accounts || [])[0] || {};
    const day = parseKvOperationsGroups(acct0.day);
    const hour = parseKvOperationsGroups(acct0.hour);
    return {
      ok: true,
      writes_used: day.writes_used,
      reads_used: day.reads_used,
      writes_hour: hour.writes_used,
      reads_hour: hour.reads_used,
      sampled_at: utc.toISOString(),
      source: "cloudflare-graphql",
    };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

function cfTokenFromEnv(env) {
  if (!env) return "";
  return String(
    env.CLOUDFLARE_API_TOKEN || env.GOD_API || env.CF_API_TOKEN || env.CF_API || ""
  ).trim();
}

function cfAccountFromEnv(env) {
  if (!env) return CF_ACCOUNT_DEFAULT;
  return String(env.CF_ACCOUNT || env.CF_ACCOUNT_ID || CF_ACCOUNT_DEFAULT).trim();
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

async function readCachedSample(env) {
  if (!env.ORIGIN_KV) return null;
  try {
    const raw = await env.ORIGIN_KV.get(SAMPLE_CACHE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j || !j.sampled_at) return null;
    const age = Date.now() - Date.parse(j.sampled_at);
    if (!Number.isFinite(age) || age < 0 || age > SAMPLE_TTL_MS) return null;
    return j;
  } catch (_) {
    return null;
  }
}

async function writeCachedSample(env, sample) {
  if (!env.ORIGIN_KV || !sample || sample.ok !== true) return;
  try {
    await env.ORIGIN_KV.put(SAMPLE_CACHE_KEY, JSON.stringify(sample), { expirationTtl: Math.ceil(SAMPLE_TTL_MS / 1000) + 60 });
  } catch (_) {}
}

async function liveKvSample(env) {
  const cached = await readCachedSample(env);
  if (cached && cached.ok === true) return cached;
  const token = cfTokenFromEnv(env);
  const sample = await sampleCfKvViaGraphql({
    token,
    accountTag: cfAccountFromEnv(env),
  });
  if (sample.ok) await writeCachedSample(env, sample);
  return sample;
}

async function writeLease(env, lease, sample) {
  if (!env.ORIGIN_KV) return;
  const dec = metabolFromLiveSample(lease.origin || "cf-standby", sample, {
    hourSpent: sample && sample.writes_hour || 0,
  });
  if (dec.decision !== "ALLOW") return;
  // lease_writes_today is Worker lease puts — NOT CF account KV burn
  lease.lease_writes_today = (lease.lease_writes_today || lease.kv_day || 0) + 1;
  lease.kv_day = lease.lease_writes_today; // compat
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

    const sample = await liveKvSample(env);
    const metaOrigin = origin === "waiting" ? "macbook" : origin;
    const meta = metabolFromLiveSample(metaOrigin, sample, {
      hourSpent: (sample && sample.writes_hour) || 0,
    });
    if (lease.state_change) await writeLease(env, lease, sample);

    if (url.pathname === "/metabol" || url.pathname.startsWith("/metabol/")) {
      return Response.json({ ok: true, ...meta, lease, sample }, { headers: cors() });
    }

    if (origin === "macbook" && macOk) {
      const src = mac.ok ? mac.json : mac2.json;
      // Prefer Mac/workerd metabol only when it already carries a live sample; else use our live/HOLD meta.
      const macMeta = src && src.metabol;
      const useMac = macMeta && typeof macMeta === "object"
        && macMeta.sample_unknown === false
        && macMeta.day_spent != null;
      const outMeta = useMac ? macMeta : meta;
      if (url.pathname === "/health" || url.pathname === "/health/") {
        return Response.json({ ...src, metabol: outMeta, standby: false }, { headers: cors() });
      }
      const up = await probe(MAC_TUNNEL + url.pathname);
      if (up.ok) return Response.json({ ...up.json, metabol: outMeta, standby: false }, { headers: cors() });
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
