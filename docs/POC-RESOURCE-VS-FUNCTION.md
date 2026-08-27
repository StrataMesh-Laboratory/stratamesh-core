# Proof of Contribution — Resource versus Function

**Status:** Normative for CMN lab and intended production freeze  
**Related:** `B0-EMISSION-POLICY.md`, `TOKENOMICS-WHITEPAPER.md`, `POC-DYNAMIC-MARKET.md`

---

## 1. Purpose

This note defines how Proof of Contribution (PoC) values what nodes supply to the mesh. It separates **resource** (what is contributed) from **function** (how that capacity is used). Confusing the two leads to incorrect pricing and distorted incentives.

---

## 2. Definitions

| Term | Meaning |
|------|---------|
| **Resource** | Measurable capacity made available to the mesh: storage, compute, bandwidth, or availability. |
| **Function** | The purpose or application of that capacity (for example which CID is stored, which SPA consumes it, or which user benefits). |
| **Quality** | An assessment of how reliably and usefully a given quantity of a resource is provided. Quality adjusts value *within* a resource class; it does not create a new class. |

Storage capacity is storage capacity whether it holds realm assets, pin-set objects, or protocol metadata. The protocol does not assign a different unit price because the *use* differs.

---

## 3. Pricing principle

STRATA minted through PoC is determined exclusively by:

1. **Billable quantity** of a single **resource class**  
2. **Exogenous market average** for that resource (in a quote asset such as EUR)  
3. **Quality factor** (premium or discount relative to par) for that contribution  
4. **Agora conversion** from quote asset into STRATA (market-discovered rate, not a protocol-fixed mint rate)

```
STRATA = quantity(resource) × market_avg(resource) × quality(resource) × agora_strata_per_quote
```

Function and purpose do **not** appear in this formula. They may appear in operational logs or SPA terms; they must not define a separate price schedule.

---

## 4. Resource classes

| Class | Unit | Scope |
|-------|------|--------|
| `storage` | MB-month | Capacity to retain data |
| `compute` | work-unit | Capacity to perform validation or processing work |
| `bandwidth` | propagation-unit | Capacity to transfer or propagate data |
| `availability` | uptime-slice | Capacity to remain reachable over time |

Legacy labels used in earlier lab code (`ipfs_pin`, `validate`, `gossip`, `fog_uptime`) map to these classes for compatibility only. They are not distinct economic categories.

---

## 5. Quality

Quality is the only sanctioned adjustment inside a resource class. Typical dimensions include reliability, usefulness relative to mesh demand for that resource, availability of the capacity, and verifiability of the measurement.

Quality must describe the **resource as supplied**, not the social or commercial purpose of its consumers.

---

## 6. Implications

- Edge or cloud substrates used by a node count only insofar as they deliver **measurable resource capacity** to the mesh. Substrate identity does not, by itself, create a price.  
- Application roles (portal, SPA, ACB runtime) consume or organise resources; they are not resource classes for PoC.  
- Labour markets, Agora trades, and DAO treasury movements transfer existing STRATA. They do not redefine PoC resource prices by function.  
- Double-counting is avoided by incremental accounting of billable units already rewarded per node and resource class.

---

## 7. Implementation reference

- Worker: `stratamesh-poc` (version `5.7.x`)  
- Canonical classes: `storage`, `compute`, `bandwidth`, `availability`  
- Measurement exposes both resource fields and legacy evidence labels; mint and quote normalise aliases to canonical classes.
- Lab honesty: `src/resource_proof.py` is an in-process SHA-256 work-token verifier for the `compute` class (challenge/receipt; reject bare claim and replay). It is not a multi-host mint and does not replace Worker measurement.

---

**UNCLASSIFIED // FOG-NODE-PT-CM-001**
