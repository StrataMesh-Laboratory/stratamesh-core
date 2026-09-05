#!/usr/bin/env python3
"""Host SDK → api-edge wizard e2e (Fog/EDGE executing host, or box fail-open).

Flow: local Ollama (or fail-open templates) → POST /v1/wizard/parse →
POST /v1/wizard/commit/{flow} for account | join-mesh | register-deps.

Fail-open path works WITHOUT Mac (Ollama absent / forced dead host).
Never prints secrets. oracle_live stays false (Worker contract). TUI ? FAQ not touched.

Env:
  API_EDGE_BASE (preferred) or API_EDGE_ORIGIN — default https://api-edge.calhegasmorais.pt
  OLLAMA_HOST — default http://127.0.0.1:11434 (native loopback only)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ops" / "lib"))
import ollama_local as ol  # noqa: E402

API = (
    os.environ.get("API_EDGE_BASE")
    or os.environ.get("API_EDGE_ORIGIN")
    or "https://api-edge.calhegasmorais.pt"
).rstrip("/")
# Keep SDK module aligned when BASE was set first
os.environ.setdefault("API_EDGE_ORIGIN", API)
FLOWS = ("account", "join-mesh", "register-deps")

_SECRET_RE = re.compile(
    r"(password|passwd|secret|token|api[_-]?key|authorization|bearer|private[_-]?key)",
    re.I,
)


def _secret_field(name: str) -> bool:
    if hasattr(ol, "secretField"):
        return bool(ol.secretField(name))
    return bool(_SECRET_RE.search(str(name or "")))


def _http(method: str, url: str, body: dict | None = None, timeout: float = 30.0, *, _retries: int = 5) -> dict:
    import time

    data = None if body is None else json.dumps(body).encode("utf-8")
    last: dict = {}
    for attempt in range(_retries + 1):
        req = urllib.request.Request(
            url,
            data=data,
            method=method,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "stratamesh-wizard-e2e/1.0 (+lab; oracle_live=false)",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read().decode("utf-8")
                try:
                    out = json.loads(raw)
                except json.JSONDecodeError:
                    out = {"raw": raw[:400]}
                out["_http"] = r.status
                return out
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8", errors="replace")
            try:
                out = json.loads(raw)
            except json.JSONDecodeError:
                out = {"raw": raw[:400]}
            out["_http"] = e.code
            out["_error"] = str(e)
            last = out
            if e.code in (429, 403, 503) and attempt < _retries:
                ra = e.headers.get("Retry-After") if e.headers else None
                try:
                    wait = float(ra) if ra else (4.0 * (attempt + 1))
                except ValueError:
                    wait = 4.0 * (attempt + 1)
                wait = min(max(wait, 2.0), 60.0)
                time.sleep(wait)
                continue
            return out
    return last


def _lab_fill(flow: str, intent: dict) -> dict:
    """Ensure fail-open stubs pass Worker schema (empty templates → lab placeholders)."""
    out = dict(intent or {})
    out["flow"] = flow
    if flow == "account":
        if not str(out.get("email") or "").strip() and not str(out.get("display_name") or "").strip():
            out["display_name"] = "lab-wizard-e2e"
            out["email"] = "lab-wizard-e2e@example.invalid"
        else:
            if not str(out.get("email") or "").strip():
                out["email"] = "lab-wizard-e2e@example.invalid"
            if not str(out.get("display_name") or "").strip():
                out["display_name"] = "lab-wizard-e2e"
        out.setdefault("locale", "pt")
        out.setdefault("accept_lab_terms", True)
    elif flow == "join-mesh":
        if not str(out.get("node_id") or "").startswith(("FOG", "EDGE")):
            out["node_id"] = "EDGE-WIZARD-E2E-001"
        out.setdefault("role", "edge")
        out.setdefault("parent_fog", "FOG-NODE-PT-CM-001")
        out.setdefault("health_url", f"{API}/health")
        out.setdefault("spare_capacity_only", True)
    elif flow == "register-deps":
        deps = out.get("dependencies")
        if not isinstance(deps, list) or not deps:
            deps = [{}]
        fixed = []
        for i, d in enumerate(deps):
            d = dict(d or {})
            if not str(d.get("id") or "").strip():
                d["id"] = f"dep-wizard-e2e-{i+1}"
            if not str(d.get("name") or "").strip():
                d["name"] = f"wizard-e2e-dep-{i+1}"
            if not str(d.get("type") or "").strip():
                d["type"] = "contributor_edge"
            if not str(d.get("node_id") or "").strip():
                d["node_id"] = "EDGE-WIZARD-E2E-DEP"
            if not str(d.get("health_url") or "").strip():
                d["health_url"] = f"{API}/health"
            fixed.append(d)
        out["dependencies"] = fixed
    for k in list(out.keys()):
        if _secret_field(k):
            out.pop(k, None)
    return out


def run_flow(flow: str, *, force_fail_open: bool, dry_run_sdk: bool) -> dict:
    if force_fail_open:
        # Point at a dead local port so chat fails → fail_open templates (works off-Mac)
        os.environ["OLLAMA_HOST"] = "http://127.0.0.1:1"
        gen = ol.wizard(flow, f"e2e {flow}")
    elif dry_run_sdk:
        gen = ol.wizard(flow, dry_run=True)
        return {"flow": flow, "sdk": gen, "skipped_commit": True, "reason": "sdk_dry_run"}
    else:
        os.environ["OLLAMA_HOST"] = os.environ.get("OLLAMA_HOST") or "http://127.0.0.1:11434"
        gen = ol.wizard(flow, f"e2e minimal lab {flow}")

    intent = gen.get("json") if isinstance(gen.get("json"), dict) else {}
    if not intent and isinstance(gen.get("content"), str) and gen["content"].strip().startswith("{"):
        try:
            intent = json.loads(gen["content"])
        except json.JSONDecodeError:
            intent = {}
    intent = _lab_fill(flow, intent)

    parsed = _http("POST", f"{API}/v1/wizard/parse", intent)
    committed = None
    if parsed.get("ok"):
        committed = _http("POST", f"{API}/v1/wizard/commit/{flow}", intent)
    return {
        "flow": flow,
        "sdk_ok": bool(gen.get("ok")),
        "fail_open": bool(gen.get("fail_open")),
        "ollama_error": gen.get("ollama_error") or gen.get("error"),
        "intent_keys": sorted(intent.keys()),
        "parse": {"ok": parsed.get("ok"), "http": parsed.get("_http"), "error": parsed.get("error")},
        "commit": None
        if committed is None
        else {
            "ok": committed.get("ok"),
            "http": committed.get("_http"),
            "committed": committed.get("committed"),
            "error": committed.get("error"),
            "stored": committed.get("stored"),
            "count": committed.get("count"),
        },
    }


def fog_public_pulse(timeout: float = 8.0) -> dict:
    """Observe public Fog /health. Not a gate. oracle_live stays whatever Fog emits (false)."""
    url = os.environ.get("FOG_PUBLIC_URL") or "https://fog.calhegasmorais.pt/health"
    out = _http("GET", url, timeout=timeout)
    http = out.get("_http")
    origin = out.get("origin")
    mac_live = bool(out.get("mac_live")) or origin == "macbook"
    reachable = bool(out.get("ok")) and http == 200 and mac_live
    metabol = out.get("metabol")
    pace = None
    if isinstance(metabol, dict):
        pace = metabol.get("decision") or metabol.get("pace")
    return {
        "url": url,
        "http": http,
        "ok": bool(out.get("ok")),
        "origin": origin,
        "mac_live": bool(out.get("mac_live")),
        "mac_fog_reachable": reachable,
        "n": out.get("n"),
        "oracle_live": out.get("oracle_live") if "oracle_live" in out else False,
        "metabol_pace": pace,
        "version": out.get("version") or out.get("release"),
    }


def desk_board_mirror() -> dict:
    """Git-tracked collegium board — readable on box while $FOG_HOME on Mac is asleep."""
    path = ROOT / "ops" / "desk-collegium" / "state.json"
    rec: dict = {"path": str(path.relative_to(ROOT)), "present": path.is_file()}
    if not path.is_file():
        return rec
    try:
        st = json.loads(path.read_text(encoding="utf-8"))
        rec["open"] = len(st.get("open_tasks") or [])
        rec["done"] = len(st.get("done_tasks") or [])
        rec["updated"] = st.get("updated")
    except Exception as e:
        rec["error"] = type(e).__name__
    return rec


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Wizard host SDK → api-edge e2e")
    ap.add_argument(
        "--fail-open",
        "--fail-open-only",
        dest="fail_open_only",
        action="store_true",
        help="force Ollama-down fail-open → parse → commit (no Mac required)",
    )
    ap.add_argument("--sdk-dry-run", action="store_true", help="SDK dry-run only (no POST)")
    ap.add_argument(
        "--both",
        action="store_true",
        help="local Ollama path then forced fail-open → parse → commit for all flows",
    )
    args = ap.parse_args(argv)

    health = _http("GET", f"{API}/health")
    index = _http("GET", f"{API}/v1/wizard")
    try:
        ping = ol.ping()
    except SystemExit as e:
        ping = {"ok": False, "error": str(e)[:200]}

    fog = fog_public_pulse()
    report: dict = {
        "api": API,
        "health_version": health.get("version"),
        "health_http": health.get("_http"),
        "wizard_ok": index.get("ok"),
        "tui_question_wizard": (index.get("policy") or {}).get("tui_question_wizard"),
        "oracle_live": False,
        "metabol_pace": fog.get("metabol_pace"),
        "mac_fog_reachable": fog.get("mac_fog_reachable"),
        "fog_public": fog,
        "desk_board_mirror": desk_board_mirror(),
        "ollama_ping": {"ok": ping.get("ok"), "models": (ping.get("models") or [])[:5]},
        "runs": [],
    }

    if args.both:
        modes = [False, True]
    elif args.fail_open_only:
        modes = [True]
    else:
        modes = [False]

    ok_all = True
    for force in modes:
        label = "fail_open" if force else "ollama_or_fail_open"
        for flow in FLOWS:
            import time
            time.sleep(1.5)  # pace CF rate limit from shared box egress
            row = run_flow(flow, force_fail_open=force, dry_run_sdk=args.sdk_dry_run)
            row["mode"] = label
            report["runs"].append(row)
            if args.sdk_dry_run:
                if not row.get("sdk", {}).get("ok"):
                    ok_all = False
            else:
                if not (row.get("parse", {}).get("ok") and row.get("commit", {}).get("ok")):
                    ok_all = False

    report["ok"] = ok_all
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if ok_all else 1


if __name__ == "__main__":
    raise SystemExit(main())
