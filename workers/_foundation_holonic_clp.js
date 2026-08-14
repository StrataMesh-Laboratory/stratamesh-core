/** EMBEDDED from shared/holonic-clp.js — foundational holarchy + CLP (do not edit only here; edit shared/) */
/**
 * StrataMesh foundational holarchy + CLP temporal kernel (shared source of truth).
 * Workers embed or mirror this module — it is not decorative UI logic.
 *
 * Holonic stack (infra top → inhabitance bottom):
 *   DLT → Node(OS/VM) → Web3 Metaverse OS (shared) → {CLP, Dashboard} → Realm → World → Sandbox → User|SCA
 *
 * CLP: relative civil time; ISO-8601 remains the wire format for DAG/interop.
 */
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

/** Ordered from substrate mesh to agent inhabitance */
const HOLONIC_LAYERS = [
  { id: "dlt", name: "StrataMesh DLT", role: "mesh DAG, PdC, PdS, Agora, gossip" },
  { id: "node", name: "Node OS/VM", role: "fog/edge host substrate" },
  { id: "metaverse_os", name: "Web3 Metaverse OS", role: "shared OS across nodes" },
  { id: "clp", name: "CLP temporal kernel", role: "relative lunisolar civil time + PPC matrix" },
  { id: "dashboard", name: "Dashboard/Portal", role: "OS application surface inside holarchy" },
  { id: "virtual_realm", name: "Virtual Realm", role: "hypervisor domain for worlds" },
  { id: "open_world", name: "Open-World", role: "multi-user persistent world" },
  { id: "ugc_sandbox", name: "UGC Sandbox", role: "authoring / isolation holon" },
  { id: "agent", name: "User | SCA", role: "standing by function and agreement" },
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
      "clp:kernel",
      `realm:${n.realm_id}`,
      `world:${n.world_id}`,
      `sandbox:${n.sandbox_id}`,
    ].join(" / "),
    node: n,
    clp,
    rules: {
      metaverse_os_shared_across_nodes: true,
      dashboard_inside_holarchy: true,
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
