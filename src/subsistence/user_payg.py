"""Registered node-user PAYG subsistence.

Citizen wallets burn STRATA to #0 while using node services.
Insolvent wallets keep static NFT data only — no resource actions.
Fog NODE_WALLET is treasury, never a citizen rail. Not a mint.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from protocol_benchmark import BURN, MINT, LabLedger

NODE_WALLET = "FOG-NODE-PT-CM-001"
FLOOR = 0.1  # below this: static NFTs only

# 0 = static (no burn). >0 = resource action, debit to #0.
BURN_RATES: Dict[str, float] = {
    "health": 0.0,
    "status": 0.0,
    "ontology": 0.0,
    "nft_view": 0.0,
    "nft_list": 0.0,
    "dashboard_tick": 0.001,
    "orch_chat": 0.02,
    "spa_execute": 0.05,
    "sandbox_run": 0.04,
    "va_api": 0.03,
    "agora_order": 0.01,
    "nft_mint": 0.10,
    "nft_transfer": 0.02,
}

STATIC_ACTIONS = frozenset(k for k, v in BURN_RATES.items() if v <= 0)
RESOURCE_ACTIONS = frozenset(k for k, v in BURN_RATES.items() if v > 0)


def rate(action: str) -> float:
    return float(BURN_RATES.get(action, 0.02 if action else 0.0))


def is_static(action: str) -> bool:
    return rate(action) <= 0


def is_treasury(address: Optional[str]) -> bool:
    a = (address or "").strip()
    return a in (NODE_WALLET, MINT, BURN, "#mint", "#0", "fog", "NODE_WALLET")


@dataclass
class UserAccount:
    user_id: str
    wallet: str
    balance: float = 0.0
    spent: float = 0.0
    ticks: int = 0


@dataclass
class Gate:
    ok: bool
    mode: str  # live | static | deny
    action: str
    rate: float
    charged: float
    balance: float
    reason: str
    static_only: bool
    allowed: List[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "ok": self.ok,
            "mode": self.mode,
            "action": self.action,
            "rate": self.rate,
            "charged": self.charged,
            "balance": round(self.balance, 6),
            "reason": self.reason,
            "static_only": self.static_only,
            "allowed": list(self.allowed),
            "floor": FLOOR,
            "burn_pole": "#0",
            "mint_pole": "#mint",
        }


class PaygRuntime:
    """In-process citizen PAYG. LabLedger burns to #0 when provided."""

    def __init__(self, lab_ledger: Optional[LabLedger] = None, graph=None):
        self.accounts: Dict[str, UserAccount] = {}
        self.by_wallet: Dict[str, str] = {}
        self.graph = graph
        self.lab = lab_ledger or (graph.lab if graph is not None else LabLedger())
        self.events: List[dict] = []

    def register(self, user_id: str, wallet: str, balance: float = 0.0, *, fund_via_poc: bool = False) -> UserAccount:
        if is_treasury(wallet):
            raise ValueError("treasury_not_citizen")
        if (wallet or "").startswith("#"):
            raise ValueError("pole_not_citizen")
        acc = UserAccount(user_id=user_id, wallet=wallet, balance=max(0.0, float(balance)))
        self.accounts[user_id] = acc
        self.by_wallet[wallet] = user_id
        if self.graph is not None:
            self.graph.open(user_id, wallet)
            if fund_via_poc and acc.balance > 0:
                self.graph.mint_poc(wallet, acc.balance, kind="prior_poc")
                acc.balance = self.graph.balance(wallet)
        elif fund_via_poc and acc.balance > 0:
            self.lab.mint_poc(wallet, acc.balance)
        return acc

    def mode_of(self, acc: UserAccount) -> str:
        if acc.balance < FLOOR:
            return "static"
        return "live"

    def snapshot(self, user_id: str) -> dict:
        acc = self.accounts.get(user_id)
        if not acc:
            return {"ok": False, "error": "unknown_user", "mode": "deny", "dashboard": False}
        mode = self.mode_of(acc)
        out = {
            "ok": True,
            "user_id": acc.user_id,
            "wallet": acc.wallet,
            "balance": round(acc.balance, 6),
            "spent": round(acc.spent, 6),
            "ticks": acc.ticks,
            "mode": mode,
            "static_only": mode == "static",
            "dashboard": True,
            "floor": FLOOR,
            "burn_rates": dict(BURN_RATES),
            "static_actions": sorted(STATIC_ACTIONS),
            "resource_actions": sorted(RESOURCE_ACTIONS),
            "note": "PAYG subsistence. Resource actions burn to #0. Unfunded = NFTs only.",
        }
        if self.graph is not None:
            snap = self.graph.snapshot(acc.wallet)
            if snap.get("ok"):
                out["lifecycle"] = {
                    "minted_from_#mint": snap.get("minted_from_#mint"),
                    "burned_to_#0": snap.get("burned_to_#0"),
                    "circulating": snap.get("circulating"),
                    "opened_tx": snap.get("opened_tx"),
                    "events": snap.get("events"),
                }
        return out

    def gate(self, user_id: Optional[str], action: str, *, anonymous: bool = False) -> Gate:
        if anonymous or not user_id:
            return Gate(
                ok=False,
                mode="deny",
                action=action,
                rate=rate(action),
                charged=0.0,
                balance=0.0,
                reason="anonymous — dashboard is registered-only",
                static_only=True,
                allowed=[],
            )
        acc = self.accounts.get(user_id)
        if not acc:
            return Gate(False, "deny", action, rate(action), 0.0, 0.0, "unknown_user", True, [])
        if is_treasury(acc.wallet):
            return Gate(False, "deny", action, 0.0, 0.0, acc.balance, "treasury_not_citizen", True, [])

        cost = rate(action)
        mode = self.mode_of(acc)
        static_allowed = sorted(STATIC_ACTIONS)

        if is_static(action):
            return Gate(True, mode, action, 0.0, 0.0, acc.balance, "static_data", mode == "static", static_allowed)

        if mode == "static" or acc.balance < FLOOR:
            return Gate(
                False, "static", action, cost, 0.0, acc.balance,
                "insufficient_subsistence — NFTs only", True, static_allowed,
            )
        if acc.balance < cost + FLOOR:
            return Gate(
                False, "static", action, cost, 0.0, acc.balance,
                "would_breach_floor — NFTs only", True, static_allowed,
            )

        # Debit citizen → #0. PAYG never mints.
        if self.graph is not None:
            br = self.graph.burn(acc.wallet, cost, action)
            if not br.get("ok"):
                return Gate(False, "static", action, cost, 0.0, acc.balance, br.get("error") or "burn_rejected", True, static_allowed)
            acc.balance = self.graph.balance(acc.wallet)
        else:
            if self.lab.balances.get(acc.wallet, 0.0) >= cost:
                if not self.lab.burn(acc.wallet, cost):
                    return Gate(False, "static", action, cost, 0.0, acc.balance, "burn_rejected", True, static_allowed)
            acc.balance = max(0.0, acc.balance - cost)
        acc.spent += cost
        acc.ticks += 1
        self.events.append({"user_id": user_id, "action": action, "amount": cost, "pole": "#0", "wallet": acc.wallet})
        new_mode = self.mode_of(acc)
        return Gate(True, new_mode, action, cost, cost, acc.balance, "burned_to_#0", new_mode == "static", static_allowed)
