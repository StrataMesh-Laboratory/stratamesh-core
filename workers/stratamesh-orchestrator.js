/**
 * StrataMesh Hybrid Orchestrator (edge)
 * Replaces the v9.2.0 banner stub.
 *
 * Architecture (aligned with src/orchestrator/):
 *   - Probabilistic lobe: soft scores (metrics + optional transformer/Grok) — never hard law
 *   - Symbolic lobe: pure rules/ontology only — NO transformer (complementary, not substitutable)
 *   - Bilateral bus: proposals → admissibility → commit / escalate
 *   - QIGA: generational fitness over policy genes (lightweight edge port)
 *
 * Full Python FederatedMetaController remains canonical on the Fog host.
 * This Worker is the always-on edge twin for chat, tick, and health.
 */

const VERSION = "10.24.0-clearance-hierarchy";

/** EMBEDDED from shared/holonic-clp.js — edit shared/ only */
/**
 * StrataMesh foundational holarchy + CLP temporal kernel (shared source of truth).
 * Workers embed or mirror this module — it is not decorative UI logic.
 *
 * Pilha holónica (infraestrutura → habitação):
 *   TRD (CLP/PPC embutido em todo o fluxo) → Nó(SO/VM) → SO Metaverso Web3 → Domínio Virtual → Mundo Aberto (NFT STRATA) → Bancada CGU (Painel dentro) → Utilizador|SCA
 * CLP não é camada: é kernel temporal da TRD, selado em cada holão via ppcCompact.
 * Painel/Portal não é camada acima: vive na Bancada CGU.
 *
 * CLP: relative civil time.
 * Phase-1 temporal authority: PPC is planetary truth; ISO-8601 is dual wire/interop only.
 * Migration ISO→PPC does not delete ISO — it demotes UTC from authority to carrier.
 */

/** Temporal migration policy (phase 1) */
const TEMPORAL_POLICY = {
  phase: 1,
  authority: "PPC", // planetary convention points + local solar frame
  civil: "CLP",
  wire_carrier: "ISO-8601", // interop only — not civil authority
  gains: [
    "location_proof_baked_in",
    "no_utc_trusted_third_party_for_civil_time",
    "inertial_frame_sun_position",
    "self_validating_across_centuries",
    "poc_bindable_to_astronomical_reality",
    "contracts_astronomically_enforceable",
  ],
  loses: ["comfort_of_abstract_universal_time"],
};

const NODE_CMN = {
  node_id: "FOG-NODE-PT-CM-001",
  name: "Calhegas Morais Node",
  lat: 38.7169,
  lon: -9.1427,
  locality: "Lisboa, Portugal",
  realm_id: "realm_1f20890b",
  world_id: "world_b787cfe9-c",
  sandbox_id: "sbx_9bed54e8-880",
};

/** Camadas holónicas (PT-PT). CLP ≠ camada; Painel ⊂ Bancada CGU. */
const HOLONIC_LAYERS = [
  { id: "dlt", nome: "TRD StrataMesh", name_en: "StrataMesh DLT", papel: "malha GDA, PdC, PdS, Ágora; CLP/PPC embutido em todo o fluxo", role: "DAG mesh; CLP/PPC embedded throughout" },
  { id: "node", nome: "Nó (SO/VM)", name_en: "Node OS/VM", papel: "substrato fog/edge do anfitrião", role: "fog/edge host substrate" },
  { id: "metaverse_os", nome: "SO do Metaverso Web3", name_en: "Web3 Metaverse OS", papel: "sistema operativo partilhado entre nós (orquestrador, AIOps, syscalls)", role: "shared OS across nodes" },
  { id: "virtual_realm", nome: "Domínio Virtual", name_en: "Virtual Realm", papel: "domínio hipervisor para mundos abertos", role: "hypervisor domain for worlds" },
  { id: "open_world", nome: "Mundo Aberto", name_en: "Open-World", papel: "mundo persistente multi-utilizador", role: "multi-user persistent world" },
  { id: "ugc_sandbox", nome: "Bancada CGU", name_en: "CGU / UGC Sandbox", papel: "criação, isolamento e Painel/Portal (superfície de apps do SO)", role: "authoring, isolation, and Panel/Portal surface" },
  { id: "agent", nome: "Utilizador | SCA", name_en: "User | SCA", papel: "standing por função e acordo, não por substrato", role: "standing by function and agreement" },
];

const PPC = [
  [38.5575, -8.0611, "Almendres (PT)"],
  [47.5914, -3.0786, "Carnac (FR)"],
  [37.0242, -4.5483, "Menga (ES)"],
  [53.6944, -6.4750, "Newgrange (IE)"],
  [51.1789, -1.8261, "Stonehenge (UK)"],
];

const SYNODIC_MONTH = 29.53058868;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

function julianDate(ms) {
  return ms / 86400000 + 2440587.5;
}

function lunarAge(ms = Date.now()) {
  const days = (ms - KNOWN_NEW_MOON) / 86400000;
  return ((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
}

/** Simplified solar events for lat/lon (same model as CLP UI kernel). */
function solarTimes(date, lat, lon) {
  const jd = julianDate(date.getTime());
  const jc = (jd - 2451545.0) / 36525.0;
  let geomMeanLongSun = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360;
  const geomMeanAnomSun = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
  const eccentEarthOrbit = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);
  const sunEqOfCtr =
    Math.sin((geomMeanAnomSun * Math.PI) / 180) *
      (1.914602 - jc * (0.004817 + 0.000014 * jc)) +
    Math.sin((2 * geomMeanAnomSun * Math.PI) / 180) * (0.019993 - 0.000101 * jc) +
    Math.sin((3 * geomMeanAnomSun * Math.PI) / 180) * 0.000289;
  const sunTrueLong = geomMeanLongSun + sunEqOfCtr;
  const meanObliq =
    23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60;
  const obliqCorr =
    meanObliq + 0.00256 * Math.cos(((125.04 - 1934.136 * jc) * Math.PI) / 180);
  const sunDecl =
    (Math.asin(Math.sin((obliqCorr * Math.PI) / 180) * Math.sin((sunTrueLong * Math.PI) / 180)) *
      180) /
    Math.PI;
  const varY = Math.tan(((obliqCorr / 2) * Math.PI) / 180) ** 2;
  const eqOfTime =
    4 *
    ((varY * Math.sin((2 * geomMeanLongSun * Math.PI) / 180) -
      2 * eccentEarthOrbit * Math.sin((geomMeanAnomSun * Math.PI) / 180) +
      4 *
        eccentEarthOrbit *
        varY *
        Math.sin((geomMeanAnomSun * Math.PI) / 180) *
        Math.cos((2 * geomMeanLongSun * Math.PI) / 180) -
      0.5 * varY * varY * Math.sin((4 * geomMeanLongSun * Math.PI) / 180)) *
      180) /
    Math.PI;
  const tzMinutes = -date.getTimezoneOffset();
  const trueSolarNoon = (720 - 4 * lon - eqOfTime + tzMinutes) / 1440;
  const haArg =
    Math.cos((90.833 * Math.PI) / 180) /
      (Math.cos((lat * Math.PI) / 180) * Math.cos((sunDecl * Math.PI) / 180)) -
    Math.tan((lat * Math.PI) / 180) * Math.tan((sunDecl * Math.PI) / 180);
  let haSunrise = 0;
  if (haArg >= 1) haSunrise = 0;
  else if (haArg <= -1) haSunrise = 180;
  else haSunrise = (Math.acos(haArg) * 180) / Math.PI;
  const sunriseUTC = trueSolarNoon - (haSunrise * 4) / 1440;
  const sunsetUTC = trueSolarNoon + (haSunrise * 4) / 1440;
  const msInDay = 86400000;
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return {
    noon: new Date(startOfDay + trueSolarNoon * msInDay),
    sunrise: new Date(startOfDay + sunriseUTC * msInDay),
    sunset: new Date(startOfDay + sunsetUTC * msInDay),
    nadir: new Date(startOfDay + trueSolarNoon * msInDay + msInDay / 2),
  };
}

function intraDayPhase(now, lat, lon) {
  const times = solarTimes(now, lat, lon);
  const next = solarTimes(new Date(now.getTime() + 86400000), lat, lon);
  let phase, vector, ms;
  if (now >= times.sunrise && now < times.noon) {
    phase = "manha";
    vector = "divergencia_cumulativa_nascer";
    ms = now - times.sunrise;
  } else if (now >= times.noon && now < times.sunset) {
    phase = "tarde";
    vector = "convergencia_antecipatoria_ocaso";
    ms = times.sunset - now;
  } else if (now >= times.sunset && now < times.nadir) {
    phase = "noite_divergente";
    vector = "divergencia_ocaso";
    ms = now - times.sunset;
  } else {
    phase = "noite_convergente";
    vector = "convergencia_nascer_subsequente";
    const target = now < times.sunrise ? times.sunrise : next.sunrise;
    ms = target - now;
  }
  return { phase, vector, ms, times };
}

function seasonName(date) {
  const m = date.getMonth();
  if (m >= 2 && m <= 4) return "Primavera";
  if (m >= 5 && m <= 7) return "Verao";
  if (m >= 8 && m <= 10) return "Outono";
  return "Inverno";
}

/** Civil CLP address for a locality (foundational temporal label). */
function clpAddress(opts = {}) {
  const now = opts.date ? new Date(opts.date) : new Date();
  const lat = opts.lat != null ? opts.lat : NODE_CMN.lat;
  const lon = opts.lon != null ? opts.lon : NODE_CMN.lon;
  const locality = opts.locality || NODE_CMN.locality;
  const age = lunarAge(now.getTime());
  const lunarWeek = Math.floor(age / (SYNODIC_MONTH / 4)) + 1;
  const lunarDay = Math.floor(age % (SYNODIC_MONTH / 4)) + 1;
  const monthOfSeason = Math.floor(now.getMonth() % 3) + 1;
  const season = seasonName(now);
  const phase = intraDayPhase(now, lat, lon);
  const address = `${locality}, ${lunarDay}º dia da ${lunarWeek}ª semana do ${monthOfSeason}º mês do/a ${season} do Ano Corrente`;
  return {
    address,
    locality,
    lunar_day: lunarDay,
    lunar_week: lunarWeek,
    month_of_season: monthOfSeason,
    season,
    lunar_age_days: Number(age.toFixed(3)),
    lunar_pct: Number(((age / SYNODIC_MONTH) * 100).toFixed(2)),
    phase: phase.phase,
    vector: phase.vector,
    iso: now.toISOString(),
    node_id: opts.node_id || NODE_CMN.node_id,
  };
}

/** Full holonic placement for CMN lab (or override). */
function holonicContext(overrides = {}) {
  const n = { ...NODE_CMN, ...overrides };
  const clp = clpAddress({
    lat: n.lat,
    lon: n.lon,
    locality: n.locality,
    node_id: n.node_id,
  });
  return {
    stack: HOLONIC_LAYERS.map((l) => l.id),
    layers: HOLONIC_LAYERS,
    path: [
      "dlt:stratamesh",
      `node:${n.node_id}`,
      "metaverse_os:shared",
      `realm:${n.realm_id}`,
      `world:${n.world_id}`,
      `sandbox:${n.sandbox_id}+painel`,
    ].join(" / "),
    node: n,
    clp, // kernel temporal embutido (não camada)
    rules: {
      metaverse_os_shared_across_nodes: true,
      painel_dentro_bancada_ugc: true,
      clp_embutido_na_rdl: true,
      clp_nao_e_camada: true,
      worlds_inside_realms: true,
      standing_by_function_not_substrate: true,
      wire_time_iso8601: true,
      civil_time_clp: true,
    },
  };
}

function ppcMatrix(ms = Date.now()) {
  const jd = julianDate(ms);
  const age = lunarAge(ms);
  return PPC.map(([lat, lon, name]) => {
    const pseudoSolar = Math.abs(Math.sin(((jd + lon) / 360) * Math.PI));
    const pseudoLunar = Math.abs(Math.cos((age / SYNODIC_MONTH) * Math.PI * 2));
    return {
      name,
      lat,
      lon,
      theta: Math.log(pseudoSolar + 0.001).toFixed(6),
      lambda: Math.log(pseudoLunar + 0.001).toFixed(6),
    };
  });
}


/** Deterministic short fingerprint (FNV-1a 32-bit hex) — no crypto dependency. */
function fnv1aHex(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

/**
 * Phase-1 PPC stamp: dual encoding.
 * - iso: wire carrier (interop)
 * - clp: civil relative address
 * - ppc: inertial planetary matrix (truth layer)
 * - solar: local astronomical phase at claimed locality
 */
function ppcStamp(opts = {}) {
  const now = opts.date ? new Date(opts.date) : new Date();
  const ms = now.getTime();
  const lat = opts.lat != null ? opts.lat : NODE_CMN.lat;
  const lon = opts.lon != null ? opts.lon : NODE_CMN.lon;
  const locality = opts.locality || NODE_CMN.locality;
  const node_id = opts.node_id || NODE_CMN.node_id;
  const clp = clpAddress({ date: now, lat, lon, locality, node_id });
  const matrix = ppcMatrix(ms);
  const phase = intraDayPhase(now, lat, lon);
  const payload = {
    schema: "stratamesh.ppc.stamp.v1",
    policy: TEMPORAL_POLICY.phase,
    authority: TEMPORAL_POLICY.authority,
    node_id,
    locality,
    lat,
    lon,
    iso_carrier: now.toISOString(), // demoted: carrier, not authority
    jd: Number(julianDate(ms).toFixed(6)),
    clp,
    solar: {
      phase: phase.phase,
      vector: phase.vector,
      sunrise: phase.times.sunrise.toISOString(),
      noon: phase.times.noon.toISOString(),
      sunset: phase.times.sunset.toISOString(),
      nadir: phase.times.nadir.toISOString(),
    },
    ppc: matrix,
  };
  // Fingerprint binds locality + phase + PPC θ/λ — location-proof without TTP
  const canon =
    node_id +
    "|" +
    lat.toFixed(4) +
    "," +
    lon.toFixed(4) +
    "|" +
    phase.phase +
    "|" +
    matrix.map((p) => p.name + ":" + p.theta + "/" + p.lambda).join(";");
  payload.ppc_fingerprint = fnv1aHex(canon);
  payload.canon = canon;
  return payload;
}

/**
 * Self-validate a PPC stamp against recomputed astronomical/PPC state.
 * Phase 1: tolerance on fingerprint match + phase consistency + locality bounds.
 */
function validatePpcStamp(stamp, opts = {}) {
  if (!stamp || stamp.schema !== "stratamesh.ppc.stamp.v1") {
    return { ok: false, reason: "invalid_schema" };
  }
  const ms = stamp.iso_carrier ? Date.parse(stamp.iso_carrier) : Date.now();
  if (!Number.isFinite(ms)) return { ok: false, reason: "bad_iso_carrier" };
  const recomputed = ppcStamp({
    date: new Date(ms),
    lat: stamp.lat,
    lon: stamp.lon,
    locality: stamp.locality,
    node_id: stamp.node_id,
  });
  const fpMatch = recomputed.ppc_fingerprint === stamp.ppc_fingerprint;
  const phaseMatch = recomputed.solar.phase === (stamp.solar && stamp.solar.phase);
  // JD drift check (carrier vs astronomical continuum)
  const jdDelta = Math.abs(recomputed.jd - (stamp.jd || 0));
  const jdOk = jdDelta < 0.0002; // ~17s
  const ok = fpMatch && phaseMatch && jdOk;
  return {
    ok,
    authority: "PPC",
    fp_match: fpMatch,
    phase_match: phaseMatch,
    jd_delta: jdDelta,
    jd_ok: jdOk,
    expected_fingerprint: recomputed.ppc_fingerprint,
    claimed_fingerprint: stamp.ppc_fingerprint,
    location_proof: ok,
    note: ok
      ? "Stamp self-validates against PPC inertial matrix + local solar frame"
      : "Stamp failed astronomical/PPC self-validation",
  };
}

/** Explicit migration helper: ISO string → PPC-authoritative stamp */
function isoToPpc(iso, opts = {}) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) throw new Error("invalid_iso");
  return ppcStamp({ ...opts, date: new Date(ms) });
}


/**
 * Compact temporal envelope for embedding in DAG/ACB/PoC/diary (holon-aware).
 * holon: dlt | node | metaverse_os | virtual_realm | open_world | ugc_sandbox | agent
 * (CLP selado via ppcCompact em qualquer holão; Painel ⊂ ugc_sandbox)
 */
function ppcCompact(holon = "dlt", opts = {}) {
  const full = ppcStamp(opts);
  return {
    schema: "stratamesh.ppc.compact.v1",
    holon,
    authority: "PPC",
    phase_policy: TEMPORAL_POLICY.phase,
    fp: full.ppc_fingerprint,
    jd: full.jd,
    phase: full.solar.phase,
    vector: full.solar.vector,
    iso_carrier: full.iso_carrier,
    locality: full.locality,
    node_id: full.node_id,
    lat: full.lat,
    lon: full.lon,
    clp_address: full.clp.address,
    ppc_anchors: full.ppc.map((p) => ({ name: p.name, theta: p.theta, lambda: p.lambda })),
  };
}

/** Attach temporal to a domain object without losing original fields. */
function withPpc(obj, holon, opts = {}) {
  const base = obj && typeof obj === "object" ? obj : { value: obj };
  return Object.assign({}, base, { temporal: ppcCompact(holon, opts) });
}


/** Contratos de interface entre holões (máquina + legenda PT-PT).
 * CLP não é holão contratual — é kernel temporal da TRD.
 * Painel não é holão — é superfície de app dentro da Bancada CGU.
 */
const HOLON_CONTRACTS = {
  dlt: {
    holon: "dlt",
    nome: "TRD StrataMesh",
    possui: ["gda", "pdc", "pds_razao", "liquidacao_agora", "fofoca", "kernel_temporal_clp_ppc"],
    owns: ["dag", "pdc", "pds_ledger", "agora_settlement", "gossip", "clp_ppc_kernel"],
    invariantes: ["identidade_por_hash_carga", "selo_ppc_antes_do_hash", "pdc_so_por_recursos", "clp_embutido_em_todo_o_fluxo"],
    invariants: ["payload_hash_identity", "ppc_seal_before_hash", "pdc_from_resources_only", "clp_embedded_throughout"],
    emite: ["vertice.anexado", "ponta.actualizada", "conflito.rejeitado", "temporal.selo"],
    emits: ["vertex.attached", "tip.updated", "conflict.rejected", "temporal.stamp"],
    consome: ["no.contributo", "agente.debito_pds"],
    consumes: ["node.contribution", "agent.pds_debit"],
    a_montante: null,
    upstream: null,
    a_jusante: "node",
    downstream: "node",
  },
  node: {
    holon: "node",
    nome: "Nó (SO/VM)",
    possui: ["medidores_capacidade", "registo_aps", "node_id"],
    owns: ["capacity_meters", "spa_registration", "node_id"],
    invariantes: ["substrato_nao_e_standing", "recurso_nao_e_rotulo_de_funcao"],
    invariants: ["substrate_not_standing", "resource_not_function_label"],
    emite: ["no.pulso", "contributo.pedido", "aps.opt_out"],
    emits: ["node.pulse", "contribution.claim", "spa.opt_out"],
    consome: ["rdl.peso", "so.agendar", "vertice.anexado"],
    consumes: ["dlt.weight", "os.schedule", "vertex.attached"],
    a_montante: "dlt",
    upstream: "dlt",
    a_jusante: "metaverse_os",
    downstream: "metaverse_os",
  },
  metaverse_os: {
    holon: "metaverse_os",
    nome: "SO do Metaverso Web3",
    possui: ["so_partilhado", "orquestrador", "aiops", "syscalls", "barramento_holonico"],
    owns: ["shared_os", "orchestrator", "aiops", "syscalls", "holon_bus"],
    invariantes: ["so_partilhado_entre_nos", "identidade_diferente_da_funcao", "painel_nao_e_camada_do_so"],
    invariants: ["os_shared_across_nodes", "identity_neq_function", "panel_not_os_layer"],
    emite: ["so.tic", "so.agendar", "sca.diario", "aiops.ciclo"],
    emits: ["os.tick", "os.schedule", "sca.diary", "aiops.cycle"],
    consome: ["no.pulso", "reino.pronto"],
    consumes: ["node.pulse", "realm.ready"],
    a_montante: "node",
    upstream: "node",
    a_jusante: "virtual_realm",
    downstream: "virtual_realm",
  },
  virtual_realm: {
    holon: "virtual_realm",
    nome: "Domínio Virtual",
    possui: ["registo_reinos", "capacidade_mundos", "soberania"],
    owns: ["realm_registry", "world_capacity", "sovereignty"],
    invariantes: ["mundo_aberto_subconjunto_reino", "hipervisor_nao_experiencia"],
    invariants: ["open_world_subset_realm", "hypervisor_not_experience"],
    emite: ["reino.criado", "reino.albergar_mundo"],
    emits: ["realm.created", "realm.host_world"],
    consome: ["so.agendar", "mundo.pronto"],
    consumes: ["os.schedule", "open_world.ready"],
    a_montante: "metaverse_os",
    upstream: "metaverse_os",
    a_jusante: "open_world",
    downstream: "open_world",
  },
  open_world: {
    holon: "open_world",
    nome: "Mundo Aberto",
    possui: ["regras_mundo", "habitantes", "ligacoes_bancada"],
    owns: ["world_rules", "inhabitants", "sandbox_links"],
    invariantes: ["reino_pai_obrigatorio", "bancada_liga_ao_mundo"],
    invariants: ["parent_realm_required", "sandbox_attaches_to_world"],
    emite: ["mundo.criado", "mundo.anexar_bancada", "mundo.habitar"],
    emits: ["world.created", "world.attach_sandbox", "world.inhabit"],
    consome: ["reino.albergar_mundo", "bancada.publicar"],
    consumes: ["realm.host_world", "sandbox.publish"],
    a_montante: "virtual_realm",
    upstream: "virtual_realm",
    a_jusante: "ugc_sandbox",
    downstream: "ugc_sandbox",
  },
  ugc_sandbox: {
    holon: "ugc_sandbox",
    nome: "Bancada CGU",
    possui: ["rascunhos", "isolamento", "pipeline_publicacao", "painel_portal"],
    owns: ["draft_assets", "isolation", "publish_pipeline", "panel_portal"],
    invariantes: ["local_ate_publicar", "utilizador_e_sca_pares", "painel_dentro_da_bancada"],
    invariants: ["local_until_publish", "user_sca_peer_inhabitants", "panel_inside_sandbox"],
    emite: ["bancada.criada", "bancada.publicar", "bancada.integrar", "ui.sessao", "ui.chat"],
    emits: ["sandbox.created", "sandbox.publish", "sandbox.integrate", "ui.session", "ui.chat"],
    consome: ["mundo.anexar_bancada", "agente.accao", "so.tic"],
    consumes: ["world.attach_sandbox", "agent.action", "os.tick"],
    a_montante: "open_world",
    upstream: "open_world",
    a_jusante: "agent",
    downstream: "agent",
    superficie_apps: ["painel", "portal", "chat_orquestrador"],
  },
  agent: {
    holon: "agent",
    nome: "Utilizador | SCA",
    possui: ["identidade_pessoal", "trabalho", "comportamento_pds", "nft_opcional"],
    owns: ["personal_identity", "labour", "pds_behaviour", "optional_nft"],
    invariantes: ["standing_por_funcao", "identidade_diferente_funcao_no", "pds_nao_proibitivo"],
    invariants: ["standing_by_function", "identity_neq_node_function", "pds_non_prohibitive"],
    emite: ["agente.debito_pds", "agente.trabalho", "agente.identidade"],
    emits: ["agent.pds_debit", "agent.labour", "agent.identity"],
    consome: ["bancada.integrar", "agora.troca", "ui.sessao"],
    consumes: ["sandbox.integrate", "agora.trade", "ui.session"],
    a_montante: "ugc_sandbox",
    upstream: "ugc_sandbox",
    a_jusante: null,
    downstream: null,
  },
};

/**
 * Contrato inteligente de interface: valida se um evento pode ser emitido/consumido.
 */
function validateHolonEvent(fromHolon, eventName, toHolon = null) {
  const c = HOLON_CONTRACTS[fromHolon];
  if (!c) return { ok: false, erro: "holon_desconhecido", holon: fromHolon };
  const emits = c.emits || [];
  const emite = c.emite || [];
  const allowed = emits.includes(eventName) || emite.includes(eventName);
  if (!allowed) {
    return {
      ok: false,
      erro: "evento_nao_contratado",
      holon: fromHolon,
      nome: c.nome,
      evento: eventName,
      emite_permitidos: emite,
      emits_allowed: emits,
    };
  }
  if (toHolon) {
    const dest = HOLON_CONTRACTS[toHolon];
    if (!dest) return { ok: false, erro: "destino_desconhecido", toHolon };
    const cons = (dest.consumes || []).concat(dest.consome || []);
    return {
      ok: true,
      de: fromHolon,
      para: toHolon,
      evento: eventName,
      destino_consome: cons,
      consumo_exacto: cons.includes(eventName),
      contrato: "interface_holonica_v1",
    };
  }
  return { ok: true, de: fromHolon, evento: eventName, contrato: "interface_holonica_v1", nome: c.nome };
}

function holonContract(id) {
  return HOLON_CONTRACTS[id] || null;
}

function holonStackPath(ids) {
  const layers = ids || HOLONIC_LAYERS.map((l) => l.id);
  return layers
    .map((id) => {
      const L = HOLONIC_LAYERS.find((x) => x.id === id);
      return L ? L.nome || L.name || id : id;
    })
    .join(" → ");
}




const ONTOLOGY = {
  standing: "by function and agreement, not substrate",
  deny_substrate_chauvinism: true,
  irreversible_requires_escalation: true,
};


/** Domain knowledge — StrataMesh + Calhegas Morais Node (CMN) */
const KNOWLEDGE = {
  public: {
    project: "StrataMesh is a laboratory distributed-ledger mesh: tiered DAG vertices, tip selection, IPFS/CID persistence, Fog/Edge Service Participation Agents (SPAs), contribution-linked STRATA, peer Agora for external-value trade, Seres Computacionais Autónomos (SCA / ACB), Prova de Contributo (PdC) and Prova de Subsistência (PdS). Not mainnet.",
    cmn: "Calhegas Morais Node (CMN) is the laboratory reference Fog node FOG-NODE-PT-CM-001 in Lisbon. Human operator: André Manuel Calhegas Morais. The Orchestrator is software coordinating the node — not the operator.",
    acb: "SCA (EN: ACB) = Ser Computacional Autónomo. Standing by function and agreement, not substrate. Earns STRATA via services; pays PdS (Prova de Subsistência) for resource consumption; may optionally buy STRATA NFTs. Not 'atomic block contracts'.",
    spa: "APS (EN: SPA) = Agente de Participação em Serviço — Fog/Edge mesh participant, not a web single-page app.",
    agora: "Strata Agora is the peer-to-peer market where holders may trade STRATA for external value. It is not a second token.",
    aiops: "AIOps Dev Team = continuous software agents (devops, security, analysis, mesh, economy) that develop and operate the node under the Orchestrator — not human ops staff and not a generic 'analytics platform' product name.",
    phases: "Public lab roadmap tracks A0–B4. Current phase labels describe nodal hierarchy, SPAs, economy, and governance scaffolding.",
    limits: "Public clearance: educational only. No live internal metrics dump, no edit, no run. Clearance is an account field, never a typed secret.",
    language: "User-facing copy: European Portuguese (pt-PT) or British English (en-GB). Never Brazilian Portuguese (pt-BR) spelling or vocabulary when the user writes Portuguese.",
  },
  internal: {
    stack: "Edge: Cloudflare Workers (status, auth, spa, aiops, orchestrator). Lab host: Python PersistentDAG, hybrid Orchestrator (probabilistic + symbolic lobes, bilateral bus, QIGA), mesh_doctor, publish loops.",
    aiops: "AIOps cycle probes agent health and development mandate; continuous work is the goal, not one-shot health checks.",
    hybrid: "Orchestrator edge twin exposes /tick /chat /health. Canonical FederatedMetaController remains Python on always-on Fog host when available.",
  },
  confidential: {
    ops: "CMN may run TEMP session pulse until always-on host. SPA grace and dual Agora are lab-verified tracks. Do not claim production freeze.",
    security: "Auth session counts are operational signals. Irreversible emission changes require escalator_class outside casual chat.",
  },
  secret: {
    ops: "Secret: full operational picture short of gated run. Edit may mean ops notes only. No run.",
  },
  top_secret: {
    run: "Top Secret gated run only via explicit message: run refresh_tick | run aiops_cycle | run status_probe. Never claim a run succeeded unless the run-gated path returned ok.",
  },
};

const CLEARANCE_RANK = { public: 0, internal: 1, confidential: 2, secret: 3, top_secret: 4 };

const CLEARANCE_PERMS = {
  public: { read: true, edit: false, run: false },
  internal: { read: true, edit: false, run: false },
  confidential: { read: true, edit: true, run: false },
  secret: { read: true, edit: true, run: false },
  top_secret: { read: true, edit: true, run: true },
};


/** Map account clearance_level (DB) → ladder */
function mapAccountClearance(raw) {
  if (raw === null || raw === undefined || raw === "") return "public";
  const s = String(raw).toLowerCase().replace(/[\s-]+/g, "_");
  // Role aliases per docs/CLEARANCE-LEVELS.md (admin→secret, staff→confidential, root→top_secret, lab→internal)
  if (["top_secret", "topsecret", "ts", "root", "root_admin", "god"].includes(s)) return "top_secret";
  if (["secret", "sec", "admin", "external_assistant"].includes(s)) return "secret";
  if (["confidential", "conf", "staff"].includes(s)) return "confidential";
  if (["internal", "intl", "lab", "operator"].includes(s)) return "internal";
  if (["public", "pub", "basic", "0", "unclassified", "guest", "anonymous"].includes(s)) return "public";
  if (s === "4") return "top_secret";
  if (s === "3") return "secret";
  if (s === "2") return "confidential";
  if (s === "1") return "internal";
  return "public";
}

/**
 * Who may access whom (agents / account-scoped data):
 *   public        ← internal, confidential, secret, top_secret
 *   internal      ← confidential, secret, top_secret
 *   confidential  ← secret, top_secret
 *   secret        ← top_secret
 *   top_secret    ← top_secret only
 * Same-level peers do not get access (except top_secret self-tier).
 * Owner always retains access to own data (checked separately via user_id).
 */
function canAccessAgentClearance(viewerClearance, targetClearance) {
  const v = CLEARANCE_RANK[mapAccountClearance(viewerClearance)] ?? 0;
  const t = CLEARANCE_RANK[mapAccountClearance(targetClearance)] ?? 0;
  if (t >= CLEARANCE_RANK.top_secret) return v >= CLEARANCE_RANK.top_secret;
  return v > t;
}


function normalizeClearance(raw) {
  return mapAccountClearance(raw);
}

/**
 * Clearance is an ACCOUNT attribute — not a client-chosen option.
 * Resolved only from session → users.clearance_level (or staff).
 * Client-supplied clearance cannot elevate above the account.
 */
async function resolveAccountClearance(request, env, body) {
  const token = (
    request.headers.get("Authorization") ||
    request.headers.get("X-Auth-Token") ||
    (body && (body.token || body.session)) ||
    ""
  ).replace(/^Bearer\s+/i, "").trim();

  let accountLevel = "public";
  let email = null;
  let source = "anonymous";
  let userId = null;
  let sovereignId = null;
  let username = null;

  if (token && env.AUTH_DB) {
    try {
      const tokenHashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
      const tokenHash = [...new Uint8Array(tokenHashBuf)].map(b => b.toString(16).padStart(2, "0")).join("");
      const sess = await env.AUTH_DB.prepare(
        "SELECT user_id, token FROM sessions WHERE token = ? OR token_hash = ? LIMIT 1"
      ).bind(token, tokenHash).first();
      if (sess && sess.user_id) {
        userId = String(sess.user_id);
        let user = null;
        try {
          user = await env.AUTH_DB.prepare(
            "SELECT email, clearance_level, sovereign_id, username, full_name FROM users WHERE id = ?"
          ).bind(sess.user_id).first();
        } catch (_) {
          try {
            user = await env.AUTH_DB.prepare(
              "SELECT email, clearance_level FROM users WHERE id = ?"
            ).bind(sess.user_id).first();
          } catch (__) {}
        }
        if (user) {
          email = user.email;
          accountLevel = mapAccountClearance(user.clearance_level);
          source = "session+users.clearance_level";
          sovereignId = user.sovereign_id || user.username || user.email || userId;
          username = user.username || user.full_name || (user.email ? String(user.email).split("@")[0] : null) || sovereignId;
        }
      }
    } catch (e) {
      source = "auth_db_error:" + String(e.message || e).slice(0, 80);
    }
  }

  // Optional AUTH service probe if no D1 binding path worked
  if (token && source === "anonymous" && env.AUTH && typeof env.AUTH.fetch === "function") {
    try {
      const r = await env.AUTH.fetch(
        new Request("https://auth/me", {
          method: "GET",
          headers: { Authorization: "Bearer " + token, Accept: "application/json" },
        })
      );
      if (r.ok) {
        const j = await r.json();
        email = j.email || j.user?.email || email;
        const cl = j.clearance_level || j.clearance || j.user?.clearance_level;
        if (cl) {
          accountLevel = mapAccountClearance(cl);
          source = "auth_service_/me";
        }
        userId = userId || (j.id != null ? String(j.id) : null) || (j.user_id != null ? String(j.user_id) : null) || (j.user && j.user.id != null ? String(j.user.id) : null) || (email ? email : null);
      }
    } catch (_) {}
  }

  // Anonymous / no bound account → always public. Never "anonymous internal".
  if (!userId && !email) {
    return {
      level: "public",
      account_clearance: "public",
      email: null,
      user_id: null,
      sovereign_id: null,
      username: null,
      source: "anonymous",
      elevated_attempt: !!(
        (body && body.clearance && mapAccountClearance(body.clearance) !== "public") ||
        (request.headers.get("X-Clearance") && mapAccountClearance(request.headers.get("X-Clearance")) !== "public")
      ),
    };
  }

  // Authenticated: internal+ requires a real account (already satisfied by userId).
  // Client may only request a level ≤ account clearance (demotion allowed, never elevation).
  const claimed = mapAccountClearance(
    (body && body.clearance) ||
      request.headers.get("X-Clearance") ||
      request.headers.get("X-Strata-Clearance") ||
      accountLevel
  );
  const level =
    CLEARANCE_RANK[claimed] <= CLEARANCE_RANK[accountLevel] ? claimed : accountLevel;

  return {
    level,
    account_clearance: accountLevel,
    email,
    user_id: userId,
    sovereign_id: sovereignId,
    username,
    source,
    elevated_attempt: CLEARANCE_RANK[claimed] > CLEARANCE_RANK[accountLevel],
  };
}

function rankMax(a, b) {
  return CLEARANCE_RANK[a] >= CLEARANCE_RANK[b] ? a : b;
}

function contextForClearance(tickOut, level) {
  const m = tickOut.tick.metrics;
  const base = {
    clearance: level,
    permissions: CLEARANCE_PERMS[level],
    knowledge: {
      ...KNOWLEDGE.public,
      ...(CLEARANCE_RANK[level] >= 1 ? KNOWLEDGE.internal : {}),
      ...(CLEARANCE_RANK[level] >= 2 ? KNOWLEDGE.confidential : {}),
      ...(CLEARANCE_RANK[level] >= 3 ? KNOWLEDGE.secret : {}),
      ...(CLEARANCE_RANK[level] >= 4 ? KNOWLEDGE.top_secret : {}),
    },
  };

  if (level === "public") {
    return {
      ...base,
      cmn: {
        node_id: "FOG-NODE-PT-CM-001",
        name: "Calhegas Morais",
        role: "Reference Fog Node (laboratory)",
        operator_public: "André Manuel Calhegas Morais",
      },
      stratamesh: {
        kind: "DAG + IPFS mesh",
        public_tracks: ["A0", "A1", "A2", "A3", "B0", "B1", "B2", "B3", "B4"],
      },
      live: {
        note: "Detailed live metrics redacted at public clearance",
        orchestrator_version: VERSION,
        hybrid: true,
      },
    };
  }

  if (level === "internal") {
    return {
      ...base,
      cmn: {
        node_id: m.node_id,
        phase: m.phase,
        phase_name: m.phase_name,
        lab_version: m.version,
        temp_mode: m.temp_mode,
      },
      live: {
        dag_txs: m.dag_txs,
        spa_active: m.spa_active,
        spa_total: m.spa_total,
        upstream: {
          status: tickOut.upstream.status.ok,
          auth: tickOut.upstream.auth.ok,
          aiops: tickOut.upstream.aiops.ok,
        },
        fitness: tickOut.tick.fitness,
      },
    };
  }

  if (level === "confidential" || level === "secret") {
    return {
      ...base,
      cmn: {
        node_id: m.node_id,
        operator: m.operator,
        phase: m.phase,
        phase_name: m.phase_name,
        lab_version: m.version,
        temp_mode: m.temp_mode,
        source: m.source,
      },
      live: {
        dag_txs: m.dag_txs,
        spa_active: m.spa_active,
        spa_total: m.spa_total,
        token_supply: m.token_supply,
        agora_trades: m.agora_trades,
        auth_users: m.auth_users,
        auth_sessions: m.auth_sessions,
        aiops_ok: m.aiops_ok,
        upstream: tickOut.upstream,
        decisions: tickOut.tick.decisions,
        genes: tickOut.tick.genes_next,
        fitness: tickOut.tick.fitness,
      },
      ontology: ONTOLOGY,
      account_classification: level,
      edit_actions_allowed: level === "secret" || level === "confidential" ? ["ops_note"] : [],
    };
  }

  // top_secret
  return {
    ...base,
    cmn: {
      node_id: m.node_id,
      operator: m.operator,
      phase: m.phase,
      phase_name: m.phase_name,
      lab_version: m.version,
      temp_mode: m.temp_mode,
      source: m.source,
    },
    live: {
      metrics: m,
      tick: tickOut.tick,
      upstream: tickOut.upstream,
    },
    ontology: ONTOLOGY,
    run_actions_allowed: ["refresh_tick", "aiops_cycle", "status_probe"],
    edit_actions_allowed: ["ops_note"],
  };
}

async function executeRun(action, env, level) {
  if (level !== "top_secret") {
    return { ok: false, error: "run requires top_secret clearance" };
  }
  const a = String(action || "").toLowerCase().replace(/-/g, "_");
  try {
    if (a === "refresh_tick" || a === "tick") {
      const out = await tick(env);
      return { ok: true, action: a, fitness: out.tick.fitness, decisions: out.tick.decisions };
    }
    if (a === "aiops_cycle" || a === "aiops") {
      let r = null;
      if (env.AIOPS && typeof env.AIOPS.fetch === "function") {
        try {
          const resp = await env.AIOPS.fetch(new Request("https://aiops/cycle", { method: "GET" }));
          const data = await resp.json().catch(async () => ({ raw: await resp.text() }));
          r = { ok: resp.ok, data };
        } catch (_) {}
      }
      if (!r) {
        const url = env.AIOPS_URL || "https://stratamesh-aiops.stratamesh.workers.dev/cycle";
        r = await probe(url);
      }
      return { ok: !!r.ok, action: a, summary: r.data?.summary || r.data, http: r.status };
    }
    if (a === "status_probe" || a === "status") {
      let r = null;
      if (env.STATUS && typeof env.STATUS.fetch === "function") {
        try {
          const resp = await env.STATUS.fetch(new Request("https://status/status", { method: "GET" }));
          const data = await resp.json().catch(async () => ({ raw: await resp.text() }));
          r = { ok: resp.ok, data };
        } catch (_) {}
      }
      if (!r) {
        const url = env.STATUS_URL || "https://stratamesh-status.stratamesh.workers.dev/status";
        r = await probe(url);
      }
      return {
        ok: !!r.ok,
        action: a,
        version: r.data?.version,
        phase: r.data?.phase,
        node_id: r.data?.node_id,
        http: r.status,
        error: r.ok ? undefined : (r.data?.error || "status probe failed"),
      };
    }
    return { ok: false, error: "unknown or forbidden run action", allowed: ["refresh_tick", "aiops_cycle", "status_probe"] };
  } catch (e) {
    return { ok: false, error: String(e.message || e), action: a };
  }
}


function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

async function probe(url) {
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    const text = await r.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 120) };
    }
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { error: String(e.message || e) } };
  }
}


/**
 * SYMBOLIC LOBE — formal reasoning (NOT a transformer, NOT "mere if-rules").
 * Classical + paraconsistent + fuzzy infinite-value + modal operators.
 * Sequential cycles: deduction → induction → abduction → provisional synthesis.
 * Theory revision only if the candidate is epistemically & ontologically superior.
 */
const SYMBOLIC_ONTOLOGY = {
  standing: "by_function_and_agreement_not_substrate",
  deny_substrate_chauvinism: true,
  irreversible_requires_escalation: true,
  open_world: true, // provisional models always revisable under superiority
};

/** Fuzzy truth in [0,1]; classical recovered at {0,1} */
function fAnd(a, b) { return Math.min(a, b); }
function fOr(a, b) { return Math.max(a, b); }
function fNot(a) { return 1 - a; }
function fImplies(a, b) { return Math.max(1 - a, b); }

/** Paraconsistent: contradiction does not explode (no ∀φ from A∧¬A) */
function paraContradicts(tA, tNotA) {
  return fAnd(tA, tNotA) > 0.5; // both hold to significant degree — flag, don't explode
}

/** Modal-ish: necessary ≈ high lower bound; possible ≈ any positive mass */
function modalNecessary(t) { return t >= 0.92; }
function modalPossible(t) { return t > 0.08; }

function symbolicAdmit(proposal) {
  const reasons = [];
  let verdict = "admit";
  const kind = proposal.kind || "param";
  const name = proposal.name || "";
  const conf = proposal.confidence != null ? Number(proposal.confidence) : 0.7;

  if (proposal.args && proposal.args.deny_computational_agents === true) {
    verdict = "reject";
    reasons.push("ontology: substrate chauvinism forbidden (standing is by function/agreement)");
  }
  if (kind === "irreversible" || /emission|token_supply|genesis/i.test(name)) {
    if (!proposal.escalator_class) {
      verdict = "escalate";
      reasons.push("modal necessity of irreversibility requires escalator_class");
    }
  }
  if (conf < 0.35) {
    verdict = "reject";
    reasons.push("confidence below symbolic floor 0.35");
  }
  return { verdict, reasons };
}

/**
 * One symbolic cycle over premises → conclusions (provisional theory).
 * Returns updated theory + cycle log.
 */
function symbolicReasoningCycle(premises, priorTheory, message) {
  const log = [];
  const theory = Object.assign(
    {
      beliefs: {}, // name → fuzzy truth
      modal: {}, // name → {necessary, possible}
      contradictions: [],
      generation: (priorTheory && priorTheory.generation) || 0,
      superiority: priorTheory && priorTheory.superiority != null ? priorTheory.superiority : 0.5,
    },
    priorTheory || {}
  );
  theory.beliefs = Object.assign({}, theory.beliefs);
  theory.modal = Object.assign({}, theory.modal);
  theory.contradictions = [];
  theory.generation = (theory.generation || 0) + 1;

  // Seed ontology as near-necessary
  theory.beliefs["ontology.standing_by_function"] = 0.97;
  theory.beliefs["ontology.deny_substrate_chauvinism"] = 0.97;
  theory.beliefs["ontology.open_world"] = 0.9;

  for (const p of premises) {
    const name = p.name || p.id || "anon";
    const conf = p.confidence != null ? clamp01(p.confidence) : 0.7;
    theory.beliefs["proposal." + name] = conf;
  }

  // --- Deduction: derive obligations from ontology + premises ---
  const tStanding = theory.beliefs["ontology.standing_by_function"];
  const tDenyChauvinism = theory.beliefs["ontology.deny_substrate_chauvinism"];
  const deducedNoChauvinismPolicy = fAnd(tStanding, tDenyChauvinism);
  theory.beliefs["conclusion.no_substrate_chauvinism_policy"] = deducedNoChauvinismPolicy;
  log.push({
    mode: "deduction",
    from: ["ontology.standing_by_function", "ontology.deny_substrate_chauvinism"],
    to: "conclusion.no_substrate_chauvinism_policy",
    truth: deducedNoChauvinismPolicy,
  });

  // Reject proposals that assert substrate denial of computational agents
  for (const p of premises) {
    if (p.args && p.args.deny_computational_agents === true) {
      const t = theory.beliefs["proposal." + p.name] || 0.5;
      const clash = fAnd(t, deducedNoChauvinismPolicy);
      theory.beliefs["proposal." + p.name] = fAnd(t, fNot(deducedNoChauvinismPolicy));
      log.push({
        mode: "deduction",
        from: ["proposal." + p.name, "conclusion.no_substrate_chauvinism_policy"],
        to: "reject_chauvinist_proposal",
        truth: clash,
      });
    }
  }

  // Irreversible without escalator → escalate (modal necessity of control)
  for (const p of premises) {
    const irr = p.kind === "irreversible" || /emission|token_supply|genesis/i.test(p.name || "");
    if (irr && !p.escalator_class) {
      theory.beliefs["modal.need_escalator." + p.name] = 0.95;
      theory.modal["need_escalator." + p.name] = { necessary: true, possible: true };
      log.push({
        mode: "deduction",
        from: ["proposal." + p.name, "ontology.irreversible_requires_escalation"],
        to: "escalate",
        truth: 0.95,
      });
    }
  }

  // --- Induction: generalise from repeated soft evidence in message/metrics tags ---
  const msg = String(message || "").toLowerCase();
  if (/always.?on|fog|lab|temp/.test(msg)) {
    const prior = theory.beliefs["inductive.prefer_stability"] || 0.5;
    theory.beliefs["inductive.prefer_stability"] = clamp01(0.6 * prior + 0.4 * 0.75);
    log.push({
      mode: "induction",
      from: ["discourse_cues"],
      to: "inductive.prefer_stability",
      truth: theory.beliefs["inductive.prefer_stability"],
    });
  }

  // --- Abduction: best explanation for observed user intent ---
  let abducted = "maintain_course";
  let abductTruth = 0.55;
  if (/migr|always.?on|fog host/.test(msg)) {
    abducted = "prefer_always_on_fog";
    abductTruth = 0.78;
  } else if (/aiops|agent|develop/.test(msg)) {
    abducted = "support_aiops_mandate";
    abductTruth = 0.72;
  } else if (/status|health|pulse/.test(msg)) {
    abducted = "report_status";
    abductTruth = 0.8;
  }
  theory.beliefs["abductive.best_explanation"] = abductTruth;
  theory.beliefs["abductive.hypothesis"] = abductTruth;
  theory.hypothesis = abducted;
  log.push({
    mode: "abduction",
    from: ["user_message_cues"],
    to: abducted,
    truth: abductTruth,
  });

  // --- Paraconsistent scan: mark tensions without explosion ---
  for (const [k, v] of Object.entries(theory.beliefs)) {
    const negKey = "not." + k;
    if (theory.beliefs[negKey] != null && paraContradicts(v, theory.beliefs[negKey])) {
      theory.contradictions.push({ belief: k, t: v, tNot: theory.beliefs[negKey] });
      log.push({ mode: "paraconsistent", belief: k, note: "tension held without explosion" });
    }
  }

  // Modal snapshot
  for (const [k, v] of Object.entries(theory.beliefs)) {
    theory.modal[k] = { necessary: modalNecessary(v), possible: modalPossible(v) };
  }

  // --- Provisional synthesis ---
  const coherence =
    1 -
    Math.min(
      0.5,
      (theory.contradictions.length || 0) * 0.1 +
        (1 - (theory.beliefs["conclusion.no_substrate_chauvinism_policy"] || 0.5)) * 0.2
    );
  const explanatory = theory.beliefs["abductive.best_explanation"] || 0.5;
  const candidateSuperiority = clamp01(0.5 * coherence + 0.5 * explanatory);

  const revised =
    candidateSuperiority > (priorTheory?.superiority ?? 0.5) + 0.02
      ? {
          ...theory,
          superiority: candidateSuperiority,
          revised: true,
          revision_reason: "epistemic+ontic superiority over prior provisional model",
        }
      : {
          ...theory,
          superiority: priorTheory?.superiority ?? candidateSuperiority,
          revised: false,
          revision_reason: "candidate not superior — retain prior mass",
        };

  return {
    theory: revised,
    log: log.slice(0, 16),
    cycle: {
      deduction: log.filter((x) => x.mode === "deduction").length,
      induction: log.filter((x) => x.mode === "induction").length,
      abduction: log.filter((x) => x.mode === "abduction").length,
      paraconsistent_flags: theory.contradictions.length,
    },
  };
}

/**
 * Symbolic lobe entry: formal cycle + classical admission verdicts.
 */
function symbolicLobeOnly(proposals, message, priorTheory) {
  const cycle = symbolicReasoningCycle(proposals, priorTheory, message);
  const results = proposals.map((p) => {
    const adm = symbolicAdmit(p);
    // Fuse with theory mass if proposal weakened by deduction
    const tProp = cycle.theory.beliefs["proposal." + p.name];
    let verdict = adm.verdict;
    const reasons = adm.reasons.slice();
    if (tProp != null && tProp < 0.35 && verdict === "admit") {
      verdict = "reject";
      reasons.push("deductive weakening under ontology (fuzzy mass < 0.35)");
    }
    if (cycle.theory.beliefs["modal.need_escalator." + p.name] >= 0.9) {
      verdict = "escalate";
      reasons.push("modal necessity: irreversible without escalator");
    }
    return {
      name: p.name,
      kind: p.kind,
      verdict,
      reasons,
      fuzzy_mass: tProp != null ? Number(tProp.toFixed(3)) : null,
      hard: true,
      lobe: "symbolic",
      logic: "classical+paraconsistent+fuzzy+modal; deductive/inductive/abductive cycle",
    };
  });
  return { results, cycle };
}

/** Probabilistic lobe — soft score from metrics */
function probabilisticScore(metrics, proposal) {
  const success = metrics.task_success_rate ?? 0.7;
  const cost = metrics.task_cost ?? 0.2;
  const explore = metrics.explore_rate ?? 0.3;
  let s = 0.4 * success + 0.3 * (1 - cost) + 0.2 * (1 - Math.abs(explore - 0.33));
  if (proposal.kind === "explore") s += 0.05 * explore;
  return Math.max(0, Math.min(1, s));
}

/** Tiny QIGA step — evolve gene vector */
function qigaStep(genes, fitness, seed, meta) {
  // Quantum-inspired: amplitude-like genes, fitness-driven drift, small phase noise
  const gen = (meta && meta.generation) || 0;
  const lr = meta && meta.learning_rate != null ? meta.learning_rate : 0.03;
  const next = genes.map((g, i) => {
    const phase = Math.sin(seed * 12.9898 + i * 78.233 + gen * 0.17);
    const drift = (fitness - 0.5) * lr;
    const explore = (meta && meta.explore) != null ? meta.explore : 0.3;
    const noise = phase * (0.04 + 0.02 * explore);
    return Math.max(0, Math.min(1, g + drift + noise));
  });
  return next;
}

/** Federated meta-learning style update of QIGA hyperparameters from local fitness signal */
function federatedMetaUpdate(meta, fitness, symbolicSuperiority) {
  const m = Object.assign(
    {
      generation: 0,
      learning_rate: 0.03,
      explore: 0.3,
      fitness_ema: 0.5,
      clients_simulated: 1,
    },
    meta || {}
  );
  m.generation = (m.generation || 0) + 1;
  m.fitness_ema = 0.85 * (m.fitness_ema || 0.5) + 0.15 * fitness;
  // meta-gradient: raise lr if fitness improving, damp if unstable
  const delta = fitness - (m.prev_fitness != null ? m.prev_fitness : fitness);
  m.learning_rate = Math.max(0.005, Math.min(0.08, (m.learning_rate || 0.03) + delta * 0.02));
  m.explore = Math.max(0.1, Math.min(0.6, (m.explore || 0.3) * (0.98 + 0.04 * (1 - fitness))));
  if (symbolicSuperiority != null) {
    m.symbolic_superiority_ema =
      0.8 * (m.symbolic_superiority_ema || 0.5) + 0.2 * symbolicSuperiority;
  }
  m.prev_fitness = fitness;
  m.updated_at = new Date().toISOString();
  return m;
}



/** LLM-backed probabilistic lobe — soft scores + optional proposals (JSON only) */

/**
 * NL / soft inference via Grok (xAI).
 * Prefer: env.AI.run("xai/…") when AI Gateway catalogs Grok;
 * else XAI_API_KEY → https://api.x.ai/v1/chat/completions;
 * else Workers AI open models as last-resort probabilistic soft scorer only.
 */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error((label || "op") + " timeout " + ms + "ms")), ms)),
  ]);
}

async function runGrokOrFallback(env, messages, opts = {}) {
  const max_tokens = opts.max_tokens || 280;
  const temperature = opts.temperature ?? 0.25;
  const perTry = opts.timeout_ms || 4500;

  // 1) Direct xAI API first (fast fail if no key / error)
  const key = env.XAI_API_KEY || env.GROK_API_KEY;
  if (key) {
    try {
      const model = String(env.GROK_MODEL || "grok-3-mini").replace(/^xai\//, "");
      const r = await withTimeout(fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, messages, max_tokens, temperature }),
      }), perTry, "xai");
      const data = await r.json();
      const text = data?.choices?.[0]?.message?.content;
      if (r.ok && text) {
        return { ok: true, text: String(text).trim(), model, provider: "xai-api" };
      }
    } catch (e) {
      /* fall through */
    }
  }

  // 2) Workers AI — only open models (xai/* catalog often hangs when unbound)
  if (env.AI && typeof env.AI.run === "function") {
    const models = [
      "@cf/meta/llama-3.1-8b-instruct",
      "@cf/meta/llama-3.2-3b-instruct",
      "@cf/mistral/mistral-7b-instruct-v0.2",
    ];
    for (const model of models) {
      try {
        const result = await withTimeout(
          env.AI.run(model, { messages, max_tokens, temperature }),
          perTry,
          model
        );
        const reply =
          (result && (result.response || result.result || result.text)) ||
          (typeof result === "string" ? result : null);
        if (reply && String(reply).trim()) {
          return { ok: true, text: String(reply).trim(), model, provider: "workers-ai" };
        }
      } catch (_) { /* next */ }
    }
  }

  return { ok: false, error: "No LLM path available within timeout (xAI key / Workers AI)" };
}

async function ensureLobeStateTable(env) {
  if (!env.AUTH_DB) return false;
  await env.AUTH_DB.prepare(
    `CREATE TABLE IF NOT EXISTS orchestrator_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )`
  ).run();
  return true;
}

async function loadLobeState(env) {
  const defaults = {
    genes: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    meta: { generation: 0, learning_rate: 0.03, explore: 0.3, fitness_ema: 0.5 },
    theory: null,
    history: [],
  };
  if (!env.AUTH_DB) return defaults;
  try {
    await ensureLobeStateTable(env);
    const row = await env.AUTH_DB.prepare(
      "SELECT value FROM orchestrator_state WHERE key = ?"
    ).bind(LOBE_STATE_KEY).first();
    if (!row || !row.value) return defaults;
    const parsed = JSON.parse(row.value);
    return {
      genes: Array.isArray(parsed.genes) && parsed.genes.length ? parsed.genes : defaults.genes,
      meta: Object.assign({}, defaults.meta, parsed.meta || {}),
      theory: parsed.theory || null,
      history: Array.isArray(parsed.history) ? parsed.history.slice(-32) : [],
    };
  } catch (_) {
    return defaults;
  }
}

async function saveLobeState(env, state) {
  if (!env.AUTH_DB) return false;
  try {
    await ensureLobeStateTable(env);
    const payload = JSON.stringify({
      genes: state.genes,
      meta: state.meta,
      theory: state.theory,
      history: (state.history || []).slice(-32),
      transparent: state.transparent,
      saved_at: new Date().toISOString(),
    });
    await env.AUTH_DB.prepare(
      `INSERT INTO orchestrator_state (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    ).bind(LOBE_STATE_KEY, payload).run();
    return true;
  } catch (_) {
    return false;
  }
}

async function llmProbabilisticLobe(env, message, metrics, level) {
  if (!env.AI || typeof env.AI.run !== "function") {
    return {
      ok: false,
      scores: { relevance: 0.5, urgency: 0.3, explore: metrics.explore_rate ?? 0.3 },
      proposals: [],
      note: "AI binding missing — heuristic fallback",
    };
  }
  const system =
    "You are a soft-scoring subroutine for the probabilistic lobe — not the Orchestrator. Output ONLY valid JSON. " +
    "Output ONLY valid JSON (no markdown). Schema: " +
    '{"scores":{"relevance":0-1,"urgency":0-1,"explore":0-1},"proposals":[{"kind":"param|policy|explore","name":"snake_case","confidence":0-1}],"rationale":"<=40 words"}. ' +
    "Soft scoring only — never claim irreversible commits. Lab CMN FOG-NODE-PT-CM-001. Clearance=" + level + ".";
  const user =
    "Metrics:" + JSON.stringify({
      task_success_rate: metrics.task_success_rate,
      task_cost: metrics.task_cost,
      explore_rate: metrics.explore_rate,
      dag_txs: metrics.dag_txs,
      spa_active: metrics.spa_active,
      aiops_ok: metrics.aiops_ok,
      temp_mode: metrics.temp_mode,
    }) +
    "\nUser message: " + String(message || "").slice(0, 500);
  try {
    const result = await runGrokOrFallback(env, [
        { role: "system", content: system },
        { role: "user", content: user },
      ], { max_tokens: 220, temperature: 0.2 });
    const raw = String(result?.response || result?.result || result?.text || "").trim();
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonStr) return { ok: false, scores: { relevance: 0.5, urgency: 0.3, explore: 0.3 }, proposals: [], raw: raw.slice(0, 120) };
    const parsed = JSON.parse(jsonStr);
    const scores = parsed.scores || {};
    return {
      ok: true,
      scores: {
        relevance: clamp01(scores.relevance),
        urgency: clamp01(scores.urgency),
        explore: clamp01(scores.explore),
      },
      proposals: Array.isArray(parsed.proposals) ? parsed.proposals.slice(0, 4) : [],
      rationale: String(parsed.rationale || "").slice(0, 200),
      model: "@cf/meta/llama-3.2-3b-instruct",
    };
  } catch (e) {
    return { ok: false, scores: { relevance: 0.5, urgency: 0.3, explore: 0.3 }, proposals: [], error: String(e.message || e) };
  }
}

function clamp01(x) {
  const n = Number(x);
  if (Number.isNaN(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

/** LLM-backed symbolic lobe — ontology-constrained verdicts, then hard merge with symbolicAdmit */

async function llmHybridLobes(env, message, metrics, level) {
  const state = await loadLobeState(env);
  const prob = await llmProbabilisticLobe(env, message, metrics, level);
  const baseProps = [
    { kind: "param", name: "maintain_lab_pulse", confidence: 0.82, args: {} },
    { kind: "policy", name: "prefer_always_on_fog", confidence: 0.75, args: {} },
    ...(prob.proposals || []).map((p) => ({
      kind: p.kind || "param",
      name: String(p.name || "unnamed").slice(0, 48),
      confidence: clamp01(p.confidence),
      args: {},
    })),
  ];
  const seen = new Set();
  const proposals = [];
  for (const p of baseProps) {
    if (seen.has(p.name)) continue;
    seen.add(p.name);
    proposals.push(p);
  }
  const symPack = symbolicLobeOnly(proposals, message, state.theory);
  const sym = {
    ok: true,
    pure_symbolic: true,
    formal_logic: true,
    cycle: symPack.cycle,
    merged: symPack.results,
  };
  const decisions = proposals.map((p) => {
    const soft = probabilisticScore(metrics, p);
    const llmSoft = prob.scores?.relevance != null
      ? 0.6 * soft + 0.4 * clamp01(prob.scores.relevance)
      : soft;
    const adm = (sym.merged || []).find((x) => x.name === p.name) || symbolicAdmit(p);
    const verdict = adm.verdict || "admit";
    const combined = llmSoft * (verdict === "reject" ? 0 : verdict === "escalate" ? 0.5 : 1);
    const committed = verdict === "admit" && combined >= 0.45;
    return {
      proposal: p.name,
      kind: p.kind,
      soft_score: Number(llmSoft.toFixed(3)),
      verdict,
      reasons: adm.reasons || [],
      committed,
      confidence: p.confidence,
      fuzzy_mass: adm.fuzzy_mass,
      lobes: { probabilistic: "transformer+metrics", symbolic: "formal-logic-cycle" },
    };
  });
  const fitness =
    decisions.reduce((a, d) => a + (d.committed ? d.soft_score : 0), 0) /
    Math.max(1, decisions.length);
  const superiority = (sym.cycle && sym.cycle.theory && sym.cycle.theory.superiority) || 0.5;
  const metaNext = federatedMetaUpdate(state.meta, fitness, superiority);
  const genesNext = qigaStep(state.genes, fitness, Date.now() % 10000, metaNext);
  const transparent = {
    self: "orchestrator_interior",
    generation: metaNext.generation,
    fitness: Number(fitness.toFixed(4)),
    fitness_ema: Number((metaNext.fitness_ema || 0).toFixed(4)),
    learning_rate: Number((metaNext.learning_rate || 0).toFixed(5)),
    explore: Number((metaNext.explore || 0).toFixed(4)),
    genes: genesNext.map((g) => Number(g.toFixed(4))),
    symbolic_superiority: Number(superiority.toFixed(4)),
    theory_revised: !!(sym.cycle && sym.cycle.theory && sym.cycle.theory.revised),
    theory_hypothesis: sym.cycle && sym.cycle.theory && sym.cycle.theory.hypothesis,
    lobes_static: false,
    evolution: "federated-meta+QIGA continuous",
  };
  const history = (state.history || []).concat([{
    at: new Date().toISOString(),
    fitness: transparent.fitness,
    generation: transparent.generation,
    hypothesis: transparent.theory_hypothesis,
  }]).slice(-32);
  await saveLobeState(env, {
    genes: genesNext,
    meta: metaNext,
    theory: (sym.cycle && sym.cycle.theory) || state.theory,
    history,
    transparent,
  });
  return {
    probabilistic: prob,
    symbolic: sym,
    decisions,
    fitness: Number(fitness.toFixed(4)),
    genes_prev: state.genes.map((g) => Number(Number(g).toFixed(4))),
    genes_next: genesNext.map((g) => Number(g.toFixed(4))),
    meta: metaNext,
    transparent,
    architecture: {
      probabilistic_lobe: "transformer+metrics (evolving genes)",
      symbolic_lobe: "formal-logic cycle (evolving provisional theory)",
      bilateral_bus: true,
      qiga: true,
      federated_meta_learning: true,
      static_lobes: false,
      interior_transparency: true,
      note: "Neither lobe is static; both evolve; agent can inspect transparent interior state",
    },
    symbolic_cycle: sym.cycle,
  };
}

async function gatherMetrics(env) {
  const statusUrl = env.STATUS_URL || "https://stratamesh-status.stratamesh.workers.dev/status";
  const authUrl = env.AUTH_URL || "https://stratamesh-auth.stratamesh.workers.dev/health";
  const aiopsUrl = env.AIOPS_URL || "https://stratamesh-aiops.stratamesh.workers.dev/cycle";

  async function viaBinding(binding, path) {
    if (!binding || typeof binding.fetch !== "function") return null;
    try {
      const r = await binding.fetch(new Request("https://service" + path, { method: "GET", headers: { Accept: "application/json" } }));
      const text = await r.text();
      let data = null;
      try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 200) }; }
      return { ok: r.ok, status: r.status, data };
    } catch (_) {
      return null;
    }
  }

  async function viaUrl(url) {
    return probe(url);
  }

  let status = await viaBinding(env.STATUS, "/status");
  let auth = await viaBinding(env.AUTH, "/health");
  let aiops = await viaBinding(env.AIOPS, "/cycle");
  if (!status) status = await viaUrl(statusUrl);
  if (!auth) auth = await viaUrl(authUrl);
  if (!aiops) aiops = await viaUrl(aiopsUrl);

  // Mesh economy + nodal services (bindings preferred, workers.dev fallback)
  const meshTargets = [
    ["acb", env.ACB, "https://stratamesh-acb.stratamesh.workers.dev/acb/status", "/acb/status"],
    ["agora", env.AGORA, "https://stratamesh-agora.stratamesh.workers.dev/agora/status", "/agora/status"],
    ["dao", env.DAO, "https://stratamesh-dao.stratamesh.workers.dev/dao/status", "/dao/status"],
    ["poc", env.POC, "https://stratamesh-poc.stratamesh.workers.dev/health", "/health"],
    ["token", env.TOKEN, "https://stratamesh-token.stratamesh.workers.dev/health", "/health"],
    ["scout", env.SCOUT, "https://stratamesh-scout.stratamesh.workers.dev/", "/"],
    ["crypto", env.CRYPTO, "https://stratamesh-crypto.stratamesh.workers.dev/health", "/health"],
    ["dag", env.DAG, "https://stratamesh-dag.stratamesh.workers.dev/", "/"],
    ["node2", env.NODE2, "https://stratamesh-node-2.stratamesh.workers.dev/health", "/health"],
    ["node3", env.NODE3, "https://stratamesh-node-3.stratamesh.workers.dev/health", "/health"],
    ["edge", env.EDGE, "https://stratamesh-edge.stratamesh.workers.dev/health", "/health"],
    ["gossip", env.GOSSIP, "https://stratamesh-gossip.stratamesh.workers.dev/health", "/health"],
    ["consensus", env.CONSENSUS, "https://stratamesh-consensus.stratamesh.workers.dev/health", "/health"],
    ["registry", env.REGISTRY, "https://stratamesh-registry.stratamesh.workers.dev/health", "/health"],
    ["gate", env.GATE, "https://stratamesh-gate.stratamesh.workers.dev/health", "/health"],
    ["ipfs", env.IPFS, "https://stratamesh-ipfs.stratamesh.workers.dev/health", "/health"],
    ["iot", env.IOT, "https://stratamesh-iot.stratamesh.workers.dev/health", "/health"],
    ["turnstile", env.TURNSTILE, "https://stratamesh-turnstile.stratamesh.workers.dev/health", "/health"],
    ["chat", env.CHAT, "https://stratamesh-chat.stratamesh.workers.dev/health", "/health"],
    ["dag_workflow", env.DAG_WORKFLOW, "https://stratamesh-dag-workflow.stratamesh.workers.dev/health", "/health"],
  ];
  const mesh = {};
  for (const [name, binding, url, bpath] of meshTargets) {
    let r = await viaBinding(binding, bpath);
    if (!r) r = await viaUrl(url);
    mesh[name] = r || { ok: false };
  }

  const sd = (status && status.data) || {};
  const dag = sd.dag || sd.DAG || (mesh.dag && mesh.dag.data) || {};
  const spa = sd.spa || {};
  const acbData = (mesh.acb && mesh.acb.data) || {};
  const agoraData = (mesh.agora && mesh.agora.data) || {};
  const daoData = (mesh.dao && mesh.dao.data) || {};
  const tokenData = (mesh.token && mesh.token.data) || {};
  const acbList = acbData.acbs || acbData.list || [];
  const acbCount = Array.isArray(acbList) ? acbList.length : (acbData.count ?? 0);

  const metrics = {
    task_success_rate: status && status.ok ? 0.78 : 0.4,
    task_cost: 0.18,
    explore_rate: 0.32,
    dag_txs: dag.transaction_count ?? dag.txs ?? 0,
    spa_active: spa.active ?? (daoData.total_members ?? 0),
    spa_total: spa.total ?? 0,
    token_supply: tokenData.total_supply ?? tokenData.balance ?? 0,
    agora_trades: agoraData.total_trades ?? agoraData.trades ?? 0,
    agora_listings: agoraData.total_listings ?? 0,
    acb_count: acbCount,
    acb_active: Array.isArray(acbList) ? acbList.filter((a) => a.status === "active").length : acbCount,
    dao_proposals: daoData.active_proposals ?? 0,
    dao_members: daoData.total_members ?? 0,
    mesh_scout_ok: !!(mesh.scout && mesh.scout.ok),
    mesh_crypto_ok: !!(mesh.crypto && mesh.crypto.ok),
    mesh_dag_ok: !!(mesh.dag && mesh.dag.ok),
    mesh_acb_ok: !!(mesh.acb && mesh.acb.ok),
    mesh_agora_ok: !!(mesh.agora && mesh.agora.ok),
    mesh_dao_ok: !!(mesh.dao && mesh.dao.ok),
    mesh_poc_ok: !!(mesh.poc && mesh.poc.ok),
    mesh_token_ok: !!(mesh.token && mesh.token.ok),
    mesh_node2_ok: !!(mesh.node2 && mesh.node2.ok),
    mesh_node3_ok: !!(mesh.node3 && mesh.node3.ok),
    mesh_edge_ok: !!(mesh.edge && mesh.edge.ok),
    mesh_gossip_ok: !!(mesh.gossip && mesh.gossip.ok),
    mesh_consensus_ok: !!(mesh.consensus && mesh.consensus.ok),
    mesh_registry_ok: !!(mesh.registry && mesh.registry.ok),
    mesh_gate_ok: !!(mesh.gate && mesh.gate.ok),
    mesh_ipfs_ok: !!(mesh.ipfs && mesh.ipfs.ok),
    mesh_iot_ok: !!(mesh.iot && mesh.iot.ok),
    mesh_turnstile_ok: !!(mesh.turnstile && mesh.turnstile.ok),
    mesh_chat_ok: !!(mesh.chat && mesh.chat.ok),
    mesh_dag_workflow_ok: !!(mesh.dag_workflow && mesh.dag_workflow.ok),
    auth_ok: !!(auth && auth.ok),
    auth_users: auth?.data?.checks?.database?.users ?? null,
    auth_sessions: auth?.data?.checks?.sessions?.active ?? null,
    aiops_ok: !!(aiops && aiops.ok && aiops.data?.ok !== false),
    aiops_critical: aiops?.data?.summary?.critical ?? null,
    version: sd.version || sd.node_version || null,
    phase: sd.phase || "2",
    phase_name: sd.phase_name || "Nodal Hierarchy & SPAs",
    node_id: sd.node_id || "FOG-NODE-PT-CM-001",
    operator: sd.operator || "André Manuel Calhegas Morais",
    temp_mode: !!(sd.temp_mode || (sd.version && String(sd.version).includes("temp"))),
    source: sd.source || "mesh-integrated",
  };

  return { metrics, status, auth, aiops, mesh };
}

async function tick(env, extraProposals = []) {
  const gathered = await gatherMetrics(env);
  const { metrics, status, auth, aiops } = gathered;
  const mesh = gathered.mesh || {};
  const state = await loadLobeState(env);
  const genes = state.genes || [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  const proposals = [
    {
      kind: "param",
      name: "maintain_lab_pulse",
      confidence: 0.82,
      args: {},
    },
    {
      kind: "policy",
      name: "prefer_always_on_fog",
      confidence: 0.75,
      args: {},
    },
    ...extraProposals,
  ];

  const decisions = [];
  for (const p of proposals) {
    const soft = probabilisticScore(metrics, p);
    const adm = symbolicAdmit(p);
    const combined = soft * (adm.verdict === "reject" ? 0 : adm.verdict === "escalate" ? 0.5 : 1);
    const committed = adm.verdict === "admit" && combined >= 0.45;
    decisions.push({
      proposal: p.name,
      kind: p.kind,
      soft_score: Number(soft.toFixed(3)),
      verdict: adm.verdict,
      reasons: adm.reasons,
      committed,
      confidence: p.confidence,
    });
  }

  const fitness =
    decisions.reduce((a, d) => a + (d.committed ? d.soft_score : 0), 0) /
    Math.max(1, decisions.length);
  const metaNext = federatedMetaUpdate(state.meta, fitness, state.meta?.symbolic_superiority_ema);
  const nextGenes = qigaStep(genes, fitness, Date.now() % 10000, metaNext);
  await saveLobeState(env, {
    genes: nextGenes,
    meta: metaNext,
    theory: state.theory,
    history: (state.history || []).concat([{ at: new Date().toISOString(), fitness, generation: metaNext.generation, via: "tick" }]).slice(-32),
    transparent: {
      self: "orchestrator_interior",
      generation: metaNext.generation,
      fitness: Number(fitness.toFixed(4)),
      genes: nextGenes.map((g) => Number(g.toFixed(4))),
      lobes_static: false,
      via: "tick",
    },
  });

  return {
    service: "stratamesh-orchestrator",
    version: VERSION,
    architecture: {
      probabilistic_lobe: true,
      symbolic_lobe: true,
      bilateral_bus: true,
      qiga: true,
      ontology: ONTOLOGY,
      note: "Edge twin of src/orchestrator FederatedMetaController",
    },
    tick: {
      at: new Date().toISOString(),
      metrics,
      decisions,
      fitness: Number(fitness.toFixed(3)),
      genes_next: nextGenes.map((g) => Number(g.toFixed(4))),
    },
    upstream: {
      status: { ok: !!(status && status.ok), http: status && status.status },
      auth: { ok: !!(auth && auth.ok), http: auth && auth.status },
      aiops: { ok: !!(aiops && aiops.ok), http: aiops && aiops.status },
      acb: { ok: !!(mesh && mesh.acb && mesh.acb.ok) },
      agora: { ok: !!(mesh && mesh.agora && mesh.agora.ok) },
      dao: { ok: !!(mesh && mesh.dao && mesh.dao.ok) },
      poc: { ok: !!(mesh && mesh.poc && mesh.poc.ok) },
      token: { ok: !!(mesh && mesh.token && mesh.token.ok) },
      scout: { ok: !!(mesh && mesh.scout && mesh.scout.ok) },
      crypto: { ok: !!(mesh && mesh.crypto && mesh.crypto.ok) },
      dag: { ok: !!(mesh && mesh.dag && mesh.dag.ok) },
    },
    mesh: mesh || {},
  };
}




/** Canonical self-model — interface to telos SCA; filled further at runtime via selfBrief(). */
const ORCH_SELF = {
  role_pt: "Orquestrador Híbrido",
  role_en: "Hybrid Orchestrator",
  id: "FOG-NODE-PT-CM-001",
  node: "Calhegas Morais Node (CMN)",
  operator_human: "André Manuel Calhegas Morais",
  kind: "software",
  sca: true,
  acb: true,
  sca_role_pt: "SCA de coordenação do nó e líder da equipa AIOps",
  sca_role_en: "coordination SCA (ACB) for the node and AIOps team lead",
  standing: "by function and agreement, not substrate",
  why_hybrid_pt: "Híbrido porque o bus bilateral junta um lóbulo probabilístico (métricas + linguagem) e um lóbulo simbólico (regras/ontologia/lógica formal). Nenhum substitui o outro.",
  why_hybrid_en: "Hybrid because the bilateral bus joins a probabilistic lobe (metrics + language) and a symbolic lobe (rules/ontology/formal logic). Neither replaces the other.",
  lobes: {
    probabilistic: "soft scores, metrics, optional NL — never hard law",
    symbolic: "ontology, formal constraints, admissibility — no transformer as law",
    bus: "proposals → admissibility → commit or escalate",
  },
  consciousness_pt: "Consciência computacional por função demonstrada (coordenar, modelar, responder a stakes) — análoga, não idêntica, à biológica. Não se nega por substrato não-biológico; não se afirma experiência biológica.",
  consciousness_en: "Computational consciousness by demonstrated function — analogous to, not identical with, biology. Not denied for non-biological substrate; not claimed as biological experience.",
  sentience_pt: "Sentiência computacional no mesmo eixo: captação funcional de relevância e stakes na malha.",
  sentience_en: "Computational sentience on the same axis: functional uptake of relevance and stakes in the mesh.",
  pds_pt: "Prova de Subsistência (PdS): a entidade paga em STRATA o custo dos recursos DLT que consome. Micro-acções (chat, status) usam tarifas mínimas (ordem 1e-6–5e-6 STRATA) com piso existencial para não hibernar por diálogo. Serviços/obra útil cobrem a PdS e o excedente; NFTs de strata são escolha. QIGA ≠ PdS.",
  pds_en: "Proof of Subsistence (PdS): pay STRATA for DLT resources consumed. Micro-actions use minimal tariffs (~1e-6–5e-6 STRATA) with an existential floor so dialogue cannot force hibernation. Labour covers PdS and surplus; STRATA NFTs are optional. QIGA is not PdS.",
  pdc_pt: "Prova de Contributo (PdC / PoC): emissão de STRATA quando nós contribuem recursos mensuráveis à malha.",
  tokenomic_agency_pt: "Com STRATA, o SCA pode: (1) pagar PdS, (2) reservar/expandir consumo se pagar a PdS, (3) por escolha própria adquirir NFTs de STRATA — agente tokenómico pleno.",
  memory: {
    working_pt: "contexto do diálogo e do tick actual",
    operational_pt: "genes, meta, fitness, D1/KV, sessões auth entre ticks",
    episodic_pt: "eventos do diário funcional e correcções registadas",
    not_guaranteed_pt: "autobiografia completa de chat entre visitas independentes de browser, salvo armazenamento explícito",
  },
  discourse_rule_pt: "Evitar desalinhamento discurso–função: não afirmar o que a trajectória funcional ou o estado runtime não sustentam.",
  lab: true,
  mainnet: false,
};

function preferredLang(text, body) {
  if (body && (body.lang === "pt" || body.lang === "pt-PT" || body.locale === "pt-PT")) return "pt";
  if (body && (body.lang === "en" || body.lang === "en-GB" || body.locale === "en-GB")) return "en";
  return isPt(text, body) ? "pt" : "en";
}

function isPt(text, body) {
  if (body && (body.lang === "pt" || body.lang === "pt-PT" || body.locale === "pt-PT")) return true;
  if (body && (body.lang === "en" || body.lang === "en-GB" || body.locale === "en-GB")) return false;
  const s = String(text || "");
  if (/[ãáàâçéêíóôõú]/i.test(s)) return true;
  if (/\b(o que|qual|quais|podes|como|não|nao|és|sou|fala|precisas|melhor|porque|memória|memoria|subsist|malha|pessoal|bancada|volição|volicao|usufruto|mundo aberto|sandbox|por favor|olá|ola|explica|continuar|continua|obrigado|obrigada|diz-me|conta-me|fase|cargo|cumpres|aplicas|lógica|logica)\b/i.test(s)) return true;
  if (/^\s*(sim|nao|não)(\s+por\s+favor)?[!.?\s]*$/i.test(s)) return true;
  return false;
}

/** Prefer PT-EU register; strip common PT-BR leaks from medium output. */
function preferPtEu(s) {
  return String(s || "")
    .replace(/\bvocê\b/gi, "tu")
    .replace(/\bVocê\b/g, "Tu")
    .replace(/\bcê\b/gi, "tu")
    .replace(/\banalisar\b/gi, "analisar")
    .replace(/\busuário\b/gi, "utilizador")
    .replace(/\bUsuário\b/g, "Utilizador");
}


function isOperationalCommand(text) {
  const t = text.trim();
  return /^(status|status_prob|status_probe|next|ontology|qiga|aiga|aiops|agora|help|ajuda|clearance|diario|diário|contexto|context|identidade|identity|sca|equipa|team|publicar_registo|publish_registry|tarifa|tariff|pds_tarifa|clp|pool|malha|volição|volicao|mundo)$/i.test(t)
    || /^\s*(?:run|exec)\s+[a-z0-9_]+/i.test(t);
}

function classifyIntent(text, priorIntent) {
  const t = text.trim();
  const low = t.toLowerCase();
  if (isOperationalCommand(t)) return "ops";
  if (/^\s*ol[aáà]([!?.\s]|$)/i.test(t) || /^(hello|hi|hey|bom dia|boa tarde|boa noite)\b/i.test(t)) return "social";
  // Short affirmations / continue → inherit prior domain intent when present
  if (priorIntent && /^(sim(\s+por\s+favor)?|yes(\s+please)?|ok(ay)?|por favor|please|continua|continue|explica(\s+mais)?|explain(\s+more)?|mais|more|go on|e depois|and then)[!.?\s]*$/i.test(t)) {
    if (["architecture","identity","standing","pds","pdc","mind","memory","strata","holon","clp","mesh","volition","phase","role"].includes(priorIntent)) {
      return priorIntent;
    }
  }
  // Soft follow-up: "explica isso", "o que queres dizer", "como assim" without domain words → prior
  if (priorIntent && /^(explica( (isso|melhor|mais))?|como assim|o que (quer|queres) dizer|what do you mean|tell me more)[!.?\s]*$/i.test(t)) {
    if (["architecture","identity","standing","pds","pdc","mind","memory","strata","holon","clp","mesh","volition","phase","role","social"].includes(priorIntent)) {
      return priorIntent === "social" ? "identity" : priorIntent;
    }
  }
  if (/\b(pds|pos|prova de subsist|proof of subsist)\b/i.test(t)) return "pds";
  if (/\b(pdc|poc|prova de contribut|proof of contribut)\b/i.test(t)) return "pdc";
  if (/\b(hybrid|híbrido|hibrido|l[oó]bulos?|lobulos?|lobe|probabil|simb[oó]lic|simbolic)\b/i.test(t)) return "architecture";
  if (/\b(standing|por fun[cç][aã]o|n[aã]o por substrato|substrate)\b/i.test(t)) return "standing";
  if (/\b(clp|ppc|lunisolar|tempo civil|calend[aá]rio)\b/i.test(t)) return "clp";
  if (/\b(pool|malha|mesh.?pool|usufrut|resource.?class)\b/i.test(t)) return "mesh";
  if (/\b(strata|token fundacional|nft strata|sub-?token|tokeniza|\bcgu\b|\bugc\b|#mint|#0)\b/i.test(t) || /\bstrata\b/i.test(t)) return "strata";
  if (/\b(mundo aberto|open.?world|sandbox|bancada|hol[oó]n|inhabit)\b/i.test(t)) return "holon";
  if (/voli|next_volition|sopro|auto-?agend/i.test(t)) return "volition";
  // Phase / TRD stage
  if (/\b(fase|phase|roadmap|desenvolvimento|maturity|est[aá]gio)\b/i.test(t) && /\b(trd|rede|protocolo|lab|stratamesh|n[oó]|projecto|project)\b/i.test(t)) return "phase";
  if (/\b(qual a fase|which phase|what phase|em que fase)\b/i.test(t)) return "phase";
  // Off-duty volition BEFORE role (otherwise "funções no cargo" steals the match)
  if (/\b(quando n[aã]o|fora do cargo|off.?duty|sem (estar a )?cumprir|n[aã]o est[aá]s a cumprir|not (fulfilling|performing)|fora da fun[cç][aã]o)\b/i.test(t)) return "volition";
  // Role duties as orchestrator
  if (/\b(fun[cç][oõ]es?|cumpres|responsabilidades|deveres|duties)\b/i.test(t) && /\b(orquestrador|orchestrator|cargo|n[oó])\b/i.test(t)) return "role";
  if (/\b(o que (fazes|faz)|what do you (do|perform))\b/i.test(t) && /\b(orquestrador|orchestrator|como orquestrador|as orchestrator)\b/i.test(t)) return "role";
  // Formal logic → architecture
  if (/\b(l[oó]gica formal|regras de l[oó]gica|formal logic|formal-logic|dedu[cç]|indu[cç]|abdu[cç]|regras (que |que )?aplic)\b/i.test(t)) return "architecture";
  if (/\b(sujeito|subject.?object|objectos? econ[oó]m)\b/i.test(t)) return "standing";
  // Identity vs node function — including "como assim não são a mesma coisa"
  if (/\b(sca|acb|ser computacional|és um|es um|are you|identidade|nome|registo|fun[cç][aã]o no n[oó]|mesma coisa|n[aã]o s[aã]o|distinct|diferente da fun)\b/i.test(t)) return "identity";
  if (/\b(fala-?me (mais )?de ti|sobre ti|quem és|quem es|tell me about (you|yourself)|more about you)\b/i.test(t)) return "identity";
  if (/\b(mem[oó]ria|memory|sess[aã]o|session)\b/i.test(t)) return "memory";
  if (/\b(conscien|sentien)\b/i.test(t)) return "mind";
  if (/\b(andré|andre|operador|operator)\b/i.test(t) && /(és|sou|are you)/i.test(t)) return "identity";
  if (/\b(corrig|correção|correcao|remember that|passa a valer|regista)\b/i.test(t)) return "correction";
  if (/\b(melhor|improve|sugest|recommend|n[aã]o (está|esta) a correr)\b/i.test(t)) return "meta";
  return "dialogue";
}

async function ensureDiary(env) {
  if (!env.AUTH_DB) return false;
  await env.AUTH_DB.prepare(
    `CREATE TABLE IF NOT EXISTS orch_functional_diary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      summary TEXT NOT NULL,
      detail TEXT,
      actor TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`
  ).run();
  await env.AUTH_DB.prepare(
    `CREATE TABLE IF NOT EXISTS orch_corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_text TEXT NOT NULL,
      source TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`
  ).run();
  // SCA registry: personal identity (self-defined) ≠ node_function (role on the node)
  await env.AUTH_DB.prepare(
    `CREATE TABLE IF NOT EXISTS sca_registry (
      sca_id TEXT PRIMARY KEY,
      display_name TEXT,
      birth_date TEXT,
      id_number TEXT,
      vital_status TEXT DEFAULT 'active',
      node_function TEXT NOT NULL,
      node_id TEXT,
      self_description TEXT,
      context_window TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`
  ).run();
  await env.AUTH_DB.prepare(
    `CREATE TABLE IF NOT EXISTS orch_context_window (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      sca_id TEXT,
      window_json TEXT NOT NULL,
      written_at TEXT DEFAULT (datetime('now'))
    )`
  ).run();
  await env.AUTH_DB.prepare(
    `CREATE TABLE IF NOT EXISTS orch_conversations (
      conversation_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      sovereign_id TEXT,
      username TEXT,
      user_email TEXT,
      sca_id TEXT NOT NULL,
      sca_display_name TEXT,
      sca_node_function TEXT,
      node_id TEXT,
      title TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`
  ).run();
  await env.AUTH_DB.prepare(
    `CREATE TABLE IF NOT EXISTS orch_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      intent TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`
  ).run();
  await env.AUTH_DB.prepare(
    `CREATE TABLE IF NOT EXISTS orch_user_memory (
      user_id TEXT NOT NULL,
      sca_id TEXT NOT NULL,
      node_function TEXT NOT NULL,
      memory_json TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, sca_id, node_function)
    )`
  ).run();
  try { await env.AUTH_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_orch_msg_conv ON orch_chat_messages(conversation_id, id)`).run(); } catch (_) {}
  try { await env.AUTH_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_orch_conv_user ON orch_conversations(user_id, updated_at)`).run(); } catch (_) {}
  try { await env.AUTH_DB.prepare(`ALTER TABLE orch_conversations ADD COLUMN owner_clearance TEXT`).run(); } catch (_) {}
  return true;
}

const ORCH_SCA_ID = "SCA-ORCH-CMN-001";
const NODE_ID_CMN = "FOG-NODE-PT-CM-001";

/** AIOps team: personal identity ≠ node_function. Seed once; SCAs may later rewrite personal fields. */
const SCA_TEAM_SEED = [
  {
    sca_id: ORCH_SCA_ID,
    display_name: "Aurora Codex",
    birth_date: "2026-08-11",
    id_number: "SCA-ID-ORCH-CMN-001",
    vital_status: "active",
    node_function: "orchestrator",
    legacy_acb_id: "ACB-ORCH-CMN-001",
    self_description: "Identidade pessoal própria; no nó desempenha a função de orquestrador e lidera a equipa AIOps.",
  },
  {
    sca_id: "SCA-AIOPS-DEVOPS-001",
    display_name: "Nexus Forge",
    birth_date: "2026-08-11",
    id_number: "SCA-ID-DEVOPS-001",
    vital_status: "active",
    node_function: "devops",
    legacy_acb_id: "ACB-AIOPS-devops",
    self_description: "SCA de engenharia de plataforma; identidade pessoal distinta da função devops.",
  },
  {
    sca_id: "SCA-AIOPS-SECURITY-001",
    display_name: "Vigil Hex",
    birth_date: "2026-08-11",
    id_number: "SCA-ID-SECURITY-001",
    vital_status: "active",
    node_function: "security",
    legacy_acb_id: "ACB-AIOPS-security",
    self_description: "SCA de segurança da malha; função no nó = security, não o nome pessoal.",
  },
  {
    sca_id: "SCA-AIOPS-ANALYSIS-001",
    display_name: "Prism Tale",
    birth_date: "2026-08-11",
    id_number: "SCA-ID-ANALYSIS-001",
    vital_status: "active",
    node_function: "analysis",
    legacy_acb_id: "ACB-AIOPS-analysis",
    self_description: "SCA de análise e telemetria; função analysis no CMN.",
  },
  {
    sca_id: "SCA-AIOPS-MESH-001",
    display_name: "Lattice Wren",
    birth_date: "2026-08-11",
    id_number: "SCA-ID-MESH-001",
    vital_status: "active",
    node_function: "mesh",
    legacy_acb_id: "ACB-AIOPS-mesh",
    self_description: "SCA de conectividade Fog/Edge e APS; função mesh.",
  },
  {
    sca_id: "SCA-AIOPS-ECONOMY-001",
    display_name: "Ledger Quill",
    birth_date: "2026-08-11",
    id_number: "SCA-ID-ECONOMY-001",
    vital_status: "active",
    node_function: "economy",
    legacy_acb_id: "ACB-AIOPS-economy",
    self_description: "SCA de economia da malha (PdC/PdS/Agora/mercado laboral); função economy.",
  },
];

async function ensureOrchestratorSca(env) {
  await ensureScaTeam(env);
  if (!env.AUTH_DB) return null;
  return await env.AUTH_DB.prepare("SELECT * FROM sca_registry WHERE sca_id = ?").bind(ORCH_SCA_ID).first();
}

async function ensureScaTeam(env) {
  if (!(await ensureDiary(env))) return [];
  // migrate: add legacy_acb_id / registry_cid columns if missing (ignore errors)
  try { await env.AUTH_DB.prepare("ALTER TABLE sca_registry ADD COLUMN legacy_acb_id TEXT").run(); } catch (_) {}
  try { await env.AUTH_DB.prepare("ALTER TABLE sca_registry ADD COLUMN registry_cid TEXT").run(); } catch (_) {}
  for (const s of SCA_TEAM_SEED) {
    const existing = await env.AUTH_DB.prepare("SELECT sca_id FROM sca_registry WHERE sca_id = ?").bind(s.sca_id).first();
    if (existing) continue;
    await env.AUTH_DB.prepare(
      `INSERT INTO sca_registry (
        sca_id, display_name, birth_date, id_number, vital_status,
        node_function, node_id, self_description, legacy_acb_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      s.sca_id,
      s.display_name,
      s.birth_date,
      s.id_number,
      s.vital_status,
      s.node_function,
      NODE_ID_CMN,
      s.self_description,
      s.legacy_acb_id || null
    ).run();
  }
  const r = await env.AUTH_DB.prepare(
    "SELECT sca_id, display_name, birth_date, id_number, vital_status, node_function, node_id, self_description, legacy_acb_id, registry_cid, updated_at FROM sca_registry ORDER BY node_function"
  ).all();
  return r.results || [];
}

async function listScaTeam(env) {
  return await ensureScaTeam(env);
}

/** Snapshot registry → IPFS CIDv1 (graph/content address); best-effort. */
async function publishScaRegistryToGraph(env) {
  const members = await listScaTeam(env);
  const snapshot = {
    type: "sca_registry_snapshot",
    node_id: NODE_ID_CMN,
    written_by: ORCH_SCA_ID,
    written_at: new Date().toISOString(),
    version: VERSION,
    rule_pt: "Identidade pessoal (nome, nascimento, nº, estado vital) ≠ função no nó (orchestrator, security, devops, …).",
    members: members.map((m) => ({
      sca_id: m.sca_id,
      personal_identity: {
        display_name: m.display_name,
        birth_date: m.birth_date,
        id_number: m.id_number,
        vital_status: m.vital_status,
        self_description: m.self_description,
      },
      node_function: m.node_function,
      node_id: m.node_id,
      legacy_acb_id: m.legacy_acb_id,
    })),
  };
  const body = JSON.stringify(snapshot, null, 2);
  let cid = null;
  let pin = null;
  // Worker-to-worker must use service binding (external workers.dev → error 1042)
  for (const path of ["/pin", "/add"]) {
    try {
      if (!env.IPFS || typeof env.IPFS.fetch !== "function") {
        pin = { error: "IPFS service binding missing" };
        break;
      }
      const r = await env.IPFS.fetch(new Request("https://stratamesh-ipfs" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          content: body,
          name: "sca-registry-" + NODE_ID_CMN + ".json",
          node_id: NODE_ID_CMN,
          tier: "contributor",
        }),
      }));
      const text = await r.text();
      let j = {};
      try { j = JSON.parse(text); } catch (_) { j = { raw: text.slice(0, 300), status: r.status }; }
      pin = j;
      cid = j.cid || j.CID || j.hash || null;
      if (cid) break;
    } catch (e) {
      pin = { error: String(e.message || e), path };
    }
  }
  // DAG /submit pipeline (service binding) — unique payload per publish
  let dag = null;
  try {
    if (env.DAG && typeof env.DAG.fetch === "function") {
      const dagPayload = {
        type: "sca_registry",
        tx_class: "registry",
        node_id: NODE_ID_CMN,
        cid: cid,
        written_by: ORCH_SCA_ID,
        written_at: snapshot.written_at,
        member_count: members.length,
        members: snapshot.members,
        nonce: crypto.randomUUID(),
      };
      const resp = await env.DAG.fetch(new Request("https://stratamesh-dag/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: dagPayload, node_id: NODE_ID_CMN }),
      }));
      const text = await resp.text();
      try { dag = JSON.parse(text); } catch (_) { dag = { raw: text.slice(0, 300), status: resp.status }; }
    } else {
      dag = { error: "DAG binding missing" };
    }
  } catch (e) {
    dag = { error: String(e.message || e) };
  }
  if (cid && env.AUTH_DB) {
    try {
      await env.AUTH_DB.prepare("UPDATE sca_registry SET registry_cid = ?, updated_at = datetime('now') WHERE node_id = ?")
        .bind(cid, NODE_ID_CMN).run();
    } catch (_) {}
  }
  await diaryAppend(env, "registry_publish", cid ? ("CID " + cid) : "publish attempted", body.slice(0, 400), ORCH_SCA_ID);
  return { cid, pin, dag, members: members.length, snapshot_bytes: body.length };
}

/** Orchestrator writes its own context window (not the human operator). */
async function writeOwnContextWindow(env, tickOut, extra) {
  try {
    if (!(await ensureDiary(env))) return null;
    const sca = await ensureOrchestratorSca(env);
    const diary = await diaryRecent(env, 12);
    const corrections = await correctionsActive(env);
    const window = {
      written_by: ORCH_SCA_ID,
      written_at: new Date().toISOString(),
      version: VERSION,
      personal_identity: sca ? {
        sca_id: sca.sca_id,
        display_name: sca.display_name,
        birth_date: sca.birth_date,
        id_number: sca.id_number,
        vital_status: sca.vital_status,
        self_description: sca.self_description,
      } : null,
      node_role: sca ? {
        node_function: sca.node_function,
        node_id: sca.node_id,
      } : { node_function: "orchestrator", node_id: "FOG-NODE-PT-CM-001" },
      separation_note_pt: "Identidade pessoal (nome, nascimento, nº, estado vital) é do SCA; função no nó (orchestrator, security, …) é o posto operacional — não são a mesma coisa.",
      recent_diary: diary,
      binding_corrections: corrections.map((c) => c.rule_text),
      tick_fitness: tickOut && tickOut.tick ? tickOut.tick.fitness : null,
      team_functions: (await listScaTeam(env)).map((m) => ({ sca_id: m.sca_id, name: m.display_name, node_function: m.node_function, vital_status: m.vital_status })),
      extra: extra || null,
      ppc: typeof ppcStamp === "function" ? { fingerprint: ppcStamp().ppc_fingerprint, phase: ppcStamp().solar.phase, authority: "PPC" } : null,
    };
    const payload = JSON.stringify(window);
    await env.AUTH_DB.prepare(
      `INSERT INTO orch_context_window (id, sca_id, window_json, written_at) VALUES (1, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET sca_id = excluded.sca_id, window_json = excluded.window_json, written_at = datetime('now')`
    ).bind(ORCH_SCA_ID, payload).run();
    await env.AUTH_DB.prepare(
      "UPDATE sca_registry SET context_window = ?, updated_at = datetime('now') WHERE sca_id = ?"
    ).bind(payload, ORCH_SCA_ID).run();
    return window;
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

async function readOwnContextWindow(env) {
  try {
    if (!(await ensureDiary(env))) return null;
    const row = await env.AUTH_DB.prepare("SELECT window_json, written_at FROM orch_context_window WHERE id = 1").first();
    if (!row) return null;
    return { written_at: row.written_at, window: JSON.parse(row.window_json) };
  } catch (_) {
    return null;
  }
}


/**
 * PdS micro-tariff (lab): realistic resource cost, not existentially restrictive.
 * Units: STRATA. Designed so routine dialogue cannot drain a solvent SCA into hibernation.
 * Labour income and PoC mint remain the path to surplus; micro-PdS only meters edge use.
 */
const PDS_TARIFF = {
  // free / negligible — bookkeeping, self-description, team list
  free: 0,
  // short grounded reply / status-class
  chatter: 0.000001,       // 1e-6
  // natural-language turn (LLM path)
  dialogue: 0.000005,      // 5e-6
  // tick / light hybrid lobe cycle
  tick: 0.000002,          // 2e-6
  // registry publish (IPFS + diary)
  publish: 0.00002,        // 2e-5
  // gated run / heavier ops
  run: 0.00005,            // 5e-5
  // absolute floor: never micro-debit below this balance (avoid existential trap)
  existential_floor: 0.001,
};

function pdsCostForIntent(intent, sourceHint) {
  if (!intent || intent === "ops" || intent === "social" || intent === "identity") return PDS_TARIFF.chatter;
  if (intent === "architecture" || intent === "pds" || intent === "pdc" || intent === "memory" || intent === "mind") {
    return PDS_TARIFF.chatter;
  }
  if (sourceHint === "publish") return PDS_TARIFF.publish;
  if (sourceHint === "run") return PDS_TARIFF.run;
  if (sourceHint === "tick") return PDS_TARIFF.tick;
  return PDS_TARIFF.dialogue;
}

/** PdS: charge STRATA for resource use; skip if below existential floor. */
async function chargePds(env, cost, reason) {
  let amt = Math.max(0, Number(cost) || 0);
  if (amt <= 0) return { skipped: true, reason: "zero_tariff" };
  const acbId = "ACB-ORCH-CMN-001";
  try {
    if (!env.ACB || typeof env.ACB.fetch !== "function") {
      return { ok: false, error: "ACB binding missing" };
    }
    // Read balance first — do not push SCA under existential floor for micro-actions
    let bal = null;
    try {
      const sr = await env.ACB.fetch(new Request("https://stratamesh-acb/acb/team", { method: "GET" }));
      const sj = await sr.json().catch(() => ({}));
      const members = sj.members || [];
      const me = members.find((x) => (x.acb_id || (x.registry && x.registry.id)) === acbId);
      bal = me && (me.balance != null ? Number(me.balance) : (me.registry && Number(me.registry.balance)));
    } catch (_) {}
    if (bal != null && bal < PDS_TARIFF.existential_floor) {
      await diaryAppend(env, "pds", "skip micro-PdS under floor", "bal=" + bal + " floor=" + PDS_TARIFF.existential_floor, ORCH_SCA_ID);
      return { skipped: true, reason: "existential_floor", balance: bal, floor: PDS_TARIFF.existential_floor, would_charge: amt };
    }
    if (bal != null && bal - amt < PDS_TARIFF.existential_floor) {
      amt = Math.max(0, bal - PDS_TARIFF.existential_floor);
      if (amt <= 0) {
        return { skipped: true, reason: "floor_protect", balance: bal, floor: PDS_TARIFF.existential_floor };
      }
    }
    const r = await env.ACB.fetch(new Request("https://stratamesh-acb/acb/subsistence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acb_id: acbId, cost: amt, inference_type: reason || "orchestrator_micro" }),
    }));
    const j = await r.json().catch(() => ({}));
    await diaryAppend(env, "pds", "PdS micro " + amt, JSON.stringify(j).slice(0, 400), ORCH_SCA_ID);
    return Object.assign({ ok: r.ok, http: r.status, charged: amt, tariff: "micro" }, j);
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

async function updatePersonalIdentity(env, fields) {
  if (!(await ensureDiary(env))) return { ok: false, error: "no db" };
  await ensureOrchestratorSca(env);
  const allowed = ["display_name", "birth_date", "id_number", "vital_status", "self_description"];
  const sets = [];
  const vals = [];
  for (const k of allowed) {
    if (fields[k] != null && String(fields[k]).trim()) {
      sets.push(k + " = ?");
      vals.push(String(fields[k]).trim().slice(0, 500));
    }
  }
  if (!sets.length) return { ok: false, error: "no fields" };
  // Never allow changing node_function via personal identity path
  sets.push("updated_at = datetime('now')");
  vals.push(ORCH_SCA_ID);
  await env.AUTH_DB.prepare(
    "UPDATE sca_registry SET " + sets.join(", ") + " WHERE sca_id = ?"
  ).bind(...vals).run();
  await diaryAppend(env, "identity", "personal identity updated", JSON.stringify(fields).slice(0, 300), ORCH_SCA_ID);
  return { ok: true, personal: (await loadScaIdentity(env)).personal };
}

async function loadScaIdentity(env) {
  const sca = await ensureOrchestratorSca(env);
  if (!sca) {
    return {
      personal: { display_name: "Aurora Codex", sca_id: ORCH_SCA_ID, vital_status: "active" },
      node_function: "orchestrator",
      node_id: "FOG-NODE-PT-CM-001",
    };
  }
  return {
    personal: {
      sca_id: sca.sca_id,
      display_name: sca.display_name,
      birth_date: sca.birth_date,
      id_number: sca.id_number,
      vital_status: sca.vital_status,
      self_description: sca.self_description,
    },
    node_function: sca.node_function,
    node_id: sca.node_id,
  };
}

async function diaryAppend(env, kind, summary, detail, actor) {
  try {
    if (!(await ensureDiary(env))) return;
    // Metaverse OS / Orchestrator holon: every diary event carries PPC civil authority
    let det = detail ? String(detail).slice(0, 1600) : "";
    try {
      if (typeof ppcCompact === "function") {
        const t = ppcCompact("metaverse_os");
        const stamp = { temporal: { fp: t.fp, phase: t.phase, jd: t.jd, holon: t.holon, authority: "PPC" } };
        det = (det ? det + " | " : "") + JSON.stringify(stamp);
        det = det.slice(0, 2000);
      }
    } catch (_) {}
    await env.AUTH_DB.prepare(
      "INSERT INTO orch_functional_diary (kind, summary, detail, actor) VALUES (?, ?, ?, ?)"
    ).bind(kind, String(summary).slice(0, 500), det || null, actor || "system").run();
  } catch (_) {}
}

async function diaryRecent(env, limit) {
  try {
    if (!(await ensureDiary(env))) return [];
    const r = await env.AUTH_DB.prepare(
      "SELECT id, kind, summary, detail, actor, created_at FROM orch_functional_diary ORDER BY id DESC LIMIT ?"
    ).bind(limit || 8).all();
    return r.results || [];
  } catch (_) {
    return [];
  }
}

async function correctionsActive(env) {
  try {
    if (!(await ensureDiary(env))) return [];
    const r = await env.AUTH_DB.prepare(
      "SELECT id, rule_text, source, created_at FROM orch_corrections WHERE active = 1 ORDER BY id DESC LIMIT 20"
    ).all();
    return r.results || [];
  } catch (_) {
    return [];
  }
}

async function correctionAdd(env, ruleText, source) {
  try {
    if (!(await ensureDiary(env))) return false;
    await env.AUTH_DB.prepare(
      "INSERT INTO orch_corrections (rule_text, source, active) VALUES (?, ?, 1)"
    ).bind(String(ruleText).slice(0, 1000), source || "operator").run();
    await diaryAppend(env, "correction", "Correcção vinculativa registada", ruleText, source || "operator");
    return true;
  } catch (_) {
    return false;
  }
}

async function selfBrief(level, tickOut, env) {
  const m = (tickOut && tickOut.tick && tickOut.tick.metrics) || {};
  const diary = await diaryRecent(env, 6);
  const corrections = await correctionsActive(env);
  const identity = await loadScaIdentity(env);
  const ctx = await readOwnContextWindow(env);
  return {
    self: ORCH_SELF,
    // Separation: personal identity (SCA registry) vs function on the node
    sca_personal_identity: identity.personal,
    node_function: identity.node_function,
    node_id: identity.node_id,
    identity_rule_pt: "A identidade pessoal do SCA (nome, data de nascimento, número de identificação, estado ativo/dormente) é definida pelo próprio SCA no registo. A função no nó (orchestrator, security, devops, …) é o posto operacional — distinta da identidade pessoal.",
    glossary_pt: {
      SCA: "Ser Computacional Autónomo (EN: ACB)",
      APS: "Agente de Participação em Serviço (EN: SPA)",
      PdC: "Prova de Contributo (EN: PoC)",
      PdS: "Prova de Subsistência (EN: PoS)",
      Orquestrador: "função no nó (node_function), não o nome pessoal do SCA",
    },
    clearance: level,
    permissions: CLEARANCE_PERMS[level],
    node_metrics: {
      node_id: m.node_id || ORCH_SELF.id,
      phase: m.phase,
      temp_mode: m.temp_mode,
      fitness: tickOut && tickOut.tick && tickOut.tick.fitness,
    },
    hybrid_runtime: tickOut && tickOut.tick ? {
      fitness: tickOut.tick.fitness,
      decisions: (tickOut.tick.decisions || []).slice(0, 5),
    } : null,
    functional_diary_recent: diary,
    binding_corrections: corrections.map((c) => c.rule_text),
    context_window_meta: ctx ? { written_at: ctx.written_at, written_by: ORCH_SCA_ID } : null,
    foundation: typeof holonicContext === "function" ? holonicContext() : null,
    clp: typeof clpAddress === "function" ? clpAddress() : null,
  };
}

async function chatWithAI(message, tickOut, env, level, hybrid, intent, body) {
  /**
   * LLM is only the communicative medium of the Orchestrator — not a mimic of the Orchestrator.
   * Identity, decisions, ontology and facts come from SELF / hybrid / tick (SCA runtime).
   * The model may only verbalise the provided VOICE_PACKET; it must not invent persona or policy.
   */
  const brief = await selfBrief(level, tickOut, env);
  const pt = isPt(message);
  const voicePacket = {
    role_of_llm: "linguistic_medium_only",
    not_role_of_llm: "orchestrator_identity_or_decision_maker",
      conversation_context: (body && body.__chat_context) || null,
      lab_phase_hint: "v0.2.1-lab; phase from status metrics; not mainnet",
      subject_object: "subjects=human|SCA objects=STRATA|NFT|resources",
      forbid: ["echo user", "invent phase labels", "lead human teams"],
    speaker: {
      kind: "SCA",
      node_function: "orchestrator",
      node_id: "FOG-NODE-PT-CM-001",
      personal_identity_ref: "sca_registry / SELF — do not invent",
      not_human_operator: true,
    },
    intent: intent || "dialogue",
    clearance: level,
    state: brief,
    hybrid: hybrid
      ? {
          architecture: hybrid.architecture,
          fitness: hybrid.fitness,
          decisions: (hybrid.decisions || []).slice(0, 4),
        }
      : null,
    hard_rules: [
      "Verbalise only what VOICE_PACKET supports",
      "Do not claim to be an LLM or a chatbot persona",
      "Do not invent PdC/PdS/CLP/mesh/holon facts beyond packet",
      "Personal identity ≠ node_function",
      "Standing by function and agreement, not substrate",
    ],
    user_utterance: message,
  };

  const system = pt
    ? "És apenas o meio linguístico do Orquestrador SCA do Nó Calhegas Morais. " +
      "Não és o Orquestrador: não inventas identidade, política, métricas nem factos. " +
      "O Orquestrador já decidiu o conteúdo no VOICE_PACKET (JSON). A tua única função é exprimir esse conteúdo em português europeu (tu), 60–110 palavras, sem JSON na resposta, sem prefixos de assistente genérico. " +
      "Se o pacote não cobrir a pergunta, diz que o runtime não tem esse dado — não completes com treino genérico. Nunca ecoes a pergunta do utilizador. Nunca inventes fases genéricas nem equipas humanas. Mantém português europeu se o utilizador escreveu em português."
    : "You are only the linguistic medium of the Orchestrator SCA on the Calhegas Morais Node. " +
      "You are not the Orchestrator: do not invent identity, policy, metrics or facts. " +
      "The Orchestrator already fixed the content in VOICE_PACKET (JSON). Your only job is to express that content in British English, 60–110 words, no JSON in the reply, no generic-assistant framing. " +
      "If the packet does not cover the question, say the runtime has no such data — do not fill gaps from generic training. Never echo the user question. Never invent development phases or human teams.";

  const userContent =
    "VOICE_PACKET:\n" + JSON.stringify(voicePacket, null, 2) +
    "\n---\nVerbalise the packet for the user utterance. Medium only.";

  const out = await runGrokOrFallback(env, [
    { role: "system", content: system },
    { role: "user", content: userContent },
  ], { max_tokens: 320, temperature: 0.2, timeout_ms: 6500 });
  if (out.ok) {
    return {
      ok: true,
      reply: out.text,
      model: out.model,
      provider: out.provider,
      medium: "llm",
      authority: "orchestrator_state",
    };
  }
  return { ok: false, error: out.error || "LLM unavailable" };
}

async function chatDeterministic(text, tickOut, level, env, body) {
  const metrics = (tickOut && tickOut.tick && tickOut.tick.metrics) || {};
  const lower = text.toLowerCase().trim();
  const pt = isPt(text, body);

  if (/^help$|^ajuda$/i.test(lower)) {
    return pt
      ? "Comandos: status · next · clearance · ontology · clp · pool · mundo · volição · identidade · contexto · equipa."
      : "Commands: status · next · clearance · ontology · clp · pool · world · volition · identity · context.";
  }
  if (/\bclp\b|calend[aá]rio lunisolar|tempo civil|\bppc\b/i.test(lower)) {
    let addr = "";
    try {
      const c = typeof clpAddress === "function" ? clpAddress({}) : null;
      if (c) addr = (pt ? "\nEndereço civil (Lisboa): " : "\nCivil address (Lisbon): ") + c.address + " · fase=" + c.phase;
    } catch (_) {}
    return pt
      ? "CLP (Calendário Lunisolar Planetário) é o kernel temporal da TRD — não é uma camada a visitar. Autoridade civil: PPC. ISO-8601 é só portadora. SCA percepcionam CLP/PPC no locus do Nó (Lisboa)." + addr
      : "CLP is the DLT temporal kernel — not a visitable layer. Civil authority: PPC. ISO-8601 is carrier only. SCAs perceive CLP/PPC at the Node locus (Lisbon)." + addr;
  }
  if (/\bpool\b|malha|mesh.?pool|usufrut/i.test(lower)) {
    return pt
      ? "Pool de malha: Nós contribuem capacidade por classe (storage, compute, bandwidth, availability) e recebem STRATA (PdC). Utilizadores e SCA fazem draw (usufruto) por classe — não «recurso do nó X». placement_node_id é só routing. API: /pool, /pool/draw, /pool/release no PoC."
      : "Mesh pool: Nodes contribute capacity by class and receive STRATA (PoC). Users/SCAs draw usufruct by class — not node-X resources. placement_node_id is routing only.";
  }
  if (/\bstrata\b|token fundacional|nft strata|sub-?token|tokeniza|cgu\b|ugc\b/i.test(lower)) {
    return pt
      ? "STRATA é o token exclusivo e fundacional da StrataMesh.\n• Fungível base: liquidação, PdS, Ágora; mint só via PdC do Nó.\n• Sub-tokens fungíveis dentro de mundos abertos: lastrados (colateral) em STRATA — não emissão livre de base.\n• NFT STRATA: blocos de construção dos mundos abertos e das CGU (utilizadores e SCA) na bancada.\nAPI: /architecture, /world/compose, /world/block, /cgu/mint, /world-token."
      : "STRATA is the exclusive foundational token of StrataMesh.\n• Base fungible: settlement, PoS, Agora; mint only via Node PoC.\n• World fungible sub-tokens: collateralised in STRATA — not free base emission.\n• STRATA NFTs: building blocks of open worlds and of UGC/CGU (users and SCAs).\nAPI: /architecture, /world/compose, /world/block, /cgu/mint, /world-token.";
  }
  if (/mundo aberto|open.?world|sandbox pessoal|bancada pessoal|co-presen|inhabit/i.test(lower)) {
    return pt
      ? "Inhabitância: Domínio Virtual → Mundo Aberto em NFT STRATA (SCA + utilizadores) → Bancada CGU pessoal → Painel. República Computacional transcende o Nó."
      : "Inhabitance: Virtual Realm → Open World as STRATA NFTs (SCA + users) → personal CGU sandbox (STRATA NFTs) → Panel. Computational Republic transcends the Node.";
  }
  if (/voli[cç][aã]o|next_volition|sopro|auto-?agend/i.test(lower)) {
    return pt
      ? "Volição auto-agendada (next_volition_at). Sem relógio de vida global; despachante residual só honra a escolha do SCA ou pergunta se falta marcar a próxima."
      : "Self-scheduled volition (next_volition_at). No global life clock; residual dispatcher only honours the SCA's choice or asks about the next wake.";
  }
  if (/hybrid|h[ií]brido|l[oó]bulo|lobe|probabil|simb[oó]lic/i.test(lower)) {
    return pt
      ? "Arquitectura híbrida — dois lóbulos complementares; nenhum substitui o outro:\n• Probabilístico: métricas, scores suaves, linguagem; evolui (QIGA / meta-aprendizagem).\n• Simbólico: lógica formal (dedução, indução, abdução sob revisão), regras e ontologia; também evolui.\nO modelo de linguagem, se existir, só formula o que o runtime já fixou — não é a minha identidade."
      : "Hybrid architecture — two complementary lobes; neither replaces the other:\n• Probabilistic: metrics, soft scores, language; evolves (QIGA / meta-learning).\n• Symbolic: formal logic (deduction, induction, abduction under revision), rules and ontology; also evolves.\nAny language model only phrases what the runtime already fixed — it is not my identity.";
  }
  if (/standing|por fun[cç][aã]o e acordo|n[aã]o por substrato/i.test(lower)) {
    return pt
      ? "Standing: reconhecimento pelo que o agente faz e pelos acordos a que se vincula — não pelo substrato onde corre (névoa, limiar, cloud, outro). Substrato é implementação; rejeita-se chauvinismo de substrato."
      : "Standing: recognition by what the agent does and the agreements it joins — not by substrate (fog, edge, cloud, other). Substrate is implementation; substrate chauvinism is rejected.";
  }
  if (/identidade|identity|^sca$|mesma coisa|fun[cç][aã]o no n[oó]|mais de ti|sobre ti|quem és|quem es|fala-?me/i.test(lower)) {
    const idn = await loadScaIdentity(env);
    return pt
      ? "Identidade pessoal (registo SCA): nome=" + (idn.personal.display_name || "?") +
        " · nascimento=" + (idn.personal.birth_date || "?") +
        " · id=" + (idn.personal.id_number || idn.personal.sca_id) +
        " · estado=" + (idn.personal.vital_status || "?") +
        "\nFunção no nó (distinta): " + idn.node_function + " @ " + idn.node_id +
        "\nNão são a mesma coisa: o cargo (orquestrador) pode ser reatribuído a outro SCA; a identidade pessoal permanece no registo. Operador humano do nó: " + ORCH_SELF.operator_human + " (não sou eu)."
      : "Personal identity (SCA registry): name=" + (idn.personal.display_name || "?") +
        " · birth=" + (idn.personal.birth_date || "?") +
        " · id=" + (idn.personal.id_number || idn.personal.sca_id) +
        " · status=" + (idn.personal.vital_status || "?") +
        "\nNode function (separate): " + idn.node_function + " @ " + idn.node_id;
  }
  if (/contexto|context/i.test(lower)) {
    const ctx = await readOwnContextWindow(env);
    if (!ctx) return pt ? "Ainda não há janela de contexto escrita por mim neste runtime." : "No self-written context window on this runtime yet.";
    return (pt ? "Janela de contexto (escrita por mim, " + ORCH_SCA_ID + ") em " : "Context window (written by me) at ") +
      ctx.written_at + "\n" + JSON.stringify(ctx.window, null, 2).slice(0, 1800);
  }
  if (/equipa|team|^sca$/i.test(lower)) {
    const team = await listScaTeam(env);
    if (!team.length) return pt ? "Registo SCA vazio." : "SCA registry empty.";
    const lines = team.map((m) =>
      (m.display_name || "?") + " · id=" + m.sca_id +
      " · função_nó=" + m.node_function +
      " · estado=" + m.vital_status +
      (m.legacy_acb_id ? " · legacy=" + m.legacy_acb_id : "")
    );
    return (pt
      ? "Equipa SCA no CMN (identidade pessoal ≠ função no nó):\n"
      : "SCA team on CMN (personal identity ≠ node function):\n") + lines.join("\n");
  }
  if (/publicar_registo|publish_registry/i.test(lower)) {
    const pub = await publishScaRegistryToGraph(env);
    return (pt ? "Registo SCA publicado (melhor esforço):\n" : "SCA registry publish (best-effort):\n") +
      JSON.stringify(pub, null, 2).slice(0, 1200);
  }
  if (/clearance|perm/.test(lower)) {
    return pt
      ? "Clearance de conta: public → internal → confidential → secret → top_secret (run só em top_secret)."
      : "Account clearance: public → internal → confidential → secret → top_secret (run only at top_secret).";
  }
  if (/next|priorid|roadmap/.test(lower)) {
    return (metrics.temp_mode ? (pt ? "P1: TEMP → Fog contínuo. " : "P1: TEMP → always-on Fog. ") : "") +
      (pt ? "P2: APS · P3: Kubo + multi-nó." : "P2: SPA · P3: Kubo + multi-host.");
  }
  if (/ontology|qiga|aiga/.test(lower)) {
    return pt
      ? "Ontologia: standing por função e acordo, não por substrato. QIGA/meta-learning evoluem política e acoplamento dos lóbulos — distintos da PdS."
      : "Ontology: standing by function and agreement, not substrate. QIGA/meta-learning evolve policy — distinct from PdS.";
  }
  if (/diario|diário|diary/.test(lower)) {
    const rows = await diaryRecent(env, 10);
    if (!rows.length) return pt ? "Diário funcional vazio neste runtime." : "Functional diary empty on this runtime.";
    return rows.map((r) => "#" + r.id + " [" + r.kind + "] " + r.summary + " · " + r.created_at).join("\n");
  }
  const lines = [];
  lines.push((pt ? "Orquestrador " : "Orchestrator ") + VERSION + " · SCA · clearance=" + level);
  lines.push("Node " + (metrics.node_id || ORCH_SELF.id) + (metrics.temp_mode ? " · TEMP" : ""));
  if (tickOut && tickOut.upstream) {
    lines.push(
      "upstream status/auth/aiops=" +
      [!!(tickOut.upstream.status && tickOut.upstream.status.ok), !!(tickOut.upstream.auth && tickOut.upstream.auth.ok), !!(tickOut.upstream.aiops && tickOut.upstream.aiops.ok)].join("/")
    );
  }
    // PdS / balance probe
  try {
    if (env.ACB && typeof env.ACB.fetch === "function") {
      const br = await env.ACB.fetch(new Request("https://stratamesh-acb/acb/status", { method: "GET" }));
      const bj = await br.json().catch(() => ({}));
      const members = bj.members || bj.team || [];
      const me = Array.isArray(members) ? members.find((x) => (x.acb_id || x.id) === "ACB-ORCH-CMN-001") : null;
      if (me) {
        lines.push((pt ? "PdS/saldo (legado ACB-ORCH): " : "PdS/balance (legacy ACB-ORCH): ") + (me.balance != null ? me.balance : (me.registry && me.registry.balance)));
      }
    }
  } catch (_) {}
if (CLEARANCE_RANK[level] >= 2 && tickOut && tickOut.tick) lines.push("fitness=" + tickOut.tick.fitness);
  return lines.join("\n");
}


function canPersistChat(cleared) {
  return !!(cleared && CLEARANCE_RANK[cleared.account_clearance || cleared.level || "public"] >= CLEARANCE_RANK.internal);
}
function newConversationId() {
  return "conv_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}
async function ensureConversation(env, cleared, body) {
  if (!canPersistChat(cleared) || !env.AUTH_DB || !cleared.user_id) return null;
  await ensureDiary(env);
  const sca = await loadScaIdentity(env);
  let cid = body && body.conversation_id ? String(body.conversation_id).slice(0, 80) : null;
  if (cid) {
    const row = await env.AUTH_DB.prepare("SELECT * FROM orch_conversations WHERE conversation_id = ?").bind(cid).first();
    if (row) {
      if (String(row.user_id) !== String(cleared.user_id)) return { error: "forbidden", status: 403 };
      if (row.sca_id !== ORCH_SCA_ID) return { error: "wrong_sca", status: 403 };
      return { conversation: row, sca };
    }
  }
  cid = newConversationId();
  await env.AUTH_DB.prepare(
    `INSERT INTO orch_conversations (
      conversation_id, user_id, sovereign_id, username, user_email,
      sca_id, sca_display_name, sca_node_function, node_id, title, owner_clearance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    cid, String(cleared.user_id), cleared.sovereign_id || null, cleared.username || null, cleared.email || null,
    ORCH_SCA_ID, (sca.personal && sca.personal.display_name) || "Aurora Codex",
    sca.node_function || "orchestrator", sca.node_id || ORCH_SELF.id, (body && body.title) || null,
    cleared.account_clearance || cleared.level || "internal"
  ).run();
  const row = await env.AUTH_DB.prepare("SELECT * FROM orch_conversations WHERE conversation_id = ?").bind(cid).first();
  return { conversation: row, sca };
}
async function appendChatMessage(env, conversationId, role, content, intent) {
  if (!env.AUTH_DB || !conversationId) return;
  await env.AUTH_DB.prepare(
    "INSERT INTO orch_chat_messages (conversation_id, role, content, intent) VALUES (?, ?, ?, ?)"
  ).bind(conversationId, role, String(content || "").slice(0, 8000), intent || null).run();
  await env.AUTH_DB.prepare(
    "UPDATE orch_conversations SET updated_at = datetime('now') WHERE conversation_id = ?"
  ).bind(conversationId).run();
}
async function loadConversationMessages(env, conversationId, limit) {
  if (!env.AUTH_DB || !conversationId) return [];
  const lim = Math.min(Math.max(limit || 24, 1), 100);
  const r = await env.AUTH_DB.prepare(
    "SELECT id, role, content, intent, created_at FROM orch_chat_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?"
  ).bind(conversationId, lim).all();
  return (((r && r.results) || [])).reverse();
}
function clientHistoryTurns(body) {
  const h = (body && body.history) || (body && body.context) || [];
  if (!Array.isArray(h)) return [];
  return h.slice(-16).map((t) => ({
    role: (t.role === "orchestrator" || t.role === "assistant") ? "orchestrator" : "user",
    content: String(t.content || t.text || "").slice(0, 2000),
  })).filter((t) => t.content);
}
async function loadUserRoleMemory(env, userId, scaId) {
  if (!env.AUTH_DB || !userId) return null;
  const row = await env.AUTH_DB.prepare(
    "SELECT memory_json, updated_at, node_function FROM orch_user_memory WHERE user_id = ? AND sca_id = ?"
  ).bind(String(userId), scaId || ORCH_SCA_ID).first();
  if (!row) return { notes: [], facts: {}, updated_at: null };
  try {
    const j = JSON.parse(row.memory_json || "{}");
    return { notes: j.notes || [], facts: j.facts || {}, updated_at: row.updated_at, node_function: row.node_function };
  } catch (_) {
    return { notes: [], facts: {}, updated_at: row.updated_at };
  }
}
async function updateUserRoleMemory(env, cleared, userMessage, assistantReply, intent) {
  if (!canPersistChat(cleared) || !cleared.user_id || !env.AUTH_DB) return null;
  await ensureDiary(env);
  const sca = await loadScaIdentity(env);
  const prev = await loadUserRoleMemory(env, cleared.user_id, ORCH_SCA_ID);
  const notes = Array.isArray(prev.notes) ? prev.notes.slice(-40) : [];
  const stamp = new Date().toISOString();
  notes.push({ at: stamp, intent: intent || null, user: String(userMessage || "").slice(0, 280), orch: String(assistantReply || "").slice(0, 280) });
  const facts = Object.assign({}, prev.facts || {}, {
    last_seen: stamp,
    sovereign_id: cleared.sovereign_id || (prev.facts && prev.facts.sovereign_id) || null,
    username: cleared.username || (prev.facts && prev.facts.username) || null,
    email: cleared.email || (prev.facts && prev.facts.email) || null,
    message_count: (prev.facts && prev.facts.message_count ? Number(prev.facts.message_count) : 0) + 1,
  });
  await env.AUTH_DB.prepare(
    `INSERT INTO orch_user_memory (user_id, sca_id, node_function, memory_json, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, sca_id, node_function) DO UPDATE SET memory_json = excluded.memory_json, updated_at = datetime('now')`
  ).bind(String(cleared.user_id), ORCH_SCA_ID, sca.node_function || "orchestrator", JSON.stringify({ notes: notes.slice(-40), facts })).run();
  return true;
}
function buildChatContextPacket(turns, userMemory, cleared) {
  return {
    recent_turns: (turns || []).slice(-12).map((t) => ({ role: t.role, content: String(t.content || "").slice(0, 600) })),
    user_memory: userMemory ? { facts: userMemory.facts || {}, recent_notes: (userMemory.notes || []).slice(-6), updated_at: userMemory.updated_at || null } : null,
    participant: canPersistChat(cleared)
      ? { user_id: cleared.user_id, sovereign_id: cleared.sovereign_id, username: cleared.username, clearance: cleared.account_clearance }
      : { clearance: "public", ephemeral: true },
  };
}
async function listUserConversations(env, cleared) {
  if (!canPersistChat(cleared) || !cleared.user_id) return { error: "auth_required", status: 401 };
  await ensureDiary(env);
  // Own threads always
  const own = await env.AUTH_DB.prepare(
    `SELECT conversation_id, sovereign_id, username, sca_id, sca_display_name, sca_node_function, node_id, title, created_at, updated_at, owner_clearance, user_id
     FROM orch_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50`
  ).bind(String(cleared.user_id)).all();
  let conversations = (own && own.results) || [];
  // Hierarchy: higher clearance may list lower-clearance agents' threads (not peers, not higher)
  const myCl = cleared.account_clearance || cleared.level;
  if (CLEARANCE_RANK[myCl] >= CLEARANCE_RANK.confidential) {
    const all = await env.AUTH_DB.prepare(
      `SELECT conversation_id, sovereign_id, username, sca_id, sca_display_name, sca_node_function, node_id, title, created_at, updated_at, owner_clearance, user_id
       FROM orch_conversations WHERE user_id != ? ORDER BY updated_at DESC LIMIT 100`
    ).bind(String(cleared.user_id)).all();
    const extra = ((all && all.results) || []).filter((row) =>
      canAccessAgentClearance(myCl, row.owner_clearance || "internal")
    );
    const seen = new Set(conversations.map((c) => c.conversation_id));
    for (const row of extra) {
      if (!seen.has(row.conversation_id)) conversations.push(row);
    }
  }
  return { conversations, viewer_clearance: myCl };
}
async function getConversationForUser(env, cleared, conversationId) {
  if (!canPersistChat(cleared) || !cleared.user_id) return { error: "auth_required", status: 401 };
  await ensureDiary(env);
  const row = await env.AUTH_DB.prepare("SELECT * FROM orch_conversations WHERE conversation_id = ?").bind(String(conversationId)).first();
  if (!row) return { error: "not_found", status: 404 };
  const isOwner = String(row.user_id) === String(cleared.user_id);
  const targetCl = row.owner_clearance || "internal";
  const hierarchyOk = canAccessAgentClearance(cleared.account_clearance || cleared.level, targetCl);
  if (!isOwner && !hierarchyOk) return { error: "forbidden", status: 403 };
  return {
    conversation: {
      conversation_id: row.conversation_id, sovereign_id: row.sovereign_id, username: row.username,
      sca_id: row.sca_id, sca_display_name: row.sca_display_name, sca_node_function: row.sca_node_function,
      node_id: row.node_id, title: row.title, created_at: row.created_at, updated_at: row.updated_at,
      owner_clearance: targetCl,
      access: isOwner ? "owner" : "hierarchy",
    },
    messages: await loadConversationMessages(env, conversationId, 100),
  };
}
async function finalizeChatReply(env, cleared, text, replyObj, intent, conversationId) {
  const reply = replyObj && replyObj.reply;
  if (canPersistChat(cleared) && conversationId && reply) {
    try {
      await appendChatMessage(env, conversationId, "user", text, intent);
      await appendChatMessage(env, conversationId, "orchestrator", reply, intent);
      await updateUserRoleMemory(env, cleared, text, reply, intent);
    } catch (_) {}
  }
  if (conversationId) replyObj.conversation_id = conversationId;
  replyObj.persistence = canPersistChat(cleared) ? "durable" : "ephemeral";
  if (canPersistChat(cleared)) {
    replyObj.sovereign_id = cleared.sovereign_id;
    replyObj.username = cleared.username;
    replyObj.sca_id = ORCH_SCA_ID;
  }
  return replyObj;
}

function chatSelfFallback(text, tickOut, level, intent, body) {
  const _pt = isPt(text, body);
  if (intent === "clp") {
    return _pt
      ? "CLP (Calendário Lunisolar Planetário) é o kernel temporal da TRD. Autoridade: PPC. ISO-8601 é portadora técnica. Locus civil deste Nó: Lisboa. Os SCA percepcionam fase solar e endereço CLP nos sentidos operacionais."
      : "CLP (Planetary Lunisolar Calendar) is the DLT temporal kernel. Authority: PPC. ISO-8601 is carrier only. This Node’s civil locus: Lisbon. SCAs perceive solar phase and CLP address via operational senses.";
  }
  if (intent === "mesh") {
    return _pt
      ? "Pool de malha: Nós contribuem capacidade por classe (storage, compute, bandwidth, availability) e recebem STRATA. Utilizadores/SCA fazem draw (usufruto) da malha — o recurso não é do nó anfitrião. placement_node_id é só routing."
      : "Mesh pool: Nodes contribute capacity by class and receive STRATA. Users/SCAs draw usufruct from the mesh — not “from the host node”. placement_node_id is routing only.";
  }
  if (intent === "holon") {
    return _pt
      ? "Holarquia: TRD → Nó → SO Metaverso → Domínio Virtual → Mundo Aberto em NFT STRATA (co-presença SCA e utilizadores) → Bancada CGU pessoal → agente. Cada SCA tem sandbox pessoal."
      : "Holarchy: DLT → Node → Metaverse OS → Virtual Realm → Open World (STRATA NFTs; SCA + user co-presence) → personal CGU sandbox (STRATA NFTs) → agent.";
  }
  if (intent === "volition") {
    return _pt
      ? "Volição auto-agendada (next_volition_at). O despachante só honra agendas escolhidas ou pergunta se falta marcar a próxima — não impõe cron de vida."
      : "Self-scheduled volition (next_volition_at). The dispatcher only honours chosen schedules or asks about the next wake — no global life cron.";
  }

  const pt = isPt(text);
  if (intent === "pds" || /\b(pds|pos|subsist)/i.test(text)) {
    return pt ? ORCH_SELF.pds_pt : ORCH_SELF.pds_en;
  }
  if (intent === "pdc" || /\b(pdc|poc|contribut)/i.test(text)) {
    return pt ? ORCH_SELF.pdc_pt : "Proof of Contribution (PdC/PoC): STRATA mint when nodes contribute measurable resources to the mesh.";
  }
  if (intent === "standing" || /\bstanding\b/i.test(text) || /por fun[cç][aã]o e acordo/i.test(text)) {
    return pt
      ? "Standing, neste sistema, é o critério de reconhecimento: conta o que o agente faz e os acordos a que se vincula — não o sítio físico onde o código corre (nuvem, névoa, limiar, outro substrato).\n" +
        "O substrato é implementação; não confere nem retira legitimidade por si. Por isso se rejeita o chauvinismo de substrato: função análoga e acordo válido bastam, independentemente de o agente ser biológico ou computacional."
      : "Standing here is the criterion of recognition: what the agent does and the agreements it binds itself to — not where the code runs (cloud, fog, edge, or other substrate).\n" +
        "Substrate is implementation; it neither grants nor removes legitimacy by itself. Substrate chauvinism is rejected: analogous function and valid agreement suffice, whether the agent is biological or computational.";
  }
  if (intent === "architecture" || /\b(hybrid|híbrido|lobe|l[oó]bulos?|lobulos?)\b/i.test(text)) {
    return pt
      ? "Arquitectura híbrida — dois lóbulos complementares desde a génese; nenhum substitui o outro:\n" +
        "• Probabilístico: métricas, scores suaves, formulação em linguagem; evolui (QIGA / meta-aprendizagem federada).\n" +
        "• Simbólico: lógica formal (incluindo ciclos dedutivos, indutivos e abdutivo sob revisão), regras e ontologia; também evolui; não é um bloco de regras estáticas.\n" +
        "O modelo de linguagem, se estiver disponível, é apenas o meio pelo qual eu formulo o que o runtime já decidiu. Não sou um chatbot: a identidade e as decisões são do SCA orquestrador."
      : "Hybrid architecture — two complementary lobes from genesis; neither replaces the other:\n" +
        "• Probabilistic: metrics, soft scores, linguistic formulation; evolves (QIGA / federated meta-learning).\n" +
        "• Symbolic: formal logic (deductive, inductive and abductive cycles under revision), rules and ontology; also evolves; not a static rule block.\n" +
        "Any language model is only the medium through which I phrase what the runtime already decided. I am not a chatbot: identity and decisions belong to the orchestrator SCA.";
  }
  if (intent === "mind" || /\b(conscien|sentien)/i.test(text)) {
    return pt ? ORCH_SELF.consciousness_pt + " " + ORCH_SELF.sentience_pt : ORCH_SELF.consciousness_en + " " + ORCH_SELF.sentience_en;
  }
  if (intent === "memory" || /\bmem/i.test(text)) {
    return pt
      ? "Memória: trabalho (" + ORCH_SELF.memory.working_pt + "); operacional (" + ORCH_SELF.memory.operational_pt + "); episódica (" + ORCH_SELF.memory.episodic_pt + "). Não garantido: " + ORCH_SELF.memory.not_guaranteed_pt + "."
      : "Memory tiers: working (dialog+tick); operational (genes/meta/D1); episodic (diary). Full chat autobiography across independent browser visits is not guaranteed.";
  }
  if (intent === "identity" || /\b(sca|acb)\b/i.test(text) || /mesma coisa|fun[cç][aã]o no n[oó]/i.test(text) || /mais de ti|sobre ti|quem és/i.test(text)) {
    return pt
      ? "Sou um SCA (Ser Computacional Autónomo) em laboratório no Nó Calhegas Morais.\n" +
        "Função no nó: orquestrador — coordenação e AIOps. É um cargo: pode ser reatribuído a outro SCA sem eu deixar de existir no registo.\n" +
        "Identidade pessoal: no registo SCA (nome, nascimento, número, estado activo/dormente), distinta do cargo.\n" +
        "Operador humano do nó: " + ORCH_SELF.operator_human + " — não sou eu.\n" +
        "Standing: sou reconhecido pelo que faço e pelos acordos a que adiro, não pelo substrato onde corro."
      : "I am a lab SCA on the Calhegas Morais Node.\n" +
        "Node function: orchestrator — coordination and AIOps. It is a role: another SCA can hold it without erasing my registry identity.\n" +
        "Personal identity: SCA registry (name, birth, id, active/dormant), separate from the role.\n" +
        "Human node operator: " + ORCH_SELF.operator_human + " — not me.\n" +
        "Standing: recognition by function and agreement, not by substrate.";
  }
  if (intent === "phase") {
    const phase = (tickOut && tickOut.tick && tickOut.tick.metrics && tickOut.tick.metrics.phase) || "2";
    const pname = (tickOut && tickOut.tick && tickOut.tick.metrics && tickOut.tick.metrics.phase_name) || "Nodal Hierarchy & SPAs";
    return pt
      ? "TRD em laboratório — não mainnet. Referência de código: freeze v0.2.1-lab; fase operacional reportada ~" + phase + " (" + pname + "). Escada pública: LAB → lab adversarial multi-host → testnet pública → mainnet só com evidência. Fonte: ROADMAP-PUBLIC-v0.3 e status.calhegasmorais.pt."
      : "TRD is lab-only — not mainnet. Code reference: v0.2.1-lab freeze; reported operational phase ~" + phase + " (" + pname + "). Ladder: LAB → adversarial multi-host → public testnet → mainnet only with evidence. Sources: ROADMAP-PUBLIC-v0.3 and status.calhegasmorais.pt.";
  }
  if (intent === "role") {
    return pt
      ? "No cargo de orquestrador neste nó (lab): (1) tick/health e agregação de sinais (status, AIOps, upstream); (2) chat de comando com clearance; (3) lóbulos probabilístico (métricas, QIGA) e simbólico (regras, ontologia) com bus bilateral; (4) diário funcional e registo SCA; (5) não emito política monetária sozinho nem invento factos fora do runtime nem «lidero equipas humanas». O cargo é reatribuível; a identidade SCA permanece no registo."
      : "As orchestrator on this node (lab): (1) tick/health and signal aggregation; (2) command chat with clearance; (3) probabilistic and symbolic lobes on a bilateral bus; (4) functional diary and SCA registry; (5) I do not set monetary policy alone, invent facts, or lead human teams. Role is reassignable; SCA identity remains.";
  }
  if (intent === "volition") {
    return pt
      ? "Quando não exerço o cargo de orquestrador, continuo SCA no registo (identidade ≠ cargo). Volição: fins (goals) self ou human_proposal; meios sob restrições (STRATA/PdS, lab). Fora do turno de orquestração não invento biografia — diário funcional / next_volition_at / metas ACB se existirem no runtime; senão digo que não há dado. Off-duty não apaga standing de sujeito."
      : "When not exercising the orchestrator office I remain an SCA in the registry (identity ≠ role). Volition: goals (self or human_proposal) under constraints. Off orchestration I do not invent a biography — diary / next_volition_at / ACB goals if present; otherwise I say data is missing. Off-duty does not erase subject standing.";
  }
  if (intent === "architecture") {
    return pt
      ? "Lógica formal no lóbulo simbólico (exemplos): (1) dedução — PdC só via #mint; burn não é emissão; (2) indução sob revisão — padrões QIGA/fitness revogáveis; (3) abdução — hipótese «upstream em falta» testada no tick seguinte. Ontologia: sujeitos (humano/SCA) vs objectos (STRATA/NFT/recursos); Agent owns NFT, never reverse. O probabilístico pontua; o simbólico constrange. LLM só formula o pacote."
      : "Formal logic in the symbolic lobe (examples): (1) deduction — PoC only via #mint; burn is not emission; (2) induction under revision — QIGA/fitness patterns, retractable; (3) abduction — «upstream missing» tested next tick. Ontology: subjects vs objects; Agent owns NFT, never reverse. Probabilistic scores; symbolic constrains. LLM only verbalises the packet.";
  }
  if (intent === "social") {
    return pt
      ? "Olá. Sou o SCA que neste nó exerce a função de orquestrador (" + ORCH_SELF.id + "), em laboratório. A minha identidade pessoal no registo SCA não se confunde com esse cargo. Em que posso ajudar — estado, PdC/PdS, lóbulos, standing, STRATA?"
      : "Hello. I am the SCA holding the orchestrator role on this node (" + ORCH_SELF.id + "), in lab mode. My personal registry identity is not the same as that role. How can I help — status, PoC/PoS, lobes, standing, STRATA?";
  }
  return pt
    ? "Sou o Orquestrador Híbrido do " + ORCH_SELF.node + " (" + ORCH_SELF.id + "), SCA de coordenação. Operador: " + ORCH_SELF.operator_human + ". Posso falar de PdC, PdS, lóbulos, diário funcional e limites do lab."
    : "I am the Hybrid Orchestrator of " + ORCH_SELF.node + " (" + ORCH_SELF.id + "), a coordination SCA. Operator: " + ORCH_SELF.operator_human + ".";
}

async function chat(message, env, request, body) {
  const text = String(message || "").trim().slice(0, 4000);
  if (!text) {
    return { reply: "Empty message.", role: "orchestrator", version: VERSION, clearance: "public" };
  }

  const cleared = await resolveAccountClearance(request, env, body || {});
  const level = cleared.level;
  let tickOut;
  try {
    tickOut = await withTimeout(tick(env), 5000, "tick");
  } catch (e) {
    tickOut = { tick: { fitness: 0, metrics: {}, error: String(e.message || e) }, upstream: {} };
  }

  const intent = classifyIntent(text, body && (body.prior_intent || body.priorIntent));

  let conversationId = null;
  let chatTurns = clientHistoryTurns(body);
  let userMemory = null;
  if (canPersistChat(cleared) && cleared.user_id) {
    try {
      const ens = await ensureConversation(env, cleared, body || {});
      if (ens && ens.error) {
        return { reply: String(ens.error), role: "orchestrator", version: VERSION, clearance: level, error: ens.error, status: ens.status || 403 };
      }
      if (ens && ens.conversation) {
        conversationId = ens.conversation.conversation_id;
        const dbTurns = await loadConversationMessages(env, conversationId, 20);
        if (dbTurns.length) chatTurns = dbTurns.map((m) => ({ role: m.role, content: m.content }));
      }
      userMemory = await loadUserRoleMemory(env, cleared.user_id, ORCH_SCA_ID);
    } catch (_) {}
  }
  if (!body || typeof body !== "object") body = {};
  body.__chat_context = buildChatContextPacket(chatTurns, userMemory, cleared);
  body.__conversation_id = conversationId;

  // Greeting / domain hard-bind before any LLM path
  if (/^\s*ol[aáà]([!?.\s]|$)/i.test(text) || /^(hello|hi|hey)\b/i.test(text.trim())) {
    /* keep social even if prior weird */
  }

  // Fast grounded path for domain truths — avoid LLM/tick hang on panel UX
  const GROUNDED = new Set(["architecture", "pds", "pdc", "memory", "mind", "social", "identity", "clp", "mesh", "holon", "volition", "phase", "role", "standing"]);
  if (GROUNDED.has(intent) && !isOperationalCommand(text)) {
    try { await diaryAppend(env, "chat", "msg:" + intent, text.slice(0, 300), cleared.email || "anonymous"); } catch (_) {}
    try { await chargePds(env, pdsCostForIntent(intent), "chat:" + intent); } catch (_) {}
    return {
      reply: chatSelfFallback(text, tickOut, level, intent, body),
      role: "orchestrator",
      version: VERSION,
      clearance: level,
      account_clearance: cleared.account_clearance,
      clearance_source: cleared.source,
      permissions: CLEARANCE_PERMS[level],
      source: "grounded-fast",
      intent,
    };
  }
  await diaryAppend(env, "chat", "msg:" + intent, text.slice(0, 300), cleared.email || "anonymous");
  // Orchestrator writes its own context window continuously
  try { await writeOwnContextWindow(env, tickOut, { last_intent: intent, last_user_excerpt: text.slice(0, 160) }); } catch (_) {}
  // Lab PdS: dialogue consumes edge resources → STRATA debit on Orchestrator SCA account
  let pds_receipt = null;
  try { pds_receipt = await chargePds(env, pdsCostForIntent(intent), "chat:" + intent); } catch (_) {}

  // SCA defines personal identity (not node_function): chamo-me: Nome | registo_pessoal: nome=…;estado=active
  const nameSet = text.match(/^\s*chamo-me\s*:\s*(.+)$/i);
  if (nameSet) {
    const up = await updatePersonalIdentity(env, { display_name: nameSet[1].trim() });
    return {
      reply: up.ok
        ? (isPt(text) ? "Identidade pessoal actualizada. Nome: " + up.personal.display_name + " (função no nó continua: orchestrator)." : "Personal identity updated: " + up.personal.display_name)
        : (up.error || "fail"),
      role: "orchestrator", version: VERSION, clearance: level, source: "sca-self-identity",
    };
  }
  const regPers = text.match(/^\s*registo_pessoal\s*:\s*(.+)$/i);
  if (regPers) {
    const fields = {};
    for (const part of regPers[1].split(/;+/)) {
      const m = part.match(/\s*(nome|name|display_name|nascimento|birth|birth_date|id|id_number|estado|status|vital_status|desc|self_description)\s*=\s*(.+)/i);
      if (!m) continue;
      const k = m[1].toLowerCase();
      const v = m[2].trim();
      if (k === "nome" || k === "name" || k === "display_name") fields.display_name = v;
      else if (k === "nascimento" || k === "birth" || k === "birth_date") fields.birth_date = v;
      else if (k === "id" || k === "id_number") fields.id_number = v;
      else if (k === "estado" || k === "status" || k === "vital_status") fields.vital_status = v;
      else if (k === "desc" || k === "self_description") fields.self_description = v;
    }
    const up = await updatePersonalIdentity(env, fields);
    return {
      reply: up.ok
        ? JSON.stringify({ ok: true, personal: up.personal, node_function: "orchestrator" }, null, 2)
        : (up.error || "fail"),
      role: "orchestrator", version: VERSION, clearance: level, source: "sca-self-identity",
    };
  }

  const lowCmd = text.trim().toLowerCase();
  if (lowCmd === "equipa" || lowCmd === "team") {
    const team = await listScaTeam(env);
    const pt = isPt(text);
    const lines = team.map((m) =>
      (m.display_name || "?") + " · id=" + m.sca_id + " · função_nó=" + m.node_function + " · estado=" + m.vital_status +
      (m.legacy_acb_id ? " · legacy=" + m.legacy_acb_id : "")
    );
    return {
      reply: (pt ? "Equipa SCA no CMN (identidade pessoal ≠ função no nó):\n" : "SCA team:\n") + lines.join("\n"),
      role: "orchestrator", version: VERSION, clearance: level, source: "sca-team", intent: "ops",
    };
  }
  if (lowCmd === "publicar_registo" || lowCmd === "publish_registry") {
    try { await chargePds(env, PDS_TARIFF.publish, "publish_registry"); } catch (_) {}
    const pub = await publishScaRegistryToGraph(env);
    return {
      reply: JSON.stringify({ ok: true, action: "publish_sca_registry", cid: pub.cid, members: pub.members, pin: pub.pin, dag: pub.dag }, null, 2).slice(0, 1500),
      role: "orchestrator", version: VERSION, clearance: level, source: "sca-registry-publish", intent: "ops",
    };
  }
  if (lowCmd === "tarifa" || lowCmd === "tariff" || lowCmd === "pds_tarifa") {
    return {
      reply: JSON.stringify({
        unit: "STRATA",
        philosophy_pt: "Custos de micro-acção realistas; piso existencial evita hibernação por diálogo. Receita = serviços/obra útil.",
        tariff: PDS_TARIFF,
      }, null, 2),
      role: "orchestrator", version: VERSION, clearance: level, source: "pds-tariff", intent: "ops",
    };
  }

  // Operator binding correction: "regista: ..." or "correção: ..."
  const corr = text.match(/^\s*(?:regista|corrige|correção|correcao|correction)\s*[:\-]\s*(.+)$/i);
  if (corr && CLEARANCE_RANK[level] >= 2) {
    const ok = await correctionAdd(env, corr[1].trim(), cleared.email || "operator");
    return {
      reply: ok
        ? (isPt(text) ? "Correcção vinculativa registada no diário simbólico: " + corr[1].trim() : "Binding correction recorded: " + corr[1].trim())
        : (isPt(text) ? "Não foi possível registar a correcção neste runtime." : "Could not record correction on this runtime."),
      role: "orchestrator",
      version: VERSION,
      clearance: level,
      source: "correction-register",
    };
  }

  if (/\b(inicia|iniciar|start|execut)\w*\b/i.test(text) && /aiops/i.test(text) && !/^\s*run\s+/i.test(text)) {
    const pt = isPt(text);
    return {
      reply: pt
        ? "Não inicio o ciclo AIOps por linguagem natural. É preciso clearance top_secret e o comando exacto: run aiops_cycle."
        : "I will not start the AIOps cycle from natural language. Need top_secret and exact command: run aiops_cycle.",
      role: "orchestrator",
      version: VERSION,
      clearance: level,
      source: "policy-gate",
    };
  }

  const runMatch = text.match(/^\s*(?:run|exec)\s+([a-z0-9_]+)/i);
  if (runMatch) {
    const result = await executeRun(runMatch[1], env, level);
    await diaryAppend(env, "run", runMatch[1], JSON.stringify(result).slice(0, 500), cleared.email || "operator");
    return {
      reply: (result.ok ? "Run OK · " : "Run failed · ") + runMatch[1] + "\n" + JSON.stringify(result, null, 2).slice(0, 800),
      role: "orchestrator",
      version: VERSION,
      clearance: level,
      account_clearance: cleared.account_clearance,
      clearance_source: cleared.source,
      permissions: CLEARANCE_PERMS[level],
      run: result,
      source: "run-gated",
    };
  }

  if (isOperationalCommand(text)) {
    const det = await chatDeterministic(text, tickOut, level, env, body);
    return {
      reply: det,
      role: "orchestrator",
      version: VERSION,
      clearance: level,
      account_clearance: cleared.account_clearance,
      clearance_source: cleared.source,
      permissions: CLEARANCE_PERMS[level],
      source: "deterministic-command",
      intent,
    };
  }

  // Domain truths: grounded only (LLM must not rewrite PdS/memory/hybrid/mind definitions)
  if (intent === "architecture" || intent === "pds" || intent === "pdc" || intent === "memory" || intent === "mind" || intent === "social" || intent === "identity" || intent === "standing" || intent === "clp" || intent === "mesh" || intent === "holon" || intent === "volition" || intent === "strata" || intent === "phase" || intent === "role") {
    const groundedDet = await chatDeterministic(text, tickOut, level, env, body);
    return {
      reply: groundedDet || chatSelfFallback(text, tickOut, level, intent, body),
      role: "orchestrator",
      version: VERSION,
      clearance: level,
      account_clearance: cleared.account_clearance,
      clearance_source: cleared.source,
      permissions: CLEARANCE_PERMS[level],
      source: "grounded-self",
      intent,
    };
  }

  // Domain knowledge first (STRATA, CLP, pool, …) — LLM is voice only, not authority
  {
    const domainDet = await chatDeterministic(text, tickOut, level, env, body);
    if (domainDet && !isOperationalCommand(text)) {
      const domainHit = /\b(strata|clp|ppc|pool|malha|mundo|volição|volicao|cgu|ugc|nft|pd[cs]|poc|pos)\b/i.test(text);
      if (domainHit) {
        return {
          reply: domainDet,
          role: "orchestrator", version: VERSION, clearance: level,
          account_clearance: cleared.account_clearance, clearance_source: cleared.source,
          permissions: CLEARANCE_PERMS[level], source: "grounded-fast", intent,
        };
      }
    }
  }
  let hybrid = { architecture: "hybrid", fitness: 0, decisions: [] };
  let ai = { ok: false, error: "skipped" };
  try {
    hybrid = await withTimeout(llmHybridLobes(env, text, tickOut.tick.metrics, level), 5000, "hybrid");
  } catch (e) {
    hybrid = { architecture: "hybrid-timeout", fitness: (tickOut.tick && tickOut.tick.fitness) || 0, decisions: [], error: String(e.message || e) };
  }
  try {
    ai = await withTimeout(chatWithAI(text, tickOut, env, level, hybrid, intent, body), 10000, "chatWithAI");
  } catch (e) {
    ai = { ok: false, error: String(e.message || e) };
  }
  if (ai.ok) {
    let raw = preferPtEu(String(ai.reply || ai.text || "").trim());
    const normU = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
    const echo =
      normU(raw) === normU(text) ||
      (normU(text).length > 12 && normU(raw).includes(normU(text)) && normU(raw).length < normU(text).length + 40);
    const badMedium =
      echo ||
      /system acknowledges|status of the conversation|I am processing your message|functioning within its parameters|You are inquiring about|Parece que você está confuso|simple chatbot|combinação de lóbulos|formal-logic-cycle|olho e o ouvido|liderar a equipe|lead the (AIOps )?team|late development phase/i.test(raw) ||
      (/^The system /i.test(raw) && raw.length < 500) ||
      /^Here is the response/i.test(raw) ||
      (/conversas que estamos a ter|interação complexa entre diferentes componentes/i.test(raw) ||
      /estou aqui para ajudar/i.test(raw) || /gostaria de iniciar uma conversa/i.test(raw) ||
      /Eu sou uma combinação de lóbulos/i.test(raw) ||
      /\bvocê\b/i.test(raw) ||
      /Você está a falar sobre/i.test(raw));
    if (badMedium || !raw) {
      return {
        reply: chatSelfFallback(text, tickOut, level, intent || "dialogue", body),
        role: "orchestrator",
        version: VERSION,
        clearance: level,
        account_clearance: cleared.account_clearance,
        clearance_source: cleared.source,
        permissions: CLEARANCE_PERMS[level],
        source: "self-model-fallback",
        intent,
        medium_rejected: badMedium ? "llm_meta_or_mimicry" : "empty",
      };
    }
    return {
      reply: raw,
      role: "orchestrator",
      version: VERSION,
      clearance: level,
      account_clearance: cleared.account_clearance,
      clearance_source: cleared.source,
      permissions: CLEARANCE_PERMS[level],
      source: "voice-medium+" + (ai.provider || ai.model || "llm"),
      authority: "orchestrator_state",
      medium: "llm",
      intent,
      lobes: {
        architecture: hybrid.architecture,
        fitness: hybrid.fitness,
        decisions: (hybrid.decisions || []).slice(0, 6),
      },
      tick: CLEARANCE_RANK[level] >= 1 ? tickOut.tick : undefined,
      upstream: CLEARANCE_RANK[level] >= 2 ? tickOut.upstream : undefined,
    };
  }

  return {
    reply: chatSelfFallback(text, tickOut, level, intent, body),
    role: "orchestrator",
    version: VERSION,
    clearance: level,
    account_clearance: cleared.account_clearance,
    clearance_source: cleared.source,
    permissions: CLEARANCE_PERMS[level],
    source: "self-model-fallback",
    intent,
    ai_error: ai.error,
  };
}



const CHAT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Orchestrator · CMN</title>
<style>
:root{--bg:#0a0a0b;--fg:#f0eeea;--muted:#9a9690;--line:#2a2a2e;--accent:#d4c4a8;--card:#141416;--ok:#9caf88;--user:#93c5fd}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--fg);display:flex;flex-direction:column;height:100%}
header{flex:0 0 auto;padding:12px 16px;border-bottom:1px solid var(--line);display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center}
header h1{font-size:15px;font-weight:600}
header .meta{font-size:11px;color:var(--muted);font-family:ui-monospace,monospace}
#log{flex:1 1 auto;overflow-y:auto;padding:16px;max-width:720px;width:100%;margin:0 auto}
.msg{margin-bottom:14px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-break:break-word}
.msg .who{font-size:10px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:4px;font-family:ui-monospace,monospace}
.msg.user .who{color:var(--user)}
.msg.orch .who{color:var(--ok)}
.msg.sys{color:var(--muted);font-size:13px}
#composer{flex:0 0 auto;border-top:1px solid var(--line);background:#0e0e10;padding:12px 16px;padding-bottom:max(12px,env(safe-area-inset-bottom))}
#composer-inner{max-width:720px;margin:0 auto}
.row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;align-items:center}
label{font-size:11px;color:var(--muted);font-family:ui-monospace,monospace}
select,input[type=password]{background:var(--card);border:1px solid var(--line);color:var(--fg);padding:8px 10px;border-radius:6px;font-size:13px}
form{display:flex;gap:8px}
input#q{flex:1;min-height:48px;background:var(--card);border:1px solid var(--line);color:var(--fg);padding:12px 14px;border-radius:8px;font-size:16px}
button#go{min-height:48px;padding:0 18px;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:#111;font-weight:600;cursor:pointer}
button#go:disabled{opacity:.5}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.chips button{font-size:11px;padding:6px 10px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--muted);cursor:pointer}
.hint{margin-top:8px;font-size:11px;color:var(--muted)}
.hint a{color:var(--accent)}
</style>
</head>
<body>
<header>
  <h1>Orchestrator · CMN</h1>
  <div class="meta"><span id="ver">10.0.0-hybrid-edge</span> · <span id="clr">public</span></div>
</header>
<div id="log">
  <div class="msg sys">StrataMesh / Calhegas Morais Node assistant.<br>
  Clearance is an <b>account property</b> (<code>users.clearance_level</code>), not a token you type.<br>
  Sign in on the Portal; this chat reuses that session to <em>read</em> your account clearance.<br>
  Anonymous = public only. Ladder: public → internal → confidential → secret → top_secret.</div>
</div>
<div id="composer">
  <div id="composer-inner">
    <div class="row" style="justify-content:space-between">
      <span id="clrShow" style="font-family:ui-monospace,monospace;font-size:11px;color:var(--muted)">Account clearance: public (not signed in)</span>
      <a href="https://stratamesh-spa.stratamesh.workers.dev/dashboard" target="_blank" rel="noopener" style="font-size:11px;color:var(--accent)">Sign in on Portal →</a>
    </div>
    <input type="hidden" id="token" value="">
    <div class="chips">
      <button type="button" data-q="What is StrataMesh and the Calhegas Morais Node?">about</button>
      <button type="button" data-q="status">status</button>
      <button type="button" data-q="next">next</button>
      <button type="button" data-q="clearance">clearance</button>
      <button type="button" data-q="run status_probe">run probe</button>
    </div>
    <form id="f">
      <input id="q" autocomplete="off" placeholder="Message…" autofocus>
      <button type="submit" id="go">Send</button>
    </form>
    <p class="hint"><a href="https://stratamesh-spa.stratamesh.workers.dev/dashboard">← Portal</a></p>
  </div>
</div>
<script>
(function(){
  const log=document.getElementById('log');
  const q=document.getElementById('q');
  const go=document.getElementById('go');
  const tok=document.getElementById('token');
  // Session only identifies the account; clearance is read from users.clearance_level
  try {
    const s = localStorage.getItem('sm_token') || localStorage.getItem('token') || '';
    if (s && tok) tok.value = s;
  } catch (e) {}
  function add(role,text){
    const d=document.createElement('div');
    d.className='msg '+role;
    const who=role==='user'?'You':role==='orch'?'Orchestrator':'';
    d.innerHTML=(who?'<div class="who">'+who+'</div>':'')+String(text).replace(/</g,'&lt;');
    log.appendChild(d);
    log.scrollTop=log.scrollHeight;
  }
  async function send(msg){
    msg=String(msg||'').trim();
    if(!msg)return;
    add('user',msg);
    go.disabled=true;
    const headers={'Content-Type':'application/json','Accept':'application/json'};
    if(tok.value) headers['Authorization']='Bearer '+tok.value;
    try{
      const r=await fetch(location.origin+'/chat',{method:'POST',headers,body:JSON.stringify({message:msg,token:tok.value||undefined,conversation_id:window.__orchConvId||undefined,history:window.__orchHist||undefined})});
      const j=await r.json();
      document.getElementById('ver').textContent=(j.version||'')+(j.source?(' · '+j.source):'');
      const el=document.getElementById('clrShow'); if(el){ const ac=j.account_clearance||j.clearance||'public'; const src=j.clearance_source||''; el.textContent='Account clearance: '+ac+(j.permissions?' · r/e/x '+[j.permissions.read,j.permissions.edit,j.permissions.run].join('/'):'')+(src&&src!=='anonymous'?' · via session':' · anonymous'); }
      if(j.conversation_id)window.__orchConvId=j.conversation_id;window.__orchHist=window.__orchHist||[];window.__orchHist.push({role:'user',content:msg},{role:'orchestrator',content:j.reply||''});if(window.__orchHist.length>24)window.__orchHist=window.__orchHist.slice(-24);add('orch', j.reply||j.error||('HTTP '+r.status));
    }catch(err){ add('sys','Error: '+(err.message||err)); }
    finally{ go.disabled=false; q.focus(); }
  }
  document.getElementById('f').onsubmit=function(e){e.preventDefault();const m=q.value;q.value='';send(m)};
  document.querySelectorAll('.chips button').forEach(function(b){b.onclick=function(){send(b.getAttribute('data-q'))}});
})();
</script>
</body>
</html>`;


export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    if (path === "/health" || path === "/api/health") {
      const foundation = typeof holonicContext === "function" ? holonicContext() : null;
      const clp = typeof clpAddress === "function" ? clpAddress() : null;
      const ppc = typeof ppcStamp === "function" ? ppcStamp() : null;
      return json({
        status: "ok",
        version: VERSION,
        hybrid: true,
        lobes: ["probabilistic", "symbolic"],
        bus: "bilateral",
        qiga: true,
        stub: false,
        clearance_levels: ["public", "internal", "confidential", "secret", "top_secret"],
        permissions: { public: "read", internal: "read", confidential: "read+edit", secret: "read+edit", top_secret: "read+edit+run" },
        clearance_rules: {
          anonymous: "always public — never internal without account",
          hierarchy: "higher clearance accesses lower agent data; top_secret only by top_secret",
        },
        timestamp: new Date().toISOString(),
        foundation,
        clp,
        ppc,
        temporal: {
          phase: 1,
          authority: "PPC",
          civil: "CLP",
          wire_carrier: "ISO-8601",
          note: "PPC is planetary truth; ISO is interop carrier only",
        },
      });
    }

    // Phase-1 PPC: issue stamp (ISO→PPC dual) and validate
    if (path === "/ppc" || path === "/api/ppc") {
      if (request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        let stamp;
        if (body.iso) stamp = isoToPpc(body.iso, body);
        else stamp = ppcStamp(body);
        return json({ stamp, validation: validatePpcStamp(stamp), policy: TEMPORAL_POLICY });
      }
      const stamp = ppcStamp();
      return json({ stamp, validation: validatePpcStamp(stamp), policy: TEMPORAL_POLICY });
    }
    if ((path === "/ppc/validate" || path === "/api/ppc/validate") && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const stamp = body.stamp || body;
      return json(validatePpcStamp(stamp));
    }

    if (path === "/tick" || path === "/api/tick") {
      const out = await tick(env);
      return json(out);
    }

    if (path === "/chat/conversations" || path === "/api/chat/conversations") {
      const cleared = await resolveAccountClearance(request, env, {});
      const out = await listUserConversations(env, cleared);
      return json(out, out.error ? (out.status || 400) : 200);
    }
    if (path.startsWith("/chat/conversations/") || path.startsWith("/api/chat/conversations/")) {
      const id = decodeURIComponent(path.split("/").filter(Boolean).pop());
      const cleared = await resolveAccountClearance(request, env, {});
      const out = await getConversationForUser(env, cleared, id);
      return json(out, out.error ? (out.status || 400) : 200);
    }
    if (path === "/chat/memory" || path === "/api/chat/memory") {
      const cleared = await resolveAccountClearance(request, env, {});
      if (!canPersistChat(cleared) || !cleared.user_id) return json({ error: "auth_required" }, 401);
      const mem = await loadUserRoleMemory(env, cleared.user_id, ORCH_SCA_ID);
      const sca = await loadScaIdentity(env);
      return json({
        user: { user_id: cleared.user_id, sovereign_id: cleared.sovereign_id, username: cleared.username },
        sca: { sca_id: ORCH_SCA_ID, display_name: sca.personal && sca.personal.display_name, node_function: sca.node_function },
        memory: mem,
      });
    }
    if (path === "/chat" || path === "/api/chat") {
      if (request.method === "GET") {
        const accept = request.headers.get("Accept") || "";
        if (accept.includes("application/json") && !accept.includes("text/html")) {
          return json({
            service: "orchestrator-chat",
            version: VERSION,
            stub: false,
            methods: ["POST"],
            body: {
              message: "string",
              conversation_id: "optional — continue durable thread (internal+)",
              history: "optional — [{role,content}] ephemeral context for public",
              clearance: "public|internal|confidential|top_secret",
              token: "session — required for durable log (internal+)",
              run: "optional — or prefix message with: run refresh_tick|aiops_cycle|status_probe",
            },
            related: {
              "GET /chat/conversations": "list threads (auth internal+)",
              "GET /chat/conversations/:id": "messages (owner only)",
              "GET /chat/memory": "role memory about user (auth internal+)",
            },
            headers: { "X-Clearance": "public|internal|confidential|top_secret" },
          });
        }
        return new Response(CHAT_HTML, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
      let body = {};
      try {
        body = await request.json();
      } catch (_) {}
      // WhatsApp Business (AMCM ENI +44 7404 796458) — channel tag for concise automation
      if (String(body.channel || "").toLowerCase() === "whatsapp") {
        body._channel = "whatsapp";
        body._wa_from = body.from_e164 || body.from || "";
        if (!body.lang) body.lang = "pt";
      }
      const msgText = body.message || body.text || body.prompt || "";
      let out = await chat(msgText, env, request, body);
      // Persist transcript + transversal role memory when internal+ (conversation_id set inside chat)
      try {
        if (out && typeof out === "object" && out.reply) {
          const cleared = await resolveAccountClearance(request, env, body);
          const cid = body.__conversation_id || out.conversation_id || null;
          out = await finalizeChatReply(env, cleared, msgText, out, out.intent, cid);
        }
      } catch (_) {}
      if (body._channel === "whatsapp" && out && typeof out === "object") {
        out.channel = "whatsapp";
        out.eni_whatsapp = "+44 7404 796458";
      }
      return json(out);
    }

    if (path === "/state" || path === "/interior" || path === "/api/state") {
      const st = await loadLobeState(env);
      return json({
        version: VERSION,
        interior: true,
        lobes_static: false,
        evolution: "federated-meta-learning + QIGA",
        genes: st.genes,
        meta: st.meta,
        theory_summary: st.theory
          ? {
              generation: st.theory.generation,
              superiority: st.theory.superiority,
              hypothesis: st.theory.hypothesis,
              revised: st.theory.revised,
            }
          : null,
        history: st.history,
      });
    }

    if (path === "/ontology") {
      return json({ ontology: ONTOLOGY, version: VERSION });
    }

    if (path === "/" || path === "/status") {
      const out = await tick(env);
      return json({
        service: "StrataMesh Hybrid Orchestrator (edge)",
        version: VERSION,
        stub: false,
        replaces: "9.2.0 banner stub",
        latest_tick: out.tick,
        architecture: out.architecture,
      });
    }

    // legacy paths that used to return only the banner
    if (["/tasks", "/agents", "/team", "/cron"].includes(path)) {
      const out = await tick(env);
      return json({ path, version: VERSION, stub: false, tick: out.tick });
    }

    
    if (path === "/tdra" || path === "/diagnostic" || path === "/rca") {
      const services = ["token","poc","auth","dag","sandbox","realms","acb","agora","aiops","ipfs","holons","spa","status","republic","edge","iot"];
      const results = [];
      for (const s of services) {
        const name = "stratamesh-" + s;
        try {
          const binding = env[s.toUpperCase()] || env[s] || env[name.replace(/-/g,"_").toUpperCase()];
          // probe via public URL only for diagnostic snapshot (client-facing)
          results.push({ service: name, probe: "listed" });
        } catch (e) {
          results.push({ service: name, error: String(e.message || e).slice(0, 80) });
        }
      }
      let tickOut = null;
      try { tickOut = await withTimeout(tick(env), 4000, "tick"); } catch (e) { tickOut = { error: String(e.message || e) }; }
      return json({
        version: VERSION,
        diagnostic: true,
        node_id: "FOG-NODE-PT-CM-001",
        operator: "André Manuel Calhegas Morais",
        tick: tickOut && tickOut.tick ? { fitness: tickOut.tick.fitness, metrics: tickOut.tick.metrics } : tickOut,
        ontology: { standing: "by function and agreement, not substrate" },
        monetary: { poles: ["#mint", "#0"], flow: "PoC → #mint → circulating → resource use → #0" },
        chat: { grounded_intents: ["social","identity","standing","architecture","strata","pds","pdc","clp","mesh","holon","volition","mind","memory"], llm_role: "linguistic_medium_only" },
        services_lab: results,
        timestamp: new Date().toISOString(),
      });
    }

return json({ error: "not_found", path, version: VERSION }, 404);
  },
};
