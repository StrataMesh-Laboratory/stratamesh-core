## 2026-08-29 — v0.2.2-lab
- Lab honesty/ops bundle. **Not mainnet.** P0 still open. LAB only. No investment claims.
- Metabolism v1.3 (#35): pace inflators/deflators on hourly cap (0.5–1.5); circuit still trips on unadjusted cap
- Tor operator onion (#37): lab Debian tor v3 onion + SOCKS5h for operator plane (optional `FOG_TOR_SOCKS`)
- Optional Fog MariaDB DSN (#38): exclusive-off `FOG_MYSQL_URL`; missing/fail keeps SQLite
- Explicitly not in this cut: #16 Worker gossip, #36 on-graph STRATA
- Honesty: Fog listen not required; python3 in-process tests already in CI

## 2026-08-27
- Resource-proof MVP: in-process `compute` class hash work-token (`src/resource_proof.py`) — challenge/receipt; reject bare claim and replay
- Honesty: in-process SHA-256 evidence is not a multi-host mint and does not credit STRATA
- CI: `protocol-invariants` runs `test_resource_proof.py` (python3 only; no Worker probes)

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
