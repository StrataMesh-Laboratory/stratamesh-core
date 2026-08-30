#!/usr/bin/env python3
"""Mac Fog runtime UI v6. 15s refresh.
q quit · s stop fog · b reboot fog · g git pull + reboot · r refresh now
Does not kill macbook-server cloudflared.
"""
from __future__ import annotations

import json
import os
import select
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

FOG = Path(os.environ.get("FOG_HOME") or (Path.home() / "StrataMesh/fog"))
LAUNCH = Path.home() / "Library/LaunchAgents"
REPO = FOG / "repo"
INTERVAL = 15
TEAL, DIM, OK, BAD, RST = "\033[36m", "\033[2m", "\033[32m", "\033[31m", "\033[0m"
UID = os.getuid()
FOG_LABELS = ("pt.calhegasmorais.fog", "pt.calhegasmorais.workerd")


def sh(args: list[str], timeout: float = 2.0) -> str:
    try:
        return subprocess.check_output(args, text=True, stderr=subprocess.DEVNULL, timeout=timeout)
    except Exception:
        return ""


def get(url: str, timeout: float = 2.0) -> dict:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "fog-tui/6"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        return {"ok": False, "error": str(e)}


def pids_rss(name: str) -> list[tuple[int, int]]:
    """(pid, rss_kb) for exact comm match."""
    out = sh(["ps", "-axo", "pid=,rss=,comm="])
    rows = []
    for line in out.splitlines():
        parts = line.split(None, 2)
        if len(parts) < 3:
            continue
        comm = Path(parts[2].strip()).name
        if comm != name:
            continue
        try:
            rows.append((int(parts[0]), int(parts[1])))
        except ValueError:
            continue
    return rows


def mem() -> tuple[int, int, int, int]:
    try:
        vm = sh(["vm_stat"])
        page = 4096
        d: dict[str, int] = {}
        for line in vm.splitlines()[1:]:
            if ":" not in line:
                continue
            k, v = line.split(":", 1)
            d[k.strip()] = int("".join(ch for ch in v if ch.isdigit()) or 0)
        free = (d.get("Pages free", 0) + d.get("Pages speculative", 0)) * page
        wired = d.get("Pages wired down", 0) * page
        active = d.get("Pages active", 0) * page
        compressed = d.get("Pages occupied by compressor", 0) * page
        return free, wired, active, compressed
    except Exception:
        return 0, 0, 0, 0


def gb(n: int) -> str:
    return "%.1fG" % (n / 1073741824)


def kb(n: int) -> str:
    if n >= 1024:
        return "%.1fM" % (n / 1024.0)
    return "%dK" % n


def ago(sec) -> str:
    sec = int(sec or 0)
    h, m, s = sec // 3600, (sec % 3600) // 60, sec % 60
    return "%dh%02dm%02ds" % (h, m, s) if h else "%dm%02ds" % (m, s)


def sysctl(key: str) -> str:
    return sh(["sysctl", "-n", key]).strip()


def host_cpu() -> tuple[str, str, str]:
    brand = sysctl("machdep.cpu.brand_string") or sysctl("hw.model") or "?"
    ncpu = sysctl("hw.ncpu") or "?"
    boot = sysctl("kern.boottime")
    return brand.split("@")[0].strip()[:42], ncpu, boot


def disk() -> tuple[str, str]:
    try:
        u = shutil.disk_usage(str(FOG if FOG.exists() else Path.home()))
        pct = int(100 * u.used / u.total) if u.total else 0
        return "%s / %s (%d%%)" % (gb(u.used), gb(u.total), pct), str(FOG)
    except Exception:
        return "—", str(FOG)


def net() -> str:
    out = sh(["netstat", "-ib"])
    for line in out.splitlines():
        parts = line.split()
        if len(parts) >= 10 and parts[0] in ("en0", "en1") and parts[2] != "0":
            try:
                ibytes = int(parts[6])
                obytes = int(parts[9])
                return "%s rx %s tx %s" % (parts[0], gb(ibytes), gb(obytes))
            except ValueError:
                continue
    return "—"


def git_sha() -> str:
    repo = REPO if (REPO / ".git").exists() else (FOG / "repo")
    if not (repo / ".git").exists() and (Path.home() / "StrataMesh/fog/repo/.git").exists():
        repo = Path.home() / "StrataMesh/fog/repo"
    if not (repo / ".git").exists():
        return "—"
    sha = sh(["git", "-C", str(repo), "rev-parse", "--short", "HEAD"]).strip()
    dirty = sh(["git", "-C", str(repo), "status", "--porcelain"]).strip()
    return (sha or "—") + (" *" if dirty else "")


def launchctl_do(verb: str, label: str) -> int:
    target = "gui/%s/%s" % (UID, label)
    if verb == "kickstart":
        return subprocess.call(
            ["launchctl", "kickstart", "-k", target],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    if verb == "bootout":
        return subprocess.call(
            ["launchctl", "bootout", target],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    plist = LAUNCH / (label + ".plist")
    return subprocess.call(
        ["launchctl", verb, str(plist)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def stop_fog() -> str:
    notes = []
    for label in FOG_LABELS:
        launchctl_do("bootout", label)
        launchctl_do("unload", label)
        notes.append("unloaded " + label)
    return " · ".join(notes) or "already stopped"


def reboot_fog() -> str:
    notes = []
    for label in FOG_LABELS:
        plist = LAUNCH / (label + ".plist")
        if not plist.is_file() and label.endswith("workerd"):
            continue
        launchctl_do("bootout", label)
        time.sleep(0.3)
        rc = launchctl_do("kickstart", label)
        if rc != 0:
            launchctl_do("load", label)
            rc = launchctl_do("kickstart", label)
        notes.append("%s rc=%s" % (label.split(".")[-1], rc))
    return "reboot " + " · ".join(notes)


def git_pull_reboot() -> str:
    repo = REPO if (REPO / ".git").exists() else Path.home() / "StrataMesh/fog/repo"
    if not (repo / ".git").exists():
        return "no git repo at %s" % repo
    fetch = sh(["git", "-C", str(repo), "fetch", "origin"], timeout=30)
    pull = sh(["git", "-C", str(repo), "pull", "--ff-only", "origin", "main"], timeout=30)
    tui_src = repo / "deploy/mac-fog/fog-tui.py"
    tui_dst = FOG / "bin/fog-tui.py"
    copied = ""
    if tui_src.is_file():
        tui_dst.write_bytes(tui_src.read_bytes())
        copied = " tui copied"
    return ("pull %s | %s" % (pull.strip()[:80] or fetch.strip()[:40] or "ok", reboot_fog())) + copied


def mark(ok: bool) -> str:
    return OK + "LIVE" + RST if ok else BAD + "DOWN" + RST


def yn(v) -> str:
    return (OK + "true" + RST) if v else (BAD + "false" + RST)


def draw(msg: str = "") -> None:
    hop = get("http://127.0.0.1:8788/health")
    st = get("http://127.0.0.1:8787/status")
    pub = get("https://fog.calhegasmorais.pt/health", timeout=3.0)
    edge = get("https://edge.calhegasmorais.pt/health", timeout=3.0)
    wr = st.get("workerd") if isinstance(st.get("workerd"), dict) else {}
    dag = st.get("dag") if isinstance(st.get("dag"), dict) else {}
    spa = st.get("spa") if isinstance(st.get("spa"), dict) else {}
    tok = st.get("token") if isinstance(st.get("token"), dict) else {}
    cons = st.get("consensus") if isinstance(st.get("consensus"), dict) else {}
    prov = st.get("mesh_provision") if isinstance(st.get("mesh_provision"), dict) else {}
    sub = st.get("subsistence") if isinstance(st.get("subsistence"), dict) else {}
    contrib = st.get("contribution") if isinstance(st.get("contribution"), dict) else {}
    stor = st.get("storage") if isinstance(st.get("storage"), dict) else {}
    n = hop.get("n")
    if n is None:
        n = st.get("n") if st.get("n") is not None else cons.get("n")
    if n is None:
        n = prov.get("n")
    fmax = cons.get("f_max")
    if fmax is None:
        fmax = prov.get("f_max")
    member = hop.get("mesh_member")
    if member is None:
        member = st.get("mesh_member")
    if member is None:
        member = prov.get("mesh_member")

    load = os.getloadavg()
    free, wired, active, compressed = mem()
    db = FOG / "data/fog.db"
    wal = FOG / "data/fog.db-wal"
    dbn = db.stat().st_size if db.is_file() else 0
    waln = wal.stat().st_size if wal.is_file() else 0
    origin = hop.get("origin") or wr.get("origin") or "?"
    live = hop.get("ok") is True and st.get("status") == "operational"
    brand, ncpu, boot = host_cpu()
    dsk, dsk_path = disk()
    wd = pids_rss("workerd")
    py = pids_rss("python3")
    cf = pids_rss("cloudflared")
    wd_rss = sum(r for _, r in wd)
    py_rss = sum(r for _, r in py)
    cf_rss = sum(r for _, r in cf)
    cols = min(78, shutil.get_terminal_size((78, 24)).columns)
    bar = "─" * cols

    sys.stdout.write("\033[H\033[J")
    print(TEAL + " FOG · MacBook runtime v6" + RST, DIM + time.strftime("%H:%M:%S") + RST, mark(live))
    print(DIM + bar + RST)
    print(" node     ", st.get("node_id") or "—", DIM + str(st.get("version") or "") + RST)
    print(" origin   ", TEAL + str(origin) + RST, DIM + str(hop.get("layer") or "") + RST)
    print(" mac_live ", yn(hop.get("mac_live") or st.get("mac_live")),
          DIM + " trusted=" + RST, yn(st.get("trusted") if "trusted" in st else hop.get("trusted")))
    print(" hop      ", "workerd :8788", mark(bool(hop.get("ok"))),
          " · fog :8787", mark(st.get("status") == "operational"))
    print(" public   ", "fog", mark(bool(pub.get("ok"))),
          DIM + "origin=" + str(pub.get("origin") or "—") + RST,
          " · edge", mark(bool(edge.get("ok"))))
    print(" uptime   ", ago(st.get("uptime_seconds")),
          DIM + "plugin reboots" + RST, wr.get("reboots", 0))
    print(" mesh     ", "n=%s f_max=%s member=%s oracle=%s" % (
        n, fmax, member, st.get("oracle_live")))
    print(" dag      ", "tx=%s tips=%s height=%s" % (
        dag.get("transaction_count"), dag.get("tip_count"), dag.get("height") or dag.get("max_height")))
    print(" spa      ", "total=%s active=%s" % (spa.get("total"), spa.get("active")),
          " · STRATA", tok.get("total_supply"))
    if contrib:
        print(" poc      ", "accepted=%s pending=%s" % (
            contrib.get("accepted") or contrib.get("count"), contrib.get("pending") or contrib.get("rejected")))
    if sub:
        print(" subsist  ", "pressure=%s debt=%s" % (
            sub.get("pressure") or sub.get("state"), sub.get("debt") or sub.get("balance")))
    print(DIM + bar + RST)
    print(" host     ", brand, DIM + "ncpu=" + ncpu + RST)
    print(" cpu      ", "load %.2f  %.2f  %.2f" % load)
    print(" mem      ", "free", gb(free), "active", gb(active), "wired", gb(wired),
          DIM + "compressor", gb(compressed) + RST)
    print(" rss      ", "workerd", kb(wd_rss), "python3", kb(py_rss), "cloudflared", kb(cf_rss))
    print(" disk     ", dsk, DIM + dsk_path + RST)
    print(" net      ", net())
    print(" sqlite   ", "%.1fK" % (dbn / 1024.0), DIM + "wal", "%.1fK" % (waln / 1024.0), str(stor.get("path") or db) + RST)
    print(" procs    ", "workerd", [p for p, _ in wd] or "—",
          " · python3", len(py),
          " · cloudflared", len(cf))
    print(" git      ", git_sha())
    print(DIM + bar + RST)
    print(" " + TEAL + "q" + RST + " quit   "
          + TEAL + "s" + RST + " stop   "
          + TEAL + "b" + RST + " reboot   "
          + TEAL + "g" + RST + " git pull+reboot   "
          + TEAL + "r" + RST + " refresh")
    print(DIM + " 15s · reboot kickstarts fog+workerd · never kills macbook-server cloudflared" + RST)
    if msg:
        print(" " + msg)
    sys.stdout.flush()


def wait_key(seconds: float) -> str:
    fd = sys.stdin.fileno()
    if not sys.stdin.isatty():
        time.sleep(seconds)
        return ""
    import tty
    import termios
    old = termios.tcgetattr(fd)
    try:
        tty.setcbreak(fd)
        end = time.time() + seconds
        while time.time() < end:
            r, _, _ = select.select([sys.stdin], [], [], max(0.0, end - time.time()))
            if r:
                return sys.stdin.read(1)
        return ""
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)


def confirm(prompt: str) -> bool:
    draw(prompt + "  y/n")
    return wait_key(30) in ("y", "Y")


def main() -> int:
    print("\033[?25l", end="")
    msg = ""
    try:
        while True:
            draw(msg)
            msg = ""
            ch = wait_key(INTERVAL)
            if not ch:
                continue
            if ch in ("q", "Q", "\x1b"):
                return 0
            if ch in ("r", "R"):
                continue
            if ch in ("s", "S"):
                msg = stop_fog() if confirm("stop fog?") else "stop cancelled"
            elif ch in ("b", "B"):
                msg = reboot_fog() if confirm("reboot fog+workerd?") else "reboot cancelled"
            elif ch in ("g", "G"):
                msg = git_pull_reboot() if confirm("git pull origin main + reboot?") else "pull cancelled"
    except KeyboardInterrupt:
        return 0
    finally:
        print("\033[?25h")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
