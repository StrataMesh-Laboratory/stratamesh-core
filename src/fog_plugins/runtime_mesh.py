"""Supervise loopback Python + Node middleware beside workerd.

Honor host_cap. Never bind public. Never touch cloudflared.
"""
from __future__ import annotations

import os
import signal
import shutil
import subprocess
import threading
import time
from pathlib import Path
from urllib.request import urlopen

from fog_plugins import host_cap

DATA = Path(os.environ.get("FOG_DATA") or Path.home() / "StrataMesh/fog/data")
ROOT = Path(os.environ.get("FOG_SRC") or Path.home() / "StrataMesh/fog/repo")
PY_PORT = int(os.environ.get("FOG_MW_PY_PORT") or "8790")
NODE_PORT = int(os.environ.get("FOG_MW_NODE_PORT") or "8791")
# 8792 is the leftover deno hop the TUI still lamps; we do not spawn it.
MW_PORTS = (8790, 8791, 8792)
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


def recycle_mw(ports=None) -> int:
    """SIGTERM listeners on loopback mw ports so the next spawn uses current files.

    Never pkill cloudflared. Never PUT Workers.
    """
    killed = 0
    for port in tuple(ports or MW_PORTS):
        for pid in _pids_listening(int(port)):
            if "cloudflared" in _comm(pid).lower():
                continue
            try:
                os.kill(pid, signal.SIGTERM)
                killed += 1
            except OSError:
                pass
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


class RuntimeMeshPlugin:
    def __init__(self):
        self.reboots = 0
        self._stop = threading.Event()
        self._thread = None
        self.py_pid = None
        self.node_pid = None
        self.last_error = None

    def snapshot(self) -> dict:
        node_bin = shutil.which("node")
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
            "workerd_alongside": True,
            "reboots": self.reboots,
            "last_error": self.last_error,
        }

    def _spawn(self):
        if host_cap.over():
            self.last_error = "host_cap"
            return
        DATA.mkdir(parents=True, exist_ok=True)
        py = ROOT / "ops" / "middleware" / "fog_mw.py"
        js = ROOT / "ops" / "middleware" / "fog_mw.js"
        stale = (py.is_file() and _mw_stale(PY_PORT, py)) or (
            js.is_file() and _mw_stale(NODE_PORT, js)
        )
        if stale:
            recycle_mw()
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
            _write_sha()
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
            _write_sha()

    def attach(self):
        if self._thread and self._thread.is_alive():
            return
        recycle_mw()
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="runtime-mesh", daemon=True)
        self._thread.start()

    def _loop(self):
        while not self._stop.is_set():
            try:
                if host_cap.over():
                    time.sleep(20)
                    continue
                py = ROOT / "ops" / "middleware" / "fog_mw.py"
                js = ROOT / "ops" / "middleware" / "fog_mw.js"
                need = (
                    not _healthy(PY_PORT)
                    or (shutil.which("node") and not _healthy(NODE_PORT))
                    or (py.is_file() and _mw_stale(PY_PORT, py))
                    or (js.is_file() and _mw_stale(NODE_PORT, js))
                )
                if need:
                    self._spawn()
                    self.reboots += 1
            except Exception as e:
                self.last_error = str(e)[:120]
            time.sleep(12)

    def stop(self):
        self._stop.set()
