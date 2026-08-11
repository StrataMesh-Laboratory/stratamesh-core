# Account clearance hierarchy (CMN / Orchestrator chat)

Canonical ladder (do not collapse levels):

| Level | Rank | read | edit | run | Intent |
|-------|------|------|------|-----|--------|
| **public** | 0 | ✓ | | | Informative StrataMesh / CMN only |
| **internal** | 1 | ✓ | | | Lab metrics, architecture |
| **confidential** | 2 | ✓ | ✓ | | Ops detail, edit notes |
| **secret** | 3 | ✓ | ✓ | | Account-class secret; full ops; **no run** |
| **top_secret** | 4 | ✓ | ✓ | ✓ | Gated run: `refresh_tick`, `aiops_cycle`, `status_probe` |

These are **account classifications** (profiles / KV / portal), not cosmetic chat labels.

Wire: `X-Clearance` header, body `clearance`, or token elevation.  
Orchestrator chat must preserve **secret** between **confidential** and **top_secret**.
