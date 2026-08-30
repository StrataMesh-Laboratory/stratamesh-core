# Workflows

Canonical map: [`docs/EDGE-GROK-ACTIONS-PACKAGE.md`](../../docs/EDGE-GROK-ACTIONS-PACKAGE.md).

**Labor = Actions. Execute git + live + Discourse = Grok** (`ops/bin/desk-execute.py --from-pack`).

| Workflow | Role |
|---|---|
| `desk-tick.yml` | 6 Lisbon slots · `/health` + honesty · **artifact `desk-tick`** |
| `desk-prepare.yml` | Q-gate + drift + t/20 **draft** · **artifact `desk-prepare`** |
| `desk-publish.yml` | alias of prepare — **no PUT** |
| `dev-labor.yml` | compile + metabolism + dry tick + no workers.dev in YAML |
| `gitlive-drift.yml` | live SHA vs git (`ops/config/worker-allow.json`) |
| `worker-inventory.yml` | fail if cron > 5 |
| `secrets-guard.yml` | PR leak scan + workers.dev in workflow diffs |
| `release-lab.yml` | dispatch GitHub prerelease |
| `mesh-health.yml` | daily → reusable `desk-tick` |
| `gha-fail-watch.yml` | failed-run log + #52 notify (no re-run) |

Probes: [`ops/config/health-probes.json`](../../ops/config/health-probes.json).  
Allow-list: [`ops/config/worker-allow.json`](../../ops/config/worker-allow.json).

Never `workers.dev`. Never a 6th CF cron. Never `/status` on the status Worker from CI.
