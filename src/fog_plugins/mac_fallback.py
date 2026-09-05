"""30-minute Mac Fog dark watch.

mac_live=false for FOG_FALLBACK_AFTER (default 1800s) → standby plan.
Edge persist never flips Fog DNS (Mac primary). Session fog-persist may.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from urllib.request import Request, urlopen

FALLBACK_AFTER = int(os.environ.get("FOG_FALLBACK_AFTER") or "1800")
FOG_PUBLIC = os.environ.get("FOG_PUBLIC_URL") or "https://fog.calhegasmorais.pt/health"
FOG_LOCAL = os.environ.get("FOG_HEALTH") or "http://127.0.0.1:8787/health"
STATE = Path(os.environ.get("FOG_DATA") or Path.home() / "StrataMesh/fog/data") / "mac_live.json"


def _probe(url: str) -> dict:
    try:
        req = Request(url, headers={"User-Agent": "stratamesh-mac-fallback/1"})
        with urlopen(req, timeout=5) as r:
            raw = r.read().decode("utf-8", "replace")
            data = json.loads(raw) if raw.lstrip().startswith("{") else {"raw": raw[:120]}
            data["ok"] = True
            data["http"] = r.status
            return data
    except Exception as e:
        return {"ok": False, "error": str(e)[:160], "url": url}


def load() -> dict:
    try:
        return json.loads(STATE.read_text())
    except Exception:
        return {}


def save(st: dict) -> None:
    STATE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE.with_suffix(".tmp")
    tmp.write_text(json.dumps(st, indent=2))
    tmp.replace(STATE)


def tick() -> dict:
    pub = _probe(FOG_PUBLIC)
    loc = _probe(FOG_LOCAL)
    origin = pub.get("origin") or loc.get("origin")
    mac = bool((pub.get("ok") and origin == "macbook") or (loc.get("ok") and (loc.get("origin") == "macbook" or loc.get("mac_live"))))
    now = time.time()
    st = load()
    if mac:
        st["last_mac_ok"] = now
        st["mac_live"] = True
        st["dark_for"] = 0
        st["standby"] = False
    else:
        last = float(st.get("last_mac_ok") or 0)
        dark = (now - last) if last else FALLBACK_AFTER + 1
        st["mac_live"] = False
        st["dark_for"] = int(dark)
        st["standby"] = dark >= FALLBACK_AFTER
        if last == 0:
            st["last_mac_ok"] = 0
    st["ts"] = now
    st["fallback_after"] = FALLBACK_AFTER
    st["public"] = {"ok": pub.get("ok"), "origin": pub.get("origin"), "error": pub.get("error")}
    st["local"] = {"ok": loc.get("ok"), "origin": loc.get("origin")}
    # Observe-only alias for desk/e2e. Sleep is not an incident.
    st["mac_fog_reachable"] = bool(st.get("mac_live"))
    st["oracle_live"] = False
    st["plan"] = plan(st)
    save(st)
    return st


def plan(st: dict) -> dict:
    standby = bool(st.get("standby"))
    return {
        "keep_edge_workerd": True,
        "keep_edge_local": True,
        "keep_mw_8790_8791": True,
        "metabol": "STANDBY" if standby else "ALLOW",
        "flip_fog_dns": bool(os.environ.get("FOG_MAY_FLIP_DNS") == "1" and (os.environ.get("FOG_ORIGIN") or "") == "session"),
        "reason": "mac dark >= 30min" if standby else "mac primary or grace",
        "after_sec": FALLBACK_AFTER,
        "dark_for": st.get("dark_for") or 0,
    }
