const SNAPSHOT = {"version": "0.2.1-lab-temp", "phase": "2"};

/** EMBEDDED from shared/holonic-clp.js — edit shared/ only */
/**
 * StrataMesh foundational holarchy + CLP temporal kernel (shared source of truth).
 * Workers embed or mirror this module — it is not decorative UI logic.
 *
 * Pilha holónica (infraestrutura → habitação):
 *   RDL (CLP/PPC embutido em todo o fluxo) → Nó(SO/VM) → SO Metaverso Web3 → Reino Virtual → Mundo Aberto → Bancada UGC (Painel dentro) → Utilizador|SCA
 * CLP não é camada: é kernel temporal da RDL, selado em cada holão via ppcCompact.
 * Painel/Portal não é camada acima: vive na Bancada UGC.
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

/** Camadas holónicas (PT-PT). CLP ≠ camada; Painel ⊂ Bancada UGC. */
const HOLONIC_LAYERS = [
  { id: "dlt", nome: "RDL StrataMesh", name_en: "StrataMesh DLT", papel: "malha GDA, PdC, PdS, Ágora; CLP/PPC embutido em todo o fluxo", role: "DAG mesh; CLP/PPC embedded throughout" },
  { id: "node", nome: "Nó (SO/VM)", name_en: "Node OS/VM", papel: "substrato fog/edge do anfitrião", role: "fog/edge host substrate" },
  { id: "metaverse_os", nome: "SO do Metaverso Web3", name_en: "Web3 Metaverse OS", papel: "sistema operativo partilhado entre nós (orquestrador, AIOps, syscalls)", role: "shared OS across nodes" },
  { id: "virtual_realm", nome: "Reino Virtual", name_en: "Virtual Realm", papel: "domínio hipervisor para mundos abertos", role: "hypervisor domain for worlds" },
  { id: "open_world", nome: "Mundo Aberto", name_en: "Open-World", papel: "mundo persistente multi-utilizador", role: "multi-user persistent world" },
  { id: "ugc_sandbox", nome: "Bancada UGC", name_en: "UGC Sandbox", papel: "criação, isolamento e Painel/Portal (superfície de apps do SO)", role: "authoring, isolation, and Panel/Portal surface" },
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
  const trueSolarNoon = (720 - 4 * lon - eqOfTime + date.getTimezoneOffset()) / 1440;
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
 * CLP não é holão contratual — é kernel temporal da RDL.
 * Painel não é holão — é superfície de app dentro da Bancada UGC.
 */
const HOLON_CONTRACTS = {
  dlt: {
    holon: "dlt",
    nome: "RDL StrataMesh",
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
    nome: "Reino Virtual",
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
    nome: "Bancada UGC",
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
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>StrataMesh Status</title>
<style>body{font-family:system-ui;background:#0b0f14;color:#e6edf3;padding:2rem}a{color:#3b82f6}.pill{color:#86efac}</style></head>
<body><h1>${s.name||'Calhegas Morais'} · ${s.node_id||''}</h1>
<p class="pill">v${s.version||'0.2.1-lab'} · Phase ${s.phase} — ${s.phase_name||''}</p>
<p><a href="/live">Live dashboard</a> · <a href="/status">JSON</a> · <a href="https://github.com/amcmorais/stratamesh-core">GitHub</a></p>
<pre style="background:#141a22;padding:1rem;border-radius:8px;overflow:auto">${JSON.stringify(s,null,2)}</pre>
</body></html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ingest' && request.method === 'POST') {
      const token = request.headers.get('X-Status-Token') || '';
      if (!env.STATUS_TOKEN || token !== env.STATUS_TOKEN)
        return new Response(JSON.stringify({error:'unauthorized'}), {status:401, headers:{'Content-Type':'application/json'}});
      const body = await request.json();
      if (env.STATUS_KV) await env.STATUS_KV.put('live', JSON.stringify(body));
      return new Response(JSON.stringify({ok:true}), {headers:{'Content-Type':'application/json'}});
    }
    if (url.pathname === '/live' || url.pathname === '/widget')
      return new Response(LIVE_HTML, {headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-cache'}});
    let data = SNAPSHOT;
    if (env.STATUS_KV) {
      try { const live = await env.STATUS_KV.get('live'); if (live) data = JSON.parse(live); } catch(_){}
    }
    if (url.pathname === '/status' || url.pathname === '/v1/status') {
      const foundation = typeof holonicContext === 'function' ? holonicContext() : null;
      const clp = typeof clpAddress === 'function' ? clpAddress() : null;
      const ppc = typeof ppcStamp === 'function' ? ppcStamp() : null;
      const enriched = Object.assign({}, data, {
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
      });
      return new Response(JSON.stringify(enriched, null, 2), {headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Cache-Control':'no-cache'}});
    }
    return new Response(page(data), {headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-cache'}});
  }
};
