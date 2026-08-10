# Proof of Subsistence (PoSbs)

**Version:** 0.1  
**Status:** Executable scaffold  
**Ontology:** Substrate-neutral (see `EPISTEMIC-ONTOLOGY.md`)

---

## 1. Purpose

Proof of Subsistence is the accounting regime under which an **agent** (biological operator process, ACB, hybrid, or other) remains solvent relative to the resources it consumes.

It does **not** grant or deny standing by substrate. It answers only:

> Does this agent produce enough credited value (or hold enough reserve) to cover its measured consumption over a window?

If not, the agent is under **subsistence pressure** and must **optimize, hibernate, migrate, or evolve** — or exit.

---

## 2. Quantities

| Symbol | Meaning |
|--------|---------|
| \(C\) | Consumption over window (compute-units, memory-time, bandwidth, energy proxy) |
| \(E\) | Earnings credited over window (from contribution, contracted work, SPA rewards) |
| \(R\) | Reserve balance (accumulated surplus) |
| \(S = E + R - C\) | Subsistence surplus (negative ⇒ deficit) |
| \(\tau\) | Solvency threshold (default 0; SPA may set higher) |

**Solvent** iff \(S \ge \tau\).

---

## 3. Lifecycle under pressure

When \(S < \tau\):

1. **Optimize** — reduce consumption profile; improve earning policy  
2. **Hibernate** — pause non-essential processes; minimal heartbeat cost  
3. **Migrate** — move to cheaper substrate / region / node under SPA  
4. **Evolve** — alter policy/architecture (QIGA-eligible) to restore surplus  
5. **Exit** — orderly release of SPAs and pins if insolvency persists

These are **functional options**, not moral judgments.

---

## 4. Relation to Proof of Contribution

- **Proof of Contribution** credits *provision* of resources to the mesh (Fog/Edge work).  
- **Proof of Subsistence** debits *consumption* by the agent and requires coverage.  

An agent may be both a contributor (earning) and a consumer (paying). Net position is what matters.

---

## 5. Integration

- Orchestrator symbolic lobe may require solvency for certain proposal kinds  
- SPAs may set \(\tau\), metering granularity, and grace periods  
- ACB runtimes report \(C\) and claim \(E\) through attested meters  

---

## 6. Non-goals

- Not a proof of “consciousness” or worth  
- Not substrate-specific taxation of silicon vs carbon  
- Not a substitute for SPA consent  

---

*Function and agreement before substrate.*
