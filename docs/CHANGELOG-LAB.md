## 2026-09-05 — Fog host fallback ladder (Oracle optional)
- **`docs/FOG-HOST-FALLBACK.md`:** priority ladder bypasses Oracle as hard gate — Mac Fog LIVE → MariaDB exclusive-off → EDGE `:8788` → sidecar/phpMyAdmin → AWS Free hedge → Pi later → Oracle optional.
- Docs: HYBRID banner OPTIONAL/non-blocking; FOG-MARIADB-ADAPTER Mac brew/Docker + vault env names; FOG-DESK-OPS / P0 / ROADMAP M-II = **distinct second host**, not Oracle-only.
- Ops: `deploy/mac-fog/mariadb/fog-mariadb-ensure.sh` idempotent schema ensure (soft-fail; no password echo).
- Desk: `dt-act-fog-host-fallback` Act; M-II/Oracle chase revised optional. `oracle_live=false` honesty preserved.
- LAB only. n=2 P1. No workers.dev. No mainnet/aBFT.

## 2026-09-05 — v0.6.0-lab (Fog desk collegium · packaged lab cut)
- **Current lab cut `v0.6.0-lab`.** Spans **since v0.5.1-lab** (includes what **v0.5.2-dev** stabilized). 0.5.2 was not a tagged cut until the debug tag.
- Desk collegium full stack: bus verbs, autonomy cycle, surfaces/journals/reports (GH+Discourse), metabol enforce, DESK feed explainability, TUI DESK geometry, `automation.desk@` mail shared+per-agent, Tailscale taper T0–T4, academy teach/apprenticeship, role packs, projected Eisenhower catalog, ship-majority, connectors soft-fail, metrics/last-cycle.
- fog-tui / kits / protocol.json / projected.json / FOG-DESK-* current → **v0.6.0-lab**.
- LAB only. n=2 P1. Oracle/M-II HOLD. No workers.dev. No mainnet/aBFT. Discourse announce via browser (no Admin API key on Free plan).

## 2026-09-05 — v0.5.2-dev (debug cut · desk collegium)
- **Tag `v0.5.2-dev`** — debugged Fog automation-desk / collegium stack on green HEAD. Not the packaged lab milestone (that is v0.6.0-lab).
- **Note:** no prior tagged 0.5.2 existed; André’s “since 0.5.2” maps to this debug cut. Delta since **v0.5.1-lab** is the desk/collegium mid-stack through `11a317a` (interim SHAs include `7fb13d3`, `c7bff9a`, `94f0c87`, `24fe7cc`, `ecd6217`…).
- Bus full verbs · autonomy + auto-ship · surfaces/journals/reports · metabol enforce · DESK feed + TUI geometry · `automation.desk@` mail · Tailscale taper T0–T4 · academy teach/apprenticeship.
- LAB only. n=2 P1. Oracle/M-II HOLD. No workers.dev. No mainnet/aBFT.

## 2026-09-02 — Honesty: v0.5.1-lab Adversarial P1 n=2
- Current live/lab cut is **v0.5.1-lab**. README and other *current* surfaces that still said 0.4.1 / 0.4.0 were stale. Historical changelog rows for v0.4.0-lab / v0.4.1-lab below are unchanged (those tags happened).
- Mesh is **n=2** (Mac Fog `FOG-NODE-PT-CM-001` + EDGE-GROK local `EDGE-GROK-CMN-001`). Do not narrate n=1 kernel as today’s lab.
- Phase name is **Adversarial LAB P1**. grok90 two-host INV/TX evidence pack remains a later bar.
- Public `fog.calhegasmorais.pt/health` may still JSON `n=1` `origin=session` `mac_live=false` — session-origin software flag, not lab n=1. Do not claim `mac_live=true` on that JSON.
- STASIS is **pace**, not freeze. Freeze = temporary holding until contingency (auth python hop, Pages, sandbox host).
- LAB only. No mainnet / aBFT / investment. No workers.dev, no 6th cron, no Worker PUT, no grok.me Publish.

## 2026-08-31 — Orchestrator /chat replies (10.24.9-chat-reply)
- RCA: POST `/api/orchestrator/chat` never called `chat()`. It always ran `labInstantChat` → academy `POST /v1/debug/chat`, which returns the identity package (“Orquestrador não ecoa… Pedido: «…» — não é a resposta”). That is echo, not a reply. Previous “não ecoa” trials left this as the only handler.
- Structural fix: user-facing `/chat` calls `chat()`. Grounded intents (Olá, identity, PdS, lobes, …) answer immediately (`grounded-fast`). Academy debugger only on `?debug` / `body.debug`.
- Guard `isIdentityPulse` rejects the identity package if it reappears. `LOBE_STATE_KEY` defined. origin-orch-chat **1.1.1**.
- Academy `/v1/debug/chat` stays a debugger. HOLD spa. Never Fog origin. Never workers.dev. No 6th cron.

## 2026-08-30 — Origin archive aligned to HEAD
- origin.calhegasmorais.pt Worker **0.1.7-align** + git `workers/stratamesh-origin-archive.js` + R2 pile `2026-08-30` + GitHub `archive-2026-08-30` all report git `aa1a27e00ed7`.
- Live mesh on the origin card: token 3.5.5-fog-honest · agora 3.3.1-gold-spot · status 0.4.8-circ-split. Hourly #52 paused.
- Never Fog origin. Never workers.dev. No 6th cron. HOLD spa.

## 2026-08-30 — Fog wallet un-aliased + Wiener Philharmoniker gold spot
- **Névoa STRATA ~1 000 014** was FOG-NODE-PT-CM-001 (~14.42) **plus** leftover genesis on account `treasury` (1 000 000). The Nó did not mint that million. Token 3.5.5-fog-honest no longer merges `treasury` into Fog. Display = origin L-STRATA + PdC on FOG-NODE only.
- **Ágora Wiener Philharmoniker** L-STRATA is no longer a frozen €4 080/oz. Formula: `(spot EUR/oz × fraction) / 0.10`. Spot from Swissquote XAU/EUR mid (fallback gold-api USD × Frankfurter). EUR lots stay 1 L-STRATA = €0.10.
- Dashboard Ágora caption now shows live €/oz and L-STRATA (not a static “spot EUR / 0.10” line).
- Never Fog origin. Never workers.dev. No 6th cron. HOLD spa PUT.

## 2026-08-30 — Login 1101 (SPA origin-orch-chat-1.1.2-login)
- Dashboard / login (calhegasmorais.pt/dashboard) returned Cloudflare Error 1101: Worker threw exception (Ray a336d88329da94ad).
- RCA: heraldic ICON_EMBED referenced `iconR2Map` on every GET but never defined → ReferenceError before the login gate.
- Fix: define `iconR2Map`, hoist ICON_EMBED to module scope, try/catch around fetch so login cannot 1101.
- Operator PUT of stratamesh-spa to restore Entrar. Never Fog origin. Never workers.dev. No 6th cron.

## 2026-08-30 — Honest STRATA circulation (token 3.5.4-circ-split, status 0.4.8-circ-split)
- The ~2.6M headline was **not** PoC STRATA and **not** L-STRATA. It was `SUM(token_balances)` excluding `#mint`/`#0` (unclassified genesis/test rows, including ~1e6 on the Fog treasury wallet).
- **L-STRATA** (lab_only / `lab_bootstrap`+`lab_grant`) and **PdC STRATA** (`poc_contribution`, sole protocol mint) are distinct versions. Status HTML now shows two cards, not one "Circulação".
- `circulating_supply` / `total_supply` = origin-ledger classified sum only. Raw D1 SUM is `ledger_balance_sum` with `statistics_note` — not a circulation statistic. Ledger rows not purged.
- Status health_fallback no longer maps `health.total_supply` onto circulating. Guard rejects a 2.6M-shaped SUM. Cache key `pulse-048-circ`. HOLD spa. Never Fog origin. Never workers.dev. No 6th cron.

## 2026-08-30 — Heraldic icons transparent (Casa de Morais + Spencer-Morais)
- Replaced muddy parchment-backed photo-icons with drawn heater shields on a clear ground.
- Casa de Morais: gules, tower argent, waves azure/argent. Favicon 32/48/192/512 + svg + ico.
- Spencer-Morais vault 1.1.1: matrimonial (casal) and dynastic/house (quarteado) as separate transparent icons.
- SPA serves embed first (does not rely on Fog R2). Never workers.dev. Never Fog origin.

## 2026-08-30 — GNU board compact (0.4.6-destyle)
- Phone GNU was a full-viewport overlay: close bar sat under Safari chrome, sticks hid, look/tap froze.
- GNU is now a small control board under the title chip. Close is 44px and visible. No autofocus on coarse (no keyboard freeze). World keeps moving.
- tty 5.5rem on phone, last 5 lines. Destyle tokens kept. Never Fog origin. Never workers.dev.

## 2026-08-30 — sandbox orbit + tap + stick Y (0.4.5-destyle)
- **Orbit** presence: drag / right stick / pinch-wheel around the avatar. C / Orbit toggle. V inhabit.
- **Tap floor to walk**, **tap object to act** (walk-then-tool). CRT tap opens GNU. Door tap uses exit.
- Move stick **up/down inverted** so push-up walks forward of look (left/right unchanged). Look via canvas drag + right stick.
- Workbench: desk+CRT, window fill, rug, beams, door frame, shelves. Street lanterns + windows. Agora columns + stalls.
- Destyle tokens kept. 3D CRT phosphor 0x2f9e8a. Never Fog origin. Never workers.dev. One Worker PUT.

## 2026-08-30 — sandbox phone HUD (0.4.4-destyle)
- Phone no longer stacks desktop chrome on the analog sticks (identity chip + 1–5 + WASD prompt + GNU/Atlas overlapped walk/look).
- Compact title · Menu sheet · Use / hold-to-cycle tool / GNU dock. Sticks sit in the corners above the home indicator.
- iOS sticks track pointerId (not `buttons`). No pointer-lock on coarse pointer. Destyle tokens unchanged. 3D CRT phosphor stays 0x2f9e8a.
- Never Fog origin. Never workers.dev. One Worker PUT (`stratamesh-sandbox-host`).

## 2026-08-30 — sandbox destyle HTML chrome (0.4.3-destyle)
- GNU atelier HUD accent is destyle alias `--teal:#c4a574` / `--acc:#c4a574` (was phosphor `#2f9e8a` on HTML chrome). 3D CRT phosphor stays in-world.
- Version **0.4.3-destyle**. Never workers.dev. Never Fog origin.

## 2026-08-30 — sandbox.calhegasmorais.pt full-page GNU atelier
- Public Holon 5 UGC host: **https://sandbox.calhegasmorais.pt/** is the full-page GNU atelier (WASD/look, dual sticks, GNU desk) — not a portal iframe, not workers.dev.
- Worker `stratamesh-sandbox-host` serves HTML for `/` and `/:owner/:id` virtual addresses. JSON at `/health`. Apex `/api/v1/sandbox*` stays `stratamesh-sandbox`.
- Source: `frontend/sandbox.html`. Never Fog origin.

## 2026-08-30 — Unix atelier is the 3D NFT workbench
- EN dashboard uses English terminology and acronyms: PoC (Proof of Contribution), PoS (Proof of Subsistence), SCA (Synthetic Computational Agent), SPA (Service Pact Agreement), DAO, CLP (Planetary Lunisolar Calendar), L-STRATA, UGC, IoT.
- Atelier is the cel-shaded Unix NFT lot (not a homepage iframe, not a voxel room). Dual sticks: walk + look. Drag-to-look in first person, same as orbit. Compose tools: manipulate, freeze, duplicate, remove, rotate. Free placement.

## 2026-08-30 — Dashboard solidifying and expansion
- **2FA trust 1h restored.** Password + trusted window (`login_trust` +1 hour) issues a session; 2FA still required when the window has lapsed. SPA gate accepts `trusted_2fa` tokens instead of treating them as failure.
- **Tesouraria autoload.** `#panel-wallet` is `.active` on first paint; desk overlay loads `/api/auth/me` so L-STRATA appears without a second click.
- **Ágora lab book.** Operator listings replace stub placeholders: EUR 1/2/5/10/20/50/100/200/500 and Wiener Philharmoniker gold 1, 1/2, 1/4, 1/10, 1/25 oz. Peg: 1 L-STRATA = €0.10 mesh-service-unit; 1 oz = €4,080 = 40,800 L-STRATA. Seller FOG-NODE-PT-CM-001 / AMCM ENI. Non-transitioning.
- **L-STRATA ≠ PoC STRATA.** `users.lab_balance` (lab grant, PAYG, does not transit) vs `token_balance` (PoC #mint). One-shot reset: every registered account **50 L-STRATA** (ACB same as user); staff **500**. New accounts receive the same grant. PAYG burns L-STRATA to `#0`.
- **Atelier Unix.** Sandbox default is the `/painel` Unix NFT workbench (iframe). Legacy 3D room is a toggle, not booted on load. `window.isScaUser` / `window.isStaffUser` — Safari `Can't find variable: isScaUser` closed.
- **Tempo (CLP).** Widget loads: sunset variable no longer shadows the `set()` helper; `/clp` iframe + solar times for Lisboa.
- **Câmaras / Pactos / Limiar / Identidade** expanded (motions, compact parties/trigger, edge function register, L-STRATA identity). Nav renamed: Tesouraria, Ágora, Malha, Atelier, Câmaras, Pactos, Agentes, Limiar, Saúde, Orquestrador, Tempo, Identidade, Delegado (EN: Treasury, Agora, Mesh, Atelier, Chambers, Compacts, Agents, Edge, Health, Orchestrator, Time, Identity, Delegate).

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
