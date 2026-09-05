# Tailscale taper program → OSS / free-forever substitutes

**Goal:** use the **14-day business trial** only as a bridge. Before it ends, every Tailscale *service* the lab actually needs is carried by open-source or free-forever stand-ins already preferred in `OPERATOR-VPN.md`. **Do not buy seats.** Trial does **not** auto-renew (`TAILSCALE-METABOL.md`).

**Tailnet:** `stratamesh-laboratory.org.github` (GitHub org SSO).  
**T_end:** *unknown until Billing screenshot* — fill `TRIAL_ENDS_PT=` below when known.  
**Auth/API keys vaulted:** `~/.config/stratagrok/tailscale-auth.key`, `tailscale-api.key` (expire ~2026-12-04; revoke at T3).

```
TRIAL_ENDS_PT=   # e.g. 2026-09-19 23:59 PT — André fills from Billing
```

## Service substitution map (what TS does → what we keep)

| Tailscale capability | Lab substitute (OSS / free forever) | Status |
| --- | --- | --- |
| Mesh overlay / private IPs (`100.x`) | **WireGuard `wg0`** `10.88.0.0/24` (`OPERATOR-VPN.md`) | LIVE on box |
| Phone / hostile-UDP path | **OpenVPN TCP** `127.0.0.1:1194` (+ onion front) | LIVE |
| Operator reachability to Fog/nginx/MariaDB | WG/OVPN **DNAT to loopback** only — never `0.0.0.0` binds | LIVE |
| Public HTTPS / Fog / EDGE | **Cloudflare named tunnel** `cloudflared` (leave process) | LIVE |
| SOCKS / onion admin | **Tor** `127.0.0.1:9050` + HiddenService ports | LIVE |
| MagicDNS / name → IP | `/etc/hosts` + Fog inventory; optional local **CoreDNS/dnsmasq** later | PLAN |
| Device inventory / “who’s online” | `wg show` + `ts-api` *during taper only* → then desk inventory md | PARTIAL |
| ACL / tags / posture | WG `AllowedIPs` + iptables; no vendor posture | LIVE (minimal) |
| Tailscale SSH | plain **SSH over `10.88.0.1`** | PLAN (Mac client) |
| Exit node / full tunnel | **Forbidden** (steals CF/GitHub/wrangler) | HOLD forever |
| Funnel / public expose via TS | named tunnel only | HOLD |
| Coordination plane (if we still want TS-client UX) | optional **Headscale** (AGPL, self-host) — only if WG UX fails | HOLD / evaluate T1 |
| Free forever vendor mesh (non-OSS control) | Personal plan ≤6 users — **lab commercial → avoid**; Community-on-GitHub only if OSI + Support | HOLD |
| Auth keys / API automation | vault files + `~/.local/bin/ts-api` → revoke; replace with WG keydir | TAPER |

**Non-goals:** paid Standard/Premium, SCIM, MDM, flow logs, Funnel, exit nodes, default-route.

## Phases (clock = days left until `TRIAL_ENDS_PT`)

### T0 — Bridge (now → fill Billing date)
- Vault auth + API keys (done). Box joined as `stratagrok-box` with metabol-safe flags (`--accept-routes=false --accept-dns=false --advertise-exit-node=false`).
- **Dual-run:** Tailscale may stay up for inventory/API only; **no** desk/Fog/path dependency on `100.x`.
- Confirm WG `wg0`, OpenVPN `:1194`, Tor `:9050`, cloudflared untouched.
- André: paste trial end from Billing → set `TRIAL_ENDS_PT`.

### T1 — Substitute primary paths (when ≥5 days left, or immediately if fewer)
- Mac (`MBPV`): install/verify **WireGuard client** with `wireguard-client.conf.example` → `10.88.0.2`; `AllowedIPs=10.88.0.0/24` only.
- iPhone: prefer **OpenVPN** profile (TCP/onion) or WG app; prove `https://10.88.0.1/` and Fog health via overlay.
- Document cutover one-pager in DESK feed: “operator = WG/OVPN, public = named tunnel”.
- Optional spike (time-boxed ≤2h): **Headscale** as free-forever control plane — accept only if Mac/iPhone clients stay Tailscale-compatible *and* we self-host; else drop.

### T2 — Drain Tailscale dependence (mid taper)
- Stop using `100.x` in any script, Hermes/OpenCode note, or desk connector.
- Move any “ping device” checks to WG handshake / Fog claw probe / named-tunnel health.
- Disable MagicDNS expectations; add Fog node inventory names → `10.88.0.x` in ops-monitor.
- Keep `ts-api devices` as **read-only metabol meter** until T3.

### T3 — Freeze & revoke (last 48h before `TRIAL_ENDS_PT`, or sooner if Billing says ≤2d)
- `tailscale down` on box; stop userspace `tailscaled` (do not systemd-fight).
- Revoke **auth keys** and **API tokens** in admin console (vault files stay until wiped).
- Mac/iPhone: disconnect Tailscale app; leave installed until T4 uninstall.
- Confirm operator still works: WG + OVPN + named tunnel + Tor only.
- **Do not** convert trial → paid. Opt Personal only if André explicitly wants a dormant ≤6-user net for personal experiments — **not** for StrataMesh lab commercial paths.

### T4 — After trial (phase-out complete)
- Uninstall Tailscale clients (Mac human job; box `apt remove tailscale` when idle).
- Wipe or rotate vaulted `tailscale-*.key` (0600 shred).
- Leave `TAILSCALE-METABOL.md` + this taper as historical metabol law.
- Default operator stack remains: **WG + OpenVPN + Tor + cloudflared**.

## Metabol decide() for Tailscale

| Signal | Action |
| --- | --- |
| Trial days unknown | ALLOW vault+bridge; HOLD buy; ask Billing |
| Trial days ≤ 5 | Force T1 if Mac WG not proven |
| Trial days ≤ 2 | Force T3 revoke |
| Seat / card prompt | STASIS — refuse upgrade |
| Connmark/iptables noise on box | ALLOW ignore (cosmetic); never fix by enabling exit-node |
| Desire for MagicDNS UX | Prefer hosts/CoreDNS; Headscale only as T1 spike |

## Acceptance metrics (objective)
1. `ip -4 route show default` = via `enp0s3` (never Tailscale).
2. Operator Fog health reachable via `10.88.0.1:8787` (or OVPN equiv) without Tailscale up.
3. Public Fog/EDGE via named tunnel unchanged.
4. Zero paid Tailscale invoice.
5. After T3: `tailscale status` fails / logged out; `wg show` still has André peer.

## Runbooks
- Operator VPN: `OPERATOR-VPN.md` + `~/.local/bin/start-operator-vpn.sh`
- Tailscale metabol: `TAILSCALE-METABOL.md`
- Legacy “don’t buy” note: `TAILSCALE-OSS.md` (points here)
- Status helper: `~/.local/bin/tailscale-taper-status.sh`

LAB / pre-testnet. Not anonymity or mainnet claim.
