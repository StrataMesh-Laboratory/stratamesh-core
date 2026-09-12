# Hermes context fix (Mac Fog)

## Requirement
Hermes Agent needs **≥65536** context. Tags that report 32k (many mistral/llava) fail agent init.

## 8GB Intel Mac path (current)

Do **not** pull `qwen2.5:7b` as the local primary on 8GB — it OOMs / thrash under desk load. Local `llama3.2:1b-64k` *generate* can also timeout when RAM is contended; that is not a reason to pull 7b.

### A — Recommended live setup
1. **Cloud primary:** `gpt-oss:20b` via `https://ollama.com/v1` with `context_length: 131072` (live `~/.hermes/config.yaml`).
2. **Local floor / fallback tag:** `llama3.2:1b-64k` (Modelfile `num_ctx 65536`; Ollama reports context length 131072).
3. Run `python3 deploy/mac-fog/hermes/ensure_workspace.py` — prefers gpt-oss cloud, then `llama3.2:1b-64k`, repairs session defaults.

Prove: `status/hermes_64k_prove_20260912.txt` + `$FOG/data/desk-meters/hermes-64k.json`.

### B — Larger local models (only with clear free RAM)
```bash
# only when free RAM clearly allows (not default on 8GB Fog Mac)
ollama pull qwen2.5:7b
```
```yaml
model:
  name: qwen2.5:7b
  context_length: 65536
  base_url: http://127.0.0.1:11434/v1
```

### C — Do not force 64k on a 32k model
Setting `context_length: 65536` on a true 32k window truncates/corrupts.

## Meter
`$FOG/data/desk-meters/hermes-64k.json` — require `live_cloud_ok` or `show_ok`; do not require local `generate_ok` on 8GB.
