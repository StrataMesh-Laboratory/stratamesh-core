# Fog Mac launcher v5 — runtime UI

v5 adds a Terminal stats UI at install (15s refresh). `q` quit UI · `s` stop fog.

Public `fog.calhegasmorais.pt` rides **macbook-server** → this Mac’s `127.0.0.1:8788`. `mac_live=true`. `mesh_member` stays **false** until a second distinct `host_id` (n≥2). Do **not** load `pt.calhegasmorais.tunnel`. Do **not** `pkill -x cloudflared`.

The Grok session is **standby**. If this Mac is down **> 30 min**, session persist flips DNS `fog` → `stratamesh-fog-lab` (session `:8788`). When this Mac’s `macbook-server` tunnel is healthy again, DNS flips back. Reclaim from here: `origin-take.command` (HMAC of the local tunnel token). See [ORIGIN-FLUX.md](../../docs/ORIGIN-FLUX.md).

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

LAB n=1 · `mesh_member=false`.
