# Fog Mac launcher v3 — MacBook’s own :8788

Replaces v2 zip mailed 2026-08-29.

**Two origins. Never both. Never one host using the other’s :8788.**

| Origin | When | Loopback |
|--------|------|----------|
| **session** (temp) | MacBook unavailable | *this* Grok host `127.0.0.1:8788` → `127.0.0.1:8787` |
| **macbook** | Mac is the node | *the Mac’s* `127.0.0.1:8788` → `127.0.0.1:8787` |

Public `/health` on `fog.calhegasmorais.pt` is answered by **that host’s** workerd and includes `"origin":"session"|"macbook"`. That is the flux probe.

## Flux (one named-tunnel connector)

```
session.live  --yield-public→  DARK  --origin-take→  macbook.live
macbook.live  --origin-yield→  DARK  --resume-public→  session.live
```

1. Installer starts **Mac-local** fog + workerd. Tunnel stays HOLD (`macbook.standby`).
2. Grok host: `python3 ops/bin/fog-persist.py --yield-public`  
   Session fog+workerd stay on loopback. Tunnel dies. Public goes DARK (1033). Persist will **not** restart the tunnel.
3. Mac: `origin-take.command`  
   Refuses if public still says `origin=session`. Loads the Mac tunnel LaunchAgent only when DARK.
4. Reverse: Mac `origin-yield.command`, then session `--resume-public`.

`FOG_ORIGIN` / workerd `ORIGIN` binding = this process’s role. `origin.lease` `public` = whether **this** host holds the connector.

## Install

1. Unzip. Double-click `FogNodeInstaller.command`.
2. Hidden prompt for the tunnel token if `~/.config/stratamesh/tunnel.token` is missing.
3. Cut over with the flux above — not by loading the tunnel plist while session is live.

Stop all: `stop-fog.command`.

No secrets in the zip. Token never on argv.

LAB n=1 · `mesh_member=false`.
