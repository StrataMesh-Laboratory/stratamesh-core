"""On-graph #mint / #0 lifecycle, individuated to registered node accounts.

Each registered user/SCA wallet is a graph subject:
  open (account tx, amount 0) → mint_poc (#mint → wallet) → burn (wallet → #0)
  hire/agora is transfer, never mint.

Fog NODE_WALLET is treasury, not a citizen. Poles are not accounts.
"""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from protocol_benchmark import BURN, MINT, NODE_WALLET, LabLedger
from tip_selection import DAG, Transaction, TxType

POLES = frozenset({MINT, BURN, "#mint", "#0"})
TREASURY = frozenset({NODE_WALLET, "treasury", "NODE_WALLET", "fog"})


def wallet_for(user_id: str) -> str:
    h = hashlib.sha256(str(user_id).encode()).hexdigest()[:16]
    return "sm:u:" + h


def is_citizen(wallet: Optional[str]) -> bool:
    w = (wallet or "").strip()
    if not w or w in POLES or w in TREASURY:
        return False
    if w.startswith("#"):
        return False
    return True


@dataclass
class Account:
    user_id: str
    wallet: str
    opened_tx: Optional[str] = None
    minted: float = 0.0
    burned: float = 0.0
    received: float = 0.0
    sent: float = 0.0
    events: List[dict] = field(default_factory=list)


class AccountGraph:
    """Per-account STRATA lifecycle on LabLedger + DAG."""

    def __init__(self, dag: Optional[DAG] = None, token=None):
        self.dag = dag if dag is not None else DAG()
        if not self.dag.txs:
            try:
                self.dag.bootstrap()
            except Exception:
                pass
        self.token = token
        self.lab = LabLedger()
        self.by_user: Dict[str, Account] = {}
        self.by_wallet: Dict[str, Account] = {}
        self.replay()

    def _tx(self, tx_type: TxType, sender: str, cid: str) -> Optional[str]:
        try:
            parents = list(self.dag.select_tips(k=2) or ["genesis"])
            tx = Transaction(
                tx_id=Transaction.make_id(sender, cid, str(time.time())),
                tx_type=tx_type,
                parents=parents,
                sender=sender,
                cid=cid,
            )
            self.dag.attach(tx)
            return tx.tx_id
        except Exception:
            return None

    def _event(self, acc: Account, kind: str, amount: float, pole: Optional[str], dag_tx: Optional[str], **extra) -> dict:
        ev = {
            "kind": kind,
            "amount": round(float(amount), 6),
            "pole": pole,
            "wallet": acc.wallet,
            "user_id": acc.user_id,
            "dag_tx": dag_tx,
            "ts": time.time(),
            **extra,
        }
        acc.events.append(ev)
        return ev

    def _kind(self, tx) -> str:
        t = tx.tx_type
        return t.value if hasattr(t, "value") else str(t)

    def replay(self) -> None:
        """Rebuild wallets + LabLedger from DAG cids. Amount lives in the cid."""
        txs = sorted(self.dag.txs.values(), key=lambda t: getattr(t, "timestamp", 0) or 0)
        for tx in txs:
            cid = tx.cid or ""
            kind = self._kind(tx)
            if kind == "account" and (cid.startswith("account_open:") or cid.startswith("account_open|")):
                w = cid.split(":", 1)[-1]
                if "|" in cid:
                    w = cid.split("|", 1)[-1]
                if is_citizen(w):
                    self.open(w, w, replay_tx=tx.tx_id)
            elif kind == "mint" and (cid.startswith("mint:#mint->") or cid.startswith("mint|")):
                if cid.startswith("mint|"):
                    bits = cid.split("|")
                    w, amt_s, knd = bits[1], bits[2] if len(bits) > 2 else "0", bits[3] if len(bits) > 3 else "poc"
                else:
                    body = cid[len("mint:#mint->"):]
                    w, _, tail = body.partition("|")
                    bits = tail.split("|")
                    amt_s = bits[0] if bits else "0"
                    knd = bits[1] if len(bits) > 1 else "poc"
                try:
                    amt = float(amt_s)
                except ValueError:
                    amt = 0.0
                if is_citizen(w) and amt > 0:
                    if w not in self.by_wallet:
                        self.open(w, w, replay_tx=tx.tx_id)
                    self.mint_poc(w, amt, kind=knd, replay=True, extra_tx=tx.tx_id)
            elif kind == "burn" and cid.startswith("burn|"):
                bits = cid.split("|")
                # burn|wallet|#0|amt|reason
                w = bits[1] if len(bits) > 1 else ""
                try:
                    amt = float(bits[3]) if len(bits) > 3 else 0.0
                except ValueError:
                    amt = 0.0
                reason = bits[4] if len(bits) > 4 else "resource_use"
                if w and amt > 0:
                    if w not in self.by_wallet:
                        self.open(w, w, replay_tx=tx.tx_id)
                    self.burn(w, amt, reason, replay=True, extra_tx=tx.tx_id)
            elif kind == "trade" and cid.startswith("xfer|"):
                bits = cid.split("|")
                frm = bits[1] if len(bits) > 1 else ""
                to = bits[2] if len(bits) > 2 else ""
                try:
                    amt = float(bits[3]) if len(bits) > 3 else 0.0
                except ValueError:
                    amt = 0.0
                reason = bits[4] if len(bits) > 4 else "hire"
                if frm and to and amt > 0:
                    if frm not in self.by_wallet and is_citizen(frm):
                        self.open(frm, frm, replay_tx=tx.tx_id)
                    if to not in self.by_wallet and is_citizen(to):
                        self.open(to, to, replay_tx=tx.tx_id)
                    self.transfer(frm, to, amt, reason, replay=True, extra_tx=tx.tx_id)

    def open(self, user_id: str, wallet: Optional[str] = None, replay_tx: Optional[str] = None) -> Account:
        w = wallet or wallet_for(user_id)
        if not is_citizen(w):
            raise ValueError("not_a_citizen_wallet")
        existing = self.by_user.get(user_id) or self.by_wallet.get(w)
        if existing:
            return existing
        acc = Account(user_id=str(user_id), wallet=w)
        acc.opened_tx = replay_tx or self._tx(TxType.ACCOUNT, w, "account_open:" + w)
        self.by_user[acc.user_id] = acc
        self.by_wallet[w] = acc
        self._event(acc, "open", 0.0, None, acc.opened_tx)
        return acc

    def get(self, wallet: Optional[str] = None, user_id: Optional[str] = None) -> Optional[Account]:
        if wallet:
            return self.by_wallet.get(wallet)
        if user_id:
            return self.by_user.get(str(user_id))
        return None

    def balance(self, wallet: str) -> float:
        return float(self.lab.balances.get(wallet, 0.0))

    def mint_poc(self, wallet: str, amount: float, kind: str = "poc", replay: bool = False, extra_tx: Optional[str] = None) -> dict:
        acc = self.by_wallet.get(wallet)
        if not acc:
            return {"ok": False, "error": "unknown_account"}
        amt = float(amount)
        if amt <= 0:
            return {"ok": False, "error": "amount"}
        if not self.lab.mint_poc(wallet, amt):
            return {"ok": False, "error": "mint_rejected"}
        if self.token is not None and not replay:
            try:
                self.token.mint_from_poc(wallet, amt, rate=1.0, ref=kind)
            except Exception:
                pass
        acc.minted += amt
        dag_tx = extra_tx if replay else self._tx(TxType.MINT, wallet, "mint:#mint->%s|%s|%s" % (wallet, amt, kind))
        ev = self._event(acc, "mint", amt, "#mint", dag_tx, origin="poc_contribution", poc_kind=kind)
        return {"ok": True, "event": ev, "balance": self.balance(wallet), "issued": self.lab.issued}

    def burn(self, wallet: str, amount: float, reason: str = "resource_use", replay: bool = False, extra_tx: Optional[str] = None) -> dict:
        acc = self.by_wallet.get(wallet)
        if not acc:
            return {"ok": False, "error": "unknown_account"}
        amt = float(amount)
        if amt <= 0:
            return {"ok": False, "error": "amount"}
        if not self.lab.burn(wallet, amt):
            return {"ok": False, "error": "insufficient_balance"}
        acc.burned += amt
        dag_tx = extra_tx if replay else self._tx(TxType.BURN, wallet, "burn|%s|#0|%s|%s" % (wallet, amt, reason))
        ev = self._event(acc, "burn", amt, "#0", dag_tx, reason=reason)
        return {"ok": True, "event": ev, "balance": self.balance(wallet), "burned_total": acc.burned}

    def transfer(self, frm: str, to: str, amount: float, reason: str = "hire", replay: bool = False, extra_tx: Optional[str] = None) -> dict:
        if frm in POLES or to in POLES:
            return {"ok": False, "error": "pole_not_transfer"}
        if frm in TREASURY and reason == "citizen_consume":
            return {"ok": False, "error": "treasury_not_citizen"}
        amt = float(amount)
        if not self.lab.transfer(frm, to, amt):
            return {"ok": False, "error": "transfer_rejected"}
        a = self.by_wallet.get(frm)
        b = self.by_wallet.get(to)
        dag_tx = extra_tx if replay else self._tx(TxType.TRADE, frm, "xfer|%s|%s|%s|%s" % (frm, to, amt, reason))
        if a:
            a.sent += amt
            self._event(a, "transfer_out", amt, None, dag_tx, counterparty=to, reason=reason)
        if b:
            b.received += amt
            self._event(b, "transfer_in", amt, None, dag_tx, counterparty=frm, reason=reason)
        return {"ok": True, "from": frm, "to": to, "amount": amt, "dag_tx": dag_tx, "mint": False}

    def snapshot(self, wallet: str) -> dict:
        acc = self.by_wallet.get(wallet)
        if not acc:
            return {"ok": False, "error": "unknown_account", "wallet": wallet}
        bal = self.balance(wallet)
        return {
            "ok": True,
            "user_id": acc.user_id,
            "wallet": acc.wallet,
            "opened_tx": acc.opened_tx,
            "minted_from_#mint": round(acc.minted, 6),
            "burned_to_#0": round(acc.burned, 6),
            "received": round(acc.received, 6),
            "sent": round(acc.sent, 6),
            "circulating": round(bal, 6),
            "events": list(acc.events[-50:]),
            "poles": {"mint": "#mint", "burn": "#0"},
            "node_treasury": NODE_WALLET,
            "citizen": True,
            "note": "Individuated lifecycle. PoC mints to this wallet. Resource use burns to #0. Hire is transfer.",
        }

    def summary(self) -> dict:
        return {
            "accounts": len(self.by_wallet),
            "issued": self.lab.issued,
            "burned": self.lab.burned,
            "circulating": self.lab.circulating(),
            "i6": self.lab.invariant_i6(),
            "wallets": sorted(self.by_wallet),
        }
