# Fog Mac launcher v7 — runtime UI + stay-awake

v7 Terminal stats (15s). `q` quit · `s` stop fog · `b` reboot fog+workerd · `g` git pull + reboot · `r` refresh.

**Stay-awake:** `FogStayAwake.command` loads `pt.calhegasmorais.fog-awake` (`caffeinate -ims` + 2 min kick if `:8787`/`:8788` died after wake). Idle sleep is held while logged in. **True sleep still halts the CPU** — workerd cannot serve while halted. Lid + battery will sleep. On charger, lid-closed stay-up:

```
sudo pmset -c disablesleep 1
```

Public `fog.calhegasmorais.pt` rides **macbook-server** → this Mac’s `127.0.0.1:8788`. `mac_live=true`. `n=2` · `mesh_member=true`. `f_max=0` until n≥3. Do **not** load `pt.calhegasmorais.tunnel`. Do **not** kill `macbook-server` cloudflared.

Browser `/` is destylised (CF Worker overlay on the exact path). JSON `/health` `/status` stay on this Mac’s tunnel.

The Grok session is **standby**. If this Mac is down **> 30 min**, session persist flips DNS `fog` → `stratamesh-fog-lab`. Wake kick is meant to bring origin back before that timer.

| Origin | Loopback |
|--------|----------|
| **macbook** (primary) | Mac `127.0.0.1:8788` → `127.0.0.1:8787` |
| **session** (fallback only) | Grok host `127.0.0.1:8788` → `127.0.0.1:8787` |

## Install

1. Unzip / git pull. Double-click `FogNodeInstaller.command`.
2. Then `FogStayAwake.command` (or it loads with the installer).
3. Re-open UI: `FogRuntime.command` (already wrapped in `caffeinate -ims`).

Stop fog: `s` then `y` in the UI, or `stop-fog.command`.
Reboot fog: `b` then `y`.
