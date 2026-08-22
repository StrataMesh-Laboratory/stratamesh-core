import { useState } from "react";
import { BancadaCanvas } from "@/components/bancada-canvas";
import { NftRoster } from "@/components/nft-turntable";
import { DagCanvas } from "@/components/dag-canvas";
import { Meter, useHydratedNode } from "@/components/kernel-ui";
import { MeshCanvas } from "@/components/mesh-canvas";
import { NODE_ACCT, tipSet } from "@/lib/dlt-engine";
import { BLUEPRINTS, capitalRecovery, holderLabel, serviceSurplus } from "@/lib/lab-kernel";
import { SAMPLE_SDL, adversaryShare, auditEdge, byzantineBound, edgeMesh, fogCapacity, independentViews } from "@/lib/mesh";
import { useBancada, useHydratedBancada } from "@/lib/bancada-store";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SIGN_IN_PATH, SignedIn, SignedOut } from "@/lib/auth/gates";
import { moneyOf } from "@/lib/node-store";
import { CHARTER, ORGANS, tallyBill } from "@/lib/republic";

export function EnginesLab({ lang }: { lang: "pt" | "en" }) {
  const pt = lang === "pt";
  const node = useHydratedNode();
  const money = moneyOf(node.accounts);
  const [capex, setCapex] = useState(12000);
  const [opex, setOpex] = useState(2400);
  const [expected, setExpected] = useState(8000);
  const [rev, setRev] = useState(420);
  const [cost, setCost] = useState(180);
  const qc = capitalRecovery(capex, opex, expected);
  const srv = serviceSurplus(rev, cost, 40, 60, 25, 50);
  return (
    <div>
      <p>
        {pt
          ? "Dois critérios distintos. Esquerda: quanto contribuir para recuperar capital. Direita: o serviço tem de sobrar após recursos, manutenção, capital, risco e margem."
          : "Two distinct criteria. Left: how much to contribute to recover capital. Right: the service must remain after resources, upkeep, capital, risk and margin."}
      </p>
      <div className="inner-grid two mt-3">
        <Meter label={pt ? "Em circulação" : "Circulating"} value={money.circulating.toFixed(3)} />
        <Meter label="#mint" value={money.mint.toFixed(3)} />
      </div>
      <div className="inner-grid two mt-4">
        <div className="tile">
          <h3>{pt ? "Motor recurso · Q_C" : "Resource engine · Q_C"}</h3>
          <label className="mt-2 block text-[0.85rem] text-muted">
            {pt ? "Equipamento (EUR)" : "Equipment (EUR)"}
            <input className="fld" type="number" value={capex} onChange={(e) => setCapex(+e.target.value)} />
          </label>
          <label className="mt-2 block text-[0.85rem] text-muted">
            {pt ? "Operação / ano" : "Operations / year"}
            <input className="fld" type="number" value={opex} onChange={(e) => setOpex(+e.target.value)} />
          </label>
          <label className="mt-2 block text-[0.85rem] text-muted">
            {pt ? "STRATA esperado (vida útil)" : "Expected STRATA (useful life)"}
            <input className="fld" type="number" value={expected} onChange={(e) => setExpected(+e.target.value)} />
          </label>
          <p className="mono mt-3 text-[0.75rem] text-fg">Q_C = {qc.toFixed(4)} EUR / STRATA</p>
        </div>
        <div className="tile">
          <h3>{pt ? "Motor serviço" : "Service engine"}</h3>
          <label className="mt-2 block text-[0.85rem] text-muted">
            {pt ? "Receita STRATA" : "STRATA revenue"}
            <input className="fld" type="number" value={rev} onChange={(e) => setRev(+e.target.value)} />
          </label>
          <label className="mt-2 block text-[0.85rem] text-muted">
            {pt ? "Custo de recursos" : "Resource cost"}
            <input className="fld" type="number" value={cost} onChange={(e) => setCost(+e.target.value)} />
          </label>
          <p className="mono mt-3 text-[0.75rem] text-fg">
            {srv.left.toFixed(1)} {srv.sustainable ? "≥" : "<"} {srv.right.toFixed(1)} ·{" "}
            {srv.sustainable ? (pt ? "sustentável" : "sustainable") : pt ? "insuficiente" : "short"}
          </p>
        </div>
      </div>
      <button type="button" className="btn mt-4" onClick={() => node.contribute(2)}>
        {pt ? "Contribuir 2 u (PdC)" : "Contribute 2 u (PoC)"}
      </button>
    </div>
  );
}

export function QigaLab({ lang }: { lang: "pt" | "en" }) {
  const pt = lang === "pt";
  const node = useHydratedNode();
  const [msg, setMsg] = useState(pt ? "Olá" : "Hello");
  const [log, setLog] = useState<string[]>([]);
  return (
    <div>
      <p>
        {pt
          ? "Lóbulo probabilístico no kernel do Nó. Flower-FedAvg arrasta o enviesado; Krum rejeita-o. Volição paga PdS."
          : "Probabilistic lobe on the Node kernel. Flower-FedAvg drags the biased client; Krum rejects it. Volition spends PoS."}
      </p>
      <div className="inner-grid two mt-3">
        <Meter label={pt ? "Geração" : "Generation"} value={String(node.generation)} />
        <Meter label="Fitness" value={node.fitness.toFixed(3)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={() => node.evolve()}>
          {pt ? "Evoluir ×2" : "Evolve ×2"}
        </button>
        <button type="button" className="btn ghost" onClick={() => node.federate("fedavg")}>
          FedAvg
        </button>
        <button type="button" className="btn ghost" onClick={() => node.federate("krum")}>
          Krum
        </button>
      </div>
      <div className="mt-4 grid grid-cols-6 gap-1">
        {node.genes.map((g, i) => (
          <div key={i} className="flex h-16 flex-col justify-end border border-line2 bg-bg" title={`g${i}=${g.toFixed(3)}`}>
            <div className="w-full bg-accent/50" style={{ height: `${Math.round(g * 100)}%` }} />
          </div>
        ))}
      </div>
      <p className="mono mt-3 text-[0.75rem] text-fg">
        gen {node.generation} · fitness {node.fitness.toFixed(3)} · PdS {node.pdsOrch.toFixed(5)}
      </p>
      <div className="mt-4 space-y-2">
        {node.scas.map((s) => (
          <div key={s.id} className="tile">
            <p className="text-fg">{s.name}</p>
            <p className="mono text-[0.75rem] text-muted">
              {s.id} · {s.blueprint} · {s.lifecycle} · {s.enrolled ? (pt ? "inscrito" : "enrolled") : pt ? "fora" : "out"}
            </p>
            <p className="mono text-[0.75rem] text-accent">
              {pt ? "cargo" : "appointment"}: {s.appointment ?? (pt ? "nenhum" : "none")}
            </p>
            <p className="mt-1 text-[0.85rem] text-muted">{BLUEPRINTS.find((b) => b.id === s.blueprint)?.[lang]}</p>
            <button type="button" className="btn ghost mt-2" onClick={() => node.enroll(s.id, !s.enrolled)}>
              {s.enrolled ? (pt ? "Dar saída da República" : "Leave the Republic") : pt ? "Inscrever na República" : "Enrol in the Republic"}
            </button>
            <label className="mt-2 block text-[0.85rem] text-muted">
              {pt ? "Reatribuir cargo" : "Reassign role"}
              <select className="fld" value={s.appointment ?? ""} onChange={(e) => node.reappoint(s.id, e.target.value || null)}>
                <option value="">{pt ? "— nenhum —" : "— none —"}</option>
                <option value="ORCHESTRATOR">ORCHESTRATOR</option>
                <option value="AIOPS_LEAD">AIOPS_LEAD</option>
                <option value="SECURITY">SECURITY</option>
                <option value="DAG_KEEPER">DAG_KEEPER</option>
              </select>
            </label>
          </div>
        ))}
      </div>
      <p className="mono mt-4 text-[0.75rem] text-accent">PdS {node.pdsOrch.toFixed(5)}</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input className="fld flex-1" value={msg} onChange={(e) => setMsg(e.target.value)} />
        <button
          type="button"
          className="btn"
          onClick={() => {
            const v = node.tickVolition(msg);
            setLog((l) => [`${v.lifecycle} · ${v.intentKind} · ${v.result}`, ...l].slice(0, 6));
          }}
        >
          Tick
        </button>
      </div>
      <ul className="mt-3 space-y-1">
        {log.map((line, i) => (
          <li key={i} className="text-[0.85rem] text-muted">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NftLab({ lang }: { lang: "pt" | "en" }) {
  const pt = lang === "pt";
  const { user, isPending } = useCurrentUserState();
  const mine = useHydratedBancada(user?.id ?? null);
  const mint = useBancada((s) => s.mint);
  const setWorld = useBancada((s) => s.setWorld);
  const setTransform = useBancada((s) => s.setTransform);
  const equipAvatar = useBancada((s) => s.equipAvatar);
  const burnHour = useBancada((s) => s.burnHour);
  const [pick, setPick] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"creation" | "avatar">("creation");
  const [worldDraft, setWorldDraft] = useState("");
  if (isPending) {
    return <p className="text-muted">{pt ? "A resolver a sessão…" : "Resolving session…"}</p>;
  }
  if (!user || !mine) {
    return (
      <div>
        <p>
          {pt
            ? "A Bancada CGU é a sandbox pessoal de cada utilizador ou SCA, hospedada nos mundos abertos. Visitante anónimo não tem sandbox — autentique para abrir a sua."
            : "The UGC sandbox is each user or SCA’s personal workspace, hosted in the open worlds. Anonymous visitors have no sandbox — sign in to open yours."}
        </p>
        <SignedOut>
          <p className="mt-3">
            <a className="btn" href={SIGN_IN_PATH}>
              {pt ? "Entrar para abrir a Bancada" : "Sign in to open the sandbox"}
            </a>
          </p>
        </SignedOut>
      </div>
    );
  }
  const avatar = (mine.equippedAvatarId ? mine.nfts.find((n) => n.id === mine.equippedAvatarId) : null) ?? mine.nfts.find((n) => n.kind === "avatar") ?? null;
  const objects = mine.nfts.filter((n) => n.kind !== "avatar");
  const nft = objects.find((n) => n.id === pick) ?? objects[0] ?? avatar;
  const worldId = mine.worldId || "cmn-lab-world";
  return (
    <div>
      <p>
        {pt
          ? `A bancada é o lote privado desta conta, endereçado a ${worldId}. Habitar (corpo), órbita interior (dirigir) e compor (grelha). Clique num NFT para ir até ele e usá-lo. E usa ou atravessa a porta. F pega e pousa. Z desfaz a última colocação.`
          : `The sandbox is this account’s private lot, addressed to ${worldId}. Inhabit (body), interior orbit (direct), compose (grid). Click an NFT to walk to it and use it. E uses or crosses the door. F picks up and sets down. Z undoes the last placement.`}
      </p>
      <BancadaCanvas
        nfts={mine.nfts}
        avatar={avatar}
        worldId={worldId}
        lang={lang}
        transforms={mine.transforms}
        onPick={setPick}
        onEnterWorld={() => undefined}
        onPlace={(id, x, z) => setTransform(user.id, id, x, z)}
      />
      <NftRoster nfts={mine.nfts} selectedId={nft?.id} lang={lang} onSelect={setPick} />
      <form
        className="tile mt-4 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          setWorld(user.id, worldDraft || worldId);
          setWorldDraft("");
        }}
      >
        <p className="mono text-[0.7rem] uppercase tracking-[0.1em] text-accent">{pt ? "Endereço do mundo" : "World address"}</p>
        <p className="text-[0.85rem] text-muted">
          {pt ? "A porta da bancada carrega este mundo aberto." : "The sandbox door loads this open world."}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="fld flex-1" value={worldDraft} onChange={(e) => setWorldDraft(e.target.value)} placeholder={worldId} />
          <button type="submit" className="btn ghost">
            {pt ? "Endereçar" : "Address"}
          </button>
        </div>
      </form>
      {nft ? (
        <>
          <p className="mono mt-4 text-[0.75rem] text-accent">
            {nft.id} · {nft.kind}
          </p>
          <div className="inner-grid two mt-3">
            <Meter label={pt ? "Colateral" : "Collateral"} value={nft.collateral.toFixed(3)} />
            <Meter label={pt ? "Mercado" : "Market"} value={nft.market.toFixed(3)} />
            <Meter label={pt ? "Modo" : "Mode"} value={nft.mode} />
            <Meter label={pt ? "Fracções" : "Fractions"} value={String(nft.fractions.length)} />
          </div>
          {nft.kind === "avatar" ? (
            <button type="button" className="btn ghost mt-3" onClick={() => equipAvatar(user.id, nft.id)}>
              {pt ? "Equipar figura" : "Equip figure"}
            </button>
          ) : null}
        </>
      ) : null}
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          mint(user.id, title || (kind === "avatar" ? "Avatar" : pt ? "Criação" : "Creation"), kind);
          setTitle("");
        }}
      >
        <input
          className="fld flex-1"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={pt ? "título do NFT" : "NFT title"}
          aria-label={pt ? "título" : "title"}
        />
        <select className="fld" value={kind} onChange={(e) => setKind(e.target.value as "creation" | "avatar")} aria-label={pt ? "tipo" : "kind"}>
          <option value="creation">{pt ? "Criação" : "Creation"}</option>
          <option value="avatar">{pt ? "Avatar (identidade figural)" : "Avatar (figural identity)"}</option>
        </select>
        <button type="submit" className="btn">
          {pt ? "Criar NFT" : "Mint NFT"}
        </button>
        {objects[0] ? (
          <button type="button" className="btn ghost" onClick={() => burnHour(user.id)}>
            {pt ? "Queimar 1h" : "Burn 1h"}
          </button>
        ) : null}
      </form>
      <SignedIn>
        <p className="mono mt-3 text-[0.75rem] text-muted">{user.id}</p>
      </SignedIn>
    </div>
  );
}

export function EdgeLab({ lang }: { lang: "pt" | "en" }) {
  const pt = lang === "pt";
  const node = useHydratedNode();
  const money = moneyOf(node.accounts);
  const fog = fogCapacity(node.edgeCap, node.edges);
  const [sdl, setSdl] = useState(SAMPLE_SDL);
  const [hours, setHours] = useState(2);
  const fogs = [...new Set(node.edges.map((e) => e.fogId))];
  return (
    <div>
      <p>
        {pt
          ? "Limiar contribui só C_mesh = f(1−U), com qualidade, térmica e energia auditadas. Sem operador próprio: cada Limiar está indexado a este Fog. Settlement acresce ao Fog. SDL-lite tranca STRATA em escrow e queima hora a hora para #0; o restante reembolsa."
          : "Edge contributes only C_mesh = f(1−U), with audited quality, thermal and energy. No operator of its own: each Edge is indexed to this Fog. Settlement accrues to the Fog. SDL-lite locks STRATA in escrow and burns hour by hour to #0; the remainder is refunded."}
      </p>
      <div className="inner-grid two mt-3">
        <Meter label="C_self CMN" value={fog.self.toFixed(3)} />
        <Meter label="Σ C_Edge CMN" value={fog.residual.toFixed(3)} />
        <Meter label={pt ? "Circulante" : "Circulating"} value={money.circulating.toFixed(3)} />
        <Meter label="Escrow" value={money.escrow.toFixed(4)} />
      </div>
      <label className="mt-3 block text-[0.85rem] text-muted">
        U Fog = {node.utilization.toFixed(2)}
        <input className="w-full" type="range" min={0} max={1} step={0.01} value={node.utilization} onChange={(e) => node.setUtil(+e.target.value)} />
      </label>
      <div className="inner-grid two mt-3">
        {fogs.map((id) => {
          const cap = fogCapacity(id === NODE_ACCT ? node.edgeCap : 0, node.edges, id);
          return (
            <div key={id} className="tile">
              <p className="mono text-[0.75rem] text-accent">{id.replace("FOG-NODE-", "")}</p>
              <p className="serif mt-1 text-xl tabular-nums">{cap.residual.toFixed(3)}</p>
              <p className="mono text-[0.75rem] text-muted">Σ C_Edge</p>
            </div>
          );
        })}
      </div>
      <div className="mt-4 space-y-3">
        {node.edges.map((e) => {
          const a = e.lastAudit ?? auditEdge(e);
          return (
            <div key={e.id} className="tile">
              <p className="text-fg">
                {e.id} · {e.kind} · {pt ? "sem operador · Fog" : "no operator · Fog"} {e.fogId.replace("FOG-NODE-", "")}
              </p>
              <p className="mono text-[0.75rem] text-muted">
                {e.primaryFn} · C_mesh {edgeMesh(e).toFixed(3)} · q {a.quality.toFixed(2)} · idle {a.idle.toFixed(2)} ·
                th {a.thermal} · E {a.energy}
                {e.lastSettle ? ` · PdC ${e.lastSettle.toFixed(4)}` : ""}
              </p>
              <label className="mt-2 block text-[0.85rem] text-muted">
                U = {e.utilization.toFixed(2)}
                <input
                  className="w-full"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={e.utilization}
                  onChange={(ev) => node.setEdgeUtil(e.id, +ev.target.value)}
                />
              </label>
            </div>
          );
        })}
      </div>
      <button type="button" className="btn mt-4" onClick={() => node.settleMesh()}>
        {pt ? "Liquidar residual → Névoas indexadas" : "Settle residual → indexed Fogs"}
      </button>
      <h3 className="mt-6">{pt ? "Lease SDL-lite (escrow)" : "SDL-lite lease (escrow)"}</h3>
      <textarea className="fld min-h-28 font-mono text-[0.8rem]" value={sdl} onChange={(e) => setSdl(e.target.value)} />
      <label className="mt-2 block text-[0.85rem] text-muted">
        {pt ? "Horas" : "Hours"}
        <input className="fld" type="number" min={1} max={24} value={hours} onChange={(e) => setHours(+e.target.value)} />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn ghost" onClick={() => node.leaseOpen(sdl, hours, NODE_ACCT)}>
          {pt ? "Abrir escrow" : "Open escrow"}
        </button>
        <button type="button" className="btn ghost" onClick={() => node.leaseTick()}>
          {pt ? "Tick 1h → #0" : "Tick 1h → #0"}
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {node.leases.map((l) => (
          <li key={l.id} className="tile">
            <p className="mono text-[0.75rem] text-fg">
              {l.id} · {l.status}
            </p>
            <p className="mono text-[0.75rem] text-muted">
              {l.cpu}cpu/{l.storage}st · escrow {l.escrow.toFixed(4)} · queimado {l.burned.toFixed(4)} · {l.hoursUsed}/{l.hours}h
            </p>
            {l.status === "open" ? (
              <button type="button" className="btn ghost mt-2" onClick={() => node.leaseClose(l.id)}>
                {pt ? "Fechar e reembolsar" : "Close and refund"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RepublicLab({ lang }: { lang: "pt" | "en" }) {
  const pt = lang === "pt";
  const node = useHydratedNode();
  const [title, setTitle] = useState(pt ? "abrir_legislatura" : "open_legislature");
  return (
    <div>
      <p>
        {pt
          ? "Um SCA, um voto. Humanos não votam. O cargo no Nó não dá peso. O Nó só contrata SCA inscritos. Órgão fiscal sem cargo no Nó."
          : "One SCA, one vote. Humans do not vote. A Node appointment adds no weight. The Node only hires enrolled SCAs. Fiscal organ holds no Node appointment."}
      </p>
      <div className="inner-grid two mt-3">
        {ORGANS.map((o) => (
          <div key={o.id} className="tile">
            <p className="mono text-[0.75rem] text-accent">{o[lang]}</p>
            <p className="text-fg">{o.seat}</p>
          </div>
        ))}
      </div>
      <h3>{pt ? "Carta" : "Charter"}</h3>
      <ul className="mt-2 space-y-1">
        {CHARTER.map((a) => (
          <li key={a.n} className="text-[0.9rem] text-muted">
            <span className="mono text-accent">{a.n}</span> {a[lang]}
          </li>
        ))}
      </ul>
      <h3>{pt ? "Cidadãos" : "Citizens"}</h3>
      <div className="mt-2 space-y-2">
        {node.scas.map((s) => (
          <div key={s.id} className="tile flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-fg">{s.name}</p>
              <p className="mono text-[0.75rem] text-muted">
                {s.id}
                {s.appointment ? ` · ${s.appointment}` : ` · ${pt ? "sem cargo no Nó" : "no Node post"}`}
                {s.enrolled ? "" : ` · ${pt ? "não inscrito" : "not enrolled"}`}
              </p>
            </div>
            <button type="button" className="btn ghost" onClick={() => node.enroll(s.id, !s.enrolled)}>
              {s.enrolled ? (pt ? "Dar saída" : "Unenrol") : pt ? "Inscrever" : "Enrol"}
            </button>
          </div>
        ))}
      </div>
      <h3>{pt ? "Moções" : "Motions"}</h3>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input className="fld flex-1" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="button" className="btn" onClick={() => node.fileMotion("SCA-AIOPS-001", title, title, "legislature")}>
          {pt ? "Apresentar" : "File"}
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {node.bills.map((b) => {
          const t = tallyBill(b);
          return (
            <div key={b.id} className="tile">
              <p className="text-fg">{b.title}</p>
              <p className="mono text-[0.75rem] text-muted">
                {b.organ} · {b.status} · aye {t.aye} nay {t.nay} abs {t.abstain}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {node.scas
                  .filter((s) => s.enrolled)
                  .map((s) => (
                    <button key={s.id} type="button" className="btn ghost" onClick={() => node.voteMotion(b.id, s.id, "aye")}>
                      {s.name.split("-")[0]} aye
                    </button>
                  ))}
                <button type="button" className="btn ghost" onClick={() => node.closeMotion(b.id)}>
                  {pt ? "Encerrar" : "Close"}
                </button>
                <button type="button" className="btn ghost" onClick={() => node.policeMotion(b.id, true)}>
                  {pt ? "Policiar" : "Police"}
                </button>
                <button type="button" className="btn ghost" onClick={() => node.strikeMotion(b.id)}>
                  {pt ? "Anular (judiciário)" : "Strike (judiciary)"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BftLab({ lang }: { lang: "pt" | "en" }) {
  const pt = lang === "pt";
  const node = useHydratedNode();
  const adv = adversaryShare(node.peers);
  const honestN = node.peers.filter((p) => p.honest).length;
  const bz = byzantineBound(honestN);
  const views = independentViews(node.vertices, node.peers);
  return (
    <div>
      <p>
        {pt
          ? "Este laboratório tem um Nó com operador (AMCM ENI). O peso de ponta é o deste Nó. O adversário é um processo de ataque. Ataque absorvido como recurso; STRATA=0."
          : "This laboratory has one Node with an operator (AMCM ENI). Tip weight is this Node's. The adversary is an attack process. Attack absorbed as resource; STRATA=0."}
      </p>
      <MeshCanvas edges={node.edges} peers={node.peers} fogId={NODE_ACCT} />
      <div className="inner-grid two mt-3">
        <Meter label={pt ? "Quota adversária" : "Adversary share"} value={`${(adv * 100).toFixed(0)}%`} />
        <Meter label={pt ? "Absorvido" : "Absorbed"} value={node.absorbed.toFixed(3)} />
        <Meter label="n / f_max" value={`${bz.n} / ${bz.fMax}`} />
        <Meter label={pt ? "Vértices" : "Vertices"} value={String(node.vertices.length)} />
      </div>
      <ul className="mt-3 space-y-2">
        {node.peers.map((p) => {
          const view = views.find((v) => v.nodeId === p.id);
          return (
            <li key={p.id} className="tile">
              <p className="text-fg">{p.id}</p>
              <p className="mono text-[0.75rem] text-muted">
                {p.operator
                  ? `${p.locus} · ${p.operator.kind} · ${p.operator.label}`
                  : pt
                    ? `${p.locus} · Edge · indexado`
                    : `${p.locus} · Edge · indexed`}
                {" · "}w {p.tipWeight.toFixed(2)}
              </p>
              <p className="mono text-[0.75rem] text-accent">
                {pt ? "pontas" : "tips"} {view?.tips.join(" · ") || "—"}
              </p>
              <button type="button" className="btn ghost mt-2" onClick={() => node.commitPeer(p.id)}>
                {pt ? "Emitir vértice" : "Commit vertex"}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={() => node.walkIndependent()}>
          {pt ? "Pontas honestas" : "Honest tips"}
        </button>
        <button type="button" className="btn ghost" onClick={() => node.gossipRound()}>
          {pt ? "Ronda gossip" : "Gossip round"}
        </button>
        <button type="button" className="btn ghost" onClick={() => node.forkAttack()}>
          {pt ? "Ataque de forquilha" : "Fork attack"}
        </button>
        <button type="button" className="btn ghost" onClick={() => node.absorb(2.5)}>
          {pt ? "Absorver 2.5" : "Absorb 2.5"}
        </button>
        <button type="button" className="btn ghost" onClick={() => node.federate("krum")}>
          Krum
        </button>
      </div>
    </div>
  );
}

export function DagLab({ lang }: { lang: "pt" | "en" }) {
  const pt = lang === "pt";
  const node = useHydratedNode();
  const tips = tipSet(node.vertices);
  return (
    <div>
      <p>
        {pt
          ? "GDA com peso de ponta MCMC. Gossip-about-gossip (Hedera-like). Conteúdo endereçado por CID. Sem cadeia linear."
          : "DAG with MCMC tip weight. Gossip-about-gossip (Hedera-like). Content addressed by CID. No linear chain."}
      </p>
      <DagCanvas vertices={node.vertices} highlight={node.lastTips} />
      <div className="inner-grid two mt-3">
        <Meter label={pt ? "Vértices" : "Vertices"} value={String(node.vertices.length)} />
        <Meter label={pt ? "Pontas" : "Tips"} value={String(tips.length)} />
      </div>
      <ul className="mt-3 space-y-1">
        {node.vertices
          .slice(-6)
          .reverse()
          .map((v) => (
            <li key={v.id} className="mono text-[0.75rem] text-muted">
              {v.id} · {v.kind} · w {v.weight.toFixed(2)} · {v.cid.slice(0, 12)}
            </li>
          ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={() => node.contribute(1)}>
          {pt ? "Vértice PdC" : "PoC vertex"}
        </button>
        <button type="button" className="btn ghost" onClick={() => node.gossip(NODE_ACCT)}>
          Gossip
        </button>
        <button type="button" className="btn ghost" onClick={() => node.walkIndependent()}>
          MCMC
        </button>
      </div>
    </div>
  );
}

export function LabFor({ id, lang }: { id?: string; lang: "pt" | "en" }) {
  if (id === "engines") return <EnginesLab lang={lang} />;
  if (id === "qiga" || id === "volition") return <QigaLab lang={lang} />;
  if (id === "nft") return <NftLab lang={lang} />;
  if (id === "edge") return <EdgeLab lang={lang} />;
  if (id === "republic") return <RepublicLab lang={lang} />;
  if (id === "bft") return <BftLab lang={lang} />;
  if (id === "dag") return <DagLab lang={lang} />;
  return null;
}
