# Fog Mac launcher v3 — workerd layer

Replaces v2 zip mailed 2026-08-29 (`StrataMesh Fog Mac installer v2`).

**Topology (structural, same on Grok-session host and MacBook):**

```
Internet → named tunnel → workerd 127.0.0.1:8788 → fog 127.0.0.1:8787
```

Fog plugin (`GET /workerd`, `POST /workerd/reboot` local-only) still reboots workerd if it dies. LaunchAgent KeepAlive is the Mac equivalent of `fog-persist.py`.

## Install

1. Stop any other origin for `fog.calhegasmorais.pt` (Grok-session persist / Oracle). One origin.
2. Unzip. Double-click `FogNodeInstaller.command`.
3. Hidden prompt for the tunnel token if `~/.config/stratamesh/tunnel.token` is missing.
4. When ready to take public DNS:  
   `launchctl load ~/Library/LaunchAgents/pt.calhegasmorais.tunnel.plist`

Stop: `stop-fog.command`.

No secrets in the zip. Token never on argv (`TUNNEL_TOKEN` env).

LAB n=1 · `mesh_member=false`.
