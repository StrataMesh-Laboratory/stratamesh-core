# Mac Fog MariaDB ensure

Idempotent `fog-mariadb-ensure.sh` applies `fog_cmn.mariadb.sql`.

- Soft-fail if brew/mysql missing
- Never prints passwords
- Vault (0600): `FOG_MYSQL_URL`, `STAFF_GROK_PASSWORD` under `~/.config/stratamesh/` (or keys in `secrets.env`)

See `docs/FOG-HOST-FALLBACK.md` and `docs/FOG-MARIADB-ADAPTER.md`.

LaunchAgent: optional soft call from `fog-auto-update.sh` only — do not hard-require MariaDB in the Fog plist.

LaunchAgent entrypoint `deploy/mac-fog/fog-node-run.sh` sources `~/.config/stratamesh/load-fog-mysql.sh` so `FOG_MYSQL_URL` is present for exclusive-off probes. DAG kernel stays SQLite until PersistentDAG wires fog_db.
