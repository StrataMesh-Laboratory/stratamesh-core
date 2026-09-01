#!/usr/bin/env python3
"""Pick cheapest ALLOW hop from rails + contingency weights. No secrets printed."""
import json, os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
rails = json.loads((ROOT / "ops/config/rails.json").read_text())
cont = json.loads((ROOT / "ops/config/contingency.json").read_text())
circuit = os.environ.get("CIRCUIT", "ALLOW")
weights = cont.get("weight") or {}
order = ["pages", "python", "node", "workerd", "fog", "tailscale", "cf-worker", "maintenance"]
if circuit in ("STASIS", "HOLD"):
    order = [x for x in order if x != "cf-worker"] + ["cf-worker"]
picked = order[0]
print(json.dumps({
    "circuit": circuit,
    "picked": picked,
    "order": order,
    "weights": {k: weights.get(k) for k in order},
    "head": "main",
}, indent=2))
