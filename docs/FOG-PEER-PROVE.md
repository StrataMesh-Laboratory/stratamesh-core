# Fog peer prove checklist (M-II / distinct host)

Use after `deploy/gcp-free` or `deploy/homelab-peer` is up.  
`ops/bin/fog-peer-rehearsal.sh` is **dialect only** — same machine does not satisfy this list.

## Preconditions

- [ ] Peer `NODE_ID` ≠ Mac `FOG-NODE-PT-CM-001`
- [ ] Peer has its own SQLite (or MariaDB) data dir
- [ ] Reachable from Mac over **Tailscale** (preferred) or named tunnel
- [ ] **No** public `:8787`
- [ ] `oracle_live` still **false** until step 6

## Prove

1. `curl http://<peer>:8787/health` → `ok`, unique `node_id`, version `0.6.0-lab`+
2. `curl http://127.0.0.1:8787/health` on Mac still ok
3. Tailscale ping Mac ↔ peer
4. INV/TX or gossip exchange per `docs/P0-INV-TX-MULTIHOST.md` (record timestamps + node ids)
5. Kill peer Fog, confirm Mac still serves; restart peer, catch-up observed
6. Only then consider flipping lab flag `oracle_live` / remote Fog provision — desk vote

## Honesty

| Setup | Counts as M-II distinct host? |
|-------|-------------------------------|
| Mac + workerd n=2 | No |
| Mac + MariaDB | No |
| Mac + rehearsal :8887 | No |
| Mac + GCP e2-micro Fog | **Yes** |
| Mac + RPi/NUC Fog | **Yes** |
