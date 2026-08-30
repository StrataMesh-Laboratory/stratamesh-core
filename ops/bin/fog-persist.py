#!/usr/bin/env python3
"""Keep FOG :8787 + workerd plugin + optional public tunnel.

Session origin is temporary. Public flux is a lease:

  session.live → --yield-public (DARK) → Mac origin-take.command → macbook.live
  macbook.live → origin-yield.command (DARK) → --resume-public → session.live

Never two cloudflared connectors on the same named tunnel.
This process does not outlive the container. It outlives the chat session.
"""
from __future__ import annotations

import json
import os
import shutil
import signal
import sqlite3
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen

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
LEASE = DATA / "origin.lease"
NODE_ID = os.environ.get("FOG_NODE_ID") or "FOG-NODE-PT-CM-001"
PORT = int(os.environ.get("FOG_PORT") or "8787")
HEALTH = f"http://127.0.0.1:{PORT}/health"
PUBLIC = os.environ.get("FOG_PUBLIC_URL") or "https://fog.calhegasmorais.pt/health"
ROLE = os.environ.get("FOG_ORIGIN") or "session"


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


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def read_lease() -> dict:
    d = {"role": ROLE, "public": True, "updated": None, "yielded_at": None, "taken_at": None}
    try:
        if LEASE.is_file():
            d.update(json.loads(LEASE.read_text(encoding="utf-8")))
    except Exception:
        pass
    d["role"] = ROLE
    return d


def write_lease(**kw) -> dict:
    d = read_lease()
    d.update(kw)
    d["role"] = ROLE
    d["updated"] = now_iso()
    DATA.mkdir(parents=True, exist_ok=True)
    LEASE.write_text(json.dumps(d, indent=2) + "\n", encoding="utf-8")
    LEASE.chmod(0o644)
    return d


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


def pids_comm(name: str) -> list[int]:
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
            comm = (p / "comm").read_text().strip()
        except Exception:
            continue
        if comm == name:
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
    if not LEASE.is_file():
        write_lease(public=True, taken_at=now_iso())


def start_node() -> None:
    if healthy():
        return
    ensure_files()
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    env.setdefault("FOG_ORIGIN", ROLE)
    log(f"start node :{PORT} db={DB_LIVE} origin={ROLE}")
    subprocess.Popen(
        [sys.executable, str(SRC / "node_persistent.py"), "--port", str(PORT), "--db", str(DB_LIVE), "--id", NODE_ID],
        cwd=str(SRC),
        env=env,
        stdout=LOG.open("a"),
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )


def start_tunnel() -> None:
    if pids_comm("cloudflared"):
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


def stop_tunnel() -> None:
    pids = pids_comm("cloudflared")
    for pid in pids:
        try:
            os.kill(pid, signal.SIGTERM)
        except Exception:
            pass
    if pids:
        log(f"stopped tunnel pids={pids}")
        time.sleep(0.4)


def public_probe() -> dict:
    try:
        req = Request(PUBLIC, headers={"User-Agent": "StrataMesh-origin-flux/1"})
        with urlopen(req, timeout=8) as r:
            body = r.read().decode("utf-8", "replace")
            try:
                data = json.loads(body)
            except Exception:
                data = {"raw": body[:200]}
            return {"ok": r.status == 200, "status": r.status, **data}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def yield_public() -> dict:
    d = write_lease(public=False, yielded_at=now_iso())
    stop_tunnel()
    log("yield-public: tunnel dropped, local fog+workerd stay")
    return {"ok": True, "lease": d, "public": public_probe()}


def resume_public() -> dict:
    d = write_lease(public=True, taken_at=now_iso(), yielded_at=None)
    start_tunnel()
    log("resume-public: tunnel requested")
    return {"ok": True, "lease": d}


def flux_status() -> dict:
    lease = read_lease()
    return {
        "ok": True,
        "role": ROLE,
        "lease": lease,
        "local_fog": healthy(),
        "tunnel_pids": pids_comm("cloudflared"),
        "public": public_probe(),
    }


def loop() -> None:
    ensure_files()
    log(f"watchdog up pid={os.getpid()} pgid={os.getpgid(0)} port={PORT} origin={ROLE}")
    n = 0
    while True:
        if not healthy():
            start_node()
            time.sleep(1)
        lease = read_lease()
        if lease.get("public", True):
            start_tunnel()
        else:
            if pids_comm("cloudflared"):
                stop_tunnel()
        n += 1
        if n % 4 == 0:
            snapshot_db()
        time.sleep(15)


def main() -> int:
    if "--status" in sys.argv:
        print(json.dumps(flux_status(), indent=2))
        return 0
    if "--yield-public" in sys.argv:
        print(json.dumps(yield_public(), indent=2))
        return 0
    if "--resume-public" in sys.argv:
        print(json.dumps(resume_public(), indent=2))
        return 0
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
