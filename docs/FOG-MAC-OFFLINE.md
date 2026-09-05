# Mac Fog offline contingency (mbpv / hermes-desk)

**When:** Tailscale host `mbpv` (`mbpv.taild31dc1.ts.net` / `100.108.35.26`) is unreachable for hours — typical Mac sleep while André is away.  
**Policy:** Expected sleep is **not** an incident. **Do not ping** André for wake. Resume on natural wake / next session.

Related: [TAILSCALE-FOG.md](./TAILSCALE-FOG.md), [FOG-HOST-FALLBACK.md](./FOG-HOST-FALLBACK.md), [API-EDGE-OLLAMA-WIZARD.md](./API-EDGE-OLLAMA-WIZARD.md), `deploy/mac-fog/hermes/desktop/DESK.md`.

---

## Continues (box / public / CF)

| Surface | Notes |
|---------|--------|
| **Box git / `gh`** | `stratagrok-box` can fetch, commit, push to `StrataMesh-Laboratory/stratamesh-core` as `amcmorais` |
| **Cloudflare Workers / Pages** | Public edge + api-edge stay up; deploy from box when metabol `cf-worker-req` ALLOW |
| **api-edge wizard contract** | `https://api-edge.calhegasmorais.pt` — `/health`, `/v1/wizard/*` (Worker does **not** need Mac loopback) |
| **Assistants / EDGE public** | `edge.calhegasmorais.pt`, Assistants feed lanes that do not require Mac SSH |
| **Fail-open wizard e2e** | `ops/bin/wizard-e2e-dryrun.py --fail-open` (or `--both`) against live api-edge — **no Mac Ollama required** |
| **Docs / desk handoff on box** | `/home/box/ops-monitor/DESK-HANDOFF.md`, contingency docs on origin |

`oracle_live` stays **false** until a real remote Fog host exists. Offline Mac does not change that.

---

## Blocked (Mac-local only)

| Item | Why |
|------|-----|
| **`$FOG_HOME` desk_bus** | State under `/Users/andremorais/StrataMesh/fog` — unreachable while mbpv offline |
| **LaunchAgents** | `pt.calhegasmorais.fog`, auto-g / `fog-auto-update.sh`, desk sync plists |
| **Local Ollama e2e on Mac** | Native `127.0.0.1:11434` on executing Fog host only |
| **MariaDB `:3307`** | Fog durable offload on Mac loopback / FOG_MYSQL_URL path |
| **Fog hops / `:8787` / workerd** | Kernel + named tunnel keepup on Mac session |
| **`ssh hermes-desk`** | Shared desk machine = mbpv Tailscale SSH |
| **Mac vault meters / desk-mail.token** | Paths under `$FOG_HOME/data/` |

Do **not** claim Fog kernel live, mesh hop prove, or host-cap Ollama green while mbpv is offline.

---

## Wake checklist (no ping)

When mbpv returns (natural wake):

```bash
# 1) Tailnet
tailscale status | grep -E 'mbpv|hermes'

# 2) Repo + tooling
cd "${FOG_HOME:-/Users/andremorais/StrataMesh/fog}/repo"  # or StrataMesh fog checkout
git pull --ff-only origin main
./ops/bin/desk-tooling-ensure.sh || true

# 3) Fog / LaunchAgents (if not already RunAtLoad)
# launchctl list | grep -i fog
# ./deploy/mac-fog/fog-awake.sh   # if present

# 4) api-edge still 1.5.0-wizard? (redeploy only on drift + metabol ALLOW)
curl -sS https://api-edge.calhegasmorais.pt/health | grep -E 'version|oracle_live'

# 5) Host SDK e2e (Ollama + fail-open)
python3 ops/lib/test_ollama_local.py
python3 ops/bin/wizard-e2e-dryrun.py --both

# 6) desk_bus / collegium catch-up (local FOG_HOME)
# python3 ops/desk-collegium/desk_bus.py list
```

Box can already prove fail-open → parse → commit without Mac; wake mainly clears Mac-only gaps (Ollama path, desk_bus, hops, MariaDB).

---

## Box-side while offline

```bash
cd /path/to/stratamesh-core   # e.g. /workspace/stratamesh-core-main on stratagrok-box
python3 ops/bin/wizard-e2e-dryrun.py --fail-open
# optional: --both (Ollama leg may fail_open on box; commit path must still pass)
```

Env: `API_EDGE_BASE` (preferred) or `API_EDGE_ORIGIN` → default `https://api-edge.calhegasmorais.pt`.

---

## Observe (not gates)

| Flag / surface | Meaning |
|----------------|---------|
| **`mac_live`** | Already on Fog workerd `/health` when `ORIGIN=macbook`. |
| **`mac_fog_reachable`** | Same measurement from a public probe: `fog.calhegasmorais.pt/health` is 200 **and** `origin=macbook` / `mac_live`. Sleep → false. Not an André gate. Not `oracle_live`. |
| **`metabol_pace`** | Pass-through of Fog metabol decision when the probe sees it. Offline Mac does not invent ALLOW/HOLD. |
| **Desk board git mirror** | `ops/desk-collegium/state.json` on origin — box/EDGE can list open Acts while `$FOG_HOME` on mbpv is unreachable. Catch-up still happens on wake (`desk_bus` local). |

`ops/bin/wizard-e2e-dryrun.py` prints `mac_fog_reachable`, `fog_public`, `desk_board_mirror`, and forces `oracle_live=false` unless the Worker already said otherwise (it must not). Fail-open e2e **must not fail** because Fog is asleep.

---

## Honesty

- Expected Mac sleep ≠ outage page ≠ André gate.
- Public CF surfaces ≠ Fog host live.
- Fail-open wizard on box ≠ local Ollama proved on Mac.
- `mac_fog_reachable=false` ≠ mesh n=1. n=2 stays provisioned; the Mac hop is just dark.
