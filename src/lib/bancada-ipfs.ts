/** IPFS HTTP gateway — CID of a Bancada object, never a Node id. */
const GATEWAYS = ["https://ipfs.io/ipfs/", "https://dweb.link/ipfs/", "https://cf-ipfs.com/ipfs/"];

export function parseCid(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const m =
    s.match(/^(?:ipfs:\/\/|\/ipfs\/)?(bafy[a-z0-9]{20,}|Qm[1-9A-HJ-NP-Za-km-z]{44})/i) ||
    s.match(/\/ipfs\/(bafy[a-z0-9]{20,}|Qm[1-9A-HJ-NP-Za-km-z]{44})/i);
  return m ? m[1] : null;
}

export function cidGatewayUrl(cid: string, i = 0): string {
  return GATEWAYS[i % GATEWAYS.length] + cid;
}

export function nftMediaRef(n: { cid?: string; image?: string; metadata_json?: string | Record<string, unknown> }): string | null {
  if (n.cid) return parseCid(n.cid);
  if (n.image) return parseCid(n.image) || (n.image.startsWith("http") ? n.image : null);
  let meta: Record<string, unknown> = {};
  try {
    meta = typeof n.metadata_json === "string" ? JSON.parse(n.metadata_json) : n.metadata_json || {};
  } catch {
    meta = {};
  }
  const cand = meta.cid || meta.image || meta.img;
  if (typeof cand === "string") return parseCid(cand) || (cand.startsWith("http") ? cand : null);
  return null;
}
