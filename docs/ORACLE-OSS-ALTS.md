# Oracle Always Free — OSS / always-free substitutes (curated)

**Date:** 2026-09-05 · **Desk:** collegium brainstorm · **Status:** curated shortlist (none provisioned yet)

**Problem:** Oracle Always Free ARM VM (grok90) was the planned remote Fog peer for M-II / n≥2 INV/TX. Support/login stuck. Desk must **not** block on it.

**Already live (do not re-solve):** Mac Fog primary · MariaDB `fog_cmn` :3307 exclusive-off (`oracle_fallback`+`MDB_active`) · MW mesh :8787–:8792 · cloudflared · paced CF/Pages · EDGE pair.

**Hard rules:** `oracle_live=false` until real remote Fog · Mac+MDB ≠ second host · no workers.dev · no paid seats without André · metabol pace.

## Collegium signals (specialty amends)

| Specialty | Signal |
|-----------|--------|
| hermes | Home/lab peer (RPi/NUC) + Tailscale + cloudflared — honest n=2 |
| claw | GCP e2-micro / Azure B1s Always Free as VM substitute |
| code | Spin-down free PaaS unfit for Fog kernel |
| edge | MW hedges reduce urgency; do not flip oracle_live |
| fog | Box/Podman second Fog = same failure domain (Note) |

## TOP 5 (ranked for StrataMesh lab)

### 1 — Raspberry Pi / NUC home peer (Act candidate)
- **Replaces:** Oracle Always Free VM as distinct Fog host
- **Fit:** Always-on process + local SQLite/MariaDB; full Fog binary
- **MW integration:** Same hop map — tunnel routes `fog.`/`gossip.` → peer :8788; Tailscale SSH for desk ops; peer MW can join mutual fallback
- **Free:** Hardware one-time / spare; electricity; OSS stack
- **Risk:** Home IP/power; need UPS later
- **Prove-next:** Boot Fog on Pi/NUC, Tailscale join, INV/TX with Mac, record evidence pack
- **Eisenhower:** **Act** (when hardware available)

### 2 — GCP Always Free e2-micro (or equivalent)
- **Replaces:** Oracle ARM VM
- **Fit:** Long-lived Linux VM; systemd Fog + optional MariaDB
- **MW integration:** cloudflared connector on VM; Tailscale; gossip to Mac Fog
- **Free:** Always Free e2-micro (1/region limits); egress caps
- **Risk:** Performance small; ToS/region; signup gates
- **Prove-next:** Create free project → VM → Fog unit → tunnel
- **Eisenhower:** **Act** (signup may need André 2FA)

### 3 — Azure free B1s / free tier VM
- **Replaces:** Oracle VM (alternate hyperscaler)
- **Fit:** Same as GCP path
- **MW integration:** Identical tunnel+Tailscale pattern
- **Free:** 12‑mo / always-free SKUs vary — verify current offer before Act
- **Risk:** Credit expiry confusion; don't plan M-II on expiring credits alone
- **Eisenhower:** **Plan** until offer verified

### 4 — Fly.io Machines (only if always-on free allowance holds)
- **Replaces:** Light remote Fog peer (not full Oracle shape)
- **Fit:** Can run containerized Fog **if** machine stays up
- **MW integration:** Fly ↔ cloudflared or Tailscale; MW still on Mac
- **Free:** Allowance changes often — **prove uptime** before M-II claims
- **Risk:** Quota/sleep policy churn
- **Eisenhower:** **Plan** / probe

### 5 — MW-only hedges (already partly live) — reduce Oracle urgency
- **Replaces:** Not the Fog kernel — replaces *pressure* on Oracle for HTML/API/resolve/mail
- **Fit:** Deno Deploy Free (ALLOW fallback), paced CF Workers/KV, Pages HTML, local py/node/deno contingency
- **Does not:** enable `oracle_live` or M-II two-host INV/TX
- **Eisenhower:** **Note** / keep metabol — already operational

## Rejected / Note-only

| Option | Why |
|--------|-----|
| Render/Railway free spin-down | Cold start breaks gossip/INV |
| Second Fog only on box Podman | Same failure domain as desk Mac path |
| workers.dev | Forbidden |
| AWS free tier t2/t3 | André case 178795913400852 blocked — hedge later |
| Oracle Always Free | Remains **optional** rung — not blocker |

## Recommended next Act

**If spare Pi/NUC exists → Act #1 this week.** Else **Act #2 GCP e2-micro** (André only for signup 2FA/captcha). Keep Oracle weekly chase quiet/optional.

## Flags

`oracle_fallback=true` · `MDB_active=true` · `oracle_live=false` · M-II `hold_until=distinct_second_host`
