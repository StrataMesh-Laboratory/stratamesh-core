# Fog Mac launcher v3 — structural workerd layer

Replaces v2 zip mailed 2026-08-29 (`StrataMesh Fog Mac installer v2`).
v2 zip attachment on DeoMail is expired (`available: false`).

**Topology (same on the Grok-session host and on the MacBook):**

```
Internet → named tunnel → workerd 127.0.0.1:8788 → fog 127.0.0.1:8787
```

Fog plugin (`GET /workerd`, `POST /workerd/reboot` local-only, no `CF-Ray`) starts and reboots workerd. LaunchAgent KeepAlive on fog is the Mac equivalent of `fog-persist.py`. workerd LaunchAgent is written but **not loaded** so reboot does not fight launchd.

`/health` and `/workerd` on :8788 are answered by workerd itself (never fetch fog — avoids the single-thread deadlock). Other paths use the FOG capability.

## Install

1. Stop any other origin for `fog.calhegasmorais.pt` (Grok-session persist / Oracle). **One origin.**
2. Unzip. Double-click `FogNodeInstaller.command`.
3. Hidden prompt for the tunnel token if `~/.config/stratamesh/tunnel.token` is missing.
4. Fog + workerd come up on loopback. Public DNS is still the session origin until you cut over:
   `launchctl load ~/Library/LaunchAgents/pt.calhegasmorais.tunnel.plist`

Stop: `stop-fog.command`.

No secrets in the zip. Token never on argv (`TUNNEL_TOKEN` env in `run-tunnel.sh`).

LAB n=1 · `mesh_member=false`.
