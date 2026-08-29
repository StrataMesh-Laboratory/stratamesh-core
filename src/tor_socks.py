"""Fog import path for the optional Tor SOCKS5h helper (ops/tor/socks.py).

Exclusive-off. See ops/tor/README.md. LAB only.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

_OPS = Path(__file__).resolve().parents[1] / "ops" / "tor" / "socks.py"
_spec = importlib.util.spec_from_file_location("ops_tor_socks", _OPS)
if _spec is None or _spec.loader is None:
    raise ImportError("ops/tor/socks.py missing")
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

ENV_KEYS = _mod.ENV_KEYS
socks_url = _mod.socks_url
should_proxy = _mod.should_proxy
proxy_plan = _mod.proxy_plan
urlopen = _mod.urlopen
direct_urlopen = _mod.direct_urlopen
