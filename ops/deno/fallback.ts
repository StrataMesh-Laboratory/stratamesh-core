/** Probe Deno local hop first, then CF-adjacent public hosts. Auth is not here.
 * Deno Deploy SaaS stays SIGNUP_UNAVAILABLE — this list is the workaround.
 * Never workers.dev.
 */
export const TS = [
  "http://127.0.0.1:8792/health",
  "http://100.108.35.26:8792/health",
];

export const CF = [
  "https://calhegasmorais.pt/health",
  "https://status.calhegasmorais.pt/",
  "https://edge.calhegasmorais.pt/health",
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

export async function firstTsApi(): Promise<string> {
  return await firstOk(TS);
}

export async function firstCfApi(): Promise<string> {
  return await firstOk(CF);
}

export async function resolveHop(): Promise<{ deno: string; cf: string; prefer: "deno" | "cf" | "none" }> {
  const deno = await firstTsApi();
  const cf = await firstCfApi();
  const prefer: "deno" | "cf" | "none" = deno ? "deno" : cf ? "cf" : "none";
  return { deno, cf, prefer };
}
