/**
 * Fetch preamble for CF Workers auth (and siblings).
 *
 * workers/stratamesh-auth.js on main is ESM (`export default`) but is shipped
 * as a single-file Worker PUT with no wrangler bundle — a live `import` of
 * `_metabolism.js` would 1000 the script. Do not butcher that 146k file here.
 * Live stratamesh-auth is 2.10.5-turnstile-lab with env STASIS freeze; do not
 * wrangler PUT it from this PR.
 *
 * Drop this in fetch() when the Worker is a real module graph:
 *
 *   import { admit, decide } from "./_metabolism.js";
 *   import { isP0Path, AUTH_CONTINGENCY } from "./metabol-admit.js";
 *
 *   const isP0 = isP0Path(path); // /health /login /verify
 *   const pack = decide("cf-worker-req", { ...liveRemaining, isP0, prevCircuit, contingencyUrl: AUTH_CONTINGENCY.url, contingencyOk: true });
 *   const gate = admit(pack, { isP0, rand: Math.random() });
 *   if (gate.via === "contingency") return Response.redirect(gate.contingency_url, 307);
 *   if (!gate.admit && !gate.freeze) return new Response("pace", { status: 429, headers: { "Retry-After": String(gate.retry_after_sec) } });
 *   if (gate.freeze) return new Response("freeze", { status: 503 }); // only after paceFailed + no hop
 *   // never 503 on first STASIS
 */
export const AUTH_CONTINGENCY = {
  url: "https://auth.calhegasmorais.pt",
  note: "python :8790 JSON hop",
};
export const PAGES_CONTINGENCY = {
  url: "https://calhegasmorais.pt/",
  note: "Pages apex, not Worker SPA",
};
export const SANDBOX_CONTINGENCY = {
  url: "https://sandbox.calhegasmorais.pt/",
  note: "gnu-atelier Pages",
};

export function isP0Path(path) {
  const p = String(path || "/").split("?")[0].toLowerCase();
  return (
    p === "/health" || p.endsWith("/health") ||
    p === "/login" || p.endsWith("/login") ||
    p === "/verify" || p.endsWith("/verify")
  );
}

export function preambleAdmit(path, pack, opts = {}) {
  const isP0 = opts.isP0 != null ? !!opts.isP0 : isP0Path(path);
  const { admit: admitFn } = opts;
  if (typeof admitFn !== "function") {
    throw new Error("pass admit from _metabolism.js as opts.admit");
  }
  return admitFn(pack, { isP0, rand: opts.rand });
}
