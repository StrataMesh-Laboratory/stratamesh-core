# v0.5.2-dev

**Debug cut (2026-09-05 PT).** Debugged Fog automation-desk / collegium stack on green HEAD. Adversarial LAB **P1**. Mesh **n=2** (`FOG-NODE-PT-CM-001` + `EDGE-GROK-CMN-001`). Not a packaged lab milestone — that is **v0.6.0-lab**.

**Tag:** `v0.5.2-dev` · **Baseline:** [v0.5.1-lab](./RELEASE-v0.5.1-lab.md)  
Lab only. **Not mainnet.** No aBFT claims. `oracle_live=false`. Oracle / M-II **HOLD**. No workers.dev. No secrets in git.

## Why this cut exists

André asked for changelog “since 0.5.2”. There was **no tagged 0.5.2** until this cut. Mid-stack desk/collegium work after v0.5.1-lab (through `11a317a` and follow-ups) is the debug surface: bus verbs, autonomy, surfaces, journals, reports, metabol enforce, feed explainability, TUI DESK geometry, `automation.desk@` mail, Tailscale taper T0–T4, academy teach/apprenticeship.

This tag freezes that **debugged** stack so v0.6.0-lab can package it as the lab pre-release. Interim SHAs (non-exhaustive): `7fb13d3`, `c7bff9a`, `94f0c87`, `24fe7cc`, `ecd6217`, `11a317a`.

## Stabilized in this debug cut

- **Collegium bus** — full verb set: propose → constrain → act|audit|amend|revise → vote|refer|dispute → commit|escalate → done|drop (`desk_bus.py`, protocol laws).
- **Autonomy + anti-vapour** — `desk_ops.py cycle`, agent role packs, auto-ship majority, bot_cap_contingency, no idle-skip self-loop.
- **Surfaces** — journals, reports (GH + Discourse drafts), TODO/CONTEXT, ensure-surfaces on cycle.
- **Metabol enforce** — per-agent `metabol_pace` lanes; HOLD/STASIS = pace not freeze.
- **Feed explainability** — DESK panel lines `HH:MM:SS agent verb payload`; TUI DESK log geometry.
- **Mail** — `automation.desk@` shared + per-agent Maildir (IMAP/SMTP vaulted).
- **Tailscale taper** — T0–T4 clock + WG/OpenVPN/Tor/named-tunnel substitutes (no paid seats).
- **Academy** — teach / apprenticeship mentors; desk agents never enroll as SCA students.
- **Connectors / metrics** — gh PATH soft-fail, score CLI, last-cycle.jsonl.

## Not claimed

- Packaged lab cut (see **v0.6.0-lab**)
- Mainnet / aBFT / investment
- workers.dev / 6th cron / Worker PUT
- Oracle grok90 chase complete (HOLD)
- M-II (HOLD until Oracle)

## Channels

git tag `v0.5.2-dev` · GitHub prerelease · Discourse announce deferred to **v0.6.0-lab**
