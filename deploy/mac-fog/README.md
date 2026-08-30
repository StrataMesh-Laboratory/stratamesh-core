# Fog Mac launcher v5 — runtime UI

v5 adds a Terminal stats UI at install (15s refresh). `q` quit UI · `s` stop fog.

Public `fog.calhegasmorais.pt` rides the existing **macbook-server** connector → this Mac’s `127.0.0.1:8788`. Do **not** load `pt.calhegasmorais.tunnel` (fog-lab). Do **not** `pkill -x cloudflared`.

| Origin | Loopback |
|--------|----------|
| **macbook** | Mac `127.0.0.1:8788` → `127.0.0.1:8787` |

Probe: `GET https://fog.calhegasmorais.pt/health` → `"origin":"macbook"`.

## Install

1. Unzip / git pull. Double-click `FogNodeInstaller.command`.
2. A Terminal window opens the runtime UI (`fog-tui.py`).
3. Re-open later: `FogRuntime.command` or `python3 ~/StrataMesh/fog/bin/fog-tui.py`.

Stop fog: `s` then `y` in the UI, or `stop-fog.command`.

LAB n=1 · `mesh_member=false`.
