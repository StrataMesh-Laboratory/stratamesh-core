#!/usr/bin/env python3
"""Desk origin PUT helper — ship_majority lands live via existing CF scripts.

Never print secrets. Token from env or ~/.config/stratamesh/{god_api,cloudflare.token}.
No wrangler. No workers.dev. Soft-fail with clear reason if token/scripts missing.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]  # ops/desk-collegium -> ops -> repo root
BIN = REPO / "ops" / "bin"
CF_PUT = BIN / "cf-put-origin.py"
D1_PUT = BIN / "d1-put-html.py"
FUND_SRC = REPO / "workers" / "stratamesh-fund.js"

HTML_NEEDLES = (
    "html", "pages", "frontend", "fund", "atelier", "landing", "portal",
    "spa", "dag", "origin", "d1", "site_content",
)
FUND_NEEDLES = ("fund", "lab-progress", "lab progress", "stratamesh-fund")
ORIGIN_NEEDLES = ("origin", "archive", "worker", "spa", "dag", "pulse", "put", "ship")


def _home_cfg(*names: str) -> list[Path]:
    home = Path.home()
    roots = [
        home / ".config" / "stratamesh",
        home / ".config" / "stratagrok",
    ]
    fog = Path(os.environ.get("FOG_HOME") or (home / "StrataMesh" / "fog"))
    roots.append(fog / "data" / "secrets")
    out: list[Path] = []
    for root in roots:
        for n in names:
            out.append(root / n)
    out.append(Path("/tmp/god_api"))
    return out


def _read_secret_file(path: Path) -> str:
    """Read a 0600 vault file; never log contents."""
    try:
        if not path.is_file():
            return ""
        raw = path.read_text(encoding="utf-8").strip()
        if "=" in raw and "\n" not in raw and not raw.startswith("{"):
            if raw.split("=", 1)[0].strip().upper() in {
                "GOD_API", "CLOUDFLARE_API_TOKEN", "CF_API_TOKEN", "TOKEN",
            }:
                return raw.split("=", 1)[1].strip().strip('"').strip("'")
        if "\n" in raw:
            for line in raw.splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    if k.strip().upper() in {
                        "GOD_API", "CLOUDFLARE_API_TOKEN", "CF_API_TOKEN", "TOKEN",
                    }:
                        return v.strip().strip('"').strip("'")
            for line in raw.splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" not in line:
                    return line
            return ""
        return raw
    except Exception:
        return ""


def ensure_god_env() -> dict[str, Any]:
    """Load CF token + account into os.environ. Returns status (no secret values)."""
    status: dict[str, Any] = {"ok": False, "sources": [], "missing": []}
    tok = (os.environ.get("GOD_API") or os.environ.get("CLOUDFLARE_API_TOKEN") or "").strip()
    if tok:
        status["sources"].append("env")
    else:
        for path in _home_cfg("god_api", "cloudflare.token"):
            tok = _read_secret_file(path)
            if tok:
                status["sources"].append(str(path))
                break
        if not tok:
            status["missing"].append("god_api|cloudflare.token")
    if tok:
        os.environ["GOD_API"] = tok
        os.environ.setdefault("CLOUDFLARE_API_TOKEN", tok)
        status["ok"] = True
        status["token_len"] = len(tok)
    acct = (os.environ.get("CF_ACCOUNT") or "").strip()
    if not acct:
        for path in _home_cfg("cf_account"):
            acct = _read_secret_file(path)
            if acct:
                status["sources"].append(str(path))
                break
    if acct:
        os.environ["CF_ACCOUNT"] = acct
    if not (os.environ.get("CLOUDFLARE_EMAIL") or "").strip():
        os.environ.setdefault("CLOUDFLARE_EMAIL", "amcmorais@icloud.com")
    return status


def _scrub(s: str) -> str:
    s = s or ""
    s = re.sub(
        r"(ghp_|ghu_|github_pat_|cfat_|cfut_|Bearer\s+)[A-Za-z0-9_\-.]{8,}",
        r"\1[redacted]",
        s,
    )
    s = re.sub(r"\b[A-Za-z0-9_\-]{40,}\b", "[redacted]", s)
    return s[:400]


def _intent_blob(task: dict | None) -> str:
    if not task:
        return ""
    parts = [
        str(task.get("intent") or ""),
        str(task.get("title") or ""),
        str(task.get("result") or ""),
        str(task.get("specialty") or ""),
        " ".join(str(x) for x in (task.get("tags") or [])),
    ]
    return " ".join(parts).lower()


def _wants_html(blob: str) -> bool:
    return any(k in blob for k in HTML_NEEDLES)


def _wants_fund(blob: str) -> bool:
    return any(k in blob for k in FUND_NEEDLES)


def _wants_origin(blob: str) -> bool:
    if not blob.strip():
        return True
    return any(k in blob for k in ORIGIN_NEEDLES) or _wants_html(blob) or _wants_fund(blob)


def _run_script(script: Path, argv: list[str], *, dry: bool, cwd: Path) -> dict[str, Any]:
    if not script.is_file():
        return {"ok": False, "detail": f"missing_script:{script.name}", "rc": 127}
    if dry:
        return {"ok": True, "detail": f"dry:{script.name}", "rc": 0, "argv": argv}
    env = os.environ.copy()
    try:
        proc = subprocess.run(
            [sys.executable, str(script), *argv],
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=180,
            env=env,
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "detail": f"timeout:{script.name}", "rc": 124}
    except Exception as e:
        return {"ok": False, "detail": f"spawn_err:{script.name}:{e.__class__.__name__}", "rc": 1}
    out = _scrub((proc.stdout or "") + "\n" + (proc.stderr or ""))
    ok = proc.returncode == 0
    return {
        "ok": ok,
        "detail": out.strip() or (f"rc={proc.returncode}" if not ok else f"{script.name} ok"),
        "rc": proc.returncode,
    }


def _put_fund_worker(*, dry: bool) -> dict[str, Any]:
    """PUT workers/stratamesh-fund.js via api-gitlive-publish.cf_put_content."""
    if not FUND_SRC.is_file():
        return {"ok": False, "detail": "missing:workers/stratamesh-fund.js"}
    if dry:
        return {"ok": True, "detail": "dry:stratamesh-fund"}
    tok = (os.environ.get("GOD_API") or os.environ.get("CLOUDFLARE_API_TOKEN") or "").strip()
    if not tok:
        return {"ok": False, "detail": "no_token_for_fund_put"}
    email = os.environ.get("CLOUDFLARE_EMAIL") or "amcmorais@icloud.com"
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "agl_put", REPO / "scripts" / "api-gitlive-publish.py"
        )
        mod = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(mod)
        out = mod.cf_put_content(
            email,
            tok,
            FUND_SRC,
            script="stratamesh-fund",
            main_module=(getattr(mod, "MAIN_MODULE", {}) or {}).get("stratamesh-fund") or "index.js",
        )
        success = bool(out.get("success")) or (out.get("http") in (200, 201))
        detail = f"fund PUT http={out.get('http')} success={int(success)}"
        if out.get("errors"):
            detail += f" errors={_scrub(json.dumps(out.get('errors')))}"
        return {"ok": success, "detail": detail, "urls": ["https://fund.calhegasmorais.pt/"]}
    except SystemExit as e:
        return {"ok": False, "detail": f"fund_put_exit:{e}"}
    except Exception as e:
        return {"ok": False, "detail": f"fund_put_err:{e.__class__.__name__}:{_scrub(str(e))}"}


def _metabol_platforms() -> dict:
    """Load platforms from desk_metabol tick state (no secrets)."""
    try:
        import importlib.util
        mp = Path(__file__).resolve().parent / "desk_metabol.py"
        spec = importlib.util.spec_from_file_location("desk_metabol", mp)
        mod = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(mod)
        state = mod.load_state()
        platforms = state.get("platforms")
        if not platforms:
            lanes = state.get("lanes") or mod.compute_lanes(state)
            platforms = mod.compute_platforms(lanes)
        return platforms or {}
    except Exception:
        return {}


def _gate_put(platforms: dict, action: str) -> tuple[bool, str, str]:
    """Respect fund-origin-put / cf-workers metabol. Pages HTML always ALLOW."""
    try:
        import importlib.util
        mp = Path(__file__).resolve().parent / "desk_metabol.py"
        spec = importlib.util.spec_from_file_location("desk_metabol", mp)
        mod = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(mod)
        ok, pace, meta = mod.platform_allows(platforms, "fund-origin-put", action=action)
        reason = str((meta or {}).get("reason") or "")
        return ok, pace, reason
    except Exception:
        return True, "ALLOW", "metabol_unavailable"



def put_live(*, task: dict | None = None, sha: str = "", dry: bool = False) -> dict:
    """Perform origin (+ optional HTML/fund) PUT for a ship_live task.

    Returns dict with keys: ok, mode, detail, sha, urls, errors (no secrets).
    """
    task = task or {}
    blob = _intent_blob(task)
    env_st = ensure_god_env()
    results: list[dict[str, Any]] = []
    errors: list[str] = []
    urls: list[str] = []
    modes: list[str] = []

    if not env_st.get("ok"):
        detail = "soft-fail: GOD_API missing (set env or ~/.config/stratamesh/god_api)"
        return {
            "ok": False,
            "mode": "no_token",
            "detail": detail,
            "sha": sha or str(task.get("sha") or ""),
            "urls": [],
            "errors": [detail],
            "env": {"ok": False, "missing": env_st.get("missing"), "sources_n": 0},
        }

    platforms = _metabol_platforms()
    force = bool(task.get("force_put") or task.get("metabol_force"))

    # Always attempt origin-archive PUT on ship path (lab default) unless metabol HOLD/STASIS.
    if _wants_origin(blob) or task.get("ship_live") or True:
        allow_o, pace_o, why_o = _gate_put(platforms, "origin")
        if force or allow_o:
            modes.append("cf-put-origin")
            r = _run_script(CF_PUT, [], dry=dry, cwd=REPO)
            results.append({"step": "cf-put-origin", **r, "metabol_pace": pace_o})
            if r.get("ok"):
                urls.append("origin-archive")
            else:
                errors.append(f"cf-put-origin:{r.get('detail')}")
        else:
            modes.append("cf-put-origin-skip")
            results.append({
                "step": "cf-put-origin",
                "ok": True,
                "skipped": True,
                "detail": f"metabol_skip pace={pace_o} {why_o}",
                "metabol_pace": pace_o,
            })

    # Pages / HTML — outside Worker bucket (always ALLOW per typology)
    if _wants_html(blob):
        allow_h, pace_h, why_h = _gate_put(platforms, "pages")
        modes.append("d1-put-html")
        if force or allow_h:
            r = _run_script(D1_PUT, ["--all"], dry=dry, cwd=REPO)
            results.append({"step": "d1-put-html", **r, "metabol_pace": pace_h or "ALLOW"})
            if r.get("ok"):
                urls.append("d1:site_content_chunks")
            else:
                errors.append(f"d1-put-html:{r.get('detail')}")
        else:
            results.append({
                "step": "d1-put-html",
                "ok": True,
                "skipped": True,
                "detail": f"metabol_skip pace={pace_h} {why_h}",
                "metabol_pace": pace_h,
            })

    if _wants_fund(blob):
        allow_f, pace_f, why_f = _gate_put(platforms, "fund")
        if force or allow_f:
            modes.append("fund-worker")
            r = _put_fund_worker(dry=dry)
            results.append({"step": "fund-worker", **r, "metabol_pace": pace_f})
            if r.get("ok"):
                urls.extend(r.get("urls") or ["stratamesh-fund"])
            else:
                errors.append(f"fund:{r.get('detail')}")
        else:
            modes.append("fund-worker-skip")
            results.append({
                "step": "fund-worker",
                "ok": True,
                "skipped": True,
                "detail": f"metabol_skip pace={pace_f} {why_f}",
                "metabol_pace": pace_f,
            })

    attempted = [r for r in results if r.get("step")]
    ok = bool(attempted) and all(r.get("ok") for r in attempted)
    if not attempted:
        ok = False
        errors.append("nothing_attempted")

    detail_parts = [f"{r.get('step')}={'ok' if r.get('ok') else 'FAIL'}" for r in results]
    detail = "; ".join(detail_parts) or "no steps"
    if dry:
        detail = "dry: " + detail

    return {
        "ok": ok,
        "mode": "+".join(modes) if modes else "none",
        "detail": detail,
        "sha": sha or str(task.get("sha") or ""),
        "urls": urls,
        "errors": errors,
        "steps": results,
        "env": {
            "ok": True,
            "sources_n": len(env_st.get("sources") or []),
            "token_len": env_st.get("token_len"),
        },
    }


def main() -> int:
    import argparse

    ap = argparse.ArgumentParser(description="Desk origin PUT (no secret echo)")
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--sha", default="")
    ap.add_argument("--intent", default="origin pages fund ship_live")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    task = {"intent": args.intent, "ship_live": True, "sha": args.sha}
    out = put_live(task=task, sha=args.sha, dry=args.dry)
    if args.json:
        print(json.dumps(out, indent=2))
    else:
        print(
            f"put_live ok={int(bool(out.get('ok')))} mode={out.get('mode')} detail={out.get('detail')}"
        )
        if out.get("errors"):
            print("errors:", "; ".join(out["errors"][:4]), file=sys.stderr)
    return 0 if out.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
