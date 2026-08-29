#!/usr/bin/env python3
"""Actions-side labor: Q-gate, drift, Discourse *draft*, execute recipe.

Never git-commit, never CF PUT, never POST Discourse. Grok runs desk-execute.py.
"""
from __future__ import annotations

import importlib.util
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load(name: str, rel: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> int:
    tick = load("desk_tick", "ops/bin/desk-tick.py")
    email = os.environ.get("CLOUDFLARE_EMAIL") or "amcmorais@icloud.com"
    tok = (os.environ.get("GOD_API") or os.environ.get("CLOUDFLARE_API_TOKEN") or "").strip()
    if not tok and Path("/tmp/god_api").is_file():
        tok = Path("/tmp/god_api").read_text().strip()

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    metab = tick.cf_graphql(email, tok) if tok else {"skipped": "no GOD_API"}
    q_allow = bool(
        tok
        and isinstance(metab, dict)
        and not metab.get("error")
        and not metab.get("skipped")
        and not metab.get("circuit_hold")
        and not metab.get("circuit_stasis")
        and int(metab.get("remaining") or 0) >= 500
    )

    # Drift without exiting 1 from this process (prepare always writes a pack).
    drift_mod = load("gitlive_drift", "ops/bin/gitlive-drift.py")
    drifted = []
    rows = []
    if tok:
        old_argv = sys.argv
        sys.argv = ["gitlive-drift.py"]
        try:
            # reuse MAP + live_content
            for rel, script in drift_mod.MAP.items():
                p = ROOT / rel
                if not p.is_file():
                    continue
                git_b = p.read_bytes()
                live_b = drift_mod.live_content(tok, script)
                gs = drift_mod.sha256_bytes(git_b)
                if live_b is None:
                    rows.append({"script": script, "status": "live_fetch_fail", "git": rel})
                    continue
                ls = drift_mod.sha256_bytes(live_b)
                match = gs == ls
                rows.append({
                    "script": script,
                    "git": rel,
                    "status": "match" if match else "DRIFT",
                    "git_sha": gs[:12],
                    "live_sha": ls[:12],
                })
                if not match:
                    drifted.append(script)
        finally:
            sys.argv = old_argv

    grok_cmd = (
        "python3 ops/bin/desk-execute.py --git --live --discourse"
        + (f" --scripts {','.join(drifted)}" if drifted else "")
    )
    draft_lines = [
        f"## EDGE-GROK ops pulse {now}",
        "",
        "Lab n=1 · `mesh_member=false` · `oracle_live=false` · no 6th cron · no workers.dev.",
        "",
        f"- Q-gate: **{'ALLOW' if q_allow else 'HOLD'}**"
        + (f" remaining={metab.get('remaining')} hour_spent={metab.get('hour_spent')}" if isinstance(metab, dict) else ""),
        f"- Drift: {', '.join(drifted) if drifted else 'none (git == live)'}",
        "- Execute stays on Grok: `python3 ops/bin/desk-execute.py --git --live --discourse`",
        "",
        "Actions did the labor (tick, inventory, hashes, draft). Grok presses git + live + t/20.",
    ]
    draft = "\n".join(draft_lines) + "\n"

    pack = {
        "schema": "stratamesh.publish-pack.v1",
        "at": now,
        "q_allow": q_allow,
        "metabolism": metab,
        "drift": rows,
        "scripts": drifted,
        "discourse": {
            "forum": "https://stratamesh.discourse.group",
            "topic": 20,
            "draft": draft,
            "execute_on": "grok",
        },
        "execute": {
            "surface": "grok",
            "command": grok_cmd,
            "never_gha_put": True,
        },
        "never_workers_dev": True,
        "no_sixth_cron": True,
    }

    out = Path(os.environ.get("DESK_TICK_OUT") or "/tmp/desk-tick")
    out.mkdir(parents=True, exist_ok=True)
    (out / "PUBLISH-PACK.json").write_text(json.dumps(pack, indent=2, default=str))
    (out / "DISCOURSE-DRAFT.md").write_text(draft)
    (out / "EXECUTE.md").write_text(
        f"# Grok execute\n\nQ-gate={'ALLOW' if q_allow else 'HOLD'}\n\n```bash\n{grok_cmd}\n```\n"
    )

    md = [
        f"# desk-prepare {now}",
        "",
        f"Q-gate **{'ALLOW' if q_allow else 'HOLD'}** · drift **{len(drifted)}** · execute **Grok only**",
        "",
        "```bash",
        grok_cmd,
        "```",
        "",
        draft,
    ]
    text = "\n".join(md)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as fh:
            fh.write(text)
    sys.stdout.write(text + "\n")
    Path(out / "desk-prepare.md").write_text(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
