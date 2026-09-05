# v0.5.1-lab

> **Superseded as current** by **v0.5.2-dev** (debug) then **v0.6.0-lab** (lab cut); historical cut unchanged.


**Historical lab cut (2026-09-02).** Adversarial LAB **P1**. Mesh **n=2** (`FOG-NODE-PT-CM-001` + `EDGE-GROK-CMN-001`). Not 0.4.1. Public `/health` n=1 origin=session mac_live=false is a session-origin software flag, not lab n=1.

Pre-release after v0.5.0-lab. Same kits (Fog macOS / Edge iOS), plus:

- Auth fallback standard: Python :8790 (anti-405 / Worker cap)
- stratamesh-auth STASIS=1 short-circuit after 737k auth spike
- Contingency + hop weights + CF↔Deno mutual primary/secondary
- Deno 2.9 in-repo (`ops/deno`, `deno task api`) via Fog/Tailscale :8792
- Static maintenance last layer
- Complements: Caddy, workerd, MinIO planned; Deno SaaS signup blocked

Channels: git tag `v0.5.1-lab` · Pages HEAD · Discourse post still via browser (id.discourse.com).
