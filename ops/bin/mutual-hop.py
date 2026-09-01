#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
JOB = sys.argv[1] if len(sys.argv) > 1 else "ts-api"
CIRCUIT = os.environ.get("CIRCUIT", "ALLOW")
cont = json.loads((Path(__file__).resolve().parents[2] / "ops/config/contingency.json").read_text())
row = ((cont.get("mutual") or {}).get("jobs") or {}).get(JOB) or {}
pri, sec = row.get("primary"), row.get("secondary")
if CIRCUIT == "STASIS" and pri == "cf-worker":
    pri, sec = sec, None
elif CIRCUIT == "STASIS" and sec == "cf-worker":
    sec = None
print(json.dumps({"job": JOB, "circuit": CIRCUIT, "serve": pri, "fallback": sec}))
