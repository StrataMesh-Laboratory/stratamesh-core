"""5-slot hop chain: 3 live MW, CF only on ALLOW, then static maintenance.

Fog :8787 is kernel, not middleware. Never workers.dev. Never Worker PUT.
HOLD/STASIS is pace: skip CF layer 4, keep serving MW or go to layer 5.
login/auth never 503 because CF decide() is STASIS.
GET /health is hop-live proof and must not enter this chain.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.request import Request, urlopen

CHAIN_HEADER = "X-Fog-Chain"
SELF_HOPS = {
    "python": "python:8790",
    "node": "node:8791",
    "deno": "deno:8792",
    "workerd": "workerd:8788",
    "fog": "fog:8787",
}
HOP_BASE = {
    "python:8790": "http://127.0.0.1:8790",
    "node:8791": "http://127.0.0.1:8791",
    "node:8791/atelier": "http://127.0.0.1:8791",
    "deno:8792": "http://127.0.0.1:8792",
    "workerd:8788": "http://127.0.0.1:8788",
}
# Layer 4: Pages is the only CF URL we fetch from loopback (not workers.dev).
CF_FETCH = {
    "cf-pages:ALLOW": os.environ.get("FOG_PAGES_ORIGIN") or "https://calhegasmorais-pt.pages.dev",
    "pages": os.environ.get("FOG_PAGES_ORIGIN") or "https://calhegasmorais-pt.pages.dev",
    "cf-auth:ALLOW": None,  # metabol gate only; never Worker PUT / workers.dev
    "cf-deomail:ALLOW": None,  # deno talks to api.deomail.com; not a Worker
    "cf-metabol:ALLOW": None,  # HOPMESH local meter; CF is gate only
}


def _root() -> Path:
    src = os.environ.get("FOG_SRC") or ""
    if src:
        return Path(src)
    here = Path(__file__).resolve()
    return here.parents[2]


def load_policy(root=None) -> dict:
    p = Path(root or _root()) / "ops" / "config" / "hop-policy.json"
    return json.loads(p.read_text(encoding="utf-8"))


def split_slots(route) -> tuple:
    """Return (mw[:3], cf_or_none, hold_html)."""
    mw, cf, hold = [], None, None
    for slot in list(route or []):
        s = str(slot)
        low = s.lower()
        if low.endswith(".html") or low.startswith("frontend/") or "maintenance" in low:
            hold = s
            continue
        if low.startswith("cf-") or low == "pages" or ":allow" in low:
            cf = s if s.endswith(":ALLOW") or s == "pages" else (s if ":ALLOW" in s else s)
            continue
        if low.startswith("fog:") or low == "fog":
            continue
        mw.append(s)
    return mw[:3], cf, hold or "frontend/maintenance-1xxx.html"


def module_for(path: str) -> str:
    p = (path or "/").split("?", 1)[0]
    if p.startswith("/api/auth") or p.startswith("/api/wb") or p in ("/login", "/me", "/auth"):
        return "auth_wb_session"
    if p.startswith("/assemble") or p.startswith("/atelier") or p.startswith("/dashboard") or p.startswith("/desk") or p.startswith("/mw/assemble") or p.startswith("/mw/atelier") or p.startswith("/mw/dashboard"):
        return "compose_assemble_desk"
    if p.startswith("/object") or p.startswith("/mail") or p.startswith("/resolve"):
        return "object_cid_mail"
    if p.startswith("/metabol"):
        return "metabol_origin"
    if p.startswith("/atelier") or p.endswith(".html"):
        return "html_atelier"
    return "compose_assemble_desk"


def is_health(path: str) -> bool:
    p = (path or "/").split("?", 1)[0].rstrip("/") or "/"
    return p in ("/", "/health", "/mw/health", "/workerd") or p.endswith("/health")


def hop_miss(status) -> bool:
    """Dead hop or this hop does not carry the module (404/405). Try next layer."""
    try:
        s = int(status or 0)
    except (TypeError, ValueError):
        return True
    return s == 0 or s in (404, 405) or s >= 500


def hop_key(slot: str) -> str:
    s = str(slot).split("/")[0]
    return s


def same_hop(slot: str, self_hop: str) -> bool:
    a = hop_key(slot).replace("http://127.0.0.1:", "")
    b = hop_key(self_hop)
    if a == b:
        return True
    # python:8790 vs python
    al, bl = a.split(":")[0], b.split(":")[0]
    return al == bl and al in ("python", "node", "deno", "workerd")


def cf_allowed(decision: str, path: str = "") -> bool:
    """Layer 4 only on ALLOW. STASIS/HOLD skip CF. Auth never uses CF 503."""
    d = str(decision or "ALLOW").upper()
    pl = str(path or "").lower()
    auth = "/api/auth" in pl or "/api/wb" in pl or pl.endswith("/login")
    if d in ("HOLD", "STASIS"):
        return False
    if "workers.dev" in pl:
        return False
    return d == "ALLOW" or auth is False and d == "ALLOW"


def maintenance_bytes(root=None) -> bytes:
    p = Path(root or _root()) / "frontend" / "maintenance-1xxx.html"
    try:
        return p.read_bytes()
    except OSError:
        return (
            b"<!DOCTYPE html><html lang=\"pt-PT\"><head><meta charset=\"utf-8\"/>"
            b"<title>N\xc3\xb3 em stasis</title></head><body><p>MW hops down. "
            b"Never workers.dev.</p></body></html>"
        )


def default_fetch(url: str, method: str = "GET", headers=None, body=None, timeout: float = 1.2):
    hdrs = dict(headers or {})
    hdrs.setdefault("User-Agent", "fog-hop-chain/2")
    hdrs[CHAIN_HEADER] = "1"
    req = Request(url, data=body, method=method, headers=hdrs)
    with urlopen(req, timeout=timeout) as r:
        raw = r.read()
        return int(getattr(r, "status", 200) or 200), dict(r.headers.items()), raw


def try_next(
    path: str,
    *,
    self_hop: str,
    method: str = "GET",
    headers=None,
    body: bytes | None = None,
    query: str = "",
    decision: str = "ALLOW",
    policy=None,
    fetch=None,
    local=None,
    root=None,
    timeout: float = 1.2,
) -> dict:
    """Walk 3 MW hops, then CF if ALLOW, then maintenance HTML.

    If local() returns a dict with handled True, that is this hop serving.
    fetch(url, method, headers, body, timeout) -> (status, headers, body).
    Incoming already-chained requests should pass already_chained via headers.
    """
    if is_health(path):
        return {"via": "health", "skip": True}
    hdrs_in = {str(k).lower(): v for k, v in dict(headers or {}).items()}
    if hdrs_in.get(CHAIN_HEADER.lower()) or hdrs_in.get("x-fog-chain"):
        return {"via": "chained", "skip": True}

    pol = policy if policy is not None else load_policy(root)
    mod = module_for(path)
    routes = (pol.get("routes") or {})
    route = routes.get(mod) or []
    mw, cf, hold = split_slots(route)
    fetch = fetch or default_fetch
    tried = []
    q = ("?" + query) if query and not str(query).startswith("?") else (query or "")

    def proxy(slot: str):
        base = HOP_BASE.get(slot) or HOP_BASE.get(hop_key(slot))
        if not base:
            return None
        url = base.rstrip("/") + path + q
        try:
            status, rh, raw = fetch(url, method, {CHAIN_HEADER: "1"}, body, timeout)
        except Exception as e:
            tried.append({"hop": slot, "error": type(e).__name__})
            return None
        if hop_miss(status):
            tried.append({"hop": slot, "status": int(status)})
            return None
        return {
            "handled": True,
            "via": slot,
            "status": int(status),
            "headers": rh,
            "body": raw,
            "tried": tried + [{"hop": slot, "status": int(status)}],
            "module": mod,
        }

    before, after, seen = [], [], False
    for slot in mw:
        if same_hop(slot, self_hop):
            seen = True
            continue
        (after if seen else before).append(slot)

    for slot in before:
        hit = proxy(slot)
        if hit:
            return hit

    if local is None:
        # Caller will serve this hop, then resume via local-miss if 404/405.
        return {
            "skip": True,
            "via": "local",
            "module": mod,
            "tried": tried,
            "rest": after,
            "cf": cf,
            "hold": hold,
        }
    out = local(path)
    if isinstance(out, dict) and out.get("handled") and not hop_miss(out.get("status", 200)):
        out = dict(out)
        out.setdefault("via", self_hop)
        out["module"] = mod
        out["tried"] = tried + [{"hop": self_hop, "via": "local"}]
        return out
    if isinstance(out, dict) and out.get("handled") and hop_miss(out.get("status", 200)):
        tried.append({"hop": self_hop, "status": int(out.get("status") or 0)})
    else:
        tried.append({"hop": self_hop, "error": "local-miss"})

    for slot in after:
        hit = proxy(slot)
        if hit:
            return hit

    return close_chain(cf, hold, decision, path, method, body, q, fetch, timeout, tried, mod, root)


def close_chain(cf, hold, decision, path, method, body, query, fetch, timeout, tried, mod, root=None):
    """Layer 4 CF if ALLOW, else layer 5 maintenance HTML. Never workers.dev. Never CF 503 on auth."""
    if cf and cf_allowed(decision, path):
        url = CF_FETCH.get(cf)
        if url and "workers.dev" not in str(url):
            try:
                status, rh, raw = fetch(url.rstrip("/") + path + (query or ""), method, {CHAIN_HEADER: "1"}, body, timeout)
                if not hop_miss(status):
                    return {
                        "handled": True,
                        "via": cf,
                        "status": int(status),
                        "headers": rh,
                        "body": raw,
                        "tried": tried,
                        "module": mod,
                    }
                tried.append({"hop": cf, "status": int(status)})
            except Exception as e:
                tried.append({"hop": cf, "error": type(e).__name__})
        else:
            tried.append({"hop": cf, "skipped": "cf-gate-only-or-no-url"})
    elif cf:
        tried.append({"hop": cf, "skipped": "metabol-%s" % decision})
    html = maintenance_bytes(root)
    return {
        "handled": True,
        "via": hold,
        "status": 200,
        "headers": {"Content-Type": "text/html; charset=utf-8", "X-Fog-Hold": "maintenance", "Cache-Control": "no-store", "X-Fog-Stasis-503": "false"},
        "body": html,
        "tried": tried,
        "module": mod,
        "maintenance": True,
    }
