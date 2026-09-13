/**
 * CF KV Free live metabol helpers (isomorphic).
 * Never invent remaining=1000 without a live UTC-day sample.
 * GraphQL: kvOperationsAdaptiveGroups actionType write|read.
 */
export const KV_WRITE_DAILY = 1000;
export const CF_ACCOUNT_DEFAULT = "f3645fcb56675cf7250d8ba7358eb252";
export const SAMPLE_CACHE_KEY = "fog:metabol:cf-kv-live";
export const SAMPLE_TTL_MS = 5 * 60 * 1000;

export function hoursLeftUtcMidnight(now = new Date()) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max((next - now.getTime()) / 3600000, 1 / 60);
}

/** @param {{ ok: boolean, writes_used?: number, writes_hour?: number, sampled_at?: string, error?: string }|null|undefined} sample */
export function metabolFromLiveSample(origin, sample, opts = {}) {
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

export function parseKvOperationsGroups(dayRows) {
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

export async function sampleCfKvViaGraphql({ token, accountTag, fetchImpl, now }) {
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

export function cfTokenFromEnv(env) {
  if (!env) return "";
  return String(
    env.CLOUDFLARE_API_TOKEN || env.GOD_API || env.CF_API_TOKEN || env.CF_API || ""
  ).trim();
}

export function cfAccountFromEnv(env) {
  if (!env) return CF_ACCOUNT_DEFAULT;
  return String(env.CF_ACCOUNT || env.CF_ACCOUNT_ID || CF_ACCOUNT_DEFAULT).trim();
}
