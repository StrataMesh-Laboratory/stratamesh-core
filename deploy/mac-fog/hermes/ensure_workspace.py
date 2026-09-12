#!/usr/bin/env python3
"""Idempotent FOG-CMN-DESK workspace ensure for Hermes Desktop on Mac.

Uses official Hermes CLI + SessionDB APIs only (no bare discovery-policy sqlite writes).
See WORKSPACE.md and RCA-HERMES-EMPTY-WORKSPACE.md.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

FOG_REPO = Path(os.environ.get("FOG_SRC", Path.home() / "StrataMesh" / "fog" / "repo"))
STRATAMESH = Path(os.environ.get("STRATAMESH_ROOT", Path.home() / "StrataMesh"))
FOG_HOME = Path(os.environ.get("FOG_HOME", Path.home() / "StrataMesh" / "fog"))
PROJECT_ID = "fog-cmn-desk"
PROJECT_NAME = "FOG-CMN-DESK"
PRIMARY = FOG_REPO
FOLDERS: List[Tuple[Path, str, bool]] = [
    (FOG_REPO, "stratamesh-core / Fog repo", True),
    (FOG_REPO / "deploy" / "mac-fog" / "hermes" / "desktop", "Hermes desk docs", False),
    (FOG_HOME / "data" / "desk-outbox", "desk outbox", False),
]
SCAN_ROOTS = [str(STRATAMESH), str(FOG_REPO)]
SEED_PROMPT = "FOG-CMN-DESK desk seed. Reply exactly: ACK"
# Prefer installed open-source tags with Hermes-usable context (>=64k).
# mistral/llava often report 32k and fail agent init; qwen only if pulled.
PREFERRED_MODELS = (
    "gpt-oss:20b",      # primary via Ollama cloud (8GB Mac cannot host Hermes 64k local)
    "llama3.2:1b-64k",  # local only when host RAM allows
    "llama3.2:1b",
    "qwen2.5:3b",
    "qwen2.5:7b",
    "qwen2.5:14b",
    "hermes3:8b",
    "llama3:latest",
)
MIN_CONTEXT = 65536
DEFAULT_CONTEXT = 131072
FALLBACK_MODELS = ("qwen2.5:3b", "qwen2.5:7b")
AVOID_AS_DEFAULT = {
    "mistral:latest",
    "mistral",
    "llava:latest",
    "llava",
    "phi3:latest",      # no tools on this desk
    "phi3",
}


def _env() -> dict:
    env = os.environ.copy()
    extra = "/usr/local/bin:/opt/homebrew/bin:" + str(Path.home() / ".local" / "bin")
    env["PATH"] = extra + ":" + env.get("PATH", "")
    return env


def which_hermes() -> str:
    h = shutil.which("hermes", path=_env()["PATH"])
    if not h:
        raise SystemExit("hermes CLI not found on PATH")
    return h


def run(
    cmd: Sequence[str], *, check: bool = True, timeout: int = 180
) -> subprocess.CompletedProcess:
    return subprocess.run(
        list(cmd),
        env=_env(),
        text=True,
        capture_output=True,
        check=check,
        timeout=timeout,
    )


def hermes(
    *args: str, check: bool = True, timeout: int = 180
) -> subprocess.CompletedProcess:
    return run([which_hermes(), *args], check=check, timeout=timeout)


def ensure_discovery_config() -> None:
    hermes("config", "set", "desktop.repo_scan_enabled", "true")
    hermes("config", "set", "desktop.repo_scan_roots", json.dumps(SCAN_ROOTS))
    hermes("config", "set", "desktop.repo_scan_exclude_paths", "[]")
    got = hermes("config", "get", "desktop.repo_scan_roots")
    print("discovery.roots:", " ".join(got.stdout.strip().splitlines()))


def ensure_project() -> None:
    show = hermes("project", "show", PROJECT_ID, check=False)
    if show.returncode != 0:
        # Try modern flags; tolerate older CLIs
        hermes(
            "project",
            "create",
            "--name",
            PROJECT_NAME,
            "--slug",
            PROJECT_ID,
            check=False,
        )
        show2 = hermes("project", "show", PROJECT_ID, check=False)
        if show2.returncode != 0:
            hermes("project", "create", PROJECT_NAME, check=False)
    hermes("project", "use", PROJECT_ID, check=False)
    for path, _label, is_primary in FOLDERS:
        path.mkdir(parents=True, exist_ok=True)
        hermes("project", "add-folder", PROJECT_ID, str(path), check=False)
        if is_primary:
            hermes("project", "set-primary", PROJECT_ID, str(path), check=False)
    hermes("project", "bind-board", PROJECT_ID, "desk", check=False)
    out = hermes("project", "show", PROJECT_ID, check=False).stdout.strip().splitlines()
    print("project:", out[:8])


def ensure_desktop_cwd_env() -> None:
    env_path = Path.home() / ".hermes" / ".env"
    env_path.parent.mkdir(parents=True, exist_ok=True)
    key = "HERMES_DESKTOP_CWD"
    val = str(PRIMARY)
    lines: List[str] = []
    if env_path.is_file():
        lines = env_path.read_text().splitlines()
    out: List[str] = []
    found = False
    for line in lines:
        if line.startswith(key + "=") or line.startswith("export " + key + "="):
            out.append(f"{key}={val}")
            found = True
        else:
            out.append(line)
    if not found:
        out.append(f"{key}={val}")
    mode = 0o600
    if env_path.is_file():
        mode = env_path.stat().st_mode & 0o777
    env_path.write_text("\n".join(out).rstrip() + "\n")
    os.chmod(env_path, mode)
    print("HERMES_DESKTOP_CWD=set")


def ollama_tags() -> List[str]:
    try:
        p = run(["ollama", "list"], check=False, timeout=30)
    except FileNotFoundError:
        return []
    if p.returncode != 0:
        return []
    tags: List[str] = []
    for i, line in enumerate(p.stdout.splitlines()):
        if i == 0 and line.upper().startswith("NAME"):
            continue
        parts = line.split()
        if parts:
            tags.append(parts[0])
    return tags


def _parse_config_value(raw: str) -> str:
    cur = (raw or "").strip()
    if not cur:
        return ""
    line = cur.splitlines()[-1].strip().strip("\"'")
    # hermes config get sometimes prints "key: value"
    if line.startswith("model.default"):
        line = line.split(":", 1)[-1].strip().strip("\"'")
    return line


def ensure_model() -> None:
    tags = ollama_tags()
    cur_val = _parse_config_value(
        hermes("config", "get", "model.default", check=False).stdout
    )
    pick = None
    if tags:
        for m in PREFERRED_MODELS:
            if m in tags and m not in AVOID_AS_DEFAULT:
                pick = m
                break
        if pick is None:
            for t in tags:
                if t not in AVOID_AS_DEFAULT:
                    pick = t
                    break
            pick = pick or tags[0]
    need_switch = bool(tags and cur_val not in tags) or (cur_val in AVOID_AS_DEFAULT)
    if need_switch and pick:
        hermes("config", "set", "model.default", pick)
        print(f"model.default repaired: {cur_val!r} -> {pick}")
        cur_val = pick
    else:
        shown = cur_val if cur_val else "(empty)"
        print(f"model.default ok: {shown} tags={len(tags)}")
    # custom is runtime-routable; ollama-launch alone is not in PROVIDER_REGISTRY
    # so resolve_provider("auto") AuthErrors without explicit --provider.
    hermes("config", "set", "model.provider", "custom", check=False)
    # 8GB Intel Fog Mac: local 64k KV thrash — prefer Ollama cloud when token present.
    _tok = Path.home() / ".config/stratagrok/ollama.api.token"
    if _tok.is_file() and _tok.read_text().strip():
        hermes("config", "set", "model.base_url", "https://ollama.com/v1", check=False)
        hermes("config", "set", "model.api_key", _tok.read_text().strip(), check=False)
        hermes("config", "set", "model.default", "gpt-oss:20b", check=False)
        print("model endpoint: ollama.com gpt-oss:20b (cloud)")
    else:
        hermes("config", "set", "model.base_url", "http://127.0.0.1:11434/v1", check=False)
        hermes("config", "set", "model.api_key", "ollama", check=False)
        print("model endpoint: local ollama (no cloud token)")
    hermes("config", "set", "model.context_length", str(DEFAULT_CONTEXT), check=False)
    ctx_raw = _parse_config_value(
        hermes("config", "get", "model.context_length", check=False).stdout
    )
    try:
        ctx = int(str(ctx_raw).split()[0])
    except Exception:
        ctx = 0
    if ctx < MIN_CONTEXT:
        hermes("config", "set", "model.context_length", str(DEFAULT_CONTEXT))
        ctx = DEFAULT_CONTEXT
        print(f"model.context_length raised to {DEFAULT_CONTEXT}")
    else:
        print(f"model.context_length ok: {ctx}")
    if cur_val:
        try:
            db = _session_db()
            try:
                for row in db.search_sessions(limit=100) or []:
                    if int(row.get("message_count") or 0) < 1:
                        continue
                    sid = row.get("id")
                    if sid and (row.get("model") or "") != cur_val:
                        db.update_session_model(sid, cur_val, provider="custom")
                        print(f"session_model {sid} -> {cur_val}")
            finally:
                db.close()
        except Exception as exc:
            print(f"session_model stamp warn: {exc}")


def _session_db():
    ha = Path.home() / ".hermes" / "hermes-agent"
    sys.path.insert(0, str(ha))
    from hermes_state import SessionDB  # type: ignore

    return SessionDB()


def prune_empty_orphans() -> int:
    db = _session_db()
    deleted = 0
    try:
        try:
            deleted += int(db.delete_empty_sessions() or 0)
        except Exception as exc:
            print(f"delete_empty_sessions warn: {exc}")
        rows = db.search_sessions(limit=200) or []
        for row in rows:
            mc = int(row.get("message_count") or 0)
            er = row.get("end_reason") or ""
            if mc == 0 and (er == "ws_orphan_reap" or row.get("source") == "desktop"):
                sid = row.get("id")
                if not sid:
                    continue
                try:
                    if db.delete_session_if_empty(sid):
                        deleted += 1
                    else:
                        db.set_session_hidden(sid, True)
                except Exception:
                    try:
                        db.set_session_hidden(sid, True)
                    except Exception:
                        pass
        print(f"orphans_pruned≈{deleted}")
        return deleted
    finally:
        try:
            db.close()
        except Exception:
            pass


def listable_fog_sessions() -> List[dict]:
    db = _session_db()
    try:
        out: List[dict] = []
        for row in db.search_sessions(limit=200) or []:
            mc = int(row.get("message_count") or 0)
            if mc < 1:
                continue
            cwd = row.get("cwd") or ""
            root = row.get("git_repo_root") or ""
            blob = f"{cwd} {root}"
            if str(FOG_REPO) in blob or "/fog/repo" in blob:
                out.append(row)
        return out
    finally:
        try:
            db.close()
        except Exception:
            pass


def stamp_cwd(session_id: str) -> None:
    db = _session_db()
    try:
        db.update_session_cwd(
            session_id,
            str(PRIMARY),
            git_repo_root=str(PRIMARY),
            replace_git_meta=True,
        )
        try:
            db.publish_session_git_metadata(
                session_id, str(PRIMARY), 1, git_repo_root=str(PRIMARY)
            )
        except Exception:
            pass
        print(f"stamped_cwd {session_id}")
    finally:
        try:
            db.close()
        except Exception:
            pass


def ensure_listable_session() -> None:
    existing = listable_fog_sessions()
    if existing:
        for row in existing:
            blob = (row.get("cwd") or "") + (row.get("git_repo_root") or "")
            if str(PRIMARY) not in blob:
                stamp_cwd(row["id"])
        print(f"listable_sessions={len(existing)}")
        return

    print("seeding listable session via hermes chat --oneshot --in")
    p = hermes(
        "chat",
        "-q",
        SEED_PROMPT,
        "--oneshot",
        "-Q",
        "--in",
        str(PRIMARY),
        "--safe-mode",
        check=False,
        timeout=300,
    )
    if p.returncode != 0:
        hermes("-z", SEED_PROMPT, "--in", str(PRIMARY), check=False, timeout=300)

    db = _session_db()
    try:
        rows = db.search_sessions(limit=20) or []
        target = None
        for row in rows:
            if int(row.get("message_count") or 0) >= 1:
                target = row
                break
        if not target:
            sid = time.strftime("%Y%m%d_%H%M%S") + "_fogseed"
            db.create_session(
                sid, "cli", cwd=str(PRIMARY), title="FOG-CMN-DESK desk seed"
            )
            db.append_message(sid, "user", SEED_PROMPT)
            db.append_message(sid, "assistant", "ACK")
            db.update_session_cwd(
                sid, str(PRIMARY), git_repo_root=str(PRIMARY), replace_git_meta=True
            )
            print(f"api_seeded {sid}")
            return
        sid = target["id"]
        blob = (target.get("cwd") or "") + (target.get("git_repo_root") or "")
        if str(PRIMARY) not in blob:
            db.update_session_cwd(
                sid, str(PRIMARY), git_repo_root=str(PRIMARY), replace_git_meta=True
            )
            print(f"stamped_cwd {sid}")
        else:
            print(f"seed_ok {sid}")
    finally:
        try:
            db.close()
        except Exception:
            pass




def ensure_fallback_providers(tags: list) -> None:
    """Keep official fallback_providers chain: qwen2.5:3b then 7b.

    Docs: https://hermes-agent.nousresearch.com/docs/user-guide/features/fallback-providers
    Interactive `hermes fallback add` is a picker — write YAML list via PyYAML.
    """
    import yaml

    cfg_path = Path.home() / ".hermes" / "config.yaml"
    raw = yaml.safe_load(cfg_path.read_text()) if cfg_path.is_file() else {}
    if not isinstance(raw, dict):
        raw = {}
    wanted = []
    for model in FALLBACK_MODELS:
        if model in tags:
            wanted.append(
                {
                    "provider": "custom",
                    "model": model,
                    "base_url": "http://127.0.0.1:11434/v1",
                    "api_key": "ollama",
                }
            )
        else:
            print(f"fallback skip (not installed yet): {model}")
    if not wanted:
        wanted = [
            {
                "provider": "custom",
                "model": m,
                "base_url": "http://127.0.0.1:11434/v1",
                "api_key": "ollama",
            }
            for m in FALLBACK_MODELS
        ]
    cur = raw.get("fallback_providers") or []
    cur_models = [e.get("model") for e in cur if isinstance(e, dict)]
    want_models = [e["model"] for e in wanted]
    if cur_models != want_models:
        raw["fallback_providers"] = wanted
        cfg_path.write_text(yaml.safe_dump(raw, sort_keys=False, allow_unicode=True))
        print(f"fallback_providers set: {want_models}")
    else:
        print(f"fallback_providers ok: {cur_models}")


def write_meter(ok: bool, extra: Optional[Dict[str, Any]] = None) -> None:
    meter_dir = FOG_HOME / "data" / "desk-meters"
    meter_dir.mkdir(parents=True, exist_ok=True)
    payload: Dict[str, Any] = {
        "ok": ok,
        "project_id": PROJECT_ID,
        "primary": str(PRIMARY),
        "scan_roots": SCAN_ROOTS,
        "oracle_live": False,
    }
    if extra:
        payload.update(extra)
    (meter_dir / "hermes-workspace.json").write_text(json.dumps(payload, indent=2) + "\n")


def main() -> int:
    print("ensure_workspace: FOG-CMN-DESK")
    ensure_discovery_config()
    ensure_project()
    ensure_desktop_cwd_env()
    ensure_model()
    ensure_fallback_providers(ollama_tags())
    prune_empty_orphans()
    ensure_listable_session()
    n = len(listable_fog_sessions())
    write_meter(n >= 1, {"listable_fog_sessions": n})
    print(f"done listable_fog_sessions={n}")
    return 0 if n >= 1 else 1


if __name__ == "__main__":
    sys.exit(main())
