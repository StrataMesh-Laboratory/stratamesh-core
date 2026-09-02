#!/usr/bin/env python3
"""Fog ping + keep-up stream. No network server. No STRATA movement."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fog_plugins.ping import PingPlugin, PingResult, PingTarget, refuse_workers_dev
from fog_plugins.keepup import KeepUpPlugin
from fog_plugins.rails import RailsPlug
from contribution import ContributionLedger
from strata_token import StrataTokenLedger


def test_refuse_workers_dev():
    assert refuse_workers_dev("https://x.workers.dev/health") is True
    assert refuse_workers_dev("https://fog.calhegasmorais.pt/health") is False


def test_ping_refuses_workers_dev():
    p = PingPlugin(targets=[PingTarget("bad", "https://stratamesh-spa.stratamesh.workers.dev/health")])
    r = p.ping_one(p.targets[0])
    assert r.ok is False and r.unready is True
    assert "workers.dev" in (r.error or "")


def _inject_ok(plugin: KeepUpPlugin):
    def tick():
        r = PingResult("workerd", "http://127.0.0.1:8788/health", True, 200, 12.0, False, None)
        plugin.ping._remember(r)
        return [r]
    plugin.ping.tick = tick  # type: ignore


def test_keepup_unready_zero_score():
    k = KeepUpPlugin("FOG-NODE-PT-CM-001", mesh_flags=lambda: {"n": 2, "oracle_live": False, "mesh_provision": {"f_max": 0}})
    def tick():
        r = PingResult("workerd", "http://127.0.0.1:8788/health", False, None, 40.0, True, "timeout")
        k.ping._remember(r)
        return [r]
    k.ping.tick = tick  # type: ignore
    s = k.measure()
    # workerd down → hop_ok 0 but fog in-process is up; unready because required workerd failed
    assert s.unready is True
    assert s.admissible is False
    assert s.score == 0.0


def test_keepup_ok_has_quantity_and_quality():
    k = KeepUpPlugin(
        "FOG-NODE-PT-CM-001",
        mesh_flags=lambda: {"n": 2, "oracle_live": False, "mesh_provision": {"f_max": 0}},
        resource_sample=lambda: type("S", (), {"cpu_percent": 20.0})(),
    )
    _inject_ok(k)
    s = k.measure()
    assert s.unready is False
    assert s.admissible is True
    assert s.quantity > 0
    assert s.quality > 0
    assert s.score == round(s.quantity * s.quality, 6)
    assert s.rails["mint_armed"] is False


def test_honesty_f_max_at_n2():
    k = KeepUpPlugin(
        "FOG-NODE-PT-CM-001",
        mesh_flags=lambda: {"n": 2, "oracle_live": False, "mesh_provision": {"f_max": 1}},
    )
    _inject_ok(k)
    s = k.measure()
    assert s.factors["honesty"] == 0.0
    assert s.admissible is False
    assert s.score == 0.0


def test_rails_do_not_mint():
    poc = ContributionLedger()
    tok = StrataTokenLedger()
    rails = RailsPlug(poc=poc, token=tok)
    k = KeepUpPlugin(
        "FOG-NODE-PT-CM-001",
        mesh_flags=lambda: {"n": 2, "oracle_live": False, "mesh_provision": {"f_max": 0}},
        resource_sample=lambda: type("S", (), {"cpu_percent": 10.0})(),
    )
    _inject_ok(k)
    k.on_sample = lambda sample: rails.ingest(sample, "FOG-NODE-PT-CM-001")
    s = k.measure()
    assert s.admissible is True
    assert rails.pending_poc > 0
    assert tok.total_supply == 0.0
    assert tok.balance("FOG-NODE-PT-CM-001") == 0.0
    assert rails.armed()["mint_armed"] is False
    assert rails.armed()["burn_armed"] is False
    # keepup is not a mintable poc kind until armed
    assert poc.balance("FOG-NODE-PT-CM-001") == 0.0


def test_stream_omits_secrets():
    k = KeepUpPlugin("FOG-NODE-PT-CM-001", mesh_flags=lambda: {"n": 2, "mesh_provision": {"f_max": 0}})
    _inject_ok(k)
    k.measure()
    blob = str(k.snapshot()) + str(k.stream_tail())
    assert "ghp_" not in blob and "cfat_" not in blob
    assert "://stratamesh" not in blob and ".workers.dev/" not in blob


def test_recycle_mw_exists_and_ports():
    from fog_plugins.runtime_mesh import MW_PORTS, recycle_mw
    assert callable(recycle_mw)
    assert MW_PORTS == (8790, 8791, 8792)
    assert recycle_mw() == 0


def test_tui_reboot_recycles_mw_before_kickstart():
    tui = Path(__file__).resolve().parent.parent / "deploy/mac-fog/fog-tui.py"
    text = tui.read_text(encoding="utf-8")
    start = text.index("def reboot_fog")
    end = text.index("\ndef ", start + 1)
    body = text[start:end]
    assert "recycle_mw" in body
    assert body.index("recycle_mw") < body.index("kickstart")

if __name__ == "__main__":
    failed = 0
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print("ok", name)
            except Exception as e:
                failed += 1
                print("FAIL", name, type(e).__name__, e)
    if failed:
        sys.exit(1)
    print("fog plugin invariants ok")
