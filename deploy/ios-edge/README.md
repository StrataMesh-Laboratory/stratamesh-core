# StrataMesh LAB — Edge Node (iPhone / iPad)

**v0.3.1** · lab · not mainnet · **not a Fog**

An Edge has a primary job (this phone, this iPad). It offers only residual capacity:

**C_mesh = f(1−U)**

- U ↑ ⇒ C_mesh ↓
- Battery < 20%, Low Power Mode, thermal serious/critical, constrained network → **C_mesh = 0**
- Foreground duty 1.0 · background duty 0.25 (session expected)
- Indexed to a parent Fog. Not ownership. Not a miner.

Formula (shared with Python): [`src/edge_usage.py`](../../src/edge_usage.py) · `GET https://api-edge.calhegasmorais.pt/v1/edge/usage`

## Ship now (PWA — Add to Home Screen)

On the iPhone/iPad: open

**https://api-edge.calhegasmorais.pt/app/**

Share → **Add to Home Screen**. Standalone LAB destyle. Node id + 2FA, then live C_mesh gauge. Heartbeats while the app is visible.

## Native (Xcode)

`StrataMeshEdge/` is a SwiftUI app: real `UIDevice.batteryLevel`, `ProcessInfo.thermalState`, `isLowPowerModeEnabled`. Open the folder in Xcode 15+, team-sign, Run on device. Background is residual on purpose (Edge continuity = session).

Wizard uses the same lab registry as Fog: `POST /api/auth/fog/bootstrap/challenge|verify`. Ask Discourse for an `EDGE-NODE-…` id bound to the operator email. No secrets in git.

Heartbeat: `POST https://api-edge.calhegasmorais.pt/v1/edge/heartbeat` with the bootstrap bearer.
