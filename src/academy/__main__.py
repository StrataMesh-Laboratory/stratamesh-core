"""Fog CLI: python3 -m academy --list | --grade ID --answer a --answer b | --run ID"""

from __future__ import annotations

import argparse
import json
import sys

from .catalog import COST, FORMATIONS, MODELS, ROSTER, VERSION, dump, formation, syllabus
from .grader import grade
from .ollama_hf import OllamaHf
from .flux import AcademyFlux


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="academy", description="ACB Academy Fog runner")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--dump", action="store_true")
    ap.add_argument("--role")
    ap.add_argument("--mode", choices=["corrective", "exploratory"])
    ap.add_argument("--grade")
    ap.add_argument("--answer", action="append", default=[])
    ap.add_argument("--run")
    ap.add_argument("--runtime", choices=["symbolic", "ollama"], default="symbolic")
    ap.add_argument("--flux", action="store_true", help="run dual-lobe QIGA tick after grade")
    ap.add_argument("--acb", default="ACB-ORCH-CMN-001")
    args = ap.parse_args(argv)

    if args.dump:
        json.dump(dump(), sys.stdout, indent=2, ensure_ascii=False)
        sys.stdout.write("\n")
        return 0
    if args.list:
        rows = syllabus(args.role, args.mode)
        print(f"academy {VERSION} students={len(ROSTER)} formations={len(FORMATIONS)} lab_waived={COST['lab_waived']}")
        for f in rows:
            print(f"{f['id']:14} {f['mode']:12} {f['role']:14} {f['title']}")
        print("models", MODELS["corrective"]["hf_gguf"], "|", MODELS["exploratory"]["hf_gguf"])
        return 0
    if args.grade:
        out = grade(args.grade, args.answer)
        if args.flux:
            out = {"grade": out, "flux": AcademyFlux().tick(args.acb, out)}
        json.dump(out, sys.stdout, indent=2, ensure_ascii=False)
        sys.stdout.write("\n")
        complete = out.get("complete") if "complete" in out else (out.get("grade") or {}).get("complete")
        return 0 if complete else 2
    if args.run:
        f = formation(args.run)
        if not f:
            print("unknown formation", args.run, file=sys.stderr)
            return 2
        if args.runtime == "ollama":
            out = OllamaHf().run_formation(args.run)
        else:
            # symbolic: print drills, do not invent answers
            out = {
                "ok": True,
                "runtime": "symbolic",
                "formation": f,
                "hint": "POST answers to /v1/grade — academy never autocompletes from silence",
            }
        json.dump(out, sys.stdout, indent=2, ensure_ascii=False)
        sys.stdout.write("\n")
        return 0 if out.get("complete") or out.get("ok") else 2
    ap.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
