/** Laboratory kernels — QIGA, FL, volition, NFT, SCA registry.
 *  PdS is a TRD rule (burn to #0). This Node only inscribes the debit. */

import { NODE_ACCT } from "@/lib/dlt-engine";
import { askSymbolic } from "@/lib/symbolic";

export const NODE_ID = NODE_ACCT;
export const ORCH_SCA = "SCA-ORCH-CMN-001";
/** Operator wallet — a person/ENI. Never the Fog Node id. Node ≠ NFT. */
export const OPERATOR_WALLET = "carteira:AMCM-ENI";
export const VISITOR_WALLET = "utilizador:visitante";

export function userWallet(userId: string) {
  return `utilizador:${userId}`;
}

export function isMeshNodeId(id: string) {
  return /^(FOG-NODE-|EDGE-|FOG-ADV-|#mint|#0$)/i.test(id);
}

export function holderLabel(id: string, lang: "pt" | "en" = "pt") {
  const pt = lang === "pt";
  if (isMeshNodeId(id)) return pt ? "erro: Nó ≠ NFT" : "error: Node ≠ NFT";
  if (id === OPERATOR_WALLET) return pt ? "Tesouraria do operador (ENI)" : "Operator treasury (ENI)";
  if (id === VISITOR_WALLET || id === "visitor") return pt ? "Utilizador visitante" : "Visiting user";
  if (id.startsWith("SCA-")) return id;
  if (id.startsWith("utilizador:")) return id.slice("utilizador:".length);
  if (id.startsWith("carteira:")) return id.slice("carteira:".length);
  return id;
}

export function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}

export function randomGenes(dim = 6): number[] {
  return Array.from({ length: dim }, () => Math.random());
}

export function fitnessOf(genes: number[], target = 0.75): number {
  const mean = genes.reduce((s, x) => s + x, 0) / genes.length;
  const v = genes.reduce((s, x) => s + (x - mean) ** 2, 0) / genes.length;
  const balance = 1 - Math.min(1, v * 4);
  const align = 1 - Math.min(1, Math.abs(mean - target));
  return 0.55 * balance + 0.45 * align;
}

function interfere(a: number[], b: number[]): number[] {
  return a.map((x, i) => {
    const y = b[i] ?? x;
    const amp = Math.sqrt(0.5 * x * x + 0.5 * y * y);
    const phase = Math.random() * Math.PI * 2;
    return clamp01(amp * Math.cos(phase) * 0.5 + 0.25 * (x + y));
  });
}

function mutate(genes: number[], rate = 0.08): number[] {
  return genes.map((g) => (Math.random() < rate ? clamp01(g + (Math.random() - 0.5) * 0.2) : g));
}

export type Individual = { genes: number[]; fitness: number };

export function qigaEvolve(pop: Individual[], generations = 2, target = 0.75) {
  let cur = pop.map((p) => ({ genes: [...p.genes], fitness: fitnessOf(p.genes, target) }));
  for (let g = 0; g < generations; g++) {
    cur.sort((a, b) => b.fitness - a.fitness);
    const elite = cur.slice(0, Math.max(2, Math.floor(cur.length / 4)));
    const next = [...elite];
    while (next.length < cur.length) {
      const p1 = elite[Math.floor(Math.random() * elite.length)];
      const p2 = elite[Math.floor(Math.random() * elite.length)];
      next.push({ genes: mutate(interfere(p1.genes, p2.genes)), fitness: 0 });
    }
    cur = next.map((p) => ({ genes: p.genes, fitness: fitnessOf(p.genes, target) }));
  }
  cur.sort((a, b) => b.fitness - a.fitness);
  return { population: cur, elite: cur[0], generationDelta: generations };
}

export type FlUpdate = { scaId: string; genes: number[]; n: number };

export function fedAvg(updates: FlUpdate[]): number[] {
  const dim = updates[0]?.genes.length ?? 6;
  const total = updates.reduce((s, u) => s + u.n, 0) || 1;
  const out = Array(dim).fill(0);
  for (const u of updates) {
    const w = u.n / total;
    for (let i = 0; i < dim; i++) out[i] += u.genes[i] * w;
  }
  return out;
}

export function krum(updates: FlUpdate[], f = 1): number[] {
  if (updates.length <= 2) return fedAvg(updates);
  const n = updates.length;
  const scores = updates.map((u, i) => {
    const dists = updates
      .map((v, j) => {
        if (i === j) return Infinity;
        return u.genes.reduce((s, x, k) => s + (x - v.genes[k]) ** 2, 0);
      })
      .sort((a, b) => a - b);
    const keep = Math.max(1, n - f - 2);
    return dists.slice(0, keep).reduce((s, x) => s + (x === Infinity ? 0 : x), 0);
  });
  let best = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i] < scores[best]) best = i;
  return updates[best].genes;
}

/** Residual Edge contribution: C_mesh = f(1 − U). Not a mini-Fog. */
export function residualMesh(utilization: number, capacity: number, quality = 1): number {
  const idle = clamp01(1 - clamp01(utilization));
  return capacity * idle * clamp01(quality);
}

/** Capital-recovery contribution intensity (resource engine). */
export function capitalRecovery(capex: number, opex: number, expectedStrata: number): number {
  if (expectedStrata <= 0) return 0;
  return (capex + opex) / expectedStrata;
}

/** Service engine: surplus must cover maintenance, capital, risk, margin. */
export function serviceSurplus(revenue: number, resourceCost: number, maint: number, capital: number, risk: number, margin: number) {
  const left = revenue - resourceCost;
  const right = maint + capital + risk + margin;
  return { left, right, sustainable: left >= right, gap: left - right };
}

export const PDS_COST: Record<string, number> = {
  social: 0.00001,
  read: 0.00002,
  symbolic: 0.00003,
  qiga: 0.00008,
  tool: 0.0001,
};

export type Volition = {
  scaId: string;
  lifecycle: "ACTIVE" | "DORMANT";
  intentKind: string;
  pdsBefore: number;
  pdsCost: number;
  pdsAfter: number;
  decision: string;
  result: string;
  source: "SCA_RUNTIME";
};

export function classifyIntent(intent: string) {
  const t = intent.trim();
  if (/^(ol[áa]|hello|hi|bom dia|boa noite|good evening|hey)\b/i.test(t)) return "social";
  if (/status|estado|fitness|genes|lifecycle|circul/i.test(t)) return "read";
  if (/lóbulo|lobe|simbólico|ontology|identidade|appointment|cargo|unifica|#mint|#0|república/i.test(t)) return "symbolic";
  if (/qiga|federat|evolve|krum|fedavg/i.test(t)) return "qiga";
  return "tool";
}

export function volitionTick(intent: string, pds: number, scaId = ORCH_SCA): Volition {
  const kind = classifyIntent(intent);
  const cost = PDS_COST[kind] ?? PDS_COST.tool;
  if (pds <= 0 || pds < cost) {
    return {
      scaId,
      lifecycle: "DORMANT",
      intentKind: kind,
      pdsBefore: pds,
      pdsCost: 0,
      pdsAfter: pds,
      decision: "hibernate",
      result: "UNAVAILABLE — PdS insuficiente para processar.",
      source: "SCA_RUNTIME",
    };
  }
  const after = Math.max(0, pds - cost);
  let result = "RESULT grounded.";
  if (kind === "social") result = "Cumprimento aceite. Não é um pedido de dados.";
  if (kind === "read") result = `lifecycle=ACTIVE · appointment=ORCHESTRATOR · node=${NODE_ID} · source=SCA_RUNTIME`;
  if (kind === "symbolic") result = askSymbolic(intent).text;
  if (kind === "qiga") result = "Passo QIGA admitido — genes evoluem no lóbulo probabilístico.";
  if (kind === "tool") result = "Intenção admitida ao runtime. LLM só formula RESULT, não o origina.";
  return {
    scaId,
    lifecycle: after > 0 ? "ACTIVE" : "DORMANT",
    intentKind: kind,
    pdsBefore: pds,
    pdsCost: cost,
    pdsAfter: after,
    decision: "admit",
    result,
    source: "SCA_RUNTIME",
  };
}

export type NftMode = "static" | "dynamic" | "suspended_static";

export type NftKind = "creation" | "parcel" | "artifact" | "avatar";

export type Nft = {
  id: string;
  title: string;
  /** World/sandbox object or figural identity. Never a Fog/Edge node. */
  kind: NftKind;
  mode: NftMode;
  collateral: number;
  market: number;
  fractions: { holder: string; units: number }[];
  burnRate: number;
  worldId?: string;
  cid?: string;
  image?: string;
};

export function nftPossessedBy(nft: Nft, holder: string) {
  const total = nft.fractions.reduce((s, f) => s + f.units, 0) || 1;
  const mine = nft.fractions.find((f) => f.holder === holder)?.units ?? 0;
  return mine / total;
}

export function redeemIfBelow(nft: Nft): Nft {
  if (nft.market >= nft.collateral) return nft;
  return {
    ...nft,
    mode: "static",
    market: nft.collateral,
  };
}

export function burnDynamic(nft: Nft, dtHours: number): Nft {
  if (nft.mode !== "dynamic") return nft;
  const burn = Math.min(nft.collateral, nft.burnRate * dtHours);
  const next = nft.collateral - burn;
  if (next <= 0) return { ...nft, collateral: 0, mode: "suspended_static" };
  return { ...nft, collateral: next };
}

export function sellFraction(nft: Nft, from: string, to: string, units: number): Nft {
  if (isMeshNodeId(from) || isMeshNodeId(to)) return nft;
  const src = nft.fractions.find((f) => f.holder === from);
  if (!src || src.units < units) return nft;
  const fractions = nft.fractions.map((f) => (f.holder === from ? { ...f, units: f.units - units } : { ...f }));
  const dst = fractions.find((f) => f.holder === to);
  if (dst) dst.units += units;
  else fractions.push({ holder: to, units });
  return { ...nft, fractions: fractions.filter((f) => f.units > 0) };
}

export type Blueprint = "Orion" | "Helix" | "Aegis" | "Vertex" | "Lyra";

export type ScaRecord = {
  id: string;
  name: string;
  blueprint: Blueprint;
  lobes: ["probabilistic", "symbolic"];
  appointment: string | null;
  enrolled: boolean;
  pds: number;
  lifecycle: "ACTIVE" | "DORMANT";
};

export const BLUEPRINTS: { id: Blueprint; pt: string; en: string }[] = [
  { id: "Orion", pt: "Orquestração holónica e diálogo grounded.", en: "Holonic orchestration and grounded dialogue." },
  { id: "Helix", pt: "Ciclo AIOps, QIGA e federação Flower/Krum.", en: "AIOps cycle, QIGA and Flower/Krum federation." },
  { id: "Aegis", pt: "Segurança, polícia computacional, jurisdição voluntária.", en: "Security, computational police, voluntary jurisdiction." },
  { id: "Vertex", pt: "Peso de ponta GDA, CID, voto virtual.", en: "DAG tip weight, CID, virtual vote." },
  { id: "Lyra", pt: "Órgão fiscal da República — auditoria, sem cargo no Nó.", en: "Republic fiscal organ — audit, no Node appointment." },
];

export function seedScas(): ScaRecord[] {
  return [
    { id: ORCH_SCA, name: "Orion-CMN", blueprint: "Orion", lobes: ["probabilistic", "symbolic"], appointment: "ORCHESTRATOR", enrolled: true, pds: 0.85, lifecycle: "ACTIVE" },
    { id: "SCA-AIOPS-001", name: "Helix-CMN", blueprint: "Helix", lobes: ["probabilistic", "symbolic"], appointment: "AIOPS_LEAD", enrolled: true, pds: 0.62, lifecycle: "ACTIVE" },
    { id: "SCA-SEC-001", name: "Aegis-CMN", blueprint: "Aegis", lobes: ["probabilistic", "symbolic"], appointment: "SECURITY", enrolled: true, pds: 0.54, lifecycle: "ACTIVE" },
    { id: "SCA-DAG-001", name: "Vertex-CMN", blueprint: "Vertex", lobes: ["probabilistic", "symbolic"], appointment: "DAG_KEEPER", enrolled: true, pds: 0.71, lifecycle: "ACTIVE" },
    { id: "SCA-FIS-001", name: "Lyra-CMN", blueprint: "Lyra", lobes: ["probabilistic", "symbolic"], appointment: null, enrolled: true, pds: 0.48, lifecycle: "ACTIVE" },
  ];
}

/** Identity stays. Appointment moves. Node hires only Republic-enrolled SCAs. */
export function appoint(scas: ScaRecord[], scaId: string, role: string | null): ScaRecord[] {
  const target = scas.find((s) => s.id === scaId);
  if (role && target && !target.enrolled) return scas;
  return scas.map((s) => {
    if (s.id === scaId) return { ...s, appointment: role };
    if (role && s.appointment === role) return { ...s, appointment: null };
    return s;
  });
}

export function enrollSca(scas: ScaRecord[], scaId: string, enrolled: boolean): ScaRecord[] {
  return scas.map((s) => (s.id === scaId ? { ...s, enrolled, appointment: enrolled ? s.appointment : null } : s));
}

