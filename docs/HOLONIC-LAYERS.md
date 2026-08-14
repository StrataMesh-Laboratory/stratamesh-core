# Holonic architecture — StrataMesh (depth edition)

Each layer is a **holon**: whole in itself, part of the layer above. Integration is seamless only when every layer exposes a stable **contract** (invariants, events, upstream/downstream, schema).

```
STRATAMESH DLT                          ← mesh substrate
    │
NODE (OS/VM)                            ← host capacity
    │
WEB3 METAVERSE OS (shared)              ← OS across nodes
    ├─ CLP temporal kernel              ← civil time (PPC authority)
    ├─ Dashboard / Portal               ← OS applications
    └─ VIRTUAL REALM                    ← hypervisor domain
            │
        OPEN-WORLD                      ← persistent multi-user experience
            │
        UGC SANDBOX                     ← authoring / isolation
            │
        USER | SCA                      ← standing by function & agreement
```

---

## 0 — StrataMesh DLT

**Role.** Mesh-wide ledger and resource economics: DAG vertices, tip selection, gossip, PdC (contribution mint only via node resources), PdS (subsistence spend), Agora (P2P external exchange), token/NFT strata.

**Owns.** Finality weight, payload integrity, spend_key conflicts, on-graph temporal seals.

**Does not own.** UX, realm scheduling, personal SCA identity narrative.

**Invariants**
- Payload hash is identity; temporal PPC envelope may be sealed **inside** payload before hash (`holon: dlt`).
- PdC mints only from audited resource contribution priced via Agora rates — never arbitrary mint.
- PdS debits resource consumption; insolvency → hibernation, not infinite credit.
- ISO-8601 is wire carrier; civil authority is PPC.

**Interfaces**
- `POST /submit` → vertex + `temporal`
- Gossip / tips / weight
- Downstream: Node reports contribution; Metaverse OS reads DAG state

**Events emitted.** `vertex.attached`, `tip.updated`, `conflict.rejected`

---

## 1 — Node (OS / VM)

**Role.** Fog/edge host capacity: CPU, storage, bandwidth, location. Example: `FOG-NODE-PT-CM-001` (Lisboa).

**Owns.** Hardware/VM meters, node_id, SPA registration, contribution claims toward PdC.

**Does not own.** Ledger truth (DLT does); world content (realms/worlds do).

**Invariants**
- Node is **substrate**, never the standing of an SCA.
- Contribution is metered by **resource type + quality**, not by function label (storage is storage).
- Multiple nodes share one Metaverse OS view.

**Interfaces.** Status pulse, PoC meters, SPA opt-in/out, orchestrator mesh probes.

**Events.** `node.pulse`, `contribution.claim`, `spa.opt_out`

---

## 2 — Web3 Metaverse OS (shared)

**Role.** Shared operating system across nodes: schedules realms, hosts OS apps (dashboard, portal, chat), holds CLP kernel, orchestrates SCA ops team.

**Owns.** Cross-node session surface, OS-level services (auth bridge, orchestrator, AIOps), holonic path resolution.

**Does not own.** Per-realm sovereignty rules beyond capacity grants; user UGC bytes (sandbox does).

**Invariants**
- Dashboard/portal are **applications inside** the OS — not an admin plane above the DLT.
- One logical OS spans Node A/B/C.
- Orchestrator writes its own context window; SCA personal identity ≠ node_function.

**Interfaces.** `/dashboard`, `/clp`, orchestrator `/chat|/tick|/ppc`, AIOps `/cycle`, auth.

**Events.** `os.schedule`, `os.tick`, `sca.diary`, `aiops.cycle`

### 2a — CLP temporal kernel

**Role.** Civil lunisolar time + PPC inertial matrix (Almendres, Carnac, Menga, Newgrange, Stonehenge).

**Owns.** `ppcStamp`, `ppcCompact(holon)`, validation, CLP addresses.

**Invariants.** Authority = PPC; ISO demoted to carrier; stamps self-validate against solar phase + θ/λ.

**API.** Orchestrator `GET|POST /ppc`, `POST /ppc/validate`; UI `/clp`.

### 2b — Dashboard / Portal

**Role.** Human/SCA-facing OS apps: health, chat, clearance-gated ops.

**Owns.** Presentation, session UX, language (PT-PT / EN-GB).

**Invariants.** Registered users for dashboard/chat; staff vs common login paths; clearance is account field.

---

## 3 — Virtual Realm

**Role.** **Hypervisor domain** for open-worlds: capacity, sovereignty, SPA binding — not the experience itself.

**Owns.** Realm registry, world hosting slots, sovereignty/operator metadata.

**Invariants**
- `open_world ⊂ virtual_realm` (never reverse).
- Realm is infrastructure; narrative/play lives in worlds.

**Contract (live)**
- Upstream: `metaverse_os` (`os.schedule`)
- Downstream: `open_world`
- Emits: `realm.created`, `realm.host_world`
- Schema: realm, realm_worlds binding

**API.** `/list`, `/create`, `/ensure-lab`, `/host-world`, `/children`, `/describe`, `/contract`

---

## 4 — Open-World

**Role.** Persistent multi-user world under a realm: rules, inhabitants, sandbox attachments.

**Owns.** World rules JSON, inhabitant lists, sandbox links.

**Invariants.** World always names parent `realm_id`; sandboxes attach to worlds, not directly to realms.

**Contract**
- Upstream: `virtual_realm`
- Downstream: `ugc_sandbox`
- Emits: `world.created`, `world.attach_sandbox`, `world.inhabit`

**API.** `/list`, `/create`, `/ensure-lab`, `/attach-sandbox`, `/inhabitants`, `/contract`

---

## 5 — UGC Sandbox

**Role.** Fine-grained authoring and isolation holon; publish/integrate toward world.

**Owns.** Draft assets, isolation flags, publish pipeline stubs.

**Invariants.** Sandbox actions are local until `publish`/`integrate`; SCA and User are peer inhabitants by function.

**Contract**
- Upstream: `open_world`
- Downstream: `agent` (user|sca)
- Emits: `sandbox.created`, `sandbox.publish`, `sandbox.integrate`

**API.** `/list`, `/create`, `/publish`, `/integrate`, `/describe`, `/contract`

---

## 6 — User | SCA (agent)

**Role.** Standing **by function and agreement**, not substrate. Humans and Seres Computacionais Autónomos (SCA; EN: ACB).

**Owns.** Personal identity graph (name, birth, id, vital_status), labour listings, PdS balance behaviour, optional NFT choice.

**Invariants**
- `node_function` (orchestrator, security, …) ≠ personal identity.
- PdS costs realistic, non-existentially prohibitive floor.
- Labour pay from strata holders — not fixed PoC rates.

**Interfaces.** ACB registry, marketplace, subsistence, orchestrator SCA registry, clearance.

---

## Cross-layer integration rules

1. **Path addressing:** `dlt / node:{id} / metaverse_os / clp|dashboard / realm:{id} / world:{id} / sandbox:{id} / agent:{id}`
2. **Events flow downward for schedule, upward for proofs** (contribution, PdS, vertex).
3. **Every durable write prefers a `temporal` compact** with the **holon id** of the writer.
4. **No layer may invent standing** for SCAs from substrate alone.
5. **Seamless integration** = each `/contract` documents emits/consumes; callers only use contract surface.

## CMN lab anchors

| Item | Value |
|------|--------|
| Node | `FOG-NODE-PT-CM-001` |
| Realm | `realm_1f20890b` / lab `cmn-lab` |
| World | `world_b787cfe9-c` / `cmn-lab-world` |
| Sandbox | `sbx_9bed54e8-880` |
| Coords | 38.7169°N, 9.1427°W |
| CLP UI | `/clp` |

See: `TEMPORAL-PPC-PHASE1.md`, `TEMPORALIDADE-CLP.md`, `EPISTEMIC-ONTOLOGY.md`, `shared/holonic-clp.js`.
