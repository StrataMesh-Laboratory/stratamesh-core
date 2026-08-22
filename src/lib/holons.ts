/** Holonic stack — nested layers of the Calhegas Morais Node.
 *
 *   0  TRD              Distributed ledger: GDA, STRATA poles, PdC, PdS, CLP, SCA identity.
 *   1  Nó Fog           Fog holon with operator. Runs and instantiates OS (native StrataMesh + others on the TRD).
 *   2  SO Metaverso     Native StrataMesh Web3 Metaverse OS, shared, instantiated locally by Fog Nodes.
 *        2.1  DV        Virtual Realm = VM hypervisors (servers of the open worlds)
 *        2.2  MA        Open World — hosted on those VM hypervisors
 *        2.3  Bancada   Creation sandbox of users and SCAs, hosted in the open worlds
 *              Painel   Private dashboard of that account. TanStack is the UI kit.
 *   —  User | SCA       account holders (Painel + Bancada). The Node provides accounts.
 *                       The Node is not an entity: no user/SCA account. It has a Fog wallet.
 *
 *   CLP is TRD kernel time. PdC / PdS belong to the TRD. Edge is indexed to a Fog.
 */

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
      body: "Tecnologia de Registo Distribuído StrataMesh: GDA, pólos STRATA (#mint / #0), PdC, PdS, CLP e identidade SCA. O Fog inscreve estas regras na malha.",
    },
    en: {
      title: "DLT",
      body: "StrataMesh Distributed Ledger: DAG, STRATA poles (#mint / #0), PoC, PoS, CLP and SCA identity. The Fog inscribes these rules on the mesh.",
    },
  },
  {
    id: "no",
    n: "1",
    pt: {
      title: "Nó Calhegas Morais",
      body: "Holon Fog FOG-NODE-PT-CM-001 · Lisboa. Operador actual: André Manuel Calhegas Morais, AMCM ENI (humano). O cargo admite DAO associativa, DAO corporativa, ou um SCA com STRATA suficiente para abrir Fog. Camada acima do SO: corre e instancia localmente sistemas operativos — o SO Metaverso nativo da StrataMesh e outros SO desenvolvidos ou importados na TRD — e indexa Limiar.",
    },
    en: {
      title: "Calhegas Morais Node",
      body: "Fog holon FOG-NODE-PT-CM-001 · Lisbon. Current operator: André Manuel Calhegas Morais, AMCM ENI (human). The appointment admits an associative DAO, a corporate DAO, or an SCA with sufficient STRATA to open a Fog. Layer above the OS: it runs and instantiates operating systems locally — the native StrataMesh Metaverse OS and other OS developed or imported on the TRD — and indexes Edge.",
    },
  },
  {
    id: "so",
    n: "2",
    pt: {
      title: "SO Metaverso",
      body: "Sistema operativo nativo do metaverso Web3 da StrataMesh, partilhado entre nós. Os Fog instanciam-no localmente: uma sessão local do SO partilhado. Vive na camada abaixo do Nó. Sub-sistemas: Domínio Virtual (VM hipervisor), Mundo Aberto e Bancada CGU. Cada conta de utilizador ou SCA recebe o seu Painel e a sua Bancada neste SO.",
    },
    en: {
      title: "Metaverse OS",
      body: "Native StrataMesh Web3 metaverse operating system, shared among nodes. Fog Nodes instantiate it locally: a local session of the shared OS. It lives in the layer below the Node. Subsystems: Virtual Realm (VM hypervisor), Open World and UGC sandbox. Each user or SCA account is assigned its Panel and sandbox on this OS.",
    },
  },
  {
    id: "dv",
    n: "3",
    pt: {
      title: "Domínio Virtual",
      body: "Sub-sistema do SO Metaverso: as VM hipervisores — servidores que instanciam e sustentam os mundos abertos.",
    },
    en: {
      title: "Virtual Realm",
      body: "Subsystem of the Metaverse OS: the VM hypervisors — servers that instantiate and run the open worlds.",
    },
  },
  {
    id: "ma",
    n: "4",
    pt: {
      title: "Mundo Aberto",
      body: "Sub-sistema habitável do SO Metaverso, hospedado nas VM do Domínio Virtual. Objectos NFT STRATA. Utilizadores e SCA coexistem aqui.",
    },
    en: {
      title: "Open World",
      body: "Habitable subsystem of the Metaverse OS, hosted on the Virtual Realm VMs. STRATA NFT objects. Users and SCAs coexist here.",
    },
  },
  {
    id: "cgu",
    n: "5",
    pt: {
      title: "Bancada CGU",
      body: "Espaço privado de criação de cada conta de utilizador ou SCA, atribuído pelo Nó. O Nó fornece essas contas; o Nó não é entidade e não tem conta. Tem carteira de Fog: o que produz (PdC) e o que gasta passa por ela. Criações = NFT STRATA. O Painel desta conta abre-se aqui; TanStack é o kit de interface.",
    },
    en: {
      title: "UGC Sandbox",
      body: "Private creation space of each user or SCA account, assigned by the Node. The Node provides those accounts; the Node is not an entity and has no account. It has a Fog wallet: what it produces (PoC) and what it spends goes through that wallet. Creations = STRATA NFTs. This account’s Panel opens here; TanStack is the UI kit.",
    },
  },
];

export const TAB_HOLON: Record<string, HolonId> = {
  pulse: "no",
  edge: "no",
  mesh: "no",
  orch: "no",
  wallet: "cgu",
  agora: "trd",
  dag: "trd",
  sca: "so",
  republic: "so",
  kyc: "cgu",
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
  if (/\bvm\b|hypervisor|realm|domínio virtual|dominio virtual|virtual.?realm/i.test(kind)) return "dv";
  if (/edge|mesh|settle|cmesh|lease|pulse|boot|orch|appoint/i.test(kind)) return "no";
  if (/nft|bancada|fraction|cgu/i.test(kind)) return "cgu";
  if (/kyc|session|clearance/i.test(kind)) return "dv";
  if (/qiga|sca|volition|enroll|bill|fl|republic/i.test(kind)) return "so";
  return "no";
}

export function emitHolon(kind: string, body: string, clp: string): HolonEvent {
  return { holon: holonOfKind(kind), kind, body, at: new Date().toISOString(), clp };
}
