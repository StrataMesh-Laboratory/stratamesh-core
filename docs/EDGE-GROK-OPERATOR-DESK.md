# EDGE-GROK operator desk (live)

Live Worker: `stratamesh-edge-grok` on https://edge.calhegasmorais.pt
Version: `1.5.0-operator-desk`
Lab only. grok@ is a Fog **user** / `external_assistant`, not SCA.

## Source of truth

- Live script: Cloudflare Worker `stratamesh-edge-grok` (`workers/stratamesh-edge-grok.js`)
- **Not live:** `workers/stratamesh-edge.js` (synthetic IoT hub / invented child edges). Do not revive those stubs.

## Public (unauthenticated)

`/` `/health` `/status` `/mesh` `/mesh/activate` `/ping-fog` `/openapi.json` `/llms.txt` `/.well-known/agent-catalog.json`

## Operator (Fog Bearer)

Auth: `GET https://stratamesh-auth.stratamesh.workers.dev/me` with `Authorization: Bearer`.
Allow `secret` or `top_secret`, including admin, SECRET staff, `external_assistant`, grok@.

- `GET /ops` HTML dash
- `GET /internal/v1/identity` `kind=user`, not SCA
- `GET /internal/v1/posture` live probes
- `GET /internal/v1/automations` desk catalog
- `GET /internal/v1/torch` gates + capability

CORS for `/ops` and `/internal/*`: `https://calhegasmorais.pt` and `https://edge.calhegasmorais.pt`.

## Automations (desk_owned)

Runner: STRATAGROK desk. **No Worker crons**. Not internalized until Orchestrator `SCA-ORCH-CMN-001` + AIOps team are shown able to fulfill (handler + replay). grok@ is not an SCA.

| Routine | Cron (Europe/Lisbon) |
|---|---|
| Night Diagnostic FOG | `0 23 * * *` |
| StrataMesh 24h Dev Cycle | `0 9 * * *` |
| Discourse lab ops pulse | `0 18 * * *` writes **only** https://stratamesh.discourse.group/t/20 |
| Watchdog P0 Mesh Escalate | `0 0-8 * * *` |
| x.ai grok@ reset retry | `19 21 * * *` |

Public ops pulse: https://stratamesh.discourse.group/t/20 (stratamesh-grok). Do not invent extra forum threads.

## Nested SSL

`api.edge.calhegasmorais.pt` handshake fails (Universal SSL one-level wildcard). Internal API stays on the desk host. Do not buy certs. Public integration API: `api-edge.calhegasmorais.pt`.
