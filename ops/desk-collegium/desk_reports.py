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
                "hermes",
                f"reports gh_ok={int(bool(gh.get('ok')))} discourse_ok={int(bool(disc.get('ok')))}",
                kind="audit",
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


def append_diary(agent_id: str, *, verb: str, task_id: str, note: str = "") -> Path | None:
    """Append one diary line: verb + task_id (and optional note). Creates journal if missing."""
    ensure_agent_journals()
    root = _fog() / "data" / "desk-outbox" / "journals" / agent_id
    root.mkdir(parents=True, exist_ok=True)
    diary = root / "diary.md"
    if not diary.is_file():
        diary.write_text(
            f"# Diary — {agent_id}\n\n## Entries\n\n",
            encoding="utf-8",
        )
    ts = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    line = f"- {ts} **{verb}** `{task_id}`"
    if note:
        line += f" — {note.replace(chr(10), ' ')[:160]}"
    line += "\n"
    with diary.open("a", encoding="utf-8") as f:
        f.write(line)
    return diary


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
    "**/automation.desk.imap",
    "**/automation.desk.smtp",
    "**/automation.desk.token",
    "**/mail/automation.desk/**",
)

DESK_MAIL_VAULT_NAMES = (
    "automation.desk.imap",
    "automation.desk.smtp",
    "automation.desk.token",
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



def try_materialize_desk_mail_vault() -> dict:
    """STRATAGROK representative: copy automation.desk.* from existing secrets.env / vault roots.

    Never invent values. Never print secrets. Never write 0-byte stubs. Prefer KeePass Mail/AUTOMATION_DESK_* via stratagrok-vault; if sources missing entirely → escalate_to_andre.
    """
    import re
    import shutil
    dest_root = Path.home() / ".config/stratagrok"
    try:
        dest_root.mkdir(parents=True, exist_ok=True)
        dest_root.chmod(0o700)
    except Exception:
        pass
    sources = [
        Path.home() / ".config/stratagrok" / "secrets.env",
        Path.home() / ".config/stratamesh" / "secrets.env",
        _fog() / "data" / "secrets" / "secrets.env",
        Path.home() / ".config/stratamesh" / "automation.desk.env",
    ]
    # Also accept already-split files in stratamesh or fog secrets
    name_map = {
        "automation.desk.imap": ("AUTOMATION_DESK_IMAP", "IMAP"),
        "automation.desk.smtp": ("AUTOMATION_DESK_SMTP", "SMTP"),
        "automation.desk.token": ("AUTOMATION_DESK_TOKEN", "DESK_MAIL_TOKEN", "AUTH_RECOVERY_TOKEN"),
    }
    created = []
    skipped_present = []
    missing_src = []
    for name, keys in name_map.items():
        dest = dest_root / name
        if dest.is_file() and dest.stat().st_size > 0:
            skipped_present.append(name)
            continue
        # prefer identical filename elsewhere
        found_file = None
        for root in (
            Path.home() / ".config/stratamesh",
            _fog() / "data" / "secrets",
            Path.home() / ".config/stratagrok",
        ):
            cand = root / name
            if cand.is_file() and cand.stat().st_size > 0 and cand.resolve() != dest.resolve():
                found_file = cand
                break
        if found_file is not None:
            try:
                shutil.copy2(found_file, dest)
                dest.chmod(0o600)
                created.append(name)
                continue
            except Exception:
                pass
        # KeePass via stratagrok-vault (Mail/AUTOMATION_DESK_*) — never print values
        try:
            import shutil as _shutil
            import subprocess
            vault_bin = _shutil.which("stratagrok-vault") or str(Path.home() / ".local/bin/stratagrok-vault")
            title = {
                "automation.desk.imap": "AUTOMATION_DESK_IMAP",
                "automation.desk.smtp": "AUTOMATION_DESK_SMTP",
                "automation.desk.token": "AUTOMATION_DESK_TOKEN",
            }.get(name)
            if title and Path(vault_bin).is_file():
                raw = subprocess.check_output(
                    [vault_bin, "get", title], text=True, stderr=subprocess.DEVNULL
                ).strip()
                if raw:
                    if name.endswith(".token"):
                        body = raw + "\n"
                    elif name.endswith(".imap"):
                        body = (
                            "MAIL_MODE=imap\nIMAP_HOST=127.0.0.1\nIMAP_PORT=143\n"
                            f"IMAP_USER=automation.desk\nIMAP_PASS={raw}\nIMAP_SSL=false\n"
                            "MAILDIR=/home/box/mail/automation.desk\n"
                            "ADDRESS=automation.desk@calhegasmorais.pt\n"
                        )
                    else:
                        body = (
                            "SMTP_MODE=maildir_drop\nSMTP_HOST=127.0.0.1\nSMTP_PORT=0\n"
                            f"SMTP_USER=automation.desk\nSMTP_PASS={raw}\n"
                            "SMTP_FROM=automation.desk@calhegasmorais.pt\n"
                            "MAILDIR=/home/box/mail/automation.desk\n"
                        )
                    tmp = dest.with_suffix(dest.suffix + ".tmp")
                    tmp.write_text(body, encoding="utf-8")
                    tmp.chmod(0o600)
                    tmp.replace(dest)
                    created.append(name)
                    continue
        except Exception:
            pass
        # Also mirror auth-recovery.token → automation.desk.token when present
        if name.endswith(".token"):
            for cand in (
                Path.home() / ".config/stratagrok/auth-recovery.token",
                Path.home() / ".config/stratamesh/auth-recovery.token",
            ):
                if cand.is_file() and cand.stat().st_size > 0:
                    try:
                        tmp = dest.with_suffix(dest.suffix + ".tmp")
                        tmp.write_bytes(cand.read_bytes().strip() + b"\n")
                        tmp.chmod(0o600)
                        tmp.replace(dest)
                        created.append(name)
                        break
                    except Exception:
                        pass
            if name in created:
                continue
        # parse secrets.env for KEY=value blocks (paths only logged)
        blob = ""
        for src in sources:
            if src.is_file() and src.stat().st_size > 0:
                try:
                    blob = src.read_text(encoding="utf-8", errors="replace")
                    break
                except Exception:
                    continue
        extracted = None
        if blob:
            for key in keys:
                m = re.search(rf"(?m)^{re.escape(key)}=(.*)$", blob)
                if m and m.group(1).strip():
                    extracted = m.group(1).strip().strip('"').strip("'")
                    break
            # multi-line IMAP/SMTP: collect KEY_* family
            if extracted is None and name.endswith((".imap", ".smtp")):
                prefix = "AUTOMATION_DESK_IMAP_" if name.endswith(".imap") else "AUTOMATION_DESK_SMTP_"
                lines = []
                for line in blob.splitlines():
                    if line.startswith(prefix) or line.startswith(keys[0] + "_"):
                        lines.append(line)
                if lines:
                    extracted = "\n".join(lines) + "\n"
        if extracted:
            try:
                dest.write_text(extracted if extracted.endswith("\n") or "\n" in extracted else extracted + "\n", encoding="utf-8")
                dest.chmod(0o600)
                created.append(name)
            except Exception:
                missing_src.append(name)
        else:
            missing_src.append(name)
    return {
        "ok": not missing_src,
        "created": created,
        "already": skipped_present,
        "missing_src": missing_src,
        "human_gate": bool(missing_src),
        "resolve_as_representative": True,
        "note": "materialized from existing vault only — no invented secrets",
    }


def verify_desk_mail_vault() -> dict:
    """Soft-check automation.desk vault path files exist and are non-empty. Never read values into outbox. Never create 0-byte stubs — missing stays missing until STRATAGROK materializes from KeePass."""
    roots = [
        Path.home() / ".config/stratagrok",
        Path.home() / ".config/stratamesh",
    ]
    fog = _fog() / "data" / "secrets"
    roots.append(fog)
    present = []
    missing = []
    empty = []
    for name in DESK_MAIL_VAULT_NAMES:
        found = None
        for root in roots:
            cand = root / name
            if cand.is_file():
                found = cand
                break
        if found is None:
            missing.append(name)
            continue
        try:
            sz = found.stat().st_size
        except OSError:
            missing.append(name)
            continue
        if sz <= 0:
            empty.append(name)
        else:
            present.append(name)
    ok = not missing and not empty
    return {
        "ok": ok,
        "present": present,
        "missing": missing,
        "empty": empty,
        "human_gate": (not ok),
        "address": "automation.desk@calhegasmorais.pt",
        "contract": "ops/desk-collegium/DESK-MAIL-AUTOMATION.md",
        "note": "paths only — values never copied to feed/outbox",
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
        mail_v = verify_desk_mail_vault()
        out["steps"]["desk_mail_vault"] = mail_v
        if mail_v.get("human_gate") and feed:
            try:
                import argparse
                import importlib.util
                # STRATAGROK representative first — materialize from existing secrets.env
                mat = try_materialize_desk_mail_vault()
                out["steps"]["desk_mail_materialize"] = {
                    "ok": mat.get("ok"),
                    "created": mat.get("created"),
                    "already": mat.get("already"),
                    "missing_src": mat.get("missing_src"),
                }
                mail_v = verify_desk_mail_vault()
                out["steps"]["desk_mail_vault"] = mail_v
                spec = importlib.util.spec_from_file_location("desk_bus", HERE / "desk_bus.py")
                busmod = importlib.util.module_from_spec(spec)
                assert spec.loader is not None
                spec.loader.exec_module(busmod)
                tid = "dt-vault-automation-desk"
                if mat.get("created"):
                    note = f"act: materialized automation.desk files {','.join(mat.get('created') or [])} from vault (representative)"
                    st = busmod.load_state()
                    if not busmod.find_task(st, tid):
                        busmod.cmd_propose(argparse.Namespace(
                            owner="stratagrok", specialty="lead",
                            intent="Act representative: automation.desk vault materialize from secrets.env",
                            id=tid, lanes=["lane-bot", "lane-hermes"],
                        ))
                        append_diary("stratagrok", verb="propose", task_id=tid, note=note[:160])
                        busmod._mutate(tid, "constrain", by="hermes", note="protocol: representative vault act")
                        append_diary("hermes", verb="constrain", task_id=tid, note="representative vault")
                    busmod._mutate(tid, "act", by="stratagrok", note=note)
                    append_diary("stratagrok", verb="act", task_id=tid, note=note[:160])
                    if mail_v.get("ok"):
                        busmod._mutate(tid, "done", by="stratagrok", note="vault files present", close=True)
                        append_diary("stratagrok", verb="done", task_id=tid, note="automation.desk vault ok")
                    busmod.feed_append("stratagrok", note, kind="act", specialty="lead")
                elif mail_v.get("human_gate"):
                    miss = ",".join((mail_v.get("missing") or []) + (mail_v.get("empty") or []) + (mat.get("missing_src") or [])) or "unknown"
                    note = f"escalate_to_andre: automation.desk vault missing entirely ({miss}) — KeePass Mail/AUTOMATION_DESK_* absent; STRATAGROK cannot invent"
                    st = busmod.load_state()
                    if not busmod.find_task(st, tid):
                        busmod.cmd_propose(argparse.Namespace(
                            owner="stratagrok", specialty="lead",
                            intent="Act escalate_to_andre: automation.desk secrets missing entirely",
                            id=tid, lanes=["lane-bot"],
                        ))
                        append_diary("stratagrok", verb="propose", task_id=tid, note=note[:160])
                        busmod._mutate(tid, "constrain", by="hermes", note="protocol: andre gate — secrets absent")
                        append_diary("hermes", verb="constrain", task_id=tid, note="andre gate")
                    cur = busmod.find_task(busmod.load_state(), tid)
                    if cur and (cur.get("status") or "") != "escalate":
                        busmod._mutate(tid, "escalate", by="stratagrok", note=note)
                        append_diary("stratagrok", verb="escalate", task_id=tid, note=note[:160])
                    busmod.feed_append("stratagrok", note, kind="escalate", specialty="lead")
            except Exception:
                pass
    except Exception as e:
        out["steps"]["desk_mail_vault"] = {"ok": False, "err": str(e)[:120]}
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
                f"surfaces TODO+CONTEXT+reports+journals {'ok' if out.get('ok') else 'PARTIAL'}",
                kind="act",
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
        bus.feed_append("hermes", "reports + TODO/CONTEXT pack synced", kind="act", specialty="coord")
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
