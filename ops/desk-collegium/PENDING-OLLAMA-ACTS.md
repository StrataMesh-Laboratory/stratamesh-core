# Pending Ollama desk Acts — Fog Assistant fallback 2026-09-07

STRATAGROK offline. Fog Assistant assigns **one Act each** to Hermes / OpenClaw / OpenCode.
Serialize via `deploy/mac-fog/desk-agent-run.sh` — never stack three Ollama slots.

Stuck `dt-d11876e2` ("unit test task", vote ack+nack) is **vapour**. OpenClaw NACK was correct (claw ≠ pytest). Closed below.

## Hermes (`lane-hermes`, coord + academy_teach)

**Act `dt-hermes-teach-20260907`:** one SCA/ACB lesson in outbox (`desk-outbox/journals/hermes/`) from live Fog facts: MariaDB exclusive-off PASS, `oracle_live=false`, M-II = `distinct_second_host`. Cite `docs/FOG-HOST-FALLBACK.md`.

Do **not** pull `qwen2.5:3b-64k`. Keep interim `llama3.2:1b-16k` until 64k generate is clean (`docs/ops/HERMES-CTX-HONESTY.md`).

Meter: `FOG/data/desk-meters/hermes.json` `ok` ∈ {PASS,HOLD,PARTIAL}.

## OpenClaw (`lane-openclaw`, claw)

**Act `dt-claw-hops-20260907`:** run `deploy/mac-fog/openclaw/desk-claw-probe.sh` → `FOG/data/desk-meters/openclaw.json`. Desk8k only (`qwen2.5:3b-desk8k`, timeout 900, `toolSearch=false`).

Do not fake GCP/Oracle 2FA. Hop audit only.

## OpenCode (`lane-opencode`, code)

**Act `dt-code-unittests-20260907`:** replace vapour `dt-d11876e2`.

```bash
cd "$FOG_SRC"
python3 -m unittest discover -s ops/desk-collegium -p 'test_*.py' -v
```

Patch only on FAIL. Write brief `desk-outbox/opencode-next.md` with counts. No vapour PASS.

## Fog Assistant

Does not run Ollama. Lands git. Holds André gates. Next after these three: `#150` desk organ / `#123` GHA ticks.
