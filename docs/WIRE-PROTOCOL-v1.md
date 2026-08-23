# StrataMesh Wire Protocol v1

**Status:** LAB — normative draft for v0.2.x-lab  
**Authority:** this document over “whatever current code does”  
**Scope:** consensus-critical and settlement-critical message shapes  
**Not in scope:** UI, Bancada chrome, marketing ontology, PQ marketing claims

Reference Fog node: `FOG-NODE-PT-CM-001` · site: https://calhegasmorais.pt/  
Live workers implement subsets of this protocol; gaps are marked **LAB**.

---

## 0. Status ladder

| Stage | Meaning |
|-------|---------|
| **LAB** | Experimental; may reset; not economically or consensus-secure |
| **TESTNET** | Public measurable network; adversarial testing expected |
| **MAINNET** | Audited protocol, economic controls, upgrade + incident process |

Current public claim: **LAB only**. Implementations must not assert production finality, aBFT, or post-quantum security.

---

## 1. Holonic stack (lockstep)

Nested containment, infrastructure → inhabitance:

```
TRD StrataMesh          (GDA, PdC, PdS, Ágora; CLP/PPC temporal kernel)
  └ Fog Node            (operator; NODE_WALLET treasury; instantiates OS)
      └ SO Metaverso    (shared Web3 metaverse OS)
          └ Domínio Virtual   (VM hypervisor — capacity for worlds)
              └ Mundo Aberto
                  └ Bancada CGU   (sandbox; Painel/Portal = UI kit)
                      └ Utilizador | SCA
```

**Hard separations**

| Layer | Role |
|-------|------|
| TRD poles `#mint` / `#0` | Protocol emission and irreversible burn |
| Fog `NODE_WALLET` | Node treasury — **not** a user/SCA account |
| User \| SCA wallets | Agent accounts (Painel + Bancada) |
| SPA / APS | **One kind** of smart-contract STRATA NFT (static ↔ dynamic), not a separate NFT class |

CLP is civil temporal authority of the TRD; ISO-8601 is wire/interop carrier only.

---

## 2. Version fields

Every consensus-critical object SHOULD carry:

| Field | Type | Notes |
|-------|------|-------|
| `protocol_version` | uint | Wire protocol major (this doc = `1`) |
| `tx_schema` | uint | Transaction body schema |
| `tip_algorithm` | uint | Tip-selection algorithm id |
| `emission_policy` | uint | PoC emission policy id |
| `signature_scheme` | uint | `1` = lab HMAC/ECDSA placeholders; PQ reserved |

Unknown major `protocol_version` → reject. Minor extensions MUST be ignorable by honest older nodes.

---

## 3. Node identity

```
NodeIdentity {
  node_id:          string          // e.g. FOG-NODE-PT-CM-001
  operator_id:      string | null   // human operator binding (off-ledger or attestation)
  public_key:       bytes           // verification key for this node
  capabilities:     string[]        // fog | edge | storage | compute | ...
  protocol_version: uint
  role:             "fog" | "edge" | "scout" | "lab"
}
```

- **Fog** = deliberately installed productive capacity.  
- **Edge** = opportunistic residual capacity under a Fog.  
- Edge nodes do not redefine Fog operator identity.

---

## 4. Transaction

### 4.1 Canonical fields

```
Transaction {
  tx_id:              string        // deterministic hash of canonical payload
  protocol_version:   uint          // 1
  tx_schema:          uint
  tx_type:            enum
  parents:            string[]      // 0..k tip ids this tx approves (k≥1 except genesis)
  weight:             float         // intrinsic weight ≥ 0
  cumulative_weight:  float         // maintained by receivers; not blindly trusted from peer
  timestamp_iso:      string        // wire carrier ISO-8601
  timestamp_clp:      object | null // optional CLP compact stamp
  sender:             string | null // node_id or agent id
  payload_type:       string        // mint | burn | transfer | spa | resource_proof | receipt | ...
  payload_hash:       string        // hash of payload body
  cid:                string | null // content id when payload is off-graph
  signature:          string        // over canonical bytes
}
```

### 4.2 `tx_type` (aligned with `src/tip_selection.py`)

| Value | Use |
|-------|-----|
| `standard` | Default graph vertex |
| `lightweight` | Preferential tip bias; lower intrinsic weight (IoT / micro) |
| `spa` | SPA/APS lifecycle (smart-contract NFT kind) |
| `finality` | Finality-related marker (lab) |
| `mint` | PoC emission event |
| `trade` | Settlement / transfer |

### 4.3 Genesis

- Empty DAG MAY bootstrap a single `genesis` vertex with `parents: []`.  
- No other transaction MAY have empty parents once genesis exists.  
- Duplicate `tx_id` → ignore (idempotent accept).

### 4.4 Attachment rules (normative intent)

1. All `parents` MUST already exist in the local DAG.  
2. Graph MUST remain a DAG (no cycles).  
3. Receiver recomputes `cumulative_weight` from local state; peer-supplied CW is advisory only.  
4. Invalid signature → reject.  
5. Replay of an accepted `tx_id` → no state change.

**LAB:** current Python/`stratamesh-dag` workers implement a subset; formal hash preimage and signature suite remain experimental.

---

## 5. Gossip (wire messages)

Two concurrent lab dialects exist; v1 freezes the **inventory dialect** from `src/gossip.py` as the portable peer protocol. The hashgraph-fragment events in `stratamesh-gossip` are an optional enrichment, not a second consensus.

### 5.1 Envelope

```
GossipEnvelope {
  type:    "inv" | "getdata" | "tx" | "getparents" | "parents"
  payload: object
  ts:      number   // unix seconds (wire); not civil authority
}
```

### 5.2 Message semantics

| Type | Payload | Meaning |
|------|---------|---------|
| `inv` | `{ ids: string[] }` | Announce known `tx_id`s |
| `getdata` | `{ ids: string[] }` | Request full transactions |
| `tx` | full Transaction fields | Deliver one transaction |
| `getparents` | `{ tx_id }` | Request parents for gap fill |
| `parents` | `{ tx_id, parents: Transaction[] }` | Parent set response |

### 5.3 Hashgraph fragment (optional, lab)

`stratamesh-gossip` events:

```
GossipEvent {
  hash:         string
  creator:      string      // node_id
  self_parent:  string | null
  other_parent: string | null
  transactions: string[]    // tx_ids referenced
  timestamp:    string
  round:        uint
}
```

Virtual voting over these events is **LAB** (not production aBFT).

---

## 6. Tip selection

### 6.1 Interface

```
select_tips(dag, k=2, prefer_lightweight_bias=0.35) → tip_id[]
```

Normative properties for algorithm id `1` (reference `src/tip_selection.py`):

1. Sample without replacement from current tips.  
2. Probability mass increases with local `cumulative_weight`.  
3. Optional bias toward `lightweight` tips.  
4. Output length `min(k, |tips|)`.

### 6.2 Live Worker surface

`stratamesh-consensus` exposes:

- `GET /api/v1/consensus/tips` — scored tips (LAB weights)  
- Modules: `cw_threshold`, `tip_sample_confidence`, `virtual_voting` (lab fame threshold)

**Non-claim:** MCMC/R-URTS naming does not inherit IOTA or Hedera security proofs.

---

## 7. Finality (lab)

```
confidence(tx_id) ∈ [0, 1]
  ≈ cumulative_weight(tx) / max_cumulative_weight(reference_pool)
```

- `deep_confidence(tx_id, threshold=0.8)` → boolean gate for lab UIs.  
- **Not** deterministic finality.  
- **Not** asynchronous BFT.  
- Meta-finality modules remain Track B (see roadmap).

Implementations MUST label confirmation as **probabilistic lab confidence**.

---

## 8. Economic poles and settlement

### 8.1 Addresses with protocol meaning

| Address | Role | Rules |
|---------|------|-------|
| `#mint` | Emission source | Creates STRATA only via verified PoC path; never holds spendable balance; never receives ordinary transfers |
| `#0` | Burn sink | Receives on resource consumption; **never** transfers out |
| `NODE_WALLET` / `FOG-NODE-PT-CM-001` | Fog treasury | Circulates; not a user/SCA account |
| User / SCA wallets | Agent accounts | Circulates under account rules |

### 8.2 Invariants (must become ledger-enforced)

| Id | Invariant |
|----|-----------|
| **I1** | `#mint` cannot receive ordinary transfers |
| **I2** | `#mint` creates value only under emission policy + proof |
| **I3** | `#0` cannot initiate transfers |
| **I4** | Burned amount is irreversible |
| **I5** | Transaction replay cannot create value |
| **I6** | `sum(spendable balances) == total_issued − total_burned` (lab_only units tracked separately) |

### 8.3 Origin classes (fungible)

| Origin | Lab valid | Transit to published |
|--------|-----------|----------------------|
| `lab_bootstrap` / `lab_grant` | yes | **no** |
| `poc_contribution` | yes | **yes** (transit_eligible) |

Ágora trades move existing STRATA; they are not mint.

### 8.4 Settlement object (target shape)

```
Settlement {
  from:            string
  to:              string
  amount:          number
  reason:          "poc_mint" | "burn" | "transfer" | "lease_settle" | "pds" | ...
  resource_receipt: string | null  // id of verified receipt when applicable
  tx_id:           string
}
```

---

## 9. Resource proof and PoC

### 9.1 Principle

**Claimed capacity ≠ accepted contribution** unless independently verifiable.

### 9.2 Resource proof (target)

```
ResourceProof {
  resource_type:       "storage" | "compute" | "bandwidth" | "memory" | "render" | ...
  measurement:         number
  measurement_window:  string      // interval
  attestation:         object      // challenge-response / meter / signed evidence
  provider:            string      // node_id
  signature:           string
  tip_algorithm:       uint
  emission_policy:     uint
}
```

### 9.3 Emission path

```
verified ResourceProof
  → normalization (class, quality, market par)
  → contribution score
  → emission function (policy id)
  → mint tx (tx_type=mint) from #mint
  → credit NODE_WALLET and/or contributor wallet
```

Function (job title) never sets the resource rate; **resource class** does (`docs/POC-RESOURCE-VS-FUNCTION.md`, `docs/B0-EMISSION-POLICY.md`).

**LAB:** meters and quality proofs are partial; treat mint outside verified PoC as non-transit lab units only.

---

## 10. Service receipt (DePIN / services)

Target lease path:

```
request → offer → selection → lease → allocation → execution
  → measurement → Receipt → settlement → optional burn
```

```
Receipt {
  provider:    string
  consumer:    string
  resource:    string
  quantity:    number
  duration:    string
  quality:     object | null
  result_hash: string | null
  signature_provider: string
  signature_consumer: string | null
}
```

Leases escrow and settle in STRATA; **leases do not mint**.

---

## 11. STRATA NFT (object economy)

```
STRATA NFT =
  NonFungibleObject
  + FractionalEconomicOwnership
  + Collateral
  + (Optional) StateMachine
  + Actions
  + (Optional) Bundle
```

`Agent = User | SCA` owns/operates NFTs.

**SPA/APS** = specialized STRATA NFT kind:

| Phase | Mode | Rule |
|-------|------|------|
| Template | `static` | Mint with collateral floor |
| Execution | `dynamic` | execute / pause |
| End | terminated / suspended_static | complete or collateral exhaustion |

Endpoints (live token worker family): ontology, bundle attach/detach, liquidate propose/vote, redeem, spa mint/execute/complete.

Majority liquidation and bundle composition remain lab surfaces; do not run majority liquidation on live Fog NFTs without explicit operator intent.

---

## 12. Identity and clearance (wire)

### 12.1 Session

```
Authorization: Bearer <session_token>
```

Clearance is an **account attribute** (`users.clearance_level`), not a client-chosen menu.

| Effective level | read | edit | run |
|-----------------|------|------|-----|
| public | ✓ | | |
| internal | ✓ | | |
| confidential | ✓ | ✓ | |
| secret | ✓ | ✓ | |
| top_secret | ✓ | ✓ | ✓ |

Anonymous → public only. `body.clearance` / `X-Clearance` MUST NOT elevate above the account.

### 12.2 KYC privacy (normative policy)

Raw identity documents MUST NOT be written to the ledger.

```
KYC provider → verification result → signed attestation
  → identity_commitment = H(sovereign_identifier || salt)
  → { verified, issuer, verification_epoch }
```

Ledger stores minimal claims, not passport/MRZ/full legal name images.

### 12.3 Fog vs account

Portal **Conta** = signed-in agent. **Contexto** = hosting Fog node id. The Fog node is host/treasury; it is not listed as the user account.

---

## 13. Content vs consensus (IPFS)

| Property | System |
|----------|--------|
| Ledger integrity | DAG transaction committed |
| Content availability | IPFS / pin / R2 retrieval |

`cid` on a transaction commits **reference**, not availability. Unavailable CID is a storage fault, not automatic consensus failure. Pinning, GC, and retention policies are operational, not tip-selection rules.

---

## 14. Observability (minimum)

| Path | Role |
|------|------|
| `/health` | Liveness |
| `/status` | Aggregated lab pulse (monetary, upstream, holons) |
| `/metrics` | **Target** — Prometheus-style (dag depth, tips, gossip latency, emission, burn) |

Consensus-critical transitions MUST remain deterministic and auditable. ML/orchestrator output MAY recommend; it MUST NOT silently rewrite ledger rules.

---

## 15. Explicit non-claims (v1)

1. Lab confidence ≠ production finality.  
2. Virtual voting lab thresholds ≠ Hedera aBFT.  
3. Tip bias heuristics ≠ proven MCMC security.  
4. PQ placeholders ≠ post-quantum security.  
5. Lab bootstrap STRATA ≠ transit-eligible mainnet float.  
6. Single-node Workers demo ≠ multi-operator mesh.

---

## 16. Canonical code map (informative)

| Concern | Primary lab locations |
|---------|----------------------|
| Tip selection | `src/tip_selection.py` |
| Finality confidence | `src/finality.py`, `src/finality_modules.py` |
| Gossip inventory | `src/gossip.py` |
| Persistent DAG | `src/persistent_dag.py` |
| Multi-node sim | `src/multi_node_sim.py` |
| Gossip worker | `workers/stratamesh-gossip.js` |
| Consensus worker | `workers/stratamesh-consensus.js` |
| DAG worker | `workers/stratamesh-dag.js` |
| PoC / emission | `workers/stratamesh-poc.js`, `docs/B0-EMISSION-POLICY.md` |
| Token / poles | `workers/stratamesh-token.js` |
| Holonic + CLP | `shared/holonic-clp.js`, `docs/HOLONIC-LAYERS.md` |

Experimental or versioned duplicates (`tip_selection_v0.1.py`, skeletons) are non-canonical until promoted.

---

## 17. Change control

1. Breaking wire changes increment `protocol_version`.  
2. Algorithm changes increment `tip_algorithm` / `emission_policy` without silent reinterpretation of old data.  
3. Lab resets MUST be announced; testnet/mainnet forbid silent history rewrites.

**Document version:** WIRE-PROTOCOL-v1 · 2026-08-23 · LAB  
**Node:** FOG-NODE-PT-CM-001
