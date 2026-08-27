/**
 * Metabolic stasis — isomorphic (Workers + browser + Node).
 * hourly_cap = remaining / hours_until_renewal
 * spendable  = remaining - reserved_future_peaks
 * No 6th Cloudflare cron. Identity ≠ cargo.
 */
export const ALLOW = "ALLOW";
export const HOLD = "HOLD";
export const STASIS = "STASIS";
export const P0_BORROW = "P0_BORROW";

const DEFAULT_TZ = "Europe/Lisbon";

export function parseHhmm(hhmm) {
  const [h, m] = String(hhmm).split(":").map((n) => parseInt(n, 10));
  return { h, m };
}

export function zonedParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: +parts.year,
    month: +parts.month,
    day: +parts.day,
    hour: +parts.hour,
    minute: +parts.minute,
    second: +parts.second,
  };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

/** Approximate timezone offset by comparing UTC ms of local wall time. */
function tzOffsetMs(wall, timeZone) {
  const utcGuess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  const asTz = zonedParts(new Date(utcGuess), timeZone);
  const asTzUtc = Date.UTC(asTz.year, asTz.month - 1, asTz.day, asTz.hour, asTz.minute, asTz.second);
  return utcGuess - asTzUtc;
}

export function hoursUntilRenewal(now, renewalHHmm = "00:00", timeZone = DEFAULT_TZ) {
  const local = zonedParts(now, timeZone);
  const { h, m } = parseHhmm(renewalHHmm);
  let cand = { ...local, hour: h, minute: m, second: 0 };
  const localMin = local.hour * 60 + local.minute;
  const candMin = h * 60 + m;
  if (candMin <= localMin) {
    const dt = new Date(Date.UTC(local.year, local.month - 1, local.day) + 86400000);
    const next = zonedParts(dt, timeZone);
    cand = { year: next.year, month: next.month, day: next.day, hour: h, minute: m, second: 0 };
  }
  const nowMs = now.getTime();
  const candUtc = Date.UTC(cand.year, cand.month - 1, cand.day, cand.hour, cand.minute, 0) - tzOffsetMs(cand, timeZone);
  const hours = (candUtc - nowMs) / 3600000;
  return Math.max(hours, 1 / 60);
}

export function hoursUntilUnix(now, resetUnix) {
  return Math.max((resetUnix * 1000 - now.getTime()) / 3600000, 1 / 60);
}

function minutesOf(parts) {
  return parts.hour * 60 + parts.minute;
}

function hhmmMinutes(hhmm) {
  const { h, m } = parseHhmm(hhmm);
  return h * 60 + m;
}

export function isNight(now, spec = {}, timeZone = DEFAULT_TZ) {
  const tz = spec.renewal_tz || timeZone;
  const parts = zonedParts(now, tz);
  const start = hhmmMinutes(spec.night_start || "22:00");
  const end = hhmmMinutes(spec.night_end || "08:00");
  const m = minutesOf(parts);
  if (start > end) return m >= start || m < end;
  return m >= start && m < end;
}

export function slotsAhead(cfg, now, rail, excludeId) {
  const tz = cfg.timezone || DEFAULT_TZ;
  const nowM = minutesOf(zonedParts(now, tz));
  return (cfg.slots || []).filter((s) => {
    if (s.rail !== rail) return false;
    if (excludeId && s.id === excludeId) return false;
    return hhmmMinutes(s.hhmm) > nowM;
  });
}

export function reservedAhead(cfg, now, rail, excludeId) {
  return slotsAhead(cfg, now, rail, excludeId).reduce((a, s) => a + (s.cost || 1), 0);
}

export function estimatedSpentSlots(cfg, now, rail, graceMin = 20) {
  const tz = cfg.timezone || DEFAULT_TZ;
  const nowM = minutesOf(zonedParts(now, tz));
  let spent = 0;
  for (const s of cfg.slots || []) {
    if (s.rail !== rail) continue;
    if (nowM >= hhmmMinutes(s.hhmm) + graceMin) spent += s.cost || 1;
  }
  return spent;
}

export function decide(rail, opts = {}) {
  const cfg = opts.cfg;
  const spec = (cfg.rails || {})[rail] || {};
  const now = opts.now || new Date();
  const cost = opts.cost == null ? 1 : opts.cost;
  const isPeak = !!opts.isPeak;
  const isP0 = !!opts.isP0;
  const slotId = opts.slotId || null;
  const layer = spec.layer || "";
  const kind = spec.kind || "rate";
  const tz = spec.renewal_tz || cfg.timezone || DEFAULT_TZ;
  const renewal = spec.renewal_hhmm || "00:00";

  const base = (decision, remaining, hoursLeft, hourlyCap, spendable, reserved, reason) => ({
    decision,
    rail,
    remaining,
    hours_left: hoursLeft,
    hourly_cap: hourlyCap,
    spendable,
    reserved,
    cost,
    reason,
    layer,
    is_peak: isPeak,
    is_p0: isP0,
  });

  if (spec.hard_cap === 0) {
    return base(STASIS, 0, 0, 0, 0, 0, spec.note || "rail forbidden");
  }
  if (kind === "hard") {
    const cap = spec.hard_cap || spec.limit || 0;
    const rem = opts.remaining == null ? cap : opts.remaining;
    if (rem <= 0) return base(STASIS, rem, 0, 0, 0, 0, `hard cap ${cap} reached`);
    return base(ALLOW, rem, 0, 0, rem, 0, `hard cap ${cap}, remaining ${rem}`);
  }

  let hoursLeft;
  if (opts.resetUnix != null) hoursLeft = hoursUntilUnix(now, opts.resetUnix);
  else if (spec.window === "rolling_hour") hoursLeft = 1;
  else if (spec.window_sec) hoursLeft = Math.max(spec.window_sec / 3600, 1 / 60);
  else hoursLeft = hoursUntilRenewal(now, renewal, tz);
  let remaining = opts.remaining;
  if (remaining == null) {
    remaining = kind === "slots" && spec.daily_limit != null
      ? Math.max(0, spec.daily_limit - estimatedSpentSlots(cfg, now, rail))
      : spec.daily_limit || spec.limit || 0;
  }
  const hourlyCap = hoursLeft ? remaining / hoursLeft : remaining;
  let reserved = 0;
  if (kind === "slots") {
    reserved = reservedAhead(cfg, now, rail, isPeak || slotId ? slotId : null);
  }
  const spendable = remaining - reserved;

  if (remaining <= 0 && !isP0) return base(STASIS, remaining, hoursLeft, hourlyCap, spendable, reserved, "quota exhausted until renewal");
  if (remaining <= 0 && isP0) return base(P0_BORROW, remaining, hoursLeft, hourlyCap, spendable, reserved, "P0 borrows past empty pool — still no retry-loop");

  if (kind === "slots") {
    if (isP0) return base(remaining >= cost ? ALLOW : P0_BORROW, remaining, hoursLeft, hourlyCap, spendable, reserved, "P0 spends even if it trims a later peak");
    if (isPeak || slotId) {
      if (remaining >= cost) return base(ALLOW, remaining, hoursLeft, hourlyCap, spendable, reserved, "budgeted slot / reserved peak");
      return base(STASIS, remaining, hoursLeft, hourlyCap, spendable, reserved, "peak has no remaining");
    }
    if (spendable < cost) return base(HOLD, remaining, hoursLeft, hourlyCap, spendable, reserved, `protect ${reserved} reserved slot(s) still ahead`);
    return base(ALLOW, remaining, hoursLeft, hourlyCap, spendable, reserved, "unscheduled spend within contingency");
  }

  if (remaining < cost) return base(STASIS, remaining, hoursLeft, hourlyCap, remaining, 0, "remaining < cost");
  if (cost > hourlyCap + 1e-9) return base(HOLD, remaining, hoursLeft, hourlyCap, remaining, 0, `cost ${cost} > hourly_cap ${hourlyCap.toFixed(4)} (pace until renewal)`);
  return base(ALLOW, remaining, hoursLeft, hourlyCap, remaining, 0, "within hourly average");
}

export function monitorIntervalSec(now, cfg) {
  const spec = (cfg.rails || {})["local-monitor"] || {};
  const night = spec.night_interval_sec || 900;
  const day = spec.day_interval_sec || 300;
  return isNight(now, spec, cfg.timezone) ? night : day;
}

export function snapshot(cfg, now = new Date(), live = {}) {
  const tz = cfg.timezone || DEFAULT_TZ;
  const parts = zonedParts(now, tz);
  const railsOut = {};
  for (const name of Object.keys(cfg.rails || {})) {
    const extra = live[name] || {};
    const v = decide(name, { cfg, now, remaining: extra.remaining, resetUnix: extra.reset_unix });
    const spec = cfg.rails[name];
    railsOut[name] = {
      ...v,
      spec_note: spec.note,
      kind: spec.kind,
      unit: spec.unit,
      daily_limit: spec.daily_limit || spec.limit || spec.hard_cap,
    };
  }
  const slots = (cfg.slots || []).map((s) => {
    const v = decide(s.rail, {
      cfg,
      now,
      isPeak: !!s.peak,
      slotId: s.id,
      remaining: railsOut[s.rail]?.remaining,
    });
    return { ...s, verdict: v.decision, reason: v.reason };
  });
  return {
    schema: "stratamesh.metabolism.v1",
    at: now.toISOString(),
    lisbon: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`,
    hour_lisbon: parts.hour,
    night: isNight(now, (cfg.rails || {})["local-monitor"], tz),
    monitor_interval_sec: monitorIntervalSec(now, cfg),
    cf_cron_hard_cap: cfg.cf_cron_hard_cap,
    formula: cfg.formula,
    rails: railsOut,
    slots,
    lab_honest: true,
    no_sixth_cron: true,
  };
}
