/** TRD primitives — STRATA poles, DAG, Agora, MCMC.
 *  PdC and PdS belong to the DLT, not to any Fog. A Node inscribes them
 *  the way paper holds mathematics: it does not author the rules. */

import { clpStamp } from "@/lib/clp";

export const MINT = "#mint";
export const SINK = "#0";
/** Fog holon id. The Node is not an entity and has no user/SCA account. */
export const NODE_ACCT = "FOG-NODE-PT-CM-001";
/** Fog wallet — what the Node produces (PoC) and spends (operation). Not an account. */
export const NODE_WALLET = NODE_ACCT;

export type Vertex = {
  id: string;
  tips: string[];
  kind: string;
  body: string;
  weight: number;
  cid: string;
  at: string;
  nodeId: string;
  clp: string;
  votes: Record<string, number>;
};

export type Order = {
  id: string;
  side: "bid" | "ask";
  account: string;
  strata: number;
  eur: number;
  at: string;
  filled?: boolean;
};

export type Accounts = Record<string, number>;

export function cidOf(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return "bafy" + (h >>> 0).toString(16).padStart(8, "0") + s.length.toString(16);
}

export function circulating(acc: Accounts) {
  return Object.entries(acc)
    .filter(([k]) => k !== MINT && k !== SINK)
    .reduce((s, [, v]) => s + v, 0);
}

export function burnTotal(acc: Accounts) {
  return acc[SINK] ?? 0;
}

export function mintTotal(acc: Accounts) {
  return -(acc[MINT] ?? 0);
}

/** TRD PdC: #mint emits into the contributor's wallet. For this Fog, that is NODE_WALLET. */
export function mintPoc(acc: Accounts, contributor: string, amount: number): Accounts {
  if (amount <= 0 || contributor === SINK || contributor === MINT) return acc;
  return { ...acc, [MINT]: (acc[MINT] ?? 0) - amount, [contributor]: (acc[contributor] ?? 0) + amount };
}

/** TRD PdS: burn from the consumer to #0. SCAs and users pay the mesh, not a Node. */
export function burnPos(acc: Accounts, from: string, amount: number): Accounts {
  const have = acc[from] ?? 0;
  const x = Math.min(have, Math.max(0, amount));
  if (x <= 0 || from === SINK || from === MINT) return acc;
  return { ...acc, [from]: have - x, [SINK]: (acc[SINK] ?? 0) + x };
}

export function transfer(acc: Accounts, from: string, to: string, amount: number): Accounts | null {
  if (from === SINK || to === MINT || from === MINT) return null;
  const have = acc[from] ?? 0;
  if (amount <= 0 || have < amount) return null;
  return { ...acc, [from]: have - amount, [to]: (acc[to] ?? 0) + amount };
}

export function childrenOf(vertices: Vertex[], id: string) {
  return vertices.filter((v) => v.tips.includes(id));
}

/** A tip is a vertex not yet approved (not listed as a parent by any other). */
export function tipSet(vertices: Vertex[]) {
  const approved = new Set<string>();
  for (const v of vertices) for (const t of v.tips) approved.add(t);
  const tips = vertices.filter((v) => !approved.has(v.id));
  return tips.length ? tips : vertices.slice(-1);
}

export function cumulativeWeight(vertices: Vertex[], id: string, memo: Map<string, number> = new Map()): number {
  const hit = memo.get(id);
  if (hit !== undefined) return hit;
  const self = vertices.find((v) => v.id === id);
  if (!self) return 0;
  const kids = childrenOf(vertices, id);
  const w = self.weight + kids.reduce((s, k) => s + cumulativeWeight(vertices, k.id, memo), 0);
  memo.set(id, w);
  return w;
}

function pickWeighted<T>(items: T[], weight: (x: T) => number) {
  const ws = items.map(weight);
  const sum = ws.reduce((s, x) => s + Math.max(0, x), 0);
  if (sum <= 0) return items[Math.floor(Math.random() * items.length)];
  let r = Math.random() * sum;
  for (let i = 0; i < items.length; i++) {
    r -= Math.max(0, ws[i]);
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** IOTA-like MCMC: walk from genesis toward tips, biased by cumulative weight. */
export function mcmcWalk(vertices: Vertex[], alpha = 0.01): Vertex {
  if (!vertices.length) {
    return {
      id: "genesis",
      tips: [],
      kind: "genesis",
      body: NODE_ACCT,
      weight: 1,
      cid: "bafygenesis",
      at: "2026-01-01T00:00:00.000Z",
      nodeId: NODE_ACCT,
      clp: "PPC-Lisboa D001 L01 INVERNO",
      votes: {},
    };
  }
  const genesis = vertices.find((v) => v.id === "genesis") ?? vertices[0];
  const memo = new Map<string, number>();
  let cur = genesis;
  for (let i = 0; i < 64; i++) {
    const kids = childrenOf(vertices, cur.id);
    if (!kids.length) return cur;
    cur = pickWeighted(kids, (k) => Math.pow(cumulativeWeight(vertices, k.id, memo) + alpha, 1 + alpha));
  }
  return cur;
}

export function selectTipsMcmc(vertices: Vertex[], n = 2, walks = 24): string[] {
  if (!vertices.length) return ["genesis"];
  const counts = new Map<string, number>();
  for (let i = 0; i < walks; i++) {
    const t = mcmcWalk(vertices);
    counts.set(t.id, (counts.get(t.id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id]) => id);
}

/** Independent view: walk using only vertices signed by honest-set nodes. */
export function selectTipsIndependent(vertices: Vertex[], nodeIds: string[], n = 2): string[] {
  const local = vertices.filter((v) => v.id === "genesis" || nodeIds.includes(v.nodeId));
  return selectTipsMcmc(local.length ? local : vertices, n, 16);
}

export function selectTips(vertices: Vertex[], n = 2): string[] {
  if (!vertices.length) return ["genesis"];
  return selectTipsMcmc(vertices, n);
}

export function confirmations(v: Vertex, nNodes: number) {
  const votes = Object.values(v.votes).reduce((s, x) => s + x, 0);
  return nNodes <= 0 ? 0 : Math.min(1, votes / nNodes);
}

/** Hedera-like virtual vote: a node endorses currently selected tips. */
export function gossipVote(vertices: Vertex[], nodeId: string): Vertex[] {
  const tips = selectTipsMcmc(vertices, 2, 12);
  return vertices.map((v) => (tips.includes(v.id) ? { ...v, votes: { ...v.votes, [nodeId]: (v.votes[nodeId] ?? 0) + 1 }, weight: v.weight + 0.08 } : v));
}

export function appendVertex(
  vertices: Vertex[],
  kind: string,
  body: string,
  opts?: { nodeId?: string; walk?: boolean },
): Vertex[] {
  const tips = opts?.walk === false ? selectTipsHeavy(vertices) : selectTipsMcmc(vertices);
  const at = new Date().toISOString();
  const nodeId = opts?.nodeId ?? NODE_ACCT;
  const clp = clpStamp(at).civil;
  const id = "v_" + Math.random().toString(36).slice(2, 10);
  const parentW = tips.reduce((s, t) => s + (vertices.find((x) => x.id === t)?.weight ?? 0) * 0.15, 0);
  const v: Vertex = {
    id,
    tips,
    kind,
    body,
    weight: 1 + parentW,
    cid: cidOf(kind + body + at + nodeId),
    at,
    nodeId,
    clp,
    votes: { [nodeId]: 1 },
  };
  return [...vertices, v].slice(-80);
}

function selectTipsHeavy(vertices: Vertex[], n = 2): string[] {
  if (!vertices.length) return ["genesis"];
  const ranked = [...vertices].sort((a, b) => b.weight - a.weight);
  return ranked.slice(0, n).map((v) => v.id);
}

export const genesisVertex: Vertex = {
  id: "genesis",
  tips: [],
  kind: "genesis",
  body: NODE_ACCT,
  weight: 1,
  cid: "bafygenesis",
  at: "2026-01-01T00:00:00.000Z",
  nodeId: NODE_ACCT,
  clp: "PPC-Lisboa D001 L01 INVERNO",
  votes: { [NODE_ACCT]: 1 },
};

/** Resource class is storage/compute/bandwidth — function does not change class. Quality ± premium. */
export function pocAmount(resourceUnits: number, globalEurPerUnit: number, strataPerEur: number, quality = 1) {
  const eur = resourceUnits * globalEurPerUnit;
  return Math.max(0, eur * strataPerEur * quality);
}

export function matchAgora(orders: Order[], acc: Accounts): { orders: Order[]; acc: Accounts; trades: number } {
  const open = orders.filter((o) => !o.filled);
  const bids = open.filter((o) => o.side === "bid").sort((a, b) => b.strata / b.eur - a.strata / a.eur);
  const asks = open.filter((o) => o.side === "ask").sort((a, b) => a.strata / a.eur - b.strata / a.eur);
  let trades = 0;
  const filled = new Set<string>();
  let next = acc;
  for (const bid of bids) {
    const ask = asks.find((a) => !filled.has(a.id) && a.account !== bid.account);
    if (!ask) continue;
    const qty = Math.min(bid.strata, ask.strata);
    const moved = transfer(next, ask.account, bid.account, qty);
    if (!moved) continue;
    next = moved;
    filled.add(bid.id);
    filled.add(ask.id);
    trades++;
  }
  return {
    acc: next,
    trades,
    orders: orders.map((o) => (filled.has(o.id) ? { ...o, filled: true } : o)),
  };
}
