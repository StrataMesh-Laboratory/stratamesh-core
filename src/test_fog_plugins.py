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


def test_spawn_still_listens_when_host_cap_over():
    """host_cap.over is HOLD pacing, not a skip of mw Popen / :8790 listen."""
    import tempfile
    from unittest.mock import MagicMock, patch
    from fog_plugins import runtime_mesh

    plugin = runtime_mesh.RuntimeMeshPlugin()
    popen_cmds = []

    def fake_popen(cmd, *args, **kwargs):
        popen_cmds.append(list(cmd))
        m = MagicMock()
        m.pid = 4242
        return m

    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        data = root / "data"
        py = root / "ops" / "middleware" / "fog_mw.py"
        js = root / "ops" / "middleware" / "fog_mw.js"
        py.parent.mkdir(parents=True)
        py.write_text("# stub\n", encoding="utf-8")
        js.write_text("// stub\n", encoding="utf-8")
        with patch.object(runtime_mesh, "ROOT", root), \
             patch.object(runtime_mesh, "DATA", data), \
             patch.object(runtime_mesh.host_cap, "over", return_value=True), \
             patch.object(runtime_mesh, "_healthy", return_value=False), \
             patch.object(runtime_mesh, "_write_sha"), \
             patch.object(runtime_mesh.subprocess, "Popen", fake_popen), \
             patch.object(runtime_mesh.shutil, "which", return_value=None), \
             patch("builtins.open", MagicMock()):
            plugin._spawn()
    assert plugin.last_error == "host_cap"
    assert popen_cmds, "host_cap.over() must not return before Popen"
    assert popen_cmds[0][0] == "python3"


def test_attach_spawns_immediately_after_recycle():
    from unittest.mock import patch
    from fog_plugins.runtime_mesh import RuntimeMeshPlugin

    plugin = RuntimeMeshPlugin()
    order = []

    def rec(*_a, **_k):
        order.append("recycle")
        return 0

    def sp(*_a, **_k):
        order.append("spawn")

    def loop(self):
        self._stop.wait(0.05)

    with patch("fog_plugins.runtime_mesh.recycle_mw", rec), \
         patch.object(RuntimeMeshPlugin, "_spawn", sp), \
         patch.object(RuntimeMeshPlugin, "_loop", loop):
        plugin.attach()
        plugin.stop()
        if plugin._thread:
            plugin._thread.join(timeout=2)
    assert order[:2] == ["recycle", "spawn"]


def test_loop_does_not_continue_skip_on_host_cap():
    import inspect
    from fog_plugins.runtime_mesh import RuntimeMeshPlugin
    src = inspect.getsource(RuntimeMeshPlugin._spawn)
    assert "return" not in src.split("last_error")[1].split("DATA.mkdir")[0]
    loop = inspect.getsource(RuntimeMeshPlugin._loop)
    assert "continue" not in loop


def test_spawn_deno_8792_when_host_cap_over():
    """recycle_mw SIGTERMs :8792; host_cap HOLD must not leave deno dark."""
    import tempfile
    from unittest.mock import MagicMock, patch
    from fog_plugins import runtime_mesh

    plugin = runtime_mesh.RuntimeMeshPlugin()
    popen_cmds = []

    def fake_popen(cmd, *args, **kwargs):
        popen_cmds.append(list(cmd))
        m = MagicMock()
        m.pid = 8792
        return m

    def fake_which(name):
        if name == "deno":
            return "/usr/local/bin/deno"
        return None

    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        data = root / "data"
        ts = root / "ops" / "deno" / "main.ts"
        ts.parent.mkdir(parents=True)
        ts.write_text("// stub\n", encoding="utf-8")
        (root / "ops" / "middleware").mkdir(parents=True, exist_ok=True)
        (root / "ops" / "middleware" / "fog_mw.py").write_text("# stub\n", encoding="utf-8")
        with patch.object(runtime_mesh, "ROOT", root), \
             patch.object(runtime_mesh, "DATA", data), \
             patch.object(runtime_mesh.host_cap, "over", return_value=True), \
             patch.object(runtime_mesh, "_healthy", return_value=False), \
             patch.object(runtime_mesh, "_write_sha"), \
             patch.object(runtime_mesh.subprocess, "Popen", fake_popen), \
             patch.object(runtime_mesh.shutil, "which", fake_which), \
             patch("builtins.open", MagicMock()):
            plugin._spawn()
    assert plugin.last_error == "host_cap"
    deno_cmds = [c for c in popen_cmds if c and "deno" in str(c[0])]
    assert deno_cmds, "host_cap.over must not skip deno Popen"
    cmd = deno_cmds[0]
    assert "run" in cmd
    assert "--allow-net" in cmd and "--allow-env" in cmd and "--allow-read" in cmd
    assert any(str(x).endswith("ops/deno/main.ts") or str(x).endswith("main.ts") for x in cmd)
    py_cmds = [c for c in popen_cmds if c and c[0] == "python3"]
    assert py_cmds, "python :8790 must still spawn under host_cap.over"


def test_tui_g_always_brews():
    tui = Path(__file__).resolve().parent.parent / "deploy/mac-fog/fog-tui.py"
    text = tui.read_text(encoding="utf-8")
    pull = text[text.index("def git_pull_reboot"):text.index("\ndef mark")]
    assert "brew skip" not in pull
    assert "brew_update_upgrade()" in pull
    assert "brew skip (auto-g)" not in text
    assert "wait_key uses stdin" in text or "stdin only" in text
    assert "/dev/tty" in text[text.index("def _yn_from_tty"):text.index("def confirm")]


def test_auto_update_brews_before_runtime_skip():
    sh = Path(__file__).resolve().parent.parent / "deploy/mac-fog/fog-auto-update.sh"
    text = sh.read_text(encoding="utf-8")
    assert "brew skip (auto-g)" not in text
    assert text.index("brew update") < text.index("skip runtime-down")
    assert "brew upgrade" in text
    assert "recycle_mw((8787,8788,8790,8791,8792))" in text.replace(" ", "")


def test_recycle_skips_dead_mw_8s():
    from fog_plugins.runtime_mesh import DEAD_MW_SKIP_SEC, recycle_mw
    assert DEAD_MW_SKIP_SEC == 8.0
    assert recycle_mw() == 0



def _tui_fns():
    """Load spark/hop_spark without opening /dev/tty or running the TUI."""
    import ast
    tui = Path(__file__).resolve().parent.parent / "deploy/mac-fog/fog-tui.py"
    src = tui.read_text(encoding="utf-8")
    tree = ast.parse(src)
    keep = []
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name in ("spark", "hop_spark"):
            keep.append(node)
    mod = ast.Module(body=keep, type_ignores=[])
    ast.fix_missing_locations(mod)
    ns = {}
    exec(compile(mod, "fog-tui.py", "exec"), ns, ns)
    return ns["spark"], ns["hop_spark"]


def test_hop_spark_always_live_not_blank():
    spark, hop_spark = _tui_fns()
    blank = chr(0x2800)
    live = [1.0] * 16
    hs = hop_spark(live)
    assert hs
    assert blank not in hs
    assert all(ch == ":" for ch in hs)
    ss = spark(live)
    assert ss and all(ch == blank for ch in ss)
    down = [0.0] * 16
    hd = hop_spark(down)
    assert hd and all(ch == "." for ch in hd)
    assert blank not in hd
    mixed = [1.0, 0.0, 1.0, 0.0] * 4
    hm = hop_spark(mixed)
    assert ":" in hm and "." in hm
    assert blank not in hm
    tui = Path(__file__).resolve().parent.parent / "deploy/mac-fog/fog-tui.py"
    text = tui.read_text(encoding="utf-8")
    assert "hop_spark(hist)" in text
    assert "spark(LOAD_HIST)" in text



def test_hop_policy_five_slots_kernel_not_mw():
    import json
    pol = json.loads((Path(__file__).resolve().parent.parent / "ops/config/hop-policy.json").read_text(encoding="utf-8"))
    assert pol["fog"]["role"] == "kernel"
    assert pol["mw"]["workerd"] == 8788
    for name, route in pol["routes"].items():
        assert len(route) == 5, name
        assert "maintenance" in str(route[4])
        assert "workers.dev" not in json.dumps(route)
        if name != "html":
            assert str(route[3]).startswith("cf-")
            for hop in route[:3]:
                assert not str(hop).startswith("cf-")
                assert "fog:8787" not in str(hop)


def test_try_next_stasis_skips_cf_then_maintenance():
    import sys
    root = Path(__file__).resolve().parent.parent
    lib = str(root / "ops/lib")
    if lib not in sys.path:
        sys.path.insert(0, lib)
    import hop_chain

    def fetch(url, method="GET", headers=None, body=None, timeout=1.2):
        raise ConnectionError("down")

    pol = hop_chain.load_policy(root)
    out = hop_chain.try_next(
        "/api/auth/login",
        self_hop="python:8790",
        decision="STASIS",
        policy=pol,
        fetch=fetch,
        local=lambda _p: {"skip": True},
        root=root,
    )
    assert out.get("skip") is True
    assert out.get("rest") == ["node:8791", "deno:8792"]
    closed = hop_chain.close_chain(
        out["cf"], out["hold"], "STASIS", "/api/auth/login", "POST", b"{}", "",
        fetch, 1.2, [], "auth_wb_session", root,
    )
    assert closed.get("maintenance") is True
    assert closed["status"] == 200
    assert hop_chain.cf_allowed("STASIS", "/api/auth/login") is False
    health = hop_chain.try_next("/health", self_hop="python:8790", policy=pol, fetch=fetch)
    assert health.get("via") == "health"


def test_try_next_layer2_when_primary_down():
    import sys
    root = Path(__file__).resolve().parent.parent
    lib = str(root / "ops/lib")
    if lib not in sys.path:
        sys.path.insert(0, lib)
    import hop_chain

    def fetch(url, method="GET", headers=None, body=None, timeout=1.2):
        if ":8791" in url:
            return 200, {"Content-Type": "application/json"}, b'{"ok":true,"hop":"node:8791"}'
        raise ConnectionError("down")

    out = hop_chain.try_next(
        "/assemble",
        self_hop="python:8790",
        decision="ALLOW",
        policy=hop_chain.load_policy(root),
        fetch=fetch,
        local=lambda _p: {"skip": True},
        root=root,
    )
    assert out.get("handled") is True
    assert "node:8791" in str(out.get("via"))
    assert not out.get("maintenance")


def test_tui_fog_kernel_and_orch_4s():
    text = (Path(__file__).resolve().parent.parent / "deploy/mac-fog/fog-tui.py").read_text(encoding="utf-8")
    assert "kernel" in text and "MW cover" in text
    body = text[text.index("def orch_aiops_report"):text.index("def orch_aiops_report") + 1200]
    assert "4.0" in body

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
