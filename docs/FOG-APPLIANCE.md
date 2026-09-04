# Calhegas Morais Fog appliance

**Status:** proposed R&D architecture — not an existing production device.  
**No public date.** Post-MacBook hardware track for FOG-NODE-PT-CM-001.  
**Lab:** StrataMesh Laboratory · Lisbon · operator AMCM ENI · software today v0.5.1-lab.  
**Pages:** <https://calhegasmorais.pt/fog-appliance>

The MacBook remains the live laboratory host. This document is the hardware roadmap for a standalone always-on mini-server. Experimental thermal and energy modules are replaceable cartridges, never single points of failure.

---

CALHEGAS MORAIS

STRATAMESH FOG NODE — MODULAR COMPUTE, RESOURCE EVIDENCE & ENERGY-AWARE APPLIANCE

Technical Prospectus

Proposed evolution of FOG-NODE-PT-CM-001 from temporary MacBook infrastructure to a low-cost, modular, measurable and energy-aware Fog appliance

Location: Lisbon, Portugal
Operator: Calhegas Morais / AMCM ENI
Project: StrataMesh Laboratory
Status: Proposed R&D architecture — not an existing production device

⸻

1. Executive proposition

The Calhegas Morais StrataMesh reference Fog node currently operates from a Mac-based laboratory configuration. Public project documentation identifies FOG-NODE-PT-CM-001 as the reference Fog node and describes the current system as a laboratory installation rather than a production network. The current laboratory release is v0.5.1-lab.

This prospectus proposes the next physical evolution:

A compact, continuously operating Fog appliance in which computation, networking, storage, hardware identity, resource measurement, thermal management, energy recovery and service orchestration are designed as one modular system.

The objective is not to build an exotic server merely for novelty.

The objective is to obtain the maximum useful StrataMesh capacity per:

* euro of capital expenditure;
* cubic centimetre;
* watt of electrical consumption;
* unit of thermal stress;
* maintenance hour;
* unit of network bandwidth;
* unit of verified physical capacity.

The proposed appliance combines low-cost commercially available hardware with an extensible experimental architecture:

1. efficient compute;
2. modular memory and storage;
3. programmable networking;
4. hardware-rooted identity;
5. independent resource measurement;
6. precise time and service metering;
7. hardware resource isolation;
8. conventional thermal fallback;
9. experimental solid-state thermal technologies;
10. thermomagnetic energy recovery;
11. piezoelectric MEMS air movement;
12. local DC power management;
13. thermal, electrical and operational telemetry;
14. a StrataMesh resource-evidence plane.

The first operational node should remain functional using conventional components alone. Experimental technologies must be introduced as replaceable modules rather than as single points of failure.

⸻

2. Core design principle

The Fog is not merely a computer.

Within the StrataMesh architecture, the Fog is the intentionally installed capacity unit, while Edge devices contribute residual capacity according to their current utilisation. Fog capacity is therefore planned, persistent and deliberately provisioned.

The hardware should embody the same principle:

The Fog should be designed around sustained, measurable and verifiable productive utilisation rather than peak benchmark performance.

A nominally powerful machine is not necessarily a useful Fog node.

A useful Fog node must provide:

* compute capacity;
* memory capacity;
* storage capacity;
* network capacity;
* service availability;
* predictable latency;
* measurable energy consumption;
* thermal sustainability;
* verifiable resource contribution.

A 300 W computer does not really consume only 300 W.

Its complete operating cost includes:

compute power
+ memory power
+ storage power
+ network power
+ power-conversion losses
+ cooling power
+ control electronics
+ standby and maintenance overhead

Likewise, nominal specifications do not establish actual service capacity.

The node must distinguish between:

declared capacity

and:

measured, sustained and accepted capacity

This distinction is central to the proposed hardware architecture.

⸻

3. The StrataMesh-specific hardware problem

A conventional mini-server is designed to answer:

How much computation can this machine perform?

A StrataMesh Fog node must answer a broader question:

How much useful, available, measurable and verifiable resource can this physical node contribute to the network under present conditions?

Therefore, the hardware must expose more than CPU, RAM and storage.

It should expose:

* physical identity;
* boot and firmware state;
* available compute;
* sustained compute;
* memory bandwidth;
* storage performance;
* network throughput;
* network latency;
* accelerator availability;
* resource allocation;
* thermal headroom;
* electrical input;
* cooling load;
* energy recovered;
* service duration;
* workload completion;
* measurement confidence;
* availability history.

This requires a dedicated hardware architecture rather than simply a faster motherboard.

⸻

4. Proposed physical architecture

The proposed Calhegas Morais Fog appliance is a compact desktop-class or embedded mini-server rather than a conventional rack server.

The architecture should contain six principal domains:

1. compute;
2. data and storage;
3. network and I/O;
4. resource evidence and security;
5. thermal and power management;
6. experimental expansion.

┌─────────────────────────────────────────────────────────┐
│                 CALHEGAS MORAIS FOG                     │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │                 COMPUTE MODULE                    │  │
│  │ CPU / RAM / optional NPU / GPU / FPGA             │  │
│  │ local fabric / DMA / accelerator interface        │  │
│  └───────────────────────┬───────────────────────────┘  │
│                          │                              │
│  ┌───────────────────────▼───────────────────────────┐  │
│  │              MEMORY AND STORAGE                   │  │
│  │ RAM / optional CXL / NVMe / evidence storage      │  │
│  └───────────────────────┬───────────────────────────┘  │
│                          │                              │
│  ┌───────────────────────▼───────────────────────────┐  │
│  │              NETWORK / DATA PLANE                 │  │
│  │ Ethernet / programmable NIC / DPU / FPGA / I/O   │  │
│  └───────────────────────┬───────────────────────────┘  │
│                          │                              │
│  ┌───────────────────────▼───────────────────────────┐  │
│  │          RESOURCE EVIDENCE PLANE                  │  │
│  │ secure element / TPM / PUF / MCU / RTC / sensors │  │
│  │ timestamps / measurements / signed receipts       │  │
│  └───────────────────────┬───────────────────────────┘  │
│                          │                              │
│  ┌───────────────────────▼───────────────────────────┐  │
│  │             THERMAL / POWER PLANE                 │  │
│  │ conventional fallback / cold plate / sensors     │  │
│  │ experimental thermal cartridge / DC bus          │  │
│  └───────────────────────┬───────────────────────────┘  │
│                          │                              │
│  ┌───────────────────────▼───────────────────────────┐  │
│  │            EXPERIMENTAL CARTRIDGE                │  │
│  │ FPGA / NPU / CIM / photonic I/O / thermal R&D    │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

The thermal cartridge and experimental accelerator cartridge should be physically separable from the compute board.

This is essential for cost control, maintenance and research iteration.

⸻

5. Minimum operational prototype

The first prototype should not attempt to manufacture a custom appliance.

The lowest-cost viable StrataMesh Fog should be built from:

* a used x86 mini-PC, thin client or small desktop;
* 8 GB or more of RAM;
* a working SSD;
* Ethernet;
* Linux;
* conventional cooling;
* a low-cost microcontroller;
* basic temperature and power instrumentation.

A practical Gen-0 target is approximately:

€50–100 for a used, functional prototype

depending on the availability of second-hand hardware.

A used corporate thin client or mini-PC is preferable to a new server motherboard because the prototype objective is not maximum performance. It is:

low cost
+ reliable operation
+ Linux compatibility
+ Ethernet
+ measurable resources
+ 24/7 capability

An ARM alternative may use a Raspberry Pi-class board, but the first reference appliance should preferably use x86 if compatibility with the current software stack and existing deployment tooling is the priority.

The minimum architecture is:

Used mini-PC
    │
    ├── Linux host
    ├── StrataMesh Fog runtime
    ├── resource collector
    ├── benchmark engine
    ├── service runtime
    ├── evidence/receipt engine
    └── hardware telemetry daemon
             │
             └── USB / serial
                    │
                 low-cost MCU
                    │
          ┌─────────┼─────────┐
          │         │         │
       temperature power   watchdog

The first prototype should prove five things:

1. persistent node identity;
2. remote service execution;
3. measurable resource contribution;
4. signed or otherwise verifiable evidence;
5. graceful failure and recovery.

The first success criterion is not “build a new cooling system.”

It is:

Can another machine send work to the node, receive a useful result, and subsequently verify that the node actually provided the claimed resource for the claimed interval?

⸻

6. Modular hardware requirement

The appliance should be designed as a set of replaceable modules.

Module A — Compute

Contains:

* motherboard or compute board;
* CPU;
* RAM;
* optional NPU/GPU/FPGA;
* local fabric;
* DMA and accelerator interfaces.

Module B — Memory and storage

Contains:

* local RAM;
* NVMe storage;
* persistent node state;
* evidence storage;
* optional future CXL memory interface.

Module C — Network and data plane

Contains:

* Ethernet;
* programmable NIC, DPU or FPGA;
* traffic metering;
* network isolation;
* packet processing;
* future optical I/O.

Module D — Resource evidence and security

Contains:

* secure element or TPM-class device;
* independent MCU;
* real-time clock;
* hardware timestamping;
* temperature, voltage, current and humidity sensors;
* watchdog;
* boot and firmware measurements.

Module E — Conventional thermal fallback

Contains:

* copper cold plate;
* heat pipe, vapor chamber, heatsink or compact liquid loop;
* ordinary fan or blower;
* thermal protection.

This module must be capable of keeping the node operational without experimental cooling.

Module F — Experimental thermal cartridge

Contains:

* magnetocaloric cells;
* thermal regenerators;
* magnetic field structure;
* thermomagnetic generator coils;
* microchannel exchanger;
* optional phase-change buffer.

Module G — MEMS air-rejection cartridge

Contains:

* piezoelectric air movers;
* microfins;
* microchannels;
* airflow and pressure sensors.

Module H — Energy electronics

Contains:

* rectifier;
* DC/DC conversion;
* supercapacitor;
* optional battery;
* current and voltage measurement;
* DC bus integration.

Module I — Experimental accelerator cartridge

May eventually contain:

* FPGA;
* NPU;
* compute-in-memory array;
* neuromorphic processor;
* photonic accelerator;
* optical network interface;
* specialized cryptographic engine.

The node must remain operational if Modules F, G, H or I are removed.

⸻

7. Compute architecture

The first compute platform should be selected for:

* high sustained performance per euro;
* low idle power;
* Linux compatibility;
* reliable 24/7 operation;
* sufficient memory;
* accessible storage;
* Ethernet;
* upgradeability;
* measurable performance.

The initial target may be:

* 4–16 efficient CPU cores;
* 8–32 GB RAM for Gen-0;
* 32–128 GB RAM for a larger dedicated Fog;
* one or two NVMe devices;
* integrated 2.5 GbE or better;
* optional accelerator;
* ECC memory where economically practical.

The node should not begin with an expensive enterprise CPU unless actual StrataMesh workloads justify it.

The correct metric is:

useful StrataMesh work
per euro
per watt
per unit of sustained thermal load

not:

generic benchmark score

The compute subsystem should eventually support heterogeneous execution:

CPU       general orchestration and services
GPU/NPU   dense AI and parallel inference
FPGA      programmable pipelines and protocols
CIM       data-local matrix operations
MCU       control, measurement and safety

This allows StrataMesh to schedule work according to the physical capability of the node rather than treating the machine as a single undifferentiated CPU.

⸻

8. Chiplet and composable architecture

The long-term architecture should remain compatible with chiplet-based systems.

Instead of a monolithic processor, the future Fog package may contain:

CPU chiplet
AI/NPU chiplet
memory interface chiplet
network chiplet
security chiplet
I/O chiplet

connected through a local package fabric.

The purpose is not to require chiplets in Gen-0.

The purpose is to ensure that the StrataMesh resource model does not assume that all compute comes from one CPU.

The software should be able to report:

CPU capacity
accelerator capacity
memory capacity
network capacity
storage capacity
security capability

independently.

This makes future chiplet, FPGA, NPU and optical-I/O upgrades possible without changing the conceptual Fog identity.

⸻

9. Memory and storage architecture

StrataMesh should treat memory as a resource class rather than merely a motherboard specification.

The node should distinguish between:

Local working memory

Used for active workloads.

Persistent node state

Used for:

* identity;
* configuration;
* keys;
* service metadata;
* operational state.

Evidence storage

Used for:

* measurements;
* timestamps;
* resource receipts;
* service records;
* audit history.

Distributed storage

Used for data that can be reconstructed or replicated elsewhere.

A future architecture may add CXL-attached or pooled memory, allowing the node to expose both:

local memory

and:

remote or pooled memory

The storage system should also investigate computational storage, where filtering, compression, indexing or preprocessing can occur near the data rather than moving all data through the CPU.

The initial design should prioritise:

* reliable NVMe;
* health monitoring;
* power-loss protection where affordable;
* separate evidence storage;
* clear capacity accounting.

⸻

10. Programmable networking and data plane

The network interface should be treated as a first-class computational component.

A conventional server treats the NIC as an accessory.

A StrataMesh Fog node should treat the network as part of its service-production machinery.

The future architecture may include:

* programmable NIC;
* DPU;
* FPGA-based packet processor;
* hardware timestamping;
* traffic metering;
* encryption;
* service isolation;
* network QoS;
* packet filtering;
* storage networking;
* future optical I/O.

The objective is to reduce unnecessary CPU work and make network contribution measurable.

A desirable data path is:

NIC
 │
 ├── CPU
 ├── FPGA/DPU
 ├── accelerator
 └── memory

rather than forcing every packet through multiple unnecessary software layers.

Zero-copy, DMA, RDMA-like mechanisms and accelerator-direct data paths should be considered as future optimisations when workload measurements justify them.

⸻

11. Hardware identity and attestation

A StrataMesh node should eventually be able to prove more than its software name.

It should be able to establish:

“This physical device possesses the hardware identity associated with this node.”

The hardware identity layer should include:

* secure element or TPM-class device;
* protected key storage;
* measured boot;
* firmware measurement;
* configuration measurement;
* optional PUF-based identity;
* remote attestation;
* signed resource evidence.

The distinction is:

software declaration:
"I have 32 cores."

versus:

hardware-backed evidence:
"This identified device booted approved firmware,
contains the measured configuration,
and completed the required resource tests."

Attestation does not automatically prove every performance claim. It establishes the identity and integrity of the measuring platform. Performance and availability must still be established through repeatable tests and service evidence.

⸻

12. Independent resource-evidence plane

The node should contain a measurement layer that is independent from the main workload environment.

                  SERVICE PLANE
       applications / workloads / containers
                         │
                  RESOURCE PLANE
       CPU / RAM / storage / network / accelerators
                         │
                 EVIDENCE PLANE
       measurement → timestamp → hash → sign
                         │
                   secure MCU
                         │
                  signed receipt

The evidence plane should measure:

* compute utilisation;
* sustained compute;
* memory availability;
* storage activity;
* network throughput;
* network latency;
* service duration;
* temperature;
* voltage;
* current;
* power;
* thermal headroom;
* cooling operation;
* hardware state;
* watchdog state;
* availability.

The main operating system should not be able to freely rewrite these values.

The evidence plane may initially be implemented with:

* a low-cost MCU;
* USB or serial communication;
* commodity sensors;
* a secure element;
* software cross-checks.

A future version may use FPGA-based timestamping, hardware packet counters and accelerator-specific performance counters.

⸻

13. Time-aware hardware

Service receipts require reliable temporal measurement.

The node should therefore include:

* monotonic clock;
* real-time clock;
* network time synchronisation;
* hardware packet timestamps where available;
* timestamped sensor readings;
* watchdog timing;
* measurement intervals;
* clock-drift monitoring.

A service claim such as:

"provided 80% compute capacity for 20 seconds"

requires more than a software log.

The system must establish:

* when the service began;
* when it ended;
* what resource was allocated;
* what work was completed;
* what the node measured during that interval;
* whether the measurement source was functioning.

Time should therefore be treated as a hardware-supported resource measurement primitive.

⸻

14. Hardware resource isolation

A Fog node may eventually serve multiple workloads or tenants.

The hardware should support resource isolation through mechanisms such as:

* IOMMU;
* DMA isolation;
* memory protection;
* SR-IOV;
* accelerator partitioning;
* network QoS;
* storage namespaces;
* FPGA regions;
* CPU affinity and quotas;
* secure virtualization.

The intended model is:

Fog node
│
├── Service A
│   ├── CPU allocation
│   ├── memory allocation
│   └── network allocation
│
├── Service B
│   ├── accelerator allocation
│   ├── storage allocation
│   └── memory allocation
│
└── Service C
    ├── FPGA region
    └── network allocation

The node should not merely report that resources were assigned.

It should enforce the allocation as closely to the hardware as practical.

⸻

15. Graceful degradation

The node should not have a binary operating state of “fully working” or “broken.”

It should support graduated capacity:

100%  normal operation
 80%  thermally constrained
 60%  accelerator disabled
 40%  CPU-only services
 20%  control and evidence only
  0%  safe shutdown

The available contribution should be calculated from:

compute capacity
+ memory capacity
+ storage capacity
+ network capacity
+ thermal headroom
+ power budget
+ current utilisation
+ measurement confidence

A node with high nominal capacity but insufficient thermal headroom should not advertise its full nominal capacity as currently available.

⸻

16. Thermal architecture

16.1 Cold-side spreader

The compute package should contact a thin, high-conductivity spreader.

A copper cold plate is the appropriate low-cost starting point.

A copper/diamond composite may become attractive for a premium prototype because diamond offers extremely high thermal conductivity while copper provides manufacturability and mechanical integration.

The initial purpose is to:

* reduce local hot spots;
* equalise heat flux;
* shorten thermal paths;
* protect the experimental cartridge from concentrated heat.

Diamond should not be included in Gen-0 unless measurements justify its cost.

⸻

16.2 Conventional thermal fallback

The node must include a conventional thermal path capable of maintaining safe operation independently.

Possible implementations include:

* copper heatsink;
* heat pipe;
* vapor chamber;
* compact liquid loop;
* ordinary fan;
* blower;
* microchannel cold plate.

The fallback may remain the primary thermal system for several generations.

Experimental thermal technology should only become primary after it demonstrates:

* sufficient cooling power;
* acceptable coefficient of performance;
* stable long-duration operation;
* manageable maintenance;
* safe failure behaviour;
* economic advantage.

⸻

16.3 Magnetocaloric layer

The magnetocaloric layer is a research subsystem, not a Gen-0 requirement.

Rather than one large block, a future cartridge should use many parallel cells:

[MCM] [MCM] [MCM] [MCM] [MCM]
[MCM] [MCM] [MCM] [MCM] [MCM]
[MCM] [MCM] [MCM] [MCM] [MCM]

Each cell undergoes a controlled magnetic and thermal cycle.

Thin structures are preferable because they reduce thermal diffusion distance.

The cells should be connected through a regenerative structure that progressively transfers heat from the cold side to the hot side.

The first demonstrator should target approximately 20–50 W of thermal capacity, not immediately 300 W.

Measurements should include:

* temperature span;
* cooling power;
* coefficient of performance;
* cycle frequency;
* magnetic losses;
* regeneration losses;
* material fatigue;
* thermal contact resistance;
* control power;
* maintenance requirements.

⸻

16.4 Thermomagnetic energy recovery

Thermal cycling may also provide an opportunity for electrical recovery.

As magnetocaloric material changes temperature and magnetisation, the resulting magnetic-flux variation can induce current in nearby coils.

The energy path is:

magnetocaloric material
          ↓
generator coil
          ↓
rectifier
          ↓
DC/DC converter
          ↓
supercapacitor / DC bus

The recovered energy should first serve local loads:

* sensors;
* control electronics;
* MEMS actuators;
* magnetic switching;
* thermal switches;
* auxiliary fans;
* telemetry;
* measurement electronics.

Only measured surplus should be treated as general-purpose recovered electricity.

The system must not claim to be self-powered.

The correct accounting is:

electrical input
− electrical output recovered
= net electrical demand

All recovered energy must be measured at the electrical interface, not inferred from theoretical thermal-cycle calculations.

⸻

16.5 Piezoelectric MEMS air rejection

The hot side may use AirJet-like piezoelectric MEMS air movement.

The MEMS system is not itself a below-ambient refrigeration system.

Its role is to reject heat from the hot-side exchanger into ambient air using a compact, high-pressure air mover.

MEMS air jets
↓↓↓↓↓↓↓↓↓↓↓↓
████████████  microfins
████████████
████████████
      ↑
      │ heat
      │
MCM regenerator
      ↑
      │
   cold plate
      ↑
     CPU

The thermal division is therefore:

magnetocaloric system:
moves heat internally
MEMS system:
moves heat from the hot exchanger to ambient

The MEMS cartridge should be measured for:

* airflow;
* pressure;
* acoustic output;
* electrical consumption;
* thermal resistance;
* reliability;
* dust tolerance;
* failure behaviour.

⸻

16.6 Phase-change thermal buffer

A phase-change material may be added as a thermal buffer.

Its role would be to absorb short-duration workload peaks, allowing the cooling system to be sized for sustained average load rather than the instantaneous maximum.

This could reduce:

* cooling-system oversizing;
* peak electrical demand;
* thermal cycling;
* fan or MEMS transients;
* workload throttling.

The buffer must not be confused with continuous heat removal. It stores heat temporarily and must eventually reject it.

⸻

17. Thermal operating envelope

The objective is not the lowest possible CPU temperature.

The objective is:

maximum useful computation at the lowest total system energy cost and acceptable reliability.

An initial experimental envelope might be:

cold plate:       15–25 °C
hot exchanger:    30–45 °C
ambient:           20–30 °C

These are planning values, not guaranteed specifications.

Below-ambient operation must be optional.

The node must continuously calculate dew point:

surface temperature >
dew point + safety margin

unless the cold-side assembly is hermetically isolated from ambient humidity.

Required safeguards include:

* humidity sensor;
* dew-point calculation;
* vapor barrier;
* insulation;
* conformal coating where appropriate;
* automatic disabling of below-ambient operation;
* emergency return to conventional cooling.

⸻

18. Power architecture

The appliance should preferably use a common DC intermediate bus.

AC INPUT
   │
   ▼
efficient PSU
   │
 DC BUS
   ├──────── CPU
   ├──────── memory
   ├──────── storage
   ├──────── network
   ├──────── MCU/sensors
   └──────── thermal system
                    │
                    ▼
             thermal load
                    │
                    ▼
       thermomagnetic generator
                    │
                    ▼
              rectifier
                    │
                    ▼
                 DC/DC
                    │
                    └──────► DC BUS

A supercapacitor should buffer cyclic generator output.

A small battery may be added for longer-duration storage, but it should not be necessary for Gen-0.

The power architecture should measure:

* input voltage;
* input current;
* subsystem power;
* recovered power;
* stored energy;
* conversion losses;
* idle power;
* workload power.

⸻

19. StrataMesh software integration

The physical node should expose a Hardware Resource and Thermal Control Plane alongside the existing Fog runtime.

The proposed interface should include:

node_identity
firmware_state
boot_measurement
compute_capacity
compute_utilisation
compute_sustained_capacity
memory_capacity
memory_bandwidth
storage_capacity
storage_performance
network_capacity
network_latency
accelerator_capacity
resource_allocation
thermal_capacity
thermal_load
thermal_headroom
energy_input
energy_recovered
cooling_power
ambient_temperature
cold_plate_temperature
hot_side_temperature
humidity
dew_point
cooling_efficiency
availability
measurement_confidence

The current StrataMesh direction toward resource proofs and measurable contribution makes this interface particularly important.

The hardware should not merely report:

CPU = 8 cores
RAM = 16 GB

It should report:

8 cores installed
5.4 cores currently available
4.7 cores sustainably available
temperature headroom = 22 W
measurement confidence = high

⸻

20. Thermal and energy capacity as Fog resources

The node should eventually be able to state:

“I possess 300 W of nominal compute capacity, but only 220 W is thermally sustainable under current environmental conditions.”

Therefore:

C_available =
f(
  compute,
  memory,
  storage,
  network,
  accelerator,
  thermal headroom,
  energy budget,
  utilisation,
  measurement confidence
)

This allows StrataMesh to schedule workloads against real available capacity rather than static hardware specifications.

Thermal capacity becomes part of the resource-accounting system.

Energy becomes part of the resource-accounting system.

Measurement confidence becomes part of the resource-accounting system.

⸻

21. Hardware benchmark engine

The node should include a repeatable benchmark and validation engine.

It should test:

Compute

* integer throughput;
* floating-point throughput;
* sustained workload performance;
* accelerator throughput;
* degradation under thermal load.

Memory

* capacity;
* bandwidth;
* latency;
* sustained availability.

Storage

* capacity;
* read/write throughput;
* IOPS;
* latency;
* health;
* endurance indicators.

Network

* throughput;
* latency;
* jitter;
* packet loss;
* sustained service availability.

Physical operation

* temperature;
* power;
* thermal headroom;
* cooling efficiency;
* recovery output;
* sensor integrity.

The benchmark engine should produce signed or otherwise verifiable results that can be associated with service receipts.

⸻

22. Locality and data movement

The hardware should expose locality information.

The cost of a workload depends not only on how much computation is required, but also on where its data resides.

The node should eventually distinguish:

* CPU-local memory;
* accelerator-local memory;
* remote memory;
* local storage;
* remote storage;
* local network;
* remote Fog network.

This enables scheduling based on:

compute cost
+ memory movement
+ storage movement
+ network movement
+ thermal cost
+ energy cost

The guiding principle is:

If the CPU does not need to touch the data, the CPU should not be forced to touch the data.

This supports future DMA, zero-copy, RDMA-like and accelerator-direct paths.

⸻

23. Programmable accelerator strategy

The appliance should support an experimental accelerator cartridge.

The initial accelerator may be absent.

Later versions may add:

FPGA

Useful for:

* packet processing;
* compression;
* cryptography;
* custom protocols;
* telemetry;
* storage preprocessing;
* deterministic workloads.

NPU

Useful for:

* AI inference;
* classification;
* embedding generation;
* local model execution.

Compute-in-memory

Useful for:

* repetitive matrix operations;
* data-local inference;
* low-movement workloads.

Neuromorphic processor

Useful for:

* event-driven sensing;
* anomaly detection;
* acoustic or environmental streams;
* low-power continuous monitoring.

Photonic accelerator

Potentially useful for:

* high-throughput matrix operations;
* optical data movement;
* future high-bandwidth Fog fabrics.

These should be treated as optional resource classes rather than assumptions built into the first node.

⸻

24. Optical and high-bandwidth interconnect

Silicon photonics and optical I/O may become relevant if StrataMesh develops high-bandwidth multi-node workloads.

The purpose would not merely be higher network speed.

It would be:

* lower data-movement energy;
* high-bandwidth accelerator access;
* lower electrical interconnect loss;
* optical resource fabrics;
* short-distance high-density links between Fog nodes.

The initial node should use ordinary Ethernet.

The physical architecture should nevertheless reserve a future I/O position for:

* optical transceiver;
* optical I/O chiplet;
* high-speed PCIe or CXL interface;
* programmable network module.

⸻

25. Security and trusted operation

The node should support a hardware-rooted security model.

Required or desirable features include:

* secure boot;
* measured boot;
* protected node keys;
* secure element or TPM;
* firmware version measurement;
* remote attestation;
* isolated control MCU;
* watchdog;
* encrypted storage for sensitive state;
* resource-domain isolation;
* tamper-evident evidence records.

Security is not only about protecting the operator.

It protects the integrity of StrataMesh resource accounting.

A node that can freely falsify:

* CPU availability;
* uptime;
* service duration;
* network throughput;
* energy use;
* thermal state;

cannot provide trustworthy resource evidence.

⸻

26. Reliability architecture

The server must degrade gracefully.

MEMS failure
→ conventional airflow activates
experimental cartridge failure
→ conventional thermal path assumes load
excess humidity
→ below-ambient operation disabled
generator failure
→ node continues using normal PSU power
thermal runaway
→ workloads throttled or migrated
sensor failure
→ conservative safe limits assumed
software failure
→ independent thermal controller maintains safety
host failure
→ watchdog performs controlled recovery
evidence-plane failure
→ node reduces or suspends accepted capacity

The compute control system and thermal safety controller must be separate.

The thermal controller must not depend entirely on the host operating system.

⸻

27. Low-cost development strategy

The largest mistake would be attempting to manufacture the entire appliance from exotic materials immediately.

The correct strategy is a staged technology ladder.

Phase A — Gen-0 cheap reference Fog

Use:

* used mini-PC or thin client;
* Linux;
* conventional cooling;
* Ethernet;
* existing StrataMesh runtime;
* basic resource collection.

Target:

€50–100 where second-hand hardware permits

Success criterion:

The node can execute useful remote work and report measurable resource contribution.

⸻

Phase B — Instrumented conventional Fog

Add:

* temperature sensors;
* current and voltage measurement;
* humidity sensor;
* independent MCU;
* watchdog;
* evidence storage;
* benchmark engine;
* signed or tamper-evident measurements.

Success criterion:

The node can distinguish nominal capacity from sustained measured capacity.

⸻

Phase C — Dedicated low-cost Fog appliance

Replace the temporary prototype with:

* efficient mini-PC or embedded board;
* improved enclosure;
* reliable storage;
* persistent node identity;
* better Ethernet;
* conventional thermal fallback.

Success criterion:

Equal or greater useful StrataMesh capacity than the MacBook at lower total cost.

⸻

Phase D — Programmable data plane

Add:

* FPGA;
* DPU;
* programmable NIC;
* hardware timestamping;
* traffic metering;
* network isolation.

Success criterion:

Network and service contribution can be measured and processed with lower CPU overhead.

⸻

Phase E — Experimental accelerator cartridge

Test:

* FPGA workloads;
* NPU workloads;
* compute-in-memory;
* neuromorphic processing;
* specialized cryptography.

Success criterion:

At least one real StrataMesh workload benefits from heterogeneous execution.

⸻

Phase F — MEMS thermal module

Add commercial solid-state air movement where economically viable.

Measure:

* airflow;
* pressure;
* acoustic output;
* power;
* thermal resistance;
* reliability.

Success criterion:

MEMS airflow provides a measurable advantage over the conventional airflow baseline.

⸻

Phase G — Magnetocaloric demonstrator

Build a separate 20–50 W thermal test bench.

Measure:

* temperature span;
* cooling power;
* COP;
* cycle frequency;
* magnetic losses;
* regeneration losses;
* material fatigue;
* generator output.

Success criterion:

The thermal cartridge demonstrates repeatable operation and measurable benefit.

⸻

Phase H — Thermomagnetic energy-recovery demonstrator

Measure:

* electrical output;
* conversion efficiency;
* parasitic losses;
* useful recovered energy;
* energy per cycle;
* stability over time.

Success criterion:

Only measured electrical recovery is admitted into the node’s energy accounting.

⸻

Phase I — Integrated thermal cartridge

Combine:

* MCM cells;
* regenerator;
* generator coils;
* microchannel exchanger;
* MEMS air rejection;
* independent control;
* conventional fallback.

Success criterion:

The cartridge operates without compromising node availability.

⸻

Phase J — High-density Fog prototype

Only after the experimental systems demonstrate real advantages should they become primary subsystems.

⸻

28. Indicative Gen-0 bill of materials

This is an engineering planning range, not a quotation.

Subsystem	Lowest-cost strategy
Compute	Used mini-PC or thin client
CPU	Existing processor
RAM	Existing 8 GB or more
Storage	Existing SSD
Network	Integrated Ethernet
Cooling	Existing conventional heatsink/fan
Controller	Low-cost MCU
Sensors	Commodity temperature/RH/current sensors
Power measurement	USB or inline meter
Security	Software identity initially; secure element later
Enclosure	Existing case or inexpensive enclosure
Software	Existing StrataMesh stack
Evidence	Local append-only log initially
Experimental modules	Not required for Gen-0

The cost-saving principle is:

Spend money only where measurement demonstrates that the additional hardware creates useful StrataMesh value.

⸻

29. What should not be done

29.1 Do not begin with custom semiconductor fabrication

Use commercially available compute, networking and control components.

29.2 Do not begin with superconducting magnets

They are unnecessary for the initial thermal demonstrator and incompatible with the lowest-cost objective.

29.3 Do not make exotic cooling a single point of failure

Conventional cooling must remain available.

29.4 Do not buy a large GPU before measuring workloads

A GPU may be useful, but only if actual StrataMesh workloads justify its power and cost.

29.5 Do not treat nominal specifications as resource proofs

CPU count, RAM capacity and advertised network speed are not sufficient evidence of service delivery.

29.6 Do not count theoretical energy recovery as revenue

Only measured electrical output should enter the energy ledger.

29.7 Do not build the enclosure before defining the interfaces

The compute, evidence, network and experimental modules must be specified before custom mechanical design.

⸻

30. Proposed physical form factor

A practical first-generation experimental cartridge may eventually target approximately:

200 × 150 × 20–40 mm

but the dimensions must be driven by:

* heat flux;
* magnetic geometry;
* airflow;
* insulation;
* sensor placement;
* serviceability;
* compute-board dimensions.

A possible arrangement is:

┌──────────────────────────────┐
│          COMPUTE             │
│ CPU / RAM / NVMe / NIC       │
├──────────────────────────────┤
│       RESOURCE MODULE        │
│ MCU / security / sensors     │
├──────────────────────────────┤
│       COLD PLATE             │
├──────────────────────────────┤
│      MCM CELL ARRAY          │
│ █ █ █ █ █ █ █ █ █ █ █ █      │
├──────────────────────────────┤
│   REGENERATOR / GENERATOR    │
├──────────────────────────────┤
│    MICROFIN EXCHANGER        │
├──────────────────────────────┤
│      MEMS AIR ARRAY          │
└───────────────┬──────────────┘
                ↓
             exhaust

The final product should be designed around replaceable cartridges rather than a permanently sealed monolithic assembly.

⸻

31. Relationship to the existing Fog software

The physical replacement should not require a conceptual replacement of the Fog.

The current MacBook configuration is the laboratory host.

The proposed appliance is a new physical host for the same conceptual node role.

CURRENT
MacBook
   │
   └── macOS Fog
          │
          └── StrataMesh
TARGET
Dedicated appliance
   │
   ├── Linux host
   ├── StrataMesh Fog
   ├── Resource Evidence Plane
   ├── Hardware Resource API
   ├── Thermal Control Plane
   ├── Energy Accounting
   └── Experimental Modules

The Fog identity should remain software-defined and cryptographically protected.

Changing the physical host should not require changing the conceptual identity of the node, although the new hardware should establish a new measured hardware state.

⸻

32. Development roadmap

Stage 1 — Baseline measurement

Document the existing MacBook configuration.

Measure:

* CPU utilisation;
* memory utilisation;
* storage;
* network;
* power;
* temperature;
* useful StrataMesh work;
* service duration;
* availability.

Stage 2 — Minimal dedicated Fog

Build the cheapest reliable dedicated server that can replace the MacBook.

Stage 3 — Resource evidence

Add:

* independent MCU;
* sensors;
* watchdog;
* secure identity;
* benchmark engine;
* append-only evidence.

Stage 4 — Network and timing plane

Add:

* hardware timestamping;
* network metering;
* traffic isolation;
* programmable NIC or FPGA where justified.

Stage 5 — Heterogeneous compute

Test:

* FPGA;
* NPU;
* compute-in-memory;
* specialized accelerators.

Stage 6 — Storage and memory expansion

Investigate:

* computational storage;
* persistent evidence storage;
* CXL or composable memory;
* zero-copy data paths.

Stage 7 — Solid-state airflow

Introduce MEMS air movement.

Stage 8 — Magnetocaloric demonstrator

Develop a separate thermal test bench.

Stage 9 — Energy-recovery demonstrator

Measure actual thermomagnetic electrical recovery.

Stage 10 — Integrated thermal cartridge

Combine:

MCM
+ regenerator
+ generator
+ MEMS exchanger
+ independent controller

Stage 11 — Fog integration

Install the cartridge on the dedicated Fog.

Stage 12 — Long-duration operation

Run:

30-day
90-day
180-day

continuous workloads.

Measure:

* useful compute delivered;
* kWh consumed;
* kWh recovered;
* thermal stability;
* service availability;
* component degradation;
* maintenance;
* measurement integrity;
* resource-proof quality.

⸻

33. Success metrics

The principal metric should be:

Useful StrataMesh computation delivered per euro and per kWh over the complete useful life of the node.

Secondary metrics should include:

1. verified useful work per litre of enclosure volume;
2. sustained compute per watt;
3. network service delivered per watt;
4. memory and storage service per euro;
5. availability under sustained utilisation;
6. resource-measurement confidence;
7. thermal capacity per unit volume;
8. recovered electrical energy per unit of waste heat;
9. maintenance hours per operating month;
10. cost of verified service receipts.

This prevents the project from being distracted by a single attractive specification such as:

* below-ambient temperature;
* fanless operation;
* maximum TOPS;
* maximum bandwidth;
* theoretical energy recovery.

⸻

34. Economic thesis

The economic argument is not:

“Exotic cooling is cheaper than a fan.”

It probably will not be at the beginning.

The stronger economic argument is:

A high-utilisation Fog node turns compute, networking, storage, thermal management and measurement into recurring operating costs. A sufficiently integrated architecture may eventually reduce total cost of ownership while increasing sustained, verifiable service capacity.

The hardware must therefore be evaluated as a complete system.

The relevant comparison is:

capital cost
+ electrical cost
+ cooling cost
+ maintenance
+ downtime
+ replacement
− useful recovered energy

The experimental technology succeeds only if it improves the complete operating result.

⸻

35. Final proposed specification

CALHEGAS MORAIS COMPACT FOG — GEN-0

Purpose: Dedicated StrataMesh Fog reference hardware

Compute: Low-cost efficient x86 or ARM platform

Memory: 8–32 GB initially; expandable toward 32–128 GB

Storage: One SSD or NVMe device initially; separate evidence storage where practical

Network: Integrated Ethernet; 2.5 GbE or better where affordable

Operating system: Linux host

Thermal system: Conventional cooling with instrumentation

Resource evidence: Low-cost independent MCU and sensor system

Security: Software identity initially; secure element or TPM-class device in the next revision

Timing: Monotonic clock, network synchronisation and timestamped measurements

Isolation: Host-level isolation initially; IOMMU, SR-IOV and accelerator partitioning later

Programmability: Optional FPGA/NPU/accelerator cartridge

Storage evolution: NVMe initially; computational storage and CXL-compatible memory as future research

Thermal evolution: Conventional fallback, MEMS airflow, magnetocaloric cartridge

Energy recovery: Thermomagnetic generator demonstrator, rectifier, DC/DC and supercapacitor

Control: Independent resource and thermal safety MCU

Sensors: Temperature, humidity, dew point, current, voltage, thermal gradient, fan/MEMS state

Software: StrataMesh Fog plus Hardware Resource, Evidence and Thermal Control Plane

Form: Modular enclosure with replaceable compute, evidence, network and experimental cartridges

Primary design objective: Maximum sustained, verified useful computation per total cost

Secondary objective: Minimum volume, acoustic output and maintenance burden

Experimental objective: Demonstrate that advanced physical subsystems can increase measurable StrataMesh capacity without compromising node availability

⸻

36. Conclusion

The proposed Calhegas Morais Fog Node should not be conceived merely as a futuristic replacement for a MacBook.

It should be conceived as:

The first physical embodiment of the Fog as a measurable, composable and verifiable unit of productive infrastructure.

The current laboratory configuration demonstrates that the StrataMesh software can be instantiated on a Fog host.

The next engineering question is how cheaply and efficiently that capacity can be made:

* persistent;
* independently measurable;
* remotely useful;
* securely identifiable;
* thermally sustainable;
* energy-aware;
* modular;
* replaceable;
* scalable.

The first version should remain deliberately conservative:

used commodity computer
+ Linux
+ conventional cooling
+ Ethernet
+ independent telemetry
+ resource evidence

The next generations can introduce:

programmable networking
+ FPGA/NPU acceleration
+ hardware attestation
+ precise timing
+ composable memory
+ computational storage
+ optical I/O
+ MEMS airflow
+ magnetocaloric cooling
+ thermomagnetic recovery

The essential development path is therefore:

MacBook reference
        ↓
minimal low-cost Fog
        ↓
instrumented Fog
        ↓
resource-evidence Fog
        ↓
programmable and heterogeneous Fog
        ↓
solid-state thermal Fog
        ↓
energy-aware Fog
        ↓
composable StrataMesh appliance

The ultimate target is not simply a colder server or a more powerful computer.

It is a compact physical node whose:

compute
+ memory
+ storage
+ network
+ security
+ timing
+ resource evidence
+ thermal capacity
+ energy accounting

are all treated as measurable components of one distributed infrastructure unit.

That is the hardware direction most specific to StrataMesh.