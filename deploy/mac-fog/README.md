# StrataMesh LAB — Fog Node (macOS)

**v0.3.0** · destyle · lab · not mainnet

Product entry: [`../fog-node/README.md`](../fog-node/README.md).

Wizard `fog-bootstrap.py` · installer `FogNodeInstaller.command` · TUI `fog-tui.py` · Finder apps in `apps/`.

No secrets in this tree. Node id + 2FA + optional tokens live in `~/.config/stratamesh`.

```bash
python3 deploy/mac-fog/fog-bootstrap.py
```

Reference CMN (`FOG-NODE-PT-CM-001`) keeps LaunchAgent `pt.calhegasmorais.fog`, origin `macbook`, n=2. Any other registered id uses `lab.stratamesh.fog`, origin `local`, n=1 until it peers.
