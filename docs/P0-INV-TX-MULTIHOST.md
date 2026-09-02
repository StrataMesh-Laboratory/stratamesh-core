# P0 — Multi-host INV/TX (Stage 1 adversarial lab)

**Status:** grok90 two-host INV/TX **evidence pack** — **later bar**, not the current phase name. Lab only.  
**Current lab:** Adversarial **P1** · **v0.5.1-lab** · **n=2** (`FOG-NODE-PT-CM-001` + `EDGE-GROK-CMN-001`).  
**Roadmap:** [ROADMAP-PUBLIC-v0.3.md](./ROADMAP-PUBLIC-v0.3.md) Stage 1 — Adversarial lab (current).  
**Desk:** [ops/EDGE-GROK-DESK-CONTRACT.md](../ops/EDGE-GROK-DESK-CONTRACT.md) (locked 2026-08-28).  
**Not:** mainnet · aBFT · investment product · public testnet exit.

This page is the honesty gate for **≥2 real hosts** exchanging INV/TX.  
[A1-PRIVATE-MESH.md](./A1-PRIVATE-MESH.md) is **one runner, three OS processes**. It does not close P0.

---

## 0. Honest lab state (snapshot 2026-08-28 — historical; see banner)

**2026-09-02:** live lab is n=2 Adversarial P1. The table below is the 2026-08-28 snapshot (n=1 / same-host EDGE). Public `/health` may still JSON n=1 origin=session mac_live=false (session-origin flag). Do not treat this snapshot as current topology.

| Fact | Value |
|------|--------|
| Fog | `FOG-NODE-PT-CM-001` · local-process · n=1 |
| Substrate | `fog_substrate=local-process` · `oracle_vm=false` · `oracle_live=false` |
| Local EDGE | `EDGE-GROK-CMN-001` on `:8788` · **same host** as Fog `:8787` |
| `same_host_as_edge_local` | `true` |
| Local `GET /inv` | genesis-only (`tx_count=1`) |
| Local `POST /gossip` / `POST /tx/ingest` | handlers exist in `src/node_persistent.py`; **not wired to a second machine** |
| I1–I6 CI | landed (`src/test_economic_invariants.py`, in-process `LabLedger`) |
| Resource-proof MVP | landed (`src/resource_proof.py`, class `compute`, in-process) |
| Process-gossip CI | landed (PR #7 / `src/test_process_gossip.py`) — still one machine |
| Oracle tenancy grok90 | incident `260826-001576` · second host waits |
| Pages origin | https://calhegasmorais.pt/ · fail-open · source of truth |
| calhegasmorais.grok.me | **unbound** |

Do not claim mesh. Do not treat Worker `stratamesh-gossip` peer lists as multi-host INV/TX.

---

## 1. Acceptance — what counts as two real hosts

P0 exits only when **two distinct machines** sustain INV/TX. Host identity is the kernel/hypervisor, not the listen port.

### 1.1 Counts

| Host | Where | Process |
|------|--------|---------|
| **A — Fog** | grok90 Oracle Always Free VM (incident `260826-001576` recovered) | `node_persistent.py --port 8787 --id FOG-NODE-PT-CM-001` (or a distinct fog id if local-temp keeps the name) |
| **B — this box** | EDGE-GROK local machine that is **not** the grok90 VM | Fog or EDGE process that speaks INV/TX |

Required fingerprints — **all** of:

1. Distinct machine identity: Oracle OCID / public IP / `uname -n` of grok90 **≠** this box.
2. Distinct kernels: two `pid_namespace` / boot ids, not two ports on one OS.
3. INV/TX packets leave one host and arrive on the other (Cloudflare Tunnel to the VM, SSH tunnel, or private IP). Loopback `127.0.0.1:8787 ↔ 127.0.0.1:8788` is not this path.
4. Each side reports `node_id` **and** a host fingerprint (`host_id` / OCID / hostname) in `/status` or the evidence pack.
5. After sync, **both** DAGs hold the same non-genesis `tx_id`s (0% tx-count spread on the exchanged set).

A third host is welcome later (roadmap ≥2–3 peers). Two is the P0 floor.

### 1.2 Does not count

| Setup | Why it fails |
|-------|----------------|
| Fog `:8787` + EDGE `:8788` on **one** machine | `same_host_as_edge_local=true`. Two sockets, one kernel. |
| `testnet_launcher.py --nodes 3` / `test_process_gossip.py` | A1: one Actions runner, three PIDs. Documented as not multi-host. |
| `multi_node_sim.py` / `protocol_benchmark.py` | In-process. No OS boundary. |
| Two Docker/containers/cgroups on this box | Same physical host as EDGE. Not grok90. |
| CF Worker `stratamesh-gossip` listing `EDGE-GROK-CMN-001` | Observer identity on Free Workers, not a Fog DAG peer. STASIS/HOLD under INC-1027. |
| `workers.dev` hop as the "second host" | Forbidden rail. Not a Fog. |
| Pages origin / Project Space srcdoc mirror | Document surface. Not INV/TX. |
| In-process I1–I6 or resource-proof CI green | Landed; not mesh. |

**Rule:** grok90 Oracle Fog ≠ this box. If both processes share a hostname, a loopback, or a single hypervisor, P0 stays OPEN.

---

## 2. INV/TX sequence and honesty checks

Wire dialect: [WIRE-PROTOCOL-v1.md](./WIRE-PROTOCOL-v1.md) §5 (`src/gossip.py`).  
HTTP helpers: `src/mesh_sync.py` against `src/node_persistent.py`.

### 2.1 HTTP sequence (lab path used by A1, reused across hosts)

```text
Host A                         Host B
|                              |
|  GET  /inv                   |
|  { ids: [...] }              |
|<---------------------------->|
|  GET  /tx/{id}               |   missing ids only
|  Transaction                 |
|<---------------------------->|
|  POST /tx/ingest             |
|  { accepted, tx_id }         |
|<---------------------------->|
```

`mesh_sync.sync_pair(a, b)`:

1. `GET {a}/inv` and `GET {b}/inv`
2. For ids only on A: `GET {a}/tx/{id}` → `POST {b}/tx/ingest`
3. Symmetric for ids only on B
4. Repeat until inventories match (cap 80 ids/round, several rounds)

### 2.2 Gossip envelope (same semantics, binary JSON)

```text
inv        { ids }           announce known tx_ids
getdata    { ids }           request full txs
tx         Transaction       deliver one
getparents { tx_id }         gap fill
parents    { tx_id, parents }
```

Local `POST /gossip` already feeds `GossipNode.handle_message`. Across hosts this is an optional dialect on top of HTTP INV/TX. Wiring it is Bot work **after** grok90 is up — not a Worker job.

### 2.3 Honesty checks (must all pass on both hosts)

From WIRE §4.3–4.4 and I5:

| Check | Pass |
|-------|------|
| Genesis | Only one vertex may have `parents: []`. Local today is this vertex. |
| Parents exist | Ingest with unknown parent → pending / reject, not a spendable attach. |
| DAG | No cycles. |
| Replay | Duplicate `tx_id` → `accepted` idempotent, no second vertex, no second mint. |
| Cumulative weight | Receiver recomputes; peer CW is advisory. |
| Host split | Evidence pack records two fingerprints; `same_host_as_edge_local` becomes `false` for the grok90↔box pair. |
| Spread | After sync, exchanged `tx_id` set is identical on A and B. |
| Chaos (Stage 1 exit, after the 2-host floor) | Loss, partition, restart: killed Fog on grok90 restarts from **its** SQLite, is behind, then catches up via INV/TX. |

I1–I6 remain ledger invariants (CI already green in-process). A multi-host run must **not** mint via `#mint` without a verified resource-proof. Resource-proof MVP is in-process `compute` only; it does not credit STRATA across hosts.

### 2.4 Evidence pack (what "done" looks like)

A GitHub artifact / PR comment, not a marketing sentence:

```text
p0_inv_tx_multihost:
  host_a: { role: fog, where: grok90, ocid: …, node_id: FOG-NODE-PT-CM-001, inv_len: N }
  host_b: { role: box,  where: edge-local, hostname: …, node_id: …, inv_len: N }
  same_host: false
  oracle_live: true
  path: inv → tx → ingest   # or inv → getdata → tx
  shared_tx_ids: […]        # includes ≥1 non-genesis
  spread: 0
  workers_dev: false
  worker_http: false
  hf_inference: false
  lab: true
```

Until that pack exists, P0 is OPEN.

---

## 3. `decide()` gates — a probe must not burn CF / HF

Library: `ops/lib/metabolism.py` · rails: `ops/config/rails.json` · policy: [ops/METABOLISM.md](../ops/METABOLISM.md).

First-match:

```text
STASIS → P0_BORROW → HOLD → ALLOW
```

`P0_BORROW` is **not** against HF at remaining 0 and **not** against live Worker HTTP under INC-1027.  
Reserved peak `R = remaining / hours_left`. SuperGrok does **not** refill Cloudflare or Hugging Face. Do not Upgrade. Never a 6th CF cron.

### 3.1 Rails that touch this P0

| Rail | Now | Probe rule |
|------|-----|------------|
| `cf-worker-req` | **STASIS** consume=0 until **2026-08-29T00:00:00Z**, then Q-gated ALLOW, hold `R` through 31 Aug | Multi-host INV/TX **must not** GET/POST Workers (`edge.calhegasmorais.pt`, `*.workers.dev`, gossip/status/aiops ingest). After refill: **one** Orchestrator `/health` on Pages origin — never `/actions`, never workers.dev. |
| `hf-inference` | **HOLD** remaining 0, `canPay=false` until **2026-09-01T00:00:00Z** | No inference. No Worker `HF_TOKEN`. No AI Gateway. Hub whoami/catalog/static commits stay LIVE. |
| `aiops-actions` | hard_cap **0** | Forbidden. |
| `cf-cron` | 5/5 | No 6th. |
| `local-monitor` | LIVE on this box | Loopback `/health` of local Fog/EDGE only. |
| Hub catalog | LIVE | Means, not a subject. Do not pull RealworldQA (~297 GiB) onto Fog. |

### 3.2 Probe allow-list (this P0)

ALLOWED without CF/HF spend:

- `http://127.0.0.1:8787/{health,inv,tx/…}` on this box
- `http://127.0.0.1:8788/health` on this box (identity only — does **not** count as host B)
- After grok90 is up: `http://127.0.0.1:8787/…` **on the VM** (SSH) or the **named tunnel to Fog**, not a Worker reverse-proxy of INV/TX
- GitHub commits/PRs of the evidence pack (pace GraphQL)

FORBIDDEN until the matching rail is ALLOW **and** Q-gated:

- Any `*.workers.dev`
- Live Worker HTTP (`/api/v1/gossip/peers`, edge `/status`, status `/ingest`, AIOps `/actions`)
- ~3 Hz host-walks
- HF inference, bucket pull, Challenge 0
- Publishing calhegasmorais.grok.me
- Partial Direct Upload of Pages (would wipe `/roadmap`, `/clp`)

If `decide(rail)` returns STASIS or HOLD, write a six-line note and stop. No retry-loop.

### 3.3 Pseudocode

```python
def may_probe_inv_tx(target: str, now) -> str:
    if target_is_workers_dev(target) or target_is_live_worker(target):
        if now < datetime(2026, 8, 29, tzinfo=timezone.utc):
            return "STASIS"          # INC-1027
        v = decide("cf-worker-req", remaining=cf_remaining, now=now, is_p0=True)
        if v.decision == "P0_BORROW":
            return "HOLD"            # P0_BORROW must not hit live Worker HTTP
        return v.decision            # still never workers.dev
    if target_is_hf_inference(target):
        return "HOLD"                # until 2026-09-01T00:00:00Z
    if target_is_local_or_oracle_fog(target):
        return "ALLOW"               # loopback / SSH / named Fog tunnel only
    return "HOLD"
```

## 4. What Bot does after grok90 provisions vs what stays HOLD

Oracle chase remains incident `260826-001576`. Second host waits on that VM. Desk-ok gossip PRs merge only when they record the live Fog process, not when they spend Worker quota.

### 4.1 Bot — after grok90 is actually up

Operator (André) provisions the VM. Bot then:

1. **Record the host.** OCID, region, image, `uname -a`, public IP (or "tunnel-only"), `node_id`. Write GitHub first (`ops/HANDOFF-LATEST.md`, this page's status table).
2. **Install Fog on the VM** per `HYBRID-ORACLE-CF-TUNNEL.md`: `node_persistent.py --port 8787`, systemd, SQLite on disk. Do not open 8787 to the world; cloudflared → `fog.calhegasmorais.pt` (or chosen hostname).
3. **Clear temp markers** (`version: 0.2.1-lab-temp`, `source: Grok managed temporary Fog`) on the next honest publish. Local-process on this box may keep running as a different peer, not as a second name for the same Fog.
4. **Wire INV/TX** between grok90 `:8787` and this box using `mesh_sync.sync_pair` over SSH/tunnel. Turn on `POST /gossip` only if the envelope is useful; HTTP INV/TX is enough for P0.
5. **Run the honesty checks** in §2.3. Produce the evidence pack in §2.4. Post it to the PR and t/20 (Discourse cap 6/Lisbon day).
6. **Chaos slice** (after the floor): SIGTERM Fog on grok90, confirm this box still serves `/inv`, restart Fog from the VM SQLite, catch up. Same idea as A1, two machines.

Bot does not click Upgrade, add a 6th cron, PUT Workers/D1, ingest via `stratamesh-status.stratamesh.workers.dev` while that rail is STASIS/HOLD, or bind grok.me.

### 4.2 Stays HOLD / STASIS (even after grok90 is up)

| Surface | Until / forever-for-now |
|---------|--------------------------|
| Live Worker HTTP | 2026-08-29T00:00:00Z then Q-gated one `/health`, never `/actions`, never workers.dev |
| HF Inference Providers | 2026-09-01T00:00:00Z · `canPay=false` |
| DeoMail workers.dev | stays disabled |
| CF cron | 5/5 · no 6th |
| Worker `HF_TOKEN` / AI Gateway | do not create |
| RealworldQA bucket on Fog | never |
| calhegasmorais.grok.me | unbound until desk says publish (preview already srcdoc-mirrors Pages; still not bound) |
| Pages Direct Upload | no partial land (wipes `/roadmap`, `/clp`) |
| Public "mesh is live" / mainnet / aBFT / investment copy | never from this page |
| Challenge 0 | unfunded |

Assistant (Project Space) does not chase Oracle, mail, t/20, or Hub. One shot: this document. Bot lands it (`contents:write` is 403 from this PAT).

## 5. Already landed (do not re-do as if they closed P0)

| Slice | Where | Closes P0? |
|-------|-------|------------|
| I1–I6 named CI | `src/test_economic_invariants.py` · WIRE §8.2 | No (in-process `LabLedger`) |
| Resource-proof MVP | `src/resource_proof.py` · `compute` challenge/receipt | No (in-process; does not mint across hosts) |
| Process-level INV/TX + kill/restart | `src/test_process_gossip.py` · `.github/workflows/process-gossip.yml` · A1 | No (one runner) |
| HTTP INV/TX handlers | `GET /inv` `GET /tx/{id}` `POST /tx/ingest` `POST /gossip` in `src/node_persistent.py` | No (unwired to a second machine) |

## 6. Explicit non-claims

- Lab confidence ≠ production finality.
- Two ports on one box ≠ two hosts.
- Worker gossip peer list ≠ INV/TX mesh.
- I1–I6 CI green ≠ multi-host conservation.
- Resource-proof MVP ≠ transit-eligible mint.
- grok90 provisioned ≠ P0 closed (INV/TX evidence pack still required).
- This laboratory is not mainnet, not aBFT, not an investment product.

## 7. Pointers

| Doc | Role |
|-----|------|
| `ops/EDGE-GROK-DESK-CONTRACT.md` | Bot vs Assistant, P0 honesty, meters |
| `ops/METABOLISM.md` | `decide()`, INC-1027, renewal calendar |
| `ops/STOP-PROBES.md` | What stays armed vs deferred |
| `WIRE-PROTOCOL-v1.md` | INV/TX envelopes, I1–I6, genesis |
| `A1-PRIVATE-MESH.md` | Local-process INV/TX (not this gate) |
| `HYBRID-ORACLE-CF-TUNNEL.md` | grok90 Fog + tunnel once Oracle is back |
| `TEMP-GROK-MANAGED-FOG.md` | Local-process placeholder while Oracle is blocked |
| `EDGE-GROK-LOCAL.md` | `:8788` on this box |
| `HUB.md` | Catalog LIVE; inference HOLD |
| `ROADMAP-PUBLIC-v0.3.md` | Stage 1 exit signals |

Document version: P0-INV-TX-MULTIHOST · 2026-08-28 · LAB

Node: FOG-NODE-PT-CM-001 · n=1 · oracle_live=false
