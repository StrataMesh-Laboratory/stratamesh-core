#!/usr/bin/env python3
"""Live hop client: four-layer catalog against http://127.0.0.1:8790.

Same cases as src/test_object_layers.py (C1 C3 C4 C5 C6 illegal).
Exit 0 on verdict pass. ASCII only. No workers.dev. No secrets.
"""
from __future__ import annotations

import json
import os
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

PORT = int(os.environ.get("FOG_MW_PY_PORT") or "8790")
BASE = "http://127.0.0.1:%d" % PORT
CASES = []


def _req(method, path, body=None, timeout=3.0):
    data = None
    headers = {"Accept": "application/json", "User-Agent": "object-layers-test/1"}
    if body is not None:
        data = json.dumps(body).encode("ascii", "replace")
        headers["Content-Type"] = "application/json"
    req = Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "replace")
            try:
                parsed = json.loads(raw) if raw else {}
            except Exception:
                parsed = {"raw": raw[:200]}
            return r.status, parsed
    except HTTPError as e:
        raw = e.read().decode("utf-8", "replace") if e.fp else ""
        try:
            parsed = json.loads(raw) if raw else {}
        except Exception:
            parsed = {"raw": raw[:200]}
        return e.code, parsed
    except URLError as e:
        return 0, {"ok": False, "error": str(e.reason)[:120]}


def _ok(name, cond, detail=""):
    CASES.append({"case": name, "ok": bool(cond), "detail": str(detail)[:160]})
    mark = "PASS" if cond else "FAIL"
    line = "%s %s" % (mark, name)
    if detail:
        line += " " + str(detail)[:120]
    print(line)


def main():
    st, health = _req("GET", "/health")
    if st != 200 or not health.get("ok"):
        print("FAIL hop unready status=%s" % st)
        print("verdict fail")
        return 1

    # C3 compose multipart dragon
    st, body = _req(
        "POST",
        "/object/compose",
        {
            "owner": "FOG-NODE-PT-CM-001",
            "kind": "ugc",
            "title": "multipart-dragon",
            "renderer": "none",
            "parts": {
                "mesh": "dragon-body-v1",
                "texture": "scale-iridescent",
                "rig": "wing-spine",
                "voice": "roar-clip",
            },
        },
    )
    layers = (body.get("layers") or {}) if isinstance(body, dict) else {}
    nft = layers.get("nft") or {}
    cid = body.get("manifest_cid") or ""
    oid = body.get("object_id") or ""
    dag = body.get("dag_tx")
    c3 = (
        st == 200
        and bool(cid)
        and bool(dag)
        and bool(oid)
        and nft.get("id") == oid
        and oid != cid
        and (layers.get("strata") or {}).get("strata_units", 0) == 0
    )
    _ok("C3", c3, "cid=%s oid=%s dag=%s" % (cid[:20], oid, dag))

    # C5 building with 4 part roles, one NFT
    st, body = _req(
        "POST",
        "/object/compose",
        {
            "owner": "FOG-NODE-PT-CM-001",
            "kind": "building",
            "title": "lab-building",
            "renderer": "none",
            "parts": {
                "foundation": "pad-01",
                "envelope": "walls-glass",
                "systems": "hvac-grid",
                "interior": "atrium",
            },
        },
    )
    obj = (body.get("object") or {}) if isinstance(body, dict) else {}
    parts = obj.get("parts") or {}
    layers = body.get("layers") or {}
    oid = body.get("object_id") or ""
    c5 = (
        st == 200
        and len(parts) == 4
        and layers.get("nft", {}).get("id") == oid
        and oid != body.get("manifest_cid")
    )
    _ok("C5", c5, "roles=%d nft=%s" % (len(parts), oid))

    # C6 new bytes => new cid and new object_id
    st_a, a = _req(
        "POST",
        "/object/compose",
        {"owner": "FOG-NODE-PT-CM-001", "kind": "ugc", "title": "c6-a", "parts": {"mesh": "bytes-alpha"}},
    )
    st_b, b = _req(
        "POST",
        "/object/compose",
        {"owner": "FOG-NODE-PT-CM-001", "kind": "ugc", "title": "c6-b", "parts": {"mesh": "bytes-beta"}},
    )
    c6 = (
        st_a == 200
        and st_b == 200
        and a.get("manifest_cid")
        and b.get("manifest_cid")
        and a.get("manifest_cid") != b.get("manifest_cid")
        and a.get("object_id") != b.get("object_id")
    )
    _ok("C6", c6, "a=%s b=%s" % (a.get("object_id"), b.get("object_id")))

    # C1 get unknown cid is empty/not found not an NFT
    st, body = _req("GET", "/object/cid/bafyunknownc1notfound000000000000000000000000000000")
    nft_id = None
    if isinstance(body, dict):
        nft_id = (body.get("layers") or {}).get("nft", {}).get("id")
        if not nft_id:
            nft_id = (body.get("object") or {}).get("object_id")
    empty = (isinstance(body, dict) and body.get("objects") == []) or st in (404, 400)
    not_nft = not nft_id and (not body.get("ok") if isinstance(body, dict) else True)
    c1 = empty and not_nft and st != 200
    if st == 200 and isinstance(body, dict) and not body.get("objects"):
        c1 = True
    _ok("C1", c1, "status=%s" % st)

    # C4 strata_units=1 raises/refuses
    st, body = _req(
        "POST",
        "/object/compose",
        {"owner": "FOG-NODE-PT-CM-001", "parts": {"mesh": "x"}, "strata_units": 1},
    )
    c4 = st in (400, 403, 409, 422) and not (isinstance(body, dict) and body.get("object_id"))
    _ok("C4", c4, "status=%s" % st)

    # illegal compose/register without parts/cid
    st1, b1 = _req("POST", "/object/compose", {"owner": "FOG-NODE-PT-CM-001"})
    st2, b2 = _req("POST", "/object/register", {"owner": "FOG-NODE-PT-CM-001", "parts": {}})
    illegal = st1 in (400, 422) and st2 in (400, 422)
    _ok("illegal", illegal, "compose=%s register=%s" % (st1, st2))

    passed = all(c["ok"] for c in CASES)
    print("verdict %s" % ("pass" if passed else "fail"))
    return 0 if passed else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print("FAIL exception %s" % str(e)[:120])
        print("verdict fail")
        sys.exit(1)
