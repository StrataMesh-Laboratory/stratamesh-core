#!/usr/bin/env python3
"""Keep FOG :8787 + workerd plugin + optional public tunnel.

Mac (macbook-server) is primary public origin.
This session is standby: local fog+workerd stay warm, DNS stays on Mac.

If Mac is down > FOG_FALLBACK_AFTER (default 1800s / 30 min):
  start stratamesh-fog-lab connector + CNAME fog → fog-lab.

If Mac tunnel is healthy again (or POST /origin/reclaim):
  CNAME fog → macbook-server + drop this connector.

Never two connectors on the same named tunnel.
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
sys.path.insert(0, str(SRC))
import origin_lease as ol  # noqa: E402

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
WORKERD_HEALTH = os.environ.get("WORKERD_HEALTH") or "http://127.0.0.1:8788/health"
PUBLIC = os.environ.get("FOG_PUBLIC_URL") or "https://fog.calhegasmorais.pt/health"
ROLE = os.environ.get("FOG_ORIGIN") or "session"
CF_ACCOUNT = os.environ.get("CF_ACCOUNT") or "f3645fcb56675cf7250d8ba7358eb252"
PUBLIC_UA = (
    "Mozilla/5.0 (compatible; StrataMesh-origin-flux/2; +https://calhegasmorais.pt/)"
)


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


def read_lease() -> dict:
    return ol.read()


def write_lease(**kw) -> dict:
    return ol.write(**kw)


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


def workerd_healthy() -> bool:
    try:
        with urlopen(WORKERD_HEALTH, timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def local_ok() -> bool:
    return healthy() and workerd_healthy()


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
    if not ol.lease_path().is_file():
        write_lease(public=False, dns_target="macbook")


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


def _http_json(url: str, method: str = "GET", headers: dict | None = None, body: bytes | None = None, timeout: float = 8):
    hdrs = {"User-Agent": PUBLIC_UA, **(headers or {})}
    req = Request(url, data=body, method=method, headers=hdrs)
    with urlopen(req, timeout=timeout) as r:
        raw = r.read().decode("utf-8", "replace")
        try:
            data = json.loads(raw) if raw else {}
        except Exception:
            data = {"raw": raw[:200]}
        return r.status, data


def public_probe() -> dict:
    try:
        status, data = _http_json(PUBLIC, timeout=8)
        return {"ok": status == 200, "status": status, **data}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def load_god_api() -> tuple[str, str] | None:
    email = (os.environ.get("CLOUDFLARE_EMAIL") or "amcmorais@icloud.com").strip()
    tok = (os.environ.get("GOD_API") or os.environ.get("CLOUDFLARE_WRITE_TOKEN") or "").strip()
    if not tok:
        for p in (Path("/tmp/god_api"), SECRETS / "god_api"):
            if p.is_file():
                tok = p.read_text(encoding="utf-8").strip()
                break
    if not tok or tok.startswith("cfut"):
        return None
    return email, tok


def cf_api(method: str, path: str, payload: dict | None = None) -> dict:
    creds = load_god_api()
    if not creds:
        return {"ok": False, "error": "no_god_api"}
    email, tok = creds
    body = None if payload is None else json.dumps(payload).encode()
    url = "https://api.cloudflare.com/client/v4" + path
    try:
        status, data = _http_json(
            url,
            method=method,
            headers={
                "X-Auth-Email": email,
                "Authorization": "Bearer " + tok,
                "Content-Type": "application/json",
            },
            body=body,
            timeout=20,
        )
        data["http"] = status
        data["ok"] = bool(data.get("success")) and status in (200, 201)
        return data
    except Exception as e:
        return {"ok": False, "error": str(e)}


def mac_tunnel_status() -> dict:
    data = cf_api("GET", f"/accounts/{CF_ACCOUNT}/cfd_tunnel/{ol.MAC_TUNNEL}")
    result = data.get("result") or {}
    return {
        "ok": data.get("ok"),
        "status": result.get("status"),
        "error": data.get("error") or data.get("errors"),
    }


def fog_dns_record() -> dict:
    data = cf_api("GET", f"/zones/{ol.ZONE_ID}/dns_records?name={ol.FOG_HOST}")
    recs = data.get("result") or []
    rec = recs[0] if recs else {}
    return {"ok": data.get("ok"), "id": rec.get("id"), "content": rec.get("content"), "error": data.get("error")}


def dns_point(target: str) -> dict:
    want = ol.TUNNEL_CNAME[target]
    rec = fog_dns_record()
    if not rec.get("id"):
        return {"ok": False, "error": "fog_dns_record_missing", **rec}
    if rec.get("content") == want:
        return {"ok": True, "already": True, "target": target, "content": want}
    data = cf_api(
        "PUT",
        f"/zones/{ol.ZONE_ID}/dns_records/{rec['id']}",
        {
            "type": "CNAME",
            "name": "fog",
            "content": want,
            "proxied": True,
            "ttl": 1,
        },
    )
    ok = bool(data.get("ok"))
    log(f"dns fog → {target} {'ok' if ok else 'HOLD'} content={want}")
    return {"ok": ok, "target": target, "content": want, "cf": {"http": data.get("http"), "errors": data.get("errors")}}


def mac_alive(probe: dict, tun: dict) -> bool:
    if probe.get("ok") and probe.get("origin") == "macbook":
        return True
    if tun.get("ok") and tun.get("status") == "healthy":
        return True
    return False


def yield_public() -> dict:
    dns = dns_point("macbook")
    stop_tunnel()
    d = write_lease(
        public=False,
        fallback=False,
        fallback_at=None,
        dns_target="macbook",
        yielded_at=ol.now_iso(),
        reclaim_requested_at=None,
    )
    log("yield-public: DNS macbook-server, fog-lab connector down")
    return {"ok": True, "lease": ol.public_view(d), "dns": dns, "public": public_probe()}


def resume_public() -> dict:
    if not local_ok():
        start_node()
        time.sleep(1)
    start_tunnel()
    dns = dns_point("session")
    d = write_lease(
        public=True,
        fallback=True,
        fallback_at=ol.now_iso(),
        dns_target="session",
        taken_at=ol.now_iso(),
        yielded_at=None,
    )
    log("resume-public: DNS fog-lab + session connector")
    return {"ok": bool(dns.get("ok")), "lease": ol.public_view(d), "dns": dns}


def flux_status() -> dict:
    lease = read_lease()
    probe = public_probe()
    tun = mac_tunnel_status()
    dns = fog_dns_record()
    alive = mac_alive(probe, tun)
    action = ol.decide(
        lease,
        mac_alive=alive,
        local_ok=local_ok(),
        now=time.time(),
        role_name=ROLE,
        after_sec=ol.fallback_after_sec(),
    )
    remaining = None
    t0 = ol.parse_iso(lease.get("mac_down_since"))
    if t0 and not alive:
        remaining = max(0, int(ol.fallback_after_sec() - (time.time() - t0)))
    return {
        "ok": True,
        "role": ROLE,
        "action": action,
        "mac_alive": alive,
        "fallback_remaining_sec": remaining,
        "lease": ol.public_view(lease),
        "local_fog": healthy(),
        "local_workerd": workerd_healthy(),
        "tunnel_pids": pids_comm("cloudflared"),
        "public": probe,
        "mac_tunnel": tun,
        "dns": dns,
    }


def apply_action(action: str) -> None:
    if action == "mark_down":
        write_lease(mac_down_since=ol.now_iso())
        log("mac down clock started (30 min to session fallback)")
    elif action == "clear_down":
        write_lease(mac_down_since=None, mac_last_ok=ol.now_iso(), fallback=False)
    elif action in ("yield_to_mac", "honor_reclaim"):
        yield_public()
    elif action == "take":
        log("fallback TAKE: Mac down ≥ 30 min")
        write_lease(fallback_reason="mac_down_30m")
        resume_public()
    elif action == "hold_unhealthy":
        log("fallback HOLD: local fog/workerd not ready")
    elif action == "wait":
        pass


def tick() -> str:
    if not healthy():
        start_node()
        time.sleep(1)
    lease = read_lease()
    probe = public_probe()
    tun = mac_tunnel_status()
    alive = mac_alive(probe, tun)
    # CF API miss: do not treat as Mac down.
    if not tun.get("ok") and not (probe.get("ok") and probe.get("origin") == "macbook"):
        if not lease.get("public"):
            apply_action("stay")
            if lease.get("public", False):
                start_tunnel()
            else:
                if pids_comm("cloudflared"):
                    stop_tunnel()
            return "uncertain"
    action = ol.decide(
        lease,
        mac_alive=alive,
        local_ok=local_ok(),
        now=time.time(),
        role_name=ROLE,
        after_sec=ol.fallback_after_sec(),
    )
    apply_action(action)
    lease = read_lease()
    if lease.get("public"):
        start_tunnel()
    else:
        if pids_comm("cloudflared"):
            stop_tunnel()
    return action


def loop() -> None:
    ensure_files()
    log(
        f"watchdog up pid={os.getpid()} pgid={os.getpgid(0)} port={PORT} "
        f"origin={ROLE} fallback_after={ol.fallback_after_sec()}s"
    )
    n = 0
    while True:
        try:
            tick()
        except Exception as e:
            log("tick fail: " + str(e))
        n += 1
        if n % 4 == 0:
            snapshot_db()
        time.sleep(15)


def main() -> int:
    try:
        sys.path.insert(0, str(Path(os.environ.get("FOG_SRC") or Path.home() / "StrataMesh/fog/repo") / "src"))
        from fog_plugins.tmp_sweep import sweep
        sweep(Path(os.environ.get("FOG_HOME") or Path.home() / "StrataMesh/fog"))
    except Exception:
        pass
    if "--status" in sys.argv:
        print(json.dumps(flux_status(), indent=2))
        return 0
    if "--yield-public" in sys.argv:
        print(json.dumps(yield_public(), indent=2))
        return 0
    if "--resume-public" in sys.argv or "--fallback-now" in sys.argv:
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
