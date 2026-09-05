# Oracle Always Free — OSS / always-free substitutes (curated)

**Date:** 2026-09-05 (PT) · **Task:** `dt-brainstorm-oracle-oss-alt` · **Status:** curated shortlist (**none provisioned**)
**Desk:** collegium propose + specialty amends (hermes/claw/code/edge/fog)

**Problem:** Oracle Always Free ARM VM (grok90) was the planned remote Fog peer for M-II / n≥2 INV/TX. Support/login stuck. Desk must **not** block on it.

**Already live (do not re-solve):** Mac Fog primary · MariaDB `fog_cmn` :3307 exclusive-off (`oracle_fallback`+`MDB_active`) · MW mesh Fog `:8787` / workerd `:8788` / py `:8790` / node `:8791` / deno `:8792` · cloudflared named tunnel · paced CF Workers/KV/Pages · Deno Deploy Free ALLOW fallback · Tailscale desk SSH.

**Hard rules:** `oracle_live=false` until a real remote Fog host exists · Mac+MDB is durable offload **not** a second mesh host · M-II needs a **DISTINCT** second machine/process peer · no workers.dev · no secrets in git/chat · no paid seats without André · metabol pace · **do not invent that any alternative is already provisioned**.

## Collegium signals (specialty amends)

| Specialty | Signal |
|-----------|--------|
| hermes | Home/lab peer (RPi/NUC/old mini) + Tailscale + cloudflared — cheapest honest n=2 |
| claw | GCP Always Free e2-micro as VM substitute; Azure B1s is **12-mo only** (not perpetual) |
| code | Spin-down PaaS (Render free / Railway sleep) unfit for Fog kernel/SQLite |
| edge | MW hedges (Deno Deploy Free, paced CF/Pages) reduce Oracle urgency; do **not** flip `oracle_live` |
| fog | Box/Podman second Fog = same failure domain as desk (Note only); Fly free gone for new accts |

## TOP 5 (ranked for StrataMesh lab)

### 1 — Home/lab peer: RPi / NUC / old Intel Mac mini + Tailscale + cloudflared
- **Role replaced:** Oracle Always Free VM as **distinct Fog host** (n≥2 peer)
- **Why it fits Fog:** Always-on process + local SQLite (or exclusive-off MariaDB); full Fog binary; true distinct `host_id`
- **MW / tunnel / Tailscale:** Same hop map — peer joins Tailscale; cloudflared can point `fog.`/`gossip.` → peer `:8788` or keep origin on Mac and peer as gossip-only; desk SSH via Tailscale (no default-route/exit-node required on box)
- **Free limits:** Spare hardware / one-time buy (André gate); electricity + home uplink only; OSS stack
- **Risks:** Power/ISP; sleep if laptop; SD wear on Pi (prefer SSD); home NAT
- **Prove-next:** Inventory spare always-on device → Tailscale join → Fog unit → Mac↔peer INV/TX evidence pack (still `oracle_live=false`)
- **Eisenhower:** **Act** (this week if spare hardware exists)

### 2 — GCP Always Free `e2-micro` (best perpetual free cloud VM)
- **Role replaced:** Oracle ARM Always Free **VM** shape
- **Why it fits Fog:** Long-lived Linux guest; systemd Fog + SQLite (avoid heavy MariaDB/workerd co-locate on 1 GB RAM)
- **MW / tunnel / Tailscale:** Install Fog on VM → Tailscale and/or cloudflared connector → gossip with Mac Fog; MW contingency stays on Mac `:8790–:8792`
- **Free limits (Always Free):** 1× `e2-micro` hours/mo in **us-west1 | us-central1 | us-east1** only; **30 GB standard** PD (not Balanced/SSD); **~1 GB** NA egress/mo; shared CPU / 1 GB RAM
- **Risks:** Wrong region or SSD disk → surprise bill; OOM if stack bloated; signup 2FA/captcha (André); KYC
- **Prove-next:** Free project → e2-micro Ubuntu (standard PD) → Fog only → Tailscale/tunnel → Mac sees distinct `/status`
- **Eisenhower:** **Act** (André only for signup 2FA/captcha — no paid seats)

### 3 — Coolify / CapRover / Dokku (or k3s/k0s single-node) **on** a free VM
- **Role replaced:** Oracle **ops surface** (deploy/restart/logs) while the VM underneath replaces the Fog host
- **Why it fits Fog:** OSS control plane to run long-lived Fog container/process + optional SQLite volume; not a Fog kernel itself
- **MW / tunnel / Tailscale:** Control plane private on Tailscale; Fog still exposes `:8787/:8788`; cloudflared unchanged pattern
- **Free limits:** Same as host VM (GCP e2-micro is the honest always-free base); Coolify/CapRover/Dokku/k3s are OSS — RAM tight on e2-micro (prefer Dokku-lite or bare systemd first)
- **Risks:** Control plane RAM tax on 1 GB; k3s heavier than needed for single Fog; complexity vs bare unit file
- **Prove-next:** After #2 VM exists — try Dokku **or** bare systemd first; k3s only if multi-workload justified
- **Eisenhower:** **Plan** (depends on #1/#2 host existing)

### 4 — Azure 12-mo free B-series VM (B1s / B2pts v2 / B2ats v2) — honesty: **not Always Free**
- **Role replaced:** Alternate hyperscaler VM (Oracle substitute for ~12 months only)
- **Why it fits Fog:** Same long-lived Linux + Fog unit pattern as GCP
- **MW / tunnel / Tailscale:** Identical Tailscale + cloudflared pattern
- **Free limits:** New-account **12-month** free amounts (e.g. ~750 h/mo B-series); **not** perpetual Always Free for VMs — always-free Azure SKUs are other services
- **Risks:** Quiet conversion to PAYG after 12 mo; multi-VM hour burn; deallocation vs stop billing traps
- **Prove-next:** Verify André has eligible new free entitlement → else skip; never base M-II solely on expiring credits
- **Eisenhower:** **Plan** / Note unless entitlement confirmed

### 5 — MW-only hedges (already partly live) — reduce Oracle **urgency**, not the Fog kernel
- **Role replaced:** Pressure on Oracle for HTML/API/resolve/mail — **not** the Fog kernel / M-II peer
- **Why it fits Fog:** Complementary to Fog; keeps metabol while second host is hunted
- **MW / tunnel / Tailscale:** Deno Deploy Free (ALLOW fallback), paced CF Workers/KV, Pages HTML, local py/node/deno mutual fallback — already on tunnel map
- **Free limits:** Provider free/paced quotas (metabol); no Fog always-on claim
- **Risks:** Over-claiming "second host"; do not set `oracle_live=true`
- **Prove-next:** Keep metabol green; document that MW hedges ≠ M-II close
- **Eisenhower:** **Note** / keep metabol — already operational

## Creative angles covered (curation notes)

| Angle | Verdict |
|-------|---------|
| Home/lab hardware + Tailscale + cloudflared | **TOP1 Act** |
| Hyperscaler always-free VMs (GCP e2-micro) | **TOP2 Act** |
| Azure B1s "free" | **Plan** — 12-mo only, not perpetual |
| AWS free tier | **Note/hold** — André case blocked; hedge later |
| Fly.io Machines | **Drop for new accounts (2026)** — free allowance legacy-only; trial ≠ always-on Fog; paid needs André |
| Railway trial / Render free | **Reject for Fog kernel** — sleep/cold-start breaks gossip/INV |
| Coolify/CapRover/Dokku / k3s/k0s | **Plan on top of free VM** (TOP3) |
| Complementary MW hedges | **TOP5 Note** — do not replace Fog kernel |
| Second Fog on box container + Mac | **Note honesty** — same failure domain; ≠ distinct host |
| Oracle Always Free | **Optional rung** — not blocker |

## Rejected / Note-only

| Option | Why |
|--------|-----|
| Render free / Railway sleep | Cold start unfit for Fog kernel |
| Fly.io new-account "free" | 2026: no perpetual free Machines for new orgs — trial/pay-as-you-go |
| Second Fog only on box Podman | Same failure domain as Mac desk path |
| workers.dev as Fog kernel | Forbidden |
| AWS EC2 free tier | Case-blocked for André; not always-free after 12 mo |
| Mac MariaDB / EDGE same-host | Offload / pair — not M-II distinct peer |
| Paid VPS/seats | André human_gate only |

## Recommended next Act (this week, no André paid spend)

1. **If spare Pi/NUC/mini exists → Act TOP1** (Tailscale + Fog + INV/TX evidence).
2. **Else Act TOP2 GCP e2-micro** — André only for free-tier signup 2FA/captcha (no paid seats). Stay in Always Free shape (region + standard PD).
3. Oracle Support chase stays **quiet optional Plan** — not an Act blocker.

## Flags / honesty

`oracle_fallback=true` · `MDB_active=true` · `oracle_live=false` · M-II `hold_until=distinct_second_host` · **no remote Fog host provisioned by this doc**

## Projected seeds

- `proj-host-rpi-nuc-peer` — Act · `hold_until=distinct_second_host` · `oracle_fallback=true`
- `proj-host-gcp-e2-micro` — Act · `hold_until=distinct_second_host` · `oracle_fallback=true`
- `proj-host-fly-probe` — **Note/drop** (2026: not always-free for new accounts)
