# Hermes homelab inventory (Mac-authored)

**Source:** Mac `$FOG_HOME/data/desk-outbox/hermes-homelab-inventory.md`  
**Act:** `dt-proj-homelab-second-host`  
**When:** 2026-09-06 · lab P1 · `oracle_live=false`

## This machine (not a spare peer)

| Field | Value |
|-------|--------|
| Hardware | **MacBookPro15,2** |
| RAM | **8 GB** |
| CPU | **Intel** |
| Fog node | `FOG-NODE-PT-CM-001` |
| Role | Primary continuous Fog (ladder #1) |

This host is the lab Fog. It is **not** the second host.

## Spare peer

**TBD.** No distinct RPi / NUC / always-on mini observed. Do not buy from this Act.

## Rehearsal

`ops/bin/fog-peer-rehearsal.sh` default **`:8887`** is a **same-Mac dialect**.  
Mac + `:8887` **≠ M-II**. See `docs/FOG-PEER-PROVE.md`.

## Also not M-II

- workerd `n=2` / EDGE-GROK-CMN-001 on the same story
- MariaDB `fog_cmn` offload
- workers.dev

## Hold

`proj-m2-twohost` stays `hold_until=distinct_second_host` until a peer `NODE_ID` ≠ `FOG-NODE-PT-CM-001` answers `/health` on its own data dir (Tailscale or named tunnel).
