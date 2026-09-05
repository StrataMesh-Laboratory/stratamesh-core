# P0 process-gossip ingest guard (0.2.3-lab-wip)

**Status (this page):** historical **n=1 kernel** ingest-guard evidence (0.2.3-lab-wip). **Does NOT describe current lab topology.**  
**Current lab (2026-09-02):** **v0.6.0-lab** · **Adversarial P1** · mesh **n=2**. grok90 two-host INV/TX pack is a later bar ([P0-INV-TX-MULTIHOST.md](./P0-INV-TX-MULTIHOST.md)).  
**Lab only.** Not mainnet · not aBFT · not an investment product · not workers.dev.

This page is the honesty note for the **ingest guard** on `POST /tx/ingest`,
plus five named asserts on top of Track A1. The still-open multi-host gate is
[P0-INV-TX-MULTIHOST.md](./P0-INV-TX-MULTIHOST.md). A1 itself is
[A1-PRIVATE-MESH.md](./A1-PRIVATE-MESH.md) (one runner, three OS processes).

Fog kernel **at ingest-guard landing:** `FOG-NODE-PT-CM-001` · n=1 · `oracle_live=false` · `mesh_member=false`. **Do not copy those n=1 flags as today’s live lab.** Today: n=2 pair; public `/health` n=1 is session-origin software flag.

Design source: Fog Assistant chat `c765a597` (reviewed). Bot lands because the
Assistant PAT is `contents:write` 403.

---

## 0. What this cut is / is not

| Is | Is not |
|----|--------|
| HTTP ingest validation on one Fog process | Two-host INV/TX (grok90 ≠ this box) |
| Duplicate INV/TX idempotence evidence | Closing P0 |
| Malformed TX → 400 `SYNTAX_ERRORS` | Worker gossip / `workers.dev` |
| Semantic reject → 200 `accepted=false` | Re-doing A1 kill/catch-up |
| Same CI job as process-gossip | Merging #16 / #36 (already historical; out of this fence) |

A1 remains the live process bar: 3 PIDs, 0% tx-count spread, SIGTERM one
process, SQLite restart catch-up (`src/test_process_gossip.py`). This cut
**adds** asserts A1 does not already make. It does not replace them.

---

## 1. Ingest guard (`src/p0_ingest_guard.py`)

Wired **only** in `POST /tx/ingest` (`src/node_persistent.py`). Other handlers
are untouched.

### 1.1 HTTP 400 — `SYNTAX_ERRORS`

| Input | Result |
|-------|--------|
| Body is not JSON | 400 `SYNTAX_ERRORS` / `bad json` |
| Missing `tx_id` | 400 `SYNTAX_ERRORS` / `missing tx_id` |
| Blank / whitespace `tx_id` | 400 `SYNTAX_ERRORS` / `blank id` |

No DAG attach. No extra vertex.

### 1.2 HTTP 200 — `accepted=false`

| Input | Code |
|-------|------|
| `tx_id` already in the local DAG | `DUPLICATE_TX` |
| Empty `parents` after genesis exists (second root) | `SECOND_ROOT` |
| `tx_type` not in WIRE / `TxType` | `BAD_TYPE` |
| Unknown / non-string / blank parent ids | `BAD_PARENTS` |

Idempotent: duplicate `tx_id` is a no-op (I5 / WIRE §4.3–4.4). Second
empty-parents vertex is forbidden once genesis is present.

Valid ingest (`tx_id` new, parents exist, type known) still returns
`{"accepted": true, "tx_id": …}` after `DAG.attach`.

---

## 2. Five named asserts on top of A1

Run: `python3 src/test_p0_ingest.py` (also a step on
`.github/workflows/process-gossip.yml`, same job as kill/catch-up).

| Id | Assert | A1 already? |
|----|--------|-------------|
| **P0-A1-DUP-INV** | Duplicate gossip `INV` (known ids, plus a fake id) adds **no** extra ledger vertex | No |
| **P0-A1-DUP-TX** | Duplicate `TX` / `POST /tx/ingest` of the same `tx_id` → **exactly one** state transition | No |
| **P0-A1-MALFORMED** | Malformed TX (bad JSON, missing `tx_id`, blank id) → HTTP **400** `SYNTAX_ERRORS` | No |
| **P0-A1-ROOT** | Second empty-parents root → HTTP 200 `accepted=false` | No |
| **P0-A1-TYPE** | Bad `tx_type` → HTTP 200 `accepted=false` | No |

Kill-one + restart catch-up stays in `test_process_gossip.py`. Do not drop it.

---

## 3. Honesty (n=1 kernel)

- One Actions runner / one operator box. Loopback HTTP. Not grok90 ↔ box.
- `same_host_as_edge_local` remains true for Fog `:8787` + EDGE `:8788`.
- Evidence here is protocol ingest, not a mesh membership claim.
- Until [P0-INV-TX-MULTIHOST.md](./P0-INV-TX-MULTIHOST.md) §2.4 evidence pack
  exists, **P0 stays OPEN**.
- No wrangler. No Pages Direct Upload. No `workers.dev`. No Worker HTTP.

---

## 4. File fence (this PR)

Owned:

- `src/p0_ingest_guard.py` (new)
- `src/node_persistent.py` — `POST /tx/ingest` only
- `src/test_p0_ingest.py` (new named asserts)
- `.github/workflows/process-gossip.yml` — one extra command on the existing job
- `docs/P0-PROCESS-INV-TX.md` (this page)
- `docs/CHANGELOG-LAB.md` — one prepended `0.2.3-lab-wip` note

Not owned (metabolism / ops stream): `ops/`, `ops-monitor/`, `metabolism.py` /
`metabolism.js`, `ops-watchdog`, `rails.json`, `ledger.json`, `workers/`,
`renovate.json`.

---

Document version: P0-PROCESS-INV-TX · 2026-08-29 · LAB · n=1 · P0 OPEN
