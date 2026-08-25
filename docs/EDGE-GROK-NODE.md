# EDGE-GROK-CMN-001 — lab edge node on Cloudflare

**Status:** Live (not a stub) · **Linked fog:** `FOG-NODE-PT-CM-001`  
**Substrate:** Cloudflare Worker (`stratamesh-edge-grok`)  
**IDs:** edge node on available cloud capacity used by lab automation — not a physical FOG host, not mainnet.

## Endpoints

| URL | Role |
|-----|------|
| https://edge.calhegasmorais.pt/health | Health + identity |
| https://edge.calhegasmorais.pt/status | Link probe to fog status + gossip |
| https://edge.calhegasmorais.pt/ping-fog | Fog reachability only |
| https://stratamesh-edge-grok.stratamesh.workers.dev/* | Same worker (workers.dev) |

## Mesh membership

`stratamesh-gossip` lists this edge **only if** `GET {EDGE_GROK_URL}/health` returns HTTP 200.  
If the edge is down, it disappears from `/api/v1/gossip/peers` (anti-stub).

```bash
curl -s https://calhegasmorais.pt/api/v1/gossip/peers | jq .
curl -s https://edge.calhegasmorais.pt/status | jq .
```

## Capabilities (v1.0.0-edge-grok)

- Always-on edge observer/relay identity on CF Free Workers  
- Live health-check link to Calhegas Morais status pulse  
- Gossip observe (peer count / protocol)  
- Lab flags: `lab: true` · no mainnet claims  

## Not in scope (yet)

- Full DAG tip publish from edge  
- Physical resource meters / PoC emission from this edge  
- Multi-operator SPA grace  

Those require protocol depth beyond a CF edge observer.
