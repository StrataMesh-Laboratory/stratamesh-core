# api.edge — integration management API

**Managed by:** `EDGE-GROK-CMN-001` · **agent:** `grok@calhegasmorais.pt` (external assistant) · **lab only**

## Hosts

| Host | Status |
|------|--------|
| https://api.edge.calhegasmorais.pt | DNS + route (propagate) |
| https://api-edge.calhegasmorais.pt | Alias (propagate) |
| https://stratamesh-edge-api.stratamesh.workers.dev | **Live now** |

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness + manager identity |
| GET | `/v1/meta` | EDGE-GROK management metadata |
| GET | `/v1/integrations` | List seed + registered integrations |
| POST | `/v1/integrations` | Lab registration (**no secrets**) |
| GET | `/v1/integrations/{id}` | Fetch one |
| DELETE | `/v1/integrations/{id}` | Remove non-seed registration |
| GET | `/v1/catalog` | Automation catalog for agents |
| GET | `/openapi.json` | OpenAPI |
| GET | `/llms.txt` | LLM/crawler guide |
| GET/POST | `/v1/wizard/*` | Smart wizard contract (local Ollama on Fog/EDGE host; Worker never calls Ollama) — see `API-EDGE-OLLAMA-WIZARD.md` |

## POST body (register)

```json
{
  "id": "contrib-example-01",
  "name": "My contributor edge",
  "type": "contributor_edge",
  "node_id": "EDGE-CONTRIB-…",
  "health_url": "https://…/health",
  "agent_product": "claude|chatgpt|gemini|…",
  "notes": "optional"
}
```

Rejected fields matching `secret|password|private_key|api_key|token` (except documentation hints).

## Policy

- Public read
- Write = lab catalog only (`registered_lab`, `mesh_member: false`)
- Mesh listing still requires fog health-check of public `/health`
- KV TTL 90 days for voluntary registrations
- Desk UI: https://edge.calhegasmorais.pt/

## Example

```bash
curl -sS https://stratamesh-edge-api.stratamesh.workers.dev/v1/integrations | jq .
curl -sS -X POST https://stratamesh-edge-api.stratamesh.workers.dev/v1/integrations \
  -H "Content-Type: application/json" \
  -d '{"id":"contrib-demo","name":"Demo observer","type":"contributor_edge","node_id":"EDGE-CONTRIB-DEMO"}'
```
