# Phase 7 Scaffold — Post-Quantum Hooks

Lab-only key registry (`src/pq_keys.py`). **Not production crypto.**

```
GET  /pq
POST /pq/generate  {algorithm: Kyber768-lab|Dilithium3-lab|SPHINCS+-lab, purpose?}
```

Replace with liboqs / hardware / Cloudflare PQ worker for real keys.

## Mesh Doctor
```bash
cd src && python3 mesh_doctor.py
```
Exercises submit → SPA → mint → agora → NFT → gov → sandbox → ACB → PQ.
