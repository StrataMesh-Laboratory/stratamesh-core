#!/usr/bin/env python3
"""StrataMesh LAB Fog runtime UI v0.3.0. Destyle. 15s.
q quit · s stop · b reboot · g git pull+reboot · r refresh

macOS libmalloc may print MallocStackLogging on Python start. That is not a
hop fault. Launchers unset the env (never =0 — that *is* the trigger) and
drop the line on fd 2. quiet_mac_malloc() is a second filter for late writes.
"""
from __future__ import annotations

import json
import os
import select
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
from pathlib import Path

FOG = Path(os.environ.get("FOG_HOME") or (Path.home() / "StrataMesh/fog"))
LAUNCH = Path.home() / "Library/LaunchAgents"
REPO = FOG / "repo"
INTERVAL = 15
ACC = "\033[38;2;196;165;116m"
FG = "\033[38;2;232;230;227m"
MUT = "\033[38;2;138;135;128m"
OK = "\033[38;2;122;168;116m"
BAD = "\033[38;2;196;92;84m"
RST = "\033[0m"
TEAL = ACC
DIM = MUT
UID = os.getuid()
FOG_LABELS = ("pt.calhegasmorais.fog", "pt.calhegasmorais.workerd")

# libmalloc knobs. Pop them. Never export MallocStackLogging=0.
MAC_MALLOC_ENV = (
    "MallocStackLogging",
    "MallocStackLoggingNoCompact",
    "MallocStackLoggingDirectory",
    "MallocScribble",
    "MallocGuardEdges",
    "MallocNanoZone",
)


def is_mac_malloc_noise(line: str) -> bool:
    s = (line or "").lower()
    if "mallocstacklogging" not in s and "malloc stack logging" not in s:
        return False
    return (
        "can't turn off" in s
        or "cannot turn off" in s
        or "not enabled" in s
        or "was not enabled" in s
    )


def quiet_mac_malloc() -> None:
    """Drop macOS libmalloc chatter.

    C writes the line to fd 2 during (and after) interpreter init. Wrapping
    sys.stderr is not enough. Setting MallocStackLogging=0 *prints* the line.
    Launchers unset + grep -v; this pump catches late writes. Idempotent.
    Set FOG_TUI_KEEP_STDERR=1 to skip the dup2 (tests).
    """
    for k in MAC_MALLOC_ENV:
        os.environ.pop(k, None)
    if getattr(quiet_mac_malloc, "_installed", False):
        return
    if os.environ.get("FOG_TUI_KEEP_STDERR", "").strip().lower() in ("1", "true", "yes"):
        return
    try:
        orig_fd = os.dup(2)
        r_fd, w_fd = os.pipe()
        os.dup2(w_fd, 2)
        os.close(w_fd)
    except OSError:
        return

    def _pump() -> None:
        buf = b""
        try:
            while True:
                chunk = os.read(r_fd, 4096)
                if not chunk:
                    break
                buf += chunk
                while b"\n" in buf:
                    raw, buf = buf.split(b"\n", 1)
                    text = raw.decode("utf-8", "replace")
                    if is_mac_malloc_noise(text):
                        continue
                    try:
                        os.write(orig_fd, raw + b"\n")
                    except OSError:
                        return
            if buf and not is_mac_malloc_noise(buf.decode("utf-8", "replace")):
                try:
                    os.write(orig_fd, buf)
                except OSError:
                    return
        except Exception:
            pass
        finally:
            try:
                os.close(r_fd)
            except OSError:
                pass

    threading.Thread(target=_pump, name="fog-tui-stderr", daemon=True).start()
    quiet_mac_malloc._installed = True  # type: ignore[attr-defined]


def sh(args: list[str], timeout: float = 2.0) -> str:
    try:
        return subprocess.check_output(args, text=True, stderr=subprocess.DEVNULL, timeout=timeout)
    except Exception:
        return ""


def get(url: str, timeout: float = 2.0) -> dict:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "fog-tui/8"})
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


def awake_line() -> str:
    out = sh(["pmset", "-g", "assertions"])
    if "caffeinate" in out.lower() and "PreventUserIdleSystemSleep" in out:
        return OK + "caffeinate" + RST + DIM + " idle-sleep held" + RST
    return DIM + "idle-sleep possible · run FogStayAwake.command" + RST


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
    copied = []
    tui_src = repo / "deploy/mac-fog/fog-tui.py"
    tui_dst = FOG / "bin/fog-tui.py"
    if tui_src.is_file():
        tui_dst.parent.mkdir(parents=True, exist_ok=True)
        tui_dst.write_bytes(tui_src.read_bytes())
        copied.append("tui copied")
    cmd_src = repo / "deploy/mac-fog/FogRuntime.command"
    cmd_dst = FOG / "bin/FogRuntime.command"
    if cmd_src.is_file():
        cmd_dst.write_bytes(cmd_src.read_bytes())
        try:
            cmd_dst.chmod(0o755)
        except OSError:
            pass
        copied.append("runtime.command copied")
    extra = (" " + " · ".join(copied)) if copied else ""
    return ("pull %s | %s" % (pull.strip()[:80] or fetch.strip()[:40] or "ok", reboot_fog())) + extra


def mark(ok: bool) -> str:
    return OK + "LIVE" + RST if ok else BAD + "DOWN" + RST


def yn(v) -> str:
    return (OK + "true" + RST) if v else (BAD + "false" + RST)


def draw(msg: str = "") -> None:
    hop = get("http://127.0.0.1:8788/health")
    st = get("http://127.0.0.1:8787/status")
    pub = get("https://fog.calhegasmorais.pt/health", timeout=3.0)
    edge = get("https://edge.calhegasmorais.pt/health", timeout=3.0)
    met = get("http://127.0.0.1:8788/metabol")
    if not met.get("ok") or met.get("pace") is None:
        cfm = get("https://status.calhegasmorais.pt/metabol", timeout=3.0)
        if cfm.get("ok"):
            met = dict(cfm)
            met["cf"] = cfm
    if met.get("ok"):
        try:
            reqm = urllib.request.Request(
                "http://127.0.0.1:8788/metabol/consume",
                data=json.dumps({
                    "cost": 0.05,
                    "node_id": (st.get("node_id") or hop.get("node_id") or "FOG-NODE-PT-CM-001"),
                    "persist": False,
                }).encode(),
                method="POST",
                headers={"Content-Type": "application/json", "User-Agent": "fog-tui/8"},
            )
            with urllib.request.urlopen(reqm, timeout=2.0) as rm:
                met = json.loads(rm.read().decode())
        except Exception:
            pass
    wr = st.get("workerd") if isinstance(st.get("workerd"), dict) else {}
    dag = st.get("dag") if isinstance(st.get("dag"), dict) else {}
    spa = st.get("spa") if isinstance(st.get("spa"), dict) else {}
    tok = st.get("token") if isinstance(st.get("token"), dict) else {}
    cons = st.get("consensus") if isinstance(st.get("consensus"), dict) else {}
    prov = st.get("mesh_provision") if isinstance(st.get("mesh_provision"), dict) else {}
    sub = st.get("subsistence") if isinstance(st.get("subsistence"), dict) else {}
    contrib = st.get("contribution") if isinstance(st.get("contribution"), dict) else {}
    keep = st.get("keepup") if isinstance(st.get("keepup"), dict) else {}
    rails = st.get("rails") if isinstance(st.get("rails"), dict) else {}
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
    cols = min(76, shutil.get_terminal_size((76, 24)).columns)
    rule = MUT + "─" * cols + RST
    nid = st.get("node_id") or os.environ.get("FOG_NODE_ID") or "—"

    sys.stdout.write("\033[H\033[J")
    print(ACC + " STRATAMESH" + RST + FG + " LAB" + RST,
          MUT + "v0.3.0" + RST, DIM + time.strftime("%H:%M:%S") + RST, mark(live))
    print(FG + " Fog Node" + RST, ACC + str(nid) + RST)
    print(MUT + " Intelligentia · Vigilantia · Veritas" + RST)
    print(MUT + " shared web3 metaverse OS · lab · not mainnet" + RST)
    print(rule)
    print(ACC + " identity" + RST)
    print("   origin ", ACC + str(origin) + RST, MUT + str(hop.get("layer") or "") + RST,
          "  mac_live", yn(hop.get("mac_live") or st.get("mac_live")),
          "  trusted", yn(st.get("trusted") if "trusted" in st else hop.get("trusted")))
    print("   mesh   ", "n=%s" % n, "  f_max=%s" % fmax, "  member=%s" % member, "  oracle=%s" % st.get("oracle_live"))
    print("   ver    ", MUT + str(st.get("version") or "0.3.0") + RST, "  up", ago(st.get("uptime_seconds")))
    print(rule)
    print(ACC + " origin hop" + RST)
    print("   workerd :8788", mark(hop.get("ok") is True),
          "   fog :8787", mark(st.get("status") == "operational"),
          "   plugin", wr.get("reboots", 0), "reboots")
    print("   public   ", mark(bool(pub.get("ok"))),
          MUT + "origin=" + str(pub.get("origin") or "—") + RST)
    print(rule)
    print(ACC + " STRATA" + RST)
    height = dag.get("height")
    if height is None:
        height = dag.get("max_height")
    if height is None:
        height = max(0, int(dag.get("transaction_count") or 0) - max(0, int(dag.get("tip_count") or 0) - 1))
    print("   dag    tx=%s  tips=%s  height=%s" % (
        dag.get("transaction_count") or 0, dag.get("tip_count") or 0, height))
    supply = tok.get("total_supply")
    projected = rails.get("pending_poc") if isinstance(rails, dict) else None
    print("   spa    total=%s  active=%s   supply %s  projected=%s" % (
        spa.get("total") or 0, spa.get("active") or 0, supply if supply is not None else 0,
        projected if projected is not None else 0))
    md = met.get("decision") or (met.get("cf") or {}).get("decision") or "—"
    pace = met.get("pace") if met.get("pace") is not None else (met.get("cf") or {}).get("pace")
    burn = met.get("burn_rate") or met.get("adjusted") or (met.get("cf") or {}).get("burn_rate")
    rem = met.get("remaining") if met.get("remaining") is not None else (met.get("cf") or {}).get("remaining")
    print("   metabol", md, " pace=%s" % (None if pace is None else round(float(pace), 3)),
          " burn=%s" % (None if burn is None else round(float(burn), 3)),
          " rem=%s" % rem, MUT + "via :8788→CF" + RST)
    print(MUT + "   PoC resources → #mint · use → #0 · not a public offer" + RST)
    last = (keep.get("last") or {}) if keep else {}
    print("   keep-up Q=%.3f  K=%.3f  S=%.3f  %s" % (
        float(last.get("quantity") or keep.get("quantity_sum") or 0),
        float(last.get("quality") or keep.get("quality_mean") or 0),
        float(last.get("score") or keep.get("score_ema") or 0),
        (OK + "admissible" + RST) if last.get("admissible") else (MUT + "measuring" + RST),
    ))
    ping = (keep.get("ping") or st.get("ping") or {})
    lastp = ping.get("last") if isinstance(ping, dict) else {}
    wrp = lastp.get("workerd") if isinstance(lastp, dict) else None
    print("   ping   workerd", mark(bool(wrp and wrp.get("ok"))) if wrp else MUT + "—" + RST,
          "  rtt", MUT + str((wrp or {}).get("rtt_ms") or ping.get("rtt_ema_ms") or "—") + "ms" + RST)
    if rails:
        print("   rails  mint_armed=%s  burn_armed=%s  pending_poc=%s" % (
            rails.get("mint_armed"), rails.get("burn_armed"), rails.get("pending_poc")))
    accepted = contrib.get("accepted")
    if accepted is None:
        accepted = contrib.get("events")
    if accepted is None:
        accepted = 0
    pending = contrib.get("pending")
    if pending is None:
        pending = rails.get("pending_poc") if isinstance(rails, dict) else 0
    print("   poc    accepted=%s  pending=%s" % (accepted, pending))
    surplus = float(sub.get("surplus") or 0)
    reserve = float(sub.get("reserve") or 0)
    tau = float(sub.get("tau") or 0)
    meter = sub.get("meter") if isinstance(sub.get("meter"), dict) else {}
    consumed = float(meter.get("consumed_total") or 0)
    earned = float(meter.get("earned_total") or 0)
    pressure = sub.get("pressure")
    if pressure is None:
        pressure = round(consumed / max(earned + reserve, 1e-9), 6)
    debt = sub.get("debt")
    if debt is None:
        debt = round(max(0.0, tau - surplus), 6)
    print("   subsist pressure=%s  debt=%s  surplus=%s  reserve=%s" % (
        pressure, debt, round(surplus, 4), reserve))
    print(rule)
    print(ACC + " host" + RST)
    print("  ", brand, MUT + "ncpu=" + ncpu + RST)
    print("   load  %.2f  %.2f  %.2f" % load)
    print("   mem   free", gb(free), "  active", gb(active), "  wired", gb(wired))
    print("   rss   workerd", kb(wd_rss), "  python3", kb(py_rss), "  cloudflared", kb(cf_rss))
    print("   disk ", dsk, MUT + dsk_path + RST)
    print("   net  ", net())
    print("   git  ", git_sha(), "  awake", awake_line())
    print(rule)
    print("  " + ACC + "q" + RST + " quit   "
          + ACC + "s" + RST + " stop   "
          + ACC + "b" + RST + " reboot   "
          + ACC + "g" + RST + " pull+reboot   "
          + ACC + "r" + RST + " refresh")
    print(MUT + "  15s · reboot does not kill the public named-tunnel" + RST)
    if msg:
        print("  " + ACC + msg + RST)
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
    quiet_mac_malloc()
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
