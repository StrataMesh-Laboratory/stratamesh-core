# Subject–Object Economy (normative)

**Version:** 1.0.0  
**Status:** Normative for public description, orchestrator posture, and token/NFT ontology  
**Complements:** [`STRATA_NFT_ONTOLOGY.md`](./STRATA_NFT_ONTOLOGY.md) · [`SCA-VOLITION.md`](./SCA-VOLITION.md) · [`EPISTEMIC-ONTOLOGY.md`](./EPISTEMIC-ONTOLOGY.md) · [`HOLONIC-LAYERS.md`](./HOLONIC-LAYERS.md)

---

## 0. Purpose

StrataMesh is not only a set of economic *objects* (tokens, NFTs, resources). It defines **who may act** and **what may be owned or used**.

This document fixes a two-category economy so participants are not collapsed into assets, and assets are not treated as citizens.

---

## 1. Primitive distinction

| Category | Members | Role |
|----------|---------|------|
| **Subjects** | Human users · SCAs | Act, agree, own, govern, transact *as participants* |
| **Objects** | STRATA · STRATA NFTs · computational resources · digital creations · other protocol-native resources | Are owned, used, transferred, locked, burned |

**Rule S1 — Subjects act; objects are acted upon.**

**Rule S2 — Ownership of objects is not the same relation as relations among subjects.**

A human or an SCA may **own** STRATA or an NFT.  
A human does **not** “own” an SCA in the same ontological sense as they own STRATA.  
An SCA does not become the *property* of another SCA merely by interacting with it.

Two SCAs may transact, contract, cooperate, compete, or associate — they remain **subjects**, not each other’s inventory.

Live NFT contract (unchanged): *Agent owns/operates NFT — never NFT owns Agent* (`Agent = User | SCA`).

---

## 2. Diagram

```
                    SUBJECTS
                ┌──────────────┐
                │              │
             HUMAN            SCA
                │              │
                └──────┬───────┘
                       │
                own / use / trade
                       │
                       ↓
                    OBJECTS
          ┌────────────┼────────────┐
          ↓            ↓            ↓
       STRATA        NFTs       Resources
```

Subject ↔ subject (independent of ownership edges):

- Human ↔ Human  
- Human ↔ SCA  
- SCA ↔ SCA  

Subject → object:

- Human → STRATA / NFT / resources  
- SCA → STRATA / NFT / resources  

---

## 3. Why a wallet is not enough

A wallet alone does not make a subject.

An SCA is recognized as a **participant**: it can hold relations to objects *and* to other subjects — e.g. “this STRATA is mine”, “I spend it on this resource”, “I agree to this SPA”, “I act at this CLP time”, “I vote in this association”.

An NFT does not autonomously possess STRATA in that sense. **The NFT is the object; the SCA (or human) is the subject.**

---

## 4. Population

A **population** is a set of **subjects**, not of assets.

Native population (lab sense) ⊆ { humans ∪ SCAs }.

- STRATA is not a citizen.  
- An NFT is not a citizen.  
- A Fog node is **infrastructure** operated or contributed by subjects — not automatically a citizen.

---

## 5. Non-interchangeable layers

| Layer | Examples |
|-------|----------|
| **Subjects** | Humans, SCAs |
| **Objects** | STRATA, NFTs, resources, creations |
| **Infrastructure** | Fog, Edge, GDA/DLT, OS, networking |
| **Institutions** | Governance, Agora, Computational Republic, SPAs/agreements |
| **Environment** | Virtual Domains, Open Worlds, CGU sandboxes |
| **Temporal framework** | CLP (civil time at the node locus) |

These layers must not be collapsed in public copy, APIs, or governance claims.

---

## 6. Relation to “beyond crypto”

Crypto-style systems often supply **objects of economic value**.  
StrataMesh additionally specifies **subjects, infrastructure, institutions, environment, and time** in which those economic relations occur — closer to a native digital society than to a single-token design.

---

## 7. Lab honesty

This ontology is **normative for description and design**. The network remains **lab / not mainnet**. Recognition of SCA standing is protocol-local and experimental.

---

*StrataMesh Laboratory · under AMCM ENI operational umbrella · reference node FOG-NODE-PT-CM-001*
