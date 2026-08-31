/**
 * Metabolic stasis v1.3 — isomorphic (Workers + browser + Node).
 * hourly_cap = remaining / hours_until_renewal
 * pace_factor inflates when under-spent vs elapsed time, deflates when over-spent
 * (neutral 1.0 if day_spent==0). adjusted = hourly_cap * pace_factor
 * density = signal / cost; effective_cap = adjusted * density
 * circuit STASIS if hour_spent ≥ 2× unadjusted cap. Never workers.dev. No 6th cron.
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
  const candUtc = Date.UTC(cand.year, cand.month - 1, cand.day, cand.hour, cand.minute, 0) - tzOffsetMs(cand, timeZone);
  return Math.max((candUtc - now.getTime()) / 3600000, 1 / 60);
}

export function hoursUntilUnix(now, resetUnix) {
  return Math.max((resetUnix * 1000 - now.getTime()) / 3600000, 1 / 60);
}

export function resetIsExpired(resetUnix, now) {
  if (resetUnix == null) return false;
  const n = now || new Date();
  const ru = Number(resetUnix);
  if (!Number.isFinite(ru)) return true;
  return ru * 1000 <= n.getTime();
}

export function resetIsoExpired(resetIso, now) {
  if (!resetIso) return false;
  const n = now || new Date();
  const until = Date.parse(String(resetIso));
  if (Number.isNaN(until)) return true;
  return until <= n.getTime();
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

function hoursLeftFor(spec, now, cfg, resetUnix, resetIso) {
  const tz = spec.renewal_tz || cfg.timezone || DEFAULT_TZ;
  const renewal = spec.renewal_hhmm || "00:00";
  if (resetUnix != null) return hoursUntilUnix(now, resetUnix);
  if (resetIso) {
    const until = Date.parse(resetIso);
    if (!Number.isNaN(until)) return Math.max((until - now.getTime()) / 3600000, 1 / 60);
  }
  if (spec.window === "rolling_hour") return 1;
  if (spec.window_sec) return Math.max(spec.window_sec / 3600, 1 / 60);
  return hoursUntilRenewal(now, renewal, tz);
}

export function phaseKey(now, spec, cfg) {
  const tz = spec.renewal_tz || cfg.timezone || DEFAULT_TZ;
  const p = zonedParts(now, tz);
  const grain = spec.phase || "hour";
  if (grain === "day") return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  if (grain === "minute") return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}`;
}

export function phaseDelta(prev, cur) {
  if (prev === cur) return 0;
  const parse = (k) => {
    if (!k.includes("T")) return Date.parse(k + "T00:00:00Z");
    if ((k.match(/:/g) || []).length === 1 && k.length >= 16) return Date.parse(k + ":00Z");
    return Date.parse(k + ":00:00Z");
  };
  const ms = parse(cur) - parse(prev);
  if (!prev.includes("T")) return Math.max(1, Math.round(ms / 86400000));
  if ((prev.match(/:/g) || []).length === 1 && prev.length >= 16) return Math.max(1, Math.round(ms / 60000));
  return Math.max(1, Math.round(ms / 3600000));
}

function emptyRail() {
  return { phase: null, day: null, carry: 0, daily_debt: 0, daily_credit: 0, phase_spent: 0, day_spent: 0, phase_grant: 0, overdraft_events: 0 };
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

export function paceFactor(daySpent, dailyLimit, hoursLeft, windowHours = 24, lo = 0.5, hi = 1.5) {
  const daily = Number(dailyLimit || 0);
  if (daily <= 0 || Number(daySpent) <= 0) return 1;
  const elapsed = Math.max(Number(windowHours) - Number(hoursLeft), 1 / 60);
  const window = Math.max(Number(windowHours), elapsed);
  const spentFrac = Number(daySpent) / daily;
  const timeFrac = elapsed / window;
  if (spentFrac < 1e-12) return 1;
  return clamp(timeFrac / spentFrac, lo, hi);
}

export function settleRail(ledger, rail, now, remaining, hoursLeft, spec, cfg) {
  const rails = (ledger.rails = ledger.rails || {});
  const st = (rails[rail] = rails[rail] || emptyRail());
  const grant = hoursLeft ? remaining / hoursLeft : remaining;
  const key = phaseKey(now, spec, cfg);
  const persist = spec.debt_persists_across_renewal !== false;
  const od = cfg.overdraft || {};
  const creditCap = grant * (od.credit_cap_hours || 1);
  const daily = spec.daily_limit || spec.limit || 0;
  const overdraftMax = Math.max(daily * (od.overdraft_max_multiplier || 1), grant * 24, 1);
  if (od.enabled === false) {
    st.phase = key;
    st.phase_grant = grant;
    return st;
  }
  if (st.phase == null) {
    st.carry = grant;
    st.phase = key;
    st.phase_spent = 0;
    st.phase_grant = grant;
    return st;
  }
  if (st.phase === key) {
    st.phase_grant = grant;
    return st;
  }
  const n = phaseDelta(st.phase, key);
  if (!persist) st.carry = grant;
  else st.carry = clamp((st.carry || 0) + grant * n, -overdraftMax, creditCap);
  st.phase = key;
  st.phase_spent = 0;
  st.phase_grant = grant;
  return st;
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
  const billing = spec.billing || "";
  const ledger = opts.ledger || null;

  const pack = (decision, remaining, hoursLeft, hourlyCap, spendable, reserved, reason, extra = {}) => ({
    decision, rail, remaining, hours_left: hoursLeft, hourly_cap: hourlyCap,
    spendable, reserved, cost, reason, layer, is_peak: isPeak, is_p0: isP0, billing,
    carry: extra.carry || 0, daily_debt: extra.daily_debt || 0, daily_credit: extra.daily_credit || 0,
    next_phase_grant: extra.next_phase_grant != null ? extra.next_phase_grant : hourlyCap,
    density: extra.density != null ? extra.density : densityOf(opts.signal == null ? 1 : opts.signal, cost),
    signal: opts.signal == null ? 1 : opts.signal,
    circuit: extra.circuit || "",
    pace_factor: extra.pace_factor != null ? extra.pace_factor : 1,
    inflator: extra.inflator != null ? extra.inflator : 1,
    deflator: extra.deflator != null ? extra.deflator : 1,
    effective_cap: extra.effective_cap || 0,
  });

  if (isWorkersDev(opts.url)) return pack(STASIS, 0, 0, 0, 0, 0, "workers.dev forbidden — zone WAF does not cover it (INC-1027)");
  if (spec.stasis_until && !isP0) {
    const until = Date.parse(spec.stasis_until);
    if (!Number.isNaN(until) && now.getTime() < until) {
      return pack(STASIS, 0, 0, 0, 0, 0, `stasis until ${spec.stasis_until}`);
    }
  }
  if (spec.hard_cap === 0) return pack(STASIS, 0, 0, 0, 0, 0, spec.note || "rail forbidden");
  if (kind === "hard") {
    const cap = spec.hard_cap || spec.limit || 0;
    const rem = opts.remaining == null ? cap : opts.remaining;
    if (rem <= 0) return pack(STASIS, rem, 0, 0, 0, 0, `hard cap ${cap} reached`);
    return pack(ALLOW, rem, 0, 0, rem, 0, `hard cap ${cap}, remaining ${rem}`);
  }

  if (!isP0 && resetIsExpired(opts.resetUnix, now)) {
    return pack(HOLD, opts.remaining == null ? 0 : opts.remaining, 0, 0, 0, 0, "expired reset_unix — fail closed (no live refresh)");
  }
  if (!isP0 && resetIsoExpired(opts.resetIso, now)) {
    return pack(HOLD, opts.remaining == null ? 0 : opts.remaining, 0, 0, 0, 0, "expired reset_iso — fail closed (no live refresh)");
  }

  const hoursLeft = hoursLeftFor(spec, now, cfg, opts.resetUnix, opts.resetIso);
  let remaining = opts.remaining;
  const fracMeter = spec.meter === "remaining_frac" || !!spec.unknown_cost;
  if (opts.remainingFrac != null) remaining = Number(opts.remainingFrac);
  if (remaining == null) {
    if (spec.unknown_remaining === "hold" && !isP0) {
      return pack(HOLD, 0, hoursLeft, 0, 0, 0, "no live remaining sample — do not invent a cap");
    }
    remaining = kind === "slots" && spec.daily_limit != null
      ? Math.max(0, spec.daily_limit - estimatedSpentSlots(cfg, now, rail))
      : spec.daily_limit || spec.limit || 0;
  }

  let st = null;
  if (ledger) {
    st = settleRail(ledger, rail, now, remaining, hoursLeft, spec, cfg);
    remaining = Math.max(0, remaining + (st.daily_credit || 0) - (st.daily_debt || 0));
  }

  const hourlyCap = hoursLeft ? remaining / hoursLeft : remaining;
  const daySpent = st ? (st.day_spent || 0) : 0;
  let windowHours = 24;
  if (spec.window_sec) windowHours = spec.window_sec / 3600;
  if (spec.window === "rolling_hour") windowHours = 1;
  const pf = paceFactor(daySpent, spec.daily_limit || spec.limit || 0, hoursLeft, windowHours);
  const adjusted = hourlyCap * pf;
  let reserved = 0;
  if (kind === "slots") reserved = reservedAhead(cfg, now, rail, isPeak || slotId ? slotId : null);
  const spendable = remaining - reserved;
  const extra = {
    carry: st ? st.carry : 0,
    daily_debt: st ? st.daily_debt : 0,
    daily_credit: st ? st.daily_credit : 0,
    next_phase_grant: adjusted,
    pace_factor: pf,
    inflator: Math.max(1, pf),
    deflator: Math.min(1, pf),
  };
  const dens = densityOf(opts.signal == null ? 1 : opts.signal, cost);
  const applyTo = (cfg.density && cfg.density.apply_to) || [];
  const floor = spec.min_density != null
    ? spec.min_density
    : (applyTo.includes(rail) ? ((cfg.density && cfg.density.min_density) || 1) : 0);
  extra.density = dens;
  extra.effective_cap = effectiveCapacity(adjusted, dens, floor);
  extra.circuit = circuitTrip(opts.hourSpent, hourlyCap, cfg);
  if (extra.circuit === STASIS && !isP0) {
    return pack(STASIS, remaining, hoursLeft, hourlyCap, spendable, reserved, "circuit STASIS — hour spent ≥ 2× hourly cap (INC-1027)", extra);
  }
  if (extra.circuit === HOLD && !isP0 && !isPeak) {
    return pack(HOLD, remaining, hoursLeft, hourlyCap, spendable, reserved, "circuit HOLD — wait for next phase", extra);
  }
  if (opts.lastSameMs != null && opts.lastSameMs < ((cfg.density && cfg.density.min_interval_ms) || 10000) && !isP0) {
    return pack(HOLD, remaining, hoursLeft, hourlyCap, spendable, reserved, "anti-3Hz: same URL too soon", extra);
  }
  if (dens + 1e-9 < floor && !isP0 && !isPeak) {
    return pack(HOLD, remaining, hoursLeft, hourlyCap, spendable, reserved, `density ${dens.toFixed(2)} < floor ${floor} — coalesce`, extra);
  }

  if (remaining <= 0 && !isP0) return pack(STASIS, remaining, hoursLeft, hourlyCap, spendable, reserved, "quota exhausted until renewal", extra);
  if (remaining <= 0 && isP0) return pack(P0_BORROW, remaining, hoursLeft, hourlyCap, spendable, reserved, "P0 borrows — subsequent phases compensate; no retry-loop", extra);

  if (kind === "slots") {
    if (isP0) return pack(remaining >= cost ? ALLOW : P0_BORROW, remaining, hoursLeft, hourlyCap, spendable, reserved, "P0 spends; overdraft credited to later phases", extra);
    if (isPeak || slotId) {
      if (remaining >= cost) return pack(ALLOW, remaining, hoursLeft, hourlyCap, spendable, reserved, "budgeted slot / reserved peak (may overdraft the hour)", extra);
      return pack(STASIS, remaining, hoursLeft, hourlyCap, spendable, reserved, "peak has no remaining", extra);
    }
    if (spendable < cost) return pack(HOLD, remaining, hoursLeft, hourlyCap, spendable, reserved, `protect ${reserved} reserved slot(s) still ahead`, extra);
    if (st && st.carry * pf + 1e-9 < cost && !isP0) {
      return pack(HOLD, remaining, hoursLeft, hourlyCap, spendable, reserved, `hourly carry ${st.carry.toFixed(2)} < cost — wait; subsequent phase will be credited`, extra);
    }
    return pack(ALLOW, remaining, hoursLeft, hourlyCap, spendable, reserved, "unscheduled spend within contingency", extra);
  }

  if (fracMeter) {
    return pack(ALLOW, remaining, hoursLeft, hourlyCap, remaining, 0, "pool remaining_frac > 0 — unknown prompt cost; fire is grok-auto", extra);
  }

  const allowance = st ? Math.max(0, st.carry * pf) : adjusted;
  if (remaining < cost) return pack(STASIS, remaining, hoursLeft, hourlyCap, remaining, 0, "remaining < cost", extra);
  if (cost > allowance + 1e-9) return pack(HOLD, remaining, hoursLeft, hourlyCap, remaining, 0, `cost ${cost} > phase allowance ${allowance.toFixed(4)} (pace; overdraft would debit next phase)`, extra);
  return pack(ALLOW, remaining, hoursLeft, hourlyCap, remaining, 0, "within hourly average + carry", extra);
}

export function densityOf(signal, cost) {
  return Math.max(0, Number(signal) / Math.max(Number(cost), 1e-9));
}

export function effectiveCapacity(limit, density, floor = 1) {
  return Number(limit) * Math.max(Number(density), Number(floor));
}

export function isWorkersDev(url) {
  return String(url || "").toLowerCase().includes("workers.dev");
}

export function circuitTrip(hourSpent, hourlyCap, cfg = {}) {
  if (hourSpent == null) return "";
  const d = cfg.density || {};
  const cap = Math.max(Number(hourlyCap), 1e-9);
  if (hourSpent >= cap * (d.circuit_stasis_mult || 2)) return STASIS;
  if (hourSpent >= cap * (d.circuit_hold_mult || 1.25)) return HOLD;
  return "";
}

export function coalesceIntents(intents, cfg = {}) {
  const dens = cfg.density || {};
  const zone = (dens.zone_suffix || "calhegasmorais.pt").toLowerCase();
  const seen = new Set();
  const kept = [];
  const worker = [];
  for (const it of intents) {
    const url = String(it.url || "");
    const low = url.toLowerCase();
    if (low.includes("workers.dev")) continue;
    const key = low.replace(/\/+$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    const isPages = !!it.pages || key === `https://${zone}` || key === `https://www.${zone}`;
    const isWorker = low.includes(zone) && !isPages && [null, undefined, "cf-worker-req", "local-monitor"].includes(it.rail);
    if (isWorker && !it.p1) {
      worker.push(it);
      continue;
    }
    kept.push({ ...it });
  }
  if (worker.length) {
    const primary = { ...worker[0] };
    primary.signal = worker.reduce((a, x) => a + (x.signal || 1), 0);
    primary.cost = 1;
    primary.coalesced = worker.length;
    primary.urls = worker.map((x) => x.url);
    kept.push(primary);
  }
  return kept;
}

export function monitorIntervalSec(now, cfg, ledger) {
  const spec = (cfg.rails || {})["local-monitor"] || {};
  let base = isNight(now, spec, cfg.timezone) ? spec.night_interval_sec || 900 : spec.day_interval_sec || 300;
  const st = ledger && ledger.rails && ledger.rails["local-monitor"];
  if (st && ((st.carry || 0) < 0 || (st.daily_debt || 0) > 0)) base = Math.round(base * 1.5);
  return base;
}

export function snapshot(cfg, now = new Date(), live = {}, ledger = { rails: {} }) {
  const tz = cfg.timezone || DEFAULT_TZ;
  const parts = zonedParts(now, tz);
  const railsOut = {};
  for (const name of Object.keys(cfg.rails || {})) {
    const spec = cfg.rails[name] || {};
    if (spec.skip_meter || spec.kind === "alias") {
      railsOut[name] = {
        decision: "ALIAS",
        rail: name,
        shares_pool: spec.shares_pool || spec.alias_of,
        reason: spec.note || "alias — does not hold a separate quota",
        spec_note: spec.note,
        kind: spec.kind,
        unit: spec.unit,
        billing: spec.billing,
        daily_limit: spec.daily_limit,
        static_assets_free: spec.static_assets_free,
      };
      continue;
    }
    const extra = Object.prototype.hasOwnProperty.call(live, name) ? (live[name] || {}) : null;
    const liveHit = extra != null;
    const sample = extra || {};
    if (!ledger.rails) ledger.rails = {};
    if (!ledger.rails[name]) ledger.rails[name] = {};
    const stLed = ledger.rails[name];
    const opts = { cfg, now, ledger };
    if (spec.meter === "remaining_frac" || spec.unknown_cost) opts.cost = 0;
    if (sample.unknown) {
      // live unknown — do not invent remaining from ledger
    } else if (liveHit) {
      if (sample.remaining_frac != null) opts.remainingFrac = sample.remaining_frac;
      if (sample.remaining != null) opts.remaining = sample.remaining;
      else if (sample.remaining_frac != null) opts.remaining = sample.remaining_frac;
      if (sample.reset_unix != null) opts.resetUnix = sample.reset_unix;
      if (sample.reset_iso) opts.resetIso = sample.reset_iso;
      if (sample.hour_spent != null) opts.hourSpent = sample.hour_spent;
      const used = sample.used != null ? sample.used : sample.day_spent;
      if (used != null) {
        stLed.day_spent = Number(used);
      }
    } else {
      const expired = resetIsExpired(stLed.sampled_reset_unix, now) || resetIsoExpired(stLed.sampled_reset_iso, now);
      if (!expired) {
        if (stLed.sampled_remaining_frac != null) opts.remainingFrac = stLed.sampled_remaining_frac;
        if (stLed.sampled_remaining != null && opts.remainingFrac == null) opts.remaining = stLed.sampled_remaining;
        if (stLed.sampled_reset_unix != null) opts.resetUnix = stLed.sampled_reset_unix;
        if (stLed.sampled_reset_iso) opts.resetIso = stLed.sampled_reset_iso;
        if (stLed.sampled_hour_spent != null) opts.hourSpent = stLed.sampled_hour_spent;
      }
    }
    const v = decide(name, opts);
    const st = stLed;
    railsOut[name] = {
      ...v,
      spec_note: spec.note,
      kind: spec.kind,
      unit: spec.unit,
      billing: spec.billing,
      daily_limit: spec.daily_limit || spec.limit || spec.hard_cap,
      phase_spent: st.phase_spent || 0,
      day_spent: st.day_spent || 0,
      overdraft_events: st.overdraft_events || 0,
      compensation: -Math.min(0, st.carry || 0),
    };
    if (opts.hourSpent != null) railsOut[name].hour_spent = opts.hourSpent;
  }
  const slots = (cfg.slots || []).map((s) => {
    const v = decide(s.rail, { cfg, now, isPeak: !!s.peak, slotId: s.id, remaining: railsOut[s.rail]?.remaining, ledger });
    return { ...s, verdict: v.decision, reason: v.reason, carry: v.carry };
  });
  return {
    schema: "stratamesh.metabolism.v1.3",
    at: now.toISOString(),
    lisbon: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`,
    hour_lisbon: parts.hour,
    night: isNight(now, (cfg.rails || {})["local-monitor"], tz),
    monitor_interval_sec: monitorIntervalSec(now, cfg, ledger),
    cf_cron_hard_cap: cfg.cf_cron_hard_cap,
    formula: cfg.formula,
    overdraft: cfg.overdraft,
    rails: railsOut,
    slots,
    debts: Object.fromEntries(Object.entries(railsOut).filter(([, v]) => v.daily_debt).map(([k, v]) => [k, v.daily_debt])),
    carries: Object.fromEntries(Object.entries(railsOut).filter(([, v]) => v.carry).map(([k, v]) => [k, v.carry])),
    lab_honest: true,
    no_sixth_cron: true,
    never_workers_dev: true,
    hourly_cap_after_refill: (railsOut["cf-worker-req"] || {}).hourly_cap,
  };
}



/** INC-KV-50 — KV writes are a separate free-tier meter (≈1000/UTC-day).
 * Same v1.3 formula as Worker requests. Always-on burn_rate. No night freeze.
 * hourly_cap = remaining / hours_until_renewal(00:00 UTC)
 * pace_factor = clamp(time_frac / spent_frac, 0.5, 1.5) ; 1.0 if day_spent==0
 * circuit trips on UNADJUSTED hourly_cap (inflator cannot bypass).
 */
export const KV_WRITE_DAILY = 1000;
export const KV_READ_DAILY = 100000;

export function kvWriteDecision({ daySpent = 0, hourSpent = 0, cost = 1, now = new Date() } = {}) {
  const remaining = Math.max(0, KV_WRITE_DAILY - Number(daySpent || 0));
  const hoursLeft = hoursUntilRenewal(now, "00:00", "UTC");
  const hourlyCap = remaining / Math.max(hoursLeft, 1 / 60);
  const elapsed = Math.max(24 - hoursLeft, 1 / 60);
  const timeFrac = elapsed / 24;
  const spentFrac = Number(daySpent || 0) <= 0 ? 0 : Number(daySpent) / KV_WRITE_DAILY;
  const pace = spentFrac === 0 ? 1 : Math.min(1.5, Math.max(0.5, timeFrac / spentFrac));
  const adjusted = hourlyCap * pace;
  if (remaining < cost) return { decision: STASIS, reason: "kv writes remaining < cost", hourlyCap, adjusted, pace, remaining, hoursLeft };
  if (hourSpent >= hourlyCap * 2) return { decision: STASIS, reason: "hour_spent ≥ 2× kv hourly_cap", hourlyCap, adjusted, pace, remaining, hoursLeft };
  if (hourSpent >= hourlyCap * 1.25) return { decision: HOLD, reason: "hour_spent ≥ 1.25× kv hourly_cap", hourlyCap, adjusted, pace, remaining, hoursLeft };
  if (hourSpent + cost > adjusted && hourSpent + cost > hourlyCap) {
    return { decision: HOLD, reason: "this write would exceed paced kv cap", hourlyCap, adjusted, pace, remaining, hoursLeft };
  }
  return { decision: ALLOW, reason: "kv burn within paced range", hourlyCap, adjusted, pace, remaining, hoursLeft };
}

/** @deprecated name kept so callers of the 12:14 freeze stub compile; delegates to v1.3. */
export function kvCircuit(opts = {}) {
  return kvWriteDecision({
    daySpent: opts.writesUsed || opts.daySpent || 0,
    hourSpent: opts.hourSpent || 0,
    now: opts.now || new Date(),
  });
}
