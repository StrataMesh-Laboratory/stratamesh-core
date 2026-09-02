# Workflows

Canonical map: [`docs/EDGE-GROK-ACTIONS-PACKAGE.md`](../../docs/EDGE-GROK-ACTIONS-PACKAGE.md).

**Labor = Actions. Execute git + live + Discourse = Grok** (`ops/bin/desk-execute.py --from-pack`).

v0.5.1-lab metabol: STASIS/HOLD = burn-rate pace (never freeze Workers, never `env STASIS=1`, never 503 login because `decide()` is STASIS). Lab is Adversarial P1 n=2 (Mac Fog + EDGE-GROK). Public fog `/health` n=1 `origin=session` is a **flag**, not a mesh fail. Hold HTML on academy/aiops/fund/edge is `outdated-aliases`, not a wrangler-deploy success. Tailscale is phased out — do not fail the lab if it is down; prefer local hops `:8788`/`:8790`. No new GH cron that hits CF Workers. No 6th CF cron. Never `workers.dev`. Never auth Worker PUT from Actions.

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
| `mesh-health.yml` | metabol pass: n≥2 **or** TUI `mesh_member`; no `origin=macbook` required |
| `metabolic-stasis.yml` | GraphQL remaining sample + pace only (never Worker freeze) |
| `edge-uptime.yml` | public edge `/health`; **hold HTML is FAIL** |
| `fog-tailnet-health.yml` | observe-only; Tailscale down ≠ lab fail |
| `gha-fail-watch.yml` | failed-run log + #123 notify (no re-run) |
| `apply-and-merge-pr.yml` | inspect / optional squash; **refuses protocol/consensus/crypto/auth** |
| `auto-create-pr.yml` | **removed from git** — disable leftover Actions workflow; never force-merge protocol |

`universal-contribution-audit.yml` `approve_and_merge` is maintainer dispatch; must not be used to force-merge protocol.

Probes: [`ops/config/health-probes.json`](../../ops/config/health-probes.json).  
Allow-list: [`ops/config/worker-allow.json`](../../ops/config/worker-allow.json).

Never `workers.dev`. Never a 6th CF cron. Never `/status` on the status Worker from CI.
