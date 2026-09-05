# Tailscale containers (Mac Docker Desktop)

**Tailnet:** `stratamesh-laboratory.org.github`  
**Tag:** `tag:container` (ACL `tagOwners` → `autogroup:admin`)  
**Auth key:** `~/.config/stratagrok/tailscale-container-auth.key` (ephemeral, reusable) — never git.

## Why Mac, not stratagrok-box
Box Docker socket is root/`docker`-group only; environment is containerized (cgroupns). **Do not** chase box Docker for lab-tailscale. Use **Docker Desktop on `mbpv`**.

## Up (hardened)
```bash
# 1) Start Docker Desktop on mbpv if daemon is down (André gate when stopped).
# 2) Ensure vault key is materialised 0600 (desk vault sync — never paste in chat).
cd deploy/mac-fog/tailscale-container
./compose-up.sh
# or:
export TS_AUTHKEY="$(tr -d '\n' < ~/.config/stratagrok/tailscale-container-auth.key)"
docker compose up -d
docker compose logs -f tailscale
```

`compose-up.sh` picks `docker compose` **or** legacy `docker-compose`, fails closed if the daemon is down or the key is missing, and never prints the key.

## Laws
- No exit node, no accept-routes, no accept-dns.
- Trial bridge only — see `docs/ops/TAILSCALE-TAPER.md` (T1 primary = **WireGuard** `10.88.0.0/24`).
- Turn **off** Exit Node / “offer as exit node” on `mbpv` in the Tailscale app (still shows “offers exit node” on status until André toggles it off).
- **Kubernetes:** HOLD until a real cluster exists.
- **Do not buy seats.** Trial ends ~2026-09-16 PT.

## T1 prove without this sidecar
If Docker Desktop is down, skip the container bridge and prove operator path via WireGuard — see `WG-T1-PROVE.md` in this directory and `wireguard-client.conf.example` on the box ops-monitor.

## Get the auth key onto Mac
Same vault sync as desk mail (STRATAGROK materialize / pull) — do not paste the key in chat.
