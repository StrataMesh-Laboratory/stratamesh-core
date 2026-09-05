# Lab baseline (2026-09-05+) — use this, not old P0/n=1/HOLD assumptions

- **Cut:** v0.6.0-lab (debug precursor v0.5.2-dev)
- **Fog:** FOG-NODE-PT-CM-001 — **n=2** when LIVE; GIT track origin/main
- **Metabol:** ALLOW / HOLD / STASIS = burn-rate **pace**, not freeze, not hops-down RCA
- **HOST 60% HOLD:** metabol circuit only — not CPU load-shed
- **True P0:** Fog process/tunnel actually down
- **Not P0:** public /health quirks, EDGE 429/1015, mint/burn locked until oracle_live, empty vault (desk materializes), TUI cap 60%
- **André human gates only:** Fog g (when needed), 2FA, captcha, Oracle password/reset, Renovate majors
- **Vault:** desk cycle materializes `automation.desk.*` from KeePass; Bot only if escalated; never commit secret *values* to git
- **Tailscale:** trial bridge → taper to WG `10.88.0.0/24`; no paid seats; no exit-node on box; containers = Mac Docker + `tag:container` (`567dc4e`)
- **No** workers.dev; grok.me Publish HOLD until origin bind
- **Do not** claim aBFT / grok90 two-host INV/TX as live

Grok Bot routines already updated to this baseline. grok.com Automations should match when UI is reachable.
