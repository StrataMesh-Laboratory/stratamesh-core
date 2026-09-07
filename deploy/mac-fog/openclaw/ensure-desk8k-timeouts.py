#!/usr/bin/env python3
"""Idempotent OpenClaw desk8k timeout pins (docs-forums path, OpenClaw 2026.9.1+).

Symptom: agent exec hangs/timeouts after tool-search on 8GB Mac + Ollama.

ONE docs-backed path (do NOT invent wrappers; skill: docs-forums-glitch-triage):
  - models.providers.ollama.timeoutSeconds = 900
    (provider HTTP + idle stream watchdog on 2026.9.x; #77744/#83979)
  - agents.defaults.timeoutSeconds = 900  (overall turn / CLI --timeout)
  - primary ollama/qwen2.5:3b-desk8k; experimental.localModelLean true
  - native api: "ollama"; baseUrl without /v1

RETIRED on 2026.9.1 (doctor rejects / strips — never write these):
  - agents.defaults.llm / idleTimeoutSeconds
  - agents.defaults.toolCallTimeoutSeconds

No secrets written. Backs up openclaw.json before mutate.
Exit 0 if already applied or successfully patched; 1 on hard failure.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
from pathlib import Path

TURN = 900
PRIMARY = "ollama/qwen2.5:3b-desk8k"
FALLBACK = "ollama/qwen2.5:3b"
RETIRED_DEFAULT_KEYS = ("llm", "toolCallTimeoutSeconds")


def _load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _needed(d: dict) -> list[str]:
    reasons: list[str] = []
    ad = (d.get("agents") or {}).get("defaults") or {}
    for k in RETIRED_DEFAULT_KEYS:
        if k in ad:
            reasons.append("retired:%s" % k)
    if int(ad.get("timeoutSeconds") or 0) < TURN:
        reasons.append("agents.defaults.timeoutSeconds<%s" % TURN)
    model = ad.get("model") if isinstance(ad.get("model"), dict) else {}
    if model.get("primary") != PRIMARY:
        reasons.append("primary!=desk8k")
    exp = ad.get("experimental") if isinstance(ad.get("experimental"), dict) else {}
    if exp.get("localModelLean") is not True:
        reasons.append("localModelLean!=true")
    prov = ((d.get("models") or {}).get("providers") or {}).get("ollama") or {}
    if int(prov.get("timeoutSeconds") or 0) < TURN:
        reasons.append("ollama.timeoutSeconds<%s" % TURN)
    if prov.get("api") != "ollama":
        reasons.append("ollama.api!=ollama")
    bu = str(prov.get("baseUrl") or "")
    if bu.endswith("/v1") or "/v1/" in bu:
        reasons.append("ollama.baseUrl_has_/v1")
    return reasons


def apply(d: dict) -> list[str]:
    changed = _needed(d)
    if not changed:
        return []
    agents = d.setdefault("agents", {})
    ad = agents.setdefault("defaults", {})
    for k in RETIRED_DEFAULT_KEYS:
        ad.pop(k, None)
    ad["timeoutSeconds"] = max(int(ad.get("timeoutSeconds") or 0), TURN)
    model = ad.setdefault("model", {})
    if not isinstance(model, dict):
        model = {}
        ad["model"] = model
    model["primary"] = PRIMARY
    fbs = model.get("fallbacks")
    if not isinstance(fbs, list) or FALLBACK not in fbs:
        model["fallbacks"] = [FALLBACK]
    exp = ad.setdefault("experimental", {})
    if not isinstance(exp, dict):
        exp = {}
        ad["experimental"] = exp
    exp["localModelLean"] = True
    models = d.setdefault("models", {})
    providers = models.setdefault("providers", {})
    ollama = providers.setdefault("ollama", {})
    ollama["timeoutSeconds"] = max(int(ollama.get("timeoutSeconds") or 0), TURN)
    ollama["api"] = "ollama"
    bu = str(ollama.get("baseUrl") or "http://127.0.0.1:11434")
    if bu.endswith("/v1"):
        bu = bu[: -len("/v1")]
    elif "/v1/" in bu:
        bu = bu.replace("/v1/", "/")
    ollama["baseUrl"] = bu or "http://127.0.0.1:11434"
    return changed


def sync_models_json(home: Path, timeout: int) -> bool:
    mp = home / ".openclaw" / "agents" / "main" / "agent" / "models.json"
    if not mp.is_file():
        return False
    md = _load(mp)
    providers = md.get("providers") or {}
    ollama = providers.get("ollama")
    if not isinstance(ollama, dict):
        return False
    cur = int(ollama.get("timeoutSeconds") or 0)
    if cur >= timeout:
        return False
    bak = mp.with_name(mp.name + ".bak-desk8k-%s" % time.strftime("%Y%m%d-%H%M%S"))
    shutil.copy2(mp, bak)
    ollama["timeoutSeconds"] = timeout
    mp.write_text(json.dumps(md, indent=2) + "\n", encoding="utf-8")
    return True


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--config", type=Path, default=None, help="openclaw.json path")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--check", action="store_true", help="exit 1 if pins missing")
    args = ap.parse_args(argv)
    home = Path.home()
    path = args.config or (home / ".openclaw" / "openclaw.json")
    if not path.is_file():
        print("missing", path, file=sys.stderr)
        return 1
    d = _load(path)
    need = _needed(d)
    if args.check:
        if need:
            print("NEED", ",".join(need))
            return 1
        print(
            "OK turn=%s ollama.timeout>=%s primary=%s lean=true no-retired-llm"
            % (TURN, TURN, PRIMARY)
        )
        return 0
    if not need:
        print("already-applied")
        sync_models_json(home, TURN)
        return 0
    if args.dry_run:
        print("would-patch", ",".join(need))
        return 0
    bak = path.with_name(path.name + ".bak-desk8k-%s" % time.strftime("%Y%m%d-%H%M%S"))
    shutil.copy2(path, bak)
    changed = apply(d)
    path.write_text(json.dumps(d, indent=2) + "\n", encoding="utf-8")
    synced = sync_models_json(home, TURN)
    print("patched", ",".join(changed), "bak=%s" % bak.name, "models_json_synced=%s" % synced)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
