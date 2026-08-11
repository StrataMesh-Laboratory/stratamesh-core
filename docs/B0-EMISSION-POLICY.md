# B0 — STRATA Emission Policy

**Status:** Active in laboratory; production freeze pending formal audit  
**Node:** FOG-NODE-PT-CM-001 (Calhegas Morais Node)  
**Related:** `POC-RESOURCE-VS-FUNCTION.md`, `TOKENOMICS-WHITEPAPER.md`

---

## 1. Sole mint path

New STRATA enters supply only through **Proof of Contribution (PoC)**.

Contribution is valued as **resource capacity** supplied to the mesh—not as application-level function. See *Resource versus Function*.

```
billable quantity (on-graph, incremental)
  × global market average for that resource (quote asset, e.g. EUR)
  × quality factor (premium or discount within that resource)
  × Agora STRATA per quote unit (P2P book, not protocol-set)
  → STRATA credited to the contributing node(s)
```

---

## 2. Mechanisms that do not mint

| Mechanism | Economic effect |
|-----------|-----------------|
| ACB labour hire | Transfer from holder to ACB |
| ACB subsistence | Debit of ACB balance |
| Agora trade | Transfer / settlement between parties |
| DAO treasury deposit or payout | Transfer |
| Corporate profit distribution | Transfer from treasury to partners by capital share |
| Associative DAO | No profit distribution in STRATA |

---

## 3. Incremental accounting

The ledger tracks billable units already rewarded per `(node_id, resource_class)`.  
If on-graph capacity has not increased since the last confirmed PoC for that class, mint amount is **zero**.

---

## 4. Quality

- Default: derived from on-graph evidence (capacity reliability, usefulness against resource demand, availability, verifiability).  
- Explicit quality or proof dimensions may be supplied within protocol bounds.  
- Par factor is 1.0; values above or below express premium or discount **within the same resource class**.

---

## 5. Market averages

Global averages are exogenous inputs stored in the ledger (`POST /poc/global-avg`).  
Laboratory values use published 2026 market proxies (for example object-storage EUR per MB-month).  
Production should replace proxies with scheduled external feeds. Averages are **not** a protocol-defined mint rate.

---

## 6. Audit

Reproducible checks: `scripts/b0_emission_audit.sh` against public Worker endpoints (and optional ledger export).

**Exit criteria for B0 freeze:** this policy published; audit demonstrates that mint events arise only from the PoC path above.

---

**UNCLASSIFIED // FOG-NODE-PT-CM-001**
