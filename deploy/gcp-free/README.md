# GCP Always Free Fog peer (lab)

**Lab only.** Closest perpetual substitute for Oracle Always Free as a **distinct** Fog kernel host.

Canonical shortlist: [`docs/ORACLE-OSS-ALTS.md`](../../docs/ORACLE-OSS-ALTS.md) · prove: [`docs/FOG-PEER-PROVE.md`](../../docs/FOG-PEER-PROVE.md)

## Always Free hard traps (2026)

| Trap | Required |
|------|----------|
| Region | `us-west1` · `us-central1` · `us-east1` **only** |
| Machine | `e2-micro` (1 free instance-hours/month) |
| Disk | **30 GB Standard persistent disk** — not Balanced/SSD (UI default bills) |
| Public IPv4 | **Omit** — billed; use **Tailscale** + **IAP TCP forwarding** |
| Egress | ~1 GB/month North America free — keep gossip on Tailscale |
| Billing | Billing account + card verification required for Always Free Compute |

`oracle_live` stays **false** until this peer is up, healthy, and INV/TX-proven with Mac Fog.

## Order of operations

1. Create GCP project + billing (André: 2FA/captcha only).
2. Run `gcloud-create-example.sh` flags manually (edit project/zone).
3. SSH via `gcloud compute ssh` (IAP) or Tailscale once joined.
4. `bootstrap.sh` then install `stratamesh-fog.service`.
5. Install Tailscale; optional cloudflared named tunnel for `fog-gcp.` hostname (do **not** steal `fog.calhegasmorais.pt` from Mac).
6. Prove per `docs/FOG-PEER-PROVE.md`.

## Hardening

- UFW: SSH/Tailscale only; **no public 8787**.
- NODE_ID=`FOG-NODE-GCP-001` · SQLite under `/var/lib/stratamesh/`.
- MW mesh remains on Mac (:8788–:8792); this peer is Fog kernel + gossip peer.
