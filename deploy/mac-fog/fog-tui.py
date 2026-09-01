#!/usr/bin/env python3
"""StrataMesh LAB Fog instrument v0.5.1-lab.
Cell-grid panels. q quit · s stop · b reboot · g update · r refresh

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
INTERVAL = 60
from collections import deque
Q_HIST: deque = deque(maxlen=15)
BURN_HIST: deque = deque(maxlen=15)
RTT_HIST: deque = deque(maxlen=15)
LOAD_HIST: deque = deque(maxlen=16)
HELP = False
FOCUS = 0
FRAME = 0
_PRINT = print
try:
    DEV_TTY = open("/dev/tty", "w", encoding="utf-8", errors="replace")
except Exception:
    DEV_TTY = sys.stdout



def spark(vals) -> str:
    """Braille 2x4 sparkline — Apple Terminal.app safe. No Kitty/Sixel."""
    xs = [float(v) for v in vals if v is not None]
    if len(xs) < 2:
        bars = "▁▂▃▄▅▆▇█"
        if not xs:
            return "·" * 8
        return bars[min(7, int(xs[-1] * 7))] * 8
    lo, hi = min(xs), max(xs)
    span = (hi - lo) or 1.0
    # left/right columns of a Braille cell, height 0..4 (bottom-up)
    left = (0x00, 0x40, 0x44, 0x46, 0x47)
    right = (0x00, 0x80, 0xA0, 0xB0, 0xB8)
    if len(xs) % 2:
        xs = xs[-16:] if len(xs) > 16 else xs
        if len(xs) % 2:
            xs = [xs[0]] + xs
    out = []
    for i in range(0, len(xs), 2):
        h0 = min(4, int(round((xs[i] - lo) / span * 4)))
        h1 = min(4, int(round((xs[i + 1] - lo) / span * 4)))
        out.append(chr(0x2800 + left[h0] + right[h1]))
    return "".join(out[-12:])

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
    """Capacity from /bin/df -kP /, same number as the Terminal."""
    try:
        out = sh(["/bin/df", "-kP", "/"])
        line = [ln for ln in out.splitlines() if ln.strip()][-1]
        parts = line.split()
        used_k, avail_k, cap = int(parts[2]), int(parts[3]), parts[4]
        total = (used_k + avail_k) * 1024
        used = used_k * 1024
        return "%s / %s (%s)" % (gb(used), gb(total), cap), "/"
    except Exception:
        return "—", "/"


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
    try:
        import sys
        repo = REPO if (REPO / "src").exists() else Path.home() / "StrataMesh/fog/repo"
        src = repo / "src"
        if str(src) not in sys.path:
            sys.path.insert(0, str(src))
        from fog_plugins.tmp_sweep import sweep
        sw = sweep(FOG)
        notes.append("sweep %s files %sB" % (sw.get("removed"), sw.get("bytes")))
    except Exception as e:
        notes.append("sweep skip")
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
    fetch = sh(["git", "-C", str(repo), "fetch", "origin", "main"], timeout=30)
    pull = sh(["git", "-C", str(repo), "reset", "--hard", "origin/main"], timeout=30)
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
    fog_rc = reboot_fog()
    # this process still holds the old draw(); replace it with the copied TUI
    dst = FOG / "bin/fog-tui.py"
    if dst.is_file():
        os.execv(sys.executable, [sys.executable, str(dst)])
    return ("pull %s | %s" % (pull.strip()[:80] or fetch.strip()[:40] or "ok", fog_rc)) + extra


def mark(ok: bool) -> str:
    return OK + "LIVE" + RST if ok else BAD + "DOWN" + RST


def yn(v) -> str:
    return (OK + "true" + RST) if v else (BAD + "false" + RST)


def vislen(s: str) -> int:
    n = 0
    i = 0
    while i < len(s):
        if s.startswith("\033", i):
            j = s.find("m", i)
            i = j + 1 if j >= 0 else i + 1
            continue
        n += 1
        i += 1
    return n


def boxline(inner: str, width: int) -> str:
    pad = width - vislen(inner)
    if pad < 0:
        inner = inner[:width]
        pad = max(0, width - vislen(inner))
    return "│" + inner + (" " * pad) + "│"


def draw(msg: str = "") -> None:
    global FRAME
    FRAME += 1
    def print(*a, **k):  # noqa: shadow — instrument goes to /dev/tty
        k.setdefault("file", DEV_TTY)
        return _PRINT(*a, **k)
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
    if (n in (None, 1)) and (st.get("mesh_member") or hop.get("mac_live")):
        n = 2
        member = True
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
    origin = st.get("origin") or wr.get("origin") or hop.get("origin") or "?"
    if origin == "session" and (st.get("mac_live") or wr.get("mac_live")):
        origin = "macbook"
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

    cap = st.get("host_cap") if isinstance(st.get("host_cap"), dict) else {}
    try:
        LOAD_HIST.append(float(load[0]))
    except Exception:
        pass
    pyh = get("http://127.0.0.1:8790/health", timeout=0.8)
    ndh = get("http://127.0.0.1:8791/health", timeout=0.8)
    cols, rows = shutil.get_terminal_size((88, 28))
    cols = max(72, min(int(cols), 120))

    def lamp(ok: bool) -> str:
        return (OK + "●" + RST) if ok else (MUT + "○" + RST)

    def bar(frac, width: int = 14) -> str:
        try:
            f = max(0.0, min(1.0, float(frac)))
        except Exception:
            f = 0.0
        n = int(round(f * width))
        return ("█" * n) + ("░" * (width - n))

    def row(*parts: str) -> None:
        print("".join(parts))

    height = dag.get("height") or dag.get("max_height") or 0
    txs = dag.get("tx") or dag.get("count") or 0
    tips = dag.get("tips") or dag.get("tip_count") or 0
    pending = rails.get("pending_poc") or keep.get("pending_poc") or 0
    mint = bool(rails.get("mint_armed"))
    burn = bool(rails.get("burn_armed"))
    waiver = bool(rails.get("lab_waived"))
    oracle = bool(st.get("oracle_live") or hop.get("oracle_live"))
    over = bool(cap.get("over"))
    pub_ok = bool(pub.get("ok"))
    hop_ok = hop.get("ok") is True
    fog_ok = st.get("status") == "operational"
    decision = "HOLD" if over else "LIVE"
    if not hop_ok or not fog_ok:
        decision = "DEGRADED"
    if not pub_ok:
        decision = "PUBLIC?"

    top = "╭" + "─" * (cols - 2) + "╮"
    bot = "╰" + "─" * (cols - 2) + "╯"
    mid = "├" + "─" * (cols - 2) + "┤"
    print(top)
    clock = time.strftime("%H:%M:%S")
    dec = met.get("decision")
    if not dec and isinstance(met.get("cf"), dict):
        dec = met.get("cf").get("decision")
    dec = dec or "—"
    w = max(40, cols - 2)
    lw = 30
    rw = max(16, w - lw - 1)

    def L(s: str) -> str:
        pad = lw - vislen(s)
        return s + (" " * max(0, pad))

    def R(s: str) -> str:
        pad = rw - vislen(s)
        return s + (" " * max(0, pad))

    def pair(a: str, b: str) -> None:
        print(boxline(L(a) + "│" + R(b), w))

    print(top)
    print(boxline(" " + ACC + "STRATAMESH" + RST + "  " + clock + MUT + "  v0.5.1-lab" + RST
                  + "  " + lamp(decision == "LIVE") + " " + decision, w))
    print(boxline(" " + str(nid) + MUT + "  " + RST + str(origin)
                  + MUT + "  n=" + RST + str(n)
                  + MUT + "  member=" + RST + str(bool(member)), w))
    print(mid)
    pair(" " + ACC + "HOP" + RST, " " + ACC + "STRATA" + RST)
    pair(" " + lamp(hop_ok) + " workerd  :8788", " dag   tx=%s  tip=%s  h=%s" % (txs, tips, height))
    pair(" " + lamp(fog_ok) + " fog      :8787", " PoC   " + bar(min(float(pending or 0) / 40.0, 1.0), 12) + " " + str(pending)[:8])
    pair(" " + lamp(bool(pyh.get("ok"))) + " python   :8790", " spa   %s / %s" % (spa.get("active") or 0, spa.get("total") or 0))
    pair(" " + lamp(bool(ndh.get("ok"))) + " node     :8791", " meta  %s  pace=%s" % (dec, met.get("pace") or "—"))
    pair(" " + lamp(pub_ok) + " public   " + str(pub.get("origin") or "—"),
         " plus  " + str((sub.get("surplus") if isinstance(sub, dict) else None) or "—"))
    print(mid)
    print(boxline(" " + ACC + "PROTOCOL" + RST + "  "
                  + lamp(oracle) + " oracle  "
                  + lamp(mint) + " mint  "
                  + lamp(burn) + " burn  "
                  + lamp(waiver) + " lab_waived", w))
    print(boxline(" " + MUT + "mint/burn locked until oracle_live · n=2 f_max=0" + RST, w))
    print(mid)
    load_frac = 0.0
    try:
        load_frac = float(load[0]) / max(float(ncpu or 1), 1.0)
    except Exception:
        pass
    print(boxline(" " + ACC + "HOST" + RST + "  cap 60%  "
                  + ("HOLD " + str(cap.get("reason") or "") if over else "ok")
                  + "  " + spark(LOAD_HIST), w))
    print(boxline("  CPU " + bar(min(load_frac, 1.0), 14) + "  %.2f  %.2f  %.2f" % load, w))
    print(boxline("  MEM free %s   act %s   wired %s" % (gb(free), gb(active), gb(wired)), w))
    print(boxline("  RSS wrk %s   py %s   cf %s" % (kb(wd_rss), kb(py_rss), kb(cf_rss)), w))
    print(boxline("  DSK " + dsk + "  " + dsk_path, w))
    print(boxline("  NET " + net(), w))
    print(boxline("  GIT " + git_sha() + "  " + awake_line(), w))
    print(bot)
    print("  " + ACC + "q" + RST + " quit   "
          + ACC + "s" + RST + " stop   "
          + ACC + "b" + RST + " reboot   "
          + ACC + "g" + RST + " update   "
          + ACC + "r" + RST + " refresh   "
          + ACC + "?" + RST + " help")
    print(MUT + "  instrument · 60s · named-tunnel stays up" + RST)

    if HELP:
        print(MUT + "  q UI only · s fog plugin · b workerd+fog · g reset origin/main + exec TUI" + RST)
        print(MUT + "  never pkill cloudflared · STRATA mint waits for oracle_live" + RST)
    if msg:
        print("  " + ACC + msg + RST)
    sys.stdout.write("")
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
    global HELP, FOCUS
    quiet_mac_malloc()
    DEV_TTY.write("\033[?1049h\033[2J\033[H\033[?25l")
    DEV_TTY.flush()
    msg = ""
    try:
        while True:
            try:
                draw(msg)
            except Exception as e:
                print("\nTUI draw", type(e).__name__, e)
                sys.stdout.flush()
            msg = ""
            ch = wait_key(INTERVAL)
            if not ch:
                continue
            if ch in ("q", "Q", "\x1b"):
                return 0
            if ch in ("r", "R"):
                continue
            if ch == "?":
                HELP = not HELP
                continue
            if ch in ("1", "2", "3", "4"):
                FOCUS = int(ch)
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
        DEV_TTY.write("\033[?25h\033[?1049l")
        DEV_TTY.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
