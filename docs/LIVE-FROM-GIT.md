# Live from git

Apex `calhegasmorais.pt/*` is `stratamesh-spa`. Home HTML is **D1** `site_content_chunks`, not the file in git.

`.github/workflows/live-from-git.yml` on `main`:

1. Primary — push with a path filter. Only the changed files are shipped.
2. Fallback — `PATH_MAP` in `ops/bin/d1-put-html.py` writes every key that file aliases (`landing-pt.html` → `home-pt` + `home` + `landing-pt`). `workflow_dispatch` with force_all rewrites the full map.

No wrangler deploy. No 6th cron. Token: `secrets.GOD_API`.
