# StrataMesh LAB — Fog Node (macOS)

**v0.5.1-lab** · destyle · lab · not mainnet · CMN **n=2** (new ids start n=1 until they peer)

Product entry: [`../fog-node/README.md`](../fog-node/README.md).

Wizard `fog-bootstrap.py` · installer `FogNodeInstaller.command` · TUI `fog-tui.py` · Finder apps in `apps/`.

TUI: `?` opens an in-window Ollama troubleshooting pane (local `:11434`, observe-only if down). `C` clears that chat (not `r`, not the 60s redraw). First paint / `r` is local hops only (`127.0.0.1`, 0.3s); public fog/edge lamps use a background cache.

No secrets in this tree. Node id + 2FA + optional tokens live in `~/.config/stratamesh`.

```bash
python3 deploy/mac-fog/fog-bootstrap.py
```

Reference CMN (`FOG-NODE-PT-CM-001`) keeps LaunchAgent `pt.calhegasmorais.fog`, origin `macbook`, n=2. Any other registered id uses `lab.stratamesh.fog`, origin `local`, n=1 until it peers.
