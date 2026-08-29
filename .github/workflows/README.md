# Workflows

Canonical map: [`docs/EDGE-GROK-ACTIONS-PACKAGE.md`](../../docs/EDGE-GROK-ACTIONS-PACKAGE.md).

**Labor = Actions. Execute git + live + Discourse = Grok** (`ops/bin/desk-execute.py`).

| Workflow | Role |
|---|---|
| `desk-tick.yml` | 6 Lisbon slots · `/health` + honesty |
| `desk-prepare.yml` | Q-gate + drift + t/20 **draft** + execute recipe |
| `desk-publish.yml` | alias of prepare — **no PUT** |
| `dev-labor.yml` | compile + metabolism tests |
| `gitlive-drift.yml` | live SHA vs git |
| `worker-inventory.yml` | fail if cron > 5 |
| `secrets-guard.yml` | PR leak scan |
| `release-lab.yml` | dispatch GitHub prerelease |
| `mesh-health.yml` | daily cheap health |
| `wrangler-action-hold.yml` | no token |

Never `workers.dev`. Never a 6th CF cron. Never `/status` on the status Worker from CI.
