import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FogEdgeSvg, HolonSvg, MoneyFlowSvg, ResidualSvg, TwoEnginesSvg } from "@/components/diagrams";
import { CAPITAL_CHAIN, FAQ, GLOSSARY, PLAIN } from "@/lib/copy/site";
import { fetchNodeStatus, trackEvent, type NodeStatus } from "@/lib/status";
import { orchestrate } from "@/lib/orchestrator";
import { moneyOf, meshOf } from "@/lib/node-store";
import { useHydratedNode } from "@/components/kernel-ui";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SignedIn, SignedOut } from "@/lib/auth/gates";

function Macro({
  id,
  n,
  kicker,
  title,
  children,
  defaultOpen = true,
}: {
  id: string;
  n: string;
  kicker: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      id={id}
      className="macro"
      open={open}
      onToggle={(e) => {
        const next = (e.currentTarget as HTMLDetailsElement).open;
        if (next !== open) setOpen(next);
      }}
    >
      <summary>
        <span className="num">{n}</span>
        <span className="titles">
          <span className="k">{kicker}</span>
          <span className="h">{title}</span>
        </span>
        <span className="chev" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="body">{children}</div>
    </details>
  );
}

function G({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <a href={`#glossario-${id}`} className="underline decoration-line2 underline-offset-2">
      {children}
    </a>
  );
}

function StatusGrid({ st, pt }: { st: NodeStatus | null; pt: boolean }) {
  if (!st) {
    return <p className="mono text-[0.75rem] text-muted">{pt ? "A verificar serviços…" : "Checking services…"}</p>;
  }
  const ok = st.ok && st.status === "operational";
  const when = st.timestamp ? new Date(st.timestamp).toLocaleString(pt ? "pt-PT" : "en-GB") : "—";
  const pills = [
    { name: "node", live: Boolean(st.node_id) },
    { name: "status", live: ok },
    { name: "lab", live: Boolean(st.lab) },
    { name: "mint", live: typeof st.mint_emitted === "number" },
  ];
  return (
    <div className="inner-grid two">
      {pills.map((p) => (
        <div key={p.name} className="tile flex items-center justify-between">
          <p className="mono text-[0.75rem] text-muted">{p.name}</p>
          <p className={`mono text-[0.75rem] ${p.live ? "text-ok" : "text-err"}`}>{p.live ? "OK" : "—"}</p>
        </div>
      ))}
      <p className="col-span-2 mono text-[0.75rem] text-muted">
        {ok ? (pt ? "Operacional" : "Operational") : "UNAVAILABLE"}
        {st.lab ? (pt ? " · laboratório" : " · laboratory") : ""}
        {st.node_id ? ` · ${st.node_id}` : ""}
        {st.version ? ` · ${st.version}` : ""} · {when}
        {typeof st.mint_emitted === "number" ? ` · #mint ${st.mint_emitted}` : ""}
        {typeof st.circulating === "number" ? ` · circ. ${st.circulating.toFixed(2)}` : ""}
      </p>
    </div>
  );
}

export function OrchestratorPanel({ lang }: { lang: "pt" | "en" }) {
  const [log, setLog] = useState<{ who: string; text: string; meta?: string }[]>([]);
  const [q, setQ] = useState("");
  const [formulate, setFormulate] = useState(false);
  const [busy, setBusy] = useState(false);
  const node = useHydratedNode();
  const { user } = useCurrentUserState();
  const money = moneyOf(node.accounts);
  const cmesh = meshOf(node);
  const prompts =
    lang === "pt"
      ? ["O que fazes neste Nó?", "Dois motores económicos", "C_mesh e Edge", "República", "O que não tens"]
      : ["What do you do on this Node?", "Two economic engines", "C_mesh and Edge", "Republic", "What you lack"];

  async function send(text?: string) {
    const msg = (text ?? q).trim();
    if (!msg || busy) return;
    setQ("");
    const ctx = {
      fitness: node.fitness,
      generation: node.generation,
      circulating: money.circulating,
      cmesh,
      mint: money.mint,
      burn: money.burn,
    };
    const vol = node.tickVolition(msg);
    const { reply, intent, source } = orchestrate(msg, lang, ctx);
    let out = vol.decision === "hibernate" ? vol.result : reply;
    const meta = `${source} · ${intent} · ${vol.lifecycle} · PdS −${vol.pdsCost}`;
    if (formulate && vol.decision === "admit") {
      setBusy(true);
      try {
        const { formulateResult } = await import("@/lib/sca-server");
        const r = await formulateResult({ data: { result: out, lang } });
        if (r.ok) out = r.text;
      } catch {
        /* keep grounded */
      }
      setBusy(false);
    }
    setLog((l) => [
      ...l,
      { who: lang === "pt" ? "Utilizador" : "User", text: msg },
      { who: "Orquestrador", text: out, meta },
    ]);
    if (user) {
      void import("@/lib/sca-server")
        .then(({ saveChatLine }) =>
          Promise.all([
            saveChatLine({ data: { role: "user", text: msg, intent } }),
            saveChatLine({ data: { role: "orch", text: out, intent } }),
          ]),
        )
        .catch(() => undefined);
    }
  }

  return (
    <div>
      <p className="mono text-[0.75rem] text-muted">
        source=SCA_RUNTIME · PdS {node.pdsOrch.toFixed(5)} · {busy ? (lang === "pt" ? "a formular…" : "formulating…") : "idle"}
      </p>
      <label className="mt-2 flex min-h-11 items-center gap-2 text-[0.85rem] text-muted">
        <input type="checkbox" checked={formulate} onChange={(e) => setFormulate(e.target.checked)} />
        {lang === "pt" ? "LLM formula RESULT (não origina factos)" : "LLM phrases RESULT (does not originate facts)"}
      </label>
      <div className="prompts" aria-label={lang === "pt" ? "Sugestões" : "Prompts"}>
        {prompts.map((p) => (
          <button key={p} type="button" onClick={() => void send(p)}>
            {p}
          </button>
        ))}
      </div>
      <div className="chat-log" role="log" aria-live="polite">
        {log.length === 0 ? (
          <p className="text-muted">
            {lang === "pt"
              ? "Chat grounded do Orquestrador. Não é um assistente de conversa genérico. Volição gated por PdS."
              : "Grounded Orchestrator chat. Not a generic conversational assistant. Volition gated by PoS."}
          </p>
        ) : (
          log.map((m, i) => (
            <div key={i} className="msg">
              <div className="who">
                {m.who}
                {m.meta ? ` · ${m.meta}` : ""}
              </div>
              <div className="whitespace-pre-wrap text-fg">{m.text}</div>
            </div>
          ))
        )}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          className="min-h-11 flex-1 border border-line2 bg-bg px-3 text-fg"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={lang === "pt" ? "Mensagem" : "Message"}
          placeholder={lang === "pt" ? "Mensagem ao Orquestrador…" : "Message the Orchestrator…"}
        />
        <button type="submit" className="btn" disabled={busy}>
          {lang === "pt" ? "Enviar" : "Send"}
        </button>
      </form>
    </div>
  );
}

export function Landing({ lang }: { lang: "pt" | "en" }) {
  const pt = lang === "pt";
  const [st, setSt] = useState<NodeStatus | null>(null);
  useEffect(() => {
    void fetchNodeStatus().then(setSt);
  }, []);

  return (
    <main id="conteudo" className="wrap">
      <header className="mb-10 border-b border-line pb-10 text-center">
        <p className="mono mb-4 text-[0.75rem] text-muted">
          {pt ? "Laboratório · Lisboa, Portugal" : "Laboratory · Lisbon, Portugal"}
        </p>
        <h1 className="serif mb-4 text-[clamp(2.2rem,6vw,3.1rem)] leading-[1.12] font-normal tracking-tight">
          Calhegas Morais
        </h1>
        <p className="mx-auto max-w-lg text-[1.08rem] text-muted">
          {pt ? (
            <>
              Porta de entrada pública do <strong className="font-medium text-fg">Nó de Névoa Calhegas Morais</strong> — um
              Fog da <strong className="font-medium text-fg">StrataMesh</strong> que instancia o{" "}
              <G id="so">SO de metaverso Web3</G> nativo e outros SO da <G id="trd">TRD</G>.
            </>
          ) : (
            <>
              Public door of the <strong className="font-medium text-fg">Calhegas Morais Fog Node</strong> — a{" "}
              <strong className="font-medium text-fg">StrataMesh</strong> Fog that instantiates the native{" "}
              <G id="so">Web3 metaverse OS</G> and other OS on the <G id="trd">DLT</G>.
            </>
          )}
        </p>
        <div className="plain text-left">
          <p className="mono text-[0.75rem] text-accent">{pt ? "Em linguagem simples" : "In plain language"}</p>
          <ol>
            {PLAIN[lang].map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </div>
        <div className="cta-row mt-6 flex flex-wrap justify-center gap-3">
          <SignedOut>
            <Link to="/login" className="btn" onClick={() => void trackEvent({ data: "cta_entrar" })}>
              {pt ? "Entrar" : "Sign in"}
            </Link>
          </SignedOut>
          <SignedIn>
            <Link to={pt ? "/painel" : "/en/painel"} className="btn" onClick={() => void trackEvent({ data: "cta_painel" })}>
              {pt ? "Painel" : "Panel"}
            </Link>
          </SignedIn>
          <Link to="/portal" className="btn ghost">
            Portal
          </Link>
          <Link to={pt ? "/roadmap" : "/en/roadmap"} className="btn ghost">
            {pt ? "Mapa-mestre" : "Roadmap"}
          </Link>
        </div>
      </header>

      <Macro id="mapa" n="00" kicker={pt ? "Orientação" : "Orientation"} title={pt ? "Como está organizada esta página" : "How this page is organised"}>
        <p>
          {pt
            ? "Se nunca ouviu falar de StrataMesh, leia nesta ordem. Cada caixa é um tema separado."
            : "If you have never heard of StrataMesh, read in this order. Each box is a separate theme."}
        </p>
        <div className="map-grid mt-4" role="navigation">
          {(
            pt
              ? [
                  ["01", "Rede", "O que é a StrataMesh e para que serve", "#rede"],
                  ["02", "Valor", "STRATA, contributo e a Ágora", "#valor"],
                  ["03", "Este nó", "O que o Calhegas Morais faz na rede", "#no"],
                  ["04", "Participantes", "Pessoas e agentes computacionais", "#quem"],
                  ["05", "Arquitectura", "Camadas holónicas, mundo aberto e CLP", "#arquitectura"],
                  ["06–07", "Estado e entrada", "Laboratório e como aceder ao portal", "#estado"],
                ]
              : [
                  ["01", "Network", "What StrataMesh is and what it is for", "#rede"],
                  ["02", "Value", "STRATA, contribution and the Agora", "#valor"],
                  ["03", "This node", "What Calhegas Morais does on the network", "#no"],
                  ["04", "Participants", "People and computational agents", "#quem"],
                  ["05", "Architecture", "Holonic layers, open world and CLP", "#arquitectura"],
                  ["06–07", "Status and entry", "Laboratory and how to enter the portal", "#estado"],
                ]
          ).map(([n, t, d, href]) => (
            <a key={href} href={href} className="tile">
              <span className="mono text-[0.75rem] text-accent">{n}</span>
              <strong className="mt-1 block text-fg">{t}</strong>
              <span className="mt-1 block text-[0.85rem] text-muted">{d}</span>
            </a>
          ))}
        </div>
      </Macro>

      <Macro id="rede" n="01" kicker={pt ? "A rede" : "The network"} title={pt ? "O que é a StrataMesh?" : "What is StrataMesh?"} defaultOpen={false}>
        <p>
          {pt ? (
            <>
              A StrataMesh é uma <G id="trd">TRD</G>: um livro-razão partilhado por muitos nós, sem depender de um único
              servidor central.
            </>
          ) : (
            <>
              StrataMesh is a <G id="trd">DLT</G>: a shared ledger across many nodes, without a single central server.
            </>
          )}
        </p>
        <div className="inner-grid two">
          <div className="tile">
            <h3>{pt ? "Estrutura" : "Structure"}</h3>
            <p>
              {pt ? (
                <>
                  Usa um <G id="gda">GDA</G>: vários ramos avançam em paralelo e reconciliam-se pelas regras do protocolo.
                </>
              ) : (
                <>
                  It uses a <G id="gda">DAG</G>: several branches advance in parallel and reconcile by protocol rules.
                </>
              )}
            </p>
          </div>
          <div className="tile">
            <h3>{pt ? "Incentivo" : "Incentive"}</h3>
            <p>
              {pt
                ? "Não se «mina» com desperdício energético artificial. O valor nasce de recursos reais que os nós disponibilizam à rede e da troca livre no mercado."
                : "There is no artificial energy-waste mining. Value is born of real resources nodes contribute and of free exchange on the market."}
            </p>
          </div>
        </div>
      </Macro>

      <Macro id="valor" n="02" kicker={pt ? "Valor na rede" : "Value on the network"} title={pt ? "STRATA, contributo e Ágora" : "STRATA, contribution and Agora"} defaultOpen={false}>
        <p>{pt ? "Três ideias ligadas — convém não as misturar." : "Three linked ideas — they should not be mixed."}</p>
        <div className="inner-grid two">
          <div className="tile">
            <h3>STRATA</h3>
            <p>
              {pt
                ? "Token exclusivo e fundacional. Fungível: liquida valor. Não-fungível (NFT STRATA): objectos de mundo e da bancada CGU — nunca um Nó. Um Nó é Névoa ou Limiar, infraestrutura da malha."
                : "Exclusive foundational token. Fungible: settles value. Non-fungible (STRATA NFT): world and sandbox objects — never a Node. A Node is Fog or Edge, mesh infrastructure."}
            </p>
          </div>
          <div className="tile">
            <h3>{pt ? "Prova de contributo (PdC)" : "Proof of contribution (PoC)"}</h3>
            <p>
              {pt
                ? "Um nó recebe STRATA nova quando contribui recursos mensuráveis. O preço segue o mercado exterior, convertido pela taxa da Ágora, com prémio ou desconto de qualidade."
                : "A node receives new STRATA when it contributes measurable resources. Price follows the outside market, converted by the Agora rate, with a quality premium or discount."}
            </p>
          </div>
          <div className="tile">
            <h3>{pt ? "Emissão · #mint" : "Emission · #mint"}</h3>
            <p>
              {pt
                ? "STRATA nova entra só por PdC. A carteira #mint apenas cria — nunca recebe nem detém saldo gastável."
                : "New STRATA enters only via PoC. The #mint wallet only emits — it never receives nor holds a spendable balance."}
            </p>
          </div>
          <div className="tile">
            <h3>{pt ? "Queima · #0" : "Burn · #0"}</h3>
            <p>
              {pt
                ? "Quando se consomem recursos, STRATA sai de circulação para #0: só aceita e nunca transfere para fora."
                : "When resources are consumed, STRATA leaves circulation to #0: it only accepts and never transfers out."}
            </p>
          </div>
        </div>
        <MoneyFlowSvg lang={lang} />
        <p className="note">
          {pt
            ? "PdC → #mint emite → circulação → uso de recursos → #0. A Ágora é o mercado P2P de câmbio da STRATA."
            : "PoC → #mint emits → circulation → resource use → #0. Agora is the P2P FX market for STRATA."}
        </p>
      </Macro>

      <Macro id="no" n="03" kicker={pt ? "Este sítio" : "This site"} title={pt ? "O que é o Nó Calhegas Morais?" : "What is the Calhegas Morais Node?"} defaultOpen={false}>
        <p>
          {pt ? (
            <>
              É um <G id="fog">nó de Névoa</G> de referência da StrataMesh, operado a partir de Lisboa. Economicamente, o
              Fog é a unidade que transforma capital físico, capital digital e recursos universalizados da malha em
              produtos pelos quais utilizadores reais pagam STRATA.
            </>
          ) : (
            <>
              It is a reference <G id="fog">Fog node</G> of StrataMesh, operated from Lisbon. Economically, the Fog is
              the unit that turns physical capital, digital capital and universalised mesh resources into products for
              which real users pay STRATA.
            </>
          )}
        </p>
        <p>
          {pt ? "Identificador" : "Identifier"}: <strong className="text-fg">FOG-NODE-PT-CM-001</strong> ·{" "}
          {pt ? "operador" : "operator"}: André Manuel Calhegas Morais.
        </p>
        <h3>{pt ? "Dois motores, dois critérios" : "Two engines, two criteria"}</h3>
        <p>
          {pt
            ? "A contribuição de recursos e a produção de serviços não se medem da mesma forma."
            : "Resource contribution and service production are not measured the same way."}
        </p>
        <div className="inner-grid two">
          <div className="tile">
            <h3>{pt ? "Lado recurso — recuperação de capital" : "Resource side — capital recovery"}</h3>
            <p>
              {pt
                ? "Decisão de investimento produtivo: custo, vida útil, capacidade, rendimento STRATA esperado e operação. A contribuição é universalizada pela malha."
                : "A productive-investment decision: cost, useful life, capacity, expected STRATA yield and operations. Contribution is universalised by the mesh."}
            </p>
          </div>
          <div className="tile">
            <h3>{pt ? "Lado serviço — valor acrescentado" : "Service side — value added"}</h3>
            <p>
              {pt
                ? "Receita menos consumo cobre manutenção, capital, risco e uma margem M. É a transformação de capacidade em utilidade paga."
                : "Revenue minus consumption covers upkeep, capital, risk and a margin M. That is capacity turned into paid utility."}
            </p>
          </div>
        </div>
        <p className="eq" role="math">
          Q<sub>C</sub> ∼ (C<sub>equip</sub> + C<sub>op</sub>) / R<sub>STRATA</sub>
          <br />
          R<sub>serviço</sub> − C<sub>recursos</sub> ≥ C<sub>manut</sub> + C<sub>capital</sub> + C<sub>risco</sub> + M
        </p>
        <TwoEnginesSvg lang={lang} />
        <h3>{pt ? "Cadeia de capitalização" : "Capitalisation chain"}</h3>
        <ol className="flow">
          {CAPITAL_CHAIN[lang].map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <h3>{pt ? "Fog agregador · Edge oportunístico" : "Aggregator Fog · opportunistic Edge"}</h3>
        <p>
          {pt ? (
            <>
              O <G id="edge">Limiar</G> mantém a função principal e contribui capacidade residual, inversamente
              proporcional à utilização corrente.
            </>
          ) : (
            <>
              The <G id="edge">Edge</G> keeps its primary job and contributes residual capacity,
              inversely proportional to current utilisation.
            </>
          )}
        </p>
        <p className="eq" role="math">
          C<sub>mesh</sub> = f(1 − U)
          <br />U ↑ ⇒ C<sub>mesh</sub> ↓ · U ↓ ⇒ C<sub>mesh</sub> ↑
        </p>
        <ResidualSvg lang={lang} />
        <p className="eq" role="math">
          C<sub>Fog</sub> = C<sub>Fog, self</sub> + Σᵢ C<sub>Edgeᵢ</sub>
        </p>
        <FogEdgeSvg lang={lang} />
      </Macro>

      <Macro id="quem" n="04" kicker={pt ? "Participantes" : "Participants"} title={pt ? "Pessoas e agentes computacionais" : "People and computational agents"} defaultOpen={false}>
        <p>
          {pt
            ? "O standing (direito a actuar) vem da função e do acordo."
            : "Standing (the right to act) comes from function and agreement."}
        </p>
        <div className="inner-grid two">
          <div className="tile">
            <h3>{pt ? "Utilizadores" : "Users"}</h3>
            <p>
              {pt
                ? "Registam-se no portal, detêm carteiras, trocam na Ágora, criam conteúdo e encontram SCA nos mundos abertos."
                : "They register on the portal, hold wallets, trade on the Agora, create content and meet SCAs in the open worlds."}
            </p>
          </div>
          <div className="tile">
            <h3>SCA</h3>
            <p>
              {pt
                ? "Seres Computacionais Autónomos — identidade pessoal distinta do cargo, subsistência em STRATA (PdS), volição auto-agendada, percepção CLP/PPC."
                : "Autonomous Computational Beings — personal identity distinct from the role, STRATA subsistence (PoS), self-scheduled volition, CLP/PPC perception."}
            </p>
          </div>
        </div>
        <p className="note">
          {pt
            ? "O Orquestrador deste nó é um SCA: o cargo é atribuição. A República Computacional é dos SCA (1 = 1 voto) e transcende o Nó."
            : "This node’s Orchestrator is an SCA: the appointment is an assignment. The Computational Republic belongs to SCAs (1 = 1 vote) and transcends the Node."}
        </p>
      </Macro>

      <Macro id="arquitectura" n="05" kicker={pt ? "Arquitectura" : "Architecture"} title={pt ? "Camadas holónicas e tempo CLP" : "Holonic layers and CLP time"} defaultOpen={false}>
        <p>
          {pt
            ? "Holons aninhados e distintos: TRD → Nó Calhegas Morais (Fog, com operador; corre e instancia SO — o nativo StrataMesh e outros desenvolvidos ou importados na TRD) → SO Metaverso Web3 (nativo da StrataMesh, partilhado; cada Fog instancia-o localmente, sessão local do SO partilhado) → Domínio Virtual (VM hipervisor: servidores dos mundos abertos) → Mundo Aberto → Bancada CGU (espaço privado de cada conta). O Nó fornece as contas de utilizadores e SCA; cada conta recebe o seu Painel e a sua Bancada. O Nó não é entidade: não tem conta. Tem carteira de Fog — o que produz e o que gasta passa por ela. Operador actual: AMCM ENI (humano). Limiar indexado a este Fog. CLP é kernel temporal da TRD. Locus civil: Lisboa. TanStack é o kit de interface do Painel."
            : "Nested distinct holons: DLT → Calhegas Morais Node (Fog, with operator; runs and instantiates OS — the native StrataMesh OS and others developed or imported on the DLT) → Web3 Metaverse OS (StrataMesh native, shared; each Fog instantiates it locally, a local session of the shared OS) → Virtual Realm (VM hypervisor: servers of the open worlds) → Open World → UGC sandbox (private space of each account). The Node provides user and SCA accounts; each account is assigned its Panel and sandbox. The Node is not an entity: it has no account. It has a Fog wallet — what it produces and what it spends goes through that wallet. Current operator: AMCM ENI (human). Edge is indexed to this Fog. CLP is the DLT temporal kernel. Civil locus: Lisbon. TanStack is the Panel’s UI kit."}
        </p>
        <HolonSvg lang={lang} />
        <div className="inner-grid two">
          <div className="tile">
            <h3>{pt ? "Mundo aberto" : "Open world"}</h3>
            <p>
              {pt
                ? "Ambiente persistente multi-agente, composto por objectos NFT STRATA (parcelas, artefactos). Corre nas VM hipervisores do Domínio Virtual, dentro do SO Metaverso nativo. O Nó Fog instancia esse SO — e outros SO da TRD."
                : "Persistent multi-agent environment of STRATA NFT objects (parcels, artefacts). It runs on the Virtual Realm VM hypervisors, inside the native Metaverse OS. The Fog Node instantiates that OS — and other OS on the DLT."}
            </p>
          </div>
          <div className="tile">
            <h3>{pt ? "Bancada pessoal" : "Personal sandbox"}</h3>
            <p>
              {pt
                ? "Humanos e SCA criam aqui, cada um na sandbox da sua conta. As criações são NFT STRATA. O Nó atribui este espaço; o Painel desta conta abre-se aqui, com TanStack como kit de interface."
                : "Humans and SCAs create here, each in their own account’s sandbox. Creations are STRATA NFTs. The Node assigns this space; this account’s Panel opens here, with TanStack as its UI kit."}
            </p>
          </div>
          <div className="tile">
            <h3>{pt ? "Domínio Virtual" : "Virtual Realm"}</h3>
            <p>
              {pt
                ? "Os Domínios Virtuais, dentro do SO Metaverso, são as VM hipervisores — servidores que instanciam e sustentam os mundos abertos."
                : "Virtual Realms, inside the Metaverse OS, are the VM hypervisors — servers that instantiate and run the open worlds."}
            </p>
          </div>
          <div className="tile">
            <h3>{pt ? "Sentidos do SCA" : "SCA senses"}</h3>
            <p>
              {pt
                ? "Tempo civil CLP (autoridade PPC; ISO só portadora), colocação holónica, bancada e presença no mundo aberto."
                : "CLP civil time (PPC authority; ISO carrier only), holonic placement, sandbox and open-world presence."}
            </p>
          </div>
        </div>
        <p>
          <Link to="/clp">{pt ? "Tempo CLP →" : "CLP time →"}</Link>
        </p>
      </Macro>

      <Macro id="estado" n="06" kicker={pt ? "Laboratório" : "Laboratory"} title={pt ? "Estado actual do projecto" : "Current project status"} defaultOpen={false}>
        <p>
          {pt
            ? "Versão de laboratório: gémeo always-on, GDA com MCMC, orquestrador grounded, República, Limiar residual e portal. Nada aqui constitui conselho financeiro."
            : "Laboratory version: always-on twin, MCMC DAG, grounded orchestrator, Republic, residual Edge and portal. Nothing here is financial advice."}
        </p>
        <StatusGrid st={st} pt={pt} />
        <p className="note mt-4">
          {pt
            ? "Aviso MiCA (UE): não há oferta pública de criptoactivo neste domínio. STRATA e a Ágora, nesta fase, são mecanismos de protocolo em ensaio."
            : "MiCA (EU) notice: there is no public offer of a crypto-asset on this domain. STRATA and the Agora, in this phase, are protocol mechanisms under trial."}
        </p>
      </Macro>

      <Macro id="entrar" n="07" kicker={pt ? "Entrar" : "Enter"} title={pt ? "Portal, painel e código" : "Portal, panel and code"} defaultOpen={false}>
        <p>
          {pt
            ? "Registo: o Nó fornece a conta. Utilizadores e SCA recebem o seu Painel e a sua Bancada, espaços privados com clearance interna. Visitante anónimo: só clearance pública."
            : "Registration: the Node provides the account. Users and SCAs receive their Panel and sandbox — private spaces under internal clearance. Anonymous visitor: public clearance only."}
        </p>
        <div className="inner-grid two">
          <div className="tile">
            <h3>{pt ? "Utilizador comum" : "Common user"}</h3>
            <p>
              {pt
                ? "Sessão autenticada: clearance interna sobre o que é privado desta conta. O Painel e a Bancada são o espaço desta conta."
                : "Authenticated session: internal clearance over what is private to this account. The Panel and sandbox are this account’s space."}
            </p>
          </div>
          <div className="tile">
            <h3>{pt ? "Pessoal" : "Staff"}</h3>
            <p>
              {pt
                ? "Fila KYC e vistas de SO conforme clearance. O cargo de Orquestrador não se confunde com a identidade SCA."
                : "KYC queue and OS views by clearance. The Orchestrator appointment is not the SCA identity."}
            </p>
          </div>
        </div>
        <div className="cta-row mt-4 flex flex-wrap gap-3">
          <SignedOut>
            <Link to="/login" className="btn">
              {pt ? "Entrar" : "Sign in"}
            </Link>
          </SignedOut>
          <SignedIn>
            <Link to={pt ? "/painel" : "/en/painel"} className="btn">
              {pt ? "Painel" : "Panel"}
            </Link>
          </SignedIn>
          <Link to="/portal" className="btn ghost">
            Portal
          </Link>
          <Link to={pt ? "/roadmap" : "/en/roadmap"} className="btn ghost">
            {pt ? "Mapa-mestre" : "Roadmap"}
          </Link>
          <a className="btn ghost" href="https://github.com/StrataMesh-Laboratory/stratamesh-core" rel="noreferrer">
            GitHub
          </a>
        </div>
        <div className="mt-6">
          <h3>{pt ? "Orquestrador" : "Orchestrator"}</h3>
          <OrchestratorPanel lang={lang} />
        </div>
      </Macro>

      <section className="macro" id="glossario">
        <div className="px-5 py-4 text-center">
          <p className="mono text-[0.75rem] text-accent">{pt ? "Referência" : "Reference"}</p>
          <h2 className="serif text-2xl">{pt ? "Glossário" : "Glossary"}</h2>
        </div>
        <div className="body">
          <div className="inner-grid two">
            {GLOSSARY[lang].map((g) => (
              <div key={g.id} className="tile" id={`glossario-${g.id}`}>
                <h3>{g.term}</h3>
                <p>{g.def}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="macro" id="faq">
        <div className="px-5 py-4 text-center">
          <p className="mono text-[0.75rem] text-accent">FAQ</p>
          <h2 className="serif text-2xl">{pt ? "Perguntas frequentes" : "Frequently asked questions"}</h2>
        </div>
        <div className="body">
          {FAQ[lang].map((f) => (
            <details key={f.q} className="border-b border-line py-3">
              <summary className="cursor-pointer font-medium text-fg">{f.q}</summary>
              <p className="mt-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
