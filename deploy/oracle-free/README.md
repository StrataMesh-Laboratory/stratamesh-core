# Oracle Always Free pack (lab)

**Lab only.** Operator-gated: the Oracle VM is **not** assumed live. Do **not** open public `:8787`. Do **not** create a dangling CNAME for `fog.calhegasmorais.pt` until a named Cloudflare Tunnel exists.

Canonical plan: [`docs/HYBRID-ORACLE-CF-TUNNEL.md`](../../docs/HYBRID-ORACLE-CF-TUNNEL.md)

## Order of operations

1. **Oracle VM (André)** — create or recover the Always Free instance. SSH from the operator IP only.
2. **bootstrap** — run `deploy/oracle-free/bootstrap.sh` (default `REPO_URL` is `https://github.com/StrataMesh-Laboratory/stratamesh-core.git`).
3. **systemd** — install `stratamesh-fog.service` and `stratamesh-publish.service`. Copy `publish.env.example` to `/etc/stratamesh/publish.env` (mode `0600`) and set `STATUS_TOKEN` **on the VM only**.
4. **cloudflared named tunnel** — `cloudflared tunnel create stratamesh-fog`, then config from `cloudflared.config.example.yml`.
5. **DNS** `fog.calhegasmorais.pt` — only after the tunnel exists (`cloudflared tunnel route dns`). NXDOMAIN today is expected.

## Hardening / ARM

- UFW: SSH only; **no public 8787**. Ingress is the tunnel.
- Prefer Ampere (`VM.Standard.A1.Flex`) Ubuntu. Fog core is Python 3.10+.
- Install **linux-arm64** `cloudflared` (and Kubo if used). Avoid x86-only binaries.

See also: `docs/TEMP-GROK-MANAGED-FOG.md` (Workers pulse until tenancy + tunnel).
