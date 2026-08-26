"""
Named WIRE §8.2 I1–I6 checks against the in-process LabLedger.

Run: python3 test_economic_invariants.py

Honesty:
  - This is the miniature harness in protocol_benchmark.py, not StrataTokenLedger.
  - I2 here is path-restriction (mint_poc vs lab_bootstrap), not a resource-proof MVP.
  - I5 is DAG replay / invalid-parent (scenario_replay_and_parents), not a second mint.
  - Passing here is Stage 0 / CI evidence, not multi-host gossip, mainnet, or aBFT.
"""
from __future__ import annotations

import sys

from protocol_benchmark import (
    BURN,
    MINT,
    NODE_WALLET,
    LabLedger,
    scenario_economic_invariants,
    scenario_replay_and_parents,
)


def assert_true(cond: bool, msg: str) -> None:
    if not cond:
        print(f"FAIL: {msg}")
        sys.exit(1)
    print(f"  OK: {msg}")


def test_i1() -> None:
    print("I1  #mint cannot receive ordinary transfers")
    led = LabLedger()
    led.mint_poc("user-a", 10.0)
    before = led.circulating()
    assert_true(not led.try_pay_mint("user-a", 1.0), "transfer toward #mint rejected")
    assert_true(led.balances.get(MINT, 0.0) == 0.0, "#mint holds no spendable balance")
    assert_true(led.balances["user-a"] == 10.0, "sender unchanged after rejected pay-to-mint")
    assert_true(led.circulating() == before, "circulating unchanged after rejected I1 transfer")


def test_i2() -> None:
    print("I2  mint path restriction (harness: mint_poc vs lab_bootstrap)")
    led = LabLedger()
    assert_true(led.mint_poc(NODE_WALLET, 40.0), "poc mint accepted")
    assert_true(led.issued == 40.0, "issued increases only on mint_poc")
    assert_true(led.mint_lab_bootstrap(NODE_WALLET, 1000.0), "lab bootstrap accepted as lab_only")
    assert_true(led.issued == 40.0, "lab_bootstrap does not increase issued")
    assert_true(led.lab_only.get(NODE_WALLET, 0.0) == 1000.0, "lab_only tracked separately")
    assert_true(led.invariant_i6(), "I6 still holds after lab_only grant")


def test_i3() -> None:
    print("I3  #0 cannot initiate transfers")
    led = LabLedger()
    led.mint_poc("user-a", 20.0)
    led.burn("user-a", 5.0)
    assert_true(led.balances.get(BURN, 0.0) == 5.0, "burn credited to #0")
    assert_true(not led.try_spend_burn_sink("user-b", 1.0), "spend from #0 rejected")
    assert_true(led.balances.get(BURN, 0.0) == 5.0, "#0 balance unchanged after rejected spend")
    assert_true(led.balances.get("user-b", 0.0) == 0.0, "recipient did not receive unburned funds")


def test_i4() -> None:
    print("I4  burned amount is irreversible")
    led = LabLedger()
    led.mint_poc("user-a", 20.0)
    assert_true(led.burn("user-a", 7.0), "burn succeeds")
    burned = led.burned
    assert_true(burned == 7.0, "burned counter increased")
    assert_true(not led.try_spend_burn_sink("user-a", 7.0), "cannot unburn via transfer from #0")
    assert_true(led.burned == burned, "burned counter did not decrease")
    assert_true(led.circulating() == 13.0, "circulating = issued − burned")


def test_i5() -> None:
    print("I5  DAG replay / invalid parent cannot attach")
    r = scenario_replay_and_parents(seed=42)
    assert_true(r.passed, f"replay_and_invalid_parent passed ({r.notes})")
    assert_true(r.metrics.get("first_replay") == "replay", "duplicate receive is replay")
    assert_true(r.metrics.get("orphan") == "pending_parents", "unknown parent not attached as spendable value")
    assert_true(r.metrics.get("dag_dup_attach") is False, "DAG duplicate attach rejected")
    assert_true(int(r.metrics.get("rejected_replay") or 0) >= 1, "rejected_replay counter incremented")


def test_i6() -> None:
    print("I6  sum(spendable) == issued − burned")
    led = LabLedger()
    led.mint_poc("a", 100.0)
    led.mint_poc("b", 50.0)
    led.transfer("a", "c", 20.0)
    led.burn("b", 10.0)
    led.mint_lab_bootstrap("a", 999.0)
    assert_true(led.invariant_i6(), "conservation holds after mint/transfer/burn/lab_only")
    assert_true(abs(led.circulating() - (led.issued - led.burned)) < 1e-9, "circulating arithmetic")
    assert_true(led.circulating() == 140.0, "spendable excludes #0 and lab_only")
    assert_true(led.issued == 150.0, "issued is poc mints only")
    assert_true(led.burned == 10.0, "burned matches burn()")


def test_bundled_scenario() -> None:
    print("harness scenario_economic_invariants")
    r = scenario_economic_invariants()
    assert_true(r.passed, f"economic_invariants_i1_i6 ({r.notes})")


if __name__ == "__main__":
    test_i1()
    test_i2()
    test_i3()
    test_i4()
    test_i5()
    test_i6()
    test_bundled_scenario()
    print("\nAll I1–I6 lab harness checks passed (in-process LabLedger; not StrataTokenLedger).")
