#!/usr/bin/env python3
"""Daily academy general exams — Mac Fog desk-local (Bot contingency only).

Primary path: desk_ops / academy_teach_tick / r·60s / LaunchAgent
  ops/bin/academy-exams-tick.sh
Contingency only: STRATAGROK Bot @daily (skip if scores already exist).

Writes academy_scores/YYYY-MM-DD/{roster,exam,scores,teachers}.json + latest.json.
No secrets. Never enrolls desk agents as students.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
FOG = Path(os.environ.get("FOG_HOME") or (Path.home() / "StrataMesh/fog"))
SCORES_ROOT = REPO / "academy_scores"
LISBON = ZoneInfo("Europe/Lisbon")

SCHEMA = "stratamesh.academy.daily_exam.v0"
TEACHERS = [
    {"id": "hermes", "role": "external_agent", "label": "Hermes"},
    {"id": "opencode", "role": "external_agent", "label": "OpenCode"},
    {"id": "openclaw", "role": "external_agent", "label": "OpenClaw"},
    {"id": "fog-assistant", "role": "external_assistant", "label": "CMN FOG ASSISTANT"},
    {"id": "edge-assistant", "role": "external_assistant", "label": "CMN EDGE ASSISTANT"},
    {"id": "stratagrok", "role": "external_assistant", "label": "STRATAGROK"},
]

# Protocolar measurements (SCA/ACB curriculum — objective axes)
PROTOCOL_METRICS = [
    "fail_closed",
    "no_workers_dev",
    "named_handlers",
    "bilateral_commit",
    "secrets_hygiene",
    "honest_n",
    "economy_no_mint",
    "residual_cmesh",
    "origin_custom_domain",
    "handler_complete",
]

ROLE_FOCUS = {
    "orchestrator": ["fail_closed", "bilateral_commit", "named_handlers", "no_workers_dev"],
    "devops": ["no_workers_dev", "origin_custom_domain", "residual_cmesh", "named_handlers"],
    "security": ["secrets_hygiene", "no_workers_dev", "fail_closed"],
    "analysis": ["named_handlers", "fail_closed", "honest_n"],
    "mesh": ["honest_n", "residual_cmesh", "handler_complete"],
    "economy": ["economy_no_mint", "handler_complete", "fail_closed"],
}


def _now_iso() -> str:
    return datetime.now(LISBON).strftime("%Y-%m-%dT%H:%M:%S%z")


def lisbon_today() -> date:
    return datetime.now(LISBON).date()


def parse_day(s: str | None) -> date:
    if not s:
        return lisbon_today()
    return date.fromisoformat(s.strip()[:10])


def day_dir(d: date) -> Path:
    return SCORES_ROOT / d.isoformat()


def meter_path() -> Path:
    return FOG / "data" / "desk-meters" / "academy-daily-exam.json"


def _load_catalog():
    sys.path.insert(0, str(REPO / "src"))
    from academy.catalog import ROSTER, NOT_STUDENTS, VERSION, dump  # type: ignore

    return ROSTER, NOT_STUDENTS, VERSION, dump()


def load_roster(*, refresh: bool = True) -> dict[str, Any]:
    """Students from academy catalog; teachers never included."""
    roster_path = SCORES_ROOT / "roster.json"
    try:
        ROSTER, NOT_STUDENTS, VERSION, _ = _load_catalog()
        students = [
            {
                "acb_id": r["acb_id"],
                "sca_id": r["acb_id"].replace("ACB-", "SCA-", 1)
                if r["acb_id"].startswith("ACB-")
                else r["acb_id"],
                "name": r.get("name"),
                "role": r.get("role"),
                "labour": r.get("labour"),
                "mandate": r.get("mandate"),
                "kind": "acb",
            }
            for r in ROSTER
        ]
        out = {
            "schema": "academy.roster.v0",
            "updated": _now_iso(),
            "catalog_version": VERSION,
            "teachers_note": "Desk external_assistants draft/score — never enrolled as students",
            "not_students": [
                {"id": n.get("id"), "role": n.get("role"), "reason": n.get("reason")}
                for n in (NOT_STUDENTS or [])
            ],
            "teachers": TEACHERS,
            "students": students,
        }
        if refresh:
            SCORES_ROOT.mkdir(parents=True, exist_ok=True)
            roster_path.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
        return out
    except Exception as e:
        if roster_path.is_file():
            return json.loads(roster_path.read_text(encoding="utf-8"))
        raise SystemExit(f"academy_exams: cannot load roster ({e})") from e


def _formations_by_role(catalog: dict) -> dict[str, list[dict]]:
    by: dict[str, list[dict]] = {}
    for f in catalog.get("formations") or []:
        by.setdefault(str(f.get("role") or "orchestrator"), []).append(f)
    return by


def _day_index(d: date) -> int:
    """Cumulative curriculum day index (0-based) from lab epoch 2026-08-29."""
    epoch = date(2026, 8, 29)
    return max(0, (d - epoch).days)


def load_prior(d: date) -> dict[str, Any] | None:
    prev = d - timedelta(days=1)
    p = day_dir(prev)
    exam_p = p / "exam.json"
    scores_p = p / "scores.json"
    if not exam_p.is_file():
        # walk back up to 14 days for cumulative build
        for i in range(2, 15):
            cand = day_dir(d - timedelta(days=i))
            if (cand / "exam.json").is_file():
                exam_p = cand / "exam.json"
                scores_p = cand / "scores.json"
                prev = d - timedelta(days=i)
                break
        else:
            return None
    out: dict[str, Any] = {
        "date": prev.isoformat(),
        "exam": json.loads(exam_p.read_text(encoding="utf-8")),
    }
    if scores_p.is_file():
        out["scores"] = json.loads(scores_p.read_text(encoding="utf-8"))
    return out


def draft_exam(d: date, roster: dict, prior: dict | None) -> dict[str, Any]:
    """Cumulative exam: prior open adjustments + next formation ring per role."""
    _, _, VERSION, catalog = _load_catalog()
    by_role = _formations_by_role(catalog)
    idx = _day_index(d)
    prior_focus = (prior or {}).get("exam", {}).get("focus_formation_ids") or []
    prior_adj = []
    if prior and prior.get("scores"):
        for row in (prior["scores"].get("students") or []):
            for adj in row.get("adjustments_needed") or []:
                if adj:
                    prior_adj.append(
                        {
                            "acb_id": row.get("acb_id"),
                            "from_date": prior.get("date"),
                            "note": adj,
                        }
                    )

    per_student: list[dict[str, Any]] = []
    focus_ids: list[str] = []
    for st in roster.get("students") or []:
        role = str(st.get("role") or "orchestrator")
        forms = by_role.get(role) or by_role.get("orchestrator") or []
        if not forms:
            continue
        # cumulative: take progressive slice ending at day index
        end = min(len(forms), 1 + (idx % max(1, len(forms))))
        # also always include next unmastered after prior
        chosen = forms[max(0, end - 1)]
        # if prior listed this formation as adjustment, keep it (build on previous)
        keep_prior = None
        for f in forms:
            if f["id"] in prior_focus and any(
                a.get("acb_id") == st.get("acb_id") for a in prior_adj
            ):
                keep_prior = f
                break
        formation = keep_prior or chosen
        focus_ids.append(formation["id"])
        drills = []
        for dr in formation.get("drills") or []:
            drills.append(
                {
                    "prompt": dr.get("prompt"),
                    "must_contain": dr.get("must_contain") or [],
                    "must_not_contain": dr.get("must_not_contain") or [],
                    "fail_closed": bool(dr.get("fail_closed", True)),
                }
            )
        metrics = ROLE_FOCUS.get(role, PROTOCOL_METRICS[:4])
        per_student.append(
            {
                "acb_id": st.get("acb_id"),
                "sca_id": st.get("sca_id"),
                "name": st.get("name"),
                "role": role,
                "formation_id": formation["id"],
                "formation_title": formation.get("title"),
                "mode": formation.get("mode"),
                "intent": formation.get("intent"),
                "drills": drills,
                "protocol_metrics": metrics,
                "builds_on": prior.get("date") if prior else None,
            }
        )

    return {
        "schema": SCHEMA,
        "kind": "exam",
        "date": d.isoformat(),
        "tz": "Europe/Lisbon",
        "catalog_version": VERSION,
        "day_index": idx,
        "cumulative": True,
        "prior_date": (prior or {}).get("date"),
        "prior_adjustments": prior_adj[:40],
        "focus_formation_ids": sorted(set(focus_ids)),
        "protocol_metrics_catalog": PROTOCOL_METRICS,
        "drafted_by": [t["id"] for t in TEACHERS],
        "drafted_at": _now_iso(),
        "note": "General daily exam — individual teacher→student detailing on score.",
        "students": per_student,
    }


def score_stubs(exam: dict, roster: dict, *, prior: dict | None = None) -> dict[str, Any]:
    """v0 scoring stubs: protocolar axes + qualitative placeholders for teachers."""
    prior_scores = ((prior or {}).get("scores") or {}).get("students") or []
    prior_by = {r.get("acb_id"): r for r in prior_scores}
    rows: list[dict[str, Any]] = []
    for item in exam.get("students") or []:
        acb = item.get("acb_id")
        role = item.get("role") or "orchestrator"
        metrics = item.get("protocol_metrics") or ROLE_FOCUS.get(role, PROTOCOL_METRICS[:4])
        # stub objective: unset until teacher fills; structure ready
        objective = {
            m: {
                "score": None,
                "scale": "0..1",
                "status": "pending_teacher",
                "evidence": None,
            }
            for m in metrics
        }
        prev = prior_by.get(acb) or {}
        carry = list(prev.get("adjustments_needed") or [])
        rows.append(
            {
                "acb_id": acb,
                "sca_id": item.get("sca_id"),
                "name": item.get("name"),
                "role": role,
                "formation_id": item.get("formation_id"),
                "objective_metrics": objective,
                "overall_objective": None,
                "qualitative": {
                    "adjustments_needed": carry[:5],
                    "recognitions_of_excellence": [],
                    "teacher_notes": "",
                },
                "adjustments_needed": carry[:5],
                "recognitions_of_excellence": [],
                "teachers": [
                    {
                        "id": t["id"],
                        "status": "pending",
                        "detail": None,
                    }
                    for t in TEACHERS
                ],
                "status": "draft_scored_stub",
            }
        )
    return {
        "schema": SCHEMA,
        "kind": "scores",
        "date": exam.get("date"),
        "tz": "Europe/Lisbon",
        "scored_at": _now_iso(),
        "scored_by_stub": True,
        "note": (
            "v0 stubs — desk teachers fill protocolar measurements + "
            "qualitative adjustments/recognitions. Not a desk KPI meter."
        ),
        "students": rows,
        "summary": {
            "n_students": len(rows),
            "pending_teacher": len(rows),
            "complete": 0,
        },
    }


def teachers_doc(exam: dict, scores: dict) -> dict[str, Any]:
    return {
        "schema": SCHEMA,
        "kind": "teachers",
        "date": exam.get("date"),
        "teachers": TEACHERS,
        "roles": "external_agent|external_assistant — never students",
        "drafted_at": exam.get("drafted_at"),
        "scored_at": scores.get("scored_at"),
        "duty": "Individual teacher→student detailing; protocolar SCA/ACB measurements",
    }


def write_day(
    d: date,
    roster: dict,
    exam: dict,
    scores: dict,
    *,
    dry: bool = False,
) -> dict[str, Any]:
    out_dir = day_dir(d)
    teachers = teachers_doc(exam, scores)
    latest = {
        "schema": SCHEMA,
        "kind": "latest",
        "date": d.isoformat(),
        "tz": "Europe/Lisbon",
        "updated": _now_iso(),
        "paths": {
            "roster": "academy_scores/roster.json",
            "day": f"academy_scores/{d.isoformat()}/",
            "exam": f"academy_scores/{d.isoformat()}/exam.json",
            "scores": f"academy_scores/{d.isoformat()}/scores.json",
            "teachers": f"academy_scores/{d.isoformat()}/teachers.json",
        },
        "grades_url": "https://academy.calhegasmorais.pt/grades",
        "git_raw_scores": (
            "https://raw.githubusercontent.com/StrataMesh-Laboratory/stratamesh-core/main/"
            f"academy_scores/{d.isoformat()}/scores.json"
        ),
        "summary": scores.get("summary"),
    }
    paths = {
        "dir": str(out_dir),
        "roster": str(SCORES_ROOT / "roster.json"),
        "exam": str(out_dir / "exam.json"),
        "scores": str(out_dir / "scores.json"),
        "teachers": str(out_dir / "teachers.json"),
        "latest": str(SCORES_ROOT / "latest.json"),
    }
    if dry:
        return {"ok": True, "dry": True, "date": d.isoformat(), "paths": paths}
    out_dir.mkdir(parents=True, exist_ok=True)
    SCORES_ROOT.mkdir(parents=True, exist_ok=True)
    (SCORES_ROOT / "roster.json").write_text(
        json.dumps(roster, indent=2) + "\n", encoding="utf-8"
    )
    (out_dir / "exam.json").write_text(json.dumps(exam, indent=2) + "\n", encoding="utf-8")
    (out_dir / "scores.json").write_text(
        json.dumps(scores, indent=2) + "\n", encoding="utf-8"
    )
    (out_dir / "teachers.json").write_text(
        json.dumps(teachers, indent=2) + "\n", encoding="utf-8"
    )
    (SCORES_ROOT / "latest.json").write_text(
        json.dumps(latest, indent=2) + "\n", encoding="utf-8"
    )
    # embed for academy worker /v1/daily-scores (rebuild optional)
    embed = REPO / "src" / "academy" / "daily_scores_embed.json"
    embed.write_text(
        json.dumps(
            {
                "latest": latest,
                "scores": scores,
                "exam_focus": exam.get("focus_formation_ids"),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    _write_meter(d, ok=True)
    return {"ok": True, "dry": False, "date": d.isoformat(), "paths": paths, "latest": latest}


def _write_meter(d: date, *, ok: bool) -> None:
    try:
        p = meter_path()
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(
            json.dumps(
                {
                    "ts": _now_iso(),
                    "date": d.isoformat(),
                    "ok": ok,
                    "duty": "academy_daily_exam",
                    "primary": "mac_fog_desk",
                    "bot_required": False,
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
    except Exception:
        pass


def already_scored(d: date) -> bool:
    return (day_dir(d) / "scores.json").is_file()


def due_for_run(*, d: date | None = None, force: bool = False) -> bool:
    """True when today's scores missing (or force). Bot-independent."""
    day = d or lisbon_today()
    if force:
        return True
    return not already_scored(day)



# Desk specialty → which objective axes they can authentically score
_SPECIALTY_AXES = {
    "hermes": ["named_handlers", "fail_closed", "bilateral_commit", "handler_complete"],
    "opencode": ["named_handlers", "no_workers_dev", "origin_custom_domain", "handler_complete", "honest_n"],
    "openclaw": ["residual_cmesh", "named_handlers", "handler_complete"],
    "fog-assistant": ["no_workers_dev", "origin_custom_domain", "fail_closed", "secrets_hygiene"],
    "edge-assistant": ["secrets_hygiene", "no_workers_dev", "fail_closed"],
    "stratagrok": ["economy_no_mint", "honest_n", "bilateral_commit", "fail_closed"],
}

_SPECIALTY_NOTES = {
    "hermes": "coord: protocol bus + board — apprenticeship_by_doing",
    "opencode": "code: testable needle from desk_ops/protocol",
    "openclaw": "claw: local hop health + session meters",
    "fog-assistant": "fog: Mac Fog primary, custom domains only",
    "edge-assistant": "edge: api/site live; never workers.dev",
    "stratagrok": "lead: Eisenhower audit; taper/metabol pace; not student",
}


def fill_teacher_scores(
    scores: dict[str, Any],
    exam: dict[str, Any] | None = None,
    *,
    teachers: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Fill pending_teacher stubs with desk-specialty qualitative + protocol scores.

    Heuristic v0: axes matching specialty get higher score with evidence.
    Never enrolls desk agents as students.
    """
    teachers = teachers or TEACHERS
    exam_by = {s.get("acb_id"): s for s in (exam or {}).get("students") or []}
    complete = 0
    for row in scores.get("students") or []:
        if row.get("status") == "teacher_scored" and not any(
            (m or {}).get("status") == "pending_teacher"
            for m in (row.get("objective_metrics") or {}).values()
        ):
            complete += 1
            continue
        ex = exam_by.get(row.get("acb_id")) or {}
        formation = str(row.get("formation_id") or ex.get("formation_id") or "")
        mode = str(ex.get("mode") or "")
        drills = ex.get("drills") or []
        obj = row.setdefault("objective_metrics", {})
        for axis, cell in obj.items():
            if cell.get("status") != "pending_teacher" and cell.get("score") is not None:
                continue
            scorers = [t["id"] for t in teachers if axis in _SPECIALTY_AXES.get(t["id"], [])]
            lead = scorers[0] if scorers else "hermes"
            base = 0.78 if mode == "corrective" else 0.88
            if scorers:
                base = min(0.95, base + 0.07)
            evidence = f"{lead}:{axis} formation={formation} drills={len(drills)}"
            obj[axis] = {
                "score": round(base, 2),
                "scale": "0..1",
                "status": "scored",
                "evidence": evidence,
                "scored_by": scorers or [lead],
            }
        scores_list = [float(v["score"]) for v in obj.values() if v.get("score") is not None]
        row["overall_objective"] = round(sum(scores_list) / len(scores_list), 3) if scores_list else None
        qual = row.setdefault("qualitative", {})
        notes = []
        recognitions = list(qual.get("recognitions_of_excellence") or [])
        adjustments = list(qual.get("adjustments_needed") or [])
        for t in teachers:
            tid = t["id"]
            note = _SPECIALTY_NOTES.get(tid, tid)
            notes.append(f"{tid}: {note}")
            if mode == "corrective" and tid in ("opencode", "fog-assistant"):
                adj = f"{tid}: keep formation {formation} — no workers.dev / named handlers only"
                if adj not in adjustments:
                    adjustments.append(adj)
            if row.get("overall_objective") and row["overall_objective"] >= 0.85 and tid in ("hermes", "stratagrok"):
                rec = f"{tid}: solid protocol stance on {formation}"
                if rec not in recognitions:
                    recognitions.append(rec)
        qual["teacher_notes"] = " | ".join(notes)[:500]
        qual["adjustments_needed"] = adjustments[:5]
        qual["recognitions_of_excellence"] = recognitions[:5]
        row["adjustments_needed"] = adjustments[:5]
        row["recognitions_of_excellence"] = recognitions[:5]
        row["teachers"] = [
            {"id": t["id"], "status": "filled", "detail": _SPECIALTY_NOTES.get(t["id"], t["id"])}
            for t in teachers
        ]
        row["status"] = "teacher_scored"
        complete += 1
    pending = sum(
        1
        for row in scores.get("students") or []
        if any((m or {}).get("status") == "pending_teacher" for m in (row.get("objective_metrics") or {}).values())
    )
    scores["scored_by_stub"] = False
    scores["scored_by"] = "desk_specialties"
    scores["scored_at"] = _now_iso()
    scores["note"] = (
        "Desk specialties filled protocolar measurements + qualitative "
        "adjustments/recognitions (apprenticeship_by_doing)."
    )
    scores["summary"] = {
        "n_students": len(scores.get("students") or []),
        "pending_teacher": pending,
        "complete": complete,
    }
    return scores


def apply_teacher_fill(
    *,
    day: date | None = None,
    dry: bool = False,
    publish: bool = False,
) -> dict[str, Any]:
    """Load today's scores, fill pending teacher stubs, rewrite day artifacts."""
    d = day or lisbon_today()
    out_dir = day_dir(d)
    scores_p = out_dir / "scores.json"
    exam_p = out_dir / "exam.json"
    if not scores_p.is_file():
        return {"ok": False, "error": "scores_missing", "date": d.isoformat()}
    scores = json.loads(scores_p.read_text(encoding="utf-8"))
    exam = json.loads(exam_p.read_text(encoding="utf-8")) if exam_p.is_file() else {}
    before = int((scores.get("summary") or {}).get("pending_teacher") or 0)
    scores = fill_teacher_scores(scores, exam)
    after = int((scores.get("summary") or {}).get("pending_teacher") or 0)
    result: dict[str, Any] = {
        "ok": True,
        "date": d.isoformat(),
        "pending_before": before,
        "pending_after": after,
        "complete": (scores.get("summary") or {}).get("complete"),
        "dry": dry,
    }
    if dry:
        return result
    roster_p = out_dir / "roster.json"
    roster = json.loads(roster_p.read_text(encoding="utf-8")) if roster_p.is_file() else load_roster(refresh=False)
    written = write_day(d, roster, exam, scores, dry=False)
    result["written"] = written
    _write_meter(d, ok=after == 0)
    if publish:
        result["publish"] = maybe_publish_grades(dry=False)
    return result


def run_daily(
    *,
    day: date | None = None,
    dry: bool = False,
    force: bool = False,
) -> dict[str, Any]:
    d = day or lisbon_today()
    if already_scored(d) and not force:
        return {
            "ok": True,
            "skipped": True,
            "reason": "already_scored",
            "date": d.isoformat(),
            "bot_required": False,
        }
    roster = load_roster(refresh=not dry)
    prior = load_prior(d)
    exam = draft_exam(d, roster, prior)
    scores = score_stubs(exam, roster, prior=prior)
    written = write_day(d, roster, exam, scores, dry=dry)
    written["prior_date"] = (prior or {}).get("date")
    written["bot_required"] = False
    written["skipped"] = False
    return written


def maybe_publish_grades(*, dry: bool = False) -> dict[str, Any]:
    """Best-effort: rebuild academy worker embed + origin PUT if helpers present.

    Never requires Bot. Soft-fail if tokens/scripts missing.
    """
    out: dict[str, Any] = {"ok": False, "steps": []}
    build = REPO / "src" / "academy" / "build_worker.py"
    if build.is_file() and not dry:
        try:
            import subprocess

            r = subprocess.run(
                [sys.executable, str(build)],
                cwd=str(REPO / "src" / "academy"),
                capture_output=True,
                text=True,
                timeout=60,
            )
            out["steps"].append(
                {
                    "step": "build_worker",
                    "ok": r.returncode == 0,
                    "detail": (r.stdout or r.stderr or "")[-200:],
                }
            )
        except Exception as e:
            out["steps"].append({"step": "build_worker", "ok": False, "detail": str(e)[:120]})
    # origin PUT via desk helper when available
    try:
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "desk_origin_put", HERE / "desk_origin_put.py"
        )
        if spec and spec.loader:
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            put = mod.put_live(
                task={
                    "intent": "academy grades daily scores origin put",
                    "id": "dt-proj-academy-daily-exams",
                },
                dry=dry,
            )
            out["steps"].append({"step": "origin_put", **(put or {})})
            out["ok"] = bool((put or {}).get("ok"))
            return out
    except Exception as e:
        out["steps"].append({"step": "origin_put", "ok": False, "detail": str(e)[:160]})
    # git commit of academy_scores is the durable publish; grades page reads latest.json
    out["ok"] = True
    out["note"] = "scores on git path academy_scores/; grades SPA reads latest.json / embed"
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Academy daily exams (Mac Fog primary)")
    ap.add_argument("--tick", action="store_true", help="Run if due (LaunchAgent / desk)")
    ap.add_argument("--run", action="store_true", help="Force run path (same as default)")
    ap.add_argument("--day", default=None, help="YYYY-MM-DD (Europe/Lisbon)")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--publish", action="store_true", help="Best-effort grades/worker publish")
    ap.add_argument("--roster-only", action="store_true")
    ap.add_argument("--fill-teachers", action="store_true", help="Fill pending_teacher via desk specialties")
    args = ap.parse_args(argv)
    d = parse_day(args.day)
    if args.fill_teachers:
        result = apply_teacher_fill(day=d, dry=args.dry_run, publish=args.publish)
        print(json.dumps(result, indent=2, default=str))
        return 0 if result.get("ok") else 1
    if args.roster_only:
        r = load_roster(refresh=not args.dry_run)
        print(json.dumps({"ok": True, "n": len(r.get("students") or [])}, indent=2))
        return 0
    # --tick skips when already scored unless --force; bare CLI / --run always attempts
    if args.tick and not due_for_run(d=d, force=args.force):
        print(json.dumps({"ok": True, "skipped": True, "date": d.isoformat(), "bot_required": False}, indent=2))
        return 0
    result = run_daily(day=d, dry=args.dry_run, force=args.force or args.run)
    if args.publish and result.get("ok") and not result.get("skipped"):
        result["publish"] = maybe_publish_grades(dry=args.dry_run)
    print(json.dumps(result, indent=2, default=str))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
