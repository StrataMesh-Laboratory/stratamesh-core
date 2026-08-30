"""Shared observe-probe contract for GitHub Actions.

Live HTTP / WAF / hop / timeout is HOLD, never a red check.
Hard FAIL is only a repo bug (workers.dev URL in config, leaked secret).
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any

TRANSIENT_HTTP = {0, 403, 408, 429, 502, 503, 504, 530, 1015}
UA = "StrataMesh-GHA-Observe/1.0 (+https://github.com/StrataMesh-Laboratory/stratamesh-core)"


def is_hold_http(code: int | None) -> bool:
    return int(code or 0) in TRANSIENT_HTTP


def fetch_json(url: str, timeout: int = 12, accept: str = "application/json") -> dict[str, Any]:
    low = url.lower()
    if "workers.dev" in low:
        return {"url": url, "ok": False, "hard": True, "hold": False, "http": 0, "error": "workers.dev forbidden"}
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept}, method="GET")
    t0 = datetime.now(timezone.utc)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            ms = int((datetime.now(timezone.utc) - t0).total_seconds() * 1000)
            try:
                body: Any = json.loads(raw.decode() or "{}")
            except Exception:
                return {
                    "url": url,
                    "ok": False,
                    "hold": True,
                    "hard": False,
                    "http": r.status,
                    "ms": ms,
                    "error": "not-json",
                    "body": {"_text": raw[:240].decode("utf-8", "replace")},
                }
            return {
                "url": url,
                "ok": 200 <= r.status < 400,
                "hold": False,
                "hard": False,
                "http": r.status,
                "ms": ms,
                "ct": r.headers.get("Content-Type") or "",
                "body": body,
            }
    except urllib.error.HTTPError as e:
        hold = is_hold_http(e.code)
        return {"url": url, "ok": False, "hold": hold, "hard": False, "http": e.code, "error": str(e.reason), "ms": 0}
    except Exception as e:
        return {
            "url": url,
            "ok": False,
            "hold": True,
            "hard": False,
            "http": 0,
            "error": f"{type(e).__name__}: {e}",
            "ms": 0,
        }
