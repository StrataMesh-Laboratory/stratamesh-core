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

## Manual node mw (:8791)

Prefer `~/StrataMesh/fog/bin/node-official` over Homebrew `node` on Intel (Cellar dyld / no bottle).

Always start with **absolute** paths from `$HOME` — never from `/tmp` or a Node tarball extract dir (broken multi-line pastes glue cwd + script into one `MODULE_NOT_FOUND` path).

```bash
cd "$HOME" && nohup "$HOME/StrataMesh/fog/bin/node-official" \
  "$HOME/StrataMesh/fog/repo/ops/middleware/fog_mw.js" \
  >>"$HOME/StrataMesh/fog/data/mw-node.log" 2>&1 &
curl -sf -m 2 http://127.0.0.1:8791/health
```

Runtime mesh already spawns the same absolute script under `FOG_SRC`/`~/StrataMesh/fog/repo`.