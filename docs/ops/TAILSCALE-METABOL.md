# Tailscale metabol_pace (stratamesh-laboratory)

**IdP:** GitHub org `stratamesh-laboratory` → business-style tailnet (not personal Gmail/GitHub-user).

## What renews / what does not
| Pool | Renews? | Notes |
| --- | --- | --- |
| **14-day business trial** | **No auto-renew** | After trial: pick Standard/Premium/Enterprise **or** lose trial features / must choose a plan. Extension = sales, not automatic. |
| **Personal plan** ($0) | Forever | ≤6 users, unlimited devices, ≤3 ACL groups, ~50 tagged resources start, 1k ephemeral mins/mo. **Non-commercial intent.** Opt-out of trial in Billing if eligible. |
| **Community on GitHub** | Free if OSS+OSI | Contact Tailscale; GitHub auth; not self-serve Billing signup. |
| **Auth keys** | Expire on their date | Generated key ~**2026-12-04**; rotating/revoking invalidates join. |
| **Device key expiry** | Reauth | Default ~180d per device; `tailscale up --force-reauth` or disable expiry for servers. |
| **Seats (paid)** | Monthly | Seat-based; vacant seats still billed; do **not** auto-buy without André. |
| **Ephemeral / tagged** | Soft now | Limits not hard-enforced yet; treat as HOLD near caps. |

## Lab ALLOW / HOLD / STASIS
- **ALLOW:** vault auth key; userspace `tailscaled` on box; join **without** `--accept-routes`, **without** exit-node, **without** MagicDNS steal (`--accept-dns=false`). Default route stays `enp0s3`.
- **HOLD:** paid seats, SCIM, MDM config, network flow logs, Funnel exposure, tagged-resource overage packs.
- **STASIS:** do not kill cloudflared / Fog / WG / Tor; Tailscale must not become the path for CF GraphQL / GitHub / wrangler.
- **Prior PLAN** (`TAILSCALE-OSS.md` phase-out) is superseded for *join+vault* when André asks; buying remains HOLD.

## Verify Billing (human)
Admin console → Settings → Billing: trial days left, Personal vs trial vs paid. Screenshot or say the number — Bot never invents remaining days.

## Trial clock (filled)
- As of 2026-09-05 PT: **11 days left** → `TRIAL_ENDS_PT=2026-09-16`
- T1 (WG/OVPN prove Mac+iPhone): **now** (≥5d left)
- T3 revoke: from **2026-09-14** (last 48h)
- T4 uninstall: after `2026-09-16`
- **Do not buy seats.**
