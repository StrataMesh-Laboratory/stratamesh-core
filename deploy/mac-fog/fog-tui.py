#!/usr/bin/env python3
"""StrataMesh LAB Fog instrument v0.5.1-lab.
Cell-grid panels. q quit · s stop · b reboot · g update · r refresh · ? wizard
TAB clears wizard chat only (not r / 60s redraw). Local Ollama :11434 (llama3.2:1b). FAQ from public docs if generate is waking. Report via Orchestrator to AIOps (fail-open).

macOS libmalloc may print MallocStackLogging on Python start. That is not a
hop fault. Launchers unset the env (never =0 — that *is* the trigger) and
drop the line on fd 2. quiet_mac_malloc() is a second filter for late writes.
"""
from __future__ import annotations

import json
import os
import re
import select
import shutil
import subprocess
import sys
import threading
import time
import unicodedata
import urllib.error
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
HOP_LIVE_HIST: dict = {
    8787: deque(maxlen=16),
    8788: deque(maxlen=16),
    8790: deque(maxlen=16),
    8791: deque(maxlen=16),
    8792: deque(maxlen=16),
}
HELP = False
G_MSG = ""
FOCUS = 0
FRAME = 0
WIZARD_LOG: list[dict] = []
WIZARD_INPUT = ""
WIZARD_BUSY = False
WIZARD_SNAP: dict = {}
_WIZARD_LOCK = threading.Lock()
WIZARD_VIEW = 8
WIZARD_MAX = 80
# g/r/s/b/q stay dashboard keys even while HELP. Composer does not swallow them.
WIZARD_RESERVED = frozenset("gGsSbBqQrR")
COMPOSER_ROW = 0  # 1-based row of "> " prompt; paint_composer only
DRAW_ROW = 1
LOCAL_HTTP_TIMEOUT = 0.3
PUB_CACHE: dict = {}
EDGE_CACHE: dict = {}
PUB_LAST_GOOD: dict = {}
EDGE_LAST_GOOD: dict = {}
PUB_FAILS = 0
EDGE_FAILS = 0
PUB_HOLD_SEC = 300.0
PUB_DARK_STREAK = 3
PUB_PROBE_PERIOD = 15.0
PUB_HTTP_TIMEOUT = 1.2
_PUB_LAST_KICK = 0.0
MET_CF_CACHE: dict = {"ok": False}  # never filled from TUI (no status.calhegasmorais.pt)
_PUB_LOCK = threading.Lock()
_PUB_BUSY = False
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


def hop_spark(vals) -> str:
    """Hop live/dark TIME HISTORY (HOP_LIVE_HIST), not a capacity fill bar.

    1.0 → ':' tick (Apple Terminal.app safe; not U+28FF). 0.0 → '.' gap, same
    column so a hole is visible. Always-live → a row of ticks. Never min-max
    (that blanked always-up). Never bar(frac)/█ fill. HOST LOAD_HIST keeps spark().
    Length 8–12.
    """
    xs = [1.0 if v else 0.0 for v in vals if v is not None]
    if not xs:
        return "." * 8
    xs = list(xs)[-12:]
    if len(xs) < 8:
        xs = [0.0] * (8 - len(xs)) + xs
    return "".join(":" if v else "." for v in xs)


def use_color() -> bool:
    """Fail-open: no color when TERM=dumb or NO_COLOR. No extra deps."""
    if os.environ.get("NO_COLOR"):
        return False
    return (os.environ.get("TERM") or "").strip().lower() != "dumb"


def _palette() -> None:
    global ACC, FG, MUT, OK, BAD, RST, TEAL, DIM, BOLD, AMBER, REV, BRIGHT_OK
    if use_color():
        ACC = "\033[38;2;196;165;116m"
        FG = "\033[38;2;232;230;227m"
        MUT = "\033[38;2;138;135;128m"
        OK = "\033[92m"
        BAD = "\033[91m"
        RST = "\033[0m"
        BOLD = "\033[1m"
        AMBER = "\033[38;2;218;165;32m"
        REV = "\033[7m"
        BRIGHT_OK = OK
    else:
        ACC = FG = MUT = OK = BAD = RST = BOLD = AMBER = REV = BRIGHT_OK = ""
    TEAL = ACC
    DIM = MUT


ACC = FG = MUT = OK = BAD = RST = TEAL = DIM = BOLD = AMBER = REV = BRIGHT_OK = ""
_palette()
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


def is_local_instrument_url(url: str) -> bool:
    u = (url or "").lower()
    return u.startswith("http://127.0.0.1:") or u.startswith("http://localhost:")


def public_http_ok(d) -> bool:
    """True when the public/edge probe got HTTP 200 JSON (transport, not app flags).

    origin=session + n=1 + mac_live=false is a session flag, not a dark lamp.
    Timeout / URLError shapes from get() are False.
    """
    if not isinstance(d, dict) or not d:
        return False
    if d.get("origin") is not None:
        return True
    if d.get("ok") is True:
        return True
    if d.get("ok") is False and d.get("error"):
        return False
    return "error" not in d


def apply_public_result(raw: dict, which: str = "pub") -> dict:
    """Hysteresis: 1 success -> live. Last-good JSON held >=5 min.
    A single HTTPS timeout with last_good does not increment PUB_FAILS and
    does not force _lamp False (hairpin/NAT). PUB_DARK_STREAK is annotation
    only. MESH public row follows local workerd hop_ok, not this _lamp.
    """
    global PUB_FAILS, EDGE_FAILS
    now = time.monotonic()
    raw = raw if isinstance(raw, dict) else {"ok": False, "error": "bad"}
    ok = public_http_ok(raw)
    with _PUB_LOCK:
        if which == "edge":
            cache, last_good = EDGE_CACHE, EDGE_LAST_GOOD
        else:
            cache, last_good = PUB_CACHE, PUB_LAST_GOOD
        if ok:
            if which == "edge":
                EDGE_FAILS = 0
            else:
                PUB_FAILS = 0
            snap = {k: raw[k] for k in raw if not str(k).startswith("_")}
            snap["_good_at"] = now
            last_good.clear()
            last_good.update(snap)
            cache.clear()
            cache.update(snap)
            cache["_lamp"] = True
            cache["_annot_fails"] = 0
            return dict(cache)
        g_busy = "g running" in (G_MSG or "")
        if which != "edge" and (last_good or g_busy):
            # Hairpin timeout / g recycle: probe optional. Do not increment
            # PUB_FAILS. Do not force _lamp False while last_good exists.
            paint = dict(last_good) if last_good else dict(raw)
            annot = int(cache.get("_annot_fails") or 0)
            if last_good and not g_busy:
                annot += 1
            cache.clear()
            cache.update(paint)
            cache["_annot_fails"] = annot
            cache["_lamp"] = bool(last_good)
            # annotation only — streak does not hollow the MESH row (draw uses hop_ok)
            cache["_annot_dark"] = bool(last_good) and annot >= PUB_DARK_STREAK
            if last_good and last_good.get("origin") is not None:
                cache["origin"] = last_good.get("origin")
                if "n" in last_good:
                    cache["n"] = last_good["n"]
                if "mac_live" in last_good:
                    cache["mac_live"] = last_good["mac_live"]
            return dict(cache)
        if which == "edge":
            EDGE_FAILS += 1
            fails = EDGE_FAILS
        else:
            PUB_FAILS += 1
            fails = PUB_FAILS
        lamp = bool(last_good) and fails < PUB_DARK_STREAK
        paint = dict(last_good) if last_good else dict(raw)
        cache.clear()
        cache.update(paint)
        cache["_lamp"] = lamp
        if last_good and last_good.get("origin") is not None:
            cache["origin"] = last_good.get("origin")
            if "n" in last_good:
                cache["n"] = last_good["n"]
            if "mac_live" in last_good:
                cache["mac_live"] = last_good["mac_live"]
        return dict(cache)


def local_decision(hop_ok: bool, fog_ok: bool, metabol_decision: str | None = None) -> str:
    """Header LIVE/HOLD/DEGRADED from hops + metabol decide(), not host_cap.over()."""
    if not hop_ok or not fog_ok:
        return "DEGRADED"
    d = str(metabol_decision or "").strip().upper()
    if d in ("HOLD", "STASIS"):
        return "HOLD"
    return "LIVE"


def pub_origin_label(pub: dict) -> str:
    o = (pub or {}).get("origin")
    if o:
        return str(o)
    with _PUB_LOCK:
        o = PUB_LAST_GOOD.get("origin")
    return str(o) if o else "—"


def kick_public_refresh() -> None:
    """Fog/edge /health in a daemon thread. Never blocks draw(). Never hits CF status.
    Timeout 1.2s, period >=15s. Never inline in draw().
    """
    global _PUB_BUSY, _PUB_LAST_KICK
    if _PUB_BUSY:
        return
    now = time.monotonic()
    if _PUB_LAST_KICK and (now - _PUB_LAST_KICK) < PUB_PROBE_PERIOD:
        return

    def _run() -> None:
        global _PUB_BUSY
        try:
            pub = get("https://fog.calhegasmorais.pt/health", timeout=PUB_HTTP_TIMEOUT)
            edge = get("https://edge.calhegasmorais.pt/health", timeout=PUB_HTTP_TIMEOUT)
            if not isinstance(pub, dict):
                pub = {"ok": False, "error": "bad"}
            if not isinstance(edge, dict):
                edge = {"ok": False, "error": "bad"}
            if "g running" in (G_MSG or "") and not public_http_ok(pub):
                pass  # probe optional while g running; do not increment fails
            else:
                apply_public_result(pub, "pub")
            apply_public_result(edge, "edge")
        except Exception:
            pass
        finally:
            _PUB_BUSY = False

    _PUB_LAST_KICK = now
    _PUB_BUSY = True
    threading.Thread(target=_run, name="fog-tui-pub", daemon=True).start()



def pids_rss_table(names: tuple[str, ...] = ("workerd", "python3", "cloudflared")) -> dict[str, list[tuple[int, int]]]:
    """One `ps` for all RSS rows."""
    out = sh(["ps", "-axo", "pid=,rss=,comm="])
    want = set(names)
    rows: dict[str, list[tuple[int, int]]] = {n: [] for n in names}
    for line in out.splitlines():
        parts = line.split(None, 2)
        if len(parts) < 3:
            continue
        comm = Path(parts[2].strip()).name
        if comm not in want:
            continue
        try:
            rows[comm].append((int(parts[0]), int(parts[1])))
        except ValueError:
            continue
    return rows


def pids_rss(name: str) -> list[tuple[int, int]]:
    """(pid, rss_kb) for exact comm match. Prefer pids_rss_table in draw()."""
    return pids_rss_table((name,)).get(name, [])


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
    # Leftover python/node/deno on :8790-8792 keep /health 200 after git update.
    # SIGTERM them before launchctl so runtime-mesh _loop respawns from current files.
    try:
        repo = REPO if (REPO / "src").exists() else Path.home() / "StrataMesh/fog/repo"
        src = repo / "src"
        if str(src) not in sys.path:
            sys.path.insert(0, str(src))
        from fog_plugins.runtime_mesh import recycle_mw
        notes.append("mw recycle %s" % recycle_mw((8787, 8788, 8790, 8791, 8792)))
    except Exception:
        notes.append("mw recycle skip")
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


def stamp_manual_g() -> None:
    p = Path.home() / ".config/stratamesh/last-manual-g"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("%.3f\n" % time.time())


def sync_workerd_config() -> str:
    """Copy worker.js + config.capnp into FOG/workerd-config; rewrite ORIGIN."""
    repo = REPO if (REPO / "ops/workerd").exists() else Path.home() / "StrataMesh/fog/repo"
    src_js = repo / "ops/workerd/worker.js"
    src_cap = repo / "ops/workerd/config.capnp"
    dest = FOG / "workerd-config"
    dest.mkdir(parents=True, exist_ok=True)
    origin = (os.environ.get("FOG_ORIGIN") or "macbook").strip() or "macbook"
    notes = []
    if src_js.is_file():
        (dest / "worker.js").write_bytes(src_js.read_bytes())
        notes.append("worker.js")
    if src_cap.is_file():
        text = src_cap.read_text()
        for old in ("session", "macbook", "local", "edge"):
            needle = 'text = "%s"' % old
            if needle in text:
                text = text.replace(needle, 'text = "%s"' % origin, 1)
                break
        (dest / "config.capnp").write_text(text)
        notes.append("capnp origin=%s" % origin)
    tmp = Path("/tmp/sm-core/ops/workerd")
    if tmp.is_dir():
        if (dest / "worker.js").is_file():
            (tmp / "worker.js").write_bytes((dest / "worker.js").read_bytes())
        if (dest / "config.capnp").is_file():
            (tmp / "config.capnp").write_text((dest / "config.capnp").read_text())
        notes.append("tmp/sm-core")
    return "sync " + " · ".join(notes) if notes else "sync skip"


def _brew_env() -> dict:
    """Intel /usr/local and Apple Silicon /opt/homebrew on PATH for brew/node."""
    env = os.environ.copy()
    env["PATH"] = "/opt/homebrew/bin:/usr/local/bin:" + env.get("PATH", "")
    return env


def _which_brew_node(name: str):
    found = shutil.which(name)
    if found:
        return found
    for d in ("/opt/homebrew/bin", "/usr/local/bin"):
        cand = Path(d) / name
        try:
            if cand.is_file() and os.access(str(cand), os.X_OK):
                return str(cand)
        except OSError:
            continue
    return None


def _alias_missing_node_dylib(err: str) -> str:
    """Map dyld 'Library not loaded: /usr/local/opt/FORMULA/lib/libX.N.dylib' to Cellar."""
    import re
    m = re.search(r"Library not loaded:\s+(\S+\.dylib)", err or "")
    if not m:
        return ""
    wanted = Path(m.group(1))
    name = wanted.name  # libada.3.dylib
    stem = name.split(".")[0]  # libada
    # /usr/local/opt/ada-url/lib/...
    parts = wanted.parts
    formula = "llhttp"
    if "opt" in parts:
        try:
            formula = parts[parts.index("opt") + 1]
        except (ValueError, IndexError):
            pass
    sources = []
    for prefix in ("/usr/local", "/opt/homebrew"):
        optlib = Path(prefix) / "opt" / formula / "lib"
        if (optlib / (stem + ".dylib")).exists():
            sources.append(optlib / (stem + ".dylib"))
        sources.extend(sorted(optlib.glob(stem + ".*.dylib")))
        cellar = Path(prefix) / "Cellar" / formula
        if cellar.is_dir():
            sources.extend(sorted(cellar.glob("*/lib/" + stem + "*.dylib")))
    src = next((p for p in sources if p.exists() and p.name != name), None)
    src = src or next((p for p in sources if p.exists()), None)
    if not src:
        return "no source for %s" % name
    dest = Path("/usr/local/opt") / formula / "lib" / name
    if str(wanted).startswith("/opt/homebrew"):
        dest = Path("/opt/homebrew/opt") / formula / "lib" / name
    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.exists() or dest.is_symlink():
            dest.unlink()
        dest.symlink_to(src.resolve())
        return "link %s -> %s" % (src.name, dest)
    except OSError as e:
        return "link fail %s" % type(e).__name__


def _brew_clt_miss(text: str) -> bool:
    """True when brew failed because Xcode.app alone / missing CLT / xcode-select."""
    t = (text or "").lower()
    return (
        "xcode alone is not sufficient" in t
        or "xcode-select" in t
        or "command line tools" in t
    )


def brew_update_upgrade() -> str:
    """Non-fatal brew update then brew upgrade. Never --greedy. Never uninstall.
    Interactive g and auto-g both brew. If node -v fails (dyld/libllhttp),
    brew reinstall llhttp node (non-fatal). CLT / Xcode-alone failures set
    clt-miss skip-recycle so g does not recycle_mw healthy python/fog."""
    env = _brew_env()
    brew = _which_brew_node("brew")
    if not brew:
        return "brew missing"
    notes = []
    clt_miss = False
    for verb in ("update", "upgrade"):
        try:
            p = subprocess.run(
                [brew, verb],
                capture_output=True,
                text=True,
                timeout=300,
                env=env,
            )
            out = (p.stderr or "") + (p.stdout or "")
            notes.append("%s rc=%s" % (verb, p.returncode))
            if _brew_clt_miss(out):
                clt_miss = True
                notes.append("clt-miss")
        except Exception:
            notes.append("%s fail" % verb)
    node_bin = _which_brew_node("node") or "node"
    node_bad = False
    err = ""
    try:
        p = subprocess.run(
            [node_bin, "-v"],
            capture_output=True,
            text=True,
            timeout=15,
            env=env,
        )
        err = (p.stderr or "") + (p.stdout or "")
        node_bad = p.returncode != 0 or "dyld" in err.lower() or "library not loaded" in err.lower()
    except Exception:
        node_bad = True
        err = ""
    if node_bad and clt_miss:
        notes.append("skip reinstall (CLT miss)")
    elif node_bad:
        try:
            p = subprocess.run(
                [brew, "reinstall", "llhttp", "ada-url", "node"],
                capture_output=True,
                text=True,
                timeout=600,
                env=env,
            )
            out = (p.stderr or "") + (p.stdout or "")
            notes.append("reinstall llhttp ada-url node rc=%s" % p.returncode)
            if _brew_clt_miss(out):
                clt_miss = True
                notes.append("clt-miss")
        except Exception:
            notes.append("reinstall node deps fail")
        for _ in range(8):
            try:
                p = subprocess.run(
                    [node_bin, "-v"],
                    capture_output=True,
                    text=True,
                    timeout=15,
                    env=env,
                )
                err2 = (p.stderr or "") + (p.stdout or "")
            except Exception as e:
                err2 = str(e)
                p = None
            if p is not None and p.returncode == 0 and "dyld" not in err2.lower():
                notes.append("node " + err2.strip().split()[0][:16])
                break
            note = _alias_missing_node_dylib(err2 or err)
            notes.append(note or "dyld unparsed")
            if not note or note.startswith("no source") or note.startswith("link fail"):
                break
    if clt_miss:
        notes.append("skip-recycle")
    return "brew " + " · ".join(notes)


def runtime_mesh_last_error(st: dict | None = None) -> str:
    """Short runtime-mesh last_error for a dark node lamp. Never secrets."""
    st = st if isinstance(st, dict) else {}
    rm = st.get("runtime_mesh") if isinstance(st.get("runtime_mesh"), dict) else st
    if not isinstance(rm, dict):
        return ""
    if rm.get("plugin") not in (None, "runtime-mesh") and "last_error" not in rm:
        rm = st.get("runtime-mesh") if isinstance(st.get("runtime-mesh"), dict) else rm
    err = str(rm.get("last_error") or "").strip().replace("\n", " ").replace("\r", " ")
    if not err:
        return ""
    low = err.lower()
    if "ghp_" in low or "github_pat_" in low or "cfat_" in low or "bearer " in low:
        return "mw-node error"
    if len(err) > 72:
        err = err[:72]
    return err


def git_pull_reboot() -> str:
    stamp_manual_g()
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
    sync = sync_workerd_config()
    copied.append(sync)
    extra = (" " + " · ".join(copied)) if copied else ""
    # Interactive g and auto-g both brew. Off the paint thread (caller is fog-tui-g).
    brew_note = brew_update_upgrade()
    # CLT / Xcode-alone brew fail: keep pull/TUI copy; do not recycle_mw / kickstart-kill hops.
    if "clt-miss" in brew_note or "skip-recycle" in brew_note:
        fog_rc = "skip recycle (CLT miss)"
    else:
        fog_rc = reboot_fog()
    return ("pull %s | %s | %s" % (pull.strip()[:80] or fetch.strip()[:40] or "ok", brew_note, fog_rc)) + extra


def mark(ok: bool) -> str:
    if ok:
        return OK + "●" + RST + " " + BOLD + "LIVE" + RST
    return MUT + "○" + RST + " " + BAD + "DOWN" + RST


def yn(v) -> str:
    return (OK + "●" + RST) if v else (MUT + "○" + RST)


def vislen(s: str) -> int:
    """Visible columns: skip ANSI CSI and combining marks. Fullwidth = 2."""
    n = 0
    i = 0
    while i < len(s):
        if s.startswith("\033", i):
            j = s.find("m", i)
            i = j + 1 if j >= 0 else i + 1
            continue
        ch = s[i]
        if unicodedata.combining(ch):
            i += 1
            continue
        # █░ ambiguous/fullwidth in some locales; treat as 1. : . ticks too.
        if ch in ("█", "░", ":", "."):
            n += 1
        else:
            n += 2 if unicodedata.east_asian_width(ch) in ("F", "W") else 1
        i += 1
    return n


def boxline(inner: str, width: int) -> str:
    pad = width - vislen(inner)
    if pad < 0:
        out = []
        used = 0
        i = 0
        while i < len(inner) and used < width:
            if inner.startswith("\033", i):
                j = inner.find("m", i)
                j = j + 1 if j >= 0 else i + 1
                out.append(inner[i:j])
                i = j
                continue
            ch = inner[i]
            if unicodedata.combining(ch):
                out.append(ch)
                i += 1
                continue
            if ch in ("█", "░", ":", "."):
                wch = 1
            else:
                wch = 2 if unicodedata.east_asian_width(ch) in ("F", "W") else 1
            if used + wch > width:
                break
            out.append(ch)
            used += wch
            i += 1
        inner = "".join(out)
        pad = max(0, width - vislen(inner))
    return DIM + "│" + RST + inner + (" " * pad) + DIM + "│" + RST


def wizard_json_path() -> Path:
    return FOG / "data" / "tui-wizard.json"


def load_wizard_log() -> None:
    """Restore WIZARD_LOG from FOG/data/tui-wizard.json. Missing file = empty."""
    global WIZARD_LOG
    pth = wizard_json_path()
    try:
        raw = json.loads(pth.read_text(encoding="utf-8"))
        rows = raw if isinstance(raw, list) else raw.get("log") or []
        clean = []
        for rec in rows:
            if not isinstance(rec, dict):
                continue
            clean.append({
                "ts": str(rec.get("ts") or ""),
                "role": str(rec.get("role") or "sys"),
                "text": str(rec.get("text") or ""),
            })
        with _WIZARD_LOCK:
            WIZARD_LOG = clean[-WIZARD_MAX:]
    except Exception:
        with _WIZARD_LOCK:
            WIZARD_LOG = []


def save_wizard_log() -> None:
    pth = wizard_json_path()
    try:
        pth.parent.mkdir(parents=True, exist_ok=True)
        with _WIZARD_LOCK:
            payload = list(WIZARD_LOG[-WIZARD_MAX:])
        pth.write_text(json.dumps(payload, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    except Exception:
        pass


def wizard_append(role: str, text: str) -> None:
    rec = {
        "ts": time.strftime("%H:%M:%S"),
        "role": str(role or "sys"),
        "text": str(text or ""),
    }
    with _WIZARD_LOCK:
        WIZARD_LOG.append(rec)
        del WIZARD_LOG[:-WIZARD_MAX]
    save_wizard_log()


def wizard_clear() -> None:
    """TAB only. Does not quit. Does not recycle hops. Does not reboot."""
    global WIZARD_LOG, WIZARD_INPUT
    with _WIZARD_LOCK:
        WIZARD_LOG = []
        WIZARD_INPUT = ""
    pth = wizard_json_path()
    try:
        pth.unlink()
    except FileNotFoundError:
        pass
    except Exception:
        pass


def ollama_base() -> str:
    h = (os.environ.get("OLLAMA_HOST") or "http://127.0.0.1:11434").strip().rstrip("/")
    if not h:
        h = "http://127.0.0.1:11434"
    if "://" not in h:
        h = "http://" + h
    return h


WIZARD_SYSTEM = (
    "You are the Fog LAB smart wizard: dynamic FAQ improviser and troubleshooting reporter. "
    "Answer from CONTEXT PUBLIC DOCS first, then hop snapshot. "
    "Lab phase is Adversarial P1 at n=2 (f_max=0). Public hop ORIGIN=session with n=1 is a "
    "public-origin flag, not the lab phase. TUI HOLD is metabolic host_cap, not a CPU RCA. "
    "SCA (PT) and ACB (EN) name the same subject. Fog kernel is :8787; MW slots are "
    "workerd/python/node/deno (five hops). "
    "Never pkill cloudflared. Never origin-take. Never workers.dev. Never a 6th Cloudflare cron. "
    "Never secrets. Never PATCH STASIS=1. Never KeePass. Never mail tokens. "
    "You may emit lines ACTION:probe hops / ACTION:tail fog log / ACTION:suggest g / "
    "ACTION:suggest s / ACTION:suggest b / ACTION:report orch. Ask the operator before they press "
    "g/s/b; do not claim you executed them. End each diagnosis with a short FAQ answer and a "
    "one-line report for AIOps Dev Team via Orchestrator (no secrets)."
)

OLLAMA_GENERATE_TIMEOUT = 60.0
OLLAMA_PREFERRED = "llama3.2:1b"
WIZARD_DOCS = ""
WIZARD_DOCS_LOADED = False
WIZARD_DOCS_MAX = 7500
_WIZARD_WAKING_SAID = False
WIZARD_DOCS_SEED = (
    "Fog kernel listens on :8787. Middleware hops are workerd, python, node, and deno (five slots). "
    "SCA (PT) and ACB (EN) name the same subject. "
    "HOLD is metabolic host_cap, not a CPU RCA. "
    "Local Ollama answers the wizard; if it is down the FAQ is fail-open from public docs. "
    "Never pkill cloudflared. Never workers.dev. Never secrets."
)

_ACTION_DENY = (
    "pkill",
    "cloudflared",
    "workers.dev",
    "origin-take",
    "origin_take",
    "secret",
    "stasis",
    "kill -",
    "launchctl",
    "curl ",
    "wget ",
    "ssh ",
)


def wizard_action_allowed(spec: str) -> bool:
    s = (spec or "").strip().lower()
    if any(d in s for d in _ACTION_DENY):
        return False
    if s == "probe hops":
        return True
    if s == "tail fog log":
        return True
    if s in ("suggest g", "suggest s", "suggest b", "report orch"):
        return True
    return False


def parse_wizard_actions(text: str) -> list[str]:
    out = []
    for raw in (text or "").splitlines():
        m = re.match(r"^\s*ACTION:\s*(.+?)\s*$", raw, re.I)
        if m:
            out.append(m.group(1).strip())
    return out


def _safe_under_fog(path: Path) -> bool:
    try:
        fog = FOG.resolve()
        target = path.resolve()
        return target == fog or fog in target.parents
    except Exception:
        return False


def wizard_run_action(spec: str) -> tuple[str, str]:
    """Allowlist only. Never git_pull_reboot / stop_fog / reboot_fog."""
    s = (spec or "").strip()
    low = s.lower()
    if not wizard_action_allowed(s):
        note = "ACTION rejected: %s" % (s[:80] or "(empty)")
        wizard_append("sys", note)
        return "rejected", note
    if low == "probe hops":
        lines = []
        for port in (8788, 8787, 8790, 8791, 8792):
            h = get("http://127.0.0.1:%d/health" % port, timeout=1.5)
            ok = h.get("ok") is True or h.get("status") == "operational"
            err = str(h.get("error") or "")[:40]
            lines.append(":%d %s%s" % (port, "LIVE" if ok else "DOWN", (" " + err) if err and not ok else ""))
        note = "probe hops\n" + "\n".join(lines)
        wizard_append("sys", note)
        return "ok", note
    if low == "tail fog log":
        candidates = [
            FOG / "logs" / "fog.log",
            FOG / "log" / "fog.log",
            FOG / "fog.log",
            FOG / "data" / "fog.log",
        ]
        chosen = None
        for c in candidates:
            if c.is_file() and _safe_under_fog(c):
                chosen = c
                break
        if chosen is None:
            note = "tail fog log: no log under FOG_HOME"
            wizard_append("sys", note)
            return "ok", note
        try:
            data = chosen.read_text(encoding="utf-8", errors="replace").splitlines()[-40:]
            note = "tail %s\n%s" % (chosen.name, "\n".join(data) or "(empty)")
        except Exception as e:
            note = "tail fog log skip: %s" % type(e).__name__
        wizard_append("sys", note)
        return "ok", note
    if low.startswith("suggest "):
        k = low.split()[-1]
        names = {
            "g": "g (git pull + reboot) — wizard will not run it",
            "s": "s (stop fog) — wizard will not run it",
            "b": "b (reboot fog+workerd) — wizard will not run it",
        }
        note = "operator: press %s" % names.get(k, k)
        wizard_append("sys", note)
        return "ok", note
    if low == "report orch":
        note = orch_aiops_report("wizard ACTION:report orch", "operator asked report", dict(WIZARD_SNAP))
        wizard_append("sys", note)
        return "ok", note
    note = "ACTION rejected: %s" % s[:80]
    wizard_append("sys", note)
    return "rejected", note


def compact_wizard_context(snap: dict | None = None) -> str:
    d = snap if isinstance(snap, dict) else dict(WIZARD_SNAP)
    hops = d.get("hops") if isinstance(d.get("hops"), dict) else {}
    lamps = " ".join(
        "%s:%s" % (p, "●" if hops.get(p) else "○")
        for p in ("8788", "8787", "8790", "8791", "8792")
    )
    return (
        "git=%s hops=%s origin=%s mac_live=%s host_cap.over=%s last_msg=%s n=%s"
        % (
            d.get("git") or "—",
            lamps,
            d.get("origin") or "—",
            d.get("mac_live"),
            d.get("host_cap_over"),
            str(d.get("msg") or "")[:80],
            d.get("n"),
        )
    )


def ollama_tag_names(timeout: float = 2.0) -> list[str]:
    try:
        data = get(ollama_base() + "/api/tags", timeout=timeout)
        models = data.get("models") if isinstance(data, dict) else None
        if not models:
            return []
        names = []
        for m in models:
            if isinstance(m, dict):
                n = str(m.get("name") or m.get("model") or "").strip()
            else:
                n = str(m).strip()
            if n:
                names.append(n)
        return names
    except Exception:
        return []


def ollama_first_tag(timeout: float = 2.0) -> str:
    names = ollama_tag_names(timeout)
    return names[0] if names else ""


def ollama_preferred_tag(timeout: float = 2.0) -> str:
    """Prefer llama3.2:1b when listed; else first tag. Fail-open empty."""
    names = ollama_tag_names(timeout)
    if not names:
        return ""
    want = OLLAMA_PREFERRED
    for n in names:
        if n == want or n.startswith(want + "/") or n.split(":")[0:2] == want.split(":")[0:2] and n.startswith(want):
            return n
    for n in names:
        if n.split(":")[0] == "llama3.2" and ("1b" in n):
            return n
    return names[0]


def _wizard_history_text() -> str:
    with _WIZARD_LOCK:
        rows = list(WIZARD_LOG[-12:])
    lines = []
    for rec in rows:
        lines.append("%s: %s" % (rec.get("role"), (rec.get("text") or "")[:500]))
    return "\n".join(lines)


def ensure_ollama_daemon() -> bool:
    """Serve local Ollama if the binary exists. Never brew here (launcher does). Never block draw (caller is a thread)."""
    if ollama_first_tag(0.4):
        return True
    bin_ = shutil.which("ollama")
    if not bin_:
        return False
    try:
        subprocess.Popen([bin_, "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    except Exception:
        return False
    time.sleep(0.7)
    return bool(ollama_first_tag(0.8))


def _public_scrub(text: str) -> str:
    """Drop mail, tokens, workers.dev, KeePass. Never secrets."""
    keep = []
    for line in (text or "").splitlines():
        low = line.lower()
        if "workers.dev" in low or "keepass" in low:
            continue
        if re.search(r"\b(api[_-]?key|password\s*[=:]|authorization:)\b", low):
            continue
        if re.search(r"\bbearer\s+[a-z0-9._\-]+", low):
            continue
        if re.search(r"\b(sk-|ghp_|github_pat_|xox[baprs]-)", line):
            continue
        if re.search(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b", line):
            continue
        keep.append(line)
    return "\n".join(keep)


def _strip_markup(raw: str) -> str:
    t = re.sub(r"<script[\s\S]*?</script>", " ", raw or "", flags=re.I)
    t = re.sub(r"<style[\s\S]*?</style>", " ", t, flags=re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    t = unicodedata.normalize("NFKC", t)
    t = re.sub(r"\s+", " ", t)
    return t.strip()


def _html_title_toc(html: str) -> str:
    title = ""
    m = re.search(r"<title[^>]*>(.*?)</title>", html or "", flags=re.I | re.S)
    if m:
        title = _strip_markup(m.group(1))
    heads = [_strip_markup(h) for h in re.findall(r"<h[1-3][^>]*>(.*?)</h[1-3]>", html or "", flags=re.I | re.S)]
    heads = [h for h in heads if h][:12]
    parts = []
    if title:
        parts.append(title)
    if heads:
        parts.append("TOC: " + " · ".join(heads))
    return _public_scrub("\n".join(parts))


def _wizard_repo_roots() -> list[Path]:
    roots: list[Path] = []
    here = Path(__file__).resolve().parent
    for p in (
        REPO,
        FOG / "repo",
        Path.home() / "StrataMesh/fog/repo",
        here.parent.parent,  # deploy/mac-fog -> repo root when in-tree
        here,
    ):
        try:
            rp = p
        except Exception:
            continue
        if rp not in roots:
            roots.append(rp)
    return roots


def _read_public_file(path: Path, limit: int) -> str:
    try:
        if not path.is_file():
            return ""
        raw = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""
    if path.suffix.lower() in (".html", ".htm"):
        raw = _strip_markup(raw)
    raw = _public_scrub(raw)
    raw = re.sub(r"\n{3,}", "\n\n", raw).strip()
    return raw[:limit]


def _optional_origin_toc() -> str:
    """Fail-open title/toc from public origin. Never secrets. Timeout 2s."""
    try:
        req = urllib.request.Request(
            "https://calhegasmorais.pt/",
            headers={"User-Agent": "fog-tui-wizard/1", "Accept": "text/html"},
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=2.0) as r:
            html = r.read(80000).decode("utf-8", "replace")
        return _html_title_toc(html)[:800]
    except Exception:
        return ""


def load_wizard_docs(refresh: bool = False) -> str:
    """Public docs next to FOG repo, truncated ~6–8k. Fail-open. Never secrets."""
    global WIZARD_DOCS, WIZARD_DOCS_LOADED
    if WIZARD_DOCS_LOADED and not refresh:
        return WIZARD_DOCS
    chunks: list[str] = [WIZARD_DOCS_SEED]
    budget = WIZARD_DOCS_MAX
    seen: set[str] = set()
    wanted_rel = [
        "docs/SUBJECT-OBJECT-ECONOMY.md",
        "frontend/landing-pt.html",
        "frontend/tokenize.html",
    ]
    for root in _wizard_repo_roots():
        for rel in wanted_rel:
            path = root / rel
            key = str(path)
            if key in seen or not path.is_file():
                continue
            seen.add(key)
            room = max(400, budget - sum(len(c) for c in chunks))
            if room < 200:
                break
            txt = _read_public_file(path, min(2800, room))
            if txt:
                chunks.append("## %s\n%s" % (rel, txt))
        road = root / "docs" / "ROADMAP-PUBLIC-v0.3.md"
        if not road.is_file():
            docs = root / "docs"
            cands = []
            if docs.is_dir():
                cands = sorted(docs.glob("ROADMAP-PUBLIC*.md"), reverse=True)
                if not cands:
                    cands = sorted(docs.glob("*ROADMAP*.md"), reverse=True)
            road = cands[0] if cands else road
        if road.is_file() and str(road) not in seen:
            seen.add(str(road))
            room = max(400, budget - sum(len(c) for c in chunks))
            txt = _read_public_file(road, min(2200, room))
            if txt:
                chunks.append("## %s\n%s" % (road.name, txt))
        for rel in ("CHARTER.md", "docs/CHARTER.md", "laboratory/CHARTER.md", "LABORATORY.md"):
            path = root / rel
            if path.is_file() and str(path) not in seen:
                seen.add(str(path))
                room = max(300, budget - sum(len(c) for c in chunks))
                txt = _read_public_file(path, min(1600, room))
                if txt:
                    chunks.append("## %s\n%s" % (rel, txt))
                    break
    toc = _optional_origin_toc()
    if toc:
        chunks.append("## origin\n%s" % toc)
    blob = "\n\n".join(chunks)
    blob = _public_scrub(blob)[:WIZARD_DOCS_MAX]
    WIZARD_DOCS = blob
    WIZARD_DOCS_LOADED = True
    return WIZARD_DOCS


def wizard_public_docs() -> str:
    return load_wizard_docs(False)


def _hop_line(snap: dict | None) -> str:
    s = snap or {}
    hops = s.get("hops") or {}
    lamps = " ".join(":%s=%s" % (k, "LIVE" if v else "DARK") for k, v in hops.items()) or "hops?"
    return "hops git=%s %s" % (s.get("git") or "?", lamps)


def _prompt_terms(prompt: str) -> set[str]:
    stop = {
        "the", "this", "that", "what", "which", "who", "whom", "whose",
        "is", "are", "was", "were", "a", "an", "of", "and", "or", "to",
        "for", "from", "how", "why", "does", "do", "did", "me", "my",
        "please", "explain", "faq", "tell", "about", "with", "into",
        "your", "you", "can", "could", "would", "should",
    }
    return {w for w in re.findall(r"[a-zA-Z0-9_:]{3,}", (prompt or "").lower()) if w not in stop}


def _extract_docs_for_prompt(prompt: str, docs: str, limit: int = 4) -> str:
    text = (docs or "").strip()
    if not text:
        return ""
    blob = text.replace("\n", " ")
    sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", blob) if len(s.strip()) > 20]
    if not sents:
        sents = [ln.strip() for ln in text.splitlines() if len(ln.strip()) > 20]
    terms = _prompt_terms(prompt)
    scored: list[tuple[int, int, str]] = []
    for s in sents:
        sl = s.lower()
        score = sum(1 for t in terms if t in sl)
        if score:
            scored.append((score, -len(s), s))
    scored.sort(reverse=True)
    picked: list[str] = []
    for _sc, _ln, s in scored:
        if s not in picked:
            picked.append(s)
        if len(picked) >= limit:
            break
    if not picked:
        picked = sents[:3]
    return " ".join(picked[:4])[:1200]


def wizard_faq_improvise(prompt: str, snap: dict | None = None) -> str:
    """Extractive FAQ from public docs for the user prompt, plus one hop line. Never hop-dump loop."""
    docs = wizard_public_docs()
    extract = _extract_docs_for_prompt(prompt, docs)
    q = (prompt or "").strip()[:240]
    body = extract or WIZARD_DOCS_SEED
    return "FAQ · Q: %s\n%s\n%s" % (q or "(empty)", body, _hop_line(snap))


def _http_json(url: str, method: str = "GET", data: bytes | None = None, timeout: float = 4.0) -> dict:
    """JSON GET/POST. Reads HTTPError body. Never secrets. Never blocks draw (caller is a thread)."""
    headers = {
        "Accept": "application/json",
        "User-Agent": "fog-tui-wizard/1",
    }
    if data is not None:
        headers["Content-Type"] = "application/json"
    try:
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode(errors="replace") or "{}"
            try:
                obj = json.loads(raw)
            except Exception:
                obj = {"ok": True, "raw": raw[:120]}
            if not isinstance(obj, dict):
                obj = {"ok": True, "value": obj}
            obj["_http"] = int(getattr(r, "status", 200) or 200)
            return obj
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode(errors="replace")[:240]
        except Exception:
            body = ""
        parsed: dict = {}
        try:
            maybe = json.loads(body) if body else {}
            if isinstance(maybe, dict):
                parsed = maybe
        except Exception:
            parsed = {}
        err = str(parsed.get("error") or parsed.get("message") or body or e.reason or e)[:120]
        out = {"ok": False, "error": err, "_http": int(e.code or 0)}
        if parsed:
            out["_body"] = {k: parsed[k] for k in list(parsed)[:8]}
        return out
    except Exception as e:
        return {"ok": False, "error": type(e).__name__, "_http": 0}


def _orch_endpoint_live(d: dict | None) -> bool:
    if not isinstance(d, dict):
        return False
    http = int(d.get("_http") or 0)
    if d.get("ok") is True:
        return True
    if str(d.get("status") or "").lower() in ("ok", "operational"):
        return True
    if d.get("listening") is True or d.get("service") == "stratamesh-orchestrator":
        return True
    if http in (200, 204) and not d.get("error"):
        return True
    return False


def orch_aiops_report(headline: str, body: str, snap: dict | None = None) -> str:
    """Fail-open e2e: POST orch chat on live mw hops, then origin. GET /health is not a chain fail.

    POST 404/405 on a hop whose GET /health is live means the route was missing — not hop-down.
    Never secrets. Never workers.dev.
    """
    payload = {
        "schema": "stratamesh.wizard.v1",
        "source": "fog-tui-wizard",
        "role": "troubleshooting",
        "dest": "AIOps Dev Team via Orchestrator",
        "headline": (headline or "")[:160],
        "message": (body or "")[:1200],
        "node_id": "FOG-NODE-PT-CM-001",
        "git": (snap or {}).get("git"),
        "hops": (snap or {}).get("hops"),
        "lab": True,
    }
    raw = json.dumps(payload).encode()
    local = (
        ("8791", "http://127.0.0.1:8791"),
        ("8790", "http://127.0.0.1:8790"),
        ("8792", "http://127.0.0.1:8792"),
    )
    notes: list[str] = []
    delivered = False
    hop_live_any = False
    for port, base in local:
        post = _http_json(base + "/api/orchestrator/chat", "POST", raw, 4.0)
        http = int(post.get("_http") or 0)
        if _orch_endpoint_live(post) or (200 <= http < 300):
            notes.append("%s POST %s" % (port, http or 200))
            delivered = True
            break
        health = _http_json(base + "/health", "GET", None, 1.5)
        live = _orch_endpoint_live(health)
        err = str(post.get("error") or "")[:40]
        if live:
            hop_live_any = True
            notes.append("%s hop-live POST %s%s" % (port, http or "err", (" " + err) if err else ""))
        else:
            notes.append("%s down %s" % (port, err or "no-health"))
    if not delivered:
        origin = "https://calhegasmorais.pt/api/orchestrator/chat"
        opost = _http_json(origin, "POST", raw, 4.0)
        ohttp = int(opost.get("_http") or 0)
        if _orch_endpoint_live(opost) or (200 <= ohttp < 300):
            notes.append("origin POST %s" % (ohttp or 200))
            delivered = True
        else:
            oget = _http_json(origin, "GET", None, 4.0)
            if _orch_endpoint_live(oget):
                notes.append("origin GET ok %s" % (oget.get("version") or oget.get("_http") or "service"))
            else:
                notes.append("origin POST %s" % (ohttp or opost.get("error") or "err"))
                ai = _http_json("https://aiops.calhegasmorais.pt/chat", "POST", raw, 4.0)
                ahttp = int(ai.get("_http") or 0)
                if _orch_endpoint_live(ai) or (200 <= ahttp < 300):
                    notes.append("aiops POST %s" % (ahttp or 200))
                    delivered = True
                else:
                    aget = _http_json("https://aiops.calhegasmorais.pt/chat", "GET", None, 2.0)
                    if _orch_endpoint_live(aget):
                        notes.append("aiops GET ok")
                    elif not hop_live_any:
                        notes.append("aiops %s" % (ai.get("error") or ahttp or "err"))
    tag = "ok" if delivered or hop_live_any else "degraded"
    return "orch-aiops %s · " % tag + " · ".join(notes[:6])


def _ollama_generate_text(model: str, prompt: str, snap: dict | None) -> str:
    """POST /api/generate. Stream until first tokens; overall timeout >= 60s. Fail-open empty."""
    docs = wizard_public_docs()
    hop_ctx = compact_wizard_context(snap)
    context = "PUBLIC DOCS:\n%s\n\nHOPS:\n%s" % (docs[:WIZARD_DOCS_MAX], hop_ctx)
    payload = {
        "model": model,
        "prompt": "CONTEXT:\n%s\n\nCHAT:\n%s\n\nUSER:\n%s\n" % (
            context,
            _wizard_history_text(),
            prompt,
        ),
        "system": WIZARD_SYSTEM,
        "stream": True,
    }
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        ollama_base() + "/api/generate",
        data=body,
        method="POST",
        headers={"Content-Type": "application/json", "User-Agent": "fog-tui/8"},
    )
    chunks: list[str] = []
    try:
        with urllib.request.urlopen(req, timeout=OLLAMA_GENERATE_TIMEOUT) as r:
            for raw_line in r:
                line = raw_line.decode("utf-8", "replace").strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                piece = str(obj.get("response") or "")
                if piece:
                    chunks.append(piece)
                if obj.get("done") is True:
                    break
    except Exception:
        if not chunks:
            return ""
    return "".join(chunks).strip()


def wizard_ollama_generate(prompt: str, snap: dict | None = None) -> None:
    """Generate on a daemon thread. FAQ from public docs if model is waking. Never blocks draw()."""
    global WIZARD_BUSY, _WIZARD_WAKING_SAID

    def _run() -> None:
        global WIZARD_BUSY, _WIZARD_WAKING_SAID
        out = ""
        try:
            ensure_ollama_daemon()
            model = ollama_preferred_tag(0.8)
            if model:
                out = _ollama_generate_text(model, prompt, snap)
            if not out:
                out = wizard_faq_improvise(prompt, snap)
                if not _WIZARD_WAKING_SAID:
                    wizard_append("sys", "ollama waking — FAQ from public docs")
                    _WIZARD_WAKING_SAID = True
            wizard_append("ollama", out)
            for act in parse_wizard_actions(out):
                wizard_run_action(act)
            note = orch_aiops_report((prompt or "")[:80], out, snap)
            wizard_append("sys", note)
        except Exception as e:
            faq = wizard_faq_improvise(prompt, snap)
            wizard_append("ollama", faq)
            wizard_append("sys", "wizard catch %s" % type(e).__name__)
        finally:
            WIZARD_BUSY = False
            _WIZARD_WAKING_SAID = False

    WIZARD_BUSY = True
    _WIZARD_WAKING_SAID = False
    threading.Thread(target=_run, name="fog-tui-ollama", daemon=True).start()


def wizard_send(text: str | None = None) -> None:
    global WIZARD_INPUT
    msg = (text if text is not None else WIZARD_INPUT).strip()
    WIZARD_INPUT = ""
    if not msg:
        return
    wizard_append("user", msg)
    if WIZARD_BUSY:
        wizard_append("sys", "ollama busy — wait")
        return
    wizard_ollama_generate(msg, dict(WIZARD_SNAP))


def wizard_consume_key(ch: str):
    """Composer + TAB-clear. While HELP, dashboard keys type into the prompt.

    Returns "type" | "clear" | "send" | "leave" | False (not consumed).
    TAB clears even if HELP is False. ? and Esc leave HELP (do not quit).
    C/c are ordinary letters while HELP. g/r/s/b/q stay reserved.
    """
    global WIZARD_INPUT
    if ch == "\t":
        wizard_clear()
        return "clear"
    if not HELP:
        return False
    if ch == "?" or ch == "\x1b":
        return "leave"
    if ch in ("\r", "\n"):
        wizard_send()
        return "send"
    if ch in ("\x7f", "\x08"):
        WIZARD_INPUT = WIZARD_INPUT[:-1]
        return "type"
    if ch in ("\x03",):
        return False
    if WIZARD_RESERVED and ch in WIZARD_RESERVED:
        return False
    if len(ch) == 1 and ch.isprintable():
        WIZARD_INPUT += ch
        return "type"
    # Swallow other keys so dashboard handlers do not fire while HELP.
    return "type"


def _advance_draw_row(**k) -> None:
    global DRAW_ROW
    if k.get("end", "\n") == "\n":
        DRAW_ROW += 1


def composer_line(inp: str | None = None, busy: bool | None = None) -> str:
    if inp is None:
        inp = WIZARD_INPUT
    if busy is None:
        busy = WIZARD_BUSY
    cursor = "…" if busy else ""
    body = "> " + inp + cursor
    return "  " + REV + ACC + body + RST


def paint_composer() -> None:
    """Rewrite the composer row only. No CSI H J, no hop probes, no dashboard."""
    global COMPOSER_ROW
    row = COMPOSER_ROW
    if not row:
        try:
            rows = shutil.get_terminal_size().lines
        except Exception:
            rows = 24
        row = max(1, rows - 2)
    try:
        DEV_TTY.write("\033[%d;1H\033[2K" % int(row))
        DEV_TTY.write(composer_line())
        DEV_TTY.flush()
    except Exception:
        pass


def draw_wizard_pane(cols: int, w: int) -> None:
    """Re-paint last N log lines every full frame (CSI H J wipes pixels)."""
    global COMPOSER_ROW, DRAW_ROW

    def print(*a, **k):  # noqa
        k.setdefault("file", DEV_TTY)
        r = _PRINT(*a, **k)
        _advance_draw_row(**k)
        return r

    iw = max(36, min(w, cols - 4))
    title = " wizard · ollama :11434 "
    dash = max(1, iw - 2 - vislen(title))
    print("  " + DIM + "╭" + title + ("─" * dash) + "╮" + RST)
    with _WIZARD_LOCK:
        view = list(WIZARD_LOG[-WIZARD_VIEW:])
        inp = WIZARD_INPUT
        busy = WIZARD_BUSY
    inner = iw - 2
    if not view:
        empty = MUT + "(empty · Enter send · TAB clear chat · survives r / 60s)" + RST
        print("  " + boxline(" " + empty, inner))
    for rec in view:
        role = rec.get("role") or "sys"
        ts = rec.get("ts") or ""
        text = (rec.get("text") or "").replace("\n", " / ")
        line = "%s %s %s" % (ts, role, text)
        print("  " + boxline(" " + MUT + line + RST, inner))
    COMPOSER_ROW = DRAW_ROW if DRAW_ROW else 0
    if not COMPOSER_ROW:
        try:
            COMPOSER_ROW = max(1, shutil.get_terminal_size().lines - 2)
        except Exception:
            COMPOSER_ROW = 0
    print("  " + boxline(composer_line(inp, busy).rstrip(), inner))
    print("  " + boxline(" " + MUT + "? leave · TAB clear chat · Enter send" + RST, inner))
    print("  " + DIM + "╰" + ("─" * (iw - 2)) + "╯" + RST)


def draw(msg: str = "") -> None:
    global FRAME, DRAW_ROW
    FRAME += 1
    DRAW_ROW = 1
    _palette()
    def print(*a, **k):  # noqa: shadow — instrument goes to /dev/tty
        k.setdefault("file", DEV_TTY)
        r = _PRINT(*a, **k)
        _advance_draw_row(**k)
        return r
    # Home + erase-below every frame. Without this, Terminal.app appends a
    # second dashboard (double header / stacked ╭──╮). Alt-screen on enter
    # is not enough: draw() used to print without CSI H.
    try:
        DEV_TTY.write("[H[J[?25l")
        DEV_TTY.flush()
    except Exception:
        pass
    kick_public_refresh()
    tloc = LOCAL_HTTP_TIMEOUT
    hop = get("http://127.0.0.1:8788/health", timeout=tloc)
    st = get("http://127.0.0.1:8787/status", timeout=tloc)
    met = get("http://127.0.0.1:8788/metabol", timeout=tloc)
    with _PUB_LOCK:
        pub = dict(PUB_CACHE)
        edge = dict(EDGE_CACHE)
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
    # hop :8788 ORIGIN=session is a public-origin flag (n=1 member=false), not P1.
    member = bool(
        st.get("mesh_member") is True
        or prov.get("mesh_member") is True
        or (isinstance(n, (int, float)) and int(n) >= 2)
        or hop.get("mac_live") is True
        or st.get("mac_live") is True
    )
    if member and (n in (None, 1)):
        n = 2
    if (not member) and hop.get("mesh_member") is True:
        member = True

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
    rss_map = pids_rss_table(("workerd", "python3", "cloudflared"))
    wd = rss_map.get("workerd") or []
    py = rss_map.get("python3") or []
    cf = rss_map.get("cloudflared") or []
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
    pyh = get("http://127.0.0.1:8790/health", timeout=tloc)
    ndh = get("http://127.0.0.1:8791/health", timeout=tloc)
    dnh = get("http://127.0.0.1:8792/health", timeout=tloc)
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
    lastk = keep.get("last") if isinstance(keep.get("last"), dict) else {}
    if not rails.get("mint_armed"):
        pending = lastk.get("score")
        if pending is None:
            pending = keep.get("score_ema") if keep.get("score_ema") is not None else 0
    else:
        pending = rails.get("pending_poc") if rails.get("pending_poc") is not None else 0
    mint = bool(rails.get("mint_armed"))
    burn = bool(rails.get("burn_armed"))
    waiver = bool(rails.get("lab_waived"))
    oracle = bool(st.get("oracle_live") or hop.get("oracle_live"))
    over = bool(cap.get("over"))
    hop_ok = hop.get("ok") is True
    # This Mac is the public session when local workerd :8788 is live.
    # HTTPS probe _lamp is an origin/annotation flag, not the MESH circle.
    pub_ok = hop_ok
    fog_ok = st.get("status") == "operational"
    dec = met.get("decision")
    if not dec and isinstance(met.get("cf"), dict):
        dec = met.get("cf").get("decision")
    dec = dec or "—"
    decision = local_decision(hop_ok, fog_ok, dec)

    top = "╭" + "─" * (cols - 2) + "╮"
    bot = "╰" + "─" * (cols - 2) + "╯"
    mid = "├" + "─" * (cols - 2) + "┤"
    clock = time.strftime("%H:%M:%S")
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

    if decision == "LIVE":
        dec_paint = lamp(True) + " " + BOLD + OK + "LIVE" + RST
    elif decision == "HOLD":
        dec_paint = AMBER + "◉" + RST + " " + BOLD + AMBER + "HOLD" + RST
    else:
        dec_paint = lamp(False) + " " + BAD + decision + RST

    print(top)
    print(boxline(" " + ACC + BOLD + "STRATAMESH" + RST + "  " + clock + MUT + "  v0.5.1-lab" + RST
                  + "  " + dec_paint, w))
    print(boxline(" " + MUT + str(nid) + RST + "  " + BOLD + str(origin) + RST
                  + MUT + "  n=" + RST + BOLD + str(n) + RST
                  + MUT + "  member=" + RST + str(bool(member)), w))
    print(mid)
    print(boxline(" " + ACC + "FOG" + RST + MUT + "  kernel  ·  MW cover: workerd python node deno" + RST, w))
    mesh = (
        (8787, "fog", fog_ok),
        (8788, "workerd", hop_ok),
        (8790, "python", bool(pyh.get("ok"))),
        (8791, "node", bool(ndh.get("ok"))),
        (8792, "deno", bool(dnh.get("ok"))),
    )
    node_hint = ""
    if not bool(ndh.get("ok")):
        node_hint = runtime_mesh_last_error(st)
        if node_hint.strip().lower() == "host_cap":
            node_hint = ""
    for port, name, okh in mesh:
        hist = HOP_LIVE_HIST.get(port)
        if hist is not None:
            hist.append(1.0 if okh else 0.0)
            sp = hop_spark(hist)
        else:
            sp = ""
        indent = " "
        nm = (BOLD + name.ljust(8) + RST) if okh else (MUT + name.ljust(8) + RST)
        extra = ""
        if name == "node" and not okh and node_hint:
            extra = MUT + " " + node_hint + RST
        print(boxline(indent + lamp(okh) + " " + nm + MUT + " :%d  " % port + RST + sp + extra, w))
    pub_nm = pub_origin_label(pub)
    print(boxline(" " + lamp(pub_ok) + " " + (BOLD if pub_ok else MUT) + "public".ljust(8) + RST
                  + MUT + " " + pub_nm + RST, w))
    print(mid)
    print(boxline(" " + ACC + "STRATA" + RST, w))
    print(boxline("  dag  tx=%s  tip=%s  h=%s" % (txs, tips, height), w))
    print(boxline("  PoC  " + bar(min(float(pending or 0) / 40.0, 1.0), 12) + " " + str(pending)[:8], w))
    print(boxline("  spa  %s / %s" % (spa.get("active") or 0, spa.get("total") or 0), w))
    print(boxline("  meta %s  pace=%s" % (dec, met.get("pace") or "—"), w))
    print(boxline("  plus " + str((sub.get("surplus") if isinstance(sub, dict) else None) or "—"), w))
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
    host_state = (AMBER + BOLD + "HOLD " + str(cap.get("reason") or "") + RST) if over else (OK + "ok" + RST)
    print(boxline(" " + ACC + "HOST" + RST + "  cap 60%  " + host_state + "  " + spark(LOAD_HIST), w))
    print(boxline("  CPU " + bar(min(load_frac, 1.0), 14) + "  %.2f  %.2f  %.2f" % load, w))
    print(boxline("  MEM free %s   act %s   wired %s" % (gb(free), gb(active), gb(wired)), w))
    print(boxline("  RSS wrk %s   py %s   cf %s" % (kb(wd_rss), kb(py_rss), kb(cf_rss)), w))
    print(boxline("  DSK " + dsk + "  " + dsk_path, w))
    print(boxline("  NET " + net(), w))
    sha_now = git_sha()
    git_extra = ""
    if node_hint and not bool(ndh.get("ok")):
        git_extra = MUT + "  mw-node " + node_hint + RST
    print(boxline("  GIT " + sha_now + "  " + awake_line() + git_extra, w))
    print(bot)
    print(MUT + "  g update   b reboot   s stop   r refresh   ? wizard   q quit" + RST)
    instr = "  instrument · 60s · named-tunnel stays up"
    if node_hint and not bool(ndh.get("ok")):
        instr = instr + " · " + node_hint
    print(MUT + instr + RST)

    WIZARD_SNAP.clear()
    WIZARD_SNAP.update({
        "git": sha_now,
        "hops": {
            "8788": hop_ok,
            "8787": fog_ok,
            "8790": bool(pyh.get("ok")),
            "8791": bool(ndh.get("ok")),
            "8792": bool(dnh.get("ok")),
        },
        "origin": origin,
        "mac_live": bool(st.get("mac_live") or hop.get("mac_live") or wr.get("mac_live")),
        "host_cap_over": over,
        "msg": msg,
        "n": n,
        "member": bool(member),
        "decision": decision,
    })
    if HELP:
        print(MUT + "  q UI only · s fog plugin · b workerd+fog · g reset origin/main + exec TUI" + RST)
        print(MUT + "  never pkill cloudflared · STRATA mint waits for oracle_live" + RST)
        draw_wizard_pane(cols, w)
    if msg:
        print("  " + ACC + msg + RST)
    try:
        DEV_TTY.flush()
    except Exception:
        pass



_TTY_IN = None

def _key_fd():
    """wait_key uses stdin only. Never /dev/tty here (g y/n opens it in confirm)."""
    return sys.stdin.fileno()


def wait_key(seconds: float) -> str:
    """Poll keys on stdin without freezing draw. TCSANOW. /dev/tty is not used."""
    import tty
    import termios
    try:
        fd = _key_fd()
    except Exception:
        time.sleep(min(float(seconds), 0.25))
        return ""
    try:
        old = termios.tcgetattr(fd)
    except Exception:
        time.sleep(min(float(seconds), 0.25))
        return ""
    try:
        tty.setcbreak(fd)
        end = time.time() + max(0.05, float(seconds))
        while time.time() < end:
            r, _, _ = select.select([fd], [], [], min(0.25, max(0.0, end - time.time())))
            if r:
                b = os.read(fd, 8)
                if not b:
                    return ""
                try:
                    return b.decode("utf-8", "ignore")[:1]
                except Exception:
                    return chr(b[0]) if b else ""
        return ""
    finally:
        try:
            termios.tcsetattr(fd, termios.TCSANOW, old)
        except Exception:
            pass


def _yn_from_tty(seconds: float = 30.0) -> str:
    """g y/n only. /dev/tty — wait_key stays on stdin."""
    import tty
    import termios
    fh = None
    try:
        fh = open("/dev/tty", "rb", buffering=0)
        fd = fh.fileno()
        old = termios.tcgetattr(fd)
    except Exception:
        if fh:
            try:
                fh.close()
            except Exception:
                pass
        return wait_key(seconds)
    try:
        tty.setcbreak(fd)
        end = time.time() + max(0.05, float(seconds))
        while time.time() < end:
            r, _, _ = select.select([fd], [], [], min(0.25, max(0.0, end - time.time())))
            if r:
                b = os.read(fd, 8)
                if not b:
                    return ""
                try:
                    return b.decode("utf-8", "ignore")[:1]
                except Exception:
                    return chr(b[0]) if b else ""
        return ""
    finally:
        try:
            termios.tcsetattr(fd, termios.TCSANOW, old)
        except Exception:
            pass
        try:
            fh.close()
        except Exception:
            pass


def confirm(prompt: str) -> bool:
    """y/n on the last terminal row. Never COMPOSER_ROW/22 (that sat mid-TUI on 55-line Fog)."""
    try:
        row = max(1, shutil.get_terminal_size((88, 28)).lines)
    except Exception:
        row = 28
    try:
        DEV_TTY.write("\033[%d;1H\033[2K\033[?25h" % row)
        DEV_TTY.write((prompt + "  y/n ")[:120])
        DEV_TTY.flush()
    except Exception:
        pass
    yes = _yn_from_tty(30) in ("y", "Y")
    try:
        DEV_TTY.write("\033[%d;1H\033[2K\033[?25l" % row)
        DEV_TTY.flush()
    except Exception:
        pass
    return yes


def main() -> int:
    global HELP, FOCUS
    quiet_mac_malloc()
    load_wizard_log()
    DEV_TTY.write("\033[?1049h\033[2J\033[H\033[?25l")
    DEV_TTY.flush()
    msg = ""
    full = True
    try:
        while True:
            if full:
                try:
                    draw(msg)
                except Exception as e:
                    print("\nTUI draw", type(e).__name__, e)
                    sys.stdout.flush()
                msg = ""
            full = True
            ch = wait_key(INTERVAL)
            global G_MSG
            if G_MSG:
                msg = G_MSG
                G_MSG = ""
                full = True
            if not ch:
                full = True
                continue
            tok = wizard_consume_key(ch)
            if tok == "type":
                full = False
                paint_composer()
                continue
            if tok == "clear" or tok == "send":
                full = True
                continue
            if tok == "leave":
                HELP = False
                full = True
                continue
            if tok:
                full = True
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
                # No blocking y/n — that prompt sat on the last row and looked like a dead key.
                # r already refreshes with no confirm; g must answer on the same press.
                msg = "g running…"
                def _g():
                    global G_MSG
                    G_MSG = git_pull_reboot()
                threading.Thread(target=_g, name="fog-tui-g", daemon=True).start()
    except KeyboardInterrupt:
        return 0
    finally:
        DEV_TTY.write("\033[?25h\033[?1049l")
        DEV_TTY.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
