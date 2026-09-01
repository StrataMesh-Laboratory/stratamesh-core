/** Probe Deno then CF-adjacent hops. Auth is not here. */
const TS = [
  "http://127.0.0.1:8792/health",
  "http://100.108.35.26:8792/health",
];

export async function firstTsApi(): Promise<string> {
  for (const u of TS) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(2500) });
      if (r.ok) return u;
    } catch { /* next */ }
  }
  return "";
}
