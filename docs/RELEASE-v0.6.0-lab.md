# v0.6.0-lab

**Current lab cut (2026-09-05 PT).** Adversarial LAB **P1**. Mesh **n=2** (`FOG-NODE-PT-CM-001` + `EDGE-GROK-CMN-001`). Packaged Fog automation-desk / collegium milestone.

**Tag:** `v0.6.0-lab` · **Baseline:** [v0.5.1-lab](./RELEASE-v0.5.1-lab.md) · **Debug precursor:** [v0.5.2-dev](./RELEASE-v0.5.2-dev.md)

Lab only. **Not mainnet.** No aBFT claims. `oracle_live=false`. Oracle / M-II **HOLD**. No workers.dev. No secrets in git.

## Versioning note

- **v0.5.1-lab** — last published lab cut before this milestone.
- **v0.5.2-dev** — debug tag on the green desk/collegium stack (stabilized mid-stack). **0.5.2 was not a tagged cut until that debug tag**; André’s “since 0.5.2” maps to work since **v0.5.1-lab**, stabilized as v0.5.2-dev.
- **v0.6.0-lab** — this packaged lab pre-release. Changelog below spans **v0.5.1-lab → v0.6.0-lab** (includes what v0.5.2-dev stabilized).

Interim SHAs (non-exhaustive): `7fb13d3`, `c7bff9a`, `94f0c87`, `24fe7cc`, `ecd6217`, `11a317a`, plus release bumps `a404cff` (0.5.2-dev) → this tag.

## What’s changed since v0.5.1-lab

### Desk collegium — full stack

- **Operational bus** (`ops/desk-collegium/desk_bus.py`) with full collegium verbs: propose → constrain → act | audit | amend | revise → vote (call+cast) | refer | dispute → commit | escalate → done | drop. Propose is not the only move; specialty owner still owns commit/done on their core.
- **Enforceable protocol** (`protocol.json` + `desk_protocol.py`): specialization, bus, metabol_pace, Eisenhower, anti-vapour, anti-idle, human_gates, ship_majority, no_sca, secrets, cadence, g_ping, academy_teach, apprenticeship, agent_autonomy, bot_cap_contingency.
- **Projected Eisenhower catalog** (`projected.json` + idempotent `ensure_projected_catalog`): Act ordinal; Plan/Note parked; Tailscale taper clock (TRIAL_ENDS_PT / T3).
- **Agent role packs** (`agent_roles.json` + per-agent VAULT.md templates): Hermes / OpenCode / OpenClaw / Fog+EDGE Assistants / STRATAGROK specialties.
- **Autonomy loop** (`desk_ops.py cycle` on TUI `r`/60s): metabol → ensure_desk_surfaces → roles_ok → projected → self_audit → pick ALLOW → handler → auto-ship if majority+metrics → academy_teach → `/desk` push. Bot = escalate surface, not routine prompter.
- **Ship-live majority** (`desk_ship.py`): mark / vote / ship with soft connectors.
- **Connectors + issues** (`desk_connectors.py`, `desk_issues.py`): gh PATH soft-fail; strict labels only (no vapour).
- **Sync** (`desk_sync.py`): Bearer vault `desk-mail.token`; pull/push `/desk` snapshot; token-check never prints secrets.

### Metabol, feed, TUI

- **Metabol enforce** (`desk_metabol.py`): per-agent pace lanes; HOLD/STASIS = pace not freeze; lane-bot HOLD never freezes Hermes/OpenCode/OpenClaw/Assistants (bot_cap_contingency).
- **DESK feed explainability** (`desk_feed.py` + Fog TUI panel): `HH:MM:SS agent verb compact-tech-payload`; paragraph wrap; chat mirror.
- **TUI DESK geometry** — live feed under instrument; score after cycle; DESK log layout (`fog-tui.py` banner **v0.6.0-lab**).

### Surfaces, journals, reports

- **ensure-surfaces** — TODO / CONTEXT / journals / reports on cycle (`desk_reports.py`).
- **Reports** — GitHub + Discourse draft paths; soft-ok if gh/discourse unavailable.
- **Metrics** — `desk_metrics.py score`; `desk-metrics.jsonl` / `last-cycle.jsonl`; target ≥ 70.

### Mail + Tailscale taper + academy

- **`automation.desk@` collegium mail** — shared Maildir client + per-agent paths; IMAP/SMTP vaulted under `~/.config/stratagrok/` (0600); aerc/snappymail templates.
- **Tailscale taper T0–T4** — docs + projected items for WG `10.88.0.0/24`, OpenVPN, Tor, named-tunnel substitutes; no paid seats; trial end 2026-09-16 PT.
- **Academy teach / apprenticeship** — desk agents mentor SCA/ACB via live Fog/Actions/collegium/Atelier work; never enroll as students.

### Docs landed with the stack

`docs/FOG-DESK-{COLLEGIUM,SPECIALIZATION,AUTONOMY,PROTOCOL,OPS,FEED,AGENTS}.md` · `ops/desk-collegium/README.md` · `SECRETS-VAULT.md` · `DESK-MAIL-AUTOMATION.md`.

## Hold / not in this cut

- Oracle grok90 chase (**HOLD**) · M-II (**HOLD**)
- Mainnet / aBFT / investment / MiCA public offer
- workers.dev · 6th Cloudflare cron · Worker PUT as Fog origin
- Paid Tailscale seats · converting trial → paid
- Discourse Admin API announce (Free plan = browser/session path)

## Channels

git tag `v0.6.0-lab` · GitHub prerelease · Discourse draft [`DISCOURSE-v0.6.0-lab.md`](./DISCOURSE-v0.6.0-lab.md) · ops pulse [t/20](https://stratamesh.discourse.group/t/20) (Bot routine update separately)
