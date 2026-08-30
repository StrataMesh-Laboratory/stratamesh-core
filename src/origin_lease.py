"""Fog origin lease — Mac primary, session standby, 30-minute fallback.

Public hostname fog.calhegasmorais.pt is a CNAME to one named tunnel:

  macbook  → macbook-server   (primary, Mac :8788)
  session  → stratamesh-fog-lab (this Grok host :8788)

Never two connectors on the same named tunnel. DNS picks the origin.
Secrets (tokens, GOD_API) stay in local files — not in this module.
"""
from __future__ import annotations

import calendar
import hashlib
import hmac
import json
import os
import time
from pathlib import Path

MAC_TUNNEL = "d1323a93-21e4-4ea2-bce8-8b74eece2e13"
SESSION_TUNNEL = "9cff5878-0962-420f-ab46-9f6a42c3d307"
FOG_HOST = "fog.calhegasmorais.pt"
ZONE_ID = "cdd8ee56bba57bca8623a86b88c7b7b6"
FALLBACK_AFTER_SEC = 1800  # 30 min
ROLE_DEFAULT = "session"

TUNNEL_CNAME = {
    "macbook": MAC_TUNNEL + ".cfargotunnel.com",
    "session": SESSION_TUNNEL + ".cfargotunnel.com",
}


def data_dir() -> Path:
    return Path(os.environ.get("FOG_DATA") or "/workspace/data/fog")


def secrets_dir() -> Path:
    return Path(os.environ.get("FOG_SECRETS") or "/workspace/data/secrets")


def lease_path() -> Path:
    return data_dir() / "origin.lease"


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def parse_iso(s: str | None) -> float | None:
    if not s:
        return None
    try:
        return calendar.timegm(time.strptime(s, "%Y-%m-%dT%H:%M:%SZ"))
    except Exception:
        return None


def role() -> str:
    return (os.environ.get("FOG_ORIGIN") or ROLE_DEFAULT).strip() or ROLE_DEFAULT


def fallback_after_sec() -> int:
    raw = (os.environ.get("FOG_FALLBACK_AFTER") or "").strip()
    if raw.isdigit():
        return max(60, int(raw))
    return FALLBACK_AFTER_SEC


def empty_lease() -> dict:
    return {
        "role": role(),
        "public": False,
        "updated": None,
        "yielded_at": None,
        "taken_at": None,
        "mac_down_since": None,
        "mac_last_ok": None,
        "fallback": False,
        "fallback_at": None,
        "fallback_reason": None,
        "fallback_after_sec": fallback_after_sec(),
        "reclaim_requested_at": None,
        "dns_target": "macbook",
        "primary": "macbook",
        "standby": "session",
    }


def read() -> dict:
    d = empty_lease()
    p = lease_path()
    try:
        if p.is_file():
            d.update(json.loads(p.read_text(encoding="utf-8")))
    except Exception:
        pass
    d["role"] = role()
    d["fallback_after_sec"] = fallback_after_sec()
    d["primary"] = "macbook"
    d["standby"] = "session"
    return d


def write(**kw) -> dict:
    d = read()
    d.update(kw)
    d["role"] = role()
    d["updated"] = now_iso()
    d["fallback_after_sec"] = fallback_after_sec()
    lease_path().parent.mkdir(parents=True, exist_ok=True)
    lease_path().write_text(json.dumps(d, indent=2) + "\n", encoding="utf-8")
    try:
        lease_path().chmod(0o644)
    except Exception:
        pass
    return d


def public_view(d: dict | None = None) -> dict:
    d = d if d is not None else read()
    return {
        "ok": True,
        "role": d.get("role"),
        "public": bool(d.get("public")),
        "fallback": bool(d.get("fallback")),
        "fallback_at": d.get("fallback_at"),
        "fallback_reason": d.get("fallback_reason"),
        "fallback_after_sec": d.get("fallback_after_sec") or FALLBACK_AFTER_SEC,
        "mac_down_since": d.get("mac_down_since"),
        "mac_last_ok": d.get("mac_last_ok"),
        "dns_target": d.get("dns_target") or "macbook",
        "primary": "macbook",
        "standby": "session",
        "updated": d.get("updated"),
        "reclaim_pending": bool(d.get("reclaim_requested_at")),
    }


def tunnel_token() -> str:
    for name in ("tunnel_token", "tunnel_token_fog_lab"):
        p = secrets_dir() / name
        if p.is_file():
            tok = p.read_text(encoding="utf-8").strip()
            if tok:
                return tok
    return ""


def reclaim_secret(tok: str | None = None) -> str:
    raw = (tok if tok is not None else tunnel_token()).strip()
    if not raw:
        return ""
    return hashlib.sha256((raw + ":origin-reclaim").encode("utf-8")).hexdigest()[:32]


def verify_reclaim(bearer: str, tok: str | None = None) -> bool:
    want = reclaim_secret(tok)
    got = (bearer or "").strip()
    if not want or not got:
        return False
    return hmac.compare_digest(got, want)


def decide(
    lease: dict,
    *,
    mac_alive: bool,
    local_ok: bool,
    now: float,
    role_name: str = "session",
    after_sec: int = FALLBACK_AFTER_SEC,
) -> str:
    """Pure fallback state machine. No I/O.

    Returns one of:
      stay, yield_to_mac, honor_reclaim, clear_down, mark_down,
      wait, hold_unhealthy, take
    """
    if role_name != "session":
        return "stay"
    public = bool(lease.get("public"))
    if lease.get("reclaim_requested_at") and public:
        return "honor_reclaim"
    if mac_alive:
        if public:
            return "yield_to_mac"
        return "clear_down"
    if public:
        return "stay"
    down_since = lease.get("mac_down_since")
    t0 = parse_iso(down_since) if down_since else None
    if t0 is None:
        return "mark_down"
    if now - t0 < after_sec:
        return "wait"
    if not local_ok:
        return "hold_unhealthy"
    return "take"
