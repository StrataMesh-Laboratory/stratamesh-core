# Track B4 — PQ pilot hooks

## Status
**Not production cryptography.** Lab placeholders + optional liboqs detection.

## API
```
POST /pq/generate  {algorithm, purpose}
POST /pq/sign      {key_id, message}   → lab_sig (hash-based)
POST /pq/verify    {key_id, message, lab_sig}
GET  /pq           # includes liboqs availability probe
```

## Algorithms (labels)
Kyber768-lab · Dilithium3-lab · SPHINCS+-lab

## Next for real PQ
Install `liboqs` / `liboqs-python` on the Fog host and replace `lab_sign` with real KEM/SIG primitives under the same API surface.
