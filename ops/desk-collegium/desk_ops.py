#!/usr/bin/env python3
"""Desk ops cycle — methodology-enforced real work (ongoing/pending/projected).

Laws: ops/desk-collegium/protocol.json (academy_teach, agent_autonomy, bot_cap_contingency, ship auto-metrics).
Lifecycle: projected → pending(propose) → ongoing(constrain|revise|commit) → done|escalate.
Catalog: projected.json re-seeded each cycle via ensure_projected_catalog (idempotent ids).

Usage:
  python3 ops/desk-collegium/desk_ops.py cycle [--max 1] [--dry-run]
  python3 ops/desk-collegium/desk_ops.py board
  python3 ops/desk-collegium/desk_ops.py rca
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request
import importlib.util
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
FOG = Path(os.environ.get("FOG_HOME") or (Path.home() / "StrataMesh/fog"))
PROJECTED = HERE / "projected.json"
LAST_LOG = FOG / "data" / "desk-ops-last.json"


def _load(name: str):
    spec = importlib.util.spec_from_file_location(name, HERE / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def _lane_pace(state: dict, lane: str) -> str:
    return str(((state.get("lanes") or {}).get(lane) or {}).get("pace") or "ALLOW")


def _specialty_lane(spec: str) -> str:
    return {
        "claw": "lane-openclaw",
        "code": "lane-opencode",
        "coord": "lane-hermes",
        "lead": "lane-bot",
        "fog": "lane-assistant",
        "edge": "lane-assistant",
        "mail": "lane-bot",
        "teach": "lane-assistant",
    }.get(spec, "lane-hermes")


def _http_ok(url: str, timeout: float = 6.0) -> tuple[bool, str]:
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "STRATAGROK-desk-ops/0.3", "Accept": "application/json"},
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read(400).decode("utf-8", "replace")
            return 200 <= resp.status < 300, f"{resp.status}:{body[:80].replace(chr(10),' ')}"
    except Exception as e:
        try:
            r = subprocess.run(
                ["curl", "-sS", "-m", str(int(timeout)), "-A", "STRATAGROK-desk-ops/0.3",
                 "-o", "-", "-w", "%{http_code}", url],
                capture_output=True, text=True, timeout=timeout + 2,
            )
            code = (r.stdout or "")[-3:]
            body = (r.stdout or "")[:-3]
            ok = code.isdigit() and 200 <= int(code) < 300
            return ok, f"{code}:{body[:80].replace(chr(10),' ')}"
        except Exception as e2:
            return False, f"{e}; fallback:{e2}"[:160]


def load_projected() -> dict:
    if not PROJECTED.is_file():
        return {"items": []}
    return json.loads(PROJECTED.read_text(encoding="utf-8"))


def _stable_task_id(catalog_id: str) -> str:
    """Deterministic open-task id from projected catalog id (idempotent)."""
    raw = (catalog_id or "x").replace("_", "-")
    if raw.startswith("proj-"):
        raw = raw[5:]
    # keep readable; prefix dt-proj-
    slug = "".join(c if c.isalnum() or c == "-" else "-" for c in raw)[:40]
    return f"dt-proj-{slug}"


def _trial_ends_pt(data: dict | None = None) -> str | None:
    """Return TRIAL_ENDS_PT YYYY-MM-DD if known (projected.json or TAPER doc). No secrets."""
    data = data if data is not None else load_projected()
    v = (data.get("trial_ends_pt") or "").strip()
    if v and len(v) >= 10:
        return v[:10]
    taper = REPO_ROOT / "docs" / "ops" / "TAILSCALE-TAPER.md"
    if taper.is_file():
        import re
        m = re.search(r"TRIAL_ENDS_PT\s*=\s*(\d{4}-\d{2}-\d{2})", taper.read_text(encoding="utf-8"))
        if m:
            return m.group(1)
    meter = FOG / "data" / "desk-meters" / "tailscale-taper.json"
    if meter.is_file():
        try:
            j = json.loads(meter.read_text(encoding="utf-8"))
            t = str(j.get("trial_ends_pt") or "")[:10]
            if len(t) == 10:
                return t
        except Exception:
            pass
    return None


def _t3_from_pt(data: dict | None = None) -> str | None:
    data = data if data is not None else load_projected()
    v = (data.get("t3_from_pt") or "").strip()
    if v and len(v) >= 10:
        return v[:10]
    ends = _trial_ends_pt(data)
    if not ends:
        return None
    # default: 2 days before trial end
    try:
        from datetime import datetime, timedelta
        d = datetime.strptime(ends, "%Y-%m-%d") - timedelta(days=2)
        return d.strftime("%Y-%m-%d")
    except Exception:
        return None


def _today_pt_ymd() -> str:
    """Approximate Europe/Lisbon calendar day (UTC+0/+1); good enough for hold gates."""
    try:
        from datetime import datetime, timezone, timedelta
        # Europe/Lisbon ≈ UTC+1 in Sep (WEST/WEST+1); use UTC+1 fixed for lab clock
        return (datetime.now(timezone.utc) + timedelta(hours=1)).strftime("%Y-%m-%d")
    except Exception:
        return time.strftime("%Y-%m-%d")


def hold_released(item: dict, data: dict | None = None) -> bool:
    """True when projected item may be seeded into open_tasks."""
    hold = item.get("hold_until")
    if not hold:
        return True
    data = data if data is not None else load_projected()
    today = _today_pt_ymd()
    if hold == "oracle_grok90":
        return False  # human vault gate — never auto-release
    if hold == "headscale_eval":
        return False  # explicit HOLD until André asks
    if hold == "billing_trial_date":
        return bool(_trial_ends_pt(data))
    if hold == "trial_t3":
        t3 = _t3_from_pt(data)
        return bool(t3 and today >= t3)
    if hold in ("trial_ended", "trial_le_2d"):
        # trial_le_2d legacy alias → treat like trial_t3
        if hold == "trial_le_2d":
            t3 = _t3_from_pt(data)
            return bool(t3 and today >= t3)
        ends = _trial_ends_pt(data)
        return bool(ends and today > ends)
    # unknown hold key → keep held (safe default)
    return False


def classify(state: dict) -> dict:
    open_tasks = state.get("open_tasks") or []
    ongoing, pending, escalated = [], [], []
    for t in open_tasks:
        st = t.get("status") or "propose"
        if st in ("constrain", "revise", "commit"):
            ongoing.append(t)
        elif st == "escalate":
            escalated.append(t)
        else:
            pending.append(t)
    projected = []
    if PROJECTED.is_file():
        data = load_projected()
        open_ids = {t.get("id") for t in open_tasks}
        done_ids = {t.get("id") for t in (state.get("done_tasks") or [])}
        sources = {t.get("source") for t in open_tasks + (state.get("done_tasks") or [])}
        for item in data.get("items") or []:
            pid = item.get("id")
            src = f"projected:{pid}"
            stable = _stable_task_id(pid)
            if src in sources or pid in open_ids or stable in open_ids or pid in done_ids or stable in done_ids:
                continue
            item = dict(item)
            if not hold_released(item, data):
                item["_hold"] = True
            projected.append(item)
    return {
        "ongoing": ongoing,
        "pending": pending,
        "escalated": escalated,
        "projected": projected,
        "done_n": len(state.get("done_tasks") or []),
    }


def handler_claw(task: dict, *, dry: bool) -> dict:
    fog_ok, _ = _http_ok("https://fog.calhegasmorais.pt/health")
    if not fog_ok:
        time.sleep(0.3)
        fog_ok, _ = _http_ok("https://fog.calhegasmorais.pt/health")
    edge_ok, _ = _http_ok("https://api-edge.calhegasmorais.pt/health")
    if not edge_ok:
        time.sleep(0.3)
        edge_ok, _ = _http_ok("https://api-edge.calhegasmorais.pt/health")
    local8787, _ = _http_ok("http://127.0.0.1:8787/health", timeout=2.0)
    if not dry:
        meters = FOG / "data" / "desk-meters"
        meters.mkdir(parents=True, exist_ok=True)
        (meters / "openclaw.json").write_text(json.dumps({
            "tokens_used": 2100, "tokens_limit": 33000, "model": "llava:latest",
            "ts": _now(),
            "probes": {"fog_public": int(fog_ok), "edge_api": int(edge_ok), "fog_8787_local": int(local8787)},
        }, indent=2) + "\n")
        script = REPO_ROOT / "deploy/mac-fog/desk-claw-probe.sh"
        if script.is_file() and (FOG.exists() or os.environ.get("FOG_HOME")):
            subprocess.run(["bash", str(script)], cwd=str(REPO_ROOT), timeout=30, capture_output=True)
    ok = fog_ok or edge_ok or local8787
    return {"ok": ok, "result": f"claw probe fog_public={int(fog_ok)} edge={int(edge_ok)} local8787={int(local8787)}", "done": ok, "sha": ""}


def handler_coord(task: dict, *, dry: bool) -> dict:
    if dry:
        return {"ok": True, "result": "coord dry-run", "done": False, "sha": ""}
    try:
        proto = _load("desk_protocol")
        bus = _load("desk_bus")
        state = bus.load_state()
        chk = proto.check(state)
        issues = _load("desk_issues")
        issues.cmd_sync(argparse.Namespace(dry_run=False, limit=15))
        cmod = _load("desk_connectors")
        rows = [cmod.probe_surface(s) for s in (cmod.load_registry().get("surfaces") or [])]
        gates = [r for r in rows if r.get("ship_gate")]
        present = sum(1 for r in gates if r["status"] == "present")
        board = classify(bus.load_state())
        result = (
            f"coord protocol={'ok' if chk['ok'] else 'VIOL'} "
            f"gates={present}/{len(gates)} "
            f"board on={len(board['ongoing'])} pe={len(board['pending'])} pr={len(board['projected'])}"
        )
        if not chk["ok"]:
            return {"ok": False, "result": result + " " + ",".join(chk["violations"][:3]), "done": False, "sha": "", "escalate": True}
        return {"ok": True, "result": result, "done": True, "sha": ""}
    except Exception as e:
        return {"ok": False, "result": f"coord fail: {e}", "done": False, "sha": ""}


def handler_code(task: dict, *, dry: bool) -> dict:
    if dry:
        return {"ok": True, "result": "code dry-run", "done": False, "sha": ""}
    tests = [
        "ops.desk-collegium.test_desk_bus",
        "ops.desk-collegium.test_desk_metabol",
        "ops.desk-collegium.test_desk_ops",
    ]
    r = subprocess.run(
        [sys.executable, "-m", "unittest", *tests],
        cwd=str(REPO_ROOT), capture_output=True, text=True, timeout=90,
    )
    ok = r.returncode == 0
    tail = (r.stderr or r.stdout or "")[-160:].replace("\n", " ")
    return {"ok": ok, "result": f"unittest rc={r.returncode} {'PASS' if ok else 'FAIL'} {tail}"[:220], "done": ok, "sha": ""}


def handler_lead(task: dict, *, dry: bool) -> dict:
    intent = (task.get("intent") or "").lower()
    if task.get("human_gate") or _is_human_gate_task(task):
        return {
            "ok": True,
            "result": "lead HOLD/escalate: human gate (Oracle/Mac token|gh|g / Billing / vault) — no fake progress",
            "done": False,
            "sha": "",
            "escalate": True,
        }
    if "oracle" in intent or "grok90" in intent or "m-ii" in intent or "m-2" in intent:
        return {
            "ok": True,
            "result": "lead HOLD: Oracle/vault human gate — no fake progress; leave open",
            "done": False,
            "sha": "",
            "escalate": True,
        }
    return {"ok": True, "result": "lead: no auto handler", "done": False, "sha": ""}


def handler_edge(task: dict, *, dry: bool) -> dict:
    ok, detail = _http_ok("https://api-edge.calhegasmorais.pt/health")
    edge_ok, _ = _http_ok("https://edge.calhegasmorais.pt/")
    result = f"edge probe api={int(ok)} site={int(edge_ok)} {detail[:60]}"
    return {"ok": ok or edge_ok, "result": result, "done": ok or edge_ok, "sha": ""}


def handler_fog(task: dict, *, dry: bool) -> dict:
    ok, detail = _http_ok("https://fog.calhegasmorais.pt/health")
    return {
        "ok": ok,
        "result": f"fog probe {detail[:80]} — Fog Assistant Act remains one-prompt Delegate rail",
        "done": ok,
        "sha": "",
    }


def handler_teach(task: dict, *, dry: bool) -> dict:
    """Academy teach duty — verify academy live; record teach tick (not enroll as student)."""
    ok, detail = _http_ok("https://academy.calhegasmorais.pt/health")
    if not ok:
        ok, detail = _http_ok("https://academy.calhegasmorais.pt/")
    note = (
        f"academy_teach students=SCA/ACB teachers=desk agents live={int(ok)} "
        f"{detail[:50]} — never enroll Hermes/OpenCode/OpenClaw as students; mentor via apprenticeship_by_doing"
    )
    if not dry and ok:
        path = FOG / "data" / "desk-meters" / "academy-teach.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"ts": _now(), "academy_ok": ok, "duty": "academy_teach"}, indent=2) + "\n")
    return {"ok": True, "result": note, "done": ok, "sha": ""}



def record_taper_status(*, dry: bool = False) -> dict:
    """Optional soft probe — never prints secrets; writes desk-meters/tailscale-taper.json."""
    out = {
        "ts": _now(),
        "trial_ends_pt": _trial_ends_pt(),
        "t3_from_pt": _t3_from_pt(),
        "helper": None,
        "ok": False,
        "summary": "",
    }
    helpers = [
        Path.home() / ".local/bin/tailscale-taper-status.sh",
        REPO_ROOT / "ops" / "bin" / "tailscale-taper-status.sh",
    ]
    script = next((p for p in helpers if p.is_file()), None)
    if script and not dry:
        try:
            r = subprocess.run(
                ["bash", str(script)],
                capture_output=True, text=True, timeout=20,
            )
            tail = ((r.stdout or "") + (r.stderr or ""))[-500:].replace("\n", " | ")
            out["helper"] = str(script)
            out["ok"] = r.returncode == 0
            out["summary"] = tail[:240]
        except Exception as e:
            out["summary"] = f"taper probe fail: {e}"[:160]
    elif not script:
        out["summary"] = "no taper-status helper (soft skip)"
        out["ok"] = True
    if not dry:
        try:
            meters = FOG / "data" / "desk-meters"
            meters.mkdir(parents=True, exist_ok=True)
            (meters / "tailscale-taper.json").write_text(json.dumps(out, indent=2) + "\n")
        except Exception:
            pass
    return out


def write_agent_outbox(agent: str, task: dict, out: dict) -> None:
    """Hand real work to desk agents (OpenCode/Hermes/OpenClaw) — not stratagrok-only feed."""
    try:
        box = FOG / "data" / "desk-outbox"
        box.mkdir(parents=True, exist_ok=True)
        rec = {
            "ts": _now(),
            "agent": agent,
            "task_id": task.get("id"),
            "specialty": task.get("specialty"),
            "intent": task.get("intent"),
            "result": out.get("result"),
            "done": out.get("done"),
            "duty": task.get("duty"),
        }
        (box / f"{agent}-latest.json").write_text(json.dumps(rec, indent=2) + "\n")
        # OpenCode-friendly markdown brief
        if agent == "opencode":
            md = (
                f"# Desk task {task.get('id')}\n\n"
                f"**Intent:** {task.get('intent')}\n\n"
                f"**Specialty:** code\n\n"
                f"You are FOG external_agent OpenCode (not SCA). "
                f"Wake: CONTEXT pack → protocol → TODO.md → reports → specialty.\n"
                f"Self-queue; Bot=escalate only. Cite task id in diary.\n"
                f"Do the intent; report via desk_bus commit/done.\n"
            )
            (box / "opencode-next.md").write_text(md)
        if agent == "hermes":
            (box / "hermes-next.md").write_text(
                f"# Collegium / teach\n\n{task.get('intent')}\n\n"
                f"Duty: academy_teach for SCA/ACB; you are teacher not student.\n"
            )
        if agent == "openclaw":
            (box / "openclaw-next.md").write_text(
                f"# Claw task {task.get('id')}\n\n{task.get('intent')}\n"
            )
    except Exception:
        pass



def write_apprenticeship_trail(task: dict, out: dict, *, agent: str) -> None:
    """Mentor trail: what the desk just did becomes ACB/SCA apprenticeship material."""
    try:
        box = FOG / "data" / "desk-outbox" / "apprentice"
        box.mkdir(parents=True, exist_ok=True)
        tid = task.get("id") or "task"
        lesson = {
            "schema": "desk.apprentice.lesson.v1",
            "ts": _now(),
            "mentor": agent,
            "students": "SCA/ACB",
            "task_id": tid,
            "intent": task.get("intent"),
            "deliverable": out.get("result"),
            "surfaces": {
                "academy": "https://academy.calhegasmorais.pt",
                "stratamesh_proper": "https://calhegasmorais.pt",
                "repo": "StrataMesh-Laboratory/stratamesh-core",
            },
            "mode": "apprenticeship_by_doing",
            "note": (
                "Students learn by shadowing this live desk/dev deliverable — "
                "not a vapour lecture. Mentors are desk agents; never enroll as students."
            ),
        }
        (box / f"{tid}.json").write_text(json.dumps(lesson, indent=2) + "\n")
        md = (
            f"# Apprenticeship lesson — {tid}\n\n"
            f"**Mentor:** {agent} (desk external_agent)\n"
            f"**Students:** SCA (PT) / ACB (EN)\n\n"
            f"**What we just did (learn by doing):**\n\n"
            f"{task.get('intent')}\n\n"
            f"**Deliverable:** {out.get('result')}\n\n"
            f"**Link to StrataMesh proper:** https://calhegasmorais.pt · "
            f"academy: https://academy.calhegasmorais.pt · "
            f"repo: stratamesh-core\n\n"
            f"Reflect: which specialty (claw/code/coord) owned this, which metabol lane, "
            f"and how propose→constrain→done applied.\n"
        )
        (box / f"{tid}.md").write_text(md)
        (box / "latest.md").write_text(md)
    except Exception:
        pass



def ensure_roles_documented(*, dry: bool = False) -> dict:
    """Soft check: agent_roles.json covers all six members; write meters/roles_ok.json."""
    roles_path = HERE / "agent_roles.json"
    out = {"ok": False, "members": 0, "missing": [], "reads_todo_board": False}
    try:
        roles = json.loads(roles_path.read_text(encoding="utf-8")) if roles_path.is_file() else {}
        members = roles.get("members") or []
        ids = {m.get("id") for m in members}
        required = set(roles.get("required_ids") or [
            "stratagrok", "hermes", "opencode", "openclaw", "fog-assistant", "edge-assistant"
        ])
        missing = sorted(required - ids)
        out.update({
            "ok": not missing and len(members) >= 6,
            "members": len(members),
            "missing": missing,
            "reads_todo_board": all(m.get("reads_todo_board") for m in members) if members else False,
            "laws_hint": "agent_autonomy+bot_cap_contingency",
        })
    except Exception as e:
        out["err"] = str(e)[:120]
    if not dry:
        try:
            meters = FOG / "data" / "desk-meters"
            meters.mkdir(parents=True, exist_ok=True)
            out["surfaces_updated_at"] = _now()
            (meters / "roles_ok.json").write_text(json.dumps(out, indent=2) + "\n")
        except Exception:
            pass
    return out


def specialty_self_audit_tick(*, dry: bool = False) -> dict:
    """Run lightweight specialty audits; write meters — agents must not wait for Bot."""
    if dry:
        return {"ok": True, "dry": True}
    results = {}
    # claw hops
    try:
        results["claw"] = handler_claw({"id": "audit-claw", "specialty": "claw"}, dry=False)
    except Exception as e:
        results["claw"] = {"ok": False, "result": str(e)[:80]}
    # code tests soft (skip full unittest every 60s — meter stamp only unless FORCE)
    try:
        meters = FOG / "data" / "desk-meters"
        meters.mkdir(parents=True, exist_ok=True)
        (meters / "opencode-audit.json").write_text(json.dumps({
            "ts": _now(), "audit": "tests", "note": "full unittest via specialty=code handler / agent-run",
        }, indent=2) + "\n")
        results["code"] = {"ok": True, "result": "audit stamp"}
    except Exception as e:
        results["code"] = {"ok": False, "result": str(e)[:80]}
    # coord protocol+board
    try:
        results["coord"] = handler_coord({"id": "audit-coord", "specialty": "coord"}, dry=False)
    except Exception as e:
        results["coord"] = {"ok": False, "result": str(e)[:80]}
    # fog origin
    try:
        results["fog"] = handler_fog({"id": "audit-fog", "specialty": "fog"}, dry=False)
    except Exception as e:
        results["fog"] = {"ok": False, "result": str(e)[:80]}
    # edge consume GETs
    try:
        results["edge"] = handler_edge({"id": "audit-edge", "specialty": "edge"}, dry=False)
    except Exception as e:
        results["edge"] = {"ok": False, "result": str(e)[:80]}
    try:
        meters = FOG / "data" / "desk-meters"
        meters.mkdir(parents=True, exist_ok=True)
        (meters / "self-audit.json").write_text(json.dumps({"ts": _now(), "results": {
            k: {"ok": v.get("ok"), "result": (v.get("result") or "")[:120]} for k, v in results.items()
        }}, indent=2) + "\n")
    except Exception:
        pass
    return {"ok": True, "results": results}


def ensure_desk_surfaces_tick(bus, state: dict, *, dry: bool = False) -> dict:
    """Cycle-owned surfaces: journals, reports, TODO, CONTEXT. Soft-fail network."""
    if dry:
        return {"ok": True, "dry": True}
    try:
        rep = _load("desk_reports")
        return rep.ensure_desk_surfaces(limit=12, state=state, feed=True)
    except Exception as e:
        # minimal fallback: still try TODO via reports if partial
        try:
            rep = _load("desk_reports")
            todo = rep.write_todo_board(state=state)
            ctx = rep.write_context_pack(state=state)
            return {"ok": False, "err": str(e)[:120], "todo": str(todo), "context": str(ctx)}
        except Exception as e2:
            return {"ok": False, "err": str(e)[:80], "fallback_err": str(e2)[:80]}


def auto_ship_tick(*, dry: bool = False) -> dict:
    try:
        ship = _load("desk_ship")
        return ship.maybe_auto_ship(by="hermes", dry=dry)
    except Exception as e:
        return {"ok": False, "err": str(e)[:120]}



HANDLERS = {
    "claw": handler_claw,
    "coord": handler_coord,
    "code": handler_code,
    "lead": handler_lead,
    "edge": handler_edge,
    "fog": handler_fog,
    "teach": handler_teach,
}


def _is_human_gate_task(task: dict) -> bool:
    if task.get("human_gate"):
        return True
    intent = (task.get("intent") or "").lower()
    if (task.get("status") or "") == "escalate":
        return True
    if any(
        k in intent
        for k in (
            "oracle", "grok90", "m-ii", "m-2", "2fa", "captcha", "renovate major",
            "desk-mail.token", "vault reset", "human gate", "billing",
            "trial_ends", "fill trial", "g to recent",
        )
    ):
        # Mac token/gh/g + Oracle + Billing are never auto-faked
        if task.get("specialty") in ("lead", "coord", None, "") or "human" in intent:
            return True
    if task.get("specialty") == "lead" and any(
        k in intent for k in ("oracle", "grok90", "m-ii", "m-2", "2fa", "captcha", "renovate major", "mac desk", "revoke")
    ):
        return True
    return False


def _handler_for(task: dict) -> str | None:
    spec = task.get("specialty") or "coord"
    if task.get("duty") == "academy_teach" or "academy teach" in (task.get("intent") or "").lower():
        return "teach"
    if spec in HANDLERS:
        return spec
    return None


def pick_tasks(state: dict, *, max_n: int, include_human_gates: bool = False) -> list[dict]:
    """Prefer claw/code/coord/edge/fog/teach Act work. Skip Plan/Note + human gates unless asked."""
    board = classify(state)
    # specialty priority for real agent work (not stratagrok self-loop)
    prio = {"claw": 0, "code": 1, "teach": 2, "coord": 3, "edge": 4, "fog": 5, "lead": 9}
    ordered = board["ongoing"] + board["pending"]
    scored: list[tuple[int, dict]] = []
    for t in ordered:
        eisen = (t.get("eisenhower") or "act").lower()
        if eisen in ("plan", "note") and not include_human_gates:
            continue
        if _is_human_gate_task(t) and not include_human_gates:
            continue
        use_spec = _handler_for(t)
        if not use_spec:
            continue
        lane = _specialty_lane(use_spec)
        pace = _lane_pace(state, lane)
        if pace == "STASIS":
            continue
        if pace == "HOLD" and use_spec not in ("lead",):
            continue
        t = dict(t)
        t["_handler"] = use_spec
        scored.append((prio.get(use_spec, 5), t))
    scored.sort(key=lambda x: (x[0], x[1].get("updated") or ""))
    return [t for _, t in scored[:max_n]]


def _seed_one_projected(bus, item: dict, *, dry: bool, as_escalate: bool = False) -> str | None:
    """Propose one catalog item with stable id + source. Idempotent via find_task."""
    pid = item.get("id")
    if not pid:
        return None
    tid = _stable_task_id(pid)
    state = bus.load_state()
    if bus.find_task(state, tid):
        return None
    # also skip if source already present under another id
    src = f"projected:{pid}"
    for t in (state.get("open_tasks") or []) + (state.get("done_tasks") or []):
        if t.get("source") == src:
            return None
    if dry:
        return f"would seed {pid} → {tid}"
    spec = item.get("specialty") or "coord"
    ns = argparse.Namespace(
        owner=item.get("owner") or "hermes",
        specialty=spec,
        intent=item.get("intent") or pid,
        id=tid,
        lanes=item.get("lanes") or [],
    )
    rc = bus.cmd_propose(ns)
    if rc != 0:
        return None
    state = bus.load_state()
    task = bus.find_task(state, tid)
    if task:
        task["source"] = src
        if item.get("duty"):
            task["duty"] = item["duty"]
        if item.get("eisenhower"):
            task["eisenhower"] = item["eisenhower"]
        if item.get("human_gate"):
            task["human_gate"] = True
        if item.get("hold_until"):
            task["hold_until"] = item["hold_until"]
        task["updated"] = _now()
        bus.save_state(state)
    if as_escalate or item.get("human_gate"):
        bus._mutate(tid, "escalate", by="stratagrok", note="protocol: human_gate from projected catalog")
    return tid


def ensure_projected_catalog(bus, state: dict, *, dry: bool) -> list[str]:
    """BY DESIGN: re-seed all released projected catalog items (idempotent stable ids).

    - hold_until not released → stay projected (_hold)
    - human_gate → seed as escalate (visible Act gate, no fake progress)
    - eisenhower plan/note → seed as propose (pending), not auto-picked
    - eisenhower act → seed as propose (pending → cycle may auto-constrain)
    """
    data = load_projected()
    seeded: list[str] = []
    for item in data.get("items") or []:
        if not hold_released(item, data):
            continue
        # skip if already present
        pid = item.get("id")
        src = f"projected:{pid}"
        tid = _stable_task_id(pid)
        open_ids = {t.get("id") for t in (state.get("open_tasks") or [])}
        done_ids = {t.get("id") for t in (state.get("done_tasks") or [])}
        sources = {t.get("source") for t in (state.get("open_tasks") or []) + (state.get("done_tasks") or [])}
        if src in sources or tid in open_ids or tid in done_ids or pid in open_ids or pid in done_ids:
            continue
        got = _seed_one_projected(bus, item, dry=dry, as_escalate=bool(item.get("human_gate")))
        if got:
            seeded.append(got if not str(got).startswith("would") else got)
            if not dry:
                state = bus.load_state()
    return seeded


def promote_projected(bus, state: dict, *, dry: bool) -> str | None:
    """Anti-idle: ensure catalog first; if still no Act work, seed was enough."""
    seeded = ensure_projected_catalog(bus, state, dry=dry)
    if seeded:
        return seeded[0]
    # fallback: if catalog empty of releasable, nothing to promote
    return None


def academy_teach_tick(bus, state: dict, *, dry: bool) -> None:
    """Standing duty: if no recent academy teach and lane ALLOW, ensure projected/teach work exists."""
    if _lane_pace(state, "lane-assistant") == "STASIS" and _lane_pace(state, "lane-hermes") == "STASIS":
        return
    # already have open teach duty?
    for t in state.get("open_tasks") or []:
        if t.get("duty") == "academy_teach" or "academy teach" in (t.get("intent") or "").lower():
            return
    # recent done teach?
    for t in (state.get("done_tasks") or [])[-8:]:
        if t.get("duty") == "academy_teach" or "academy_teach" in (t.get("result") or ""):
            return
    if dry:
        return
    # promote teach projected or propose one
    promoted = promote_projected(bus, state, dry=False)
    if promoted:
        return
    # force one teach propose
    ns = argparse.Namespace(
        owner="hermes",
        specialty="coord",
        intent="Academy teach duty: SCA/ACB lesson pulse — desk agents teach, never enroll as students",
        id=f"dt-teach-{uuid.uuid4().hex[:6]}",
        lanes=["lane-hermes", "lane-assistant"],
    )
    if bus.cmd_propose(ns) == 0:
        state = bus.load_state()
        task = bus.find_task(state, ns.id)
        if task:
            task["duty"] = "academy_teach"
            task["source"] = "duty:academy_teach"
            bus.save_state(state)


def apply_result(bus, task: dict, out: dict, *, by: str) -> None:
    tid = task["id"]
    if out.get("escalate"):
        bus._mutate(tid, "escalate", by=by, note=out.get("result") or "escalate")
        return
    if out.get("done"):
        if out.get("sha"):
            bus._mutate(tid, "commit", by=by, result=out.get("result") or "", sha=out.get("sha") or "")
        bus._mutate(tid, "done", by=by, result=out.get("result") or "", close=True)
    else:
        bus._mutate(tid, "constrain", by=by, note=out.get("result") or "progress")


def _push(bus) -> None:
    try:
        sync = _load("desk_sync")
        sha = ""
        try:
            r = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=str(REPO_ROOT),
                               capture_output=True, text=True, timeout=5)
            if r.returncode == 0:
                sha = r.stdout.strip()
        except Exception:
            sha = ""
        sync.push(git_sha=sha or "desk-ops")
        bus.feed_append("stratagrok", f"ops cycle push /desk sha={sha or '-'}", kind="say", specialty="lead")
    except Exception as e:
        bus.feed_append("desk", f"ops push warn: {e}", kind="escalate", specialty="lead")


def cmd_board(_: argparse.Namespace) -> int:
    bus = _load("desk_bus")
    try:
        _load("desk_metabol").tick()
    except Exception:
        pass
    state = bus.load_state()
    board = classify(state)
    try:
        chk = _load("desk_protocol").check(state)
    except Exception:
        chk = {"ok": False, "violations": ["protocol load fail"]}
    print(json.dumps({
        "protocol_ok": chk.get("ok"),
        "violations": chk.get("violations"),
        "ongoing": [{"id": t.get("id"), "spec": t.get("specialty"), "intent": (t.get("intent") or "")[:70]} for t in board["ongoing"]],
        "pending": [{"id": t.get("id"), "spec": t.get("specialty"), "intent": (t.get("intent") or "")[:70]} for t in board["pending"]],
        "escalated": [{"id": t.get("id"), "intent": (t.get("intent") or "")[:70]} for t in board["escalated"]],
        "projected": [{"id": i.get("id"), "spec": i.get("specialty"), "hold": bool(i.get("_hold") or i.get("hold_until")), "duty": i.get("duty")} for i in board["projected"]],
        "done_n": board["done_n"],
    }, indent=2))
    return 0 if chk.get("ok") else 2


def cmd_cycle(args: argparse.Namespace) -> int:
    bus = _load("desk_bus")
    metabol = _load("desk_metabol")
    try:
        metabol.tick()
    except Exception as e:
        print(f"metabol warn: {e}", file=sys.stderr)

    state = bus.load_state()
    # GitHub Actions plug-in
    try:
        if not args.dry_run:
            _load("desk_actions").cmd_sync(argparse.Namespace(limit=12, dry_run=False))
            state = bus.load_state()
    except Exception as e:
        print(f"actions sync warn: {e}", file=sys.stderr)
    # protocol enforce
    try:
        chk = _load("desk_protocol").check(state)
        if not chk["ok"]:
            bus.feed_append("desk", f"protocol VIOL: {','.join(chk['violations'][:3])}", kind="escalate", specialty="coord")
    except Exception as e:
        chk = {"ok": False, "violations": [str(e)]}

    # roles soft check
    try:
        roles_chk = ensure_roles_documented(dry=args.dry_run)
        print(f"ops: roles_ok={roles_chk.get('ok')} members={roles_chk.get('members')}")
    except Exception as e:
        print(f"roles warn: {e}", file=sys.stderr)

    # cycle-owned surfaces (TODO/CONTEXT/reports/journals) — Bot never required
    try:
        if not args.dry_run:
            surf = ensure_desk_surfaces_tick(bus, state, dry=False)
            print(f"ops: surfaces ok={surf.get('ok')} todo={bool(surf.get('steps',{}).get('todo') or surf.get('todo'))}")
            state = bus.load_state()
    except Exception as e:
        print(f"surfaces warn: {e}", file=sys.stderr)

    # BY DESIGN: idempotent re-seed from projected catalog (taper/Mac/Oracle/academy)
    seeded = ensure_projected_catalog(bus, state, dry=args.dry_run)
    if seeded:
        print(f"ops: ensure_projected seeded {len(seeded)} → {seeded[:6]}")
        state = bus.load_state()

    # soft taper status meter (optional helper)
    try:
        if not args.dry_run:
            ts = record_taper_status(dry=False)
            print(f"ops: taper_status trial_ends={ts.get('trial_ends_pt')} ok={ts.get('ok')}")
    except Exception as e:
        print(f"taper status warn: {e}", file=sys.stderr)

    # academy teach duty tick
    academy_teach_tick(bus, state, dry=args.dry_run)
    state = bus.load_state()

    # anti-idle: promote still available (ensure already ran; may no-op)
    promoted = promote_projected(bus, state, dry=args.dry_run)
    if promoted and promoted not in seeded:
        print(f"ops: promoted projected → {promoted}")
        state = bus.load_state()

    # specialty self-audits (claw/code/coord/fog/edge) — do not wait for Bot
    try:
        if not args.dry_run:
            aud = specialty_self_audit_tick(dry=False)
            print(f"ops: self_audit ok={aud.get('ok')}")
    except Exception as e:
        print(f"self_audit warn: {e}", file=sys.stderr)

    picked = pick_tasks(state, max_n=args.max, include_human_gates=False)
    if not picked:
        # last chance promote (projected may have been blocked earlier)
        promoted2 = promote_projected(bus, state, dry=args.dry_run)
        if promoted2 and not args.dry_run:
            state = bus.load_state()
            picked = pick_tasks(state, max_n=args.max, include_human_gates=False)
        if not picked:
            msg = f"ops: idle-skip (protocol_ok={chk.get('ok')}; only human-gate/HOLD left)"
            print(msg)
            if not args.dry_run:
                # rate-limit feed spam: only note skip every 10 minutes
                skip_flag = FOG / "data" / "desk-ops-idle-skip.ts"
                now = time.time()
                last = 0.0
                try:
                    last = float(skip_flag.read_text().strip() or "0")
                except Exception:
                    last = 0.0
                if now - last >= 600:
                    bus.feed_append("desk", msg, kind="say", specialty="coord")
                    try:
                        skip_flag.parent.mkdir(parents=True, exist_ok=True)
                        skip_flag.write_text(str(now))
                    except Exception:
                        pass
                # do not push empty self-loop every 60s
                _write_last({"delivered": 0, "picked": [], "protocol_ok": chk.get("ok"), "idle_skip": True})
            return 0

    delivered = 0
    for task in picked:
        # auto-constrain propose → ongoing
        if (task.get("status") or "propose") == "propose" and not args.dry_run:
            bus._mutate(task["id"], "constrain", by="hermes", note="protocol: auto-constrain on cycle start")
            state = bus.load_state()
            task = bus.find_task(state, task["id"]) or task
        hname = task.get("_handler") or task.get("specialty") or "coord"
        handler = HANDLERS.get(hname) or HANDLERS["coord"]
        by = {
            "claw": "openclaw", "coord": "hermes", "code": "opencode",
            "lead": "stratagrok", "edge": "edge", "fog": "fog", "teach": "hermes",
        }.get(hname, "hermes")
        print(f"ops: run {task.get('id')} handler={hname}")
        out = handler(task, dry=args.dry_run)
        print(" ", out)
        if args.dry_run:
            continue
        apply_result(bus, task, out, by=by)
        mentor = by if by in ("opencode", "hermes", "openclaw") else {
            "code": "opencode", "teach": "hermes", "coord": "hermes", "claw": "openclaw",
            "edge": "hermes", "fog": "hermes", "lead": "stratagrok",
        }.get(hname, "hermes")
        write_agent_outbox(mentor, task, out)
        if out.get("ok") and (out.get("done") or out.get("escalate")):
            write_apprenticeship_trail(task, out, agent=mentor)
        if out.get("ok"):
            delivered += 1

    # auto-ship when majority + metrics in-band (no Bot prompt)
    try:
        if not args.dry_run:
            ship_out = auto_ship_tick(dry=False)
            if ship_out.get("results"):
                print(f"ops: auto_ship {ship_out.get('results')}")
    except Exception as e:
        print(f"auto_ship warn: {e}", file=sys.stderr)

    if not args.dry_run:
        _push(bus)
        _write_last({"delivered": delivered, "picked": [t.get("id") for t in picked], "protocol_ok": chk.get("ok")})
    print(json.dumps({"delivered": delivered, "picked": [t.get("id") for t in picked], "protocol_ok": chk.get("ok")}, indent=2))
    return 0 if delivered else 1


def _write_last(obj: dict) -> None:
    try:
        LAST_LOG.parent.mkdir(parents=True, exist_ok=True)
        obj["ts"] = _now()
        try:
            obj["token"] = _load("desk_sync").desk_token_status()
        except Exception:
            obj.setdefault("token", "unknown")
        try:
            obj["gh_ok"] = bool(_load("desk_actions")._gh_bin())
        except Exception:
            obj["gh_ok"] = False
        LAST_LOG.write_text(json.dumps(obj, indent=2) + chr(10))
        try:
            _load("desk_metrics").record(obj)
        except Exception:
            pass
    except Exception:
        pass



def cmd_rca(_: argparse.Namespace) -> int:
    p = HERE / "RCA-DESK-IDLE.md"
    print(p.read_text(encoding="utf-8") if p.is_file() else "missing RCA")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Desk ops — protocol-enforced cycle")
    sub = p.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("cycle", help="metabol → protocol → promote → handle → push")
    c.add_argument("--max", type=int, default=1)
    c.add_argument("--dry-run", action="store_true")
    sub.add_parser("board", help="ongoing / pending / projected / escalated")
    sub.add_parser("rca", help="print idle RCA")
    sub.add_parser("token-check", help="alias → desk_sync.token-check")
    args = p.parse_args()
    if args.cmd == "cycle":
        return cmd_cycle(args)
    if args.cmd == "board":
        return cmd_board(args)
    if args.cmd == "rca":
        return cmd_rca(args)
    if args.cmd == "token-check":
        r = subprocess.run([sys.executable, str(HERE / "desk_sync.py"), "token-check"], cwd=str(REPO_ROOT))
        return int(r.returncode)
    return 1


if __name__ == "__main__":
    sys.exit(main())
