# v0.5.1-lab hops

Mac Fog auto-g + hop skip (2026-09-02 PT).

- **Auto-update** `pt.calhegasmorais.fog-auto-update` every 1800s: only if `:8788/health` is up, `HEAD != origin/main`, and `~/.config/stratamesh/last-manual-g` is missing or older than 1800s. Then `git fetch` + `reset --hard origin/main`, copy TUI + FogRuntime.command + `ops/workerd/{worker.js,config.capnp}` (ORIGIN rewrite, also `/tmp/sm-core/ops/workerd` if present), `launchctl kickstart` **fog + workerd only**. Never tunnel, never cloudflared, never brew upgrade (`brew update` only).
- TUI **g** stamps `last-manual-g` and `sync_workerd_config()` before reboot. CSI home redraw already on main.
- Installer always `cp -f` worker.js; banner **v0.5.1-lab**.
- workerd hop: skip dead hops 8s, 400ms abort, `MW_DENO` `:8792`, local metabol talk (`HOPMESH`; STASIS paces). Plugin `FOG_SRC` defaults to repo; `mesh_member` from `FOG_MESH_N`; copies `worker.js` into config dir on start.

No extra CF cron. No spa catch-all. No workers.dev. No origin-take.
