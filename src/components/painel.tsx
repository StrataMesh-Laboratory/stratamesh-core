import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HolonStrip } from "@/components/holon-strip";
import { KernelPulse, LabFrame, Meter, useHydratedNode } from "@/components/kernel-ui";
import { OrchestratorPanel } from "@/components/landing";
import { LabFor } from "@/components/roadmap-labs";
import { NODE_ACCT, NODE_WALLET } from "@/lib/dlt-engine";
import { clpStamp, clpLabel } from "@/lib/clp";
import { HOLONS, tabsForHolon, type HolonId } from "@/lib/holons";
import { useHydratedBancada, useBancada } from "@/lib/bancada-store";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { hasInternalClearance, walletOf } from "@/lib/session-id";
import { useNode } from "@/lib/node-store";
import { fetchNodeStatus, type NodeStatus } from "@/lib/status";

const TABS = {
  pt: [
    { id: "pulse", t: "Pulso" },
    { id: "wallet", t: "Carteira" },
    { id: "agora", t: "Ágora" },
    { id: "dag", t: "GDA" },
    { id: "bancada", t: "Bancada" },
    { id: "sca", t: "SCA" },
    { id: "republic", t: "República" },
    { id: "edge", t: "Limiar" },
    { id: "mesh", t: "Malha" },
    { id: "kyc", t: "KYC" },
    { id: "orch", t: "Orquestrador" },
  ],
  en: [
    { id: "pulse", t: "Pulse" },
    { id: "wallet", t: "Wallet" },
    { id: "agora", t: "Agora" },
    { id: "dag", t: "DAG" },
    { id: "bancada", t: "Sandbox" },
    { id: "sca", t: "SCA" },
    { id: "republic", t: "Republic" },
    { id: "edge", t: "Edge" },
    { id: "mesh", t: "Mesh" },
    { id: "kyc", t: "KYC" },
    { id: "orch", t: "Orchestrator" },
  ],
} as const;

export function Painel({ lang }: { lang: "pt" | "en" }) {
  const pt = lang === "pt";
  const tabs = TABS[lang];
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("bancada");
  const [st, setSt] = useState<NodeStatus | null>(null);
  const { user, isPending } = useCurrentUserState();
  const node = useHydratedNode();
  const mine = useHydratedBancada(user?.id ?? null);
  const enrollMine = useBancada((s) => s.enrollKyc);
  const [units, setUnits] = useState(2);
  const [holon, setHolon] = useState<HolonId>("cgu");
  const [clp, setClp] = useState(() => clpStamp());
  const [kycEmail, setKycEmail] = useState("");

  useEffect(() => {
    void fetchNodeStatus().then(setSt);
  }, []);
  useEffect(() => {
    if (!user?.id) return;
    useNode.getState().ensureAccount(walletOf(user.id));
  }, [user?.id]);
  useEffect(() => {
    const t = window.setInterval(() => setClp(clpStamp()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const holonCopy = HOLONS.find((h) => h.id === holon)?.[lang];
  const visibleTabs = tabsForHolon(holon, tabs);
  const activeTab = visibleTabs.some((t) => t.id === tab) ? tab : visibleTabs[0]?.id ?? "pulse";

  if (isPending) {
    return (
      <main id="conteudo" className="wrap text-center">
        <p className="mono text-[0.75rem] text-muted">{pt ? "A resolver a sessão…" : "Resolving session…"}</p>
      </main>
    );
  }
  if (!user || !hasInternalClearance(user)) return <RedirectToSignIn />;

  const acct = walletOf(user.id);
  const userStrata = node.accounts[acct] ?? 0;
  const fogStrata = node.accounts[NODE_WALLET] ?? 0;
  const fogStaff = user.clearance === "staff" || user.clearance === "top_secret";
  const who = user.displayName || user.primaryEmail || user.id;

  return (
    <main id="conteudo" className="wrap wrap-wide">
      <header className="mb-6 border-b border-line pb-6 text-center">
        <p className="mono text-[0.75rem] text-accent">
          {pt ? "Conta" : "Account"} · {acct} · clearance {user.clearance}
        </p>
        <h1 className="serif mt-2 text-3xl">{pt ? "Painel" : "Panel"}</h1>
        <p className="mt-2 text-muted">
          {pt
            ? "Espaço privado desta conta — Painel e Bancada. O Nó fornece contas de utilizadores e SCA. O Nó não é entidade e não tem conta; tem carteira de Fog."
            : "Private space of this account — Panel and sandbox. The Node provides user and SCA accounts. The Node is not an entity and has no account; it has a Fog wallet."}
        </p>
        <p className="mono mt-3 text-[0.75rem] text-muted">{clpLabel(clp, lang)}</p>
        <p className="mono mt-2 text-[0.75rem] text-muted">
          {st?.ok ? (pt ? "Malha neste Fog: operacional" : "Mesh on this Fog: operational") : pt ? "Malha: UNAVAILABLE (gémeo local)" : "Mesh: UNAVAILABLE (local twin)"}
          {` · ${pt ? "STRATA desta conta" : "this account’s STRATA"} ${userStrata.toFixed(3)}`}
          {` · ${pt ? "carteira do Nó" : "Node wallet"} ${fogStrata.toFixed(3)}`}
        </p>
        <p className="mt-2 text-[0.9rem] text-muted">
          {pt ? "Titular" : "Holder"} · {who}
        </p>
      </header>

      <HolonStrip
        lang={lang}
        active={holon}
        onPick={(id) => {
          setHolon(id);
          const next = tabsForHolon(id, tabs)[0];
          if (next) setTab(next.id as (typeof tabs)[number]["id"]);
        }}
      />
      {holonCopy ? <p className="mb-4 text-center text-[0.9rem] text-muted">{holonCopy.body}</p> : null}

      <nav className="holon-nav" aria-label={pt ? "Ferramentas desta camada" : "Tools on this layer"}>
        {visibleTabs.map((t) => (
          <button key={t.id} type="button" className={activeTab === t.id ? "on" : ""} onClick={() => setTab(t.id as (typeof tabs)[number]["id"])}>
            {t.t}
          </button>
        ))}
      </nav>

      {activeTab === "pulse" && (
        <LabFrame>
          <p className="mb-3 text-muted">
            {pt
              ? `Leitura da malha no Fog que hospeda esta conta (${NODE_ACCT}). O pulso é do Fog; a conta é ${acct}.`
              : `Mesh reading on the Fog that hosts this account (${NODE_ACCT}). The pulse is the Fog’s; the account is ${acct}.`}
          </p>
          <KernelPulse lang={lang} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn ghost" onClick={() => node.consume(acct, 0.05)}>
              {pt ? "Consumir 0.05 desta conta (PdS)" : "Consume 0.05 from this account (PoS)"}
            </button>
            {fogStaff ? (
              <>
                <button type="button" className="btn" onClick={() => node.contribute(units)}>
                  {pt ? `Contributo Fog ${units} u (PdC)` : `Fog contribution ${units} u (PoC)`}
                </button>
                <button type="button" className="btn ghost" onClick={() => node.evolve()}>
                  QIGA
                </button>
                <button type="button" className="btn ghost" onClick={() => node.settleMesh()}>
                  {pt ? "Liquidar Limiar" : "Settle Edge"}
                </button>
              </>
            ) : null}
            <Link to={pt ? "/roadmap" : "/en/roadmap"} className="btn ghost">
              {pt ? "Mapa-mestre" : "Roadmap"}
            </Link>
          </div>
          {fogStaff ? (
            <label className="mt-4 block text-[0.85rem] text-muted">
              {pt ? "Unidades de recurso do Fog" : "Fog resource units"} {units}
              <input className="w-full" type="range" min={0.5} max={8} step={0.5} value={units} onChange={(e) => setUnits(+e.target.value)} />
            </label>
          ) : null}
          <h3>{pt ? "Diário da malha" : "Mesh journal"}</h3>
          <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
            {node.journal.slice(0, 12).map((j, i) => (
              <li key={i} className="mono text-[0.75rem] text-muted">
                {j.kind} · {j.text}
                {j.clp ? ` · ${j.clp}` : ""}
              </li>
            ))}
          </ul>
        </LabFrame>
      )}

      {activeTab === "wallet" && (
        <LabFrame>
            <p>
              {pt
                ? "Carteira desta conta (utilizador ou SCA). Distinta da carteira do Nó (Fog) e da tesouraria do operador AMCM ENI."
                : "Wallet of this account (user or SCA). Distinct from the Fog Node wallet and from the AMCM ENI operator treasury."}
            </p>
            <div className="inner-grid two mt-3">
              <Meter label={pt ? "STRATA desta conta" : "This account’s STRATA"} value={userStrata.toFixed(4)} />
              <Meter label={pt ? "Criações" : "Creations"} value={String(mine?.nfts.length ?? 0)} />
            </div>
            <div className="inner-grid two mt-3">
              <Meter label={pt ? "Carteira do Nó (Fog)" : "Fog Node wallet"} value={fogStrata.toFixed(4)} />
              <p className="text-[0.85rem] text-muted">
                {pt
                  ? "O Nó não é entidade: não tem Painel nem conta. O PdC e a despesa operacional passam por esta carteira."
                  : "The Node is not an entity: no Panel, no account. PoC and operational spend go through this wallet."}
              </p>
            </div>
            <ul className="mt-4 space-y-2">
              {(mine?.nfts ?? []).map((n) => (
                <li key={n.id} className="tile flex justify-between gap-2 text-[0.9rem]">
                  <span className="mono text-[0.75rem] text-muted">{n.id}</span>
                  <span className="tabular-nums">{n.collateral.toFixed(4)}</span>
                </li>
              ))}
            </ul>
        </LabFrame>
      )}

      {activeTab === "agora" && (
        <LabFrame>
          <p>
            {pt
              ? "A Ágora é o câmbio P2P onde STRATA encontra preço face ao euro de laboratório."
              : "Agora is the P2P exchange where STRATA finds a laboratory euro price."}
          </p>
          <p className="eq">1 EUR ≈ {node.agoraEur} STRATA (lab)</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => user && node.placeOrder("ask", acct, 0.2, 0.1)}
              >
                {pt ? "Oferta 0.20" : "Ask 0.20"}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => user && node.placeOrder("bid", acct, 0.2, 0.1)}
              >
                {pt ? "Procura 0.20" : "Bid 0.20"}
              </button>
              <button type="button" className="btn ghost" onClick={() => node.settleAgora()}>
                {pt ? "Cruzar" : "Match"}
              </button>
            </div>
          <ul className="mt-4 space-y-2">
            {node.orders.slice(0, 10).map((o) => (
              <li key={o.id} className="tile flex justify-between gap-2 text-[0.9rem]">
                <span className="mono text-[0.75rem] text-accent">
                  {o.side} {o.filled ? (pt ? "fechada" : "filled") : pt ? "aberta" : "open"}
                </span>
                <span className="text-muted">
                  {o.strata} STRATA · {o.eur} EUR · {o.account}
                </span>
              </li>
            ))}
          </ul>
        </LabFrame>
      )}

      {activeTab === "dag" && (
        <LabFrame>
          <LabFor id="dag" lang={lang} />
        </LabFrame>
      )}
      {activeTab === "bancada" && (
        <LabFrame>
          <LabFor id="nft" lang={lang} />
        </LabFrame>
      )}
      {activeTab === "sca" && (
        <LabFrame>
          <LabFor id="qiga" lang={lang} />
        </LabFrame>
      )}
      {activeTab === "republic" && (
        <LabFrame>
          <LabFor id="republic" lang={lang} />
        </LabFrame>
      )}
      {activeTab === "edge" && (
        <LabFrame>
          <LabFor id="edge" lang={lang} />
        </LabFrame>
      )}
      {activeTab === "mesh" && (
        <LabFrame>
          <LabFor id="bft" lang={lang} />
        </LabFrame>
      )}

      {activeTab === "kyc" && (
        <LabFrame>
          <p>
            {pt
              ? "Verificação desta conta. Cada sessão vê só o seu estado."
              : "Verification of this account. Each session sees only its own status."}
          </p>
          <form
              className="mt-4 flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (!kycEmail || !user) return;
                enrollMine(user.id, kycEmail);
                void import("@/lib/sca-server")
                  .then(({ enrollKycRow }) => enrollKycRow({ data: kycEmail }))
                  .catch(() => undefined);
                setKycEmail("");
              }}
            >
              <input
                className="fld flex-1"
                type="email"
                value={kycEmail}
                onChange={(e) => setKycEmail(e.target.value)}
                placeholder={pt ? "correio para KYC" : "email for KYC"}
                aria-label="email"
              />
              <button type="submit" className="btn">
                {pt ? "Inscrever" : "Enroll"}
              </button>
            </form>
            <div className="mt-4 space-y-2">
              {mine?.kyc ? (
                <div className="tile flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {mine.kyc.email} · <span className="mono text-[0.75rem] text-accent">{mine.kyc.status}</span>
                  </span>
                </div>
              ) : (
                <p className="text-muted">{pt ? "Ainda sem inscrição nesta conta." : "No enrollment on this account yet."}</p>
              )}
            </div>
        </LabFrame>
      )}

      {activeTab === "orch" && (
        <LabFrame>
          <OrchestratorPanel lang={lang} />
        </LabFrame>
      )}
    </main>
  );
}
