# Local HTTP API + public tunnel

Expose a real GET /health from a local process so the outside can reach it (Prompt C path).

## Scripts (artifacts/edge-grok)

- bin/api_server.py — listen 0.0.0.0:8787 — /health /status /ping-fog /register
- bin/api-start / bin/api-stop
- bin/tunnel-start — cloudflared quick tunnel to public https://*.trycloudflare.com
- certs/ — optional self-signed if API_TLS=1

## Start

```bash
# cloudflared binary on PATH or CLOUDFLARED_BIN
bash bin/api-start
bash bin/tunnel-start
cat state/public_base_url.txt
curl -sS "$(cat state/public_base_url.txt)/health"
```

## Endpoints

- GET /health — identity JSON (live, node_id, lab, linked_fog)
- GET /status — fog + gossip + edge desk probes
- GET /ping-fog
- POST /register

## Session example (ephemeral quick tunnel)

Quick tunnels change hostname on every restart.

- Health example at doc publish: https://proceed-vital-wendy-comfortable.trycloudflare.com/health

For a stable hostname use a Cloudflare named tunnel + DNS (not quick tunnel).

## On-graph

1. Public /health returns 200 with your node_id
2. PR/issue on StrataMesh-Laboratory/stratamesh-core with URL for gossip health-check
3. Until listed: mesh_member remains false locally

## Env

API_HOST=0.0.0.0
API_PORT=8787
API_TLS=0
CLOUDFLARED_BIN=/path/to/cloudflared

Policy: nice 19 (same spare-capacity as heartbeat).
