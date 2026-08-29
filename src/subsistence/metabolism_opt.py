"""Optional on-graph metabolism adapter for STRATA object spend.

Lab only. Opt-in. Not exclusive. Not a mint.
Default Proof of Subsistence (meter / ledger / policy / runtime) stays
valid without this module. Fog NODE_WALLET is treasury, not a citizen rail.

If ops-monitor.lib.metabolism (or a v1.3 copy with pace_factor) can be
imported, decide() is delegated there. Otherwise a stdlib thin adapter
implements remaining/hours_left * pace_factor. Never imports Workers JS.
Never GETs workers.dev.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Optional

from .policy import PressureAction, SubsistencePolicy

ALLOW = "ALLOW"
HOLD = "HOLD"
STASIS = "STASIS"
P0_BORROW = "P0_BORROW"

NFT_FLOOR = 0.1

OPT_IN_STRINGS = frozenset({"metabolism", "metabolism.v1.3", "true", "1", "yes"})

NFT_KINDS = frozenset({
    "nft",
    "nft-collateral",
    "strata-nft-collateral",
    "strata_nft_collateral",
})
WALLET_KINDS = frozenset({
    "acb",
    "acb-pos-wallet",
    "acb_pos_wallet",
    "node-user",
    "node-user-consume",
    "node_user_consume",
    "wallet",
})
# Treasury infrastructure — never a citizen consume rail.
FOG_TREASURY_KINDS = frozenset({
    "fog",
    "fog-treasury",
    "node_wallet",
    "node-wallet",
    "NODE_WALLET",
    "fog-node-wallet",
})

ON_GRAPH_RAIL_SPECS = {
    "strata-nft-collateral": {
        "layer": "lab",
        "kind": "rate",
        "billing": "strata",
        "unit": "strata",
        "optional": True,
        "exclusive": False,
        "floor": NFT_FLOOR,
        "phase": "hour",
        "debt_persists_across_renewal": True,
        "note": "preserve collateral until renewal; floor 0.1 reserved; not exclusive vs redeem/liquidate",
    },
    "acb-pos-wallet": {
        "layer": "lab",
        "kind": "rate",
        "billing": "strata",
        "unit": "strata",
        "optional": True,
        "exclusive": False,
        "subject": "ACB",
        "object": "STRATA wallet",
        "phase": "hour",
        "debt_persists_across_renewal": True,
        "note": "PdS consume + other costs; not a mint",
    },
    "node-user-consume": {
        "layer": "lab",
        "kind": "rate",
        "billing": "strata",
        "unit": "strata",
        "optional": True,
        "exclusive": False,
        "subject": "registered node user",
        "object": "STRATA consumption",
        "phase": "hour",
        "debt_persists_across_renewal": True,
        "note": "subject spends object; not Fog treasury",
    },
}


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def pace_factor(
    day_spent: float,
    daily_limit: float,
    hours_left: float,
    window_hours: float = 24.0,
    lo: float = 0.5,
    hi: float = 1.5,
) -> float:
    """Inflator (>1) when under-spent vs elapsed; deflator (<1) when over-spent.
    Neutral 1.0 when day_spent==0 or daily_limit<=0.
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
    return _clamp(time_frac / spent_frac, lo, hi)


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
    pace_factor: float = 1.0
    inflator: float = 1.0
    deflator: float = 1.0
    circuit: str = ""
    is_peak: bool = False
    is_p0: bool = False

    def as_dict(self) -> dict[str, Any]:
        return {
            "decision": self.decision,
            "rail": self.rail,
            "remaining": round(float(self.remaining), 4),
            "hours_left": round(float(self.hours_left), 4),
            "hourly_cap": round(float(self.hourly_cap), 4),
            "spendable": round(float(self.spendable), 4),
            "reserved": round(float(self.reserved), 4),
            "cost": float(self.cost),
            "reason": self.reason,
            "pace_factor": round(float(self.pace_factor), 4),
            "circuit": self.circuit,
        }


def _is_workers_dev(url: Optional[str]) -> bool:
    if not url:
        return False
    return "workers.dev" in str(url).lower()


def _thin_decide(
    rail: str,
    remaining: Optional[float] = None,
    now: Optional[datetime] = None,  # noqa: ARG001 — signature parity with ops-monitor
    cost: float = 1.0,
    is_peak: bool = False,
    is_p0: bool = False,
    slot_id: Optional[str] = None,  # noqa: ARG001
    reset_unix: Optional[int] = None,
    cfg: Optional[dict] = None,  # noqa: ARG001
    ledger: Optional[dict] = None,  # noqa: ARG001
    signal: float = 1.0,  # noqa: ARG001
    url: Optional[str] = None,
    hour_spent: Optional[float] = None,
    last_same_ms: Optional[float] = None,  # noqa: ARG001
    hours_left: Optional[float] = None,
    day_spent: float = 0.0,
    daily_limit: float = 0.0,
    window_hours: float = 24.0,
    **_kw: Any,
) -> Verdict:
    """Stdlib decide: remaining/hours_left * pace_factor. No ROOT, no rails.json."""
    extra_pf = 1.0
    if _is_workers_dev(url):
        return Verdict(
            STASIS, rail, 0, 0, 0, 0, 0, cost,
            "workers.dev forbidden — zone WAF does not cover it (INC-1027)",
        )

    rem = float(remaining if remaining is not None else 0.0)
    if hours_left is None and reset_unix is not None:
        n = now or datetime.now(timezone.utc)
        if n.tzinfo is None:
            n = n.replace(tzinfo=timezone.utc)
        hours_left = max(
            (datetime.fromtimestamp(int(reset_unix), tz=timezone.utc) - n.astimezone(timezone.utc)).total_seconds() / 3600.0,
            1.0 / 60.0,
        )
    hl = max(float(hours_left if hours_left is not None else 1.0), 1.0 / 60.0)
    hourly_cap = rem / hl if hl else rem
    pf = pace_factor(day_spent, daily_limit, hl, window_hours)
    extra_pf = pf
    adjusted = hourly_cap * pf
    spendable = rem

    def _v(decision: str, reason: str, circuit: str = "") -> Verdict:
        return Verdict(
            decision, rail, rem, hl, hourly_cap, spendable, 0.0, cost, reason,
            pace_factor=extra_pf,
            inflator=max(1.0, extra_pf),
            deflator=min(1.0, extra_pf),
            circuit=circuit,
            is_peak=is_peak,
            is_p0=is_p0,
        )

    # Circuit on UNADJUSTED hourly_cap — inflator cannot bypass the window.
    if hour_spent is not None:
        cap = max(float(hourly_cap), 1e-9)
        spent = float(hour_spent)
        if spent >= cap * 2.0 and not is_p0:
            return _v(STASIS, f"circuit STASIS — hour spent {hour_spent} ≥ 2× hourly cap {hourly_cap:.4f}", STASIS)
        if spent >= cap * 1.25 and not is_p0 and not is_peak:
            return _v(HOLD, f"circuit HOLD — hour spent {hour_spent} ≥ 1.25× cap; wait for next phase", HOLD)

    if rem <= 0 and not is_p0:
        return _v(STASIS, "quota exhausted until renewal")
    if rem <= 0 and is_p0:
        return _v(P0_BORROW, "P0 borrows — subsequent phases compensate; no retry-loop")
    if rem < cost and not is_peak and not is_p0:
        return _v(STASIS, "remaining < cost")
    if rem < cost and is_p0:
        return _v(P0_BORROW, "P0 borrows — remaining < cost")

    # Peaks (SPA execute, user-initiated) may overdraft the hour.
    if is_peak or is_p0:
        if rem >= cost:
            return _v(ALLOW, "budgeted peak / P0 (may overdraft the hour)")
        return _v(STASIS, "peak has no remaining")

    if cost > adjusted + 1e-9:
        return _v(
            HOLD,
            f"cost {cost} > phase allowance {adjusted:.4f} (pace; overdraft would debit next phase)",
        )
    return _v(ALLOW, "within hourly average + pace_factor")


def _try_import_ops_decide() -> Optional[Callable[..., Any]]:
    """Prefer a v1.3 metabolism with pace_factor. Never import Workers JS."""
    import importlib.util

    candidates = [
        Path("/tmp/metab/ops-monitor_lib_metabolism.py"),
        Path("/tmp/metab/metabolism.py"),
        Path("/home/box/ops-monitor/lib/metabolism.py"),
        Path(__file__).resolve().parents[2] / "ops-monitor" / "lib" / "metabolism.py",
        Path("/workspace/ops-monitor/lib/metabolism.py"),
    ]
    for p in candidates:
        try:
            if not p.is_file():
                continue
            spec = importlib.util.spec_from_file_location("_metab_decide_src", p)
            if spec is None or spec.loader is None:
                continue
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            if hasattr(mod, "pace_factor") and hasattr(mod, "decide"):
                return mod.decide  # type: ignore[no-any-return]
        except Exception:
            continue
    try:
        from opsmonitor.lib.metabolism import decide as d, pace_factor as pf  # type: ignore
        if pf is not None:
            return d
    except Exception:
        pass
    return None


_OPS_DECIDE = _try_import_ops_decide()


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
    hours_left: Optional[float] = None,
    day_spent: float = 0.0,
    daily_limit: float = 0.0,
    **kw: Any,
) -> Any:
    """Delegate to ops-monitor decide() when it has pace_factor; else thin adapter.

    Always pass cfg so ops-monitor does not need ROOT/rails.json.
    hours_left is converted to reset_unix for the ops-monitor signature.
    """
    if hours_left is not None and reset_unix is None:
        n = now or datetime.now(timezone.utc)
        if n.tzinfo is None:
            n = n.replace(tzinfo=timezone.utc)
        now = n
        reset_unix = int((n + timedelta(hours=float(hours_left))).timestamp())

    if _OPS_DECIDE is not None:
        if cfg is None:
            rails = dict(ON_GRAPH_RAIL_SPECS)
            if rail not in rails:
                rails[rail] = {"layer": "lab", "kind": "rate", "billing": "strata", "optional": True, "exclusive": False}
            cfg = {"timezone": "Europe/Lisbon", "rails": rails}
        try:
            return _OPS_DECIDE(
                rail,
                remaining=remaining,
                now=now,
                cost=cost,
                is_peak=is_peak,
                is_p0=is_p0,
                slot_id=slot_id,
                reset_unix=reset_unix,
                cfg=cfg,
                ledger=ledger,
                signal=signal,
                url=url,
                hour_spent=hour_spent,
                last_same_ms=last_same_ms,
            )
        except TypeError:
            # Older decide() without url= — still try, then fall through.
            try:
                return _OPS_DECIDE(
                    rail,
                    remaining=remaining,
                    now=now,
                    cost=cost,
                    is_peak=is_peak,
                    is_p0=is_p0,
                    reset_unix=reset_unix,
                    cfg=cfg,
                    ledger=ledger,
                )
            except Exception:
                pass
        except Exception:
            pass

    return _thin_decide(
        rail,
        remaining=remaining,
        now=now,
        cost=cost,
        is_peak=is_peak,
        is_p0=is_p0,
        slot_id=slot_id,
        reset_unix=reset_unix,
        cfg=cfg,
        ledger=ledger,
        signal=signal,
        url=url,
        hour_spent=hour_spent,
        last_same_ms=last_same_ms,
        hours_left=hours_left,
        day_spent=day_spent,
        daily_limit=daily_limit,
        **kw,
    )


def opted_in(meta: Any) -> bool:
    """True if meta/spend_policy in {metabolism, metabolism.v1.3, true}."""
    if meta is True:
        return True
    if meta is False or meta is None:
        return False
    if isinstance(meta, (int, float)) and not isinstance(meta, bool):
        return meta == 1
    if isinstance(meta, str):
        return meta.strip().lower() in OPT_IN_STRINGS
    if isinstance(meta, dict):
        if "spend_policy" in meta:
            return opted_in(meta.get("spend_policy"))
        inner = meta.get("meta")
        if inner is not None and inner is not meta:
            return opted_in(inner)
        if "metabolism" in meta:
            return opted_in(meta.get("metabolism"))
    return False


def remaining_for(
    kind: str,
    wallet: Optional[float] = None,
    collateral: Optional[float] = None,
    floor: float = NFT_FLOOR,
) -> float:
    """Spendable remaining for a rail kind.

    NFT: collateral minus floor 0.1 (reserved).
    Wallet (ACB / node-user): wallet STRATA.
    Fog treasury kinds: 0 (not a citizen rail).
    """
    k = str(kind or "")
    kl = k.lower().replace("_", "-")
    if k in FOG_TREASURY_KINDS or kl in {x.lower().replace("_", "-") for x in FOG_TREASURY_KINDS}:
        return 0.0
    if kl in NFT_KINDS or "nft" in kl:
        col = float(collateral or 0.0)
        return max(0.0, col - float(floor))
    return max(0.0, float(wallet or 0.0))


def verdict_to_action(decision: Any) -> PressureAction:
    """Map decide() verdict onto PoSbs pressure. Does not replace policy.py."""
    if isinstance(decision, PressureAction):
        return decision
    d = decision
    if hasattr(decision, "decision"):
        d = decision.decision
    key = str(d or "").upper()
    if key == ALLOW:
        return PressureAction.NONE
    if key == HOLD:
        return PressureAction.OPTIMIZE
    if key == STASIS:
        return PressureAction.HIBERNATE
    if key == P0_BORROW:
        # Consume one grace tick — same pressure as policy.py's insolvency grace.
        return PressureAction.OPTIMIZE
    return PressureAction.NONE


@dataclass
class GateResult:
    decision: str
    action: PressureAction
    remaining: float
    hours_left: float
    hourly_cap: float
    adjusted: float
    pace_factor: float
    cost: float
    reason: str
    opted_in: bool
    granted: bool
    kind: str
    spendable: float = 0.0
    grant: float = 0.0
    circuit: str = ""
    verdict: Any = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "decision": self.decision,
            "action": self.action.value,
            "remaining": self.remaining,
            "hours_left": self.hours_left,
            "hourly_cap": self.hourly_cap,
            "adjusted": self.adjusted,
            "pace_factor": self.pace_factor,
            "cost": self.cost,
            "reason": self.reason,
            "opted_in": self.opted_in,
            "granted": self.granted,
            "kind": self.kind,
            "spendable": self.spendable,
            "grant": self.grant,
        }


def consume_grace_tick(policy: Optional[SubsistencePolicy] = None, grace_remaining: Optional[int] = None) -> int:
    """P0_BORROW consumes one grace tick (policy.max_grace_ticks window)."""
    pol = policy or SubsistencePolicy()
    if grace_remaining is None:
        grace_remaining = pol.max_grace_ticks
    return max(0, int(grace_remaining) - 1)


def gate_spend(
    meta: Any = None,
    kind: str = "acb-pos-wallet",
    wallet: Optional[float] = None,
    collateral: Optional[float] = None,
    floor: float = NFT_FLOOR,
    hours_left: Optional[float] = None,
    cost: float = 1.0,
    is_peak: bool = False,
    is_p0: bool = False,
    url: Optional[str] = None,
    hour_spent: Optional[float] = None,
    day_spent: float = 0.0,
    daily_limit: float = 0.0,
    now: Optional[datetime] = None,
    cfg: Optional[dict] = None,
    ledger: Optional[dict] = None,
    **kw: Any,
) -> GateResult:
    """Pace an opted-in STRATA spend. If not opted_in, always ALLOW (exclusive-off)."""
    rem = remaining_for(kind, wallet=wallet, collateral=collateral, floor=floor)
    hl = max(float(hours_left if hours_left is not None else 1.0), 1.0 / 60.0)
    hourly_cap = rem / hl if hl else rem

    if not opted_in(meta):
        return GateResult(
            decision=ALLOW,
            action=PressureAction.NONE,
            remaining=rem,
            hours_left=hl,
            hourly_cap=hourly_cap,
            adjusted=hourly_cap,
            pace_factor=1.0,
            cost=float(cost),
            reason="opt-out: exclusive-off; default PoSbs / SPA / redeem unchanged",
            opted_in=False,
            granted=True,
            kind=str(kind),
            spendable=rem,
            grant=hourly_cap,
        )

    kl = str(kind or "").lower().replace("_", "-")
    if kl in {x.lower().replace("_", "-") for x in FOG_TREASURY_KINDS} or str(kind) in FOG_TREASURY_KINDS:
        return GateResult(
            decision=STASIS,
            action=PressureAction.HIBERNATE,
            remaining=0.0,
            hours_left=hl,
            hourly_cap=0.0,
            adjusted=0.0,
            pace_factor=1.0,
            cost=float(cost),
            reason="Fog NODE_WALLET is treasury infrastructure, not a citizen consume rail",
            opted_in=True,
            granted=False,
            kind=str(kind),
            spendable=0.0,
            grant=0.0,
        )

    v = decide(
        str(kind),
        remaining=rem,
        now=now,
        cost=float(cost),
        is_peak=is_peak,
        is_p0=is_p0,
        url=url,
        hour_spent=hour_spent,
        hours_left=hl,
        day_spent=day_spent,
        daily_limit=daily_limit,
        cfg=cfg,
        ledger=ledger,
        **kw,
    )
    decision = getattr(v, "decision", None) or (v.get("decision") if isinstance(v, dict) else str(v))
    decision = str(decision)
    reason = getattr(v, "reason", None) or (v.get("reason") if isinstance(v, dict) else "")
    pf = float(getattr(v, "pace_factor", 1.0) or 1.0)
    v_hl = float(getattr(v, "hours_left", hl) or hl)
    v_cap = float(getattr(v, "hourly_cap", hourly_cap) or hourly_cap)
    v_rem = float(getattr(v, "remaining", rem) if getattr(v, "remaining", None) is not None else rem)
    spendable = float(getattr(v, "spendable", v_rem) or 0.0)
    circuit = str(getattr(v, "circuit", "") or "")
    adjusted = v_cap * pf
    action = verdict_to_action(decision)
    granted = decision in (ALLOW, P0_BORROW)
    return GateResult(
        decision=decision,
        action=action,
        remaining=v_rem,
        hours_left=v_hl,
        hourly_cap=v_cap,
        adjusted=adjusted,
        pace_factor=pf,
        cost=float(cost),
        reason=str(reason or ""),
        opted_in=True,
        granted=granted,
        kind=str(kind),
        spendable=spendable,
        grant=adjusted,
        circuit=circuit,
        verdict=v,
    )


__all__ = [
    "ALLOW",
    "HOLD",
    "STASIS",
    "P0_BORROW",
    "NFT_FLOOR",
    "Verdict",
    "GateResult",
    "pace_factor",
    "decide",
    "opted_in",
    "remaining_for",
    "verdict_to_action",
    "consume_grace_tick",
    "gate_spend",
]
