# Operator VPN (LAB, exclusive-off, not this stack)

Lab only. Design note. Do not install OpenVPN or WireGuard here. No 6th cron. No extra Worker. Never workers.dev. Not an anonymity, aBFT, or mainnet claim.

Do not route the Tor stack through OpenVPN. There is no Tor-over-VPN default.

Keep Tor SOCKS 127.0.0.1:9050 and the v3 onion as the security stack: stream isolation for Fog gossip, onion for the operator plane.

Never default-route the box through a VPN. A default route would capture Cloudflare GraphQL, GitHub, and wrangler — already excluded from Tor.

## Optional later (exclusive-off)

WireGuard preferred over OpenVPN for André's Mac → 10.x → localhost phpMyAdmin / Fog / 443 when the onion is blocked. Bind VPN to loopback services only, not 0.0.0.0:3306. OpenVPN only if TCP 443 camouflage is required.

VPN-before-Tor (tor daemon outbound via VPN) only to hide Tor from the ISP. Not an anonymity claim. Not for Cloudflare or GitHub.

Lab honest. No mainnet.
