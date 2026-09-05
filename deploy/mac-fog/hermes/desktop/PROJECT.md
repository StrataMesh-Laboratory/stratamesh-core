# Project FOG-CMN-DESK

| Field | Value |
|-------|-------|
| Mandate | Fog automation desk (native Hermes desktop) |
| Hermes role | external_agent — coord + academy_teach |
| Peers | OpenCode, OpenClaw (external_agent) |
| Lead | STRATAGROK (Grok Bot) — meters/git/escalate; Bot desktop not shared |
| Shared desk machine | Hermes desktop on Mac `mbpv` via SSH `hermes-desk` ([SSH.md](./SSH.md)) |
| Fog health | http://127.0.0.1:8787/health |
| Academy | https://academy.calhegasmorais.pt |
| Ollama | http://127.0.0.1:11434 |
| OpenClaw | ws://127.0.0.1:18789 (when running) |
| Git | StrataMesh-Laboratory/stratamesh-core |
| Desk CLI | ops/desk-collegium/* |
| Actions | desk_actions.py + workflows desk-collegium/tick/prepare |
| Outbox | $FOG_HOME/data/desk-outbox/ |

**Native desk env:** [DESK.md](./DESK.md)  
Do not create SCA accounts for desk agents. Students = SCA/ACB only.
