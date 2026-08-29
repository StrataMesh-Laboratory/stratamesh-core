# Fog MariaDB DSN adapter (LAB, exclusive-off)

Optional local MariaDB offload for **FOG-NODE-PT-CM-001** (`n=1`).
Not a mesh. `oracle_live=false`. Not workers.dev, D1, KV, R2, RDS, or a paid DB.

Operator: André Manuel Calhegas Morais. Fog substrate — desk review before merge.

## Exclusive-off

| `FOG_MYSQL_URL` | Behaviour |
|---|---|
| unset / empty | Today's SQLite path, identical. PersistentDAG stays `transactions` + `meta` only. |
| set, connect OK | Use `fog_cmn` on loopback MariaDB (user `grok`, GRANT `fog_cmn.*` only). |
| set, connect fails | SQLite fallback. Do not crash. |

`GET /health` must **not** import `src/fog_db.py` and must **not** connect MariaDB.
Keep `Handler.do_GET` `/health` as `{"ok": true}`.

`GET /status` must **not** auto-build liboqs. This adapter never imports `pq_keys`.

Wiring into `PersistentFogNode` is optional and out of this PR. Missing env = no behaviour change.

## DSN

```
FOG_MYSQL_URL=mysql://grok@127.0.0.1:3306/fog_cmn
```

Password is **not** stored in the URL file. `STAFF_GROK_PASSWORD` from the vault
(`~/.config/stratagrok/secrets.env`) is used when the DSN has no password.
Never echo the password. `storage_status()` redacts it.

SQLite fallback path: `FOG_SQLITE_PATH` or `/tmp/stratamesh-fog.db`
(lab node default). Local desk also uses `/home/box/stratamesh-edge/data/fog.db`.

## 1:1 mapping (in-process → `fog_cmn`)

Upstream `src/persistent_dag.py` SQLite is only:

- `transactions` — `tx_id, tx_type, parents, weight, cumulative_weight, timestamp, cid, sender`
- `meta` — `key, value`

Staff, subsistence, and gossip are in-process today (`PersistentFogNode`,
`AUTH-STAFF-2FA`, `subsistence/*`, `gossip.GossipNode`). MariaDB tables match those objects, not Worker/D1 snapshots:

| In-process | `fog_cmn` table |
|---|---|
| `PersistentDAG.txs` / `_persist_tx` | `transactions` |
| `PersistentDAG` genesis meta | `meta` |
| staff table (`email, role, clearance, …`) | `staff` |
| lab 2FA (`staff_otp`) | `staff_otp` |
| `AgentAccount` | `subsistence_accounts` |
| `ResourceMeter` + `ResourceVector` | `subsistence_meters` |
| `LedgerEntry` | `subsistence_log` |
| `GossipNode.pending` | `gossip_pending` |
| gossip `encode()` messages | `gossip_messages` |

SQL: [`fog_cmn.mariadb.sql`](../fog_cmn.mariadb.sql) (also applied by `fog_db.apply_mariadb_schema`). Apply as `grok` against `fog_cmn`. Do not `CREATE DATABASE` / `GRANT` in this file.

Local sidecar snapshot tables (`gossip_snapshot`, `subsistence_snapshot`, `staff_identities`) may already exist on the desk MariaDB. This adapter does not drop them.

## Apply locally

```bash
set -a
# shellcheck disable=SC1091
source /home/box/.config/stratagrok/secrets.env
set +a
MYSQL_PWD="$STAFF_GROK_PASSWORD" mysql -h 127.0.0.1 -P 3306 -u grok fog_cmn < fog_cmn.mariadb.sql
```

phpMyAdmin (localhost only): `https://localhost/phpmyadmin/`

## Tests (no network)

```bash
# from a checkout that has src/fog_db.py
unset FOG_MYSQL_URL
python3 -c "import fog_db; s=fog_db.open_store('/tmp/fog-dsn-test.db'); assert s.backend=='sqlite'; assert fog_db.health_payload()=={'ok': True}; s.close()"

FOG_MYSQL_URL='mysql://grok@127.0.0.1:1/fog_cmn' python3 -c "import fog_db; s=fog_db.open_store('/tmp/fog-dsn-test.db'); assert s.backend=='sqlite'; assert s.mysql_fallback; assert fog_db.health_payload()=={'ok': True}; s.close()"
```

Bogus host / closed port → SQLite fallback, process does not crash.

## Honesty

- Lab single host (`FOG-NODE-PT-CM-001`). `n=1`.
- `oracle_live=false`, `mesh_member=false`.
- Not a Cloudflare Worker job. Do not point this adapter at workers.dev.
- `grok` is not MySQL root and is not SCA.
