# HANDOFF-LATEST — 2026-09-02 PT (André honesty)

**generated_at:** 2026-09-02T11:11:00Z
**lisbon:** 2026-09-02T12:11:00+0100
**agent:** STRATAGROK / grok@calhegasmorais.pt
**node:** FOG-NODE-PT-CM-001
**edge:** EDGE-GROK-CMN-001 (EDGE-GROK local)
**phase:** adversarial_lab_P1
**tag:** v0.5.1-lab

Lab only. grok@ is not an SCA. No mainnet / aBFT / investment claims.

## Current lab truth (mandatory)

| Item | Value |
|------|-------|
| Version | **v0.5.1-lab** (live/lab). Not 0.4.1. README/others that still said 0.4.1 were stale. |
| Mesh | **n=2** — Mac Fog `FOG-NODE-PT-CM-001` + EDGE-GROK local `EDGE-GROK-CMN-001`. Do **not** say n=1 kernel / n=1 until proven. |
| Phase | **Adversarial LAB phase P1**. Not “P0 as the lab phase”. |
| grok90 INV/TX pack | Later bar, not the current phase name. Gate: `docs/P0-INV-TX-MULTIHOST.md`. |
| Public Fog `/health` | May still JSON `n=1` `origin=session` `mac_live=false`. That is a **session-origin software flag**, not “the lab is n=1”. Do **not** claim `mac_live=true` on public JSON. |
| Hosts | Two. Do not invent a 6th host. |

## Metabolism

| Item | Value |
|------|-------|
| Hourly git+live #52 | **PAUSED** (SuperGrok). Daily 04 observe · 09 ship · 18 t/20 · 23 handoff |
| CF Workers | STASIS ledger [#80](https://github.com/StrataMesh-Laboratory/stratamesh-core/issues/80). **STASIS is pace, not freeze.** Freeze = temporary holding until contingency routes (auth python hop, Pages, sandbox host). No Worker PUT from this desk |
| Fog metabol | metabol-v1.3 remaining=1000 ALLOW (different meter from CF spend) |
| 6th cron | **never** |
| workers.dev | **never** |
| grok.me | **HOLD** (no Publish from this desk) |
| wrangler deploy | **HOLD** while #80 |

## Live curl vs lab mesh

- Public `https://fog.calhegasmorais.pt/health` may still report `origin=session` `n=1` `mac_live=false` `edge_live=false`. Treat as session-origin software flag / hop lag. Lab mesh remains **n=2**.
- Tag **v0.5.1-lab**. Hop JSON version may lag the tag (session software). Curl of that JSON does not rewrite the lab phase.
- Public `edge.calhegasmorais.pt/health` may be maintenance HTML, not hop JSON. That is not a sixth host and not proof the local EDGE-GROK is absent.
- POST `/api/orchestrator/chat` reliability is a Worker/API issue. Not a mesh-n rewrite.

## P0 / P1

- **Current phase name: P1 (Adversarial LAB).** Two-host CMN pair is the live lab mesh.
- Multi-host **grok90 INV/TX evidence pack** stays a later honesty bar (`docs/P0-INV-TX-MULTIHOST.md`). Do not rename the current phase “P0”.
- Ingest-guard “n=1 kernel” (`docs/P0-PROCESS-INV-TX.md`) is **historical kernel evidence**, not current lab topology.
- CF Workers spend ≥ cap (#80): STASIS = **pace**; contingency holds until auth python hop / Pages / sandbox host.

## NEXT PICK

1. Docs/status language matches v0.5.1-lab · Adversarial P1 · n=2 (this note).
2. No Worker PUT while #80. No workers.dev. No 6th cron. No grok.me Publish.
3. Do not boot Fog from STRATAGROK computer. Do not claim public JSON `mac_live=true`.
4. grok90 two-host INV/TX pack remains a later bar, not this hour’s phase rename.

LAB. Session `/health` JSON does not override n=2.
