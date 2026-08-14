/**
 * Holonic layer contracts — extension + depth, seamless integration surface.
 * Each layer declares: id, order, parent, children, capabilities, APIs, invariants.
 */
export const HOLON_CONTRACTS = {
  dlt: {
    order: 0,
    name: "StrataMesh DLT",
    parent: null,
    children: ["node"],
    role: "Mesh substrate: DAG, gossip, PdC, PdS, Agora, token, consensus",
    capabilities: ["vertex_submit", "tip_select", "conflict_detect", "ipfs_pin", "gossip"],
    apis: ["stratamesh-dag", "stratamesh-dag-gateway", "stratamesh-ipfs", "stratamesh-agora", "stratamesh-poc"],
    invariants: [
      "temporal.authority === PPC sealed before payload hash",
      "spend_key unique on accepted vertices",
      "ISO is wire carrier only",
    ],
    integration: {
      emits: ["vertex.committed", "tip.updated", "temporal.stamped"],
      consumes: ["node.contribution", "agent.pds_payment"],
    },
  },
  node: {
    order: 1,
    name: "Node OS/VM",
    parent: "dlt",
    children: ["metaverse_os"],
    role: "Fog/edge host substrate; contributes resources; hosts OS twin",
    capabilities: ["resource_advertise", "health_pulse", "peer_gossip", "edge_serve"],
    apis: ["stratamesh-edge", "stratamesh-node-2", "stratamesh-node-3", "stratamesh-status"],
    invariants: [
      "node_id globally unique in mesh",
      "resource claims feed PdC quality metrics",
    ],
    integration: {
      emits: ["node.pulse", "node.resources"],
      consumes: ["dlt.tipset", "metaverse_os.schedule"],
    },
  },
  metaverse_os: {
    order: 2,
    name: "Web3 Metaverse OS",
    parent: "node",
    children: ["clp", "dashboard", "virtual_realm"],
    role: "Shared OS across nodes: schedules realms, shared services, CLP, dashboard apps",
    capabilities: ["schedule_realm", "shared_service", "orchestrate", "aiops_cycle", "diary"],
    apis: ["stratamesh-orchestrator", "stratamesh-aiops", "stratamesh-auth"],
    invariants: [
      "OS is shared across nodes (not private shell only)",
      "dashboard is OS application, not external admin plane",
    ],
    integration: {
      emits: ["os.tick", "os.diary", "os.schedule"],
      consumes: ["clp.stamp", "node.pulse", "virtual_realm.lifecycle"],
    },
  },
  clp: {
    order: 2.1,
    name: "CLP temporal kernel",
    parent: "metaverse_os",
    children: [],
    role: "Civil lunisolar time + PPC inertial truth; dual ISO carrier",
    capabilities: ["ppc_stamp", "ppc_validate", "clp_address", "solar_phase"],
    apis: ["stratamesh-orchestrator:/ppc", "stratamesh-spa:/clp"],
    invariants: ["authority=PPC", "wire_carrier=ISO-8601", "location_proof via fingerprint"],
    integration: {
      emits: ["temporal.stamp", "temporal.phase"],
      consumes: ["node.locality"],
    },
  },
  dashboard: {
    order: 2.2,
    name: "Dashboard / Portal",
    parent: "metaverse_os",
    children: [],
    role: "Human/SCA UI surface inside Metaverse OS holarchy",
    capabilities: ["portal_spa", "auth_gate", "chat_orch", "clp_ui"],
    apis: ["stratamesh-spa", "stratamesh-ui", "stratamesh-portal"],
    invariants: ["lives inside holarchy", "clearance is account field"],
    integration: {
      emits: ["ui.session", "ui.command"],
      consumes: ["os.tick", "clp.stamp", "agent.registry"],
    },
  },
  virtual_realm: {
    order: 3,
    name: "Virtual Realm",
    parent: "metaverse_os",
    children: ["open_world"],
    role: "Hypervisor domain: instantiates and operates worlds under realm rules/SPA",
    capabilities: ["create_realm", "host_world", "realm_policy", "list_children"],
    apis: ["stratamesh-realms"],
    invariants: ["worlds live inside realms", "realm ≠ world"],
    integration: {
      emits: ["realm.created", "realm.host_world"],
      consumes: ["os.schedule", "open_world.ready"],
    },
  },
  open_world: {
    order: 4,
    name: "Open-World",
    parent: "virtual_realm",
    children: ["ugc_sandbox"],
    role: "Multi-user persistent world; sandbox contributions as dynamic portions",
    capabilities: ["create_world", "attach_sandbox", "inhabitants", "world_state"],
    apis: ["stratamesh-worlds"],
    invariants: ["requires parent realm_id", "sandboxes are children not peers"],
    integration: {
      emits: ["world.updated", "world.inhabitant"],
      consumes: ["realm.host_world", "ugc_sandbox.publish"],
    },
  },
  ugc_sandbox: {
    order: 5,
    name: "UGC Sandbox",
    parent: "open_world",
    children: ["agent"],
    role: "Authoring / isolation cell; publish integrates into parent world",
    capabilities: ["create_sandbox", "publish", "isolate", "integrate"],
    apis: ["stratamesh-sandbox"],
    invariants: ["publish targets parent world", "isolation until publish"],
    integration: {
      emits: ["sandbox.publish"],
      consumes: ["world.attach", "agent.edit"],
    },
  },
  agent: {
    order: 6,
    name: "User | SCA",
    parent: "ugc_sandbox",
    children: [],
    role: "Standing by function and agreement; personal identity ≠ node function",
    capabilities: ["identity", "labour", "pds", "nft_optional", "chat"],
    apis: ["stratamesh-acb", "stratamesh-orchestrator", "stratamesh-auth"],
    invariants: [
      "identity graph separate from node_function",
      "PdS for resource consumption",
      "labour market not fixed PoC rates",
    ],
    integration: {
      emits: ["agent.action", "agent.pds"],
      consumes: ["sandbox.context", "os.diary"],
    },
  },
};

export function contractOf(holonId) {
  return HOLON_CONTRACTS[holonId] || null;
}

export function parentOf(holonId) {
  const c = HOLON_CONTRACTS[holonId];
  return c ? c.parent : null;
}

export function childrenOf(holonId) {
  const c = HOLON_CONTRACTS[holonId];
  return c ? c.children || [] : [];
}

/** Path from DLT to agent for a placement */
export function holonPathIds() {
  return ["dlt", "node", "metaverse_os", "clp", "dashboard", "virtual_realm", "open_world", "ugc_sandbox", "agent"];
}

export function integrationEdges() {
  const edges = [];
  for (const [id, c] of Object.entries(HOLON_CONTRACTS)) {
    for (const ch of c.children || []) edges.push({ from: id, to: ch, rel: "contains" });
    for (const ev of (c.integration && c.integration.emits) || []) edges.push({ from: id, event: ev, rel: "emits" });
  }
  return edges;
}
