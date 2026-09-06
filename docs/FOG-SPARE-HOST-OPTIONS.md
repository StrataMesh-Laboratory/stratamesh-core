# Spare Fog host options + bootstrap

Lab P1 · `oracle_live=false` until a **distinct** peer kernel is live.  
Mac inventory (Hermes outbox): **MacBookPro15,2 / 8 GB Intel** is the **primary** Fog — not a candidate spare.  
Rehearsal `:8887` is the same Mac — **not** M-II (`docs/FOG-PEER-PROVE.md`).

This note proposes options. It does **not** claim a second host is up.

---

## Options (concrete)

| Option | What | Fit | Gate |
|--------|------|-----|------|
| **A — spare mini / old laptop** | x86_64 Debian/Ubuntu or existing Intel mini, sleep disabled | Best **if the box already exists** and stays powered | None to *document*; power/UPS is ops |
| **B — Raspberry Pi 4/5 + SSD** | ARM64 Lite, boot from SSD not SD | Best **long-run** always-on | **André purchase** if no Pi on the shelf — desk does not buy |
| **C — Android Termux** | `pkg install python git`; Fog as user process | Experimental only. Fine for a **weekend dialect**. Not an always-on M-II host | No buy; honesty: process dies with the phone |

Do **not** use: workers.dev, MariaDB `:3307`, EDGE on the Mac, GCP signup 2FA (separate Act), Oracle grok90 (optional, non-blocking).

Recommended order if hardware is already in the house: **A then B**. Termux is last and labeled experimental.

Peer `NODE_ID` must be **`FOG-NODE-HOME-001`** (or another id ≠ `FOG-NODE-PT-CM-001`). Own data dir. Tailscale to the same tailnet as mbpv / hermes-desk. No public `:8787` until an optional `fog-home.` tunnel exists. Mac keeps `fog.calhegasmorais.pt`.

---

## Bootstrap (A or B — Debian/Ubuntu)

On the **spare machine only**:

```bash
# 1) OS
sudo apt-get update -y
sudo apt-get install -y python3 python3-venv git curl

# 2) Tailscale — same tailnet as Mac Fog. Do not open WAN :8787.
#    https://tailscale.com/download
#    sudo tailscale up --ssh

# 3) Tree + unit (NODE_ID is not the Mac)
export REPO_URL=https://github.com/StrataMesh-Laboratory/stratamesh-core.git
export INSTALL_DIR=/opt/stratamesh-core
export DATA_DIR=/var/lib/stratamesh
export NODE_ID=FOG-NODE-HOME-001
bash deploy/homelab-peer/bootstrap.sh
# or, after clone:
#   sudo cp deploy/homelab-peer/stratamesh-fog.service /etc/systemd/system/
#   sudo systemctl daemon-reload
#   sudo systemctl enable --now stratamesh-fog

# 4) Optional public name later — fog-home. only, never steal fog.
#    ARM64: linux-arm64 cloudflared release (not amd64).
#    See deploy/homelab-peer/cloudflared.config.example.yml
```

Unit already points at:

- `WorkingDirectory=/opt/stratamesh-core/src`
- `NODE_ID=FOG-NODE-HOME-001`
- `PORT=8787`
- `DB=/var/lib/stratamesh/fog.db`

---

## Bootstrap (C — Termux, experimental)

```bash
pkg update && pkg install python git
mkdir -p ~/stratamesh ~/stratamesh-data
git clone https://github.com/StrataMesh-Laboratory/stratamesh-core.git ~/stratamesh
cd ~/stratamesh/src
NODE_ID=FOG-NODE-TERMUX-001 \
  python3 node_persistent.py --port 8787 --db ~/stratamesh-data/fog.db --id FOG-NODE-TERMUX-001
```

Keep the phone awake / on power. Install Tailscale from Play / F-Droid. Treat as dialect until a Pi/mini exists. Do not flip `oracle_live`.

---

## After boot — prove (operator on both machines)

Follow `docs/FOG-PEER-PROVE.md` in order: distinct `node_id`, own DB, Tailscale reach, no public `:8787`, INV/TX record, kill-peer Mac still serves.  
Only a desk vote after that list is green considers `oracle_live` / M-II hold lift.

---

## Honesty

- Spare peer is **TBD** until one of A/B actually runs.
- This file is a plan + copy-paste bootstrap, not a live peer.
- Purchase of a Pi, if none exists, is an André gate. Desk does not spend.
