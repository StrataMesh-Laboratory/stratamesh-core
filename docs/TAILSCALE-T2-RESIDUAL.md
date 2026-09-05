# Tailscale T2 residual PLAN

**Status:** T2 drain shipped `38e8ffc` (2026-09-05 PT). Task `dt-proj-ts-taper-t2`.

## Done
- Scripts/connectors/workflows: hardcoded `100.x` defaults → MagicDNS (`*.taild31dc1.ts.net`).
- Files: ensure-desk-vault, desk_reports, minio-up, install-desk-ssh, SSH.md, DESK.md,
  hermes configs (+ `tailscale_magicdns`), contingency.json, fog-tailnet-health,
  edge-uptime, ops/deno README, TAILSCALE-FOG T2 note.

## Residual (intentional until T3)
- `docs/TAILSCALE-FOG.md` inventory table still lists IPv4 (documentation only).
- Hermes `tailscale_ipv4` fields retained beside MagicDNS (legacy reference).
- SSH.md / DESK.md mention IPv4 as legacy next to MagicDNS.

## Next (T3 hold)
- `proj-ts-taper-t3` — do not start early; trial ends PT 2026-09-16; T3 from 2026-09-14.
- Prefer MagicDNS in all new code; no new `100.x` hardcodes.

oracle_live=false. No secrets in git.

## Tooling bootstrap (desk offline during Act)

When `mbpv` is back:

```bash
cd /Users/andremorais/StrataMesh/fog/repo && git pull --ff-only
bash deploy/mac-fog/desk-tooling-ensure.sh
# marks: wrangler-ready.json / gcp-cli-missing.json|gcp-cli-status.json / ts-taper-t2-done.json
python3 ops/desk-collegium/desk_ops.py done dt-proj-ts-taper-t2 || true
```

Sibling owns `wrangler deploy stratamesh-edge-api 1.5.0-wizard` — do not duplicate.
