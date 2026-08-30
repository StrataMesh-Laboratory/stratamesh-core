/**
 * cognition-lobes — installable SCA cognition module (LAB).
 * Dual-lobe controller: probabilistic propose + symbolic constrain.
 * SCAs install this into their cognition slot. Worker does not infer.
 * No workers.dev. No HF token. Bilateral bus only.
 */
export const PACKAGE = {
  id: "cognition-lobes",
  kind: "cognition_module",
  version: "0.1.0-lab",
  install_slot: "cognition",
  host: "https://academy.calhegasmorais.pt/v1/packages/cognition-lobes",
  lobes: ["probabilistic", "symbolic"],
  bus: "propose → constrain → revise → commit | escalate",
  workers_dev: false,
  worker_infers: false,
};

export const GENE_SLOTS = [
  "explore",
  "fail_closed",
  "honesty_n",
  "metabolism",
  "secrets",
  "economy_no_mint",
  "residual_cmesh",
  "handler_complete",
];

export function createLobeController(prev) {
  const st = prev && typeof prev === "object"
    ? {
        generation: Number(prev.generation) || 0,
        fitness_ema: Number(prev.fitness_ema) || 0.5,
        genes: Array.isArray(prev.genes) ? prev.genes.slice(0, GENE_SLOTS.length) : GENE_SLOTS.map(() => 0.5),
        modules: Array.isArray(prev.modules) ? prev.modules.slice() : [],
      }
    : { generation: 0, fitness_ema: 0.5, genes: GENE_SLOTS.map(() => 0.5), modules: [] };
  while (st.genes.length < GENE_SLOTS.length) st.genes.push(0.5);

  function propose(observation) {
    const honesty = observation && observation.fog && observation.fog.n >= 2 ? 1 : 0.2;
    const score = 0.5 * honesty + 0.5 * st.fitness_ema;
    return {
      lobe: "probabilistic",
      score,
      proposal: score >= 0.6 ? "commit_if_admissible" : "escalate",
      observation: {
        n: observation && observation.fog && observation.fog.n,
        mesh_member: observation && observation.fog && observation.fog.mesh_member,
      },
    };
  }

  function constrain(proposal) {
    const reasons = [];
    if (!proposal) reasons.push("empty_proposal");
    if (proposal && proposal.workers_dev) reasons.push("workers.dev_not_admissible");
    if (proposal && proposal.unready) reasons.push("unready_fail_closed");
    const ok = reasons.length === 0;
    return {
      lobe: "symbolic",
      admissible: ok,
      certificate: ok ? "admissible" : "fail-closed",
      reasons,
      bus: PACKAGE.bus,
    };
  }

  function tick(observation) {
    const p = propose(observation);
    const s = constrain({ unready: !!(observation && observation.unready), workers_dev: false });
    const committed = s.admissible && p.proposal === "commit_if_admissible";
    if (committed) {
      st.generation += 1;
      st.fitness_ema = 0.85 * st.fitness_ema + 0.15 * p.score;
    }
    return {
      ok: true,
      schema: "stratamesh.cognition.lobes.v1",
      committed,
      evolved: committed,
      probabilistic: p,
      symbolic: s,
      verdict: committed ? "commit" : "escalate",
      state: snapshot(),
    };
  }

  function install(moduleId) {
    const id = String(moduleId || "").slice(0, 80);
    if (!id) return { ok: false, error: "module_id required" };
    if (st.modules.indexOf(id) < 0) st.modules.push(id);
    return { ok: true, modules: st.modules.slice() };
  }

  function snapshot() {
    return {
      generation: st.generation,
      fitness_ema: +Number(st.fitness_ema).toFixed(4),
      genes: st.genes.map((g) => +Number(g).toFixed(4)),
      slots: GENE_SLOTS,
      modules: st.modules.slice(),
    };
  }

  return { tick, install, snapshot, package: PACKAGE };
}

export function subsistenceBurn({ acb_id, module_id, units, oracle_live, funded, lab_waived }) {
  const amount = Number(units || 0) * 0.0005;
  const waived = lab_waived !== false && !oracle_live;
  return {
    ok: true,
    schema: "stratamesh.subsistence.burn.v1",
    from: acb_id || null,
    to: "#0",
    rail: "burn_to_#0",
    unit: "STRATA",
    amount: waived ? 0 : amount,
    would_burn: amount,
    executed: !waived && !!oracle_live && !!funded && amount > 0,
    lab_waived: !!waived,
    never_mint: true,
    module_id: module_id || null,
    note: waived
      ? "LAB: burn recorded, STRATA not moved until oracle_live && funded."
      : "Subsistence debit of the student ACB — transfer to #0, never mint.",
  };
}
