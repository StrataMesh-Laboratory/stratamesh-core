# Hardening — operational (not only aspirational)

## 1. Independent validators + tip weight (live)
- `NODE-VAL-PT-CM-002` / `003` validate and call `POST /peer-weight`
- On **every DAG attach**, both peers receive tip weight on the new `vertex_id`
- Evidence: attach response includes `peer_weights: [{peer_id, ok, weighted}]`

## 2. Measurement gate before mint (live)
- `measurement_receipts` with `evidence_hash` + score
- Score uses on-graph fields + distinct EDGE/NODE-VAL contributors (24h) + peer_weight diversity when available
- `POST /mint` **requires** score ≥ **0.25** unless `allow_lab_low_score` (explicit lab only)
- Policy returned on 403 explains how to obtain a receipt

## 3. Finality with peer diversity (live)
- `cw_threshold` provisional **only if** weight ≥ 3 **and** confidence ≥ 0.2 **and** `peer_diversity ≥ 2`
- Diversity = `COUNT(DISTINCT peer_id)` on `peer_weight_events` for that tip
- `GET /finality/test` checks solo-heavy stays pending; multi-peer heavy provisional
- Version `1.1.0-peer-diversity-finality`

## 4. Agent loops: PdS + burn + labour (live)
- Cognition tick: insufficient PdS → deferred
- Continuous free cognition blocked without recent labour **or** balance floor
- Successful autonomous cognition **burns STRATA to `#0`** via `burnStrataToSink` when available
- ACB `5.13.0-pds-burn-ops`

## Verified commands
```bash
curl -s https://stratamesh-dag.stratamesh.workers.dev/finality/test
curl -s -X POST https://stratamesh-dag.stratamesh.workers.dev/attach \
  -H 'Content-Type: application/json' \
  -d '{"payload":{"type":"x"},"node_id":"FOG-NODE-PT-CM-001"}'
curl -s https://stratamesh-dag.stratamesh.workers.dev/finality
```
