# Hermes context fix (Mac)

## Error
`llava` reports **32768** tokens; Hermes Agent requires **≥65536**.

## Fix (pick one)

### A — Recommended: pull a ≥64K model, point config
```bash
ollama pull qwen2.5:7b
# optional later if RAM allows:
# ollama pull hermes3:8b
```

Copy `deploy/mac-fog/hermes/config.example.yaml` → `~/.hermes/config.yaml` (or Hermes desktop Settings → config path).

Ensure:
```yaml
model:
  name: qwen2.5:7b   # or hermes3:8b
  context_length: 65536
  base_url: http://127.0.0.1:11434/v1
```

Restart Hermes desktop → Retry agent init.

### B — Only if the model *truly* has ≥64K but Ollama under-reports
Set `model.context_length: 65536` (or real window). **Do not** force 64K on llava — it will truncate/corrupt.

### C — Keep llava for vision tooling later
Not as the Hermes *agent* model. Agent model must clear 64K.

## RAM note
Mac Fog often has little free RAM. Prefer `qwen2.5:7b` Q4 over 14B/70B until MEM headroom returns.
