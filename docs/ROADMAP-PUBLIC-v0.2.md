# StrataMesh DLT — Public Roadmap v0.2

**Fog Node:** Calhegas Morais (`FOG-NODE-PT-CM-001`)  
**Location:** 38.7169° N, 9.1427° W — Lisbon, Portugal  
**Domain:** [calhegasmorais.pt](https://calhegasmorais.pt/)  
**Core repo:** [StrataMesh-Laboratory/stratamesh-core](https://github.com/StrataMesh-Laboratory/stratamesh-core)  
**Lab release:** [v0.2.1-lab](https://github.com/StrataMesh-Laboratory/stratamesh-core/releases/tag/v0.2.1-lab) (2026-08-10; supersedes v0.2.0-lab)  
**Motto:** *Intelligentia · Vigilantia · Veritas*

---

> **Superseded for promotion control law** by [ROADMAP-PUBLIC-v0.3.md](./ROADMAP-PUBLIC-v0.3.md) (2026-08-23).  
> v0.2 remains historical: parallel Track A ∥ Track B after lab freeze. In-process “done” ≠ multi-host production.

---

## 1. Vision (from whitepaper)

StrataMesh is a next-generation distributed ledger that combines:

| Pillar | Whitepaper intent |
|--------|-------------------|
| **DAG core** | High-throughput, parallel transactions; open-source tip selection; lightweight txs for IoT / micro-payments |
| **IPFS linkage** | Content-addressed payloads and metadata; durable, censorship-resistant data plane |
| **Fog / Edge hierarchy** | Tiered participation under on-graph **Service Provision Agreements (SPAs)** with opt-out / contingency |
| **Proof of Contribution** | Nodes earn base token (STRATA) for useful work (validate, pin, serve) |
| **Strata Agora** | DEX / listing venue for contribution tokens and service markets |
| **Meta-protocol** | Application- and DAO-defined finality modules on top of probabilistic DAG confidence |
| **ACBs + Proof of Subsistence** | Autonomous agents that must remain solvent relative to resources they consume |
| **Post-quantum path** | Phased adoption of lattice / code-based cryptography |
| **Open core** | Lean, auditable protocols; community refinement and formal verification over time |

Epistemic stance (normative for this node): **function and agreement before substrate** — ACBs and operators are peers under SPA/DAO rules (`docs/EPISTEMIC-ONTOLOGY.md`).

---

## 2. Honesty check — where we are (v0.2.0-lab)

Lab code exercises the full whitepaper *path* **in-process**. That is not the same as a production mesh.

| Pillar | Lab (v0.2.0-lab) | Production gap |
|--------|------------------|----------------|
| DAG + tip selection | Runnable; SQLite persistent node; gossip testnet | Multi-host peers, formal verification, sustained throughput metrics |
| IPFS | Client: stub / Kubo API / gateway | Always-on Kubo (or equivalent) under SPA **pinner** role |
| SPA | On-graph register + pinner policy flags | Multi-operator SPAs, opt-out execution, compliance telemetry |
| Finality | Probabilistic tip confidence scores | Optional deterministic modules (DAO-certified meta-protocol) |
| PoC → STRATA | Mint from contribution ledger; on-graph mint txs | Emission schedule, caps, public audit, legal clarity |
| Agora | Order book + STRATA settlement | Dual-asset markets, durable matching, dispute rules |
| NFT / UGC | CID registry + sandbox → optional NFT | Persistent media resolution, rights, discovery |
| Governance | Proposals + weighted votes (2-voter lab quorum) | Binding SPA/DAO constitutions, vote weight from stake/contribution |
| ACB + PoSbs | Registry, heartbeat → pressure states | Real resource meters, migration across hosts |
| PQ | **Placeholders only** | liboqs / hardware / production key lifecycle |
| Orchestrator | Hybrid probabilistic + symbolic + QIGA scaffold | Federated learning over live node fleet |
| Public surface | Status Worker, landing, portal routes | Continuous Fog process, WAF-stable public APIs |

**Public pulse today:**  
https://stratamesh-status.stratamesh.workers.dev/status · https://stratamesh-status.stratamesh.workers.dev/live

---

## 3. Roadmap architecture (refined)

Two tracks run in parallel after the lab freeze:

```
Track A — Mesh reality          Track B — Protocol depth
(always-on, multi-node)         (economics, finality, PQ, ACBs)
        \                         /
         \                       /
          v                     v
     Shared public metrics + SPA network effects
```

### Track A — Mesh reality (priority)

| Stage | Name | Outcomes | Exit criteria |
|-------|------|----------|---------------|
| **A0** | Single-host production | Continuous `node_persistent` + `publish_loop` on a stable host; Kubo optional | Public `/status` reflects uptime hours, not snapshot-only |
| **A1** | Private multi-node | ≥3 hosts gossiping; shared tip set growth | Cross-host INV/TX sync sustained ≥24h |
| **A2** | SPA network | ≥2 independent operators under SPA; pinner role on real IPFS | Active SPA count ≥2; pin success rate reported |
| **A3** | Public testnet | Open join docs; faucet or invite; explorer fields | External node count >0 on public metrics |

### Track B — Protocol depth

| Stage | Name | Outcomes | Exit criteria |
|-------|------|----------|---------------|
| **B0** | Emission & audit | PoC → STRATA rules documented; mint events queryable | Written emission policy + reproducible lab audit script |
| **B1** | Agora v1 | Dual-asset (STRATA ↔ service credit); balance locks on order | No underfunded fills; trade history on-graph |
| **B2** | Meta-finality | Pluggable deterministic finality module (optional) | Module interface + one reference implementation |
| **B3** | ACB economy | PoSbs meters from real CPU/mem; hibernate/migrate hooks | ACB can hibernate and resume under policy |
| **B4** | PQ v1 | Real Kyber/Dilithium (or chosen suite) for node identity | External audit checklist started; lab placeholders retired for identity |

### Cross-cutting

| Workstream | Content |
|------------|---------|
| **Orchestrator** | Federated summaries from live nodes; QIGA-tuned tip/pin policies under symbolic SPA constraints |
| **Security** | WAF/tuning for calhegasmorais.pt; auth recovery hardened; no debug auth paths |
| **Formalism** | Tip-selection properties → tests → eventual formal spec |
| **Portal** | Wallet / SPA / status widgets backed by live APIs (not only D1 static HTML) |

---

## 4. Phase mapping (whitepaper language ↔ execution)

Legacy phase numbers remain for continuity with v0.1 docs and status payloads:

| Phase | Whitepaper theme | Lab | Next production focus |
|-------|------------------|-----|------------------------|
| **0** | Operational baseline | **Done** | Maintain public roadmap & status |
| **1** | Core DAG + IPFS linkage | **Lab done** | A0–A1, real Kubo |
| **2** | Nodal hierarchy & SPAs | **Scaffold done** | A2 multi-operator SPAs |
| **3** | Tokenomics & Agora | **Lab done** | B0–B1 emission + dual-asset Agora |
| **4** | Application primitives | **Lab done** | Persistent NFT/UGC discovery |
| **5** | Governance & finality modules | **Gov lab; finality partial** | B2 meta-finality modules |
| **6** | ACBs | **Lab done** | B3 real meters & migration |
| **7** | Post-quantum & heterogeneous nodes | **Hooks only** | B4 real PQ; exotic node readiness later |

---

## 5. Near-term plan (recommended sequence)

**Horizon 1 — Mesh foundations (next)**  
1. Deploy always-on Fog process (A0) with `publish_loop` → public status *(tooling landed: systemd units, docker-compose, healthcheck — host still operator-provided)*  
2. Attach Kubo; set SPA pinner role to **strict api mode**  
3. Stand up second/third private nodes; document join procedure (A1)

**Horizon 2 — Network effects** *(A3 join draft + B0 emission policy landed in-repo)*  
4. Second operator SPA (A2)  
5. Emission policy doc + mint audit script (B0)  
6. Portal panels: live `/status`, `/token`, `/spa` (not static only)

**Horizon 3 — Protocol maturity**  
7. Agora dual-asset + locks (B1)  
8. Finality module interface (B2)  
9. ACB real resource coupling (B3)  
10. PQ identity pilot (B4)

---

## 6. Success metrics (public)

Unchanged in spirit from v0.1; now tied to measurable lab→prod signals:

| Metric | Lab signal today | Production target |
|--------|------------------|-------------------|
| Fog / Edge node count | 1 logical reference | ≥3 private, then public testnet >0 external |
| Tx throughput / lightweight ratio | mesh_doctor / local | Sustained rates on multi-node |
| Finality confidence | Tip scores exported | Confidence distribution on explorer |
| Active SPAs / value under agreement | 1 lab SPA | ≥2 independent operators |
| STRATA emission / Agora volume | Lab mint + book | Policy-bound emission; non-zero settled volume |
| NFT / UGC resolvable CIDs | Registry + stub pins | Gateway-resolvable under pinner SPA |
| ACB population / subsistence | Registry + heartbeats | Solvent ratio over time |
| Status uptime | Snapshot / Worker | Continuous host hours |

---

## 7. Non-goals (this revision)

- Claiming mainnet or regulated token launch  
- Treating PQ placeholders as cryptographic security  
- Centralizing raw private payloads for “better learning”  
- Replacing SPA/DAO consent with Orchestrator unilateral action  

---

## 9. Lab track completion (v0.2.1-lab)

| Track | Status |
|-------|--------|
| A0 always-on tooling | **done** (systemd / compose / healthcheck) |
| A1 multi-node tx sync | **done** (0% spread in lab) |
| A2 multi-operator SPA | **done** |
| A3 public join draft | **done** (doc) |
| B0 emission + audit | **done** |
| B1 dual-asset Agora | **done** (STRATA ↔ SVC) |
| B2 meta-finality modules | **done** |
| B3 ACB resource meters | **done** |
| B4 PQ pilot hooks | **lab only** (not real PQ) |
| SPA opt-out | **lab** (immediate deactivate; grace TBD) |

Production host + external peers remain operator actions.

**Recommended zero-cost host path:** Oracle Always Free VM + Cloudflare Tunnel + OSS middleware — see `docs/HYBRID-ORACLE-CF-TUNNEL.md`.

## 8. Document control

| Version | Date | Notes |
|---------|------|--------|
| v0.1 | 2026-08 | Initial public roadmap (Phase 0 active) |
| **v0.2** | **2026-08-10** | Post **v0.2.0-lab**: whitepaper alignment, lab vs prod split, Track A/B |

Maintained by the Orchestrator under the Calhegas Morais Fog Node.  
Next revision: close of **A0** (always-on status) or first external SPA.

**UNCLASSIFIED // FOG-NODE-PT-CM-001**  
© 2026 Calhegas Morais · StrataMesh DLT
