# cPanel UAPI — Fog runtime

Hosting box (AMCM): `CPANEL_HOST` default `94.126.169.39` port **2083**.

Secret (never git):

```
# ~/.config/stratamesh/secrets.env  mode 600
CPANEL_TOKEN=...
CPANEL_USER=...
CPANEL_HOST=94.126.169.39
```

Worker binding on CF: `CPANEL_TOKEN` in `stratamesh-cpanel-proxy` (`/health`, `/sync` → Mysql/list_databases).

Fog probe (does not print the token):

```
python3 ops/bin/cpanel-fog-sync.py health
python3 ops/bin/cpanel-fog-sync.py list-db
```

Use when CF Workers are in 1027 stasis: mail/DNS/MySQL on the cPanel box stay up; Pages serves HTML; this API is the hosting hop, not a Worker.
