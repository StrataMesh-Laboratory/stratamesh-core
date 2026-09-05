#!/usr/bin/env python3
"""Desk ops cycle — methodology-enforced real work (ongoing/pending/projected).

Laws: ops/desk-collegium/protocol.json (incl. academy_teach).
Lifecycle: projected → pending(propose) → ongoing(constrain|revise|commit) → done|escalate.

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
        data = json.loads(PROJECTED.read_text(encoding="utf-8"))
        open_ids = {t.get("id") for t in open_tasks}
        done_ids = {t.get("id") for t in (state.get("done_tasks") or [])}
        sources = {t.get("source") for t in open_tasks + (state.get("done_tasks") or [])}
        for item in data.get("items") or []:
            pid = item.get("id")
            src = f"projected:{pid}"
            if src in sources or pid in open_ids or pid in done_ids:
                continue
            if item.get("hold_until") == "oracle_grok90":
                item = dict(item)
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
        f"{detail[:50]} — never enroll Hermes/OpenCode/OpenClaw as students"
    )
    if not dry and ok:
        path = FOG / "data" / "desk-meters" / "academy-teach.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"ts": _now(), "academy_ok": ok, "duty": "academy_teach"}, indent=2) + "\n")
    return {"ok": True, "result": note, "done": ok, "sha": ""}



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
                f"Do the intent; report result via desk_bus commit/done. "
                f"Teach ACB students by leaving a clear testable lesson if applicable.\n"
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
    intent = (task.get("intent") or "").lower()
    if (task.get("status") or "") == "escalate":
        return True
    if task.get("specialty") == "lead" and any(
        k in intent for k in ("oracle", "grok90", "m-ii", "m-2", "2fa", "captcha", "renovate major")
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
    """Prefer claw/code/coord/edge/fog/teach. Skip Oracle/lead gates unless asked."""
    board = classify(state)
    # specialty priority for real agent work (not stratagrok self-loop)
    prio = {"claw": 0, "code": 1, "teach": 2, "coord": 3, "edge": 4, "fog": 5, "lead": 9}
    ordered = board["ongoing"] + board["pending"]
    scored: list[tuple[int, dict]] = []
    for t in ordered:
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


def promote_projected(bus, state: dict, *, dry: bool) -> str | None:
    """If no real-agent ALLOW work, promote one projected (anti-idle / anti self-loop)."""
    board = classify(state)
    actionable = pick_tasks(state, max_n=1, include_human_gates=False)
    if actionable:
        return None
    for item in board["projected"]:
        if item.get("_hold") or item.get("hold_until") == "oracle_grok90":
            continue
        spec = item.get("specialty") or "coord"
        lane = _specialty_lane(spec)
        if _lane_pace(state, lane) in ("STASIS", "HOLD") and spec != "lead":
            continue
        if dry:
            return f"would promote {item.get('id')}"
        ns = argparse.Namespace(
            owner=item.get("owner") or "hermes",
            specialty=spec,
            intent=item.get("intent") or item.get("id"),
            id=f"dt-{str(item.get('id') or uuid.uuid4().hex)[:16].replace('_','')}",
            lanes=item.get("lanes") or [],
        )
        rc = bus.cmd_propose(ns)
        if rc == 0:
            state = bus.load_state()
            task = bus.find_task(state, ns.id)
            if task:
                task["source"] = f"projected:{item.get('id')}"
                if item.get("duty"):
                    task["duty"] = item["duty"]
                task["updated"] = _now()
                bus.save_state(state)
            return ns.id
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

    # academy teach duty tick
    academy_teach_tick(bus, state, dry=args.dry_run)
    state = bus.load_state()

    # anti-idle: promote projected if needed
    promoted = promote_projected(bus, state, dry=args.dry_run)
    if promoted:
        print(f"ops: promoted projected → {promoted}")
        state = bus.load_state()

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
        write_agent_outbox(by if by in ("opencode", "hermes", "openclaw") else {
            "code": "opencode", "teach": "hermes", "coord": "hermes", "claw": "openclaw",
            "edge": "hermes", "fog": "hermes", "lead": "stratagrok",
        }.get(hname, "hermes"), task, out)
        if out.get("ok"):
            delivered += 1

    if not args.dry_run:
        _push(bus)
        _write_last({"delivered": delivered, "picked": [t.get("id") for t in picked], "protocol_ok": chk.get("ok")})
    print(json.dumps({"delivered": delivered, "picked": [t.get("id") for t in picked], "protocol_ok": chk.get("ok")}, indent=2))
    return 0 if delivered else 1


def _write_last(obj: dict) -> None:
    try:
        LAST_LOG.parent.mkdir(parents=True, exist_ok=True)
        obj["ts"] = _now()
        LAST_LOG.write_text(json.dumps(obj, indent=2) + "\n")
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
    args = p.parse_args()
    if args.cmd == "cycle":
        return cmd_cycle(args)
    if args.cmd == "board":
        return cmd_board(args)
    if args.cmd == "rca":
        return cmd_rca(args)
    return 1


if __name__ == "__main__":
    sys.exit(main())
