# Origin flux — Mac primary, session fallback (30 min)

Public `fog.calhegasmorais.pt` is a **CNAME** to one named tunnel at a time.

| Role | Tunnel | Host | Continuity |
|------|--------|------|------------|
| **primary** | `macbook-server` | Mac `:8788` → `:8787` | LaunchAgent KeepAlive |
| **standby / fallback** | `stratamesh-fog-lab` | this Grok session `:8788` → `:8787` | persist daemon; dies with the container |

`macbook-server` also carries `aiops`, `cpanel`, apex `/api/v1`. Session **never** takes that token.

## Take (Mac down > 30 min)

Session `fog-persist` (15s tick):

1. Local fog + workerd stay warm (`public=false`, no fog-lab connector).
2. Mac alive = public `/health` `origin=macbook` **or** CF `macbook-server` tunnel `status=healthy`.
3. First miss starts `mac_down_since`.
4. After **1800s** and local hop healthy: start fog-lab connector + **PATCH DNS** CNAME `fog` → `stratamesh-fog-lab`.
5. CF API miss does **not** count as Mac down (no false take).

## Yield (Mac back)

Automatic: `macbook-server` healthy again → persist flips CNAME back and drops fog-lab connector.

Fast path: Mac `origin-take.command` `POST /origin/reclaim` (HMAC of the fog-lab tunnel token, not in git). Persist honors on next tick (≤15s).

## Operator

```
python3 ops/bin/fog-persist.py --status
python3 ops/bin/fog-persist.py --daemon          # standby
python3 ops/bin/fog-persist.py --fallback-now    # skip 30 min
python3 ops/bin/fog-persist.py --yield-public    # force DNS back to Mac
```

`FOG_FALLBACK_AFTER` (seconds, min 60) overrides the 30-minute clock. Default 1800.

Lab n=1 / n=2 honesty unchanged. Session fallback is **not** a second mesh host_id while Mac is up; it is the same Fog node id on a different connector.
