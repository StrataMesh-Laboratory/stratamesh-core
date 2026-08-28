# STOP-PROBES · INC-1027

The ~3 Hz lockstep walker is **not in this lab twin**. Local watchdog / heartbeat PIDs were stale. GraphQL: DeoMail `workers.dev` had **0 requests after 02:00 UTC** (11390 / 6717 / 1432 in hours 00–02). Custom-domain traffic after 03:00 UTC is ~340/h, not 3 Hz.

Fog named tunnel remains **530 / P1**. The host process cannot be SIGKILL'd from here.

## What was stopped

| Surface | Action |
|---|---|
| Grok automations ×4 | **Paused** (Watchdog, Discourse pulse, Night Diagnostic, Dev Cycle) — they listed live Worker URLs including DeoMail `workers.dev` |
| Local ops-watchdog `--loop` | Not running. `STASIS=1` + `state/STASIS`. `monitor-start` **refuses** |
| Local edge-heartbeat `--loop` | Stale pid, not running |
| `stratamesh-deomail` **workers.dev** | **disabled** (`enabled: false`). Zone WAF never covered this hostname |
| DeoMail custom host | `deomail.calhegasmorais.pt` → worker route, **5 req / 10s / IP / colo** |
| This board | Does not probe |

## Midnight refill (00:00 UTC)

If the Fog host loop comes back, it will still try `https://stratamesh-deomail.stratamesh.workers.dev/health`. That URL **no longer invokes the Worker**, so it cannot eat the 100k. Custom-domain lockstep is capped at 5/10s.

Do **not** hit live Worker URLs until refill + 30 min. No plan upgrade. Still 5/5 crons.

## Host (when tunnel is back)

`bin/kill-host-probe` — pkill the named walker only.

Mesh n=1 (Fog + Edge). `spa.source=lab_seed`. Challenge 0 unfunded. Fog 530 remains P1 underneath.
