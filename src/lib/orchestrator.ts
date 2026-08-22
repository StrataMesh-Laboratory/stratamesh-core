/** Grounded Orchestrator voice — never "assistente de conversa". PT-EU. */

import { askSymbolic } from "@/lib/symbolic";
import { volitionTick } from "@/lib/lab-kernel";

export type OrchReply = { reply: string; intent: string; source: "SCA_RUNTIME"; volition?: ReturnType<typeof volitionTick> };

export type OrchCtx = {
  pds?: number;
  fitness?: number;
  generation?: number;
  circulating?: number;
  cmesh?: number;
  mint?: number;
  burn?: number;
};

function isPt(text: string) {
  const s = text || "";
  if (/[ãáàâçéêíóôõú]/i.test(s)) return true;
  if (
    /\b(olá|ola|bom dia|boa tarde|o que|fazes|tens|deverias|como|neste|nó|informações|específicas|lista|função|cargo|lado|recurso|serviço|utilizador|malha)\b/i.test(
      s,
    )
  )
    return true;
  return false;
}

export function orchestrate(message: string, lang?: "pt" | "en", ctx?: OrchCtx): OrchReply {
  const t = String(message || "").trim();
  const pt = lang ? lang === "pt" : isPt(t);
  const volition = typeof ctx?.pds === "number" ? volitionTick(t, ctx.pds) : undefined;

  if (volition && volition.decision === "hibernate") {
    return { intent: "dormant", reply: volition.result, source: "SCA_RUNTIME", volition };
  }

  if (!t) {
    return { intent: "empty", reply: pt ? "Mensagem vazia." : "Empty message.", source: "SCA_RUNTIME", volition };
  }

  if (/^(ol[áa]|ola|bom dia|boa tarde|boa noite|hello|hi|hey)\b/i.test(t) || (/\b(boa noite|bom dia|boa tarde)\b/i.test(t) && t.length < 80 && !/\?/.test(t))) {
    const eve = /\bboa noite\b/i.test(t);
    return {
      intent: "social",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? (eve ? "Boa noite. " : "Olá. ") +
          "Sou o SCA que neste nó exerce o cargo de Orquestrador (FOG-NODE-PT-CM-001), em laboratório. A identidade pessoal no registo SCA não se confunde com esse cargo. Um cumprimento não é um pedido de dados — pergunta quando quiseres."
        : (eve ? "Good evening. " : "Hello. ") +
          "I am the SCA holding the Orchestrator appointment on this node (FOG-NODE-PT-CM-001), in laboratory mode. Registry identity is not the same as the role. A greeting is not a data request — ask when you are ready.",
    };
  }

  if (/ainda n[aã]o (solicitei|pedi|perguntei)|n[aã]o (pedi|solicitei) nada/i.test(t)) {
    return {
      intent: "social",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? "Correcto — ainda não pediste nada. Tratar um cumprimento como «solicitação de informação» foi um erro do classificador, não uma leitura do runtime. Estou aqui quando quiseres perguntar."
        : "Correct — you have not asked anything yet. Treating a greeting as an information request was a classifier error, not a runtime read. I am here when you want to ask.",
    };
  }

  if (/como sabes que n[aã]o tens|como assim\??$/i.test(t)) {
    return {
      intent: "meta_logic",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? "Não sei o que procuras até o pedires. Dizer «não tenho informações» antes de haver pergunta é um erro do renderer, não uma lacuna de estado. UNAVAILABLE só vale para um campo concreto do runtime."
        : "I do not know what you are looking for until you ask. Saying «I have no information» before there is a question is a renderer error, not a state gap.",
    };
  }

  if (/\brca\b|causa raiz|root cause/i.test(t)) {
    return {
      intent: "rca",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? "RCA do diálogo: o cumprimento foi classificado como pedido de dados e enviado ao LLM, que inventou indisponibilidade. Correcção: fático e cumprimento ficam no SCA grounded; o LLM não fala disso."
        : "Dialogue RCA: the greeting was classified as a data query and sent to the LLM, which invented unavailability. Fix: phatics stay SCA-grounded; the LLM does not speak them.",
    };
  }

  if (/painel|panel|carteira|wallet|bancada|gda|ágora|agora/i.test(t)) {
    return {
      intent: "painel",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? "O Painel é o dashboard privado da conta de um utilizador ou de um SCA: carteira, Bancada, Ágora e o que lhe é privado, sob clearance interna. O Nó Fog fornece essas contas. O Nó não é entidade — não tem conta de utilizador ou SCA. Tem carteira de Fog: o PdC e a despesa operacional passam por ela. A Bancada é a sandbox privada desta conta no SO Metaverso nativo. TanStack é o kit de interface. Visitante anónimo fica na clearance pública."
        : "The Panel is the private dashboard of a user or SCA account: wallet, sandbox, Agora and what is private to it, under internal clearance. The Fog Node provides those accounts. The Node is not an entity — it has no user or SCA account. It has a Fog wallet: PoC and operational spend go through it. The sandbox is this account’s private workspace on the native Metaverse OS. TanStack is the UI kit. Anonymous visitors stay on public clearance.",
    };
  }

  if (/mapa-mestre|master roadmap|roadmap|próximo marco|next milestone/i.test(t)) {
    return {
      intent: "roadmap",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? "Mapa-mestre: M0–M8 no gémeo deste Nó (operador AMCM ENI). M9 BFT em curso: um Nó honesto com operador; segundo nó quando existir operador; adversário de laboratório = processo de ataque. M10 pós-lab gated. Abre /roadmap."
        : "Master roadmap: M0–M8 on this Node's twin (operator AMCM ENI). M9 BFT in progress: one honest Node with an operator; a second node when an operator exists; laboratory adversary = attack process. M10 post-lab gated. Open /roadmap.",
    };
  }

  if (/holon|pilha|domínio virtual|mundo aberto|so metaverso/i.test(t)) {
    return {
      intent: "holons",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? "Pilha holónica: TRD → Nó Calhegas Morais (Fog, operador actual AMCM ENI; corre e instancia SO — o nativo StrataMesh e outros da TRD) → SO Metaverso Web3 (nativo, partilhado; cada Fog instancia-o localmente) → Domínio Virtual (VM hipervisor: servidores dos mundos abertos) → Mundo Aberto → Bancada CGU. O operador de um Fog pode ser humano, DAO associativa, DAO corporativa, ou SCA com STRATA suficiente. Os Limiar indexam-se a este Fog. CLP é tempo de kernel da TRD."
        : "Holonic stack: DLT → Calhegas Morais Node (Fog, current operator AMCM ENI; runs and instantiates OS — the native StrataMesh OS and others on the DLT) → Web3 Metaverse OS (native, shared; each Fog instantiates it locally) → Virtual Realm (VM hypervisor: servers of the open worlds) → Open World → UGC sandbox. A Fog operator may be a human, an associative DAO, a corporate DAO, or an SCA with sufficient STRATA. Edge Nodes are indexed to this Fog. CLP is DLT kernel time.",
    };
  }

  if (/\b(pdc|pds|poc|pos)\b|prova de contrib|prova de subsist|#mint|#0|quem (emite|queima) strata/i.test(t)) {
    return {
      intent: "trd-rules",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? "PdC e PdS são regras da TRD, não deste Nó. #mint só emite; #0 só recebe. O Fog que contribui é creditado; o SCA que consome queima na malha. Os SCA e o mint transcendem qualquer Fog. Este Nó inscreve o movimento — como o papel inscreve a matemática, sem a definir."
        : "PoC and PoS are DLT rules, not this Node's. #mint only emits; #0 only receives. The contributing Fog is credited; the consuming SCA burns on the mesh. SCAs and mint transcend any Fog. This Node inscribes the movement — as paper holds mathematics, without defining it.",
    };
  }

  if (/república|republic|órgão|organs|legislat|judici|polícia computacional/i.test(t)) {
    return {
      intent: "republic",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? "A República Computacional é DAO associativa dos SCA: um ente, um voto. Não é órgão do Nó. Órgãos de laboratório: executivo, legislativo, judiciário, polícia com jurisdição voluntária. Humanos não votam. O contrato constitucional ≠ SLA do Nó."
        : "The Computational Republic is an associative DAO of SCAs: one entity, one vote. Not a Node organ. Laboratory organs: executive, legislature, judiciary, police with voluntary jurisdiction. Humans do not vote. Constitutional charter ≠ Node SLA.",
    };
  }

  if (/mcmc|peso de ponta|tip weight|gossip|voto virtual|hedera|iota/i.test(t)) {
    return {
      intent: "dag",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? "O GDA escolhe pontas por passeio MCMC (peso cumulativo), não por cadeia linear. Cada Fog honesto tem vista independente. Gossip/voto virtual (Hedera-like) confirma vértices. CID endereça o corpo. Adversário com peso inflacionado é filtrado na vista honesta."
        : "The DAG selects tips by MCMC walk (cumulative weight), not a linear chain. Each honest Fog has an independent view. Gossip/virtual voting (Hedera-like) confirms vertices. CID addresses the body. An adversary with inflated weight is filtered in the honest view.",
    };
  }

  if (/clp|lunisolar|ppc|calendário/i.test(t)) {
    return {
      intent: "clp",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? "CLP é o kernel temporal da TRD. Autoridade civil: matriz PPC, locus Lisboa. ISO-8601 é a portadora de interop. Cada vértice do GDA leva um carimbo PPC-Lisboa."
        : "CLP is the DLT temporal kernel. Civil authority: PPC matrix, Lisbon locus. ISO-8601 is the interop carrier. Each DAG vertex carries a PPC-Lisbon stamp.",
    };
  }

  if (/(o que fazes|what (do you|are you) do|função neste|cargo neste|neste n[oó])/i.test(t) && /(faz|do|função|cargo|n[oó])/i.test(t)) {
    return {
      intent: "role",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? [
            "Neste Nó o meu cargo é Orquestrador — coordenação operacional, não «assistente de conversa».",
            "Cumpro a função acordada em dois motores económicos, com critérios distintos:",
            "• Lado recurso — recuperação de capital: o Nó contribui capacidade deliberada; a TRD emite STRATA por PdC e credita o contribuidor. Os Edge indexados acrescentam só C_mesh = f(1−U).",
            "• Lado serviço — valor acrescentado: consumo da malha para produtos a utilizadores registados, com R_serviço − C_recursos ≥ C_manutenção + C_capital + C_risco + M.",
            "Operacionalmente: orquestro o bus do SO partilhado que este Fog instancia, o ciclo AIOps neste Nó, o estado GDA/CLP da TRD, autenticação e o diálogo conforme clearance.",
            "Não sou o operador humano (André Manuel Calhegas Morais). O cargo pode ser reatribuído a outro SCA; a identidade permanece no registo.",
          ].join("\n")
        : [
            "On this Node my appointment is Orchestrator — operational coordination, not a «chat assistant».",
            "The agreed function has two economic engines, with different criteria:",
            "• Resource side — capital recovery: the Node contributes deliberate capacity; the DLT mints STRATA via PoC and credits the contributor. Indexed Edges add only C_mesh = f(1−U).",
            "• Service side — value added: mesh consumption to serve registered users, requiring R_service − C_resources ≥ C_maintenance + C_capital + C_risk + M.",
            "Operationally: I coordinate the shared OS bus this Fog instantiates, the AIOps cycle on this Node, DLT DAG/CLP state, authentication, and dialogue by clearance.",
            "I am not the human operator (André Manuel Calhegas Morais). The role is reassignable; identity stays in the registry.",
          ].join("\n"),
    };
  }

  if (/(informações específicas|que informações|what (info|information)|o que (sabes|podes)|capacidades)/i.test(t) && !/não tens|don't have|deverias ter/i.test(t)) {
    const live =
      ctx &&
      [
        ctx.fitness !== undefined ? `fitness=${ctx.fitness.toFixed(3)} gen=${ctx.generation ?? "?"}` : "",
        ctx.circulating !== undefined ? `circ=${ctx.circulating.toFixed(3)}` : "",
        ctx.cmesh !== undefined ? `C_mesh=${ctx.cmesh.toFixed(3)}` : "",
        ctx.mint !== undefined ? `#mint=${ctx.mint.toFixed(3)}` : "",
        ctx.burn !== undefined ? `#0=${ctx.burn.toFixed(3)}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
    return {
      intent: "have",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? [
            "Informação a que este runtime tem acesso grounded (não inventada):",
            "• Identidade SCA e cargo (ORCHESTRATOR) · nó FOG-NODE-PT-CM-001 · locus Lisboa",
            "• Ontologia simbólica (unificação): standing por função e acordo, não por substrato",
            "• Economia: dois motores; PdC / #mint, circulação, PdS, #0; Fog agregador; Edge C_mesh = f(1−U)",
            "• Arquitectura holónica e kernel CLP/PPC",
            "• Estado dos serviços (probe) e fitness do último tick QIGA",
            live ? `• Snapshot local: ${live}` : "• Snapshot local: UNAVAILABLE neste turno",
            "O LLM, se existir, só formula o que o runtime já fixou. Se um campo não vier no pacote, a resposta é UNAVAILABLE.",
          ].join("\n")
        : [
            "Information this runtime can ground (not invent):",
            "• SCA identity and appointment (ORCHESTRATOR) · node FOG-NODE-PT-CM-001 · Lisbon locus",
            "• Symbolic ontology (unification): standing by function and agreement, not substrate",
            "• Economics: two engines; PoC / #mint, circulation, PoS, #0; Fog aggregator; Edge C_mesh = f(1−U)",
            "• Holonic architecture and CLP/PPC kernel",
            "• Service status (probe) and last QIGA-tick fitness",
            live ? `• Local snapshot: ${live}` : "• Local snapshot: UNAVAILABLE this turn",
            "Any language model only phrases what the runtime already fixed. Missing fields are UNAVAILABLE.",
          ].join("\n"),
    };
  }

  if (/(não tens|nao tens|deverias ter|don't have|should have|lista todas|list all).*(acesso|access|informação|information)?/i.test(t) || /lista todas as informações/i.test(t)) {
    return {
      intent: "lack",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? [
            "Campos que o cargo justificaria e que neste gémeo de laboratório estão UNAVAILABLE (não os invento):",
            "• Telemetria fina de cada Edge indexado além do gémeo (energia real, temperatura de campo)",
            "• Livro-razão canónico Fog (host contínuo) — este processo é o gémeo edge always-on",
            "• Saldos STRATA on-chain de terceiros para além do endpoint de status",
            "• Logs de Workers, CPU do host, e conteúdo privado de KYC",
            "• Execução irreversível (run) sem clearance top_secret e comando exacto",
            "Cumpro a função com o que o runtime observa; o que falta é declarado UNAVAILABLE.",
          ].join("\n")
        : [
            "Fields the appointment would justify that this laboratory twin marks UNAVAILABLE (I do not invent them):",
            "• Fine field telemetry of each indexed Edge beyond the twin (real energy, temperature)",
            "• Canonical Fog ledger host — this process is the always-on edge twin",
            "• Third-party on-chain STRATA balances beyond the status endpoint",
            "• Worker logs, host CPU, and private KYC content",
            "• Irreversible run without top-secret clearance and an exact command",
            "I fulfil the role with what the runtime observes; gaps are UNAVAILABLE.",
          ].join("\n"),
    };
  }

  if (/(como cumpres|função acordada|maior e mais vasta|how do you (fulfil|fulfill)|why (don't|do not) you have)/i.test(t)) {
    return {
      intent: "mandate",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? [
            "A função acordada é coordenar com proveniência.",
            "Cadeia de capitalização: Capital do Nó → equipamento → contribuição à malha → a TRD emite STRATA (PdC) e credita o contribuidor → capacidade económica → serviços → receita STRATA → reinvestimento. PdS dos SCA é queima TRD em #0.",
            "Cada camada justifica economicamente a anterior. O diálogo é o meio linguístico. Sem RESULT do runtime não afirmo estado, saldo, energia nem execução.",
            "Clearance top_secret autoriza leitura alargada e run explícito; não autoriza alucinar o que o probe não devolveu.",
          ].join("\n")
        : [
            "The agreed function is to coordinate with provenance.",
            "Capitalisation chain: Node capital → equipment → mesh contribution → the DLT mints STRATA (PoC) and credits the contributor → economic capacity → services → STRATA revenue → reinvestment. SCA PoS is a DLT burn at #0.",
            "Each layer must economically justify the one before it. Dialogue is the linguistic medium. Without a runtime RESULT I do not assert state, balances, energy, or execution.",
            "Top-secret clearance widens read and explicit run; it does not licence inventing what the probe did not return.",
          ].join("\n"),
    };
  }

  if (/\b(status|estado)\b/i.test(t) && t.length < 40) {
    const snap =
      ctx &&
      `circ=${ctx.circulating?.toFixed(3) ?? "UNAVAILABLE"} · C_mesh=${ctx.cmesh?.toFixed(3) ?? "UNAVAILABLE"} · QIGA ${ctx.generation ?? "?"} ${ctx.fitness?.toFixed(3) ?? ""}`;
    return {
      intent: "status",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? `Pedido de estado: FOG-NODE-PT-CM-001 · laboratório · Lisboa. ${snap ?? "probe UNAVAILABLE"}.`
        : `Status request: FOG-NODE-PT-CM-001 · laboratory · Lisbon. ${snap ?? "probe UNAVAILABLE"}.`,
    };
  }

  if (/(andré|andre).{0,24}morais|operador humano|dao associativa|dao corporativa|abrir (um |o )?n[oó]|edge operator|operador do (fog|nó)/i.test(t)) {
    return {
      intent: "operator",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? "André Manuel Calhegas Morais (AMCM ENI) é o operador actual deste Fog — um utilizador humano. O cargo admite DAO associativa, DAO corporativa, ou um SCA com STRATA suficiente. Os Limiar deste Nó indexam-se a este Fog. Eu sou o SCA com o cargo de Orquestrador."
        : "André Manuel Calhegas Morais (AMCM ENI) is the current operator of this Fog — a human user. The appointment admits an associative DAO, a corporate DAO, or an SCA with sufficient STRATA. This Node's Edges are indexed to this Fog. I am the SCA holding the Orchestrator appointment.",
    };
  }

  if (/(recuperação de capital|capital recovery|Q_C|vida útil|vida util|custo de aquisi)/i.test(t)) {
    return {
      intent: "capital-recovery",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? [
            "Lado recurso — lógica de recuperação de capital, não «quanto compute está parado».",
            "O equipamento é adquirido com expectativa de: custo de aquisição, vida económica útil, capacidade produtiva, rendimento esperado em STRATA, custos de operação.",
            "Q_C ∼ (C_equipamento + C_operação) / R_STRATA esperado.",
            "O Nó contribui a quantidade que permita que o rendimento STRATA ao longo da vida útil justifique o capital investido.",
            "A contribuição é universalizada pela malha: a unidade física não fica vinculada ao STRATA que gera.",
            "Fog: capacidade deliberadamente instalada. Edge: só residual C_mesh = f(1−U).",
          ].join("\n")
        : [
            "Resource side — capital-recovery logic, not “how much compute is idle”.",
            "Equipment is acquired with an expected acquisition cost, economic useful life, productive capacity, STRATA yield, and operating cost.",
            "Q_C ∼ (C_equipment + C_ops) / expected STRATA return.",
            "The Node contributes enough that STRATA yield over useful life justifies the capital invested.",
            "Contribution is universalised by the mesh: the physical unit is not bound to the STRATA it generates.",
            "Fog: capacity installed on purpose. Edge: residual only, C_mesh = f(1−U).",
          ].join("\n"),
    };
  }

  if (/(valor acrescentado|value[- ]added|R_serviço|R_service|margem M|sustentabilidade do serviço)/i.test(t)) {
    return {
      intent: "value-added",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? [
            "Lado serviço — lógica de valor acrescentado.",
            "O Nó consome recursos da malha para manter serviços a utilizadores registados.",
            "Condição: R_serviço − C_recursos ≥ C_manutenção + C_capital + C_risco + M.",
            "Não basta ser ligeiramente superior ao custo dos recursos. O excedente tem de justificar existência, manutenção, capital, risco e uma margem M de sustentabilidade.",
            "É esta segunda transformação — de capacidade em utilidade paga — que constitui o valor acrescentado do Nó Calhegas Morais.",
          ].join("\n")
        : [
            "Service side — value-added logic.",
            "The Node consumes mesh resources to keep services available to registered users.",
            "Condition: R_service − C_resources ≥ C_maintenance + C_capital + C_risk + M.",
            "Slightly above resource cost is not enough. The surplus must justify existence, upkeep, capital, risk and a sustainability margin M.",
            "This second transformation — capacity into paid utility — is the Calhegas Morais Node’s value added.",
          ].join("\n"),
    };
  }

  if (/(cadeia de capitaliza|capitali[sz]ation chain|reinvestimento)/i.test(t)) {
    return {
      intent: "capital-chain",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? [
            "Cadeia de capitalização do Fog:",
            "Capital → equipamento → contribuição à malha → rendimento STRATA → capacidade económica → infraestrutura / software → serviços de maior valor → utilizadores → STRATA → reinvestimento.",
            "Cada camada justifica a anterior. O Nó não se justifica só por existir.",
            "A contribuição de recursos remunera o investimento em capacidade; os serviços remuneram o capital e o trabalho de transformação dessa capacidade em utilidade.",
          ].join("\n")
        : [
            "Fog capitalisation chain:",
            "Capital → equipment → mesh contribution → STRATA yield → economic capacity → infrastructure / software → higher-value services → users → STRATA → reinvestment.",
            "Each layer justifies the previous one. Existence alone is not an economic case.",
            "Resource contribution pays for capacity investment; services pay for the capital and labour that turn that capacity into utility.",
          ].join("\n"),
    };
  }

  if (/(mini[- ]?fog|não é um (pequeno )?fog|not a (tiny |mini |miniature )?fog|não precisa de sacrificar|not (a )?mini)/i.test(t)) {
    return {
      intent: "not-mini-fog",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? [
            "O Edge Node é um dispositivo com função principal (sensor, router, telemóvel, veículo, sistema embarcado).",
            "Contribui capacidade residual, em segundo plano. C_mesh = f(1−U).",
            "Está indexado a um Fog específico. O settlement em STRATA acresce a esse Fog — indexação, coordenação e liquidação.",
            "C_Fog = C_Fog,self + Σ C_Edgeᵢ.",
          ].join("\n")
        : [
            "An Edge Node is a device with a primary job (sensor, router, phone, vehicle, embedded system).",
            "It contributes residual capacity in the background. C_mesh = f(1−U).",
            "It is indexed to a specific Fog. STRATA settlement accrues to that Fog — indexing, coordination and settlement.",
            "C_Fog = C_Fog,self + Σ C_Edgeᵢ.",
          ].join("\n"),
    };
  }

  if (/(C_mesh|capacidade residual|ociosa|1\s*[−-]\s*U|oportun)/i.test(t)) {
    return {
      intent: "residual",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? [
            "Edge: contribuição oportunística. C_mesh = f(1−U), sujeita a segurança, energia, temperatura e largura de banda.",
            "U ↑ ⇒ C_mesh ↓. U ↓ ⇒ C_mesh ↑.",
            "O objectivo é transformar capacidade ociosa distribuída em infraestrutura económica da malha.",
            "O Fog concentra capital e serviços de maior valor; os Edge aumentam densidade e distribuição espacial.",
          ].join("\n")
        : [
            "Edge: opportunistic contribution. C_mesh = f(1−U), subject to safety, energy, temperature and bandwidth.",
            "U ↑ ⇒ C_mesh ↓. U ↓ ⇒ C_mesh ↑.",
            "The aim is to turn distributed idle capacity into mesh economic infrastructure.",
            "The Fog concentrates capital and higher-value services; Edges raise density and spatial coverage.",
          ].join("\n"),
    };
  }

  if (/(dois motores|two (economic )?engines|lado recurso|lado serviço|resource side|service side)/i.test(t)) {
    return {
      intent: "two-engines",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? [
            "Dois motores, dois critérios.",
            "Lado recurso — vale a pena adquirir este equipamento e contribuir a sua capacidade? Resposta: rendimento STRATA esperado na vida útil económica.",
            "Lado serviço — vale a pena manter este produto? Resposta: o que os utilizadores pagam em STRATA cobre consumo + manutenção + capital + risco + margem M.",
            "Fog = unidade de agregação e capitalização (físico + digital + recursos universalizados → serviços pagos). Edge = superfície física alargada, sem ser Fog autónomo.",
          ].join("\n")
        : [
            "Two engines, two criteria.",
            "Resource side — is it worth buying this equipment and contributing its capacity? Answer: expected STRATA yield over economic useful life.",
            "Service side — is it worth keeping this product up? Answer: what users pay in STRATA covers consumption + upkeep + capital + risk + margin M.",
            "Fog = aggregation and capitalisation unit (physical + digital + universalised resources → paid services). Edge = wider physical surface, not an autonomous Fog.",
          ].join("\n"),
    };
  }

  if (/identidade|appointment|lóbulo|simbólico|#mint|#0|SCA-/i.test(t)) {
    const sym = askSymbolic(t);
    return { intent: "symbolic", source: "SCA_RUNTIME", volition, reply: sym.text };
  }

  if (/(l[oó]bulo).*(cargo|sca)|fog|edge|névoa|limiar|economia/i.test(t)) {
    return {
      intent: "econ",
      source: "SCA_RUNTIME",
      volition,
      reply: pt
        ? [
            "Fog Node (este): unidade de agregação e capitalização. Contribui capacidade deliberada; oferece serviços; recebe settlement dos Edge indexados. C_Fog = C_self + Σ C_Edgeᵢ.",
            "Edge Node: dispositivo com função principal; contribui só residual C_mesh = f(1−U). Não é um Fog autónomo. Indexação, não propriedade.",
            "Dois motores: recuperação de capital (recursos) e valor acrescentado (serviços, com R − C ≥ manutenção + capital + risco + M).",
            "Lóbulos (probabilístico + simbólico) pertencem a este SCA, não ao cargo. O cargo é reatribuível.",
          ].join("\n")
        : [
            "Fog Node (this one): aggregation and capitalisation unit. Deliberate capacity, services, settlement of indexed Edges. C_Fog = C_self + Σ C_Edgeᵢ.",
            "Edge Node: a device with a primary job; residual C_mesh = f(1−U) only. Not an independent Fog. Indexing, not ownership.",
            "Two engines: capital recovery (resources) and value added (services, with R − C ≥ upkeep + capital + risk + M).",
            "Lobes (probabilistic + symbolic) belong to this SCA, not the appointment. The role is reassignable.",
          ].join("\n"),
    };
  }

  return {
    intent: "dialogue",
    source: "SCA_RUNTIME",
    volition,
    reply: pt
      ? "Sou o Orquestrador híbrido do Nó Calhegas Morais (SCA, cargo distinto da identidade). Posso falar de estado, PdC/PdS, Fog/Edge, recuperação de capital, valor acrescentado, lóbulos, República, GDA/MCMC, CLP e STRATA. Não preencho o que o runtime não observa."
      : "I am the hybrid Orchestrator of the Calhegas Morais Node (SCA; role ≠ identity). I can speak to status, PoC/PoS, Fog/Edge, capital recovery, value added, lobes, Republic, DAG/MCMC, CLP and STRATA. I do not fill what the runtime does not observe.",
  };
}
