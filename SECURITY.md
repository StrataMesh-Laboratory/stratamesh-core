# Security

Lab node and public Workers. Please **do not** open public issues for exploitable flaws that could harm FOG-NODE-PT-CM-001 or contributors.

Email: **geral@eni.calhegasmorais.pt** (AMCM ENI)

Include: surface URL or repo path, impact, repro if safe.

Canonical code: https://github.com/StrataMesh-Laboratory

## Operator-plane Tor (lab)

Optional Debian `tor` v3 onion + loopback SOCKS5h for the operator plane (Fog on `:8787` and the localhost HTTPS front). Copy [ops/tor/torrc.operator.example](ops/tor/torrc.operator.example); operator notes in [ops/tor/README.md](ops/tor/README.md). Set `FOG_TOR_SOCKS` / `TOR_SOCKS` (`socks5h://127.0.0.1:9050`) so Fog/EDGE gossip *may* egress through Tor — exclusive-off when unset. Cloudflare GraphQL, GitHub, and wrangler stay off Tor.

This is operator-plane isolation plus optional gossip egress. It is **not** a claim that StrataMesh is anonymous, aBFT, or mainnet-ready. Arti onion services are not the production path in this lab (follow-up).
