#!/usr/bin/env python3
"""Metabolic stasis v1.2 — remaining/hours, density (signal/cost), circuit breaker.

Subsequent phases credit unused grant against prior overdraft. Peaks 09:00 /
18:00 / 23:00 Lisbon may overdraft; quiet hours pay it back. Density is
signal per token: coalesce so few spends have high impact. Circuit trips
before Error 1027. Never a 6th CF cron. Never workers.dev.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
RAILS_PATH = ROOT / "config" / "rails.json"
LEDGER_PATH = ROOT / "state" / "ledger.json"

ALLOW = "ALLOW"
HOLD = "HOLD"
STASIS = "STASIS"
P0_BORROW = "P0_BORROW"

LISBON = ZoneInfo("Europe/Lisbon")


def load_rails(path: Path = RAILS_PATH) -> dict:
    return json.loads(path.read_text())


def parse_hhmm(hhmm: str) -> tuple[int, int]:
    h, m = hhmm.split(":")
    return int(h), int(m)


def as_tz(now: Optional[datetime], tz_name: str) -> datetime:
    tz = ZoneInfo(tz_name)
    if now is None:
        now = datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    return now.astimezone(tz)


def hours_until_renewal(
    now: Optional[datetime] = None,
    renewal_hhmm: str = "00:00",
    tz_name: str = "Europe/Lisbon",
) -> float:
    local = as_tz(now, tz_name)
    rh, rm = parse_hhmm(renewal_hhmm)
    candidate = local.replace(hour=rh, minute=rm, second=0, microsecond=0)
    if candidate <= local:
        candidate = candidate + timedelta(days=1)
    hours = (candidate - local).total_seconds() / 3600.0
    return max(hours, 1.0 / 60.0)


def hours_until_unix(now: Optional[datetime], reset_unix: int) -> float:
    if now is None:
        now = datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    reset = datetime.fromtimestamp(reset_unix, tz=timezone.utc)
    hours = (reset - now.astimezone(timezone.utc)).total_seconds() / 3600.0
    return max(hours, 1.0 / 60.0)


def minutes_of_day(local: datetime) -> int:
    return local.hour * 60 + local.minute


def hhmm_minutes(hhmm: str) -> int:
    h, m = parse_hhmm(hhmm)
    return h * 60 + m


def is_night(now: Optional[datetime] = None, spec: Optional[dict] = None) -> bool:
    spec = spec or {}
    tz = spec.get("renewal_tz") or "Europe/Lisbon"
    local = as_tz(now, tz)
    start = hhmm_minutes(spec.get("night_start") or "22:00")
    end = hhmm_minutes(spec.get("night_end") or "08:00")
    m = minutes_of_day(local)
    if start > end:
        return m >= start or m < end
    return start <= m < end


def slots_ahead(cfg: dict, now: Optional[datetime], rail: str, exclude_id: Optional[str] = None) -> list[dict]:
    local = as_tz(now, cfg.get("timezone") or "Europe/Lisbon")
    now_m = minutes_of_day(local)
    out = []
    for s in cfg.get("slots") or []:
        if s.get("rail") != rail:
            continue
        if exclude_id and s.get("id") == exclude_id:
            continue
        if hhmm_minutes(s["hhmm"]) > now_m:
            out.append(s)
    return out


def reserved_ahead(cfg: dict, now: Optional[datetime], rail: str, exclude_id: Optional[str] = None) -> float:
    return float(sum(s.get("cost") or 1 for s in slots_ahead(cfg, now, rail, exclude_id)))


def estimated_spent_slots(cfg: dict, now: Optional[datetime], rail: str, grace_min: int = 20) -> float:
    local = as_tz(now, cfg.get("timezone") or "Europe/Lisbon")
    now_m = minutes_of_day(local)
    spent = 0.0
    for s in cfg.get("slots") or []:
        if s.get("rail") != rail:
            continue
        if now_m >= hhmm_minutes(s["hhmm"]) + grace_min:
            spent += float(s.get("cost") or 1)
    return spent


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def density_of(signal: float, cost: float) -> float:
    """Facts (or bits of unique state) delivered per token spent."""
    c = max(float(cost), 1e-9)
    return max(0.0, float(signal) / c)


def effective_capacity(limit: float, density: float, floor: float = 1.0) -> float:
    """Outcomes per window. Density above floor multiplies the same quota."""
    return float(limit) * max(float(density), float(floor))


def is_workers_dev(url: Optional[str]) -> bool:
    if not url:
        return False
    return "workers.dev" in Stringish(url)


def Stringish(x: Any) -> str:
    return str(x or "").lower()


def circuit_trip(hour_spent: Optional[float], hourly_cap: float, cfg: Optional[dict] = None) -> str:
    """Return STASIS / HOLD / '' so a 3 Hz lockstep cannot exhaust the day again."""
    if hour_spent is None:
        return ""
    dens = (cfg or {}).get("density") or {}
    stasis_x = float(dens.get("circuit_stasis_mult") or 2.0)
    hold_x = float(dens.get("circuit_hold_mult") or 1.25)
    cap = max(float(hourly_cap), 1e-9)
    spent = float(hour_spent)
    if spent >= cap * stasis_x:
        return STASIS
    if spent >= cap * hold_x:
        return HOLD
    return ""


def coalesce_intents(intents: list[dict], cfg: Optional[dict] = None) -> list[dict]:
    """Collapse many low-density probes into few high-density spends.

    - Drop workers.dev (WAF-blind, INC-1027 hole).
    - Drop duplicate URLs.
    - Collapse N Worker /health on the same zone into one multiplex (signal=N, cost=1).
    - Pages / GitHub API stay; they are not the 100k Worker rail.
    """
    cfg = cfg or {}
    dens = cfg.get("density") or {}
    zone = (dens.get("zone_suffix") or "calhegasmorais.pt").lower()
    seen = set()
    kept: list[dict] = []
    worker_health: list[dict] = []
    for it in intents:
        url = str(it.get("url") or "")
        low = url.lower()
        if "workers.dev" in low:
            continue
        key = low.rstrip("/")
        if key in seen:
            continue
        seen.add(key)
        is_pages = it.get("pages") or low.rstrip("/") in (
            f"https://{zone}",
            f"https://www.{zone}",
        )
        is_worker = (
            zone in low
            and not is_pages
            and it.get("rail") in (None, "cf-worker-req", "local-monitor")
        )
        if is_worker and not it.get("p1"):
            worker_health.append(it)
            continue
        kept.append(dict(it))
    if worker_health:
        n = len(worker_health)
        primary = dict(worker_health[0])
        primary["signal"] = sum(float(x.get("signal") or 1) for x in worker_health)
        primary["cost"] = 1.0
        primary["coalesced"] = n
        primary["urls"] = [x.get("url") for x in worker_health]
        # Keep a single representative URL; multiplex is the density win.
        kept.append(primary)
    return kept


def min_interval_hold(last_same_ms: Optional[float], cfg: Optional[dict] = None) -> bool:
    dens = (cfg or {}).get("density") or {}
    floor = float(dens.get("min_interval_ms") or 10000)
    if last_same_ms is None:
        return False
    return float(last_same_ms) < floor


def hours_left_for(spec: dict, now: Optional[datetime], cfg: dict, reset_unix: Optional[int] = None) -> float:
    tz = spec.get("renewal_tz") or cfg.get("timezone") or "Europe/Lisbon"
    renewal = spec.get("renewal_hhmm") or "00:00"
    if reset_unix is not None:
        return hours_until_unix(now, reset_unix)
    if spec.get("window") == "rolling_hour":
        return 1.0
    if spec.get("window_sec"):
        return max(float(spec["window_sec"]) / 3600.0, 1.0 / 60.0)
    return hours_until_renewal(now, renewal, tz)


def phase_key(now: Optional[datetime], spec: dict, cfg: dict) -> str:
    tz = spec.get("renewal_tz") or cfg.get("timezone") or "Europe/Lisbon"
    local = as_tz(now, tz)
    grain = spec.get("phase") or "hour"
    if grain == "day":
        return local.strftime("%Y-%m-%d")
    if grain == "minute":
        return local.strftime("%Y-%m-%dT%H:%M")
    return local.strftime("%Y-%m-%dT%H")


def day_key(now: Optional[datetime], spec: dict, cfg: dict) -> str:
    tz = spec.get("renewal_tz") or cfg.get("timezone") or "Europe/Lisbon"
    local = as_tz(now, tz)
    rh, rm = parse_hhmm(spec.get("renewal_hhmm") or "00:00")
    # day identity is the renewal-aligned date (before renewal hhmm still previous day)
    mark = local.replace(hour=rh, minute=rm, second=0, microsecond=0)
    if local < mark:
        local = local - timedelta(days=1)
    return local.strftime("%Y-%m-%d")


def phase_delta(prev: str, cur: str) -> int:
    """How many phase steps from prev (exclusive) to cur (inclusive). min 1 if different."""
    if prev == cur:
        return 0

    def parse(k: str) -> datetime:
        if "T" not in k:
            return datetime.strptime(k, "%Y-%m-%d")
        if k.count(":") == 1 and len(k) >= 16:
            try:
                return datetime.strptime(k, "%Y-%m-%dT%H:%M")
            except ValueError:
                return datetime.strptime(k, "%Y-%m-%dT%H")
        return datetime.strptime(k, "%Y-%m-%dT%H")

    a, b = parse(prev), parse(cur)
    if "T" not in prev:
        return max(1, (b - a).days)
    if prev.count(":") == 1 and len(prev) >= 16:
        return max(1, int((b - a).total_seconds() // 60))
    return max(1, int((b - a).total_seconds() // 3600))


def empty_rail_state() -> dict:
    return {
        "phase": None,
        "day": None,
        "carry": 0.0,
        "daily_debt": 0.0,
        "daily_credit": 0.0,
        "phase_spent": 0.0,
        "day_spent": 0.0,
        "phase_grant": 0.0,
        "overdraft_events": 0,
    }


def load_ledger(path: Path = LEDGER_PATH) -> dict:
    if not path.exists():
        return {"schema": "stratamesh.metabolism.ledger.v1", "rails": {}}
    try:
        return json.loads(path.read_text())
    except Exception:
        return {"schema": "stratamesh.metabolism.ledger.v1", "rails": {}}


def save_ledger(ledger: dict, path: Path = LEDGER_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(ledger, indent=2))


def _od_cfg(cfg: dict) -> dict:
    return cfg.get("overdraft") or {}


def _caps(spec: dict, cfg: dict, grant: float) -> tuple[float, float]:
    od = _od_cfg(cfg)
    credit_hours = float(od.get("credit_cap_hours") or 1)
    mult = float(od.get("overdraft_max_multiplier") or 1)
    daily = float(spec.get("daily_limit") or spec.get("limit") or 0)
    credit_cap = max(grant * credit_hours, 0.0)
    overdraft_max = max(daily * mult, grant * 24 * mult, 1.0)
    return credit_cap, overdraft_max


def settle_rail(
    ledger: dict,
    rail: str,
    now: Optional[datetime],
    remaining: float,
    hours_left: float,
    spec: dict,
    cfg: dict,
) -> dict:
    """Deposit unused grants of skipped phases (compensation) and roll the day."""
    rails = ledger.setdefault("rails", {})
    st = rails.setdefault(rail, empty_rail_state())
    grant = remaining / hours_left if hours_left else remaining
    key = phase_key(now, spec, cfg)
    dkey = day_key(now, spec, cfg)
    persist = bool(spec.get("debt_persists_across_renewal", True))
    credit_cap, overdraft_max = _caps(spec, cfg, grant)
    od = _od_cfg(cfg)
    if not od.get("enabled", True):
        st["phase"] = key
        st["day"] = dkey
        st["phase_grant"] = grant
        return st

    if st.get("day") and st["day"] != dkey:
        daily = float(spec.get("daily_limit") or spec.get("limit") or 0)
        eff = daily + float(st.get("daily_credit") or 0) - float(st.get("daily_debt") or 0)
        leftover = eff - float(st.get("day_spent") or 0)
        if leftover >= 0:
            pay = min(float(st.get("daily_debt") or 0), leftover)
            st["daily_debt"] = float(st.get("daily_debt") or 0) - pay
            leftover -= pay
            if od.get("carry_unused", True) and persist:
                st["daily_credit"] = min(leftover, credit_cap * 24 if credit_cap else leftover)
            else:
                st["daily_credit"] = 0.0
        else:
            if persist:
                st["daily_debt"] = float(st.get("daily_debt") or 0) + (-leftover)
                st["daily_debt"] = min(float(st["daily_debt"]), overdraft_max)
            else:
                st["daily_debt"] = 0.0
            st["daily_credit"] = 0.0
        st["day_spent"] = 0.0
        if not persist:
            st["carry"] = 0.0
            st["daily_debt"] = 0.0
            st["daily_credit"] = 0.0
        st["day"] = dkey
    elif not st.get("day"):
        st["day"] = dkey

    prev = st.get("phase")
    if prev is None:
        st["carry"] = grant
        st["phase"] = key
        st["phase_spent"] = 0.0
        st["phase_grant"] = grant
        return st

    if prev == key:
        st["phase_grant"] = grant
        return st

    n = phase_delta(prev, key)
    # skipped/closed phases deposit their grant with spent=0 → compensate debt
    if not persist and n >= 1:
        # vendor window reset (GitHub hour): drop carry, start fresh
        st["carry"] = grant
    else:
        st["carry"] = float(st.get("carry") or 0) + grant * n
        st["carry"] = clamp(float(st["carry"]), -overdraft_max, credit_cap)
    st["phase"] = key
    st["phase_spent"] = 0.0
    st["phase_grant"] = grant
    return st


@dataclass
class Verdict:
    decision: str
    rail: str
    remaining: float
    hours_left: float
    hourly_cap: float
    spendable: float
    reserved: float
    cost: float
    reason: str
    layer: str = ""
    is_peak: bool = False
    is_p0: bool = False
    carry: float = 0.0
    daily_debt: float = 0.0
    daily_credit: float = 0.0
    next_phase_grant: float = 0.0
    billing: str = ""
    density: float = 1.0
    signal: float = 1.0
    effective_cap: float = 0.0
    circuit: str = ""

    def as_dict(self) -> dict[str, Any]:
        d = asdict(self)
        for k in (
            "hourly_cap", "hours_left", "spendable", "carry", "daily_debt",
            "daily_credit", "next_phase_grant", "density", "signal", "effective_cap",
        ):
            d[k] = round(float(d[k]), 4)
        return d


def decide(
    rail: str,
    remaining: Optional[float] = None,
    now: Optional[datetime] = None,
    cost: float = 1.0,
    is_peak: bool = False,
    is_p0: bool = False,
    slot_id: Optional[str] = None,
    reset_unix: Optional[int] = None,
    cfg: Optional[dict] = None,
    ledger: Optional[dict] = None,
    signal: float = 1.0,
    url: Optional[str] = None,
    hour_spent: Optional[float] = None,
    last_same_ms: Optional[float] = None,
) -> Verdict:
    cfg = cfg or load_rails()
    spec = (cfg.get("rails") or {}).get(rail) or {}
    layer = spec.get("layer") or ""
    billing = spec.get("billing") or ""
    kind = spec.get("kind") or "rate"
    dens_cfg = cfg.get("density") or {}
    dens = density_of(signal, cost)
    apply_to = dens_cfg.get("apply_to") or []
    if spec.get("min_density") is not None:
        floor = float(spec.get("min_density"))
    elif rail in apply_to:
        floor = float(dens_cfg.get("min_density") or 1.0)
    else:
        floor = 0.0
    extra = dict(
        layer=layer, is_peak=is_peak, is_p0=is_p0, billing=billing,
        density=dens, signal=float(signal),
    )

    if is_workers_dev(url):
        return Verdict(
            STASIS, rail, 0, 0, 0, 0, 0, cost,
            "workers.dev forbidden — zone WAF does not cover it (INC-1027)",
            **extra,
        )

    if spec.get("hard_cap") == 0:
        return Verdict(
            STASIS, rail, 0, 0, 0, 0, 0, cost,
            spec.get("note") or "rail forbidden", **extra,
        )

    if kind == "hard":
        cap = float(spec.get("hard_cap") or spec.get("limit") or 0)
        rem = cap - float(spec.get("used") or 0) if remaining is None else float(remaining)
        if rem <= 0:
            return Verdict(STASIS, rail, rem, 0, 0, 0, 0, cost, f"hard cap {cap} reached", **extra)
        return Verdict(ALLOW, rail, rem, 0, 0, rem, 0, cost, f"hard cap {cap}, remaining {rem}", **extra)

    hours_left = hours_left_for(spec, now, cfg, reset_unix)
    daily = spec.get("daily_limit")
    if remaining is None:
        if kind == "slots" and daily is not None:
            remaining = max(0.0, float(daily) - estimated_spent_slots(cfg, now, rail))
        else:
            remaining = float(daily or spec.get("limit") or 0)
    remaining = float(remaining)

    st = None
    if ledger is not None:
        st = settle_rail(ledger, rail, now, remaining, hours_left, spec, cfg)
        remaining = max(0.0, remaining + float(st.get("daily_credit") or 0) - float(st.get("daily_debt") or 0))

    hourly_cap = remaining / hours_left if hours_left else remaining
    reserved = 0.0
    if kind == "slots":
        reserved = reserved_ahead(cfg, now, rail, exclude_id=slot_id if (is_peak or slot_id) else None)
        if is_peak or slot_id:
            reserved = reserved_ahead(cfg, now, rail, exclude_id=slot_id)
    spendable = remaining - reserved
    carry = float(st.get("carry") or 0) if st else 0.0
    daily_debt = float(st.get("daily_debt") or 0) if st else 0.0
    daily_credit = float(st.get("daily_credit") or 0) if st else 0.0
    extra.update(
        carry=carry,
        daily_debt=daily_debt,
        daily_credit=daily_credit,
        next_phase_grant=hourly_cap,
        effective_cap=effective_capacity(hourly_cap, dens, floor),
    )

    trip = circuit_trip(hour_spent, hourly_cap, cfg)
    extra["circuit"] = trip
    if trip == STASIS and not is_p0:
        return Verdict(STASIS, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                       f"circuit STASIS — hour spent {hour_spent} ≥ 2× hourly cap {hourly_cap:.1f} (INC-1027)",
                       **extra)
    if trip == HOLD and not is_p0 and not is_peak:
        return Verdict(HOLD, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                       f"circuit HOLD — hour spent {hour_spent} ≥ 1.25× cap; wait for next phase",
                       **extra)
    if min_interval_hold(last_same_ms, cfg) and not is_p0:
        return Verdict(HOLD, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                       "anti-3Hz: same URL too soon (min 10s)", **extra)
    if dens + 1e-9 < floor and not is_p0 and not is_peak:
        return Verdict(HOLD, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                       f"density {dens:.2f} < floor {floor:.2f} — coalesce or cache; do not spend a thin token",
                       **extra)

    if remaining <= 0 and not is_p0:
        return Verdict(STASIS, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                       "quota exhausted until renewal", **extra)
    if remaining <= 0 and is_p0:
        extra["is_peak"] = True
        extra["is_p0"] = True
        return Verdict(P0_BORROW, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                       "P0 borrows — subsequent phases compensate; no retry-loop", **extra)

    if kind == "slots":
        if is_p0:
            extra["is_p0"] = True
            return Verdict(ALLOW if remaining >= cost else P0_BORROW, rail, remaining, hours_left,
                           hourly_cap, spendable, reserved, cost,
                           "P0 spends; overdraft credited to later phases", **extra)
        if is_peak or slot_id:
            extra["is_peak"] = True
            if remaining >= cost:
                return Verdict(ALLOW, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                               "budgeted slot / reserved peak (may overdraft the hour)", **extra)
            return Verdict(STASIS, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                           "peak has no remaining", **extra)
        if spendable < cost:
            return Verdict(HOLD, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                           f"protect {reserved} reserved slot(s) still ahead", **extra)
        # unscheduled: also respect hourly carry if ledger present (don't dump contingency in one hour)
        if st is not None and carry + 1e-9 < cost and not is_p0:
            return Verdict(HOLD, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                           f"hourly carry {carry:.2f} < cost — wait; subsequent phase will be credited", **extra)
        return Verdict(ALLOW, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                       "unscheduled spend within contingency", **extra)

    # rate rails
    allowance = hourly_cap
    if st is not None:
        allowance = max(0.0, carry)
    if remaining < cost:
        return Verdict(STASIS, rail, remaining, hours_left, hourly_cap, remaining, 0, cost,
                       "remaining < cost", **extra)
    if cost > allowance + 1e-9:
        return Verdict(HOLD, rail, remaining, hours_left, hourly_cap, remaining, 0, cost,
                       f"cost {cost} > phase allowance {allowance:.4f} (pace; overdraft would debit next phase)", **extra)
    return Verdict(ALLOW, rail, remaining, hours_left, hourly_cap, remaining, 0, cost,
                   "within hourly average + carry", **extra)


def record_spend(
    rail: str,
    cost: float = 1.0,
    now: Optional[datetime] = None,
    cfg: Optional[dict] = None,
    ledger: Optional[dict] = None,
    remaining: Optional[float] = None,
    is_p0: bool = False,
    is_peak: bool = False,
    slot_id: Optional[str] = None,
    reset_unix: Optional[int] = None,
    persist: bool = True,
    force: bool = False,
) -> Verdict:
    """Apply a spend to the ledger. Overdraft is compensated by later phases."""
    cfg = cfg or load_rails()
    if ledger is None:
        ledger = load_ledger()
    v = decide(rail, remaining=remaining, now=now, cost=cost, is_peak=is_peak, is_p0=is_p0,
               slot_id=slot_id, reset_unix=reset_unix, cfg=cfg, ledger=ledger)
    if v.decision in (HOLD, STASIS) and not force and not is_p0:
        if persist:
            save_ledger(ledger)
        return v
    spec = (cfg.get("rails") or {}).get(rail) or {}
    st = ledger.setdefault("rails", {}).setdefault(rail, empty_rail_state())
    st["carry"] = float(st.get("carry") or 0) - float(cost)
    st["phase_spent"] = float(st.get("phase_spent") or 0) + float(cost)
    st["day_spent"] = float(st.get("day_spent") or 0) + float(cost)
    credit_cap, overdraft_max = _caps(spec, cfg, float(st.get("phase_grant") or v.hourly_cap or 1))
    if st["carry"] < 0:
        st["overdraft_events"] = int(st.get("overdraft_events") or 0) + 1
        st["carry"] = max(float(st["carry"]), -overdraft_max)
    else:
        st["carry"] = min(float(st["carry"]), credit_cap)
    daily = float(spec.get("daily_limit") or spec.get("limit") or 0)
    if daily and st["day_spent"] > daily + float(st.get("daily_credit") or 0):
        st["daily_debt"] = st["day_spent"] - daily - float(st.get("daily_credit") or 0)
    if persist:
        save_ledger(ledger)
    v.carry = float(st["carry"])
    v.daily_debt = float(st.get("daily_debt") or 0)
    v.daily_credit = float(st.get("daily_credit") or 0)
    if v.decision == ALLOW and st["carry"] < 0:
        v.reason = (v.reason or "") + " · overdraft will debit subsequent phase"
    return v


def monitor_interval_sec(now: Optional[datetime] = None, cfg: Optional[dict] = None, ledger: Optional[dict] = None) -> int:
    cfg = cfg or load_rails()
    spec = (cfg.get("rails") or {}).get("local-monitor") or {}
    night = int(spec.get("night_interval_sec") or 900)
    day = int(spec.get("day_interval_sec") or 300)
    base = night if is_night(now, spec) else day
    # overdraft compensation: stretch interval if we owe
    if ledger is None and LEDGER_PATH.exists():
        ledger = load_ledger()
    if ledger:
        st = (ledger.get("rails") or {}).get("local-monitor") or {}
        debt = float(st.get("daily_debt") or 0)
        carry = float(st.get("carry") or 0)
        if carry < 0 or debt > 0:
            base = int(base * 1.5)
    return base


def snapshot(
    now: Optional[datetime] = None,
    live: Optional[dict] = None,
    cfg: Optional[dict] = None,
    ledger: Optional[dict] = None,
) -> dict:
    cfg = cfg or load_rails()
    live = live or {}
    now = now or datetime.now(timezone.utc)
    if ledger is None and LEDGER_PATH.exists():
        ledger = load_ledger()
    if ledger is None:
        ledger = {"schema": "stratamesh.metabolism.ledger.v1", "rails": {}}
    lisbon = as_tz(now, cfg.get("timezone") or "Europe/Lisbon")
    rails_out = {}
    for name, spec in (cfg.get("rails") or {}).items():
        kwargs: dict[str, Any] = {"cfg": cfg, "now": now, "ledger": ledger}
        if name in live:
            if "remaining" in live[name]:
                kwargs["remaining"] = live[name]["remaining"]
            if "reset_unix" in live[name]:
                kwargs["reset_unix"] = live[name]["reset_unix"]
        v = decide(name, **kwargs)
        st = (ledger.get("rails") or {}).get(name) or {}
        rails_out[name] = {
            **v.as_dict(),
            "spec_note": spec.get("note"),
            "kind": spec.get("kind"),
            "unit": spec.get("unit"),
            "billing": spec.get("billing"),
            "daily_limit": spec.get("daily_limit") or spec.get("limit") or spec.get("hard_cap"),
            "phase_spent": st.get("phase_spent"),
            "day_spent": st.get("day_spent"),
            "overdraft_events": st.get("overdraft_events") or 0,
            "compensation": round(-min(0.0, float(st.get("carry") or 0)), 4),
        }
    slots = []
    for s in cfg.get("slots") or []:
        v = decide(s["rail"], now=now, is_peak=bool(s.get("peak")), slot_id=s["id"], cfg=cfg,
                   remaining=rails_out.get(s["rail"], {}).get("remaining"), ledger=ledger)
        slots.append({**s, "verdict": v.decision, "reason": v.reason, "carry": round(v.carry, 4)})
    debts = {k: v["daily_debt"] for k, v in rails_out.items() if v.get("daily_debt")}
    carries = {k: v["carry"] for k, v in rails_out.items() if v.get("carry") not in (0, 0.0, None)}
    return {
        "schema": "stratamesh.metabolism.v1.2",
        "at": now.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "lisbon": lisbon.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "hour_lisbon": lisbon.hour,
        "night": is_night(now, (cfg.get("rails") or {}).get("local-monitor")),
        "monitor_interval_sec": monitor_interval_sec(now, cfg, ledger),
        "cf_cron_hard_cap": cfg.get("cf_cron_hard_cap"),
        "formula": cfg.get("formula"),
        "overdraft": cfg.get("overdraft"),
        "density": cfg.get("density"),
        "rails": rails_out,
        "slots": slots,
        "debts": debts,
        "carries": carries,
        "lab_honest": True,
        "no_sixth_cron": True,
        "never_workers_dev": True,
        "hourly_cap_after_refill": 4167,
        "effective_worker_facts_per_hour": effective_capacity(
            4167, float((cfg.get("density") or {}).get("target_density") or 8)
        ),
    }


def main(argv: Optional[list[str]] = None) -> int:
    import sys
    argv = argv if argv is not None else sys.argv[1:]
    if argv and argv[0] == "--spend":
        rail = argv[1]
        cost = float(argv[2]) if len(argv) > 2 else 1.0
        v = record_spend(rail, cost)
        print(json.dumps(v.as_dict(), indent=2))
        return 0 if v.decision in (ALLOW, P0_BORROW) else 2
    snap = snapshot()
    if argv and argv[0] == "--pretty":
        print(json.dumps(snap, indent=2))
    else:
        print(json.dumps(snap, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
