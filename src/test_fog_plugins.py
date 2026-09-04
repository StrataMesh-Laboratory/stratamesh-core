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


def test_host_cap_ignores_huge_loadavg():
    """Mach load1=389 must not trip over by itself (screenshot false positive)."""
    from unittest.mock import patch
    from fog_plugins import host_cap

    with patch.object(host_cap.os, "getloadavg", return_value=(389.391, 200.0, 100.0)), \
         patch.object(host_cap.os, "cpu_count", return_value=8), \
         patch.object(host_cap, "_mem_frac", return_value=0.77), \
         patch.object(host_cap, "_disk_frac", return_value=0.35), \
         patch.object(host_cap, "_cpu_frac", return_value=0.21):
        snap = host_cap.snapshot()
    assert snap["load1"] == 389.391
    assert snap["over"] is False
    assert snap["reason"] == "ok"


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
        m.poll.return_value = None
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
             patch.object(runtime_mesh, "_write_sha") as write_sha, \
             patch.object(runtime_mesh.subprocess, "Popen", fake_popen), \
             patch.object(runtime_mesh.shutil, "which", return_value=None), \
             patch("builtins.open", MagicMock()):
            plugin._spawn()
    assert popen_cmds, "host_cap.over() must not return before Popen"
    assert plugin.last_error != "host_cap", "dark hops must not paint last_error=host_cap"
    assert popen_cmds[0][0] == "python3"
    assert write_sha.called, "HOLD must still stamp git sha after spawn"


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
        m.poll.return_value = None
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
    assert plugin.last_error != "host_cap", "dark :8791 must keep dyld/mw RCA, not host_cap"
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
    assert "brew skip" not in text
    assert "brew_update_upgrade()" in pull
    # ? wizard must lock g/s/b/r/q into composer (not dashboard) while HELP
    assert "WIZARD_RESERVED = frozenset()" in text
    assert "gGsSbBqQrR" not in text
    assert "lock keyboard to the wizard" in text
    assert "No blocking y/n" in text or "g running" in text
    assert "brew skip (auto-g)" not in text
    brew_fn = text[text.index("def brew_update_upgrade"):text.index("def runtime_mesh_last_error")]
    assert "reinstall" in brew_fn and "llhttp" in brew_fn and "ada-url" in brew_fn and "node" in brew_fn
    assert brew_fn.index("upgrade") < brew_fn.index("reinstall")
    assert "/usr/local/bin" in text and "/opt/homebrew/bin" in text
    assert "wait_key uses stdin" in text or "stdin only" in text
    assert "/dev/tty" in text[text.index("def _yn_from_tty"):text.index("def confirm")]
    assert "_brew_clt_miss" in text
    assert "clt-miss" in brew_fn
    assert "skip-recycle" in brew_fn
    assert "skip recycle (CLT miss)" in pull
    assert pull.index("brew_update_upgrade()") < pull.index("reboot_fog()")


def test_tui_brew_clt_miss_skips_recycle():
    """CLT brew stderr must mark clt-miss; git_pull_reboot must not call reboot_fog/recycle."""
    import ast
    import types
    from unittest.mock import patch

    tui_path = Path(__file__).resolve().parent.parent / "deploy/mac-fog/fog-tui.py"
    src = tui_path.read_text(encoding="utf-8")
    assert "def _brew_clt_miss" in src
    tree = ast.parse(src)
    want = {
        "_brew_clt_miss",
        "_brew_bottle_miss",
        "brew_update_upgrade",
        "_brew_env",
        "_which_brew_node",
        "_official_node_bin",
        "_alias_missing_node_dylib",
    }
    ns = {"__name__": "fog_tui_clt_test"}
    # Minimal deps the extracted fns close over / reference at runtime
    import os, shutil, subprocess, time
    from pathlib import Path as P
    ns.update({"os": os, "shutil": shutil, "subprocess": subprocess, "time": time, "Path": P, "FOG": P("/tmp"), "REPO": P("/tmp")})
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name in want:
            code = compile(ast.Module(body=[node], type_ignores=[]), str(tui_path), "exec")
            exec(code, ns)
    assert ns["_brew_clt_miss"]("Error: Xcode alone is not sufficient on this machine")
    assert ns["_brew_clt_miss"]("install the Command Line Tools: xcode-select --install")
    assert not ns["_brew_clt_miss"]("Already up-to-date.")

    clt_err = (
        "Error: Xcode alone is not sufficient on this machine.\n"
        "Install the Command Line Tools:\n  xcode-select --install\n"
    )

    class FakeProc:
        def __init__(self, rc=1, err=""):
            self.returncode = rc
            self.stderr = err
            self.stdout = ""

    calls = []

    def fake_run(cmd, **kwargs):
        calls.append(list(cmd))
        if cmd and str(cmd[0]).endswith("brew") and cmd[1] in ("update", "upgrade"):
            return FakeProc(1, clt_err)
        if cmd and "node" in str(cmd[0]) and "-v" in cmd:
            return FakeProc(1, "dyld: Library not loaded: /usr/local/opt/llhttp/lib/libllhttp.9.3.dylib")
        return FakeProc(0, "")

    with patch.object(ns["subprocess"], "run", fake_run), \
         patch.dict(ns, {"_which_brew_node": lambda name: "/opt/homebrew/bin/" + name}):
        note = ns["brew_update_upgrade"]()
    assert "clt-miss" in note
    assert "skip-recycle" in note
    assert any(c[1] == "update" for c in calls if len(c) > 1)
    assert any(c[1] == "upgrade" for c in calls if len(c) > 1)
    assert not any(c[1] == "reinstall" for c in calls if len(c) > 1)
    # Static: g path skips reboot_fog on clt-miss
    pull = src[src.index("def git_pull_reboot"): src.index("\ndef mark")]
    assert 'if "clt-miss" in brew_note' in pull or "skip-recycle" in pull
    assert "skip recycle (CLT miss)" in pull


def test_auto_update_brews_before_runtime_skip():
    sh = Path(__file__).resolve().parent.parent / "deploy/mac-fog/fog-auto-update.sh"
    text = sh.read_text(encoding="utf-8")
    assert "brew skip (auto-g)" not in text
    assert "brew skip" not in text
    assert "run_brew_verb update" in text and "run_brew_verb upgrade" in text
    assert text.index("run_brew_verb update") < text.index("skip runtime-down")
    assert "llhttp" in text and "ada-url" in text
    assert "brew reinstall llhttp ada-url node" in text
    assert text.index("run_brew_verb upgrade") < text.index("brew reinstall llhttp ada-url node")
    assert "recycle_mw((8787,8788,8790,8791,8792))" in text.replace(" ", "")
    assert "node :8791 dark after brew" in text
    assert "recycle_mw((8791,))" in text.replace(" ", "")
    assert "libllhttp.9.3.dylib" in text
    assert "/usr/local/opt/llhttp/lib" in text
    assert "heal_node_dyld" in text
    assert "pull anyway" in text
    assert "BREW_CLT_MISS" in text
    assert "brew_clt_miss" in text
    assert "Xcode alone is not sufficient" in text
    assert "xcode-select" in text
    assert "Command Line Tools" in text
    assert "CLT miss — skip recycle_mw" in text
    assert text.index('if [[ "$BREW_CLT_MISS" -eq 1 ]]') < text.index(
        "recycle_mw((8787,8788,8790,8791,8792))"
    )


def test_auto_update_clt_miss_skips_recycle_keeps_brew():
    """Lab-harness needle: CLT brew failure must not call recycle_mw; brew still always invoked."""
    sh = Path(__file__).resolve().parent.parent / "deploy/mac-fog/fog-auto-update.sh"
    text = sh.read_text(encoding="utf-8")
    assert "run_brew_verb update" in text
    assert "run_brew_verb upgrade" in text
    assert "brew skip" not in text
    assert "node :8791 dark + CLT miss — heal_node_dyld only; skip recycle_mw/kickstart" in text
    # already-on-main :8791 dark — CLT branch heals only (log may name recycle; call must not).
    anchor = text.index("node :8791 dark + CLT miss")
    dark_if = text.rfind('if [[ "$BREW_CLT_MISS" -eq 1 ]]; then', 0, anchor)
    dark_block = text[dark_if: text.index("exit 0", anchor)]
    clt_dark = dark_block.split("else", 1)[0]
    assert "heal_node_dyld" in clt_dark
    assert "recycle_mw(" not in clt_dark
    assert "launchctl kickstart" not in clt_dark
    # pull path — CLT branch before else must not invoke recycle_mw(...)
    pull_idx = text.index("CLT miss — skip recycle_mw / hop kills / kickstart")
    pull_if = text.rfind('if [[ "$BREW_CLT_MISS" -eq 1 ]]; then', 0, pull_idx)
    pull_block = text[pull_if: text.index("kickstart fog+workerd done", pull_idx) + 40]
    clt_pull = pull_block.split("else", 1)[0]
    assert "recycle_mw(" not in clt_pull
    assert "launchctl kickstart" not in clt_pull


def test_heal_node_dyld_parses_ada():
    from fog_plugins.runtime_mesh import alias_missing_node_dylib, _dyld_node_error
    assert _dyld_node_error("Library not loaded: /usr/local/opt/ada-url/lib/libada.3.dylib")
    # no Cellar on this hop — function must not raise
    note = alias_missing_node_dylib(
        "dyld: Library not loaded: /usr/local/opt/ada-url/lib/libada.3.dylib"
    )
    assert isinstance(note, str)


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
        local=lambda _p: {},
        root=root,
    )
    assert out.get("maintenance") is True
    assert out.get("status") == 200
    assert "503" not in str(out.get("status"))
    assert hop_chain.cf_allowed("STASIS", "/api/auth/login") is False
    skipped = " ".join(str(x) for x in (out.get("tried") or []))
    assert "metabol" in skipped or "STASIS" in skipped
    health = hop_chain.try_next("/health", self_hop="python:8790", policy=pol, fetch=fetch)
    assert health.get("via") == "health"
    assert health.get("skip") is True


def test_try_next_health_not_chained():
    import sys
    root = Path(__file__).resolve().parent.parent
    lib = str(root / "ops/lib")
    if lib not in sys.path:
        sys.path.insert(0, lib)
    import hop_chain
    fetched = []

    def fetch(url, method="GET", headers=None, body=None, timeout=1.2):
        fetched.append(url)
        return 200, {}, b"{}"

    pol = hop_chain.load_policy(root)
    for path in ("/health", "/mw/health", "/"):
        out = hop_chain.try_next(path, self_hop="python:8790", policy=pol, fetch=fetch)
        assert out.get("via") == "health" and out.get("skip") is True
    assert fetched == []


def test_try_next_layer2_when_primary_down():
    import sys
    root = Path(__file__).resolve().parent.parent
    lib = str(root / "ops/lib")
    if lib not in sys.path:
        sys.path.insert(0, lib)
    import hop_chain

    def fetch(url, method="GET", headers=None, body=None, timeout=1.2):
        if ":8790" in url:
            raise ConnectionError("primary down")
        if ":8791" in url:
            return 200, {"Content-Type": "application/json"}, b'{"ok":true,"hop":"node:8791"}'
        raise ConnectionError("down")

    out = hop_chain.try_next(
        "/api/auth/login",
        self_hop="workerd:8788",
        decision="ALLOW",
        policy=hop_chain.load_policy(root),
        fetch=fetch,
        local=lambda _p: {},
        root=root,
    )
    assert out.get("handled") is True
    assert "node:8791" in str(out.get("via"))
    assert not out.get("maintenance")

    def fetch404(url, method="GET", headers=None, body=None, timeout=1.2):
        if ":8790" in url:
            return 404, {"Content-Type": "application/json"}, b'{"ok":false}'
        if ":8791" in url:
            return 200, {"Content-Type": "application/json"}, b'{"ok":true,"hop":"node:8791"}'
        raise ConnectionError("down")

    out404 = hop_chain.try_next(
        "/api/auth/login",
        self_hop="workerd:8788",
        decision="ALLOW",
        policy=hop_chain.load_policy(root),
        fetch=fetch404,
        local=lambda _p: {},
        root=root,
    )
    assert out404.get("handled") is True
    assert "node:8791" in str(out404.get("via"))


def test_which_bin_brew_path_when_which_none():
    import os
    import tempfile
    from unittest.mock import patch
    from fog_plugins import runtime_mesh

    assert "/opt/homebrew/bin" in runtime_mesh.WHICH_FALLBACK_DIRS
    with tempfile.TemporaryDirectory() as td:
        brew = Path(td) / "opt" / "homebrew" / "bin"
        brew.mkdir(parents=True)
        node = brew / "node"
        node.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
        os.chmod(node, 0o755)
        # No FOG_HOME official — brew path must still resolve when node -v succeeds.
        with patch.object(runtime_mesh.shutil, "which", return_value=None), \
             patch.object(runtime_mesh, "WHICH_FALLBACK_DIRS", (str(brew), "/usr/local/bin")), \
             patch.object(runtime_mesh, "FOG", Path(td) / "nofog"), \
             patch.dict(runtime_mesh.os.environ, {"FOG_HOME": str(Path(td) / "nofog")}, clear=False), \
             patch.object(runtime_mesh, "_NODE_PROBE_FAIL_UNTIL", 0.0), \
             patch.object(runtime_mesh, "_NODE_PROBE_ERR", ""):
            # Reset module backoff
            runtime_mesh._NODE_PROBE_FAIL_UNTIL = 0.0
            runtime_mesh._NODE_PROBE_ERR = ""
            got = runtime_mesh._which_bin("node")
        assert got == str(node)


def test_node_official_preferred_over_brew():
    """fog/bin/node-official wins over PATH/Cellar brew node."""
    import os
    import tempfile
    from unittest.mock import patch
    from fog_plugins import runtime_mesh

    with tempfile.TemporaryDirectory() as td:
        fog = Path(td) / "fog"
        (fog / "bin").mkdir(parents=True)
        official = fog / "bin" / "node-official"
        official.write_text("#!/bin/sh\necho v22.23.2\n", encoding="utf-8")
        os.chmod(official, 0o755)
        brew = Path(td) / "usr" / "local" / "bin"
        brew.mkdir(parents=True)
        bad = brew / "node"
        bad.write_text("#!/bin/sh\necho dyld: Library not loaded: /usr/local/opt/llhttp/lib/libllhttp.9.3.dylib >&2\nexit 1\n", encoding="utf-8")
        os.chmod(bad, 0o755)
        runtime_mesh._NODE_PROBE_FAIL_UNTIL = 0.0
        runtime_mesh._NODE_PROBE_ERR = ""
        with patch.object(runtime_mesh, "FOG", fog), \
             patch.object(runtime_mesh, "DATA", fog / "data"), \
             patch.dict(runtime_mesh.os.environ, {"FOG_HOME": str(fog)}, clear=False), \
             patch.object(runtime_mesh.shutil, "which", return_value=str(bad)), \
             patch.object(runtime_mesh, "WHICH_FALLBACK_DIRS", (str(brew),)):
            got = runtime_mesh._which_bin("node")
        assert got == str(official), got
        assert "node-official" in got


def test_dyld_brew_node_not_returned_no_tight_loop():
    """Broken brew node must not be returned; probe failure arms 60s backoff."""
    import os
    import tempfile
    from unittest.mock import patch
    from fog_plugins import runtime_mesh

    assert runtime_mesh.NODE_DYLD_BACKOFF_SEC == 60.0
    with tempfile.TemporaryDirectory() as td:
        fog = Path(td) / "fog"
        (fog / "bin").mkdir(parents=True)
        brew = Path(td) / "usr" / "local" / "bin"
        brew.mkdir(parents=True)
        bad = brew / "node"
        bad.write_text(
            "#!/bin/sh\necho 'dyld: Library not loaded: /usr/local/opt/llhttp/lib/libllhttp.9.3.dylib' >&2\necho Abort trap: 6 >&2\nexit 134\n",
            encoding="utf-8",
        )
        os.chmod(bad, 0o755)
        runtime_mesh._NODE_PROBE_FAIL_UNTIL = 0.0
        runtime_mesh._NODE_PROBE_ERR = ""
        clock = {"t": 5000.0}
        with patch.object(runtime_mesh, "FOG", fog), \
             patch.object(runtime_mesh, "DATA", fog / "data"), \
             patch.dict(runtime_mesh.os.environ, {"FOG_HOME": str(fog)}, clear=False), \
             patch.object(runtime_mesh.shutil, "which", return_value=str(bad)), \
             patch.object(runtime_mesh, "WHICH_FALLBACK_DIRS", (str(brew),)), \
             patch.object(runtime_mesh.time, "time", lambda: clock["t"]):
            assert runtime_mesh._which_bin("node") is None
            assert "dyld" in (runtime_mesh._NODE_PROBE_ERR or "").lower() or "brew node" in (runtime_mesh._NODE_PROBE_ERR or "").lower()
            assert runtime_mesh._NODE_PROBE_FAIL_UNTIL >= clock["t"] + 60.0
            # Second resolve during backoff must not re-exec / tight-loop
            probes = []
            real_probe = runtime_mesh._node_probe

            def counting_probe(bin_path):
                probes.append(bin_path)
                return real_probe(bin_path)

            with patch.object(runtime_mesh, "_node_probe", counting_probe):
                assert runtime_mesh._which_bin("node") is None
            assert probes == [], "must not re-probe brew node during 60s backoff"


def test_brew_always_invoked_on_g_and_auto_g():
    """Needle: interactive g and auto-g still always brew (do not regress brew-always-run)."""
    tui = Path(__file__).resolve().parent.parent / "deploy/mac-fog/fog-tui.py"
    au = Path(__file__).resolve().parent.parent / "deploy/mac-fog/fog-auto-update.sh"
    text = tui.read_text(encoding="utf-8")
    pull = text[text.index("def git_pull_reboot"):text.index("\ndef mark")]
    assert "brew_update_upgrade()" in pull
    assert "brew skip" not in text
    brew_fn = text[text.index("def brew_update_upgrade"):text.index("def runtime_mesh_last_error")]
    assert "node-official" in brew_fn
    assert "_official_node_bin" in text
    assert "bottle-miss" in brew_fn or "bottle miss" in brew_fn
    assert "reinstall" in brew_fn and "llhttp" in brew_fn
    sh = au.read_text(encoding="utf-8")
    assert "run_brew_verb update" in sh and "run_brew_verb upgrade" in sh
    assert "brew skip" not in sh
    assert "node-official" in sh
    assert "BREW_BOTTLE_MISS" in sh
    assert "brew reinstall llhttp ada-url node" in sh

def test_fog_launchagent_plist_has_homebrew_path():
    """Fog KeepAlive plist heredoc (not only auto-update) must PATH Homebrew for node :8791."""
    inst = Path(__file__).resolve().parent.parent / "deploy/mac-fog/FogNodeInstaller.command"
    text = inst.read_text(encoding="utf-8")
    start = text.index('cat > "$LAUNCH/${AGENT}.plist"')
    fog_plist = text[start:text.index("\nEOF", start)]
    assert "<key>PATH</key>" in fog_plist
    assert "/opt/homebrew/bin" in fog_plist
    assert "/usr/local/bin:/usr/bin:/bin" in fog_plist
    au_start = text.index('cat > "$LAUNCH/${AU}.plist"')
    assert start < au_start
    assert fog_plist.count("<key>PATH</key>") == 1
    au_plist = text[au_start:text.index("\nEOF", au_start)]
    assert "/opt/homebrew/bin" in au_plist
    assert "fog-auto-update" not in fog_plist
    tunnel = text[text.index("run-tunnel.sh"):text.index("Auto-update")]
    assert "<key>PATH</key>" not in tunnel


def test_recycle_mw_spare_healthy_skips_node():
    """Healthy :8791 fog_mw.js must not appear in the kill list when spare_healthy."""
    import signal
    from unittest.mock import patch
    from fog_plugins import runtime_mesh

    kills = []

    def fake_kill(pid, sig):
        kills.append((pid, sig))

    with patch.object(runtime_mesh, "_healthy", side_effect=lambda p: int(p) == 8791), \
         patch.object(runtime_mesh, "_pids_listening", return_value=[5151]), \
         patch.object(runtime_mesh, "_comm", return_value="node"), \
         patch.object(
             runtime_mesh,
             "_cmd",
             return_value="/Users/x/StrataMesh/fog/bin/node-official /repo/ops/middleware/fog_mw.js",
         ), \
         patch.object(runtime_mesh.os, "kill", fake_kill):
        n = runtime_mesh.recycle_mw((8791,), spare_healthy=True)
    assert n == 0
    assert kills == []
    with patch.object(runtime_mesh, "_healthy", side_effect=lambda p: int(p) == 8791), \
         patch.object(runtime_mesh, "_pids_listening", return_value=[5151]), \
         patch.object(runtime_mesh, "_comm", return_value="node"), \
         patch.object(
             runtime_mesh,
             "_cmd",
             return_value="/Users/x/StrataMesh/fog/bin/node-official /repo/ops/middleware/fog_mw.js",
         ), \
         patch.object(runtime_mesh.os, "kill", fake_kill), \
         patch.object(runtime_mesh.time, "sleep", lambda *_a, **_k: None), \
         patch.object(runtime_mesh.time, "time", side_effect=[1000.0, 1010.0, 1010.0, 1010.0]):
        assert runtime_mesh._spare_healthy_listener(8791) is True
        n2 = runtime_mesh.recycle_mw((8791,), force=True)
    assert n2 >= 1
    assert (5151, signal.SIGTERM) in kills


def test_spawn_stale_recycles_only_stale_port():
    """Stale node must recycle (8791,) only — not all MW_PORTS / healthy siblings."""
    import tempfile
    from unittest.mock import MagicMock, patch
    from fog_plugins import runtime_mesh

    plugin = runtime_mesh.RuntimeMeshPlugin()
    recycled = []

    def fake_recycle(ports=None, spare_healthy=True, force=False):
        recycled.append({"ports": tuple(ports) if ports is not None else None, "force": force})
        return 0

    def healthy(port):
        # python+deno healthy; node healthy-but-stale (still /health 200)
        return int(port) in (8790, 8791, 8792)

    def stale(port, script):
        return int(port) == 8791

    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        data = root / "data"
        py = root / "ops" / "middleware" / "fog_mw.py"
        js = root / "ops" / "middleware" / "fog_mw.js"
        ts = root / "ops" / "deno" / "main.ts"
        py.parent.mkdir(parents=True)
        ts.parent.mkdir(parents=True)
        py.write_text("# stub\n", encoding="utf-8")
        js.write_text("// stub\n", encoding="utf-8")
        ts.write_text("// stub\n", encoding="utf-8")
        with patch.object(runtime_mesh, "ROOT", root), \
             patch.object(runtime_mesh, "DATA", data), \
             patch.object(runtime_mesh.host_cap, "over", return_value=False), \
             patch.object(runtime_mesh, "_healthy", healthy), \
             patch.object(runtime_mesh, "_mw_stale", stale), \
             patch.object(runtime_mesh, "recycle_mw", fake_recycle), \
             patch.object(runtime_mesh, "_which_bin", return_value=None), \
             patch.object(runtime_mesh.time, "sleep", lambda *_a, **_k: None):
            plugin._spawn()
    assert recycled, "stale node must trigger recycle"
    assert recycled[0]["ports"] == (8791,)
    assert recycled[0]["force"] is True
    assert recycled[0]["ports"] != runtime_mesh.MW_PORTS


def test_attach_recycles_only_unhealthy_or_stale():
    """attach must not blanket MW_PORTS when hops are healthy current scripts."""
    from unittest.mock import patch
    from fog_plugins.runtime_mesh import RuntimeMeshPlugin
    from fog_plugins import runtime_mesh

    plugin = RuntimeMeshPlugin()
    recycled = []

    def rec(ports=None, spare_healthy=True, force=False):
        recycled.append(tuple(ports) if ports is not None else None)
        return 0

    def sp(*_a, **_k):
        pass

    def loop(self):
        self._stop.wait(0.05)

    with patch.object(runtime_mesh, "_mw_ports_needing_recycle", return_value=()), \
         patch("fog_plugins.runtime_mesh.recycle_mw", rec), \
         patch.object(RuntimeMeshPlugin, "_spawn", sp), \
         patch.object(RuntimeMeshPlugin, "_loop", loop):
        plugin.attach()
        plugin.stop()
        if plugin._thread:
            plugin._thread.join(timeout=2)
    assert recycled == [()]
    recycled.clear()
    with patch.object(runtime_mesh, "_mw_ports_needing_recycle", return_value=(8791,)), \
         patch("fog_plugins.runtime_mesh.recycle_mw", rec), \
         patch.object(RuntimeMeshPlugin, "_spawn", sp), \
         patch.object(RuntimeMeshPlugin, "_loop", loop):
        plugin2 = RuntimeMeshPlugin()
        plugin2.attach()
        plugin2.stop()
        if plugin2._thread:
            plugin2._thread.join(timeout=2)
    assert recycled == [(8791,)]


def test_recycle_leftover_gets_sigkill():
    import signal
    from unittest.mock import patch
    from fog_plugins import runtime_mesh

    kills = []

    def fake_kill(pid, sig):
        kills.append((pid, sig))

    t = {"n": 0}

    def fake_time():
        t["n"] += 1
        # jump past 8s after SIGTERM so leftovers get SIGKILL
        return 1000.0 if t["n"] < 3 else 1010.0

    with patch.object(runtime_mesh, "_pids_listening", return_value=[4242]), \
         patch.object(runtime_mesh, "_comm", return_value="node"), \
         patch.object(runtime_mesh.os, "kill", fake_kill), \
         patch.object(runtime_mesh.time, "sleep", lambda *_a, **_k: None), \
         patch.object(runtime_mesh.time, "time", fake_time):
        runtime_mesh.recycle_mw((8791,))
    sigs = [s for _pid, s in kills]
    assert signal.SIGTERM in sigs
    assert signal.SIGKILL in sigs
    with patch.object(runtime_mesh, "_pids_listening", return_value=[7]), \
         patch.object(runtime_mesh, "_comm", return_value="cloudflared"), \
         patch.object(runtime_mesh.os, "kill", fake_kill):
        n = runtime_mesh.recycle_mw((8791,))
    assert n == 0
    assert all(pid != 7 for pid, _s in kills)


def test_mw_stale_healthy_cap_over_sha_mismatch_false():
    """HOLD: healthy hop + sha mismatch alone is not stale. cwd/script mismatch still is."""
    from unittest.mock import patch
    from fog_plugins import runtime_mesh

    script = Path("/ops/middleware/fog_mw.py")
    with patch.object(runtime_mesh, "_healthy", return_value=True), \
         patch.object(runtime_mesh, "_repo_sha", return_value="aaa111"), \
         patch.object(runtime_mesh, "_stamped_sha", return_value="bbb222"), \
         patch.object(runtime_mesh, "_pids_listening", return_value=[99]), \
         patch.object(runtime_mesh, "_cmd", return_value=str(script)), \
         patch.object(runtime_mesh, "_cwd", return_value=""), \
         patch.object(runtime_mesh.host_cap, "over", return_value=True):
        assert runtime_mesh._mw_stale(8790, script) is False
    with patch.object(runtime_mesh, "_healthy", return_value=True), \
         patch.object(runtime_mesh, "_repo_sha", return_value="aaa111"), \
         patch.object(runtime_mesh, "_stamped_sha", return_value="bbb222"), \
         patch.object(runtime_mesh, "_pids_listening", return_value=[99]), \
         patch.object(runtime_mesh, "_cmd", return_value="/other/fog_mw.py"), \
         patch.object(runtime_mesh, "_cwd", return_value=""), \
         patch.object(runtime_mesh.host_cap, "over", return_value=True):
        assert runtime_mesh._mw_stale(8790, script) is True


def test_recycle_leftover_python_sigterm_only_node_sigkill():
    import signal
    from unittest.mock import patch
    from fog_plugins import runtime_mesh

    def run(comm, pid):
        kills = []

        def fake_kill(p, sig):
            kills.append((p, sig))

        t = {"n": 0}

        def fake_time():
            t["n"] += 1
            return 1000.0 if t["n"] < 3 else 1010.0

        with patch.object(runtime_mesh, "_pids_listening", return_value=[pid]), \
             patch.object(runtime_mesh, "_comm", return_value=comm), \
             patch.object(runtime_mesh.os, "kill", fake_kill), \
             patch.object(runtime_mesh.time, "sleep", lambda *_a, **_k: None), \
             patch.object(runtime_mesh.time, "time", fake_time):
            runtime_mesh.recycle_mw((8790,))
        return kills

    py_kills = run("python3", 111)
    assert (111, signal.SIGTERM) in py_kills
    assert (111, signal.SIGKILL) not in py_kills
    app_kills = run("Python", 112)
    assert (112, signal.SIGTERM) in app_kills
    assert (112, signal.SIGKILL) not in app_kills
    node_kills = run("node", 222)
    assert (222, signal.SIGTERM) in node_kills
    assert (222, signal.SIGKILL) in node_kills



def test_tui_node_dark_last_error_needle():
    """Dark node lamp shows runtime-mesh last_error / mw-node hint. No secrets."""
    tui = Path(__file__).resolve().parent.parent / "deploy/mac-fog/fog-tui.py"
    text = tui.read_text(encoding="utf-8")
    assert "def runtime_mesh_last_error" in text
    assert "last_error" in text
    assert "mw-node" in text
    assert "runtime_mesh" in text
    assert "ghp_" in text  # scrub needle
    import ast
    tree = ast.parse(text)
    keep = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "runtime_mesh_last_error"]
    mod = ast.Module(body=keep, type_ignores=[])
    ast.fix_missing_locations(mod)
    ns = {}
    exec(compile(mod, "fog-tui.py", "exec"), ns, ns)
    fn = ns["runtime_mesh_last_error"]
    hint = fn({"runtime_mesh": {"plugin": "runtime-mesh", "last_error": "mw-node exit 1 dyld libllhttp.9.3.dylib"}})
    assert "dyld" in hint and "libllhttp" in hint
    red = fn({"runtime_mesh": {"last_error": "mw-node ghp_SECRETTOKEN123 llhttp"}})
    assert "ghp_" not in red
    assert red == "mw-node error"
    assert fn({"runtime_mesh": {}}) == ""
    assert "workers.dev" not in text[text.index("def runtime_mesh_last_error"):text.index("def runtime_mesh_last_error")+800]


def test_node_dyld_last_error_backs_off_60s():
    """Immediate dyld death must not tight-loop Popen every 12s."""
    import tempfile
    from unittest.mock import MagicMock, patch
    from fog_plugins import runtime_mesh

    assert runtime_mesh.NODE_DYLD_BACKOFF_SEC == 60.0
    src = Path(runtime_mesh.__file__).read_text(encoding="utf-8")
    assert "NODE_DYLD_BACKOFF_SEC" in src
    assert "_node_backoff_until" in src
    assert "dyld" in src and "libllhttp" in src
    loop = __import__("inspect").getsource(runtime_mesh.RuntimeMeshPlugin._loop)
    assert "continue" not in loop

    plugin = runtime_mesh.RuntimeMeshPlugin()
    popens = []
    clock = {"t": 1000.0}

    def fake_popen(cmd, *args, **kwargs):
        popens.append(list(cmd))
        m = MagicMock()
        m.pid = 8791
        m.poll.return_value = 1
        return m

    def fake_which(name):
        if name == "node":
            return "/usr/local/bin/node"
        return None

    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        data = root / "data"
        data.mkdir()
        js = root / "ops" / "middleware" / "fog_mw.js"
        js.parent.mkdir(parents=True)
        js.write_text("// stub\n", encoding="utf-8")
        (data / "mw-node.log").write_bytes(b"dyld: Library not loaded: /usr/local/opt/llhttp/lib/libllhttp.9.3.dylib\n")
        with patch.object(runtime_mesh, "ROOT", root), \
             patch.object(runtime_mesh, "DATA", data), \
             patch.object(runtime_mesh.host_cap, "over", return_value=False), \
             patch.object(runtime_mesh, "_healthy", return_value=False), \
             patch.object(runtime_mesh, "_write_sha"), \
             patch.object(runtime_mesh.subprocess, "Popen", fake_popen), \
             patch.object(runtime_mesh, "_which_bin", fake_which), \
             patch.object(runtime_mesh.time, "time", lambda: clock["t"]):
            plugin._spawn()
            assert popens, "first spawn must try node"
            assert plugin.last_error and "dyld" in plugin.last_error.lower()
            assert plugin._node_backoff_until >= clock["t"] + 60.0
            n1 = len(popens)
            plugin._spawn()
            assert len(popens) == n1, "must not respawn node during 60s dyld backoff"
            clock["t"] += 61.0
            plugin._spawn()
            assert len(popens) == n1 + 1, "must try again after 60s backoff"


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
