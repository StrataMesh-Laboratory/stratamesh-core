# Operator-plane Tor (LAB)

Debian tor package. Free tier. Lab only.

Operator-plane isolation: reach Fog and the localhost HTTPS front as a v3 onion without putting phpMyAdmin or Fog on clearnet. Optional SOCKS5h egress for Fog/EDGE gossip. Not a claim that StrataMesh is anonymous, aBFT, or mainnet-ready.

Out of scope: Tails, Tor Browser, Snowflake, meek, OnionShare, nyx-as-product, DNS-over-Tor for Cloudflare or GitHub APIs, onion-only apex, MX change, extra Worker, 6th cron, workers.dev, wrangler deploy, paid bridges, Oracle grok90. Arti onion services are not the production path yet (follow-up).

grok@ is Fog staff, not root. Do not put staff passwords or control-port passwords in torrc. Never print CookieAuthFile contents. Do not mix Chrome profiles.

## Install

Install the distro tor package (and tor-geoipdb if free in the distro). HiddenServiceDir is /var/lib/tor/stratamesh-operator, mode 0700, owned by the tor daemon user. Include torrc.operator.example from /etc/tor/torrc via percent-include of /etc/tor/torrc.d/*.torrc. Enable the systemd unit; reload after editing. Do not set RunAsDaemon 1 under systemd.

No-root fallback: user-space tor from a 0700 prefix. Rewrite HiddenServiceDir and DataDirectory. Drop User.

Wait for HiddenServiceDir/hostname (often 20-60s on first bootstrap). Report the .onion. Do not read the control cookie.

SOCKS must be 127.0.0.1:9050 only, not 0.0.0.0. One Tor Project check is OK (not Cloudflare): curl with --socks5-h to check.torproject.org/api/ip

## HiddenServicePort map

Onion 443 maps to 127.0.0.1:8443 (existing localhost HTTPS front, paths /fog and /edge). Retarget to nginx 127.0.0.1:443 if that front moves.

Onion 8787 maps to 127.0.0.1:8787 (Fog HTTP when the lab process is up).

Onion 51820 maps to 127.0.0.1:51820 (WireGuard TCP front; kernel WG UDP is loopback-firewalled). Onion 1194 maps to 127.0.0.1:1194 (OpenVPN TCP camouflage). nginx keeps 127.0.0.1:443.

phpMyAdmin and MariaDB on 443/3306 stay off the onion and off 0.0.0.0. Do not restart cloudflared, Fog, or EDGE for this stack.

## Fog / EDGE SOCKS5h (exclusive-off)

Environment FOG_TOR_SOCKS uses scheme socks5h to 127.0.0.1 port 9050. TOR_SOCKS is the fallback name. First wins: FOG_TOR_SOCKS then TOR_SOCKS. Scheme socks5h (not socks5) so DNS goes through Tor. Daemon flags: IsolateClientAddr IsolateSOCKSAuth IsolateDestAddr. Optional SOCKS username in the URL uses IsolateSOCKSAuth per peer.

Helpers wrap outbound HTTP only when the env is set.
Unset env: no proxy (stdlib urllib). Set env: Fog/EDGE gossip HTTP may wrap.
Never routed through Tor: Cloudflare GraphQL and api.cloudflare.com; GitHub; wrangler and workers.dev; this lab CF-fronted apex (calhegasmorais.pt, grok.me). Those break or burn extra circuits and are not the anonymity target.

Operator VPN daemons may run **beside** Tor (not wrapping tor outbound). See [OPERATOR-VPN.md](OPERATOR-VPN.md). Do not default-route the box through a VPN (would capture Cloudflare GraphQL, GitHub, wrangler). Do not send CF / GitHub / wrangler through VPN or Tor. SOCKS 127.0.0.1:9050 and the v3 onion stay the security plane. Not an anonymity, aBFT, or mainnet claim.

## Tests

Run the unit tests in this directory and src/test_tor_socks. No network. CI must not hit Tor or clearnet.

## Follow-ups (not this change)

v3 client authorization: Debian tor can restrict onion clients via authorized_clients under HiddenServiceDir. Minting the client key pair is not one-shot with the package. Directory is ready; wiring keys is a follow-up.
Arti: next, not this production path. Snowflake, meek, paid bridges, Tails, Tor Browser: out.

Lab honest. No mainnet.
