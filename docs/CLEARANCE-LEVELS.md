# Account clearance (not a chat menu)

Clearance is an **attribute of the account** (`users.clearance_level` in Auth D1), resolved via **session token**.  
It is **not** an optional dropdown the client may choose to escalate.

## Ladder

| Account values (examples) | Effective level | read | edit | run |
|---------------------------|-----------------|------|------|-----|
| `public`, `basic`, `0`, guest | **public** | ✓ | | |
| `internal`, `lab`, `operator` | **internal** | ✓ | | |
| `confidential`, `staff` | **confidential** | ✓ | ✓ | |
| `secret`, `admin` | **secret** | ✓ | ✓ | |
| `top_secret`, `root`, `ts` | **top_secret** | ✓ | ✓ | ✓ |

## Rules

1. Anonymous / no session → **public** only.  
2. `body.clearance` or `X-Clearance` **cannot elevate** above `users.clearance_level`.  
3. `run *` only when effective level is **top_secret**.  
4. UI shows account clearance as **read-only**; session token is how you authenticate.

## Wire

- Session: `Authorization: Bearer <session token>`  
- Orchestrator loads `sessions` → `users.clearance_level` via `AUTH_DB`  
- Tables: `users.clearance_level`, `clearance_levels` (legacy grants)
