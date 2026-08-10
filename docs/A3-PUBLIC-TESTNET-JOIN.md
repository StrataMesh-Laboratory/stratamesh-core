# Track A3 — Public testnet join (draft)

**Status:** Invitation / operator-run — not an open mainnet.

## Prerequisites
- Python 3.11+
- Open TCP port for the Fog HTTP API (default 8787) or tunnel
- Optional: Kubo with `IPFS_API_URL`

## 1. Get the code
```bash
git clone https://github.com/amcmorais/stratamesh-core.git
cd stratamesh-core
git checkout v0.2.0-lab   # or main
```

## 2. Start your node
```bash
export NODE_ID="FOG-$(hostname)-01"
./scripts/run_fog_node.sh
# or:
cd src && python3 node_persistent.py --port 8787 --db ./fog.db --id "$NODE_ID"
```

## 3. Register SPA
```bash
curl -s -X POST http://127.0.0.1:8787/spa/register \
  -H 'Content-Type: application/json' \
  -d '{"roles":["edge"]}'
```

Roles: `fog` | `edge` | `pinner` | `validator`  
Pinner role expects `IPFS_API_URL` in production (lab allows stub).

## 4. Peer with the mesh
Add known peer URLs (example):
```json
{
  "mesh": "public-testnet-draft",
  "peers": [
    {"id": "FOG-NODE-PT-CM-001", "url": "https://STATUS_OR_TUNNEL_URL"}
  ]
}
```

Sync from your side:
```bash
cd src
python3 -c "
from mesh_sync import sync_mesh, sync_spas
bases = ['http://127.0.0.1:8787', 'http://PEER:8787']
print(sync_mesh(bases, rounds=3))
print(sync_spas(bases))
"
```

## 5. Publish status (optional)
```bash
export STATUS_TOKEN=...   # coordinate with mesh operators
./scripts/publish_loop.sh
```

## 6. Health
```bash
./scripts/healthcheck.sh
curl -s http://127.0.0.1:8787/status | head
```

## Conduct
- No mainnet claims; lab/testnet economics only  
- Opt-out via SPA rules when formalized  
- Report peers and SPA ids to mesh maintainers for the public directory  

**Calhegas Morais** remains the reference seed node (`FOG-NODE-PT-CM-001`).
