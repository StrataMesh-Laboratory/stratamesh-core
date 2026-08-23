# Hybrid deployment — Oracle Always Free + Cloudflare Tunnel + OSS middleware

**Goal:** Run StrataMesh Fog node 24/7 at **€0** (subject to Oracle Free eligibility), expose it safely via **Cloudflare Tunnel** (no open inbound ports), keep public site/status on **Cloudflare Workers**.

**Operator:** André Manuel Calhegas Morais · FOG-NODE-PT-CM-001

---

## Architecture

```
                    Internet users
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
   calhegasmorais.pt   status Worker    (optional)
   Workers + D1        stratamesh-status  fog.<domain>
           │               │               │
           │               │    Cloudflare Tunnel
           │               │    (cloudflared)
           │               ▼               │
           │         POST /ingest ◄────────┤ publish_loop
           │                               │
           └───────────────────────────────┘
                           │
                    Oracle Always Free VM
                    (Ampere ARM or AMD micro)
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   node_persistent    publish_loop      optional:
   :8787              → CF status       Kubo IPFS
   mesh_sync peers                      Caddy/nginx
   SQLite                               fail2ban
```

| Layer | Component | Cost | Role |
|-------|-----------|------|------|
| Edge / site | Cloudflare Workers + D1 | Free tier | Landing, portal, status UI |
| Ingress | **cloudflared** Tunnel | Free | Public HTTPS → private `:8787` |
| Compute | **Oracle Always Free** VM | Free* | Fog daemon 24/7 |
| Optional data | Kubo (IPFS) on same VM | Free OSS | Real pins under SPA pinner |
| Process mgmt | systemd (or Docker Compose) | OSS | Restart on failure |
| Hardening | UFW + fail2ban (SSH only) | OSS | No public 8787 |

\*Oracle Always Free requires signup (card for identity). Capacity/region limits apply.

---

## Why this hybrid

- **WebDomain / cPanel** cannot host a long-running Fog process.
- **Workers** cannot replace `node_persistent.py` (CPU limits).
- **Tunnel** avoids opening Oracle VCN ports to the world and works with dynamic-ish networking.
- **Status Worker** stays the public pulse; the VM only **pushes** JSON via `/ingest`.

---

## 1. Oracle Always Free (outline)

1. Create account: https://www.oracle.com/cloud/free/
2. Create VCN + subnet (default OK) with **SSH (22) from your IP only**; **do not** open 8787 publicly.
3. Launch instance:
   - Preferred: **VM.Standard.A1.Flex** (Ampere ARM) — e.g. 1–2 OCPU, 6–12 GB within Always Free budget  
   - Or AMD micro if ARM capacity unavailable
4. Image: **Ubuntu 22.04** or **Oracle Linux**
5. SSH: `ssh -i <key> ubuntu@<public-ip>`

### Bootstrap packages
```bash
sudo apt update && sudo apt install -y python3 python3-venv git ufw fail2ban
# optional IPFS:
# curl -s https://dist.ipfs.tech/kubo/v0.29.0/kubo_v0.29.0_linux-arm64.tar.gz ...
```

### Clone & run
```bash
git clone https://github.com/StrataMesh-Laboratory/stratamesh-core.git
cd stratamesh-core
python3 -m venv .venv && source .venv/bin/activate
# no heavy pip deps required for core node
```

Use `deploy/oracle-free/` units below or Docker Compose + tunnel sidecar.

---

## 2. Cloudflare Tunnel (cloudflared)

### Install (Linux ARM64 example)
```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o cloudflared
chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/
```

### Authenticate (once, on a machine with browser)
```bash
cloudflared tunnel login
cloudflared tunnel create stratamesh-fog
cloudflared tunnel route dns stratamesh-fog fog.calhegasmorais.pt   # or chosen hostname
```

### Config `/etc/cloudflared/config.yml`
```yaml
tunnel: <TUNNEL_ID>
credentials-file: /etc/cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: fog.calhegasmorais.pt
    service: http://127.0.0.1:8787
  - service: http_status:404
```

### systemd
```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

DNS for `fog.calhegasmorais.pt` is managed by Cloudflare when using `tunnel route dns` (CNAME to tunnel).

---

## 3. OSS middleware (compatibility)

| Middleware | Purpose |
|------------|---------|
| **cloudflared** | Zero-Trust-style ingress; TLS at edge |
| **Caddy** (optional) | Local reverse proxy, headers, rate limit before node |
| **fail2ban** | SSH brute-force protection |
| **UFW** | Allow 22 from your IP; deny 8787 from public |
| **Kubo** | IPFS API on `127.0.0.1:5001` → `IPFS_API_URL` |
| **systemd** | `stratamesh-fog` + `stratamesh-publish` + `cloudflared` |

### Optional Caddy snippet (localhost only)
```caddy
:8788 {
  reverse_proxy 127.0.0.1:8787
  header {
    X-StrataMesh-Edge "oracle-free"
  }
}
```
Point tunnel at `8788` if you enable Caddy.

---

## 4. Fog + publish on the VM

```bash
# /etc/systemd/system/stratamesh-fog.service  (see deploy/oracle-free/)
# Environment:
#   NODE_ID=FOG-NODE-PT-CM-001
#   PORT=8787
#   DB=/var/lib/stratamesh/fog.db
#   IPFS_API_URL=http://127.0.0.1:5001   # if Kubo

# publish_loop → existing Worker ingest
# STATUS_INGEST_URL=https://stratamesh-status.stratamesh.workers.dev/ingest
# STATUS_TOKEN=<rotate from Worker binding>
```

Health:
```bash
curl -s http://127.0.0.1:8787/health
curl -s https://fog.calhegasmorais.pt/health    # via tunnel
curl -s https://stratamesh-status.stratamesh.workers.dev/status
```

---

## 5. Compatibility notes (ARM)

- Pure **Python 3.10+** Fog core: works on Ampere.
- **psutil** (B3 meters): `pip install psutil` if desired; falls back to `/proc`.
- **Kubo**: download **linux-arm64** build.
- Avoid x86-only binaries without emulation.

---

## 6. Security checklist

- [ ] SSH key only; disable password auth  
- [ ] UFW: 22 restricted; **8787 not public**  
- [ ] Tunnel credentials only on VM  
- [ ] Rotate `STATUS_TOKEN`  
- [ ] Do not commit Oracle keys, tunnel JSON, or cPanel tokens to git  

---

## 7. What stays on Cloudflare (unchanged)

- `calhegasmorais.pt` landing / portal (Workers + D1)  
- `stratamesh-status` JSON + `/live`  
- WAF / DNS  

The Oracle VM is **only** the Fog runtime + tunnel endpoint + optional IPFS.

---

## 8. Failure modes

| Risk | Mitigation |
|------|------------|
| Oracle account rejected / reclaimed | Keep local PC fallback; git is source of truth |
| Tunnel disconnect | systemd restarts cloudflared; status shows stale timestamp |
| ARM capacity full | Retry region or AMD micro shape |
| Free egress limits | Status ingest is tiny; avoid serving large media from VM |

---

## Quick start order

1. Oracle VM + SSH hardened  
2. Clone repo, systemd fog + publish  
3. cloudflared tunnel → `fog.calhegasmorais.pt`  
4. Optional Kubo + `IPFS_API_URL`  
5. Verify `/health` via tunnel + status Worker ingest  

See also: `deploy/oracle-free/`, `docs/OPS-RUNBOOK.md`, `docs/A3-PUBLIC-TESTNET-JOIN.md`.
