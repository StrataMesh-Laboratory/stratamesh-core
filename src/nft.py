"""
StrataMesh NFT / CID objects — Phase 4 scaffold
===============================================
Content-addressed objects with ownership tracked on the local ledger.
Full media lives on IPFS; registry holds CID + owner + metadata.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import time
import hashlib
import json


@dataclass
class NFTAsset:
    asset_id: str
    cid: str
    owner: str
    title: str = ""
    meta: Dict = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    dag_tx: Optional[str] = None


class NFTRegistry:
    def __init__(self):
        self.assets: Dict[str, NFTAsset] = {}

    def _id(self, cid: str, owner: str) -> str:
        raw = f"{cid}|{owner}|{time.time()}"
        return "nft_" + hashlib.sha256(raw.encode()).hexdigest()[:14]

    def mint(self, owner: str, cid: str, title: str = "", **meta) -> NFTAsset:
        if not cid:
            raise ValueError("cid required")
        asset = NFTAsset(
            asset_id=self._id(cid, owner),
            cid=cid,
            owner=owner,
            title=title or cid[:16],
            meta=meta,
        )
        self.assets[asset.asset_id] = asset
        return asset

    def transfer(self, asset_id: str, new_owner: str) -> NFTAsset:
        a = self.assets.get(asset_id)
        if not a:
            raise KeyError("asset not found")
        a.owner = new_owner
        return a

    def by_owner(self, owner: str) -> List[NFTAsset]:
        return [a for a in self.assets.values() if a.owner == owner]

    def summary(self) -> dict:
        return {
            "total": len(self.assets),
            "assets": [
                {
                    "asset_id": a.asset_id,
                    "cid": a.cid,
                    "owner": a.owner,
                    "title": a.title,
                    "dag_tx": a.dag_tx,
                }
                for a in list(self.assets.values())[-50:]
            ],
        }


def demo():
    r = NFTRegistry()
    a = r.mint("FOG-NODE-PT-CM-001", "bafy-nft-demo", title="Genesis Object")
    r.transfer(a.asset_id, "EDGE-01")
    print(r.summary())
    print("nft demo OK")


if __name__ == "__main__":
    demo()
