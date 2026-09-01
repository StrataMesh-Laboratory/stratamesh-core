/** Four-layer object on Deno :8792. CID ≠ NFT. No Deno Deploy account. */
const ALPHA = "abcdefghijklmnopqrstuvwxyz234567";

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function contentCid(value: unknown): Promise<string> {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  const hex = await sha256Hex(s);
  let bits = "";
  for (let i = 0; i < hex.length; i += 2) bits += parseInt(hex.slice(i, i + 2), 16).toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) out += ALPHA[parseInt(bits.slice(i, i + 5), 2)];
  return "bafy" + out.slice(0, 52);
}

function partPayload(role: string, value: unknown): { role: string; name: string; raw: unknown; cid: string | null } | null {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    return { role, name: role, raw: value, cid: null };
  }
  const rec = value as Record<string, unknown>;
  const name = String(rec.name || role);
  if (rec.cid) return { role, name, raw: null, cid: String(rec.cid) };
  const raw = rec.content != null ? rec.content : rec.bytes != null ? rec.bytes : rec;
  return { role, name, raw, cid: null };
}

export async function composeManifest(
  parts: Record<string, unknown>,
  meta: { name?: string; kind?: string; creator?: string; world_id?: string | null } = {},
) {
  const listed: { role: string; cid: string; name: string }[] = [];
  for (const role of Object.keys(parts || {}).sort()) {
    const extracted = partPayload(role, parts[role]);
    if (!extracted) continue;
    const cid = extracted.cid || (await contentCid(
      typeof extracted.raw === "string" ? extracted.raw : JSON.stringify(extracted.raw),
    ));
    listed.push({ role: extracted.role, cid, name: extracted.name });
  }
  const partMap: Record<string, { cid: string; name: string }> = {};
  for (const p of listed) partMap[p.role] = { cid: p.cid, name: p.name };
  const manifest = {
    standard: "strata-digital-object-1",
    layers: ["cid", "dag", "nft", "strata"],
    meta: {
      name: meta.name || "",
      kind: meta.kind || "ugc",
      creator: meta.creator || "",
      world_id: meta.world_id || null,
    },
    parts: partMap,
  };
  return { manifest, manifest_cid: await contentCid(JSON.stringify(manifest)), parts: listed };
}

export const OBJECT_KINDS = [
  "world", "machine", "compute", "avatar_component", "ugc",
  "service", "dataset", "ai_artifact", "building", "virtual_space",
] as const;
