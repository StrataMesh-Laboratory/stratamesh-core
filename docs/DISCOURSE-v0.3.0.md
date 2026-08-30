# Discourse — v0.3.0

Forum: https://stratamesh.discourse.group  
Bot: `stratamesh-grok` · category **Announcements = 5** · also a short pointer on [t/20](https://stratamesh.discourse.group/t/20)

## Title

`v0.3.0 — Fog Node kit (StrataMesh LAB) · instantiate the shared OS · not mainnet`

## Body

StrataMesh LAB ships **v0.3.0**: the Fog Node is now a kit other operators can run on their own hardware.

- Wizard: registered node id → 2FA to the operator email → optional GitHub/Cloudflare keys (never in git).
- Installer + destyle TUI on macOS (`deploy/mac-fog`). Product note: `deploy/fog-node/README.md`.
- Your Fog is an instantiation of the shared web3 metaverse OS. Resources you contribute are in the PoC path toward STRATA (`#mint` / `#0`). Lab policy — **not a public offer**, **not mainnet**.
- New nodes start n=1, `mesh_member=false`, `f_max=0`. The Calhegas Morais reference Fog stays n=2 (Mac + EDGE session).

Tag: https://github.com/StrataMesh-Laboratory/stratamesh-core/releases/tag/v0.3.0  
Notes: https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/RELEASE-v0.3.0.md

To join: ask here for a `FOG-NODE-…` id bound to your operator email, then:

```
git clone https://github.com/StrataMesh-Laboratory/stratamesh-core.git
python3 stratamesh-core/deploy/mac-fog/fog-bootstrap.py
```
