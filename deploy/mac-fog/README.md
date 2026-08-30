# Fog Mac launcher v3 — MacBook’s own :8788

Replaces v2 zip mailed 2026-08-29.

**Two origins. Never both. Never one host using the other’s :8788.**

| Origin | When | Loopback |
|--------|------|----------|
| **session** (temp) | MacBook unavailable | *this* Grok host `127.0.0.1:8788` → `127.0.0.1:8787` |
| **macbook** | Mac is the node | *the Mac’s* `127.0.0.1:8788` → `127.0.0.1:8787` |

```
Internet → named tunnel → (this host’s) workerd :8788 → (this host’s) fog :8787
```

The Mac installer starts **Mac-local** workerd and fog. It does not proxy, SSH, or otherwise use the session :8788. Cutover = stop session persist+tunnel, then load the Mac tunnel LaunchAgent. Same named-tunnel token, **one connector**.

Fog plugin (`GET /workerd`, `POST /workerd/reboot` local-only) owns workerd on that host. `FOG_ORIGIN=macbook` on the Mac; session persist sets `FOG_ORIGIN=session`.

## Install

1. Unzip. Double-click `FogNodeInstaller.command`. Fog + workerd come up on **this Mac’s** loopback. Tunnel stays HOLD.
2. Hidden prompt for the tunnel token if `~/.config/stratamesh/tunnel.token` is missing.
3. When the Mac takes public DNS: stop the Grok-session persist, then  
   `launchctl load ~/Library/LaunchAgents/pt.calhegasmorais.tunnel.plist`

Stop: `stop-fog.command`.

No secrets in the zip. Token never on argv.

LAB n=1 · `mesh_member=false`.
