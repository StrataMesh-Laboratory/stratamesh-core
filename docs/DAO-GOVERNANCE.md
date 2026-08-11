# DAO Governance (lab)

## Templates
- `foundational` — protocol parameters, SPA standards, emission, finality certification
- `enterprise` — RBAC, treasury, compliance reports
- `consortium` — multi-org weighted votes, joint SPAs

## Flow
1. `POST /dao/proposal` (optional `dao_template`, `quorum_required`)
2. `POST /dao/vote` (`for`|`against`|`abstain`, `weight`)
3. `POST /dao/execute` when quorum met and for > against
4. Anchored on DAG

## SPA compliance
`POST /dao/compliance` `{ spa_id }` → status/pin/role checks + DAG

## Cron
Worker `scheduled` hourly: auto-terminate `opt_out_pending` SPAs past notice.
