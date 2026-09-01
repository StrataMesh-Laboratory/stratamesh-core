"""Supervise loopback Python + Node middleware beside workerd.

Honor host_cap. Never bind public. Never touch cloudflared.
"""
from __future__ import annotations

import os
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


def _healthy(port: int) -> bool:
    try:
        with urlopen(f"http://127.0.0.1:{port}/health", timeout=1.2) as r:
            return r.status == 200
    except Exception:
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
        if py.is_file() and not _healthy(PY_PORT):
            log = open(DATA / "mw-py.log", "ab")
            p = subprocess.Popen(
                ["python3", str(py)],
                stdout=log,
                stderr=log,
                start_new_session=True,
            )
            self.py_pid = p.pid
        node = shutil.which("node")
        if node and js.is_file() and not _healthy(NODE_PORT):
            log = open(DATA / "mw-node.log", "ab")
            p = subprocess.Popen(
                [node, str(js)],
                stdout=log,
                stderr=log,
                start_new_session=True,
            )
            self.node_pid = p.pid

    def attach(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="runtime-mesh", daemon=True)
        self._thread.start()

    def _loop(self):
        while not self._stop.is_set():
            try:
                if host_cap.over():
                    time.sleep(20)
                    continue
                need = not _healthy(PY_PORT) or (shutil.which("node") and not _healthy(NODE_PORT))
                if need:
                    self._spawn()
                    self.reboots += 1
            except Exception as e:
                self.last_error = str(e)[:120]
            time.sleep(12)

    def stop(self):
        self._stop.set()
