# IPFS Client

`src/ipfs_client.py` — pin path for Fog nodes.

| Mode | When | Behaviour |
|------|------|-----------|
| `stub` | default / offline | In-memory “pinned” |
| `api` | `IPFS_API_URL` set | Kubo `POST /api/v0/pin/add` |
| `gateway` | explicit | HEAD/GET gateway for availability |

```bash
export IPFS_API_URL=http://127.0.0.1:5001
python3 node_persistent.py --port 8787
# pins go to local Kubo

python3 -c "from ipfs_client import IPFSClient; print(IPFSClient(mode='gateway').request_pin('Qm...'))"
```

SPA “pinner” role should eventually require `api` mode under contract.
