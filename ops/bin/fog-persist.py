#!/usr/bin/env python3
"""Keep FOG :8787 + tunnel alive outside the Grok session process group.

Double-fork + setsid so the agent bash PGID SIGTERM does not take fog with it.
SQLite is snapshotted to /workspace/data/fog/fog.db. Token is read from a
local file into TUNNEL_TOKEN (never argv / never git).

This does not outlive the container. It outlives the chat session.
"""
from __future__ import annotations

import os
import shutil
import signal
import sqlite3
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(os.environ.get("FOG_SRC") or "/tmp/sm-core")
SRC = ROOT / "src"
DATA = Path(os.environ.get("FOG_DATA") or "/workspace/data/fog")
SECRETS = Path(os.environ.get("FOG_SECRETS") or "/workspace/data/secrets")
DB_LIVE = DATA / "fog.db"
DB_FALLBACK = Path("/tmp/fog-run/fog.db")
BIN_CF = DATA / "cloudflared"
BIN_CF_FALLBACK = Path("/tmp/fog-run/cloudflared")
TOKEN_FILE = SECRETS / "tunnel_token"
PIDFILE = DATA / "fog-persist.pid"
LOG = DATA / "fog-persist.log"
NODE_ID = os.environ.get("FOG_NODE_ID") or "FOG-NODE-PT-CM-001"
PORT = int(os.environ.get("FOG_PORT") or "8787")
HEALTH = f"http://127.0.0.1:{PORT}/health"


def log(msg: str) -> None:
    line = time.strftime("%Y-%m-%dT%H:%M:%SZ ", time.gmtime()) + msg + "\n"
    try:
        DATA.mkdir(parents=True, exist_ok=True)
        with LOG.open("a", encoding="utf-8") as fh:
            fh.write(line)
    except Exception:
        pass
    try:
        sys.stderr.write(line)
        sys.stderr.flush()
    except Exception:
        pass


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
    signal.signal(signal.SIGPIPE, signal.SIG_IGN)
    devnull = os.open("/dev/null", os.O_RDWR)
    os.dup2(devnull, 0)
    lf = os.open(str(LOG), os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
    os.dup2(lf, 1)
    os.dup2(lf, 2)
    PIDFILE.write_text(str(os.getpid()) + "\n")


def healthy() -> bool:
    try:
        with urlopen(HEALTH, timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def pids_matching(needle: str) -> list[int]:
    out = []
    proc = Path("/proc")
    me = os.getpid()
    for p in proc.iterdir():
        if not p.name.isdigit():
            continue
        pid = int(p.name)
        if pid == me:
            continue
        try:
            cmd = (p / "cmdline").read_bytes().replace(b"\0", b" ").decode("utf-8", "replace")
        except Exception:
            continue
        if needle in cmd:
            out.append(pid)
    return out


def snapshot_db() -> None:
    src = DB_LIVE if DB_LIVE.is_file() else DB_FALLBACK
    if not src.is_file():
        return
    dest = DATA / "fog.snapshot.db"
    try:
        src_c = sqlite3.connect(str(src))
        dst_c = sqlite3.connect(str(dest))
        src_c.backup(dst_c)
        dst_c.close()
        src_c.close()
        dest.replace(DATA / "fog.ok.db")
    except Exception as e:
        log("snapshot fail: " + str(e))


def ensure_files() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    SECRETS.mkdir(parents=True, exist_ok=True)
    if not BIN_CF.is_file() and BIN_CF_FALLBACK.is_file():
        shutil.copy2(BIN_CF_FALLBACK, BIN_CF)
        BIN_CF.chmod(0o755)
    tf_fallback = Path("/tmp/tunnel_token")
    if not TOKEN_FILE.is_file() and tf_fallback.is_file():
        TOKEN_FILE.write_bytes(tf_fallback.read_bytes())
        TOKEN_FILE.chmod(0o600)
    if not DB_LIVE.is_file():
        if (DATA / "fog.ok.db").is_file():
            shutil.copy2(DATA / "fog.ok.db", DB_LIVE)
        elif DB_FALLBACK.is_file():
            shutil.copy2(DB_FALLBACK, DB_LIVE)


def start_node() -> None:
    if healthy():
        return
    ensure_files()
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    env.setdefault("FOG_ORIGIN", "session")
    log(f"start node :{PORT} db={DB_LIVE}")
    subprocess.Popen(
        [sys.executable, str(SRC / "node_persistent.py"), "--port", str(PORT), "--db", str(DB_LIVE), "--id", NODE_ID],
        cwd=str(SRC),
        env=env,
        stdout=LOG.open("a"),
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )


def start_tunnel() -> None:
    if pids_matching("cloudflared"):
        return
    ensure_files()
    tok = TOKEN_FILE.read_text().strip() if TOKEN_FILE.is_file() else ""
    if not tok:
        log("HOLD tunnel: no local token file")
        return
    cf = str(BIN_CF if BIN_CF.is_file() else BIN_CF_FALLBACK)
    env = os.environ.copy()
    env["TUNNEL_TOKEN"] = tok
    log("start tunnel (token via env, not argv)")
    subprocess.Popen(
        [cf, "tunnel", "--no-autoupdate", "run"],
        env=env,
        stdout=LOG.open("a"),
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )


def loop() -> None:
    ensure_files()
    log(f"watchdog up pid={os.getpid()} pgid={os.getpgid(0)} port={PORT}")
    n = 0
    while True:
        if not healthy():
            start_node()
            time.sleep(1)
        start_tunnel()
        n += 1
        if n % 4 == 0:
            snapshot_db()
        time.sleep(15)


def main() -> int:
    if "--stop" in sys.argv:
        if PIDFILE.is_file():
            try:
                os.kill(int(PIDFILE.read_text().strip()), signal.SIGTERM)
            except Exception as e:
                log("stop: " + str(e))
        return 0
    if "--daemon" in sys.argv:
        daemonize()
    else:
        DATA.mkdir(parents=True, exist_ok=True)
        PIDFILE.write_text(str(os.getpid()) + "\n")
    loop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
