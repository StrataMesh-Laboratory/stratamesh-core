# StrataMesh resource spine

**Status:** laboratory architecture — v0.6.0-lab, not mainnet.  
**Integrates:** [FOG-APPLIANCE.md](FOG-APPLIANCE.md) · [FOG-INFRASTRUCTURE.md](FOG-INFRASTRUCTURE.md) · stratamesh-core protocol.  
**Pages:** <https://calhegasmorais.pt/fog-stack>

Physical substrate (S0–S1) + node runtime + evidence + DAG/gossip + STRATA receipts + holonic apps (S2–S6). Spine object: **ResourceOffer → Receipt → settlement**. The node is not a trusted oracle.

---

Yes. Looking at the actual StrataMesh repositories and the Calhegas Morais reference node, the architecture becomes much more concrete than the two prospectuses alone suggest.

The important shift is this:

The infrastructure/appliance documents describe the physical substrate. The StrataMesh repositories describe the protocol and economic layer that turns that substrate into a coordinated resource network.

I checked the current public lab state and the two key repositories. The lab currently describes itself as a DLT for Fog/Edge resource coordination and STRATA settlement, with FOG-NODE-PT-CM-001 as the reference node. The current core is v0.6.0-lab, explicitly still laboratory/adversarial-lab rather than mainnet. 

1. The real StrataMesh stack

I would now model the project like this:

                    STRATAMESH
                         │
             ┌───────────┴───────────┐
             │                       │
       COORDINATION              SETTLEMENT
             │                       │
       DAG / Gossip             STRATA
       Discovery                Escrow
       Tip selection            Burn / mint
       Resource proofs          Receipts
       Scheduling               Accounting
             │                       │
             └───────────┬───────────┘
                         │
                  RESOURCE FABRIC
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
     FOG               EDGE              CLOUD/
     nodes             nodes             external
       │                 │                 │
       └───────────────mesh────────────────┘
                         │
                  PHYSICAL WORLD
                         │
      power / fiber / radio / storage / CPU
      GPU / NPU / sensors / thermal / energy

And then the Calhegas Morais node is not merely a web server sitting at the bottom.

It is intended to be the reference physical instantiation of that entire stack.

The repository explicitly separates the reference-node registry from the protocol implementation: calhegas-morais-node describes identity, role, treasury, endpoints and operational posture, while stratamesh-core contains the actual protocol. 

That distinction is extremely important.

⸻

2. What calhegasmorais.pt actually represents

The public site should be understood as the Node surface, not as StrataMesh itself.

The current lab documentation exposes several surfaces:

* calhegasmorais.pt — node/site surface
* fog.calhegasmorais.pt — Fog service
* gossip.calhegasmorais.pt — gossip surface
* origin.calhegasmorais.pt — origin/archive surface
* status.calhegasmorais.pt — operational status
* academy / hub / fund surfaces around the ecosystem. 

So conceptually:

calhegasmorais.pt
       │
       ├── identity
       ├── human interface
       ├── node portal
       ├── CLP / temporal layer
       ├── public service endpoints
       │
       └── FOG-NODE-PT-CM-001
                    │
                    └── StrataMesh Core

This is much closer to a physical-digital node than to a conventional website.

The repository identifies the node as:

FOG-NODE-PT-CM-001

in Lisbon, with AMCM ENI as operator and the StrataMesh Laboratory as the associated laboratory. 

⸻

3. Then what is the actual StrataMesh layer?

This is where the architecture becomes interesting.

The core repository currently identifies itself as:

DAG + Fog/Edge + tip selection + STRATA settlement

and contains the protocol, contracts, deployment, workers, operations, frontend and supporting infrastructure. 

I would divide that into five real protocol planes.

Plane 1 — Identity

Who/what is participating?

Operator
   │
   └── Node identity
          │
          ├── FOG-NODE-...
          ├── keys
          ├── wallet
          ├── capabilities
          └── evidence

This is where the physical appliance becomes a recognized StrataMesh resource provider.

The node repository is explicitly concerned with identity and treasury, while the lab instructions require requesting a node ID and binding it to an operator identity. 

⸻

4. Plane 2 — Resource

This is the part that connects directly to your infrastructure/appliance documents.

The physical node produces something like:

{
  "node": "FOG-NODE-PT-CM-001",
  "compute": {
    "cpu": "...",
    "cores": 8,
    "sustained_capacity": "...",
    "utilization": 0.61
  },
  "memory": {
    "capacity_gb": 16,
    "available_gb": 9.4
  },
  "storage": {
    "capacity_gb": 512,
    "available_gb": 388
  },
  "network": {
    "uplink": "fiber",
    "latency_ms": 7,
    "loss": 0.001
  },
  "energy": {
    "power_w": 64,
    "source": "grid"
  },
  "thermal": {
    "temperature_c": 41,
    "headroom": 0.32
  },
  "availability": {
    "state": "NORMAL"
  }
}

The existing StrataMesh protocol should not treat that entire object as one generic “compute node.”

That would throw away most of the value of the architecture.

Instead, the node should expose resource classes.

NODE
 │
 ├── CPU
 ├── GPU/NPU/FPGA
 ├── RAM
 ├── Storage
 ├── Network
 ├── Energy
 ├── Thermal capacity
 ├── Connectivity resilience
 └── Evidence capacity

That is exactly where your Fog Appliance specification becomes strategically important.

⸻

5. Plane 3 — Evidence

This is arguably the most important bridge between your two prospectuses and the actual StrataMesh protocol.

A node says:

“I provided 10 minutes of compute.”

The network needs to know:

“Why should anyone believe you?”

So the architecture becomes:

Physical machine
       │
       ▼
Resource sensors
       │
       ▼
Execution telemetry
       │
       ▼
Benchmark / service evidence
       │
       ▼
Timestamp
       │
       ▼
Node identity / attestation
       │
       ▼
Signed evidence
       │
       ▼
StrataMesh transaction

This is why the independent MCU / TPM / secure-element / measurement-plane idea from the appliance document is not peripheral engineering.

It potentially becomes part of the protocol’s economic trust model.

The current laboratory already describes the adversarial P1 stage as including a resource-proof MVP. 

That’s the point where the physical appliance architecture and StrataMesh start becoming one system.

⸻

6. Plane 4 — Coordination

This is the DLT/network part.

The current core explicitly uses DAG/gossip/tip-selection concepts and exposes consensus/gossip surfaces. It also describes parallels with IOTA-style DAG mechanics and Hedera-style gossip/virtual voting, while separately incorporating resource-market concepts inspired by systems such as Akash/Render. 

Conceptually:

         Node A
        /      \
       /        \
   Node B ---- Node C
       \        /
        \      /
         Node D

But the important thing is that these aren’t merely blockchain validators.

They’re resource-producing machines.

Therefore:

traditional DLT:
node → transaction → consensus
StrataMesh:
node
 │
 ├── resource
 ├── execution
 ├── evidence
 ├── transaction
 └── settlement

That’s a fundamentally different emphasis.

⸻

7. Plane 5 — Settlement

This is where STRATA enters.

The current core defines STRATA as the foundational settlement token and describes two monetary poles:

#mint
   │
   │ Proof of Contribution
   ▼
STRATA circulation
   │
   ├── node
   ├── user
   ├── ACB
   └── other participant
   │
   │ resource use
   ▼
#0
   │
   └── burn sink

The repository explicitly describes #mint as emission-only via PoC and #0 as a burn sink for resource use. 

This gives us a very useful distinction:

StrataMesh isn’t fundamentally trying to tokenize machines.

It is trying to create an accounting relationship between:

contribution → resource → use → evidence → settlement.

⸻

8. The missing conceptual bridge: the Resource Receipt

This is where I think the architecture can be substantially deepened.

The core object shouldn’t be merely:

TRANSACTION

It should be something closer to:

RESOURCE RECEIPT

For example:

Receipt #8472
Provider:
    FOG-NODE-PT-CM-001
Consumer:
    SCA-XYZ
Resource:
    CPU
Requested:
    30 CPU-minutes
Delivered:
    28.7 CPU-minutes
Execution:
    workload hash = ...
Observed:
    CPU utilization
    temperature
    power
    network
    duration
Evidence:
    measurement set = ...
Timestamp:
    T0 → T1
Node state:
    NORMAL
Confidence:
    0.97
Settlement:
    X STRATA

Then the DLT records the economic fact, while the node maintains the underlying technical evidence.

That produces a clean separation:

physical telemetry
       ↓
technical evidence
       ↓
resource receipt
       ↓
DLT transaction
       ↓
settlement

That is much stronger than trying to put every sensor reading directly onto a ledger.

⸻

9. This makes the Calhegas Morais node the prototype of a new kind of node

The reference node can therefore be viewed as:

┌─────────────────────────────────────────────┐
│          CALHEGAS MORAIS FOG NODE           │
│                                             │
│  Physical Infrastructure                    │
│  ─────────────────────                      │
│  Grid / Fiber / Radio / Energy / Thermal    │
│                                             │
│  Fog Appliance                              │
│  ─────────────                              │
│  CPU / RAM / Storage / Network / Sensors    │
│                                             │
│  StrataMesh Runtime                         │
│  ─────────────────                          │
│  Node identity / workers / scheduler       │
│                                             │
│  Evidence Plane                             │
│  ─────────────                              │
│  Measurements / timestamps / proofs         │
│                                             │
│  DLT Plane                                  │
│  ─────────                                  │
│  DAG / gossip / consensus                   │
│                                             │
│  Economic Plane                             │
│  ─────────────                              │
│  STRATA / receipts / settlement             │
│                                             │
│  Human / Holonic Plane                      │
│  ─────────────────────                      │
│  User / SCA / world / domain / CGU          │
└─────────────────────────────────────────────┘

That is the actual architecture I think you are converging toward.

⸻

10. And the holonic layer sits above the resource layer

The repository currently describes a stack like:

TRD StrataMesh
   │
   └── Fog Node
          │
          └── SO Metaverso
                 │
                 └── Domínio Virtual
                        │
                        └── Mundo Aberto
                               │
                               └── Bancada CGU
                                      │
                                      └── Utilizador | SCA

and separately describes the Node → Web3 Metaverse OS → temporal kernel → virtual domain/world/sandbox/user/ACB structure. 

This is important because it tells us why the node isn’t merely a DePIN box.

A conventional DePIN model is approximately:

machine → resource → token

Your architecture is closer to:

human / SCA
      │
      ▼
intent
      │
      ▼
world / application
      │
      ▼
resource requirement
      │
      ▼
StrataMesh
      │
      ▼
Fog / Edge resource
      │
      ▼
physical execution
      │
      ▼
evidence
      │
      ▼
receipt
      │
      ▼
settlement

That is a much richer system.

⸻

11. The really interesting part: infrastructure resilience becomes a protocol resource

This is where I would push the architecture beyond the current software implementation.

Suppose two nodes both advertise:

8 CPU cores
16 GB RAM

Technically they look identical.

But:

Node A

grid only
fiber only
no backup
thermal headroom 10%

Node B

grid
solar
generator
fiber
Starlink
radio
thermal headroom 45%

They are not equivalent resources.

Node B has a higher probability of continuing execution.

Therefore the StrataMesh resource model should eventually expose:

COMPUTE CAPACITY
+
NETWORK CAPACITY
+
ENERGY CAPACITY
+
THERMAL CAPACITY
+
FAILURE INDEPENDENCE
+
RECOVERY CAPABILITY

Call this something like:

Resilience Capacity

Then a scheduler could say:

ordinary workload
→ cheapest available CPU
critical workload
→ highest confidence × resilience
latency-sensitive workload
→ low-latency local Fog
long-running workload
→ high energy + thermal headroom
offline-tolerant workload
→ cheap opportunistic node

That would turn the infrastructure document into an actual StrataMesh scheduling primitive.

⸻

12. This also clarifies Fiber vs Starlink

The current lab’s public architecture already exposes Fog, gossip and origin surfaces, but the infrastructure specification gives you the missing physical abstraction.

Don’t model:

Internet = Internet

Model:

WAN resource
 ├── fiber
 ├── satellite
 ├── cellular
 └── radio

Each has:

latency
bandwidth
loss
jitter
cost
availability
failure domain

So a resource offer becomes:

RESOURCE:
    network
PATH:
    fiber
QUALITY:
    7 ms latency
    0.1% loss
    1 Gbps
FAILURE DOMAIN:
    terrestrial
FALLBACK:
    satellite
CONFIDENCE:
    ...

Now StrataMesh can actually schedule network resources, rather than simply assuming connectivity.

⸻

13. The same applies to energy

This is potentially even more interesting.

The node shouldn’t merely say:

power = 150 W

It should know:

energy source:
    grid
current:
    150 W
marginal cost:
    X
available alternatives:
    solar
    generator
energy reserve:
    Y Wh
forecast:
    ...
thermal constraint:
    ...
continuity probability:
    ...

Then the orchestrator can make decisions such as:

                    workload
                       │
            ┌──────────┴──────────┐
            │                     │
        urgent                 flexible
            │                     │
      execute now          wait / migrate
                                  │
                         ┌────────┴────────┐
                         │                 │
                      cheap            resilient
                       node              node

This is the point where energy-aware Fog computing becomes a first-class StrataMesh concept.

⸻

14. The current laboratory ladder fits this perfectly

The current repository says the lab has moved into an adversarial P1 stage with two hosts:

FOG-NODE-PT-CM-001
        +
EDGE-GROK-CMN-001

and identifies two major tracks:

Track A — Mesh reality

always-on node
     ↓
multi-host gossip
     ↓
multi-operator SPAs
     ↓
public testnet

Track B — Protocol depth

emission policy
     ↓
dual-asset Agora
     ↓
meta-finality
     ↓
real ACB meters
     ↓
real PQ

The repository explicitly identifies this as the current promotion path rather than mainnet. 

That gives you a very useful development strategy.

⸻

15. I would therefore define the actual StrataMesh architecture as 7 layers

Not just the two prospectus layers.

S0 — Physical Infrastructure

electricity
gas
solar
generator
fiber
Starlink
radio
cooling
physical security

S1 — Fog Appliance

CPU
RAM
storage
NIC
accelerators
MCU
sensors
thermal
power

S2 — Node Runtime

node identity
workers
services
resource manager
scheduler
health
local storage

S3 — Evidence

measurement
timestamps
attestation
benchmark
execution evidence
resource proofs

S4 — Mesh Protocol

gossip
DAG
tips
consensus
discovery
resource advertisements

S5 — Resource Economy

request
offer
allocation
execution
receipt
escrow
settlement
STRATA

S6 — Holonic / Application Layer

human
SCA / ACB
domain
world
CGU / UGC
metaverse OS
services

And Calhegas Morais is the first integrated physical-digital implementation of S0–S6.

⸻

16. The most important architectural change I’d make

I would make one object absolutely central:

ResourceOffer

Something conceptually like:

ResourceOffer
│
├── provider
│
├── resource_type
│
├── capacity
├── sustained_capacity
├── current_availability
│
├── locality
│
├── latency
├── bandwidth
│
├── energy_cost
├── thermal_capacity
│
├── resilience
├── fallback_capacity
│
├── measurement_confidence
│
├── evidence_reference
│
├── price
│
└── validity_window

Then:

ResourceOffer
       │
       ▼
ResourceRequest
       │
       ▼
Matching / scheduling
       │
       ▼
Allocation
       │
       ▼
Execution
       │
       ▼
Evidence
       │
       ▼
Receipt
       │
       ▼
STRATA settlement

That gives the entire project a single spine.

⸻

17. And the node becomes a Resource Oracle — but not a trusted oracle

This distinction matters.

The node can report:

“I have 8 cores.”

But StrataMesh shouldn’t blindly believe it.

Instead:

NODE CLAIM
    │
    ▼
measurement
    │
    ├── hardware state
    ├── workload evidence
    ├── performance test
    ├── environmental state
    └── temporal evidence
             │
             ▼
       confidence score
             │
             ▼
       network decision

This is much more defensible than “blockchain proves that the CPU worked.”

A blockchain can prove that a signed claim was submitted and incorporated into the protocol.

It doesn’t magically prove that the physical claim is true.

Your appliance/evidence architecture is precisely what has to close that gap.

⸻

18. Why the current MacBook is actually useful

The repository makes an unusually useful admission: the current reference Fog origin is a MacBook, and sleep/lid/battery state can make the public origin disappear. The documentation explicitly distinguishes that from a protocol crash and provides a FogStayAwake mechanism. 

That is actually valuable R&D evidence.

It demonstrates the difference between:

software availability

and:

physical infrastructure availability

The MacBook is therefore a good Gen-0 experimental Fog, but not the final infrastructure.

The dedicated appliance should solve:

always-on
thermal stability
measurable power
independent control
network resilience
hardware identity
continuous evidence

without changing the conceptual StrataMesh identity.

⸻

19. The resulting system is bigger than “a blockchain”

This is the distinction I’d make very strongly.

StrataMesh is better understood as:

a resource coordination protocol operating over a heterogeneous physical Fog/Edge infrastructure, with a DLT used for shared state, evidence references, coordination and settlement.

The DLT is one component.

The actual system is:

                 STRATAMESH
                     │
       ┌─────────────┼─────────────┐
       │             │             │
    PHYSICAL       COMPUTE       ECONOMIC
     WORLD          WORLD          WORLD
       │             │             │
 infrastructure   Fog/Edge       STRATA
 energy            workers        receipts
 network           services       settlement
 sensors           workloads      ownership
       │             │             │
       └─────────────┼─────────────┘
                     │
                  EVIDENCE
                     │
                     ▼
                    DLT

That’s the architecture I see emerging from the actual repositories.

⸻

20. And that gives us a much sharper definition of the Calhegas Morais node

I would define FOG-NODE-PT-CM-001 as:

A physically instantiated StrataMesh resource node whose infrastructure, compute capacity, network connectivity, energy state, execution state and evidence state are continuously observable and can participate in Fog/Edge resource coordination and STRATA settlement.

That is substantially more precise than calling it a “Fog server.”

The current node repository already separates the reference node’s identity/operational description from the protocol core, while the lab describes the node as the public laboratory surface. 

⸻

21. The next logical step

I would now stop thinking of the three projects as separate things:

calhegasmorais.pt
stratamesh-laboratory
physical Fog appliance

and instead define them as three manifestations of one architecture:

                    STRATAMESH
                        │
          ┌─────────────┼─────────────┐
          │             │             │
       PROTOCOL        NODE          SITE
          │             │             │
 stratamesh-core   FOG-NODE-...   Calhegas Morais
          │             │             │
          └─────────────┼─────────────┘
                        │
                  physical resource
                        │
                 evidence + receipt
                        │
                     STRATA

stratamesh-core is the protocol brain.
calhegas-morais-node is the reference-node identity/operational package.
calhegasmorais.pt is the public/digital surface.
The Fog Appliance is the physical resource engine.
The Fog Infrastructure is what makes that resource continuously available.

And the missing layer tying everything together is the resource/evidence/receipt model.

That is where I would focus the next architecture revision—not on adding more blockchain machinery.

The lab is already at the point where the repository itself identifies resource-proof MVP + two-host mesh as the current experimental frontier. 

If we make that resource-proof model rigorous, the physical infrastructure work, the Fog appliance work, the DAG/gossip work, and STRATA settlement all suddenly become parts of one coherent machine rather than parallel R&D threads.