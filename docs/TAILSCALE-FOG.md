# Tailnet — StrataMesh Laboratory

Org console: `stratamesh-laboratory.org.github`  
Public origin stays Pages + named tunnels. Tailscale is **ops mesh only** (no Fog apex takeover).

| node_id / hostname | role | tailnet IPv4 | note |
|---|---|---|---|
| EDGE-GROK-CMN-001 / edge-grok-cmn-001 | Edge lab hop | 100.102.244.34 | this isolate |
| FOG / mbpv | Fog MacBook | 100.108.35.26 | FOG-NODE-PT-CM-001 |
| EDGE phone / iphone-14 | Edge residual | 100.127.166.6 | C_mesh = f(1-U) |

## Locus

- Vault (never git): `~/.config/stratamesh/tailscale.authkey`, `tailscale.api`
- Rail: `ops/config/rails.json` → `tailscale-api` (2000/day UTC, 15s min)
- Probe: `ops/bin/tailscale-stasis.py`
- Join helper: `deploy/mac-fog/tailscale-fog.sh`

## Rules

- Do not publish `100.x` on calhegasmorais.pt HTML.
- Do not `pkill cloudflared`. Fog public origin remains the Mac tunnel you already run.
- Tailscale SSH only (`--ssh`), never `sshd` on 0.0.0.0.
- Metabolic: 429 from `api.tailscale.com` → STASIS; hourly_cap = remaining / hours_to_00:00 UTC.
