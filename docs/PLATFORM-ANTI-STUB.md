# Platform anti-stub pass (2026-08-26)

Lab-honest replacements applied on Cloudflare Workers. Fake multi-host theatre removed.

## Deployed

| Worker | Change | Version signal |
|--------|--------|----------------|
| `stratamesh-gossip` | Peers = only `FOG-NODE-PT-CM-001` (live). Removed `node-2/3`, `edge-cmn-*`, `scout` placeholders. Protocol `lab_single_host_gossip`. | `2.1.0-lab-honest` |
| `stratamesh-status` | `/health` version aligned to **0.3.9-pulse** (was 0.3.8 while `/` was 0.3.9). | `0.3.9-pulse` |
| `stratamesh-dag-gateway` | Alias `GET /api/v1/dag/tips` → same as `/api/v1/tips`. | `1.1.1-aliases` |
| `stratamesh-poc` | Alias `/status` → `/health` under PoC prefix. | — |
| `stratamesh-acb` | Aliases `/roster`, `/acb/roster` → team roster. | — |
| `stratamesh-aiops` | Prior pass: handoff loop, no perpetual P3 actions. | `1.7.1-ops-formal` |

## Still incomplete (honest, not fake)

| Surface | Reality |
|---------|---------|
| Multi-host gossip | Not live — peers list stays single-node until real operators |
| SPA metrics on status | Missing fields until SPA registry emits them |
| `src/cid_pin_stub.py` (core repo) | Lab pin helper name — track for real Kubo path |
| Fund form `placeholder=` attrs | HTML UX only, not fake data |
| Free plan Worker count | ~36 scripts — hygiene, not stubs |

## Policy

- Prefer **empty / lab / single-node** over invented peers or mainnet claims.
- Path **aliases** for documented URLs are OK; silent fake payloads are not.
- Night Diagnostic + Dev Cycle + AIOps `/actions` consume real posture only.

## Verify

```bash
curl -s https://calhegasmorais.pt/api/v1/gossip/peers | jq .
curl -s https://status.calhegasmorais.pt/health | jq .version
curl -s https://calhegasmorais.pt/api/v1/dag/tips | head
curl -s https://calhegasmorais.pt/api/v1/poc/status | head
curl -s https://calhegasmorais.pt/api/v1/acb/roster | head
```
