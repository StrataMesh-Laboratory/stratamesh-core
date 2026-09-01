# v0.5.0-lab hop — Node Launcher

P1 / A-LAB. Lab. Not mainnet. oracle_live stays false.

## Hop
Internet → named tunnel → workerd :8788 (isolate, metabol)
→ Fog :8787 (origin macbook)
→ Python :8790 (cap, plugins, /strata, fallback watch)
→ Node :8791 (/assemble compose)

## Fallback (30 min)
mac_live false ≥ 1800s → EDGE keeps :8788/:8789/:8790/:8791.
Fog DNS does **not** flip from EDGE. Only session persist with FOG_MAY_FLIP_DNS=1.
Named tunnel is never pkill'd.

## Cadence
TUI instrument 60s. r refreshes now.

## CI
hop-e2e: contract → python-fog gossip → node-compose.
