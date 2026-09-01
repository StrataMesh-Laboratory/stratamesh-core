# StrataMesh LAB — Fog Node (macOS)

**v0.5.1-lab** · lab · not mainnet · origin FOG-NODE-PT-CM-001

Instantiate the shared web3 metaverse OS on a Mac. This kit does not ship secrets. Operator identity is a registered node id plus 2FA. Tokens stay in ~/.config/stratamesh (0600).

Motto: *Intelligentia · Vigilantia · Veritas*

## What you get

| Piece | Role |
|-------|------|
| Wizard | deploy/mac-fog/fog-bootstrap.py |
| Installer | FogNodeInstaller.command — Fog :8787, workerd :8788 |
| TUI | destyle runtime · 60s · q/s/b/g/r |
| Middleware | Python :8790 · Node :8791 (auth/SPA fallback when CF Workers 1027) |

Release: https://github.com/StrataMesh-Laboratory/stratamesh-core/releases/tag/v0.5.1-lab

Public HTML is Pages. Do not point apex at workers.dev. Do not take Fog as public origin for the reference pair.

New Fog starts n=1, mesh_member=false, f_max=0. Reference pair stays n=2 until a third distinct host. oracle_live=false.
