# T1 prove sketch — WireGuard alternate (OSS taper)

**Goal:** prove operator reachability on `10.88.0.0/24` **without** Tailscale seats, exit-nodes, or depending on `lab-tailscale`.

Trial bridge only. Public Fog/EDGE stays on Cloudflare named tunnel. Never default-route the Mac (`AllowedIPs=10.88.0.0/24` only).

## Box (already LIVE)
| Check | Expect |
| --- | --- |
| `ip -4 addr show wg0` | `10.88.0.1/24` UP |
| `ip -4 route show default` | via `enp0s3` (never `tailscale0` / `wg0`) |
| OpenVPN / Tor | `127.0.0.1:1194` / `:9050` listening |
| Peer slot | André Mac `10.88.0.2/32` in `wg show` |

Client private key stays vaulted `~/.local/var/vpn/client-andre.key` (0600) on the box — never commit / never chat.

## Mac (`mbpv`) prove steps
1. Install **WireGuard** app (App Store / wireguard.com).
2. Import from box ops-monitor `wireguard-client.conf.example` after filling `PrivateKey` from the vaulted client key (local copy only).
3. Confirm `AllowedIPs = 10.88.0.0/24` only — **not** `0.0.0.0/0`, **not** `127.0.0.1/32`.
4. Activate tunnel; from Mac:
   - `ping -c2 10.88.0.1`
   - `curl -fsS http://10.88.0.1:8787/health` (Fog)
   - optional: `https://10.88.0.1/` (nginx via DNAT)
5. Leave Tailscale app installed but **do not** use it as operator path; turn **off** Exit Node offer on mbpv.
6. iPhone: prefer OpenVPN TCP/onion profile; same health URL via overlay when ready.

## Optional TS container bridge (non-blocking for T1)
Only if Docker Desktop is up: `./compose-up.sh` → expect node `lab-docker-sidecar` with `tag:container`. Failure of Docker does **not** block T1 WG prove.

## Acceptance (T1)
- [ ] Mac ↔ `10.88.0.1` works with Tailscale **down** or unused for operator.
- [ ] Default Mac route unchanged (CF/GitHub/wrangler native).
- [ ] Zero paid Tailscale invoice; no seat purchase.
- [ ] mbpv Exit Node offer disabled (André UI toggle).

## Headscale
Time-boxed ≤2h spike only if WG UX fails for Mac/iPhone. Else HOLD (see taper T1).
