"""Edge residual contribution: C_mesh = f(1-U).

Fog contributes capacity installed on purpose.
Edge has a primary job (this phone, this iPad, this session). It offers only
what is left after that job, safety, energy and thermal.

U ↑ ⇒ C_mesh ↓. Not a miner. Indexed to a parent Fog — not an independent Fog.
Continuity is session (expected). Lab constants — not mainnet.
"""
from __future__ import annotations

from typing import Any

VERSION = "0.3.1"
CAP_LAB = 1.0
BATTERY_FLOOR = 0.20
DUTY_FOREGROUND = 1.0
DUTY_BACKGROUND = 0.25
W_CPU, W_BATT, W_THERM, W_NET, W_FG = 0.35, 0.25, 0.15, 0.15, 0.10
THERMAL_MAP = {
    "nominal": 0.0,
    "fair": 0.33,
    "serious": 0.72,
    "critical": 1.0,
}


def clip(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return lo if x < lo else hi if x > hi else x


def utilisation(sample: dict[str, Any]) -> dict[str, float | bool | str]:
    cpu = clip(float(sample.get("cpu") or 0.0))
    battery = clip(float(sample.get("battery") if sample.get("battery") is not None else 1.0))
    batt_stress = 1.0 - battery
    thermal_name = str(sample.get("thermal") or "nominal").lower()
    thermal = THERMAL_MAP.get(thermal_name, 0.0)
    net = clip(float(sample.get("net") or 0.0))
    foreground = bool(sample.get("foreground", True))
    low_power = bool(sample.get("low_power", False))
    constrained = bool(sample.get("constrained_network", False))
    u = clip(
        W_CPU * cpu
        + W_BATT * batt_stress
        + W_THERM * thermal
        + W_NET * net
        + W_FG * (0.0 if foreground else 1.0)
    )
    blocked = (
        battery < BATTERY_FLOOR
        or low_power
        or thermal_name in ("serious", "critical")
        or constrained
    )
    return {
        "U": round(u, 4),
        "cpu": round(cpu, 4),
        "battery": round(battery, 4),
        "batt_stress": round(batt_stress, 4),
        "thermal": thermal,
        "thermal_name": thermal_name,
        "net": round(net, 4),
        "foreground": foreground,
        "low_power": low_power,
        "constrained_network": constrained,
        "blocked": blocked,
    }


def c_mesh(sample: dict[str, Any], cap: float = CAP_LAB) -> dict[str, Any]:
    u = utilisation(sample)
    residual = max(0.0, 1.0 - float(u["U"]))
    duty = DUTY_FOREGROUND if u["foreground"] else DUTY_BACKGROUND
    if u["blocked"]:
        value = 0.0
        why = "safety_clamp"
    else:
        value = round(residual * duty * float(cap), 6)
        why = "residual"
    return {
        "ok": True,
        "role": "edge",
        "formula": "C_mesh = (1-U) * duty * cap, 0 if safety",
        "version": VERSION,
        "lab": True,
        "not_mainnet": True,
        "C_mesh": value,
        "residual": round(residual, 4),
        "duty": duty,
        "cap": float(cap),
        "why": why,
        "utilisation": u,
        "note": "U is primary-job utilisation, not spare FLOPs. Indexed Edge, not a Fog.",
    }
