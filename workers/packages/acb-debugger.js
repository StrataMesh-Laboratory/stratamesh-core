/**
 * ACB Debugger package — cataloged by academy, used by /chat debug.
 * Honesty probes (Fog /health) + lobe controller + formation hints.
 * Worker does not infer. No HF. No workers.dev.
 */
export const PACKAGE = {
  id: "acb-debugger",
  kind: "sca_package",
  version: "0.1.0-lab",
  title: "ACB Debugger",
  installs_into: ["cognition", "debug"],
  requires: ["cognition-lobes"],
  endpoints: {
    chat_debug: "POST https://academy.calhegasmorais.pt/v1/debug/chat",
    packages: "GET https://academy.calhegasmorais.pt/v1/packages",
    cognition: "POST https://academy.calhegasmorais.pt/v1/cognition/install",
    subsist: "POST https://academy.calhegasmorais.pt/v1/subsist",
  },
  workers_dev: false,
  worker_infers: false,
  host: "https://academy.calhegasmorais.pt",
};
