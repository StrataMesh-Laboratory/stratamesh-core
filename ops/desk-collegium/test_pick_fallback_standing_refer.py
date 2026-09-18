"""P0: fallback + explicit standing_refer park (no cooldown reopen for Oracle/GCP)."""
import importlib.util
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
OPS = HERE / "desk_ops.py"


def _load():
    spec = importlib.util.spec_from_file_location("desk_ops_fallback_p0", OPS)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


class PickFallbackStandingReferPark(unittest.TestCase):
    def test_explicit_standing_refer_parks_without_cooldown(self):
        mod = _load()
        t = {
            "id": "dt-ch-oracle-gr",
            "status": "refer",
            "standing_refer": True,
            "ping_when_needed": True,
            "prep_allowed": True,
            "human_gate": True,
            "intent": "OPTIONAL Oracle grok90 chase",
            "updated": "2026-09-01T00:00:00+01:00",  # ancient — cooldown would have elapsed
        }
        self.assertTrue(mod._is_standing_soft_refer(t))

    def test_fallback_parks_oracle_standing_refer_despite_ping_flags(self):
        mod = _load()
        state = {
            "open_tasks": [
                {
                    "id": "dt-ch-oracle-gr",
                    "status": "refer",
                    "eisenhower": "act",
                    "specialty": "lead",
                    "owner": "stratagrok",
                    "human_gate": True,
                    "standing_refer": True,
                    "ping_when_needed": True,
                    "prep_allowed": True,
                    "intent": "OPTIONAL Oracle grok90 chase — never blocks desk",
                    "updated": "2026-09-01T00:00:00+01:00",
                },
                {
                    "id": "dt-proj-ts-taper-t1",
                    "status": "act",
                    "eisenhower": "act",
                    "specialty": "coord",
                    "owner": "hermes",
                    "intent": "Act T1 NOW: Mac+iPhone prove WG",
                    "updated": "2026-09-16T00:01:00+01:00",
                },
            ],
            "members": [],
            "lanes": {},
        }
        picked = mod.pick_actable_fallback(state, max_n=3)
        ids = [t.get("id") for t in picked]
        self.assertNotIn("dt-ch-oracle-gr", ids)
        self.assertIn("dt-proj-ts-taper-t1", ids)


if __name__ == "__main__":
    unittest.main()
