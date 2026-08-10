"""
UGC Sandbox — Phase 4/5 scaffold
================================
Isolated content slots bound to CIDs; publish → NFT optional path.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import time
import hashlib


@dataclass
class SandboxItem:
    item_id: str
    owner: str
    cid: str
    label: str = ""
    published: bool = False
    created_at: float = field(default_factory=time.time)
    nft_asset_id: Optional[str] = None


class UGCSandbox:
    def __init__(self, max_items_per_owner: int = 50):
        self.items: Dict[str, SandboxItem] = {}
        self.max_items_per_owner = max_items_per_owner

    def _id(self, owner: str, cid: str) -> str:
        raw = f"{owner}|{cid}|{time.time()}"
        return "ugc_" + hashlib.sha256(raw.encode()).hexdigest()[:12]

    def create(self, owner: str, cid: str, label: str = "") -> SandboxItem:
        owned = [i for i in self.items.values() if i.owner == owner]
        if len(owned) >= self.max_items_per_owner:
            raise ValueError("sandbox quota exceeded")
        it = SandboxItem(
            item_id=self._id(owner, cid),
            owner=owner,
            cid=cid,
            label=label or cid[:12],
        )
        self.items[it.item_id] = it
        return it

    def publish(self, item_id: str, nft_asset_id: Optional[str] = None) -> SandboxItem:
        it = self.items[item_id]
        it.published = True
        if nft_asset_id:
            it.nft_asset_id = nft_asset_id
        return it

    def summary(self) -> dict:
        return {
            "total": len(self.items),
            "published": sum(1 for i in self.items.values() if i.published),
            "items": [
                {
                    "id": i.item_id,
                    "owner": i.owner,
                    "cid": i.cid,
                    "label": i.label,
                    "published": i.published,
                    "nft_asset_id": i.nft_asset_id,
                }
                for i in list(self.items.values())[-40:]
            ],
        }


def demo():
    s = UGCSandbox()
    it = s.create("FOG-NODE-PT-CM-001", "bafy-ugc-1", "Draft world tile")
    s.publish(it.item_id, nft_asset_id="nft_demo")
    print(s.summary())
    print("sandbox demo OK")


if __name__ == "__main__":
    demo()
