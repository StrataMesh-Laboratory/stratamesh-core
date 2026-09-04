# Calhegas Morais Fog infrastructure

**Status:** R&D / laboratory architecture — not an existing production hut.  
**No public date.** Pair of [FOG-APPLIANCE.md](FOG-APPLIANCE.md).  
**Reference:** FOG-NODE-PT-CM-001 · ~2 m × 2 m infrastructure hut.  
**Spine:** [FOG-STACK.md](FOG-STACK.md)  
**Pages:** <https://calhegasmorais.pt/fog-infrastructure>

The appliance is the resource-producing machine. This document is the resource-enabling environment: grid, gas, fiber, Starlink, radio, generation, contingency. Utilities are optional inputs, not assumptions.

---

CALHEGAS MORAIS — STRATAMESH FOG INFRASTRUCTURE
MODULAR UTILITY, CONNECTIVITY, CONTINGENCY & RESOURCE INFRASTRUCTURE
Research / infrastructure prospectus — laboratory architecture
Status: R&D / laboratory architecture Reference: FOG-NODE-PT-CM-001 Primary concept: 2 m × 2 m minimalist autonomous infrastructure hut Operating philosophy: utility optionality, graceful degradation, automatic orchestration Target: very-low-cost physical infrastructure supporting Fog Appliances and local users/services
 
⸻
 
1. Executive concept
The Fog Infrastructure is a small, modular physical infrastructure platform designed to support a Fog Appliance without assuming that a site possesses any particular combination of utilities.
The reference architecture is a compact approximately 2 m × 2 m infrastructure hut on inexpensive land, with a minimal human workstation and predominantly autonomous operation.
It is designed around three conventional external utility inputs:
* Electrical grid
* Piped natural gas
* Ground fiber Internet
and two principal independent fallback layers:
* Satellite Internet / Starlink
* Autonomous energy generation, potentially combining intermittent renewable generation with dispatchable fuel generation.
The infrastructure therefore does not ask:
“Does this site have everything?”
It asks:
“What resources are available right now, what is their condition and cost, and how can the node remain useful with the available subset?”
This creates an infrastructure architecture capable of operating in configurations ranging from grid + fiber + gas through single-utility sites to deliberately autonomous configurations with neither grid nor fiber nor piped gas.
 
⸻
 
2. Infrastructure ≠ Appliance
The distinction is fundamental.
Fog Appliance
The appliance is the computational/resource unit:
* CPU
* RAM
* storage
* network interfaces
* sensors
* MCU
* accelerators
* thermal system
* resource measurement
* evidence generation
* Fog workloads.
Fog Infrastructure
The infrastructure provides the environment in which one or more appliances operate:
* electricity
* generation
* energy conversion
* utility interfaces
* Internet backhaul
* satellite fallback
* local networking
* terrestrial radio
* physical protection
* environmental monitoring
* remote management
* human access
* safety systems.
The appliance is therefore a resource-producing machine.
The infrastructure is a resource-enabling environment.
 
⸻
 
3. Core design principle
Infrastructure should not depend on infrastructure.
The Fog Infrastructure should remain useful when one or more conventional services disappear.
Its architecture therefore treats:
grid, gas and fiber
as optional inputs rather than assumptions.
The system dynamically determines:
AVAILABLE RESOURCES
        ↓
RESOURCE HEALTH
        ↓
RESOURCE COST
        ↓
RESOURCE CAPACITY
        ↓
CONTINGENCY STATE
        ↓
OPTIMAL CONFIGURATION
This allows the same physical design to be deployed on very different sites.
 
⸻
 
4. The Three-Utility Model
The reference infrastructure recognizes three especially valuable external resources.
4.1 Electrical grid
Primary advantages:
* continuous availability
* mature infrastructure
* high energy density
* low local complexity
* potentially inexpensive electricity
* possible authorized bidirectional operation.
The grid is normally the simplest primary energy source.
But the architecture does not regard the grid as guaranteed.
Grid failure therefore causes a transition rather than necessarily terminating operation.
 
⸻
 
5. Piped natural gas
Natural gas provides a fundamentally different resource.
Unlike intermittent renewable generation, gas is dispatchable.
It can therefore support:
* electricity generation
* prolonged autonomous operation
* emergency operation
* high-demand periods
* renewable shortfall
* grid failure.
The infrastructure can therefore treat gas as an energy availability reserve.
Importantly, the generator and combustion/exhaust system should be physically separated and engineered appropriately; the 2×2 m occupied enclosure is not intended to contain a combustion generator.
 
⸻
 
6. Fiber Internet
Fiber provides the preferred terrestrial communications path where available.
Advantages include:
* high bandwidth
* low latency
* predictable performance
* high capacity for synchronization
* efficient bulk data transfer.
But fiber is deliberately not treated as the only Internet connection.
 
⸻
 
7. Starlink as independent communications fallback
Satellite connectivity provides a different failure domain.
The conceptual topology becomes:
                 ┌── FIBER ──────────┐
                 │                   │
INTERNET ────────┤                   ├── FOG ROUTER
                 │                   │
                 └── STARLINK ───────┘
                                      │
                              LOCAL NETWORK
                                      │
                         ┌────────────┼────────────┐
                         ↓            ↓            ↓
                      APPLIANCE     RADIO       LOCAL LAN
Fiber and Starlink are therefore not simply “two Internet subscriptions.”
They represent two different physical connectivity paths.
The infrastructure controller can continuously evaluate:
* availability
* latency
* packet loss
* jitter
* throughput
* congestion
* workload requirements
* operational cost
* failure state.
The result is connectivity orchestration.
 
⸻
 
8. Connectivity arbitrage
The system can select the appropriate backhaul according to workload and circumstances.
Example
Bulk synchronization:
Fiber available → use fiber.
Low-priority resilient telemetry:
Starlink available → potentially use Starlink.
Fiber outage:
Automatically migrate critical traffic to Starlink.
Fiber restored:
Return appropriate traffic to fiber.
Critical service:
Potentially maintain redundant paths.
Thus:
FIBER
  │
  ├── primary
  │
  └── degraded
          ↓
       STARLINK
          │
          ↓
    LOCAL RADIO/LAN
The objective is not necessarily to find the lowest nominal price.
It is to optimize:
cost × performance × reliability × availability × workload importance.
 
⸻
 
9. Ground Radio Layer
The infrastructure can additionally expose local connectivity through terrestrial radio.
Conceptually:
                 STARLINK
                     │
                   FIBER
                     │
                     ↓
              ┌─────────────┐
              │ FOG NETWORK │
              └──────┬──────┘
                     │
          ┌──────────┼──────────┐
          ↓          ↓          ↓
        Wi-Fi      LoRa       P2P RADIO
          │          │          │
       USERS       SENSORS    OTHER NODES
Different radio technologies serve different purposes:
* Wi-Fi → local high-bandwidth access
* LoRa/LoRaWAN → low-power telemetry
* directional radio → node-to-node links
* managed cellular/private radio → potentially larger managed coverage.
The infrastructure does not assume that increasing transmitter power is the correct way to increase coverage. Antenna placement, topology, frequency allocation and distributed access points are more important.
Portuguese spectrum rules apply to the particular radio technology, frequency and deployment; for example, ANACOM specifies technical constraints for 5 GHz WAS/RLAN operation, while other private radio systems may involve assigned channels or licensing. 
 
⸻
 
10. The Autonomous-Energy Model
The “none of the three utilities” configuration requires a fourth concept:
Energy independence.
But the architecture should not assume that renewable generation alone guarantees continuous operation.
Instead:
          INTERMITTENT SOURCE
          ┌───────────────┐
          │ Solar / etc.  │
          └───────┬───────┘
                  │
                  ↓
             POWER BUS
                  ↑
                  │
          ┌───────┴───────┐
          │               │
     DISPATCHABLE      OPTIONAL
       GENERATOR       STORAGE
          │
       fuel
The principle is:
Intermittent energy provides cheap/available energy; dispatchable generation provides continuity.
This can be implemented with an appropriate generator/fuel configuration, subject to local safety, environmental and regulatory requirements.
The infrastructure controller then decides whether to:
* use renewable generation
* start the generator
* reduce load
* defer non-critical workloads
* preserve energy for critical services.
 
⸻
 
11. No-Utility Operating Mode
The architecture explicitly recognizes:
GRID = absent
FIBER = absent
PIPED GAS = absent
That does not automatically mean shutdown.
Instead:
RENEWABLE GENERATION
        +
DISPATCHABLE FUEL
        +
STARLINK
        +
LOCAL RADIO
        +
FOG APPLIANCE
can constitute an autonomous infrastructure configuration.
The important qualification is that autonomous energy must actually be engineered and sized for the intended duration and load.
There is no magic “off-grid” state.
 
⸻
 
12. Graceful Degradation
The infrastructure should have explicit operating states.
STATE 0 — Full Utility
Grid + fiber + gas.
GRID       → primary power
FIBER      → primary WAN
GAS        → reserve generation
STARLINK   → communications fallback
STATE 1 — Grid + Fiber
Gas unavailable.
GRID       → power
FIBER      → WAN
STARLINK   → WAN fallback
STATE 2 — Grid + Gas
Fiber unavailable.
GRID       → primary power
FIBER      → unavailable
STARLINK   → WAN
GAS        → generation reserve
RADIO      → local connectivity
STATE 3 — Gas + Fiber
Grid unavailable.
GAS        → generated electricity
FIBER      → WAN
STARLINK   → WAN fallback
STATE 4 — Gas only
GAS        → electricity
STARLINK   → WAN
RADIO      → local network
STATE 5 — Renewable + Fuel
No grid, gas pipeline or fiber.
RENEWABLE  → preferred energy
GENERATOR  → dispatchable reserve
STARLINK   → WAN
RADIO      → local connectivity
STATE 6 — Energy scarcity
The system begins shedding non-critical workloads.
SAFETY
  ↓
CONTROL
  ↓
COMMUNICATIONS
  ↓
CRITICAL COMPUTE
  ↓
ORDINARY FOG
  ↓
OPPORTUNISTIC COMPUTE
This is where the infrastructure becomes genuinely autonomous rather than simply remotely controlled.
 
⸻
 
13. Energy Orchestration
The controller can continuously calculate something conceptually like:
GRID COST
+
GENERATION COST
+
FUEL COST
+
CONVERSION LOSSES
+
EQUIPMENT WEAR
+
EXPECTED FAILURE COST
against:
AVAILABLE RENEWABLE ENERGY
+
CURRENT NODE DEMAND
+
EXPECTED FUTURE DEMAND
+
GRID CONDITIONS
+
GENERATOR CAPACITY
The controller therefore does not have to arbitrage constantly.
It can simply preserve optionality.
Example
If grid electricity is inexpensive:
use grid.
If local generation becomes economically advantageous:
generate locally.
If renewable production is abundant:
use renewable energy.
If renewable output collapses:
dispatch generation.
If generation has no economic advantage:
don’t run the generator unnecessarily.
And where a grid-connected generation configuration is legally authorized, surplus electricity can potentially be exported. Portuguese DGEG rules currently provide frameworks for decentralized production/autoconsumption and sale of surplus, but grid injection is subject to the applicable registration, technical and network requirements. 
 
⸻
 
14. The Grid as an Energy Sink/Source
The infrastructure can conceptually treat the public grid as an enormous external energy balancing mechanism.
Not literally a battery.
Rather:
             GRID
          ↙        ↘
      IMPORT       EXPORT
         ↓           ↑
       NODE ←──→ POWER SYSTEM
This can eliminate the need for a large conventional battery as the economic centerpiece of the system.
A battery may still be useful for power quality, ride-through or other engineering purposes, but it is not required to define the architecture.
The fundamental resource is:
access to a continuously available external electrical system.
 
⸻
 
15. Physical Infrastructure
The reference structure remains deliberately tiny.
Approximately 2 m × 2 m
The enclosure contains:
Equipment zone
* Fog Appliance
* network switch
* router/firewall
* fiber termination
* power electronics
* MCU/sensor controller
* environmental sensors
* UPS/ride-through equipment if required
* radio equipment.
Human zone
One minimalist workstation:
* desk
* monitor
* keyboard
* possibly mouse
* maintenance tools.
The human station is not the operating center.
It is the exception interface.
Normal operation should require nobody inside.
 
⸻
 
16. External Infrastructure
The things that should not occupy the 2×2 m interior can live externally.
Roof / mast
* Starlink terminal
* Wi-Fi antennas
* directional radio
* sensor equipment
* potentially solar equipment.
External energy area
* generator
* gas equipment
* exhaust
* appropriate protective enclosure
* fuel equipment where applicable.
External renewable area
Potentially:
* photovoltaic panels
* solar structures
* other experimental generation modules.
The shack itself therefore remains small even when the infrastructure system occupies a larger physical footprint.
 
⸻
 
17. Modular Interface Architecture
The infrastructure should use replaceable modules rather than being designed as a single integrated machine.
┌─────────────────────────────────────────┐
│             FOG INFRASTRUCTURE          │
│                                         │
│  ENERGY                                  │
│  ├─ Grid                                │
│  ├─ Generator                           │
│  ├─ Renewable                           │
│  └─ Power electronics                   │
│                                         │
│  CONNECTIVITY                           │
│  ├─ Fiber                               │
│  ├─ Starlink                            │
│  ├─ Wi-Fi                               │
│  └─ Ground radio                        │
│                                         │
│  COMPUTE                                │
│  └─ Fog Appliance                       │
│                                         │
│  CONTROL                                │
│  ├─ MCU                                 │
│  ├─ Sensors                             │
│  ├─ Energy controller                   │
│  └─ Network orchestrator                │
│                                         │
│  HUMAN                                  │
│  └─ Minimal workstation                 │
└─────────────────────────────────────────┘
Each module should be replaceable without redesigning the whole structure.
 
⸻
 
18. Infrastructure Resource Evidence
The same philosophy used by the Fog Appliance extends outward.
The infrastructure itself becomes measurable.
Potential measurements include:
Energy
* grid consumption
* generated energy
* renewable production
* generator runtime
* voltage
* current
* frequency
* power quality.
Connectivity
* bandwidth
* latency
* packet loss
* uptime
* jitter
* interface availability.
Environment
* temperature
* humidity
* enclosure conditions
* equipment thermal state.
Physical operation
* generator runtime
* maintenance intervals
* equipment availability
* module failures.
This creates a potentially important distinction:
The Fog Appliance proves what computation/resource work it performed.
The Fog Infrastructure provides evidence about the conditions under which that work was possible.
 
⸻
 
19. Infrastructure + Fog Appliance
Together they create a two-layer resource system.
          FOG INFRASTRUCTURE
                   │
       ┌───────────┼───────────┐
       ↓           ↓           ↓
     ENERGY      NETWORK     PHYSICAL
       │           │           │
       └───────────┼───────────┘
                   ↓
             FOG APPLIANCE
                   │
          COMPUTE / STORAGE
                   │
                   ↓
             FOG SERVICES
                   │
                   ↓
           RESOURCE EVIDENCE
                   │
                   ↓
             SERVICE RECEIPT
                   │
                   ↓
              SETTLEMENT
This is where the two prospectuses become one system.
 
⸻
 
20. Infrastructure as a Fog Resource
A mature StrataMesh architecture could therefore distinguish:
INFRASTRUCTURE RESOURCE
        ↓
APPLIANCE RESOURCE
        ↓
SERVICE
        ↓
RECEIPT
        ↓
PROOF
        ↓
SETTLEMENT
For example:
Infrastructure
provides 100 Mbps connectivity for six hours.
Appliance
performs compute for two hours.
Service
serves an SCA or external workload.
Receipt
records what service occurred.
Evidence
records relevant resource measurements.
Settlement
accounts for the contribution.
This is much closer to a physical resource economy than simply operating a server.
 
⸻
 
21. Contingency as a First-Class Resource
A particularly important concept is that backup capacity itself has value.
A node that normally uses fiber but maintains a functioning Starlink connection has a different resource profile from one with only fiber.
Likewise:
* grid + generator
* fiber + Starlink
* renewable + generator
* multiple radio paths
* independent power sources.
The infrastructure therefore has a measurable resilience envelope.
Potential future metric:
RESILIENCE =
availability
+
independence
+
fallback capacity
+
recovery time
+
remaining energy
This could eventually become part of Fog resource scheduling.
 
⸻
 
22. The Site Does Not Need to Be Perfect
This is perhaps the most important architectural principle.
A site with:
grid + fiber + gas
is excellent.
But the architecture should also accept:
grid only
or:
fiber only
or:
gas only
or:
none of them.
The infrastructure adapts.
That makes deployment much less constrained by geography.
Instead of asking:
“Where can we build a perfect site?”
the system asks:
“What does this site already provide, and what minimum modules turn it into a useful Fog site?”
 
⸻
 
23. Deployment Ladder
INFRA-0 — Basic enclosure
* 2×2 m structure
* grid
* network
* Fog Appliance
* environmental monitoring.
INFRA-1 — Dual WAN
Add:
* fiber
* Starlink
* automatic WAN failover.
INFRA-2 — Local radio
Add:
* Wi-Fi
* sensor radio
* directional links where appropriate.
INFRA-3 — Dispatchable energy
Add:
* generator
* energy controller
* automatic contingency operation.
INFRA-4 — Renewable hybrid
Add:
* solar/other renewable generation
* energy-aware workload scheduling.
INFRA-5 — Bidirectional energy
Where legally and technically permitted:
* generation
* self-consumption
* grid import
* authorized export
* economic optimization.
INFRA-6 — Autonomous Fog Infrastructure
The mature target:
GRID
GAS
RENEWABLE
FIBER
STARLINK
RADIO
COMPUTE
STORAGE
CONTROL
with the controller continuously optimizing the available combination.
 
⸻
 
24. Economic Philosophy
The infrastructure is deliberately low CAPEX and modular.
The goal is not to build a miniature hyperscale data center.
The goal is:
maximum infrastructure optionality per euro of physical infrastructure.
That means favoring:
* commodity equipment
* used/refurbished compute
* simple construction
* replaceable modules
* standard networking
* standard power equipment
* inexpensive sensors
* software-defined orchestration.
Money should primarily buy capability and resilience, not architectural extravagance.
 
⸻
 
25. Human Operator Model
The human is an exception handler.
Normal state:
AUTOMATIC
Exceptional state:
ALERT
 ↓
REMOTE DIAGNOSIS
 ↓
REMOTE RECOVERY
 ↓
HUMAN VISIT
Only then does the person use the:
desk + keyboard + monitor.
The workstation therefore exists because physical infrastructure occasionally requires a human—not because the system fundamentally requires one.
 
⸻
 
26. Safety Boundary
The minimalist philosophy stops at safety.
The architecture should not minimize:
* electrical protection
* grounding
* fire protection
* gas safety
* combustion ventilation
* CO detection
* exhaust separation
* weather protection
* surge/lightning protection
* certified grid interconnection
* radio compliance.
The 2×2 m enclosure is a minimal building, not a reason to put hazardous equipment into an unsuitable space.
 
⸻
 
27. Research Questions
The infrastructure prospectus creates several research programs.
Energy
* How accurately can generation cost be predicted?
* When should dispatchable generation start?
* How should generator wear be priced?
* How much renewable intermittency can be absorbed without storage?
* How should workloads respond to energy scarcity?
Connectivity
* When is fiber preferable to Starlink?
* When is redundancy worth its cost?
* Can workloads be dynamically classified by network requirements?
* Can connectivity itself become a measured Fog resource?
Infrastructure economics
* What is the minimum viable autonomous site?
* What utility combinations provide the best resilience?
* What is the value of fallback capacity?
* What is the optimal infrastructure CAPEX?
Resource evidence
* Can infrastructure measurements become cryptographically verifiable?
* Can service receipts incorporate infrastructure conditions?
* Can resource availability become schedulable on the DAG?
 
⸻
 
28. Long-Term Architecture
The eventual concept is not one giant Fog facility.
It is a population of small heterogeneous nodes.
                 INTERNET
              /            \
          FIBER           STARLINK
             \               /
              \             /
             FOG INFRASTRUCTURE
                    │
             ┌──────┴──────┐
             │             │
          ENERGY         RADIO
             │             │
             └──────┬──────┘
                    ↓
              FOG APPLIANCE
                    ↓
              LOCAL SERVICES
                    ↓
              RESOURCE PROOFS
                    ↓
               DAG / IPFS
                    ↓
             RECEIPTS / STRATA
Each physical site can have a different resource profile.
One might be:
fiber-rich / grid-rich
Another:
solar-rich / radio-rich
Another:
gas-rich / fiber-poor
Another:
Starlink + renewable + generator
Yet they can participate in the same logical Fog resource environment.
 
⸻
 
29. The Fundamental Idea
The Fog Appliance is the thing that does the work.
The Fog Infrastructure is the thing that makes doing that work resilient.
The infrastructure therefore turns:
a piece of land + whatever utilities happen to exist
into:
a continuously adapting physical resource environment.
And that is the key distinction from a conventional server room.
A conventional server room says:
“We need reliable electricity and Internet.”
The Fog Infrastructure says:
“Give me whatever combination of electricity, fuel, renewable energy, terrestrial connectivity and satellite connectivity exists here, and I will continuously determine how much capability that combination can provide.”
That is the stronger architectural proposition.
 
⸻
 
30. Prospectus Summary
FOG-INFRASTRUCTURE
Minimal physical footprint. Maximum utility optionality. Automatic operation. Human intervention by exception.
Inputs
Grid Natural gas Fiber Renewable energy Satellite connectivity
Transformation
Energy orchestration Connectivity orchestration Resource measurement Contingency management
Outputs
Power Internet Radio connectivity Compute environment Fog services Resilience
Evidence
Energy measurements Network measurements Environmental measurements Appliance resource proofs Service receipts
Economic layer
Cost optimization Optional arbitrage Authorized energy export Resource settlement
Physical target
~2 × 2 m minimalist infrastructure hut
with:
one desk + monitor + keyboard
for the occasional human operator, while the actual infrastructure runs automatically.
 
⸻
 
The paired architecture
I think the cleanest way to present the two prospectuses together is:
FOG-APPLIANCE = Modular Compute, Resource Evidence & Energy-Aware Machine
FOG-INFRASTRUCTURE = Modular Utility, Connectivity, Contingency & Resource Infrastructure
The appliance makes resources computable and provable.
The infrastructure makes the appliance deployable, resilient and economically adaptable.
And the really interesting part is that neither requires every site to look the same. The whole point is that heterogeneity becomes a feature rather than a deployment problem.
