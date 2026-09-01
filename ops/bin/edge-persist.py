#!/usr/bin/env python3
"""EDGE-GROK local persist: :8789 process + workerd :8788 + named tunnel.

Same hop as Fog, different host. Do not touch Mac fog / macbook-server cloudflared.
Self-heal: if local :8788 /health is not origin=edge, reboot workerd + edge process.
Public DNS cutover is HOLD until origin=edge locally.
"""
from __future__ import annotations

import json
import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(os.environ.get("FOG_SRC") or "/tmp/sm-core")
DATA = Path(os.environ.get("EDGE_DATA") or "/workspace/data/edge")
SECRETS = Path(os.environ.get("EDGE_SECRETS") or "/workspace/data/secrets")
PORT = int(os.environ.get("EDGE_PORT") or "8789")
WPORT = int(os.environ.get("WORKERD_PORT") or "8788")
TOKEN_FILE = SECRETS / "edge_tunnel_token"
PIDFILE = DATA / "edge-persist.pid"
LOG = DATA / "edge-persist.log"
POLL = int(os.environ.get("EDGE_POLL_SEC") or "15")
MISS_REBOOT = int(os.environ.get("EDGE_MISS_REBOOT") or "3")
PUBLIC = os.environ.get("EDGE_PUBLIC_URL") or "https://edge.calhegasmorais.pt/health"
LOCAL = f"http://127.0.0.1:{WPORT}/health"
NODE = f"http://127.0.0.1:{PORT}/health"
CONFIG = Path(os.environ.get("WORKERD_CONFIG") or str(ROOT / "ops" / "workerd" / "config-edge.capnp"))


def log(msg: str) -> None:
    line = time.strftime("%Y-%m-%dT%H:%M:%SZ ", time.gmtime()) + msg + "\n"
    DATA.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as fh:
        fh.write(line)
    sys.stderr.write(line)


def pids_named(name: str) -> list[int]:
    out = []
    proc = Path("/proc")
    if proc.is_dir():
        me = os.getpid()
        for p in proc.iterdir():
            if not p.name.isdigit():
                continue
            try:
                if int(p.name) == me:
                    continue
                if (p / "comm").read_text().strip() == name:
                    out.append(int(p.name))
            except Exception:
                pass
        return out
    try:
        raw = subprocess.check_output(["pgrep", "-x", name], text=True)
        out.extend(int(x) for x in raw.split() if x.strip().isdigit())
    except Exception:
        pass
    return out


def get_json(url: str, timeout: float = 4.0) -> dict:
    try:
        req = Request(url, headers={"User-Agent": "edge-persist/1"})
        with urlopen(req, timeout=timeout) as r:
            return {"ok": r.status == 200, "status": r.status, **json.loads(r.read().decode())}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def start_edge() -> None:
    h = get_json(NODE, 2)
    if h.get("ok") and h.get("node_id") == "EDGE-GROK-CMN-001":
        return
    env = os.environ.copy()
    env["FOG_ORIGIN"] = "edge"
    env["EDGE_PORT"] = str(PORT)
    env["PYTHONUNBUFFERED"] = "1"
    log("start edge-grok-local :%s" % PORT)
    subprocess.Popen(
        [sys.executable, str(ROOT / "ops" / "bin" / "edge-grok-local.py")],
        cwd=str(ROOT),
        env=env,
        stdout=LOG.open("a"),
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )


def workerd_bin() -> str | None:
    env = (os.environ.get("WORKERD_BIN") or "").strip()
    if env and Path(env).is_file():
        return env
    w = shutil.which("workerd")
    return w


def start_workerd() -> None:
    h = get_json(LOCAL, 2)
    if h.get("ok") and h.get("origin") == "edge":
        return
    binp = workerd_bin()
    if not binp:
        log("HOLD workerd: binary missing")
        return
    log("start workerd %s %s" % (binp, CONFIG))
    subprocess.Popen(
        [binp, "serve", str(CONFIG)],
        cwd=str(CONFIG.parent),
        stdout=LOG.open("a"),
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )


def stop_named(name: str) -> None:
    for pid in pids_named(name):
        try:
            os.kill(pid, signal.SIGTERM)
        except Exception:
            pass


def start_tunnel() -> None:
    if pids_named("cloudflared"):
        return
    tok = TOKEN_FILE.read_text().strip() if TOKEN_FILE.is_file() else ""
    if not tok or not tok.startswith("eyJ"):
        log("HOLD tunnel: no edge_tunnel_token")
        return
    cf = shutil.which("cloudflared") or str(DATA / "cloudflared")
    if not Path(cf).is_file() and not shutil.which("cloudflared"):
        log("HOLD tunnel: cloudflared missing")
        return
    env = os.environ.copy()
    env["TUNNEL_TOKEN"] = tok
    log("start edge tunnel (token via env)")
    subprocess.Popen(
        [cf, "tunnel", "--no-autoupdate", "run"],
        env=env,
        stdout=LOG.open("a"),
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )


def reboot() -> None:
    log("reboot edge+workerd")
    stop_named("workerd")
    time.sleep(0.4)
    start_edge()
    time.sleep(0.6)
    start_workerd()


def daemonize() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    if os.fork() > 0:
        os._exit(0)
    os.setsid()
    if os.fork() > 0:
        os._exit(0)
    os.umask(0o027)
    os.chdir("/")
    signal.signal(signal.SIGHUP, signal.SIG_IGN)
    PIDFILE.write_text(str(os.getpid()) + "\n")


def loop() -> None:
    miss = 0
    while True:
        start_edge()
        start_workerd()
        try:
            from fog_plugins.mac_fallback import tick as mac_tick
            st = mac_tick()
            if st.get("standby"):
                log("mac standby dark_for=%ss plan=%s" % (st.get("dark_for"), (st.get("plan") or {}).get("metabol")))
                # keep hop + mw; do not flip Fog DNS from EDGE
                try:
                    from fog_plugins.runtime_mesh import RuntimeMeshPlugin
                    RuntimeMeshPlugin().attach()
                except Exception as e:
                    log("mw attach " + str(e))
        except Exception as e:
            log("mac_fallback " + str(e))
        if os.environ.get("EDGE_TUNNEL") == "1":
            start_tunnel()
        hop = get_json(LOCAL, 3)
        if hop.get("ok") and hop.get("origin") == "edge":
            miss = 0
        else:
            miss += 1
            log("miss %s hop=%s" % (miss, hop))
            if miss >= MISS_REBOOT:
                reboot()
                miss = 0
        time.sleep(POLL)


def main() -> int:
    if "--foreground" not in sys.argv:
        daemonize()
    DATA.mkdir(parents=True, exist_ok=True)
    log("edge-persist start poll=%ss" % POLL)
    start_edge()
    time.sleep(0.5)
    start_workerd()
    loop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
