"""Sweep non-persistent Fog scratch on every reboot.

Never touches rails, tunnel tokens, git, named-tunnel, or ~/.config/stratamesh.
"""
from __future__ import annotations

import os
import time
from pathlib import Path

KEEP_NAMES = {
    "rails.json",
    "origin-lease.json",
    "edge_tunnel_token",
    "fog_tunnel_token",
    ".gitignore",
}


def _fog_home() -> Path:
    return Path(os.environ.get("FOG_HOME") or Path.home() / "StrataMesh/fog")


def _truncate_keep_tail(path: Path, max_bytes: int = 2_000_000, tail_lines: int = 400) -> str:
    try:
        if not path.is_file() or path.stat().st_size <= max_bytes:
            return ""
        text = path.read_text(errors="replace")
        lines = text.splitlines()[-tail_lines:]
        path.write_text("\n".join(lines) + "\n")
        return path.name
    except Exception:
        return ""


def sweep(fog: Path | None = None) -> dict:
    fog = Path(fog) if fog else _fog_home()
    removed = 0
    truncated = []
    bytes_before = 0
    now = time.time()

    globs = [
        fog / "log",
        fog / "tmp",
        fog / "data",
        Path("/tmp"),
        Path("/private/tmp"),
        Path("/var/folders"),
    ]
    patterns_exact = (
        "fog-tui-login.log",
        "fog-awake.log",
        "MallocStackLogging",
    )

    for root in globs:
        if not root.exists():
            continue
        try:
            it = root.rglob("*") if root.name in {"tmp", "log"} or str(root).endswith("tmp") else root.iterdir()
        except Exception:
            continue
        for p in it:
            try:
                if not p.is_file():
                    continue
                if p.name in KEEP_NAMES:
                    continue
                name = p.name
                low = name.lower()
                # named-tunnel / secrets
                if "token" in low or "tunnel" in low or p.suffix in {".pem", ".key", ".p12"}:
                    continue
                drop = False
                if p.suffix in {".pyc", ".pyo"}:
                    drop = True
                if name == "keepup.jsonl":
                    t = _truncate_keep_tail(p)
                    if t:
                        truncated.append(t)
                    continue
                if p.suffix == ".log" and p.stat().st_size > 512_000:
                    t = _truncate_keep_tail(p, max_bytes=512_000, tail_lines=200)
                    if t:
                        truncated.append(t)
                    continue
                if name.endswith(".tmp") or name.endswith(".temp") or low.endswith(".swp"):
                    drop = True
                if "mallocstacklogging" in low:
                    drop = True
                if name.startswith("fog-") and p.parent in {Path("/tmp"), Path("/private/tmp")}:
                    drop = True
                if name.startswith("workerd-") and p.suffix in {".log", ".tmp"}:
                    drop = True
                if drop:
                    bytes_before += p.stat().st_size
                    p.unlink()
                    removed += 1
            except Exception:
                continue

    # __pycache__ under fog + repo (compiled only)
    for cache_root in (fog, fog / "repo"):
        if not cache_root.exists():
            continue
        for d in cache_root.rglob("__pycache__"):
            if not d.is_dir():
                continue
            for p in d.glob("*.pyc"):
                try:
                    bytes_before += p.stat().st_size
                    p.unlink()
                    removed += 1
                except Exception:
                    pass

    return {
        "schema": "stratamesh.fog.tmp_sweep.v1",
        "removed": removed,
        "truncated": truncated,
        "bytes": bytes_before,
        "ts": now,
        "fog": str(fog),
    }


if __name__ == "__main__":
    import json
    print(json.dumps(sweep(), indent=2))
