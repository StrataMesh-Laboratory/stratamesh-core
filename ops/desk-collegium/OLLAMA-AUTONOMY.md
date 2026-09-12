# Ollama specialty autonomy — Fog law

Hermes, OpenClaw and OpenCode are equal specialists. They do not wait for a
STRATAGROK prompt to take the next Act on their lane.

- Cycle writes `desk-outbox/{hermes,openclaw,opencode}-next.md` from the live board.
- `status: null` becomes `propose`. Owner infers specialty when it is missing.
- Mac `fog-auto-update.sh` runs **one** `desk-agent-run.sh` specialty per 1800s pulse (RR). Never three at once on 8GB.
- Close only via `desk_agent_finish.py` + non-empty evidence. Binary-present is not done.
- HOLD file or `:11434` down → skip the pulse, do not stamp success.

STRATAGROK ranks; specialists execute. André gates stay André.

## Public hop (AskWatch / off-LAN)

`https://ollama.calhegasmorais.pt` is a **bearer proxy** onto Mac `:11434`.
Unauthenticated GET returns `401 {"error":"unauthorized"}` — that is live, not WAF 403.

| Who | URL | Auth |
|---|---|---|
| Hermes / OpenClaw / OpenCode on the Mac | `http://127.0.0.1:11434` | none |
| AskWatch (5G) | `https://ollama.calhegasmorais.pt/v1` | `Authorization: Bearer <vault>` |
| Cloudflare Access field | off | the 401 is the proxy, not Access |

Vault the bearer next to Groq/Cerebras. Never git, never Pages, never Discourse.
Desk metabol (when ALLOW): one specialty pulse; `oracle_live=false`.
T1 WG `10.88.0.2` PASS is orthogonal — LAN proof, not this hostname.
