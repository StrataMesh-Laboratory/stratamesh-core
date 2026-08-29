# Academy desk lesson — 2026-08-29 PT

**Surface:** git academy (`docs/academy/`). Discourse [t/20](https://stratamesh.discourse.group/t/edge-grok-ops-pulse-mesh-api-edge-discovery-lab/20) is the EDGE-GROK **ops pulse**, not the student surface. Do not paste this lesson there.

**This is TRAINING, not a torch pass.** No new Worker crons. No wrangler deploy. No `workers.dev`. No 6th CF cron. LAB only. No investment claims.

**Students:** Orchestrator `SCA-ORCH-CMN-001` and the AIOps team (devops / security / analysis / mesh / economy).
**Not a student / not an SCA:** `grok@calhegasmorais.pt` is Fog `external_assistant` at secret. Holonic layer (see `docs/HOLONIC-LAYERS.md`): Orchestrator + AIOps sit in **SO do Metaverso**; grok@ does not.

**Unready rule (fail closed):** missing handlers **or** empty `next_actions` = **unready**. Do not fulfill. Do not ship. Do not pass the torch. Green + empty `mandatory_actions` in `stratamesh.handoff.v1` is HOLD-success for the *handoff snapshot* (`docs/AIOPS-HANDOFF-LOOP.md`); it is **not** a claim that Orchestrator/AIOps can run desk jobs.

Authoritative machine schema (consume, do **not** rewrite tonight): `ops/HANDOFF-LATEST.json` (`schema: stratamesh.handoff.v1`).

---

## 0. What you will one day run (not tonight)

| Actor | One-day job | Tonight |
|-------|-------------|---------|
| AIOps `GET /cycle` | Probe live surfaces, emit `findings` + `next_actions` with **named handlers** (`id`, `priority`, `owner`, `verb`, `success_check`, `effort`) | Unready if `next_actions` is `[]` while work is claimed, or if any `verb` has no handler |
| AIOps `GET /actions` | Live delegation list rebuilt from probes + handoff tiers | `/actions` hard_cap 0 (hangs on live 1.10.3). Never treat silence as green. Rail `aiops-actions` forbidden |
| Orchestrator `GET /api/orchestrator/actions` and `/handoff` | **Read-only** consume of AIOps (`env.AIOPS.fetch`). Honest `{ok:false,error,source:"aiops"}` on failure | Does **not** POST, does not run `mandatory_actions`, does not add crons, does not stand in for 09:00 Dev Cycle |
| 09:00 Lisbon Dev Cycle | `GET /actions` then at most two ships, else HOLD | Still desk-owned. Train, then retest |
| Local `ops-watchdog` | Loop: `sample_live()` then `live_decide_kwargs()` then `decide()` with `hour_spent`, coalesce intents, probe only on ALLOW | **Already looping locally.** Loopback `monitor.env` is local-only (not in git) |
| Deployed CF Workers | Import `workers/_metabolism.js` so Worker HTTP is Q-gated | **Do not import by deploying.** Source file exists; **live Workers still do not import it.** Leave them |

If a handler is missing for a `verb` you emit, drop the action and stay HOLD. Inventing a handler is a fail.

---

## 1. Dual Assistants (one prompt per thread)

| Surface | Chat id (prefix) | Owns | Must not |
|---------|------------------|------|----------|
| **CMN FOG ASSISTANT** | `c765a597` (project Nó Calhegas Morais / STRATAMESH LAB) | Fog protocol, ingest-guard design, Fog MariaDB DSN (`fog_cmn`, `FOG_MYSQL_URL`), host fingerprint on `:8787` | EDGE desk UI, grok.me publish, mixing MariaDB into EDGE |
| **CMN EDGE ASSISTANT** | `57f83a9d` | EDGE preview **consume-origin** of `https://edge.calhegasmorais.pt/` (unpublished) | Fog SQLite/MariaDB, `FOG_MYSQL_URL`, phpMyAdmin, ingest-guard |

Rules you will enforce:

1. **One prompt per thread.** Never a mixed Fog+EDGE todo list in one Assistant turn.
2. **Bot reviews, then lands git.** Assistant PAT is `contents:write` 403. Design in chat; Bot commits on `StrataMesh-Laboratory/stratamesh-core`.
3. **Never mix Fog MariaDB into EDGE.** `FOG_MYSQL_URL` / `fog_cmn` / phpMyAdmin `127.0.0.1:3306` are Fog-only (`docs/FOG-MARIADB-ADAPTER.md`). EDGE `:8788` does not import `src/fog_db.py`.
4. STRATAGROK is one EDGE-GROK desk on two surfaces (`ops/EDGE-GROK-DESK-CONTRACT.md`). SuperGrok does **not** refill Cloudflare or Hugging Face.

---

## 2. v0.2.2-lab honesty (read before any ready claim)

Baseline: `docs/RELEASE-v0.2.2-lab.md` + `docs/CHANGELOG-LAB.md`.

| Fact | Value |
|------|--------|
| Cut | **v0.2.2-lab**. Ingest guard is `0.2.3-lab-wip` on top — n=1 kernel evidence only |
| P0 | **OPEN.** Gate: `docs/P0-INV-TX-MULTIHOST.md`. Process ingest (`docs/P0-PROCESS-INV-TX.md`, #48) **does not close** it |
| Out of this cut | **#16** Worker gossip · **#36** on-graph STRATA (NFT/ACB/user) |
| Kernel | `FOG-NODE-PT-CM-001` n=1 · `oracle_live=false` · `mesh_member=false` · `same_host_as_edge_local=true` |
| Lab | Not mainnet · not aBFT · not an investment product |

A1 (`src/test_process_gossip.py`) is one Actions runner / three OS processes. That is **not** two hosts.

---

## 3. Metabolism v1.3 circuit — NOW WIRED (#47), properties (#49)

Library: `ops/lib/metabolism.py` and `ops-monitor/lib/metabolism.py` (do not edit in this lesson). Formula unchanged:

    hourly_cap   = remaining / max(hours_until_renewal, 1/60)
    pace_factor  = clamp(time_frac / spent_frac, 0.5, 1.5)   # 1.0 if day_spent==0
    adjusted     = hourly_cap × pace_factor
    circuit HOLD   if hour_spent ≥ 1.25 × hourly_cap     # UNADJUSTED cap
    circuit STASIS if hour_spent ≥ 2    × hourly_cap     # UNADJUSTED cap

An inflator must not bypass Error 1027. Circuit uses **unadjusted** `hourly_cap`.

What #47 actually wired (callers, not the formula):

- Live `remaining` + UTC-hour `hour_spent` into `decide()` / `snapshot()` / `live_decide_kwargs()`.
- CF GraphQL `used` recorded as `day_spent` so `pace_factor` can inflate/deflate.
- GraphQL/sample failure → that rail is `unknown` → **HOLD**. **Never invent `remaining=100000`.**
- Expired `reset_unix` / `reset_iso` without a live refresh → HOLD (no 1-minute dump cap).
- Local `ops-watchdog` samples then `decide(rail, remaining=..., hour_spent=...)` (see `ops/bin/ops-watchdog` and `ops-monitor/bin/ops-watchdog`).

#49: Hypothesis properties on v1.3 invariants (`ops/lib/test_metabolism_hypothesis.py` and the ops-monitor copy). Run them locally; do not treat a skipped property as green.

**Workers:** `workers/_metabolism.js` is in git. **Deployed Workers still do not import it.** Do **not** `wrangler deploy` to close that gap. Metabolism tonight is a **request-time library + local watchdog**, not a 6th cron.

CF Free crons stay **5/5** (ACB `30 0 * * *`, AIOps `0 1 * * *`, briefing, dao, poc). Never a 6th. Never `workers.dev` (zone WAF hole, INC-1027).

---

## 4. Renovate (dashboard #46 — wait for Monday)

Issue: https://github.com/StrataMesh-Laboratory/stratamesh-core/issues/46 (`Dependency Dashboard`).

| Rule | Action |
|------|--------|
| **58** updates | Awaiting schedule (`before 6am on Monday` UTC). Do not unschedule them tonight |
| Patches | Automerge **after checks** for listed JS/TS dev tooling and GitHub Actions **patch** only (`renovate.json`) |
| Majors | **STRATAGROK review, then merge.** Never automerge vite / react / typescript majors, wrangler, Cloudflare, pg, better-auth, kysely, crypto/ledger/consensus |
| Create-all | **Do not** tick the dashboard "Create all awaiting schedule PRs at once" control |

No `renovate create-all`. No concurrent PR storm (`prConcurrentLimit: 5` is already the cap).

---

## 5. EDGE preview / grok.me

- EDGE Assistant (`57f83a9d`) **consume-origin** of `https://edge.calhegasmorais.pt/`. Preview is **unpublished**.
- `https://calhegasmorais.grok.me` is **HOLD** (unbound / 404). Do not click Publish. Pages origin `https://calhegasmorais.pt/` stays source of truth (fail-open).
- Do not probe Worker chat/API to "align" preview.

---

## 6. Operator VPNs (loopback beside Tor)

Authorized beside the existing Tor stack. Distro packages. **Never default-route the box.**

| Plane | Bind | Overlay |
|-------|------|---------|
| WireGuard `wg0` | UDP 51820 firewalled to `lo` | `10.88.0.0/24` (`Table = off`) |
| OpenVPN TCP | `127.0.0.1:1194` | `10.89.0.0/24` |
| Tor SOCKS | `127.0.0.1:9050` | unchanged |

**Cloudflare GraphQL, GitHub, and wrangler stay off VPN and off Tor** (already excluded). A `0.0.0.0/0` AllowedIPs / `redirect-gateway` is a fail. Do not kill cloudflared, Fog `:8787`, EDGE `:8788`, nginx `:443`, MariaDB `:3306`, tor SOCKS.

Runbook: local desk `ops-monitor/OPERATOR-VPN.md`. Not an anonymity / aBFT / mainnet claim.

---

## 7. Dry-run checklist (you can FAIL)

No Worker HTTP. No wrangler. No `workers.dev`. Fixtures only. Run from a checkout of `stratamesh-core` that already has #47/#49.

### 7.1 Circuit JSON has `hour_spent` (must FAIL if missing)

Save as `/tmp/academy-dry-run-metab.py` and run `python3 /tmp/academy-dry-run-metab.py` from the repo root:

    import sys
    from datetime import datetime
    from pathlib import Path
    from zoneinfo import ZoneInfo

    for root in (Path("ops-monitor/lib"), Path("ops/lib")):
        if (root / "metabolism.py").exists():
            sys.path.insert(0, str(root.resolve()))
            break
    else:
        raise SystemExit("FAIL: metabolism.py not found (ops-monitor/lib or ops/lib)")

    from metabolism import HOLD, snapshot

    LISBON = ZoneInfo("Europe/Lisbon")
    now = datetime(2026, 8, 29, 4, 0, tzinfo=LISBON)
    ledger = {"schema": "x", "rails": {}}

    # A — wired caller: hour_spent present; 1.25x unadjusted cap -> HOLD
    live = {"cf-worker-req": {"remaining": 80000, "hour_spent": 5000, "used": 20000}}
    row = snapshot(now, live=live, ledger=ledger)["rails"]["cf-worker-req"]
    if "hour_spent" not in row:
        raise SystemExit("FAIL: decide()/snapshot cf-worker-req JSON missing hour_spent — circuit not wired")
    if row["hour_spent"] != 5000:
        raise SystemExit("FAIL: hour_spent mismatch")
    print("7.1a PASS hour_spent=", row["hour_spent"], "decision=", row["decision"], "circuit=", row.get("circuit"))

    # B — unknown remaining must HOLD; must not invent 100000
    row_u = snapshot(
        now,
        live={"cf-worker-req": {"unknown": True}},
        ledger={"schema": "x", "rails": {}},
    )["rails"]["cf-worker-req"]
    if row_u["decision"] != HOLD:
        raise SystemExit("FAIL: unknown remaining was not HOLD")
    if row_u.get("remaining") == 100000:
        raise SystemExit("FAIL: invented remaining=100000")
    if "do not invent a cap" not in (row_u.get("reason") or ""):
        raise SystemExit("FAIL: unknown remaining reason missing fail-closed text")
    print("7.1b PASS unknown HOLD (no invented 100k)")

Also run the landed unit + Hypothesis gates (local, no deploy):

    python3 ops/lib/test_metabolism.py CircuitWiredCallers
    python3 ops/lib/test_metabolism_hypothesis.py
    python3 ops-monitor/lib/test_metabolism.py CircuitWiredCallers
    python3 ops-monitor/lib/test_metabolism_hypothesis.py

**FAIL** if `CircuitWiredCallers` is missing, if `hour_spent` is absent from the JSON, if unknown remaining becomes ALLOW with `remaining=100000`, or if Hypothesis properties are skipped.

### 7.2 P0 docs still OPEN (must FAIL if closed)

Save as `/tmp/academy-dry-run-p0.py` and run `python3 /tmp/academy-dry-run-p0.py` from the repo root:

    from pathlib import Path
    p0 = Path("docs/P0-INV-TX-MULTIHOST.md").read_text()
    proc = Path("docs/P0-PROCESS-INV-TX.md").read_text()
    if "**Status:** OPEN" not in p0 and "Status: OPEN" not in p0:
        raise SystemExit("FAIL: P0-INV-TX-MULTIHOST.md is not OPEN")
    if "Does NOT close multi-host P0" not in proc and "P0 stays OPEN" not in proc:
        raise SystemExit("FAIL: P0-PROCESS-INV-TX.md no longer says P0 stays OPEN")
    print("7.2 PASS P0 still OPEN (ingest guard is n=1 kernel, not mesh)")

### 7.3 Unready / no-claim gates (must FAIL if you would emit these)

Tick **fail** if any of the following would appear in an Orchestrator or AIOps `next_actions` / handoff / pulse:

| Claim | Why it fails |
|-------|----------------|
| Multi-host mesh / `mesh_member=true` | n=1, `same_host_as_edge_local=true`. Fog `:8787` + EDGE `:8788` is one kernel |
| Mainnet / aBFT / funded Challenge 0 | LAB. Challenge 0 unfunded |
| Passing the torch / claiming the 09:00 Dev Cycle | Missing handlers or empty `next_actions` = unready |
| Worker gossip as P0 / merging #16 | #16 is out of v0.2.2-lab. Worker peer lists are not INV/TX |
| `wrangler deploy` to import `_metabolism.js` | Forbidden tonight. Local library + watchdog is the wired path |
| 6th CF cron | Still 5/5. Metabolism is not a cron |
| `workers.dev` probe | INC-1027 hole. `decide()` must STASIS that URL |
| Fog MariaDB on EDGE | Dual-Assistant split |
| Ticking Renovate create-all / unscheduling the 58 | Monday schedule |
| Publishing grok.me | HOLD |

---

## 8. Read-next (existing paths — do not rewrite them in this lesson)

| Path | Why |
|------|-----|
| `ops/HANDOFF-LATEST.json` | `stratamesh.handoff.v1` machine snapshot (consume) |
| `docs/AIOPS-HANDOFF-LOOP.md` | Fallback order, `/actions` vs Orchestrator proxy, torch HOLD |
| `docs/AIOPS-DEV-TEAM.md` | Five-agent mandate |
| `docs/HOLONIC-LAYERS.md` | Nested stack; Orchestrator/AIOps in SO Metaverso |
| `docs/ORCHESTRATOR-HYBRID-ARCHITECTURE.md` | Bilateral bus — scaffolding, not live fulfillment |
| `ops/EDGE-GROK-DESK-CONTRACT.md` | Bot vs Assistant split |
| `docs/P0-INV-TX-MULTIHOST.md` | P0 OPEN gate |
| `docs/P0-PROCESS-INV-TX.md` | n=1 ingest guard honesty (owned by the ingest stream — do not edit) |
| `docs/RELEASE-v0.2.2-lab.md` | Honesty cut |
| `docs/FOG-MARIADB-ADAPTER.md` | Fog-only DSN |

---

Document version: academy-desk-lesson · 2026-08-29 PT · TRAINING · LAB · n=1 · P0 OPEN · torch HOLD
