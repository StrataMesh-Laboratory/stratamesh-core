/** Fog operator is an appointment on a Fog holon — not the holon itself.
 *  Edge Nodes have no operator: they are indexed to a principal Fog. */

export type FogOperatorKind = "human" | "dao_associative" | "dao_corporate" | "sca";

export type FogOperator = {
  kind: FogOperatorKind;
  id: string;
  label: string;
};

export const OPERATOR_KIND = {
  pt: {
    human: "utilizador humano",
    dao_associative: "DAO associativa",
    dao_corporate: "DAO corporativa",
    sca: "SCA",
  },
  en: {
    human: "human user",
    dao_associative: "associative DAO",
    dao_corporate: "corporate DAO",
    sca: "SCA",
  },
} as const;

/** Current laboratory instance — kind=human. Not the only admissible kind. */
export const THIS_FOG_OPERATOR: FogOperator = {
  kind: "human",
  id: "AMCM-ENI",
  label: "André Manuel Calhegas Morais, AMCM ENI",
};

export function fogRequiresOperator() {
  return true;
}

export function edgeRequiresOperator() {
  return false;
}

export function kindMayOpenFog(kind: FogOperatorKind) {
  return kind === "human" || kind === "dao_associative" || kind === "dao_corporate" || kind === "sca";
}

/** Ontology admits SCA operators. This laboratory has none instantiated. No invented threshold. */
export function scaOpenFogStatus() {
  return {
    admitted: true as const,
    instantiated: false as const,
    note: "future-open: an SCA that accumulates sufficient STRATA may open a Fog; not yet a laboratory instance",
  };
}

export function operatorLine(op: FogOperator, lang: "pt" | "en" = "pt") {
  const k = OPERATOR_KIND[lang][op.kind];
  return lang === "pt" ? `operador ${k}: ${op.label}` : `operator (${k}): ${op.label}`;
}
