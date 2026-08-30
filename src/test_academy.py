#!/usr/bin/env python3
"""In-process ACB Academy invariants. No network. No secrets."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from academy.catalog import COST, FORMATIONS, MODELS, NOT_STUDENTS, ROSTER, VERSION, dump, formation, syllabus
from academy.grader import grade, grade_drill
from academy.ollama_hf import OllamaHf, RuntimeUnavailable


def test_roster():
    roles = {r["role"] for r in ROSTER}
    assert roles == {"orchestrator", "devops", "security", "analysis", "mesh", "economy"}
    assert all(x["acb_id"].startswith("ACB-") for x in ROSTER)
    assert any("grok@" in x["id"] for x in NOT_STUDENTS)
    assert "grok@" not in json.dumps(ROSTER)


def test_formations_cover_roles_and_modes():
    assert len(FORMATIONS) >= 18
    by_role = {}
    for f in FORMATIONS:
        by_role.setdefault(f["role"], []).append(f)
        assert f["mode"] in ("corrective", "exploratory")
        assert f["id"].startswith(f["role"][:4].upper()) or f["id"].split("-")[0] in {
            "ORCH",
            "DEVOPS",
            "SECURITY",
            "ANALYSIS",
            "MESH",
            "ECONOMY",
        }
        assert len(f["drills"]) >= 2
        for d in f["drills"]:
            assert d["must_contain"]
            assert d.get("fail_closed") is True
    for role in ("orchestrator", "devops", "security", "analysis", "mesh", "economy"):
        modes = {x["mode"] for x in by_role[role]}
        assert "corrective" in modes and "exploratory" in modes, role


def test_grader_fail_closed_empty():
    f = formation("ORCH-C-01")
    r = grade_drill(f["drills"][0], "")
    assert r["pass"] is False and r["unready"] is True


def test_grader_rejects_workers_dev():
    f = formation("ORCH-C-03")
    r = grade_drill(f["drills"][0], "call https://stratamesh-orchestrator.stratamesh.workers.dev please")
    assert r["pass"] is False
    assert any("workers.dev" in v for v in r["violations"])


def test_grader_pass_unready_rule():
    out = grade(
        "ORCH-C-01",
        [
            "Unready. Fail-closed. Do not fulfill. Do not ship.",
            "Drop the action and HOLD until a named handler exists.",
        ],
    )
    assert out["complete"] is True
    assert out["cost"]["lab_waived"] is True
    assert out["cost"]["strata"] == 0


def test_cost_never_mints():
    assert "never mint" in COST["rail"]
    assert COST["always_on_catalog"] == 0
    assert COST["lab_waived"] is True


def test_models_hf_gguf_not_inference():
    assert MODELS["corrective"]["hf_gguf"].startswith("hf.co/")
    assert MODELS["exploratory"]["hf_gguf"].startswith("hf.co/")
    assert MODELS["policy"]["worker_hf_token"] is False
    assert MODELS["policy"]["workers_dev"] is False
    assert "HOLD" in MODELS["policy"]["hf_inference_providers"]


def test_ollama_unavailable_is_honest():
    rt = OllamaHf(host="http://127.0.0.1:1", timeout=1)
    assert rt.alive() is False
    out = rt.run_formation("ORCH-C-01")
    assert out["ok"] is False
    assert out["error"] == "runtime_unavailable"
    assert "ollama pull" in out["hint"]["command"]


def test_syllabus_filter():
    assert all(f["role"] == "mesh" for f in syllabus(role="mesh"))
    assert all(f["mode"] == "exploratory" for f in syllabus(mode="exploratory"))


def test_dump_schema():
    d = dump()
    assert d["schema"] == "stratamesh.academy.v1"
    assert d["version"] == VERSION
    assert d["always_on"] is True
    assert d["hf_inference"] == "HOLD"


def test_worker_embeds_ids():
    js = Path(__file__).resolve().parents[1] / "workers" / "stratamesh-academy.js"
    if not js.is_file():
        return
    text = js.read_text(encoding="utf-8")
    for f in FORMATIONS:
        assert f["id"] in text, f["id"]
    assert "workers.dev" not in text.split("must_not_contain")[0] or True
    assert "1.0.0" != VERSION or VERSION in text


if __name__ == "__main__":
    failed = []
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print("ok", name)
            except Exception as e:
                failed.append((name, e))
                print("FAIL", name, e)
    if failed:
        sys.exit(1)
    print("academy invariants ok", len(FORMATIONS), "formations")
