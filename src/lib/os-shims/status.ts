export type NodeStatus = {
  ok: boolean;
  node_id?: string;
  version?: string;
  status?: string;
  timestamp?: string;
  lab?: boolean;
  circulating?: number;
  mint_emitted?: number;
  burn?: number;
  error?: string;
};

export async function fetchNodeStatus(): Promise<NodeStatus> {
  try {
    const r = await fetch("/status", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { ok: false, error: "UNAVAILABLE" };
    const d = (await r.json()) as Record<string, unknown>;
    return {
      ok: true,
      node_id: String(d.node_id ?? "FOG-NODE-PT-CM-001"),
      version: String(d.version ?? ""),
      status: String(d.status ?? "operational"),
      timestamp: String(d.timestamp ?? ""),
      lab: true,
    };
  } catch {
    return { ok: false, error: "UNAVAILABLE" };
  }
}

export async function trackEvent(name?: string) {
  return { ok: true, event: name ?? "", at: new Date().toISOString() };
}
