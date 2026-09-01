# Tailnet — StrataMesh Laboratory

Console: stratamesh-laboratory.org.github  
MagicDNS suffix: **taild31dc1.ts.net**  
HTTPS certs: **on**. Regional routing: **on**. Split DNS: 1.1.1.1 / 1.0.0.1.  
Funnel: **off** (Fog is not public origin).

| hostname | MagicDNS | IPv4 | role |
|---|---|---|---|
| edge-grok-cmn-001 | edge-grok-cmn-001.taild31dc1.ts.net | 100.102.244.34 | EDGE hop |
| mbpv | mbpv.taild31dc1.ts.net | 100.108.35.26 | Fog Mac |
| iphone-14 | iphone-14.taild31dc1.ts.net | 100.127.166.6 | Edge phone |

Tags in ACL: `tag:fog` `tag:edge` `tag:gha` (owners: autogroup:admin).

GHA: secret `TS_AUTHKEY` (org auth key, prefer tag:gha). Workflow `fog-tailnet-health.yml` hits Fog ports on 100.108.35.26.
