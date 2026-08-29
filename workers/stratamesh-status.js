
/** EMBEDDED from shared/holonic-clp.js — edit shared/ only */
/**
 * StrataMesh foundational holarchy + CLP temporal kernel (shared source of truth).
 * Workers embed or mirror this module — it is not decorative UI logic.
 *
 * Pilha holónica (infraestrutura → habitação):
 *   TRD (CLP/PPC kernel temporal) → Nó Fog (com operador; corre e instancia SO nativos e importados na TRD) → SO Metaverso Web3 (nativo StrataMesh, partilhado, instanciado nos Fog) → Domínio Virtual (VM hipervisor: servidores dos mundos abertos) → Mundo Aberto → Bancada CGU (sandbox users/SCA; Painel TanStack = kit de interface) → Utilizador|SCA
 * CLP é kernel temporal da TRD, selado em cada holão via ppcCompact.
 * Painel/Portal/TanStack vive na Bancada CGU.
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

/** Camadas holónicas (PT-PT). CLP = kernel temporal da TRD; Painel ⊂ Bancada CGU. */
const HOLONIC_LAYERS = [
  { id: "dlt", nome: "TRD StrataMesh", name_en: "StrataMesh DLT", papel: "livro-razão GDA, PdC, PdS, Ágora; CLP/PPC embutido em todo o fluxo", role: "DAG mesh; PoC, PoS, Agora; CLP/PPC embedded throughout" },
  { id: "node", nome: "Nó de Névoa", name_en: "Fog Node", papel: "holon Fog com operador; corre e instancia SO — nativo StrataMesh e outros desenvolvidos ou importados na TRD; indexa Limiar", role: "Fog holon with operator; runs and instantiates OS — native StrataMesh and others developed or imported on the DLT; indexes Edge" },
  { id: "metaverse_os", nome: "SO do Metaverso Web3", name_en: "Web3 Metaverse OS", papel: "SO nativo StrataMesh, partilhado; os Fog instanciam-no localmente; sub-sistemas: DV (VM hipervisor), Mundo Aberto, Bancada (Painel TanStack = kit de interface)", role: "native StrataMesh metaverse OS, shared, instantiated by Fog Nodes; subsystems: Virtual Realm (VM hypervisor), Open World, sandbox (Panel TanStack = UI kit)" },
  { id: "virtual_realm", nome: "Domínio Virtual", name_en: "Virtual Realm", papel: "sub-sistema do SO: VM hipervisor — servidores que suportam os mundos abertos", role: "OS subsystem: VM hypervisor — servers that support the open worlds" },
  { id: "open_world", nome: "Mundo Aberto", name_en: "Open World", papel: "sub-sistema habitável do SO, hospedado nas VM do Domínio Virtual", role: "habitable OS subsystem, hosted on Virtual Realm VMs" },
  { id: "ugc_sandbox", nome: "Bancada CGU", name_en: "CGU / UGC Sandbox", papel: "sandbox de utilizadores e SCA, hospedada nos mundos abertos; Painel TanStack = kit de interface", role: "user/SCA sandbox hosted in open worlds; Panel TanStack = UI kit" },
  { id: "agent", nome: "Utilizador | SCA", name_en: "User | SCA", papel: "standing por função e acordo", role: "standing by function and agreement" },
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
    nome: "Nó de Névoa",
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




function page(s) {
  const sum = s.summary || {};
  const mon = s.monetary || {};
  const up = s.upstream || {};
  const upLine = Object.keys(up).map((k) => k + ':' + (up[k] ? 'ok' : '—')).join(' · ');
  return `<!DOCTYPE html><html lang="pt-PT"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Estado · ${s.name_pt||s.name||'CMN'}</title>
<style>
body{font-family:system-ui,sans-serif;background:#0b0f14;color:#e6edf3;padding:1.5rem;line-height:1.45;max-width:52rem;margin:0 auto}
a{color:#93c5fd}h1{font-size:1.25rem;font-weight:600;margin:0 0 .5rem}
.pill{display:inline-block;color:#86efac;font-family:ui-monospace,monospace;font-size:.75rem;margin:.25rem 0 1rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(9rem,1fr));gap:.75rem;margin:1rem 0}
.card{background:#141a22;border:1px solid #243044;border-radius:8px;padding:.75rem}
.card .v{font-size:1.1rem;font-weight:600;font-variant-numeric:tabular-nums}
.card .l{font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:#9aa4b2;margin-top:.25rem}
pre{background:#141a22;padding:1rem;border-radius:8px;overflow:auto;font-size:.72rem;border:1px solid #243044}
.muted{color:#9aa4b2;font-size:.85rem}
</style></head>
<body>
<h1>${s.name_pt||s.name||'Calhegas Morais'} · ${s.node_id||''}</h1>
<p class="pill">v${s.version||''} · fase ${s.phase||''} — ${s.phase_name||''} · ${s.status||''}</p>
<p class="muted">${s.timestamp||''} · fonte ${s.source||''}</p>
<p class="muted">Upstream ${sum.upstream_ok||0}/${sum.upstream_total||11} · ${upLine}</p>
<div class="grid">
  <div class="card"><div class="v">${mon.circulating_supply!=null?Number(mon.circulating_supply).toLocaleString('pt-PT',{maximumFractionDigits:2}):'—'}</div><div class="l">Circulação</div></div>
  <div class="card"><div class="v">${mon.out_of_circulation!=null?Number(mon.out_of_circulation).toLocaleString('pt-PT',{maximumFractionDigits:4}):'—'}</div><div class="l">#0 queima</div></div>
  <div class="card"><div class="v">${mon.mint_emitted!=null?Number(mon.mint_emitted).toLocaleString('pt-PT',{maximumFractionDigits:6}):'—'}</div><div class="l">#mint emitido</div></div>
  <div class="card"><div class="v">${sum.mesh_classes||0}</div><div class="l">Classes malha</div></div>
  <div class="card"><div class="v">${(s.agora&&s.agora.rate&&s.agora.rate.strata_per_quote!=null)?Number(s.agora.rate.strata_per_quote).toFixed(2):'—'}</div><div class="l">STRATA/EUR</div></div>
  <div class="card"><div class="v">${(s.auth&&s.auth.users!=null)?s.auth.users:'—'}</div><div class="l">Utilizadores</div></div>
</div>
<p class="muted">${(mon.flow||'')}</p>
<p><a href="/status">JSON</a> · <a href="/live">Live</a> · <a href="https://calhegasmorais.pt/dashboard">Portal</a> · <a href="https://github.com/StrataMesh-Laboratory/stratamesh-core">GitHub</a></p>
<details><summary class="muted">JSON completo</summary><pre>${JSON.stringify(s,null,2).replace(/</g,'&lt;')}</pre></details>
</body></html>`;
}


async function svcJson(env, bindingName, path, timeoutMs = 2500) {
  const b = env && env[bindingName];
  if (!b || typeof b.fetch !== 'function') return { ok: false, missing_binding: bindingName };
  try {
    const work = (async () => {
      const r = await b.fetch(new Request('https://binding.internal' + path, {
        headers: { Accept: 'application/json' },
      }));
      const text = await r.text();
      let json = null;
      try { json = JSON.parse(text); } catch (_) {}
      return { ok: r.ok, status: r.status, json };
    })();
    const timed = new Promise((resolve) =>
      setTimeout(() => resolve({ ok: false, error: 'timeout_' + bindingName }), timeoutMs)
    );
    return await Promise.race([work, timed]);
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e).slice(0, 120) };
  }
}

async function fetchJsonPublic(url, timeoutMs = 2500) {
  try {
    const work = (async () => {
      const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'stratamesh-status/0.4' } });
      const json = await r.json().catch(() => null);
      return { ok: r.ok, status: r.status, json };
    })();
    const timed = new Promise((resolve) => setTimeout(() => resolve({ ok: false, error: 'timeout_public' }), timeoutMs));
    return await Promise.race([work, timed]);
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e).slice(0, 120) };
  }
}

async function tokenSnapshot(env, monetaryMs = 2500) {
  const [health, mon] = await Promise.all([
    svcJson(env, 'TOKEN', '/health', 4000),
    svcJson(env, 'TOKEN', '/monetary', monetaryMs),
  ]);
  if (mon.ok && mon.json && mon.json.circulating_supply != null) {
    return { ok: true, json: mon.json, version: (mon.json.version || (health.json && health.json.version)), source: 'monetary' };
  }
  if (health.ok && health.json) {
    const h = health.json;
    const bd = h.breakdown || {};
    return {
      ok: true,
      source: 'health_fallback',
      version: h.version,
      json: {
        circulating_supply: h.total_supply,
        circulating_lab_only: bd.lab_only_strata,
        circulating_transit_eligible: bd.transit_eligible_poc,
        out_of_circulation: null,
        mint_emitted: bd.transit_eligible_poc,
        flow: h.holonic_note || h.emission_policy,
        poles: null,
        fog_wallet: bd.fog_wallet || null,
        version: h.version,
      },
    };
  }
  return { ok: false, json: null, source: 'unavailable' };
}

async function readPulseCache(env) {
  if (!env.STATUS_KV) return null;
  try {
    const raw = await env.STATUS_KV.get('pulse_cache');
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j || !j._cached_at) return null;
    const age = Date.now() - Date.parse(j._cached_at);
    return { age, live: j };
  } catch (_) {
    return null;
  }
}

async function writePulseCache(env, live) {
  // KV Free writes STASIS after CF 10048. Pulse now lives in Cache API (writeEdgeCache).
  return;
}

const EDGE_PULSE_URL = 'https://stratamesh-status.cache/pulse';
const EDGE_PULSE_MS = 30000;

async function readEdgeCache() {
  try {
    const hit = await caches.default.match(new Request(EDGE_PULSE_URL));
    if (!hit) return null;
    const j = await hit.json();
    if (!j || !j._cached_at) return null;
    const age = Date.now() - Date.parse(j._cached_at);
    if (!Number.isFinite(age) || age < 0 || age > EDGE_PULSE_MS) return null;
    return { age, live: j };
  } catch (_) {
    return null;
  }
}

async function writeEdgeCache(live) {
  if (!live) return;
  try {
    const copy = Object.assign({}, live, { _cached_at: new Date().toISOString(), pulse_store: 'cache_api' });
    const resp = new Response(JSON.stringify(copy), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' },
    });
    await caches.default.put(new Request(EDGE_PULSE_URL), resp);
  } catch (_) {}
}

async function buildLiveStatus(env, opts) {
  const now = new Date().toISOString();
  const foundation = typeof holonicContext === 'function' ? holonicContext() : null;
  const clp = typeof clpAddress === 'function' ? clpAddress() : null;
  const ppc = typeof ppcStamp === 'function' ? ppcStamp() : null;

  const monetaryMs = (opts && opts.monetaryMs) || 2500;
  const [tokenSnap, pocHealth, pocPool, acbH, orchH, dagH, dagStats, dagTips, repH, agoraH, agoraRate, aiopsLast, authH, ipfsH, holonsH, holonsList, gossip] = await Promise.all([
    tokenSnapshot(env, monetaryMs),
    svcJson(env, 'POC', '/health', 4000),
    svcJson(env, 'POC', '/pool', 5000),
    svcJson(env, 'ACB', '/health', 2500),
    svcJson(env, 'ORCH', '/health', 2500),
    svcJson(env, 'DAG', '/health', 2500),
    svcJson(env, 'DAG', '/stats', 2500),
    svcJson(env, 'DAG', '/tips', 2500),
    svcJson(env, 'REPUBLIC', '/health', 2500),
    svcJson(env, 'AGORA', '/health', 2500),
    svcJson(env, 'AGORA', '/agora/rate?quote=EUR', 2500),
    svcJson(env, 'AIOPS', '/health', 1500),
    svcJson(env, 'AUTH', '/health', 2500),
    svcJson(env, 'IPFS', '/health', 2500),
    svcJson(env, 'HOLONS', '/health', 2500),
    svcJson(env, 'HOLONS', '/so', 2500),
    fetchJsonPublic('https://calhegasmorais.pt/api/v1/gossip/peers', 2500),
  ]);

  const mon = tokenSnap.json;
  const pool = (pocPool.json && pocPool.ok) ? pocPool.json : null;
  const pocOk = !!(pocHealth.ok || pocPool.ok);

  let kv = null;
  if (env.STATUS_KV) {
    try {
      const live = await env.STATUS_KV.get('live');
      if (live) kv = JSON.parse(live);
    } catch (_) {}
  }

  return {
    node_id: 'FOG-NODE-PT-CM-001',
    name: 'Calhegas Morais',
    name_pt: 'Nó de Névoa Calhegas Morais',
    operator: 'André Manuel Calhegas Morais',
    location: { lat: 38.7169, lon: -9.1427, label: 'Lisbon, Portugal', locality_pt: 'Lisboa, Portugal' },
    version: '0.4.4-cache-api',
    phase: (kv && kv.phase) || '2',
    phase_name: (kv && kv.phase_name) || 'Nodal Hierarchy & SPAs',
    status: 'operational',
    timestamp: now,
    lab: true,
    source: 'live-aggregation+bindings+cache_api',
    monetary: mon ? {
      circulating_supply: mon.circulating_supply,
      circulating_lab_only: mon.circulating_lab_only,
      circulating_transit_eligible: mon.circulating_transit_eligible,
      out_of_circulation: mon.out_of_circulation,
      mint_emitted: (mon.poles && mon.poles.mint && mon.poles.mint.total_emitted != null)
        ? mon.poles.mint.total_emitted
        : (mon.mint_emitted != null ? mon.mint_emitted : null),
      burn_sink: '#0',
      mint_source: '#mint',
      flow: mon.flow,
      poles: mon.poles || null,
      source: tokenSnap.source,
    } : { error: 'TOKEN /monetary and /health unavailable' },
    mesh_pool: pool && pool.pool ? {
      classes: pool.pool.map((x) => ({
        resource_class: x.resource_class,
        capacity_available: x.capacity_available,
        capacity_contributed: x.capacity_contributed,
      })),
      ontology: pool.ontology || null,
    } : null,
    upstream: {
      token: tokenSnap.ok,
      poc: pocOk,
      acb: acbH.ok,
      orchestrator: orchH.ok,
      dag: dagH.ok,
      republic: repH.ok,
      agora: agoraH.ok,
      aiops: aiopsLast.ok,
      auth: authH.ok,
      ipfs: ipfsH.ok,
      holons: holonsH.ok,
    },
    ipfs: ipfsH.json && ipfsH.ok ? { version: ipfsH.json.version, status: ipfsH.json.status || 'ok' } : null,
    holons: holonsH.json && holonsH.ok ? { version: holonsH.json.version, servico: holonsH.json.servico || holonsH.json.service } : null,
    auth: authH.json && authH.ok ? {
      version: authH.json.version,
      users: authH.json.checks && authH.json.checks.database ? authH.json.checks.database.users : null,
      staff: authH.json.checks && authH.json.checks.staff ? authH.json.checks.staff.count : null,
    } : null,
    dag: {
      version: dagH.json && dagH.json.version,
      status: (dagH.json && dagH.json.status) || (dagH.ok ? 'ok' : 'down'),
      transaction_count: Number(
        (dagStats.json && (dagStats.json.transaction_count || dagStats.json.txs || dagStats.json.count)) ??
        (dagTips.json && (Array.isArray(dagTips.json.tips) ? dagTips.json.tips.length : dagTips.json.count)) ??
        (dagH.json && (dagH.json.transaction_count || dagH.json.txs)) ??
        0
      ),
      tips: dagTips.json && (Array.isArray(dagTips.json.tips) ? dagTips.json.tips.length : dagTips.json.count),
      stats_ok: !!dagStats.ok,
      tips_ok: !!dagTips.ok,
      measured: true,
    },
    spa: {
      source: 'fog_process',
      active: 1,
      total: 1,
      by_role: { fog: 1, edge: 0, other: 0 },
      mesh_member: false,
      oracle_live: false,
      holons_ok: !!holonsH.ok,
      note: 'Lab n=1. Fog is Grok-managed local-process 0.2.3-lab-temp (Fog /health 200). Not lab_seed. mesh_member=false oracle_live=false. EDGE may gossip; it is not this SPA.',
    },
    republic: repH.json && repH.ok ? {
      version: repH.json.version,
      kind: repH.json.kind,
      vote: repH.json.vote,
      citizens_are: repH.json.citizens_are,
    } : null,
    agora: {
      health_ok: !!agoraH.ok,
      version: agoraH.json && agoraH.json.version,
      status: agoraH.json && (agoraH.json.status || 'ok'),
      settlements: { unavailable: 'n<2' },
      rate: agoraRate.json && agoraRate.ok ? {
        quote_asset: agoraRate.json.quote_asset || 'EUR',
        strata_per_quote: agoraRate.json.strata_per_quote,
        quote_per_strata: agoraRate.json.quote_per_strata,
        source: agoraRate.json.source,
        liquidity_strata: agoraRate.json.liquidity_strata,
        listings: agoraRate.json.listings,
      } : null,
    },
    consensus: {
      n: 1,
      f_max: 0,
      mesh_member: false,
      module: 'probabilistic',
      note: 'lab n=1; Byzantine f_max=0 until n>=3',
    },
    acb: acbH.json && acbH.ok ? {
      version: acbH.json.version,
      service: acbH.json.service,
    } : null,
    aiops: aiopsLast.json ? {
      ok: !!aiopsLast.ok,
      version: aiopsLast.json.version,
      service: aiopsLast.json.service || aiopsLast.json.status,
      note: 'use /cycle or /last on AIOPS worker for full cycle payload',
    } : null,
    summary: {
      upstream_ok: [tokenSnap, { ok: pocOk }, acbH, orchH, dagH, repH, agoraH, aiopsLast, authH, ipfsH, holonsH].filter((x) => x && x.ok).length,
      upstream_total: 11,
      circulating: mon ? mon.circulating_supply : null,
      burned: mon ? mon.out_of_circulation : null,
      mint_emitted: (mon && mon.poles && mon.poles.mint && mon.poles.mint.total_emitted != null)
        ? mon.poles.mint.total_emitted
        : (mon && mon.mint_emitted != null ? mon.mint_emitted : null),
      mesh_classes: pool && pool.pool ? pool.pool.length : 0,
      agora_strata_per_eur: agoraRate.json && agoraRate.ok ? agoraRate.json.strata_per_quote : null,
      auth_users: authH.json && authH.ok && authH.json.checks && authH.json.checks.database
        ? authH.json.checks.database.users : null,
      operational: true,
    },
    versions: {
      orchestrator: orchH.json && (orchH.json.version || orchH.json.service),
      acb: acbH.json && acbH.json.version,
      dag: dagH.json && dagH.json.version,
      token: tokenSnap.version || (mon && mon.version),
      aiops: aiopsLast.json && aiopsLast.json.version,
      republic: repH.json && repH.json.version,
      agora: agoraH.json && agoraH.json.version,
    },
    foundation,
    clp,
    ppc,
    temporal: {
      phase: 1,
      authority: 'PPC',
      civil: 'CLP',
      wire_carrier: 'ISO-8601',
      note: 'PPC is planetary truth; ISO is interop carrier only',
    },
    holonic_path: foundation && foundation.path,
    links: {
      site: 'https://calhegasmorais.pt/',
      portal: 'https://calhegasmorais.pt/dashboard',
      tdra: 'https://stratamesh-orchestrator.stratamesh.workers.dev/tdra',
      monetary: 'https://stratamesh-token.stratamesh.workers.dev/monetary',
      repo: 'https://github.com/StrataMesh-Laboratory/stratamesh-core',
      laboratory: 'https://github.com/StrataMesh-Laboratory',
      node_registry: 'https://github.com/StrataMesh-Laboratory/calhegas-morais-node',
      eni: 'https://github.com/amcmorais/amcm-eni',
    },
    kv_ingest_present: !!kv,
  };
}


export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=30' };
    if (url.pathname === '/ingest' && request.method === 'POST') {
      const token = request.headers.get('X-Status-Token') || '';
      if (!env.STATUS_TOKEN || token !== env.STATUS_TOKEN)
        return new Response(JSON.stringify({error:'unauthorized'}), {status:401, headers:{'Content-Type':'application/json'}});
      const body = await request.json();
      if (env.STATUS_KV) await env.STATUS_KV.put('live', JSON.stringify(body));
      return new Response(JSON.stringify({ok:true}), {headers:{'Content-Type':'application/json'}});
    }
    if (url.pathname === '/live' || url.pathname === '/widget') {
      const edge = await readEdgeCache();
      const cached = edge || await readPulseCache(env);
      const live = (cached && cached.live) ? cached.live : await buildLiveStatus(env);
      if (!edge && live) {
        if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(writeEdgeCache(live));
        else await writeEdgeCache(live);
      }
      return new Response(page(live), {headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'public, max-age=30'}});
    }

    if (url.pathname === '/inventory' || url.pathname === '/v1/inventory') {
      const edge = await readEdgeCache();
      const cached = edge || await readPulseCache(env);
      const live = (cached && cached.live) ? cached.live : await buildLiveStatus(env);
      if (!edge && live) {
        if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(writeEdgeCache(live));
        else await writeEdgeCache(live);
      }
      const inv = {
        node_id: live.node_id,
        version: live.version,
        lab: true,
        track: 'edge',
        issue: 'https://github.com/StrataMesh-Laboratory/stratamesh-core/issues/2',
        measured_at: live.timestamp,
        spa: live.spa || null,
        dag: live.dag || null,
        mesh_pool: live.mesh_pool || null,
        resources: {
          classes: (live.mesh_pool && live.mesh_pool.classes) || [],
          peers: live.spa,
          dag_txs: live.dag && live.dag.transaction_count,
          agora_settlements: live.agora && live.agora.settlements,
        },
        honesty: {
          spa_source: live.spa && live.spa.source,
          dag_measured: !!(live.dag && live.dag.measured),
          note: 'Lab inventory. spa.source=fog_process; settlements unavailable n<2; consensus n=1 f_max=0.',
        },
      };
      return new Response(JSON.stringify(inv, null, 2), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' },
      });
    }

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'stratamesh-status',
        version: '0.4.4-cache-api',
        node_id: 'FOG-NODE-PT-CM-001',
        timestamp: new Date().toISOString(),
      }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' } });
    }

    async function respondLive(live) {
      if (url.pathname === '/' && (request.headers.get('Accept') || '').includes('text/html')) {
        return new Response(page(live), {headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'public, max-age=30'}});
      }
      if (url.pathname === '/summary') {
        const slim = {
          version: live.version,
          status: live.status,
          timestamp: live.timestamp,
          node_id: live.node_id,
          name_pt: live.name_pt,
          summary: live.summary,
          monetary: live.monetary && {
            circulating_supply: live.monetary.circulating_supply,
            out_of_circulation: live.monetary.out_of_circulation,
            mint_emitted: live.monetary.mint_emitted,
            burn_sink: live.monetary.burn_sink,
            mint_source: live.monetary.mint_source,
            flow: live.monetary.flow,
            source: live.monetary.source,
          },
          agora_rate: live.agora && live.agora.rate,
          upstream: live.upstream,
          auth: live.auth,
          ipfs_ok: !!(live.upstream && live.upstream.ipfs),
          holons_ok: !!(live.upstream && live.upstream.holons),
        };
        return new Response(JSON.stringify(slim, null, 2), { headers: cors });
      }
      return new Response(JSON.stringify(live, null, 2), { headers: cors });
    }

    if (url.pathname === '/status' || url.pathname === '/v1/status' || url.pathname === '/summary' || url.pathname === '/') {
      const edge = await readEdgeCache();
      if (edge && edge.live) return respondLive(edge.live);
      const cached = await readPulseCache(env);
      const fresh = cached && Number.isFinite(cached.age) && cached.age < 25000 && cached.live;
      if (fresh) {
        if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(writeEdgeCache(cached.live));
        return respondLive(cached.live);
      }
      const live = await buildLiveStatus(env);
      if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(writeEdgeCache(live));
      else await writeEdgeCache(live);
      return respondLive(live);
    }
    const live = await buildLiveStatus(env);
    return new Response(page(live), {headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'public, max-age=15'}});
  }
};