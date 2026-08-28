# Hypothesis tests for Fog StrataTokenLedger

Lab-only. Not multi-host mesh. Not a Worker job.

`src/test_fog_ledger_invariants.py` property-tests `StrataTokenLedger`
(the ledger `node_persistent.PersistentFogNode` constructs). Distinct from
`src/test_economic_invariants.py` (WIRE I1–I6 miniature `LabLedger`).

## Extra dependency

```
pip install -r requirements-dev.txt
# or: pip install --user hypothesis
```

## Run

```
cd src
python3 test_fog_ledger_invariants.py
```

Honesty banner in the test module states single-host STRATAGROK lab
(FOG-NODE-PT-CM-001 + EDGE-GROK-CMN-001). Passing these tests is not
mesh membership, Oracle VM, aBFT, or mainnet.
