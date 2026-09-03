#!/usr/bin/env python3
"""Metabolic stasis v1.3 — remaining/hours, pace_factor, density, circuit breaker.

pace_factor inflates (>1) when under-spent vs elapsed time and deflates (<1)
when over-spent. Neutral 1.0 when day_spent==0 so existing tests stay green.
Circuit trips on the unadjusted hourly cap so an inflator cannot bypass Error 1027.
Subsequent phases credit unused grant against prior overdraft. Peaks 09:00 /
18:00 / 23:00 Lisbon may overdraft; quiet hours pay it back. Density is
signal per token: coalesce so few spends have high impact. Never a 6th CF cron.
Never workers.dev.
"""
from __future__ import annotations

import json
import random
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


def hours_until_iso(now: Optional[datetime], reset_iso: str) -> float:
    """hours_left from a Usage reset timestamp. Naive ISO is Europe/Lisbon (session TZ)."""
    if now is None:
        now = datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    until = datetime.fromisoformat(str(reset_iso).replace("Z", "+00:00"))
    if until.tzinfo is None:
        until = until.replace(tzinfo=LISBON)
    hours = (until.astimezone(timezone.utc) - now.astimezone(timezone.utc)).total_seconds() / 3600.0
    return max(hours, 1.0 / 60.0)


def reset_is_expired(reset_unix: Optional[int], now: Optional[datetime] = None) -> bool:
    """True if reset_unix is missing-invalid or already in the past (UTC)."""
    if reset_unix is None:
        return False
    if now is None:
        now = datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    try:
        ru = int(reset_unix)
    except (TypeError, ValueError):
        return True
    return ru <= int(now.astimezone(timezone.utc).timestamp())


def reset_iso_expired(reset_iso: Optional[str], now: Optional[datetime] = None) -> bool:
    """True if a Usage reset ISO timestamp is already in the past."""
    if not reset_iso:
        return False
    if now is None:
        now = datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    try:
        until = datetime.fromisoformat(str(reset_iso).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return True
    if until.tzinfo is None:
        until = until.replace(tzinfo=LISBON)
    return until.astimezone(timezone.utc) <= now.astimezone(timezone.utc)


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


def pace_factor(
    day_spent: float,
    daily_limit: float,
    hours_left: float,
    window_hours: float = 24.0,
    lo: float = 0.5,
    hi: float = 1.5,
) -> float:
    """Inflator (>1) when under-spent vs elapsed time; deflator (<1) when over-spent.
    Neutral 1.0 when day_spent==0 or daily_limit<=0 so existing tests stay green.
    """
    daily = float(daily_limit or 0)
    if daily <= 0 or float(day_spent) <= 0:
        return 1.0
    elapsed = max(float(window_hours) - float(hours_left), 1.0 / 60.0)
    window = max(float(window_hours), elapsed)
    spent_frac = float(day_spent) / daily
    time_frac = elapsed / window
    if spent_frac < 1e-12:
        return 1.0
    return clamp(time_frac / spent_frac, lo, hi)


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


def pace_failed(
    prev_circuit: Optional[str] = None,
    circuit: Optional[str] = None,
    hour_spent: Optional[float] = None,
    hourly_cap: Optional[float] = None,
) -> bool:
    """True only when pacing was already on (prev HOLD/STASIS) and circuit is still STASIS."""
    if str(circuit or "") != STASIS:
        return False
    prev = str(prev_circuit or "")
    if prev not in (HOLD, STASIS):
        return False
    if hour_spent is None or hourly_cap is None:
        return True
    return float(hour_spent) >= 2.0 * max(float(hourly_cap), 1e-9)


DEFAULT_CONTINGENCY = {
    "auth": {"url": "https://auth.calhegasmorais.pt", "note": "python :8790 JSON hop"},
    "cf-worker-req": {"url": "https://calhegasmorais.pt/", "note": "Pages apex, not Worker SPA"},
    "sandbox": {"url": "https://sandbox.calhegasmorais.pt/", "note": "gnu-atelier Pages"},
}


def _retry_after_sec(hourly_cap: float) -> int:
    return max(30, int(round(3600.0 / max(float(hourly_cap or 0), 1.0))))


def admit(decision_pack, opts: Optional[dict] = None) -> dict:
    """Request-path effector. Never maps STASIS → HTTP 503.

    1. Pace (HOLD/STASIS deflator) on the primary rail.
    2. If pace_failed: fail-open to contingency_url when contingency_ok.
    3. Freeze only if pace_failed AND no healthy contingency (or workers.dev forbidden).
    Freeze is a temporary holding pattern until contingency routes recover.
    """
    opts = opts or {}
    pack = decision_pack if isinstance(decision_pack, dict) else asdict(decision_pack)
    is_p0 = opts["is_p0"] if "is_p0" in opts else bool(pack.get("is_p0"))
    rand = float(opts["rand"]) if "rand" in opts else random.random()
    deflator = float(pack["deflator"]) if pack.get("deflator") is not None else 1.0
    circuit = pack.get("circuit") or ""
    decision = pack.get("decision") or ""
    prev = opts.get("prev_circuit", pack.get("prev_circuit"))
    hour_spent = opts.get("hour_spent", pack.get("hour_spent"))
    hourly_cap = pack.get("hourly_cap")
    failed = pace_failed(
        prev_circuit=prev,
        circuit=circuit or (STASIS if decision == STASIS else circuit),
        hour_spent=hour_spent,
        hourly_cap=hourly_cap,
    )
    c_url = str(pack.get("contingency_url") or "")
    c_ok = bool(pack.get("contingency_ok") and c_url)
    reason = str(pack.get("reason") or "")
    hard_forbidden = is_workers_dev(pack.get("url")) or "workers.dev forbidden" in reason
    rem = pack.get("remaining")
    quota_gone = pack.get("hard_cap") == 0 or rem == 0

    def result(adm, freeze, why, retry=0, via="primary"):
        return {
            "admit": bool(adm),
            "freeze": bool(freeze),
            "retry_after_sec": int(retry),
            "reason": why,
            "via": "contingency" if (adm and c_ok and failed) or via == "contingency" else via,
            "contingency_url": c_url,
        }

    if hard_forbidden:
        return result(False, True, "workers.dev forbidden rail")
    if quota_gone and not is_p0:
        if c_ok:
            return result(True, False, "fail-open contingency (quota gone)", via="contingency")
        return result(False, True, "quota gone; pacing cannot recover today")
    if failed:
        if c_ok:
            return result(True, False, "fail-open contingency after pace_failed", via="contingency")
        if is_p0:
            return result(True, False, P0_BORROW)
        return result(False, True, "pace_failed and no contingency")
    on_hold = circuit == HOLD or decision == HOLD
    on_stasis_pace = (circuit == STASIS or decision == STASIS) and not failed
    if on_hold or on_stasis_pace:
        p = max(0.0, min(1.0, deflator))
        if on_stasis_pace:
            p = min(p, 0.5)
        yes = rand < p
        return result(
            yes, False,
            "pace STASIS min (not freeze)" if on_stasis_pace else "pace HOLD (deflator)",
            retry=0 if yes else _retry_after_sec(hourly_cap or 0),
        )
    return result(True, False, reason or ALLOW)


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


def hours_left_for(
    spec: dict,
    now: Optional[datetime],
    cfg: dict,
    reset_unix: Optional[int] = None,
    reset_iso: Optional[str] = None,
) -> float:
    tz = spec.get("renewal_tz") or cfg.get("timezone") or "Europe/Lisbon"
    renewal = spec.get("renewal_hhmm") or "00:00"
    if reset_unix is not None:
        return hours_until_unix(now, reset_unix)
    if reset_iso:
        return hours_until_iso(now, reset_iso)
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
    pace_factor: float = 1.0
    inflator: float = 1.0
    deflator: float = 1.0
    freeze: bool = False
    pace_failed: bool = False
    contingency_url: str = ""
    contingency_ok: bool = False

    def as_dict(self) -> dict[str, Any]:
        d = asdict(self)
        for k in (
            "hourly_cap", "hours_left", "spendable", "carry", "daily_debt",
            "daily_credit", "next_phase_grant", "density", "signal", "effective_cap",
            "pace_factor", "inflator", "deflator",
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
    remaining_frac: Optional[float] = None,
    reset_iso: Optional[str] = None,
    prev_circuit: Optional[str] = None,
    contingency_url: Optional[str] = None,
    contingency_ok: bool = False,
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
        freeze=False, pace_failed=False,
        contingency_url=str(contingency_url or ""),
        contingency_ok=bool(contingency_ok),
    )

    def V(*args, **kwargs):
        """Stamp freeze without mapping STASIS → 503. First STASIS from ALLOW is pace."""
        merged = dict(extra)
        merged.update(kwargs)
        decision = args[0] if args else merged.get("decision")
        remaining = args[2] if len(args) > 2 else merged.get("remaining")
        reason = args[8] if len(args) > 8 else merged.get("reason") or ""
        hourly_cap = args[4] if len(args) > 4 else merged.get("hourly_cap") or 0
        circ = merged.get("circuit") or ""
        failed = pace_failed(
            prev_circuit=prev_circuit,
            circuit=circ or (decision if decision in (HOLD, STASIS) else ""),
            hour_spent=hour_spent,
            hourly_cap=hourly_cap,
        )
        c_url = merged.get("contingency_url") or ""
        c_ok = bool(merged.get("contingency_ok") and c_url)
        freeze = False
        if is_workers_dev(url) or "workers.dev forbidden" in str(reason):
            freeze = True
        elif spec.get("hard_cap") == 0:
            freeze = True
        elif remaining is not None and float(remaining) <= 0 and not is_p0 and not c_ok:
            freeze = decision == STASIS
        elif failed and not is_p0 and not c_ok:
            freeze = True
        if decision in (ALLOW, P0_BORROW):
            freeze = False
        merged["freeze"] = freeze
        merged["pace_failed"] = failed
        return Verdict(*args, **merged)

    if is_workers_dev(url):
        return V(
            STASIS, rail, 0, 0, 0, 0, 0, cost,
            "workers.dev forbidden — zone WAF does not cover it (INC-1027)",
            **extra,
        )

    until_s = spec.get("stasis_until")
    if until_s and not is_p0:
        try:
            until = datetime.fromisoformat(str(until_s).replace("Z", "+00:00"))
            if until.tzinfo is None:
                until = until.replace(tzinfo=timezone.utc)
            n = now or datetime.now(timezone.utc)
            if n.tzinfo is None:
                n = n.replace(tzinfo=timezone.utc)
            if n.astimezone(timezone.utc) < until.astimezone(timezone.utc):
                return V(
                    STASIS, rail, 0, 0, 0, 0, 0, cost,
                    f"stasis until {until_s}",
                    **extra,
                )
        except (TypeError, ValueError):
            pass

    if spec.get("hard_cap") == 0:
        return V(
            STASIS, rail, 0, 0, 0, 0, 0, cost,
            spec.get("note") or "rail forbidden", **extra,
        )

    if kind == "hard":
        cap = float(spec.get("hard_cap") or spec.get("limit") or 0)
        rem = cap - float(spec.get("used") or 0) if remaining is None else float(remaining)
        if rem <= 0:
            return V(STASIS, rail, rem, 0, 0, 0, 0, cost, f"hard cap {cap} reached", **extra)
        return V(ALLOW, rail, rem, 0, 0, rem, 0, cost, f"hard cap {cap}, remaining {rem}", **extra)

    # Fail closed: expired reset without a live window must HOLD, never a 1-minute dump cap.
    if not is_p0 and reset_unix is not None and reset_is_expired(reset_unix, now):
        rem = float(remaining) if remaining is not None else 0.0
        return V(
            HOLD, rail, rem, 0, 0, 0, 0, cost,
            "expired reset_unix — fail closed (no live refresh)",
            **extra,
        )
    if not is_p0 and reset_iso and reset_iso_expired(reset_iso, now):
        rem = float(remaining) if remaining is not None else 0.0
        return V(
            HOLD, rail, rem, 0, 0, 0, 0, cost,
            "expired reset_iso — fail closed (no live refresh)",
            **extra,
        )

    hours_left = hours_left_for(spec, now, cfg, reset_unix, reset_iso)
    daily = spec.get("daily_limit")
    frac_meter = spec.get("meter") == "remaining_frac" or bool(spec.get("unknown_cost"))
    # SuperGrok-style weekly pool: remaining_frac in [0,1] is remaining (1.0 = full pool).
    # There is no public token count. Do not invent one.
    if remaining_frac is not None:
        remaining = float(remaining_frac)
    if remaining is None:
        if spec.get("unknown_remaining") == "hold" and not is_p0:
            return V(
                HOLD, rail, 0, hours_left, 0, 0, 0, cost,
                "no live remaining sample — do not invent a cap",
                **extra,
            )
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
    day_spent = float(st.get("day_spent") or 0) if st else 0.0
    window_hours = 24.0
    if spec.get("window_sec"):
        window_hours = float(spec["window_sec"]) / 3600.0
    if spec.get("window") == "rolling_hour":
        # rolling hour: the 'day' is the hour window; spec.limit is the daily_limit analogue
        window_hours = 1.0
    pf = pace_factor(
        day_spent,
        float(daily or spec.get("limit") or 0),
        hours_left,
        window_hours,
    )
    extra["pace_factor"] = pf
    extra["inflator"] = max(1.0, pf)
    extra["deflator"] = min(1.0, pf)
    adjusted = hourly_cap * pf
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
        next_phase_grant=adjusted,
        effective_cap=effective_capacity(adjusted, dens, floor),
    )

    trip = circuit_trip(hour_spent, hourly_cap, cfg)
    extra["circuit"] = trip
    if trip == STASIS and not is_p0:
        return V(STASIS, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                       f"circuit STASIS — hour spent {hour_spent} ≥ 2× hourly cap {hourly_cap:.1f} (INC-1027)",
                       **extra)
    if trip == HOLD and not is_p0 and not is_peak:
        return V(HOLD, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                       f"circuit HOLD — hour spent {hour_spent} ≥ 1.25× cap; wait for next phase",
                       **extra)
    if min_interval_hold(last_same_ms, cfg) and not is_p0:
        return V(HOLD, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                       "anti-3Hz: same URL too soon (min 10s)", **extra)
    if dens + 1e-9 < floor and not is_p0 and not is_peak:
        return V(HOLD, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                       f"density {dens:.2f} < floor {floor:.2f} — coalesce or cache; do not spend a thin token",
                       **extra)

    if remaining <= 0 and not is_p0:
        return V(STASIS, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                       "quota exhausted until renewal", **extra)
    if remaining <= 0 and is_p0:
        extra["is_peak"] = True
        extra["is_p0"] = True
        return V(P0_BORROW, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                       "P0 borrows — subsequent phases compensate; no retry-loop", **extra)

    if kind == "slots":
        if is_p0:
            extra["is_p0"] = True
            return V(ALLOW if remaining >= cost else P0_BORROW, rail, remaining, hours_left,
                           hourly_cap, spendable, reserved, cost,
                           "P0 spends; overdraft credited to later phases", **extra)
        if is_peak or slot_id:
            extra["is_peak"] = True
            if remaining >= cost:
                return V(ALLOW, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                               "budgeted slot / reserved peak (may overdraft the hour)", **extra)
            return V(STASIS, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                           "peak has no remaining", **extra)
        if spendable < cost:
            return V(HOLD, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                           f"protect {reserved} reserved slot(s) still ahead", **extra)
        # unscheduled: also respect hourly carry if ledger present (don't dump contingency in one hour)
        if st is not None and carry * pf + 1e-9 < cost and not is_p0:
            return V(HOLD, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                           f"hourly carry {carry:.2f} < cost — wait; subsequent phase will be credited", **extra)
        return V(ALLOW, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                       "unscheduled spend within contingency", **extra)

    # remaining_frac rails: prompt cost is unknown compute, not pool units.
    # Gate on remaining_frac > 0 + circuit. A fire is grok-auto (cost=1 fire).
    # Snapshot uses cost=0 ("is the pool alive"). Never treat cost=1 as 100% of the weekly pool.
    if frac_meter:
        return V(
            ALLOW, rail, remaining, hours_left, hourly_cap, remaining, 0, cost,
            "pool remaining_frac > 0 — unknown prompt cost; fire is grok-auto",
            **extra,
        )

    # rate rails — pace with adjusted hourly; ledger carry is also paced
    allowance = adjusted
    if st is not None:
        allowance = max(0.0, carry * pf)
    if remaining < cost:
        return V(STASIS, rail, remaining, hours_left, hourly_cap, remaining, 0, cost,
                       "remaining < cost", **extra)
    if cost > allowance + 1e-9:
        return V(HOLD, rail, remaining, hours_left, hourly_cap, remaining, 0, cost,
                       f"cost {cost} > phase allowance {allowance:.4f} (pace; overdraft would debit next phase)", **extra)
    return V(ALLOW, rail, remaining, hours_left, hourly_cap, remaining, 0, cost,
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


def live_decide_kwargs(
    name: str,
    spec: dict,
    live: Optional[dict],
    ledger: dict,
    now: datetime,
    cfg: dict,
) -> dict[str, Any]:
    """Bind remaining / hour_spent / reset for decide() from a live sample or a still-valid ledger.

    Never invent remaining. GraphQL/sample failure (live[name].unknown) HOLDs that rail.
    Stale ledger + expired reset_unix is omitted so decide() cannot dump a 1-minute cap.
    Records GraphQL used onto ledger.day_spent so pace_factor can inflate/deflate.
    """
    kwargs: dict[str, Any] = {}
    live = live or {}
    sample = live.get(name)
    live_hit = sample is not None
    if sample is None:
        sample = {}
    explicit_unknown = bool(sample.get("unknown"))
    rails_led = ledger.setdefault("rails", {})
    st_led = rails_led.setdefault(name, {})

    if explicit_unknown:
        # live refresh said unknown — do not fall back to a stale remaining
        pass
    elif live_hit:
        if sample.get("remaining_frac") is not None:
            kwargs["remaining_frac"] = sample["remaining_frac"]
        if "remaining" in sample and sample["remaining"] is not None:
            kwargs["remaining"] = sample["remaining"]
        elif sample.get("remaining_frac") is not None:
            kwargs["remaining"] = sample["remaining_frac"]
        if "reset_unix" in sample and sample["reset_unix"] is not None:
            kwargs["reset_unix"] = sample["reset_unix"]
        if sample.get("reset_iso"):
            kwargs["reset_iso"] = sample["reset_iso"]
        if sample.get("hour_spent") is not None:
            kwargs["hour_spent"] = sample["hour_spent"]
        used = sample.get("used")
        if used is None:
            used = sample.get("day_spent")
        if used is not None:
            st_led["day_spent"] = float(used)
            st_led["day"] = day_key(now, spec, cfg)
    else:
        ru = st_led.get("sampled_reset_unix")
        iso = st_led.get("sampled_reset_iso")
        expired = reset_is_expired(ru, now) or reset_iso_expired(iso, now)
        if expired:
            # fail closed: do not pass remaining or reset (no 1-minute dump cap)
            pass
        else:
            if st_led.get("sampled_remaining_frac") is not None:
                kwargs["remaining_frac"] = st_led["sampled_remaining_frac"]
            if "sampled_remaining" in st_led and "remaining_frac" not in kwargs:
                kwargs["remaining"] = st_led["sampled_remaining"]
            if ru is not None:
                kwargs["reset_unix"] = ru
            if iso:
                kwargs["reset_iso"] = iso
            if st_led.get("sampled_hour_spent") is not None:
                kwargs["hour_spent"] = st_led["sampled_hour_spent"]

    return kwargs


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
        spec = spec or {}
        if spec.get("skip_meter") or spec.get("kind") == "alias":
            alias = spec.get("shares_pool") or spec.get("alias_of")
            rails_out[name] = {
                "decision": "ALIAS",
                "rail": name,
                "shares_pool": alias,
                "reason": spec.get("note") or "alias — does not hold a separate quota",
                "spec_note": spec.get("note"),
                "kind": spec.get("kind"),
                "unit": spec.get("unit"),
                "billing": spec.get("billing"),
                "daily_limit": spec.get("daily_limit"),
                "static_assets_free": spec.get("static_assets_free"),
            }
            continue
        kwargs: dict[str, Any] = {"cfg": cfg, "now": now, "ledger": ledger}
        if spec.get("meter") == "remaining_frac" or spec.get("unknown_cost"):
            kwargs["cost"] = 0.0  # snapshot: is the pool alive; prompt compute is unknown
        bound = live_decide_kwargs(name, spec, live, ledger, now, cfg)
        kwargs.update(bound)
        v = decide(name, **kwargs)
        st = (ledger.get("rails") or {}).get(name) or {}
        out_row = {
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
        if bound.get("hour_spent") is not None:
            out_row["hour_spent"] = bound["hour_spent"]
        rails_out[name] = out_row
    slots = []
    for s in cfg.get("slots") or []:
        v = decide(s["rail"], now=now, is_peak=bool(s.get("peak")), slot_id=s["id"], cfg=cfg,
                   remaining=rails_out.get(s["rail"], {}).get("remaining"), ledger=ledger)
        slots.append({**s, "verdict": v.decision, "reason": v.reason, "carry": round(v.carry, 4)})
    debts = {k: v["daily_debt"] for k, v in rails_out.items() if v.get("daily_debt")}
    carries = {k: v["carry"] for k, v in rails_out.items() if v.get("carry") not in (0, 0.0, None)}
    return {
        "schema": "stratamesh.metabolism.v1.3",
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
        "hourly_cap_after_refill": (rails_out.get("cf-worker-req") or {}).get("hourly_cap"),
        "effective_worker_facts_per_hour": effective_capacity(
            float((rails_out.get("cf-worker-req") or {}).get("hourly_cap") or 0),
            float((cfg.get("density") or {}).get("target_density") or 8),
        ),
    }



# --- per-hop metabol_pace (complementary mesh, not one CF clock) ---
HOP_PACE = {
    "fog": {"kind": "host", "port": 8787, "cf_daily": False, "note": "FOG instrument; host_cap only"},
    "workerd": {
        "kind": "cf-worker", "port": 8788, "rail": "cf-worker-req",
        "daily_limit": 100000, "renewal_hhmm": "00:00", "renewal_tz": "UTC",
        "note": "CF Workers 100k/day reset 00:00 UTC; never workers.dev",
    },
    "python": {"kind": "local", "port": 8790, "rail": "hop-python", "cf_daily": False, "note": "local py; host cap only"},
    "node": {"kind": "local", "port": 8791, "rail": "hop-node", "cf_daily": False, "note": "local node; host cap only"},
    "deno": {"kind": "local", "port": 8792, "rail": "hop-deno-local", "cf_daily": False, "note": "local Deno :8792; host cap only"},
    "deno-deploy": {
        "kind": "allow-fallback", "rail": "hop-deno-deploy", "cf_daily": False,
        "note": "Deno Deploy Free is ALLOW fallback only",
    },
    "kv": {
        "kind": "cf-kv", "rail": "cf-kv-writes", "daily_limit": 1000,
        "renewal_hhmm": "00:00", "renewal_tz": "UTC",
        "note": "KV 1000 writes/day UTC; separate from Worker 100k",
    },
    "pages": {
        "kind": "pages-html", "rail": "cf-pages", "outside_worker_bucket": True,
        "note": "Pages HTML outside Worker bucket; never SPA catch-all",
    },
    "cf-auth": {"kind": "cf-worker", "rail": "cf-worker-req", "p0": True, "note": "CF auth only if ALLOW"},
    "cf-deomail": {"kind": "cf-worker", "rail": "deomail", "note": "CF deomail only if ALLOW"},
}

HOP_ALIASES = {
    "8787": "fog", "fog": "fog",
    "8788": "workerd", "workerd": "workerd", "cf": "workerd", "workers": "workerd",
    "8790": "python", "python": "python", "py": "python", "mw": "python",
    "8791": "node", "node": "node",
    "8792": "deno", "deno": "deno", "deno-local": "deno",
    "deno-deploy": "deno-deploy", "deploy": "deno-deploy",
    "kv": "kv", "cf-kv": "kv", "cf-kv-writes": "kv",
    "pages": "pages", "html": "pages", "cf-pages": "pages",
    "cf-auth": "cf-auth", "auth": "python",
    "cf-deomail": "cf-deomail", "deomail": "cf-deomail",
}

COMPLEMENTARY_ROUTES = {
    "auth_wb_session": ["python:8790", "node:8791", "deno:8792", "cf-auth:ALLOW", "frontend/maintenance-1xxx.html"],
    "compose_assemble_desk": ["node:8791", "python:8790", "deno:8792", "cf-pages:ALLOW", "frontend/maintenance-1xxx.html"],
    "object_cid_mail": ["deno:8792", "python:8790", "node:8791", "cf-deomail:ALLOW", "frontend/maintenance-1xxx.html"],
    "html_atelier": ["node:8791/atelier", "python:8790", "workerd:8788", "cf-pages:ALLOW", "frontend/maintenance-1xxx.html"],
    "html": ["pages", "node:8791/atelier", "python:8790", "workerd:8788", "frontend/maintenance-1xxx.html"],
    "metabol_origin": ["workerd:8788", "python:8790", "node:8791", "cf-metabol:ALLOW", "frontend/maintenance-1xxx.html"],
}


def resolve_hop(hop) -> str:
    s = str(hop or "").strip().lower().split("/")[0]
    if not s:
        return ""
    if ":" in s:
        left, right = s.split(":", 1)
        left, right = left.strip(), right.strip()
        if left in HOP_ALIASES:
            return HOP_ALIASES[left]
        if right in HOP_ALIASES:
            return HOP_ALIASES[right]
        if left.isdigit():
            return HOP_ALIASES.get(left, left)
        return HOP_ALIASES.get(left, left)
    return HOP_ALIASES.get(s, s)


def metabol_pace(
    hop,
    *,
    host_over: bool = False,
    remaining: Optional[float] = None,
    day_spent: float = 0,
    hour_spent: float = 0,
    now: Optional[datetime] = None,
    is_p0: bool = False,
    cfg: Optional[dict] = None,
    cost: float = 1,
    path: str = "",
    **kwargs,
) -> dict:
    """Per-hop pace. Each hop has its own renewal/quota/burn_rate.

    python/node/local Deno have no CF daily clock (host_cap only).
    HOLD/STASIS is pace not freeze. login/auth must not 503 because CF decide() is STASIS.
    Never workers.dev. Deno Deploy Free is ALLOW fallback only.
    """
    key = resolve_hop(hop)
    spec = dict(HOP_PACE.get(key) or {})
    p0 = bool(is_p0)
    pl = str(path or "").split("?")[0].lower()
    if pl.endswith("/login") or pl.endswith("/verify") or pl.endswith("/health") or "/api/auth" in pl or "/api/wb" in pl:
        p0 = True
    base = {
        "hop": key,
        "port": spec.get("port"),
        "kind": spec.get("kind") or "unknown",
        "cf_daily": bool(spec.get("cf_daily")),
        "rail": spec.get("rail"),
        "renewal_hhmm": spec.get("renewal_hhmm"),
        "renewal_tz": spec.get("renewal_tz"),
        "daily_limit": spec.get("daily_limit"),
        "outside_worker_bucket": bool(spec.get("outside_worker_bucket")),
        "freeze": False,
        "http_503": False,
        "is_p0": p0,
        "note": spec.get("note") or "",
        "routes": COMPLEMENTARY_ROUTES,
    }
    if not spec:
        base.update({"decision": HOLD, "reason": "unknown hop — fail closed pace", "pace": True})
        return base
    if spec.get("kind") in ("local", "host"):
        if host_over:
            base.update({"decision": HOLD, "reason": "host_cap pace (not freeze)", "pace": True})
            return base
        base.update({"decision": ALLOW, "reason": "local hop — no CF daily clock", "pace": False})
        return base
    if spec.get("kind") == "allow-fallback":
        base.update({"decision": ALLOW, "reason": "Deno Deploy Free ALLOW fallback only", "pace": False, "fallback_only": True})
        return base
    if spec.get("kind") == "pages-html":
        base.update({
            "decision": ALLOW,
            "reason": "Pages HTML outside Worker 100k bucket",
            "pace": False,
            "outside_worker_bucket": True,
            "cf_daily": False,
        })
        return base
    rail = spec.get("rail") or "cf-worker-req"
    rem = remaining
    if rem is None and spec.get("daily_limit") is not None:
        rem = max(0.0, float(spec["daily_limit"]) - float(day_spent or 0))
    v = decide(
        rail,
        remaining=rem,
        hour_spent=hour_spent,
        now=now,
        cost=cost,
        is_p0=p0,
        cfg=cfg,
        **{k: kwargs[k] for k in kwargs if k in ("url", "prev_circuit", "contingency_url", "contingency_ok", "ledger", "day_spent")},
    )
    pack = v.as_dict() if hasattr(v, "as_dict") else dict(v)
    gate = admit(pack, {"is_p0": p0, "rand": kwargs.get("rand", 1.0), "hour_spent": hour_spent})
    pack.update(base)
    pack["decision"] = pack.get("decision") or v.decision
    pack["admit"] = gate.get("admit")
    pack["freeze"] = bool(gate.get("freeze")) and not p0
    pack["http_503"] = False if p0 else bool(gate.get("freeze"))
    pack["pace"] = pack.get("decision") in (HOLD, STASIS) and not pack["freeze"]
    pack["reason"] = gate.get("reason") or pack.get("reason")
    if p0:
        pack["freeze"] = False
        pack["http_503"] = False
        pack["admit"] = True
        pack["reason"] = (pack.get("reason") or "") + " · login/auth P0 never 503 on CF STASIS"
    return pack


def mesh_map() -> dict:
    return {
        "fog": 8787,
        "ipc": {"workerd": 8788, "python": 8790, "node": 8791, "deno": 8792},
        "routes": COMPLEMENTARY_ROUTES,
        "tunnel": {
            "auth/mw": "127.0.0.1:8790",
            "fog/origin/gossip": "127.0.0.1:8788",
            "reload": "SIGHUP",
        },
        "never": ["workers.dev", "Worker PUT on hot path", "pkill cloudflared", "SPA catch-all"],
        "hops": {k: {kk: vv for kk, vv in spec.items()} for k, spec in HOP_PACE.items()},
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
