## 2026-08-26
- CI: `protocol-invariants` workflow runs in-process `test_tip_selection.py`, named WIRE I1–I6 checks, and `protocol_benchmark.py` (no Worker probes)
- Honesty: I1–I6 CI gates the miniature `LabLedger` harness, not `StrataTokenLedger` and not multi-host gossip
- CI: `process-gossip` — 3 OS processes, INV/TX `mesh_sync`, SIGTERM one node + SQLite restart catch-up (`src/test_process_gossip.py`)
- Honesty: one Actions runner / local processes; not multi-machine, not mainnet, not aBFT
- Oracle-free pack: org repo URL; ingest token removed from unit; preflight CI. Oracle VM still operator-gated.

## 2026-08-11
- SPA opt-out grace (lab clock) + pending in summary
- Dual-asset Agora settlement verified in integration test
- Temporary Grok-managed status pulse while Oracle recovery pending
