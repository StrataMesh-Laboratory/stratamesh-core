# Mac Fog MariaDB ensure

Idempotent `fog-mariadb-ensure.sh` applies `fog_cmn.mariadb.sql`.

- Soft-fail if brew/mysql missing
- Never prints passwords
- Vault (0600): `FOG_MYSQL_URL`, `STAFF_GROK_PASSWORD` under `~/.config/stratamesh/` (or keys in `secrets.env`)

See `docs/FOG-HOST-FALLBACK.md` and `docs/FOG-MARIADB-ADAPTER.md`.

LaunchAgent: optional soft call from `fog-auto-update.sh` only — do not hard-require MariaDB in the Fog plist.
