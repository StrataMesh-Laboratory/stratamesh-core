# Hermes workspace — FOG-CMN-DESK (Mac)

Automation-desk map for native Hermes Desktop on MBPA. **New session is not enough** if cwd is detached from the project; `ensure_workspace.py` owns durability after update/reboot/recycle.

## Official docs

- Desktop (discovery, `--cwd`, Gateways): https://hermes-agent.nousresearch.com/docs/user-guide/desktop
- CLI reference: https://hermes-agent.nousresearch.com/docs/reference/cli-commands
- Multi-connection desktop: https://hermes-agent.nousresearch.com/docs/user-guide/multi-connection-desktop
- Session storage: https://hermes-agent.nousresearch.com/docs/developer-guide/session-storage
- OAuth over SSH: https://hermes-agent.nousresearch.com/docs/guides/oauth-over-ssh

## Canonical paths

| Role | Path |
|------|------|
| Fog repo (primary) | `/Users/andremorais/StrataMesh/fog/repo` |
| StrataMesh root | `/Users/andremorais/StrataMesh` |
| Hermes home | `~/.hermes` |
| App | `~/.hermes/hermes-agent/apps/desktop/release/mac/Hermes.app` |
| Project id | `fog-cmn-desk` (name FOG-CMN-DESK) |
| Outbox | `$FOG_HOME/data/desk-outbox` |

## Discovery (durable)

Official control is **config.yaml**, not raw `projects.db` `project_meta`:

```yaml
desktop:
  repo_scan_enabled: true
  repo_scan_roots:
    - /Users/andremorais/StrataMesh
    - /Users/andremorais/StrataMesh/fog/repo
  repo_scan_exclude_paths: []
```

```bash
hermes config set desktop.repo_scan_enabled true
hermes config set desktop.repo_scan_roots [/Users/andremorais/StrataMesh,/Users/andremorais/StrataMesh/fog/repo]
```

Empty `repo_scan_roots` = default home scan (docs). Policy rows in `project_meta` are reconciled from this config — bare SQLite edits get clobbered while Hermes runs.

## Project CLI

```bash
hermes project use fog-cmn-desk
hermes project show fog-cmn-desk
hermes project add-folder fog-cmn-desk /Users/andremorais/StrataMesh/fog/repo
hermes project set-primary fog-cmn-desk /Users/andremorais/StrataMesh/fog/repo
# optional kanban
hermes project bind-board fog-cmn-desk desk
```

## Launch with workspace cwd

```bash
export HERMES_DESKTOP_CWD=/Users/andremorais/StrataMesh/fog/repo   # also in ~/.hermes/.env
hermes desktop --cwd /Users/andremorais/StrataMesh/fog/repo --skip-build
```

## Sessions (listable = visible in project sidebar)

Desktop filters with `min_messages=1` and project-folder cwd match. Seed:

```bash
hermes chat -q "FOG-CMN-DESK desk seed. Reply exactly: ACK" --oneshot -Q \
  --in /Users/andremorais/StrataMesh/fog/repo
# Then ensure stamps cwd via SessionDB.update_session_cwd (chat --in alone may omit cwd).
hermes sessions list --workspace fog
```

Prune empty orphans (0 messages / ws_orphan_reap) via ensure — do not leave them as the only desktop rows.

## Model ↔ Ollama (≥64K + tools)

Hermes agent init requires **context ≥ 65536** (see CONTEXT-64K.md). Prefer installed OSS tags that also expose **tools**:

1. `llama3.2:1b` — desk smoke OK (131072 + tools)
2. `qwen2.5:*` after pull
3. Avoid as agent default: `mistral` / `llava` (~32k), `phi3` (no tools on this desk)

```bash
hermes config set model.default llama3.2:1b
hermes config set model.context_length 131072
```

## Desk integration

| Surface | How |
|---------|-----|
| Pulse | `deploy/mac-fog/hermes/desk-hermes-pulse.sh` → runs ensure then desk-agent-run |
| Desk agent | `desk-agent-run.sh hermes` calls ensure before meters |
| Post-update | `fog-auto-update.sh` should invoke ensure after Hermes update (hook) |
| OpenClaw | `hermes claw` / desk-claw-probe (peer specialty) |
| Remote Mac↔box | Settings → Gateways: SSH or Remote `hermes serve`; prefer Tailscale (see multi-connection + oauth-over-ssh docs) |
| Bot Mode / peers | Desktop Bot Mode + `hermes peer` for cross-machine Fog/EDGE later |

## Operator checklist after blank UI

1. `python3 deploy/mac-fog/hermes/ensure_workspace.py`
2. `python3 deploy/mac-fog/hermes/test_ensure_workspace.py`
3. Soft relaunch: `hermes desktop --cwd …/fog/repo --skip-build`
4. Confirm sidebar shows ≥1 FOG-CMN-DESK session — if welcome only, one New session **with** fog/repo cwd, then re-run ensure so recycle keeps it.

Do **not** rely on one-shot chat seeds alone; ensure owns project + discovery + cwd-stamped session + model check.

See also [MODELS-METABOL.md](./MODELS-METABOL.md) for primary/fallback metabol_pace.
