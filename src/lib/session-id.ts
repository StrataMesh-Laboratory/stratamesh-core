/** Stable identity keys for per-account Bancada / wallet isolation.
 *
 * Users and SCAs hold accounts. The Node provides them.
 * The Node is not an entity: it has no account and no Painel.
 * The Fog still has a wallet (NODE_WALLET) for PoC production and operational spend.
 */

export function walletOf(userId: string): string {
  return `utilizador:${userId}`;
}

/** Registered floor. Visitors (no session) stay PUBLIC and never enter the Painel. */
export function hasInternalClearance(user: { clearance?: string } | null | undefined): boolean {
  if (!user) return false;
  const c = (user.clearance || "internal").toLowerCase().replace(/[\s-]+/g, "_");
  return c === "internal" || c === "staff" || c === "top_secret";
}

function fnv1a(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function fromJwt(token: string): { id: string; email: string | null; name: string | null } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = json + "=".repeat((4 - (json.length % 4)) % 4);
    const payload = JSON.parse(atob(pad)) as Record<string, unknown>;
    const email = typeof payload.email === "string" ? payload.email : null;
    const sub = payload.sub ?? payload.user_id ?? payload.uid ?? payload.id;
    const id = email || (sub != null ? String(sub) : null);
    if (!id) return null;
    const name = typeof payload.name === "string" ? payload.name : null;
    return { id, email, name };
  } catch {
    return null;
  }
}

/** Resolve the live-portal session from localStorage. Null when signed out. */
export function identityFromLiveStorage(): { id: string; email: string | null; name: string | null } | null {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem("sm_token") || window.localStorage.getItem("token");
  if (!token) return null;
  const jwt = fromJwt(token);
  if (jwt) return jwt;
  const email = window.localStorage.getItem("sm_email") || window.localStorage.getItem("email");
  if (email) return { id: email, email, name: null };
  return { id: "tok:" + fnv1a(token), email: null, name: null };
}
