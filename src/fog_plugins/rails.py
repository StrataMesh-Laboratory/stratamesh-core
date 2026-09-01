"""STRATA rails plug — PoC → #mint, PoS → #0.

Armed only when oracle_live AND FOG_MINT_ARMED / FOG_BURN_ARMED.
Lab default: measure, record keep-up, never move STRATA.
I1 #mint does not receive. I3 #0 does not spend.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Optional

from .keepup import KeepUpSample

_DATA = Path(os.environ.get("FOG_DATA") or str(Path.home() / "StrataMesh/fog/data"))
_STORE = _DATA / "rails.json"


def _flag(name: str) -> bool:
    return (os.environ.get(name) or "").strip().lower() in ("1", "true", "yes")


class RailsPlug:
    def __init__(self, poc=None, token=None, subsistence=None, lab_ledger=None):
        self.poc = poc
        self.token = token
        self.subsistence = subsistence
        self.lab_ledger = lab_ledger
        self.pending_poc = 0.0
        self.pending_burn = 0.0
        self.settled_poc = 0.0
        self.settled_burn = 0.0
        self._load()

    def _load(self) -> None:
        try:
            raw = json.loads(_STORE.read_text())
        except Exception:
            return
        if not isinstance(raw, dict):
            return
        for k in ("pending_poc", "pending_burn", "settled_poc", "settled_burn"):
            try:
                setattr(self, k, max(0.0, float(raw.get(k) or 0)))
            except (TypeError, ValueError):
                pass

    def _save(self) -> None:
        try:
            _DATA.mkdir(parents=True, exist_ok=True)
            payload = {
                "schema": "stratamesh.fog.rails.v1",
                "pending_poc": round(self.pending_poc, 6),
                "pending_burn": round(self.pending_burn, 6),
                "settled_poc": round(self.settled_poc, 6),
                "settled_burn": round(self.settled_burn, 6),
            }
            tmp = _STORE.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(payload, indent=2))
            tmp.replace(_STORE)
        except Exception:
            pass

    def armed(self) -> dict:
        oracle = False  # lab lock; mesh_flags.oracle_live stays false
        return {
            "oracle_live": oracle,
            "mint_armed": bool(oracle and _flag("FOG_MINT_ARMED")),
            "burn_armed": bool(oracle and _flag("FOG_BURN_ARMED")),
            "lab_waived": True,
            "mint_pole": "#mint",
            "burn_pole": "#0",
            "poc_path": "keepup.score → ContributionLedger.kind=fog_keepup → mint_from_poc when armed",
            "pos_path": "keepup consume → subsistence.consume → LabLedger.burn(#0) when armed",
            "i1": "#mint never receives ordinary transfers",
            "i3": "#0 never initiates transfers",
        }

    def ingest(self, sample: KeepUpSample, node_id: str) -> dict:
        """Record keep-up. Do not mint/burn unless armed."""
        flags = self.armed()
        out: dict[str, Any] = {"schema": "stratamesh.fog.rails.v1", **flags, "poc_event": None, "mint": None, "burn": None}
        if sample.unready or not sample.admissible:
            out["reason"] = "unready — fail-closed, no credit"
            if self.subsistence:
                try:
                    self.subsistence.consume(node_id, compute=0.01)
                except Exception:
                    pass
            self._save()
            return out

        self.pending_poc += sample.score
        # ping itself is a tiny PoS consume; keep-up earn is the PoC side
        if self.subsistence:
            try:
                self.subsistence.consume(node_id, compute=0.02)
                self.subsistence.earn(node_id, compute=sample.score)
            except Exception:
                pass
        if flags["mint_armed"] and self.poc:
            try:
                ev = self.poc.record(
                    node_id,
                    "fog_keepup",
                    units=sample.quantity,
                    weight=sample.quality,
                    mint_armed=True,
                    lab_waived=False,
                )
                out["poc_event"] = ev.event_id
            except Exception as e:
                out["poc_error"] = type(e).__name__

        if flags["mint_armed"] and self.token and sample.score > 0:
            try:
                ev = self.token.mint_from_poc(node_id, sample.score, rate=1.0, ref="fog_keepup")
                self.settled_poc += ev.amount
                self.pending_poc = max(0.0, self.pending_poc - ev.amount)
                out["mint"] = {"mint_id": ev.mint_id, "amount": ev.amount, "pole": "#mint"}
            except Exception as e:
                out["mint_error"] = type(e).__name__
        else:
            out["mint"] = None
            out["reason"] = "lab_waived — measuring only; #mint unarmed"

        # Quality collapse would burn; default stream does not collapse enough to auto-burn.
        if flags["burn_armed"] and self.lab_ledger and sample.quality < 0.2:
            try:
                amt = min(sample.score, 0.01)
                if amt > 0 and self.lab_ledger.burn(node_id, amt):
                    self.settled_burn += amt
                    out["burn"] = {"amount": amt, "pole": "#0"}
            except Exception as e:
                out["burn_error"] = type(e).__name__
        self._save()
        return out

    def snapshot(self) -> dict:
        return {
            **self.armed(),
            "pending_poc": round(self.pending_poc, 6),
            "pending_burn": round(self.pending_burn, 6),
            "settled_poc": round(self.settled_poc, 6),
            "settled_burn": round(self.settled_burn, 6),
            "note": "STRATA does not move until oracle_live and armed flags. Hire remains transfer, never mint.",
        }
