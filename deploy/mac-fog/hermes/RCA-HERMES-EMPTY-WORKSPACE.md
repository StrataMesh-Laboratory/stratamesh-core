# RCA: Hermes Desktop empty workspace (FOG-CMN-DESK)

**Date:** 2026-09-06 (~02:21–02:30 PT)  
**Host:** MBPA (Intel Mac, SSH `hermes-desk`)  
**Symptom:** Hermes.app Gateway ready, model shown, center welcome “HERMES AGENT”, sidebar Sessions: **“No sessions yet”**. Operator expected FOG-CMN-DESK usable.

## Official references (do not invent APIs)

- Desktop / discovery / `--cwd`: https://hermes-agent.nousresearch.com/docs/user-guide/desktop
- CLI (`hermes project`, `hermes sessions`, `hermes chat --in`, `hermes config`): https://hermes-agent.nousresearch.com/docs/reference/cli-commands
- Multi-connection / Gateways / SSH remotes: https://hermes-agent.nousresearch.com/docs/user-guide/multi-connection-desktop
- Session storage (`state.db`, cwd / message_count): https://hermes-agent.nousresearch.com/docs/developer-guide/session-storage
- OAuth / SSH remote auth notes: https://hermes-agent.nousresearch.com/docs/guides/oauth-over-ssh

## Timeline (causal)

1. **Mid-quit / update** — Desktop update or quit left a `source=desktop` session with `message_count=0`, empty `cwd`/`git_repo_root`, `end_reason=ws_orphan_reap`.
2. **Orphan reap** — Empty WS orphan is not listable; desktop `listSessions(min_messages=1)` hides it.
3. **In-project empty copy** — With active project FOG-CMN-DESK, sidebar uses i18n `projectEmpty` (“No sessions yet”) when no in-project session passes the filter (cwd under a project folder **and** ≥1 message).
4. **Discovery policy cache** — `projects.db` `project_meta.repo_discovery_policy.roots` is a **policy cache**, not the durable control. Bare SQLite JSON writes are **clobbered** when Hermes reconciles from config. Durable control is `config.yaml`:
   ```yaml
   desktop:
     repo_scan_enabled: true
     repo_scan_roots: [/Users/andremorais/StrataMesh, /Users/andremorais/StrataMesh/fog/repo]
     repo_scan_exclude_paths: []
   ```
   Prefer `hermes config set` (official). Empty roots = default home scan (docs), not “no scan”.
5. **Model mismatch (amplifier)** — `model.default=qwen2.5:7b` while Ollama tags were only `llama3.2:1b`, `llama3`, `phi3`, `mistral`, `llava`. UI could look “ready” while turns fail; ensure must assert default ∈ `ollama list`.

## Causal chain (short)

```
update/quit → desktop session orphan (0 msgs, no cwd)
            → min_messages=1 filter + projectEmpty
            → welcome + “No sessions yet”
(+ optional) raw sqlite roots clobber / missing repo_scan_roots durability
(+ optional) model.default not in Ollama tags
```

## Why seeding the project alone is insufficient

- `hermes project` folders + `active_id` only define **workspace membership**.
- Sidebar sessions require a **listable session**: `message_count ≥ 1` and `cwd` under a FOG-CMN-DESK folder (typically `…/fog/repo`).
- `hermes chat -q … --in <dir>` may create a message **without** stamping `cwd`/`git_repo_root`; must call SessionDB `update_session_cwd` (or equivalent) after seed.
- “New session” in UI without `--cwd` / `HERMES_DESKTOP_CWD` can again detach from the project.

## Structural fix (owned by ensure)

See `ensure_workspace.py` + `WORKSPACE.md`:

1. `hermes config set` for `desktop.repo_scan_*`
2. `hermes project use` / folders / primary for FOG-CMN-DESK
3. `HERMES_DESKTOP_CWD` in `~/.hermes/.env`
4. Model default ∈ Ollama tags
5. Delete empty orphans (`delete_empty_sessions` / prune 0-msg)
6. Seed one listable session `--in fog/repo`, then **stamp cwd** via SessionDB
7. Wire into desk pulse / post-update recycle

## Assert needles (tests)

| Needle | Fail if |
|--------|---------|
| `desktop.repo_scan_roots` | empty list / missing StrataMesh or fog/repo |
| active project | not `fog-cmn-desk` or missing primary `…/fog/repo` |
| listable session | zero sessions with `message_count≥1` and cwd under fog/repo |
| model | `model.default` not in `ollama list` tags |
| orphans | open 0-msg desktop sessions with `ws_orphan_reap` (warn/fail after ensure) |

## Debug artifacts

`/Users/andremorais/StrataMesh/fog/data/desk-outbox/hermes-empty-rca/` (project_meta, sessions summary, desktop_config — no secrets).

## Operator note

After ensure + soft relaunch (`hermes desktop --cwd …/fog/repo --skip-build`), sidebar should show the seeded FOG-CMN-DESK session. If still welcome-only, one **New session** while workspace cwd is fog/repo is enough — ensure owns durability so the next recycle does not regress.
