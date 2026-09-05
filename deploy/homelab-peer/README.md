# Homelab Fog peer (RPi / NUC / mini) — lab

**Best honest M-II path** when spare always-on hardware exists.

## Stack

1. Raspberry Pi 4/5 (ARM64) or Intel NUC/mini — always-on power.
2. Tailscale join same tailnet as Mac Fog (`hermes-desk` / mbpv).
3. `bootstrap.sh` + `stratamesh-fog.service` (`FOG-NODE-HOME-001`).
4. Optional cloudflared for `fog-home.` — Mac keeps `fog.`.
5. Prove: [`docs/FOG-PEER-PROVE.md`](../../docs/FOG-PEER-PROVE.md).

## Why this beats Oracle wait

Distinct machine + local SQLite + desk SSH over Tailscale. No hyperscaler IPv4 bill trap. Electricity/UPS is the only ongoing cost.

## ARM64 notes

Install **linux-arm64** `cloudflared` from GitHub releases. Python 3.10+.
