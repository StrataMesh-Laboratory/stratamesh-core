# Operator VPN (LAB, beside Tor, free tier)

André authorized **both** operator VPN daemons **beside** the existing Tor stack (2026-08-29 PT). Distro packages. policy-rc.d blocks systemd; start user-space like tor.

Not an anonymity / aBFT / mainnet claim. Not VPN-before-Tor (tor outbound stays on the box default route). Not a 6th cron. Not an extra Worker. Never workers.dev. No wrangler deploy.

**Never default-route the box.** A `0.0.0.0/0` AllowedIPs / `redirect-gateway` would capture Cloudflare GraphQL, GitHub, and wrangler — already excluded from Tor.

**Never send CF / GitHub / wrangler through VPN or Tor.**

Do not kill cloudflared, Fog :8787, EDGE :8788, nginx :443, MariaDB :3306, tor SOCKS 9050.

Do not expose 3306 or phpMyAdmin on `0.0.0.0`.

## Layout

| Plane | Bind | Overlay |
| --- | --- | --- |
| WireGuard `wg0` | UDP kernel listen-port **51820** (kernel binds INADDR_ANY; **iptables DROP** unless `-i lo` and dest `127.0.0.1`). TCP onion front **127.0.0.1:51820** via socat | `10.88.0.1/24` |
| OpenVPN TCP camouflage | **127.0.0.1:1194** (nginx already owns `127.0.0.1:443`) | `10.89.0.1/24` (`tun0`) |
| Tor SOCKS | `127.0.0.1:9050` | unchanged |
| Operator v3 onion | HiddenServiceDir hostname | ports 443, 8787, **51820**, **1194** |

Keys / certs: `~/.local/var/vpn/` **0700**, files **0600**. OpenVPN PKI: `~/.local/var/vpn/openvpn/` **0700**. Never commit private keys. Never print them. Never print the Meta WA token.

Start: `~/.local/bin/start-operator-vpn.sh` (idempotent; aborts if the default route changes).

## WireGuard (preferred LAN)

- Server: `10.88.0.1/24`, peer André Mac `10.88.0.2/32`.
- `Table = off` on the server `wg-quick` conf — connected `/24` only, **not** default.
- Kernel WireGuard has no `ListenAddress`; loopback-only is enforced with:
  - `iptables INPUT DROP` UDP 51820 unless `-i lo`
  - `iptables INPUT DROP` UDP 51820 unless dest `127.0.0.1`
  - `ip6tables INPUT DROP` UDP 51820 unless `-i lo`
- Tor HiddenServicePort is TCP, WireGuard is UDP. `socat` bridges **TCP 127.0.0.1:51820 → UDP 127.0.0.1:51820**. Mac over onion needs a matching UDP-over-TCP helper, **or** use OpenVPN TCP 1194 (native).
- Client AllowedIPs: **`10.88.0.0/24` only**. Do **not** `0.0.0.0/0`. Do **not** `127.0.0.1/32` (would steal Mac localhost).
- Box loopback services via the WG LAN (DNAT, not a new bind on `0.0.0.0`):
  - `https://10.88.0.1/` → nginx `127.0.0.1:443`
  - `http://10.88.0.1:8787/health` → Fog
  - `mysql -h 10.88.0.1 -P 3306` → MariaDB
- Client snippet (placeholders, **no private key**): `/home/box/ops-monitor/wireguard-client.conf.example`
- Usable client private key stays **0600** at `~/.local/var/vpn/client-andre.key`

## OpenVPN (TCP camouflage)

- `local 127.0.0.1`, `proto tcp4`, port **1194**.
- **No** `redirect-gateway`. Pushes only `10.89.0.1/32` (box loopback services via the TUN gateway).
- Same DNAT map on `tun0`: 443 / 8787 / 3306 → `127.0.0.1`.
- Server-only PKI (easy-rsa). Client example: `/home/box/ops-monitor/openvpn-client.conf.example`
- Client cert CN `andre-mac`. Copy `ca.crt` / `andre-mac.crt` / `andre-mac.key` / `ta.key` off the box; never commit.

## Tor HiddenServicePort additions

Same v3 identity (`HiddenServiceDir` unchanged). SIGHUP only; do not restart tor.

| Onion port | Target |
| --- | --- |
| 443 | `127.0.0.1:8443` (existing HTTPS front) |
| 8787 | `127.0.0.1:8787` (Fog) |
| **51820** | `127.0.0.1:51820` (WG TCP bridge) |
| **1194** | `127.0.0.1:1194` (OpenVPN TCP) |

Live hostname is `HiddenServiceDir/hostname` on the box (not logged here).

## Lab inventory (2026-08-29 PT)

Default route **unchanged**: `default via 172.30.0.1 dev enp0s3`. `ip route` has **no** default via `wg0` or `tun0`. Only connected overlays `10.88.0.0/24` and `10.89.0.0/24`.

| Process | pid | listen |
| --- | --- | --- |
| cloudflared | 197380 | (untouched) |
| Fog FOG-NODE-PT-CM-001 | 420203 | `:8787` (pre-existing) |
| EDGE-GROK-CMN-001 | 300523 | `:8788` (pre-existing) |
| nginx | (pre-existing) | `127.0.0.1:443` / `[::1]:443` |
| MariaDB | (pre-existing) | `127.0.0.1:3306` / `[::1]:3306` **not** `0.0.0.0` |
| tor | 425772 | `127.0.0.1:9050` SOCKS, `127.0.0.1:9051` control |
| socat TCP→WG | 521947 | `127.0.0.1:51820` TCP |
| openvpn | 521955 (nobody) | `127.0.0.1:1194` TCP |
| wg0 (kernel) | n/a (interface) | UDP 51820, firewalled to lo |

Verify (repeat after restart):

```
sudo wg show
ss -tlnp | grep 127.0.0.1:1194
ip -4 route show default    # must be via enp0s3, not wg0
curl -sS --max-time 10 https://ifconfig.me
curl -sS -o /dev/null -w '%{http_code} %{remote_ip}\n' https://github.com
curl -sS -o /dev/null -w '%{http_code} %{remote_ip}\n' https://api.cloudflare.com
ss -tlnp | grep 127.0.0.1:9050
cat ~/.local/var/tor/stratamesh-operator/hostname
```

2026-08-29 PT check: ifconfig.me still `104.30.180.115`; GitHub HTTP 200 via `140.82.114.4`; api.cloudflare.com via `104.19.193.29`. Tor SOCKS still `127.0.0.1:9050` pid 425772. Onion hostname unchanged.

## Persistence

policy-rc.d exits 101 — apt will not start `openvpn.service`. Use `~/.local/bin/start-operator-vpn.sh`. Tor remains `tor -f ~/.local/etc/tor/torrc.operator`.

## Honesty

LAB / pre-testnet. Kernel WG cannot bind `127.0.0.1` only; DROP rules + TCP socat are the loopback contract. OpenVPN TCP on 1194 is the native onion path. Not a 24/7 Fog host substitute.
