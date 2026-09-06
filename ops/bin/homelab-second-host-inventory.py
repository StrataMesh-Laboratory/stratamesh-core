#!/usr/bin/env python3
"""dt-proj-homelab-second-host — inventory + optional Tailscale prove.

Does NOT provision a peer. Does NOT set oracle_live. Does NOT close M-II.
Success = honest JSON: whether a spare distinct Fog kernel is visible.

Same-Mac EDGE, MariaDB, n=2 mesh_flags, workers.dev — never count as host #2.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone

FOG_PUBLIC = os.environ.get("FOG_PUBLIC_URL") or "https://fog.calhegasmorais.pt"
KNOWN_FOG = "FOG-NODE-PT-CM-001"
UA = "stratamesh-homelab-inventory/1 (+lab; oracle_live=false)"


def _get(url: str, timeout: float = 10.0) -> dict:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "replace")
            data = json.loads(raw) if raw.lstrip().startswith("{") else {"raw": raw[:200]}
            data["_http"] = int(getattr(r, "status", 200) or 200)
            return data
    except Exception as e:
        return {"ok": False, "_http": 0, "error": f"{type(e).__name__}: {e}"[:160]}


def _tailscale_peers() -> dict:
    bin_ = shutil.which("tailscale")
    if not bin_:
        return {"present": False, "peers": [], "note": "tailscale CLI absent on this hop"}
    try:
        raw = subprocess.check_output(
            [bin_, "status", "--json"],
            timeout=8,
            stderr=subprocess.DEVNULL,
        )
        js = json.loads(raw.decode("utf-8", "replace") or "{}")
    except Exception as e:
        return {"present": True, "peers": [], "error": type(e).__name__}
    peers = []
    self_ = js.get("Self") or {}
    peers.append({
        "id": self_.get("ID") or self_.get("DNSName"),
        "host": self_.get("HostName") or self_.get("DNSName"),
        "online": bool(self_.get("Online", True)),
        "self": True,
    })
    for _k, p in (js.get("Peer") or {}).items():
        peers.append({
            "id": p.get("ID") or p.get("DNSName"),
            "host": p.get("HostName") or p.get("DNSName"),
            "online": bool(p.get("Online")),
            "self": False,
        })
    return {"present": True, "peers": peers}


def main() -> int:
    health = _get(FOG_PUBLIC.rstrip("/") + "/health")
    status = _get(FOG_PUBLIC.rstrip("/") + "/status")
    ts = _tailscale_peers()
    origin = health.get("origin")
    mac_live = bool(health.get("mac_live") or origin == "macbook")
    node = status.get("node_id") or KNOWN_FOG
    host_id = status.get("host_id")
    n = health.get("n") if health.get("n") is not None else status.get("n")

    # Distinct second Fog kernel: another node_id online, not EDGE-on-same-story.
    extra_fog = []
    for p in ts.get("peers") or []:
        host = str(p.get("host") or "").lower()
        if p.get("self"):
            continue
        if any(x in host for x in ("rpi", "pi4", "pi5", "nuc", "homelab", "fog-2", "fog2")):
            extra_fog.append(p)

    second = False  # no Fog /status besides FOG-NODE-PT-CM-001 observed from this hop
    report = {
        "schema": "stratamesh.homelab_second_host.inventory.v1",
        "ts": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "act": "dt-proj-homelab-second-host",
        "fog_public": {
            "ok": bool(health.get("ok")),
            "http": health.get("_http"),
            "origin": origin,
            "mac_live": mac_live,
            "n": n,
            "oracle_live": False,
            "node_id": node,
            "host_id": host_id,
        },
        "tailscale": ts,
        "spare_device_seen": bool(extra_fog),
        "spare_candidates": extra_fog,
        "second_fog_host": second,
        "m2_hold": True,
        "not_a_second_host": [
            "n=2 mesh_flags / EDGE-GROK-CMN-001",
            "MariaDB fog_cmn offload",
            "same-Mac workerd",
            "workers.dev",
        ],
        "next": (
            "If a spare RPi/NUC appears on Tailscale, install Fog kernel + named tunnel; "
            "then lift hold_until=distinct_second_host on proj-m2-twohost. Do not buy hardware from this Act."
        ),
    }
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
