"""
Named P0 ingest-guard asserts on top of A1 (lab n=1 kernel).

A1 (src/test_process_gossip.py) already gates: ≥3 PIDs, 0% spread,
SIGTERM one process, SQLite restart catch-up. This file ADDS:

  P0-A1-DUP-INV     duplicate INV → no extra ledger vertex
  P0-A1-DUP-TX      duplicate TX → exactly one state transition
  P0-A1-MALFORMED   malformed TX → HTTP 400 SYNTAX_ERRORS or accepted=false
  P0-A1-ROOT        second empty-parents root → 200 accepted=false
  P0-A1-TYPE        bad type → 200 accepted=false

Does NOT close multi-host P0. One host / local processes. Not mainnet, not aBFT.

Usage:
    python3 test_p0_ingest.py
"""

from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

from gossip import GossipNode, make_inv, make_tx
from p0_ingest_guard import (
    BAD_PARENTS,
    BAD_TYPE,
    DUPLICATE_TX,
    SECOND_ROOT,
    SYNTAX_ERRORS,
    guard_ingest,
)
from persistent_dag import PersistentDAG
from tip_selection import Transaction, TxType


def assert_true(cond: bool, msg: str) -> None:
    if not cond:
        print(f"FAIL: {msg}")
        sys.exit(1)
    print(f"  OK: {msg}")


def _known(*ids: str) -> set[str]:
    return set(ids)


# ---------------------------------------------------------------------------
# Unit: guard_ingest (no HTTP)
# ---------------------------------------------------------------------------

def test_syntax_blank_bad_json_missing() -> None:
    print("P0-A1-MALFORMED  malformed TX HTTP 400 SYNTAX_ERRORS")
    known = _known("genesis")
    bad_json = guard_ingest(b"{", known_ids=known)
    assert_true(bad_json.http_status == 400, "bad json → HTTP 400")
    assert_true(bad_json.code == SYNTAX_ERRORS, "bad json → SYNTAX_ERRORS")
    assert_true(bad_json.accepted is False, "bad json not accepted")

    missing = guard_ingest(b"{}", known_ids=known)
    assert_true(missing.http_status == 400, "missing tx_id → HTTP 400")
    assert_true(missing.code == SYNTAX_ERRORS, "missing tx_id → SYNTAX_ERRORS")
    assert_true("missing" in missing.reason, "reason names missing tx_id")

    blank = guard_ingest(b'{"tx_id": ""}', known_ids=known)
    assert_true(blank.http_status == 400, "blank id → HTTP 400")
    assert_true(blank.code == SYNTAX_ERRORS, "blank id → SYNTAX_ERRORS")

    ws = guard_ingest(b'{"tx_id": "   "}', known_ids=known)
    assert_true(ws.http_status == 400, "whitespace id → HTTP 400")
    assert_true(ws.code == SYNTAX_ERRORS, "whitespace id → SYNTAX_ERRORS")


def test_duplicate_tx_one_transition() -> None:
    print("P0-A1-DUP-TX  duplicate TX exactly one state transition (guard)")
    known = _known("genesis", "tx-a")
    d = guard_ingest(
        b'{"tx_id":"tx-a","tx_type":"standard","parents":["genesis"]}',
        known_ids=known,
    )
    assert_true(d.http_status == 200, "duplicate → HTTP 200")
    assert_true(d.accepted is False, "duplicate not accepted")
    assert_true(d.code == DUPLICATE_TX, "duplicate code DUPLICATE_TX")


def test_second_root_and_bad_type_parents() -> None:
    print("P0-A1-ROOT  second empty-parents root → accepted=false")
    known = _known("genesis")
    root = guard_ingest(
        b'{"tx_id":"root-2","parents":[]}',
        known_ids=known,
        genesis_id="genesis",
    )
    assert_true(root.http_status == 200, "second root → HTTP 200")
    assert_true(root.accepted is False, "second root not accepted")
    assert_true(root.code == SECOND_ROOT, "second root code SECOND_ROOT")

    print("P0-A1-TYPE  bad type → accepted=false")
    bad_t = guard_ingest(
        b'{"tx_id":"tx-badtype","tx_type":"not-a-type","parents":["genesis"]}',
        known_ids=known,
    )
    assert_true(bad_t.http_status == 200, "bad type → HTTP 200")
    assert_true(bad_t.accepted is False, "bad type not accepted")
    assert_true(bad_t.code == BAD_TYPE, "bad type code BAD_TYPE")

    bad_p = guard_ingest(
        b'{"tx_id":"tx-orphan","tx_type":"standard","parents":["no-such"]}',
        known_ids=known,
    )
    assert_true(bad_p.accepted is False, "unknown parent not accepted")
    assert_true(bad_p.code == BAD_PARENTS, "unknown parent code BAD_PARENTS")
    assert_true(bad_p.http_status == 200, "unknown parent → HTTP 200")


def test_happy_path_accepted() -> None:
    print("happy-path ingest classified accepted (parents exist)")
    known = _known("genesis")
    ok = guard_ingest(
        b'{"tx_id":"tx-ok","tx_type":"standard","parents":["genesis"],"weight":1}',
        known_ids=known,
    )
    assert_true(ok.accepted is True, "valid tx accepted by guard")
    assert_true(ok.http_status == 200, "valid tx HTTP 200")
    assert_true(ok.tx_id == "tx-ok", "tx_id preserved")
    assert_true(ok.parents == ("genesis",), "parents preserved")


# ---------------------------------------------------------------------------
# In-process gossip: duplicate INV does not attach
# ---------------------------------------------------------------------------

def test_duplicate_inv_no_extra_vertex() -> None:
    print("P0-A1-DUP-INV  duplicate INV no extra ledger vertex")
    fd, db = tempfile.mkstemp(prefix="p0-inv-", suffix=".db")
    os.close(fd)
    try:
        dag = PersistentDAG(db)
        g = GossipNode(dag)
        before = len(dag.txs)
        ids = list(dag.txs.keys())
        g.handle_message(make_inv(ids))
        g.handle_message(make_inv(ids))
        g.handle_message(make_inv(ids + ["not-a-real-tx-id"]))
        after = len(dag.txs)
        assert_true(after == before, f"INV replay did not add vertices ({before}→{after})")
        assert_true("not-a-real-tx-id" not in dag.txs, "unknown INV id did not become a vertex")
        dag.close()
    finally:
        for p in (db, db + "-wal", db + "-shm"):
            if os.path.exists(p):
                os.remove(p)


def test_duplicate_tx_gossip_one_attach() -> None:
    print("P0-A1-DUP-TX  gossip TX replay attaches once")
    fd, db = tempfile.mkstemp(prefix="p0-gtx-", suffix=".db")
    os.close(fd)
    try:
        dag = PersistentDAG(db)
        g = GossipNode(dag)
        tx = Transaction(
            tx_id="lab-dup-tx",
            tx_type=TxType.STANDARD,
            parents=["genesis"],
            weight=1.0,
        )
        before = len(dag.txs)
        g.handle_message(make_tx(tx))
        mid = len(dag.txs)
        g.handle_message(make_tx(tx))
        after = len(dag.txs)
        assert_true(mid == before + 1, "first TX attached exactly one vertex")
        assert_true(after == mid, "second TX did not attach another vertex")
        assert_true("lab-dup-tx" in dag.txs, "tx_id present once")
        dag.close()
    finally:
        for p in (db, db + "-wal", db + "-shm"):
            if os.path.exists(p):
                os.remove(p)


# ---------------------------------------------------------------------------
# HTTP wire against one node_persistent process
# ---------------------------------------------------------------------------

def _http_json(method: str, url: str, data: dict | None = None, raw: bytes | None = None):
    body = raw
    headers = {}
    if data is not None:
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        payload = e.read().decode()
        try:
            obj = json.loads(payload)
        except Exception:
            obj = {"raw": payload}
        return e.code, obj


def test_http_ingest_wire() -> None:
    print("HTTP POST /tx/ingest wire (one local process; n=1)")
    src = os.path.dirname(os.path.abspath(__file__))
    script = os.path.join(src, "node_persistent.py")
    port = int(os.environ.get("STRATAMESH_P0_INGEST_PORT", "18787"))
    fd, db = tempfile.mkstemp(prefix="p0-http-", suffix=".db")
    os.close(fd)
    logf = tempfile.NamedTemporaryFile(prefix="p0-http-node-", suffix=".log", delete=False)
    proc = subprocess.Popen(
        [sys.executable, script, "--port", str(port), "--db", db, "--id", "FOG-P0-INGEST-01"],
        cwd=src,
        stdout=logf,
        stderr=subprocess.STDOUT,
    )
    base = f"http://127.0.0.1:{port}"
    try:
        deadline = time.time() + 12
        while time.time() < deadline:
            try:
                st, _ = _http_json("GET", f"{base}/health")
                if st == 200:
                    break
            except Exception:
                time.sleep(0.15)
        else:
            logf.flush()
            try:
                with open(logf.name, encoding="utf-8", errors="replace") as fh:
                    tail = fh.read()[-800:]
            except Exception:
                tail = ""
            raise SystemExit(
                "ASSERT FAIL: ingest-guard node did not become healthy\n" + tail
            )

        st0, inv0 = _http_json("GET", f"{base}/inv")
        assert_true(st0 == 200, "GET /inv 200")
        n0 = len(list(inv0.get("ids") or []))

        # happy path
        st, body = _http_json(
            "POST",
            f"{base}/tx/ingest",
            {
                "tx_id": "lab-http-1",
                "tx_type": "standard",
                "parents": ["genesis"],
                "weight": 1.0,
            },
        )
        assert_true(st == 200 and body.get("accepted") is True, "valid ingest accepted=true")

        # P0-A1-DUP-TX HTTP: same tx again
        st, body = _http_json(
            "POST",
            f"{base}/tx/ingest",
            {
                "tx_id": "lab-http-1",
                "tx_type": "standard",
                "parents": ["genesis"],
                "weight": 1.0,
            },
        )
        assert_true(st == 200, "duplicate TX HTTP 200")
        assert_true(body.get("accepted") is False, "duplicate TX accepted=false")
        st2, inv2 = _http_json("GET", f"{base}/inv")
        n2 = len(list(inv2.get("ids") or []))
        assert_true(n2 == n0 + 1, f"exactly one state transition ({n0}→{n2})")
        st_inv, inv = _http_json("GET", f"{base}/inv")
        ids = list(inv.get("ids") or [])
        assert_true(ids.count("lab-http-1") <= 1, "duplicate TX did not duplicate inventory id")
        assert_true("lab-http-1" in ids, "accepted tx_id in inventory")

        # P0-A1-MALFORMED HTTP
        st, body = _http_json("POST", f"{base}/tx/ingest", raw=b"{")
        assert_true(st == 400, "bad json HTTP 400")
        assert_true(
            body.get("error") == SYNTAX_ERRORS or body.get("code") == SYNTAX_ERRORS,
            "bad json body names SYNTAX_ERRORS",
        )
        st, body = _http_json("POST", f"{base}/tx/ingest", {})
        assert_true(st == 400, "missing tx_id HTTP 400")
        st, body = _http_json("POST", f"{base}/tx/ingest", {"tx_id": ""})
        assert_true(st == 400, "blank id HTTP 400")

        # P0-A1-ROOT HTTP
        st, body = _http_json(
            "POST",
            f"{base}/tx/ingest",
            {"tx_id": "lab-second-root", "parents": []},
        )
        assert_true(st == 200, "second root HTTP 200")
        assert_true(body.get("accepted") is False, "second root accepted=false")

        # P0-A1-TYPE HTTP
        st, body = _http_json(
            "POST",
            f"{base}/tx/ingest",
            {
                "tx_id": "lab-bad-type",
                "tx_type": "definitely-not-a-type",
                "parents": ["genesis"],
            },
        )
        assert_true(st == 200, "bad type HTTP 200")
        assert_true(body.get("accepted") is False, "bad type accepted=false")

        st3, inv3 = _http_json("GET", f"{base}/inv")
        n3 = len(list(inv3.get("ids") or []))
        assert_true(n3 == n0 + 1, "rejects did not add extra vertices")
    finally:
        if proc.poll() is None:
            try:
                proc.send_signal(signal.SIGTERM)
                proc.wait(timeout=4)
            except Exception:
                proc.kill()
                proc.wait(timeout=2)
        for p in (db, db + "-wal", db + "-shm"):
            if os.path.exists(p):
                os.remove(p)


if __name__ == "__main__":
    print(
        "Honesty: lab n=1 ingest-guard; does NOT close multi-host P0; "
        "A1 kill/catch-up stays in test_process_gossip.py"
    )
    test_syntax_blank_bad_json_missing()
    test_duplicate_tx_one_transition()
    test_second_root_and_bad_type_parents()
    test_happy_path_accepted()
    test_duplicate_inv_no_extra_vertex()
    test_duplicate_tx_gossip_one_attach()
    test_http_ingest_wire()
    print("\nAll P0 ingest-guard named asserts passed (n=1 kernel; P0 still OPEN).")
