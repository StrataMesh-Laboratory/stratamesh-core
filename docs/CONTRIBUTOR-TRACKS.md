# Contributor tracks — problems, not job titles

Each track is a **problem class** StrataMesh needs before / during public testnet.  
Pick a track that matches what you already ship upstream (KubeEdge, libp2p, Golem, agents, …).

| Track | You might already work on | First surfaces in this repo |
|-------|---------------------------|-----------------------------|
| **network** | libp2p, gossip, NAT, multiparty links | multi-host mesh, wire protocol, status probes |
| **edge** | KubeEdge, Akri, EdgeX, fog ops | reference node ops, device/resource inventory |
| **economy** | Golem, Akash, compute markets | PoC metering honesty, PdS tariffs, Agora lab rails |
| **agents** | LangGraph, AG2, multi-agent runtimes | SCA registry, volition, orchestrator grounded chat |
| **worlds** | Godot, Bevy, simulation | holonic layers, NFT world objects (lab) |
| **identity** | DID, authN/Z | subjects vs objects, clearance hierarchy, portal |
| **core** | DAG/DLT, consensus research | tip selection, benchmarks, adversarial lab ladder |

## Entry paths

1. **Read** [CONTRIBUTING.md](../CONTRIBUTING.md) and [COMMUNITY-OUTREACH-MAP.md](./COMMUNITY-OUTREACH-MAP.md).  
2. **Browse** open issues with label `track:*` or `good first issue`.  
3. **Funded work:** [Impact challenges](https://fund.calhegasmorais.pt/challenges) → accept → PR with metrics.  
4. **Unfunded:** open PR / issue; same review bar.

## Acceptance bar (all tracks)

- Lab honesty: no mainnet / production finality claims.  
- Tests or executable evidence for behavioural changes.  
- Prefer small, reviewable diffs.  
- Subjects ≠ objects ([SUBJECT-OBJECT-ECONOMY.md](./SUBJECT-OBJECT-ECONOMY.md)).

## Edge track: inventory → measurement (PoC)

The edge inventory is a description of **capacity offered to the mesh**, not a
list of every sensor field. A resource entry is billable only when it has a
canonical `class` and a positive `units` value.

### Inventory schema (`stratamesh.edge.inventory.v1`)

```json
{
  "node_id": "EDGE-NODE-PT-CM-001",
  "parent_fog": "FOG-NODE-PT-CM-001",
  "role": "env_gateway",
  "device_class": "synthetic_iot_environmental_gateway",
  "telemetry": {
    "sensors": {"temperature_c": 21.5, "humidity_pct": 52.0},
    "resource_profile": {
      "bandwidth": {"class": "bandwidth", "units": 2.5},
      "availability": {"class": "availability", "units": 1.0}
    }
  },
  "substrate": {"kind": "cloudflare_worker_isolate", "lab": true}
}
```

`node_id`, `parent_fog`, and `role` identify the provider. `device_class` and
`sensors` are descriptive evidence. Only `telemetry.resource_profile[*]` is a
resource inventory: its key and `class` must be one of `storage`, `compute`,
`bandwidth`, or `availability`; `units` is a positive capacity sample.
Legacy labels such as `ipfs_pin`, `validate`, `gossip`, and `fog_uptime` are
evidence aliases, not additional resource classes. See
[`POC-RESOURCE-VS-FUNCTION.md`](./POC-RESOURCE-VS-FUNCTION.md).

### Probe → measurement path

The existing synthetic edge Worker provides a deterministic, executable PoC:

1. `GET <edge-worker>/telemetry` probes the node and returns the inventory
   above (`workers/stratamesh-edge-node.js`).
2. `POST <edge-worker>/heartbeat` samples the profile and sends a bounded 10%
   slice per resource to the PoC service as
   `POST /pool/contribute` (`resource_class`, `units`, `node_id`, and telemetry
   metadata). It optionally attaches a lightweight DAG edge.
3. `GET <poc-worker>/measure?node_id=<node_id>` reads the PoC's on-graph
   measurement evidence. A pool contribution alone does not fabricate
   on-graph measurement units; the result can remain zero until accepted DAG,
   subsidy, pin, or equivalent evidence exists.

For a real device, `POST <iot-worker>/iot/ingest` accepts normalized telemetry
(`{agent_id, kind, value, unit}`), SenML, form, or query input. IoT ingestion
records telemetry, but does **not** convert it into PoC resource capacity or
mint STRATA; an operator must supply a separate, auditable resource profile.

### Explicit non-claims

- Synthetic sensor values are deterministic drivers, not physical sensor
  readings.
- A successful HTTP ACK proves acceptance/recording, not device health,
  uptime, availability, or measurement truth.
- `/pool/contribute` is a lab capacity write; it is not proof of capacity,
  multi-host attestation, or a mint authorization by itself.
- `/measure` is partial lab/on-graph evidence, not production metering,
  mainnet finality, aBFT, Sybil resistance, or a hardware attestation.
- IoT telemetry does not imply resource ownership, a subject identity, or an
  economic price by device function.

## What we are not

- A generic “hire crypto devs” programme.  
- A rebrand of Kubernetes, libp2p, Golem, or IOTA.  
- Mainnet. Reference node + evidence ladder only.
