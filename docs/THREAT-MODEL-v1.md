# StrataMesh Threat Model v1

**Status:** LAB — living model for v0.2.x-lab  
**Companion:** `docs/WIRE-PROTOCOL-v1.md`  
**Method:** asset → attacker → surface → impact → detection → mitigation → residual risk

This model is a prerequisite for testnet. It does not claim the lab mesh is secure against the attackers listed.

---

## 0. Scope and assumptions

### In scope

- DAG / tip selection / gossip / probabilistic finality  
- STRATA emission (PoC), burn (`#0`), transfers, Fog treasury  
- Fog / Edge roles, SPA/APS NFT kind, DePIN receipts (target)  
- Auth sessions, clearance, KYC attestation path  
- SCA as economic principal  
- Operational surface: Cloudflare Workers, D1, R2, status/AIOps pulse  

### Out of scope (for this revision)

- Physical datacenter compromise of shared cPanel host beyond DNS/TLS notes  
- Nation-state traffic analysis of all Cloudflare edges  
- Formal cryptographic proofs of tip selection  

### Standing assumptions (LAB)

| Id | Assumption | If false |
|----|------------|----------|
| S1 | Operators of FOG-NODE-PT-CM-001 are trusted for lab resets | Lab can be wiped/equivocated by operator |
| S2 | Cloudflare account controls are not adversary-controlled | Full edge rewrite possible |
| S3 | Lab signing secrets are not production root of trust | Forged lab txs |
| S4 | Single-operator mesh is the default topology | Multi-operator claims need extra Sybil analysis |
| S5 | PQ schemes are placeholders | No PQ security claim |

---

## 1. Assets

| Asset | Confidentiality | Integrity | Availability |
|-------|-----------------|-----------|--------------|
| DAG history / tips | Low | **Critical** | High |
| Mint / burn invariants | — | **Critical** | High |
| NODE_WALLET balances | Medium | **Critical** | Medium |
| User/SCA balances | Medium | **Critical** | Medium |
| Session tokens / clearance | **High** | **High** | Medium |
| KYC raw documents | **Critical** | High | Medium |
| Resource proof evidence | Medium | **High** | Medium |
| Service receipts | Medium | **High** | Medium |
| SCA capability grants | High | **High** | Medium |
| Orchestrator policy | Medium | High | Medium |
| IPFS content addressed by CID | Varies | Medium | High |
| Status/AIOps telemetry | Low | Medium | Medium |

---

## 2. Attacker classes

| Id | Class | Capability sketch |
|----|-------|-------------------|
| **A1** | Honest-but-curious node | Follows protocol; retains and correlates traffic |
| **A2** | Malicious Fog operator | Controls one Fog’s keys, meters, local DB, Workers bindings |
| **A3** | Sybil Edge operator | Spawns many cheap Edge identities under weak admission |
| **A4** | Compromised user | Stolen session or password; limited clearance |
| **A5** | Compromised SCA | Agent process with wallet + network inside sandbox escape |
| **A6** | Malicious majority of active nodes | Coordinates tips, gossip, or votes in lab topology |
| **A7** | Network partition attacker | Splits Fog/Edge or peer sets; delays heal |
| **A8** | Eclipse attacker | Feeds one victim a false peer set / false tip cone |
| **A9** | Resource-meter manipulation | Lies about CPU/storage/bandwidth/uptime |
| **A10** | Oracle / time manipulation | Skews ISO timestamps, market averages, CLP inputs |
| **A11** | Identity / KYC attacker | Fake documents, MRZ injection, attestation forgery |
| **A12** | Economic manipulation | Wash trades, reflexive emission, thin Agora games |
| **A13** | Cloudflare / platform admin | Account takeover of Workers/D1/R2 (lab host risk) |
| **A14** | Content / CID adversary | Pin withholding, malicious payload at CID, substitution attempts |

---

## 3. Surfaces mapped to protocol objects

| Surface | Protocol object | Primary attackers |
|---------|-----------------|-------------------|
| Tx attach / parents | Transaction | A2, A6, A8 |
| Tip selection | tips, CW | A6, A8, A9 |
| Gossip inv/tx | GossipEnvelope | A1, A7, A8 |
| Virtual voting (lab) | GossipEvent | A6 |
| `#mint` / `#0` | Settlement | A2, A9, A12 |
| PoC meters | ResourceProof | A2, A3, A9 |
| DePIN lease | Receipt | A2, A4, A12 |
| SPA execute/pause | STRATA NFT state | A4, A5 |
| Session + clearance | Auth | A4, A11 |
| KYC OCR / submit | Attestation | A11 |
| SCA labour | ACB / agent-services | A5, A12 |
| Status pulse | Telemetry | A13 (integrity of dashboards) |

---

## 4. Scenario sheets (selected)

### T1 — Sybil tips / parasite cone

- **Attackers:** A3, A6  
- **Surface:** tip selection, parent choice  
- **Impact:** inflated confidence for attacker txs; honest tips starved  
- **Detection:** tip-set entropy, CW concentration, identity diversity metrics  
- **Mitigation (target):** admission control, resource-weighted identity, rate limits, diversity constraints in tip algorithm  
- **Lab residual:** **High** — single-operator lab cannot claim Sybil resistance  

### T2 — False contribution → mint

- **Attackers:** A2, A9  
- **Surface:** ResourceProof → emission policy → `#mint`  
- **Impact:** unearned STRATA; invariant I2 broken in spirit  
- **Detection:** cross-check meters, challenge-response fail logs, emission audit scripts  
- **Mitigation:** no transit eligibility without independent verification; lab_bootstrap never transits  
- **Lab residual:** **High** until real meters + challenges land (Track B3)  

### T3 — Burn sink spend / mint receive

- **Attackers:** A2, A13  
- **Surface:** token ledger rules  
- **Impact:** breaks I1/I3/I4/I6  
- **Detection:** property tests; continuous invariant audit on balances  
- **Mitigation:** enforce in single canonical balance engine; reject at API and state transition  
- **Lab residual:** **Medium** — worker code has guards; need property tests + multi-impl agreement  

### T4 — Replay / double-spend

- **Attackers:** A4, A6, A8  
- **Surface:** Transaction `tx_id`, transfers  
- **Impact:** duplicated spend or mint  
- **Detection:** duplicate `tx_id` metrics; balance divergence  
- **Mitigation:** idempotent accept; deterministic `tx_id`; signed payload  
- **Lab residual:** **Medium** — depends on canonical serialization freeze  

### T5 — Eclipse + partition

- **Attackers:** A7, A8  
- **Surface:** gossip peers, tip feed  
- **Impact:** victim accepts minority history; false confidence  
- **Detection:** peer-set churn, cross-Fog tip mismatch, partition timers  
- **Mitigation:** diverse peer discovery, heal rules, confidence caps under isolation  
- **Lab residual:** **High** — multi-host gossip still roadmap Track A  

### T6 — KYC data on ledger

- **Attackers:** A11, A13, future public readers  
- **Surface:** kyc workers, D1, accidental DAG payload  
- **Impact:** irreversible privacy breach if immutable  
- **Detection:** schema scans for document fields on ledger tables  
- **Mitigation:** **normative** — commitment + attestation only (WIRE §12.2)  
- **Lab residual:** **High** until raw-doc paths audited and stripped from any graph payload  

### T7 — SCA capability escape

- **Attackers:** A5  
- **Surface:** agent-services, wallet, network, shell  
- **Impact:** unbounded spend, lateral movement, labour market abuse  
- **Detection:** capability audit log, quota breaches, anomaly spend  
- **Mitigation:** capability tokens, sandbox, resource quotas, revocation; never combine arbitrary shell + wallet + unlimited network  
- **Lab residual:** **High** — SCA autonomy is early  

### T8 — Thin Agora / reflexive emission

- **Attackers:** A12  
- **Surface:** emission function, Agora VWAP, service demand  
- **Impact:** inflationary spiral or manipulated price signals feeding PoC premiums  
- **Detection:** emission vs burn time series; utilization vs issuance  
- **Mitigation:** emission function includes demand/utilization/burn/security budget — not contribution alone  
- **Lab residual:** **High** — policy documented; adversarial economic sim not yet standard  

### T9 — Orchestrator / ML in consensus path

- **Attackers:** A2, A5, poisoning data sources  
- **Surface:** hybrid orchestrator recommendations  
- **Impact:** nondeterministic or manipulated state transitions  
- **Detection:** separate recommend vs commit logs  
- **Mitigation:** **hard rule** — ML may recommend; protocol state transitions remain deterministic, versioned, replayable  
- **Lab residual:** **Medium** if separation is enforced in code review  

### T10 — Platform admin (Cloudflare)

- **Attackers:** A13  
- **Surface:** Workers scripts, D1, R2, DNS  
- **Impact:** total lab rewrite, false status, key exfil  
- **Detection:** deploy audit, git lockstep, external monitors  
- **Mitigation:** lockstep publish, least-privilege tokens, secret rotation, external status mirrors  
- **Lab residual:** **Accepted** for LAB; unacceptable for MAINNET without multi-operator diversity  

---

## 5. Identity and clearance threats

| Threat | Mitigation |
|--------|------------|
| Client sends `clearance: top_secret` | Server resolves from `users.clearance_level` only |
| Session theft | Short TTL, 2FA for staff, rotation, device binding (target) |
| Confused deputy (Fog id as user) | UI + API: Conta = agent; Contexto = node; NODE_WALLET ≠ account |

Visitors remain **PUBLIC** clearance. Panel/Bancada are private per User|SCA.

---

## 6. Economic trust boundaries

```
#mint  --emit only-->  wallets (Fog treasury | User | SCA)  --burn-->  #0
         ^                         |
         |                         +-- Ágora P2P (no mint)
    PoC proof only
```

| Boundary | Trust rule |
|----------|------------|
| Lab units | May exist; must not be labeled transit_eligible |
| PoC units | Only after verification policy passes |
| Lease escrow | Settlement from escrow; no mint |
| NFT collateral | Burn/execute rules per SPA kind; majority liquidation is explicit, high-impact |

---

## 7. Required tests derived from this model

Map directly to harness work (Track B after this document):

| Test class | Threats covered |
|------------|-----------------|
| Deterministic replay | T4, T9 |
| Property: I1–I6 | T3, T4 |
| Fuzz gossip + tx | T1, T5 |
| Partition / eclipse sim | T5 |
| Sybil Edge swarm | T1, T2 |
| Fake meter vs challenge | T2 |
| KYC schema lint (no raw docs on ledger) | T6 |
| SCA quota + revoke | T7 |
| Emission vs burn stress | T8 |

---

## 8. Residual risk summary (LAB)

| Area | Residual | Exit toward TESTNET |
|------|----------|---------------------|
| Sybil resistance | High | Admission + resource-weighted identity + multi-operator |
| PoC verifiability | High | Challenge-response meters; no transit without proof |
| Finality | High | Spec + modules beyond lab confidence; adversarial evidence |
| Multi-host gossip | High | Always-on multi-node; chaos suite green |
| KYC privacy | High | Attestation-only path proven by audit |
| SCA capabilities | High | Capability model + sandbox tests |
| Platform concentration | Accepted in lab | Multi-operator / diversity plan |
| Invariant engine | Medium | Property tests in CI on every mint/burn path |

---

## 9. Governance domains (do not collapse)

| Domain | Decides |
|--------|---------|
| Protocol governance | Wire rules, emission policy ids, tip algorithm ids |
| Node governance | Fog operator, infrastructure, keys |
| SCA governance | Agent collective rules (associative DAO ≠ node ops) |

A vote about SCA rights must not silently change tip selection or mint rules.

---

## 10. Change control

1. New attacker class or broken assumption → bump model revision and re-rank residuals.  
2. Mitigations that change wire behavior require `WIRE-PROTOCOL` version notes.  
3. Do not mark residual “Low” without reproducible test evidence linked from CI.

**Document version:** THREAT-MODEL-v1 · 2026-08-23 · LAB  
**Node:** FOG-NODE-PT-CM-001
