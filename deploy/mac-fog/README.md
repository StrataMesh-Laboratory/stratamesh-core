# Fog Node installer (macOS)

The **Fog Installer** app is a hardware bootstrap for this Mac.

1. **Node id** of the operator-registered Fog (example `FOG-NODE-PT-CM-001`)
2. **2FA** mailed to the registered operator (DeoMail via auth)
3. **GitHub PAT** (`ghp_…`) — hidden popup, stored `~/.config/stratamesh/`
4. **Cloudflare API token** (`cfat_…`) — hidden popup
5. **Tunnel token** if not already on disk
6. Installs Fog `:8787`, workerd `:8788`, stay-awake, then the destyle runtime UI

Double-click `apps/FogInstaller.app` or:

```
python3 ~/StrataMesh/fog/repo/deploy/mac-fog/fog-bootstrap.py
```

Secrets never go to git. Lid + battery still sleeps; stay-awake holds idle sleep.

TUI: `q` quit · `s` stop · `b` reboot · `g` pull+reboot · `r` refresh.
