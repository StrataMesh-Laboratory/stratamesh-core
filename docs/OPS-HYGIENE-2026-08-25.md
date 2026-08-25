# Lab hygiene log — 2026-08-25

Executed from diagnostic (FOG-NODE-PT-CM-001), **without** enabling Bot Fight / crawler blocks for legitimate AI or search bots.

## Done

| Action | Result |
|--------|--------|
| DNS `cpanel.calhegasmorais.pt` A | **Deleted** (legacy origin surface) |
| DNS `_dnslink` TXT | **Deleted** (stale May-2026 CID; re-add when current site root CID is pinned) |
| Workers deleted (unbound, no routes) | contribution, contribution-portal, cpanel-proxy, edge-cmn-01/02, ipfs-pinner, kyc, kyc-ocr, portal, ui |
| Worker count | **56 → 46** |
| Crons | Still **5/5** Free max (acb, aiops, briefing, dao, poc) — within budget |
| Security level | **high** (unchanged) |
| robots.txt | `User-agent: *` / `Allow: /` — crawlers and AI readers **not** blocked |
| Live probes | home/status/fund/briefing **200** |

## Kept (unrouted but service-bound)

briefing, deomail, whatsapp, gate, node-2/3, scout, chat, crypto, edge, registry, turnstile, clearance, docverify, dag-workflow, …

## Not done here (requires operator)

1. **Rotate Cloudflare API tokens** used in chats/sandboxes — create scoped tokens (Workers Edit, D1, Zone DNS/Settings, read-only status). Documented in `docs/OPS-TOKEN-HYGIENE.md`.
2. Further cut toward ≤30 workers only after confirming orchestrator can drop scout/crypto/chat bindings.
3. Re-publish DNSLink when a current directory CID for the public site is available.
4. Oracle Always Free + Tunnel multi-host (Roadmap adversarial lab).

## Explicit non-action

No Bot Fight Mode / no WAF rules targeting GPTBot, ClaudeBot, Google-Extended, or other legitimate content crawlers.
