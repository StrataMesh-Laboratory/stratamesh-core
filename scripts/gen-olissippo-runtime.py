#!/usr/bin/env python3
"""Regenerate frontend/olissippo-runtime.json from real persona ticks."""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
import olissippo_personas as op
import olissippo_identity as oid
trails = op.tick_all(minutes=15, days_hours=6.0)
people = []
for sid, trail in trails.items():
    last = trail[-1]
    entry = next(p for p in op.load_index()["personas"] if p["subject_id"] == sid)
    persona = op.load_persona(entry["slug"])
    roles = oid.world_roles_for_subject(sid, realm="lore-olissippo-lusitanian")
    role = roles[0] if roles else {}
    people.append({
        "name": last.get("display_name") or persona["display_name"],
        "role_pt": role.get("role_pt") or persona.get("role"),
        "role_en": (role.get("role") or persona.get("role") or "").replace("_", " "),
        "subject_ref": sid,
        "world_role_ref": role.get("role_id") or persona.get("world_role_id"),
        "location_id": last["location_id"],
        "home": persona.get("home_location"),
        "activity": last.get("activity"),
        "charcoal_held": last.get("charcoal_held", 0),
        "spear_progress": last.get("spear_progress", 0),
        "status_flags": last.get("status_flags") or [],
        "day": last.get("day"),
        "minute": last.get("minute"),
        "kind": "person",
        "identity_registry": "stratamesh",
        "world_role_registry": "cmn",
        "is_nft": False,
    })
runtime = {
    "schema": "stratamesh.lore.olissippo.runtime.v1",
    "realm": "lore-olissippo-lusitanian",
    "not_main": True,
    "hosts_sandboxes": False,
    "same_mechanics_as_main": True,
    "generated_by": "scripts/gen-olissippo-runtime.py",
    "hours_simulated": 6.0,
    "tick_minutes": 15,
    "people": people,
    "note": "Live Subject positions from real routine ticks — not mock data.",
}
out = ROOT / "frontend/olissippo-runtime.json"
out.write_text(json.dumps(runtime, indent=2, ensure_ascii=False) + "\n")
print("wrote", out, "n=", len(people))
