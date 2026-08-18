# Hardening slice (lab)

## 1. Independent validators + tip weight
- `NODE-VAL-PT-CM-002` / `003` (`stratamesh-node-2` / `node-3`)
- On `/validate`, call DAG `POST /peer-weight` with `peer_id` → `peer_weight_events` + cumulative weight bump
- Still same CF account (operator concentration remains); process space is separate

## 2. Measurement gate before mint scale
- `measurement_receipts` with `evidence_hash` + score
- `POST /mint` runs `requireMeasurementForMint` (403 if score too low unless `allow_lab_low_score`)
- Edge mesh contributes raise peer_confirms for fog node receipts

## 3. Finality modules + tests
- `GET /finality`, `/finality/modules`, `/finality/test`
- Explicit `adversary_assumptions` / non-claims (not ABFT)
- Self-test: probabilistic never finalizes; cw light pending; cw heavy provisional

## 4. Agent loops: PdS + labour gate
- Autonomous cognition deferred if PdS insufficient
- Continuous free cognition blocked without recent labour marketplace activity **or** elevated balance floor
- Volition cycle skips insolvent SCAs

**Honest limit:** multi-operator independence and true unforgeability still require external hosts and non-self-attested physical measurement.
