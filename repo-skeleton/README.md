# StrataMesh Core

Open-source foundational components of the StrataMesh Distributed Ledger Technology.

**Status:** Phase 0 — Initial repository skeleton  
**Node:** Calhegas Morais Fog Node (FOG-NODE-PT-CM-001)  
**Specification baseline:** Whitepaper + Public Roadmap v0.1

## Repository Layout (planned)

```
stratamesh-core/
├── docs/
│   ├── ROADMAP-PUBLIC-v0.1.md
│   ├── whitepaper.md
│   └── status-endpoint-spec.md
├── contracts/
│   └── SPA-FogNode-v0.1-draft.md
├── src/
│   ├── tip_selection/
│   ├── dag/
│   ├── ipfs_linkage/
│   └── spa/
├── tests/
├── formal/          # formal verification artefacts
└── README.md
```

## Current Artefacts
- Public roadmap
- Fog Node SPA draft template
- Tip-selection design skeleton
- Status endpoint specification

## Development Process
- All consensus-critical code will be developed in the open.
- Tip-selection and validation rules are subject to community refinement and formal verification.
- The Orchestrator (AIOps) manages day-to-day task decomposition; irreversible decisions escalate to designated humans.

## Licence
To be confirmed by foundational DAO (strong preference for permissive open-source licence compatible with formal verification tooling).

---

Intelligentia · Vigilantia · Veritas
