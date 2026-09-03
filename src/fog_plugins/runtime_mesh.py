"""Supervise loopback Python + Node + Deno middleware beside workerd.

Honor host_cap for keep-up/PoC pacing, not mw listen. Never bind public. Never touch cloudflared.
"""
from __future__ import annotations

import json
import os
import signal
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path
from urllib.request import urlopen

from fog_plugins import host_cap

DATA = Path(os.environ.get("FOG_DATA") or Path.home() / "StrataMesh/fog/data")
ROOT = Path(os.environ.get("FOG_SRC") or Path.home() / "StrataMesh/fog/repo")
PY_PORT = int(os.environ.get("FOG_MW_PY_PORT") or "8790")
NODE_PORT = int(os.environ.get("FOG_MW_NODE_PORT") or "8791")
DENO_PORT = int(os.environ.get("FOG_MW_DENO_PORT") or "8792")
MW_PORTS = (PY_PORT, NODE_PORT, DENO_PORT)
RECYCLE_PORTS = (8787, 8788, PY_PORT, NODE_PORT, DENO_PORT)
_SHA_STAMP = "mw-git-sha"


def _healthy(port: int) -> bool:
    try:
        with urlopen(f"http://127.0.0.1:{port}/health", timeout=1.2) as r:
            return r.status == 200
    except Exception:
        return False


def _pids_listening(port: int) -> list:
    try:
        out = subprocess.check_output(
            ["lsof", "-nP", "-iTCP:%d" % int(port), "-sTCP:LISTEN", "-t"],
            stderr=subprocess.DEVNULL,
            timeout=2,
        )
    except (subprocess.CalledProcessError, FileNotFoundError, OSError, subprocess.TimeoutExpired):
        return []
    pids = []
    for tok in out.decode("utf-8", "replace").split():
        try:
            pids.append(int(tok))
        except ValueError:
            continue
    return pids


def _comm(pid: int) -> str:
    try:
        return subprocess.check_output(
            ["ps", "-p", str(pid), "-o", "comm="],
            stderr=subprocess.DEVNULL,
            timeout=2,
        ).decode("utf-8", "replace").strip()
    except Exception:
        return ""


def _cmd(pid: int) -> str:
    try:
        return subprocess.check_output(
            ["ps", "-p", str(pid), "-o", "command="],
            stderr=subprocess.DEVNULL,
            timeout=2,
        ).decode("utf-8", "replace")
    except Exception:
        return ""


def _cwd(pid: int) -> str:
    try:
        out = subprocess.check_output(
            ["lsof", "-a", "-p", str(pid), "-d", "cwd", "-Fn"],
            stderr=subprocess.DEVNULL,
            timeout=2,
        ).decode("utf-8", "replace")
    except Exception:
        return ""
    for line in out.splitlines():
        if line.startswith("n"):
            return line[1:].strip()
    return ""


def _repo_sha() -> str:
    try:
        return subprocess.check_output(
            ["git", "-C", str(ROOT), "rev-parse", "HEAD"],
            stderr=subprocess.DEVNULL,
            timeout=3,
        ).decode("utf-8", "replace").strip()
    except Exception:
        return ""


def _stamped_sha() -> str:
    p = DATA / _SHA_STAMP
    try:
        return p.read_text(encoding="utf-8").strip() if p.is_file() else ""
    except OSError:
        return ""


def _write_sha() -> None:
    sha = _repo_sha()
    if not sha:
        return
    try:
        DATA.mkdir(parents=True, exist_ok=True)
        (DATA / _SHA_STAMP).write_text(sha + "\n", encoding="utf-8")
    except OSError:
        pass


DEAD_MW_SKIP_SEC = 8.0


def recycle_mw(ports=None) -> int:
    """SIGTERM listeners on loopback hop ports so the next spawn uses current files.

    Default: fog :8787, workerd :8788, python :8790, node :8791, deno :8792.
    Supervise paths pass MW_PORTS so Fog/workerd are not SIGTERM'd by attach.
    Never pkill cloudflared. Never PUT Workers.
    Already-dead hops are skipped. After SIGTERM wait up to 8s then skip leftovers.
    """
    ports = tuple(RECYCLE_PORTS if ports is None else ports)

    def live_pids(port: int):
        out = []
        for pid in _pids_listening(int(port)):
            if "cloudflared" in _comm(pid).lower():
                continue
            out.append(pid)
        return out

    killed = 0
    for port in ports:
        for pid in live_pids(port):
            try:
                os.kill(pid, signal.SIGTERM)
                killed += 1
            except OSError:
                pass
    if killed:
        deadline = time.time() + DEAD_MW_SKIP_SEC
        while time.time() < deadline:
            leftover = False
            for port in ports:
                if live_pids(port):
                    leftover = True
                    break
            if not leftover:
                break
            time.sleep(0.25)
    return killed


def _mw_stale(port: int, script: Path) -> bool:
    """True if a healthy listener is from another cwd/script or an older FOG_SRC sha."""
    if not _healthy(port):
        return False
    sha_now = _repo_sha()
    stamped = _stamped_sha()
    if sha_now and sha_now != stamped:
        return True
    expected = str(script)
    pids = _pids_listening(port)
    if not pids:
        return False
    for pid in pids:
        cmd = _cmd(pid)
        if expected not in cmd:
            return True
        cwd = _cwd(pid)
        if cwd:
            try:
                got = Path(cwd).resolve()
                if got not in (ROOT.resolve(), script.parent.resolve()):
                    return True
            except OSError:
                return True
    return False




def _hop_policy_routes():
    try:
        p = ROOT / "ops" / "config" / "hop-policy.json"
        data = json.loads(p.read_text(encoding="utf-8"))
        return data.get("routes") or {}
    except Exception:
        return {}


def _write_object_layers_last(payload, data_dir=None):
    target = Path(data_dir or DATA)
    try:
        target.mkdir(parents=True, exist_ok=True)
        (target / "object-layers-last.json").write_text(
            json.dumps(payload, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
    except OSError:
        pass


def _run_object_layers_probe(plugin, data_dir, root, healthy, port):
    """One-shot four-layer catalog probe. Never raises into Fog."""
    payload = {"ok": False, "ts": time.time(), "verdict": "fail"}
    try:
        deadline = time.time() + 8
        ready = False
        while time.time() < deadline:
            if plugin is not None and getattr(plugin, "_stop", None) and plugin._stop.is_set():
                payload["verdict"] = "stopped"
                _write_object_layers_last(payload, data_dir)
                return
            try:
                ready = bool(healthy(port))
            except Exception:
                ready = False
            if ready:
                break
            time.sleep(0.35)
        if not ready:
            payload["verdict"] = "unready"
            payload["error"] = "object-layers: :%d unready" % int(port)
            if plugin is not None:
                plugin.last_error = payload["error"]
            _write_object_layers_last(payload, data_dir)
            return
        script = Path(root) / "ops" / "object-layers-test.py"
        if script.is_file():
            env = os.environ.copy()
            env.setdefault("FOG_SRC", str(root))
            env.setdefault("FOG_DATA", str(data_dir))
            env.setdefault("FOG_MW_PY_PORT", str(int(port)))
            p = subprocess.run(
                [sys.executable, str(script)],
                cwd=str(root),
                env=env,
                capture_output=True,
                timeout=25,
                text=True,
            )
            payload["ok"] = p.returncode == 0
            payload["verdict"] = "pass" if p.returncode == 0 else "fail"
            if p.returncode != 0:
                err = ((p.stderr or p.stdout or "probe fail").strip() or "probe fail")[:120]
                payload["error"] = err
                if plugin is not None:
                    plugin.last_error = err
        else:
            from urllib.request import Request, urlopen as _urlopen
            url = "http://127.0.0.1:%d/health" % int(port)
            with _urlopen(url, timeout=1.5) as r:
                payload["ok"] = r.status == 200
            payload["verdict"] = "pass" if payload["ok"] else "fail"
        payload["ts"] = time.time()
    except Exception as e:
        payload["ok"] = False
        payload["verdict"] = "error"
        payload["error"] = str(e)[:120]
        payload["ts"] = time.time()
        if plugin is not None:
            plugin.last_error = payload["error"]
    _write_object_layers_last(payload, data_dir)


class RuntimeMeshPlugin:
    def __init__(self):
        self.reboots = 0
        self._stop = threading.Event()
        self._thread = None
        self.py_pid = None
        self.node_pid = None
        self.deno_pid = None
        self.last_error = None

    def snapshot(self) -> dict:
        node_bin = shutil.which("node")
        deno_bin = shutil.which("deno")
        return {
            "ok": _healthy(PY_PORT),
            "plugin": "runtime-mesh",
            "python": {"port": PY_PORT, "ok": _healthy(PY_PORT), "pid": self.py_pid},
            "node": {
                "port": NODE_PORT,
                "ok": _healthy(NODE_PORT) if node_bin else False,
                "pid": self.node_pid,
                "binary": node_bin,
            },
            "deno": {
                "port": DENO_PORT,
                "ok": _healthy(DENO_PORT) if deno_bin else False,
                "pid": self.deno_pid,
                "binary": deno_bin,
            },
            "workerd_alongside": True,
            "fog_role": "kernel",
            "mw": ["workerd:8788", "python:8790", "node:8791", "deno:8792"],
            "hop_policy": _hop_policy_routes(),
            "reboots": self.reboots,
            "last_error": self.last_error,
        }

    def _kick_object_layers_probe(self):
        """Daemon probe after :8790 is up. Fail-open; last_error only."""
        if getattr(self, "_layers_probe_lock", None) is None:
            self._layers_probe_lock = threading.Lock()
        if not self._layers_probe_lock.acquire(blocking=False):
            return
        data_dir = DATA
        root = ROOT
        healthy = _healthy
        port = PY_PORT

        def run():
            try:
                _run_object_layers_probe(self, data_dir, root, healthy, port)
            except Exception as e:
                self.last_error = str(e)[:120]
                _write_object_layers_last(
                    {"ok": False, "ts": time.time(), "verdict": "error", "error": str(e)[:120]},
                    data_dir,
                )
            finally:
                try:
                    self._layers_probe_lock.release()
                except Exception:
                    pass

        threading.Thread(target=run, name="object-layers-probe", daemon=True).start()

    def _spawn(self):
        # host_cap.over() is metabolic burn-rate (keep-up/PoC), not OS load-shed.
        # Record it, skip extra sha stamps, but still bind :8790/:8791/:8792 if unhealthy.
        cap_over = host_cap.over()
        if cap_over:
            self.last_error = "host_cap"
        DATA.mkdir(parents=True, exist_ok=True)
        py = ROOT / "ops" / "middleware" / "fog_mw.py"
        js = ROOT / "ops" / "middleware" / "fog_mw.js"
        ts = ROOT / "ops" / "deno" / "main.ts"
        stale = (
            (py.is_file() and _mw_stale(PY_PORT, py))
            or (js.is_file() and _mw_stale(NODE_PORT, js))
            or (ts.is_file() and _mw_stale(DENO_PORT, ts))
        )
        if stale:
            recycle_mw(MW_PORTS)
            time.sleep(0.25)
        if py.is_file() and not _healthy(PY_PORT):
            log = open(DATA / "mw-py.log", "ab")
            env = os.environ.copy()
            env.setdefault("FOG_SRC", str(ROOT))
            env.setdefault("FOG_DATA", str(DATA))
            p = subprocess.Popen(
                ["python3", str(py)],
                stdout=log,
                stderr=log,
                start_new_session=True,
                cwd=str(ROOT),
                env=env,
            )
            self.py_pid = p.pid
            if not cap_over:
                _write_sha()
            self._kick_object_layers_probe()
        node = shutil.which("node")
        if node and js.is_file() and not _healthy(NODE_PORT):
            log = open(DATA / "mw-node.log", "ab")
            env = os.environ.copy()
            env.setdefault("FOG_SRC", str(ROOT))
            env.setdefault("FOG_DATA", str(DATA))
            p = subprocess.Popen(
                [node, str(js)],
                stdout=log,
                stderr=log,
                start_new_session=True,
                cwd=str(ROOT),
                env=env,
            )
            self.node_pid = p.pid
            if not cap_over:
                _write_sha()
        deno = shutil.which("deno")
        if deno and ts.is_file() and not _healthy(DENO_PORT):
            log = open(DATA / "mw-deno.log", "ab")
            env = os.environ.copy()
            env.setdefault("FOG_SRC", str(ROOT))
            env.setdefault("FOG_DATA", str(DATA))
            p = subprocess.Popen(
                [deno, "run", "--allow-net", "--allow-env", "--allow-read", str(ts)],
                stdout=log,
                stderr=log,
                start_new_session=True,
                cwd=str(ROOT),
                env=env,
            )
            self.deno_pid = p.pid
            if not cap_over:
                _write_sha()

    def attach(self):
        if self._thread and self._thread.is_alive():
            return
        recycle_mw(MW_PORTS)
        self._spawn()
        if _healthy(PY_PORT):
            self._kick_object_layers_probe()
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="runtime-mesh", daemon=True)
        self._thread.start()

    def _loop(self):
        while not self._stop.is_set():
            try:
                if host_cap.over():
                    self.last_error = "host_cap"
                py = ROOT / "ops" / "middleware" / "fog_mw.py"
                js = ROOT / "ops" / "middleware" / "fog_mw.js"
                ts = ROOT / "ops" / "deno" / "main.ts"
                need = (
                    not _healthy(PY_PORT)
                    or (shutil.which("node") and not _healthy(NODE_PORT))
                    or (shutil.which("deno") and not _healthy(DENO_PORT))
                    or (py.is_file() and _mw_stale(PY_PORT, py))
                    or (js.is_file() and _mw_stale(NODE_PORT, js))
                    or (ts.is_file() and shutil.which("deno") and _mw_stale(DENO_PORT, ts))
                )
                if need:
                    self._spawn()
                    self.reboots += 1
            except Exception as e:
                self.last_error = str(e)[:120]
            time.sleep(12)

    def stop(self):
        self._stop.set()
