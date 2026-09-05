# Lab baseline (2026-09-05+) — Adversarial **P1** (not P0)

- **Priority class:** Adversarial **P1** — do **not** say the lab is on P0
- **Cut:** v0.6.0-lab (debug precursor v0.5.2-dev)
- **Fog:** FOG-NODE-PT-CM-001 — **n=2** when LIVE; GIT track origin/main
- **Metabol:** ALLOW / HOLD / STASIS = burn-rate **pace**, not freeze, not hops-down RCA
- **HOST 60% HOLD:** metabol circuit only — not CPU load-shed
- **Outage escalate (rare):** Fog process/tunnel actually down — still not a reason to call the lab “P0”
- **Not outages:** public /health quirks, EDGE 429/1015, mint/burn locked until oracle_live, empty vault (desk materializes), TUI cap 60%
- **André human gates only:** Fog g (when needed), 2FA, captcha, Oracle password/reset, Renovate majors
- **Vault:** desk cycle materializes `automation.desk.*` from KeePass; Bot only if escalated; never commit secret *values* to git
- **Tailscale:** trial bridge → taper to WG `10.88.0.0/24`; no paid seats; no exit-node on box; containers = Mac Docker + `tag:container`
- **No** workers.dev; grok.me Publish HOLD until origin bind
- **Do not** claim aBFT / grok90 two-host INV/TX as live

Grok Bot routines + grok.com Automations must say **P1**, not pretend P0.
