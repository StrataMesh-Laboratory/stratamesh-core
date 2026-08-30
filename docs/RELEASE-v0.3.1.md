# StrataMesh Core — v0.3.1

**Edge Node on iPhone/iPad** (StrataMesh LAB) · follows [v0.3.0 Fog kit](RELEASE-v0.3.0.md)

Lab. Not mainnet. Edges are **not Fogs**. Continuity = session (expected).

- Canonical `C_mesh = f(1−U)` in `src/edge_usage.py`
- PWA: https://api-edge.calhegasmorais.pt/app/ (Add to Home Screen)
- SwiftUI app: `deploy/ios-edge/StrataMeshEdge/`
- Heartbeat `POST /v1/edge/heartbeat` on api-edge (bootstrap bearer)
- Safety clamps: battery, Low Power, thermal, constrained path
