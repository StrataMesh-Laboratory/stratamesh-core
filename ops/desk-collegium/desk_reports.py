#!/usr/bin/env python3
"""Daily automation reports → desk-outbox (GH Actions + Discourse).

Single source of truth agents consume before specialty work.
Works from Mac desk_ops alone (gh CLI) — no Bot tokens required (bot_cap_contingency).

Writes:
  $FOG_HOME/data/desk-outbox/reports/gh-daily.md
  $FOG_HOME/data/desk-outbox/reports/discourse-daily.md
  $FOG_HOME/data/desk-outbox/reports/latest.md
  meters/reports-sync.json

Never prints secrets. Soft-ok without network.
"""
from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = "StrataMesh-Laboratory/stratamesh-core"
DISCOURSE_TOPIC = "https://stratamesh.discourse.group/t/edge-grok-ops-pulse-mesh-api-edge-discovery-lab/20"

# Candidate box/Mac state paths (sanitized pulse only — no secrets)
DISCOURSE_STATE_CANDIDATES = (
    Path.home() / "ops-monitor/state/discourse-pulse-last.json",
    Path("/home/box/ops-monitor/state/discourse-pulse-last.json"),
    Path(os.environ.get("FOG_HOME") or (Path.home() / "StrataMesh/fog"))
    / "data"
    / "desk-meters"
    / "discourse-pulse-last.json",
    HERE / "meters" / "discourse-pulse-last.json",
)


def _fog() -> Path:
    return Path(os.environ.get("FOG_HOME") or (Path.home() / "StrataMesh/fog"))


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def reports_dir() -> Path:
    d = _fog() / "data" / "desk-outbox" / "reports"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _load_actions():
    import importlib.util

    spec = importlib.util.spec_from_file_location("desk_actions", HERE / "desk_actions.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def _sanitize_discourse(raw: dict) -> dict:
    """Keep only public pulse fields — drop anything secret-shaped."""
    allow = (
        "at", "lisbon", "topic", "post_number", "url", "fog", "edge", "sha",
        "html", "title", "n", "phase", "note", "summary",
    )
    out = {k: raw[k] for k in allow if k in raw and raw[k] is not None}
    # strip accidental token-like values
    for k, v in list(out.items()):
        s = str(v)
        if any(x in s.lower() for x in ("token", "bearer", "password", "secret", "api_key")):
            out.pop(k, None)
        elif len(s) > 400:
            out[k] = s[:400] + "…"
    return out


def load_discourse_pulse() -> dict | None:
    for p in DISCOURSE_STATE_CANDIDATES:
        try:
            if p.is_file():
                raw = json.loads(p.read_text(encoding="utf-8"))
                if isinstance(raw, dict):
                    return _sanitize_discourse(raw)
        except Exception:
            continue
    return None


def write_gh_daily(*, limit: int = 12) -> dict:
    """Mirror recent desk/CI workflow conclusions into gh-daily.md."""
    out = {"ok": False, "runs": 0, "path": str(reports_dir() / "gh-daily.md"), "ts": _now()}
    lines = [
        "# GitHub Actions — daily desk brief",
        "",
        f"_synced {_now()} · repo `{REPO}` · no secrets_",
        "",
    ]
    try:
        actions = _load_actions()
        runs = actions.list_runs(limit) if hasattr(actions, "list_runs") else []
    except Exception as e:
        runs = []
        lines.append(f"_gh soft-unavailable: {e}_")
        lines.append("")
        lines.append("Agents: continue specialty work offline of Bot (bot_cap_contingency).")
        (reports_dir() / "gh-daily.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
        out["reason"] = "gh_error"
        return out

    if not runs:
        lines.append("_No runs returned (gh missing/unauth or empty). Soft-ok._")
        lines.append("")
        lines.append("Continue via Mac TUI `r` / desk_ops — do not wait for Bot.")
        (reports_dir() / "gh-daily.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
        out["reason"] = "gh_unavailable"
        out["ok"] = True  # soft
        return out

    desk_wfs = getattr(actions, "DESK_WORKFLOWS", ())
    lines.append("| Conclusion | Workflow | Title |")
    lines.append("|------------|----------|-------|")
    interesting = 0
    for r in runs:
        wf = str(r.get("workflowName") or "")
        conc = str(r.get("conclusion") or r.get("status") or "?")
        title = str(r.get("displayTitle") or "")[:60].replace("|", "/")
        if any(w in wf.lower() for w in desk_wfs) or conc == "failure":
            interesting += 1
            lines.append(f"| {conc} | {wf[:32]} | {title} |")
    if interesting == 0:
        lines.append("| — | (no desk-related in window) | — |")
    lines.append("")
    lines.append("Failures open `specialty=code` bus tasks via `desk_actions.sync`.")
    path = reports_dir() / "gh-daily.md"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    out.update({"ok": True, "runs": len(runs), "interesting": interesting, "path": str(path)})
    return out


def write_discourse_daily() -> dict:
    """Sanitized Discourse lab ops pulse → discourse-daily.md."""
    out = {"ok": True, "path": str(reports_dir() / "discourse-daily.md"), "ts": _now()}
    lines = [
        "# Discourse — lab ops pulse digest",
        "",
        f"_synced {_now()} · topic [t/20]({DISCOURSE_TOPIC}) · no secrets_",
        "",
    ]
    pulse = load_discourse_pulse()
    if not pulse:
        lines.append("_No local discourse-pulse-last.json — soft skip._")
        lines.append("")
        lines.append(f"Read public topic when online: {DISCOURSE_TOPIC}")
        lines.append("Bot routine `discourse-lab-ops-pulse` should write the same meter path agents consume.")
        out["reason"] = "no_pulse_state"
    else:
        lines.append("| Field | Value |")
        lines.append("|-------|-------|")
        for k, v in pulse.items():
            lines.append(f"| {k} | {v} |")
        lines.append("")
        if pulse.get("url"):
            lines.append(f"Link: {pulse['url']}")
        out["pulse_keys"] = list(pulse.keys())
    path = reports_dir() / "discourse-daily.md"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    out["path"] = str(path)
    return out


def write_latest(gh: dict, disc: dict) -> Path:
    md = (
        f"# Desk daily reports\n\n"
        f"_synced { _now() }_\n\n"
        f"- [GH Actions](./gh-daily.md) — ok={gh.get('ok')} runs={gh.get('runs', 0)}\n"
        f"- [Discourse](./discourse-daily.md) — ok={disc.get('ok')} reason={disc.get('reason', 'ok')}\n\n"
        f"**Agents MUST read this directory before specialty work** (self-update).\n"
        f"Bot = escalate surface; do not wait for Bot re-prompt.\n"
    )
    path = reports_dir() / "latest.md"
    path.write_text(md, encoding="utf-8")
    return path


def prepend_to_agent_briefs() -> None:
    """Prepend a one-liner pointer into *-next.md briefs if they exist."""
    box = _fog() / "data" / "desk-outbox"
    box.mkdir(parents=True, exist_ok=True)
    pointer = (
        "## Reports (read first)\n\n"
        f"See `{box / 'reports' / 'latest.md'}` — GH Actions + Discourse daily.\n"
        "Self-update before specialty work. Bot is escalate-only.\n\n"
    )
    for name in ("hermes-next.md", "opencode-next.md", "openclaw-next.md"):
        p = box / name
        try:
            if p.is_file():
                body = p.read_text(encoding="utf-8")
                if "## Reports (read first)" in body:
                    continue
                p.write_text(pointer + body, encoding="utf-8")
            else:
                p.write_text(
                    f"# Desk brief — {name.split('-')[0]}\n\n{pointer}"
                    f"Self-queue ALLOW specialty work from bus/projected.\n",
                    encoding="utf-8",
                )
        except Exception:
            pass


def sync(*, limit: int = 12, prepend: bool = True, feed: bool = True) -> dict:
    """Full reports sync — soft-ok without network/Bot."""
    gh = write_gh_daily(limit=limit)
    disc = write_discourse_daily()
    latest = write_latest(gh, disc)
    if prepend:
        prepend_to_agent_briefs()
    meter = {
        "ts": _now(),
        "gh_ok": bool(gh.get("ok")),
        "discourse_ok": bool(disc.get("ok")),
        "gh_runs": gh.get("runs", 0),
        "paths": {"gh": gh.get("path"), "discourse": disc.get("path"), "latest": str(latest)},
    }
    try:
        meters = _fog() / "data" / "desk-meters"
        meters.mkdir(parents=True, exist_ok=True)
        (meters / "reports-sync.json").write_text(json.dumps(meter, indent=2) + "\n")
    except Exception:
        pass
    if feed:
        try:
            import importlib.util

            spec = importlib.util.spec_from_file_location("desk_bus", HERE / "desk_bus.py")
            bus = importlib.util.module_from_spec(spec)
            assert spec.loader is not None
            spec.loader.exec_module(bus)
            bus.feed_append(
                "desk",
                f"reports synced gh_ok={int(bool(gh.get('ok')))} discourse_ok={int(bool(disc.get('ok')))}",
                kind="say",
                specialty="coord",
            )
        except Exception:
            pass
    return {"ok": True, "gh": gh, "discourse": disc, "latest": str(latest), "meter": meter}




def write_todo_board(state: dict | None = None, projected: dict | None = None) -> Path:
    """Human+agent readable to-do snapshot from bus state + projected catalog."""
    if state is None:
        try:
            import importlib.util
            spec = importlib.util.spec_from_file_location("desk_bus", HERE / "desk_bus.py")
            bus = importlib.util.module_from_spec(spec)
            assert spec.loader is not None
            spec.loader.exec_module(bus)
            state = bus.load_state()
        except Exception:
            state = {"open_tasks": [], "done_tasks": [], "lanes": {}}
    if projected is None:
        proj_path = HERE / "projected.json"
        try:
            projected = json.loads(proj_path.read_text(encoding="utf-8")) if proj_path.is_file() else {}
        except Exception:
            projected = {}

    open_tasks = state.get("open_tasks") or []
    ongoing, pending, escalated = [], [], []
    for t in open_tasks:
        st = (t.get("status") or "propose").lower()
        row = {
            "id": t.get("id"),
            "specialty": t.get("specialty"),
            "owner": t.get("owner"),
            "status": st,
            "eisenhower": t.get("eisenhower") or "act",
            "human_gate": bool(t.get("human_gate")),
            "intent": (t.get("intent") or "")[:120],
        }
        if st == "escalate" or t.get("human_gate"):
            escalated.append(row)
        elif st in ("constrain", "revise", "commit"):
            ongoing.append(row)
        else:
            pending.append(row)

    lines = [
        "# Desk TODO board (live)",
        "",
        f"_snapshot {_now()} · source: bus state + projected.json · no secrets_",
        "",
        "Rules: pick ONLY your specialty; human_gates escalate to STRATAGROK; diary cites task id.",
        "Wake order: CONTEXT pack → protocol → Eisenhower → this board → specialty.",
        "",
        "## Ongoing",
        "",
    ]
    if not ongoing:
        lines.append("_none_")
    else:
        lines.append("| Id | Spec | Status | Intent |")
        lines.append("|----|------|--------|--------|")
        for r in ongoing:
            lines.append(f"| `{r['id']}` | {r['specialty']} | {r['status']} | {r['intent']} |")
    lines += ["", "## Pending (propose)", ""]
    if not pending:
        lines.append("_none_")
    else:
        lines.append("| Id | Spec | Eisenhower | Intent |")
        lines.append("|----|------|------------|--------|")
        for r in pending:
            lines.append(f"| `{r['id']}` | {r['specialty']} | {r['eisenhower']} | {r['intent']} |")
    lines += ["", "## Escalated / human_gates", ""]
    if not escalated:
        lines.append("_none_")
    else:
        lines.append("| Id | Spec | Intent |")
        lines.append("|----|------|--------|")
        for r in escalated:
            lines.append(f"| `{r['id']}` | {r['specialty']} | {r['intent']} |")

    # projected backlog (not yet open)
    items = projected.get("items") or []
    lines += ["", "## Projected catalog (not yet open / held)", ""]
    if not items:
        lines.append("_empty projected.json_")
    else:
        lines.append("| Id | Spec | Eisenhower | Hold | Intent |")
        lines.append("|----|------|------------|------|--------|")
        for it in items[:24]:
            lines.append(
                f"| `{it.get('id')}` | {it.get('specialty')} | {it.get('eisenhower') or 'act'} | "
                f"{it.get('hold_until') or '—'} | {(it.get('intent') or '')[:80]} |"
            )

    lanes = state.get("lanes") or {}
    if lanes:
        lines += ["", "## Metabol lanes", ""]
        for k, v in lanes.items():
            if isinstance(v, dict):
                lines.append(f"- `{k}`: {v.get('pace', v)}")
            else:
                lines.append(f"- `{k}`: {v}")

    box = _fog() / "data" / "desk-outbox"
    box.mkdir(parents=True, exist_ok=True)
    path = box / "TODO.md"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    # alias
    (box / "board.md").write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
    return path


def write_context_pack(state: dict | None = None, projected: dict | None = None) -> Path:
    """Shared CMN + StrataMesh context pack — read-only pointers, no secrets / no Bot-private memory."""
    if projected is None:
        try:
            projected = json.loads((HERE / "projected.json").read_text(encoding="utf-8"))
        except Exception:
            projected = {}
    milestone = (projected.get("roadmap") or projected.get("current") or
                 (projected.get("meta") or {}).get("milestone") or "M-I")
    # try state roadmap
    if state and isinstance(state.get("roadmap"), dict):
        milestone = state["roadmap"].get("current") or milestone
    elif isinstance(projected.get("milestone"), str):
        milestone = projected["milestone"]

    md = f"""# CONTEXT — CMN + StrataMesh (shared desk pack)

_regenerated {_now()} · read-only pointers · **no secrets** · not Bot-private memory_

## Wake order (mandatory)

1. This CONTEXT pack
2. `ops/desk-collegium/protocol.json` (laws)
3. Eisenhower: one Act; Delegate Fog|EDGE split; Plan/Note parked — `docs/FOG-DESK-PROTOCOL.md` + `docs/FOG-DESK-OPS.md`
4. Live TODO board: `desk-outbox/TODO.md`
5. Daily reports: `desk-outbox/reports/latest.md`
6. Your specialty work (self-queue from board)

## CMN (Nó Calhegas Morais)

- Mandate: Fog automation desk on **FOG-NODE-PT-CM-001**, identity `grok@calhegasmorais.pt`
- Contract: `ops/EDGE-GROK-DESK-CONTRACT.md`
- Archive Instructions: `docs/NO-CALHEGAS-MORAIS-INSTRUCTIONS.md`
- Desk docs: `docs/FOG-DESK-AGENTS.md`, `FOG-DESK-SPECIALIZATION.md`, `FOG-DESK-COLLEGIUM.md`, `FOG-DESK-AUTONOMY.md`
- Collegium bus: `ops/desk-collegium/` (`desk_bus.py`, `desk_ops.py cycle`)
- Academy: SCA (PT) / ACB (EN) are **students**; desk agents are **teachers/mentors** — never enroll as students
- Bot = escalate surface; agents = self-initiative + self-audit (`agent_autonomy`, `bot_cap_contingency`)

## StrataMesh proper

- Spine: `docs/ROADMAP-VISION.md` (when present on origin)
- Current desk milestone focus: **{milestone}**
- Public origin: https://calhegasmorais.pt · fog · sandbox · bancada (account-required atelier)
- Repo: `StrataMesh-Laboratory/stratamesh-core`
- Catalog/SCA rules: protocol `no_sca` + academy block in `protocol.json`
- Deny: workers.dev · secrets in git/chat · Reddit · ENI geral@ mix

## Live desk surfaces

| Surface | Path |
|---------|------|
| TODO board | `$FOG_HOME/data/desk-outbox/TODO.md` |
| GH daily | `$FOG_HOME/data/desk-outbox/reports/gh-daily.md` |
| Discourse daily | `$FOG_HOME/data/desk-outbox/reports/discourse-daily.md` |
| Context (this) | `$FOG_HOME/data/desk-outbox/CONTEXT-CMN-STRATAMESH.md` |
| Collegium state | `$FOG_HOME/data/desk-collegium/state.json` |
| Meters | `$FOG_HOME/data/desk-meters/` |

## Fog vs EDGE (Archive roles)

- **CMN FOG ASSISTANT:** Fog git+live (origin Pages, hops, auth/mw)
- **CMN EDGE ASSISTANT:** EDGE **GET consume-only** — no origin write / no Fog bind

## Hermes / OpenCode / OpenClaw

Native Mac desk (not Bot desktop). Hermes context ≥64k. Load this pack path each pulse.
"""
    box = _fog() / "data" / "desk-outbox"
    box.mkdir(parents=True, exist_ok=True)
    path = box / "CONTEXT-CMN-STRATAMESH.md"
    path.write_text(md, encoding="utf-8")
    # repo template for tests / git
    tmpl = HERE / "templates" / "CONTEXT-CMN-STRATAMESH.md"
    try:
        tmpl.parent.mkdir(parents=True, exist_ok=True)
        if not tmpl.is_file():
            tmpl.write_text(md, encoding="utf-8")
    except Exception:
        pass
    return path




JOURNAL_AGENTS = (
    ("stratagrok", "lead"),
    ("hermes", "coord"),
    ("opencode", "code"),
    ("openclaw", "claw"),
    ("fog-assistant", "fog"),
    ("edge-assistant", "edge"),
)


def ensure_agent_journals() -> dict:
    """Create 6× diary+notebook seeds if missing — never wipe existing diary."""
    root = _fog() / "data" / "desk-outbox" / "journals"
    root.mkdir(parents=True, exist_ok=True)
    created = []
    for aid, spec in JOURNAL_AGENTS:
        d = root / aid
        d.mkdir(parents=True, exist_ok=True)
        diary = d / "diary.md"
        nb = d / "notebook.md"
        if not diary.is_file():
            diary.write_text(
                f"# Diary — {aid}\n\n"
                f"Specialty: {spec}\n\n"
                f"Rules: cite task id from TODO.md when acting; Bot=escalate only.\n\n"
                f"## Entries\n\n",
                encoding="utf-8",
            )
            created.append(str(diary))
        if not nb.is_file():
            nb.write_text(
                f"# Notebook — {aid}\n\n"
                f"## Mandatory wake order\n\n"
                f"1. desk-outbox/CONTEXT-CMN-STRATAMESH.md\n"
                f"2. ops/desk-collegium/protocol.json\n"
                f"3. docs/FOG-DESK-PROTOCOL.md + FOG-DESK-OPS.md (Eisenhower)\n"
                f"4. desk-outbox/TODO.md\n"
                f"5. desk-outbox/reports/latest.md\n"
                f"6. Specialty self-audit + self-queue from board\n\n"
                f"## Specialty notes\n\n",
                encoding="utf-8",
            )
            created.append(str(nb))
    return {"root": str(root), "created": created, "agents": [a for a, _ in JOURNAL_AGENTS]}




GITIGNORE_SECRET_NEEDLES = (
    "**/secrets.env",
    "**/desk-mail.token",
    "**/.config/stratagrok/**",
    "**/.config/stratamesh/**",
    "**/desk-outbox/**/secrets*",
    "**/tailscale-*.key",
    "*.kdbx",
)

VAULT_AGENT_IDS = (
    "stratagrok", "hermes", "opencode", "openclaw", "fog-assistant", "edge-assistant",
)


def verify_vault_surfaces() -> dict:
    """Ensure gitignore needles + VAULT.md templates exist. Never copy secret values."""
    repo_root = HERE.parents[1]  # stratamesh-core root when ops/desk-collegium/
    gi = repo_root / ".gitignore"
    missing_gi = []
    gi_text = gi.read_text(encoding="utf-8") if gi.is_file() else ""
    for needle in GITIGNORE_SECRET_NEEDLES:
        if needle not in gi_text:
            missing_gi.append(needle)
    # VAULT templates under ops/desk-collegium/agents/<id>/VAULT.md
    agents_root = HERE / "agents"
    agents_root.mkdir(parents=True, exist_ok=True)
    created = []
    for aid in VAULT_AGENT_IDS:
        vp = agents_root / aid / "VAULT.md"
        if not vp.is_file():
            vp.parent.mkdir(parents=True, exist_ok=True)
            vp.write_text(
                f"# Vault pointer — {aid}\n\n"
                f"See ops/desk-collegium/SECRETS-VAULT.md. Full access; never print values.\n",
                encoding="utf-8",
            )
            created.append(str(vp))
    secrets_doc = HERE / "SECRETS-VAULT.md"
    return {
        "ok": not missing_gi and secrets_doc.is_file(),
        "gitignore_missing": missing_gi,
        "secrets_doc": secrets_doc.is_file(),
        "vault_md_created": created,
        "vault_md_ok": all((agents_root / a / "VAULT.md").is_file() for a in VAULT_AGENT_IDS),
        "note": "never copies secret values into outbox",
    }


def ensure_desk_surfaces(*, limit: int = 12, state: dict | None = None, feed: bool = True) -> dict:
    """Idempotent cycle-owned refresh. Soft-fail if gh/discourse unavailable.
    Bot never required. Called from desk_ops cycle + desk-agent-run.
    """
    out = {"ts": _now(), "ok": True, "steps": {}}
    try:
        out["steps"]["journals"] = ensure_agent_journals()
    except Exception as e:
        out["steps"]["journals"] = {"ok": False, "err": str(e)[:120]}
    try:
        out["steps"]["vault"] = verify_vault_surfaces()
    except Exception as e:
        out["steps"]["vault"] = {"ok": False, "err": str(e)[:120]}
    try:
        out["steps"]["todo"] = str(write_todo_board(state=state))
    except Exception as e:
        out["steps"]["todo"] = f"err:{e.__class__.__name__}"
        out["ok"] = False
    try:
        out["steps"]["context"] = str(write_context_pack(state=state))
    except Exception as e:
        out["steps"]["context"] = f"err:{e.__class__.__name__}"
        out["ok"] = False
    try:
        rep = sync(limit=limit, prepend=True, feed=False)
        out["steps"]["reports"] = {
            "gh_ok": bool((rep.get("gh") or {}).get("ok")),
            "discourse_ok": bool((rep.get("discourse") or {}).get("ok")),
            "latest": rep.get("latest"),
        }
    except Exception as e:
        out["steps"]["reports"] = {"ok": False, "err": str(e)[:120]}
        # soft — bot_cap / offline
    # meters stamp
    try:
        meters = _fog() / "data" / "desk-meters"
        meters.mkdir(parents=True, exist_ok=True)
        stamp = {"surfaces_updated_at": _now(), "ok": out["ok"], "steps": list(out["steps"].keys())}
        (meters / "surfaces_ok.json").write_text(json.dumps(stamp, indent=2) + "\n")
        # roles stamp soft
        roles_p = HERE / "agent_roles.json"
        if roles_p.is_file():
            import json as _json
            roles = _json.loads(roles_p.read_text(encoding="utf-8"))
            # do not mutate repo file on Mac cycle — write meter only
            (meters / "roles_ok.json").write_text(
                _json.dumps({
                    "surfaces_updated_at": _now(),
                    "members": len(roles.get("members") or []),
                    "required_ids_ok": sorted(roles.get("required_ids") or []) == sorted(
                        [m["id"] for m in (roles.get("members") or [])]
                    ),
                    "reads_todo_board": all(m.get("reads_todo_board") for m in (roles.get("members") or [])),
                }, indent=2) + "\n"
            )
        out["steps"]["meters"] = str(meters / "surfaces_ok.json")
    except Exception as e:
        out["steps"]["meters"] = f"err:{e.__class__.__name__}"
    if feed:
        try:
            import importlib.util
            spec = importlib.util.spec_from_file_location("desk_bus", HERE / "desk_bus.py")
            busmod = importlib.util.module_from_spec(spec)
            assert spec.loader is not None
            spec.loader.exec_module(busmod)
            busmod.feed_append(
                "desk",
                f"surfaces refreshed ok={int(out['ok'])} (TODO/CONTEXT/reports/journals)",
                kind="say",
                specialty="coord",
            )
        except Exception:
            pass
    return out


def ensure_outbox_pack(*, limit: int = 12, state: dict | None = None) -> dict:
    """reports.sync + TODO board + CONTEXT pack — Mac-only OK (bot_cap_contingency)."""
    todo = write_todo_board(state=state)
    ctx = write_context_pack(state=state)
    rep = sync(limit=limit, prepend=True, feed=False)
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location("desk_bus", HERE / "desk_bus.py")
        bus = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(bus)
        bus.feed_append("desk", "reports synced + TODO/CONTEXT pack", kind="say", specialty="coord")
    except Exception:
        pass
    return {"todo": str(todo), "context": str(ctx), "reports": rep}


def cmd_sync(args: argparse.Namespace) -> int:
    out = sync(limit=args.limit, prepend=not args.no_prepend, feed=not args.no_feed)
    print(json.dumps({"ok": out["ok"], "gh_ok": out["gh"].get("ok"), "discourse_ok": out["discourse"].get("ok"), "latest": out["latest"]}, indent=2))
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Desk daily reports sync (GH + Discourse → outbox)")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("sync", help="write reports/ + optional brief prepend")
    s.add_argument("--limit", type=int, default=12)
    s.add_argument("--no-prepend", action="store_true")
    s.add_argument("--no-feed", action="store_true")
    e = sub.add_parser("ensure-pack", help="TODO + CONTEXT + reports + journals (alias ensure-surfaces)")
    sub.add_parser("ensure-surfaces", help="idempotent cycle surfaces refresh")
    e.add_argument("--limit", type=int, default=12)
    args = p.parse_args()
    if args.cmd == "sync":
        return cmd_sync(args)
    if args.cmd in ("ensure-pack", "ensure-surfaces"):
        out = ensure_desk_surfaces(limit=args.limit)
        print(json.dumps(out, indent=2, default=str))
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
