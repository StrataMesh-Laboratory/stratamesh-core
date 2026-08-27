#!/usr/bin/env python3
"""Metabolic stasis — remaining / hours_until_renewal, all rails.

Lab · Node · StrataMesh share one circadian budget. Discrete Grok fires use
slot reservation (peaks 09:00 / 18:00 / 23:00 Lisbon). Continuous APIs use
hourly_cap = remaining / hours_left. Never add a 6th Cloudflare cron.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
RAILS_PATH = ROOT / "config" / "rails.json"

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
    """Hours until the next renewal instant in tz_name (minimum 1 minute)."""
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
    """Assume a budgeted slot has fired once we are grace_min past its hhmm."""
    local = as_tz(now, cfg.get("timezone") or "Europe/Lisbon")
    now_m = minutes_of_day(local)
    spent = 0.0
    for s in cfg.get("slots") or []:
        if s.get("rail") != rail:
            continue
        if now_m >= hhmm_minutes(s["hhmm"]) + grace_min:
            spent += float(s.get("cost") or 1)
    return spent


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

    def as_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["hourly_cap"] = round(self.hourly_cap, 4)
        d["hours_left"] = round(self.hours_left, 4)
        d["spendable"] = round(self.spendable, 4)
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
) -> Verdict:
    cfg = cfg or load_rails()
    spec = (cfg.get("rails") or {}).get(rail) or {}
    layer = spec.get("layer") or ""
    kind = spec.get("kind") or "rate"
    tz = spec.get("renewal_tz") or cfg.get("timezone") or "Europe/Lisbon"
    renewal = spec.get("renewal_hhmm") or "00:00"

    if spec.get("hard_cap") == 0:
        return Verdict(
            STASIS, rail, 0, 0, 0, 0, 0, cost,
            spec.get("note") or "rail forbidden",
            layer=layer, is_peak=is_peak, is_p0=is_p0,
        )

    if kind == "hard":
        cap = float(spec.get("hard_cap") or spec.get("limit") or 0)
        used = float(spec.get("used") or 0)
        rem = cap - used if remaining is None else float(remaining)
        if rem <= 0:
            return Verdict(STASIS, rail, rem, 0, 0, 0, 0, cost,
                           f"hard cap {cap} reached", layer=layer)
        return Verdict(ALLOW, rail, rem, 0, 0, rem, 0, cost,
                       f"hard cap {cap}, remaining {rem}", layer=layer)

    if reset_unix is not None:
        hours_left = hours_until_unix(now, reset_unix)
    elif spec.get("window") == "rolling_hour":
        hours_left = 1.0
    elif spec.get("window_sec"):
        hours_left = max(float(spec["window_sec"]) / 3600.0, 1.0 / 60.0)
    else:
        hours_left = hours_until_renewal(now, renewal, tz)

    daily = spec.get("daily_limit")
    if remaining is None:
        if kind == "slots" and daily is not None:
            remaining = max(0.0, float(daily) - estimated_spent_slots(cfg, now, rail))
        else:
            remaining = float(daily or spec.get("limit") or 0)

    remaining = float(remaining)
    hourly_cap = remaining / hours_left if hours_left else remaining

    reserved = 0.0
    if kind == "slots":
        reserved = reserved_ahead(cfg, now, rail, exclude_id=slot_id if (is_peak or slot_id) else None)
        if is_peak or slot_id:
            reserved = reserved_ahead(cfg, now, rail, exclude_id=slot_id)
    spendable = remaining - reserved

    if remaining <= 0 and not is_p0:
        return Verdict(STASIS, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                       "quota exhausted until renewal", layer=layer, is_peak=is_peak, is_p0=is_p0)
    if remaining <= 0 and is_p0:
        return Verdict(P0_BORROW, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                       "P0 borrows past empty pool — still no retry-loop", layer=layer, is_peak=True, is_p0=True)

    if kind == "slots":
        if is_p0:
            return Verdict(ALLOW if remaining >= cost else P0_BORROW, rail, remaining, hours_left,
                           hourly_cap, spendable, reserved, cost,
                           "P0 spends even if it trims a later peak", layer=layer, is_peak=is_peak, is_p0=True)
        if is_peak or slot_id:
            if remaining >= cost:
                return Verdict(ALLOW, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                               "budgeted slot / reserved peak", layer=layer, is_peak=True)
            return Verdict(STASIS, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                           "peak has no remaining", layer=layer, is_peak=True)
        if spendable < cost:
            return Verdict(HOLD, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                           f"protect {reserved} reserved slot(s) still ahead", layer=layer)
        return Verdict(ALLOW, rail, remaining, hours_left, hourly_cap, spendable, reserved, cost,
                       "unscheduled spend within contingency", layer=layer)

    # rate rails: this hour may spend at most hourly_cap
    if remaining < cost:
        return Verdict(STASIS, rail, remaining, hours_left, hourly_cap, remaining, 0, cost,
                       "remaining < cost", layer=layer)
    if cost > hourly_cap + 1e-9:
        return Verdict(HOLD, rail, remaining, hours_left, hourly_cap, remaining, 0, cost,
                       f"cost {cost} > hourly_cap {hourly_cap:.4f} (pace until renewal)", layer=layer)
    return Verdict(ALLOW, rail, remaining, hours_left, hourly_cap, remaining, 0, cost,
                   "within hourly average", layer=layer)


def monitor_interval_sec(now: Optional[datetime] = None, cfg: Optional[dict] = None) -> int:
    cfg = cfg or load_rails()
    spec = (cfg.get("rails") or {}).get("local-monitor") or {}
    night = int(spec.get("night_interval_sec") or 900)
    day = int(spec.get("day_interval_sec") or 300)
    return night if is_night(now, spec) else day


def snapshot(now: Optional[datetime] = None, live: Optional[dict] = None, cfg: Optional[dict] = None) -> dict:
    """Full metabolic picture for dashboard / handoff."""
    cfg = cfg or load_rails()
    live = live or {}
    now = now or datetime.now(timezone.utc)
    lisbon = as_tz(now, cfg.get("timezone") or "Europe/Lisbon")
    rails_out = {}
    for name, spec in (cfg.get("rails") or {}).items():
        kwargs: dict[str, Any] = {"cfg": cfg, "now": now}
        if name in live:
            if "remaining" in live[name]:
                kwargs["remaining"] = live[name]["remaining"]
            if "reset_unix" in live[name]:
                kwargs["reset_unix"] = live[name]["reset_unix"]
        v = decide(name, **kwargs)
        rails_out[name] = {**v.as_dict(), "spec_note": spec.get("note"), "kind": spec.get("kind"),
                           "unit": spec.get("unit"), "daily_limit": spec.get("daily_limit") or spec.get("limit") or spec.get("hard_cap")}
    slots = []
    for s in cfg.get("slots") or []:
        v = decide(s["rail"], now=now, is_peak=bool(s.get("peak")), slot_id=s["id"], cfg=cfg,
                   remaining=rails_out.get(s["rail"], {}).get("remaining"))
        slots.append({**s, "verdict": v.decision, "reason": v.reason})
    return {
        "schema": "stratamesh.metabolism.v1",
        "at": now.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "lisbon": lisbon.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "hour_lisbon": lisbon.hour,
        "night": is_night(now, (cfg.get("rails") or {}).get("local-monitor")),
        "monitor_interval_sec": monitor_interval_sec(now, cfg),
        "cf_cron_hard_cap": cfg.get("cf_cron_hard_cap"),
        "formula": cfg.get("formula"),
        "rails": rails_out,
        "slots": slots,
        "lab_honest": True,
        "no_sixth_cron": True,
    }


def main(argv: Optional[list[str]] = None) -> int:
    import sys
    argv = argv if argv is not None else sys.argv[1:]
    snap = snapshot()
    if argv and argv[0] == "--pretty":
        print(json.dumps(snap, indent=2))
    else:
        print(json.dumps(snap, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
