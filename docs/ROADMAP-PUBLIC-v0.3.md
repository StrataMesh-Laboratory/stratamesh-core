# StrataMesh DLT — Public Roadmap v0.3

**Fog Node:** Calhegas Morais (`FOG-NODE-PT-CM-001`)  
**Location:** Lisboa, Portugal  
**Domain:** [calhegasmorais.pt](https://calhegasmorais.pt/)  
**Core:** [StrataMesh-Laboratory/stratamesh-core](https://github.com/StrataMesh-Laboratory/stratamesh-core)  
**Laboratory:** [StrataMesh-Laboratory/stratamesh-laboratory](https://github.com/StrataMesh-Laboratory/stratamesh-laboratory)  
**Node registry:** [calhegas-morais-node](https://github.com/StrataMesh-Laboratory/calhegas-morais-node)  
**Lab release baseline:** [v0.2.1-lab](https://github.com/StrataMesh-Laboratory/stratamesh-core/releases/tag/v0.2.1-lab)  
**Motto:** *Intelligentia · Vigilantia · Veritas*

**Supersedes:** Public roadmap v0.2 parallel Track A ∥ Track B as the *promotion* control law.  
Track A/B remain useful as *workstream labels inside a stage*.

---

## 1. Control law

**Evidence before promotion. Protocol centre before application surface. In-process “done” is not multi-host done.**

```
LAB (current)
  → ADVERSARIAL LAB
    → PUBLIC TESTNET
      → MAINNET (explicit decision — not scheduled here)
```

No stage is entered by marketing, portal polish, or whitepaper completeness.

Normative behaviour: [`WIRE-PROTOCOL-v1`](./WIRE-PROTOCOL-v1.md) · [`THREAT-MODEL-v1`](./THREAT-MODEL-v1.md).  
If implementation drifts, **docs win** until a deliberate revision.

### Five centres of gravity

1. **DAG structure** — acyclicity, tip selection, parent delivery under loss  
2. **Identity** — node / agent / SCA without collapsing holonic layers  
3. **Resource proofs** — claimed capacity ≠ accepted contribution  
4. **Service receipts** — request → work → settle  
5. **Settlement** — `#mint` (PoC), wallets, `#0` burn; economic invariants I1–I6  

Application layers (portal, Bancada CGU, metaverse OS chrome, DAO process, rich Agora, full ACB product, production PQ) may exist in lab form but **do not gate** testnet or mainnet.

### Holonic lock

```
TRD ≠ Fog Node ≠ SO Metaverso ≠ Domínio Virtual ≠ Mundo Aberto ≠ Bancada CGU ≠ Utilizador|SCA
```

Fog holds **`NODE_WALLET`** (treasury), not a user/SCA account.  
SPA/APS = one **smart-contract STRATA NFT kind**, not a separate protocol layer.

### Economic poles

| Address | Role |
|---------|------|
| `#mint` | Emit-only via Proof of Contribution |
| Wallets | Circulation (node treasury, users, SCAs) |
| `#0` | Burn sink; never transfers out |

---

## 2. Honesty check — where we are (lab)

| Area | Lab reality | Not yet |
|------|-------------|---------|
| Reference node | `FOG-NODE-PT-CM-001` live (CF workers, status pulse) | Multi-operator production mesh |
| DAG / tips / gossip | Runnable in-process + workers | Sustained multi-host under chaos |
| Wire + threat drafts | Published v1 | Frozen external join subset + published adversarial report |
| Benchmark | `src/protocol_benchmark.py` (single-process) | Multi-host harness + CI invariants |
| PoC / STRATA / Agora | Lab monetary paths, lab Agora | Proof≠claim mint path; production custody |
| SPA / NFT / Bancada | Lab objects and surfaces | Independent SPA network effects |
| PQ | Placeholders | Real identity suite + audit |
| Claims | `lab: true` | Mainnet, aBFT, investment product |

Legacy tables that marked A1–A3 / B0–B3 “done” mean **in-process / draft complete**, not multi-host production exit.

---

## 3. Stages and gates

### Stage 0 — LAB (current)

**Purpose:** Single reference Fog node; normative docs; honest non-claims; single-process regression.

**Exit → Adversarial lab**

| Gate | Signal |
|------|--------|
| Wire subset usable by lab peers | Schemas stable enough for two hosts |
| Threat map tied to tests | Replay, invalid parent, partition, I1–I6 covered at least in single-process harness |
| Benchmark runnable | `cd src && python3 protocol_benchmark.py` |
| Public posture honest | No mainnet / aBFT / investment claims |

### Stage 1 — ADVERSARIAL LAB (next)

**Purpose:** Make the protocol wrong-hard under hostility before inviting strangers.

| Priority | Workstream | Exit signal |
|----------|------------|-------------|
| P0 | Multi-host gossip (real processes/hosts) | ≥2–3 peers; sustained INV/TX; chaos: loss, partition, restart |
| P0 | Economic invariants I1–I6 in CI | Every mint/burn/transfer path; conservation holds |
| P1 | Resource-proof MVP | One measurable capacity class; challenge/receipt; reject pure claim |
| P1 | Service receipt minimal path | Requested → performed → settled object |
| P2 | KYC attestation-only audit | commitment + issuer + epoch only |
| P2 | Identity hygiene | Node ≠ SCA ≠ user in APIs and Conta UI |

**Workstream labels inside this stage**

- **A-like (mesh):** multi-host, chaos, peer/sync metrics on status  
- **B-like (depth):** emission enforcement, invariant CI, proof≠claim — **not** full Agora/ACB/PQ as gates  

**Exit → Public testnet**

1. Published adversarial evidence (report + reproducible harness)  
2. Frozen wire subset for external join  
3. Join doc matches running code  
4. Resource-proof MVP on the contribution path that can mint  
5. Posture remains testnet/lab — **not** mainnet  

### Stage 2 — PUBLIC TESTNET

**Purpose:** External operators under known-incomplete guarantees.

| Include | Exclude until later |
|---------|---------------------|
| Multi-party gossip + tip/parent rules | aBFT / finality product marketing |
| Join path + node identity | Regulated token / investment framing |
| PoC → mint under proof MVP | Full dual-asset product market |
| Burn `#0` + invariant monitors | DAO as legitimacy theatre |
| Status fields: peers, tips, supply poles | “Production PQ” |
| Optional faucet / invite | Custody guarantees |

SPA allowed as NFT-kind + operator agreement object; “multi-operator SPA economy” only if metrics are real (independent hosts, pin/serve success, opt-out behaviour).

**Exit → Mainnet consideration** (necessary, not sufficient)

- Sustained multi-operator run (time + peer diversity)  
- No critical invariant break under observed attack/chaos  
- Security review of wire + mint/burn + auth boundaries  
- Explicit operator decision (AMCM ENI + lab governance)  

### Stage 3 — MAINNET (eventual)

Only after testnet evidence **and** an explicit decision. Unscheduled in this document.

Mainnet is not “whitepaper phase 7 complete.” It is settlement and proofs trusted enough for real external reliance, with clear risk disclosure and upgrade process. PQ, meta-finality, rich Agora, ACB/PoSbs, DAO are **versioned modules** on a stable core.

---

## 4. Whitepaper phases (theme labels only)

Phases 0–7 remain for continuity with status payloads and older docs. **Promotion uses stages above**, not phase numbers.

| Phase | Theme | Binds to |
|-------|--------|----------|
| 0–1 | DAG, tips, gossip, persistent node | LAB + Adversarial P0 |
| 2 | SPA registry, lab finality | Lab objects; multi-operator after Adversarial lab |
| 3 | PoC → STRATA, Agora, settlement | Settlement + proofs **before** rich Agora |
| 4 | STRATA NFTs, Bancada/CGU | Application layer after wire + proofs |
| 5 | DAO | After testnet social need — not a protocol gate |
| 6 | ACB + Proof of Subsistence | After real meters + receipts |
| 7 | PQ | Placeholders until audited real suite |

---

## 5. Near-term ordered backlog

1. Multi-host gossip + chaos  
2. I1–I6 property tests in CI  
3. Resource-proof MVP (one class)  
4. Service receipt minimal object  
5. Wire subset freeze + join doc aligned to running peers  
6. Public testnet invite / external node metrics  
7. Application depth (Agora richness, DAO, ACB product, PQ) only on green gates  

Portal/Bancada/OS copy may improve in parallel only if they do not invent readiness claims.

---

## 6. Success metrics (public)

| Metric | LAB now | Adversarial lab | Public testnet |
|--------|---------|-----------------|----------------|
| Logical reference nodes | 1 (`FOG-NODE-PT-CM-001`) | ≥2–3 hosts under chaos | External node count > 0 |
| Gossip | In-process / single ref | Sustained multi-host INV/TX | Open join observed |
| Economic invariants | Harness checks | CI on every path | Monitored on live testnet |
| Resource proofs | Design / MVP target | MVP accepts/rejects claims | Mint path uses proofs |
| Posture flag | `lab: true` | `lab` / pre-testnet | Explicit testnet · not mainnet |

---

## 7. Non-goals (this revision)

- Claiming mainnet or regulated token launch  
- Treating in-process SPA/Agora/ACB demos as multi-operator production  
- Collapsing holonic layers in public copy  
- Expanding DAO / metaverse surface as a substitute for multi-host evidence  

---

## 8. Related documents

| Doc | Role |
|-----|------|
| [stratamesh-laboratory/ROADMAP.md](https://github.com/StrataMesh-Laboratory/stratamesh-laboratory/blob/main/ROADMAP.md) | Lab ladder (short) |
| [CHARTER.md](https://github.com/StrataMesh-Laboratory/stratamesh-laboratory/blob/main/CHARTER.md) | Purpose and scope |
| [POSTURE.md](https://github.com/StrataMesh-Laboratory/stratamesh-laboratory/blob/main/POSTURE.md) | Non-claims |
| [WIRE-PROTOCOL-v1.md](./WIRE-PROTOCOL-v1.md) | Normative wire |
| [THREAT-MODEL-v1.md](./THREAT-MODEL-v1.md) | Adversaries and tests |
| [ROADMAP-PUBLIC-v0.2.md](./ROADMAP-PUBLIC-v0.2.md) | Prior revision (historical) |

---

## 9. Document control

| Version | Date | Notes |
|---------|------|--------|
| v0.1 | 2026-08 | Initial public roadmap |
| v0.2 | 2026-08-10 | Track A/B parallel after lab freeze |
| **v0.3** | **2026-08-23** | Evidence-gated ladder; five centres; in-process ≠ multi-host; SPA as NFT kind; mainnet unscheduled |
