# Fog host fallback ladder (Oracle optional / non-blocking)

**Lab cut:** v0.6.0-lab · **n=2** Adversarial P1 · `oracle_live=false` until a **real remote Fog host** exists.
**Operator:** André Manuel Calhegas Morais · FOG-NODE-PT-CM-001
**Purpose:** Keep desk Acts moving when Oracle Free Tier tenancy **grok90** is stuck (login/reset/Support). Oracle is **never** a hard gate for Mac Fog, MariaDB offload, EDGE pair work, or M-II planning.

See also: [FOG-MARIADB-ADAPTER.md](./FOG-MARIADB-ADAPTER.md), [HYBRID-ORACLE-CF-TUNNEL.md](./HYBRID-ORACLE-CF-TUNNEL.md) (OPTIONAL), [P0-INV-TX-MULTIHOST.md](./P0-INV-TX-MULTIHOST.md), [EDGE-GROK-LOCAL.md](./EDGE-GROK-LOCAL.md).

---

## Priority ladder (bypass Oracle as hard gate)

| # | Layer | Role | Blocks desk? |
|---|--------|------|--------------|
| **1** | **Primary continuous Fog** | Mac Fog `:8787` + workerd + named CF tunnel — **current LIVE** | No — this *is* the lab |
| **2** | **MariaDB durable offload** | `FOG_MYSQL_URL` exclusive-off → local MariaDB `fog_cmn` (SQLite default; MariaDB when DSN OK) | No — process data resilience only; **not** a second mesh host claim |
| **3** | **Complementary session host** | EDGE-GROK `:8788` (same Mac/session) — already **n=2** pair | No — honest `same_host` until a distinct machine |
| **4** | **Box/sidecar MariaDB + phpMyAdmin** | Loopback-only operator offload / backup of DAG txs | No — ops surface, not Fog kernel |
| **5** | **AWS Always Free hedge** | Lambda/DDB **only if Free plan; never Paid** | No — compute contingency, **not** Fog kernel |
| **6** | **Raspberry Pi + SSD later** | Physical second-host path | No — documented; **do not buy now** |
| **7** | **Oracle Always Free + Tunnel** | Optional resume when account works | **Never** blocks desk Acts |

Honesty preserved:

- `oracle_live` stays **false** until a real remote Fog host is provisioned (Oracle VM, Pi, or AWS-shaped Fog peer — not MariaDB alone, not EDGE on the same Mac).
- M-II two-host INV/TX evidence needs a **distinct second host** (Mac+Pi or Mac+AWS-shaped peer when ready). **grok90 is not required for all progress.**
- MariaDB offload ≠ second host. Same-Mac EDGE ≠ distinct host. Do not claim mesh or `oracle_live=true` from ladder rungs 1–4.

---

## 1. Primary continuous Fog (LIVE)

- Process: Mac Fog `FOG-NODE-PT-CM-001` on `:8787`
- Edge front: workerd + named Cloudflare tunnel (existing Mac keepup)
- Cadence: LaunchAgent / `fog-auto-update.sh` (g/auto-g)
- Status: lab continuous path — desk progress does **not** wait on Oracle Support

## 2. MariaDB durable offload (exclusive-off)

- Env: `FOG_MYSQL_URL` (see [FOG-MARIADB-ADAPTER.md](./FOG-MARIADB-ADAPTER.md))
- DB: local `fog_cmn`, user `grok`, GRANT `fog_cmn.*` only
- Default: SQLite when unset/empty or connect fails — process must not crash
- Ensure script: `deploy/mac-fog/mariadb/fog-mariadb-ensure.sh` (idempotent schema from `fog_cmn.mariadb.sql`; soft-fail if brew/mysql missing; never prints passwords)
- Vault names only (0600 under `~/.config/stratamesh/` or `~/.config/stratagrok/`):
  - `FOG_MYSQL_URL`
  - `STAFF_GROK_PASSWORD`
  - optional `secrets.env` keys with the same names
- **Not** a mesh peer. **Not** M-II exit evidence by itself.

## 3. Complementary session host (n=2 P1)

- `EDGE-GROK-CMN-001` on `:8788` — same Mac or session as Fog
- Honest label: `same_host_as_edge_local=true` until a distinct machine
- Useful for session/pair drills; does **not** close P0/M-II multi-host INV/TX

## 4. Box/sidecar MariaDB + phpMyAdmin

- Loopback only (`127.0.0.1`) — never expose phpMyAdmin publicly
- Operator backup/inspect of DAG txs / staff/subsistence/gossip tables when MariaDB is up
- Complements rung 2; still not a second Fog host

## 5. AWS Always Free hedge

- Lambda / DynamoDB **only** on Always Free; **never** Paid / RDS / provisioned spend
- Compute contingency and hedge experiments — **not** Fog kernel replacement
- Must not burn paid quota; soft-fail when Free plan unavailable

## 6. Raspberry Pi + SSD (later)

- Physical distinct-host path for M-II INV/TX when ready
- Documented only — **no purchase now**
- When online: Mac Fog ↔ Pi Fog is a valid two-host evidence path (alongside or instead of Oracle)

## 7. Oracle Always Free + Tunnel (OPTIONAL)

- Tenancy grok90 / incident `260826-001576` — resume when login/Support works
- Playbook: [HYBRID-ORACLE-CF-TUNNEL.md](./HYBRID-ORACLE-CF-TUNNEL.md) (banner: OPTIONAL / non-blocking)
- `deploy/oracle-free/` units remain valid for that day
- Desk Acts, MariaDB path, Mac Fog continuous, and M-II **planning/prep** proceed without it

---

## M-II / P0 honesty map

| Claim | True when |
|-------|-----------|
| Lab n=2 P1 | Mac Fog + EDGE-GROK (may be same host) |
| M-II HOLD gate | **Distinct second host** missing — not “Oracle only” |
| `oracle_live=true` | Real remote Fog host provisioned and honest in `/status` |
| MariaDB up | Durable offload OK; still `oracle_live=false` if no remote Fog |
| grok90 required for all progress | **False** — see this ladder |

Desk projected: `proj-fog-host-fallback` (Act) · `proj-m2-twohost` (distinct host) · `proj-oracle-260826` / `ch-oracle-grok90` (optional chase).

---

## Ops quick commands

```bash
# Ensure fog_cmn schema (soft-fail; no password echo)
bash deploy/mac-fog/mariadb/fog-mariadb-ensure.sh

# Dry-run / unit (no live MariaDB required)
cd src && python3 -m unittest test_fog_db -v

# Desk Act (already open when seeded)
python3 ops/desk-collegium/desk_bus.py list | grep -E "fog-host-fallback|m2-twohost|oracle"
```

Document version: FOG-HOST-FALLBACK · 2026-09-05 · LAB · oracle_live=false

## Lifted Oracle HOLDs (2026-09-05)

With `oracle_fallback=true` and `MDB_active=true` (Mac MariaDB `fog_cmn` :3307):
- Desk `hold_until: oracle_grok90` **releases** (Fog host Acts unblocked).
- M-II stays `hold_until: distinct_second_host` (not MariaDB alone).
- `oracle_live` stays **false** (mint/STRATA economic).
- Oracle Support chase remains OPTIONAL Plan — not an Act blocker.
