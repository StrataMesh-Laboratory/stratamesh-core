#!/usr/bin/env python3
"""Mac Fog runtime UI. Refresh 15s. q quit UI · s stop fog (not macbook-server tunnel)."""
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
INTERVAL = 15
TEAL, DIM, OK, BAD, RST = "\033[36m", "\033[2m", "\033[32m", "\033[31m", "\033[0m"


def get(url: str, timeout: float = 2.0) -> dict:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "fog-tui/5"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        return {"ok": False, "error": str(e)}


def pids(name: str) -> list[int]:
    try:
        out = subprocess.check_output(["pgrep", "-x", name], text=True)
        return [int(x) for x in out.split() if x.strip().isdigit()]
    except Exception:
        return []


def mem() -> tuple[int, int, int]:
    try:
        vm = subprocess.check_output(["vm_stat"], text=True)
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
        return free, wired, active
    except Exception:
        return 0, 0, 0


def gb(n: int) -> str:
    return "%.1fG" % (n / 1073741824)


def ago(sec) -> str:
    sec = int(sec or 0)
    h, m, s = sec // 3600, (sec % 3600) // 60, sec % 60
    return "%dh%02dm%02ds" % (h, m, s) if h else "%dm%02ds" % (m, s)


def stop_fog() -> str:
    uid = os.getuid()
    notes = []
    for label in ("pt.calhegasmorais.fog", "pt.calhegasmorais.workerd"):
        plist = LAUNCH / (label + ".plist")
        subprocess.call(["launchctl", "bootout", "gui/%s/%s" % (uid, label)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.call(["launchctl", "unload", str(plist)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        notes.append("unloaded " + label)
    for pid in pids("workerd"):
        try:
            os.kill(pid, 15)
            notes.append("sigterm workerd %s" % pid)
        except Exception:
            pass
    return " · ".join(notes) or "already stopped"


def draw(msg: str = "") -> None:
    hop = get("http://127.0.0.1:8788/health")
    st = get("http://127.0.0.1:8787/status")
    wr = st.get("workerd") if isinstance(st.get("workerd"), dict) else {}
    dag = st.get("dag") if isinstance(st.get("dag"), dict) else {}
    spa = st.get("spa") if isinstance(st.get("spa"), dict) else {}
    tok = st.get("token") if isinstance(st.get("token"), dict) else {}
    cons = st.get("consensus") if isinstance(st.get("consensus"), dict) else {}
    prov = st.get("mesh_provision") if isinstance(st.get("mesh_provision"), dict) else {}
    n = hop.get("n") if hop.get("n") is not None else st.get("n")
    if n is None:
        n = cons.get("n") if cons.get("n") is not None else prov.get("n")
    fmax = cons.get("f_max")
    if fmax is None:
        fmax = prov.get("f_max")
    member = hop.get("mesh_member")
    if member is None:
        member = st.get("mesh_member")
    if member is None:
        member = prov.get("mesh_member")
    load = os.getloadavg()
    free, wired, active = mem()
    db = FOG / "data/fog.db"
    dbn = db.stat().st_size if db.is_file() else 0
    origin = hop.get("origin") or wr.get("origin") or "?"
    live = hop.get("ok") is True and st.get("status") == "operational"
    mark = OK + "LIVE" + RST if live else BAD + "DOWN" + RST
    bar = "─" * min(72, shutil.get_terminal_size((72, 20)).columns)
    sys.stdout.write("\033[H\033[J")
    print(TEAL + " FOG · MacBook runtime v5" + RST, DIM + time.strftime("%H:%M:%S") + RST, mark)
    print(DIM + bar + RST)
    print(" node     ", st.get("node_id") or "—", DIM + str(st.get("version") or "") + RST)
    print(" origin   ", TEAL + str(origin) + RST, DIM + str(hop.get("layer") or "") + RST)
    print(" mac_live ", (OK + "true" + RST) if (hop.get("mac_live") or st.get("mac_live")) else (BAD + "false" + RST),
          DIM + " mesh_member=" + RST, st.get("mesh_member"))
    print(" hop      ", "workerd :8788", (OK + " ok" + RST) if hop.get("ok") else (BAD + " down" + RST),
          " · fog :8787", (OK + " ok" + RST) if st.get("status") else (BAD + " down" + RST))
    print(" uptime   ", ago(st.get("uptime_seconds")), DIM + "reboots" + RST, wr.get("reboots", 0))
    print(" mesh     ", "n=%s f_max=%s member=%s oracle=%s" % (
        n, fmax, member, st.get("oracle_live")))
    print(" dag      ", "tx=%s tips=%s" % (dag.get("transaction_count"), dag.get("tip_count")),
          DIM + str((dag.get("tips_sample") or [""])[0]) + RST)
    print(" spa      ", "total=%s active=%s" % (spa.get("total"), spa.get("active")),
          " · STRATA", tok.get("total_supply"))
    print(DIM + bar + RST)
    print(" load     ", "%.2f  %.2f  %.2f" % load)
    print(" mem      ", "free", gb(free), "active", gb(active), "wired", gb(wired))
    stor = st.get("storage") if isinstance(st.get("storage"), dict) else {}
    print(" sqlite   ", "%.1fK" % (dbn / 1024.0), DIM + str(stor.get("path") or db) + RST)
    print(" procs    ", "workerd", pids("workerd") or "—",
          " · python3", len(pids("python3")),
          " · cloudflared", len(pids("cloudflared")))
    print(DIM + bar + RST)
    print(" " + TEAL + "q" + RST + " quit UI   " + TEAL + "s" + RST + " stop fog   " + TEAL + "r" + RST + " refresh now")
    print(DIM + " 15s refresh · stop does not kill macbook-server cloudflared" + RST)
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
                ch = sys.stdin.read(1)
                return ch
        return ""
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)


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
                draw("stop fog? y/n")
                conf = wait_key(30)
                if conf in ("y", "Y"):
                    msg = stop_fog()
                else:
                    msg = "stop cancelled"
    except KeyboardInterrupt:
        return 0
    finally:
        print("\033[?25h")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
