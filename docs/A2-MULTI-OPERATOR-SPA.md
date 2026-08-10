# Track A2 — Multi-operator SPAs

## Demo
```bash
cd src && python3 a2_multi_spa_demo.py
```

## Behaviour
- Each operator node registers its own SPA (roles: fog / edge / pinner)
- `GET /spa/export` + `POST /spa/import` exchange registries
- `mesh_sync.sync_spas(bases)` merges unique SPA records mesh-wide
- Pin policy still evaluates pinner role vs IPFS mode per node

## Verified (lab)
3 operators (ALPHA/BETA/GAMMA) → each node reports **active: 3** SPAs after sync.
