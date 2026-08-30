# Fog Mac launcher v6 — runtime UI

v6 Terminal stats (15s). `q` quit · `s` stop fog · `b` reboot fog+workerd · `g` git pull + reboot · `r` refresh.

Public `fog.calhegasmorais.pt` rides **macbook-server** → this Mac’s `127.0.0.1:8788`. `mac_live=true`. `n=2` · `mesh_member=true` (Fog Mac + EDGE session). `f_max=0` until n≥3. Do **not** load `pt.calhegasmorais.tunnel`. Do **not** kill `macbook-server` cloudflared.

Browser `/` is destylised (CF Worker overlay on the exact path). JSON `/health` `/status` stay on this Mac’s tunnel.

The Grok session is **standby**. If this Mac is down **> 30 min**, session persist flips DNS `fog` → `stratamesh-fog-lab` (session `:8788`). When this Mac’s `macbook-server` tunnel is healthy again, DNS flips back. Reclaim from here: `origin-take.command`. See [ORIGIN-FLUX.md](../../docs/ORIGIN-FLUX.md).

| Origin | Loopback |
|--------|----------|
| **macbook** (primary) | Mac `127.0.0.1:8788` → `127.0.0.1:8787` |
| **session** (fallback only) | Grok host `127.0.0.1:8788` → `127.0.0.1:8787` |

Probe: `GET https://fog.calhegasmorais.pt/health` → `"origin":"macbook"` (or `"session"` during fallback).

## Install

1. Unzip / git pull. Double-click `FogNodeInstaller.command`.
2. A Terminal window opens the runtime UI (`fog-tui.py`).
3. Re-open later: `FogRuntime.command` or `python3 ~/StrataMesh/fog/bin/fog-tui.py`.

Stop fog: `s` then `y` in the UI, or `stop-fog.command`.
Reboot fog: `b` then `y` (kickstart, does not kill the public tunnel).

LAB n=2 · `mesh_member=true` · `f_max=0`.
