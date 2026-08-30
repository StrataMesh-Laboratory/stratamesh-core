"""Fog plugin: keep a local workerd on :8788. Reboot if it dies.

Owned by PersistentFogNode (:8787). Not a 6th CF cron. Token never on argv.
"""
from __future__ import annotations

import os
import shutil
import signal
import subprocess
import threading
import time
from pathlib import Path
from urllib.request import urlopen

PORT = int(os.environ.get("WORKERD_PORT") or "8788")
HEALTH = f"http://127.0.0.1:{PORT}/health"
DATA = Path(os.environ.get("FOG_DATA") or "/workspace/data/fog")
ROOT = Path(os.environ.get("FOG_SRC") or "/tmp/sm-core")
CONFIG = ROOT / "ops" / "workerd" / "config.capnp"
PIDFILE = DATA / "workerd.pid"
LOG = DATA / "workerd.log"
POLL_SEC = 8


def _which_workerd() -> str | None:
    env = (os.environ.get("WORKERD_BIN") or "").strip()
    if env and Path(env).is_file():
        return env
    for p in (
        DATA / "workerd-runtime" / "node_modules" / ".bin" / "workerd",
        DATA / "workerd",
    ):
        if p.is_file():
            return str(p)
    w = shutil.which("workerd")
    return w


class WorkerdPlugin:
    def __init__(self):
        self.lock = threading.Lock()
        self.reboots = 0
        self.last_error = None
        self.last_ok = None
        self.started_at = None
        self._stop = threading.Event()
        self._thread = None

    def snapshot(self) -> dict:
        binp = _which_workerd()
        return {
            "ok": self.healthy(),
            "plugin": "fog-workerd",
            "port": PORT,
            "bind": "127.0.0.1",
            "health": HEALTH,
            "binary": binp,
            "config": str(CONFIG),
            "reboots": self.reboots,
            "last_error": self.last_error,
            "last_ok": self.last_ok,
            "started_at": self.started_at,
            "mesh_member": False,
            "note": "workerd is OSS runtime; CF KV/D1/R2 are not on this process",
        }

    def healthy(self) -> bool:
        try:
            with urlopen(HEALTH, timeout=2) as r:
                ok = r.status == 200
            if ok:
                self.last_ok = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            return ok
        except Exception:
            return False

    def start(self) -> dict:
        DATA.mkdir(parents=True, exist_ok=True)
        if self.healthy():
            return {"ok": True, "already": True, **self.snapshot()}
        binp = _which_workerd()
        if not binp:
            self.last_error = "workerd_binary_missing"
            return {"ok": False, "error": self.last_error, "hint": "npm i --prefix data/fog/workerd-runtime workerd"}
        if not CONFIG.is_file():
            self.last_error = "config_missing"
            return {"ok": False, "error": self.last_error}
        logf = LOG.open("a")
        proc = subprocess.Popen(
            [binp, "serve", str(CONFIG)],
            cwd=str(CONFIG.parent),
            stdout=logf,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        PIDFILE.write_text(str(proc.pid) + "\n")
        deadline = time.time() + 8
        while time.time() < deadline:
            if self.healthy():
                self.started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                self.last_error = None
                return {"ok": True, "pid": proc.pid, **self.snapshot()}
            if proc.poll() is not None:
                self.last_error = f"exited_{proc.returncode}"
                return {"ok": False, "error": self.last_error, "pid": proc.pid}
            time.sleep(0.2)
        self.last_error = "health_timeout"
        return {"ok": False, "error": self.last_error, "pid": proc.pid}

    def stop(self) -> None:
        pids = []
        if PIDFILE.is_file():
            try:
                pids.append(int(PIDFILE.read_text().strip()))
            except Exception:
                pass
        proc = Path("/proc")
        me = os.getpid()
        for p in proc.iterdir():
            if not p.name.isdigit():
                continue
            pid = int(p.name)
            if pid == me:
                continue
            try:
                comm = (p / "comm").read_text().strip()
            except Exception:
                continue
            if comm == "workerd":
                pids.append(pid)
        for pid in set(pids):
            try:
                os.kill(pid, signal.SIGTERM)
            except Exception:
                pass
        time.sleep(0.3)

    def reboot(self) -> dict:
        with self.lock:
            self.stop()
            out = self.start()
            if out.get("ok"):
                self.reboots += 1
            return {"rebooted": True, **out}

    def _loop(self) -> None:
        self.start()
        while not self._stop.wait(POLL_SEC):
            if not self.healthy():
                self.reboot()

    def attach(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._loop, name="fog-workerd", daemon=True)
        self._thread.start()

    def shutdown(self) -> None:
        self._stop.set()


def is_loopback_not_tunnel(handler) -> bool:
    """Reboot is local-only. Tunnelled requests carry CF-Ray / CF-Connecting-IP."""
    h = handler.headers
    if h.get("CF-Ray") or h.get("Cf-Ray") or h.get("CF-Connecting-IP") or h.get("Cf-Connecting-Ip"):
        return False
    ip = handler.client_address[0]
    return ip in ("127.0.0.1", "::1", "localhost")
