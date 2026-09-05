# Tailscale containers (Mac Docker Desktop)

**Tailnet:** `stratamesh-laboratory.org.github`  
**Tag:** `tag:container`  
**Auth key:** `~/.config/stratagrok/tailscale-container-auth.key` (ephemeral, reusable) — never git.

## Why Mac, not stratagrok-box
Box Docker daemon cannot start (cgroup mounts blocked). Use **Docker Desktop on `mbpv`**.

## Up
```bash
export TS_AUTHKEY="$(tr -d '\n' < ~/.config/stratagrok/tailscale-container-auth.key)"
cd deploy/mac-fog/tailscale-container
docker compose up -d
docker compose logs -f tailscale
```

## Laws
- No exit node, no accept-routes, no accept-dns.
- Trial bridge only — see `docs/ops/TAILSCALE-TAPER.md` (T1 primary = WireGuard).
- Turn **off** Exit Node on `mbpv` in the Tailscale app (taper non-goal).
- **Kubernetes:** HOLD until a real cluster exists.

## Get the auth key onto Mac
Same vault sync as desk mail (STRATAGROK materialize / pull) — do not paste the key in chat.
