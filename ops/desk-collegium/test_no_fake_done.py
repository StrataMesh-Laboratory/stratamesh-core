"""Ban skip-success / fake done in desk_ops."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
OPS = (ROOT / "desk_ops.py").read_text(encoding="utf-8")


def test_no_deferred_to_board_success():
    assert "deferred to board" not in OPS


def test_self_audit_does_not_ok_true_skip_code_act():
    assert "code self-audit skipped (no CI theatre)" not in OPS or '"ok": True' not in OPS.split("code self-audit skipped")[0][-80:]


def test_delivered_requires_done_and_evidence():
    assert "if out.get(\"ok\") and out.get(\"done\") and out.get(\"evidence\")" in OPS or (
        "delivered +=" in OPS and "skipped" in OPS
    )


def test_honest_result_helper_exists():
    assert "def honest_result(" in OPS
    assert "NO-FAKE-DONE" in (ROOT / "NO-FAKE-DONE.md").read_text(encoding="utf-8")
