# Workflows

Canonical map: [`docs/EDGE-GROK-ACTIONS-PACKAGE.md`](../../docs/EDGE-GROK-ACTIONS-PACKAGE.md).

Public Linux runners are **net $0** on this org. That is the EDGE-GROK Bot body. Grok chat stays judgment + Fog/tunnel.

| Workflow | Role |
|---|---|
| `desk-tick.yml` | 6 Lisbon slots · `/health` + honesty + optional GraphQL |
| `gitlive-drift.yml` | live Worker bytes vs git |
| `worker-inventory.yml` | fail if CF cron > 5 |
| `desk-publish.yml` | **dispatch** Q-gated CF PUT |
| `release-lab.yml` | **dispatch** GitHub prerelease |
| `secrets-guard.yml` | PR leak scan |
| `mesh-health.yml` | daily cheap health |
| `metabolism.yml` | unit tests on rails |
| `protocol-invariants.yml` / `process-gossip.yml` | lab harness |
| `origin-archive.yml` | 00:20Z pile |
| `wrangler-action-hold.yml` | no token, `--version` only |

Never `workers.dev`. Never a 6th CF cron. Never `/status` on the status Worker from CI.
