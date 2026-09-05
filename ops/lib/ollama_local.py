#!/usr/bin/env python3
"""Local native Ollama SDK for Fog/EDGE executing hosts.

NATIVE ONLY: talks to OLLAMA_HOST (default http://127.0.0.1:11434).
Never points at remote/cloud LLM. Used by api-edge smart wizard runners
on the host that executes the wizard — not by Cloudflare Workers.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any

DEFAULT_HOST = "http://127.0.0.1:11434"
API_EDGE = os.environ.get("API_EDGE_ORIGIN") or "https://api-edge.calhegasmorais.pt"

FLOWS = ("account", "join-mesh", "register-deps")


def _host() -> str:
    h = (os.environ.get("OLLAMA_HOST") or DEFAULT_HOST).rstrip("/")
    # Refuse obvious remote / non-loopback defaults in automation
    if os.environ.get("OLLAMA_ALLOW_NONLOCAL") == "1":
        return h
    low = h.lower()
    if "127.0.0.1" in low or "localhost" in low or low.startswith("http://[::1]"):
        return h
    raise SystemExit(
        f"refusing non-local OLLAMA_HOST={h!r} — native Ollama must be on executing host "
        "(set OLLAMA_ALLOW_NONLOCAL=1 only for explicit lab override)"
    )


def _get(path: str, timeout: float = 8.0) -> dict[str, Any]:
    req = urllib.request.Request(_host() + path, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _post(path: str, body: dict[str, Any], timeout: float = 120.0) -> dict[str, Any]:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        _host() + path,
        data=data,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def ping() -> dict[str, Any]:
    try:
        tags = _get("/api/tags", timeout=5.0)
    except Exception as e:
        return {"ok": False, "host": _host(), "error": str(e)[:200], "native": True}
    models = [m.get("name") for m in (tags.get("models") or []) if m.get("name")]
    return {
        "ok": True,
        "host": _host(),
        "native": True,
        "models": models,
        "default_model": os.environ.get("OLLAMA_MODEL") or (models[0] if models else None),
    }


def chat(prompt: str, *, system: str | None = None, model: str | None = None) -> dict[str, Any]:
    m = model or os.environ.get("OLLAMA_MODEL")
    if not m:
        p = ping()
        m = p.get("default_model")
    if not m:
        return {"ok": False, "error": "no_local_model"}
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    try:
        out = _post(
            "/api/chat",
            {"model": m, "messages": messages, "stream": False, "format": "json"},
            timeout=180.0,
        )
    except urllib.error.HTTPError as e:
        # older ollama may not support format=json — retry plain
        try:
            out = _post(
                "/api/chat",
                {"model": m, "messages": messages, "stream": False},
                timeout=180.0,
            )
        except Exception as e2:
            return {"ok": False, "error": f"http:{e.code}:{e2}"[:200], "model": m}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200], "model": m}
    content = ((out.get("message") or {}).get("content")) or out.get("response") or ""
    parsed: Any = None
    try:
        parsed = json.loads(content)
    except Exception:
        # try extract JSON object
        start, end = content.find("{"), content.rfind("}")
        if start >= 0 and end > start:
            try:
                parsed = json.loads(content[start : end + 1])
            except Exception:
                parsed = None
    return {
        "ok": True,
        "native": True,
        "host": _host(),
        "model": m,
        "content": content,
        "json": parsed,
    }


SYSTEM = {
    "account": (
        "You are the StrataMesh Fog/EDGE local wizard on the operator host. "
        "Output ONLY JSON: {\"flow\":\"account\",\"email\":\"\",\"display_name\":\"\",\"locale\":\"pt|en\","
        "\"accept_lab_terms\":true,\"notes\":\"\"}. Never ask for or echo passwords/tokens/API keys."
    ),
    "join-mesh": (
        "You are the StrataMesh local wizard. Output ONLY JSON: "
        "{\"flow\":\"join-mesh\",\"node_id\":\"FOG-|EDGE-…\",\"role\":\"fog|edge\","
        "\"parent_fog\":\"FOG-NODE-PT-CM-001\",\"health_url\":\"https://…/health\","
        "\"spare_capacity_only\":true,\"notes\":\"\"}. Never invent secrets."
    ),
    "register-deps": (
        "You are the StrataMesh local wizard. Output ONLY JSON: "
        "{\"flow\":\"register-deps\",\"dependencies\":[{\"id\":\"\",\"name\":\"\","
        "\"type\":\"contributor_edge\",\"node_id\":\"\",\"health_url\":\"\"}]}. "
        "Reject any secret/password/token fields. Lab catalog only."
    ),
}


def wizard(flow: str, user_text: str = "", *, dry_run: bool = False) -> dict[str, Any]:
    if flow not in FLOWS:
        return {"ok": False, "error": "unknown_flow", "flows": list(FLOWS)}
    prompt = user_text.strip() or f"Draft a minimal valid {flow} intent for lab use."
    if dry_run:
        return {
            "ok": True,
            "dry_run": True,
            "flow": flow,
            "system": SYSTEM[flow],
            "prompt": prompt,
            "ollama": ping(),
            "next": f"POST {API_EDGE}/v1/wizard/parse then /v1/wizard/commit/{flow}",
        }
    gen = chat(prompt, system=SYSTEM[flow])
    gen["flow"] = flow
    gen["api_edge"] = API_EDGE
    return gen


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Local native Ollama SDK (executing host only)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("ping")
    w = sub.add_parser("wizard")
    w.add_argument("flow", choices=FLOWS)
    w.add_argument("--text", default="")
    w.add_argument("--dry-run", action="store_true")
    w.add_argument("--model", default=None)
    args = ap.parse_args(argv)
    if args.cmd == "ping":
        print(json.dumps(ping(), indent=2))
        return 0
    if args.model:
        os.environ["OLLAMA_MODEL"] = args.model
    out = wizard(args.flow, args.text, dry_run=args.dry_run)
    print(json.dumps(out, indent=2, ensure_ascii=False))
    return 0 if out.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
