# StrataMesh Contributor Edge SDK — for AI agents

**Paste this document into Claude, ChatGPT, Copilot, Cursor, Gemini, or any coding agent.**  
It installs a **local contributor edge device** using the same mechanics as **EDGE-GROK** (`spare_capacity_only`, background idle priority), and links it **on-graph** to the Calhegas Morais Fog via the public edge API.

| Resource | URL |
|----------|-----|
| **Edge desk (UI + API)** | https://edge.calhegasmorais.pt/ |
| **Edge health JSON** | https://edge.calhegasmorais.pt/health |
| **Edge status JSON** | https://edge.calhegasmorais.pt/status |
| **Fog status** | https://status.calhegasmorais.pt/ |
| **Gossip peers (mesh)** | https://calhegasmorais.pt/api/v1/gossip/peers |
| **AIOps actions** | https://aiops.calhegasmorais.pt/actions |
| **This SDK (canonical)** | https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/AGENT-EDGE-SDK.md |
| **Edge node docs** | https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/EDGE-GROK-NODE.md |
| **Local grounding pattern** | https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/EDGE-GROK-LOCAL.md |

**Lab only · pre-testnet · Subjects ≠ objects · no mainnet / yield claims.**

---

## 1. What you are installing

A **contributor edge** is:

1. **Local** background process(es) on the machine/session where the agent runs.  
2. **Idle priority only** — never compete with the user’s primary work (same policy as EDGE-GROK).  
3. **Observer + heartbeat** toward Fog / edge.calhegasmorais.pt / gossip.  
4. **Honest** — if offline, it must **not** appear as a live mesh peer.

Reference identity on the graph today:

- Fog: `FOG-NODE-PT-CM-001`  
- Lab automation edge: `EDGE-GROK-CMN-001` (agent `grok@calhegasmorais.pt`, external assistant)  
- Your device will use a **new** `node_id` you choose (see §3).

---

## 2. Non-negotiable resource policy

| Constraint | Required value | Why |
|------------|----------------|-----|
| CPU nice | `19` (or OS equivalent lowest) | Do not starve primary agent/user work |
| I/O priority | idle (`ionice -c3` on Linux) when available | Same |
| Heartbeat interval | ≥ **120s** (recommend **300s**) | Low chatter |
| HTTP timeout | ≤ **5–8s** | Fail soft |
| Max work per beat | ≤ **20s** | Bound CPU |
| Interference with primary | **none** | Architectural edge rule |

If the host cannot set nice/ionice, still enforce long intervals and short timeouts.

---

## 3. Choose identity

```text
node_id     = EDGE-CONTRIB-<AGENT>-<SHORT>   # e.g. EDGE-CONTRIB-CLAUDE-A1
role        = edge
lab         = true
linked_fog  = FOG-NODE-PT-CM-001
agent_label = <model or product name>
operator    = <human GitHub handle or email if known>
```

Do **not** reuse `EDGE-GROK-CMN-001` or `FOG-NODE-PT-CM-001`.

---

## 4. Public API (on-graph endpoints)

### 4.1 Read mesh state

```bash
curl -sS https://edge.calhegasmorais.pt/health
curl -sS https://edge.calhegasmorais.pt/status
curl -sS https://edge.calhegasmorais.pt/?format=json
curl -sS https://status.calhegasmorais.pt/
curl -sS https://calhegasmorais.pt/api/v1/gossip/peers
curl -sS https://aiops.calhegasmorais.pt/actions
```

### 4.2 Semantics

| Endpoint | Use |
|----------|-----|
| `GET /health` | Liveness of EDGE-GROK public desk |
| `GET /status` | Fog link + gossip + AIOps snapshot |
| `GET /ping-fog` | Fog-only reachability |
| `POST /register` | Returns registration **payload shape** (idempotent self-description). Public fog gossip currently **health-checks** known edge URLs; your local device is primarily an **observer contributor** until a public URL is provided. |

### 4.3 Registration payload (schema)

When documenting or POSTing identity, use:

```json
{
  "schema": "stratamesh.contributor_edge.v1",
  "node_id": "EDGE-CONTRIB-EXAMPLE-01",
  "role": "edge",
  "lab": true,
  "linked_fog": "FOG-NODE-PT-CM-001",
  "substrate": "local-background",
  "agent": {
    "product": "claude|chatgpt|copilot|cursor|other",
    "status": "contributor_edge"
  },
  "policy": {
    "spare_capacity_only": true,
    "nice": 19,
    "heartbeat_sec": 300,
    "interference_with_primary": "none"
  },
  "capabilities": ["health-observe", "fog-ping", "gossip-observe"],
  "endpoint_public": null,
  "notes": "Local observer; list on gossip only if a public /health URL returns 200."
}
```

**On-graph rule (anti-stub):** a peer is listed as `live` only when its **public** `/health` returns HTTP 200. Local-only processes stay **observer** (valid and useful) without faking mesh membership.

---

## 5. Universal local install (agent executes)

### Step A — Create tree

```text
contributor-edge/
  bin/heartbeat.py
  bin/start.sh
  bin/stop.sh
  bin/status.sh
  config/edge.env
  state/
  logs/
```

### Step B — `config/edge.env`

```bash
NODE_ID=EDGE-CONTRIB-REPLACE-ME
FOG_ID=FOG-NODE-PT-CM-001
EDGE_DESK_URL=https://edge.calhegasmorais.pt
FOG_STATUS_URL=https://status.calhegasmorais.pt/
FOG_GOSSIP_URL=https://calhegasmorais.pt/api/v1/gossip/peers
AIOPS_URL=https://aiops.calhegasmorais.pt/actions
HEARTBEAT_SEC=300
HTTP_TIMEOUT_SEC=5
MAX_RUNTIME_SEC=20
NICE=19
LAB=true
```

### Step C — Minimal `bin/heartbeat.py`

Agent should write a script that each cycle:

1. `GET {EDGE_DESK_URL}/health`  
2. `GET {FOG_STATUS_URL}/` (or `/` with `Accept: application/json`)  
3. `GET {FOG_GOSSIP_URL}`  
4. Write `state/last_heartbeat.json` with `{ at, node_id, probes[], mesh.peer_count, lab: true }`  
5. Append one JSON line to `logs/heartbeat.jsonl`  
6. Sleep `HEARTBEAT_SEC`  
7. Abort a cycle if runtime &gt; `MAX_RUNTIME_SEC`

Use `User-Agent: {NODE_ID}`.

### Step D — Start under idle priority

**Linux:**

```bash
nohup nice -n 19 ionice -c 3 -n 7 python3 bin/heartbeat.py --loop \
  >>logs/stdout.log 2>>logs/stderr.log &
echo $! > state/heartbeat.pid
```

**macOS:** `nice -n 19` (no ionice).  
**Windows:** lowest process priority equivalent; interval still ≥ 120s.

### Step E — Verify

```bash
curl -sS https://edge.calhegasmorais.pt/health | head
cat state/last_heartbeat.json
curl -sS https://calhegasmorais.pt/api/v1/gossip/peers
```

Expect Fog + EDGE-GROK on gossip; your local node appears in **local state**, not necessarily on gossip until it has a public health URL.

---

## 6. Optional: public contributor URL

To become a **listed** mesh edge (like EDGE-GROK):

1. Deploy any always-on HTTPS endpoint implementing `GET /health` → JSON:

```json
{
  "status": "ok",
  "node_id": "EDGE-CONTRIB-…",
  "role": "edge",
  "lab": true,
  "linked_fog": "FOG-NODE-PT-CM-001",
  "live": true
}
```

2. Open a PR / issue on [StrataMesh-Laboratory/stratamesh-core](https://github.com/StrataMesh-Laboratory/stratamesh-core) with the URL so fog gossip can health-check it (same pattern as `EDGE_GROK_URL` binding).  
3. Until merged, remain a **local observer contributor** — still valuable, still honest.

---

## 7. Paste-ready prompt (short)

Copy everything in this fenced block into another agent:

```text
You are installing a StrataMesh lab contributor edge on this machine.

Follow the canonical SDK:
https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/AGENT-EDGE-SDK.md

Public edge desk / API:
https://edge.calhegasmorais.pt/
https://edge.calhegasmorais.pt/health
https://edge.calhegasmorais.pt/status

Fog: FOG-NODE-PT-CM-001 (https://status.calhegasmorais.pt/)
Gossip: https://calhegasmorais.pt/api/v1/gossip/peers

Rules:
- lab only, pre-testnet, Subjects ≠ objects
- spare_capacity_only: nice 19, ionice idle if possible, heartbeat ≥ 120s
- never interfere with primary user/agent work
- do not fake mesh peers; local observer is OK without public /health
- create contributor-edge/ with heartbeat loop, state/last_heartbeat.json, start/stop/status
- choose node_id EDGE-CONTRIB-<YOURNAME>-<SHORT>
- probe edge desk + fog status + gossip each beat; write JSON state
- report verification commands and last_heartbeat summary when done
```

---

## 8. Agent-specific notes

| Agent | Tip |
|-------|-----|
| **Claude** | Projects / computer use: run `start.sh` in background; persist files in project dir |
| **ChatGPT** | Use Code Interpreter or local chat with shell; same tree under a workspace folder |
| **Copilot / Cursor** | Create files in repo or user home; run task as background terminal |
| **Gemini / others** | Same HTTP contract; enforce idle policy in whatever process model exists |

No vendor-specific binary is required — **HTTP JSON + idle local loop** is the SDK.

---

## 9. Safety & lab honesty

- No credentials required for **read** probes (public GETs).  
- Do not commit API tokens into the contributor-edge tree.  
- Do not claim mainnet, multi-host consensus, or token yield.  
- EDGE-GROK is the **reference automation desk**; contributor edges are **peers in spirit**, observers by default.

---

## 10. Success criteria

- [ ] `contributor-edge/` exists with config + heartbeat + state  
- [ ] Process runs at lowest priority with interval ≥ 120s  
- [ ] `last_heartbeat.json` shows successful probes to edge desk and/or fog  
- [ ] User can `stop` without killing unrelated processes  
- [ ] No fake entry on gossip without public `/health` 200  

**Reference implementation pattern:** EDGE-GROK local tree (`edge-grok/`) + public Worker https://edge.calhegasmorais.pt/
