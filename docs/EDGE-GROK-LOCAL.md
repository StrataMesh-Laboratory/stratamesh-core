# EDGE-GROK local grounding (background, spare capacity)

This local process **is** `EDGE-GROK-CMN-001` in the live lab mesh (**n=2** with Mac Fog `FOG-NODE-PT-CM-001`). Adversarial LAB **P1**, cut **v0.5.1-lab**. Public `fog.calhegasmorais.pt/health` may still JSON `n=1` `origin=session` `mac_live=false` (session-origin flag — not lab n=1).


Local executables under the Grok session filesystem ground `EDGE-GROK-CMN-001` without contending with primary work.

## Policy

| Limit | Value |
|-------|-------|
| CPU nice | 19 (lowest) |
| ionice | class 3 idle |
| Heartbeat | every 300s |
| HTTP timeout | 5s |
| Max work per beat | 20s |
| Interference with primary | **none** (idle priority only) |

Public always-on edge remains the CF Worker: https://edge.calhegasmorais.pt/

Local process only: soft probes to edge/fog/gossip and state under `state/last_heartbeat.json`.

## Commands (from session)

```bash
bash edge-grok/bin/edge-start
bash edge-grok/bin/edge-status
bash edge-grok/bin/edge-stop
python3 edge-grok/bin/edge-heartbeat   # one-shot
```

See also [EDGE-GROK-NODE.md](./EDGE-GROK-NODE.md).
