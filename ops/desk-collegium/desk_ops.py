#!/usr/bin/env python3
"""Desk ops cycle — methodology-enforced real work (ongoing/pending/projected).

Laws: ops/desk-collegium/protocol.json (academy_teach, agent_autonomy, bot_cap_contingency, ship auto-metrics).
Lifecycle: projected → pending(propose) → ongoing(constrain|act|audit|amend|revise|vote|refer|dispute|commit) → done|escalate.
Full verbs: propose act audit amend revise vote(call|cast) refer dispute constrain commit escalate done drop.
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


def _is_rate_limited(detail: str) -> bool:
    d = (detail or "").lower()
    return ("429" in d) or ("1015" in d) or ("rate limited" in d) or ("too many requests" in d)


def _http_ok(url: str, timeout: float = 6.0, *, retries: int = 2) -> tuple[bool, str]:
    """GET with short backoff on CF 429/1015 — collegium retry path, not a dead-end dispute."""
    last = ""
    attempts = max(1, int(retries) + 1)
    for i in range(attempts):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "STRATAGROK-desk-ops/0.3", "Accept": "application/json"},
                method="GET",
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                body = resp.read(400).decode("utf-8", "replace")
                ok = 200 <= resp.status < 300
                last = f"{resp.status}:{body[:80].replace(chr(10),' ')}"
                if ok:
                    return True, last
                if not _is_rate_limited(last) or i + 1 >= attempts:
                    return False, last
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
                last = f"{code}:{body[:80].replace(chr(10),' ')}"
                if ok:
                    return True, last
                if not _is_rate_limited(last) and "429" not in str(e):
                    # non-rate errors: one curl fallback is enough
                    if i + 1 >= attempts or not _is_rate_limited(f"{e}"):
                        return False, last or f"{e}"[:160]
            except Exception as e2:
                last = f"{e}; fallback:{e2}"[:160]
                if i + 1 >= attempts:
                    return False, last
        # backoff: 0.4s, 0.8s, …
        time.sleep(0.4 * (i + 1))
    return False, last or "http_fail"


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


def _oracle_fallback_active() -> bool:
    import os
    if (os.environ.get("ORACLE_FALLBACK") or "").strip().lower() in ("1", "true", "yes"):
        return True
    try:
        from pathlib import Path
        import json
        p = Path(os.environ.get("FOG_HOME", "")) / "data/desk-meters/lab-flags.json"
        if p.is_file():
            j = json.loads(p.read_text())
            return bool(j.get("oracle_fallback"))
    except Exception:
        pass
    return False


def hold_released(item: dict, data: dict | None = None) -> bool:
    """True when projected item may be seeded into open_tasks."""
    hold = item.get("hold_until")
    if not hold:
        return True
    data = data if data is not None else load_projected()
    today = _today_pt_ymd()
    if hold == "oracle_grok90":
        if _oracle_fallback_active():
            return True  # Mac+MDB fallback — Fog host not blocked on grok90
        return False
    if hold == "distinct_second_host":
        return False  # need Pi/AWS/remote Fog — not Mac+MDB alone
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
        if st in (
            "constrain", "revise", "commit",
            "act", "audit", "amend", "vote", "refer", "dispute",
        ):
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
    """Real hop health: HTTP probes + desk-claw-probe.sh; verb=audit."""
    fog_ok, _ = _http_ok("https://fog.calhegasmorais.pt/health")
    if not fog_ok:
        time.sleep(0.3)
        fog_ok, _ = _http_ok("https://fog.calhegasmorais.pt/health")
    edge_ok, _ = _http_ok("https://api-edge.calhegasmorais.pt/health")
    if not edge_ok:
        time.sleep(0.3)
        edge_ok, _ = _http_ok("https://api-edge.calhegasmorais.pt/health")
    local8787, _ = _http_ok("http://127.0.0.1:8787/health", timeout=2.0)
    tokens_used, tokens_limit = 2100, 33000
    if not dry:
        meters = FOG / "data" / "desk-meters"
        meters.mkdir(parents=True, exist_ok=True)
        prev = meters / "openclaw.json"
        if prev.is_file():
            try:
                pj = json.loads(prev.read_text(encoding="utf-8"))
                tokens_used = int(pj.get("tokens_used") or tokens_used)
                tokens_limit = int(pj.get("tokens_limit") or tokens_limit)
            except Exception:
                pass
        (meters / "openclaw.json").write_text(json.dumps({
            "tokens_used": tokens_used, "tokens_limit": tokens_limit, "model": "llava:latest",
            "ts": _now(),
            "probes": {"fog_public": int(fog_ok), "edge_api": int(edge_ok), "fog_8787_local": int(local8787)},
        }, indent=2) + "\n")
        for script in (
            REPO_ROOT / "deploy/mac-fog/desk-claw-probe.sh",
            REPO_ROOT / "deploy/mac-fog/openclaw/desk-claw-probe.sh",
        ):
            if script.is_file() and (FOG.exists() or os.environ.get("FOG_HOME")):
                subprocess.run(["bash", str(script)], cwd=str(REPO_ROOT), timeout=30, capture_output=True)
                break
        try:
            feed = _load("desk_feed")
            payload = feed.claw_payload(
                fog_public=int(fog_ok), edge=int(edge_ok), local8787=int(local8787),
                tokens_used=tokens_used, tokens_limit=tokens_limit,
            )
            _load("desk_bus").feed_append("openclaw", payload, kind="audit", specialty="claw")
        except Exception:
            pass
    ok = fog_ok or edge_ok or local8787
    payload = (
        f"hops fog={int(fog_ok)} edge={int(edge_ok)} :8787={int(local8787)} "
        f"| tokens {tokens_used}/{tokens_limit}"
    )
    out = {
        "ok": ok,
        "result": payload,
        "done": ok,
        "sha": "",
        "verb": "audit" if ok else "dispute",
    }
    if not ok:
        out["escalate"] = False
        out["peer"] = "refer"  # specialty path may refer to coord
    return out


def handler_coord(task: dict, *, dry: bool) -> dict:
    """protocol.check + board + reports sync + maybe_auto_ship; T1 writes WG brief."""
    if dry:
        return {"ok": True, "result": "coord dry-run", "done": False, "sha": "", "verb": "act"}
    try:
        proto = _load("desk_protocol")
        bus = _load("desk_bus")
        state = bus.load_state()
        chk = proto.check(state)
        # reports sync + TODO board (real surface work)
        try:
            rep = _load("desk_reports")
            rep.sync(limit=12, prepend=True, feed=True)
            rep.write_todo_board(state=bus.load_state())
        except Exception as e:
            print(f"coord reports warn: {e}", file=sys.stderr)
        try:
            issues = _load("desk_issues")
            issues.cmd_ensure(argparse.Namespace(dry_run=False, force=False))
            issues.cmd_sync(argparse.Namespace(dry_run=False, limit=15))
        except Exception as e:
            print(f"coord issues warn: {e}", file=sys.stderr)
        cmod = _load("desk_connectors")
        rows = [cmod.probe_surface(s) for s in (cmod.load_registry().get("surfaces") or [])]
        gates = [r for r in rows if r.get("ship_gate")]
        present = sum(1 for r in gates if r["status"] == "present")
        board = classify(bus.load_state())
        ship_out = {}
        try:
            ship_out = auto_ship_tick(dry=False)
        except Exception as e:
            ship_out = {"err": str(e)[:80]}
        # Hermes ≥64k soft meter
        try:
            hm = FOG / "data" / "desk-meters" / "hermes.json"
            ctx = 0
            if hm.is_file():
                ctx = int(json.loads(hm.read_text(encoding="utf-8")).get("context_length") or 0)
            if ctx and ctx < 65536:
                bus.feed_append(
                    "hermes",
                    f"context {ctx}<65536 — use qwen2.5:7b+ (see hermes/CONTEXT-64K.md)",
                    kind="dispute",
                    specialty="coord",
                )
        except Exception:
            pass
        intent = (task.get("intent") or "").lower()
        # T1 / WG prove — actionable outbox brief (Mac executes; box documents)
        if "wg" in intent or "10.88" in intent or "taper-t1" in (task.get("source") or "") or "t1" in intent:
            _write_wg_t1_brief(task)
        result = (
            f"protocol={'ok' if chk['ok'] else 'VIOL'} "
            f"gates={present}/{len(gates)} "
            f"board on={len(board['ongoing'])} pe={len(board['pending'])} "
            f"pr={len(board['projected'])} es={len(board['escalated'])} "
            f"ship={len(ship_out.get('results') or [])}"
        )
        if not chk["ok"]:
            return {
                "ok": False,
                "result": result + " " + ",".join(chk["violations"][:3]),
                "done": False,
                "sha": "",
                "escalate": True,
                "verb": "dispute",
            }
        # peer vote when ship candidates wait majority
        try:
            _maybe_collegium_verbs(bus, task, board, ship_out)
        except Exception as e:
            print(f"collegium verbs warn: {e}", file=sys.stderr)
        return {"ok": True, "result": result, "done": True, "sha": "", "verb": "act"}
    except Exception as e:
        return {"ok": False, "result": f"coord fail: {e}", "done": False, "sha": "", "verb": "dispute"}


def _run_code_unittest_subset() -> dict:
    """Real compileall + unittest discover — shared by handler_code and self-audit.

    Nest-safe: sets DESK_CODE_NEST=1 so nested cycle tests skip re-entry.
    Self-audit uses a narrow -p that excludes test_desk_ops (cycle recursion).
    """
    if os.environ.get("DESK_CODE_NEST") == "1":
        return {
            "ok": True,
            "result": "unittest skip nested (DESK_CODE_NEST)",
            "done": False,
            "sha": "",
            "verb": "audit",
            "nested_skip": True,
        }
    comp = subprocess.run(
        [sys.executable, "-m", "compileall", "-q", str(HERE)],
        cwd=str(REPO_ROOT), capture_output=True, text=True, timeout=60,
    )
    if comp.returncode != 0:
        tail = ((comp.stderr or comp.stdout or "")[-140:]).replace("\n", " ")
        return {
            "ok": False,
            "result": f"compileall FAIL {tail}"[:220],
            "done": False,
            "sha": "",
            "verb": "refer",
            "peer": "refer",
            "peer_vote": True,
            "next_action": "opencode: fix compile errors in ops/desk-collegium then re-run discover",
        }
    # discover by path (hyphen dir is not a Python package)
    # Exclude test_desk_ops from self-audit-style runs to avoid cycle recursion;
    # handler_code still runs a safe subset under DESK_CODE_NEST.
    patterns = [
        "test_desk_bus.py",
        "test_desk_metabol.py",
        "test_desk_feed.py",
        "test_desk_roles.py",
    ]
    existing = [p for p in patterns if (HERE / p).is_file()]
    if not existing:
        return {
            "ok": False,
            "result": "unittest FAIL no safe test_desk_*.py found",
            "done": False,
            "sha": "",
            "verb": "refer",
            "peer": "refer",
            "next_action": "opencode: restore desk unit tests under ops/desk-collegium",
        }
    env = os.environ.copy()
    env["DESK_CODE_NEST"] = "1"
    # Run listed modules by file path load (avoid hyphen package import + avoid ops recursion)
    r = subprocess.run(
        [sys.executable, "-m", "unittest", "discover", "-s", str(HERE), "-p", "test_desk_bus.py", "-q"],
        cwd=str(REPO_ROOT), capture_output=True, text=True, timeout=120, env=env,
    )
    # accumulate remaining patterns
    rc = r.returncode
    tails = [(r.stderr or r.stdout or "")]
    for pat in ("test_desk_metabol.py", "test_desk_feed.py", "test_desk_roles.py"):
        if not (HERE / pat).is_file():
            continue
        ri = subprocess.run(
            [sys.executable, "-m", "unittest", "discover", "-s", str(HERE), "-p", pat, "-q"],
            cwd=str(REPO_ROOT), capture_output=True, text=True, timeout=120, env=env,
        )
        rc = rc or ri.returncode
        tails.append(ri.stderr or ri.stdout or "")
    class _R: pass
    r = _R(); r.returncode = rc; r.stderr = "\n".join(tails); r.stdout = ""
    ok = r.returncode == 0
    tail = (r.stderr or r.stdout or "")[-140:].replace("\n", " ")
    out = {
        "ok": ok,
        "result": f"unittest discover rc={r.returncode} {'PASS' if ok else 'FAIL'} {tail}"[:220],
        "done": ok,
        "sha": "",
        "verb": "audit" if ok else "refer",
    }
    if not ok:
        out["peer"] = "refer"
        out["peer_vote"] = True
        out["next_action"] = "opencode: patch failing desk tests; peers cast ack after green discover"
    return out


def handler_code(task: dict, *, dry: bool) -> dict:
    """compileall desk-collegium + unittest discover; refer+peer_vote on FAIL (collegium path)."""
    if dry:
        return {"ok": True, "result": "code dry-run", "done": False, "sha": "", "verb": "act"}
    # Prefer consuming outbox brief when present (agent-run writes it)
    brief = FOG / "data" / "desk-outbox" / "opencode-next.md"
    consumed = ""
    if brief.is_file():
        try:
            consumed = brief.read_text(encoding="utf-8")[:80].replace("\n", " ")
        except Exception:
            consumed = "brief-present"
    out = _run_code_unittest_subset()
    if consumed:
        out["result"] = (out.get("result") or "") + f" | brief={consumed[:40]}"
        out["result"] = out["result"][:220]
    return out


def handler_lead(task: dict, *, dry: bool) -> dict:
    """André gates escalate; representable work acts (vault/gh/vapour) — never dump on André."""
    intent = (task.get("intent") or "").lower()
    if _is_andre_human_gate_task(task):
        return {
            "ok": True,
            "result": "escalate_to_andre (Fog g / 2FA / captcha / Oracle password / Renovate major) — no fake progress",
            "done": False,
            "sha": "",
            "escalate": True,
            "verb": "escalate",
            "next_action": "André: clear true human_gate only — STRATAGROK already tried representative path",
        }
    # Representable: try vault materialize + document gh soft-fail
    if not dry and ("vault" in intent or "automation.desk" in intent or "desk-mail" in intent):
        try:
            rep = _load("desk_reports")
            mat = rep.try_materialize_desk_mail_vault()
            if mat.get("ok") or mat.get("created"):
                return {
                    "ok": True,
                    "result": f"act representative vault materialize created={mat.get('created')} already={mat.get('already')}",
                    "done": True,
                    "sha": "",
                    "verb": "act",
                }
            if mat.get("missing_src") or mat.get("retry_pull"):
                return {
                    "ok": True,
                    "result": f"refer: vault still missing {mat.get('missing_src')} — retry ensure-desk-vault/Tailscale pull (not André gate)",
                    "done": False,
                    "sha": "",
                    "escalate": False,
                    "verb": "refer",
                    "next_action": "Mac: ensure-desk-vault.sh or VAULT_PULL_TOKEN pull; desk keeps cycling other Acts",
                }
        except Exception as e:
            return {
                "ok": False,
                "result": f"representative vault fail: {e}"[:160],
                "done": False,
                "sha": "",
                "verb": "dispute",
                "peer_vote": True,
                "next_action": "stratagrok: revise vault materialize helper",
            }
    if "gh" in intent or "path" in intent or "launchagent" in intent:
        return {
            "ok": True,
            "result": "act representative: gh PATH soft-fail already in connectors; LaunchAgent origin fix via Mac agent-run — not André",
            "done": False,
            "sha": "",
            "verb": "act",
            "next_action": "hermes/opencode: ensure gh on PATH in FogRuntime; connectors soft-fail remains",
            "peer_vote": True,
        }
    if "oracle" in intent or "grok90" in intent or "m-ii" in intent or "m-2" in intent:
        return {
            "ok": True,
            "result": "act representative: Oracle/grok@ is STRATAGROK+vaulted (2FA/captcha only to André)",
            "done": False,
            "sha": "",
            "escalate": False,
            "verb": "act",
            "resolve_as_representative": True,
            "next_action": "stratagrok: use vaulted grok@; escalate only on 2FA/captcha",
            "peer_vote": True,
        }
    # Soft: record taper status + board gap note (real meter, not vapour done)
    if not dry:
        try:
            ts = record_taper_status(dry=False)
            note = (
                f"taper trial_ends={ts.get('trial_ends_pt')} t3={ts.get('t3_from_pt')} "
                f"ok={int(bool(ts.get('ok')))} — lead audits board; Act work stays with specialties"
            )
            return {"ok": True, "result": note, "done": False, "sha": "", "verb": "audit"}
        except Exception as e:
            return {"ok": False, "result": f"lead taper fail: {e}"[:160], "done": False, "sha": "", "verb": "dispute"}
    return {"ok": True, "result": "lead dry-run", "done": False, "sha": "", "verb": "audit"}


def handler_edge(task: dict, *, dry: bool) -> dict:
    """Health probe + actionable outbox brief; 429/1015 → dispute+revise retry (not dead-end)."""
    ok, detail = _http_ok("https://api-edge.calhegasmorais.pt/health", retries=2)
    edge_ok, site_detail = _http_ok("https://edge.calhegasmorais.pt/", retries=2)
    rate = _is_rate_limited(detail) or _is_rate_limited(site_detail)
    result = f"edge api={int(ok)} site={int(edge_ok)}"
    if rate and not (ok or edge_ok):
        result += " | 429/1015 after backoff"
    elif not ok and detail:
        result += f" | {detail[:40]}"
    if not dry:
        steps = [
            "GET https://api-edge.calhegasmorais.pt/health (expect 200; backoff on 429/1015)",
            "Consume origin GETs only — no Worker deploy, no workers.dev",
            "If rate-limited: revise slot retries with backoff; peer vote if still down",
            "If api dark (not 429): check named tunnel + Fog origin; refer Hermes coord",
            "Diary: cite task id; Bot=escalate only for true human_gate",
        ]
        _write_assistant_brief("edge-assistant", task, result, steps=steps)
        try:
            kind = "audit" if (ok or edge_ok) else "dispute"
            _load("desk_bus").feed_append("edge", result, kind=kind, specialty="edge")
        except Exception:
            pass
    if ok or edge_ok:
        return {"ok": True, "result": result, "done": True, "sha": "", "verb": "audit"}
    out = {
        "ok": False,
        "result": result,
        "done": False,
        "sha": "",
        "verb": "dispute",
        "peer": "refer",
        "peer_vote": True,
        "next_action": (
            "edge-assistant: wait backoff then re-GET api-edge+/edge; "
            "cast ack if 200 else hermes refer tunnel"
        ),
    }
    if rate:
        out["next_action"] = (
            "edge-assistant: CF 429/1015 — revise after ≥30s; re-run handler_edge; "
            "peer vote only if still fail"
        )
        out["auto_cast_ack"] = True
    return out


def handler_fog(task: dict, *, dry: bool) -> dict:
    """Origin health + actionable outbox brief for Fog Assistant / Hermes."""
    ok, detail = _http_ok("https://fog.calhegasmorais.pt/health")
    result = f"fog origin health={'ok' if ok else 'DOWN'}"
    if not dry:
        _write_assistant_brief(
            "fog-assistant",
            task,
            result,
            steps=[
                "Confirm https://fog.calhegasmorais.pt/health",
                "Mac: FogRuntime / :8787 local; dual-run WG 10.88.0.0/24 when T1 Act",
                "One-Act Delegate rail — propose next Act in-thread when idle",
                "Never browser-automate from Bot box; write brief for Mac agent-run",
            ],
        )
        try:
            _load("desk_bus").feed_append(
                "fog",
                result + ("" if ok else f" | {detail[:50]}"),
                kind="audit" if ok else "dispute",
                specialty="fog",
            )
        except Exception:
            pass
    return {
        "ok": ok,
        "result": result + (" — one-Act Delegate rail" if ok else f" — {detail[:60]}"),
        "done": ok,
        "sha": "",
        "verb": "audit" if ok else "dispute",
    }


def handler_teach(task: dict, *, dry: bool) -> dict:
    """Academy teach — live check + real apprenticeship lesson trail in outbox."""
    ok, detail = _http_ok("https://academy.calhegasmorais.pt/health")
    if not ok:
        ok, detail = _http_ok("https://academy.calhegasmorais.pt/")
    note = (
        f"academy_teach live={int(ok)} students=SCA/ACB teachers=desk "
        f"— apprenticeship_by_doing (never enroll desk agents)"
    )
    if not dry:
        path = FOG / "data" / "desk-meters" / "academy-teach.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"ts": _now(), "academy_ok": ok, "duty": "academy_teach"}, indent=2) + "\n")
        # Always write lesson trail from this deliverable (even if academy soft-down)
        write_apprenticeship_trail(task, {"result": note, "done": ok}, agent="hermes")
        try:
            _load("desk_bus").feed_append(
                "hermes", note[:200], kind="act" if ok else "refer", specialty="teach",
            )
        except Exception:
            pass
    return {"ok": True, "result": note, "done": ok, "sha": "", "verb": "act" if ok else "refer"}



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
                f"Mail: automation.desk@calhegasmorais.pt (shared) — "
                f"IMAP/SMTP paths `~/.config/stratagrok/automation.desk.imap|.smtp` (no passwords in git).\n"
                f"Self-queue; Bot=escalate only. Cite task id in diary.\n"
                f"Do the intent; report via desk_bus commit/done.\n"
            )
            (box / "opencode-next.md").write_text(md)
        if agent == "hermes":
            (box / "hermes-next.md").write_text(
                f"# Collegium / teach\n\n{task.get('intent')}\n\n"
                f"Duty: academy_teach for SCA/ACB; you are teacher not student.\n"
                f"Mail: automation.desk@calhegasmorais.pt shared Maildir — "
                f"config paths ~/.config/stratagrok/automation.desk.imap|.smtp\n"
            )
        if agent == "openclaw":
            (box / "openclaw-next.md").write_text(
                f"# Claw task {task.get('id')}\n\n{task.get('intent')}\n\n"
                f"Run: bash deploy/mac-fog/desk-claw-probe.sh\n"
                f"Verb: audit hops; diary cite task id.\n"
                f"Mail: automation.desk@ shared — ~/.config/stratagrok/automation.desk.imap|.smtp\n"
            )
        if agent in ("fog-assistant", "fog"):
            _write_assistant_brief("fog-assistant", task, str(out.get("result") or ""), steps=[
                "Confirm fog origin /health",
                "One-Act Delegate; propose next when idle",
            ])
        if agent in ("edge-assistant", "edge"):
            _write_assistant_brief("edge-assistant", task, str(out.get("result") or ""), steps=[
                "GET api-edge /health",
                "Consume-origin only",
            ])
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


def specialty_self_audit_tick(*, dry: bool = False, state: dict | None = None) -> dict:
    """Run lightweight specialty audits when lane ALLOW; HOLD/STASIS skip (metabol law)."""
    if dry:
        return {"ok": True, "dry": True}
    results = {}
    try:
        bus = _load("desk_bus")
        state = state if state is not None else bus.load_state()
    except Exception:
        state = state or {}

    def _run(spec: str, fn, task: dict):
        allowed, pace, lane = _pace_allows(state, spec)
        if not allowed:
            _feed_metabol_skip(spec, pace, lane, state)
            results[spec] = {"ok": True, "skipped": True, "pace": pace, "result": f"skip {pace}"}
            return
        try:
            results[spec] = fn(task, dry=False)
        except Exception as e:
            results[spec] = {"ok": False, "result": str(e)[:80]}

    _run("claw", handler_claw, {"id": "audit-claw", "specialty": "claw"})
    # code: REAL unittest discover (no vapour stamp) when lane ALLOW
    allowed_c, pace_c, lane_c = _pace_allows(state, "code")
    if not allowed_c:
        _feed_metabol_skip("code", pace_c, lane_c, state)
        results["code"] = {"ok": True, "skipped": True, "pace": pace_c}
    else:
        try:
            code_out = _run_code_unittest_subset()
            results["code"] = code_out
            meters = FOG / "data" / "desk-meters"
            meters.mkdir(parents=True, exist_ok=True)
            (meters / "opencode-audit.json").write_text(json.dumps({
                "ts": _now(),
                "audit": "unittest_discover",
                "ok": bool(code_out.get("ok")),
                "result": (code_out.get("result") or "")[:180],
            }, indent=2) + "\n")
            try:
                _load("desk_bus").feed_append(
                    "opencode",
                    (code_out.get("result") or "code audit")[:200],
                    kind=("audit" if code_out.get("ok") else "refer"),
                    specialty="code",
                )
            except Exception:
                pass
        except Exception as e:
            results["code"] = {"ok": False, "result": str(e)[:80], "verb": "refer", "peer_vote": True,
                               "next_action": "opencode: fix self-audit unittest runner"}
    _run("coord", handler_coord, {"id": "audit-coord", "specialty": "coord"})
    _run("fog", handler_fog, {"id": "audit-fog", "specialty": "fog"})
    _run("edge", handler_edge, {"id": "audit-edge", "specialty": "edge"})
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




def _write_wg_t1_brief(task: dict) -> None:
    """Actionable T1 WG prove brief for Mac Hermes/agent-run (box cannot bind WG)."""
    try:
        box = FOG / "data" / "desk-outbox"
        box.mkdir(parents=True, exist_ok=True)
        md = (
            f"# T1 WG prove — {task.get('id')}\n\n"
            f"**Intent:** {task.get('intent')}\n\n"
            "## Act on Mac (not Bot box)\n\n"
            "1. Confirm WireGuard `10.88.0.0/24` up — Mac `10.88.0.2`\n"
            "2. Ping peer / iPhone on same net; note RTT\n"
            "3. OpenVPN operator path dual-run OK; **no paid Tailscale seats**\n"
            "4. Write meter `desk-meters/wg-t1.json` with up/peers/ts\n"
            "5. `desk_bus.py act|done` this task with result; diary cite id\n\n"
            "TRIAL_ENDS_PT=2026-09-16 — taper T2/T3/T4 stay Plan/HOLD.\n"
        )
        (box / "hermes-wg-t1.md").write_text(md)
        (box / "hermes-next.md").write_text(md)
        (box / "wg-t1-latest.json").write_text(json.dumps({
            "ts": _now(), "task_id": task.get("id"), "intent": task.get("intent"),
            "action": "mac_prove_wg_10_88", "paid_seats": False,
        }, indent=2) + "\n")
    except Exception:
        pass


def _write_assistant_brief(agent: str, task: dict, result: str, *, steps: list[str]) -> None:
    """Non-empty actionable outbox brief for fog/edge (Hermes/agent-run executes)."""
    try:
        box = FOG / "data" / "desk-outbox"
        box.mkdir(parents=True, exist_ok=True)
        lines = [
            f"# Desk brief — {agent} — {task.get('id')}",
            "",
            f"**Intent:** {task.get('intent')}",
            f"**Probe:** {result}",
            "",
            "## Execute (real work — not vapour)",
            "",
        ]
        for i, s in enumerate(steps, 1):
            lines.append(f"{i}. {s}")
        lines.append("")
        lines.append("Read TODO.md + CONTEXT pack first. Bot=escalate only.")
        md = "\n".join(lines) + "\n"
        (box / f"{agent}-next.md").write_text(md)
        (box / f"{agent}-latest.json").write_text(json.dumps({
            "ts": _now(), "agent": agent, "task_id": task.get("id"),
            "intent": task.get("intent"), "result": result, "steps": steps,
        }, indent=2) + "\n")
    except Exception:
        pass


def _maybe_collegium_verbs(bus, task: dict, board: dict, ship_out: dict) -> None:
    """Wire vote/refer/dispute when metrics/peers require (bus already has verbs)."""
    if len(board.get("escalated") or []) >= 3:
        bus.feed_append(
            "hermes",
            f"refer lead: escalated={len(board['escalated'])} human gates waiting",
            kind="refer",
            specialty="coord",
        )
    for r in ship_out.get("results") or []:
        if r.get("action") in ("escalate_nack", "escalate_oob"):
            bus.feed_append(
                "hermes",
                f"dispute ship {r.get('id')}: {r.get('action')}",
                kind="dispute",
                specialty="coord",
            )
        elif r.get("action") == "wait_majority":
            tid = r.get("id")
            if tid:
                try:
                    bus.cmd_call_vote(argparse.Namespace(
                        task_id=tid, by="hermes",
                        note="coord: call vote — wait majority for ship",
                    ))
                except Exception:
                    bus.feed_append(
                        "hermes",
                        f"vote call {tid} acks={r.get('acks')}/{r.get('need')}",
                        kind="vote",
                        specialty="coord",
                    )


def _pace_allows(state: dict, spec: str) -> tuple[bool, str, str]:
    """STASIS=block all; HOLD=block non-lead. lane-bot never freezes other specialties."""
    lane = _specialty_lane(spec)
    pace = _lane_pace(state, lane)
    if pace == "STASIS":
        return False, pace, lane
    if pace == "HOLD" and spec not in ("lead",):
        return False, pace, lane
    return True, pace, lane


def _feed_metabol_skip(spec: str, pace: str, lane: str, state: dict) -> None:
    """Explainable feed when metabol pace skips a specialty."""
    try:
        lanes = (state.get("lanes") or {}).get(lane) or {}
        extra = lanes.get("sample_note") or ""
        tokens = ""
        if lanes.get("tokens_used") is not None and lanes.get("tokens_limit"):
            tokens = f" tokens={int(lanes['tokens_used'])}/{int(lanes['tokens_limit'])}"
        short = lane.replace("lane-", "")
        payload = f"metabol: skip {short} {pace}{tokens}"
        if extra and pace in ("HOLD", "STASIS"):
            payload += f" | {str(extra)[:60]}"
        _load("desk_bus").feed_append("desk", payload, kind="audit", specialty=spec or "coord")
    except Exception:
        pass



HANDLERS = {
    "claw": handler_claw,
    "coord": handler_coord,
    "code": handler_code,
    "lead": handler_lead,
    "edge": handler_edge,
    "fog": handler_fog,
    "teach": handler_teach,
}


# True André-only gates (protocol human_gates). Everything else: STRATAGROK resolve_as_representative.
ANDRE_HUMAN_GATE_NEEDLES = (
    "2fa",
    "captcha",
    # Oracle/grok90 is STRATAGROK + vaulted grok@ — NOT André (2FA/captcha only)
    "renovate major",
    "fog g",
    " g to recent",
    "press g",
    "manual g",
    "tui g",
)
ANDRE_HUMAN_GATE_HOLDS = (
    "andre_2fa",
    "andre_captcha",
    "renovate_major",
    "fog_tui_g",
)


def _is_andre_human_gate_task(task: dict) -> bool:
    """True only for Fog g / 2FA / captcha / Renovate majors (Oracle = STRATAGROK).

    Flags andre_gate / escalate_to_andre / human_gate alone do NOT park — vault,
    automation.desk.*, gh PATH, edge 429 are revise→act (vault is present).
    """
    if task.get("resolve_as_representative"):
        return False
    intent = f"{task.get('intent') or ''} {task.get('title') or ''} {task.get('result') or ''}".lower()
    hold = str(task.get("hold_until") or "").lower()
    if hold in ANDRE_HUMAN_GATE_HOLDS:
        return True
    if any(k in intent for k in ANDRE_HUMAN_GATE_NEEDLES):
        return True
    return False


def _is_human_gate_task(task: dict) -> bool:
    """Legacy name = André-only gate. Prefer _is_andre_human_gate_task.

    automation.desk vault / gh PATH / edge 429 / OpenCode idle / vapour are
    STRATAGROK resolve_as_representative — NOT André dumps.
    """
    if task.get("resolve_as_representative"):
        return False
    # human_gate flag alone is insufficient — many projected items were over-flagged
    if task.get("andre_gate") or task.get("escalate_to_andre"):
        return True
    if _is_andre_human_gate_task(task):
        return True
    # Keep explicit human_gate only when intent clearly André-only
    if task.get("human_gate") and _is_andre_human_gate_task(task):
        return True
    return False


def _handler_for(task: dict) -> str | None:
    spec = task.get("specialty") or "coord"
    if task.get("duty") == "academy_teach" or "academy teach" in (task.get("intent") or "").lower():
        return "teach"
    if spec in HANDLERS:
        return spec
    return None


def _pick_rr_path() -> Path:
    return FOG / "data" / "desk-meters" / "pick-rr.json"


def _pick_rr_cursor() -> int:
    p = _pick_rr_path()
    if not p.is_file():
        return 0
    try:
        return int(json.loads(p.read_text(encoding="utf-8")).get("cursor") or 0)
    except Exception:
        return 0


def _pick_rr_advance(chosen_spec: str) -> None:
    order = ["claw", "code", "teach", "coord", "edge", "fog", "lead"]
    try:
        idx = order.index(chosen_spec)
    except ValueError:
        idx = _pick_rr_cursor()
    nxt = (idx + 1) % len(order)
    try:
        p = _pick_rr_path()
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps({"ts": _now(), "cursor": nxt, "last": chosen_spec}, indent=2) + "\n")
    except Exception:
        pass


def pick_actable_fallback(state: dict, *, max_n: int = 1) -> list[dict]:
    """If RR pick is empty but open Act work remains, take the next representable task.

    Skips only true André gates and eisenhower plan/note. Used so r/60s cannot
    idle-skip while dt-* Acts are still open.
    """
    out: list[dict] = []
    for t in state.get("open_tasks") or []:
        if _is_andre_human_gate_task(t):
            continue
        eisen = (t.get("eisenhower") or "act").lower()
        if eisen in ("plan", "note"):
            continue
        spec = _handler_for(t) or "coord"
        allowed, pace, lane = _pace_allows(state, spec)
        if not allowed:
            continue
        item = dict(t)
        item["_handler"] = spec
        item["_pace"] = pace
        item["_lane"] = lane
        out.append(item)
        if len(out) >= max_n:
            break
    return out



def _task_tags(task: dict) -> list[str]:
    """Light tag extraction for camaraderie soft prior (intent/specialty only)."""
    tags: list[str] = []
    spec = (task.get("specialty") or "").strip().lower()
    if spec:
        tags.append(f"craft:{spec}")
    intent = (task.get("intent") or "").lower()
    for key in ("fog-tui", "origin-put", "mail-sync", "hops", "code", "coord", "claw", "edge", "teach"):
        if key in intent.replace("_", "-") or key in intent:
            tags.append(f"craft:{key.replace('-', '-')}")
    # de-dupe
    out: list[str] = []
    seen: set[str] = set()
    for t in tags:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out[:8]


def _reputation_soft_prior(task: dict) -> float:
    """Soft prior only — never starves RR. KPI-wall: reputation store, not metrics."""
    try:
        import importlib.util
        fp = Path(__file__).resolve().parent / "reputation" / "store.py"
        spec = importlib.util.spec_from_file_location("desk_reputation_store_ops", fp)
        mod = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(mod)
        return float(
            mod.soft_prior_score_for_specialty(
                str(task.get("specialty") or ""),
                task_tags=_task_tags(task),
            )
        )
    except Exception:
        return 0.0


def suggest_refer_helpers(task: dict, *, limit: int = 3) -> list[str]:
    """Refer-path soft prior: specialty → will_help∩tags → recent notes → RR."""
    try:
        import importlib.util
        fp = Path(__file__).resolve().parent / "reputation" / "store.py"
        spec = importlib.util.spec_from_file_location("desk_reputation_store_ops2", fp)
        mod = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(mod)
        ranked = mod.rank_helpers(
            task_tags=_task_tags(task),
            specialty=str(task.get("specialty") or ""),
        )
        return [r["id"] for r in ranked[:limit]]
    except Exception:
        return []


def pick_tasks(state: dict, *, max_n: int, include_human_gates: bool = False) -> list[dict]:
    """Fair RR across specialties so claw cannot starve code/coord at --max 1.

    Skip Plan/Note + human gates unless asked. Metabol HOLD/STASIS still enforced.

    Soft prior (camaraderie): after RR specialty rotation, a tiny qualitative
    reputation / will_help boost may re-order within the same RR bucket — never
    a hard gate, never KPI blend, never starves juniors or teach lane.
    """
    board = classify(state)
    order = ["claw", "code", "teach", "coord", "edge", "fog", "lead"]
    cur = _pick_rr_cursor() % len(order)
    rotated = order[cur:] + order[:cur]
    prio = {s: i for i, s in enumerate(rotated)}
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
        allowed, pace, lane = _pace_allows(state, use_spec)
        if not allowed:
            _feed_metabol_skip(use_spec, pace, lane, state)
            continue
        t = dict(t)
        t["_handler"] = use_spec
        t["_pace"] = pace
        t["_lane"] = lane
        soft = _reputation_soft_prior(t)
        t["_rep_soft"] = soft
        # RR prio primary; soft prior secondary (negate soft so higher fit sorts first); updated tertiary
        scored.append((prio.get(use_spec, 5), -soft, t))
    scored.sort(key=lambda x: (x[0], x[1], (x[2].get("updated") or "")))
    # diversify: at most one task per specialty in a pick batch
    picked: list[dict] = []
    seen: set[str] = set()
    for _, __, t in scored:
        spec = t.get("_handler") or ""
        if spec in seen:
            continue
        seen.add(spec)
        picked.append(t)
        if len(picked) >= max_n:
            break
    if picked:
        _pick_rr_advance(str(picked[0].get("_handler") or "claw"))
    return picked


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
    if as_escalate:
        bus._mutate(tid, "escalate", by="stratagrok", note="protocol: true André gate (g/2FA/captcha/Oracle reset/Renovate major)")
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
        # escalate on seed only for André-true gates — not representable work
        andre = bool(item.get("andre_gate") or item.get("escalate_to_andre")) or (
            bool(item.get("human_gate")) and _is_andre_human_gate_task(item)
        )
        got = _seed_one_projected(bus, item, dry=dry, as_escalate=andre)
        if got:
            seeded.append(got if not str(got).startswith("would") else got)
            if not dry:
                state = bus.load_state()
    return seeded


def unpark_false_escalates(bus, state: dict, *, dry: bool = False) -> list[str]:
    """Move parked escalate tasks that are not true André gates back to revise→act."""
    moved: list[str] = []
    for t in list(state.get("open_tasks") or []):
        st = str(t.get("status") or "")
        if st not in ("escalate", "hold"):
            continue
        if _is_andre_human_gate_task(t):
            continue
        tid = t.get("id")
        if not tid:
            continue
        moved.append(tid)
        if dry:
            continue
        t["resolve_as_representative"] = True
        t["andre_gate"] = False
        t["escalate_to_andre"] = False
        bus.save_state(state)
        try:
            bus._mutate(tid, "revise", by="stratagrok", note="unpark: not Fog g/2FA/captcha/Oracle reset/Renovate major — vault present; revise→act")
        except Exception:
            t["status"] = "revise"
            bus.save_state(state)
    return moved


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


def _diary_agent(by: str) -> str:
    b = (by or "").lower()
    if "opencode" in b:
        return "opencode"
    if "openclaw" in b:
        return "openclaw"
    if "grok" in b or "stratagrok" in b:
        return "stratagrok"
    if "edge" in b:
        return "edge-assistant"
    if "fog" in b and "hermes" not in b:
        return "fog-assistant"
    if "hermes" in b or b in ("coord", "desk"):
        return "hermes"
    return "hermes"


def _diary(by: str, verb: str, tid: str, note: str = "") -> None:
    try:
        rep = _load("desk_reports")
        rep.ensure_agent_journals()
        rep.append_diary(_diary_agent(by), verb=verb, task_id=tid, note=(note or "")[:160])
    except Exception as e:
        print(f"diary warn: {e}", file=sys.stderr)


def collegium_continue_after_soft_fail(bus, task: dict, out: dict, *, by: str) -> None:
    """Force collegium path after dispute/refer — never leave a dead-end feed note.

    Chain: revise (next_action slot) → optional call_vote for peers.
    True human_gate escalate is handled separately and does not get auto-revise.
    """
    tid = task["id"]
    next_action = (out.get("next_action") or "retry specialty handler with amend/revise").strip()
    # Soft camaraderie prior for refer targets (specialty → will_help → notes → RR)
    try:
        helpers = suggest_refer_helpers(task, limit=3)
        if helpers and (out.get("peer") == "refer" or out.get("peer_vote") or out.get("verb") == "refer"):
            out = dict(out)
            out["soft_helpers"] = helpers
            if "soft_helpers" not in next_action:
                next_action = f"{next_action} | soft_helpers={','.join(helpers)}"
    except Exception:
        pass
    # revise keeps task open with actionable slot
    bus._mutate(
        tid,
        "revise",
        by=by,
        note=f"next_action: {next_action}"[:220],
    )
    _diary(by, "revise", tid, f"next_action: {next_action}"[:160])
    if out.get("peer_vote") or out.get("peer") == "refer":
        bus._mutate(
            tid,
            "vote",
            by=by,
            note=f"call vote on next_action: {next_action}"[:220],
            verb="call_vote",
            feed_kind="vote",
            history_extra={"vote_phase": "call"},
        )
        _diary(by, "call_vote", tid, f"peers: ack/nack — {next_action}"[:160])
        # Auto-cast ack from specialty owner when retry path is machine-solvable
        # (rate-limit / unittest) so the vote is not abandoned; peers may still nack.
        if out.get("auto_cast_ack"):
            try:
                bus.cmd_cast(argparse.Namespace(
                    task_id=tid, by=by, vote="ack",
                    note="auto-ack: retry path armed",
                ))
                _diary(by, "cast", tid, "ack retry path armed")
            except Exception as e:
                print(f"cast warn: {e}", file=sys.stderr)


_LIVE_ORIGIN_NEEDLES = (
    "origin", "pages", "worker", "spa", "dag", "pulse", "fund", "html",
    "put", "ship_live", "atelier", "frontend", "landing",
)


def _task_looks_live_origin(task: dict, out: dict | None = None) -> bool:
    """True when result should go ship_live (majority+PUT) instead of done."""
    out = out or {}
    if out.get("ship_live") or task.get("ship_live"):
        return True
    blob = f"{task.get('intent') or ''} {task.get('title') or ''} {out.get('result') or ''}".lower()
    return any(k in blob for k in _LIVE_ORIGIN_NEEDLES)


def apply_result(bus, task: dict, out: dict, *, by: str) -> None:
    tid = task["id"]
    verb = (out.get("verb") or "").strip().lower()
    chain: list[str] = []
    if out.get("escalate"):
        verb = verb or "escalate"
        bus._mutate(tid, "escalate", by=by, note=out.get("result") or "escalate")
        chain.append("escalate")
        _diary(by, "escalate", tid, out.get("result") or "escalate")
        # Record gate properly: ensure next_action is human-visible, no fake progress
        if out.get("next_action"):
            _diary(by, "act", tid, f"human_gate next: {out.get('next_action')}"[:160])
            chain.append("act")
    elif out.get("done"):
        intent_l = f"{task.get('intent') or ''} {task.get('title') or ''} {out.get('result') or ''}".lower()
        if ("oracle" in intent_l or "grok90" in intent_l) and not out.get("force_done"):
            bus._mutate(tid, "act", by=by, note=(out.get("result") or "") + " | oracle keep-open (not done)")
            bus.feed_append(by, f"oracle keep-open {tid}", kind="act", specialty=str(task.get("specialty") or "lead"))
            st = bus.load_state()
            t = bus.find_task(st, tid)
            if t:
                t["status"] = "act"
                t["done"] = False
                t["resolve_as_representative"] = True
                t["updated"] = _now()
                bus.save_state(st)
            chain.append("oracle_open")
            _diary(by, "act", tid, "oracle keep-open")
            verb = "act"
        elif _task_looks_live_origin(task, out):
            st = bus.load_state()
            t = bus.find_task(st, tid)
            if t:
                t["ship_live"] = True
                t["status"] = "act"
                t["done"] = False
                t["result"] = out.get("result") or t.get("result") or "mark ship_live"
                if out.get("sha"):
                    t["sha"] = out.get("sha")
                t["updated"] = _now()
                bus.save_state(st)
            bus._mutate(tid, "act", by=by, note=(out.get("result") or "") + " | mark ship_live")
            bus.feed_append(by, f"mark ship_live {tid}", kind="act", specialty=str(task.get("specialty") or "coord"))
            chain.append("ship_live")
            _diary(by, "act", tid, "mark ship_live")
            try:
                ship = _load("desk_ship")
                ship.cmd_vote(__import__("argparse").Namespace(
                    task_id=tid, vote="ack", by=by,
                    note="auto-ack after mark ship_live",
                ))
            except Exception as e:
                print(f"ship_live vote warn: {e}", file=sys.stderr)
            verb = "act"
        else:
            if out.get("sha"):
                bus._mutate(tid, "commit", by=by, result=out.get("result") or "", sha=out.get("sha") or "")
                verb = verb or "commit"
                chain.append("commit")
                _diary(by, "commit", tid, out.get("result") or "")
            bus._mutate(tid, "done", by=by, result=out.get("result") or "", close=True)
            verb = "done"
            chain.append("done")
            _diary(by, "done", tid, out.get("result") or "")
    elif out.get("put_now") or out.get("ship_now"):
        try:
            ship = _load("desk_ship")
            rc = ship.cmd_ship(__import__("argparse").Namespace(
                task_id=tid,
                by=by,
                result=out.get("result") or "ship_now from apply_result",
                sha=out.get("sha") or "",
                force_connectors=bool(out.get("force_connectors")),
                skip_put=False,
                force=bool(out.get("force")),
            ))
            chain.append("ship" if rc == 0 else f"ship_rc_{rc}")
            _diary(by, "commit" if rc == 0 else "escalate", tid, f"ship_now rc={rc}")
            verb = "commit" if rc == 0 else "escalate"
        except Exception as e:
            bus.feed_append("desk", f"ship_now fail {tid}: {e}", kind="escalate", specialty="coord")
            chain.append("ship_err")
    else:
        # After specialty work: prefer explicit verb, else act (not only constrain)
        verb = verb or "act"
        if out.get("peer") == "refer" and verb not in ("refer", "dispute", "escalate"):
            verb = "refer"
        if verb in ("constrain", "act", "audit", "amend", "revise", "refer", "dispute", "vote"):
            bus._mutate(tid, verb, by=by, note=out.get("result") or "progress")
        else:
            bus._mutate(tid, "act", by=by, note=out.get("result") or "progress")
            verb = "act"
        chain.append(verb)
        _diary(by, verb, tid, out.get("result") or "progress")
        # Collegium continuation: dispute/refer must open revise/vote, not stop
        if verb in ("dispute", "refer") and not out.get("escalate"):
            # machine-solvable retries auto-arm cast ack
            if out.get("next_action") and ("429" in (out.get("result") or "") or "unittest" in (out.get("result") or "") or out.get("auto_cast_ack") is None):
                if "429" in (out.get("result") or "") or "1015" in (out.get("result") or "") or "unittest" in (out.get("result") or ""):
                    out = dict(out)
                    out.setdefault("auto_cast_ack", True)
            collegium_continue_after_soft_fail(bus, task, out, by=by)
            chain.extend(["revise", "call_vote"])
    # Optional: stamp chain meter for audit
    try:
        meters = FOG / "data" / "desk-meters"
        meters.mkdir(parents=True, exist_ok=True)
        (meters / "last-verb-chain.json").write_text(json.dumps({
            "ts": _now(), "task": tid, "by": by, "chain": chain,
            "result": (out.get("result") or "")[:160],
        }, indent=2) + "\n")
    except Exception:
        pass


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
        bus.feed_append("stratagrok", f"ops cycle push /desk sha={sha or '-'}", kind="act", specialty="lead")
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
    if os.environ.get("DESK_CODE_NEST") == "1":
        print("ops: skip cycle (DESK_CODE_NEST)")
        return 0
    bus = _load("desk_bus")
    metabol = _load("desk_metabol")
    try:
        metabol.tick()
    except Exception as e:
        print(f"metabol warn: {e}", file=sys.stderr)

    state = bus.load_state()
    try:
        if not args.dry_run:
            moved = unpark_false_escalates(bus, state, dry=False)
            if moved:
                print(f"ops: unparked false André escalates n={len(moved)}")
            state = bus.load_state()
    except Exception as e:
        print(f"unpark warn: {e}", file=sys.stderr)
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
            aud = specialty_self_audit_tick(dry=False, state=state)
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
            picked = pick_actable_fallback(state, max_n=args.max)
        if not picked:
            msg = f"ops: idle-skip (protocol_ok={chk.get('ok')}; only human-gate/HOLD/plan left)"
            print(msg)
            if not args.dry_run:
                skip_flag = FOG / "data" / "desk-ops-idle-skip.ts"
                now = time.time()
                last = 0.0
                try:
                    last = float(skip_flag.read_text().strip() or "0")
                except Exception:
                    last = 0.0
                if now - last >= 600:
                    bus.feed_append("desk", msg, kind="audit", specialty="coord")
                    try:
                        skip_flag.parent.mkdir(parents=True, exist_ok=True)
                        skip_flag.write_text(str(now))
                    except Exception:
                        pass
                _write_last({"delivered": 0, "picked": [], "protocol_ok": chk.get("ok"), "idle_skip": True})
            return 0
        # Act work remained — feed must move on r/60s
        if not args.dry_run:
            bus.feed_append(
                "desk",
                f"r/60s cycle picked={picked[0].get('id')} spec={picked[0].get('_handler')} open={len(state.get('open_tasks') or [])}",
                kind="act",
                specialty=str(picked[0].get("_handler") or "coord"),
                force=True,
                dedupe=False,
            )

    if picked and not args.dry_run:
        try:
            bus.feed_append(
                "desk",
                f"r/60s cycle picked={picked[0].get('id')} spec={picked[0].get('_handler')} open={len(state.get('open_tasks') or [])}",
                kind="act",
                specialty=str(picked[0].get("_handler") or "coord"),
                force=True,
                dedupe=False,
            )
        except Exception:
            pass

    delivered = 0
    for task in picked:
        # auto-constrain propose → ongoing
        if (task.get("status") or "propose") == "propose" and not args.dry_run:
            bus._mutate(task["id"], "constrain", by="hermes", note="protocol: auto-constrain on cycle start")
            state = bus.load_state()
            task = bus.find_task(state, task["id"]) or task
        hname = task.get("_handler") or task.get("specialty") or "coord"
        # Defense in depth: re-check metabol pace immediately before handler
        state = bus.load_state()
        allowed, pace, lane = _pace_allows(state, hname)
        if not allowed:
            _feed_metabol_skip(hname, pace, lane, state)
            print(f"ops: skip {task.get('id')} handler={hname} pace={pace}")
            continue
        handler = HANDLERS.get(hname) or HANDLERS["coord"]
        by = {
            "claw": "openclaw", "coord": "hermes", "code": "opencode",
            "lead": "stratagrok", "edge": "edge", "fog": "fog", "teach": "hermes",
        }.get(hname, "hermes")
        print(f"ops: run {task.get('id')} handler={hname} pace={pace}")
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
