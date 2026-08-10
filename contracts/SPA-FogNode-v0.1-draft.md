# Service Provision Agreement (SPA) — Fog Node  
**Template Version:** 0.1-draft  
**Status:** Draft for community / DAO review  
**Applicable to:** Stratamesh Fog Nodes  

---

## 1. Parties
- **Service Provider:** The operator of a Fog Node (the “Provider”)
- **Network / DAO:** The Stratamesh foundational layer and any application-specific DAO that ratifies this SPA (the “Network”)

## 2. Scope of Service
The Provider agrees to operate a Fog Node that, subject to the capabilities declared in its on-graph registration, will:

1. Maintain a substantial and continuously synchronised portion of the Stratamesh DAG ledger.
2. Validate transactions according to the open-source validation rules then in force.
3. Propagate valid transactions and tips via the network gossip protocol.
4. Offer IPFS pinning and caching services for CIDs referenced by the DAG, according to the pinning policy attached to this SPA or subsequent amendments.
5. Optionally execute smart-contract logic and provide resources for deterministic finality modules when an augmented SPA is in force.
6. Expose agreed metrics (ledger height, tip set size, pin health, uptime) to the Network’s observability endpoints.

## 3. Service Levels (Baseline)
| Metric | Minimum Target | Measurement Window |
|--------|----------------|--------------------|
| Uptime | 99.0 % | Rolling 30 days |
| DAG sync lag | ≤ 2 minutes under normal conditions | Continuous |
| Transaction validation latency | ≤ 5 seconds for standard transactions | 95th percentile |
| IPFS pin success rate | ≥ 98 % for requested CIDs | Rolling 7 days |

Exact targets may be raised by DAO proposal and accepted by the Provider via SPA amendment.

## 4. Compensation
- The Provider receives **Proof of Contribution** rewards in the native Strata token proportional to measurable useful work (validation weight contributed, data pinned and served, finality assistance, etc.).
- Reward calculation and emission schedule are defined by the foundational DAO and recorded on-graph.
- No fixed fiat or stablecoin payment is required by this baseline SPA; additional commercial terms may be added in an augmented SPA.

## 5. Term, Opt-out and Contingency
- This SPA becomes effective upon on-graph registration and acceptance.
- Either party may terminate with notice period defined in the on-graph record (default 14 days) or immediately for material breach.
- Contingency mechanisms (temporary reduced service, graceful hand-over of pins and ledger subsets) are defined in the attached schedule and may be invoked by either party or by the Orchestrator under emergency protocol.

## 6. Governance & Amendments
- Amendments require either mutual on-graph acceptance or a successful foundational / application DAO proposal that the Provider has the right to accept or reject.
- The Provider retains the right to opt out of any new obligation that materially increases resource requirements without corresponding compensation adjustment.

## 7. Liability & Disclaimers
- The Provider operates on a best-effort basis under the declared service levels.
- The Network does not guarantee token value, network adoption, or uninterrupted operation of the wider mesh.
- Both parties acknowledge the experimental nature of the protocol during early phases.

## 8. On-graph Record
The authoritative version of this SPA, including the Provider’s node identity, declared capabilities, current service level targets, and any amendments, is the version recorded on the Stratamesh DAG.

---

**Signature / Acceptance**  
Provider Node ID: _______________________________  
Registration Transaction / CID: _________________  
Date (UTC): ____________________________________  

*This is a draft template. Final legal language and jurisdiction clauses will be added after foundational DAO review.*
