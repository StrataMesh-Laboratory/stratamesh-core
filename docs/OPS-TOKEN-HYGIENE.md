# Cloudflare token hygiene (lab)

## Principle

Never put Global API Keys in git or browser bundles. Prefer **scoped API tokens** per job.

## Recommended tokens (create in Cloudflare dashboard → My Profile → API Tokens)

| Token name | Permissions (minimum) | Used by |
|------------|----------------------|---------|
| `lab-workers-deploy` | Account · Workers Scripts · Edit; Account · Account Settings · Read | Deploy `stratamesh-*` workers |
| `lab-d1-write` | Account · D1 · Edit | Portal/content lockstep |
| `lab-dns-zone` | Zone · DNS · Edit; Zone · Zone Settings · Edit (zone `calhegasmorais.pt`) | Routes, security, cache rules |
| `lab-status-read` | Zone · Analytics · Read; Account · Workers Scripts · Read | Monitoring only |

## Rotation cadence

1. After any token appears in chat, logs, or a shared sandbox — **rotate immediately**.
2. Lab operator: rotate Global API Key only from the CF dashboard; do not store the new key in the repo.
3. Session sandboxes: place write credentials only in ephemeral paths (e.g. `/tmp/god_api`) and delete after the session.

## PoC mint path (verified lab)

```bash
# 1) Measurement (GET)
curl -sS 'https://stratamesh-poc.stratamesh.workers.dev/measure?node_id=FOG-NODE-PT-CM-001'

# 2) Incremental mint from on-chain evidence (POST)
curl -sS -X POST 'https://stratamesh-poc.stratamesh.workers.dev/mint' \
  -H 'Content-Type: application/json' \
  -d '{"node_id":"FOG-NODE-PT-CM-001","contribution_type":"storage","from_onchain":true}'
```

Gate: measurement required · anti-double-claim via `poc_rewarded_units` · antifragile gate · Agora FX for STRATA pricing · graph settlement (DAG + IPFS pin + gossip).

Lab only — not mainnet economics.
