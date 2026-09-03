/** Mutual mw + substrate channels. Never workers.dev.
 * Deno Deploy SaaS stays SIGNUP_UNAVAILABLE — local :8792 is the Deno hop.
 * 3 live MW then CF only on ALLOW then static maintenance. Fog :8787 is kernel.
 */
export const DENO = [
  "http://127.0.0.1:8792/health",
];
export const PY = [
  "http://127.0.0.1:8790/health",
];
export const NODE = [
  "http://127.0.0.1:8791/health",
];
export const CF = [
  "https://calhegasmorais.pt/health",
  "https://fog.calhegasmorais.pt/health",
];

async function firstOk(urls: string[]): Promise<string> {
  for (const u of urls) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(2500) });
      if (r.ok) return u;
    } catch { /* next */ }
  }
  return "";
}

export async function resolveHop(): Promise<{
  deno: string; py: string; node: string; workerd: string; cf: string;
  prefer: "deno" | "py" | "node" | "workerd" | "cf" | "none";
  hold: string;
}> {
  const deno = await firstOk(DENO);
  const py = await firstOk(PY);
  const node = await firstOk(NODE);
  const workerd = await firstOk(["http://127.0.0.1:8788/health"]);
  const cf = await firstOk(CF);
  const prefer = deno ? "deno" : py ? "py" : node ? "node" : workerd ? "workerd" : cf ? "cf" : "none";
  return { deno, py, node, workerd, cf, prefer, hold: "frontend/maintenance-1xxx.html" };
}
