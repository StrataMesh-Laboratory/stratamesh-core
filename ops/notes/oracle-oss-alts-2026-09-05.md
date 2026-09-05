# Oracle Always Free substitutes — OSS / always-free shortlist

**Date:** 2026-09-05 (PT) · **Task:** `dt-brainstorm-oracle-oss-alt` · **By:** desk collegium (stratagrok lead + specialty amends)
**Honesty:** `oracle_live=false`. **No remote Fog host is live.** Mac+MDB ≠ second host. M-II needs a **distinct** second host.
**MW already operational (do not re-home):** Fog `:8787`, workerd `:8788`, py `:8790`, node `:8791`, deno `:8792`, CF paced, Pages.
**Ladder context:** Mac Fog primary → MariaDB `:3307` exclusive-off → EDGE pair → box → AWS Free hedge (case-blocked) → RPi later → Oracle optional.

## Problem frame

Oracle Free (grok90 / Support) is stuck. Desk must not idle on Support. Need creative **second-host / remote Fog peer** paths that are OSS-friendly and always-free (or zero-new-spend), integrating as a **Fog kernel peer** beside the Mac MW stack — not replacing MW.

## Specialty peer notes (amend votes)

| Specialty | Stance |
|-----------|--------|
| **lead (stratagrok)** | Prefer prove paths that yield a distinct `host_id` for M-II INV/TX; keep Oracle as optional rung 7. |
| **coord (hermes)** | Pace metabol; seed projected Plan/Act only; no fake `oracle_live`. Document next prove steps in outbox. |
| **code (opencode)** | Fog peer = same `node_persistent` + SQLite (or exclusive-off MySQL) process; tunnel/Tailscale only — never workers.dev. |
| **claw (openclaw)** | Ops prove = SSH + `/health` + Tailscale ping from Mac; soft-fail scripts; never commit secrets. |
| **fog (fog-assistant)** | Mac continuous Fog stays primary; remote is complementary peer; keepup/LaunchAgent stay Mac-local. |
| **edge (edge-assistant)** | EDGE `:8788` remains same-host pair; does **not** close M-II. Remote Fog ≠ EDGE session. |

## Curated options

### A — Google Cloud Always Free `e2-micro` (closest cloud VM substitute)

| Field | Note |
|-------|------|
| **Replaces** | Oracle Always Free **VM** role (always-on Linux guest for Fog process) |
| **MW path** | Install Fog on e2-micro → CF named tunnel **or** Tailscale → peer Mac Fog over mesh/gossip; MW stays on Mac |
| **Always-free limits** | 1× e2-micro / month in us-west1 \| us-central1 \| us-east1; ~30 GB standard PD; tight egress; shared CPU; **1 GB RAM** |
| **Fog fit** | Marginal but plausible for lean Fog+SQLite; avoid MariaDB on-box; no heavy workerd co-locate |
| **Tailscale/tunnel** | Tailscale subnet/exit optional; prefer CF tunnel (already paced on Mac playbook) |
| **Risk** | US-region only free; OOM if stack bloated; billing footguns if leaving Always Free shape; account KYC |
| **Next prove** | Create GCP project under Always Free → e2-micro Ubuntu → install Fog only → Tailscale/CF → Mac sees distinct host `/status` with `oracle_live` still false until honest remote Fog flag policy |

### B — Homelab distinct host (old laptop / mini / Android Termux / spare NUC) + Tailscale

| Field | Note |
|-------|------|
| **Replaces** | Oracle **physical presence** of a second machine (distinct host_id) without cloud Support |
| **MW path** | Run Fog binary/python on spare device; Tailscale to Mac desk; CF tunnel optional if public edge needed |
| **Always-free limits** | Electricity + home uplink only; no cloud free-tier politics |
| **Fog fit** | Excellent for always-on SQLite Fog if device sleeps disabled; true M-II candidate |
| **Tailscale/tunnel** | Tailscale first-class; matches existing WG/TS taper work |
| **Risk** | Power/ISP outages; NAT; device must stay awake; Termux is experimental for long-run Fog |
| **Next prove** | Inventory spare always-on device → Tailscale ACL → Fog listen → INV/TX drill Mac↔spare |

### C — Raspberry Pi + SSD (documented later; no buy now)

| Field | Note |
|-------|------|
| **Replaces** | Oracle as **durable physical second host** (best long-term M-II path) |
| **MW path** | Pi Fog ↔ Mac Fog over Tailscale/LAN; MW remains Mac |
| **Always-free limits** | Hardware cost (André gate to purchase); then zero cloud bill |
| **Fog fit** | Strong — ARM Linux, SQLite, low power always-on |
| **Tailscale/tunnel** | Native; optional CF tunnel |
| **Risk** | Purchase timing; SD wear (prefer SSD); not available today |
| **Next prove** | Keep Plan only until André authorizes buy; no spend from desk |

### D — Fly.io / Koyeb-class free allowance (container peer) — **Plan / caution**

| Field | Note |
|-------|------|
| **Replaces** | Oracle **process hosting** (not full VM parity) |
| **MW path** | Containerize Fog kernel only; private networking + Tailscale relay if offered; **no** workers.dev |
| **Always-free limits** | Free allowances change; machines may suspend; not “Ampere-shaped” |
| **Fog fit** | Weak for always-on honesty unless paid always-on — may violate metabol/always-on |
| **Risk** | Sleep policies fake “peer”; ToS/credit card; easy to accident-bill |
| **Next prove** | Only if A/B blocked; spike cold-start vs always-on; André ack before any card |

### E — Oracle Always Free (optional resume) — **keep Plan, not blocking**

| Field | Note |
|-------|------|
| **Replaces** | Itself (Ampere/x86 Always Free) when Support/login works |
| **Status** | Optional rung 7 · `proj-oracle-260826` eisenhower=plan |
| **Honesty** | Still not live; do not gate desk Acts |

### Explicit non-options (this Act)

- **workers.dev / CF Workers as Fog kernel** — forbidden; MW/Pages already cover edge
- **Mac MariaDB `:3307` / box MariaDB** — durable offload only, **not** a host
- **EDGE `:8788` same Mac** — n=2 pair, **not** distinct second host for M-II
- **AWS EC2 12‑month free** — not always-free; Lambda/DDB hedge stays case-blocked compute contingency
- **Paid VPS/seats** — André human_gate only

## Top recommendation (curated)

1. **Act-ready prove:** **A — GCP e2-micro Always Free** (cloud VM substitute) **or** **B — spare homelab device + Tailscale** (best zero-cloud M-II if hardware exists).
2. **Plan:** **C — RPi+SSD** when André authorizes purchase.
3. **Park / optional:** D (container free tiers), E (Oracle Support).

**Do not claim any remote host live.** Success of this Act = shortlist + projected seeds + feed amends.

## Projected seeds (desk)

- `proj-gcp-e2micro-fog` — Plan/Act spike (hold until account ready; still `distinct_second_host` for M-II exit)
- `proj-homelab-second-host` — Act inventory+Tailscale prove if spare device exists
- `proj-m2-twohost` — remains Plan with `hold_until=distinct_second_host`

