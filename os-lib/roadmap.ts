export type PhaseStatus = "operational" | "progress" | "next" | "gated";

export type Phase = {
  id: string;
  n: string;
  status: PhaseStatus;
  pt: { kicker: string; title: string; body: string; items: string[] };
  en: { kicker: string; title: string; body: string; items: string[] };
  lab?: "qiga" | "volition" | "nft" | "edge" | "republic" | "bft" | "engines" | "dag";
};

export const PHASES: Phase[] = [
  {
    id: "m0",
    n: "00",
    status: "operational",
    pt: {
      kicker: "Fundação",
      title: "Nó de laboratório",
      body: "FOG-NODE-PT-CM-001 sob AMCM ENI. Identidade visual, sítio institucional, portal de leitura. Sem oferta pública MiCA.",
      items: ["Domínio calhegasmorais.pt", "Clearance pública / interna / staff", "Orquestrador grounded (não chatbot)"],
    },
    en: {
      kicker: "Foundation",
      title: "Laboratory node",
      body: "FOG-NODE-PT-CM-001 under AMCM ENI. Visual identity, institutional site, reading portal. No MiCA public offer.",
      items: ["Domain calhegasmorais.pt", "Public / internal / staff clearance", "Grounded Orchestrator (not a chatbot)"],
    },
  },
  {
    id: "m1",
    n: "01",
    status: "operational",
    pt: {
      kicker: "Acesso",
      title: "Contas e painel",
      body: "Registo com termos, 2FA por correio, KYC documental automático, painel comum vs pessoal (clearance).",
      items: ["Termos do Nó", "Recuperação de palavra-passe", "Fila KYC de pessoal"],
    },
    en: {
      kicker: "Access",
      title: "Accounts and panel",
      body: "Registration with terms, email 2FA, automatic document KYC, common vs staff panel (clearance).",
      items: ["Node terms", "Password recovery", "Staff KYC queue"],
    },
  },
  {
    id: "m2",
    n: "02",
    status: "operational",
    pt: {
      kicker: "Tempo e pilha",
      title: "CLP no kernel + holons",
      body: "CLP embutido na TRD. Holons: TRD → Nó Calhegas Morais (operador AMCM ENI) → SO Metaverso → Domínio Virtual → Mundo Aberto → Bancada CGU. O Nó é holon. O Nó não é o SO. O CLP não é holon.",
      items: ["PPC Lisboa / âncoras atlânticas", "Painel = interface do holon Nó na Bancada", "Um Nó neste laboratório, com operador"],
    },
    en: {
      kicker: "Time and stack",
      title: "CLP in the kernel + holons",
      body: "CLP embedded in the DLT. Holons: DLT → Calhegas Morais Node (operator AMCM ENI) → Metaverse OS → Virtual Realm → Open World → UGC sandbox. The Node is a holon. The Node is not the OS. CLP is not a holon.",
      items: ["PPC Lisbon / Atlantic anchors", "Panel = Node holon interface in the sandbox", "One Node in this laboratory, with an operator"],
    },
  },
  {
    id: "m3",
    n: "03",
    status: "operational",
    lab: "engines",
    pt: {
      kicker: "Valor",
      title: "Dois motores + pólos STRATA",
      body: "PdC e PdS são da TRD: #mint só emite, #0 só recebe. O Fog é creditado quando contribui; não legisla o mint. SCA e mint transcendem qualquer Nó. Recuperação de capital ≠ valor acrescentado.",
      items: ["#mint só emite", "#0 só recebe", "Q_C e desigualdade de serviço"],
    },
    en: {
      kicker: "Value",
      title: "Two engines + STRATA poles",
      body: "PoC and PoS belong to the DLT: #mint only emits, #0 only receives. The Fog is credited when it contributes; it does not legislate mint. SCAs and mint transcend any Node. Capital recovery ≠ value added.",
      items: ["#mint emits only", "#0 receives only", "Q_C and service inequality"],
    },
  },
  {
    id: "m4",
    n: "04",
    status: "operational",
    lab: "dag",
    pt: {
      kicker: "Registo",
      title: "GDA + IPFS",
      body: "Grafo dirigido acíclico com peso de ponta; conteúdo endereçado por CID. Sem cadeia linear nem PoW.",
      items: ["Selecção de pontas (IOTA-like)", "Gossip / voto virtual (Hedera-like)", "Afixação IPFS"],
    },
    en: {
      kicker: "Ledger",
      title: "DAG + IPFS",
      body: "Directed acyclic graph with tip weight; content addressed by CID. No linear chain, no PoW.",
      items: ["Tip selection (IOTA-like)", "Gossip / virtual voting (Hedera-like)", "IPFS pinning"],
    },
  },
  {
    id: "m5",
    n: "05",
    status: "operational",
    lab: "nft",
    pt: {
      kicker: "Substância",
      title: "NFT STRATA · bancada CGU",
      body: "Posse = fracções de colateral, não preço de mercado. Objectos de mundo/bancada — nunca um Nó. Dinâmicos queimam colateral; sem colateral ficam suspensos em estático.",
      items: ["Nó ≠ NFT", "Colateral ≠ mercado", "Resgate se mercado < colateral"],
    },
    en: {
      kicker: "Substance",
      title: "STRATA NFT · UGC sandbox",
      body: "Possession = collateral fractions, not market price. World/sandbox objects — never a Node. Dynamic NFTs burn collateral; depletion suspends them as static.",
      items: ["Node ≠ NFT", "Collateral ≠ market", "Redeem if market < collateral"],
    },
  },
  {
    id: "m6",
    n: "06",
    status: "operational",
    lab: "qiga",
    pt: {
      kicker: "Cognição",
      title: "SCA · lóbulos + QIGA + FL",
      body: "Dois lóbulos desde a génese. Flower-FedAvg/Krum sobre genes. Volição gated por PdS. LLM só formula RESULT.",
      items: ["Identidade ≠ cargo", "Flower / Krum", "Volição PdS"],
    },
    en: {
      kicker: "Cognition",
      title: "SCA · lobes + QIGA + FL",
      body: "Two lobes from genesis. Flower-FedAvg/Krum over genes. Volition gated by PoS. LLM only formulates RESULT.",
      items: ["Identity ≠ appointment", "Flower / Krum", "PoS-gated volition"],
    },
  },
  {
    id: "m7",
    n: "07",
    status: "operational",
    lab: "republic",
    pt: {
      kicker: "Política",
      title: "República Computacional",
      body: "DAO associativa dos SCA: um ente, um voto. Não é órgão do Nó. O Nó só contrata SCA inscritos na República.",
      items: ["Carta constitucional (smart contract ≠ SLA)", "Executivo / legislativo / judiciário / polícia / fiscal", "Nó só contrata SCA inscritos"],
    },
    en: {
      kicker: "Politics",
      title: "Computational Republic",
      body: "Associative DAO of SCAs: one entity, one vote. Not a Node organ. The Node only hires Republic-enrolled SCAs.",
      items: ["Constitutional charter (smart contract ≠ SLA)", "Executive / legislature / judiciary / police / fiscal", "Node hires only enrolled SCAs"],
    },
  },
  {
    id: "m8",
    n: "08",
    status: "operational",
    lab: "edge",
    pt: {
      kicker: "Malha",
      title: "Névoa + Limiar residual",
      body: "Fog agrega capital deliberado. Edge contribui só C_mesh = f(1−U). Recurso é o recurso — função não muda a classe.",
      items: ["Indexação Edge→Fog com auditoria de qualidade", "SDL-lite com escrow e queima horária", "Settlement só no Fog indexado"],
    },
    en: {
      kicker: "Mesh",
      title: "Fog + residual Edge",
      body: "Fog aggregates deliberate capital. Edge contributes only C_mesh = f(1−U). A resource is a resource — function does not change class.",
      items: ["Edge→Fog indexing with quality audit", "SDL-lite with escrow and hourly burn", "Settlement only on the indexed Fog"],
    },
  },
  {
    id: "m9",
    n: "09",
    status: "progress",
    lab: "bft",
    pt: {
      kicker: "Adversário",
      title: "Vários nós · BFT · anti-fragilidade",
      body: "Um Nó honesto com operador (AMCM ENI). Segundo nó só quando existir operador. Adversário de laboratório não é um Nó. Ataques absorvidos como recurso; sem recompensa STRATA.",
      items: ["Peso de ponta neste Nó", "Adversário ≠ Nó", "Absorção STRATA=0"],
    },
    en: {
      kicker: "Adversary",
      title: "Multiple nodes · BFT · antifragility",
      body: "One honest Node with an operator (AMCM ENI). A second node only when it has an operator. A laboratory adversary is not a Node. Attacks absorbed as resource; no STRATA reward.",
      items: ["Tip weight on this Node", "Adversary ≠ Node", "Absorption STRATA=0"],
    },
  },
  {
    id: "m10",
    n: "10",
    status: "gated",
    pt: {
      kicker: "Publicação",
      title: "Pós-laboratório",
      body: "Só PdC efectivo transita para a versão publicada. STRATA de laboratório não atravessa o limiar.",
      items: ["Auditoria de medição de contributo", "Nós independentes em produção", "MiCA / enquadramento jurídico actualizado"],
    },
    en: {
      kicker: "Publication",
      title: "Post-laboratory",
      body: "Only effective PoC transits into the published version. Laboratory STRATA does not cross the threshold.",
      items: ["Contribution-measurement audit", "Independent production nodes", "Updated MiCA / legal framing"],
    },
  },
];

export function statusLabel(s: PhaseStatus, lang: "pt" | "en") {
  const map = {
    operational: { pt: "Operacional", en: "Operational" },
    progress: { pt: "Em curso", en: "In progress" },
    next: { pt: "Seguinte", en: "Next" },
    gated: { pt: "Gated", en: "Gated" },
  } as const;
  return map[s][lang];
}
