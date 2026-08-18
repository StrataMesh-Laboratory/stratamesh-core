# Calhegas Morais Edge Nodes (synthetic IoT on Cloudflare)

## What is real
Each Edge Node is a **separate Cloudflare Worker** (separate isolate / process space).
The Worker isolate is the substrate; sensor values are **deterministic drivers** over wall-clock + node seed — the same pattern as firmware that polls hardware, except the “hardware” is the isolate itself.

Capacity contributions are **real writes** to `stratamesh-poc` mesh pool (`/pool/contribute`) with `node_id` of the edge.

## Nodes
| node_id | Worker | Role | Device class |
|---------|--------|------|----------------|
| EDGE-NODE-PT-CM-001 | stratamesh-edge-cmn-01 | env_gateway | environmental gateway |
| EDGE-NODE-PT-CM-002 | stratamesh-edge-cmn-02 | storage_cache | storage/cache edge |

Parent fog: **FOG-NODE-PT-CM-001** (Calhegas Morais)

## Endpoints (per edge)
- `GET /health` — identity
- `GET /telemetry` — current sensor drivers
- `POST /heartbeat` — contribute capacity + optional DAG attach
- `GET /status` — last durable state (KV)

## Hub
`https://stratamesh-edge.stratamesh.workers.dev/children`  
`POST /pulse-all` — heartbeat both edges

## Cron (optional)
In Cloudflare Dashboard → each edge Worker → Triggers → Cron (`*/15 * * * *`) to auto-pulse without manual calls.
