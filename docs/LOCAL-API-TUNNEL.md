# Local HTTPS/HTTP API + public tunnel

Expose a **real**  from a contributor or EDGE-GROK local process so the outside world (and fog gossip) can reach it.

## Layout ( or copy into )

| Script | Role |
|--------|------|
|  | API on  —     |
|  | Start API at nice 19 |
|  | Stop API + tunnel |
|  | Cloudflare **quick tunnel** → public  |
|  | Optional self-signed () for local HTTPS |

## Quick start



## Endpoints

-  — identity JSON (, , , )
-  — probes fog + gossip + edge desk
- 
-  — log body + echo identity

## Public URL (this lab session)

> Quick tunnels are **ephemeral**. Restart ⇒ new hostname.

- Base (example at publish time): 
- Health: 

Named stable hostnames need a Cloudflare **named tunnel** + DNS (not quick tunnel).

## On-graph (Prompt C)

1. Public  returns 200 with your .
2. Open issue/PR on  with the URL for gossip  health-check.
3. Until fog lists you:  still correct for local state.

## Env



Policy: same spare-capacity (nice 19) as heartbeat.
