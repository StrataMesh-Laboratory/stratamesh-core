# StrataMesh LAB — Fog Node

**v0.3.0** · lab · prerelease · **not mainnet**

Instantiate the shared web3 metaverse OS on **your** hardware. This kit does not ship secrets. Operator identity is a **registered node id** plus a **2FA code** mailed to that operator. GitHub and Cloudflare tokens stay in `~/.config/stratamesh` (`0600`) on the machine that runs the wizard.

Motto: *Intelligentia · Vigilantia · Veritas*

## What you get

| Piece | Role |
|-------|------|
| **Wizard** | `deploy/mac-fog/fog-bootstrap.py` — node id → 2FA → optional GH/CF keys → install |
| **Installer** | `FogNodeInstaller.command` — Fog `:8787`, workerd `:8788`, stay-awake |
| **TUI** | destyle runtime · 15s · q/s/b/g/r |
| **Apps** | `deploy/mac-fog/apps/` Finder bundles (ad-hoc sign on the Mac) |

Public clone: [stratamesh-core](https://github.com/StrataMesh-Laboratory/stratamesh-core). Registry: `https://calhegasmorais.pt/api/auth` (reference node issues node ids).

## Economy (honest)

- Contribute **resources** on this Fog → **PoC** → STRATA minted at `#mint` (lab policy, not a public offer).
- Resource use burns toward `#0`.
- `f_max=0` until the mesh has n≥3 distinct hosts. A new node starts **n=1** `mesh_member=false` until it peers.
- The Calhegas Morais reference node is already n=2 (Fog Mac + EDGE session).

## macOS (first substrate)

```bash
git clone https://github.com/StrataMesh-Laboratory/stratamesh-core.git
cd stratamesh-core
python3 deploy/mac-fog/fog-bootstrap.py
```

Or double-click `deploy/mac-fog/apps/FogInstaller.app` after `bash deploy/mac-fog/build-apps.sh`.

You need:

1. A **node id** issued by the lab (Discourse / operator). Unknown ids 404.
2. The **6-digit 2FA** sent to the registered operator email.
3. Optional **GitHub PAT** if you will push. Public clone works without it.
4. Optional **Cloudflare API + named-tunnel token** if this Fog should be reachable on the public internet. Local-only is valid.

## Not in git

Tokens, tunnel JWTs, KeePass, PDFs, `.kdbx`. Never. Profile on disk: `~/.config/stratamesh/node.json` (ids and URLs only).

## Request a node id

Forum: [stratamesh.discourse.group](https://stratamesh.discourse.group) — ask in the lab for a `FOG-NODE-…` id bound to your operator email. Then run the wizard.

Linux container Fog (`:8080`) remains the session/standby path; this package is the **hardware node** path.
