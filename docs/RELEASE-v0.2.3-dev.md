# StrataMesh Core — v0.2.3-dev

**Status:** SHIPPED (operator GO 2026-08-30) · GitHub **prerelease**  
**Tag:** `v0.2.3-dev`  
**Baseline:** [v0.2.3-lab](https://github.com/StrataMesh-Laboratory/stratamesh-core/releases/tag/v0.2.3-lab)

Not semver major. Not v0.3. Not testnet. Not mainnet. `oracle_live=false`. `f_max=0`.

## What this cut is

Two distinct hosts, honest **n=2** / **mesh_member=true**:

| Node | Continuity | Hop |
|------|------------|-----|
| `FOG-NODE-PT-CM-001` Mac | continuous | tunnel → workerd `:8788` ORIGIN=macbook → fog `:8787` |
| `EDGE-GROK-CMN-001` | session (expected) | tunnel → workerd `:8788` ORIGIN=edge → edge `:8789` |

Public: `fog.calhegasmorais.pt` `origin=macbook`; `edge.calhegasmorais.pt` `origin=edge`; gossip `2.3.9-n2-probe` lists both live.

## Not in this cut

- Byzantine `f_max>0` (needs n≥3)
- Closing P0 multi-host as aBFT
- oracle_live / grok90 VM
- workers.dev, 6th CF cron
- Mainnet / MiCA public offer

## Since v0.2.3-lab

- Structural workerd hop (Fog + EDGE)
- `mac_live` trusted Mac origin
- EDGE persist + watchdog (self-start on missed hop ping)
- Origin flux / one named-tunnel connector
- VA API 7-day tokens (dashboard Assistente) — already on api-edge
- Fog TUI v5 (15s, q/s)
