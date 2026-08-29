"""Optional Tor SOCKS5h wrapper for Fog/EDGE gossip egress.

LAB only. Exclusive-off when FOG_TOR_SOCKS / TOR_SOCKS is unset.
Does not proxy Cloudflare GraphQL, GitHub, wrangler, or this lab's CF apex.
Not an anonymity claim. Stdlib; PySocks is optional if already installed.
"""
from __future__ import annotations

import http.client
import os
import socket
import ssl
import urllib.request
from typing import Any, Callable, Optional
from urllib.parse import urlparse

ENV_KEYS = ("FOG_TOR_SOCKS", "TOR_SOCKS")

_SKIP_SUFFIXES = (
    "cloudflare.com",
    "workers.dev",
    "github.com",
    "githubusercontent.com",
    "calhegasmorais.pt",
    "grok.me",
)

# Tests patch these. Unit tests never open a real socket.
direct_urlopen: Callable[..., Any] = urllib.request.urlopen


def socks_url() -> Optional[str]:
    for key in ENV_KEYS:
        val = (os.environ.get(key) or "").strip()
        if val:
            return val
    return None


def _host_of(url: str) -> str:
    return (urlparse(url).hostname or "").lower().rstrip(".")


def should_proxy(url: str) -> bool:
    if not socks_url():
        return False
    host = _host_of(url)
    if not host:
        return False
    if host.endswith(".onion"):
        return True
    for suf in _SKIP_SUFFIXES:
        if host == suf or host.endswith("." + suf):
            return False
    return True


def proxy_plan(url: str) -> dict:
    """Pure: which proxy (if any) would wrap this URL. No sockets."""
    proxy = socks_url()
    if not proxy or not should_proxy(url):
        return {
            "proxy": None,
            "dns": "direct",
            "scheme": None,
            "socks_host": None,
            "socks_port": None,
            "socks_user": None,
        }
    parsed = urlparse(proxy)
    scheme = (parsed.scheme or "").lower()
    return {
        "proxy": proxy,
        "scheme": scheme,
        "dns": "remote" if scheme == "socks5h" else "local",
        "socks_host": parsed.hostname,
        "socks_port": parsed.port or 9050,
        "socks_user": parsed.username,
    }


def _target_url(url) -> str:
    if isinstance(url, str):
        return url
    return url.get_full_url()


def urlopen(url, data=None, timeout: float = 5, **kwargs):
    """urllib.urlopen when env unset; SOCKS5h wrap when set and allowed."""
    plan = proxy_plan(_target_url(url))
    if plan["proxy"] is None:
        if data is None:
            return direct_urlopen(url, timeout=timeout, **kwargs)
        return direct_urlopen(url, data=data, timeout=timeout, **kwargs)
    return _socks_http(url, plan, data=data, timeout=timeout)


def _socks_http(url, plan: dict, data=None, timeout: float = 5):
    req = url if hasattr(url, "get_full_url") else urllib.request.Request(url, data=data)
    target = req.get_full_url()
    parsed = urlparse(target)
    dest_host = parsed.hostname
    dest_port = parsed.port or (443 if parsed.scheme == "https" else 80)
    sock = _dial(
        plan["socks_host"],
        int(plan["socks_port"]),
        dest_host,
        int(dest_port),
        timeout=timeout,
        username=plan.get("socks_user"),
        rdns=plan.get("dns") == "remote",
    )
    if parsed.scheme == "https":
        ctx = ssl.create_default_context()
        sock = ctx.wrap_socket(sock, server_hostname=dest_host)
    if parsed.scheme == "https":
        conn = http.client.HTTPSConnection(dest_host, dest_port, timeout=timeout)
    else:
        conn = http.client.HTTPConnection(dest_host, dest_port, timeout=timeout)
    conn.sock = sock
    path = parsed.path or "/"
    if parsed.query:
        path = path + "?" + parsed.query
    headers = {k: v for k, v in req.header_items()}
    body = req.data
    conn.request(req.get_method(), path, body=body, headers=headers)
    resp = conn.getresponse()
    resp._tor_conn = conn
    return resp


def _dial(proxy_host, proxy_port, dest_host, dest_port, timeout, username=None, rdns=True):
    try:
        import socks as pysocks  # optional extra
    except ImportError:
        pysocks = None
    if pysocks is not None:
        return pysocks.create_connection(
            (dest_host, dest_port),
            timeout=timeout,
            proxy_type=pysocks.PROXY_TYPE_SOCKS5,
            proxy_addr=proxy_host,
            proxy_port=proxy_port,
            proxy_username=username,
            proxy_rdns=rdns,
        )
    return _stdlib_dial(proxy_host, proxy_port, dest_host, dest_port, timeout, username, rdns)


def _stdlib_dial(proxy_host, proxy_port, dest_host, dest_port, timeout, username, rdns):
    """RFC 1928 CONNECT to a local Tor SOCKS port. Client only."""
    sock = socket.create_connection((proxy_host, proxy_port), timeout=timeout)
    try:
        if username:
            sock.sendall(b"\x05\x01\x02")
            ver, method = sock.recv(2)
            if method == 2:
                user_b = username.encode()
                sock.sendall(bytes([1, len(user_b)]) + user_b + bytes([0]))
                sock.recv(2)
        else:
            sock.sendall(b"\x05\x01\x00")
            sock.recv(2)
        host_b = dest_host.encode("idna")
        if rdns:
            req = b"\x05\x01\x00\x03" + bytes([len(host_b)]) + host_b
        else:
            # still send domain; operator should use socks5h
            req = b"\x05\x01\x00\x03" + bytes([len(host_b)]) + host_b
        req += dest_port.to_bytes(2, "big")
        sock.sendall(req)
        hdr = sock.recv(4)
        if len(hdr) < 4 or hdr[1] != 0:
            raise OSError("SOCKS CONNECT failed")
        atyp = hdr[3]
        if atyp == 1:
            sock.recv(6)
        elif atyp == 3:
            ln = sock.recv(1)[0]
            sock.recv(ln + 2)
        elif atyp == 4:
            sock.recv(18)
        return sock
    except Exception:
        sock.close()
        raise
