## 2026-08-30 — Individuated #mint/#0 lifecycle
- Each registered account is an on-graph subject: ACCOUNT open (not mint) → PoC #mint → PAYG #0 → hire TRADE.
- DAG replay restores wallets from cid (`mint:#mint->wallet|amt|kind`). Fog treasury is not a citizen.
- Auth `/lifecycle` + Token `GET /lifecycle?account=`. Dashboard shows minted/burned/events.

## 2026-08-30 — Registered-user PAYG subsistence
- Dashboard is **registered-only**. Anonymous get a login/register gate (no instantiated panel).
- Citizen wallets PAYG-burn STRATA to `#0` for resource actions (dashboard tick, orch, sandbox, VA, agora, NFT mint). Floor 0.1 → static NFTs only.
- Fog `NODE_WALLET` is not a citizen rail. Not a mint. Hire remains transfer.
- `src/subsistence/user_payg.py` + Auth `GET /subsistence` `POST /payg/tick`.

## 2026-08-30 — Fog keep-up plugins (ping × quality stream)
- `src/fog_plugins/{ping,keepup,rails}.py` on the Mac Fog runtime. GET `/ping` `/contribution/metrics` `/contribution/stream`. POST `/contribution/tick` loopback.
- Score = quantity × quality. Unready does not contribute. `#mint` / `#0` rails exist and stay unarmed (`oracle_live=false`). workers.dev refused.
- TUI shows keep-up Q/K/S. JSONL `$FOG_DATA/keepup.jsonl`.

## 2026-08-30 — Actions: origin-archive / gitlive-drift retries
- origin-archive: never PATCH a PAT-owned `archive-YYYY-MM-DD` (`GITHUB_TOKEN` cannot update). `gh release create` + view-exists = green.
- gitlive-drift: comment `continue-on-error`; check stays observe-only. Old SHA retries cannot pick up YAML — dispatch on main, do not rerun doomed commits.
- apply-and-merge: empty PR number is inspect-only, not a red X.

## 2026-08-30 — v0.4.1-lab Academy QIGA flux
- Academy grades are dual-lobe packets on the Orchestrator bus. Unready does not evolve. Federated summaries omit answers. `POST /v1/flux` + Fog `python3 -m academy --flux`. Optional `env.ACB` `/acb/qiga` tap. No workers.dev.

## 2026-08-30 — v0.4.0-lab ACB Academy
- Always-on academy at academy.calhegasmorais.pt. 19 formations (corrective + exploratory) for Orchestrator + AIOps. Ollama ← HF GGUF on Fog residual C_mesh. Grader fail-closed. STRATA cost declared, lab-waived. grok@ not a student. No Worker HF_TOKEN, no 6th cron, no workers.dev.

## 2026-08-30 — v0.3.1 iOS Edge
- `C_mesh=f(1-U)` + iPhone/iPad PWA (`/app`) + SwiftUI kit. Heartbeat on api-edge.

## 2026-08-30 — v0.3.0 Fog Node kit
- Generic Fog Node wizard/installer/TUI (StrataMesh LAB). No secrets in git. Optional GH/CF. New nodes n=1. CMN remains n=2.

## 2026-08-30 — Fog installer wizard
- macOS Fog Installer: node id → operator 2FA email → GitHub/CF hidden tokens → install → destyle TUI v8. Auth `/fog/bootstrap/challenge|verify`.

## 2026-08-30 — Fog Installer + .app
- `FogInstaller.app` / `FogStayAwake.app` / `FogRuntime.app` (ad-hoc sign). `install-apps.command` + `build-apps.sh`.

## 2026-08-30 — Mac stay-awake v7
- `FogStayAwake.command` + `pt.calhegasmorais.fog-awake` (`caffeinate -ims`, 2 min wake kick). Idle sleep held. Lid+battery still sleeps.

## 2026-08-30 — aiops destyle
- `aiops.calhegasmorais.pt/` destyle family. `/health` n=2 · mesh_member=true · f_max=0. Cycle JSON unchanged.

## 2026-08-30 — Grok automations
- Five Grok Automations re-prompted: n=2 destyle Mac origin, gossip host exists, 30min fallback, vault secrets (no tokens in prompt). Canonical: `ops/GROK-AUTOMATIONS.md`.

## 2026-08-30 — gossip destyle
- `gossip.calhegasmorais.pt/` same destyle family as Fog/EDGE. `/health` n=2 · mesh_member=true · f_max=0. Roster stays `/peers`.

## 2026-08-30 — fog destyle live + TUI v6
- CF Worker `stratamesh-node-public` exact `/` overlay on fog + edge (JSON `/health` `/status` stay tunnel).
- Mac TUI v6: `b` reboot, `g` git pull+reboot, host cpu/mem/rss/disk/net/sqlite/public probes.

## 2026-08-30 — fog destyle
- Fog `/` no longer brands EDGE-GROK on the Mac landing. Same destyle as EDGE (badge + node id + JSON links). Peer roster stays `/status`.

## 2026-08-30 — origin archive aligned
- `origin.calhegasmorais.pt` worker **0.1.5-aligned** with git `stratamesh-core` and R2 pile `2026-08-30`.
- Honesty: n=2 · mesh_member=true · f_max=0 · Mac primary · session 30-min fallback.
- Local live-workers copy refreshed off the same module. Pages hold no longer claims the origin hostname.

## 2026-08-30 — session origin fallback 30m
- Mac (`macbook-server`) stays primary public Fog. This Grok session is **standby**.
- If Mac is down **> 30 min**, `fog-persist` starts `stratamesh-fog-lab` and PATCHes CNAME `fog.calhegasmorais.pt` to that tunnel. Mac back → DNS flips back.
- Fast reclaim: Mac `origin-take.command` `POST /origin/reclaim` (HMAC of local tunnel token, not in git).
- GHA `origin-fallback` every 10 min observes only (`$0`). Does not flip DNS.
- Notes: [ORIGIN-FLUX.md](./ORIGIN-FLUX.md)

## 2026-08-30 — v0.2.3-dev
- Prerelease vs v0.2.3-lab. **n=2** Fog Mac (continuous) + EDGE-GROK (session). `mesh_member=true`. `f_max=0`. `oracle_live=false`.
- Notes: [RELEASE-v0.2.3-dev.md](./RELEASE-v0.2.3-dev.md)
- Fog git version `0.2.3-dev`. Hop `origin=macbook` via workerd. EDGE hop `origin=edge`.
- Gossip `2.3.9-n2-probe`. Not testnet. Not mainnet.

## 2026-08-29 — v0.2.3-lab
- Lab prerelease vs v0.2.2-lab. **Not major. Not testnet. Not mainnet.** Notes: [RELEASE-v0.2.3-lab.md](./RELEASE-v0.2.3-lab.md)
- Protocol: ingest-guard (#48); spa_view honesty; #16 gossip→real Fog; #36 on-graph metabolism (lab spend, not mint)
- Origin: orch chat 200 JSON 1.1.0 + 10.24.4 budget; gossip `2.3.5-host` at gossip.calhegasmorais.pt; origin public landing 0.1.1
- Fog git `node_persistent.py` version `0.2.3-lab` + `public_html()`. Live tunnel process may still be `0.2.3-lab-temp` until host restart
- P0 OPEN. n=1 mesh_member=false oracle_live=false. LAB only. No investment claims.

## 2026-08-29 — v0.2.3-lab-wip
- Process-gossip ingest guard (n=1 kernel). **Does not close multi-host P0.** Lab only. No investment claims.
- `POST /tx/ingest`: 400 `SYNTAX_ERRORS` on blank id / bad JSON / missing `tx_id`; 200 `accepted=false` on duplicate `tx_id` / second empty-parents root / bad type / unknown parents
- Named asserts on top of A1 (`src/test_p0_ingest.py`): duplicate INV no extra vertex; duplicate TX one state transition; malformed TX 400; second root / bad type `accepted=false`
- Honesty: one host / local processes; not grok90↔box, not mainnet, not aBFT. Gate remains [P0-INV-TX-MULTIHOST.md](./P0-INV-TX-MULTIHOST.md)

## 2026-08-29 — v0.2.2-lab
- Lab honesty/ops bundle. **Not mainnet.** P0 still open. LAB only. No investment claims.
- Metabolism v1.3 (#35): pace inflators/deflators on hourly cap (0.5–1.5); circuit still trips on unadjusted cap
- Tor operator onion (#37): lab Debian tor v3 onion + SOCKS5h for operator plane (optional `FOG_TOR_SOCKS`)
- Optional Fog MariaDB DSN (#38): exclusive-off `FOG_MYSQL_URL`; missing/fail keeps SQLite
- Explicitly not in this cut: #16 Worker gossip, #36 on-graph STRATA
- Honesty: Fog listen not required; python3 in-process tests already in CI

## 2026-08-27
- Resource-proof MVP: in-process `compute` class hash work-token (`src/resource_proof.py`) — challenge/receipt; reject bare claim and replay
- Honesty: in-process SHA-256 evidence is not a multi-host mint and does not credit STRATA
- CI: `protocol-invariants` runs `test_resource_proof.py` (python3 only; no Worker probes)

## 2026-08-26
- CI: `protocol-invariants` workflow runs in-process `test_tip_selection.py`, named WIRE I1–I6 checks, and `protocol_benchmark.py` (no Worker probes)
- Honesty: I1–I6 CI gates the miniature `LabLedger` harness, not `StrataTokenLedger` and not multi-host gossip
- CI: `process-gossip` — 3 OS processes, INV/TX `mesh_sync`, SIGTERM one node + SQLite restart catch-up (`src/test_process_gossip.py`)
- Honesty: one Actions runner / local processes; not multi-machine, not mainnet, not aBFT
- Oracle-free pack: org repo URL; ingest token removed from unit; preflight CI. Oracle VM still operator-gated.

## 2026-08-11
- SPA opt-out grace (lab clock) + pending in summary
- Dual-asset Agora settlement verified in integration test
- Temporary Grok-managed status pulse while Oracle recovery pending
