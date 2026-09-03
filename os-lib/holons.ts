/** Holonic stack.
 *  A Fog Node is a holon and requires an operator (human, associative DAO, corporate DAO, or — future-open — an ACB).
 *  Edge Nodes are not independent holons of operation: they have no operator; they are indexed to a principal Fog.
 *  The Node is not the Metaverse OS. It is not an NFT. CLP is TRD kernel time — not a holon. */

export type HolonId = "trd" | "no" | "so" | "dv" | "ma" | "cgu";

export type Holon = {
  id: HolonId;
  n: string;
  pt: { title: string; body: string };
  en: { title: string; body: string };
};

export const HOLONS: Holon[] = [
  {
    id: "trd",
    n: "0",
    pt: {
      title: "TRD",
      body: "Tecnologia de Registo Distribuído StrataMesh. Daqui são as regras: GDA, pólos STRATA (#mint / #0), PdC, PdS, CLP, identidade SCA. O Fog inscreve; não legisla. Analogia: a matemática pode escrever-se no papel — o papel não a define.",
    },
    en: {
      title: "DLT",
      body: "StrataMesh Distributed Ledger. The rules live here: DAG, STRATA poles (#mint / #0), PoC, PoS, CLP, ACB identity. The Fog inscribes; it does not legislate. Analogy: mathematics may be written on paper — the paper does not define it.",
    },
  },
  {
    id: "no",
    n: "1",
    pt: {
      title: "Nó Calhegas Morais",
      body: "Holon Fog FOG-NODE-PT-CM-001 · Lisboa. Operador actual: André Manuel Calhegas Morais, AMCM ENI (utilizador humano). O cargo de operador admite também DAO associativa, DAO corporativa, ou — futuro aberto — um SCA com STRATA suficiente para abrir Fog. Limiar indexado, sem operador próprio.",
    },
    en: {
      title: "Calhegas Morais Node",
      body: "Fog holon FOG-NODE-PT-CM-001 · Lisbon. Current operator: André Manuel Calhegas Morais, AMCM ENI (human user). The operator appointment also admits an associative DAO, a corporate DAO, or — future-open — an ACB with sufficient STRATA to open a Fog. Indexed Edge, no operator of its own.",
    },
  },
  {
    id: "so",
    n: "2",
    pt: {
      title: "SO Metaverso",
      body: "Sistema operativo partilhado do metaverso Web3. Plataforma comum que este Nó hospeda. O Nó é holon; o SO é outro holon — não se confundem.",
    },
    en: {
      title: "Metaverse OS",
      body: "Shared Web3 metaverse operating system. Common platform this Node hosts. The Node is a holon; the OS is another holon — they are not the same.",
    },
  },
  {
    id: "dv",
    n: "3",
    pt: {
      title: "Domínio Virtual",
      body: "Holon de infraestrutura do SO: hipervisor da capacidade, identidade e posse.",
    },
    en: {
      title: "Virtual Realm",
      body: "OS infrastructure holon: hypervisor of capacity, identity and possession.",
    },
  },
  {
    id: "ma",
    n: "4",
    pt: {
      title: "Mundo Aberto",
      body: "Holon habitável do SO, composto por objectos NFT STRATA. Utilizadores e SCA coexistem aqui.",
    },
    en: {
      title: "Open World",
      body: "Habitable OS holon, composed of STRATA NFT objects. Users and ACBs coexist here.",
    },
  },
  {
    id: "cgu",
    n: "5",
    pt: {
      title: "Bancada CGU",
      body: "Holon de criação (humanos e SCA). Criações = NFT STRATA. O painel abre-se aqui como interface do holon Nó — não como o SO.",
    },
    en: {
      title: "UGC Sandbox",
      body: "Creation holon (humans and ACBs). Creations = STRATA NFTs. The panel opens here as the Node holon's interface — not as the OS.",
    },
  },
];

export const TAB_HOLON: Record<string, HolonId> = {
  pulse: "no",
  edge: "no",
  mesh: "no",
  orch: "no",
  wallet: "trd",
  agora: "trd",
  dag: "trd",
  sca: "so",
  republic: "so",
  kyc: "dv",
  bancada: "cgu",
};

export function tabsForHolon(holon: HolonId, tabs: readonly { id: string; t: string }[]) {
  if (holon === "ma") return tabs.filter((t) => t.id === "bancada");
  const owned = tabs.filter((t) => TAB_HOLON[t.id] === holon);
  return owned.length ? owned : tabs.slice();
}

export type HolonEvent = {
  holon: HolonId;
  kind: string;
  body: string;
  at: string;
  clp: string;
};

export function holonOfKind(kind: string): HolonId {
  if (/poc|pos|agora|gda|dag|mint|burn|gossip|mcmc/i.test(kind)) return "trd";
  if (/edge|mesh|settle|cmesh|lease|pulse|boot|orch|appoint/i.test(kind)) return "no";
  if (/nft|bancada|fraction|cgu/i.test(kind)) return "cgu";
  if (/kyc|session|clearance/i.test(kind)) return "dv";
  if (/qiga|sca|volition|enroll|bill|fl|republic/i.test(kind)) return "so";
  return "no";
}

export function emitHolon(kind: string, body: string, clp: string): HolonEvent {
  return { holon: holonOfKind(kind), kind, body, at: new Date().toISOString(), clp };
}
